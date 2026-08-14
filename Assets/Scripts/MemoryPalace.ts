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
 *   EXPLORE   view-only walk of a chosen palace (Edit / Explore / Train all
 *             share the saved-palace picker; it only appears when more than
 *             one palace exists, since a palace is bound to a physical room
 *             and guessing wrong scatters gems across the wrong anchors):
 *             distant anchors glint and resolve on approach; ONE proximity
 *             whisper (per-memory TTS) at a time; select → read-only card +
 *             full playback. No sigil swirl, no edit affordances — the Done
 *             chip (the existing modal-summon affordance) walks back to MODAL.
 *
 * Persistence: PalaceStore (global.persistentStorageSystem). Spatial Anchors
 * deferred — raw world poses are the v1 (DESIGN.md "Location linking").
 *
 * All 3D content assembles here at runtime (script-driven scene assembly);
 * every visible string lives in MemoryPalaceUI.
 */
import { MemoryPalaceUI, PalacePick, PalacePickerIntent } from "./MemoryPalaceUI";
import { SigilController } from "./SigilController";
import { ReticleController } from "./ReticleController";
import { GemFactory } from "./GemFactory";
import { ExploreController } from "./ExploreController";
import { TrainController } from "./TrainController";
import { AsrController } from "./AsrController";
import {
  PalaceStore, Palace, MemoryRecord,
  toStoredVec3, fromStoredVec3, freshMemoryId, MAX_MEMORIES_PER_PALACE,
  routeOrder, normalizeRoute, moveInRoute,
} from "./PalaceStore";
import { EnhanceService, EnhanceKind, buildEnhancePrompt, averageTextureColor } from "./EnhanceService";
import { routeMemory, MemoryRoute, coerceAnim, coerceVfx } from "./MemoryRouter";
import { SnapshotService, Snapshot } from "./SnapshotService";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

const BRAND_MAT = requireAsset("../SimpleVertexBaseColor.lspkg/vertexBaseColorMaterial.mat") as Material;
const GAZE_HUM = requireAsset("../GeneratedSFX/gazehum.wav") as AudioTrackAsset;
const IMAGE_MAT = requireAsset("../Materials/ImageMaterial.mat") as Material;

// Solfeggio arcana SFX (see tempAssetGen/gen_sfx_solfeggio.js for the family).
const SHUTTER_SFX = requireAsset("../GeneratedSFX/shutter.wav") as AudioTrackAsset;
const CARD_OPEN_SFX = requireAsset("../GeneratedSFX/cardopen.wav") as AudioTrackAsset;
const CARD_CLOSE_SFX = requireAsset("../GeneratedSFX/cardclose.wav") as AudioTrackAsset;
const REVEAL_SFX = requireAsset("../GeneratedSFX/reveal.wav") as AudioTrackAsset;
const GRADE_REMEMBER_SFX = requireAsset("../GeneratedSFX/graderemember.wav") as AudioTrackAsset;
const GRADE_ALMOST_SFX = requireAsset("../GeneratedSFX/gradealmost.wav") as AudioTrackAsset;
const GRADE_FORGOT_SFX = requireAsset("../GeneratedSFX/gradeforgot.wav") as AudioTrackAsset;
const COMPLETE_SFX = requireAsset("../GeneratedSFX/complete.wav") as AudioTrackAsset;
const CONJURE_SFX = requireAsset("../GeneratedSFX/conjure.wav") as AudioTrackAsset;
const HATCH_SFX = requireAsset("../GeneratedSFX/hatch.wav") as AudioTrackAsset;
const SPLASH_SFX = requireAsset("../GeneratedSFX/splash.wav") as AudioTrackAsset;

// 2D snapshots: per-palace budget for persisted photo chars — beyond it,
// photos stay in-session only (DESIGN risk note allows exactly that).
const PHOTO_BUDGET_CHARS = 40000;
const HINT_QUAD_CM = 16;   // Train Recall-tier blurred hint quad size

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
const FLASH_FAIL_S = 3.5;                       // failures linger longer (user call)

const GAZE_COS = Math.cos((8 * Math.PI) / 180); // gaze cone half-angle 8°
const GAZE_RANGE = 500;                         // cm — gaze reveal reach
const GAZE_DWELL_S = 0.8;                       // hold before the label blooms
const GAZE_GRACE_S = 1.2;                       // label lingers after gaze leaves
const GAZE_LABEL_LIFT = 11;                     // cm above the gem
const GAZE_DEBUG_RAISE = 7;                     // cm ABOVE the gaze label — below covered the object (user)
const FLASH_GEM_LIFT = 26;                      // cm above a gem — status pills must clear the gaze label at +11 (plate + bob)

