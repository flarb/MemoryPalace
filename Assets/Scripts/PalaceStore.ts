/**
 * PalaceStore — palace persistence over global.persistentStorageSystem
 * (Wednesday milestone: "palace save/load — persistentStorage metadata").
 *
 * Layout in the GeneralDataStore:
 *   mp_index          JSON PalaceSummary[] — picker rows without loading bodies
 *   mp_palace_<id>    JSON Palace — full record incl. memories
 *   mp_anchor_<id>    opaque serialized LocationAsset (PalaceAnchors) — the
 *                     palace's spatial-anchor map handle, stored BESIDE the
 *                     palace so an OS blob can never bloat the JSON body
 *
 * Spatial anchoring is DUAL-WRITE (see PalaceAnchors.ts): raw world poses stay
 * the source of truth per DESIGN.md "Location linking (v1 honesty)"; a palace
 * that also carries `anchor` {key, pose} can rigidly re-align those poses when
 * the device relocalizes the room. Pre-anchor saves (no `anchor`) load and
 * behave exactly as before. Positions are rounded to 0.1 cm to keep JSON small.
 *
 * Every save/load prints counts + sizes + positions — that log line is the
 * persistence verification evidence (editor: the store survives lens resets
 * within a Lens Studio session).
 */

const INDEX_KEY = "mp_index";
const PALACE_KEY_PREFIX = "mp_palace_";

/** DESIGN.md size guard: cap memories per palace well under storage limits. */
export const MAX_MEMORIES_PER_PALACE = 50;
/** Soft warning threshold for one palace's JSON payload (chars ≈ bytes).
 *  Raised for photo persistence — MemoryPalace's PHOTO_BUDGET_CHARS caps the
 *  photo share well under this. */
const SOFT_PALACE_CHARS = 64000;

export interface StoredVec3 {
  x: number;
  y: number;
  z: number;
}

export interface StoredQuat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** A world pose (position + rotation), rounded for storage. */
export interface StoredPose {
  p: StoredVec3;
  r: StoredQuat;
}

/**
 * Per-palace spatial-anchor link (PalaceAnchors.ts). `key` names the sibling
 * store entry holding the opaque serialized LocationAsset; `pose` is the
 * anchor frame's world transform in the same frame the raw positions were
 * last written in. ONE anchor per palace — a palace is bound to one physical
 * room, so the whole set re-aligns rigidly or not at all (never half a
 * palace; DESIGN.md "never error-wall").
 */
export interface AnchorLink {
  key: string;
  pose: StoredPose;
}

export interface EnhanceSpec {
  kind: "mesh" | "image";
  prompt: string;
}

export interface MemoryRecord {
  id: string;
  transcript: string;
  position: StoredVec3;
  surfaceNormal?: StoredVec3;
  createdAt: number;
  /** Recall mastery 0–3 (Train self-grades); absent on old saves = 0. */
  mastery?: number;
  /** Router output (MemoryRouter): 2–4 word title shown instead of the raw
   *  transcript on gaze labels and Train prompts. Absent = show transcript. */
  label?: string;
  /** Router output: procedural motion + particle recipes driving this gem.
   *  Absent (old saves, routing offline) = the classic idle bob + slow spin. */
  anim?: string;
  vfx?: string;
  /** Journey position along the route. Absent on old saves — `routeOrder()`
   *  falls back to capture order, which is exactly what Train v1 assumed. */
  order?: number;
  /** 192 px JPEG b64 crop of the framed region (persistence is a bonus,
   *  never a gate — absent = in-session-only or no photo). */
  snap?: string;
  /** 16 px twin of `snap` — bilinear upscale = the Train blur hint. */
  snapTiny?: string;
  /** The router's imagery pick, held until the user taps Conjure. Distinct
   *  from `enhance`: this is an OFFER (nothing generates), `enhance` is the
   *  accepted REQUEST (regenerates on every palace load). */
  routeKind?: string;
  routePrompt?: string;
  /** Conjured imagery request — regenerated lazily on palace load. */
  enhance?: EnhanceSpec;
}

export interface Palace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  memories: MemoryRecord[];
  /** Spatial-anchor link; absent on pre-anchor saves (raw poses only). */
  anchor?: AnchorLink;
}

