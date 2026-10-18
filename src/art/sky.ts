import { Color3, Color4, DynamicTexture, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";
import { planets, siderealTime, skyDirection, starCatalog, starDiameter, type PlanetSpec, type StarSpec } from "./heavens";

export interface SkySample {
  fog: Color3;
  clear: Color4;
  fogDensity: number;
  hemi: number;
  hemiColor: Color3;
  ground: Color3;
  sunIntensity: number;
  sunColor: Color3;
  lightDir: Vector3;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hex = (c: Color3) => c.toHexString();

/**
 * A full day, about three and a half minutes. 0 and 1 are midnight,
 * 0.25 is sunrise, 0.5 is noon, 0.75 is sunset.
 */
export class Sky {
  private readonly dome: Mesh;
  private readonly clouds: Mesh;
  private readonly tex: DynamicTexture;
  private readonly cloudTex: DynamicTexture;
  private readonly sunMesh: Mesh;
  private readonly moonMesh: Mesh;
  private readonly sunMat: StandardMaterial;
  private readonly moonMat: StandardMaterial;
  private readonly cloudMat: StandardMaterial;
  private readonly starMeshes: { mesh: Mesh; spec: StarSpec; base: number }[] = [];
  private readonly planetMeshes: { mesh: Mesh; spec: PlanetSpec }[] = [];
  private readonly scratch = new Vector3();
  private readonly pole = new Vector3();
  private paintedKey = -1;

  constructor(scene: Scene) {
    const dome = MeshBuilder.CreateSphere("sky", { diameter: 1000, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    this.dome = dome;
    const m = new StandardMaterial("sky-mat", scene);
    this.tex = new DynamicTexture("sky-tex", { width: 4, height: 256 }, scene, false);
    this.tex.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    m.emissiveTexture = this.tex;
    m.emissiveColor = Color3.Black();
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.disableDepthWrite = true;
    m.fogEnabled = false;
    dome.material = m;
    dome.infiniteDistance = true;
    dome.isPickable = false;

    this.cloudTex = new DynamicTexture("cloud-tex", { width: 1024, height: 256 }, scene, false);
    this.paintClouds();
    const clouds = MeshBuilder.CreateSphere("sky-clouds", { diameter: 940, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    this.clouds = clouds;
    this.cloudMat = new StandardMaterial("cloud-mat", scene);
    this.cloudMat.emissiveTexture = this.cloudTex;
    this.cloudMat.opacityTexture = this.cloudTex;
    this.cloudMat.emissiveColor = Color3.White();
    this.cloudMat.diffuseColor = Color3.Black();
    this.cloudMat.specularColor = Color3.Black();
    this.cloudMat.disableLighting = true;
    this.cloudMat.disableDepthWrite = true;
    this.cloudMat.fogEnabled = false;
    this.cloudMat.backFaceCulling = false;
    clouds.material = this.cloudMat;
    clouds.infiniteDistance = true;
    clouds.isPickable = false;

    this.sunMesh = MeshBuilder.CreateDisc("sun", { radius: 22, tessellation: 32 }, scene);
    this.sunMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.sunMesh.infiniteDistance = true;
    this.sunMat = new StandardMaterial("sun-mat", scene);
    this.sunMat.emissiveColor = new Color3(1, 0.94, 0.78);
    this.sunMat.diffuseColor = Color3.Black();
    this.sunMat.disableLighting = true;
    this.sunMat.fogEnabled = false;
    this.sunMesh.material = this.sunMat;

    this.moonMesh = MeshBuilder.CreateDisc("moon", { radius: 12, tessellation: 28 }, scene);
    this.moonMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.moonMesh.infiniteDistance = true;
    this.moonMat = new StandardMaterial("moon-mat", scene);
    this.moonMat.emissiveColor = new Color3(0.82, 0.86, 0.95);
    this.moonMat.diffuseColor = Color3.Black();
    this.moonMat.disableLighting = true;
    this.moonMat.fogEnabled = false;
    this.moonMesh.material = this.moonMat;

    const tints = [
      [1, 0.97, 0.93],
      [0.78, 0.88, 1],
      [1, 0.84, 0.62],
      [1, 0.55, 0.42],
    ];
    const starMats = tints.map((rgb, i) => {
      const mat = new StandardMaterial(`star-mat-${i}`, scene);
      mat.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mat.disableDepthWrite = true;
      return mat;
    });
    for (const spec of starCatalog()) {
      const mesh = MeshBuilder.CreateSphere("star", { diameter: 1, segments: 4 }, scene);
      mesh.material = starMats[spec.tint];
      mesh.infiniteDistance = true;
      mesh.isPickable = false;
      const base = starDiameter(spec.mag);
      mesh.scaling.setAll(base);
      this.starMeshes.push({ mesh, spec, base });
    }
    for (const spec of planets()) {
      const mesh = MeshBuilder.CreateSphere(`planet-${spec.name}`, { diameter: spec.diameter, segments: 8 }, scene);
      const mat = new StandardMaterial(`planet-mat-${spec.name}`, scene);
      mat.emissiveColor = new Color3(...spec.color);
      mat.diffuseColor = Color3.Black();
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mat.disableDepthWrite = true;
      mesh.material = mat;
      mesh.infiniteDistance = true;
      mesh.isPickable = false;
      this.planetMeshes.push({ mesh, spec });
    }
  }

  excludeGlow(glow: GlowLayer): void {
    const extras = [this.dome, this.clouds, this.sunMesh, this.moonMesh, ...this.starMeshes.map((s) => s.mesh), ...this.planetMeshes.map((p) => p.mesh)];
    for (const mesh of extras) glow.addExcludedMesh(mesh);
  }

  private paintClouds(): void {
    const ctx = this.cloudTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 1024, 256);
    const puff = (x: number, y: number, rx: number, ry: number, a: number) => {
      const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.55, `rgba(255,252,245,${a * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    const bands = [104, 152];
    for (const y0 of bands) {
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 110;
        puff(x, y0, 78, 18, 0.85);
        puff(x + 28, y0 - 6, 50, 16, 0.6);
        puff(x - 24, y0 + 4, 44, 14, 0.5);
      }
    }
    this.cloudTex.update(false);
    this.cloudTex.hasAlpha = true;
    this.cloudTex.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
  }

  /** Advances the painted sky. `day` is 0–1 around the clock, `hope` is 0–1 verses gathered. */
  update(day: number, hope: number): SkySample {
    const lst = siderealTime(day);
    const sunVec = skyDirection(lst, 0, this.scratch);
    const sunAlt = sunVec.y;
    const night = smooth(0.14, -0.2, sunAlt);
    const golden = (1 - night) * (1 - smooth(0.02, 0.5, Math.max(0, sunAlt)));

    const dayTop = new Color3(0.2, 0.48, 0.95);
    const dayHigh = new Color3(0.38, 0.66, 0.98);
    const dayHor = new Color3(0.72, 0.86, 0.96);
    const goldTop = new Color3(0.42, 0.22, 0.58);
    const goldHigh = new Color3(0.95, 0.38, 0.28);
    const goldHor = new Color3(1, 0.62, 0.22);
    const nightTop = new Color3(0.01, 0.015, 0.07);
    const nightHigh = new Color3(0.04, 0.04, 0.12);
    const nightHor = new Color3(0.12, 0.07, 0.16);

    let top = Color3.Lerp(Color3.Lerp(dayTop, goldTop, golden), nightTop, night);
    let high = Color3.Lerp(Color3.Lerp(dayHigh, goldHigh, golden), nightHigh, night);
    let horizon = Color3.Lerp(Color3.Lerp(dayHor, goldHor, golden), nightHor, night);
    if (hope > 0) {
      const lift = new Color3(0.55, 0.72, 0.95);
      top = Color3.Lerp(top, lift, hope * 0.18 * (1 - night));
      horizon = Color3.Lerp(horizon, new Color3(0.95, 0.86, 0.7), hope * 0.12);
    }

    const ctx = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    const paintKey = Math.round(day * 500) + Math.round(hope * 20) * 1000;
    if (paintKey !== this.paintedKey) {
      this.paintedKey = paintKey;
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, hex(top));
      g.addColorStop(0.3, hex(high));
      g.addColorStop(0.44, hex(horizon));
      g.addColorStop(0.56, hex(horizon));
      g.addColorStop(0.7, hex(high));
      g.addColorStop(1, hex(top));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 256);
      this.tex.update(false);
    }

    const starFade = smooth(0.02, -0.16, sunAlt);
    for (let i = 0; i < this.starMeshes.length; i++) {
      const star = this.starMeshes[i];
      const dir = skyDirection(lst - star.spec.ra, star.spec.dec, this.pole);
      const up = dir.y;
      star.mesh.isVisible = starFade > 0.04 && up > -0.01;
      if (!star.mesh.isVisible) continue;
      const twinkle = 0.82 + 0.18 * Math.sin(day * 48 + i * 1.7);
      star.mesh.scaling.setAll(star.base * starFade * twinkle);
      star.mesh.position.copyFrom(dir).scaleInPlace(520);
    }
    const planetFade = smooth(0.28, -0.02, sunAlt);
    for (const planet of this.planetMeshes) {
      const dir = skyDirection(lst - planet.spec.ra, planet.spec.dec, this.pole);
      planet.mesh.isVisible = planetFade > 0.05 && dir.y > -0.01;
      if (!planet.mesh.isVisible) continue;
      planet.mesh.scaling.setAll(planetFade);
      planet.mesh.position.copyFrom(dir).scaleInPlace(500);
    }
    this.cloudTex.uOffset = day * 0.35;
    this.cloudMat.alpha = 0.15 + (1 - night) * 0.72;
    const cloudTint = Color3.Lerp(new Color3(1, 0.97, 0.92), new Color3(0.96, 0.55, 0.38), golden * (1 - night));
    this.cloudMat.emissiveColor = Color3.Lerp(cloudTint, new Color3(0.35, 0.4, 0.55), night);

    const sunHold = sunVec.clone();
    const sunVis = smooth(-0.04, 0.06, sunAlt);
    this.sunMesh.isVisible = sunVis > 0.04;
    this.sunMesh.position.copyFrom(sunHold).scaleInPlace(470);
    this.sunMesh.scaling.setAll(0.75 + golden * 0.5);
    this.sunMat.emissiveColor = Color3.Lerp(new Color3(1, 0.98, 0.9), new Color3(1, 0.38, 0.08), golden);
    this.sunMat.alpha = sunVis;

    const moonVec = skyDirection(lst - Math.PI, (5 * Math.PI) / 180, this.scratch);
    const moonAlt = moonVec.y;
    const moonVis = smooth(-0.03, 0.08, moonAlt) * (0.35 + 0.65 * night);
    this.moonMesh.isVisible = moonVis > 0.05;
    this.moonMesh.position.copyFrom(moonVec).scaleInPlace(470);
    this.moonMat.alpha = moonVis;

    const lamp = sunAlt > 0.02 ? sunHold : moonAlt > 0 ? moonVec : sunHold;
    const lightDir = lamp.scale(-1);
    const sunColor = Color3.Lerp(new Color3(1, 0.95, 0.82), new Color3(1, 0.5, 0.22), golden);
    return {
      fog: horizon,
      clear: new Color4(horizon.r, horizon.g, horizon.b, 1),
      fogDensity: (0.0035 + night * 0.004) * (1 - hope * 0.45),
      hemi: (0.18 + (1 - night) * 0.42) * (0.8 + hope * 0.25),
      hemiColor: Color3.Lerp(new Color3(0.85, 0.9, 1), new Color3(1, 0.72, 0.5), golden * (1 - night * 0.5)),
      ground: Color3.Lerp(new Color3(0.35, 0.3, 0.24), new Color3(0.12, 0.12, 0.16), night),
      sunIntensity: (sunAlt > 0 ? 0.35 + sunAlt * 1.15 : 0.12) * (0.75 + hope * 0.3),
      sunColor: sunAlt > 0 ? sunColor : new Color3(0.55, 0.62, 0.8),
      lightDir,
    };
  }
}
