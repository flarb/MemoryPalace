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

export type EnhanceKind = "mesh" | "image";

/** Literal transcript → styled generation prompt (brand palette baked in). */
export function buildEnhancePrompt(kind: EnhanceKind, transcript: string): string {
  if (kind === "mesh") {
    return "A small charming low-poly magical object representing: " + transcript +
      ". Fantasy crystal aesthetic, clean silhouette, single centered object.";
  }
  return "A dreamy magical illustration representing: " + transcript +
    ". Soft violet and teal glow, single centered subject, dark indigo background.";
}

export class EnhanceService {
  private inFlight: { [memoryId: string]: boolean } = {};

  isBusy(memoryId: string): boolean { return this.inFlight[memoryId] === true; }

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

  /** onBaseMesh fires once (~30 s); onRefinedMesh may follow and supersede. */
  generateMesh(memoryId: string, prompt: string,
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
          if (value === "base_mesh") {
            onBaseMesh((assetOrError as Snap3DTypes.GltfAssetData).gltfAsset);
          } else if (value === "refined_mesh") {
            this.inFlight[memoryId] = false;
            onRefinedMesh((assetOrError as Snap3DTypes.GltfAssetData).gltfAsset);
          } else if (value === "failed") {
            this.inFlight[memoryId] = false;
            onFailed((assetOrError as Snap3DTypes.ErrorData).errorMsg);
          }
          // The "image" preview stage is ignored — the gem keeps its shimmer.
        });
      })
      .catch((e) => {
        this.inFlight[memoryId] = false;
        onFailed("Snap3D submit failed: " + e);
      });
  }
}
