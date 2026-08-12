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
import { buildDiscMesh, RGB_LIGHT_VIOLET, RGB_TEAL } from "./MemoryMeshes";

const VAPORIZE_SFX = requireAsset("../GeneratedSFX/vaporize.wav") as AudioTrackAsset;

const VAPOR_PUNCH_S = 0.12;       // punch-out phase
const VAPOR_SHRINK_S = 0.55;      // shrink-to-nothing phase
const VAPOR_PUNCH_SCALE = 1.35;
const VAPOR_PARTICLES = 14;

interface DyingGem {
  wrapper: SceneObject;
  visual: SceneObject;
  age: number;
  baseWorld: vec3;
}

interface VaporParticle {
  obj: SceneObject;
  vel: vec3;
  age: number;
  life: number;
  size: number;
}

interface TimedCleanup {
  obj: SceneObject;
  ttl: number;
}

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
  private dying: DyingGem[] = [];
  private particles: VaporParticle[] = [];
  private cleanup: TimedCleanup[] = [];
  private burstMat: Material;
  private puffMeshA: RenderMesh | null = null;
  private puffMeshB: RenderMesh | null = null;
  private elapsed = 0;

  constructor(private parent: SceneObject, private material: Material) {
    // Additive clone for vapor puffs (dark vertex color = transparent).
    this.burstMat = material.clone();
    this.burstMat.mainPass.twoSided = true;
    this.burstMat.mainPass.depthWrite = false;
    this.burstMat.mainPass.blendMode = BlendMode.Add;
  }

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

  /**
   * Delete effect: punch the gem out, shrink it to nothing with a spin-up,
   * blow off a vapor burst, and play the vaporize SFX at the spot.
   */
  vaporize(memoryId: string): boolean {
    for (let i = 0; i < this.gems.length; i++) {
      if (this.gems[i].memoryId !== memoryId) continue;
      const g = this.gems[i];
      this.gems.splice(i, 1);
      if (isNull(g.wrapper)) return true;

      // A dying gem is no longer selectable — drop its interaction pieces now.
      const inter = g.wrapper.getComponent(Interactable.getTypeName());
      if (inter) inter.destroy();
      const col = g.wrapper.getComponent("Physics.ColliderComponent");
      if (col) col.destroy();

      const pos = g.wrapper.getTransform().getWorldPosition();
      this.dying.push({ wrapper: g.wrapper, visual: g.visual, age: 0, baseWorld: pos });
      this.spawnVaporBurst(pos);
      this.playVaporizeSfx(pos);
      return true;
    }
    return false;
  }

  private spawnVaporBurst(center: vec3): void {
    if (this.puffMeshA === null) this.puffMeshA = buildDiscMesh(1.3, RGB_LIGHT_VIOLET);
    if (this.puffMeshB === null) this.puffMeshB = buildDiscMesh(1.1, RGB_TEAL);
    for (let i = 0; i < VAPOR_PARTICLES; i++) {
      const obj = global.scene.createSceneObject("VaporPuff");
      obj.setParent(this.parent);
      obj.getTransform().setWorldPosition(center);
      obj.getTransform().setLocalRotation(
        quat.angleAxis(Math.random() * Math.PI * 2, vec3.up())
          .multiply(quat.angleAxis(Math.random() * Math.PI, vec3.right())));
      const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = i % 2 === 0 ? this.puffMeshA : this.puffMeshB;
      rmv.mainMaterial = this.burstMat;

      // Random direction, biased upward — vapor rises.
      const theta = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.65;
      const planar = Math.sqrt(Math.max(0, 1 - up * up));
      const speed = 26 + Math.random() * 22;
      this.particles.push({
        obj: obj,
        vel: new vec3(Math.cos(theta) * planar * speed, up * speed, Math.sin(theta) * planar * speed),
        age: 0,
        life: 0.5 + Math.random() * 0.4,
        size: 0.7 + Math.random() * 0.8,
      });
    }
  }

  private playVaporizeSfx(pos: vec3): void {
    const obj = global.scene.createSceneObject("VaporizeSfx");
    obj.setParent(this.parent);
    obj.getTransform().setWorldPosition(pos);
    const ac = obj.createComponent("Component.AudioComponent") as AudioComponent;
    ac.audioTrack = VAPORIZE_SFX;
    ac.playbackMode = Audio.PlaybackMode.LowLatency;   // user-input feedback (specs-audio)
    ac.play(1);
    this.cleanup.push({ obj: obj, ttl: 3.5 });   // outlives the reverb tail
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

    // Dying gems: punch out, then shrink to nothing with a spin-up and rise.
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.age += dt;
      if (isNull(d.wrapper)) { this.dying.splice(i, 1); continue; }
      if (d.age >= VAPOR_PUNCH_S + VAPOR_SHRINK_S) {
        d.wrapper.destroy();
        this.dying.splice(i, 1);
        continue;
      }
      let s: number;
      if (d.age < VAPOR_PUNCH_S) {
        const t = d.age / VAPOR_PUNCH_S;
        s = 1 + (VAPOR_PUNCH_SCALE - 1) * (1 - (1 - t) * (1 - t));   // ease-out punch
      } else {
        const t = (d.age - VAPOR_PUNCH_S) / VAPOR_SHRINK_S;
        s = VAPOR_PUNCH_SCALE * (1 - t * t * t);                     // ease-in shrink
      }
      d.visual.getTransform().setLocalScale(new vec3(s, s, s));
      // The memory unwinds as it vaporizes.
      const spin = (this.elapsed * Math.PI * 2) / 24 + d.age * d.age * 9;
      d.visual.getTransform().setLocalRotation(quat.angleAxis(spin, vec3.up()));
      d.wrapper.getTransform().setWorldPosition(
        new vec3(d.baseWorld.x, d.baseWorld.y + d.age * 5, d.baseWorld.z));
    }

    // Vapor puffs: drift up with drag + buoyancy; additive + shrink = fade.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (isNull(p.obj) || p.age >= p.life) {
        if (!isNull(p.obj)) p.obj.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.obj.getTransform();
      t.setWorldPosition(t.getWorldPosition().add(p.vel.uniformScale(dt)));
      p.vel = p.vel.uniformScale(Math.max(0, 1 - 2.4 * dt));
      p.vel = new vec3(p.vel.x, p.vel.y + 8 * dt, p.vel.z);
      const k = 1 - p.age / p.life;
      const s = p.size * k;
      t.setLocalScale(new vec3(s, s, s));
    }

    // Timed cleanup (one-shot SFX hosts).
    for (let i = this.cleanup.length - 1; i >= 0; i--) {
      this.cleanup[i].ttl -= dt;
      if (this.cleanup[i].ttl <= 0) {
        if (!isNull(this.cleanup[i].obj)) this.cleanup[i].obj.destroy();
        this.cleanup.splice(i, 1);
      }
    }
  }
}
