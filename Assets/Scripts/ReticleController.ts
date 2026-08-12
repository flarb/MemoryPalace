/**
 * ReticleController — gaze-follow targeting reticle for the capture wizard
 * (Tuesday stub for the Wednesday frame-draw step).
 *
 * A dashed teal orbit ring (STYLE.md focus motif, -12° tilt) + soft violet
 * glow dot, floating 150 cm along the user's gaze. The dashes slowly orbit.
 */
import { buildDashedRingMesh, buildDiscMesh, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";

const RETICLE_DISTANCE = 150; // cm along gaze
const TILT_RAD = (-12 * Math.PI) / 180;

export class ReticleController {
  private root: SceneObject;
  private ring: SceneObject;
  private dot: SceneObject;
  private visible = false;
  private elapsed = 0;
  private point = new vec3(0, 0, -RETICLE_DISTANCE);
  private tilt = quat.angleAxis(TILT_RAD, new vec3(0, 0, 1));

  constructor(parent: SceneObject, ringMaterial: Material, glowMaterial: Material) {
    this.root = global.scene.createSceneObject("Reticle");
    this.root.setParent(parent);

    this.ring = global.scene.createSceneObject("ReticleRing");
    this.ring.setParent(this.root);
    const ringRmv = this.ring.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    ringRmv.mesh = buildDashedRingMesh(4.5, 0.5, 12, 0.45, RGB_TEAL);
    ringRmv.mainMaterial = ringMaterial;

    this.dot = global.scene.createSceneObject("ReticleDot");
    this.dot.setParent(this.root);
    const dotRmv = this.dot.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    dotRmv.mesh = buildDiscMesh(1.6, RGB_VIOLET);
    dotRmv.mainMaterial = glowMaterial;

    this.root.enabled = false;
  }

  show(): void { this.visible = true; this.root.enabled = true; }
  hide(): void { this.visible = false; this.root.enabled = false; }
  isVisible(): boolean { return this.visible; }
  getPoint(): vec3 { return new vec3(this.point.x, this.point.y, this.point.z); }

  update(dt: number, camPos: vec3, gazePoint: vec3): void {
    if (!this.visible) return;
    this.elapsed += dt;
    this.point = gazePoint;

    const t = this.root.getTransform();
    t.setWorldPosition(this.point);

    // Face the user: mesh normal is +Z, so aim -Z along the view direction.
    const viewDir = this.point.sub(camPos).normalize();
    t.setWorldRotation(quat.lookAt(viewDir, vec3.up()));

    // Dash orbit: slow spin around the ring's local Z, composed with the tilt.
    const spin = quat.angleAxis(this.elapsed * 0.8, new vec3(0, 0, 1));
    this.ring.getTransform().setLocalRotation(this.tilt.multiply(spin));
  }
}
