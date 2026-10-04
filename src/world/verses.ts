import { Color3, Constants, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";

interface VerseLight {
  tablet: Mesh;
  column: Mesh;
  base: Mesh;
  baseY: number;
  phase: number;
}

/** The skyward light columns. No other object in the game may use this look. */
export class VerseLights {
  private readonly lights = new Map<number, VerseLight>();
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
    column.position.set(x, y + 45, z);
    column.material = this.columnMat;
    column.isPickable = false;
    this.glow.addExcludedMesh(column);

    const base = MeshBuilder.CreateDisc(`verse-${verse}-base`, { radius: 1.4, tessellation: 32 }, this.scene);
    base.rotation.x = Math.PI / 2;
    base.position.set(x, y + 0.03, z);
    base.material = this.baseMat;
    this.glow.addExcludedMesh(base);

    this.lights.set(verse, { tablet, column, base, baseY, phase: verse * 0.7 });
  }

  /** Last verse in a chapter becomes a wider, brighter pillar. */
  emphasize(verse: number): void {
    const l = this.lights.get(verse);
    if (!l) return;
    l.column.scaling.set(2.6, 1, 2.6);
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
  }

  update(t: number): void {
    for (const l of this.lights.values()) {
      l.tablet.position.y = l.baseY + Math.sin(t * 1.6 + l.phase) * 0.15;
      l.tablet.rotation.y = t * 0.7 + l.phase;
    }
    this.columnMat.alpha = 0.21 + 0.05 * Math.sin(t * 2.2);
  }
}
