/**
 * MemoryPalaceUI — all user-facing UI for the MemoryPalace Lens (Wednesday).
 *
 * Panels (SpectaclesUIKit, composed per /specs-build-ui):
 *  - Start modal (UIKit Frame follow panel): Keystone logo, wordmark,
 *    Create / Edit / Explore / Train buttons, first-run hint, credit. Holds a
 *    second content view — the saved-palace picker (6 rows + Back) — swapped
 *    in-place per DESIGN.md "Edit → saved-palace picker on the modal".
 *    The picker is shared by all three palace-opening buttons and carries a
 *    PalacePickerIntent, so its title says what the pick will DO ("Edit which
 *    palace?" / "Explore which palace?") and one row tap routes accordingly.
 *  - Transcript card: mic + streaming ASR body (pose driven by main script).
 *  - Memory card: transcript + Delete (soft rose) + Close — blooms next to a
 *    selected gem during editing sessions; world-posed by the main script.
 *  - "New Memory" / "Done" labels: small billboarded tags riding the sigil
 *    cluster; wizard status line.
 *
 * Channel A event-bus: main pushes state via setters; subscribes to onCreate /
 * onEditRequested / onPalacePicked / onExplore / onTrain / onCardDelete /
 * onCardClose.
 *
 * Hidden-panel pattern (G3): UIKit elements only initialize on enabled
 * objects, so hidden panels park at FAR_POS while enabled, then move into
 * place + disable at t+0.25 s (applyInitialVisibility). The picker view uses
 * the same trick in the frame's LOCAL space (PICKER_PARK).
 *
 * STYLE.md: lavender text #ede9ff, muted #9a8be8, violet #7c6cf0 interactive,
 * teal #4dd6c1 accents, soft rose #ff7a9a destructive, sentence case copy.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign, FlexDirection, FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

// ── Assets (requireAsset — never @input) ─────────────────────────────────────
const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const LOGO_TEX = requireAsset("../Textures/logo_keystone.png") as Texture
const ICON_NEW = requireAsset("../Icons/add.png") as Texture
const ICON_LOAD = requireAsset("../Icons/folder_open.png") as Texture
const ICON_EXPLORE = requireAsset("../Icons/explore.png") as Texture
const ICON_TRAIN = requireAsset("../Icons/psychology.png") as Texture
const ICON_MIC = requireAsset("../Icons/mic.png") as Texture
const ICON_SPEAK = requireAsset("../Icons/volume_up.png") as Texture
const ICON_HELP_Q = requireAsset("../Icons/question_mark.png") as Texture
const ICON_CLOSE = requireAsset("../Icons/close.png") as Texture
const FONT_LIGHT = requireAsset("../Fonts/Montserrat-Light.ttf") as Font
const FONT_MEDIUM = requireAsset("../Fonts/Montserrat-Medium.ttf") as Font

// ── Brand palette (Branding/STYLE.md) ────────────────────────────────────────
const COL_TEXT = new vec4(237 / 255, 233 / 255, 255 / 255, 1)   // #ede9ff lavender
const COL_MUTED = new vec4(154 / 255, 139 / 255, 232 / 255, 1)  // #9a8be8 muted lavender
const COL_TEAL = new vec4(77 / 255, 214 / 255, 193 / 255, 1)    // #4dd6c1
const COL_LVIOLET = new vec4(168 / 255, 139 / 255, 255 / 255, 1) // #a88bff light violet
const COL_ROSE = new vec4(255 / 255, 122 / 255, 154 / 255, 1)   // #ff7a9a destructive

// ── Typography: the single source of truth for text size + weight ────────────
// em-square cm = size / 43.886, calibrated for z = -110 cm (see /specs-build-ui).
const FONT_SIZE_SCALE = 1.0  // Montserrat em ratio ≈ Objektiv's 0.695 → 1.0

type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1:      {size: 105, weight: 700},
  Title2:      {size: 93,  weight: 700},
  HeadlineXL:  {size: 62,  weight: 700},
  Headline1:   {size: 54,  weight: 700},
  Headline2:   {size: 48,  weight: 700},
  Subheadline: {size: 41,  weight: 700},
  Button:      {size: 39,  weight: 500},
  Callout:     {size: 39,  weight: 700},
  Body:        {size: 39,  weight: 500},
  Caption:     {size: 38,  weight: 500},
}

function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

// ── Status pill fit (Body @ 150 cm) — wrap + plate sizing for flash() text ──
// Avg Montserrat advance ≈ 0.53 em; em cm = size / 43.886 (see above).
const STATUS_WRAP_W = 24    // cm — wrap box width; long toasts break at 2 lines
const STATUS_LINE_H = 2.2   // cm — one Body @ 150 line slot
const STATUS_CHAR_W = (roleSize("Body", 150) / 43.886) * 0.53
const STATUS_MAX_CHARS = 68 // ellipsis cap ⇒ never more than 3 wrapped lines
const MODAL_LINE_MAX = 46   // modal toast line: Caption capacity of the 22 cm slot
const PICKER_NAME_MAX = 20  // palace name within "name — N memories" (17 cm row)

// ── Modal vertical follow assist ─────────────────────────────────────────────
// UIKit SmoothFollow ignores elevation inside its tilt band (±25°/35° pitch) —
// the panel strands high/low when the user settles their gaze elsewhere. This
// assist eases the frame's height toward the gaze line inside that band; its
// neutral branch adopts external Y (target.y = current pos.y), so nothing
// fights. Steeper pitches are still owned by UIKit tilt mode.
const VFOLLOW_ENTER_DEG = 7   // gaze↕panel offset that wakes the slide
const VFOLLOW_SETTLE_DEG = 2  // offset at which the slide rests (hysteresis)
const VFOLLOW_K = 2.0         // per-second ease rate (~63% in 0.5 s)
const VFOLLOW_TILT_UP = 25    // UIKit defaults — mirror, don't exceed
const VFOLLOW_TILT_DOWN = 35
const VFOLLOW_MAX_ELEV = 38   // stay inside SmoothFollow's ±40 clamp band

// ── Gaze-label speaker: TTS loading pulse ────────────────────────────────────
const SPEAK_ICON_S = 1.8    // cm — icon rest scale (also the imageIn size)
const SPEAK_PULSE_HZ = 2.0  // gentle breathe while the speech round-trip runs

// ── Layout constants ─────────────────────────────────────────────────────────
const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08
const FAR_POS = new vec3(0, -100000, 0)     // park hidden panels here until post-init
const PICKER_PARK = new vec3(0, -100000, 0) // same trick, frame-local space

const MODAL_W = 26

// Help view (INSTRUCTIONS) metrics + copy. Caption ≈ 0.46 cm/char (em math
// below); per-paragraph flex rows, sized by a conservative chars/line so
// estimation error opens gaps rather than overlapping lines.
const HELP_WRAP_W = 19.5    // cm — body wrap width
const HELP_LINE_H = 1.15    // cm — Caption line pitch
const HELP_CHARS_PER_LINE = 30  // left-aligned ragged wrap fills ~0.75, not 0.88
const HELP_PARAS = [
  "Memory Palace turns the room around you into a place to keep what you " +
  "want to remember — the ancient method of loci, rebuilt in AR.",
  "NEW — start a fresh palace. Tap the swirl on your hand, frame what you " +
  "want to remember, and speak. A gem drops where you point, holding your " +
  "words.",
  "EDIT — reopen a saved palace to add or remove memories.",
  "EXPLORE — walk your palace hands-free. Distant memories glint and " +
  "whisper as you come near. Gaze at a gem to reveal its words; tap the " +
  "speaker to hear them.",
  "TRAIN — the recall quiz. Follow the ping to each glow, say what lives " +
  "there, then reveal and grade yourself. As mastery grows the palace " +
  "shows you less, until the memories are simply yours.",
  "From a gem's card you can also conjure a 3D object or image of the " +
  "memory. Everything saves as you go.",
]
const CARD_W = 24
const PHOTO_CM = 11.5                 // the snapshot itself
const PHOTO_FRAME_CM = PHOTO_CM + 1.4 // recessed plate behind it (0.7 cm reveal)
const PHOTO_Z_LIFT = 0.4              // photo in front of its frame (z-fight guard)
const CLOSE_X_CM = 3.2                // corner dismiss button
const CLOSE_X_INSET = 2.2             // from the plate corner, in
const CLOSE_X_Z = 1.2                 // in front of the plate AND the content
const PICKER_ROWS = 6

/** Shape of one saved-palace row the main script hands to showPalacePicker. */
export interface PalaceListEntry {
  id: string
  name: string
  memoryCount: number
}

