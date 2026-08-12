/**
 * MemoryGemMesh — procedural faceted memory gem (the app's POI marker).
 *
 * Builds a low-poly kite-cut gem with MeshBuilder:
 *   - octagonal table (top), 2N alternating crown facets, girdle band,
 *     N pavilion facets converging to a culet point.
 *   - Flat shading: every facet gets its own vertices + face normal.
 *   - Brand gradient (#a88bff -> #7c6cf0 -> #4dd6c1, STYLE.md) baked into
 *     per-facet vertex colors, tilted slightly toward +X (the lockup's 45deg),
 *     with a baked key-light term so facets read on an unlit material.
 *   - Winding is guaranteed CCW-from-outside: the gem is convex and contains
 *     the origin, so each face is auto-flipped until dot(normal, centroid) > 0.
 *
 * Origin sits at the girdle center (natural pivot for spin/bob).
 * gemScale = 1 is ~58 cm tall x 48 cm wide; use ~0.12-0.2 for in-app POI use.
 *
 * The geometry builder is exported standalone so GemFactory can spawn gems at
 * runtime (one shared RenderMesh per scale); the @component wrapper remains
 * usable for scene-authored placements.
 */

const SEGMENTS = 8;

// Brand palette (Branding/STYLE.md)
const LIGHT_VIOLET: [number, number, number] = [168 / 255, 139 / 255, 255 / 255]; // #a88bff
const VIOLET: [number, number, number] = [124 / 255, 108 / 255, 240 / 255];       // #7c6cf0
const TEAL: [number, number, number] = [77 / 255, 214 / 255, 193 / 255];          // #4dd6c1

type Vec3 = [number, number, number];

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;
    return [nx, ny, nz];
}

/**
 * Builds the gem geometry and returns a ready RenderMesh.
 * Shared by the @component below and by GemFactory's runtime spawns.
 */
