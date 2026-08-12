/**
 * TrainController — Train mode v1's quiz targeting (DESIGN.md "Train mode",
 * core tier: recall quiz + self-grading + mastery ladder).
 *
 * Journey v1 = the active palace's memories in capture order (no editing UI).
 * Loci hide as bare glows (GemFactory glint rendering, distance auto-resolve
 * OFF); the CURRENT target pings periodically from its direction (twinkle SFX
 * + sparkle — spatial audio as wayfinding, DESIGN.md sound map). Arriving
 * within PROMPT_RANGE fires onPrompt; reveal/grade/mastery/persistence live
 * in MemoryPalace (it owns the palace + store, per the delete/enhance idiom).
 *
 * Plain class (GemFactory idiom): begin()/end() bracket a route,
 * update(dt, camPos) drives seek-phase pings + arrival detection.
 */
import { GemFactory } from "./GemFactory";
import { MemoryRecord, fromStoredVec3 } from "./PalaceStore";

const TWINKLE_SFX = requireAsset("../GeneratedSFX/twinkle.wav") as AudioTrackAsset;

const PROMPT_RANGE = 260;    // cm — the same arrival radius Explore resolves at
const PING_MIN_S = 2.2;
const PING_MAX_S = 3.6;
const PING_VOL = 0.3;

type TrainPhase = "seek" | "prompt" | "revealed";

interface TrainAnchor {
  memoryId: string;
  transcript: string;
  pos: vec3;
}

export class TrainController {
  private anchors: TrainAnchor[] = [];
  private index = 0;
  private phaseState: TrainPhase = "seek";
  private training = false;
  private elapsed = 0;
  private nextPing = 0;
  private onPrompt: ((memoryId: string) => void) | null = null;

  constructor(private gems: GemFactory) {}

  /** Start the route over the active palace's memories, capture order. */
  begin(memories: MemoryRecord[], onPrompt: (memoryId: string) => void): void {
    this.anchors = memories.map((m) => ({
      memoryId: m.id, transcript: m.transcript, pos: fromStoredVec3(m.position),
    }));
    this.index = 0;
    this.phaseState = "seek";
    this.training = true;
    this.onPrompt = onPrompt;
    this.nextPing = this.elapsed + 0.8;   // first ping fast — orient immediately
    print("Train: begin — " + this.anchors.length + " loci in capture order");
  }

  end(): void {
    this.training = false;
    this.anchors = [];
    this.onPrompt = null;
    print("Train: end");
  }

  current(): TrainAnchor | null {
    return this.index < this.anchors.length ? this.anchors[this.index] : null;
  }

  /** Prompt → revealed. False when not currently prompting (guards the UI). */
  markRevealed(): boolean {
    if (!this.training || this.phaseState !== "prompt") return false;
    this.phaseState = "revealed";
    return true;
  }

  /** Editor testing hook: force the prompt without walking into range. */
  forcePrompt(): void {
    if (!this.training || this.phaseState !== "seek") return;
    this.enterPrompt();
  }

  /** Next locus. True while loci remain; false = route complete. */
  advance(): boolean {
    this.index++;
    this.phaseState = "seek";
    this.nextPing = this.elapsed + 0.8;
    return this.index < this.anchors.length;
  }

  update(dt: number, camPos: vec3): void {
    this.elapsed += dt;
    if (!this.training || this.phaseState !== "seek") return;
    const cur = this.current();
    if (cur === null) return;
    const d = cur.pos.sub(camPos).length;
    if (d < PROMPT_RANGE) {
      this.enterPrompt();
      return;
    }
    // Spatial wayfinding: periodic soft ping FROM the target's direction.
    if (this.elapsed >= this.nextPing) {
      this.nextPing = this.elapsed + PING_MIN_S + Math.random() * (PING_MAX_S - PING_MIN_S);
      this.gems.playTrackAt(TWINKLE_SFX, cur.pos, PING_VOL);
      this.gems.emitGlintSparkle(cur.memoryId);
      print("Train: ping locus " + (this.index + 1) + "/" + this.anchors.length +
        " \"" + cur.transcript + "\" d=" + d.toFixed(0) + " cm");
    }
  }

  private enterPrompt(): void {
    this.phaseState = "prompt";
    const cur = this.current();
    if (cur !== null && this.onPrompt !== null) this.onPrompt(cur.memoryId);
  }
}
