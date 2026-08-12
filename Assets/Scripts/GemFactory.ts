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
import { buildDashedRingMesh, buildDiscMesh, RGB_LIGHT_VIOLET, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";
import { EnhanceKind } from "./EnhanceService";

const VAPORIZE_SFX = requireAsset("../GeneratedSFX/vaporize.wav") as AudioTrackAsset;
const IMAGE_MAT = requireAsset("../Materials/ImageMaterial.mat") as Material;

const ENHANCED_TARGET_CM = 14;    // conjured mesh max dimension
const IMAGE_HEIGHT_CM = 12;       // conjured image billboard height
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
  enhanced: SceneObject | null;      // conjured visual (replaces the gem look)
  enhancedKind: EnhanceKind | null;
  base: vec3;
  phase: number;
  scale: number;
}

interface PendingFit {
  memoryId: string;
  holder: SceneObject;
  frames: number;
  target: number;
}

interface ConjureRing {
  memoryId: string;
  obj: SceneObject;
}

export class GemFactory {
  private meshCache: {[key: string]: RenderMesh} = {};
  private gems: GemRecord[] = [];
  private dying: DyingGem[] = [];
  private arriving: ArrivingGem[] = [];
  private pendingFit: PendingFit[] = [];
  private conjureRings: ConjureRing[] = [];
  private conjureRingMesh: RenderMesh | null = null;
  private gazeRing: ConjureRing | null = null;
  private gazeRingMesh: RenderMesh | null = null;
  private gazeMoteAccum = 0;
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
      enhanced: null,
      enhancedKind: null,
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
      const activeVisual = g.enhanced !== null ? g.enhanced : g.visual;
      this.dying.push({ wrapper: g.wrapper, visual: activeVisual, glow: g.glow, age: 0, baseWorld: pos });
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

