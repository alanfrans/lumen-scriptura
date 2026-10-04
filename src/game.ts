import {
  ArcRotateCamera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  Constants,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Palette } from "./art/materials";
import { buildPerson, type Rig } from "./art/models";
import { Sky } from "./art/sky";
import { heightAt } from "./world/terrain";
import { CANON_LEVELS, GENESIS_CHAPTERS, GENESIS_VERSES, TORAH_VERSES } from "./data/canon";
import { GENESIS_1 } from "./data/genesis1";
import { PLACEMENTS, type Placement } from "./data/layout";
import { Hud } from "./hud";
import { clearState, loadState, saveState, STIPEND_PERIOD, type SaveState } from "./save";
import { resolveCircle } from "./world/collision";
import { VerseLights } from "./world/verses";
import {
  buildWorld,
  CHAPEL,
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
const CHAPTER_SIZE = GENESIS_1.length;

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
  private readonly world: World;
  private readonly lights: VerseLights;
  private readonly glow: GlowLayer;
  private readonly hemi: HemisphericLight;
  private readonly sun: DirectionalLight;
  private readonly hud = new Hud();
  private readonly state: SaveState = loadState();
  private readonly collected = new Set<number>(this.state.collected);
  private readonly keys = new Set<string>();
  private started = false;
  private mounted = false;
  private time = 0;
  private saveClock = 0;
  private ownedNoticeAt = 0;
  private compass: (XZ & { until: number }) | null = null;
  private readonly watch = { wp: 0, chasing: false, cooldown: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.fogMode = Scene.FOGMODE_EXP2;

    const sunDir = new Vector3(-0.5, -0.85, 0.35);
    this.hemi = new HemisphericLight("sky-light", new Vector3(0, 1, 0), this.scene);
    this.hemi.groundColor = new Color3(0.42, 0.36, 0.3);
    this.sun = new DirectionalLight("sun-light", sunDir, this.scene);
    this.sun.diffuse = new Color3(1, 0.93, 0.8);
    this.glow = new GlowLayer("glow", this.scene);
    this.glow.intensity = 0.7;
    this.sky = new Sky(this.scene, sunDir);

    const pal = new Palette(this.scene);
    this.world = buildWorld(this.scene, pal);
    this.lights = new VerseLights(this.scene, this.glow);
    for (const p of PLACEMENTS) {
      if (this.collected.has(p.verse)) this.lights.addResidue(p.x, p.z);
      else this.lights.add(p.verse, p.x, p.y ?? 0, p.z);
    }

    this.playerRig = buildPerson(this.scene, pal, "player", {
      robe: [0.24, 0.34, 0.55],
      trim: [0.6, 0.5, 0.35],
      head: [0.78, 0.72, 0.6],
      satchel: true,
    });
    this.player = this.playerRig.root;
    this.player.position.set(this.state.px, heightAt(this.state.px, this.state.pz), this.state.pz);
    const anchor = new Mesh("camera-anchor", this.scene);
    anchor.parent = this.player;
    anchor.position.y = 1.6;

    this.camera = new ArcRotateCamera("cam", -Math.PI / 2, 1.12, 16, this.player.position.clone(), this.scene);
    this.camera.lockedTarget = anchor;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 45;
    this.camera.lowerBetaLimit = 0.35;
    this.camera.upperBetaLimit = 1.48;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1200;

    this.setupShadows();
    this.restoreWorld();
    this.applyHope();
    this.refreshEmphasis();
    if (this.state.sealed) this.raiseBeacon();
    this.bindInput();

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      if (this.started) this.update(dt);
      else this.lights.update((this.time += dt));
      this.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
  }

  // ---- setup ----

  private setupShadows(): void {
    const csm = new CascadedShadowGenerator(1024, this.sun);
    csm.numCascades = 3;
    csm.shadowMaxZ = 140;
    csm.lambda = 0.85;
    csm.stabilizeCascades = true;
    csm.usePercentageCloserFiltering = true;
    csm.setDarkness(0.35);
    for (const m of this.scene.meshes) {
      if (/^(verse|beacon|sky|sun|water|ground|camera-anchor)/.test(m.name)) continue;
      csm.addShadowCaster(m, false);
      m.receiveShadows = true;
    }
    this.world.ground.receiveShadows = true;
  }

  private restoreWorld(): void {
    const s = this.state;
    if (s.keyTaken) this.world.key.dispose();
    if (s.jarTaken) this.world.jar.dispose();
    if (s.doorOpen) this.openDoor();
    this.placeHorse(s.horseX, s.horseZ);
  }

  private placeHorse(x: number, z: number): void {
    this.world.horse.root.position.set(x, heightAt(x, z), z);
  }

  private bindInput(): void {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (!e.repeat) this.onKey(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    document.getElementById("begin")?.addEventListener("click", () => this.start());
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
    if (code === "KeyE") this.nearestInteraction()?.act();
    else if (code === "KeyH") this.toggleMount();
    else if (code === "KeyC") this.openCodex();
  }

  // ---- frame ----

  private update(dt: number): void {
    this.time += dt;
    this.lights.update(this.time);
    const paused = this.hud.dialogOpen || this.hud.codexOpen;
    this.playerSpeed = 0;
    if (!paused) {
      this.movePlayer(dt);
      this.updateWatchman(dt);
      this.checkVerses();
      this.tickStipend(dt);
    }
    this.animateRigs(dt, paused);
    this.updatePrompt(paused);
    this.updateCompass();
    this.updateStatus();
    this.saveClock += dt;
    if (this.saveClock > 5) this.persist();
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
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
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
    const ground = heightAt(pos.x, pos.z);
    if (this.mounted) {
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
    w.horse.animate(dt, this.mounted ? this.playerSpeed : 0);
    if (paused) w.watchman.animate(dt, 0);
    const pp = this.player.position;
    for (const npc of [w.miriam, w.eli, w.tobias]) {
      const r = npc.root;
      if (distXZ(r.position, pp) < 7) {
        r.rotation.y = turnToward(r.rotation.y, Math.atan2(pp.x - r.position.x, pp.z - r.position.z), dt * 4);
      }
      npc.animate(dt, 0);
    }
  }

  private inChapel(p: XZ): boolean {
    return p.x > CHAPEL.minX && p.x < CHAPEL.maxX && p.z > CHAPEL.minZ && p.z < CHAPEL.maxZ;
  }

  private updateWatchman(dt: number): void {
    const rig = this.world.watchman;
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

  private checkVerses(): void {
    const pp = this.player.position;
    for (const p of PLACEMENTS) {
      if (this.collected.has(p.verse)) continue;
      const d = distXZ(p, pp);
      if (p.owner) {
        if (d < 3 && this.time > this.ownedNoticeAt) {
          this.hud.toast("This verse belongs to Tobias. Talk to him about it.");
          this.ownedNoticeAt = this.time + 8;
        }
        continue;
      }
      if (d < 1.8) this.collect(p.verse);
    }
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
    if (!this.mounted && distXZ(this.player.position, this.world.horse.root.position) < 3.5) {
      return this.hud.setPrompt(
        this.state.hasHorse ? "H — Ride Dinah" : "Eli's mare, Dinah. Ask Eli in the pasture about her.",
      );
    }
    this.hud.setPrompt(null);
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
    const hope = Math.round((this.collected.size / CHAPTER_SIZE) * 100);
    this.hud.setStatus(
      `<div class="title">Genesis 1 &middot; <b>${this.collected.size}</b> / ${CHAPTER_SIZE} verses</div>` +
        `<div>Coin <b>${s.coin}</b> &middot; Stipend in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</div>` +
        `<div>${this.mounted ? "Riding Dinah" : "On foot"} &middot; Hope ${hope}%</div>` +
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
    const list: Interaction[] = [
      npc("Talk to Miriam", w.miriam, () => this.talkMiriam()),
      npc("Talk to Eli", w.eli, () => this.talkEli()),
      npc("Talk to Tobias", w.tobias, () => this.talkTobias()),
    ];
    if (!s.doorOpen) {
      list.push({
        label: s.hasKey ? "Unlock the scriptorium door" : "Try the scriptorium door",
        ...DOOR_POS,
        act: () => this.tryDoor(),
      });
    }
    if (!s.keyTaken) {
      list.push({
        label: "Take the sexton's key",
        x: KEY_POS.x,
        z: KEY_POS.z - 1.2,
        act: () => {
          s.keyTaken = true;
          s.hasKey = true;
          w.key.dispose();
          this.hud.toast("You take the sexton's key. Heavy old iron, worn smooth.");
          this.persist();
        },
      });
    }
    if (!s.jarTaken) {
      list.push({
        label: "Pick up the clay jar",
        ...JAR_POS,
        act: () => {
          s.jarTaken = true;
          s.hasJar = true;
          w.jar.dispose();
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
    d.rotation.y = Math.PI / 2;
    d.position.x = 58.7;
    d.position.z = 49.5;
    this.world.doorBox.solid = false;
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
    for (const p of PLACEMENTS) {
      if (this.collected.has(p.verse)) continue;
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
    if (!s.metMiriam) {
      s.metMiriam = true;
      this.persist();
      this.hud.openDialog(
        who,
        "Peace to you, Seeker. This valley holds the first chapter of the first book: Genesis 1, thirty-one verses scattered where the world was first spoken. You'll know them when you see them. Their light rises straight into the sky. Most lie free on the sand. Some are locked away, and one was sold. Come and ask me whenever you're lost. I always know something, and old Eli up in the north pasture knows the rest.",
      );
      return;
    }
    if (this.collected.size === CHAPTER_SIZE) {
      this.hud.openDialog(
        who,
        "The whole chapter, gathered. Look at the sky over the arch. That light is yours now, and everyone's. There are 1,188 more chapters out there, Seeker.",
      );
      return;
    }
    const chapelLeft = PLACEMENTS.some((p) => p.site === "scriptorium" && !this.collected.has(p.verse));
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
    const rung = s.hintRungs[p.verse] ?? 0;
    s.hintRungs[p.verse] = Math.min(rung + 1, 2);
    if (!s.rumored.includes(p.verse)) s.rumored.push(p.verse);
    const pp = this.player.position;
    let text: string;
    if (p.owner === "tobias") {
      const lines = [
        "Verse thirty-one isn't lying in the dust. Tobias the collector bought it. His purple tent is north of the arch, toward the ring of pillars.",
        "Tobias likes coin, but he likes old clay even more. There's a jar by the well at the far north-west corner of the oasis.",
        "I've put a light on your compass. It points to Tobias.",
      ];
      text = lines[rung];
      if (rung === 2) this.setCompass(this.world.tobias.root.position.x, this.world.tobias.root.position.z);
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
    const pastureLeft = [24, 25].filter((v) => !this.collected.has(v)).length;
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
    if (this.collected.has(31)) {
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

  // ---- progress ----

  private collect(verse: number): void {
    if (this.collected.has(verse)) return;
    this.collected.add(verse);
    this.state.collected = [...this.collected].sort((a, b) => a - b);
    const p = PLACEMENTS.find((q) => q.verse === verse);
    this.lights.remove(verse);
    if (p) {
      this.lights.addResidue(p.x, p.z);
      if (this.compass && distXZ(this.compass, p) < 1) this.compass = null;
    }
    this.hud.showVerse(`Genesis 1:${verse}`, GENESIS_1[verse - 1]);
    this.applyHope();
    this.refreshEmphasis();
    if (this.collected.size === CHAPTER_SIZE && !this.state.sealed) this.sealChapter();
    else this.hud.toast(`Verse recovered: ${this.collected.size} of ${CHAPTER_SIZE} in Genesis 1.`);
    this.persist();
  }

  private refreshEmphasis(): void {
    const left = PLACEMENTS.filter((p) => !this.collected.has(p.verse));
    if (left.length === 1) this.lights.emphasize(left[0].verse);
  }

  private sealChapter(): void {
    this.state.sealed = true;
    this.raiseBeacon();
    this.hud.openDialog(
      "Chapter sealed: Genesis 1",
      "All thirty-one verses are in your Codex. A Hope Beacon rises over the Ruined Arch. This chapter counts toward Genesis, the Torah, and all three canon levels: the Hebrew Bible, the Protestant Bible, and the Catholic Bible. Press C to see your Codex.",
    );
  }

  private raiseBeacon(): void {
    const b = MeshBuilder.CreateCylinder("beacon", { height: 140, diameter: 5, tessellation: 24 }, this.scene);
    b.position.set(0, 70, -25);
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
    const h = this.collected.size / CHAPTER_SIZE;
    const horizon = Color3.Lerp(new Color3(0.33, 0.29, 0.29), new Color3(0.8, 0.84, 0.88), h);
    const top = Color3.Lerp(new Color3(0.14, 0.13, 0.17), new Color3(0.28, 0.48, 0.82), h);
    this.sky.paint(top, horizon);
    this.scene.clearColor = new Color4(horizon.r, horizon.g, horizon.b, 1);
    this.scene.fogColor = horizon;
    this.scene.fogDensity = 0.012 - 0.0085 * h;
    this.hemi.intensity = 0.4 + 0.35 * h;
    this.sun.intensity = 0.55 + 0.9 * h;
  }

  private persist(): void {
    this.saveClock = 0;
    const s = this.state;
    s.px = this.player.position.x;
    s.pz = this.player.position.z;
    s.horseX = this.world.horse.root.position.x;
    s.horseZ = this.world.horse.root.position.z;
    saveState(s);
  }

  private openCodex(): void {
    const n = this.collected.size;
    const chapters = this.state.sealed ? 1 : 0;
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
    const verses = GENESIS_1.map((text, i) => {
      const v = i + 1;
      const p = PLACEMENTS.find((q) => q.verse === v);
      if (this.collected.has(v)) return `<li class="got"><span class="num">${v}</span>${text}</li>`;
      if (this.state.rumored.includes(v) && p)
        return `<li class="rumor"><span class="num">${v}</span>Rumored · ${p.area}</li>`;
      return `<li><span class="num">${v}</span>Unknown</li>`;
    }).join("");

    this.hud.showCodex(
      `<div class="codex-inner">` +
        `<div class="codex-head"><h2>Codex</h2><span>C or Esc to close</span></div>` +
        `<h3>Canon levels</h3>${levels}` +
        `<h3>Book types</h3>${types}` +
        `<h3>Genesis 1 · ${n} / ${CHAPTER_SIZE}</h3><ol class="verses">${verses}</ol>` +
        `<button id="reset-save">Start over</button></div>`,
    );
    document.getElementById("reset-save")?.addEventListener("click", () => {
      if (!confirm("Erase your progress and start over?")) return;
      clearState();
      location.reload();
    });
  }
}
