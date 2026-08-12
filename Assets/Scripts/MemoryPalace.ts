/**
 * MemoryPalace — main experience script (Tuesday v0 milestone).
 *
 * State machine:
 *   MODAL     start modal visible, sigil live ("glance at your left hand").
 *   IDLE      modal dismissed; sigil is the capture affordance.
 *   AIMING    reticle floats at gaze; pinch (device) or 2.5 s auto (editor)
 *             confirms the anchor point.  [full frame-draw lands Wednesday]
 *   LISTENING ASR streams onto the transcript card; auto-stop on ~1.2 s
 *             silence or pinch; canned transcript in the editor.
 *   → gem drops free-floating at the anchor (in-session only; persistence
 *     lands Wednesday), back to IDLE.
 *
 * All 3D content assembles here at runtime (script-driven scene assembly);
 * every visible string lives in MemoryPalaceUI.
 */
import { MemoryPalaceUI } from "./MemoryPalaceUI";
import { SigilController } from "./SigilController";
import { ReticleController } from "./ReticleController";
import { GemFactory } from "./GemFactory";
import { AsrController } from "./AsrController";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

const BRAND_MAT = requireAsset("../SimpleVertexBaseColor.lspkg/vertexBaseColorMaterial.mat") as Material;

const PLACED_GEM_SCALE = 0.15;                  // ~9 cm
const AIM_DISTANCE = 150;                       // cm along gaze (reticle + gem)
const PINCH_DEBOUNCE_S = 0.4;
const GEM_SURFACE_OFFSET = 5;                   // cm along the hit normal (half gem + clearance)
const CARD_DISTANCE = 90;                       // cm ahead for the listening card
const CARD_DROP = 12;                           // cm below gaze in the view plane (~8° — lower-mid, clear of FOV bottom)
const CARD_LERP = 8;                            // soft-follow responsiveness

type WizardState = "MODAL" | "IDLE" | "AIMING" | "LISTENING";

interface MemoryRecord {
  transcript: string;
  position: vec3;
  createdAt: number;
}

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
  private memories: MemoryRecord[] = [];

  private editorMode = global.deviceInfoSystem.isEditor();
  private stateAge = 0;
  private cardPos = vec3.zero();
  private cardRot = quat.quatIdentity();

  onAwake() {
    this.buildScene();

    this.createEvent("UpdateEvent").bind(() => this.onUpdate());

    // Editor: mouse click = TapEvent — the explicit place/stop confirm.
    // Device uses raw pinch (OnStart below). No auto-placement anywhere.
    this.createEvent("TapEvent").bind(() => {
      if (this.editorMode) this.onConfirmGesture();
    });

    this.createEvent("OnStartEvent").bind(() => {
      // UI events (Channel A).
      this.uiHud.onCapture.add(() => this.startWizard());
      // Explore/Train: the UI shows its own coming-soon hint (Tuesday scope).

      // Sigil tap → wizard (SIK subscriptions bind in OnStart).
      this.sigil.start();
      this.sigil.onTapped.add(() => this.startWizard());

      // Editor: no hands — the modal is the whole affordance; the sigil (and
      // its parked stand-in) exists only on device.
      if (this.editorMode) {
        this.sigil.setActive(false);
        this.uiHud.setHintText("Press Capture, then hold the view steady");
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
  }

  private makeAdditive(mat: Material): Material {
    mat.mainPass.twoSided = true;
    mat.mainPass.depthWrite = false;
    mat.mainPass.blendMode = BlendMode.Add;   // dark vertex color = transparent
    return mat;
  }

  // ── Wizard flow ────────────────────────────────────────────────────────────

  private startWizard(): void {
    if (this.state !== "MODAL" && this.state !== "IDLE") return;
    this.setState("AIMING");
    this.uiHud.hideModal();
    this.uiHud.hideSigilLabel();
    this.sigil.setActive(false);
    this.reticle.show();
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
    this.reticle.hide();
    this.uiHud.hideTranscript();

    if (transcript.length > 0) {
      // The gem IS the memory marker (DESIGN.md) — sits just off the surface
      // when the reticle snapped, free-floats otherwise.
      const surfaceNormal = this.reticle.getNormal();
      const gemPos = surfaceNormal !== null
        ? anchor.add(surfaceNormal.uniformScale(GEM_SURFACE_OFFSET))
        : anchor;
      this.gems.spawn(gemPos, PLACED_GEM_SCALE);
      this.memories.push({ transcript: transcript, position: gemPos, createdAt: getTime() });
      print("MemoryPalace: captured \"" + transcript + "\" (" + this.memories.length + " memories)");
    } else {
      print("MemoryPalace: capture cancelled (empty transcript)");
    }

    if (this.editorMode) {
      // No hands in preview — the modal returns as the next-capture affordance,
      // with a visible confirmation so the flow never reads as "nothing happened".
      this.uiHud.showModal();
      this.uiHud.showToast(transcript.length > 0
        ? "✓ Memory placed — " + this.memories.length + " total"
        : "Capture cancelled");
      this.setState("MODAL");
    } else {
      this.sigil.setActive(true);
      this.setState("IDLE");
    }
  }

  private onPinchDown(): void {
    this.onConfirmGesture();
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

  private setState(s: WizardState): void {
    this.state = s;
    this.stateAge = 0;
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  private onUpdate(): void {
    const dt = getDeltaTime();
    this.stateAge += dt;
    const camPos = this.camera.getWorldPosition();

    this.sigil.update(dt, camPos);
    this.gems.update(dt);
    this.asr.update(dt);

    // "New Memory" label rides the sigil (billboarded by the UI module).
    if (this.state === "MODAL" || this.state === "IDLE") {
      const anchor = this.sigil.getLabelAnchor();
      if (anchor !== null) {
        this.uiHud.showSigilLabel();
        this.uiHud.setSigilLabelPosition(anchor);
      } else {
        this.uiHud.hideSigilLabel();
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
