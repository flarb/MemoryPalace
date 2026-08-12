/**
 * MemoryPalace — main experience script (Wednesday milestone: palace sessions
 * + persistence).
 *
 * State machine:
 *   MODAL     start modal visible (Create / Edit / Explore / Train); the sigil
 *             cluster is hidden — it exists only inside sessions (DESIGN.md).
 *   SESSION   editing session: sigil cluster live (hand on device, parked in
 *             editor). Swirl tap → capture wizard; gem tap → memory card;
 *             Done chip → save → MODAL. Auto-saves after every capture/delete.
 *   AIMING    reticle at gaze; pinch (device) / click (editor) confirms.
 *   LISTENING ASR streams onto the transcript card; auto-stop on ~1.2 s
 *             silence or pinch/click; canned transcript in the editor.
 *   → gem drops at the anchor, memory recorded, auto-saved, back to SESSION.
 *
 * Persistence: PalaceStore (global.persistentStorageSystem). Spatial Anchors
 * deferred — raw world poses are the v1 (DESIGN.md "Location linking").
 *
 * All 3D content assembles here at runtime (script-driven scene assembly);
 * every visible string lives in MemoryPalaceUI.
 */
import { MemoryPalaceUI } from "./MemoryPalaceUI";
import { SigilController } from "./SigilController";
import { ReticleController } from "./ReticleController";
import { GemFactory } from "./GemFactory";
import { AsrController } from "./AsrController";
import {
  PalaceStore, Palace, MemoryRecord,
  toStoredVec3, fromStoredVec3, freshMemoryId, MAX_MEMORIES_PER_PALACE,
} from "./PalaceStore";
import { EnhanceService, EnhanceKind, buildEnhancePrompt, averageTextureColor } from "./EnhanceService";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

const BRAND_MAT = requireAsset("../SimpleVertexBaseColor.lspkg/vertexBaseColorMaterial.mat") as Material;
const GAZE_HUM = requireAsset("../GeneratedSFX/gazehum.wav") as AudioTrackAsset;

const PLACED_GEM_SCALE = 0.15;                  // ~9 cm
const AIM_DISTANCE = 150;                       // cm along gaze (reticle + gem)
const PINCH_DEBOUNCE_S = 0.4;
const GEM_SURFACE_OFFSET = 5;                   // cm along the hit normal (half gem + clearance)
const CARD_DISTANCE = 90;                       // cm ahead for the listening card
const CARD_DROP = 12;                           // cm below gaze in the view plane (~8° — lower-mid, clear of FOV bottom)
const CARD_LERP = 8;                            // soft-follow responsiveness
const MEMCARD_LIFT = 14;                        // cm above a selected gem
const MEMCARD_PULL = 12;                        // cm from the gem toward the viewer
const FLASH_S = 2.4;                            // transient status flash duration

const GAZE_COS = Math.cos((8 * Math.PI) / 180); // gaze cone half-angle 8°
const GAZE_RANGE = 500;                         // cm — gaze reveal reach
const GAZE_DWELL_S = 0.8;                       // hold before the label blooms
const GAZE_GRACE_S = 1.2;                       // label lingers after gaze leaves
const GAZE_LABEL_LIFT = 11;                     // cm above the gem

type WizardState = "MODAL" | "SESSION" | "AIMING" | "LISTENING";

@component
export class MemoryPalace extends BaseScriptComponent {
  // Inspector toggle: wireframe every collider for hit-zone diagnosis.
  @input
  debugColliders: boolean = false;

  // Wired by the bootstrap to the UI panel's ScriptComponent (typed as the
  // UI class directly — no .getScript(), no cast).
  @input
  uiHud!: MemoryPalaceUI;

  private state: WizardState = "MODAL";
  private camera = WorldCameraFinderProvider.getInstance();
  private sigil!: SigilController;
  private reticle!: ReticleController;
  private gems!: GemFactory;
  private asr = new AsrController();
  private store!: PalaceStore;
  private enhancer = new EnhanceService();
  private enhanceMeshMat!: Material;
  private palace: Palace | null = null;
  private selectedMemoryId: string | null = null;

