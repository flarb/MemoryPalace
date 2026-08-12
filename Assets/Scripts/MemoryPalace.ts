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

const HERO_GEM_POS = new vec3(0, 23.5, -112);   // floats above the start modal
const HERO_GEM_SCALE = 0.12;                    // ~7 cm
const PLACED_GEM_SCALE = 0.15;                  // ~9 cm
const AIM_DISTANCE = 150;                       // cm along gaze (reticle + gem)
const EDITOR_AIM_AUTOCONFIRM_S = 2.5;
const PINCH_DEBOUNCE_S = 0.4;

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
  private aimElapsed = 0;
  private stateAge = 0;

  onAwake() {
    this.buildScene();

    this.createEvent("UpdateEvent").bind(() => this.onUpdate());

    this.createEvent("OnStartEvent").bind(() => {
      // UI events (Channel A).
      this.uiHud.onCapture.add(() => this.startWizard());
      // Explore/Train: the UI shows its own coming-soon hint (Tuesday scope).

      // Sigil tap → wizard (SIK subscriptions bind in OnStart).
      this.sigil.start();
      this.sigil.onTapped.add(() => this.startWizard());

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

    // Brand hero: one gem floating above the start modal — the same material
    // story as the logo (gem gradient) and every placed memory.
    this.gems.spawn(HERO_GEM_POS, HERO_GEM_SCALE);
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
    this.aimElapsed = 0;
  }

  private confirmPlacement(): void {
    if (this.state !== "AIMING") return;
    this.setState("LISTENING");
    this.uiHud.showTranscript();
    this.asr.start({
      onPartial: (t) => this.uiHud.setTranscript(t),
      onFinal: (t) => this.finishCapture(t),
      onError: (msg) => {
        this.uiHud.setListeningState(msg + " — try again");
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
      // The gem IS the memory marker (DESIGN.md) — free-floating v0 anchor.
      this.gems.spawn(anchor, PLACED_GEM_SCALE);
      this.memories.push({ transcript: transcript, position: anchor, createdAt: getTime() });
      print("MemoryPalace: captured \"" + transcript + "\" (" + this.memories.length + " memories)");
    } else {
      print("MemoryPalace: capture cancelled (empty transcript)");
    }

    this.sigil.setActive(true);
    this.setState("IDLE");
  }

  private onPinchDown(): void {
    if (this.stateAge < PINCH_DEBOUNCE_S) return;   // ignore the pinch that got us here
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

      // Editor: raw pinch never fires in preview — auto-confirm keeps the
      // wizard drivable end-to-end (DESIGN.md preview-testability rule).
      if (this.editorMode) {
        this.aimElapsed += dt;
        if (this.aimElapsed >= EDITOR_AIM_AUTOCONFIRM_S) {
          this.confirmPlacement();
        }
      }
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
