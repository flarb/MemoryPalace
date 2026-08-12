/**
 * ExploreController — Explore mode's LOD + soundscape driver (DESIGN.md
 * "Explore mode (walk your palace)").
 *
 *  - Distant anchors render as anonymous GLINTS (GemFactory.setResolved(false));
 *    they resolve into the gem / conjured object on approach. A hysteresis band
 *    keeps the boundary from flickering.
 *  - ONE proximity whisper at a time (nearest wins, DESIGN.md sound rule 5):
 *    the memory's audio plays faint and positional, swelling as you near — you
 *    hear memories before you see them (the whisper opens at 3.0 m while the
 *    anchor is still a glint; resolution happens at 2.6 m).
 *  - Sparse twinkles on the nearest-N glints (per-anchor 2.5–7 s cadence plus
 *    a global cooldown — a palace of 30 memories is never a wind-chime shop).
 *
 * Whisper source (v1): this codebase keeps no recorded-audio buffer (the
 * capture wizard is ASR-only), so the memory's audio is the per-memory TTS
 * cache — EnhanceService.generateSpeech (OpenAI tts-1 "shimmer" via RSG),
 * shared with the gaze-label speak button and the card's full playback. TTS
 * unavailable → silent, glint only. "Whisper" = distance-driven volume ramp +
 * on-device spatial audio; runtime low-pass isn't cheaply available on
 * AudioComponent (accepted v1 reading).
 *
 * Plain class (GemFactory idiom): constructed once by MemoryPalace, begin()/
 * end() bracket an Explore walk, update(dt, camPos) drives it per frame.
 */
import { GemFactory } from "./GemFactory";
import { EnhanceService } from "./EnhanceService";
import { MemoryRecord, fromStoredVec3 } from "./PalaceStore";

const TWINKLE_SFX = requireAsset("../GeneratedSFX/twinkle.wav") as AudioTrackAsset;

// ── LOD thresholds (cm, room scale — tune in preview) ────────────────────────
const RESOLVE_ENTER = 260;      // glint materializes into the gem/object
const RESOLVE_EXIT = 330;       // …and re-glints past this (hysteresis band)
const WHISPER_RANGE = 300;      // whisper opens (vol 0) — before resolution
const WHISPER_NEAR = 90;        // …and reaches full whisper level by here
const WHISPER_VOL = 0.42;       // faint by design — select playback is 0.85
const WHISPER_GAP_S = 2.8;      // breath between repeats while dwelling
const WHISPER_GUARD_S = 0.6;    // min play window before trusting !isPlaying
const WHISPER_LOG_S = 1.5;      // periodic whisper status print (verification)
const TTS_RETRY_S = 30;         // wait after a failed TTS fetch

// ── Twinkles: sparse, nearest-N capped (DESIGN.md sound rule 5) ──────────────
const TWINKLE_RANGE = 1200;
const TWINKLE_N = 3;
const TWINKLE_MIN_S = 2.5;
const TWINKLE_MAX_S = 7.0;
const TWINKLE_COOLDOWN_S = 0.9;
const TWINKLE_VOL_NEAR = 0.3;
const TWINKLE_VOL_FAR = 0.12;

interface ExploreAnchor {
  memoryId: string;
  transcript: string;
  pos: vec3;
  resolved: boolean;
  nextTwinkle: number;   // elapsed-time deadline
}

export class ExploreController {
  private anchors: ExploreAnchor[] = [];
  private exploring = false;
  private suppressed = false;   // memory card open → whisper yields to playback
  private elapsed = 0;
  private lastTwinkleAt = -TWINKLE_COOLDOWN_S;

  // ONE whisper at a time (nearest wins).
  private whisperObj: SceneObject | null = null;
  private whisperAudio: AudioComponent | null = null;
  private whisperTargetId: string | null = null;
  private whisperGap = 0;
  private whisperGuard = 0;
  private whisperLogIn = 0;

  // TTS per memory: track when ready, deadline before retrying failures.
  private tts: { [memoryId: string]: AudioTrackAsset } = {};
  private ttsPending: { [memoryId: string]: boolean } = {};
  private ttsRetryAt: { [memoryId: string]: number } = {};