export function buildMemoryGemMesh(gemScale: number): RenderMesh {
    const s = Math.max(0.01, gemScale);
    const R = 24 * s;             // girdle radius
    const tableR = 0.55 * R;      // table (top face) radius
    const crownH = 0.75 * R;      // girdle top -> table
    const girdleH = 0.25 * R;     // vertical girdle band
    const pavilionH = 1.4 * R;    // girdle bottom -> culet point

    const yGirdleTop = girdleH / 2;
    const yGirdleBot = -girdleH / 2;
    const yTable = yGirdleTop + crownH;
    const yCulet = yGirdleBot - pavilionH;

    const verts: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    const facetColor = (centroid: Vec3, normal: Vec3): [number, number, number, number] => {
        const tY = (yTable - centroid[1]) / (yTable - yCulet); // 0 table, 1 culet
        const xN = (centroid[0] / R + 1) / 2;                  // 0 -X side, 1 +X side
        const t = Math.min(1, Math.max(0, 0.8 * tY + 0.2 * xN));

        let rgb: [number, number, number];
        if (t < 0.5) {
            rgb = lerp3(LIGHT_VIOLET, VIOLET, t / 0.5);
        } else {
            rgb = lerp3(VIOLET, TEAL, (t - 0.5) / 0.5);
        }

        // Baked key light from upper right-front (unlit material => shade in colors).
        const lx = 0.4, ly = 0.85, lz = 0.3;
        const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
        const nDotL = Math.max(0, (normal[0] * lx + normal[1] * ly + normal[2] * lz) / lLen);
        const shade = 0.78 + 0.34 * nDotL;

        return [
            Math.min(1, rgb[0] * shade),
            Math.min(1, rgb[1] * shade),
            Math.min(1, rgb[2] * shade),
            1,
        ];
    };

    const emitFace = (points: Vec3[]): void => {
        const centroid: Vec3 = [0, 0, 0];
        for (const p of points) {
            centroid[0] += p[0];
            centroid[1] += p[1];
            centroid[2] += p[2];
        }
        centroid[0] /= points.length;
        centroid[1] /= points.length;
        centroid[2] /= points.length;

        let n = faceNormal(points[0], points[1], points[2]);
        if (n[0] * centroid[0] + n[1] * centroid[1] + n[2] * centroid[2] < 0) {
            points = points.slice().reverse();
            n = faceNormal(points[0], points[1], points[2]);
        }

        const color = facetColor(centroid, n);

        const base = vertexIndex;
        for (const p of points) {
            verts.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], color[3]);
        }
        // Convex planar fan: (0,1,2) [+ (0,2,3) for quads] keeps the checked winding.
        for (let k = 1; k < points.length - 1; k++) {
            indices.push(base, base + k, base + k + 1);
        }
        vertexIndex += points.length;
    };

    const N = SEGMENTS;
    const halfStep = Math.PI / N; // table ring rotated half a segment (kite cut)

    const ring = (radius: number, y: number, angleOffset: number): Vec3[] => {
        const pts: Vec3[] = [];
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2 + angleOffset;
            pts.push([radius * Math.cos(a), y, radius * Math.sin(a)]);
        }
        return pts;
    };

    const tableRing = ring(tableR, yTable, halfStep);
    const girdleTop = ring(R, yGirdleTop, 0);
    const girdleBot = ring(R, yGirdleBot, 0);
    const tableCenter: Vec3 = [0, yTable, 0];
    const culet: Vec3 = [0, yCulet, 0];

    for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;

        // Table: fan of N coplanar triangles (one flat +Y face).
        emitFace([tableCenter, tableRing[i], tableRing[j]]);

        // Crown, "up" facet: girdle edge i -> table vertex above its midpoint.
        emitFace([girdleTop[i], girdleTop[j], tableRing[i]]);

        // Crown, "down" facet: table edge i -> girdle vertex below its midpoint.
        emitFace([tableRing[i], tableRing[j], girdleTop[j]]);

        // Girdle band: planar trapezoid quad.
        emitFace([girdleTop[i], girdleTop[j], girdleBot[j], girdleBot[i]]);

        // Pavilion: long facet from girdle edge to the culet point.
        emitFace([girdleBot[i], girdleBot[j], culet]);
    }

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

@component
export class MemoryGemMesh extends BaseScriptComponent {
    /** Vertex-color material (SimpleVertexBaseColor / vertexBaseColorMaterial). */
    @input
    material: Material;

    /** Uniform scale multiplier. 1.0 = ~58 cm tall (demo scale). */
    @input
    gemScale: number = 1.0;

    /** Slow spin + gentle bob per STYLE.md motion doctrine. */
    @input
    idleMotion: boolean = true;

    private elapsed = 0;
    private baseY = 0;

    onAwake(): void {
        const rmv = this.sceneObject.createComponent(
            "Component.RenderMeshVisual"
        ) as RenderMeshVisual;
        rmv.mesh = buildMemoryGemMesh(this.gemScale);
        if (this.material) {
            rmv.mainMaterial = this.material;
        } else {
            print("MemoryGemMesh: no material assigned - gem will not render with brand colors.");
        }

        if (this.idleMotion) {
            this.baseY = this.getTransform().getLocalPosition().y;
            this.createEvent("UpdateEvent").bind(() => this.onUpdate());
        }
    }

    private onUpdate(): void {
        this.elapsed += getDeltaTime();

        // Slow spin: ~24s per revolution.
        const spinAngle = (this.elapsed * (Math.PI * 2)) / 24;
        const t = this.getTransform();
        t.setLocalRotation(quat.angleAxis(spinAngle, vec3.up()));

        // Gentle bob: +/- 2 cm (scaled), 4 s period, sine.
        const bob = Math.sin((this.elapsed * Math.PI * 2) / 4) * 2 * this.gemScale;
        const p = t.getLocalPosition();
        t.setLocalPosition(new vec3(p.x, this.baseY + bob, p.z));
    }
}
