/**
 * Gaussian-splat grove for `?splats=1`.
 *
 * The game is Babylon.js, so PlayCanvas would be a second engine and could not
 * keep the lake, rivers, and terrain. Spark renders on its own WebGL context:
 * sharing Babylon's context drops the splat draw (the sort's integer textures
 * never produce fragments there). Each frame the splat color is copied onto the
 * game canvas. Occlusion uses the hidden collision mesh's depth, tested against
 * the depth Babylon already wrote for the ground, water, and character. The
 * film post-process stays off so that depth is still the scene depth.
 *
 * Tiles are separate chunked .RAD files. Spark streams each one with `paged:
 * true` and coarsens it by distance (`lodScale`, `lodRenderScale`). Tiles
 * outside the streaming radii are removed, collider included.
 *
 * The character is the existing person. Rapier's kinematic controller walks
 * them with WASD, jump, and the orbit camera already in the game.
 */
import {
  type ArcRotateCamera,
  type Engine,
  Mesh,
  type Scene,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import RAPIER from "@dimforge/rapier3d-compat";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import * as THREE from "three";
import { PLACE_EDEN } from "../data/era";
import type { World } from "../world/world";
import { splatColliderDebug } from "./flag";
import { readGlbMesh } from "./glb";
import { GROVE, type GroveTile } from "./grove-manifest";

const RADIUS = 0.32;
const HALF = 0.46;
const FEET = HALF + RADIUS;
const WALK = 7;
const SPRINT = 11;
const JUMP = 6.4;
const GRAVITY = -18;
const BOUNDS = 145;

export interface SplatHost {
  canvas: HTMLCanvasElement;
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  player: Mesh;
  getWorld: () => World;
  placeId: () => string;
}

export interface SplatStats {
  tileSize: number;
  tilesResident: number;
  tilesTotal: number;
  splatsResident: number;
  splatsRendered: number;
  fps: number;
  frameMs: number;
  heapMb: number | null;
  colliderTris: number;
}

interface ResidentTile {
  tile: GroveTile;
  mesh: SplatMesh;
  body: RAPIER.RigidBody | null;
  debug: THREE.Mesh | null;
  depth: THREE.Mesh | null;
}

export class SplatPrototype {
  ready = false;
  /** Reserved so the render loop can skip a frame if a future sort has to stall. */
  busy = false;
  readonly stats: SplatStats = {
    tileSize: GROVE.tileSize,
    tilesResident: 0,
    tilesTotal: GROVE.tiles.length,
    splatsResident: 0,
    splatsRendered: 0,
    fps: 0,
    frameMs: 0,
    heapMb: null,
    colliderTris: 0,
  };

  private readonly threeScene = new THREE.Scene();
  private readonly debugScene = new THREE.Scene();
  private readonly depthScene = new THREE.Scene();
  private readonly depthMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  private readonly threeCamera = new THREE.PerspectiveCamera(60, 1, 0.05, 1200);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly spark: SparkRenderer;
  private readonly suppressCanvasResize: (fn: () => void) => void;
  private world: RAPIER.World | null = null;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;
  private readonly staticBodies: RAPIER.RigidBody[] = [];
  private readonly tiles = new Map<string, ResidentTile>();
  private readonly loading = new Set<string>();
  private treeMesh: { positions: Float32Array; indices: Uint32Array } | null = null;
  private treeGeometry: THREE.BufferGeometry | null = null;
  private debugOn = splatColliderDebug();
  private vertical = 0;
  private frameMs = 16;
  private readonly hud: HTMLElement;
  private shown = false;
  private frameOpen = false;

  private constructor(private readonly host: SplatHost, renderer: THREE.WebGLRenderer, suppress: <T>(fn: () => T) => T) {
    this.renderer = renderer;
    this.suppressCanvasResize = suppress;
    this.spark = suppress(() => new SparkRenderer({
      renderer,
      depthTest: true,
      depthWrite: false,
      // The default pre-update binds the sort accumulator before the splats are
      // drawn, so they miss the canvas. WebXR sets this false for the same reason.
      preUpdate: false,
      transparent: true,
      sortRadial: true,
      // Coarsen splats once they are under about 1.5 pixels. Tile residency is
      // what actually frees memory; the page budget stays a few tiles wide.
      lodRenderScale: 1.5,
      maxPagedSplats: 65536 * 4,
    }));
    this.threeScene.add(this.spark);
    this.threeCamera.matrixAutoUpdate = true;
    this.hud = document.createElement("div");
    this.hud.id = "splat-stats";
    document.getElementById("hud")?.appendChild(this.hud);
    this.resize();
  }

  static async mount(host: SplatHost): Promise<SplatPrototype> {
    // Spark's sort reads an integer texture. On the context Babylon already
    // created, that draw produces no fragments. A private context renders the
    // splats, and the color is copied onto the game canvas afterwards.
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    const prototype = new SplatPrototype(host, renderer, (fn) => fn());
    await prototype.start();
    return prototype;
  }

  resize(): void {
    this.suppressCanvasResize(() => {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.host.canvas.width, this.host.canvas.height, false);
    });
  }

  onPlace(id: string): void {
    if (!this.world) return;
    if (id !== PLACE_EDEN) {
      for (const tileId of [...this.tiles.keys()]) this.unload(tileId);
      return;
    }
    this.rebuildStatic();
    this.snapToPlayer();
    this.markWaterDepth();
  }

  toggleDebug(): void {
    this.debugOn = !this.debugOn;
    for (const resident of this.tiles.values()) this.syncDebug(resident);
  }

  /** Horizontal speed, for the walk cycle. */
  update(dt: number, keys: ReadonlySet<string>, paused: boolean): number {
    this.frameMs = this.frameMs * 0.9 + dt * 1000 * 0.1;
    if (!this.ready || !this.body || !this.collider || !this.controller || !this.world || paused) {
      this.publish();
      return 0;
    }
    const camera = this.host.camera;
    const turn = 1.8 * dt;
    if (keys.has("ArrowLeft")) camera.alpha += turn;
    if (keys.has("ArrowRight")) camera.alpha -= turn;
    const looking = keys.has("ControlLeft") || keys.has("ControlRight");
    let ix = 0;
    let iz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
    if (keys.has("KeyD")) ix += 1;
    if (keys.has("KeyA")) ix -= 1;
    if (looking && (ix || iz)) {
      camera.alpha -= ix * turn;
      const beta = camera.beta - iz * turn * 0.7;
      camera.beta = Math.min(camera.upperBetaLimit ?? beta, Math.max(camera.lowerBetaLimit ?? beta, beta));
      this.publish();
      return 0;
    }

    const forwardX = -Math.cos(camera.alpha);
    const forwardZ = -Math.sin(camera.alpha);
    let dirX = 0;
    let dirZ = 0;
    if (ix || iz) {
      const rightX = forwardZ;
      const rightZ = -forwardX;
      dirX = forwardX * iz + rightX * ix;
      dirZ = forwardZ * iz + rightZ * ix;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
    }
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? SPRINT : WALK;
    const grounded = this.controller.computedGrounded();
    if (grounded && this.vertical <= 0) this.vertical = 0;
    if (grounded && keys.has("Space")) this.vertical = JUMP;
    else this.vertical += GRAVITY * dt;
    if (this.vertical > 0) this.controller.disableSnapToGround();
    else this.controller.enableSnapToGround(0.4);

    this.controller.computeColliderMovement(this.collider, {
      x: dirX * speed * dt,
      y: this.vertical * dt,
      z: dirZ * speed * dt,
    });
    const motion = this.controller.computedMovement();
    const at = this.body.translation();
    let x = Math.max(-BOUNDS, Math.min(BOUNDS, at.x + motion.x));
    const y = at.y + motion.y;
    let z = Math.max(-BOUNDS, Math.min(BOUNDS, at.z + motion.z));
    if (y < -8) {
      x = GROVE.spawn.x;
      z = GROVE.spawn.z;
      this.vertical = 0;
      this.body.setNextKinematicTranslation({ x, y: FEET + 0.2, z });
    } else {
      this.body.setNextKinematicTranslation({ x, y, z });
    }
    this.world.step();
    const next = this.body.translation();
    const player = this.host.player;
    player.position.set(next.x, next.y - FEET, next.z);
    if (dirX || dirZ) {
      const face = Math.atan2(dirX, dirZ);
      let delta = face - player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      player.rotation.y += Math.max(-dt * 12, Math.min(dt * 12, delta));
    }
    this.stream(next.x, next.z);
    this.publish();
    return Math.hypot(motion.x, motion.z) / Math.max(dt, 1e-4);
  }

  composite(): void {
    if (!this.shown || this.frameOpen) return;
    this.syncCamera();
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = true;
    this.renderer.render(this.threeScene, this.threeCamera);
    if (this.debugOn && this.debugScene.children.length) {
      this.renderer.autoClear = false;
      this.renderer.render(this.debugScene, this.threeCamera);
    }
    this.renderOcclusion();
    this.blit();
    let selected = 0;
    for (const info of this.spark.lodInstances.values()) selected += info.numSplats;
    for (const resident of this.tiles.values()) selected += resident.mesh.paged?.numSplats ?? 0;
    this.stats.splatsRendered = this.spark.activeSplats || selected;
  }

  /**
   * Draw the hidden tree meshes into a depth texture and read it back. The
   * overlay writes that depth with gl_FragDepth so the canopy hides the
   * character, and the ground hides the canopy, without sharing a context.
   */
  private renderOcclusion(): void {
    const width = this.host.canvas.width;
    const height = this.host.canvas.height;
    if (width < 2 || height < 2 || !this.depthScene.children.length) {
      this.depthBuf = null;
      return;
    }
    this.ensureOcclusion(width, height);
    const depthRT = this.depthRT;
    const packRT = this.packRT;
    const packScene = this.packScene;
    const packCam = this.packCam;
    const depthBuf = this.depthBuf;
    if (!depthRT || !packRT || !packScene || !packCam || !depthBuf) return;
    this.renderer.setRenderTarget(depthRT);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.renderer.render(this.depthScene, this.threeCamera);
    this.renderer.setRenderTarget(packRT);
    this.renderer.render(packScene, packCam);
    this.renderer.readRenderTargetPixels(packRT, 0, 0, width, height, depthBuf);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
  }

  private depthRT: THREE.WebGLRenderTarget | null = null;
  private packRT: THREE.WebGLRenderTarget | null = null;
  private packScene: THREE.Scene | null = null;
  private packCam: THREE.OrthographicCamera | null = null;
  private depthBuf: Uint8Array | null = null;

  private ensureOcclusion(width: number, height: number): void {
    if (this.depthRT && this.depthRT.width === width && this.depthRT.height === height) return;
    this.depthRT?.dispose();
    this.packRT?.dispose();
    const depthTexture = new THREE.DepthTexture(width, height);
    this.depthRT = new THREE.WebGLRenderTarget(width, height, { depthTexture, depthBuffer: true, stencilBuffer: false });
    this.packRT = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.packRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.depthBuf = new Uint8Array(width * height * 4);
    if (!this.packScene) {
      const material = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: depthTexture } },
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: [
          "precision highp float;",
          "uniform sampler2D tDepth;",
          "varying vec2 vUv;",
          "void main(){",
          "  float x = clamp(texture2D(tDepth, vUv).r, 0.0, 1.0) * 16777215.0;",
          "  float hi = floor(x / 65536.0);",
          "  float mid = floor(mod(x, 65536.0) / 256.0);",
          "  float lo = floor(mod(x, 256.0));",
          "  gl_FragColor = vec4(hi, mid, lo, 255.0) / 255.0;",
          "}",
        ].join("\n"),
      });
      this.packMat = material;
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
      this.packScene = scene;
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      cam.position.z = 1;
      this.packCam = cam;
    }
    if (this.packMat) this.packMat.uniforms.tDepth.value = depthTexture;
  }

  private packMat: THREE.ShaderMaterial | null = null;

  /** Copy the splat color onto the game canvas. Empty pixels stay transparent. */
  private blit(): void {
    const gl = (this.host.engine as unknown as { _gl: WebGL2RenderingContext })._gl;
    const source = this.renderer.domElement;
    const tex = this.blitTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const depthTex = this.depthTexture(gl);
    const depth = this.depthBuf;
    if (depth && this.depthRT) {
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.depthRT.width, this.depthRT.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, depth);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    }
    const program = this.blitProgram(gl);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.blitBuffer(gl));
    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(program, "splat"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.uniform1i(gl.getUniformLocation(program, "depthMap"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "useDepth"), depth && this.depthRT ? 1 : 0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, this.host.canvas.width, this.host.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.host.engine.wipeCaches(true);
  }

  private blitTex: WebGLTexture | null = null;
  private depthTex: WebGLTexture | null = null;
  private blitProg: WebGLProgram | null = null;
  private blitBuf: WebGLBuffer | null = null;

  private depthTexture(gl: WebGL2RenderingContext): WebGLTexture {
    if (this.depthTex) return this.depthTex;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Could not allocate the splat depth");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.depthTex = tex;
    return tex;
  }

  private blitTexture(gl: WebGL2RenderingContext): WebGLTexture {
    if (this.blitTex) return this.blitTex;
    const tex = gl.createTexture();
    if (!tex) throw new Error("Could not allocate the splat overlay");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.blitTex = tex;
    return tex;
  }

  private blitBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
    if (this.blitBuf) return this.blitBuf;
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Could not allocate the splat overlay");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.blitBuf = buffer;
    return buffer;
  }

  private blitProgram(gl: WebGL2RenderingContext): WebGLProgram {
    if (this.blitProg) return this.blitProg;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Could not compile the splat overlay");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error("Could not link the splat overlay");
    gl.attachShader(
      program,
      compile(gl.VERTEX_SHADER, "#version 300 es\nin vec2 position; out vec2 uv; void main(){ uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }"),
    );
    gl.attachShader(
      program,
      compile(
        gl.FRAGMENT_SHADER,
        [
          "#version 300 es",
          "precision highp float;",
          "uniform sampler2D splat;",
          "uniform sampler2D depthMap;",
          "uniform int useDepth;",
          "in vec2 uv;",
          "out vec4 outColor;",
          "void main(){",
          "  vec2 p = vec2(uv.x, 1.0 - uv.y);",
          "  vec4 c = texture(splat, p);",
          "  if (c.a < 0.02) discard;",
          "  if (useDepth == 1) {",
          "    vec3 bits = texture(depthMap, p).rgb * 255.0;",
          "    float d = (bits.r * 65536.0 + bits.g * 256.0 + bits.b) / 16777215.0;",
          // Empty canopy depth is the far plane. Those fringe pixels stay in front
          // of the color, which is the same as having no depth for that texel.
          "    gl_FragDepth = d > 0.999 ? 0.0 : d;",
          "  }",
          "  outColor = c;",
          "}",
        ].join("\n"),
      ),
    );
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(program));
    this.blitProg = program;
    return program;
  }

  private async start(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
    this.controller = this.world.createCharacterController(0.03);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.35, 0.2, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.rebuildStatic();
    this.markWaterDepth();
    const player = this.host.player.position;
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(player.x, player.y + FEET + 0.05, player.z),
    );
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), this.body);
    try {
      const response = await fetch("/splats/tree.collision.glb");
      if (response.ok) {
        this.treeMesh = readGlbMesh(await response.arrayBuffer());
        this.stats.colliderTris = this.treeMesh.indices.length / 3;
        this.treeGeometry = new THREE.BufferGeometry();
        this.treeGeometry.setAttribute("position", new THREE.BufferAttribute(this.treeMesh.positions.slice(), 3));
        this.treeGeometry.setIndex(new THREE.BufferAttribute(this.treeMesh.indices.slice(), 1));
      }
    } catch (error) {
      console.error("Splat collider failed to load", error);
    }
    this.ready = true;
    this.snapToPlayer();
    const at = this.host.player.position;
    if (this.host.placeId() === PLACE_EDEN) this.stream(at.x, at.z);
    else this.onPlace(this.host.placeId());
  }

  private snapToPlayer(): void {
    if (!this.body) return;
    const player = this.host.player.position;
    this.vertical = 0;
    this.body.setNextKinematicTranslation({ x: player.x, y: player.y + FEET + 0.05, z: player.z });
    this.world?.step();
  }

  private rebuildStatic(): void {
    const world = this.world;
    if (!world) return;
    for (const body of this.staticBodies) world.removeRigidBody(body);
    this.staticBodies.length = 0;
    const flags = RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES | RAPIER.TriMeshFlags.DELETE_BAD_TOPOLOGY_TRIANGLES;
    for (const mesh of this.host.scene.meshes) {
      if (!(mesh instanceof Mesh) || mesh.isDisposed() || !isWalkMesh(mesh.name)) continue;
      const shape = meshTriangles(mesh);
      if (!shape) continue;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(RAPIER.ColliderDesc.trimesh(shape.positions, shape.indices, flags), body);
      this.staticBodies.push(body);
    }
    for (const box of this.host.getWorld().colliders) {
      if (!box.solid) continue;
      const hx = (box.maxX - box.minX) / 2;
      const hz = (box.maxZ - box.minZ) / 2;
      if (hx < 0.02 || hz < 0.02) continue;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation((box.minX + box.maxX) / 2, 1.6, (box.minZ + box.maxZ) / 2),
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 2.2, hz), body);
      this.staticBodies.push(body);
    }
  }

  private markWaterDepth(): void {
    for (const mesh of this.host.scene.meshes) {
      const material = mesh.material;
      if (!material || Array.isArray(material) || !mesh.name.startsWith("water")) continue;
      material.forceDepthWrite = true;
    }
  }

  private stream(x: number, z: number): void {
    for (const tile of GROVE.tiles) {
      const distance = Math.hypot(tile.x - x, tile.z - z);
      const resident = this.tiles.get(tile.id);
      if (!resident && distance <= GROVE.loadRadius && !this.loading.has(tile.id)) {
        void this.load(tile);
      } else if (resident && distance >= GROVE.unloadRadius) {
        this.unload(tile.id);
      } else if (resident) {
        const t = Math.min(1, Math.max(0, (distance - 6) / Math.max(1, GROVE.loadRadius - 6)));
        resident.mesh.lodScale = 1 - t * 0.6;
      }
    }
  }

  private async load(tile: GroveTile): Promise<void> {
    this.loading.add(tile.id);
    const paged = GROVE.paged || tile.url.endsWith(".rad");
    const mesh = new SplatMesh(paged ? { url: tile.url, paged: true } : { url: tile.url, lod: true });
    mesh.position.set(tile.x, 0, tile.z);
    mesh.frustumCulled = false;
    this.threeScene.add(mesh);
    try {
      await mesh.initialized;
    } catch (error) {
      console.error(`Splat tile ${tile.id} failed`, error);
      mesh.dispose();
      this.threeScene.remove(mesh);
      this.loading.delete(tile.id);
      return;
    }
    this.loading.delete(tile.id);
    const player = this.host.player.position;
    if (Math.hypot(tile.x - player.x, tile.z - player.z) >= GROVE.unloadRadius) {
      mesh.dispose();
      this.threeScene.remove(mesh);
      return;
    }
    const resident: ResidentTile = { tile, mesh, body: this.treeBody(tile), debug: null, depth: this.depthMesh(tile) };
    this.tiles.set(tile.id, resident);
    this.syncDebug(resident);
    this.shown = true;
  }

  private unload(id: string): void {
    const resident = this.tiles.get(id);
    if (!resident) return;
    resident.mesh.dispose();
    this.threeScene.remove(resident.mesh);
    if (resident.body && this.world) this.world.removeRigidBody(resident.body);
    if (resident.debug) {
      this.debugScene.remove(resident.debug);
      const material = resident.debug.material;
      if (material instanceof THREE.Material) material.dispose();
    }
    if (resident.depth) this.depthScene.remove(resident.depth);
    this.tiles.delete(id);
    if (!this.tiles.size) this.shown = false;
  }

  private treeBody(tile: GroveTile): RAPIER.RigidBody | null {
    if (!this.world || !this.treeMesh) return null;
    const yaw = tile.yaw / 2;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(tile.x, 0, tile.z).setRotation({
        x: 0,
        y: Math.sin(yaw),
        z: 0,
        w: Math.cos(yaw),
      }),
    );
    const flags = RAPIER.TriMeshFlags.MERGE_DUPLICATE_VERTICES | RAPIER.TriMeshFlags.DELETE_BAD_TOPOLOGY_TRIANGLES;
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(this.treeMesh.positions.slice(), this.treeMesh.indices.slice(), flags),
      body,
    );
    return body;
  }

  private depthMesh(tile: GroveTile): THREE.Mesh | null {
    if (!this.treeGeometry) return null;
    const mesh = new THREE.Mesh(this.treeGeometry, this.depthMaterial);
    mesh.position.set(tile.x, 0, tile.z);
    mesh.rotation.y = tile.yaw;
    mesh.frustumCulled = false;
    this.depthScene.add(mesh);
    return mesh;
  }

  private syncDebug(resident: ResidentTile): void {
    if (!this.debugOn || !this.treeGeometry) {
      if (resident.debug) {
        this.debugScene.remove(resident.debug);
        resident.debug = null;
      }
      return;
    }
    if (resident.debug) return;
    const material = new THREE.MeshBasicMaterial({ color: 0x7cff9a, wireframe: true, depthTest: true });
    const debug = new THREE.Mesh(this.treeGeometry, material);
    debug.position.set(resident.tile.x, 0, resident.tile.z);
    debug.rotation.y = resident.tile.yaw;
    this.debugScene.add(debug);
    resident.debug = debug;
  }

  private syncCamera(): void {
    // Spark rebuilds the view from the camera quaternion, so a copied Babylon
    // matrix does not survive: Babylon is left-handed and that view is not a
    // pure rotation. Match position, target, and vertical field of view instead.
    // Three then looks down its own -Z at the same point.
    const camera = this.host.camera;
    camera.update();
    const locked = camera.lockedTarget;
    locked?.computeWorldMatrix(true);
    const target = locked ? locked.getAbsolutePosition() : camera.getTarget();
    this.threeCamera.position.set(camera.position.x, camera.position.y, camera.position.z);
    this.threeCamera.up.set(camera.upVector.x, camera.upVector.y, camera.upVector.z);
    this.threeCamera.lookAt(target.x, target.y, target.z);
    this.threeCamera.near = camera.minZ;
    this.threeCamera.far = camera.maxZ;
    this.threeCamera.fov = (camera.fov * 180) / Math.PI;
    this.threeCamera.aspect = this.host.canvas.width / Math.max(1, this.host.canvas.height);
    this.threeCamera.updateProjectionMatrix();
    this.threeCamera.updateMatrixWorld(true);
  }

  private publish(): void {
    let resident = 0;
    for (const tile of this.tiles.values()) resident += tile.tile.splatCount;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    this.stats.tilesResident = this.tiles.size;
    this.stats.splatsResident = resident;
    this.stats.fps = this.frameMs > 0 ? 1000 / this.frameMs : 0;
    this.stats.frameMs = this.frameMs;
    this.stats.heapMb = memory ? memory.usedJSHeapSize / (1024 * 1024) : null;
    const heap = this.stats.heapMb == null ? "" : ` · ${this.stats.heapMb.toFixed(0)} MB heap`;
    this.hud.textContent =
      `Splat grove · ${GROVE.tileSize} m tiles · ${this.stats.tilesResident}/${this.stats.tilesTotal} loaded` +
      ` · ${fmt(resident)} splats · ${fmt(this.stats.splatsRendered)} drawn · ${this.stats.fps.toFixed(0)} fps${heap}`;
    (window as unknown as { lumenSplats?: SplatStats }).lumenSplats = this.stats;
  }
}

export function mountSplatPrototype(host: SplatHost): Promise<SplatPrototype> {
  return SplatPrototype.mount(host);
}

function isWalkMesh(name: string): boolean {
  return name === "ground" || name === "cover-bank" || name.startsWith("water");
}

function meshTriangles(mesh: Mesh): { positions: Float32Array; indices: Uint32Array } | null {
  const source = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indexSource = mesh.getIndices();
  if (!source || !indexSource || indexSource.length < 3) return null;
  mesh.computeWorldMatrix(true);
  const matrix = mesh.getWorldMatrix();
  const positions = new Float32Array(source.length);
  const point = new Vector3();
  for (let i = 0; i < source.length; i += 3) {
    Vector3.TransformCoordinatesFromFloatsToRef(source[i], source[i + 1], source[i + 2], matrix, point);
    positions[i] = point.x;
    positions[i + 1] = point.y;
    positions[i + 2] = point.z;
  }
  const indices = new Uint32Array(indexSource.length);
  for (let i = 0; i < indexSource.length; i++) indices[i] = indexSource[i];
  return { positions, indices };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
