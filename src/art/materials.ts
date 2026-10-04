import { Color3, Scene, StandardMaterial, Texture } from "@babylonjs/core";
import { textureFactory, type TexKind } from "./textures";

export type RGB = [number, number, number];

export class Palette {
  private readonly mats = new Map<string, StandardMaterial>();
  private readonly textures = new Map<string, Texture>();
  private readonly paint: (kind: TexKind) => Texture;

  constructor(private readonly scene: Scene) {
    this.paint = textureFactory(scene);
  }

  private texture(kind: TexKind, scale: number): Texture {
    const key = `${kind}:${scale}`;
    let t = this.textures.get(key);
    if (!t) {
      t = this.paint(kind);
      t.uScale = t.vScale = scale;
      this.textures.set(key, t);
    }
    return t;
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
    if (kind) m.diffuseTexture = this.texture(kind, scale);
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
