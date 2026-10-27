import {
  ArcRotateCamera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  Constants,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Palette } from "./art/materials";
import { buildPerson, type Rig } from "./art/models";
import { Sky } from "./art/sky";
import { heightAt } from "./world/terrain";
import { setLatitude } from "./art/heavens";
import { blockReason, CARRY_LIMIT, holdsShut, NEAR_REACH, type RuleQuery } from "./challenge/rules";
import { verseQuiz } from "./challenge/words";
import { CANON_LEVELS, GENESIS_CHAPTERS, GENESIS_VERSES, TORAH_VERSES } from "./data/canon";
import { chapterKey, chapterSpec, nextChapter } from "./data/chapters";
import { placeById, PLACE_SOUTH_ROAD, roadsFrom } from "./data/era";
import { compareVerseIds, PLACE_JORDAN_HILLS, verseId } from "./data/identity";
import { CURRENT_LEVEL } from "./data/levels";
import { PLACEMENTS, type Placement } from "./data/layout";
import { chapterPlacements, chapterTexts } from "./data/reading";
import { Hud } from "./hud";
import { clearState, loadState, saveState, STIPEND_PERIOD, type SaveState } from "./save";
import { resolveCircle } from "./world/collision";
import { loadPlace } from "./world/place";
import { LECTERN } from "./world/south-road";
import { VerseLights } from "./world/verses";
import {
  CHAPEL,
  disposeWorld,
  DOOR_POS,
  JAR_POS,
  KEY_POS,
  REAR_GAP,
  WATCH_HOME,
  WATCH_PATROL,
  type World,
} from "./world/world";

const PLAYER_R = 0.45;
const BOUNDS = 145;
const WALK = 7;
const SPRINT = 11;
const RIDE = 17;
const STIPEND_AMOUNT = 20;
const VERSE_PRICE = 30;
const INTERACT_RANGE = 3.2;
/** One full day and night. Night is about half of this. */
const DAY_LENGTH = 20 * 60;
const EYE_HEIGHT = 1.62;

interface Interaction {
  label: string;
  x: number;
  z: number;
  act: () => void;
}

type XZ = { x: number; z: number };
const distXZ = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const fmt = (n: number) => n.toLocaleString("en-US");

