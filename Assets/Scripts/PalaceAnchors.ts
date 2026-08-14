/**
 * PalaceAnchors — per-palace spatial anchoring over the native Spatial
 * Persistence surface: MappingSession checkpoint → LocationAsset
 * toSerialized / fromSerialized → LocatedAtComponent relocalization.
 *
 * Topology: ONE anchor per palace, not per memory. The native surface anchors
 * a mapped SPACE (a LocationAsset), not point features — one localization
 * event re-aligns the whole palace rigidly, which is exactly the app's model
 * (a palace is bound to one physical room; DESIGN.md). Per-memory anchors
 * would mean N checkpoints of the same map and the possibility of a
 * half-restored palace — the error-wall DESIGN.md forbids. Raw world poses
 * remain the source of truth (dual-write); an anchor only ever CORRECTS
 * them, never gates them.
 *
 * Flow:
 *   edit session   beginMapping() — a quality-building mapping session runs
 *                  while the user walks and captures.
 *   Done / save    requestAnchor() checkpoints the map, measures the anchor
 *                  frame's pose in this session, and hands the caller
 *                  {link, serialized} to persist (PalaceStore sidecar key).
 *   palace open    beginRestore() deserializes the stored location; when the
 *                  OS relocalizes the room (onFound) the caller gets an
 *                  AnchorFix — the rigid delta stored-frame → this-session
 *                  frame. Bounded by RESTORE_WINDOW_S; on timeout the raw
 *                  poses simply stand (gems spawned from them immediately).
 *
 * Editor: the module disarms at construction (isEditor) — every entry point
 * returns immediately, the preview experience is carried entirely by raw
 * poses, and boot logs stay clean. On device every native call sits in
 * try/catch and failure degrades silently to raw poses ("never block, never
 * error-wall"). The on-device path is UNVERIFIED this week (no hardware) —
 * hence the defensive posture everywhere.
 *
 * NOTE: MappingSession / MappingOptions are deprecated since Lens Scripting
 * v371 in favor of the Spatial Anchors package — which is not in the Asset
 * Library as of LS 5.23 (searched; the samples vendor it privately). The
 * deprecated calls still ship in StudioLib and are isolated HERE so a later
 * package swap touches exactly one file. LocatedAtComponent and the
 * LocationAsset serialize pair are NOT deprecated.
 */
import {
  AnchorLink, StoredPose,
  anchorBlobKey, toStoredVec3, fromStoredVec3, toStoredQuat, fromStoredQuat,
} from "./PalaceStore";

const POSE_WINDOW_S = 6;        // our own just-checkpointed map should be Found fast
const RESTORE_WINDOW_S = 12;    // relocalization window after a palace opens
const CHECKPOINT_WINDOW_S = 30; // Done pressed but map quality never got there

/** Rigid re-alignment from a palace's stored frame to this session's frame. */
export interface AnchorFix {
  /** Re-express a stored world point in this session's world frame. */
  movePoint(p: vec3): vec3;
  /** Re-express a stored world direction (e.g. a surface normal). */
  moveDirection(d: vec3): vec3;
  /** The anchor frame's pose in this session — persist it WITH the rebased
   *  poses so the stored frame stays self-consistent for the next session. */
  newPose: StoredPose;
}

interface Probe {
  obj: SceneObject;
  located: LocatedAtComponent;
  age: number;
  window: number;
  foundReg: EventRegistration | null;
  errorReg: EventRegistration | null;
  /** Written by the native onFound callback; DELIVERED from update() so
   *  native event stacks never re-enter gem/scene teardown. */
  result: { pos: vec3; rot: quat } | null;
  errored: boolean;
  isRestore: boolean;
  onFound: (pos: vec3, rot: quat) => void;
  onTimeout: () => void;
}

function makeFix(saved: StoredPose, nowPos: vec3, nowRot: quat): AnchorFix {
  const savedPos = fromStoredVec3(saved.p);
  const savedRot = fromStoredQuat(saved.r);
  const deltaRot = nowRot.multiply(savedRot.invert());
  return {
    movePoint: (p: vec3) => nowPos.add(deltaRot.multiplyVec3(p.sub(savedPos))),
    moveDirection: (d: vec3) => deltaRot.multiplyVec3(d),
    newPose: { p: toStoredVec3(nowPos), r: toStoredQuat(nowRot) },
  };
}