/** What the pick will do — the picker is shared by Edit, Explore and Train. */
export type PalacePickerIntent = "edit" | "explore" | "train"

/** One row tap: the palace chosen, plus the intent the picker was opened with. */
export interface PalacePick {
  id: string
  intent: PalacePickerIntent
}

// Picker copy per intent: the title states the verb, so a row tap is never a
// mystery ("which palace?" always answers "…to do what?").
const PICKER_TITLE: {[k: string]: string} = {
  edit: "Edit which palace?",
  explore: "Explore which palace?",
  train: "Train which palace?",
}

@component
export class MemoryPalaceUI extends BaseScriptComponent {
  // ── Public events (UI → main) ──────────────────────────────────────────────
  private _onCreate = new Event<void>()
  get onCreate(): PublicApi<void> { return this._onCreate.publicApi() }
  private _onEditRequested = new Event<void>()
  get onEditRequested(): PublicApi<void> { return this._onEditRequested.publicApi() }
  private _onPalacePicked = new Event<PalacePick>()
  get onPalacePicked(): PublicApi<PalacePick> { return this._onPalacePicked.publicApi() }
  private _onExplore = new Event<void>()
  get onExplore(): PublicApi<void> { return this._onExplore.publicApi() }
  private _onTrain = new Event<void>()
  get onTrain(): PublicApi<void> { return this._onTrain.publicApi() }
  private _onCardDelete = new Event<void>()
  get onCardDelete(): PublicApi<void> { return this._onCardDelete.publicApi() }
  private _onCardClose = new Event<void>()
  get onCardClose(): PublicApi<void> { return this._onCardClose.publicApi() }
  private _onCardEnhanceMesh = new Event<void>()
  get onCardEnhanceMesh(): PublicApi<void> { return this._onCardEnhanceMesh.publicApi() }
  private _onCardEnhanceImage = new Event<void>()
  get onCardEnhanceImage(): PublicApi<void> { return this._onCardEnhanceImage.publicApi() }
  private _onCardEnhanceRemove = new Event<void>()
  get onCardEnhanceRemove(): PublicApi<void> { return this._onCardEnhanceRemove.publicApi() }
  /** One-tap conjure: the router already chose the kind and wrote the prompt. */
  private _onCardConjure = new Event<void>()
  get onCardConjure(): PublicApi<void> { return this._onCardConjure.publicApi() }
  /** Journey reorder: −1 = earlier on the route, +1 = later. */
  private _onRouteMove = new Event<number>()
  get onRouteMove(): PublicApi<number> { return this._onRouteMove.publicApi() }
  private _onGazeSpeak = new Event<void>()
  get onGazeSpeak(): PublicApi<void> { return this._onGazeSpeak.publicApi() }
  private _onTrainReveal = new Event<void>()
  get onTrainReveal(): PublicApi<void> { return this._onTrainReveal.publicApi() }
  private _onTrainGrade = new Event<number>()
  get onTrainGrade(): PublicApi<number> { return this._onTrainGrade.publicApi() }

  // ── Panel roots + state ────────────────────────────────────────────────────
  private modalRoot!: SceneObject
  private cardRoot!: SceneObject
  private labelRoot!: SceneObject
  private doneLabelRoot!: SceneObject
  private statusRoot!: SceneObject
  private memCardRoot!: SceneObject
  private gazeLabelRoot!: SceneObject
  private gazeLabelText: Text | null = null
  private memCardActionRow: SceneObject | null = null
  private memCardEnhanceRow: SceneObject | null = null
  private memCardConjureRow: SceneObject | null = null
  private memCardRouteRow: SceneObject | null = null
  private memCardRouteText: Text | null = null
  private memCardConjureLabel: Text | null = null
  private memCardFlex: FlexLayout | null = null
  private memCardCloseX: SceneObject | null = null
  private memCardMode: "main" | "enhance" | "readonly" | "prompt" | "grade" = "main"
  private memCardRemoveRow: SceneObject | null = null
  private memCardPromptRow: SceneObject | null = null
  private memCardGradeRow: SceneObject | null = null
  private memCardPhotoRow: SceneObject | null = null
  private memCardPhotoMat: Material | null = null
  private cardHasEnhance = false
  private realPos: {[name: string]: vec3} = {}

  private wantModal = true
  private wantCard = false
  private wantLabel = false
  private wantGazeLabel = false
  private wantDoneLabel = false
  private wantStatus = false
  private wantMemCard = false
  private initDone = false

  // Modal view swap (main buttons ⇄ palace picker)
  private modalFrame: Frame | null = null
  private mainView: SceneObject | null = null
  private pickerView: SceneObject | null = null
  private activeView: "main" | "picker" | "help" = "main"
  private helpView: SceneObject | null = null
  private helpSize: vec2 | null = null
  private helpReady = false
  private mainSize: vec2 | null = null
  private pickerSize: vec2 | null = null
  private pickerReady = false
  private pendingPickerList: PalaceListEntry[] | null = null
  private pendingPickerIntent: PalacePickerIntent = "edit"
  private pickerIntent: PalacePickerIntent = "edit"
  private pickerRows: {item: SceneObject; label: Text}[] = []
  private pickerRowIds: (string | null)[] = []
  private pickerTitleText: Text | null = null
  private pickerEmptyText: Text | null = null

  // Dynamic text handles
  private comingSoonText: Text | null = null
  private listeningText: Text | null = null
  private transcriptText: Text | null = null
  private hintText: Text | null = null
  private pendingHint: string | null = null
  private cardHintText: Text | null = null
  private statusText: Text | null = null
  private statusPlate: BackPlate | null = null
  private modalDragging = false
  private vAssistActive = false
  private speakerFace: SceneObject | null = null
  private speakerImg: Image | null = null
  private speakerLoading = false
  private speakerPulseT = 0
  private memCardText: Text | null = null
  private comingSoonClear!: DelayedCallbackEvent

  onAwake() {
    this.buildStartModal()
    this.buildTranscriptCard()
    this.buildMemoryCard()
    this.buildSigilLabel()
    this.buildDoneLabel()
    this.buildStatusLine()
    this.buildGazeLabel()

    this.comingSoonClear = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.comingSoonClear.bind(() => { if (this.comingSoonText) this.comingSoonText.text = "" })

    this.createEvent("UpdateEvent").bind(() => {
      this.updateModalVerticalAssist()
      this.updateSpeakerPulse()
    })

    // BackPlate (and every UIKit Element) initializes on OnStartEvent — a
    // SceneObject disabled before start never initializes (G3). So hidden
    // panels are parked at FAR_POS while enabled, then moved into place and
    // disabled shortly after start.
    this.createEvent("OnStartEvent").bind(() => {
      const d = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
      d.bind(() => this.applyInitialVisibility())
      d.reset(0.25)
    })
  }

  // ── Public API (main → UI) ─────────────────────────────────────────────────

  showModal(): void {
    this.setActiveView("main")   // reopening always lands on the main view
    this.wantModal = true
    this.applyVisibility()
  }
  hideModal(): void { this.wantModal = false; this.applyVisibility() }

  showComingSoon(mode: string): void {
    if (this.comingSoonText) {
      this.comingSoonText.text = mode + " — Coming soon"
      this.comingSoonClear.reset(2.2)
    }
  }

