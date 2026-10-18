import { Color3, Constants, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";

interface VerseLight {
  tablet: Mesh;
  column: Mesh;
  base: Mesh;
  baseY: number;
  groundY: number;
  phase: number;
  /** Some verses simply burn hotter than others. */
  innate: number;
  /** 0 closed, 1 streaming into the sky. */
  open: number;
  wide: boolean;
}

const COLUMN_H = 90;
/** About five feet. Inside this, the column opens. */
const STREAM = 1.52;
/** Local glow strengthens across this distance. */
const GLOW = 24;

function innateOf(verse: number): number {
  return 0.62 + ((verse * 47) % 11) * 0.065;
}

/** The skyward light columns. No other object in the game may use this look. */
export class VerseLights {
  private readonly lights = new Map<number, VerseLight>();
  private readonly residues: Mesh[] = [];
  private readonly tabletMat: StandardMaterial;
  private readonly columnMat: StandardMaterial;
  private readonly pillarMat: StandardMaterial;
  private readonly baseMat: StandardMaterial;
  private readonly residueMat: StandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly glow: GlowLayer,
  ) {
    this.tabletMat = this.emissive("verse-tablet", new Color3(1, 0.86, 0.5), 1, false);
    this.columnMat = this.emissive("verse-column", new Color3(1, 0.8, 0.42), 0.24, true);
    this.pillarMat = this.emissive("verse-pillar", new Color3(1, 0.93, 0.72), 0.45, true);
    this.baseMat = this.emissive("verse-base", new Color3(1, 0.78, 0.4), 0.5, true);
    this.residueMat = this.emissive("verse-residue", new Color3(0.9, 0.75, 0.45), 0.12, true);
  }

  private emissive(name: string, color: Color3, alpha: number, additive: boolean): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = color;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.alpha = alpha;
    if (additive) {
      m.alphaMode = Constants.ALPHA_ADD;
      m.backFaceCulling = false;
      m.fogEnabled = false;
    }
    return m;
  }

  add(verse: number, x: number, y: number, z: number): void {
    const tablet = MeshBuilder.CreateBox(`verse-${verse}`, { width: 0.8, height: 1.1, depth: 0.12 }, this.scene);
    const baseY = y + 1.1;
    tablet.position.set(x, baseY, z);
    tablet.material = this.tabletMat;

    const column = MeshBuilder.CreateCylinder(
      `verse-${verse}-column`,
      { height: 90, diameterTop: 0.5, diameterBottom: 1.5, tessellation: 18 },
      this.scene,
    );
    column.position.set(x, y, z);
    column.scaling.y = 0.001;
    column.material = this.columnMat;
    column.isPickable = false;
    column.isVisible = false;
    this.glow.addExcludedMesh(column);

    const base = MeshBuilder.CreateDisc(`verse-${verse}-base`, { radius: 1.4, tessellation: 32 }, this.scene);
    base.rotation.x = Math.PI / 2;
    base.position.set(x, y + 0.03, z);
    base.material = this.baseMat;
    this.glow.addExcludedMesh(base);

    this.lights.set(verse, {
      tablet,
      column,
      base,
      baseY,
      groundY: y,
      phase: verse * 0.7,
      innate: innateOf(verse),
      open: 0,
      wide: false,
    });
  }

  /** Last verse in a chapter becomes a wider, brighter pillar once it opens. */
  emphasize(verse: number): void {
    const l = this.lights.get(verse);
    if (!l) return;
    l.wide = true;
    l.column.material = this.pillarMat;
  }

  remove(verse: number): void {
    const l = this.lights.get(verse);
    if (!l) return;
    l.tablet.dispose();
    l.column.dispose();
    l.base.dispose();
    this.lights.delete(verse);
  }

  addResidue(x: number, z: number): void {
    const r = MeshBuilder.CreateDisc("verse-residue", { radius: 0.9, tessellation: 24 }, this.scene);
    r.rotation.x = Math.PI / 2;
    r.position.set(x, 0.02, z);
    r.material = this.residueMat;
    this.glow.addExcludedMesh(r);
    this.residues.push(r);
  }

  /** Remove every tablet, column, and residue so a place can be built again. */
  clear(): void {
    for (const verse of [...this.lights.keys()]) this.remove(verse);
    for (const residue of this.residues) residue.dispose();
    this.residues.length = 0;
  }

  /**
   * Tablets glow harder as any person draws near. Within about five feet
   * the column opens and streams upward. Brighter verses stay brighter.
   */
  update(
    t: number,
    dt: number,
    people: readonly { x: number; z: number }[],
    shut?: ReadonlySet<number>,
  ): void {
    for (const [verse, l] of this.lights) {
      l.tablet.position.y = l.baseY + Math.sin(t * 1.6 + l.phase) * 0.15;
      l.tablet.rotation.y = t * 0.7 + l.phase;

      let nearest = GLOW;
      const tx = l.tablet.position.x;
      const tz = l.tablet.position.z;
      if (shut?.has(verse)) {
        nearest = GLOW;
      } else {
        for (const p of people) {
          const d = Math.hypot(p.x - tx, p.z - tz);
          if (d < nearest) nearest = d;
        }
      }
      const closeness = nearest >= GLOW ? 0 : 1 - nearest / GLOW;
      const eased = closeness * closeness;
      const shine = l.innate * (0.38 + 1.25 * eased);
      l.tablet.visibility = shine;
      l.base.visibility = l.innate * (0.12 + 0.9 * eased);

      const want = nearest <= STREAM ? 1 : 0;
      l.open += (want - l.open) * Math.min(1, dt * 8);
      const open = l.open;
      l.column.isVisible = open > 0.03;
      l.column.scaling.x = l.column.scaling.z = l.wide ? 2.2 : 1;
      l.column.scaling.y = Math.max(0.001, open);
      l.column.position.y = l.groundY + (COLUMN_H * open) / 2;
      l.column.visibility = l.innate * (0.45 + 0.55 * open);
    }
  }
}
