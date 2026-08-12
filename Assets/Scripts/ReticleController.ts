/**
 * ReticleController — surface-snapping targeting reticle for the capture wizard.
 *
 * Casts a WorldQuery ray along the user's gaze each frame:
 *  - HIT: the dashed teal ring lies flat on the surface (aligned to the hit
 *    normal), glow dot at the point — "this is where the gem lands."
 *  - NO HIT (or WorldQueryModule unavailable in this preview): v0 fallback —
 *    ring floats 150 cm along gaze, facing the user, with the brand tilt.
 *
 * WorldQuery self-throttles (~5 Hz); one request stays in flight and update()
 * consumes the latest async result (/specs-world-query pattern).
 */
import { buildDashedRingMesh, buildDiscMesh, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";

const RETICLE_DISTANCE = 150;   // cm along gaze (float fallback)
const RAY_LENGTH = 600;         // cm — max surface-snap distance
const TILT_RAD = (-12 * Math.PI) / 180;
const SURFACE_LIFT = 0.5;       // cm off the surface to avoid z-fighting

let worldQuery: WorldQueryModule | null = null;
try {
  worldQuery = require("LensStudio:WorldQueryModule") as WorldQueryModule;
} catch (e) {
  print("ReticleController: WorldQueryModule unavailable — float-only reticle (" + e + ")");
}

export class ReticleController {
  private root: SceneObject;
  private ring: SceneObject;
  private dot: SceneObject;
  private visible = false;
  private elapsed = 0;
  private point = new vec3(0, 0, -RETICLE_DISTANCE);
  private normal: vec3 | null = null;
  private tilt = quat.angleAxis(TILT_RAD, new vec3(0, 0, 1));

  private session: HitTestSession | null = null;
  private pending = false;
  private lastHit: WorldQueryHitTestResult | null = null;

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

    if (worldQuery !== null) {
      try {
        const options = HitTestSessionOptions.create();
        options.filter = true;   // smoothed hit results
        this.session = worldQuery.createHitTestSessionWithOptions(options);
        this.session.start();    // required — no results before start()
      } catch (e) {
        print("ReticleController: hit-test session failed — float-only (" + e + ")");
        this.session = null;
      }
    }

    this.root.enabled = false;
  }

  show(): void { this.visible = true; this.root.enabled = true; }
  hide(): void { this.visible = false; this.root.enabled = false; }
  isVisible(): boolean { return this.visible; }

  /** Anchor point for the memory (surface hit, lifted; or gaze float). */
  getPoint(): vec3 { return new vec3(this.point.x, this.point.y, this.point.z); }

  /** Surface normal at the anchor, or null when floating (no surface). */
  getNormal(): vec3 | null {
    return this.normal === null ? null : new vec3(this.normal.x, this.normal.y, this.normal.z);
  }

  update(dt: number, camPos: vec3, gazePoint: vec3): void {
    if (!this.visible) return;
    this.elapsed += dt;

    // One gaze ray in flight; latest result wins.
    if (this.session !== null && !this.pending) {
      this.pending = true;
      const dir = gazePoint.sub(camPos).normalize();
      const rayEnd = camPos.add(dir.uniformScale(RAY_LENGTH));
      this.session.hitTest(camPos, rayEnd, (result: WorldQueryHitTestResult | null) => {
        this.pending = false;
        this.lastHit = result;   // null = no surface under gaze
      });
    }

    const t = this.root.getTransform();
    if (this.lastHit !== null) {
      const n = this.lastHit.normal.normalize();
      this.point = this.lastHit.position.add(n.uniformScale(SURFACE_LIFT));
      this.normal = n;
      t.setWorldPosition(this.point);
      // Ring mesh faces +Z: aim -Z along -normal so +Z rides the normal —
      // ring lies flat on floors/tables, flush on walls.
      const upRef = Math.abs(n.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
      t.setWorldRotation(quat.lookAt(n.uniformScale(-1), upRef));
    } else {
      this.point = gazePoint;
      this.normal = null;
      t.setWorldPosition(this.point);
      // Face the user: mesh normal is +Z, so aim -Z along the view direction.
      const viewDir = this.point.sub(camPos).normalize();
      t.setWorldRotation(quat.lookAt(viewDir, vec3.up()));
    }

    // Dash orbit; the brand tilt only applies in float mode — on a surface the
    // ring sits flush.
    const spin = quat.angleAxis(this.elapsed * 0.8, new vec3(0, 0, 1));
    this.ring.getTransform().setLocalRotation(this.normal !== null ? spin : this.tilt.multiply(spin));
  }
}