  /** Transient confirmation line on the modal (same slot as coming-soon). */
  showToast(msg: string): void {
    if (this.comingSoonText) {
      // Single-line slot by design (layout-stable) — ellipsize, don't wrap.
      this.comingSoonText.text =
        msg.length > MODAL_LINE_MAX ? msg.slice(0, MODAL_LINE_MAX - 1) + "…" : msg
      this.comingSoonClear.reset(2.8)
    }
  }

  /** Replace the first-run hint copy (editor vs device affordances differ). */
  setHintText(t: string): void {
    this.pendingHint = t   // buffered — the modal builds lazily inside Frame init
    if (this.hintText) this.hintText.text = t
  }

  /**
   * Swap the modal to the saved-palace picker view, populated with entries.
   * `intent` decides the title copy and where a row tap routes — the caller
   * gets it back on onPalacePicked, so the picker itself stays stateless-ish.
   */
  showPalacePicker(entries: PalaceListEntry[],
      intent: PalacePickerIntent = "edit"): void {
    this.pickerIntent = intent
    if (!this.pickerReady) {
      this.pendingPickerList = entries   // picker still in its park window
      this.pendingPickerIntent = intent
      return
    }
    if (this.pickerTitleText) this.pickerTitleText.text = PICKER_TITLE[intent]
    for (let i = 0; i < this.pickerRows.length; i++) {
      const e = entries[i]
      if (e !== undefined) {
        this.pickerRowIds[i] = e.id
        const nm = e.name.length > PICKER_NAME_MAX
          ? e.name.slice(0, PICKER_NAME_MAX - 1) + "…" : e.name
        this.pickerRows[i].label.text =
          nm + " — " + e.memoryCount + (e.memoryCount === 1 ? " memory" : " memories")
        this.pickerRows[i].item.enabled = true
      } else {
        this.pickerRowIds[i] = null
        this.pickerRows[i].item.enabled = false
      }
    }
    if (this.pickerEmptyText) {
      this.pickerEmptyText.text = entries.length === 0 ? "No palaces yet — press New" : ""
    }
    this.setActiveView("picker")
  }

