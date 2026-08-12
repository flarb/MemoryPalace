/**
 * GemFactory — runtime spawner for memory gems.
 *
 * Shares one RenderMesh per gemScale (built once via buildMemoryGemMesh) and
 * gives every spawned gem the STYLE.md idle motion: slow ~24s spin + gentle
 * sine bob. Gems live for the session (persistence is Wednesday scope).
 */
import { buildMemoryGemMesh } from "./MemoryGemMesh";

interface GemRecord {
  so: SceneObject;
  base: vec3;
  phase: number;
  scale: number;
}

export class GemFactory {
  private meshCache: {[key: string]: RenderMesh} = {};
  private gems: GemRecord[] = [];
  private elapsed = 0;

  constructor(private parent: SceneObject, private material: Material) {}

  spawn(worldPos: vec3, gemScale: number): SceneObject {
    const key = gemScale.toFixed(3);
    if (!this.meshCache[key]) {
      this.meshCache[key] = buildMemoryGemMesh(gemScale);
    }
    const so = global.scene.createSceneObject("MemoryGem");
    so.setParent(this.parent);
    so.getTransform().setWorldPosition(worldPos);

    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = this.meshCache[key];
    rmv.mainMaterial = this.material;

    this.gems.push({ so, base: worldPos, phase: Math.random() * Math.PI * 2, scale: gemScale });
    return so;
  }

  get count(): number { return this.gems.length; }

  update(dt: number): void {
    this.elapsed += dt;
    for (const g of this.gems) {
      if (isNull(g.so)) continue;
      const t = g.so.getTransform();
      const spin = ((this.elapsed + g.phase) * (Math.PI * 2)) / 24;
      t.setLocalRotation(quat.angleAxis(spin, vec3.up()));
      const bob = Math.sin((this.elapsed * Math.PI * 2) / 4 + g.phase) * 2.2 * g.scale;
      t.setWorldPosition(new vec3(g.base.x, g.base.y + bob, g.base.z));
    }
  }
}
