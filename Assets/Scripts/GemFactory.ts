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
import { buildDashedRingMesh, buildDiscMesh, buildPathDashMesh, RGB_LIGHT_VIOLET, RGB_TEAL, RGB_VIOLET } from "./MemoryMeshes";
import { EnhanceKind } from "./EnhanceService";
import { AnimRecipe, VfxRecipe } from "./MemoryRouter";

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

// Motion recipes (DESIGN.md: "Animation is mandatory, not decoration" — Snap3D
// returns static GLB, so the encoding motion is ours). Baseline idle bob + slow
// spin applies to EVERY gem; the recipe layers on top of it.
const IDLE_BOB_CM = 2.2;          // × gem scale
const IDLE_BOB_HZ = 0.25;         // 4 s period
const IDLE_SPIN_S = 24;           // seconds per revolution
const ORBIT_RADIUS_CM = 3.5;
const SHAKE_AMP_CM = 0.9;

// VFX budget (DESIGN risk note: "a palace of 30 memories must never become a
// wind-chime shop"). One shared additive puff family, distance-gated + capped.
const VFX_RANGE_CM = 500;
const VFX_PARTICLE_CAP = 140;     // global live-particle ceiling before emitters yield
const VFX_BURST_PERIOD_S = 2.4;

// Journey ribbon (DESIGN.md "Journeys": ribbon connects loci, next locus glows).
const RIBBON_WIDTH = 0.9;         // cm
const RIBBON_DASH = 6;            // cm
const RIBBON_GAP = 5;             // cm
const NEXT_RING_RADIUS = 11;      // cm — reads clearly outside the gem silhouette

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
  resolved: boolean;                 // Explore LOD: false = anonymous glint
  glint: SceneObject | null;         // lazy soft-mote stand-in (Explore)
  anim: AnimRecipe | null;           // router recipe; null = baseline idle only
  vfx: VfxRecipe | null;
  vfxAccum: number;                  // fractional emission carry
  /** Rest scale of the ACTIVE visual — vec3.one for the gem, the fitted scale
   *  for a conjured mesh, the aspect box for a conjured image. Scale recipes
   *  multiply this so pulse/swell never eat the auto-fit. */
  visualBase: vec3;
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
  private ribbon: SceneObject | null = null;
  private nextRing: ConjureRing | null = null;
  private nextRingMesh: RenderMesh | null = null;
  private glintCoreMesh: RenderMesh | null = null;
  private glintHaloMesh: RenderMesh | null = null;
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
      resolved: true,
      glint: null,
      anim: null,
      vfx: null,
      vfxAccum: 0,
      visualBase: vec3.one(),
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
      g.visualBase = vec3.one();   // replaced by the fit pass once the AABB is live
      this.applyResolvedVisibility(g);
      // Auto-fit needs live AABBs — keep the holder visible through the fit
      // window even when glinted; the fit pass re-applies visibility after.
      if (!g.resolved) holder.enabled = true;
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
      const imgScale = new vec3(IMAGE_HEIGHT_CM * aspect, IMAGE_HEIGHT_CM, 1);
      holder.getTransform().setLocalScale(imgScale);
      g.enhanced = holder;
      g.enhancedKind = "image";
      g.visualBase = imgScale;   // scale recipes multiply this, never replace it
      this.applyResolvedVisibility(g);
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
      this.applyResolvedVisibility(g);
      this.setGlowTint(memoryId, RGB_VIOLET as [number, number, number]);
      this.spawnVaporBurst(g.wrapper.getTransform().getWorldPosition());
      print("GemFactory: enhancement removed for " + memoryId);
      return true;
    }
    return false;
  }

  /**
   * Attach the router's motion + particle recipes to a gem (DESIGN.md: the LLM
   * tags every memory with animRecipe + vfxRecipe). Pass null/null to fall back
   * to the baseline idle. Safe to call before or after the visual is conjured.
   */
  setRecipes(memoryId: string, anim: AnimRecipe | null, vfx: VfxRecipe | null): void {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      g.anim = anim;
      g.vfx = vfx;
      g.vfxAccum = 0;
      // A recipe change can leave the last frame's offset/scale baked in.
      const active = g.enhanced !== null && !isNull(g.enhanced) ? g.enhanced : g.visual;
      if (!isNull(active)) {
        active.getTransform().setLocalPosition(vec3.zero());
        active.getTransform().setLocalScale(g.visualBase);
      }
      print("GemFactory: recipes for " + memoryId + " — anim=" + (anim === null ? "idle" : anim) +
        " vfx=" + (vfx === null ? "none" : vfx));
      return;
    }
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
      if (!g.resolved) continue;   // glints stay anonymous (Explore) — no gaze leak
      out.push({ memoryId: g.memoryId, pos: g.wrapper.getTransform().getWorldPosition() });
    }
    return out;
  }

  /**
   * Explore LOD: an unresolved gem renders as an anonymous GLINT — a soft
   * additive mote (violet core + faint teal halo; STYLE.md gradient glows) —
   * with visuals, light pool, and interaction hidden until approach.
   */
  setResolved(memoryId: string, resolved: boolean): void {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return;
      if (g.resolved === resolved) return;
      g.resolved = resolved;
      this.applyResolvedVisibility(g);
      return;
    }
  }

  private applyResolvedVisibility(g: GemRecord): void {
    if (isNull(g.wrapper)) return;
    // Glinted gems are unselectable — no content leaks at distance.
    const inter = g.wrapper.getComponent(Interactable.getTypeName());
    if (inter) inter.enabled = g.resolved;
    const col = g.wrapper.getComponent("Physics.ColliderComponent");
    if (col) col.enabled = g.resolved;
    if (g.enhanced !== null && !isNull(g.enhanced)) g.enhanced.enabled = g.resolved;
    g.visual.enabled = g.resolved && g.enhanced === null;
    if (g.glow !== null && !isNull(g.glow)) g.glow.enabled = g.resolved;
    if (!g.resolved && g.glint === null) g.glint = this.buildGlint(g);
    if (g.glint !== null && !isNull(g.glint)) g.glint.enabled = !g.resolved;
  }

  private setVisualBase(memoryId: string, base: vec3): void {
    for (const g of this.gems) {
      if (g.memoryId === memoryId) { g.visualBase = base; return; }
    }
  }

  /** Post-fit: re-sync an enhanced holder with the gem's resolve state (Explore). */
  private applyFitVisibility(memoryId: string): void {
    for (const g of this.gems) {
      if (g.memoryId === memoryId) { this.applyResolvedVisibility(g); return; }
    }
  }

  /** Soft anonymous mote: nested additive gradient discs, billboarded in update(). */
  private buildGlint(g: GemRecord): SceneObject {
    if (this.glintCoreMesh === null) this.glintCoreMesh = buildDiscMesh(1.5, RGB_LIGHT_VIOLET);
    if (this.glintHaloMesh === null) {
      this.glintHaloMesh = buildDiscMesh(3.0,
        [RGB_TEAL[0] * 0.4, RGB_TEAL[1] * 0.4, RGB_TEAL[2] * 0.4]);
    }
    const glint = global.scene.createSceneObject("GemGlint");
    glint.setParent(g.wrapper);   // rides the bob like everything else
    glint.getTransform().setLocalPosition(vec3.zero());
    const core = global.scene.createSceneObject("GlintCore");
    core.setParent(glint);
    const coreRmv = core.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    coreRmv.mesh = this.glintCoreMesh;
    coreRmv.mainMaterial = this.burstMat;
    const halo = global.scene.createSceneObject("GlintHalo");
    halo.setParent(glint);
    halo.getTransform().setLocalPosition(new vec3(0, 0, -0.15));   // behind the core
    const haloRmv = halo.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    haloRmv.mesh = this.glintHaloMesh;
    haloRmv.mainMaterial = this.burstMat;
    return glint;
  }

  /** A couple of rising motes off a glint (Explore twinkle visual). */
  emitGlintSparkle(memoryId: string): void {
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return;
      if (this.puffMeshA === null) this.puffMeshA = buildDiscMesh(1.3, RGB_LIGHT_VIOLET);
      if (this.puffMeshB === null) this.puffMeshB = buildDiscMesh(1.1, RGB_TEAL);
      const center = g.wrapper.getTransform().getWorldPosition();
      for (let i = 0; i < 2; i++) {
        const obj = global.scene.createSceneObject("GlintSpark");
        obj.setParent(this.parent);
        const jitter = new vec3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
        obj.getTransform().setWorldPosition(center.add(jitter));
        const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
        rmv.mesh = i % 2 === 0 ? this.puffMeshA : this.puffMeshB;
        rmv.mainMaterial = this.burstMat;
        this.particles.push({
          obj: obj,
          vel: new vec3(0, 8 + Math.random() * 5, 0),
          age: 0,
          life: 0.6 + Math.random() * 0.4,
          size: 0.3 + Math.random() * 0.25,
        });
      }
      return;
    }
  }

  /**
   * Draw the journey: a dashed violet→teal ribbon threading the loci in route
   * order (DESIGN.md "Journeys"). Rebuilt only when the route changes — capture,
   * delete, reorder, load — never per frame. Fewer than two loci = no ribbon.
   */
  setRoute(points: vec3[]): void {
    this.clearRoute();
    if (points.length < 2) return;
    const raw: [number, number, number][] = points.map((p) => [p.x, p.y, p.z] as [number, number, number]);
    const mesh = buildPathDashMesh(raw, RIBBON_WIDTH, RIBBON_DASH, RIBBON_GAP, RGB_VIOLET, RGB_TEAL);
    if (mesh === null) return;
    // Hosted at the origin with identity rotation, so mesh-local == world.
    const obj = global.scene.createSceneObject("JourneyRibbon");
    obj.setParent(this.parent);
    obj.getTransform().setWorldPosition(vec3.zero());
    obj.getTransform().setWorldRotation(quat.quatIdentity());
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = mesh;
    rmv.mainMaterial = this.burstMat;
    this.ribbon = obj;
    print("GemFactory: journey ribbon drawn — " + points.length + " loci");
  }

  clearRoute(): void {
    if (this.ribbon !== null && !isNull(this.ribbon)) this.ribbon.destroy();
    this.ribbon = null;
  }

  /**
   * Mark the next locus on the route: a slow teal orbit ring that breathes.
   * Content-free by construction, so Train can use it on a bare glow without
   * leaking the answer. Pass null to clear.
   */
  setNextLocus(memoryId: string | null): void {
    if (this.nextRing !== null) {
      if (this.nextRing.memoryId === memoryId) return;   // unchanged
      if (!isNull(this.nextRing.obj)) this.nextRing.obj.destroy();
      this.nextRing = null;
    }
    if (memoryId === null) return;
    for (const g of this.gems) {
      if (g.memoryId !== memoryId) continue;
      if (isNull(g.wrapper)) return;
      if (this.nextRingMesh === null) {
        this.nextRingMesh = buildDashedRingMesh(NEXT_RING_RADIUS, 0.5, 10, 0.55, RGB_TEAL);
      }
      const ring = global.scene.createSceneObject("NextLocusRing");
      ring.setParent(g.wrapper);   // rides the bob with its gem
      ring.getTransform().setLocalPosition(vec3.zero());
      const rmv = ring.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rmv.mesh = this.nextRingMesh;
      rmv.mainMaterial = this.burstMat;
      this.nextRing = { memoryId: memoryId, obj: ring };
      print("GemFactory: next locus → " + memoryId);
      return;
    }
  }

  /**
   * Ambient particle recipe around a living gem (DESIGN.md vfxRecipe). Rate-
   * based with a fractional accumulator, so the look is frame-rate independent;
   * gated by distance and by the global particle cap so a 30-memory palace
   * stays a palace and not a wind-chime shop.
   */
  private emitRecipeVfx(g: GemRecord, dt: number, camPos: vec3): void {
    if (this.particles.length >= VFX_PARTICLE_CAP) return;
    const center = g.wrapper.getTransform().getWorldPosition();
    if (center.sub(camPos).length > VFX_RANGE_CM) return;

    let rate: number;
    switch (g.vfx) {
      case "sparkle": rate = 1.6; break;
      case "smoke":   rate = 0.9; break;
      case "rain":    rate = 2.2; break;
      case "burst":   rate = 1 / VFX_BURST_PERIOD_S; break;
      default: return;
    }
    g.vfxAccum += dt * rate;
    if (g.vfxAccum > 3) g.vfxAccum = 1;   // never bank a backlog after a stall
    let budget = 2;                        // per-gem per-frame emission ceiling
    while (g.vfxAccum >= 1 && budget > 0) {
      g.vfxAccum -= 1;
      budget--;
      this.emitVfxUnit(g.vfx as VfxRecipe, center);
    }
  }

  /** One emission "tick" of a recipe — burst is the only multi-particle one. */
  private emitVfxUnit(vfx: VfxRecipe, center: vec3): void {
    if (this.puffMeshA === null) this.puffMeshA = buildDiscMesh(1.3, RGB_LIGHT_VIOLET);
    if (this.puffMeshB === null) this.puffMeshB = buildDiscMesh(1.1, RGB_TEAL);
    if (vfx === "burst") {
      // A quick radial pop — the "look at me" recipe for urgent memories.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 22 + Math.random() * 14;
        this.pushMote(center,
          new vec3(Math.cos(a) * speed, 4 + Math.random() * 6, Math.sin(a) * speed),
          0.4 + Math.random() * 0.25, 0.45 + Math.random() * 0.3);
      }
      return;
    }
    if (vfx === "sparkle") {
      const jitter = new vec3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
      this.pushMote(center.add(jitter), new vec3(0, 9 + Math.random() * 5, 0),
        0.7 + Math.random() * 0.4, 0.3 + Math.random() * 0.25);
      return;
    }
    if (vfx === "smoke") {
      // Bigger, slower, lazier — reads as a smoulder rather than a twinkle.
      const jitter = new vec3((Math.random() - 0.5) * 5, -2, (Math.random() - 0.5) * 5);
      this.pushMote(center.add(jitter),
        new vec3((Math.random() - 0.5) * 7, 4 + Math.random() * 4, (Math.random() - 0.5) * 7),
        1.1 + Math.random() * 0.6, 0.8 + Math.random() * 0.5);
      return;
    }
    // rain: drizzle falling through the memory from just above it.
    const spawn = center.add(new vec3((Math.random() - 0.5) * 10, 14, (Math.random() - 0.5) * 10));
    this.pushMote(spawn, new vec3(0, -34, 0), 0.8, 0.22 + Math.random() * 0.18);
  }

  private pushMote(pos: vec3, vel: vec3, life: number, size: number): void {
    const obj = global.scene.createSceneObject("RecipeMote");
    obj.setParent(this.parent);
    obj.getTransform().setWorldPosition(pos);
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    rmv.mesh = Math.random() < 0.5 ? (this.puffMeshA as RenderMesh) : (this.puffMeshB as RenderMesh);
    rmv.mainMaterial = this.burstMat;
    this.particles.push({ obj: obj, vel: vel, age: 0, life: life, size: size });
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
    g.visualBase = vec3.one();   // back to the gem visual's rest scale
    if (!isNull(g.visual)) g.visual.getTransform().setLocalPosition(vec3.zero());
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

  /** Play any track positionally (TTS "speak this memory", etc.). */
  playTrackAt(track: AudioTrackAsset, pos: vec3, volume: number): void {
    this.playOneShot(track, pos, volume);
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
    this.cleanup.push({ obj: obj, ttl: 12 });   // outlives reverb tails and TTS clips
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
    // Ring/ribbon lifetimes are tied to the route, not to any one gem.
    this.clearRoute();
    this.setNextLocus(null);
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
        this.setVisualBase(f.memoryId, new vec3(k, k, k));   // scale recipes build on the fit
        print("GemFactory: fitted enhanced mesh (" + size.toFixed(1) + " cm native → ×" + k.toFixed(2) + ")");
        this.pendingFit.splice(i, 1);
        this.applyFitVisibility(f.memoryId);   // re-sync with Explore resolve state
      } else if (f.frames > 12) {
        f.holder.getTransform().setLocalScale(new vec3(10, 10, 10));   // skill fallback floor
        this.setVisualBase(f.memoryId, new vec3(10, 10, 10));
        print("GemFactory: enhanced mesh unmeasurable — fallback scale 10");
        this.pendingFit.splice(i, 1);
        this.applyFitVisibility(f.memoryId);   // re-sync with Explore resolve state
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

    // Next-locus ring: lays flat, counter-rotates slowly, and breathes — the
    // "you're headed here" beacon, readable from across the room.
    if (this.nextRing !== null) {
      if (isNull(this.nextRing.obj)) {
        this.nextRing = null;
      } else {
        const nt = this.nextRing.obj.getTransform();
        nt.setLocalRotation(
          quat.angleAxis(-this.elapsed * 0.55, vec3.up())
            .multiply(quat.angleAxis(-Math.PI / 2, vec3.right())));
        const ns = 1 + 0.12 * Math.sin(this.elapsed * Math.PI * 2 * 0.5);
        nt.setLocalScale(new vec3(ns, ns, ns));
      }
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
      const t = this.elapsed + g.phase;
      const isImage = g.enhanced !== null && g.enhancedKind === "image" && !isNull(g.enhanced);
      const visual = g.enhanced !== null && !isNull(g.enhanced) ? g.enhanced : g.visual;

      // ── Recipe → motion parameters. Baseline idle applies to EVERY gem
      // (DESIGN: "at least idle bob + slow spin"); the recipe layers on top.
      let bobAmp = IDLE_BOB_CM * g.scale;
      let bobHz = IDLE_BOB_HZ;
      let spinRate = (Math.PI * 2) / IDLE_SPIN_S;
      let scaleMul = 1;
      let orbitR = 0;
      let shake = 0;
      switch (g.anim) {
        case "spin":  spinRate = (Math.PI * 2) / 3; break;
        case "bob":   bobAmp *= 3.2; bobHz = 0.5; break;
        case "pulse": scaleMul = 1 + 0.18 * Math.sin(t * Math.PI * 2 * 1.6); break;
        case "orbit": orbitR = ORBIT_RADIUS_CM; break;
        case "shake": shake = SHAKE_AMP_CM; break;
        case "swell": scaleMul = 1 + 0.30 * Math.sin(t * Math.PI * 2 * 0.35); break;
        default: break;   // null → baseline idle
      }

      if (isImage) {
        // Conjured images billboard toward the viewer (+Z at camera) — spin and
        // orbit would rotate the picture away from the reader, so they degrade
        // to a livelier bob instead.
        const toCam = camPos.sub(g.wrapper.getTransform().getWorldPosition()).normalize();
        const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
        (g.enhanced as SceneObject).getTransform().setWorldRotation(quat.lookAt(toCam, upRef));
        if (orbitR > 0 || g.anim === "spin") { bobAmp = IDLE_BOB_CM * g.scale * 3.2; bobHz = 0.5; }
        orbitR = 0;
      } else {
        // Spin on the active visual child (never the collider wrapper).
        visual.getTransform().setLocalRotation(quat.angleAxis(t * spinRate, vec3.up()));
      }

      // Orbit / scale ride the visual child; bob + shake ride the wrapper so
      // the collider (and every ring/glint parented to it) follows along.
      if (!isImage) {
        visual.getTransform().setLocalPosition(orbitR > 0
          ? new vec3(Math.cos(t * Math.PI * 2 * 0.5) * orbitR, 0, Math.sin(t * Math.PI * 2 * 0.5) * orbitR)
          : vec3.zero());
      }
      if (scaleMul !== 1) {
        visual.getTransform().setLocalScale(new vec3(
          g.visualBase.x * scaleMul, g.visualBase.y * scaleMul, g.visualBase.z * scaleMul));
      }

      const bob = Math.sin(t * Math.PI * 2 * bobHz) * bobAmp;
      let sx = 0, sz = 0, sy = 0;
      if (shake > 0) {
        // Three incommensurable frequencies = jitter that never visibly loops.
        sx = Math.sin(t * 37.1) * shake;
        sy = Math.sin(t * 43.7) * shake * 0.6;
        sz = Math.sin(t * 31.3) * shake;
      }
      g.wrapper.getTransform().setWorldPosition(
        new vec3(g.base.x + sx, g.base.y + bob + sy, g.base.z + sz));
      // The light pool breathes counter to the bob: gem closer → pool fuller.
      // (Arriving gems overwrite this later in update() — last write wins.)
      if (g.glow !== null && !isNull(g.glow)) {
        const gs = 1 - (bob / (IDLE_BOB_CM * g.scale)) * 0.1;
        g.glow.getTransform().setLocalScale(new vec3(gs, gs, gs));
      }

      // Ambient VFX — resolved gems only, distance-gated, under a global cap.
      if (g.resolved && g.vfx !== null && g.vfx !== "none") {
        this.emitRecipeVfx(g, dt, camPos);
      }
      // Explore glints: billboard toward the viewer + slow shimmer pulse.
      if (!g.resolved && g.glint !== null && !isNull(g.glint)) {
        const gpos = g.wrapper.getTransform().getWorldPosition();
        const toCam = camPos.sub(gpos).normalize();
        const upRef = Math.abs(toCam.dot(vec3.up())) > 0.98 ? vec3.forward() : vec3.up();
        g.glint.getTransform().setWorldRotation(quat.lookAt(toCam, upRef));
        const gls = 0.85 + 0.3 * Math.sin(this.elapsed * 2.1 + g.phase * 3);
        g.glint.getTransform().setLocalScale(new vec3(gls, gls, gls));
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