  // Status line: small billboarded caption the wizard parks under the reticle.
  showStatus(): void { this.wantStatus = true; this.applyVisibility() }
  hideStatus(): void { this.wantStatus = false; this.applyVisibility() }
  setStatusText(t: string): void {
    if (!this.statusText) return
    const s = t.length > STATUS_MAX_CHARS ? t.slice(0, STATUS_MAX_CHARS - 1) + "…" : t
    this.statusText.text = s
    // Fit the pill to the message: snug single line, or wrapped lines at
    // STATUS_WRAP_W (0.85 = word-boundary fill slack). Over-estimating height
    // is the safe failure — centered text in a slightly tall pill, never spill.
    const est = s.length * STATUS_CHAR_W
    let lines = 1
    let textW = Math.max(12, est + 0.8)
    if (est > STATUS_WRAP_W) {
      lines = Math.min(3, Math.ceil(est / (STATUS_WRAP_W * 0.85)))
      textW = STATUS_WRAP_W
    }
    if (this.statusPlate) {
      // 1.8 / 1.1 = 2 × the column's padX 0.9 / padY 0.55.
      this.statusPlate.size = new vec2(textW + 1.8, lines * STATUS_LINE_H + 1.1)
    }
  }
  setStatusPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantStatus) return
    this.statusRoot.getTransform().setWorldPosition(worldPos)
  }

  // Gaze label: the memory's words, revealed by dwelling on its gem.
  showGazeLabel(): void { this.wantGazeLabel = true; this.applyVisibility() }
  hideGazeLabel(): void { this.wantGazeLabel = false; this.applyVisibility() }
  setGazeLabelText(t: string): void {
    if (this.gazeLabelText) {
      const MAX = 64
      this.gazeLabelText.text = t.length > MAX ? t.slice(0, MAX) + "…" : t
    }
  }
  setGazeLabelPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantGazeLabel) return
    this.gazeLabelRoot.getTransform().setWorldPosition(worldPos)
  }

  /** Drive the transcript card's full pose (soft head-follow caption). */
  setTranscriptCardPose(worldPos: vec3, worldRot: quat): void {
    if (!this.initDone) return
    const t = this.cardRoot.getTransform()
    t.setWorldPosition(worldPos)
    t.setWorldRotation(worldRot)
  }

  /** Replace the card's bottom hint copy (pinch on device, click in editor). */
  setCardHint(t: string): void {
    if (this.cardHintText) this.cardHintText.text = t
  }

  showTranscript(): void {
    this.wantCard = true
    if (this.transcriptText) this.transcriptText.text = ""
    if (this.listeningText) this.listeningText.text = "Listening…"
    this.applyVisibility()
  }
  hideTranscript(): void { this.wantCard = false; this.applyVisibility() }

  setTranscript(text: string): void {
    if (!this.transcriptText) return
    // Keep the visible tail — the card fits ~3 wrapped lines.
    const MAX = 120
    this.transcriptText.text = text.length > MAX ? "…" + text.slice(text.length - MAX) : text
  }

  setListeningState(state: string): void {
    if (this.listeningText) this.listeningText.text = state
  }

  /** Memory card next to a selected gem: transcript + Delete + Close.
   *  readOnly (Explore): view-only — no Delete/Enhance, just Close. */
  showMemoryCard(transcript: string, worldPos: vec3, worldRot: quat,
      hasEnhance: boolean = false, readOnly: boolean = false,
      startMode: "main" | "enhance" = "main"): void {
    this.cardHasEnhance = hasEnhance
    // Reopening resets the row — except when the caller opens straight into
    // the conjure chip (post-capture "Conjure imagery?").
    this.setMemCardMode(readOnly ? "readonly" : startMode)
    if (this.memCardText) {
      const MAX = 140
      this.memCardText.text = transcript.length > MAX ? transcript.slice(0, MAX) + "…" : transcript
    }
    this.wantMemCard = true
    if (this.initDone) {
      const t = this.memCardRoot.getTransform()
      t.setWorldPosition(worldPos)
      t.setWorldRotation(worldRot)
    }
    this.applyVisibility()
  }
  hideMemoryCard(): void { this.wantMemCard = false; this.applyVisibility() }

  /** Journey readout on the memory card: "Locus 2 of 7". */
  setRoutePosition(index: number, total: number): void {
    if (this.memCardRouteText === null) return
    this.memCardRouteText.text = index > 0
      ? "Locus " + index + " of " + total : "Off route"
  }

  /** Photo above the transcript on the memory card; null hides the row. */
  setCardPhoto(tex: Texture | null): void {
    if (this.memCardPhotoRow === null) return
    if (tex === null) {
      if (this.initDone) this.memCardPhotoRow.enabled = false
      return
    }
    if (this.memCardPhotoMat !== null) this.memCardPhotoMat.mainPass.baseTex = tex
    if (this.initDone) this.memCardPhotoRow.enabled = true
  }

  /** Train: "What lives here?" + Reveal, posed like the memory card. */
  showTrainPrompt(worldPos: vec3, worldRot: quat): void {
    this.setMemCardMode("prompt")
    this.setCardPhoto(null)   // the quiz card never leaks the photo
    if (this.memCardText) this.memCardText.text = "What lives here?"
    this.wantMemCard = true
    if (this.initDone) {
      const t = this.memCardRoot.getTransform()
      t.setWorldPosition(worldPos)
      t.setWorldRotation(worldRot)
    }
    this.applyVisibility()
  }

  /** Train: the revealed memory + self-grade row (Remembered / Almost / Forgot). */
  showTrainGrade(transcript: string, worldPos: vec3, worldRot: quat): void {
    this.setMemCardMode("grade")
    this.setCardPhoto(null)   // grade card stays words-only (photo lives on the hint)
    if (this.memCardText) {
      const MAX = 140
      this.memCardText.text = transcript.length > MAX ? transcript.slice(0, MAX) + "…" : transcript
    }
    this.wantMemCard = true
    if (this.initDone) {
      const t = this.memCardRoot.getTransform()
      t.setWorldPosition(worldPos)
      t.setWorldRotation(worldRot)
    }
    this.applyVisibility()
  }

  showSigilLabel(): void { this.wantLabel = true; this.applyVisibility() }
  hideSigilLabel(): void { this.wantLabel = false; this.applyVisibility() }

  setSigilLabelPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantLabel) return
    this.labelRoot.getTransform().setWorldPosition(worldPos)
  }

  showDoneLabel(): void { this.wantDoneLabel = true; this.applyVisibility() }
  hideDoneLabel(): void { this.wantDoneLabel = false; this.applyVisibility() }

  setDoneLabelPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantDoneLabel) return
    this.doneLabelRoot.getTransform().setWorldPosition(worldPos)
  }

  // ── Visibility plumbing ────────────────────────────────────────────────────

  private applyInitialVisibility(): void {
    this.initDone = true
    this.cardRoot.getTransform().setLocalPosition(this.realPos["card"])
    this.memCardRoot.getTransform().setLocalPosition(this.realPos["memcard"])
    this.labelRoot.getTransform().setLocalPosition(this.realPos["label"])
    this.doneLabelRoot.getTransform().setLocalPosition(this.realPos["donelabel"])
    this.statusRoot.getTransform().setLocalPosition(this.realPos["status"])
    this.gazeLabelRoot.getTransform().setLocalPosition(this.realPos["gazelabel"])
    if (this.memCardEnhanceRow !== null) this.memCardEnhanceRow.enabled = false
    if (this.memCardConjureRow !== null) this.memCardConjureRow.enabled = false
    if (this.memCardRouteRow !== null) this.memCardRouteRow.enabled = false
    if (this.memCardRemoveRow !== null) this.memCardRemoveRow.enabled = false
    if (this.memCardCloseX !== null) this.memCardCloseX.enabled = false
    if (this.memCardPromptRow !== null) this.memCardPromptRow.enabled = false
    if (this.memCardGradeRow !== null) this.memCardGradeRow.enabled = false
    if (this.memCardPhotoRow !== null) this.memCardPhotoRow.enabled = false
    this.applyVisibility()
  }

  private applyVisibility(): void {
    if (!this.initDone) return  // flags are honored by applyInitialVisibility
    this.modalRoot.enabled = this.wantModal
    this.cardRoot.enabled = this.wantCard
    this.memCardRoot.enabled = this.wantMemCard
    this.labelRoot.enabled = this.wantLabel
    this.doneLabelRoot.enabled = this.wantDoneLabel
    this.statusRoot.enabled = this.wantStatus
    this.gazeLabelRoot.enabled = this.wantGazeLabel
  }

  /** Swap between the modal's main buttons, the palace picker, and help. */
  private setActiveView(v: "main" | "picker" | "help"): void {
    this.activeView = v
    this.setHintText("")   // hover-exit doesn't fire across a view swap
    if (this.mainView !== null) this.mainView.enabled = (v === "main")
    if (this.pickerView !== null && this.pickerReady) this.pickerView.enabled = (v === "picker")
    if (this.helpView !== null && this.helpReady) this.helpView.enabled = (v === "help")
    if (this.modalFrame !== null) {
      const size = v === "main" ? this.mainSize : v === "picker" ? this.pickerSize : this.helpSize
      if (size !== null) this.modalFrame.innerSize = size
    }
  }

  // ── Panel builders ─────────────────────────────────────────────────────────

  private buildStartModal(): void {
    this.modalRoot = this.obj(this.sceneObject, "StartModal", new vec3(0, 2, 0))
    this.realPos["modal"] = new vec3(0, 2, 0)
    this.modalRoot.createComponent("Component.Canvas")
    // Follow panel (UIKit Frame): billboards + lazily follows the user like a
    // standard Specs system panel. Content builds under contentTransform inside
    // onInitialized (ReplayEvent) — contentTransform is unsafe pre-init.
    const frame = this.modalRoot.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.autoScaleContent = false
    frame.allowScaling = false

    frame.onInitialized.add(() => {
      frame.showCloseButton = false   // closing the main menu would strand the user
      frame.showFollowButton = false  // always-follow, no toggle
      frame.setUseFollow(true)
      frame.setFollowing(true)
      frame.useTiltMode = true   // gaze-tracking past pitch thresholds — follows look up/down too
      // Vertical assist yields to the hand while the user drags the frame.
      frame.onTranslationStart.add(() => { this.modalDragging = true })
      frame.onTranslationEnd.add(() => { this.modalDragging = false })
      this.modalFrame = frame

      const host = frame.contentTransform.getSceneObject()

      // Main view: logo + wordmark + buttons + hint + credit.
      this.mainView = this.obj(host, "MainView", new vec3(0, 0, 0.6))
      const col = this.flexColumn(this.mainView, MODAL_W, -1, {
        gap: 0.9, padX: 1.6, padY: 1.6,
        justify: FlexJustify.Start, align: FlexAlign.Center,
      })
      const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
      flex.onLayoutComplete.add((r) => {
        this.mainSize = new vec2(r.containerWidth, r.containerHeight)
        if (this.activeView === "main") frame.innerSize = this.mainSize
      })
      this.buildModalContent(col)
      // Hint copy may have been pushed before the frame initialized — apply now.
      if (this.pendingHint !== null && this.hintText) this.hintText.text = this.pendingHint

      // Picker view: parked far in frame-local space while its UIKit children
      // initialize (G3), then moved into place + disabled below.
      this.pickerView = this.obj(host, "PickerView", PICKER_PARK)
      const pcol = this.flexColumn(this.pickerView, MODAL_W, -1, {
        gap: 0.8, padX: 1.6, padY: 1.6,
        justify: FlexJustify.Start, align: FlexAlign.Center,
      })
      const pflex = pcol.getComponent(FlexLayout.getTypeName()) as FlexLayout
      pflex.onLayoutComplete.add((r) => {
        this.pickerSize = new vec2(r.containerWidth, r.containerHeight)
        if (this.activeView === "picker" && this.modalFrame !== null) {
          this.modalFrame.innerSize = this.pickerSize
        }
      })
      this.buildPickerContent(pcol)

      // Help view: INSTRUCTIONS — same park-while-initializing trick (G3).
      this.helpView = this.obj(host, "HelpView", PICKER_PARK.add(new vec3(0, -200, 0)))
      const hcol = this.flexColumn(this.helpView, MODAL_W, -1, {
        gap: 0.8, padX: 1.6, padY: 1.6,
        justify: FlexJustify.Start, align: FlexAlign.Center,
      })
      const hflex = hcol.getComponent(FlexLayout.getTypeName()) as FlexLayout
      hflex.onLayoutComplete.add((r) => {
        this.helpSize = new vec2(r.containerWidth, r.containerHeight)
        if (this.activeView === "help" && this.modalFrame !== null) {
          this.modalFrame.innerSize = this.helpSize
        }
      })
      this.buildHelpContent(hcol)

      const park = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
      park.bind(() => {
        if (this.helpView !== null) {
          this.helpView.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
          this.helpView.enabled = false
          this.helpReady = true
        }
        if (this.pickerView === null) return
        this.pickerView.getTransform().setLocalPosition(new vec3(0, 0, 0.6))
        this.pickerView.enabled = false
        this.pickerReady = true
        if (this.pendingPickerList !== null) {
          const list = this.pendingPickerList
          this.pendingPickerList = null
          this.showPalacePicker(list, this.pendingPickerIntent)
        }
      })
      park.reset(0.25)
    })
  }

  private buildModalContent(col: SceneObject): void {

    // Keystone lockup — graphic-only texture (SVG <text> did not survive
    // conversion; wordmark rendered as UIKit text below, per DESIGN.md).
    this.flexChild(col, {w: 8, h: 10}, (c) => {
      this.imageIn(c, LOGO_TEX, 8, 10, new vec4(1, 1, 1, 1))
    })

    // Wordmark: tracked-out Light display type.
    this.flexChild(col, {w: 22, h: 2.4}, (c) => {
      this.textIn(c, "M E M O R Y   P A L A C E", "Headline2", {
        font: FONT_LIGHT, nativeWeight: 300, color: COL_TEXT,
      })
    })

    // "— AR —" rule-line motif, teal accent.
    this.flexChild(col, {w: 22, h: 1.4}, (c) => {
      this.textIn(c, "—   A R   —", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEAL,
      })
    })

    this.addModalButton(col, "New", ICON_NEW,
      "Press New to start a palace", () => this._onCreate.invoke())
    this.addModalButton(col, "Edit", ICON_LOAD,
      "Change an existing palace", () => this._onEditRequested.invoke())
    this.addModalButton(col, "Explore", ICON_EXPLORE,
      "Walk your palace and relive its memories", () => this._onExplore.invoke())
    this.addModalButton(col, "Train", ICON_TRAIN,
      "Quiz your recall, locus by locus", () => this._onTrain.invoke())

    // Tooltip line: empty until a button above is hovered (copy set per button).
    this.flexChild(col, {w: 22, h: 1.5}, (c) => {
      this.hintText = this.textIn(c, "", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
      })
    })

    // Transient coming-soon / toast line (empty keeps layout stable).
    this.flexChild(col, {w: 22, h: 1.3}, (c) => {
      this.comingSoonText = this.textIn(c, "", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEAL,
      })
    })

    // Bottom row: circular help chip (lower left) · studio credit (right).
    this.flexChild(col, {w: 22, h: 2.6}, (c) => {
      const row = this.flexRow(c, 22, 2.6, {justify: FlexJustify.SpaceBetween, align: FlexAlign.Center})
      this.flexChild(row, {w: 2.4, h: 2.4}, (cc) => {
        const btn = cc.createComponent(Button.getTypeName()) as Button
        btn.size = new vec3(2.4, 2.4, 1)   // BEFORE init
        btn.onHoverEnter.add(() => this.setHintText("How Memory Palace works"))
        btn.onHoverExit.add(() => this.setHintText(""))
        const face = this.obj(cc, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
        this.imageIn(face, ICON_HELP_Q, 1.2, 1.2, COL_TEAL)
        btn.onTriggerUp.add(() => this.setActiveView("help"))
      })
      this.flexChild(row, {w: 6, h: 1.1}, (cc) => {
        this.textIn(cc, "FLARB LLC", "Caption", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
        })
      })
    })
  }

  /** Help view: X (back to main), INSTRUCTIONS title, scrollable body text. */
  private buildHelpContent(col: SceneObject): void {
    // Title bar: X upper-left, centered title, spacer mirroring the X.
    this.flexChild(col, {w: 22, h: 2.6}, (c) => {
      const row = this.flexRow(c, 22, 2.6, {justify: FlexJustify.SpaceBetween, align: FlexAlign.Center})
      this.flexChild(row, {w: 2.4, h: 2.4}, (cc) => {
        const btn = cc.createComponent(Button.getTypeName()) as Button
        btn.size = new vec3(2.4, 2.4, 1)   // BEFORE init
        const face = this.obj(cc, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
        this.imageIn(face, ICON_CLOSE, 1.2, 1.2, COL_TEXT)
        btn.onTriggerUp.add(() => this.setActiveView("main"))
      })
      this.flexChild(row, {w: 12, h: 2.2}, (cc) => {
        this.textIn(cc, "I N S T R U C T I O N S", "Subheadline", {
          font: FONT_LIGHT, nativeWeight: 300, color: COL_TEXT,
        })
      })
      this.flexChild(row, {w: 2.4, h: 2.4}, () => {})   // spacer keeps the title centered
    })

    // Body — full text visible, one flex row per paragraph. (A ScrollWindow
    // pass is parked for now: its pinch-drag input loses to the Frame's
    // whole-panel InteractionPlane; revisit if the copy outgrows the panel.)
    for (const para of HELP_PARAS) {
      const lines = Math.ceil(para.length / HELP_CHARS_PER_LINE)
      const h = lines * HELP_LINE_H + 0.3
      this.flexChild(col, {w: 22, h: h}, (c) => {
        const t = this.textIn(c, para, "Caption", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
          wrap: {w: HELP_WRAP_W, h: h},
        })
        t.horizontalAlignment = HorizontalAlignment.Left   // document, not a caption
      })
    }
  }

  /** Picker view: title + up to 6 saved-palace rows + empty state + Back. */
  private buildPickerContent(col: SceneObject): void {
    // Title is rewritten per intent in showPalacePicker; "edit" is the default
    // so the built copy already matches the first-built state.
    this.flexChild(col, {w: 22, h: 2.2}, (c) => {
      this.pickerTitleText = this.textIn(c, PICKER_TITLE["edit"], "Body", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
      })
    })

    // Empty state — text cleared when rows exist (stable layout, toast pattern).
    this.flexChild(col, {w: 22, h: 1.4}, (c) => {
      this.pickerEmptyText = this.textIn(c, "No palaces yet — press New", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
      })
    })

    this.pickerRows = []
    this.pickerRowIds = []
    for (let i = 0; i < PICKER_ROWS; i++) {
      const idx = i
      this.pickerRowIds.push(null)
      let labelRef: Text | null = null
      const item = this.flexChild(col, {w: 20, h: 2.8}, (host) => {
        const btn = host.createComponent(Button.getTypeName()) as Button
        btn.size = new vec3(20, 2.8, 1)   // BEFORE init

        const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
        const row = this.flexRow(face, 20, 2.8, {
          justify: FlexJustify.Center, align: FlexAlign.Center,
        })
        this.flexChild(row, {w: 17, h: 2.2}, (c) => {
          labelRef = this.textIn(c, "", "Caption", {
            font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
          })
        })

        btn.onTriggerUp.add(() => {
          const id = this.pickerRowIds[idx]
          if (id !== null) {
            this._onPalacePicked.invoke({id: id, intent: this.pickerIntent})
          }
        })
      })
      this.pickerRows.push({item: item, label: labelRef!})
    }

    this.addPlainButton(col, "Back", 10, () => this.setActiveView("main"))
  }

  private addModalButton(col: SceneObject, label: string, icon: Texture | null,
      tooltip: string, onClick: () => void): void {
    this.flexChild(col, {w: 14, h: 3.2}, (host) => {
      const btn = host.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(14, 3.2, 1)   // BEFORE init
      // Tooltip: the hint line shows this button's purpose while hovered.
      btn.onHoverEnter.add(() => this.setHintText(tooltip))
      btn.onHoverExit.add(() => this.setHintText(""))

      const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
      const row = this.flexRow(face, 14, 3.2, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.7,
      })
      if (icon !== null) {
        this.flexChild(row, {w: 1.9, h: 1.9}, (c) => {
          this.imageIn(c, icon, 1.9, 1.9, COL_LVIOLET)
        })
      }
      this.flexChild(row, {w: icon !== null ? 6 : 8, h: 2.4}, (c) => {
        this.textIn(c, label, "Button", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
        })
      })

      btn.onTriggerUp.add(onClick)
    })
  }

  /** Bare labeled button (picker Back, card Delete/Close). */
  private addPlainButton(col: SceneObject, label: string, width: number,
      onClick: () => void, labelColor: vec4 = COL_TEXT): void {
    this.flexChild(col, {w: width, h: 2.8}, (host) => {
      const btn = host.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(width, 2.8, 1)   // BEFORE init

      const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
      const row = this.flexRow(face, width, 2.8, {
        justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.flexChild(row, {w: width - 2, h: 2.2}, (c) => {
        this.textIn(c, label, "Button", {
          font: FONT_MEDIUM, nativeWeight: 500, color: labelColor,
        })
      })

      btn.onTriggerUp.add(onClick)
    })
  }

  private buildTranscriptCard(): void {
    this.cardRoot = this.obj(this.sceneObject, "TranscriptCard", FAR_POS)
    this.realPos["card"] = new vec3(0, -16, 5)   // world z = -105 (UI root at -110)
    this.cardRoot.createComponent("Component.Canvas")
    // No Billboard: the main script drives full pose (soft head-follow,
    // lower-third caption placement) via setTranscriptCardPose.
    const plate = this.cardRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"

    const content = this.obj(this.cardRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, CARD_W, -1, {
      gap: 0.7, padX: 1.4, padY: 1.2,
      justify: FlexJustify.Start, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // Header row: mic icon + state text.
    this.flexChild(col, {w: 21, h: 2.2}, (hdr) => {
      const row = this.flexRow(hdr, 21, 2.2, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.6,
      })
      this.flexChild(row, {w: 1.8, h: 1.8}, (c) => {
        this.imageIn(c, ICON_MIC, 1.8, 1.8, COL_MUTED)
      })
      this.flexChild(row, {w: 8, h: 2.2}, (c) => {
        this.listeningText = this.textIn(c, "Listening…", "Body", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
        })
      })
    })

    // Streaming transcript body — wraps up to ~3 lines, grows around center.
    this.flexChild(col, {w: 21, h: 5.4}, (c) => {
      this.transcriptText = this.textIn(c, "", "Body", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
        wrap: {w: 21, h: 5.4},
      })
    })

    this.flexChild(col, {w: 21, h: 1.3}, (c) => {
      this.cardHintText = this.textIn(c, "Pinch to finish", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
      })
    })
  }

  /** Memory card: a selected gem's transcript + Delete / Close (session edit). */
  private buildMemoryCard(): void {
    this.memCardRoot = this.obj(this.sceneObject, "MemoryCard", FAR_POS)
    this.realPos["memcard"] = new vec3(0, 0, 0)   // pose driven per show call
    this.memCardRoot.createComponent("Component.Canvas")
    // No Billboard: showMemoryCard poses it facing the user (quat.lookAt +Z).
    const plate = this.memCardRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"

    const content = this.obj(this.memCardRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, CARD_W, -1, {
      gap: 1, padX: 1.4, padY: 1.6,
      justify: FlexJustify.Start, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    // Kept so setMemCardMode can re-discover children after toggling rows —
    // a DISABLED flex child still reserves its slot until the layout rescans,
    // which is what left a dead band where the hidden rows used to sit.
    this.memCardFlex = flex
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
      // The X rides the plate's upper-left corner, so it has to be re-placed
      // every time the card resizes (which is every mode change).
      if (this.memCardCloseX !== null) {
        this.memCardCloseX.getTransform().setLocalPosition(new vec3(
          -r.containerWidth / 2 + CLOSE_X_INSET,
          r.containerHeight / 2 - CLOSE_X_INSET,
          CLOSE_X_Z))
      }
    })

    // Corner dismiss. Outside the flex column on purpose — it's chrome, not a
    // row, and it must not push the content around or claim layout height.
    this.memCardCloseX = this.obj(this.memCardRoot, "CardClose", FAR_POS)
    const xBtn = this.memCardCloseX.createComponent(Button.getTypeName()) as Button
    xBtn.size = new vec3(CLOSE_X_CM, CLOSE_X_CM, 1)   // BEFORE init
    xBtn.onTriggerUp.add(() => this._onCardClose.invoke())
    const xFace = this.obj(this.memCardCloseX, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
    this.textIn(xFace, "✕", "Button", {
      font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
    })

    // Snapshot row: the memory's photo in a recessed frame, above the words
    // (hidden when the memory has none). The frame sits on the row host at
    // unit scale; the image is a nested child scaled to its own size, so the
    // plate isn't multiplied by the photo's scale.
    this.memCardPhotoRow = this.flexChild(col, {w: PHOTO_FRAME_CM, h: PHOTO_FRAME_CM}, (c) => {
      const frame = c.createComponent(BackPlate.getTypeName()) as BackPlate
      frame.style = "dark"
      frame.size = new vec2(PHOTO_FRAME_CM, PHOTO_FRAME_CM)   // BEFORE init
      const photo = this.obj(c, "Photo", new vec3(0, 0, PHOTO_Z_LIFT))
      const img = photo.createComponent("Component.Image") as Image
      const mat = imageMaterial.clone()
      mat.mainPass.baseTex = LOGO_TEX   // placeholder until setCardPhoto
      mat.mainPass.depthTest = true
      mat.mainPass.depthWrite = false
      mat.mainPass.baseColor = new vec4(1, 1, 1, 1)
      img.clearMaterials()
      img.addMaterial(mat)
      photo.getTransform().setLocalScale(new vec3(PHOTO_CM, PHOTO_CM, 1))
      this.memCardPhotoMat = mat
    })

    // The memory itself.
    this.flexChild(col, {w: 21, h: 5.4}, (c) => {
      this.memCardText = this.textIn(c, "", "Body", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
        wrap: {w: 21, h: 5.4},
      })
    })

    // Action row: Enhance (toggles the conjure block) / Delete (soft rose).
    // Dismissal lives on the corner X, not in this row — and Delete stays on
    // screen while the conjure block is open, so it's always one tap away.
    this.memCardActionRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.8,
      })
      this.rowButton(row, "Enhance", 7.4, COL_TEAL,
        () => this.setMemCardMode(this.memCardMode === "enhance" ? "main" : "enhance"))
      this.rowButton(row, "Delete", 7, COL_ROSE, () => this._onCardDelete.invoke())
    })

    // Journey row (edit sessions): where this memory sits on the route, and
    // the two taps that move it (DESIGN.md "Journeys": a named, ordered route).
    this.memCardRouteRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.7,
      })
      this.rowButton(row, "◀", 3.4, COL_LVIOLET, () => this._onRouteMove.invoke(-1))
      this.flexChild(row, {w: 11, h: 2.8}, (t) => {
        this.memCardRouteText = this.textIn(t, "Locus 1", "Caption", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
        })
      })
      this.rowButton(row, "▶", 3.4, COL_LVIOLET, () => this._onRouteMove.invoke(1))
    })

    // One-tap conjure — the router already picked the kind and wrote a mnemonic
    // prompt at capture time, so this is the whole "Conjure imagery?" chip.
    this.memCardConjureRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      // Retitled per memory by setConjureKind — "Conjure imagery" is only the
      // pre-routing placeholder.
      this.memCardConjureLabel = this.rowButton(row, "Conjure imagery", 14, COL_TEAL,
        () => this._onCardConjure.invoke())
    })

    // Override stack (revealed by Enhance): the caption is what tells you the
    // buttons below are a DIFFERENT choice, not a repeat of the primary.
    // Built ENABLED so its buttons initialize during the FAR_POS park window
    // (G3); applyInitialVisibility hides it, and toggles only happen post-init.
    this.memCardEnhanceRow = this.flexChild(col, {w: 21, h: 5}, (c) => {
      const stack = this.flexColumn(c, 21, 5, {
        gap: 0.4, justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.flexChild(stack, {w: 21, h: 1.4}, (t) => {
        this.textIn(t, "or pick a different kind", "Caption", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
        })
      })
      this.flexChild(stack, {w: 21, h: 2.8}, (r) => {
        const row = this.flexRow(r, 21, 2.8, {
          justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.8,
        })
        // No "Back" here — it read as a third imagery choice. Enhance toggles
        // this block shut, and the corner X dismisses the card outright.
        this.rowButton(row, "3D", 6, COL_LVIOLET, () => this._onCardEnhanceMesh.invoke())
        this.rowButton(row, "Image", 7.5, COL_LVIOLET, () => this._onCardEnhanceImage.invoke())
      })
    })

    // Remove row (only when the memory already has an enhancement).
    this.memCardRemoveRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.rowButton(row, "Remove enhancement", 15, COL_ROSE, () => this._onCardEnhanceRemove.invoke())
    })

    // (The read-only Explore row is gone: its only control was Close, and the
    // corner X now does that in every mode.)

    // Train prompt row: the recall question's single affordance.
    this.memCardPromptRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.rowButton(row, "Reveal", 7.5, COL_TEAL, () => this._onTrainReveal.invoke())
    })

    // Train grade row: self-grading, never punishing (Forgot is muted, not rose).
    this.memCardGradeRow = this.flexChild(col, {w: 21, h: 3}, (c) => {
      const row = this.flexRow(c, 21, 3, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.7,
      })
      this.rowButton(row, "Remembered", 8.6, COL_TEAL, () => this._onTrainGrade.invoke(1))
      this.rowButton(row, "Almost", 5.6, COL_TEXT, () => this._onTrainGrade.invoke(0))
      this.rowButton(row, "Forgot", 5.2, COL_MUTED, () => this._onTrainGrade.invoke(-1))
    })
  }

  /** Swap the memory card between its action rows (edit / conjure / read-only / train). */
  private setMemCardMode(mode: "main" | "enhance" | "readonly" | "prompt" | "grade"): void {
    this.memCardMode = mode
    // "enhance" is ADDITIVE, not a replacement: the conjure block opens
    // beneath the ordinary actions so Delete never goes out of reach —
    // it used to vanish the moment the post-capture chip auto-opened.
    const editing = mode === "main" || mode === "enhance"
    if (this.memCardActionRow !== null) this.memCardActionRow.enabled = editing
    if (this.memCardRouteRow !== null) this.memCardRouteRow.enabled = editing
    if (this.memCardConjureRow !== null) this.memCardConjureRow.enabled = mode === "enhance"
    if (this.memCardEnhanceRow !== null) this.memCardEnhanceRow.enabled = mode === "enhance"
    if (this.memCardRemoveRow !== null) {
      this.memCardRemoveRow.enabled = mode === "enhance" && this.cardHasEnhance
    }
    if (this.memCardPromptRow !== null) this.memCardPromptRow.enabled = mode === "prompt"
    if (this.memCardGradeRow !== null) this.memCardGradeRow.enabled = mode === "grade"
    // Dismissal is available while browsing, but not mid-quiz — closing the
    // card during a Train prompt would strand the run with no way back.
    if (this.memCardCloseX !== null && this.initDone) {
      this.memCardCloseX.enabled = editing || mode === "readonly"
    }
    // Rescan so the hidden rows give up their slots — `refreshChildren` skips
    // disabled children, which collapses the card down onto what's visible.
    // Pre-init the layout hasn't discovered anything yet, so skip (the initial
    // pass runs after applyInitialVisibility anyway).
    if (this.initDone && this.memCardFlex !== null) this.memCardFlex.refreshChildren()
  }

  /** Name the router's pick on the primary conjure button, so "Conjure" and
   *  the 3D / Image overrides aren't three unlabelled ways to do one thing. */
  setConjureKind(kind: "mesh" | "image" | null): void {
    if (this.memCardConjureLabel === null) return
    this.memCardConjureLabel.text = kind === "mesh" ? "Conjure 3D object"
      : kind === "image" ? "Conjure image"
      : "Conjure imagery"
  }

  /** Button inside an existing flex row (memory card actions).
   *  Returns the label Text so callers can retitle it later. */
  private rowButton(row: SceneObject, label: string, width: number, labelColor: vec4,
      onClick: () => void): Text | null {
    let labelText: Text | null = null
    this.flexChild(row, {w: width, h: 2.8}, (host) => {
      const btn = host.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(width, 2.8, 1)   // BEFORE init

      const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
      const brow = this.flexRow(face, width, 2.8, {
        justify: FlexJustify.Center, align: FlexAlign.Center,
      })
      this.flexChild(brow, {w: width - 2, h: 2.2}, (c) => {
        labelText = this.textIn(c, label, "Button", {
          font: FONT_MEDIUM, nativeWeight: 500, color: labelColor,
        })
      })

      btn.onTriggerUp.add(onClick)
    })
    return labelText
  }

  private buildSigilLabel(): void {
    this.labelRoot = this.obj(this.sceneObject, "NewMemoryLabel", FAR_POS)
    this.realPos["label"] = new vec3(0, 0, 0)
    this.labelRoot.createComponent("Component.Canvas")
    const plate = this.labelRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    this.labelRoot.createComponent(Billboard.getTypeName())   // yaw-follow the user

    const content = this.obj(this.labelRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, 8, -1, {
      gap: 0, padX: 0.6, padY: 0.4,
      justify: FlexJustify.Center, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    this.flexChild(col, {w: 7, h: 1.4}, (c) => {
      this.textIn(c, "New Memory", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
      })
    })
  }

  /** Small "Done" tag riding the sigil cluster's Done chip (teal = success). */
  private buildDoneLabel(): void {
    this.doneLabelRoot = this.obj(this.sceneObject, "DoneLabel", FAR_POS)
    this.realPos["donelabel"] = new vec3(0, 0, 0)
    this.doneLabelRoot.createComponent("Component.Canvas")
    const plate = this.doneLabelRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    this.doneLabelRoot.createComponent(Billboard.getTypeName())

    const content = this.obj(this.doneLabelRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, 5, -1, {
      gap: 0, padX: 0.5, padY: 0.35,
      justify: FlexJustify.Center, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    this.flexChild(col, {w: 4, h: 1.2}, (c) => {
      this.textIn(c, "Done", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEAL,
      })
    })
  }

  private buildGazeLabel(): void {
    this.gazeLabelRoot = this.obj(this.sceneObject, "GazeLabel", FAR_POS)
    this.realPos["gazelabel"] = new vec3(0, 0, 0)
    this.gazeLabelRoot.createComponent("Component.Canvas")
    const plate = this.gazeLabelRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    this.gazeLabelRoot.createComponent(Billboard.getTypeName())

    const content = this.obj(this.gazeLabelRoot, "Content", new vec3(0, 0, 0.6))
    // 19 = the 17-wide speaker+text row slot + 2×padX — the plate hugs this
    // column, so a narrower width spills the speaker chip outside the plate.
    const col = this.flexColumn(content, 19, -1, {
      gap: 0, padX: 0.9, padY: 0.55,
      justify: FlexJustify.Center, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    // Speaker button + the memory's words, one row.
    this.flexChild(col, {w: 17, h: 3.6}, (c) => {
      const row = this.flexRow(c, 17, 3.6, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.6,
      })
      this.flexChild(row, {w: 2.8, h: 2.8}, (host) => {
        const btn = host.createComponent(Button.getTypeName()) as Button
        btn.size = new vec3(2.8, 2.8, 1)   // BEFORE init
        const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
        this.imageIn(face, ICON_SPEAK, SPEAK_ICON_S, SPEAK_ICON_S, COL_TEAL)
        this.speakerFace = face
        this.speakerImg = face.getComponent("Component.Image") as Image
        btn.onTriggerUp.add(() => this._onGazeSpeak.invoke())
      })
      this.flexChild(row, {w: 13, h: 3.4}, (c2) => {
        this.gazeLabelText = this.textIn(c2, "", "Body", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
          wrap: {w: 13, h: 3.4}, distanceCm: 150,
        })
      })
    })
  }

  private buildStatusLine(): void {
    this.statusRoot = this.obj(this.sceneObject, "WizardStatus", FAR_POS)
    this.realPos["status"] = new vec3(0, 0, 0)
    this.statusRoot.createComponent("Component.Canvas")
    const plate = this.statusRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    this.statusPlate = plate
    this.statusRoot.createComponent(Billboard.getTypeName())

    const content = this.obj(this.statusRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, STATUS_WRAP_W + 1, -1, {
      gap: 0, padX: 0.9, padY: 0.55,
      justify: FlexJustify.Center, align: FlexAlign.Center,
    })
    // No onLayoutComplete plate-hug here: setStatusText is the plate's single
    // writer (text-aware wrap fit), so the flex pass never fights it. The flex
    // tree only centers the child; every show is preceded by setStatusText.
    // Body role scaled for the reticle's ~150 cm viewing distance — the old
    // Caption-at-110 sizing is why the label was unreadable out there.
    this.flexChild(col, {w: STATUS_WRAP_W, h: STATUS_LINE_H}, (c) => {
      this.statusText = this.textIn(c, "Hold steady…", "Body", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT, distanceCm: 150,
        wrap: {w: STATUS_WRAP_W, h: STATUS_LINE_H},
      })
    })
  }

  // ── Gaze-label speaker loading pulse ───────────────────────────────────────

  /** Breathe the speaker icon while a TTS fetch is in flight. */
  setSpeakerLoading(on: boolean): void {
    if (this.speakerLoading === on) return
    this.speakerLoading = on
    this.speakerPulseT = 0
    if (!on) this.resetSpeakerVisual()
  }

  private resetSpeakerVisual(): void {
    if (this.speakerFace !== null) {
      this.speakerFace.getTransform().setLocalScale(new vec3(SPEAK_ICON_S, SPEAK_ICON_S, 1))
    }
    if (this.speakerImg !== null) {
      const c = this.speakerImg.mainPass.baseColor
      this.speakerImg.mainPass.baseColor = new vec4(c.x, c.y, c.z, 1)
    }
  }

  private updateSpeakerPulse(): void {
    if (!this.speakerLoading || this.speakerFace === null) return
    this.speakerPulseT += getDeltaTime()
    const wave = Math.sin(this.speakerPulseT * SPEAK_PULSE_HZ * 2 * Math.PI)
    const s = SPEAK_ICON_S * (1 + 0.16 * wave)
    this.speakerFace.getTransform().setLocalScale(new vec3(s, s, 1))
    if (this.speakerImg !== null) {
      const a = 0.65 + 0.35 * (0.5 + 0.5 * wave)
      const c = this.speakerImg.mainPass.baseColor
      this.speakerImg.mainPass.baseColor = new vec4(c.x, c.y, c.z, a)
    }
  }

  // ── Modal vertical follow assist (see VFOLLOW_* constants) ────────────────
  // Pitch conventions mirror UIKit SmoothFollow: pitch > 0 = looking up.

  private updateModalVerticalAssist(): void {
    if (!this.initDone || !this.wantModal || this.modalFrame === null || this.modalDragging) return
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const f = camT.forward
    const pitch = Math.atan2(-f.y, Math.sqrt(f.x * f.x + f.z * f.z))
    const pitchDeg = pitch * (180 / Math.PI)
    if (pitchDeg > VFOLLOW_TILT_UP || pitchDeg < -VFOLLOW_TILT_DOWN) {
      this.vAssistActive = false   // steep gaze — UIKit tilt mode owns elevation
      return
    }
    const t = this.modalRoot.getTransform()
    const pos = t.getWorldPosition()
    const cam = camT.getWorldPosition()
    const dx = pos.x - cam.x
    const dz = pos.z - cam.z
    const horiz = Math.sqrt(dx * dx + dz * dz)
    if (horiz < 1) return
    const pitchToPanel = Math.atan2(pos.y - cam.y, horiz)
    const offDeg = Math.abs(pitchToPanel - pitch) * (180 / Math.PI)
    if (!this.vAssistActive && offDeg > VFOLLOW_ENTER_DEG) this.vAssistActive = true
    else if (this.vAssistActive && offDeg < VFOLLOW_SETTLE_DEG) this.vAssistActive = false
    if (!this.vAssistActive) return
    const rawTarget = cam.y + Math.tan(pitch) * horiz
    const targetY = Math.min(cam.y + VFOLLOW_MAX_ELEV, Math.max(cam.y - VFOLLOW_MAX_ELEV, rawTarget))
    const k = Math.min(1, VFOLLOW_K * getDeltaTime())
    t.setWorldPosition(new vec3(pos.x, pos.y + (targetY - pos.y) * k, pos.z))
  }

  // ── Element helpers ────────────────────────────────────────────────────────

  private textIn(host: SceneObject, str: string, role: TextRole, opts: {
    font?: Font; color?: vec4; nativeWeight?: number; wrap?: {w: number; h: number}
    distanceCm?: number   // viewing distance the role size is scaled for (default 110)
  }): Text {
    const t = host.createComponent("Component.Text") as Text
    t.text = str
    t.depthTest = true
    applyTextRole(t, role, opts.distanceCm ?? 110)
    if (opts.font) t.font = opts.font
    if (opts.nativeWeight !== undefined) {
      // Match the loaded font file's native weight — avoids faux-bold synthesis.
      ;(t as Text & {weight?: number}).weight = opts.nativeWeight
    }
    if (opts.color) t.textFill.color = opts.color
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center   // never Top for multi-line
    if (opts.wrap) {
      t.horizontalOverflow = HorizontalOverflow.Wrap
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-opts.wrap.w / 2, opts.wrap.w / 2, -opts.wrap.h / 2, opts.wrap.h / 2)
    } else {
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5)
    }
    return t
  }

  private imageIn(host: SceneObject, tex: Texture, w: number, h: number, tint: vec4): void {
    const img = host.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = tex
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false   // Images: depth-test ON, depth-write OFF
    mat.mainPass.baseColor = tint
    img.clearMaterials()
    img.addMaterial(mat)
    host.getTransform().setLocalScale(new vec3(w, h, 1))
  }

  // ── Layout composition helpers (verbatim per /specs-build-ui) ──────────────

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const sceneObject = global.scene.createSceneObject(name)
    sceneObject.setParent(parent)
    if (position) sceneObject.getTransform().setLocalPosition(position)
    return sceneObject
  }

  private liftInZ(sceneObject: SceneObject, zOffset: number): void {
    const transform = sceneObject.getTransform()
    const pos = transform.getLocalPosition()
    transform.setLocalPosition(new vec3(pos.x, pos.y, pos.z + zOffset))
  }

  private flexColumn(parent: SceneObject, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    return this.makeFlex(parent, FlexDirection.Column, width, height, opts)
  }

  private flexRow(parent: SceneObject, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    return this.makeFlex(parent, FlexDirection.Row, width, height, opts)
  }

  private makeFlex(parent: SceneObject, direction: FlexDirection, width: number, height: number,
      opts?: {gap?: number, padY?: number, padX?: number, justify?: FlexJustify, align?: FlexAlign}): SceneObject {
    const container = this.obj(parent, "Flex")
    this.liftInZ(container, LAYOUT_Z_LIFT)
    const flexLayout = container.createComponent(FlexLayout.getTypeName()) as FlexLayout
    const flexItem = container.createComponent(FlexItem.getTypeName()) as FlexItem
    if (width > 0) flexItem.overrideWidth = width
    if (height > 0) flexItem.overrideHeight = height

    flexLayout.onInitialized.add(() => {
      flexLayout.width = width
      flexLayout.height = height
      flexLayout.direction = direction
      if (direction === FlexDirection.Row) {
        flexLayout.columnGap = opts?.gap ?? 0
      } else {
        flexLayout.rowGap = opts?.gap ?? 0
      }
      flexLayout.paddingTop = opts?.padY ?? 0
      flexLayout.paddingBottom = opts?.padY ?? 0
      flexLayout.paddingLeft = opts?.padX ?? 0
      flexLayout.paddingRight = opts?.padX ?? 0
      flexLayout.justifyContent = opts?.justify ?? FlexJustify.Start
      flexLayout.alignItems = opts?.align ?? FlexAlign.Stretch
    })
    return container
  }

  private flexChild(parent: SceneObject, size: {w?: number, h?: number, grow?: number},
      builder: (childObject: SceneObject) => void): SceneObject {
    const child = this.obj(parent, "Item")
    this.liftInZ(child, LAYOUT_Z_LIFT)
    const flexItem = child.createComponent(FlexItem.getTypeName()) as FlexItem
    if (size.w !== undefined && size.w > 0) flexItem.overrideWidth = size.w
    if (size.h !== undefined && size.h > 0) flexItem.overrideHeight = size.h
    flexItem.flexGrow = size.grow ?? 0
    flexItem.flexShrink = 0

    builder(child)

    const parentFlexLayout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
    if (parentFlexLayout) {
      // addItems throws pre-init while autoDiscoverItemsOnStart is enabled
      // (FlexLayout.ts:641). onInitialized is a ReplayEvent, so this defers
      // to post-init for synchronous onAwake builds and fires immediately for
      // lazy post-init builds. addItems ignores duplicates, so items the
      // layout already auto-discovered register as a no-op.
      parentFlexLayout.onInitialized.add(() => parentFlexLayout.addItems([flexItem]))
    }
    return child
  }
}