  private editorMode = global.deviceInfoSystem.isEditor();
  private stateAge = 0;
  private cardPos = vec3.zero();
  private cardRot = quat.quatIdentity();
  private flashRemaining = 0;

  // Gaze-reveal state (the Learn tier of the vanishing interface).
  private gazeTargetId: string | null = null;
  private gazeDwell = 0;
  private gazeRevealed = false;
  private gazeGrace = 0;
  private gazeAudio: AudioComponent | null = null;

  onAwake() {
    this.buildScene();
    this.store = new PalaceStore();
    this.sigil.setActive(false);   // cluster is session-only (MODAL at boot)

    this.createEvent("UpdateEvent").bind(() => this.onUpdate());

    // Editor: mouse click = TapEvent — the explicit place/stop confirm.
    // Device uses raw pinch (OnStart below). No auto-placement anywhere.
    // SESSION clicks land on Interactables (swirl/chip/gems/buttons); the
    // TapEvent that fires alongside them is ignored outside AIMING/LISTENING.
    this.createEvent("TapEvent").bind(() => {
      if (this.editorMode) this.onConfirmGesture();
    });

    this.createEvent("OnStartEvent").bind(() => {
      // UI events (Channel A).
      this.uiHud.onCreate.add(() => this.onCreatePalace());
      this.uiHud.onEditRequested.add(() => {
        this.uiHud.showPalacePicker(this.store.listPalaces().map((s) => ({
          id: s.id, name: s.name, memoryCount: s.memoryCount,
        })));
      });
      this.uiHud.onEditPalace.add((id: string) => this.onEditPalace(id));
      this.uiHud.onCardDelete.add(() => this.onDeleteSelected());
      this.uiHud.onCardClose.add(() => this.closeMemoryCard());
      this.uiHud.onCardEnhanceMesh.add(() => this.onEnhanceSelected("mesh"));
      this.uiHud.onCardEnhanceImage.add(() => this.onEnhanceSelected("image"));
      this.uiHud.onCardEnhanceRemove.add(() => this.onRemoveEnhancement());
      // Explore/Train: the UI shows its own coming-soon hint (Wednesday scope).

      // Sigil cluster (SIK subscriptions bind in OnStart).
      this.sigil.start();
      this.sigil.onTapped.add(() => this.startWizard());
      this.sigil.onDoneTapped.add(() => this.finishSession());

      if (this.editorMode) {
        this.uiHud.setHintText("Press New to start a palace");
        this.uiHud.setCardHint("Click to finish");
      }

      // Raw pinch (either hand) confirms aim / stops listening on device.
      const handProvider = HandInputData.getInstance();
      const onPinch = () => this.onPinchDown();
      handProvider.getHand("left").onPinchDown.add(onPinch);
      handProvider.getHand("right").onPinchDown.add(onPinch);
    });

    if (this.debugColliders) {
      this.setColliderDebugAll(this.getSceneObject(), true);
    }
  }

  // ── Scene assembly (script-driven; wrapper pattern per Hard Rule 6) ────────

  private buildScene(): void {
    const root = this.getSceneObject();

    // Additive brand materials cloned from the vertex-color pack.
    const ribbonMatA = this.makeAdditive(BRAND_MAT.clone());
    const ribbonMatB = this.makeAdditive(BRAND_MAT.clone());
    const glowMat = this.makeAdditive(BRAND_MAT.clone());
    const ringMat = this.makeAdditive(BRAND_MAT.clone());

    this.sigil = new SigilController(root, ribbonMatA, ribbonMatB, glowMat);
    this.reticle = new ReticleController(root, ringMat, glowMat);
    this.gems = new GemFactory(root, BRAND_MAT);

    // Plain (non-additive) vertex-color clone for Snap3D GLBs — pairs with
    // use_vertex_color; never pass null to the gltf loader (editor crash).
    this.enhanceMeshMat = BRAND_MAT.clone();

    // Faint dwell hum for the gaze reveal (loops while the ring builds).
    const humObj = global.scene.createSceneObject("GazeHum");
    humObj.setParent(root);
    this.gazeAudio = humObj.createComponent("Component.AudioComponent") as AudioComponent;
    this.gazeAudio.audioTrack = GAZE_HUM;
    this.gazeAudio.playbackMode = Audio.PlaybackMode.LowLatency;
    this.gazeAudio.volume = 0.22;
  }

