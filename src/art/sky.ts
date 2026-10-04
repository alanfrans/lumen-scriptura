import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";

export class Sky {
  private readonly tex: DynamicTexture;

  constructor(scene: Scene, sunDirection: Vector3) {
    const dome = MeshBuilder.CreateSphere(
      "sky",
      { diameter: 1000, segments: 24, sideOrientation: Mesh.BACKSIDE },
      scene,
    );
    const m = new StandardMaterial("sky-mat", scene);
    this.tex = new DynamicTexture("sky-tex", { width: 4, height: 256 }, scene, false);
    m.emissiveTexture = this.tex;
    m.emissiveColor = Color3.Black();
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.fogEnabled = false;
    dome.material = m;
    dome.infiniteDistance = true;
    dome.isPickable = false;

    const sun = MeshBuilder.CreateDisc("sun", { radius: 20, tessellation: 32 }, scene);
    sun.billboardMode = Mesh.BILLBOARDMODE_ALL;
    sun.position = sunDirection.normalizeToNew().scale(-470);
    sun.infiniteDistance = true;
    const sm = new StandardMaterial("sun-mat", scene);
    sm.emissiveColor = new Color3(1, 0.94, 0.78);
    sm.diffuseColor = Color3.Black();
    sm.disableLighting = true;
    sm.fogEnabled = false;
    sun.material = sm;
  }

  /** Sphere UVs run pole to pole, so the gradient is mirrored around the horizon. */
  paint(top: Color3, horizon: Color3): void {
    const ctx = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top.toHexString());
    g.addColorStop(0.42, horizon.toHexString());
    g.addColorStop(0.58, horizon.toHexString());
    g.addColorStop(1, top.toHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    this.tex.update();
  }
}