function identityPose(): StoredPose {
  return { p: { x: 0, y: 0, z: 0 }, r: { x: 0, y: 0, z: 0, w: 1 } };
}

export class PalaceAnchors {
  private root: SceneObject;
  private disabled: boolean;
  private session: MappingSession | null = null;
  private anchorPending = false;
  private checkpointTimer = 0;
  private probes: Probe[] = [];

  constructor(root: SceneObject) {
    this.root = root;
    this.disabled = global.deviceInfoSystem.isEditor();
    if (this.disabled) {
      print("PalaceAnchors: editor preview — anchoring disarmed; raw world poses carry the experience");
    }
  }

  // ── Mapping (edit sessions only) ───────────────────────────────────────────

  /** Start building a map of the room. Idempotent; device-only. */
  beginMapping(): void {
    if (this.disabled || this.session !== null) return;
    try {
      const options = LocatedAtComponent.createMappingOptions();
      // policy stays default ("auto"); location unset = map in the current AR
      // session frame; no cloud module = map storage private to the user.
      this.session = LocatedAtComponent.createMappingSession(options);
      print("PalaceAnchors: mapping session started");
    } catch (e) {
      // Capability absent on this OS build — stand down for the whole run
      // rather than retrying an error-wall on every session.
      this.disabled = true;
      print("PalaceAnchors: mapping unavailable (" + e + ") — raw poses carry this run");
    }
  }

  /** Stop mapping (Done without an anchor to mint, or checkpoint finished). */
  stopMapping(): void {
    if (this.session === null) return;
    try {
      this.session.cancel();
    } catch (e) {
      print("PalaceAnchors: mapping cancel failed (" + e + ")");
    }
    this.session = null;
  }

  /**
   * Checkpoint the running map into a persistable anchor for `palaceId`.
   * On success the callback gets {link, serialized} to store — possibly after
   * the session that requested it already ended (the caller re-loads the
   * record if so). Every failure path just logs; the palace stays raw-pose.
   */
  requestAnchor(palaceId: string,
    onAnchor: (link: AnchorLink, serialized: string) => void): void {
    if (this.disabled || this.session === null) return;
    if (this.anchorPending) {
      print("PalaceAnchors: anchor already pending — this save stays raw-pose until it resolves");
      return;
    }
    this.anchorPending = true;
    this.checkpointTimer = 0;
    try {
      this.session.checkpoint().then((loc: LocationAsset) => {
        if (!this.anchorPending) return;   // CHECKPOINT_WINDOW_S gave up already
        this.anchorPending = false;
        this.stopMapping();                // map captured — stop paying for mapping
        let serialized = "";
        try {
          serialized = loc.toSerialized();
        } catch (e) {
          print("PalaceAnchors: location serialize failed (" + e + ") — palace stays raw-pose");
          return;
        }
        if (serialized.length === 0) {
          print("PalaceAnchors: empty serialized location — palace stays raw-pose");
          return;
        }
        // Measure where the mapped frame sits in THIS session (should be ≈ the
        // AR origin per MappingOptions docs — measured, not assumed). If our
        // own fresh map is somehow never Found, the documented frame stands in.
        const link = (pose: StoredPose): AnchorLink =>
          ({ key: anchorBlobKey(palaceId), pose: pose });
        this.spawnProbe(loc, POSE_WINDOW_S, false,
          (pos, rot) => onAnchor(link({ p: toStoredVec3(pos), r: toStoredQuat(rot) }), serialized),
          () => onAnchor(link(identityPose()), serialized));
      }).catch((e: any) => {
        this.anchorPending = false;
        this.stopMapping();
        print("PalaceAnchors: checkpoint failed (" + e + ") — palace stays raw-pose");
      });
    } catch (e) {
      this.anchorPending = false;
      print("PalaceAnchors: checkpoint call failed (" + e + ") — palace stays raw-pose");
    }
  }

  // ── Relocalization (any palace open) ───────────────────────────────────────