export interface PalaceSummary {
  id: string;
  name: string;
  memoryCount: number;
  updatedAt: number;
}

export function toStoredVec3(v: vec3): StoredVec3 {
  return {
    x: Math.round(v.x * 10) / 10,
    y: Math.round(v.y * 10) / 10,
    z: Math.round(v.z * 10) / 10,
  };
}

export function fromStoredVec3(s: StoredVec3): vec3 {
  return new vec3(s.x, s.y, s.z);
}

/** Quats round to 4 dp — unit components need finer grain than the 0.1 cm
 *  position rule (0.1 on a unit quat would be a multi-degree wobble). */
export function toStoredQuat(q: quat): StoredQuat {
  return {
    x: Math.round(q.x * 10000) / 10000,
    y: Math.round(q.y * 10000) / 10000,
    z: Math.round(q.z * 10000) / 10000,
    w: Math.round(q.w * 10000) / 10000,
  };
}

export function fromStoredQuat(s: StoredQuat): quat {
  const q = new quat(s.w, s.x, s.y, s.z);
  q.normalize();   // undo rounding drift — LocatedAt math wants unit quats
  return q;
}

const ANCHOR_KEY_PREFIX = "mp_anchor_";
/** Anchor blobs are opaque OS handles of unknown size — refuse silly ones
 *  rather than let one palace's map evict everything else in the store. */
const ANCHOR_BLOB_CHARS = 32000;

export function anchorBlobKey(palaceId: string): string {
  return ANCHOR_KEY_PREFIX + palaceId;
}

/**
 * The journey: memories in route order (DESIGN.md "Journeys" — an ordered
 * route through the palace). `order` is authoritative when present; records
 * without it keep their capture position, which is what Train v1 walked. The
 * returned array is a new array over the SAME records — mutating a record
 * through it still edits the palace.
 */
export function routeOrder(memories: MemoryRecord[]): MemoryRecord[] {
  const decorated = memories.map((m, i) => ({
    rec: m,
    key: m.order !== undefined ? m.order : i,
    i: i,
  }));
  decorated.sort((a, b) => (a.key !== b.key ? a.key - b.key : a.i - b.i));
  return decorated.map((d) => d.rec);
}

/** Renumber `order` to a dense 0..n-1 along the current route order. */
export function normalizeRoute(memories: MemoryRecord[]): void {
  const route = routeOrder(memories);
  for (let i = 0; i < route.length; i++) route[i].order = i;
}

/**
 * Swap a memory with its route neighbour (delta -1 earlier / +1 later).
 * Returns the memory's new 0-based route index, or -1 when it can't move.
 */
export function moveInRoute(memories: MemoryRecord[], memoryId: string, delta: number): number {
  normalizeRoute(memories);
  const route = routeOrder(memories);
  let at = -1;
  for (let i = 0; i < route.length; i++) {
    if (route[i].id === memoryId) { at = i; break; }
  }
  if (at < 0) return -1;
  const to = at + delta;
  if (to < 0 || to >= route.length) return -1;
  const a = route[at];
  const b = route[to];
  const tmp = a.order;
  a.order = b.order;
  b.order = tmp;
  return to;
}

function fmtPositions(memories: MemoryRecord[]): string {
  return memories
    .map((m) => "(" + m.position.x + ", " + m.position.y + ", " + m.position.z + ")")
    .join(" ");
}

let idCounter = 0;
function freshId(prefix: string): string {
  idCounter++;
  return prefix + Date.now().toString(36) + "_" + idCounter.toString(36) +
    Math.floor(Math.random() * 46656).toString(36);
}

export function freshMemoryId(): string {
  return freshId("m");
}

export class PalaceStore {
  private store: GeneralDataStore;

  constructor() {
    this.store = global.persistentStorageSystem.store;
    this.store.onStoreFull = () => {
      print("PalaceStore: STORAGE FULL — the last save was rejected; delete memories or palaces");
    };
    const idx = this.readIndex();
    print("PalaceStore: ready — " + idx.length + " saved palace(s), store keys: " +
      this.store.getAllKeys().length);
  }

