/**
 * AsrController — speech-to-text for the capture wizard (ASR Module, NOT the
 * deprecated VoiceML).
 *
 * - Streams partials via onTranscriptionUpdateEvent.
 * - Auto-stop: silenceUntilTerminationMs = 1200 makes the module emit
 *   isFinal after ~1.2 s of silence.
 * - Pinch-stop: stopNow() finalizes with the latest partial.
 * - Preview fallback (DESIGN.md risk item): mic/ASR may not work in the Lens
 *   Studio editor — if no real transcription arrives within FALLBACK_AFTER_S
 *   in the editor, a canned transcript ("buy milk for Thursday") streams word
 *   by word so the wizard stays fully drivable.
 *
 * Timing is driven by update(dt) from the main script's UpdateEvent.
 */

interface AsrHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

const FALLBACK_AFTER_S = 3.0;
const FALLBACK_WORD_INTERVAL_S = 0.35;
const FALLBACK_FINAL_DELAY_S = 0.8;
const CANNED_TRANSCRIPT = "buy milk for Thursday";

export class AsrController {
  private asrModule: AsrModule = require("LensStudio:AsrModule");
  private editorMode = global.deviceInfoSystem.isEditor();

  private listening = false;
  private done = false;
  private handlers: AsrHandlers | null = null;
  private lastText = "";
  private realSeen = false;

  private elapsed = 0;
  private fallbackActive = false;
  private fallbackWords: string[] = [];
  private fallbackIndex = 0;
  private wordTimer = 0;
  private finalTimer = 0;

  start(handlers: AsrHandlers): void {
    this.handlers = handlers;
    this.listening = true;
    this.done = false;
    this.lastText = "";
    this.realSeen = false;
    this.elapsed = 0;
    this.fallbackActive = false;
    this.fallbackIndex = 0;
    this.wordTimer = 0;
    this.finalTimer = 0;

    try {
      const options = AsrModule.AsrTranscriptionOptions.create();
      options.mode = AsrModule.AsrMode.HighAccuracy;
      options.silenceUntilTerminationMs = 1200;

      options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
        if (!this.listening || this.fallbackActive) return;
        this.realSeen = true;
        this.lastText = e.text;
        if (this.handlers) this.handlers.onPartial(e.text);
        if (e.isFinal && e.text.trim().length > 0) {
          this.finish(e.text);
        }
      });

      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        print("AsrController: transcription error " + code);
        // In the editor the canned fallback takes over; on device surface it.
        if (!this.editorMode && this.listening && !this.done && this.handlers) {
          this.handlers.onError("ASR error (" + code + ")");
        }
      });

      this.asrModule.startTranscribing(options);
    } catch (e) {
      print("AsrController: startTranscribing failed: " + e);
      if (!this.editorMode && this.handlers) {
        this.handlers.onError("Mic unavailable");
      }
      // Editor: fall through — the canned fallback will kick in via update().
    }
  }

  /** Pinch-to-stop: finalize with whatever we have (may be empty → cancel). */
  stopNow(): void {
    if (!this.listening || this.done) return;
    this.finish(this.lastText);
  }

  get isListening(): boolean { return this.listening && !this.done; }

  update(dt: number): void {
    if (!this.listening || this.done) return;
    this.elapsed += dt;

    // Editor-only canned fallback when no real transcription showed up.
    if (this.editorMode && !this.realSeen && !this.fallbackActive && this.elapsed > FALLBACK_AFTER_S) {
      this.fallbackActive = true;
      this.fallbackWords = CANNED_TRANSCRIPT.split(" ");
      this.wordTimer = FALLBACK_WORD_INTERVAL_S; // emit the first word immediately
      print("AsrController: editor fallback engaged (canned transcript)");
    }

    if (this.fallbackActive) {
      if (this.fallbackIndex < this.fallbackWords.length) {
        this.wordTimer += dt;
        if (this.wordTimer >= FALLBACK_WORD_INTERVAL_S) {
          this.wordTimer = 0;
          this.fallbackIndex++;
          this.lastText = this.fallbackWords.slice(0, this.fallbackIndex).join(" ");
          if (this.handlers) this.handlers.onPartial(this.lastText);
        }
      } else {
        this.finalTimer += dt;
        if (this.finalTimer >= FALLBACK_FINAL_DELAY_S) {
          this.finish(this.lastText);
        }
      }
    }
  }

  private finish(text: string): void {
    if (this.done) return;
    this.done = true;
    this.listening = false;
    try {
      this.asrModule.stopTranscribing();
    } catch (e) {
      // Already stopped or never started (editor fallback path) — fine.
    }
    if (this.handlers) this.handlers.onFinal(text.trim());
  }
}
