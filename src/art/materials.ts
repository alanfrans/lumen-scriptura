import { Color3, Scene, StandardMaterial } from "@babylonjs/core";
import { createTexture, type TexKind, type TexPair } from "./textures";

export type RGB = [number, number, number];

/** How each painted texture should catch the light. Bump is the normal-map strength. */
const FINISH: Record<TexKind, { spec: number; power: number; bump: number }> = {
  sand: { spec: 0.05, power: 18, bump: 0.55 },
  grain: { spec: 0.045, power: 16, bump: 0.5 },
  ashlar: { spec: 0.07, power: 28, bump: 1.05 },
  wood: { spec: 0.055, power: 22, bump: 0.72 },
  cloth: { spec: 0.02, power: 8, bump: 0.42 },
  stripes: { spec: 0.03, power: 12, bump: 0.5 },
  skin: { spec: 0.09, power: 20, bump: 0.28 },
  fur: { spec: 0.025, power: 8, bump: 0.55 },
  metal: { spec: 0.62, power: 52, bump: 0.38 },
  ripple: { spec: 0.55, power: 64, bump: 0.4 },
  leaf: { spec: 0.035, power: 12, bump: 0.65 },
  rock: { spec: 0.055, power: 20, bump: 0.85 },
};

export class Palette {
  private readonly mats = new Map<string, StandardMaterial>();
  private readonly textures = new Map<string, TexPair>();

  constructor(private readonly scene: Scene) {}

  private pair(kind: TexKind, scale: number): TexPair {
    const key = `${kind}:${scale}`;
    let found = this.textures.get(key);
    if (!found) {
      found = createTexture(this.scene, kind);
      found.diffuse.uScale = found.diffuse.vScale = scale;
      found.bump.uScale = found.bump.vScale = scale;
      found.bump.level = FINISH[kind].bump;
      this.textures.set(key, found);
    }
    return found;
  }

  /** Cached by name: the first call for a name decides its look. */
  mat(name: string, rgb: RGB, kind?: TexKind, scale = 1): StandardMaterial {
    const found = this.mats.get(name);
    if (found) return found;
    const m = new StandardMaterial(name, this.scene);
    // Textures average ~80% gray, so lift the tint to keep the intended color.
    const lift = kind ? 1.22 : 1;
    m.diffuseColor = new Color3(Math.min(1, rgb[0] * lift), Math.min(1, rgb[1] * lift), Math.min(1, rgb[2] * lift));
    m.specularColor = new Color3(0.03, 0.03, 0.03);
    if (kind) {
      const maps = this.pair(kind, scale);
      const finish = FINISH[kind];
      m.diffuseTexture = maps.diffuse;
      m.bumpTexture = maps.bump;
      m.specularPower = finish.power;
      if (kind === "metal") {
        m.specularColor = new Color3(
          Math.min(1, rgb[0] * 0.5 + 0.38),
          Math.min(1, rgb[1] * 0.5 + 0.38),
          Math.min(1, rgb[2] * 0.5 + 0.38),
        );
      } else if (kind === "skin") {
        m.specularColor = new Color3(finish.spec, finish.spec * 0.82, finish.spec * 0.7);
        m.emissiveColor = new Color3(rgb[0] * 0.05, rgb[1] * 0.025, rgb[2] * 0.018);
      } else {
        m.specularColor = new Color3(finish.spec, finish.spec, finish.spec);
      }
    }
    this.mats.set(name, m);
    return m;
  }

  glow(name: string, rgb: RGB): StandardMaterial {
    const found = this.mats.get(name);
    if (found) return found;
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = new Color3(...rgb);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    this.mats.set(name, m);
    return m;
  }
}
