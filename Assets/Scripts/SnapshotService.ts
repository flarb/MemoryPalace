/**
 * SnapshotService — 2D snapshot capture for memories (DESIGN.md capture
 * Step 1 / "The gem" amber-inclusion source / Train's blurred hint tier).
 *
 * v1 simplification (deliberate): no pinch-drag FRAME rectangle — the shipped
 * wizard folded FRAME into AIMING, so the reticle confirm IS the frame
 * gesture. At confirm we read the continuous camera texture (requestImage is
 * device-only; requestCamera also runs in the editor against the simulated
 * room render) and crop a fixed square (~40% of frame height) centered on the
 * anchor's screen projection via the render camera. On device the RGB camera
 * is offset from the display — centered-crop parallax is accepted at v1.
 *
 * Products per capture: 192 px crop (card photo) + a 16 px tiny twin whose
 * bilinear upscale on a quad is the free "blur" (Train Recall-tier hint).
 * Pixel path = ProceduralTextureProvider createFromTexture/getPixels — the
 * same machinery EnhanceService.averageTextureColor already ships.
 */

const CROP_FRACTION = 0.4;   // square side as a fraction of frame height
const SNAP_PX = 192;         // card photo
const TINY_PX = 16;          // blur twin

export interface Snapshot {
  tex: Texture;
  tiny: Texture;
}

export class SnapshotService {
  private cameraModule: CameraModule = require("LensStudio:CameraModule");
  private camTex: Texture | null = null;
  private frameSeen = false;

  /** Lazy camera spin-up (post-start only — e.g. first wizard start). */
  ensureCamera(): void {
    if (this.camTex !== null) return;
    try {
      const req = CameraModule.createCameraRequest();
      req.cameraId = global.deviceInfoSystem.isEditor()
        ? CameraModule.CameraId.Default_Color
        : CameraModule.CameraId.Right_Color;
      this.camTex = this.cameraModule.requestCamera(req);
      const provider = this.camTex.control as CameraTextureProvider;
      // Keeps the pipeline warm AND proves frames are flowing before we read.
      provider.onNewFrame.add(() => { this.frameSeen = true; });
      print("Snapshot: camera requested");
    } catch (e) {
      print("Snapshot: camera unavailable (" + e + ")");
      this.camTex = null;
    }
  }

  /**
   * Crop the current frame around the anchor's screen projection.
   * Null = no photo (graceful: the memory behaves exactly as before).
   */
  capture(anchorWorld: vec3, renderCam: Camera): Snapshot | null {
    if (this.camTex === null || !this.frameSeen) {
      print("Snapshot: no camera frame yet — memory ships without a photo");
      return null;
    }
    try {
      const src = ProceduralTextureProvider.createFromTexture(this.camTex);
      const prov = src.control as ProceduralTextureProvider;
      const w = this.camTex.getWidth();
      const h = this.camTex.getHeight();
      if (w < 8 || h < 8) return null;
      // Anchor → screen (0..1, origin top-left) → texture px (origin bottom-left).
      const s = renderCam.worldSpaceToScreenSpace(anchorWorld);
      const side = Math.floor(h * CROP_FRACTION);
      let cx = Math.floor(s.x * w);
      let cy = Math.floor((1 - s.y) * h);
      cx = Math.max(side / 2, Math.min(w - side / 2, cx));
      cy = Math.max(side / 2, Math.min(h - side / 2, cy));
      const x0 = Math.max(0, Math.floor(cx - side / 2));
      const y0 = Math.max(0, Math.floor(cy - side / 2));
      const data = new Uint8Array(side * side * 4);
      prov.getPixels(x0, y0, side, side, data);
      const tex = this.resample(data, side, SNAP_PX);
      const tiny = this.resample(data, side, TINY_PX);
      print("Snapshot: cropped " + side + "×" + side + " @ (" + x0 + "," + y0 +
        ") of " + w + "×" + h + " → " + SNAP_PX + " px + " + TINY_PX + " px tiny");
      return { tex: tex, tiny: tiny };
    } catch (e) {
      print("Snapshot: capture failed (" + e + ") — memory ships without a photo");
      return null;
    }
  }

  /** Nearest-neighbor resample of an RGBA square into a fresh texture. */
  private resample(src: Uint8Array, srcSide: number, dstSide: number): Texture {
    const out = new Uint8Array(dstSide * dstSide * 4);
    for (let y = 0; y < dstSide; y++) {
      const sy = Math.min(srcSide - 1, Math.floor((y / dstSide) * srcSide));
      for (let x = 0; x < dstSide; x++) {
        const sx = Math.min(srcSide - 1, Math.floor((x / dstSide) * srcSide));
        const si = (sy * srcSide + sx) * 4;
        const di = (y * dstSide + x) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = 255;
      }
    }
    const tex = ProceduralTextureProvider.create(dstSide, dstSide, Colorspace.RGBA);
    (tex.control as ProceduralTextureProvider).setPixels(0, 0, dstSide, dstSide, out);
    return tex;
  }

  /** JPEG b64 for persistence (low quality — storage is the scarce thing). */
  encode(tex: Texture): Promise<string> {
    return new Promise((resolve, reject) => {
      Base64.encodeTextureAsync(tex, (s) => resolve(s), () => reject("encode failed"),
        CompressionQuality.LowQuality, EncodingType.Jpg);
    });
  }

  /** Texture from a persisted b64 JPEG (palace load). */
  decode(b64: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      Base64.decodeTextureAsync(b64, (t) => resolve(t), () => reject("decode failed"));
    });
  }
}