  /**
   * Conjured 3D object replaces the gem look: GLB instantiated under a holder
   * child (bob/select/vaporize all keep working), auto-fit to ~14 cm.
   * NEVER pass null as the material — the gltf loader hard-crashes the editor.
   */
  setEnhancedMesh(memoryId: string, gltfAsset: GltfAsset, material: Material): boolean {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return false;
      this.clearEnhanced(g);
      const holder = global.scene.createSceneObject("EnhancedVisual");
      holder.setParent(g.wrapper);
      holder.getTransform().setLocalPosition(vec3.zero());
      try {
        (gltfAsset as any).tryInstantiate(holder, material);
      } catch (e) {
        print("GemFactory: gltf instantiate failed (" + e + ")");
        holder.destroy();
        return false;
      }
      g.enhanced = holder;
      g.enhancedKind = "mesh";
      g.visual.enabled = false;
      this.pendingFit.push({ memoryId: memoryId, holder: holder, frames: 0, target: ENHANCED_TARGET_CM });
      this.spawnVaporBurst(g.wrapper.getTransform().getWorldPosition());   // hatch burst
      print("GemFactory: enhanced mesh attached for " + memoryId);
      return true;
    }
    return false;
  }

  /** Conjured 2D image replaces the gem look: billboarded textured quad. */
  setEnhancedImage(memoryId: string, texture: Texture): boolean {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return false;
      this.clearEnhanced(g);
      const holder = global.scene.createSceneObject("EnhancedVisual");
      holder.setParent(g.wrapper);
      holder.getTransform().setLocalPosition(vec3.zero());
      const img = holder.createComponent("Component.Image") as Image;
      const mat = IMAGE_MAT.clone();
      mat.mainPass.baseTex = texture;
      mat.mainPass.baseColor = new vec4(1, 1, 1, 1);   // kill any placeholder tint
      mat.mainPass.depthTest = true;
      mat.mainPass.depthWrite = false;
      img.clearMaterials();
      img.addMaterial(mat);
      const aspect = texture.getHeight() > 0 ? texture.getWidth() / texture.getHeight() : 1;
      holder.getTransform().setLocalScale(new vec3(IMAGE_HEIGHT_CM * aspect, IMAGE_HEIGHT_CM, 1));
      g.enhanced = holder;
      g.enhancedKind = "image";
      g.visual.enabled = false;
      this.spawnVaporBurst(g.wrapper.getTransform().getWorldPosition());   // hatch burst
      print("GemFactory: enhanced image attached for " + memoryId);
      return true;
    }
    return false;
  }

  /** Strip the conjured visual and bring the gem look (and violet glow) back. */
  removeEnhanced(memoryId: string): boolean {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return false;
      if (g.enhanced === null) return false;
      this.clearEnhanced(g);
      g.visual.enabled = true;
      this.setGlowTint(memoryId, RGB_VIOLET as [number, number, number]);
      this.spawnVaporBurst(g.wrapper.getTransform().getWorldPosition());
      print("GemFactory: enhancement removed for " + memoryId);
      return true;
    }
    return false;
  }

  /** Re-tint the surface light pool (e.g. to match a conjured object). */
  setGlowTint(memoryId: string, rgb: [number, number, number]): void {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (g.glow === null || isNull(g.glow)) return;
      const rmv = g.glow.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null;
      if (rmv) {
        rmv.mesh = buildDiscMesh(GLOW_RADIUS, [rgb[0], rgb[1], rgb[2]]);
        print("GemFactory: glow tinted (" + rgb[0].toFixed(2) + ", " +
          rgb[1].toFixed(2) + ", " + rgb[2].toFixed(2) + ") for " + memoryId);
      }
      return;
    }
  }

  /** Living gems with their current world positions (for gaze targeting). */
  gazeCandidates(): { memoryId: string; pos: vec3 }[] {
    const out: { memoryId: string; pos: vec3 }[] = [];
    for (const g of this.gems) {
      if (isNull(g.wrapper)) continue;
      out.push({ memoryId: g.memoryId, pos: g.wrapper.getTransform().getWorldPosition() });
    }
    return out;
  }

  /**
   * Slow orbit-ring focus highlight on the gazed gem (STYLE.md: everything
   * focused earns an orbit) + gentle rising motes while held. Pass null to clear.
   */
  setGazeRing(memoryId: string | null): void {
    if (this.gazeRing !== null) {
      if (this.gazeRing.memoryId === memoryId) return;   // unchanged
      if (!isNull(this.gazeRing.obj)) this.gazeRing.obj.destroy();
      this.gazeRing = null;
    }
    if (memoryId === null) return;
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return;
      if (this.gazeRingMesh === null) {
        this.gazeRingMesh = buildDashedRingMesh(8, 0.4, 14, 0.5, RGB_TEAL);
      }
      const ring = global.scene.createSceneObject("GazeRing");
      ring.setParent(g.wrapper);
      ring.getTransform().setLocalPosition(vec3.zero());
      const rmv = ring.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = this.gazeRingMesh;
      rmv.mainMaterial = this.burstMat;
      this.gazeRing = { memoryId: memoryId, obj: ring };
      this.gazeMoteAccum = 0;
      return;
    }
  }

  /** Fast-spinning dashed halo around the gem while generation is in flight. */
  setConjuring(memoryId: string, on: boolean): void {
    for (let i = this.conjureRings.length - 1; i >= 0; i--) {
      if (this.conjureRings[i].memoryId === memoryId) {
        if (!isNull(this.conjureRings[i].obj)) this.conjureRings[i].obj.destroy();
        this.conjureRings.splice(i, 1);
      }
    }
    if (!on) return;
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return;
      if (this.conjureRingMesh === null) {
        this.conjureRingMesh = buildDashedRingMesh(7, 0.45, 12, 0.5, RGB_TEAL);
      }
      const ring = global.scene.createSceneObject("ConjureRing");
      ring.setParent(g.wrapper);   // rides the bob with the gem
      ring.getTransform().setLocalPosition(vec3.zero());
      const rmv = ring.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = this.conjureRingMesh;
      rmv.mainMaterial = this.burstMat;
      this.conjureRings.push({ memoryId: memoryId, obj: ring });
      return;
    }
  }

  private clearEnhanced(g: GemRecord): void {
    if (g.enhanced !== null && !isNull(g.enhanced)) g.enhanced.destroy();
    g.enhanced = null;
    g.enhancedKind = null;
    for (let i = this.pendingFit.length - 1; i >= 0; i--) {
      if (this.pendingFit[i].memoryId === g.memoryId) this.pendingFit.splice(i, 1);
    }
  }

  /** Union max world dimension of every mesh under root (0 if unmeasurable). */
  private measureMaxDim(root: SceneObject): number {
    let min: vec3 | null = null;
    let max: vec3 | null = null;
    const visit = (obj: SceneObject): void => {
      const rmv = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual | null;
      if (rmv) {
        const lo = rmv.worldAabbMin();
        const hi = rmv.worldAabbMax();
        min = min === null ? lo : new vec3(Math.min(min.x, lo.x), Math.min(min.y, lo.y), Math.min(min.z, lo.z));
        max = max === null ? hi : new vec3(Math.max(max.x, hi.x), Math.max(max.y, hi.y), Math.max(max.z, hi.z));
      }
      for (let i = 0; i < obj.getChildrenCount(); i++) visit(obj.getChild(i));
    };
    visit(root);
    if (min === null || max === null) return 0;
    return Math.max(max.x - min.x, Math.max(max.y - min.y, max.z - min.z));
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

  update(dt: number, camPos: vec3): void {
    this.elapsed += dt;

    // Auto-fit freshly instantiated GLBs once their AABBs are valid.
    for (let i = this.pendingFit.length - 1; i >= 0; i--) {
      const f = this.pendingFit[i];
      f.frames++;
      if (isNull(f.holder)) { this.pendingFit.splice(i, 1); continue; }
      if (f.frames < 2) continue;
      const size = this.measureMaxDim(f.holder);
      if (size > 0.01) {
        const k = f.target / size;
        f.holder.getTransform().setLocalScale(new vec3(k, k, k));
        print("GemFactory: fitted enhanced mesh (" + size.toFixed(1) + " cm native → ×" + k.toFixed(2) + ")");
        this.pendingFit.splice(i, 1);
      } else if (f.frames > 12) {
        f.holder.getTransform().setLocalScale(new vec3(10, 10, 10));   // skill fallback floor
        print("GemFactory: enhanced mesh unmeasurable — fallback scale 10");
        this.pendingFit.splice(i, 1);
      }
    }

    // Conjure halos: flat spin, fast — "working on it".
    for (let i = this.conjureRings.length - 1; i >= 0; i--) {
      const cr = this.conjureRings[i];
      if (isNull(cr.obj)) { this.conjureRings.splice(i, 1); continue; }
      cr.obj.getTransform().setLocalRotation(
        quat.angleAxis(this.elapsed * 3.2, vec3.up())
          .multiply(quat.angleAxis(-Math.PI / 2, vec3.right())));   // lay ring flat, spin about up
    }

    // Gaze ring: slow contemplative orbit + a drizzle of rising motes.
    if (this.gazeRing !== null) {
      if (isNull(this.gazeRing.obj)) {
        this.gazeRing = null;
      } else {
        this.gazeRing.obj.getTransform().setLocalRotation(
          quat.angleAxis(this.elapsed * 0.9, vec3.up())
            .multiply(quat.angleAxis(-Math.PI / 2, vec3.right())));
        this.gazeMoteAccum += dt * 2.5;
        while (this.gazeMoteAccum >= 1) {
          this.gazeMoteAccum -= 1;
          const center = this.gazeRing.obj.getTransform().getWorldPosition();
          if (this.puffMeshA === null) this.puffMeshA = buildDiscMesh(1.3, RGB_LIGHT_VIOLET);
          if (this.puffMeshB === null) this.puffMeshB = buildDiscMesh(1.1, RGB_TEAL);
          const obj = global.scene.createSceneObject("GazeMote");
          obj.setParent(this.parent);
          const jitter = new vec3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8);
          obj.getTransform().setWorldPosition(center.add(jitter));
          const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
          rmv.mesh = Math.random() < 0.5 ? this.puffMeshA : this.puffMeshB;
          rmv.mainMaterial = this.burstMat;
          this.particles.push({
            obj: obj,
            vel: new vec3(0, 9 + Math.random() * 5, 0),
            age: 0,
            life: 0.8 + Math.random() * 0.4,
            size: 0.3 + Math.random() * 0.3,
          });
        }
      }
    }

    for (const g of this.gems) {
      if (isNull(g.wrapper)) continue;
      if (g.enhanced !== null && g.enhancedKind === "image" && !isNull(g.enhanced)) {
        // Conjured images billboard toward the viewer (+Z at camera).
        const toCam = camPos.sub(g.wrapper.getTransform().getWorldPosition()).normalize();
        const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
        g.enhanced.getTransform().setWorldRotation(quat.lookAt(toCam, upRef));
      } else {
        // Spin on the active visual child (never the collider wrapper).
        const spinTarget = g.enhanced !== null && !isNull(g.enhanced) ? g.enhanced : g.visual;
        const spin = ((this.elapsed + g.phase) * (Math.PI * 2)) / 24;
        spinTarget.getTransform().setLocalRotation(quat.angleAxis(spin, vec3.up()));
      }
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