  /** Summaries, most recently updated first (picker order per DESIGN.md). */
  listPalaces(): PalaceSummary[] {
    return this.readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** True when a full record exists for this palace id. */
  has(id: string): boolean {
    return this.store.has(PALACE_KEY_PREFIX + id);
  }

  /** New blank palace, auto-named "Palace N" — NOT persisted until save(). */
  createPalace(): Palace {
    const now = Date.now();
    const palace: Palace = {
      id: freshId("p"),
      name: "Palace " + this.nextPalaceNumber(),
      createdAt: now,
      updatedAt: now,
      memories: [],
    };
    print("PalaceStore: created \"" + palace.name + "\" (" + palace.id + ") — unsaved until first save");
    return palace;
  }

  load(id: string): Palace | null {
    const key = PALACE_KEY_PREFIX + id;
    if (!this.store.has(key)) {
      print("PalaceStore: load failed — no record for id " + id);
      return null;
    }
    const json = this.store.getString(key);
    try {
      const palace = JSON.parse(json) as Palace;
      print("PalaceStore: loaded \"" + palace.name + "\" — " + palace.memories.length +
        " memories, " + json.length + " chars; positions: " + fmtPositions(palace.memories));
      return palace;
    } catch (e) {
      print("PalaceStore: load parse failed for " + id + " (" + e + ")");
      return null;
    }
  }

  /** Persist the palace and upsert its index summary. Auto-bumps updatedAt. */
  save(palace: Palace): boolean {
    if (palace.memories.length > MAX_MEMORIES_PER_PALACE) {
      print("PalaceStore: save refused — " + palace.memories.length + " memories exceeds the " +
        MAX_MEMORIES_PER_PALACE + " cap");
      return false;
    }
    palace.updatedAt = Date.now();
    const json = JSON.stringify(palace);
    if (json.length > SOFT_PALACE_CHARS) {
      print("PalaceStore: WARNING — \"" + palace.name + "\" is " + json.length +
        " chars (soft limit " + SOFT_PALACE_CHARS + "); nearing storage limits");
    }
    this.store.putString(PALACE_KEY_PREFIX + palace.id, json);

    const index = this.readIndex().filter((s) => s.id !== palace.id);
    index.push({
      id: palace.id,
      name: palace.name,
      memoryCount: palace.memories.length,
      updatedAt: palace.updatedAt,
    });
    this.store.putString(INDEX_KEY, JSON.stringify(index));

    print("PalaceStore: saved \"" + palace.name + "\" — " + palace.memories.length +
      " memories, " + json.length + " chars; positions: " + fmtPositions(palace.memories));
    return true;
  }

  // ── Spatial-anchor blobs (dual-write sidecar; never gates palace loads) ────

  /** Persist a palace's opaque serialized anchor location. Size-guarded. */
  saveAnchorBlob(palaceId: string, serialized: string): boolean {
    if (serialized.length === 0 || serialized.length > ANCHOR_BLOB_CHARS) {
      print("PalaceStore: anchor blob refused for " + palaceId + " (" +
        serialized.length + " chars; budget " + ANCHOR_BLOB_CHARS + ") — palace stays raw-pose");
      return false;
    }
    this.store.putString(anchorBlobKey(palaceId), serialized);
    print("PalaceStore: anchor blob saved for " + palaceId + " (" +
      serialized.length + " chars)");
    return true;
  }

  /** The palace's serialized anchor location, or null when it has none. */
  loadAnchorBlob(palaceId: string): string | null {
    const key = anchorBlobKey(palaceId);
    if (!this.store.has(key)) return null;
    const s = this.store.getString(key);
    return s.length > 0 ? s : null;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private readIndex(): PalaceSummary[] {
    if (!this.store.has(INDEX_KEY)) return [];
    try {
      const arr = JSON.parse(this.store.getString(INDEX_KEY));
      return Array.isArray(arr) ? (arr as PalaceSummary[]) : [];
    } catch (e) {
      print("PalaceStore: index parse failed — starting fresh (" + e + ")");
      return [];
    }
  }

  /** Next N for "Palace N" — max existing suffix + 1, so names stay unique. */
  private nextPalaceNumber(): number {
    let maxN = 0;
    for (const s of this.readIndex()) {
      const m = /^Palace (\d+)$/.exec(s.name);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    return maxN + 1;
  }
}
