/**
 * SigilController — the back-of-hand summon (DESIGN.md "Sigil v0").
 *
 * An ethereal swirl (two counter-rotating helical ribbons + a soft glow disc,
 * violet/teal, additive) that blooms above the back of the LEFT (non-dominant)
 * hand via SIK hand tracking. Tapping/pinching it (dominant hand) starts the
 * capture wizard. Back-of-hand placement keeps clear of the palm-side Snap OS
 * system button.
 *
 * Hard Rule 6 compliance: the collider + Interactable live on a unit-scale,
 * identity-rotation wrapper; rotation/scale pulses go on leaf visual children.
 *
 * Editor preview: raw hand tracking doesn't fire in Lens Studio preview, so in
 * the editor the sigil parks at a fixed world position where the mouse
 * (SIK MouseInteractor) can click it — keeps the wizard fully drivable.
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { buildRibbonMesh, buildDiscMesh, RGB_LIGHT_VIOLET, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";

const EDITOR_SIGIL_POS = new vec3(-22, -12, -85);
const COLLIDER_SIZE = 9;      // cm cube around the ~6cm swirl
const HOVER_OFFSET = 4;       // cm off the back of the hand
const LABEL_OFFSET = 8;       // cm above the swirl for the "New Memory" tag

export class SigilController {
  private _onTapped = new Event<void>();
  get onTapped(): PublicApi<void> { return this._onTapped.publicApi(); }

  private wrapper: SceneObject;
  private ribbonA: SceneObject;
  private ribbonB: SceneObject;
  private disc: SceneObject;
  private interactable: Interactable;
  private hand = HandInputData.getInstance().getHand("left");
  private editorMode = global.deviceInfoSystem.isEditor();
  private elapsed = 0;
  private active = true;
  private labelAnchor: vec3 | null = null;

  constructor(parent: SceneObject, ribbonMatA: Material, ribbonMatB: Material, glowMat: Material) {
    // Unit-scale, identity-rotation wrapper carries collider + Interactable.
    this.wrapper = global.scene.createSceneObject("SigilWrapper");
    this.wrapper.setParent(parent);

    const collider = this.wrapper.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const box = Shape.createBoxShape();
    box.size = new vec3(COLLIDER_SIZE, COLLIDER_SIZE, COLLIDER_SIZE);
    collider.shape = box;
    this.interactable = this.wrapper.createComponent(Interactable.getTypeName()) as Interactable;

    // Leaf visuals — rotation + scale pulses live here, never on the wrapper.
    this.ribbonA = global.scene.createSceneObject("SigilRibbonA");
    this.ribbonA.setParent(this.wrapper);
    this.ribbonA.getTransform().setLocalPosition(new vec3(0, -2.5, 0));
    const rmvA = this.ribbonA.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmvA.mesh = buildRibbonMesh(2.4, 1.2, 3.2, 5.0, 0.7, RGB_LIGHT_VIOLET, RGB_VIOLET);
    rmvA.mainMaterial = ribbonMatA;

    this.ribbonB = global.scene.createSceneObject("SigilRibbonB");
    this.ribbonB.setParent(this.wrapper);
    this.ribbonB.getTransform().setLocalPosition(new vec3(0, -2.5, 0));
    const rmvB = this.ribbonB.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmvB.mesh = buildRibbonMesh(2.4, 1.4, 3.0, 5.0, 0.55, RGB_TEAL, RGB_LIGHT_VIOLET);
    rmvB.mainMaterial = ribbonMatB;

    this.disc = global.scene.createSceneObject("SigilGlow");
    this.disc.setParent(this.wrapper);
    this.disc.getTransform().setLocalPosition(new vec3(0, -2.8, 0));
    // Disc is built facing +Z; lay it flat (facing +Y) on the leaf visual.
    this.disc.getTransform().setLocalRotation(quat.angleAxis(-Math.PI / 2, new vec3(1, 0, 0)));
    const rmvD = this.disc.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmvD.mesh = buildDiscMesh(4.2, RGB_VIOLET);
    rmvD.mainMaterial = glowMat;

    this.wrapper.enabled = false;
  }

  /** Call from the main script's OnStartEvent (SIK init-order rule). */
  start(): void {
    this.interactable.onTriggerEnd.add(() => {
      if (this.active) this._onTapped.invoke();
    });
  }

  /** Suppressed during the capture wizard to prevent accidental re-entry. */
  setActive(v: boolean): void {
    this.active = v;
    if (!v) {
      this.wrapper.enabled = false;
      this.labelAnchor = null;
    }
  }

  /** World position for the "New Memory" label, or null when hidden. */
  getLabelAnchor(): vec3 | null { return this.labelAnchor; }

  update(dt: number, camPos: vec3): void {
    this.elapsed += dt;
    if (!this.active) return;

    let pos: vec3 | null = null;
    if (this.editorMode) {
      pos = EDITOR_SIGIL_POS;
    } else if (this.hand.isTracked()) {
      pos = this.backOfHandPosition(camPos);
    }

    if (pos === null) {
      this.wrapper.enabled = false;
      this.labelAnchor = null;
      return;
    }

    this.wrapper.enabled = true;
    this.wrapper.getTransform().setWorldPosition(pos);
    this.labelAnchor = new vec3(pos.x, pos.y + LABEL_OFFSET, pos.z);

    // Counter-rotating ribbons + gentle pulse (sine ease, STYLE.md motion).
    this.ribbonA.getTransform().setLocalRotation(quat.angleAxis(this.elapsed * 1.5, vec3.up()));
    this.ribbonB.getTransform().setLocalRotation(quat.angleAxis(-this.elapsed * 1.1 + Math.PI, vec3.up()));
    const s = 1 + 0.08 * Math.sin((this.elapsed * Math.PI * 2) / 3);
    this.ribbonA.getTransform().setLocalScale(new vec3(s, s, s));
    this.ribbonB.getTransform().setLocalScale(new vec3(s, s, s));
    this.disc.getTransform().setLocalScale(new vec3(s, s, s));
  }

  /**
   * Back-of-hand point: knuckle midpoint pushed along the hand-plane normal,
   * flipped toward the viewer — the side you glance at is the side that blooms.
   */
  private backOfHandPosition(camPos: vec3): vec3 {
    const wrist = this.hand.wrist.position;
    const idx = this.hand.indexKnuckle.position;
    const pky = this.hand.pinkyKnuckle.position;
    const mid = this.hand.middleKnuckle.position;

    const v1 = idx.sub(wrist);
    const v2 = pky.sub(wrist);
    let n = v1.cross(v2).normalize();
    const toCam = camPos.sub(mid).normalize();
    if (n.dot(toCam) < 0) n = n.uniformScale(-1);
    return mid.add(n.uniformScale(HOVER_OFFSET));
  }
}
