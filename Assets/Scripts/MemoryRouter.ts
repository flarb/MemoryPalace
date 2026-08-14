/**
 * MemoryRouter — the mnemonic transformer (DESIGN.md "Imagery router").
 *
 * ONE Remote Service Gateway LLM call turns a literal transcript into mnemonic
 * direction: a punchy label, the imagery kind, a bizarre-vivid generation
 * prompt, and the motion/VFX recipes that carry the encoding. Method-of-loci
 * research is explicit that *static* literal imagery underperforms for abstract
 * content, so the router always names motion — `animRecipe` is never "none"
 * for a real memory.
 *
 * DESIGN's third kind, "bitmoji" (your avatar acts out the memory), is Friday
 * scope — the Bitmoji package and clip set aren't in the project yet. Until
 * then the router maps people/actions/events to "image" (Imagen can stage a
 * scene) and objects/concepts to "mesh" (Snap3D). The prompt below already
 * encodes DESIGN's noun-vs-verb split, so adding "bitmoji" later is a one-line
 * enum change plus a branch in the consumer.
 *
 * NEVER blocks and NEVER error-walls (DESIGN routing rule): any failure —
 * offline, expired RSG token, malformed JSON, unknown enum — degrades to
 * `fallbackRoute()`, which is derived locally from the transcript.
 */
import { OpenAI } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAI";
import { OpenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/OpenAITypes";

/**
 * Procedural transform recipes (GemFactory drives these on the gem).
 *
 * DESIGN.md listed a sixth, "shake". It shipped and was cut the same day: any
 * high-frequency tremor — even retuned to a decaying burst on the visual only
 * — reads as a rendering glitch rather than as urgency, which is the opposite
 * of what a mnemonic wants. Urgency is carried by `pulse` and `swell` instead.
 * Legacy saves are remapped by `coerceAnim`.
 */
export type AnimRecipe = "spin" | "bob" | "pulse" | "orbit" | "swell";
/** Particle recipes (GemFactory's shared additive puff family, restyled). */
export type VfxRecipe = "sparkle" | "smoke" | "burst" | "rain" | "none";
/** "gem" = don't conjure; the gem stays the marker. */
export type RouteKind = "mesh" | "image" | "gem";

export interface MemoryRoute {
  label: string;          // 2–4 word punchy title
  kind: RouteKind;
  prompt: string;         // generation prompt for mesh/image (empty when "gem")
  animRecipe: AnimRecipe;
  vfxRecipe: VfxRecipe;
  routed: boolean;        // false = local fallback, not the LLM's opinion
}

const ANIMS: AnimRecipe[] = ["spin", "bob", "pulse", "orbit", "swell"];
const VFX: VfxRecipe[] = ["sparkle", "smoke", "burst", "rain", "none"];
const KINDS: RouteKind[] = ["mesh", "image", "gem"];

const MODEL = "gpt-4.1-nano";

const SYSTEM_PROMPT =
  "You turn a spoken memory into mnemonic imagery for an AR memory palace. " +
  "The user will walk past this object later and must instantly recall the memory. " +
  "Reply with ONLY a JSON object, no prose and no code fences.\n" +
  "Fields:\n" +
  "  label: 2-4 word punchy title OF THE MEMORY AS SPOKEN, Title Case, no " +
  "trailing punctuation. Never describe the artwork: no style, color, or " +
  "lighting words (luminous, glowing, bright, pastel...) unless the user " +
  "actually said them. \"a race car\" -> \"Race Car\", never \"Luminous Race Car\".\n" +
  "  kind: \"mesh\" for objects, things, concepts (nouns); \"image\" for people, " +
  "actions, events, social moments (verbs).\n" +
  "  prompt: a BIZARRE, VIVID, exaggerated image of the memory — the weirder the " +
  "more memorable. Concrete and absurd beats literal and tasteful. One centered " +
  "subject. Example: \"buy milk\" -> \"a cartoon cow doing a handstand spraying a " +
  "fountain of milk\". Keep under 30 words. CRITICAL: the result renders on an " +
  "ADDITIVE AR display where dark pixels turn invisible — always describe the " +
  "subject in bright, luminous, saturated colors (glowing pastels, vivid hues, " +
  "white highlights); never black, dark, or shadowed materials.\n" +
  "  animRecipe: one of spin, bob, pulse, orbit, swell. Motion carries the " +
  "encoding — pick the one that dramatizes THIS memory. Abstract or urgent " +
  "memories deserve the bigger motions (pulse, swell).\n" +
  "  vfxRecipe: one of sparkle, smoke, burst, rain, none. Use none sparingly.";

/** Tolerant extraction: models sometimes wrap JSON in prose or ``` fences. */
function extractJson(raw: string): any | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.substring(start, end + 1));
  } catch (e) {
    return null;
  }
}