  /**
   * Try to localize a stored anchor. Fires `onFix` AT MOST ONCE, only within
   * the window; the caller spawned gems from raw poses already, so timing out
   * costs nothing. A stale probe from a previous palace is cancelled first —
   * one active palace means one active restore.
   */
  beginRestore(serialized: string, savedPose: StoredPose,
    onFix: (fix: AnchorFix) => void): void {
    if (this.disabled) return;
    this.cancelRestore();
    let loc: LocationAsset;
    try {
      loc = LocationAsset.fromSerialized(serialized);
    } catch (e) {
      print("PalaceAnchors: stored anchor unreadable (" + e + ") — raw poses stand");
      return;
    }
    this.spawnProbe(loc, RESTORE_WINDOW_S, true,
      (pos, rot) => onFix(makeFix(savedPose, pos, rot)),
      () => print("PalaceAnchors: relocalization window closed — raw poses stand"));
  }

  /** Drop any pending restore (palace closed / another opened). No callbacks. */
  cancelRestore(): void {
    for (let i = this.probes.length - 1; i >= 0; i--) {
      if (!this.probes[i].isRestore) continue;
      const p = this.probes.splice(i, 1)[0];
      this.destroyProbe(p);
    }
  }

  /** Session teardown: drop restores; keep a pending checkpoint (it may still
   *  resolve into a perfectly good anchor for the just-saved palace). */
  onSessionEnd(): void {
    this.cancelRestore();
  }

  // ── Frame loop (driven from MemoryPalace.onUpdate) ─────────────────────────

  update(dt: number): void {
    if (this.disabled) return;

    // Done pressed but the map never reached checkpoint quality — give up so
    // the mapping session doesn't run forever in the background.
    if (this.anchorPending) {
      this.checkpointTimer += dt;
      if (this.checkpointTimer > CHECKPOINT_WINDOW_S) {
        this.anchorPending = false;
        this.stopMapping();
        print("PalaceAnchors: map quality never reached checkpoint — palace stays raw-pose this time");
      }
    }

    for (let i = this.probes.length - 1; i >= 0; i--) {
      const p = this.probes[i];
      p.age += dt;
      if (p.result !== null) {
        const r = p.result;
        this.probes.splice(i, 1);
        this.destroyProbe(p);
        p.onFound(r.pos, r.rot);
      } else if (p.errored || p.age > p.window) {
        this.probes.splice(i, 1);
        this.destroyProbe(p);
        p.onTimeout();
      }
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** A throwaway SceneObject + LocatedAtComponent that reports where a
   *  LocationAsset's frame sits in this session's world coordinates. */
  private spawnProbe(loc: LocationAsset, window: number, isRestore: boolean,
    onFound: (pos: vec3, rot: quat) => void, onTimeout: () => void): void {
    try {
      const obj = global.scene.createSceneObject("PalaceAnchorProbe");
      obj.setParent(this.root);
      const located = obj.createComponent("Component.LocatedAtComponent");
      const probe: Probe = {
        obj: obj, located: located, age: 0, window: window,
        foundReg: null, errorReg: null, result: null, errored: false,
        isRestore: isRestore, onFound: onFound, onTimeout: onTimeout,
      };
      // Subscribe BEFORE assigning the location so an immediate Found (same
      // session, map still hot) can't slip past us.
      probe.foundReg = located.onFound.add(() => {
        if (probe.result !== null) return;   // first Found wins; refinements ignored
        const t = obj.getTransform();
        probe.result = { pos: t.getWorldPosition(), rot: t.getWorldRotation() };
      });
      probe.errorReg = located.onError.add(() => {
        probe.errored = true;
      });
      located.location = loc;
      this.probes.push(probe);
    } catch (e) {
      print("PalaceAnchors: probe failed (" + e + ") — raw poses stand");
      onTimeout();
    }
  }

  private destroyProbe(p: Probe): void {
    try {
      if (p.foundReg !== null) p.located.onFound.remove(p.foundReg);
      if (p.errorReg !== null) p.located.onError.remove(p.errorReg);
    } catch (e) {
      // Registration teardown is best-effort — the object dies next anyway.
    }
    try {
      p.obj.destroy();
    } catch (e) {
      print("PalaceAnchors: probe destroy failed (" + e + ")");
    }
  }
}
