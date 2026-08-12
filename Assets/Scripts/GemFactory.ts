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
import { buildDiscMesh, RGB_LIGHT_VIOLET, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";

const VAPORIZE_SFX = requireAsset("../GeneratedSFX/vaporize.wav") as AudioTrackAsset;
const PLACE_SFX = requireAsset("../GeneratedSFX/place.wav") as AudioTrackAsset;

const ARRIVE_PUNCH_S = 0.2;       // grow 0 → overshoot
const ARRIVE_SETTLE_S = 0.16;     // overshoot → 1
const ARRIVE_PUNCH_SCALE = 1.18;
const PLACE_PARTICLES = 12;

const GLOW_RADIUS = 6;            // cm — light pool under a surface gem (~gem width +30%)
const GLOW_LIFT = 0.35;           // cm off the surface (z-fight guard)

const VAPOR_PUNCH_S = 0.12;       // punch-out phase
const VAPOR_SHRINK_S = 0.55;      // shrink-to-nothing phase
const VAPOR_PUNCH_SCALE = 1.35;
const VAPOR_PARTICLES = 14;

interface DyingGem {
  wrapper: SceneObject;
  visual: SceneObject;
  glow: SceneObject | null;
  age: number;
  baseWorld: vec3;
}

interface ArrivingGem {
  visual: SceneObject;
  glow: SceneObject | null;
  age: number;
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
  glow: SceneObject | null;
  base: vec3;
  phase: number;
  scale: number;
}

export class GemFactory {
  private meshCache: {[key: string]: RenderMesh} = {};
  private gems: GemRecord[] = [];
  private dying: DyingGem[] = [];
  private arriving: ArrivingGem[] = [];
  private particles: VaporParticle[] = [];
  private cleanup: TimedCleanup[] = [];
  private burstMat: Material;
  private puffMeshA: RenderMesh | null = null;
  private puffMeshB: RenderMesh | null = null;
  private glowMesh: RenderMesh | null = null;
  private elapsed = 0;

  constructor(private parent: SceneObject, private material: Material) {
    // Additive clone for vapor puffs (dark vertex color = transparent).
    this.burstMat = material.clone();
    this.burstMat.mainPass.twoSided = true;
    this.burstMat.mainPass.depthWrite = false;
    this.burstMat.mainPass.blendMode = BlendMode.Add;
  }

  spawn(worldPos: vec3, gemScale: number, memoryId: string,
        onSelected: (memoryId: string) => void,
        opts?: { surface?: { point: vec3; normal: vec3 }; arrive?: boolean }): SceneObject {
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

    // Surface-attached gems cast a soft light pool onto the surface: a static
    // additive glow disc at the base (it never bobs with the gem — the pool
    // stays put while the light source floats).
    let glow: SceneObject | null = null;
    if (opts !== undefined && opts.surface !== undefined) {
      if (this.glowMesh === null) this.glowMesh = buildDiscMesh(GLOW_RADIUS, RGB_VIOLET);
      const n = opts.surface.normal.normalize();
      glow = global.scene.createSceneObject("GemGlow");
      glow.setParent(this.parent);
      glow.getTransform().setWorldPosition(opts.surface.point.add(n.uniformScale(GLOW_LIFT)));
      const upRef = Math.abs(n.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
      glow.getTransform().setWorldRotation(quat.lookAt(n, upRef));   // +Z along the normal
      const glowRmv = glow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      glowRmv.mesh = this.glowMesh;
      glowRmv.mainMaterial = this.burstMat;
    }

    this.gems.push({
      memoryId: memoryId,
      wrapper: wrapper,
      visual: visual,
      glow: glow,
      base: worldPos,
      phase: Math.random() * Math.PI * 2,
      scale: gemScale,
    });

    // Fresh placements arrive with juice; restored palaces spawn quietly.
    if (opts !== undefined && opts.arrive === true) {
      visual.getTransform().setLocalScale(vec3.zero());   // grows in via update()
      if (glow !== null) glow.getTransform().setLocalScale(vec3.zero());
      this.arriving.push({ visual: visual, glow: glow, age: 0 });
      const burstOrigin = opts.surface !== undefined ? opts.surface.point : worldPos;
      const burstNormal = opts.surface !== undefined ? opts.surface.normal : vec3.up();
      this.spawnPlaceBurst(burstOrigin, burstNormal);
      this.playOneShot(PLACE_SFX, worldPos, 0.6);
    }
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

      // A dying gem is no longer selectable. DISABLE (never destroy) the
      // interaction pieces: destroying an Interactable synchronously inside
      // an interaction callback leaves SIK's InteractionManager dispatching
      // against a null object this frame ("Exception in HostFunction").
      const inter = g.wrapper.getComponent(Interactable.getTypeName());
      if (inter) inter.enabled = false;
      const col = g.wrapper.getComponent("Physics.ColliderComponent");
      if (col) col.enabled = false;

      const pos = g.wrapper.getTransform().getWorldPosition();
      this.dying.push({ wrapper: g.wrapper, visual: g.visual, glow: g.glow, age: 0, baseWorld: pos });
      this.spawnVaporBurst(pos);
      this.playOneShot(VAPORIZE_SFX, pos, 0.6);
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

  /** Flat disk-ring burst at the gem's base — magical placement dust. */
  private spawnPlaceBurst(origin: vec3, normal: vec3): void {
    if (this.puffMeshA === null) this.puffMeshA = buildDiscMesh(1.3, RGB_LIGHT_VIOLET);
    if (this.puffMeshB === null) this.puffMeshB = buildDiscMesh(1.1, RGB_TEAL);
    const n = normal.normalize();
    let t1 = n.cross(vec3.up());
    if (t1.length < 0.05) t1 = n.cross(vec3.right());
    t1 = t1.normalize();
    const t2 = n.cross(t1).normalize();
    for (let i = 0; i < PLACE_PARTICLES; i++) {
      const obj = global.scene.createSceneObject("PlacePuff");
      obj.setParent(this.parent);
      obj.getTransform().setWorldPosition(origin);
      obj.getTransform().setLocalRotation(
        quat.angleAxis(Math.random() * Math.PI * 2, vec3.up())
          .multiply(quat.angleAxis(Math.random() * Math.PI, vec3.right())));
      const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = i % 2 === 0 ? this.puffMeshA : this.puffMeshB;
      rmv.mainMaterial = this.burstMat;

      // Even ring in the surface plane + slight lift along the normal.
      const a = (i / PLACE_PARTICLES) * Math.PI * 2 + Math.random() * 0.5;
      const dir = t1.uniformScale(Math.cos(a)).add(t2.uniformScale(Math.sin(a)));
      const speed = 30 + Math.random() * 16;
      this.particles.push({
        obj: obj,
        vel: dir.uniformScale(speed).add(n.uniformScale(9 + Math.random() * 7)),
        age: 0,
        life: 0.35 + Math.random() * 0.3,
        size: 0.5 + Math.random() * 0.45,
      });
    }
  }

  private playOneShot(track: AudioTrackAsset, pos: vec3, volume: number): void {
    const obj = global.scene.createSceneObject("OneShotSfx");
    obj.setParent(this.parent);
    obj.getTransform().setWorldPosition(pos);
    const ac = obj.createComponent("Component.AudioComponent") as AudioComponent;
    ac.audioTrack = track;
    ac.playbackMode = Audio.PlaybackMode.LowLatency;   // user-input feedback (specs-audio)
    ac.volume = volume;
    ac.play(1);
    this.cleanup.push({ obj: obj, ttl: 3.5 });   // outlives the reverb tail
  }

  /** Destroy one gem by memory id (delete flow). Returns whether it existed. */
  despawn(memoryId: string): boolean {
    for (let i = 0; i < this.gems.length; i++) {
      if (this.gems[i].memoryId === memoryId) {
        if (!isNull(this.gems[i].wrapper)) this.gems[i].wrapper.destroy();
        const glow = this.gems[i].glow;
        if (glow !== null && !isNull(glow)) glow.destroy();
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
      if (g.glow !== null && !isNull(g.glow)) g.glow.destroy();
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
      // The light pool breathes counter to the bob: gem closer → pool fuller.
      // (Arriving gems overwrite this later in update() — last write wins.)
      if (g.glow !== null && !isNull(g.glow)) {
        const gs = 1 - (bob / (2.2 * g.scale)) * 0.1;
        g.glow.getTransform().setLocalScale(new vec3(gs, gs, gs));
      }
    }

    // Arriving gems: grow in with a punch-overshoot, then settle to rest.
    for (let i = this.arriving.length - 1; i >= 0; i--) {
      const a = this.arriving[i];
      a.age += dt;
      if (isNull(a.visual)) { this.arriving.splice(i, 1); continue; }
      if (a.age >= ARRIVE_PUNCH_S + ARRIVE_SETTLE_S) {
        a.visual.getTransform().setLocalScale(vec3.one());
        if (a.glow !== null && !isNull(a.glow)) a.glow.getTransform().setLocalScale(vec3.one());
        this.arriving.splice(i, 1);
        continue;
      }
      let s: number;
      if (a.age < ARRIVE_PUNCH_S) {
        const t = a.age / ARRIVE_PUNCH_S;
        s = ARRIVE_PUNCH_SCALE * (1 - (1 - t) * (1 - t) * (1 - t));   // ease-out grow
      } else {
        const t = (a.age - ARRIVE_PUNCH_S) / ARRIVE_SETTLE_S;
        s = ARRIVE_PUNCH_SCALE - (ARRIVE_PUNCH_SCALE - 1) * t * t;    // ease-in settle
      }
      a.visual.getTransform().setLocalScale(new vec3(s, s, s));
      if (a.glow !== null && !isNull(a.glow)) a.glow.getTransform().setLocalScale(new vec3(s, s, s));
    }

    // Dying gems: punch out, then shrink to nothing with a spin-up and rise.
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.age += dt;
      if (isNull(d.wrapper)) { this.dying.splice(i, 1); continue; }
      if (d.age >= VAPOR_PUNCH_S + VAPOR_SHRINK_S) {
        d.wrapper.destroy();
        if (d.glow !== null && !isNull(d.glow)) d.glow.destroy();
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
      // The light pool flares with the death punch, then extinguishes.
      if (d.glow !== null && !isNull(d.glow)) d.glow.getTransform().setLocalScale(new vec3(s, s, s));
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