type WizardState = "MODAL" | "SESSION" | "AIMING" | "LISTENING" | "EXPLORE" | "TRAIN";

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
  private explore!: ExploreController;
  private train!: TrainController;
  private trainRemembered = 0;
  private palace: Palace | null = null;
  private selectedMemoryId: string | null = null;

  // 2D snapshots: capture service + in-session texture caches + the single
  // reusable blurred-hint quad (only the current Train target ever needs one).
  private snaps = new SnapshotService();
  private snapTex: { [memoryId: string]: Texture } = {};
  private snapTinyTex: { [memoryId: string]: Texture } = {};
  private pendingSnap: Snapshot | null = null;
  /** Set while the post-capture chip is open: X cancels THIS memory only. */
  private freshCaptureId: string | null = null;
  /** User-initiated conjures in flight — the capture swirl hides while any
   *  are pending (user call: no new memory mid-conjure). Quiet load-time
   *  regens don't gate; blocking capture for a minute after load would read
   *  as broken. */
  private conjuringIds: { [id: string]: boolean } = {};
  /** One silent retry per conjure attempt — Snap3D fails intermittently
   *  ("ALD verification failed" seconds after an identical call succeeded). */
  private conjureRetried: { [id: string]: boolean } = {};
  /** Fresh capture whose routing is still in flight. Gates the swirl through
   *  the capture→chip gap — without it the swirl reappeared for the ~2 s the
   *  LLM took, then vanished when the chip opened (user: "timing issue"). */
  private pendingRouteChipId: string | null = null;
  private hintObj: SceneObject | null = null;
  private hintImage: Image | null = null;

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
      this.uiHud.onEditRequested.add(() => this.showPicker("edit"));
      this.uiHud.onPalacePicked.add((p: PalacePick) => this.openPalace(p.id, p.intent));
      this.uiHud.onCardDelete.add(() => this.onDeleteSelected());
      this.uiHud.onCardClose.add(() => this.onCardCloseTapped());
      this.uiHud.onCardEnhanceMesh.add(() => this.onEnhanceSelected("mesh"));
      this.uiHud.onCardEnhanceImage.add(() => this.onEnhanceSelected("image"));
      this.uiHud.onCardEnhanceRemove.add(() => this.onRemoveEnhancement());
      this.uiHud.onCardConjure.add(() => this.onCardConjure());
      this.uiHud.onCardOk.add(() => this.onCardOk());
      this.uiHud.onRouteMove.add((delta) => this.onRouteMove(delta));
      this.uiHud.onGazeLabelHover.add((on) => this.onGazeLabelHover(on));
      this.uiHud.onGazeSpeak.add(() => this.speakGazedMemory());
      this.uiHud.onExplore.add(() => this.requestMode("explore"));
      this.uiHud.onTrain.add(() => this.requestMode("train"));
      this.uiHud.onTrainReveal.add(() => this.revealCurrentLocus());
      this.uiHud.onTrainGrade.add((delta: number) => this.onTrainGrade(delta));

      // Sigil cluster (SIK subscriptions bind in OnStart).
      this.sigil.start();
      this.sigil.onTapped.add(() => this.startWizard());
      this.sigil.onDoneTapped.add(() => {
        // The chip is the modal-summon affordance in every mode.
        if (this.state === "EXPLORE") this.exitExplore();
        else if (this.state === "TRAIN") this.exitTrain();
        else this.finishSession();
      });

      // Modal hint line is now the hover-tooltip slot (empty when idle) —
      // per-button copy lives in MemoryPalaceUI.buildModalContent.
      if (this.editorMode) {
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
    this.explore = new ExploreController(root, this.gems, this.enhancer);
    this.train = new TrainController(this.gems);

    // Plain (non-additive) vertex-color clone for Snap3D GLBs — pairs with
    // use_vertex_color; never pass null to the gltf loader (editor crash).
    this.enhanceMeshMat = BRAND_MAT.clone();

    // Spatial-audio listener rides the camera — required for the Explore
    // whisper's positional mixing (without it LS warns every frame and
    // spatialAudio silently no-ops).
    const camObj = this.camera.getComponent().getSceneObject();
    if (camObj.getComponent("Component.AudioListenerComponent") === null) {
      camObj.createComponent("Component.AudioListenerComponent");
    }

    // Faint dwell hum for the gaze reveal (loops while the ring builds).
    const humObj = global.scene.createSceneObject("GazeHum");
    humObj.setParent(root);
    this.gazeAudio = humObj.createComponent("Component.AudioComponent") as AudioComponent;
    this.gazeAudio.audioTrack = GAZE_HUM;
    this.gazeAudio.playbackMode = Audio.PlaybackMode.LowPower;   // ambient loop (specs-audio)
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

  // ── Opening a saved palace (shared by Edit / Explore / Train) ──────────────

  /** Swap the modal to the saved-palace picker, labelled for `intent`. */
  private showPicker(intent: PalacePickerIntent): void {
    this.uiHud.showPalacePicker(this.store.listPalaces().map((s) => ({
      id: s.id, name: s.name, memoryCount: s.memoryCount,
    })), intent);
  }

  /**
   * Modal button → mode. A palace is bound to a physical room, so with more
   * than one saved we ASK instead of guessing: opening the wrong palace
   * scatters gems across another room's anchors, and nothing on screen would
   * explain why. One palace = no choice to make, so go straight in and the
   * demo path (New → capture → Done → Explore) stays a single press.
   *
   * Edit deliberately keeps its picker even at one palace — it doubles as the
   * only place you can see the palaces you have.
   */
  private requestMode(intent: "explore" | "train"): void {
    if (this.state !== "MODAL") return;
    const list = this.store.listPalaces();
    if (list.length === 0) {
      this.uiHud.showToast(intent === "train"
        ? "Nothing to train yet — press New first"
        : "Nothing to explore yet — press New first");
      return;
    }
    if (list.length === 1) {
      this.openPalace(list[0].id, intent);
      return;
    }
    // listPalaces() is most-recently-updated first, so the palace you just
    // finished editing leads the rows — the old implicit guess, made visible.
    this.showPicker(intent);
  }

  /** A palace was chosen (picker row, or the only one saved) — enter its mode. */
  private openPalace(id: string, intent: PalacePickerIntent): void {
    if (this.state !== "MODAL") return;
    const loaded = this.store.load(id);
    if (loaded === null) {
      this.uiHud.showToast("Couldn't load that palace");
      return;
    }
    // Edit can open an empty palace (that's how you fill it); the read-back
    // modes cannot. Toasting keeps the picker up so another row is one tap away.
    if (intent !== "edit" && loaded.memories.length === 0) {
      this.uiHud.showToast("\"" + loaded.name + "\" has no memories yet");
      return;
    }
    this.palace = loaded;
    if (intent === "edit") this.enterEditSession(loaded);
    else if (intent === "explore") this.enterExplore(loaded);
    else this.enterTrain(loaded);
  }

  private enterEditSession(loaded: Palace): void {
    normalizeRoute(loaded.memories);   // dense 0..n-1 (old saves had no order)
    for (const rec of loaded.memories) {
      this.spawnMemoryGem(rec);
      // Conjured imagery regenerates lazily — gems hatch as the palace wakes.
      if (rec.enhance !== undefined) this.startEnhance(rec, true);
      // Backfill routing for pre-router saves: labels + recipes + a working
      // conjure offer. Quiet — no chips pop on load.
      if (rec.label === undefined) this.routeMemoryFor(rec, false);
    }
    this.refreshRoute();
    this.enterSession(true);
  }

  private enterSession(restored: boolean): void {
    this.uiHud.hideModal();
    this.conjuringIds = {};   // stale in-flight gates die with their session
    this.pendingRouteChipId = null;
    this.sigil.setChipOnly(false);   // full cluster — sessions are for editing
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

  // ── Explore mode (view-only walk of the active palace) ─────────────────────

  private enterExplore(loaded: Palace): void {
    normalizeRoute(loaded.memories);
    for (const rec of loaded.memories) {
      this.spawnMemoryGem(rec);
      // Conjured imagery regenerates lazily — gems hatch as the palace wakes.
      if (rec.enhance !== undefined) this.startEnhance(rec, true);
    }
    this.refreshRoute();   // the journey is legible while you walk it
    this.uiHud.hideModal();
    this.sigil.setChipOnly(true);   // Done chip = the way home; no edit affordances
    this.sigil.setActive(true);
    this.explore.begin(loaded.memories);
    this.explore.update(0, this.camera.getWorldPosition());   // LOD before first frame
    this.setState("EXPLORE");
    this.flash("Exploring \"" + loaded.name + "\"",
      this.camera.getForwardPosition(100, false));
    print("MemoryPalace: exploring \"" + loaded.name + "\" (" +
      loaded.memories.length + " memories)");
  }

  /** Done chip during EXPLORE: nothing to save — just walk back to the modal. */
  private exitExplore(): void {
    if (this.state !== "EXPLORE") return;
    this.explore.end();
    this.closeMemoryCard();
    this.gems.despawnAll();
    this.uiHud.hideSigilLabel();
    this.uiHud.hideDoneLabel();
    this.uiHud.hideStatus();
    this.flashRemaining = 0;
    this.sigil.setActive(false);
    this.sigil.setChipOnly(false);
    this.palace = null;   // view-only: nothing changed, nothing to save
    this.uiHud.showModal();
    this.setState("MODAL");
  }

  // ── Train mode v1 (recall quiz over the active palace, capture order) ──────

  private enterTrain(loaded: Palace): void {
    this.trainRemembered = 0;
    normalizeRoute(loaded.memories);
    for (const rec of loaded.memories) {
      // Quiz: every locus starts hidden as a bare glow (no enhance regen —
      // conjured visuals would be hidden anyway and RSG tokens are precious).
      this.spawnMemoryGem(rec);
      this.gems.setResolved(rec.id, false);
    }
    // The ribbon and the next-locus ring are content-free by construction, so
    // they guide the walk without leaking any answer.
    this.refreshRoute();
    this.uiHud.hideModal();
    this.sigil.setChipOnly(true);   // Done chip = the way home; no edit affordances
    this.sigil.setActive(true);
    this.train.begin(routeOrder(loaded.memories), (memoryId) => this.trainPromptFor(memoryId));
    this.markNextLocus();
    this.setState("TRAIN");
    this.flash("Training \"" + loaded.name + "\" — follow the ping",
      this.camera.getForwardPosition(100, false));
    print("MemoryPalace: training \"" + loaded.name + "\" (" +
      loaded.memories.length + " loci)");
  }

  /** Arrived at the target locus: pre-reveal presentation per mastery tier. */
  private trainPromptFor(memoryId: string): void {
    if (this.state !== "TRAIN" || this.palace === null) return;
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === memoryId) { rec = m; break; }
    }
    if (rec === null) return;
    const mastery = rec.mastery !== undefined ? rec.mastery : 0;
    // Vanishing interface: Learn (0) = gem + words, Practice (1) = gem only,
    // Recall (2) = blurred snapshot when the memory has one (else bare glow),
    // Mastered (3) = bare glow.
    if (mastery <= 1) this.gems.setResolved(memoryId, true);
    if (mastery === 0) this.showTrainLabel(rec);
    if (mastery === 2) this.showSnapHint(rec);
    const pose = this.memCardPose(fromStoredVec3(rec.position));
    this.uiHud.showTrainPrompt(pose.pos, pose.rot);
    print("MemoryPalace: train prompt \"" + rec.transcript + "\" (mastery " + mastery + ")");
  }

  /** Reveal button (or a pinch on the target gem when it's tangible). */
  private revealCurrentLocus(): void {
    if (this.state !== "TRAIN" || this.palace === null) return;
    if (!this.train.markRevealed()) return;   // only mid-prompt
    const cur = this.train.current();
    if (cur === null) return;
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === cur.memoryId) { rec = m; break; }
    }
    if (rec === null) return;
    this.hideSnapHint();   // the real thing replaces the blur
    this.gems.setResolved(rec.id, true);
    this.gems.playTrackAt(REVEAL_SFX, fromStoredVec3(rec.position), 0.4);   // soft 528+852 bloom
    this.showTrainLabel(rec);   // words + speaker button (TTS falls back silent)
    const pose = this.memCardPose(fromStoredVec3(rec.position));
    this.uiHud.showTrainGrade(rec.transcript, pose.pos, pose.rot);
    print("MemoryPalace: train reveal \"" + rec.transcript + "\"");
  }

  /** Self-grade: Remembered +1 / Almost 0 / Forgot −1 (mastery 0–3, persisted). */
  private onTrainGrade(delta: number): void {
    if (this.state !== "TRAIN" || this.palace === null) return;
    const cur = this.train.current();
    if (cur === null) return;
    for (const m of this.palace.memories) {
      if (m.id !== cur.memoryId) continue;
      const before = m.mastery !== undefined ? m.mastery : 0;
      m.mastery = Math.max(0, Math.min(3, before + delta));
      print("MemoryPalace: mastery \"" + m.transcript + "\" " + before + " → " +
        m.mastery + (delta > 0 ? " (remembered)" : delta < 0 ? " (forgot)" : " (almost)"));
      break;
    }
    if (delta > 0) this.trainRemembered++;
    // Grade trio: Remembered = bright airy triad (the moment's milestone);
    // Almost = one plain kind 417; Forgot = soft low felt tone, the quietest —
    // never punishing (DESIGN.md sound rule 6).
    const gradePos = this.gems.basePosition(cur.memoryId);
    this.gems.playTrackAt(
      delta > 0 ? GRADE_REMEMBER_SFX : delta < 0 ? GRADE_FORGOT_SFX : GRADE_ALMOST_SFX,
      gradePos !== null ? gradePos : this.camera.getForwardPosition(80, false),
      delta > 0 ? 0.5 : delta < 0 ? 0.3 : 0.35);
    this.store.save(this.palace);   // mastery persists with the palace
    this.uiHud.hideMemoryCard();
    this.uiHud.hideGazeLabel();
    this.hideSnapHint();
    if (this.train.advance()) {
      this.markNextLocus();
      this.flash("Next locus — follow the ping",
        this.camera.getForwardPosition(80, false));
    } else {
      // Seed of DESIGN.md's mastery-melody: completion plays the rising
      // solfeggio phrase (396→528→639→852) — the plan is for mastery tiers
      // to append notes to this exact phrase until the palace plays it whole.
      this.gems.playTrackAt(COMPLETE_SFX,
        this.camera.getForwardPosition(80, false), 0.5);
      const msg = "Route complete — " + this.trainRemembered + "/" +
        this.palace.memories.length + " remembered";
      this.exitTrain();
      this.uiHud.showToast(msg);
      print("MemoryPalace: " + msg);
    }
  }

  /** Ring the locus the route is pointing you at (cleared at the end). */
  private markNextLocus(): void {
    const cur = this.train.current();
    this.gems.setNextLocus(cur !== null ? cur.memoryId : null);
  }

  /** Done chip during TRAIN: mastery already saved per grade — walk home. */
  private exitTrain(): void {
    if (this.state !== "TRAIN") return;
    this.train.end();
    this.uiHud.hideMemoryCard();
    this.uiHud.hideGazeLabel();
    this.hideSnapHint();
    this.gems.despawnAll();
    this.uiHud.hideSigilLabel();
    this.uiHud.hideDoneLabel();
    this.uiHud.hideStatus();
    this.flashRemaining = 0;
    this.sigil.setActive(false);
    this.sigil.setChipOnly(false);
    this.palace = null;
    this.uiHud.showModal();
    this.setState("MODAL");
  }

  /** The memory's words above its gem (reuses the gaze label + speaker). */
  private showTrainLabel(rec: MemoryRecord): void {
    const p = fromStoredVec3(rec.position);
    this.uiHud.setGazeLabelText(rec.transcript);
    this.uiHud.showGazeLabel();
    this.uiHud.setGazeLabelPosition(new vec3(p.x, p.y + GAZE_LABEL_LIFT, p.z));
  }

  /** Card pose above a gem, pulled toward the viewer (memory-card convention). */
  private memCardPose(base: vec3): { pos: vec3; rot: quat } {
    const camPos = this.camera.getWorldPosition();
    const toGem = camPos.sub(base);
    const dir = toGem.length > 1 ? toGem.normalize() : vec3.forward();
    const pos = new vec3(base.x, base.y + MEMCARD_LIFT, base.z).add(dir.uniformScale(MEMCARD_PULL));
    const toCam = camPos.sub(pos).normalize();
    const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
    return { pos: pos, rot: quat.lookAt(toCam, upRef) };
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
    this.snaps.ensureCamera();   // spin up so frames flow by confirm time
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
    // FRAME = the confirm gesture (v1): grab the still NOW, cropped around the
    // confirmed anchor's screen projection — both free-float and surface-pin.
    this.pendingSnap = this.snaps.capture(this.reticle.getPoint(), this.camera.getComponent());
    if (this.pendingSnap !== null) {
      // The capture moment's sound: crystalline 852 Hz etch at the anchor.
      this.gems.playTrackAt(SHUTTER_SFX, this.reticle.getPoint(), 0.38);
    }
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
        order: this.palace.memories.length,   // appended to the end of the route
      };
      if (surfaceNormal !== null) rec.surfaceNormal = toStoredVec3(surfaceNormal);
      if (this.pendingSnap !== null) {
        // The framed crop rides the memory: session cache now, JPEG b64 async.
        this.snapTex[rec.id] = this.pendingSnap.tex;
        this.snapTinyTex[rec.id] = this.pendingSnap.tiny;
        this.persistSnapshot(rec, this.pendingSnap);
      }
      this.palace.memories.push(rec);
      this.spawnMemoryGem(rec, true);   // fresh placement = arrival juice + SFX
      this.store.save(this.palace);   // auto-save after every capture
      this.refreshRoute();            // the ribbon grows with the journey
      this.pendingRouteChipId = rec.id;   // swirl stays hidden until the chip
      this.routeMemoryFor(rec);       // one LLM call → label + recipes + offer
      print("MemoryPalace: captured \"" + transcript + "\" (" +
        this.palace.memories.length + " memories in " + this.palace.name + ")");
      flashText = "Memory placed (" + this.palace.memories.length + ")";
      flashPos = new vec3(gemPos.x, gemPos.y + FLASH_GEM_LIFT, gemPos.z);
    } else {
      print("MemoryPalace: capture cancelled (empty transcript)");
    }

    // Both editor and device return to the session — the sigil cluster is the
    // next-capture affordance; the Done chip is the exit.
    this.pendingSnap = null;
    this.sigil.setActive(true);
    this.setState("SESSION");
    this.applyConjureGate();   // routing pending → the swirl stays down NOW
    this.flash(flashText, flashPos);
  }

  // ── 2D snapshots (capture Step 1 v1 + Train Recall-tier hint) ──────────────

  /** Persist the crop as small JPEGs — a bonus, never a gate (DESIGN risk note). */
  private persistSnapshot(rec: MemoryRecord, shot: Snapshot): void {
    Promise.all([this.snaps.encode(shot.tex), this.snaps.encode(shot.tiny)])
      .then((encoded) => {
        const full = encoded[0];
        const tiny = encoded[1];
        if (this.palace === null) return;   // session already ended
        let used = 0;
        for (const m of this.palace.memories) {
          if (m.snap !== undefined) used += m.snap.length;
          if (m.snapTiny !== undefined) used += m.snapTiny.length;
        }
        if (used + full.length + tiny.length > PHOTO_BUDGET_CHARS) {
          print("MemoryPalace: photo budget reached (" + used +
            " chars used) — this photo stays in-session only");
          return;
        }
        rec.snap = full;
        rec.snapTiny = tiny;
        this.store.save(this.palace);
        print("MemoryPalace: photo persisted (" + full.length + " + " +
          tiny.length + " chars)");
      })
      .catch((e) => print("MemoryPalace: photo encode failed (" + e + ") — in-session only"));
  }

  /** Cached card photo; kicks an async decode of the persisted JPEG if needed. */
  private cardPhotoFor(rec: MemoryRecord): Texture | null {
    const cached = this.snapTex[rec.id];
    if (cached !== undefined) return cached;
    if (rec.snap !== undefined) {
      const id = rec.id;
      this.snaps.decode(rec.snap)
        .then((tex) => {
          this.snapTex[id] = tex;
          if (this.selectedMemoryId === id) this.uiHud.setCardPhoto(tex);
        })
        .catch(() => print("MemoryPalace: photo decode failed for " + id));
    }
    return null;
  }

  /** Train Recall tier: the tiny crop, bilinear-upscaled on a quad = blur. */
  private showSnapHint(rec: MemoryRecord): void {
    const place = (tex: Texture): void => {
      if (this.state !== "TRAIN") return;
      const cur = this.train.current();
      if (cur === null || cur.memoryId !== rec.id) return;   // target moved on
      this.ensureHintQuad();
      this.hintImage!.getMaterial(0).mainPass.baseTex = tex;
      const p = fromStoredVec3(rec.position);
      this.hintObj!.getTransform().setWorldPosition(p);
      this.hintObj!.enabled = true;
      print("MemoryPalace: blurred hint shown for \"" + rec.transcript + "\"");
    };
    const cached = this.snapTinyTex[rec.id];
    if (cached !== undefined) { place(cached); return; }
    if (rec.snapTiny === undefined) return;   // no photo — bare glow, as before
    this.snaps.decode(rec.snapTiny)
      .then((tex) => { this.snapTinyTex[rec.id] = tex; place(tex); })
      .catch(() => print("MemoryPalace: hint decode failed for " + rec.id));
  }

  private hideSnapHint(): void {
    if (this.hintObj !== null) this.hintObj.enabled = false;
  }

  private ensureHintQuad(): void {
    if (this.hintObj !== null) return;
    this.hintObj = global.scene.createSceneObject("SnapHint");
    this.hintObj.setParent(this.getSceneObject());
    const img = this.hintObj.createComponent("Component.Image") as Image;
    const mat = IMAGE_MAT.clone();
    mat.mainPass.depthTest = true;
    mat.mainPass.depthWrite = false;
    img.clearMaterials();
    img.addMaterial(mat);
    this.hintObj.getTransform().setLocalScale(new vec3(HINT_QUAD_CM, HINT_QUAD_CM, 1));
    this.hintImage = img;
    this.hintObj.enabled = false;
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
    // The router's motion + particle recipes ride the memory (DESIGN.md:
    // "Animation is mandatory, not decoration"). Absent = baseline idle.
    if (rec.anim !== undefined || rec.vfx !== undefined) {
      // Coerced, not cast: saves written before "shake" was retired still
      // carry it, and those memories inherit pulse rather than going inert.
      this.gems.setRecipes(rec.id, coerceAnim(rec.anim), coerceVfx(rec.vfx));
    }
  }

  // ── Journeys (DESIGN.md: ordered route, ribbon, next-locus glow) ───────────

  /** Redraw the journey ribbon from the active palace's route order. */
  private refreshRoute(): void {
    if (this.palace === null) { this.gems.clearRoute(); return; }
    const route = routeOrder(this.palace.memories);
    this.gems.setRoute(route.map((m) => fromStoredVec3(m.position)));
  }

  /** Reorder the selected memory along the route (−1 earlier / +1 later). */
  private onRouteMove(delta: number): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    const at = moveInRoute(this.palace.memories, this.selectedMemoryId, delta);
    if (at < 0) {
      this.flash(delta < 0 ? "Already first on the route" : "Already last on the route",
        this.gems.basePosition(this.selectedMemoryId));
      return;
    }
    this.store.save(this.palace);
    this.refreshRoute();
    this.uiHud.setRoutePosition(at + 1, this.palace.memories.length);
    const p = this.gems.basePosition(this.selectedMemoryId);
    this.flash("Locus " + (at + 1) + " of " + this.palace.memories.length,
      p !== null ? new vec3(p.x, p.y + FLASH_GEM_LIFT, p.z) : null);
    print("MemoryPalace: route move " + this.selectedMemoryId + " → position " + (at + 1));
  }

  /** Route index (1-based) of a memory, for the card's locus readout. */
  private routeIndexOf(memoryId: string): number {
    if (this.palace === null) return 0;
    const route = routeOrder(this.palace.memories);
    for (let i = 0; i < route.length; i++) {
      if (route[i].id === memoryId) return i + 1;
    }
    return 0;
  }

  private onGemSelected(memoryId: string): void {
    if (this.state === "TRAIN") {
      // Pinching the target gem = Reveal (reachable when the pre-reveal
      // presentation made the gem tangible — mastery ≤ 1).
      const cur = this.train.current();
      if (cur !== null && cur.memoryId === memoryId) this.revealCurrentLocus();
      return;
    }
    if ((this.state !== "SESSION" && this.state !== "EXPLORE") || this.palace === null) return;
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === memoryId) { rec = m; break; }
    }
    if (rec === null) return;
    this.selectedMemoryId = memoryId;
    this.applyConjureGate();   // card open = swirl yields (SESSION only)

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
      rec.enhance !== undefined, this.state === "EXPLORE");
    this.uiHud.setCardPhoto(this.cardPhotoFor(rec));   // both cards get the photo
    this.uiHud.setRoutePosition(this.routeIndexOf(memoryId), this.palace.memories.length);
    this.uiHud.setConjureKind(this.conjureKindOf(rec));
    this.gems.playTrackAt(CARD_OPEN_SFX, base, 0.3);   // bloom-open arpeggio
    if (this.state === "EXPLORE") {
      // Select = full playback: the whisper's TTS cache at full voice (shared
      // with the gaze speak button; the whisper itself yields while the card
      // is open via setSuppressed in onUpdate).
      this.enhancer.generateSpeech(rec.id, rec.transcript)
        .then((track) => {
          if (this.selectedMemoryId !== memoryId) return;   // card already closed
          const p = this.gems.basePosition(memoryId);
          this.gems.playTrackAt(track, p !== null ? p : base, 0.85);
        })
        .catch((msg) => print("MemoryPalace: explore playback unavailable — " + msg));
    }
    print("MemoryPalace: selected memory \"" + rec.transcript + "\" (" + memoryId + ")");
  }

  // ── The mnemonic router (DESIGN.md "Imagery router") ───────────────────────

  /**
   * One RSG LLM call per capture: the literal transcript becomes a punchy
   * label, an imagery pick with a bizarre-vivid prompt, and the motion/VFX
   * recipes that carry the encoding. The label and recipes apply immediately;
   * the imagery is only an OFFER until the user taps Conjure (DESIGN.md capture
   * Step 4 — "Conjure imagery?"). Routing never blocks and never error-walls:
   * `routeMemory` resolves to a local fallback rather than rejecting.
   */
  private routeMemoryFor(rec: MemoryRecord, openChip: boolean = true): void {
    const palaceAtRequest = this.palace;
    routeMemory(rec.transcript).then((route: MemoryRoute) => {
      // Routing resolved (success or fallback): the swirl-gate for this
      // capture ends here regardless of what happens below.
      if (this.pendingRouteChipId === rec.id) {
        this.pendingRouteChipId = null;
        this.applyConjureGate();
      }
      // The session may have ended, or this memory been deleted, while the
      // call was in flight — both are ordinary, neither is an error.
      if (this.palace === null || this.palace !== palaceAtRequest) return;
      let live = false;
      for (const m of this.palace.memories) {
        if (m.id === rec.id) { live = true; break; }
      }
      if (!live) return;

      rec.label = route.label;
      rec.anim = route.animRecipe;
      rec.vfx = route.vfxRecipe;
      if (route.kind !== "gem") {
        rec.routeKind = route.kind;
        rec.routePrompt = route.prompt;
      }
      this.gems.setRecipes(rec.id, route.animRecipe, route.vfxRecipe);
      this.store.save(this.palace);

      // The conjure chip: only for fresh captures, when the user is idle in
      // the session (no card open) — never for load-time backfill routing.
      if (openChip && this.state === "SESSION" && this.selectedMemoryId === null &&
          rec.routeKind !== undefined) {
        this.openConjureChip(rec);
      }
    });
  }

  /** Post-capture "Conjure imagery?" — the memory card opened straight to it. */
  private openConjureChip(rec: MemoryRecord): void {
    this.selectedMemoryId = rec.id;
    this.freshCaptureId = rec.id;   // X = cancel while THIS card stays open
    this.applyConjureGate();        // card open = swirl yields
    const pose = this.memCardPose(fromStoredVec3(rec.position));
    this.uiHud.showMemoryCard(rec.transcript, pose.pos, pose.rot,
      rec.enhance !== undefined, false, "enhance");
    this.uiHud.setCardPhoto(this.cardPhotoFor(rec));
    this.uiHud.setRoutePosition(this.routeIndexOf(rec.id), this.palace === null ? 0 : this.palace.memories.length);
    this.uiHud.setConjureKind(this.conjureKindOf(rec));
    this.gems.playTrackAt(CARD_OPEN_SFX, fromStoredVec3(rec.position), 0.3);
    print("MemoryPalace: conjure offered for \"" + rec.transcript + "\" (" + rec.routeKind + ")");
  }

  /** The kind the one-tap Conjure button will produce, or null if unrouted. */
  private conjureKindOf(rec: MemoryRecord): "mesh" | "image" | null {
    if (rec.routeKind === "mesh" || rec.routeKind === "image") return rec.routeKind;
    return null;
  }

  /** The router's label when it has one, else the raw transcript. */
  private displayText(rec: MemoryRecord): string {
    return rec.label !== undefined && rec.label.length > 0 ? rec.label : rec.transcript;
  }

  /** One-tap Conjure: accept the router's own pick — no typing, no menu. */
  private onCardConjure(): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    const id = this.selectedMemoryId;
    let rec: MemoryRecord | null = null;
    for (const m of this.palace.memories) {
      if (m.id === id) { rec = m; break; }
    }
    if (rec === null) return;
    if (this.enhancer.isBusy(id)) {
      this.flash("Already conjuring this memory", this.gems.basePosition(id));
      return;
    }
    // Unrouted (old save, routing offline): the styled mesh template stands in
    // — the primary button must never be dead.
    const kind: EnhanceKind = rec.routeKind === "image" ? "image" : "mesh";
    const prompt = rec.routePrompt !== undefined
      ? rec.routePrompt : buildEnhancePrompt(kind, rec.transcript);
    rec.enhance = { kind: kind, prompt: prompt };
    this.store.save(this.palace);
    this.closeMemoryCard();
    this.startEnhance(rec, false);
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
    // Manual override still gets the router's mnemonic prompt when the kinds
    // agree — the styled template is only the no-routing fallback.
    const prompt = rec.routeKind === kind && rec.routePrompt !== undefined
      ? rec.routePrompt : buildEnhancePrompt(kind, rec.transcript);
    rec.enhance = { kind: kind, prompt: prompt };
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
    // Subtle splash (user call): the conjured thing dissolves back into the
    // gem — a watery plip + the conjure climb unwound, not a milestone sound.
    if (p !== null) this.gems.playTrackAt(SPLASH_SFX, p, 0.4);
    this.flash("Enhancement removed",
      p !== null ? new vec3(p.x, p.y + FLASH_GEM_LIFT, p.z) : null);
    print("MemoryPalace: enhancement removed for " + id);
  }

  /** A user-initiated conjure began: gate the swirl until it lands. */
  private conjureBegan(id: string): void {
    this.conjuringIds[id] = true;
    this.applyConjureGate();
  }

  /** A conjure resolved (hatch or fail). Safe to call twice — map-guarded. */
  private conjureEnded(id: string): void {
    if (this.conjuringIds[id] === undefined) return;
    delete this.conjuringIds[id];
    this.applyConjureGate();
  }

  private applyConjureGate(): void {
    if (this.state !== "SESSION") return;   // other states own chipOnly themselves
    // The swirl yields while you're mid-creation: a memory card open (the
    // post-capture chip included — user report: both interfaces visible at
    // once) OR a conjure still forging. Done stays available throughout.
    const busy = Object.keys(this.conjuringIds).length > 0 ||
      this.selectedMemoryId !== null ||
      this.pendingRouteChipId !== null;
    this.sigil.setChipOnly(busy);   // swirl + "New Memory" label hide; Done stays
  }

  /**
   * The hatch chord at the gem (DESIGN: "crack + particle burst + harmonic
   * bloom"). Quieter on palace-load regens: several gems waking at once
   * overlap, and the same-key chords harmonize but shouldn't stack loud.
   */
  private playHatch(memoryId: string, quiet: boolean): void {
    const p = this.gems.basePosition(memoryId);
    if (p !== null) this.gems.playTrackAt(HATCH_SFX, p, quiet ? 0.35 : 0.6);
  }

  /** Kick generation for a memory's stored enhance spec; visuals hatch async. */
  private startEnhance(rec: MemoryRecord, quiet: boolean, isRetry: boolean = false): void {
    if (rec.enhance === undefined) return;
    const flashAt = (): vec3 | null => {
      const p = this.gems.basePosition(rec.id);
      return p !== null ? new vec3(p.x, p.y + FLASH_GEM_LIFT, p.z) : null;
    };
    if (!quiet && !isRetry) {
      this.flash(rec.enhance.kind === "mesh" ? "Conjuring object…" : "Conjuring image…", flashAt());
      // The forge lights: rising solfeggio shimmer at the gem (DESIGN's
      // "conjure accepted" beat — the button's own click was just a beep).
      const at = this.gems.basePosition(rec.id);
      if (at !== null) this.gems.playTrackAt(CONJURE_SFX, at, 0.55);
      this.conjureBegan(rec.id);   // swirl hides until this conjure resolves
    }
    // Shared failure path: one silent retry (Snap3D flakes — an identical
    // submit succeeded seconds earlier), THEN the user-facing failure.
    const fail = (msg: string): void => {
      this.gems.setConjuring(rec.id, false);
      print("MemoryPalace: conjure failed — " + msg);
      if (!this.conjureRetried[rec.id] && rec.enhance !== undefined) {
        this.conjureRetried[rec.id] = true;
        print("MemoryPalace: retrying conjure once for " + rec.id);
        const d = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent;
        d.bind(() => {
          if (this.palace !== null && rec.enhance !== undefined) {
            this.startEnhance(rec, quiet, true);   // gate stays held throughout
          } else {
            this.conjureEnded(rec.id);
          }
        });
        d.reset(1.5);
        return;
      }
      delete this.conjureRetried[rec.id];
      this.conjureEnded(rec.id);
      this.flash("Generation failed — try again", flashAt(), FLASH_FAIL_S);
    };
    print("MemoryPalace: conjuring " + rec.enhance.kind + " for \"" + rec.transcript + "\"" +
      (isRetry ? " (retry)" : ""));
    this.gems.setConjuring(rec.id, true);   // spinning halo + forge loop while we wait

    if (rec.enhance.kind === "image") {
      this.enhancer.generateImage(rec.id, rec.enhance.prompt)
        .then((tex) => {
          this.gems.setConjuring(rec.id, false);
          this.conjureEnded(rec.id);
          delete this.conjureRetried[rec.id];
          if (this.gems.setEnhancedImage(rec.id, tex)) {
            this.gems.setGlowTint(rec.id, averageTextureColor(tex));
            this.playHatch(rec.id, quiet);
            this.flash("✓ Image conjured", flashAt());
            print("MemoryPalace: image conjured for " + rec.id);
          }
        })
        .catch((msg) => fail("image: " + msg));
    } else {
      this.enhancer.generateMesh(rec.id, rec.enhance.prompt,
        (preview) => {
          // The concept image lands before the mesh — tint the light pool so
          // the glow foreshadows the object's palette.
          this.gems.setGlowTint(rec.id, averageTextureColor(preview));
        },
        (baseMesh) => {
          this.gems.setConjuring(rec.id, false);
          // The base mesh IS the hatch — the swirl unlocks here, not at the
          // refined swap ~60 s later (which is invisible bookkeeping).
          this.conjureEnded(rec.id);
          delete this.conjureRetried[rec.id];
          if (this.gems.setEnhancedMesh(rec.id, baseMesh, this.enhanceMeshMat)) {
            this.playHatch(rec.id, quiet);
            this.flash("✓ Object conjured (refining…)", flashAt());
            print("MemoryPalace: base mesh conjured for " + rec.id);
          }
        },
        (refinedMesh) => {
          this.gems.setEnhancedMesh(rec.id, refinedMesh, this.enhanceMeshMat);
          print("MemoryPalace: refined mesh swapped in for " + rec.id);
        },
        (msg) => fail("mesh: " + msg));
    }
  }

  private onDeleteSelected(): void {
    if (this.state !== "SESSION" || this.palace === null || this.selectedMemoryId === null) return;
    this.deleteMemoryById(this.selectedMemoryId, "Memory deleted");
  }

  /** Shared destroy path: Delete button, and X-as-cancel on a fresh capture. */
  private deleteMemoryById(id: string, flashText: string): void {
    if (this.palace === null) return;
    let deletedPos: vec3 | null = null;
    for (const m of this.palace.memories) {
      if (m.id === id) { deletedPos = fromStoredVec3(m.position); break; }
    }
    this.gems.vaporize(id);   // punch-out + vapor burst + SFX (delete effect)
    this.palace.memories = this.palace.memories.filter((m) => m.id !== id);
    normalizeRoute(this.palace.memories);   // close the gap in the route
    this.store.save(this.palace);   // auto-save after every delete
    this.refreshRoute();
    this.closeMemoryCard();
    print("MemoryPalace: deleted memory " + id + " (" +
      this.palace.memories.length + " remain)");
    this.flash(flashText, deletedPos !== null
      ? new vec3(deletedPos.x, deletedPos.y + 10, deletedPos.z)
      : this.camera.getForwardPosition(80, false));
  }

  /**
   * Corner X. On the fresh-capture chip it's CANCEL — the just-placed memory
   * is discarded (user call, reversing the earlier keep-on-X: with OK beside
   * it, X reads as "didn't mean it"). On any other card it's plain close;
   * X-deleting a week-old memory on a misclick would be unforgivable, and
   * Delete exists for intent.
   */
  private onCardCloseTapped(): void {
    if (this.selectedMemoryId !== null &&
        this.selectedMemoryId === this.freshCaptureId) {
      this.freshCaptureId = null;
      this.deleteMemoryById(this.selectedMemoryId, "Capture discarded");
      return;
    }
    if (this.selectedMemoryId !== null) {
      const p = this.gems.basePosition(this.selectedMemoryId);
      if (p !== null) this.gems.playTrackAt(CARD_CLOSE_SFX, p, 0.22);
    }
    this.closeMemoryCard();
  }

  /** OK on the conjure panel: fresh chip → keep the memory and close;
   *  existing memory → back to the main panel. */
  private onCardOk(): void {
    if (this.selectedMemoryId !== null &&
        this.selectedMemoryId === this.freshCaptureId) {
      this.freshCaptureId = null;
      const p = this.gems.basePosition(this.selectedMemoryId);
      if (p !== null) this.gems.playTrackAt(CARD_CLOSE_SFX, p, 0.22);
      this.closeMemoryCard();
      return;
    }
    this.uiHud.showMemCardMain();
  }

  private closeMemoryCard(): void {
    this.uiHud.hideMemoryCard();
    this.selectedMemoryId = null;
    // Any close ends the "fresh capture" window — reopening the same gem
    // later gets ordinary card semantics (X = close, not cancel).
    this.freshCaptureId = null;
    this.applyConjureGate();   // swirl returns unless a conjure still forges
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
        // Glanceable read: the router's 2–4 word label when it has one (select
        // the gem for the full transcript). Unrouted memories show their words.
        let transcript = "";
        if (this.palace !== null) {
          for (const m of this.palace.memories) {
            if (m.id === bestId) { transcript = this.displayText(m); break; }
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
          this.uiHud.setGazeDebugPosition(new vec3(p.x, p.y + GAZE_LABEL_LIFT + GAZE_DEBUG_RAISE, p.z));
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

  /** Speaker button on the gaze label: the palace reads the memory aloud.
   *  In TRAIN the label is driven manually — speak the current locus instead. */
  private speakGazedMemory(): void {
    if (this.palace === null) return;
    let id: string;
    if (this.state === "TRAIN") {
      const cur = this.train.current();
      if (cur === null) return;
      id = cur.memoryId;
    } else {
      if (this.gazeTargetId === null || !this.gazeRevealed) return;
      id = this.gazeTargetId;
    }
    let transcript = "";
    for (const m of this.palace.memories) {
      if (m.id === id) { transcript = m.transcript; break; }
    }
    if (transcript.length === 0) return;
    print("MemoryPalace: speaking \"" + transcript + "\"");
    // Pulse the speaker icon while the TTS round-trip is in flight (cached
    // memories resolve immediately — the pulse never gets a visible frame).
    this.uiHud.setSpeakerLoading(true);
    this.enhancer.generateSpeech(id, transcript)
      .then((track) => {
        this.uiHud.setSpeakerLoading(false);
        const p = this.gems.basePosition(id);
        this.gems.playTrackAt(track, p !== null ? p : this.camera.getWorldPosition(), 0.85);
      })
      .catch((msg) => {
        this.uiHud.setSpeakerLoading(false);
        print("MemoryPalace: speak failed — " + msg);
        this.flash("Couldn't speak that — try again", this.gems.basePosition(id));
      });
  }

  /**
   * Debug box trigger: hand-ray hover over the gaze label (edit sessions).
   * Explicit intent — the old extra-dwell trigger fired while you were just
   * READING the label (user report). Hover off = gone.
   */
  private onGazeLabelHover(on: boolean): void {
    if (!on) {
      this.uiHud.hideGazeDebug();
      return;
    }
    if (this.state !== "SESSION" || !this.gazeRevealed ||
        this.gazeTargetId === null || this.palace === null) return;
    for (const m of this.palace.memories) {
      if (m.id !== this.gazeTargetId) continue;
      const meta = (m.routeKind !== undefined ? m.routeKind : "unrouted") +
        " · " + (m.anim !== undefined ? m.anim : "idle") +
        " · " + (m.vfx !== undefined ? m.vfx : "no vfx");
      const prompt = m.routePrompt !== undefined ? m.routePrompt : "(no generation prompt yet)";
      this.uiHud.showGazeDebug(meta + "\n" + prompt);
      const p = this.gems.basePosition(m.id);
      if (p !== null) {
        this.uiHud.setGazeDebugPosition(new vec3(p.x, p.y + GAZE_LABEL_LIFT + GAZE_DEBUG_RAISE, p.z));
      }
      print("MemoryPalace: gaze debug for \"" + m.transcript + "\" — " + meta);
      return;
    }
  }

  private clearGaze(): void {
    if (this.gazeAudio !== null) this.gazeAudio.stop(false);
    this.gems.setGazeRing(null);
    this.uiHud.hideGazeLabel();
    this.uiHud.hideGazeDebug();
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

  /** Transient status flash (billboarded caption) — session feedback juice.
   *  Failures pass a longer hold (user: errors should linger 3–4 s). */
  private flash(text: string, worldPos: vec3, seconds: number = FLASH_S): void {
    this.uiHud.setStatusText(text);
    this.uiHud.showStatus();
    this.uiHud.setStatusPosition(worldPos);
    this.flashRemaining = seconds;
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

    // Explore soundscape: LOD + whisper + twinkles ride the same frame loop.
    if (this.state === "EXPLORE") {
      this.explore.setSuppressed(this.selectedMemoryId !== null);
      this.explore.update(dt, camPos);
    }

    // Train: target pings + arrival detection; the blurred hint billboards.
    if (this.state === "TRAIN") {
      this.train.update(dt, camPos);
      if (this.hintObj !== null && this.hintObj.enabled) {
        const hp = this.hintObj.getTransform().getWorldPosition();
        const toCam = camPos.sub(hp).normalize();
        const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
        this.hintObj.getTransform().setWorldRotation(quat.lookAt(toCam, upRef));
      }
    }

    // Status flash countdown (AIMING owns the status line exclusively).
    if (this.flashRemaining > 0 && this.state !== "AIMING") {
      this.flashRemaining -= dt;
      if (this.flashRemaining <= 0) this.uiHud.hideStatus();
    }

    // Sigil cluster labels ride the swirl + Done chip during sessions and
    // Explore (chip-only there: labelAnchor stays null, so only "Done" shows).
    if (this.state === "SESSION" || this.state === "EXPLORE") {
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
    // the memory's words bloom above it. While free-walking a session or
    // Explore (glinted anchors are excluded by gazeCandidates — no leaks).
    if ((this.state === "SESSION" || this.state === "EXPLORE") && this.selectedMemoryId === null) {
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