  constructor(private parent: SceneObject, private gems: GemFactory,
              private enhancer: EnhanceService) {}

  /** Start an Explore walk over the active palace's memories. */
  begin(memories: MemoryRecord[]): void {
    this.anchors = memories.map((m) => ({
      memoryId: m.id,
      transcript: m.transcript,
      pos: fromStoredVec3(m.position),
      resolved: true,   // gems spawn resolved; the first update() applies real LOD
      nextTwinkle: this.elapsed + Math.random() * TWINKLE_MAX_S,
    }));
    this.exploring = true;
    this.suppressed = false;
    print("Explore: begin — " + this.anchors.length + " anchors");
  }

  /** End the walk: silence the whisper, forget the anchors. */
  end(): void {
    this.exploring = false;
    this.stopWhisper();
    this.anchors = [];
    print("Explore: end");
  }

  /** While the memory card is open, the whisper yields to full playback. */
  setSuppressed(v: boolean): void {
    if (this.suppressed === v) return;
    this.suppressed = v;
    if (v) this.stopWhisper();
  }

  update(dt: number, camPos: vec3): void {
    this.elapsed += dt;
    if (!this.exploring) return;

    // ── LOD: glint ⇄ resolved, with hysteresis ───────────────────────────────
    for (const a of this.anchors) {
      const d = a.pos.sub(camPos).length;
      if (a.resolved && d > RESOLVE_EXIT) {
        a.resolved = false;
        this.gems.setResolved(a.memoryId, false);
        print("Explore: glinted \"" + a.transcript + "\" at " + d.toFixed(0) + " cm");
      } else if (!a.resolved && d < RESOLVE_ENTER) {
        a.resolved = true;
        this.gems.setResolved(a.memoryId, true);
        print("Explore: resolved \"" + a.transcript + "\" at " + d.toFixed(0) + " cm");
      }
    }

    this.updateWhisper(dt, camPos);
    this.updateTwinkles(camPos);
  }

  // ── Whisper (ONE at a time, nearest wins) ───────────────────────────────────

  private updateWhisper(dt: number, camPos: vec3): void {
    if (this.suppressed) return;   // card open — full playback owns the air

    let best: ExploreAnchor | null = null;
    let bestD = WHISPER_RANGE;
    for (const a of this.anchors) {
      const d = a.pos.sub(camPos).length;
      if (d < bestD) { bestD = d; best = a; }
    }

    if (best === null) {
      if (this.whisperTargetId !== null) this.stopWhisper();
      return;
    }

    if (this.whisperTargetId !== best.memoryId) {
      this.stopWhisper();
      this.whisperTargetId = best.memoryId;
      this.whisperGap = 0;     // first whisper plays as soon as the track exists
      this.whisperGuard = 0;
      print("Explore: whisper target \"" + best.transcript + "\" (d=" +
        bestD.toFixed(0) + " cm)");
    }

    const track = this.ttsFor(best.memoryId, best.transcript);
    if (track === null) return;   // pending or failed — the glint carries the scene

    const ac = this.ensureWhisperAudio(track);
    // Faint at range, fuller up close (the accepted v1 "whisper" reading).
    const t = 1 - Math.min(1, Math.max(0, (bestD - WHISPER_NEAR) / (WHISPER_RANGE - WHISPER_NEAR)));
    const vol = WHISPER_VOL * t;
    this.whisperObj!.getTransform().setWorldPosition(best.pos);
    ac.volume = vol;

    this.whisperLogIn -= dt;
    if (this.whisperLogIn <= 0) {
      this.whisperLogIn = WHISPER_LOG_S;
      print("Explore: whisper d=" + bestD.toFixed(0) + " cm vol=" + vol.toFixed(2) +
        (ac.isPlaying() ? " (playing)" : ""));
    }

    if (this.whisperGuard > 0) { this.whisperGuard -= dt; return; }
    if (ac.isPlaying()) return;
    this.whisperGap -= dt;
    if (this.whisperGap <= 0) {
      ac.audioTrack = track;
      ac.play(1);
      this.whisperGuard = WHISPER_GUARD_S;
      this.whisperGap = WHISPER_GAP_S;
      print("Explore: whisper plays \"" + best.transcript + "\" vol=" + vol.toFixed(2));
    }
  }

