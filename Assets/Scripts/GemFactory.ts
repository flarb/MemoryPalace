/**
 * GemFactory — runtime spawner for memory gems (Wednesday: selectable).
 *
 * Hard Rule 6 structure per gem:
 *   wrapper "MemoryGem"  — unit scale, identity rotation; carries the sphere
 *                          collider + SIK Interactable; bob = translation here
 *                          so the hit zone rides the visual.
 *   child  "GemVisual"   — RenderMeshVisual; the slow ~24s spin lives here.
 *
 * Gems are keyed by memoryId so the session can despawn on delete and respawn
 * a loaded palace. Selection fires onSelected(memoryId) (gated by the caller).
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { buildMemoryGemMesh } from "./MemoryGemMesh";

interface GemRecord {
  memoryId: string;
  wrapper: SceneObject;
  visual: SceneObject;
  base: vec3;
  phase: number;
  scale: number;
}

export class GemFactory {
  private meshCache: {[key: string]: RenderMesh} = {};
  private gems: GemRecord[] = [];
  private elapsed = 0;

  constructor(private parent: SceneObject, private material: Material) {}

  spawn(worldPos: vec3, gemScale: number, memoryId: string,
        onSelected: (memoryId: string) => void): SceneObject {
    const key = gemScale.toFixed(3);
    if (!this.meshCache[key]) {
      this.meshCache[key] = buildMemoryGemMesh(gemScale);
    }

    const wrapper = global.scene.createSceneObject("MemoryGem");
    wrapper.setParent(this.parent);
    wrapper.getTransform().setWorldPosition(worldPos);

    // Generous sphere: gem is ~8.6 cm tall at scale 0.15 — radius 40*scale
    // (= 6 cm) makes it forgiving to pinch/click.
    const collider = wrapper.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const sphere = Shape.createSphereShape();
    sphere.radius = 40 * gemScale;
    collider.shape = sphere;
    const interactable = wrapper.createComponent(Interactable.getTypeName()) as Interactable;
    interactable.onTriggerEnd.add(() => onSelected(memoryId));

    const visual = global.scene.createSceneObject("GemVisual");
    visual.setParent(wrapper);
    const rmv = visual.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = this.meshCache[key];
    rmv.mainMaterial = this.material;

    this.gems.push({
      memoryId: memoryId,
      wrapper: wrapper,
      visual: visual,
      base: worldPos,
      phase: Math.random() * Math.PI * 2,
      scale: gemScale,
    });
    return wrapper;
  }

  /** Destroy one gem by memory id (delete flow). Returns whether it existed. */
  despawn(memoryId: string): boolean {
    for (let i = 0; i < this.gems.length; i++) {
      if (this.gems[i].memoryId === memoryId) {
        if (!isNull(this.gems[i].wrapper)) this.gems[i].wrapper.destroy();
        this.gems.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** Clear the whole session's gems (Done chip → back to the modal). */
  despawnAll(): void {
    for (const g of this.gems) {
      if (!isNull(g.wrapper)) g.wrapper.destroy();
    }
    this.gems = [];
  }

  /** Current bob-less anchor position for a gem, or null. */
  basePosition(memoryId: string): vec3 | null {
    for (const g of this.gems) {
      if (g.memoryId === memoryId) return new vec3(g.base.x, g.base.y, g.base.z);
    }
    return null;
  }

  get count(): number { return this.gems.length; }

  update(dt: number): void {
    this.elapsed += dt;
    for (const g of this.gems) {
      if (isNull(g.wrapper)) continue;
      // Spin on the visual child (rotation never touches the collider wrapper).
      const spin = ((this.elapsed + g.phase) * (Math.PI * 2)) / 24;
      g.visual.getTransform().setLocalRotation(quat.angleAxis(spin, vec3.up()));
      // Bob = translation on the wrapper so the collider follows.
      const bob = Math.sin((this.elapsed * Math.PI * 2) / 4 + g.phase) * 2.2 * g.scale;
      g.wrapper.getTransform().setWorldPosition(new vec3(g.base.x, g.base.y + bob, g.base.z));
    }
  }
}
