/**
 * PalaceStore — palace persistence over global.persistentStorageSystem
 * (Wednesday milestone: "palace save/load — persistentStorage metadata").
 *
 * Layout in the GeneralDataStore:
 *   mp_index          JSON PalaceSummary[] — picker rows without loading bodies
 *   mp_palace_<id>    JSON Palace — full record incl. memories
 *
 * Spatial Anchors are deferred (package not installed; device-only to verify) —
 * v1 persists raw world poses per DESIGN.md "Location linking (v1 honesty)".
 * Positions are rounded to 0.1 cm to keep JSON small.
 *
 * Every save/load prints counts + sizes + positions — that log line is the
 * persistence verification evidence (editor: the store survives lens resets
 * within a Lens Studio session).
 */

const INDEX_KEY = "mp_index";
const PALACE_KEY_PREFIX = "mp_palace_";

/** DESIGN.md size guard: cap memories per palace well under storage limits. */
export const MAX_MEMORIES_PER_PALACE = 50;
/** Soft warning threshold for one palace's JSON payload (chars ≈ bytes). */
const SOFT_PALACE_CHARS = 24000;

export interface StoredVec3 {
  x: number;
  y: number;
  z: number;
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
  /** Conjured imagery request — regenerated lazily on palace load. */
  enhance?: EnhanceSpec;
}

export interface Palace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  memories: MemoryRecord[];
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