function pick<T>(value: any, allowed: T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const v = value.toLowerCase().trim();
  for (const a of allowed) {
    if ((a as any as string) === v) return a;
  }
  return fallback;
}

/**
 * Validate a stored `anim` string against the live vocabulary. Saves written
 * before "shake" was cut still carry it; those memories inherit `pulse`, the
 * nearest surviving urgency motion, rather than silently falling back to idle.
 */
export function coerceAnim(value: string | undefined): AnimRecipe | null {
  if (value === undefined) return null;
  if (value === "shake") return "pulse";   // retired recipe, remapped
  return pick<AnimRecipe | null>(value, ANIMS as (AnimRecipe | null)[], null);
}

/** Validate a stored `vfx` string against the live vocabulary. */
export function coerceVfx(value: string | undefined): VfxRecipe | null {
  if (value === undefined) return null;
  return pick<VfxRecipe | null>(value, VFX as (VfxRecipe | null)[], null);
}

/** First few words, Title Cased — a decent label with no network at all. */
function localLabel(transcript: string): string {
  const words = transcript.trim().split(/\s+/).slice(0, 4);
  if (words.length === 0) return "Memory";
  const titled = words.map((w) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
  return titled.join(" ").replace(/[.,;:!?]+$/, "");
}

/**
 * The offline / failure route (DESIGN: "never block, never error-wall").
 * Deliberately still animated — a still object is a worse mnemonic than a
 * generically moving one.
 */
export function fallbackRoute(transcript: string): MemoryRoute {
  return {
    label: localLabel(transcript),
    kind: "mesh",
    prompt: "A small charming low-poly magical object representing: " + transcript +
      ". Fantasy crystal aesthetic, clean silhouette, single centered object.",
    animRecipe: "bob",
    vfxRecipe: "sparkle",
    routed: false,
  };
}

/**
 * One LLM call → mnemonic direction. Always resolves (never rejects): callers
 * get a usable route no matter what the network did.
 */
export function routeMemory(transcript: string): Promise<MemoryRoute> {
  const text = transcript.trim();
  if (text.length === 0) return Promise.resolve(fallbackRoute(text));

  const messages: OpenAITypes.ChatCompletions.Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text },
  ];

  return OpenAI.chatCompletions({
    model: MODEL,
    messages: messages,
    temperature: 0.9,        // mnemonics want surprise, not the median answer
  })
    .then((response: OpenAITypes.ChatCompletions.Response) => {
      const content = response && response.choices && response.choices[0]
        ? (response.choices[0].message.content as string) : "";
      const parsed = extractJson(content);
      if (parsed === null) {
        print("MemoryRouter: unparseable reply — local fallback. Raw: " + content);
        return fallbackRoute(text);
      }
      const kind = pick<RouteKind>(parsed.kind, KINDS, "mesh");
      const label = typeof parsed.label === "string" && parsed.label.trim().length > 0
        ? parsed.label.trim() : localLabel(text);
      const prompt = typeof parsed.prompt === "string" && parsed.prompt.trim().length > 0
        ? parsed.prompt.trim() : fallbackRoute(text).prompt;
      const route: MemoryRoute = {
        label: label,
        kind: kind,
        prompt: prompt,
        animRecipe: pick<AnimRecipe>(parsed.animRecipe, ANIMS, "bob"),
        vfxRecipe: pick<VfxRecipe>(parsed.vfxRecipe, VFX, "sparkle"),
        routed: true,
      };
      print("MemoryRouter: \"" + text + "\" → [" + route.label + "] kind=" + route.kind +
        " anim=" + route.animRecipe + " vfx=" + route.vfxRecipe +
        " prompt=\"" + route.prompt + "\"");
      return route;
    })
    .catch((e) => {
      print("MemoryRouter: routing failed (" + e + ") — local fallback");
      return fallbackRoute(text);
    });
}