function turnToward(current: number, target: number, maxStep: number): number {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

function compassWord(from: XZ, to: XZ): string {
  const deg = (Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return names[Math.round(((deg + 360) % 360) / 45) % 8];
}

export class Game {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly player: Mesh;
  private readonly playerRig: Rig;
  private readonly sky: Sky;
  private playerSpeed = 0;
  private world!: World;
  private readonly pal: Palette;
  private shadows: CascadedShadowGenerator | null = null;
  private beacon: Mesh | null = null;
  private readonly lights: VerseLights;
  private readonly glow: GlowLayer;
  private readonly hemi: HemisphericLight;
  private readonly sun: DirectionalLight;
  private readonly hud = new Hud();
  private readonly state: SaveState = loadState();
  private readonly collected = new Set<string>(this.state.collected);
  private readonly keys = new Set<string>();
  private started = false;
  private mounted = false;
  private time = 0;
  /** 0 and 1 are midnight. The valley starts in the late afternoon so dusk arrives soon. */
  private day = 0.66;
  private saveClock = 0;
  private ownedNoticeAt = 0;
  private ruleHint: string | null = null;
  /** Wrong line or full arms: don't reopen the verse the same step. */
  private wordsQuiet = 0;
  private guideSpeed = 0;
  /** Far camera. The eyes are the view until V is pressed. */
  private thirdPerson = false;
  private viewRadius = 8;
  private travelOpen = false;
  private travelDest = "";
  private compass: (XZ & { until: number }) | null = null;
  private readonly watch = { wp: 0, chasing: false, cooldown: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.onNewMaterialAddedObservable.add((material) => {
      if (material instanceof StandardMaterial) material.maxSimultaneousLights = 6;
    });

    const sunDir = new Vector3(0.2, -0.8, 0.4);
    this.hemi = new HemisphericLight("sky-light", new Vector3(0, 1, 0), this.scene);
    this.hemi.groundColor = new Color3(0.42, 0.36, 0.3);
    this.hemi.specular = new Color3(0.12, 0.12, 0.13);
    this.sun = new DirectionalLight("sun-light", sunDir, this.scene);
    this.sun.diffuse = new Color3(1, 0.93, 0.8);
    this.sun.specular = new Color3(1, 0.96, 0.88);
    this.glow = new GlowLayer("glow", this.scene);
    this.glow.intensity = 0.55;
    this.sky = new Sky(this.scene);
    this.sky.excludeGlow(this.glow);

    this.pal = new Palette(this.scene);
    this.lights = new VerseLights(this.scene, this.glow);

    this.playerRig = buildPerson(this.scene, this.pal, "player", {
      robe: [0.24, 0.34, 0.55],
      trim: [0.6, 0.5, 0.35],
      head: [0.78, 0.72, 0.6],
      satchel: true,
    });
    this.player = this.playerRig.root;
    this.player.position.set(this.state.px, heightAt(this.state.px, this.state.pz), this.state.pz);
    const anchor = new Mesh("camera-anchor", this.scene);
    anchor.parent = this.player;
    anchor.position.y = EYE_HEIGHT;
    for (const mesh of this.playerRig.meshes) mesh.isVisible = false;

    this.camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2, 0.04, anchor.position.clone(), this.scene);
    this.camera.lockedTarget = anchor;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    this.camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
    this.camera.lowerRadiusLimit = 0.04;
    this.camera.upperRadiusLimit = 0.04;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = 2.4;
    this.camera.inertia = 0;
    this.camera.minZ = 0.05;
    this.camera.maxZ = 1200;
    this.setupLook();
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.thirdPerson) return;
        this.viewRadius = Math.min(14, Math.max(3.5, this.viewRadius + Math.sign(e.deltaY) * 0.6));
        e.preventDefault();
      },
      { passive: false },
    );

    this.goToPlace(this.state.place);
    this.bindInput();
    this.placeLevelPin();

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      if (this.started) this.update(dt);
      else {
        this.time += dt;
        this.day = (this.day + dt / DAY_LENGTH) % 1;
        this.paintSky();
        this.lights.update(this.time, dt, []);
        this.world.tick?.(dt, this.time);
      }
      this.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
  }

  // ---- setup ----

  /** Unload the current district and build the named one. */
  goToPlace(id: string, arrive = false): void {
    const place = placeById(id);
    this.leavePlace();
    this.world = loadPlace(this.scene, this.pal, id);
    this.state.place = id;
    setLatitude(place.latitude);
    if (arrive) {
      const at = this.state.placeAt[id] ?? place.spawn;
      this.player.position.set(at.x, this.world.heightAt(at.x, at.z), at.z);
      this.mounted = false;
      this.playerRig.setSeated(false);
    }
    this.layVerses();
    this.setupShadows();
    this.restoreWorld();
    this.refreshEmphasis();
    if (this.beaconHere(id)) this.raiseBeacon();
    this.applyHope();
  }

  private leavePlace(): void {
    this.lights.clear();
    if (this.beacon && !this.beacon.isDisposed()) this.beacon.dispose(false, true);
    this.beacon = null;
    this.shadows?.dispose();
    this.shadows = null;
    if (this.world) disposeWorld(this.world);
  }

  private layVerses(): void {
    if (chapterSpec(this.state.book, this.state.chapter).place !== this.state.place) return;
    for (const p of this.spots()) {
      if (this.has(p.verse)) this.lights.addResidue(p.x, p.z);
      else if (!this.state.carried.includes(this.vid(p.verse))) this.lights.add(p.verse, p.x, p.y ?? 0, p.z);
    }
  }

  private setupLook(): void {
    const look = new DefaultRenderingPipeline("look", false, this.scene, [this.camera]);
    look.fxaaEnabled = true;
    look.samples = 1;
    look.bloomEnabled = true;
    look.bloomThreshold = 0.62;
    look.bloomWeight = 0.16;
    look.bloomKernel = 48;
    look.bloomScale = 0.5;
    look.sharpenEnabled = true;
    look.sharpen.edgeAmount = 0.2;
    look.grainEnabled = true;
    look.grain.intensity = 3;
    look.grain.animated = true;
    const grade = this.scene.imageProcessingConfiguration;
    grade.contrast = 1.14;
    grade.exposure = 1.08;
    grade.toneMappingEnabled = true;
    grade.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    grade.vignetteEnabled = true;
    grade.vignetteWeight = 0.9;
    grade.vignetteStretch = 0.4;
    grade.vignetteColor = new Color4(0.05, 0.035, 0.025, 1);
    grade.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
  }

  private setupShadows(): void {
    const csm = new CascadedShadowGenerator(2048, this.sun);
    this.shadows = csm;
    csm.numCascades = 3;
    csm.shadowMaxZ = 120;
    csm.lambda = 0.75;
    csm.stabilizeCascades = true;
    csm.usePercentageCloserFiltering = true;
    csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    csm.normalBias = 0.02;
    csm.bias = 0.002;
    csm.setDarkness(0.45);
    for (const m of this.scene.meshes) {
      if (/^(verse|beacon|sky|sun|moon|star|planet|milky|water|ground|camera-anchor|folk|beast)/.test(m.name)) continue;
      csm.addShadowCaster(m, false);
      m.receiveShadows = true;
    }
    this.world.ground.receiveShadows = true;
  }

  private restoreWorld(): void {
    const s = this.state;
    if (s.keyTaken && this.world.key) this.world.key.dispose();
    if (s.jarTaken && this.world.jar) this.world.jar.dispose();
    if (s.doorOpen && this.world.door) this.openDoor();
    if (this.world.horse) this.placeHorse(s.horseX, s.horseZ);
  }

  private placeHorse(x: number, z: number): void {
    const horse = this.world.horse;
    if (!horse) return;
    horse.root.position.set(x, this.world.heightAt(x, z), z);
  }

  /** Marks this level on the opening map. The pin moves when a new level begins. */
  private placeLevelPin(): void {
    const pin = document.getElementById("level-pin");
    if (!pin) return;
    pin.style.left = `${CURRENT_LEVEL.mapX * 100}%`;
    pin.style.top = `${CURRENT_LEVEL.mapY * 100}%`;
    const name = document.getElementById("pin-name");
    const place = document.getElementById("pin-place");
    if (name) name.textContent = CURRENT_LEVEL.name;
    if (place) place.textContent = CURRENT_LEVEL.place;
  }

  private bindInput(): void {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (this.started && e.code.startsWith("Arrow")) e.preventDefault();
      if (!e.repeat) this.onKey(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    document.getElementById("begin")?.addEventListener("click", () => this.start());
    document.getElementById("travel-stay")?.addEventListener("click", () => this.hideTravel());
    document.getElementById("travel-go")?.addEventListener("click", () => this.takeRoad());
  }

  private start(): void {
    this.started = true;
    document.getElementById("title")?.classList.add("hidden");
    this.canvas.focus();
    if (!this.state.metMiriam) this.hud.toast("Miriam waits by the campfire. Walk to her and press E.");
  }

  private onKey(code: string): void {
    if (!this.started) return;
    if (this.hud.dialogOpen) {
      const n = ["Digit1", "Digit2", "Digit3"].indexOf(code);
      if (n >= 0) this.hud.pick(n);
      else if (code === "Escape" || (code === "KeyE" && !this.hud.hasOptions)) this.hud.closeDialog();
      return;
    }
    if (this.hud.codexOpen) {
      if (code === "KeyC" || code === "Escape") this.hud.hideCodex();
      return;
    }
    if (this.travelOpen) {
      if (code === "Escape" || code === "KeyM") this.hideTravel();
      return;
    }
    if (code === "KeyM") this.showTravel();
    else if (code === "KeyE") this.nearestInteraction()?.act();
    else if (code === "KeyH") this.toggleMount();
    else if (code === "KeyC") this.openCodex();
    else if (code === "KeyV") this.setThirdPerson(!this.thirdPerson);
  }

  /** Player and other people. Animals do not wake a verse. */
  private peopleNearVerses(): { x: number; z: number }[] {
    const near: { x: number; z: number }[] = [this.player.position];
    const add = (name: string, at: { x: number; z: number }) => {
      if (!name.startsWith("beast")) near.push(at);
    };
    const w = this.world;
    const addRig = (rig: { root: { name: string; position: { x: number; z: number } } } | null) => {
      if (rig) add(rig.root.name, rig.root.position);
    };
    addRig(w.miriam);
    addRig(w.eli);
    addRig(w.tobias);
    addRig(w.watchman);
    for (const rig of w.folk) add(rig.root.name, rig.root.position);
    for (const wanderer of w.wanderers) add(wanderer.rig.root.name, wanderer.rig.root.position);
    return near;
  }

  // ---- frame ----

  private update(dt: number): void {
    this.time += dt;
    this.day = (this.day + dt / DAY_LENGTH) % 1;
    this.world.tick?.(dt, this.time);
    this.keepEyesAboveGround();
    this.paintSky();
    this.lights.update(this.time, dt, this.peopleNearVerses(), this.shutVerses());
    const paused = this.hud.dialogOpen || this.hud.codexOpen || this.travelOpen;
    this.playerSpeed = 0;
    if (!paused) {
      this.movePlayer(dt);
      this.updateGuide(dt);
      this.updateWatchman(dt);
      this.checkVerses();
      this.tickStipend(dt);
    } else this.guideSpeed = 0;
    this.animateRigs(dt, paused);
    this.updateWanderers(dt);
    this.updatePrompt(paused);
    this.updateCompass();
    this.updateStatus();
    this.saveClock += dt;
    if (this.saveClock > 5) this.persist();
  }

  /** The near plane must stay above the ground when the view tilts down a slope. */
  private keepEyesAboveGround(): void {
    if (!this.thirdPerson) {
      const eye = this.camera.position;
      const floor = this.world.heightAt(eye.x, eye.z) + 0.4;
      if (eye.y < floor) eye.y = floor;
      return;
    }
    const target = this.orbitTarget();
    let radius = this.viewRadius;
    for (let i = 0; i < 10 && radius > 1.2; i++) {
      const pos = this.orbitAt(radius, target);
      if (pos.y >= this.world.heightAt(pos.x, pos.z) + 0.55) break;
      radius *= 0.72;
    }
    this.camera.radius = radius;
  }

  /** Where the orbit camera will sit for a radius. Matches Babylon's arc. */
  private orbitTarget(): Vector3 {
    const locked = this.camera.lockedTarget;
    if (locked) return locked.getAbsolutePosition();
    return this.camera.getTarget();
  }

  private orbitAt(radius: number, target: Vector3): Vector3 {
    const a = this.camera.alpha;
    const b = this.camera.beta;
    return new Vector3(
      target.x + radius * Math.cos(a) * Math.sin(b),
      target.y + radius * Math.cos(b),
      target.z + radius * Math.sin(a) * Math.sin(b),
    );
  }

  private setThirdPerson(third: boolean): void {
    this.thirdPerson = third;
    for (const mesh of this.playerRig.meshes) mesh.isVisible = third;
    if (third) {
      this.camera.beta = Math.min(1.2, Math.max(0.55, this.camera.beta));
      this.camera.lowerBetaLimit = 0.45;
      this.camera.upperBetaLimit = 1.35;
      this.camera.lowerRadiusLimit = 1.2;
      this.camera.upperRadiusLimit = 14;
      this.camera.minZ = 0.15;
      this.hud.toast("View from behind. Press V to look through your own eyes.");
    } else {
      this.camera.lowerBetaLimit = 0.2;
      this.camera.upperBetaLimit = 2.4;
      this.camera.lowerRadiusLimit = 0.04;
      this.camera.upperRadiusLimit = 0.04;
      this.camera.radius = 0.04;
      this.camera.minZ = 0.05;
      this.hud.toast("Your own eyes. Press V for the view from behind.");
    }
    this.keepEyesAboveGround();
  }

  private forward(): Vector3 {
    const a = this.camera.alpha;
    return new Vector3(-Math.cos(a), 0, -Math.sin(a));
  }

  private movePlayer(dt: number): void {
    const k = this.keys;
    let ix = 0;
    let iz = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) iz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iz -= 1;
    if (k.has("KeyD")) ix += 1;
    if (k.has("KeyA")) ix -= 1;
    const turn = 1.8 * dt;
    if (k.has("ArrowLeft")) this.camera.alpha += turn;
    if (k.has("ArrowRight")) this.camera.alpha -= turn;
    const looking = k.has("ControlLeft") || k.has("ControlRight");
    if (looking && (ix || iz)) {
      this.camera.alpha -= ix * turn;
      const beta = this.camera.beta - iz * turn * 0.7;
      this.camera.beta = Math.min(this.camera.upperBetaLimit ?? beta, Math.max(this.camera.lowerBetaLimit ?? beta, beta));
      this.syncHorse();
      return;
    }
    const pos = this.player.position;
    if (ix || iz) {
      const fwd = this.forward();
      const right = Vector3.Cross(Vector3.Up(), fwd);
      const dir = fwd.scale(iz).add(right.scale(ix)).normalize();
      const speed = this.mounted ? RIDE : k.has("ShiftLeft") || k.has("ShiftRight") ? SPRINT : WALK;
      const next = { x: pos.x + dir.x * speed * dt, z: pos.z + dir.z * speed * dt };
      resolveCircle(next, this.mounted ? 0.9 : PLAYER_R, this.world.colliders, this.mounted);
      const nx = Math.max(-BOUNDS, Math.min(BOUNDS, next.x));
      const nz = Math.max(-BOUNDS, Math.min(BOUNDS, next.z));
      this.playerSpeed = Math.hypot(nx - pos.x, nz - pos.z) / dt;
      pos.x = nx;
      pos.z = nz;
      this.player.rotation.y = turnToward(this.player.rotation.y, Math.atan2(dir.x, dir.z), dt * 12);
    }
    this.syncHorse();
  }

  private syncHorse(): void {
    const pos = this.player.position;
    const ground = this.world.heightAt(pos.x, pos.z);
    if (this.mounted && this.world.horse) {
      const h = this.world.horse.root;
      h.position.set(pos.x, ground, pos.z);
      h.rotation.y = this.player.rotation.y;
      pos.y = ground + 0.95;
    } else {
      pos.y = ground;
    }
  }

  private animateRigs(dt: number, paused: boolean): void {
    const w = this.world;
    this.playerRig.animate(dt, this.mounted ? 0 : this.playerSpeed);
    w.horse?.animate(dt, this.mounted ? this.playerSpeed : 0);
    if (paused) w.watchman?.animate(dt, 0);
    const pp = this.player.position;
    for (const npc of [w.miriam, w.eli, w.tobias]) {
      if (!npc) continue;
      const r = npc.root;
      if (distXZ(r.position, pp) < 7) {
        r.rotation.y = turnToward(r.rotation.y, Math.atan2(pp.x - r.position.x, pp.z - r.position.z), dt * 4);
      }
      npc.animate(dt, 0);
    }
    for (const rig of w.folk) {
      const following = rig.root.name === "joel" && this.state.guideFollows;
      const r = rig.root;
      if (!following && distXZ(r.position, pp) < 8) {
        r.rotation.y = turnToward(r.rotation.y, Math.atan2(pp.x - r.position.x, pp.z - r.position.z), dt * 3);
      }
      rig.animate(dt, following ? this.guideSpeed : 0);
    }
  }

  private updateWanderers(dt: number): void {
    for (const w of this.world.wanderers) {
      w.phase += dt * w.rate;
      const u = (Math.sin(w.phase) + 1) * 0.5;
      const x = w.ax + (w.bx - w.ax) * u;
      const z = w.az + (w.bz - w.az) * u;
      const root = w.rig.root;
      const dx = x - root.position.x;
      const dz = z - root.position.z;
      const step = Math.hypot(dx, dz);
      root.position.set(x, this.world.heightAt(x, z), z);
      if (step > 0.002) root.rotation.y = Math.atan2(dx, dz);
      w.rig.animate(dt, step / Math.max(dt, 1e-4));
    }
  }

  private inChapel(p: XZ): boolean {
    return p.x > CHAPEL.minX && p.x < CHAPEL.maxX && p.z > CHAPEL.minZ && p.z < CHAPEL.maxZ;
  }

  private updateWatchman(dt: number): void {
    const rig = this.world.watchman;
    if (!rig) return;
    const w = rig.root.position;
    const pp = this.player.position;
    const w8 = this.watch;
    const dPlayer = distXZ(w, pp);
    const playerFromHome = distXZ(pp, WATCH_HOME);
    const sanctuary = this.inChapel(pp);
    w8.cooldown -= dt;

    if (w8.chasing && (sanctuary || playerFromHome > 26 || dPlayer > 14)) {
      w8.chasing = false;
      this.hud.toast("The watchman gives up and returns to his rounds.");
    }
    if (!w8.chasing && w8.cooldown <= 0 && !sanctuary && dPlayer < 8 && playerFromHome < 26) {
      w8.chasing = true;
      this.hud.toast("The watchman has seen you. Run, or find another way in.");
    }

    let target: XZ;
    let speed: number;
    if (w8.chasing) {
      target = pp;
      speed = 8.5;
    } else {
      target = WATCH_PATROL[w8.wp];
      speed = 2.4;
      if (distXZ(w, target) < 0.5) w8.wp = (w8.wp + 1) % WATCH_PATROL.length;
    }
    const dx = target.x - w.x;
    const dz = target.z - w.z;
    const d = Math.hypot(dx, dz);
    let moved = 0;
    if (d > 0.01) {
      const step = Math.min(d, speed * dt);
      const ox = w.x;
      const oz = w.z;
      w.x += (dx / d) * step;
      w.z += (dz / d) * step;
      resolveCircle(w, 0.5, this.world.colliders, false);
      w.y = heightAt(w.x, w.z);
      moved = Math.hypot(w.x - ox, w.z - oz) / dt;
      rig.root.rotation.y = turnToward(rig.root.rotation.y, Math.atan2(dx, dz), dt * 8);
    }
    rig.animate(dt, moved);

    if (w8.chasing && dPlayer < 1.5) {
      const nx = (pp.x - w.x) / (dPlayer || 1);
      const nz = (pp.z - w.z) / (dPlayer || 1);
      const next = { x: pp.x + nx * 9, z: pp.z + nz * 9 };
      resolveCircle(next, PLAYER_R, this.world.colliders, this.mounted);
      pp.x = next.x;
      pp.z = next.z;
      this.syncHorse();
      const lost = Math.min(5, this.state.coin);
      this.state.coin -= lost;
      this.hud.toast(
        `The watchman shoves you back: "No one digs among these graves."${lost ? ` He takes ${lost} coin.` : ""}`,
      );
      w8.chasing = false;
      w8.cooldown = 5;
    }
  }

  private updateGuide(dt: number): void {
    const joel = this.world.folk.find((rig) => rig.root.name === "joel");
    if (!joel || !this.state.guideFollows) {
      this.guideSpeed = 0;
      return;
    }
    const pos = joel.root.position;
    const pp = this.player.position;
    const d = distXZ(pos, pp);
    const stand = 1.05;
    if (d <= stand + 0.05) {
      this.guideSpeed = 0;
      return;
    }
    const step = Math.min(3.2 * dt, d - stand);
    const next = { x: pos.x + ((pp.x - pos.x) / d) * step, z: pos.z + ((pp.z - pos.z) / d) * step };
    resolveCircle(next, 0.4, this.world.colliders, false);
    pos.x = next.x;
    pos.y = this.world.heightAt(next.x, next.z);
    pos.z = next.z;
    joel.root.rotation.y = Math.atan2(pp.x - pos.x, pp.z - pos.z);
    this.guideSpeed = step / Math.max(dt, 0.001);
  }

  private beaconHere(place: string): boolean {
    if (place === PLACE_JORDAN_HILLS) return this.state.sealed || this.state.sealedChapters.includes("genesis.1");
    const spec = chapterSpec(this.state.book, this.state.chapter);
    return spec.place === place && this.state.sealedChapters.includes(chapterKey(spec.book, spec.chapter));
  }

  private chapterRules() {
    return chapterSpec(this.state.book, this.state.chapter).rules;
  }

  private spots(): readonly Placement[] {
    return chapterPlacements(this.state.chapter);
  }

  private chapterTotal(): number {
    return chapterTexts(this.state.chapter).length;
  }

  private chapterHave(): number {
    return this.spots().filter((p) => this.has(p.verse)).length;
  }

  private query(verse: number, distance: number, at: XZ): RuleQuery {
    return {
      verse,
      distance,
      has: (n) => this.has(n),
      day: this.day,
      witness: this.nearestWitness(at),
      hour: chapterSpec(this.state.book, this.state.chapter).hour,
    };
  }

  /** Distance from a verse to the nearest person who is not the player. */
  private nearestWitness(at: XZ): number {
    let best = Infinity;
    const people = this.peopleNearVerses();
    for (let i = 1; i < people.length; i++) best = Math.min(best, distXZ(people[i], at));
    return best;
  }

  /** Verses a rule keeps dim, no matter who is standing there. */
  private shutVerses(): Set<number> {
    const rules = this.chapterRules();
    const shut = new Set<number>();
    if (chapterSpec(this.state.book, this.state.chapter).place !== this.state.place) return shut;
    for (const p of this.spots()) {
      if (this.has(p.verse) || this.state.carried.includes(this.vid(p.verse))) continue;
      if (holdsShut(rules, this.query(p.verse, 0, p))) shut.add(p.verse);
    }
    return shut;
  }

  private checkVerses(): void {
    const pp = this.player.position;
    const rules = this.chapterRules();
    let hint: string | null = null;
    let hintDist = 8;
    if (chapterSpec(this.state.book, this.state.chapter).place !== this.state.place) {
      this.ruleHint = null;
      return;
    }
    for (const p of this.spots()) {
      if (this.has(p.verse) || this.state.carried.includes(this.vid(p.verse))) continue;
      const d = distXZ(p, pp);
      if (p.owner) {
        if (d < 3 && this.time > this.ownedNoticeAt) {
          this.hud.toast("This verse belongs to Tobias. Talk to him about it.");
          this.ownedNoticeAt = this.time + 8;
        }
        continue;
      }
      const q = this.query(p.verse, d, p);
      const hold = holdsShut(rules, q);
      if (hold) {
        if (d < hintDist) {
          hint = hold;
          hintDist = d;
        }
        continue;
      }
      if (blockReason(rules, q)) continue;
      if (d < NEAR_REACH && this.time >= this.wordsQuiet) this.takeVerse(p);
    }
    this.ruleHint = hint;
  }

  private takeVerse(p: Placement): void {
    const rules = this.chapterRules();
    if (rules.includes("words")) return this.askWords(p);
    if (rules.includes("carry")) return this.liftVerse(p);
    this.commitVerse(p.verse);
  }

  private askWords(p: Placement): void {
    const text = chapterTexts(this.state.chapter)[p.verse - 1];
    const quiz = verseQuiz(text, p.verse);
    this.hud.openDialog(
      `Genesis ${this.state.chapter}:${p.verse}`,
      quiz.stem || "Finish the line.",
      quiz.choices.map((choice) => ({
        label: choice.text,
        onPick: () => {
          if (!choice.right) {
            this.wordsQuiet = this.time + 2.5;
            this.hud.toast("That is not how the line ends.");
            return;
          }
          this.commitVerse(p.verse);
        },
      })),
    );
  }

  private liftVerse(p: Placement): void {
    if (this.state.carried.length >= CARRY_LIMIT) {
      this.wordsQuiet = this.time + 2.5;
      this.hud.toast("Your arms are full. Set these verses on the lectern.");
      return;
    }
    this.state.carried.push(this.vid(p.verse));
    this.lights.remove(p.verse);
    this.hud.toast(`You carry verse ${p.verse}. Set it on the lectern.`);
    this.persist();
  }

  private tickStipend(dt: number): void {
    this.state.stipendTimer -= dt;
    if (this.state.stipendTimer <= 0) {
      this.state.stipendTimer += STIPEND_PERIOD;
      this.state.coin += STIPEND_AMOUNT;
      this.hud.toast(`Weekly stipend received: +${STIPEND_AMOUNT} coin.`);
    }
  }

  private updatePrompt(paused: boolean): void {
    if (paused) return this.hud.setPrompt(null);
    const near = this.nearestInteraction();
    if (near) return this.hud.setPrompt(`E — ${near.label}`);
    if (this.world.horse && !this.mounted && distXZ(this.player.position, this.world.horse.root.position) < 3.5) {
      return this.hud.setPrompt(
        this.state.hasHorse ? "H — Ride Dinah" : "Eli's mare, Dinah. Ask Eli in the pasture about her.",
      );
    }
    this.hud.setPrompt(this.ruleHint);
  }

  private updateCompass(): void {
    const c = this.compass;
    const pp = this.player.position;
    if (!c || this.time > c.until || distXZ(c, pp) < 3) {
      this.compass = null;
      this.hud.setCompass(null);
      return;
    }
    const fwd = this.forward();
    const rel = Math.atan2(c.x - pp.x, c.z - pp.z) - Math.atan2(fwd.x, fwd.z);
    this.hud.setCompass((rel * 180) / Math.PI, `${Math.round(distXZ(c, pp))} m`);
  }

  private updateStatus(): void {
    const s = this.state;
    const secs = Math.max(0, Math.ceil(s.stipendTimer));
    const items = [s.hasKey && "Sexton's key", s.hasJar && "Clay jar"].filter(Boolean).join(", ");
    const hope = Math.round((this.chapterHave() / this.chapterTotal()) * 100);
    const carried = this.state.carried.length;
    this.hud.setStatus(
      `<div class="title">Genesis ${s.chapter} &middot; <b>${this.chapterHave()}</b> / ${this.chapterTotal()} verses</div>` +
        `<div>Coin <b>${s.coin}</b> &middot; Stipend in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</div>` +
        `<div>${this.mounted ? "Riding Dinah" : "On foot"} &middot; Hope ${hope}%</div>` +
        (carried ? `<div>Carrying ${carried} verse${carried === 1 ? "" : "s"} for the lectern</div>` : "") +
        (items ? `<div>Carrying: ${items}</div>` : ""),
    );
  }

  // ---- interactions ----

  private interactions(): Interaction[] {
    const s = this.state;
    const w = this.world;
    const npc = (label: string, rig: Rig, act: () => void): Interaction => ({
      label,
      x: rig.root.position.x,
      z: rig.root.position.z,
      act,
    });
    const list: Interaction[] = [];
    if (w.miriam) list.push(npc("Talk to Miriam", w.miriam, () => this.talkMiriam()));
    if (w.eli) list.push(npc("Talk to Eli", w.eli, () => this.talkEli()));
    if (w.tobias) list.push(npc("Talk to Tobias", w.tobias, () => this.talkTobias()));
    const joel = w.folk.find((rig) => rig.root.name === "joel");
    if (joel) list.push(npc("Talk to Joel", joel, () => this.talkJoel()));
    if (joel && this.chapterRules().includes("carry")) {
      list.push({
        label: this.state.carried.length ? "Set the verses on the lectern" : "The lectern",
        ...LECTERN,
        act: () => this.fileCarried(),
      });
    }
    if (w.door && !s.doorOpen) {
      list.push({
        label: s.hasKey ? "Unlock the scriptorium door" : "Try the scriptorium door",
        ...DOOR_POS,
        act: () => this.tryDoor(),
      });
    }
    const key = w.key;
    if (key && !s.keyTaken) {
      list.push({
        label: "Take the sexton's key",
        x: KEY_POS.x,
        z: KEY_POS.z - 1.2,
        act: () => {
          s.keyTaken = true;
          s.hasKey = true;
          key.dispose();
          this.hud.toast("You take the sexton's key. Heavy old iron, worn smooth.");
          this.persist();
        },
      });
    }
    const jar = w.jar;
    if (jar && !s.jarTaken) {
      list.push({
        label: "Pick up the clay jar",
        ...JAR_POS,
        act: () => {
          s.jarTaken = true;
          s.hasJar = true;
          jar.dispose();
          this.hud.toast("You pick up an old clay jar. Someone might trade for this.");
          this.persist();
        },
      });
    }
    return list;
  }

  private nearestInteraction(): Interaction | null {
    let best: Interaction | null = null;
    let bestD = INTERACT_RANGE;
    for (const i of this.interactions()) {
      const d = distXZ(i, this.player.position);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  private toggleMount(): void {
    const pos = this.player.position;
    if (this.mounted) {
      this.mounted = false;
      this.playerRig.setSeated(false);
      const side = this.player.rotation.y + Math.PI / 2;
      this.placeHorse(pos.x + Math.sin(side) * 1.6, pos.z + Math.cos(side) * 1.6);
      this.syncHorse();
      this.hud.toast("You climb down from Dinah.");
      return;
    }
    if (!this.world.horse) return;
    if (distXZ(pos, this.world.horse.root.position) > 3.5) return;
    if (!this.state.hasHorse) {
      this.hud.toast("Dinah belongs to Eli. Ask him first.");
      return;
    }
    this.mounted = true;
    this.playerRig.setSeated(true);
    this.player.rotation.y = this.world.horse.root.rotation.y;
    this.syncHorse();
    this.hud.toast("Riding Dinah. She won't go through doorways. Press H to climb down.");
  }

  private openDoor(): void {
    const d = this.world.door;
    const box = this.world.doorBox;
    if (!d || !box) return;
    d.rotation.y = Math.PI / 2;
    d.position.x = 58.7;
    d.position.z = 49.5;
    box.solid = false;
  }

  private tryDoor(): void {
    const s = this.state;
    if (s.hasKey) {
      s.doorOpen = true;
      this.openDoor();
      this.hud.toast("The key turns. The scriptorium door swings open.");
    } else {
      s.triedDoor = true;
      this.hud.toast("Locked fast. Someone at the camp may know where the key went.");
    }
    this.persist();
  }

  private setCompass(x: number, z: number): void {
    this.compass = { x, z, until: this.time + 75 };
  }

  private nearestUncollected(): Placement | null {
    let best: Placement | null = null;
    let bestD = Infinity;
    for (const p of this.spots()) {
      if (this.has(p.verse) || this.state.carried.includes(this.vid(p.verse))) continue;
      const d = distXZ(p, this.player.position);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  private talkMiriam(): void {
    const s = this.state;
    const who = "Miriam, keeper of the camp";
    const spec = chapterSpec(s.book, s.chapter);
    if (spec.place !== PLACE_JORDAN_HILLS) {
      this.hud.openDialog(
        who,
        `Genesis ${s.chapter} is at the camp beside the south road. Press M, and take the road south.`,
      );
      return;
    }
    if (!s.metMiriam) {
      s.metMiriam = true;
      this.persist();
      this.hud.openDialog(
        who,
        "Peace to you, Seeker. This valley holds the first chapter of the first book: Genesis 1, thirty-one verses scattered where the world was first spoken. You'll know them when you see them. Their light rises straight into the sky. Most lie free on the sand. Some are locked away, and one was sold. Come and ask me whenever you're lost. I always know something, and old Eli up in the north pasture knows the rest.",
      );
      return;
    }
    if (this.chapterHave() === this.chapterTotal() && this.state.chapter === 1) {
      this.hud.openDialog(
        who,
        "The whole chapter, gathered. Look at the sky over the arch. That light is yours now, and everyone's. There are 1,188 more chapters out there, Seeker.",
      );
      return;
    }
    const chapelLeft = PLACEMENTS.some((p) => p.site === "scriptorium" && !this.has(p.verse));
    if (s.triedDoor && !s.doorOpen && !s.hasKey && chapelLeft) return this.doorHint(who);
    const target = this.nearestUncollected();
    if (target) this.verseHint(who, target);
  }

  private doorHint(who: string): void {
    const s = this.state;
    const rung = s.doorHintRung;
    s.doorHintRung = Math.min(rung + 1, 2);
    const lines = [
      "That door has been locked since the sexton died. He kept his key close: it lies on his grave in the old cemetery, south-east of here. A watchman walks the west side of those graves. Eli knows his rounds.",
      "If you'd rather stay away from the graves: the earthquake took part of the scriptorium's north wall. Walk round the back, toward the east corner. No key needed.",
      "Here, I'll put a light on your compass. It points to the gap in the north wall.",
    ];
    if (rung === 2) this.setCompass(REAR_GAP.x, REAR_GAP.z);
    this.hud.openDialog(who, lines[rung]);
    this.persist();
  }

  private verseHint(who: string, p: Placement): void {
    const s = this.state;
    const id = this.vid(p.verse);
    const rung = s.hintRungs[id] ?? 0;
    s.hintRungs[id] = Math.min(rung + 1, 2);
    if (!s.rumored.includes(id)) s.rumored.push(id);
    const pp = this.player.position;
    let text: string;
    if (p.owner === "tobias") {
      const lines = [
        "Verse thirty-one isn't lying in the dust. Tobias the collector bought it. His purple tent is north of the arch, toward the ring of pillars.",
        "Tobias likes coin, but he likes old clay even more. There's a jar by the well at the far north-west corner of the oasis.",
        "I've put a light on your compass. It points to Tobias.",
      ];
      text = lines[rung];
      const tobias = this.world.tobias;
      if (rung === 2 && tobias) this.setCompass(tobias.root.position.x, tobias.root.position.z);
    } else if (rung === 0) {
      text = `There is light ${compassWord(pp, p)} of here, toward the ${p.area}.`;
    } else if (rung === 1) {
      text = `Verse ${p.verse} rests ${p.landmark}.`;
      if (p.site === "scriptorium" && !s.doorOpen && !s.triedDoor) {
        text += " The scriptorium door is locked. Try it, then come back to me.";
      }
    } else {
      text = "Hold still... there. I've put a light on your compass. Follow it.";
      this.setCompass(p.x, p.z);
    }
    this.hud.openDialog(who, text);
    this.persist();
  }

  private talkEli(): void {
    const s = this.state;
    const who = "Eli the shepherd";
    if (!s.hasHorse) {
      s.hasHorse = true;
      this.persist();
      this.hud.openDialog(
        who,
        "Shalom! Miriam said a Seeker was coming. You'll wear your sandals out on this sand. Take Dinah, my mare. Stand beside her and press H to ride, and H again to climb down. She's quick, but she won't squeeze through doorways.",
      );
      return;
    }
    s.eliTalks += 1;
    const pastureLeft = [24, 25].filter((v) => !this.has(v)).length;
    const lines = [
      "The cemetery watchman walks the lantern path on its west side, back and forth, all day. He'll shove you out and help himself to your purse. But there's a gap in the east wall he never looks at.",
      pastureLeft
        ? `My sheep graze around ${pastureLeft === 2 ? "two verses" : "a verse"} up here. Look toward the north end of the pasture.`
        : "Tobias the collector? He drives a hard bargain, but he keeps his word. Coin or clay, he says.",
      "Miriam has kept that camp since before the scriptorium fell. If she doesn't know where a thing is, she knows who does.",
    ];
    this.hud.openDialog(who, lines[s.eliTalks % lines.length]);
  }

  private talkTobias(): void {
    const s = this.state;
    const who = "Tobias the collector";
    if (this.has(31)) {
      this.hud.openDialog(who, "It's yours now, and rightly. Carry it farther than my tent ever could.");
      return;
    }
    let text =
      "Ah, a Seeker. I hold verse thirty-one. 'Very good,' it says, and so is my price: thirty coin. Or... I've long wanted a clay jar from the old wells at the oasis. Bring me one and we'll call it even.";
    if (!s.hasJar && s.coin < VERSE_PRICE) {
      text += " No coin? Your stipend comes every week. I'm a patient man.";
    }
    this.hud.openDialog(who, text, [
      {
        label: `Pay ${VERSE_PRICE} coin (you have ${s.coin})`,
        disabled: s.coin < VERSE_PRICE,
        onPick: () => {
          s.coin -= VERSE_PRICE;
          this.collect(31);
        },
      },
      {
        label: "Trade the clay jar",
        disabled: !s.hasJar,
        onPick: () => {
          s.hasJar = false;
          this.collect(31);
        },
      },
      { label: "Leave", onPick: () => {} },
    ]);
  }

  private talkJoel(): void {
    const spec = chapterSpec(this.state.book, this.state.chapter);
    const next = nextChapter(this.state.book, this.state.chapter);
    const who = "Joel, keeper of the south road";
    if (next && next.place === this.state.place && this.state.sealedChapters.includes(chapterKey(this.state.book, this.state.chapter))) {
      this.hud.openDialog(who, `Genesis ${this.state.chapter} is in the Codex. Genesis ${next.chapter} is here in the camp.`, [
        { label: `Begin Genesis ${next.chapter}`, onPick: () => this.beginChapter(next) },
        { label: "Not yet", onPick: () => {} },
      ]);
      return;
    }
    const bits: string[] = [];
    if (spec.rules.includes("order")) bits.push("Take them in order. The first verse of the chapter opens the next.");
    if (spec.rules.includes("hour")) bits.push(`These verses open in the ${spec.hour?.label ?? "evening"}.`);
    if (spec.rules.includes("witness")) {
      bits.push(
        this.state.guideFollows
          ? "I'm with you. Stand close to a verse, and I will stand close too."
          : "These verses stay shut unless someone stands with you.",
      );
    }
    if (spec.rules.includes("words")) bits.push("Read the ending carefully. Only one of the three lines is the verse.");
    if (spec.rules.includes("carry")) bits.push("The lectern is west of the fire. Carry a verse there. Three at a time.");
    if (!bits.length) bits.push("Press M when you want the way back to the valley.");
    const follow = spec.rules.includes("witness") && !this.state.guideFollows;
    this.hud.openDialog(
      who,
      bits.join(" "),
      follow
        ? [
            {
              label: "Walk with me",
              onPick: () => {
                this.state.guideFollows = true;
                this.persist();
                this.hud.toast("Joel walks with you.");
              },
            },
            { label: "Not now", onPick: () => {} },
          ]
        : [],
    );
  }

  private showTravel(): void {
    const hops = roadsFrom(this.state.place);
    const hop = hops[0];
    if (!hop) return;
    if (this.state.place === PLACE_JORDAN_HILLS && !this.state.sealed) {
      this.hud.toast("The south road opens when Genesis 1 is in the codex.");
      return;
    }
    const here = placeById(this.state.place);
    const there = hop.destination;
    const pin = (id: string, place: { name: string; mapX: number; mapY: number }) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.style.left = `${place.mapX * 100}%`;
      node.style.top = `${place.mapY * 100}%`;
      const label = node.querySelector("b");
      if (label) label.textContent = place.name;
    };
    pin("travel-here", here);
    pin("travel-there", there);
    const title = document.getElementById("travel-title");
    const copy = document.getElementById("travel-copy");
    const go = document.getElementById("travel-go");
    if (title) title.textContent = hop.road.name;
    if (copy) copy.textContent = hop.homeward ? hop.road.homeward : hop.road.telling;
    if (go) go.textContent = `Take the road · ${hop.road.days} days`;
    this.travelDest = there.id;
    this.travelOpen = true;
    document.getElementById("travel")?.classList.remove("hidden");
  }

  private hideTravel(): void {
    this.travelOpen = false;
    document.getElementById("travel")?.classList.add("hidden");
  }

  private takeRoad(): void {
    const dest = this.travelDest;
    const hop = roadsFrom(this.state.place).find((item) => item.destination.id === dest);
    if (!hop) return this.hideTravel();
    if (this.state.place === PLACE_JORDAN_HILLS && !this.state.sealed) return this.hideTravel();
    this.mounted = false;
    this.playerRig.setSeated(false);
    this.state.placeAt[this.state.place] = { x: this.player.position.x, z: this.player.position.z };
    this.state.elapsedDays += hop.road.days;
    this.day = 0.32;
    if (dest === PLACE_SOUTH_ROAD && this.state.chapter === 1 && this.state.sealedChapters.includes("genesis.1")) {
      this.state.chapter = 2;
    }
    this.hideTravel();
    this.goToPlace(dest, true);
    this.hud.toast(`${hop.road.days} days on the road. You arrive at dawn.`);
    this.persist();
  }

  // ---- progress ----

  /** Id of a verse in the chapter the player is walking. */
  private vid(verse: number): string {
    return verseId(this.state.book, this.state.chapter, verse);
  }

  private has(verse: number): boolean {
    return this.collected.has(this.vid(verse));
  }

  private collect(verse: number): void {
    this.commitVerse(verse);
  }

  private commitVerse(verse: number): void {
    const id = this.vid(verse);
    if (this.collected.has(id)) return;
    const hold = holdsShut(this.chapterRules(), this.query(verse, 0, this.player.position));
    if (hold) {
      this.hud.toast(hold);
      return;
    }
    this.collected.add(id);
    this.state.carried = this.state.carried.filter((carried) => carried !== id);
    this.finishTake([verse]);
  }

  private fileCarried(): void {
    const prefix = `${this.state.book}.${this.state.chapter}.`;
    const ids = this.state.carried.filter((id) => id.startsWith(prefix));
    if (!ids.length) {
      this.hud.toast("Carry a verse here, then set it down.");
      return;
    }
    const verses = ids.map((id) => Number(id.slice(prefix.length)));
    for (const id of ids) this.collected.add(id);
    this.state.carried = this.state.carried.filter((id) => !ids.includes(id));
    this.finishTake(verses);
  }

  private finishTake(verses: number[]): void {
    this.state.collected = [...this.collected].sort(compareVerseIds);
    const texts = chapterTexts(this.state.chapter);
    for (const verse of verses) {
      const p = this.spots().find((q) => q.verse === verse);
      this.lights.remove(verse);
      if (p) {
        this.lights.addResidue(p.x, p.z);
        if (this.compass && distXZ(this.compass, p) < 1) this.compass = null;
      }
    }
    const last = verses[verses.length - 1];
    this.hud.showVerse(`Genesis ${this.state.chapter}:${last}`, texts[last - 1]);
    this.applyHope();
    this.refreshEmphasis();
    const key = chapterKey(this.state.book, this.state.chapter);
    const have = this.chapterHave();
    const total = this.chapterTotal();
    if (have === total && !this.state.sealedChapters.includes(key)) this.sealChapter();
    else if (verses.length === 1) this.hud.toast(`Verse recovered: ${have} of ${total} in Genesis ${this.state.chapter}.`);
    else this.hud.toast(`${verses.length} verses set down: ${have} of ${total} in Genesis ${this.state.chapter}.`);
    this.persist();
  }

  private beginChapter(spec: ReturnType<typeof nextChapter>): void {
    if (!spec) return;
    this.state.book = spec.book;
    this.state.chapter = spec.chapter;
    this.state.guideFollows = false;
    if (spec.place === this.state.place) this.goToPlace(this.state.place);
    else this.hud.toast(`Genesis ${spec.chapter} is at ${placeById(spec.place).name}. Press M.`);
    this.persist();
  }

  private refreshEmphasis(): void {
    const left = this.spots().filter((p) => !this.has(p.verse) && !this.state.carried.includes(this.vid(p.verse)));
    if (left.length === 1) this.lights.emphasize(left[0].verse);
  }

  private sealChapter(): void {
    const key = chapterKey(this.state.book, this.state.chapter);
    if (!this.state.sealedChapters.includes(key)) this.state.sealedChapters.push(key);
    if (this.state.chapter === 1) this.state.sealed = true;
    if (this.beaconHere(this.state.place)) this.raiseBeacon();
    const next = nextChapter(this.state.book, this.state.chapter);
    const here = next?.place === this.state.place;
    this.hud.openDialog(
      `Chapter sealed: Genesis ${this.state.chapter}`,
      this.state.chapter === 1
        ? "All thirty-one verses are in your Codex. A Hope Beacon rises over the Ruined Arch. The south road is open: press M when you are ready to leave the valley. This chapter counts toward Genesis, the Torah, and all three canon levels: the Hebrew Bible, the Protestant Bible, and the Catholic Bible. Press C to see your Codex."
        : `Genesis ${this.state.chapter} is in the Codex.${here ? ` Genesis ${next.chapter} is here in the camp whenever you are ready.` : ""}`,
      here && next
        ? [{ label: `Begin Genesis ${next.chapter}`, onPick: () => this.beginChapter(next) }, { label: "Not yet", onPick: () => {} }]
        : [],
    );
  }

  private raiseBeacon(): void {
    if (this.beacon && !this.beacon.isDisposed()) return;
    const b = MeshBuilder.CreateCylinder("beacon", { height: 140, diameter: 5, tessellation: 24 }, this.scene);
    this.beacon = b;
    const at = this.state.place === PLACE_JORDAN_HILLS ? -25 : -2;
    b.position.set(0, 70, at);
    const m = new StandardMaterial("beacon-mat", this.scene);
    m.emissiveColor = new Color3(1, 0.96, 0.85);
    m.diffuseColor = Color3.Black();
    m.disableLighting = true;
    m.alpha = 0.35;
    m.alphaMode = Constants.ALPHA_ADD;
    m.backFaceCulling = false;
    m.fogEnabled = false;
    b.material = m;
    this.glow.addExcludedMesh(b);
  }

  private applyHope(): void {
    this.paintSky();
  }

  private paintSky(): void {
    const hope = this.chapterHave() / this.chapterTotal();
    const s = this.sky.update(this.day, hope);
    this.scene.clearColor = s.clear;
    this.scene.fogColor = s.fog;
    this.scene.fogDensity = s.fogDensity;
    this.hemi.intensity = s.hemi;
    this.hemi.diffuse = s.hemiColor;
    this.hemi.groundColor = s.ground;
    this.sun.intensity = s.sunIntensity;
    this.sun.diffuse = s.sunColor;
    this.sun.direction = s.lightDir;
  }

  private persist(): void {
    this.saveClock = 0;
    const s = this.state;
    s.px = this.player.position.x;
    s.pz = this.player.position.z;
    if (this.world.horse) {
      s.horseX = this.world.horse.root.position.x;
      s.horseZ = this.world.horse.root.position.z;
    }
    saveState(s);
  }

  private openCodex(): void {
    const n = this.collected.size;
    const chapterHave = this.chapterHave();
    const chapterTotal = this.chapterTotal();
    const chapters = this.state.sealedChapters.length;
    const bar = (have: number, total: number) =>
      `<div class="bar"><span style="width:${Math.max(0.6, (have / total) * 100)}%"></span></div>`;
    const row = (name: string, detail: string, have: number, total: number) =>
      `<div class="track"><div class="track-row"><b>${name}</b><span>${detail}</span></div>${bar(have, total)}</div>`;

    const levels = CANON_LEVELS.map((l) =>
      row(
        `Level ${l.label} · ${l.name}`,
        `${fmt(n)} / ${fmt(l.verses)} verses · ${chapters} / ${fmt(l.chapters)} chapters · 0 / ${l.books} books`,
        n,
        l.verses,
      ),
    ).join("");
    const types =
      row("Torah", `${fmt(n)} / ${fmt(TORAH_VERSES)} verses · Hebrew, Protestant, and Catholic`, n, TORAH_VERSES) +
      row(
        "Genesis (Bereshit)",
        `${fmt(n)} / ${fmt(GENESIS_VERSES)} verses · ${chapters} / ${GENESIS_CHAPTERS} chapters`,
        n,
        GENESIS_VERSES,
      );
    const verses = chapterTexts(this.state.chapter)
      .map((text, i) => {
        const v = i + 1;
        const p = this.spots().find((q) => q.verse === v);
        if (this.has(v)) return `<li class="got"><span class="num">${v}</span>${text}</li>`;
        if (this.state.carried.includes(this.vid(v))) return `<li class="rumor"><span class="num">${v}</span>In your arms, for the lectern</li>`;
        if (this.state.rumored.includes(this.vid(v)) && p)
          return `<li class="rumor"><span class="num">${v}</span>Rumored · ${p.area}</li>`;
        return `<li><span class="num">${v}</span>Unknown</li>`;
      })
      .join("");

    this.hud.showCodex(
      `<div class="codex-inner">` +
        `<div class="codex-head"><h2>Codex</h2><span>C or Esc to close</span></div>` +
        `<h3>Canon levels</h3>${levels}` +
        `<h3>Book types</h3>${types}` +
        `<h3>Genesis ${this.state.chapter} · ${chapterHave} / ${chapterTotal}</h3><ol class="verses">${verses}</ol>` +
        `<button id="reset-save">Start over</button></div>`,
    );
    document.getElementById("reset-save")?.addEventListener("click", () => {
      if (!confirm("Erase your progress and start over?")) return;
      clearState();
      location.reload();
    });
  }
}
