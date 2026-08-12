/**
 * MemoryPalaceUI — all user-facing UI for the MemoryPalace Lens (Tuesday v0).
 *
 * Panels (SpectaclesUIKit, composed per /specs-build-ui):
 *  - Start modal: Keystone logo texture, "MEMORY PALACE / AR" wordmark,
 *    Capture / Explore / Train buttons, first-run hand hint, coming-soon line.
 *  - Transcript card: mic icon + "Listening…" header, streaming ASR body,
 *    "pinch to finish" hint. Hidden until the capture wizard reaches SPEAK.
 *  - "New Memory" label: small billboarded tag the main script positions next
 *    to the hand sigil.
 *
 * Channel A event-bus: main script pushes state via public setters and
 * subscribes to onCapture / onExplore / onTrain.
 *
 * STYLE.md: lavender text #ede9ff, muted #9a8be8, violet #7c6cf0 interactive,
 * teal #4dd6c1 accents, no yellow, no pure-white text fills, Montserrat
 * (Light 300 display / Medium 500 functional).
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

// ── Assets (requireAsset — never @input) ─────────────────────────────────────
const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material
const LOGO_TEX = requireAsset("../Textures/logo_keystone.png") as Texture
const ICON_CAPTURE = requireAsset("../Icons/photo_camera.png") as Texture
const ICON_EXPLORE = requireAsset("../Icons/explore.png") as Texture
const ICON_TRAIN = requireAsset("../Icons/psychology.png") as Texture
const ICON_MIC = requireAsset("../Icons/mic.png") as Texture
const FONT_LIGHT = requireAsset("../Fonts/Montserrat-Light.ttf") as Font
const FONT_MEDIUM = requireAsset("../Fonts/Montserrat-Medium.ttf") as Font

// ── Brand palette (Branding/STYLE.md) ────────────────────────────────────────
const COL_TEXT = new vec4(237 / 255, 233 / 255, 255 / 255, 1)   // #ede9ff lavender
const COL_MUTED = new vec4(154 / 255, 139 / 255, 232 / 255, 1)  // #9a8be8 muted lavender
const COL_TEAL = new vec4(77 / 255, 214 / 255, 193 / 255, 1)    // #4dd6c1
const COL_LVIOLET = new vec4(168 / 255, 139 / 255, 255 / 255, 1) // #a88bff light violet

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

// ── Layout constants ─────────────────────────────────────────────────────────
const LAYOUT_Z_LIFT = 0.02
const BUTTON_LABEL_Z = 0.08
const FAR_POS = new vec3(0, -100000, 0)   // park hidden panels here until post-init

const MODAL_W = 26
const CARD_W = 24

@component
export class MemoryPalaceUI extends BaseScriptComponent {
  // ── Public events (UI → main) ──────────────────────────────────────────────
  private _onCapture = new Event<void>()
  get onCapture(): PublicApi<void> { return this._onCapture.publicApi() }
  private _onExplore = new Event<void>()
  get onExplore(): PublicApi<void> { return this._onExplore.publicApi() }
  private _onTrain = new Event<void>()
  get onTrain(): PublicApi<void> { return this._onTrain.publicApi() }

  // ── Panel roots + state ────────────────────────────────────────────────────
  private modalRoot!: SceneObject
  private cardRoot!: SceneObject
  private labelRoot!: SceneObject
  private statusRoot!: SceneObject
  private realPos: {[name: string]: vec3} = {}

  private wantModal = true
  private wantCard = false
  private wantLabel = false
  private wantStatus = false
  private initDone = false

  // Dynamic text handles
  private comingSoonText: Text | null = null
  private listeningText: Text | null = null
  private transcriptText: Text | null = null
  private hintText: Text | null = null
  private pendingHint: string | null = null
  private cardHintText: Text | null = null
  private statusText: Text | null = null
  private comingSoonClear!: DelayedCallbackEvent

  onAwake() {
    this.buildStartModal()
    this.buildTranscriptCard()
    this.buildSigilLabel()
    this.buildStatusLine()

    this.comingSoonClear = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.comingSoonClear.bind(() => { if (this.comingSoonText) this.comingSoonText.text = "" })

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

  showModal(): void { this.wantModal = true; this.applyVisibility() }
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
      this.comingSoonText.text = msg
      this.comingSoonClear.reset(2.8)
    }
  }

  /** Replace the first-run hint copy (editor vs device affordances differ). */
  setHintText(t: string): void {
    this.pendingHint = t   // buffered — the modal builds lazily inside Frame init
    if (this.hintText) this.hintText.text = t
  }

  // Status line: small billboarded caption the wizard parks under the reticle.
  showStatus(): void { this.wantStatus = true; this.applyVisibility() }
  hideStatus(): void { this.wantStatus = false; this.applyVisibility() }
  setStatusText(t: string): void {
    if (this.statusText) this.statusText.text = t
  }
  setStatusPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantStatus) return
    this.statusRoot.getTransform().setWorldPosition(worldPos)
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

  showSigilLabel(): void { this.wantLabel = true; this.applyVisibility() }
  hideSigilLabel(): void { this.wantLabel = false; this.applyVisibility() }

  setSigilLabelPosition(worldPos: vec3): void {
    if (!this.initDone || !this.wantLabel) return
    this.labelRoot.getTransform().setWorldPosition(worldPos)
  }

  // ── Visibility plumbing ────────────────────────────────────────────────────

  private applyInitialVisibility(): void {
    this.initDone = true
    this.cardRoot.getTransform().setLocalPosition(this.realPos["card"])
    this.labelRoot.getTransform().setLocalPosition(this.realPos["label"])
    this.statusRoot.getTransform().setLocalPosition(this.realPos["status"])
    this.applyVisibility()
  }

  private applyVisibility(): void {
    if (!this.initDone) return  // flags are honored by applyInitialVisibility
    this.modalRoot.enabled = this.wantModal
    this.cardRoot.enabled = this.wantCard
    this.labelRoot.enabled = this.wantLabel
    this.statusRoot.enabled = this.wantStatus
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

      const host = frame.contentTransform.getSceneObject()
      const content = this.obj(host, "Content", new vec3(0, 0, 0.6))
      const col = this.flexColumn(content, MODAL_W, -1, {
        gap: 0.9, padX: 1.6, padY: 1.6,
        justify: FlexJustify.Start, align: FlexAlign.Center,
      })
      const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
      flex.onLayoutComplete.add((r) => {
        frame.innerSize = new vec2(r.containerWidth, r.containerHeight)
      })
      this.buildModalContent(col)
      // Hint copy may have been pushed before the frame initialized — apply now.
      if (this.pendingHint !== null && this.hintText) this.hintText.text = this.pendingHint
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

    this.addModalButton(col, "Capture", ICON_CAPTURE, () => this._onCapture.invoke())
    this.addModalButton(col, "Explore", ICON_EXPLORE, () => {
      this.showComingSoon("Explore")
      this._onExplore.invoke()
    })
    this.addModalButton(col, "Train", ICON_TRAIN, () => {
      this.showComingSoon("Train")
      this._onTrain.invoke()
    })

    // First-run hint (Snap hand-menu guideline: users won't find hand UI unaided).
    this.flexChild(col, {w: 22, h: 1.5}, (c) => {
      this.hintText = this.textIn(c, "Glance at your left hand to capture", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
      })
    })

    // Transient coming-soon line (empty keeps layout stable).
    this.flexChild(col, {w: 22, h: 1.3}, (c) => {
      this.comingSoonText = this.textIn(c, "", "Caption", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEAL,
      })
    })

    // Studio credit, bottom right.
    this.flexChild(col, {w: 22, h: 1.1}, (c) => {
      const row = this.flexRow(c, 22, 1.1, {justify: FlexJustify.End, align: FlexAlign.Center})
      this.flexChild(row, {w: 6, h: 1.1}, (cc) => {
        this.textIn(cc, "FLARB LLC", "Caption", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_MUTED,
        })
      })
    })
  }

  private addModalButton(col: SceneObject, label: string, icon: Texture, onClick: () => void): void {
    this.flexChild(col, {w: 14, h: 3.2}, (host) => {
      const btn = host.createComponent(Button.getTypeName()) as Button
      btn.size = new vec3(14, 3.2, 1)   // BEFORE init

      const face = this.obj(host, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
      const row = this.flexRow(face, 14, 3.2, {
        justify: FlexJustify.Center, align: FlexAlign.Center, gap: 0.7,
      })
      this.flexChild(row, {w: 1.9, h: 1.9}, (c) => {
        this.imageIn(c, icon, 1.9, 1.9, COL_LVIOLET)
      })
      this.flexChild(row, {w: 6, h: 2.4}, (c) => {
        this.textIn(c, label, "Button", {
          font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT,
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

  private buildStatusLine(): void {
    this.statusRoot = this.obj(this.sceneObject, "WizardStatus", FAR_POS)
    this.realPos["status"] = new vec3(0, 0, 0)
    this.statusRoot.createComponent("Component.Canvas")
    const plate = this.statusRoot.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.style = "dark"
    this.statusRoot.createComponent(Billboard.getTypeName())

    const content = this.obj(this.statusRoot, "Content", new vec3(0, 0, 0.6))
    const col = this.flexColumn(content, 16, -1, {
      gap: 0, padX: 0.9, padY: 0.55,
      justify: FlexJustify.Center, align: FlexAlign.Center,
    })
    const flex = col.getComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    // Body role scaled for the reticle's ~150 cm viewing distance — the old
    // Caption-at-110 sizing is why the label was unreadable out there.
    this.flexChild(col, {w: 15, h: 2.2}, (c) => {
      this.statusText = this.textIn(c, "Hold steady…", "Body", {
        font: FONT_MEDIUM, nativeWeight: 500, color: COL_TEXT, distanceCm: 150,
      })
    })
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
