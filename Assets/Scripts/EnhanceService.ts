/**
 * EnhanceService — conjures imagery for memories via the Remote Service
 * Gateway (DESIGN.md "Imagery router", user-driven v1).
 *
 *  - "image": Google Imagen (imagen-3.0-generate-002) → Texture.
 *    NOTE: gemini-*-image models 404 through RSG — Imagen is the only working
 *    Google image path (/specs-ai-remote-service).
 *  - "mesh":  Snap3D text-to-3D GLB, staged: the base mesh hatches early
 *    (~30 s) and the refined mesh replaces it silently later (~60–90 s).
 *
 * One in-flight request per memory id; callers own visuals + persistence.
 */
import { Snap3D } from "RemoteServiceGateway.lspkg/HostedSnap/Snap3D";
import { Snap3DTypes } from "RemoteServiceGateway.lspkg/HostedSnap/Snap3DTypes";
import { Imagen } from "RemoteServiceGateway.lspkg/HostedExternal/Imagen";
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes";
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { OpenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes";

export type EnhanceKind = "mesh" | "image";

/** Literal transcript → styled generation prompt (brand palette baked in).
 *  Additive-display rule in both templates: dark pixels VANISH on Specs, so
 *  subjects must be bright/luminous. (A dark background on the image is fine
 *  — it disappears, leaving the subject floating like a cutout.) */
export function buildEnhancePrompt(kind: EnhanceKind, transcript: string): string {
  if (kind === "mesh") {
    return "A small charming low-poly magical object representing: " + transcript +
      ". Fantasy crystal aesthetic, clean silhouette, single centered object, " +
      "bright glowing pastel colors, luminous surfaces, no black or dark materials.";
  }
  return "A dreamy magical illustration representing: " + transcript +
    ". Soft violet and teal glow, single brightly luminous centered subject in " +
    "vivid saturated colors, dark indigo background.";
}

export class EnhanceService {
  private inFlight: { [memoryId: string]: boolean } = {};
  private speechCache: { [memoryId: string]: AudioTrackAsset } = {};
  private speechBusy: { [memoryId: string]: boolean } = {};

  isBusy(memoryId: string): boolean { return this.inFlight[memoryId] === true; }

  /** OpenAI TTS of the memory text — cached per memory, soft arcana voice. */
  generateSpeech(memoryId: string, text: string): Promise<AudioTrackAsset> {
    if (this.speechCache[memoryId] !== undefined) {
      return Promise.resolve(this.speechCache[memoryId]);
    }
    if (this.speechBusy[memoryId]) return Promise.reject("Speech already generating");
    this.speechBusy[memoryId] = true;
    const request: OpenAITypes.Speech.Request = {
      model: "tts-1",
      input: text,
      voice: "shimmer",
    };
    return OpenAI.speech(request)
      .then((track) => {
        this.speechBusy[memoryId] = false;
        this.speechCache[memoryId] = track;
        return track;
      })
      .catch((e) => {
        this.speechBusy[memoryId] = false;
        throw "TTS failed: " + e;
      });
  }

  generateImage(memoryId: string, prompt: string): Promise<Texture> {
    if (this.inFlight[memoryId]) return Promise.reject("Already conjuring this memory");
    this.inFlight[memoryId] = true;
    const request: GoogleGenAITypes.Imagen.ImagenRequest = {
      model: "imagen-3.0-generate-002",
      body: {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      },
    };
    return new Promise((resolve, reject) => {
      Imagen.generateImage(request)
        .then((response) => {
          const b64 = response && response.predictions && response.predictions[0]
            ? response.predictions[0].bytesBase64Encoded : null;
          if (!b64) {
            this.inFlight[memoryId] = false;
            reject("No image data in response");
            return;
          }
          Base64.decodeTextureAsync(b64,
            (tex) => { this.inFlight[memoryId] = false; resolve(tex); },
            () => { this.inFlight[memoryId] = false; reject("Failed to decode image"); });
        })
        .catch((e) => {
          this.inFlight[memoryId] = false;
          reject("Imagen error: " + e);
        });
    });
  }

  /**
   * onPreview fires first (the 2D concept image — used for glow tinting),
   * onBaseMesh once (~10–60 s), onRefinedMesh may follow and supersede.
   */
  generateMesh(memoryId: string, prompt: string,
               onPreview: (texture: Texture) => void,
               onBaseMesh: (gltfAsset: GltfAsset) => void,
               onRefinedMesh: (gltfAsset: GltfAsset) => void,
               onFailed: (msg: string) => void): void {
    if (this.inFlight[memoryId]) { onFailed("Already conjuring this memory"); return; }
    this.inFlight[memoryId] = true;
    Snap3D.submitAndGetStatus({
      prompt: prompt,
      format: "glb",
      refine: true,
      use_vertex_color: true,   // pairs with the unlit vertex-color material
    })
      .then((status) => {
        status.event.add(([value, assetOrError]) => {
          if (value === "image") {
            onPreview((assetOrError as Snap3DTypes.TextureAssetData).texture);
          } else if (value === "base_mesh") {
            onBaseMesh((assetOrError as Snap3DTypes.GltfAssetData).gltfAsset);
          } else if (value === "refined_mesh") {
            this.inFlight[memoryId] = false;
            onRefinedMesh((assetOrError as Snap3DTypes.GltfAssetData).gltfAsset);
          } else if (value === "failed") {
            this.inFlight[memoryId] = false;
            onFailed((assetOrError as Snap3DTypes.ErrorData).errorMsg);
          }
        });
      })
      .catch((e) => {
        this.inFlight[memoryId] = false;
        onFailed("Snap3D submit failed: " + e);
      });
  }
}

/**
 * Average color of a texture's center crop (background-darkness rejected),
 * brightness-normalized so an additive glow stays legible. Falls back to the
 * brand violet when sampling fails or everything is near-black.
 */
export function averageTextureColor(tex: Texture): [number, number, number] {
  const FALLBACK: [number, number, number] = [124 / 255, 108 / 255, 240 / 255]; // #7c6cf0
  try {
    const procTex = ProceduralTextureProvider.createFromTexture(tex);
    const prov = procTex.control as ProceduralTextureProvider;
    const w = tex.getWidth();
    const h = tex.getHeight();
    if (w < 4 || h < 4) return FALLBACK;
    const cw = Math.floor(w / 2);
    const ch = Math.floor(h / 2);
    const data = new Uint8Array(cw * ch * 4);
    prov.getPixels(Math.floor(w / 4), Math.floor(h / 4), cw, ch, data);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 16) {   // stride 4 pixels
      const pr = data[i] / 255, pg = data[i + 1] / 255, pb = data[i + 2] / 255;
      const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      if (lum < 0.09) continue;   // reject background darkness
      r += pr; g += pg; b += pb; n++;
    }
    if (n === 0) return FALLBACK;
    r /= n; g /= n; b /= n;
    const maxc = Math.max(r, Math.max(g, b));
    if (maxc < 0.01) return FALLBACK;
    const k = 0.85 / maxc;   // additive glow legibility floor
    return [Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k)];
  } catch (e) {
    print("EnhanceService: color sample failed (" + e + ") — brand violet fallback");
    return FALLBACK;
  }
}