  private makeAdditive(mat: Material): Material {
    mat.mainPass.twoSided = true;
    mat.mainPass.depthWrite = false;
    mat.mainPass.blendMode = BlendMode.Add;   // dark vertex color = transparent
    return mat;
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  private onCreatePalace(): void {
    if (this.state !== "MODAL") return;
    this.palace = this.store.createPalace();
    this.enterSession(false);
  }

  private onEditPalace(id: string): void {
    if (this.state !== "MODAL") return;
    const loaded = this.store.load(id);
    if (loaded === null) {
      this.uiHud.showToast("Couldn't load that palace");
      return;
    }
    this.palace = loaded;
    for (const rec of loaded.memories) {
      this.spawnMemoryGem(rec);
      // Conjured imagery regenerates lazily — gems hatch as the palace wakes.
      if (rec.enhance !== undefined) this.startEnhance(rec, true);
    }
    this.enterSession(true);
  }

  private enterSession(restored: boolean): void {
    this.uiHud.hideModal();
    this.sigil.setActive(true);
    this.setState("SESSION");
    if (restored && this.palace !== null && this.palace.memories.length > 0) {
      this.flash("Palace restored (" + this.palace.memories.length + ")",
        this.camera.getForwardPosition(100, false));
    }
  }

  /** Done chip: save the palace (auto-saves already ran) and return home. */
  private finishSession(): void {
    if (this.state !== "SESSION") return;
    this.closeMemoryCard();
    this.gems.despawnAll();
    this.uiHud.hideSigilLabel();
    this.uiHud.hideDoneLabel();
    this.uiHud.hideStatus();
    this.flashRemaining = 0;
    this.sigil.setActive(false);

    const p = this.palace;
    this.palace = null;
    this.uiHud.showModal();
    if (p !== null) {
      if (p.memories.length === 0 && !this.store.has(p.id)) {
        print("MemoryPalace: empty unsaved palace discarded (" + p.id + ")");
        this.uiHud.showToast("Empty palace discarded");
      } else {
        this.store.save(p);
        this.uiHud.showToast("Palace saved — " + p.memories.length +
          (p.memories.length === 1 ? " memory" : " memories"));
      }
    }
    this.setState("MODAL");
  }

  // ── Wizard flow ────────────────────────────────────────────────────────────

  private startWizard(): void {
    if (this.state !== "SESSION") return;
    if (this.palace === null) return;
    if (this.palace.memories.length >= MAX_MEMORIES_PER_PALACE) {
      this.flash("Palace is full", this.camera.getForwardPosition(80, false));
      return;
    }
    this.closeMemoryCard();
    this.setState("AIMING");
    this.uiHud.hideSigilLabel();
    this.uiHud.hideDoneLabel();
    this.sigil.setActive(false);
    this.reticle.show();
    this.flashRemaining = 0;
    this.uiHud.showStatus();
    this.uiHud.setStatusText(this.editorMode ? "Click to place" : "Pinch to place");
  }

  private confirmPlacement(): void {
    if (this.state !== "AIMING") return;
    this.setState("LISTENING");
    this.uiHud.hideStatus();
    // Caption-style card: seed at the lower-third target, then soft-follow.
    const seed = this.cardTargetPose();
    this.cardPos = seed.pos;
    this.cardRot = seed.rot;
    this.uiHud.setTranscriptCardPose(this.cardPos, this.cardRot);
    this.uiHud.showTranscript();
    this.asr.start({
      onPartial: (t) => this.uiHud.setTranscript(t),
      onFinal: (t) => this.finishCapture(t),
      onError: (msg) => {
        this.uiHud.setListeningState(msg + " — Try again");
        this.finishCapture("");
      },
    });
  }

  private finishCapture(transcript: string): void {
    if (this.state !== "LISTENING") return;
    const anchor = this.reticle.getPoint();
    const surfaceNormal = this.reticle.getNormal();
    this.reticle.hide();
    this.uiHud.hideTranscript();

    let flashText = "Capture cancelled";
    let flashPos = this.camera.getForwardPosition(80, false);

    if (transcript.length > 0 && this.palace !== null) {
      // The gem IS the memory marker (DESIGN.md) — sits just off the surface
      // when the reticle snapped, free-floats otherwise.
      const gemPos = surfaceNormal !== null
        ? anchor.add(surfaceNormal.uniformScale(GEM_SURFACE_OFFSET))
        : anchor;
      const rec: MemoryRecord = {
        id: freshMemoryId(),
        transcript: transcript,
        position: toStoredVec3(gemPos),
        createdAt: Date.now(),
      };
      if (surfaceNormal !== null) rec.surfaceNormal = toStoredVec3(surfaceNormal);
      this.palace.memories.push(rec);
      this.spawnMemoryGem(rec, true);   // fresh placement = arrival juice + SFX
      this.store.save(this.palace);   // auto-save after every capture
      print("MemoryPalace: captured \"" + transcript + "\" (" +
        this.palace.memories.length + " memories in " + this.palace.name + ")");
      flashText = "Memory placed (" + this.palace.memories.length + ")";
      flashPos = new vec3(gemPos.x, gemPos.y + 12, gemPos.z);
    } else {
      print("MemoryPalace: capture cancelled (empty transcript)");
    }

    // Both editor and device return to the session — the sigil cluster is the
    // next-capture affordance; the Done chip is the exit.
    this.sigil.setActive(true);
    this.setState("SESSION");
    this.flash(flashText, flashPos);
  }

  // ── Gem selection → memory card ────────────────────────────────────────────

  private spawnMemoryGem(rec: MemoryRecord, arrive: boolean = false): void {
    const pos = fromStoredVec3(rec.position);
    // Surface-attached memories get a light pool at their base (and the
    // placement burst uses the same point + normal).
    let surface: { point: vec3; normal: vec3 } | undefined = undefined;
    if (rec.surfaceNormal !== undefined) {
      const n = fromStoredVec3(rec.surfaceNormal).normalize();
      surface = { point: pos.sub(n.uniformScale(GEM_SURFACE_OFFSET)), normal: n };
    }
    this.gems.spawn(pos, PLACED_GEM_SCALE, rec.id,
      (memoryId) => this.onGemSelected(memoryId),
      { surface: surface, arrive: arrive });
  }

  private onGemSelected(memoryId: string): void {
    if (this.state !== "SESSION" || this.palace === null) return;
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === memoryId) { rec = m; break; }
    }
    if (rec === null) return;
    this.selectedMemoryId = memoryId;