  private stopWhisper(): void {
    if (this.whisperAudio !== null && this.whisperAudio.isPlaying()) {
      this.whisperAudio.stop(true);   // fadeOutTime softens the exit
    }
    this.whisperTargetId = null;
  }

  private ensureWhisperAudio(track: AudioTrackAsset): AudioComponent {
    if (this.whisperObj === null || isNull(this.whisperObj)) {
      this.whisperObj = global.scene.createSceneObject("ExploreWhisper");
      this.whisperObj.setParent(this.parent);
      const ac = this.whisperObj.createComponent("Component.AudioComponent") as AudioComponent;
      this.whisperAudio = ac;
      // Codebase convention (gazeAudio, playOneShot): assign a track BEFORE
      // any other AudioComponent property — property writes on a track-less
      // component throw "[AudioComponent] Audio player is not enabled".
      ac.audioTrack = track;
      ac.playbackMode = Audio.PlaybackMode.LowPower;   // ambient family (specs-audio)
      ac.fadeInTime = 0.12;
      ac.fadeOutTime = 0.2;
      try {
        ac.spatialAudio.enabled = true;                // positional on device
      } catch (e) {
        print("Explore: spatial audio unavailable here (" + e + ") — volume ramp carries the whisper");
      }
    }
    return this.whisperAudio!;
  }

  /** Cached TTS track, or null while it generates / after a recent failure. */
  private ttsFor(memoryId: string, transcript: string): AudioTrackAsset | null {
    const cached = this.tts[memoryId];
    if (cached !== undefined) return cached;
    if (this.ttsPending[memoryId]) return null;
    const retryAt = this.ttsRetryAt[memoryId];
    if (retryAt !== undefined && this.elapsed < retryAt) return null;
    this.ttsPending[memoryId] = true;
    this.enhancer.generateSpeech(memoryId, transcript)
      .then((track) => {
        this.ttsPending[memoryId] = false;
        this.tts[memoryId] = track;
        print("Explore: whisper audio ready for \"" + transcript + "\"");
      })
      .catch((msg) => {
        this.ttsPending[memoryId] = false;
        this.ttsRetryAt[memoryId] = this.elapsed + TTS_RETRY_S;
        print("Explore: whisper audio unavailable (" + msg + ") — glint only");
      });
    return null;
  }

  // ── Twinkles (sparse, nearest-N of the glinted anchors) ─────────────────────

  private updateTwinkles(camPos: vec3): void {
    const eligible: { a: ExploreAnchor; d: number }[] = [];
    for (const a of this.anchors) {
      if (a.resolved) continue;   // only anonymous glints twinkle
      const d = a.pos.sub(camPos).length;
      if (d < TWINKLE_RANGE) eligible.push({ a: a, d: d });
    }
    eligible.sort((x, y) => x.d - y.d);

    for (let i = 0; i < eligible.length && i < TWINKLE_N; i++) {
      const e = eligible[i];
      if (this.elapsed < e.a.nextTwinkle) continue;
      if (this.elapsed - this.lastTwinkleAt < TWINKLE_COOLDOWN_S) {
        e.a.nextTwinkle = this.elapsed + 0.3 + Math.random() * 0.6;   // defer, stay sparse
        continue;
      }
      this.lastTwinkleAt = this.elapsed;
      e.a.nextTwinkle = this.elapsed + TWINKLE_MIN_S +
        Math.random() * (TWINKLE_MAX_S - TWINKLE_MIN_S);
      const t = Math.min(1, Math.max(0, (e.d - 150) / (TWINKLE_RANGE - 150)));
      const vol = TWINKLE_VOL_NEAR + (TWINKLE_VOL_FAR - TWINKLE_VOL_NEAR) * t;
      this.gems.playTrackAt(TWINKLE_SFX, e.a.pos, vol);
      this.gems.emitGlintSparkle(e.a.memoryId);
      print("Explore: twinkle \"" + e.a.transcript + "\" d=" + e.d.toFixed(0) +
        " vol=" + vol.toFixed(2));
    }
  }
}
