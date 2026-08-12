/**
 * MemoryMeshes — procedural MeshBuilder geometry for the sigil swirl and the
 * targeting reticle. Vertex layout (position 3 / normal 3 / color 4) matches
 * SimpleVertexBaseColor's vertexBaseColorMaterial, same as MemoryGemMesh.
 *
 * Colors are STYLE.md violet/teal. Ribbon + ring materials render additively
 * (set at clone time by the caller), so "fade to dark" = fade to transparent.
 */

type RGB = [number, number, number];

function pushVert(verts: number[], p: [number, number, number], n: [number, number, number], c: [number, number, number, number]): void {
  verts.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3]);
}

function buildMesh(verts: number[], indices: number[]): RenderMesh {
  const builder = new MeshBuilder([
    { name: "position", components: 3 },
    { name: "normal", components: 3, normalized: true },
    { name: "color", components: 4 },
  ]);
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  builder.appendVerticesInterleaved(verts);
  builder.appendIndices(indices);
  const mesh = builder.getMesh();
  builder.updateMesh();
  return mesh;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Helical ribbon strip rising and widening around the Y axis.
 * Color runs colorA -> colorB along its length, dimming to near-black at both
 * ends (reads as a fade under additive blending).
 */
export function buildRibbonMesh(
  turns: number, rStart: number, rEnd: number,
  height: number, ribbonWidth: number,
  colorA: RGB, colorB: RGB, segments: number = 64
): RenderMesh {
  const verts: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ang = t * turns * Math.PI * 2;
    const r = rStart + (rEnd - rStart) * t;
    const y = t * height;
    const cx = r * Math.cos(ang);
    const cz = r * Math.sin(ang);
    // Radial-outward normal (flat-ish shading is fine for an additive wisp).
    const n: [number, number, number] = [Math.cos(ang), 0, Math.sin(ang)];

    // End fade: sin envelope dims RGB toward black at t=0 and t=1.
    const envelope = Math.sin(Math.PI * t);
    const rgb = mix(colorA, colorB, t);
    const c: [number, number, number, number] = [
      rgb[0] * envelope, rgb[1] * envelope, rgb[2] * envelope, 1,
    ];

    pushVert(verts, [cx, y - ribbonWidth / 2, cz], n, c);
    pushVert(verts, [cx, y + ribbonWidth / 2, cz], n, c);

    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  return buildMesh(verts, indices);
}

/**
 * Flat dashed ring in the XY plane (normal +Z) — the STYLE.md orbit-ring motif.
 * dashCount dashes, gapRatio of each step left empty.
 */
export function buildDashedRingMesh(
  radius: number, thickness: number,
  dashCount: number, gapRatio: number,
  color: RGB, subSegments: number = 5
): RenderMesh {
  const verts: number[] = [];
  const indices: number[] = [];
  const rIn = radius - thickness / 2;
  const rOut = radius + thickness / 2;
  const step = (Math.PI * 2) / dashCount;
  const dashArc = step * (1 - gapRatio);
  const n: [number, number, number] = [0, 0, 1];
  const c: [number, number, number, number] = [color[0], color[1], color[2], 1];

  let vi = 0;
  for (let d = 0; d < dashCount; d++) {
    const a0 = d * step;
    for (let s = 0; s <= subSegments; s++) {
      const a = a0 + (s / subSegments) * dashArc;
      pushVert(verts, [rIn * Math.cos(a), rIn * Math.sin(a), 0], n, c);
      pushVert(verts, [rOut * Math.cos(a), rOut * Math.sin(a), 0], n, c);
      if (s < subSegments) {
        const b = vi + s * 2;
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    vi += (subSegments + 1) * 2;
  }
  return buildMesh(verts, indices);
}

/**
 * Flat disc fan in the XY plane (normal +Z), colorCenter at the middle dimming
 * to black at the rim — a radial-gradient glow under additive blending
 * (STYLE.md: glows are gradient fades, never blur filters).
 */
export function buildDiscMesh(radius: number, colorCenter: RGB, segments: number = 32): RenderMesh {
  const verts: number[] = [];
  const indices: number[] = [];
  const n: [number, number, number] = [0, 0, 1];
  pushVert(verts, [0, 0, 0], n, [colorCenter[0], colorCenter[1], colorCenter[2], 1]);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pushVert(verts, [radius * Math.cos(a), radius * Math.sin(a), 0], n, [0, 0, 0, 1]);
    if (i < segments) {
      indices.push(0, i + 1, i + 2);
    }
  }
  return buildMesh(verts, indices);
}

// Shared brand RGB constants for callers.
export const RGB_LIGHT_VIOLET: RGB = [168 / 255, 139 / 255, 255 / 255]; // #a88bff
export const RGB_VIOLET: RGB = [124 / 255, 108 / 255, 240 / 255];       // #7c6cf0
export const RGB_TEAL: RGB = [77 / 255, 214 / 255, 193 / 255];          // #4dd6c1