    // Card blooms above the gem, pulled toward the viewer, facing the user.
    const base = fromStoredVec3(rec.position);
    const camPos = this.camera.getWorldPosition();
    const toGem = camPos.sub(base);
    const dir = toGem.length > 1 ? toGem.normalize() : vec3.forward();
    const pos = new vec3(base.x, base.y + MEMCARD_LIFT, base.z).add(dir.uniformScale(MEMCARD_PULL));
    // LS API: quat.lookAt aims +Z along its arg; panel front is +Z → aim +Z
    // AT the camera (the proven Tuesday convention).
    const toCam = camPos.sub(pos).normalize();
    const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
    this.uiHud.showMemoryCard(rec.transcript, pos, quat.lookAt(toCam, upRef),
      rec.enhance !== undefined);
    print("MemoryPalace: selected memory \"" + rec.transcript + "\" (" + memoryId + ")");
  }

  // ── Enhance (conjured imagery via Remote Service Gateway) ──────────────────

  private onEnhanceSelected(kind: EnhanceKind): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    const id = this.selectedMemoryId;
    if (this.enhancer.isBusy(id)) {
      this.flash("Already conjuring this memory", this.gems.basePosition(id));
      return;
    }
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === id) { rec = m; break; }
    }
    if (rec === null) return;
    rec.enhance = { kind: kind, prompt: buildEnhancePrompt(kind, rec.transcript) };
    this.store.save(this.palace);   // the conjure request persists with the palace
    this.closeMemoryCard();
    this.startEnhance(rec, false);
  }

  private onRemoveEnhancement(): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    const id = this.selectedMemoryId;
    for (const m of this.palace.memories) {
      if (m.id === id) { delete m.enhance; break; }
    }
    this.store.save(this.palace);
    this.gems.removeEnhanced(id);
    this.closeMemoryCard();
    const p = this.gems.basePosition(id);
    this.flash("Enhancement removed",
      p !== null ? new vec3(p.x, p.y + 12, p.z) : null);
    print("MemoryPalace: enhancement removed for " + id);
  }

  /** Kick generation for a memory's stored enhance spec; visuals hatch async. */
  private startEnhance(rec: MemoryRecord, quiet: boolean): void {
    if (rec.enhance === undefined) return;
    const flashAt = (): vec3 | null => {
      const p = this.gems.basePosition(rec.id);
      return p !== null ? new vec3(p.x, p.y + 12, p.z) : null;
    };
    if (!quiet) {
      this.flash(rec.enhance.kind === "mesh" ? "Conjuring object…" : "Conjuring image…", flashAt());
    }
    print("MemoryPalace: conjuring " + rec.enhance.kind + " for \"" + rec.transcript + "\"");
    this.gems.setConjuring(rec.id, true);   // spinning halo while we wait

    if (rec.enhance.kind === "image") {
      this.enhancer.generateImage(rec.id, rec.enhance.prompt)
        .then((tex) => {
          this.gems.setConjuring(rec.id, false);
          if (this.gems.setEnhancedImage(rec.id, tex)) {
            this.gems.setGlowTint(rec.id, averageTextureColor(tex));
            this.flash("✓ Image conjured", flashAt());
            print("MemoryPalace: image conjured for " + rec.id);
          }
        })
        .catch((msg) => {
          this.gems.setConjuring(rec.id, false);
          this.flash("Conjure failed — try again", flashAt());
          print("MemoryPalace: image conjure failed — " + msg);
        });
    } else {
      this.enhancer.generateMesh(rec.id, rec.enhance.prompt,
        (preview) => {
          // The concept image lands before the mesh — tint the light pool so
          // the glow foreshadows the object's palette.
          this.gems.setGlowTint(rec.id, averageTextureColor(preview));
        },
        (baseMesh) => {
          this.gems.setConjuring(rec.id, false);
          if (this.gems.setEnhancedMesh(rec.id, baseMesh, this.enhanceMeshMat)) {
            this.flash("✓ Object conjured (refining…)", flashAt());
            print("MemoryPalace: base mesh conjured for " + rec.id);
          }
        },
        (refinedMesh) => {
          this.gems.setEnhancedMesh(rec.id, refinedMesh, this.enhanceMeshMat);
          print("MemoryPalace: refined mesh swapped in for " + rec.id);
        },
        (msg) => {
          this.gems.setConjuring(rec.id, false);
          this.flash("Conjure failed — try again", flashAt());
          print("MemoryPalace: mesh conjure failed — " + msg);
        });
    }
  }

  private onDeleteSelected(): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    const id = this.selectedMemoryId;
    let deletedPos: vec3 | null = null;
    for (const m of this.palace.memories) {
      if (m.id === id) { deletedPos = fromStoredVec3(m.position); break; }
    }
    this.gems.vaporize(id);   // punch-out + vapor burst + SFX (delete effect)
    this.palace.memories = this.palace.memories.filter((m) => m.id !== id);
    this.store.save(this.palace);   // auto-save after every delete
    this.closeMemoryCard();
    print("MemoryPalace: deleted memory " + id + " (" +
      this.palace.memories.length + " remain)");
    this.flash("Memory deleted", deletedPos !== null
      ? new vec3(deletedPos.x, deletedPos.y + 10, deletedPos.z)
      : this.camera.getForwardPosition(80, false));
  }

  private closeMemoryCard(): void {
    this.uiHud.hideMemoryCard();
    this.selectedMemoryId = null;
  }

  // ── Gestures & helpers ─────────────────────────────────────────────────────

  private onPinchDown(): void {
    this.onConfirmGesture();
  }

  // ── Gaze reveal ────────────────────────────────────────────────────────────

  private updateGaze(dt: number, camPos: vec3): void {
    const fwdPoint = this.camera.getForwardPosition(100, false);
    const fwd = fwdPoint.sub(camPos).normalize();

    // Best candidate: tightest angle inside the cone, within reach.
    let bestId: string | null = null;
    let bestCos = GAZE_COS;
    for (const c of this.gems.gazeCandidates()) {
      const v = c.pos.sub(camPos);
      const dist = v.length;
      if (dist > GAZE_RANGE || dist < 20) continue;
      const cos = v.normalize().dot(fwd);
      if (cos > bestCos) { bestCos = cos; bestId = c.memoryId; }
    }

    if (bestId === this.gazeTargetId) {
      this.gazeGrace = 0;
      if (bestId === null) return;
      this.gazeDwell += dt;
      if (!this.gazeRevealed && this.gazeDwell >= GAZE_DWELL_S) {
        this.gazeRevealed = true;
        if (this.gazeAudio !== null) this.gazeAudio.stop(false);
        let transcript = "";
        if (this.palace !== null) {
          for (const m of this.palace.memories) {
            if (m.id === bestId) { transcript = m.transcript; break; }
          }
        }
        this.uiHud.setGazeLabelText(transcript);
        this.uiHud.showGazeLabel();
        print("MemoryPalace: gaze reveal \"" + transcript + "\"");
      }
      if (this.gazeRevealed) {
        const p = this.gems.basePosition(bestId);
        if (p !== null) {
          this.uiHud.setGazeLabelPosition(new vec3(p.x, p.y + GAZE_LABEL_LIFT, p.z));
        }
      }
      return;
    }

    // Target changed. A revealed label gets a grace period against flicker.
    if (bestId === null && this.gazeRevealed && this.gazeGrace < GAZE_GRACE_S) {
      this.gazeGrace += dt;
      return;
    }
    this.clearGaze();
    if (bestId !== null) {
      this.gazeTargetId = bestId;
      this.gems.setGazeRing(bestId);
      if (this.gazeAudio !== null) this.gazeAudio.play(-1);   // faint loop while dwelling
    }
  }

  private clearGaze(): void {
    if (this.gazeAudio !== null) this.gazeAudio.stop(false);
    this.gems.setGazeRing(null);
    this.uiHud.hideGazeLabel();
    this.gazeTargetId = null;
    this.gazeDwell = 0;
    this.gazeRevealed = false;
    this.gazeGrace = 0;
  }

  /** Lower-third caption pose: ahead of gaze, dropped in the view plane. */
  private cardTargetPose(): { pos: vec3; rot: quat } {
    const camPos = this.camera.getWorldPosition();
    const fwdPoint = this.camera.getForwardPosition(CARD_DISTANCE, false);
    const viewDir = fwdPoint.sub(camPos).normalize();
    let right = viewDir.cross(vec3.up());
    if (right.length < 0.05) right = vec3.right();   // looking straight up/down
    right = right.normalize();
    const viewUp = right.cross(viewDir).normalize();
    const pos = fwdPoint.sub(viewUp.uniformScale(CARD_DROP));
    // LS API: vec3.forward() is +Z, so quat.lookAt aims +Z along its arg.
    // Panel front is +Z → aim it AT the camera (roll-free via viewUp).
    const rot = quat.lookAt(viewDir.uniformScale(-1), viewUp);
    return { pos: pos, rot: rot };
  }

  /** Shared confirm: pinch on device, tap/click in the editor. */
  private onConfirmGesture(): void {
    if (this.stateAge < PINCH_DEBOUNCE_S) return;   // ignore the gesture that got us here
    if (this.state === "AIMING") {
      this.confirmPlacement();
    } else if (this.state === "LISTENING") {
      this.asr.stopNow();
    }
  }

  /** Transient status flash (billboarded caption) — session feedback juice. */
  private flash(text: string, worldPos: vec3): void {
    this.uiHud.setStatusText(text);
    this.uiHud.showStatus();
    this.uiHud.setStatusPosition(worldPos);
    this.flashRemaining = FLASH_S;
  }

  private setState(s: WizardState): void {
    print("MemoryPalace: state " + this.state + " → " + s);
    this.state = s;
    this.stateAge = 0;
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  private onUpdate(): void {
    const dt = getDeltaTime();
    this.stateAge += dt;
    const camPos = this.camera.getWorldPosition();

    this.sigil.update(dt, camPos);
    this.gems.update(dt, camPos);
    this.asr.update(dt);

    // Status flash countdown (AIMING owns the status line exclusively).
    if (this.flashRemaining > 0 && this.state !== "AIMING") {
      this.flashRemaining -= dt;
      if (this.flashRemaining <= 0) this.uiHud.hideStatus();
    }

    // Sigil cluster labels ride the swirl + Done chip during sessions.
    if (this.state === "SESSION") {
      const anchor = this.sigil.getLabelAnchor();
      if (anchor !== null) {
        this.uiHud.showSigilLabel();
        this.uiHud.setSigilLabelPosition(anchor);
      } else {
        this.uiHud.hideSigilLabel();
      }
      const doneAnchor = this.sigil.getDoneLabelAnchor();
      if (doneAnchor !== null) {
        this.uiHud.showDoneLabel();
        this.uiHud.setDoneLabelPosition(doneAnchor);
      } else {
        this.uiHud.hideDoneLabel();
      }
    }

    if (this.state === "AIMING") {
      const gaze = this.camera.getForwardPosition(AIM_DISTANCE, false);
      this.reticle.update(dt, camPos, gaze);

      // Status label floats above the anchor point, pulled toward the viewer
      // so it never buries into the surface the reticle snapped to.
      const p = this.reticle.getPoint();
      const toCam = camPos.sub(p).normalize();
      this.uiHud.setStatusPosition(
        new vec3(p.x, p.y + 8, p.z).add(toCam.uniformScale(5)));
    }

    // Gaze reveal: dwelling on a gem earns its orbit ring, motes, hum — then
    // the memory's words bloom above it. Only while free-walking the session.
    if (this.state === "SESSION" && this.selectedMemoryId === null) {
      this.updateGaze(dt, camPos);
    } else if (this.gazeTargetId !== null || this.gazeRevealed) {
      this.clearGaze();
    }

    if (this.state === "LISTENING") {
      // Soft head-follow: the card is speech UI, not world furniture — it
      // rides the lower third of view so it stays readable while talking.
      const target = this.cardTargetPose();
      const k = Math.min(1, dt * CARD_LERP);
      this.cardPos = vec3.lerp(this.cardPos, target.pos, k);
      this.cardRot = quat.slerp(this.cardRot, target.rot, k);
      this.uiHud.setTranscriptCardPose(this.cardPos, this.cardRot);
    }
  }

  // ── Debug: wireframe all colliders (Hard Rule 6.7) ─────────────────────────

  private setColliderDebugAll(obj: SceneObject, enable: boolean): void {
    const c = obj.getComponent("Physics.ColliderComponent") as ColliderComponent | null;
    if (c) c.debugDrawEnabled = enable;
    const b = obj.getComponent("Physics.BodyComponent") as ColliderComponent | null;
    if (b) b.debugDrawEnabled = enable;
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      this.setColliderDebugAll(obj.getChild(i), enable);
    }
  }
}
