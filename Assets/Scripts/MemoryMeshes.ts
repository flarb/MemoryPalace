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

/**
 * Dashed ribbon along a polyline through the palace — the journey path
 * (DESIGN.md "Journeys": ribbon connects loci). Each dash is TWO perpendicular
 * quads so the path reads from any viewing angle without billboarding, and the
 * color runs colorA → colorB along the whole route so direction is legible at
 * a glance: violet where you started, teal where you're headed.
 *
 * Points are consumed in the mesh's LOCAL space — host the object at the origin
 * with identity rotation and pass world positions directly.
 */
export function buildPathDashMesh(
  points: [number, number, number][],
  width: number, dashLen: number, gapLen: number,
  colorA: RGB, colorB: RGB
): RenderMesh | null {
  if (points.length < 2) return null;

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    segLens.push(l);
    total += l;
  }
  if (total < 0.01) return null;

  const verts: number[] = [];
  const indices: number[] = [];
  let vi = 0;
  let walked = 0;
  const step = dashLen + gapLen;
  const half = width / 2;

  const quad = (
    p0: [number, number, number], p1: [number, number, number],
    ax: [number, number, number], c: [number, number, number, number]
  ): void => {
    const o: [number, number, number] = [ax[0] * half, ax[1] * half, ax[2] * half];
    pushVert(verts, [p0[0] - o[0], p0[1] - o[1], p0[2] - o[2]], ax, c);
    pushVert(verts, [p0[0] + o[0], p0[1] + o[1], p0[2] + o[2]], ax, c);
    pushVert(verts, [p1[0] - o[0], p1[1] - o[1], p1[2] - o[2]], ax, c);
    pushVert(verts, [p1[0] + o[0], p1[1] + o[1], p1[2] + o[2]], ax, c);
    indices.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
    vi += 4;
  };

  for (let s = 0; s < segLens.length; s++) {
    const len = segLens[s];
    if (len < 0.01) { walked += len; continue; }
    const a = points[s];
    const b = points[s + 1];
    const d: [number, number, number] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len];

    // Two axes perpendicular to the segment (world-up reference, with a
    // fallback for near-vertical runs between stacked loci).
    let u: [number, number, number] = [-d[2], 0, d[0]];   // d × up
    let ul = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    if (ul < 0.05) {
      u = [d[1], -d[0], 0];   // any perpendicular; nonzero when d is vertical
      ul = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
      if (ul < 1e-4) { walked += len; continue; }
    }
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v: [number, number, number] = [
      d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0],
    ];

    for (let off = 0; off < len; off += step) {
      const end = Math.min(off + dashLen, len);
      if (end - off < dashLen * 0.35) break;   // no orphan stubs at a corner
      const p0: [number, number, number] = [a[0] + d[0] * off, a[1] + d[1] * off, a[2] + d[2] * off];
      const p1: [number, number, number] = [a[0] + d[0] * end, a[1] + d[1] * end, a[2] + d[2] * end];
      const rgb = mix(colorA, colorB, Math.min(1, (walked + off) / total));
      const c: [number, number, number, number] = [rgb[0], rgb[1], rgb[2], 1];
      quad(p0, p1, u, c);
      quad(p0, p1, v, c);
    }
    walked += len;
  }
  if (indices.length === 0) return null;
  return buildMesh(verts, indices);
}

// Shared brand RGB constants for callers.
export const RGB_LIGHT_VIOLET: RGB = [168 / 255, 139 / 255, 255 / 255]; // #a88bff
export const RGB_VIOLET: RGB = [124 / 255, 108 / 255, 240 / 255];       // #7c6cf0
export const RGB_TEAL: RGB = [77 / 255, 214 / 255, 193 / 255];          // #4dd6c1
