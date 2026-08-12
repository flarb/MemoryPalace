/**
 * SigilController — the sigil cluster, i.e. the session controller
 * (DESIGN.md "Palaces & sessions": it exists only inside Create/Edit sessions).
 *
 * Two affordances:
 *  - Swirl (violet, counter-rotating ribbons + glow disc): tap → capture wizard.
 *  - Done chip (teal dashed orbit ring + teal glow, ~7 cm below the swirl):
 *    tap → save the palace and return to the modal. Teal = success and the
 *    orbit ring = focus per STYLE.md; visually distinct from the violet swirl.
 *
 * Placement: back of the LEFT hand on device (SIK hand tracking); in the
 * editor the whole cluster parks at a fixed world position where the mouse
 * (SIK MouseInteractor treats click as pinch) can drive both affordances.
 *
 * Hard Rule 6: each affordance's collider + Interactable live on its own
 * unit-scale, identity-rotation wrapper; rotation/scale pulses go on leaf
 * visual children only.
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData";
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { buildRibbonMesh, buildDiscMesh, buildDashedRingMesh, RGB_LIGHT_VIOLET, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";

// Editor park: lower-left IN VIEW (DESIGN.md), computed camera-relative each
// frame — the sim camera is neither at the world origin nor static, so any
// absolute world point (the v0 approach) drifts out of frame. 85 cm ahead,
// 14 cm left / 10 cm down in the view plane ≈ 9.4° left, 6.7° down — swirl,
// chip, and labels all inside the Specs preview half-FOV (≈13.5° h, 19° v).
const EDITOR_PARK_FWD = 85;    // cm ahead of the camera
const EDITOR_PARK_LEFT = 14;   // cm left in the view plane
const EDITOR_PARK_DOWN = 10;   // cm down in the view plane
// Collider sizing: the swirl and chip boxes must NOT abut — with a 9 cm swirl
// box and a 7 cm drop, the chip's top edge sat inside the swirl's box and a
// mouse ray at the chip's upper half triggered the swirl (verified misfire).
// 7 cm swirl box + 9 cm drop + 6 cm chip box leaves a 2.5 cm clear band.
const COLLIDER_SIZE = 7;      // cm cube around the ~6cm swirl
const HOVER_OFFSET = 4;       // cm off the back of the hand
const LABEL_OFFSET = 8;       // cm above the swirl for the "New Memory" tag
const CHIP_DROP = 9;          // cm below the swirl (DESIGN.md: Done chip below)
const CHIP_COLLIDER = 6;      // cm cube around the ~4cm chip
const CHIP_LABEL_DROP = 4.5;  // cm below the chip for the "Done" tag

export class SigilController {
  private _onTapped = new Event<void>();
  get onTapped(): PublicApi<void> { return this._onTapped.publicApi(); }
  private _onDoneTapped = new Event<void>();
  get onDoneTapped(): PublicApi<void> { return this._onDoneTapped.publicApi(); }

  private wrapper: SceneObject;
  private ribbonA: SceneObject;
  private ribbonB: SceneObject;
  private disc: SceneObject;
  private interactable: Interactable;

  private chipWrapper: SceneObject;
  private chipVisual: SceneObject;
  private chipRing: SceneObject;
  private chipInteractable: Interactable;

  private hand = HandInputData.getInstance().getHand("left");
  private camera = WorldCameraFinderProvider.getInstance();
  private editorMode = global.deviceInfoSystem.isEditor();
  private elapsed = 0;
  private active = true;
  private labelAnchor: vec3 | null = null;
  private doneLabelAnchor: vec3 | null = null;

  constructor(parent: SceneObject, ribbonMatA: Material, ribbonMatB: Material, glowMat: Material) {
    // ── Swirl: unit-scale wrapper carries collider + Interactable ────────────
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

    // ── Done chip: its own unit-scale wrapper below the swirl ────────────────
    this.chipWrapper = global.scene.createSceneObject("SigilDoneChip");
    this.chipWrapper.setParent(parent);

    const chipCollider = this.chipWrapper.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const chipBox = Shape.createBoxShape();
    chipBox.size = new vec3(CHIP_COLLIDER, CHIP_COLLIDER, CHIP_COLLIDER);
    chipCollider.shape = chipBox;
    this.chipInteractable = this.chipWrapper.createComponent(Interactable.getTypeName()) as Interactable;

    // Visual container: faces the viewer each frame (rotation on the leaf,
    // never the wrapper). Ring + glow are flat +Z meshes.
    this.chipVisual = global.scene.createSceneObject("DoneChipVisual");
    this.chipVisual.setParent(this.chipWrapper);

    this.chipRing = global.scene.createSceneObject("DoneChipRing");
    this.chipRing.setParent(this.chipVisual);
    const rmvRing = this.chipRing.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmvRing.mesh = buildDashedRingMesh(2.0, 0.35, 10, 0.4, RGB_TEAL);
    rmvRing.mainMaterial = glowMat;

    const chipGlow = global.scene.createSceneObject("DoneChipGlow");
    chipGlow.setParent(this.chipVisual);
    const rmvGlow = chipGlow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmvGlow.mesh = buildDiscMesh(1.6, RGB_TEAL);
    rmvGlow.mainMaterial = glowMat;

    this.wrapper.enabled = false;
    this.chipWrapper.enabled = false;
  }

  /** Call from the main script's OnStartEvent (SIK init-order rule). */
  start(): void {
    this.interactable.onTriggerEnd.add(() => {
      if (this.active) this._onTapped.invoke();
    });
    this.chipInteractable.onTriggerEnd.add(() => {
      if (this.active) this._onDoneTapped.invoke();
    });
  }

  /**
   * The cluster is the session controller: active only during SESSION states
   * (hidden during MODAL and while the capture wizard runs).
   */
  setActive(v: boolean): void {
    this.active = v;
    if (!v) {
      this.wrapper.enabled = false;
      this.chipWrapper.enabled = false;
      this.labelAnchor = null;
      this.doneLabelAnchor = null;
    }
  }

  /** World position for the "New Memory" label, or null when hidden. */
  getLabelAnchor(): vec3 | null { return this.labelAnchor; }

  /** World position for the "Done" label, or null when hidden. */
  getDoneLabelAnchor(): vec3 | null { return this.doneLabelAnchor; }

  update(dt: number, camPos: vec3): void {
    this.elapsed += dt;
    if (!this.active) return;

    let pos: vec3 | null = null;
    if (this.editorMode) {
      pos = this.editorParkPosition(camPos);   // lower-left in view, mouse-drivable
    } else if (this.hand.isTracked()) {
      pos = this.backOfHandPosition(camPos);
    }

    if (pos === null) {
      this.wrapper.enabled = false;
      this.chipWrapper.enabled = false;
      this.labelAnchor = null;
      this.doneLabelAnchor = null;
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

    // Done chip rides below the swirl; visual faces the viewer.
    const chipPos = new vec3(pos.x, pos.y - CHIP_DROP, pos.z);
    this.chipWrapper.enabled = true;
    this.chipWrapper.getTransform().setWorldPosition(chipPos);
    this.doneLabelAnchor = new vec3(chipPos.x, chipPos.y - CHIP_LABEL_DROP, chipPos.z);

    // LS API: quat.lookAt aims +Z along its argument; the ring/disc meshes
    // face +Z → aim +Z AT the camera (the proven Tuesday convention).
    const toCam = camPos.sub(chipPos).normalize();
    const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
    this.chipVisual.getTransform().setWorldRotation(quat.lookAt(toCam, upRef));
    const cs = 1 + 0.06 * Math.sin((this.elapsed * Math.PI * 2) / 3 + 1.3);
    this.chipVisual.getTransform().setLocalScale(new vec3(cs, cs, cs));
    // Slow dash orbit on the ring leaf (composes with the visual's facing).
    this.chipRing.getTransform().setLocalRotation(quat.angleAxis(this.elapsed * 0.6, new vec3(0, 0, 1)));
  }

  /** Editor: park lower-left in the CURRENT view (view-plane offsets). */
  private editorParkPosition(camPos: vec3): vec3 {
    const fwdPoint = this.camera.getForwardPosition(EDITOR_PARK_FWD, false);
    const viewDir = fwdPoint.sub(camPos).normalize();
    let right = viewDir.cross(vec3.up());
    if (right.length < 0.05) right = vec3.right();   // looking straight up/down
    right = right.normalize();
    const viewUp = right.cross(viewDir).normalize();
    return fwdPoint
      .sub(right.uniformScale(EDITOR_PARK_LEFT))
      .sub(viewUp.uniformScale(EDITOR_PARK_DOWN));
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
