import * as THREE from 'three';
import './style.css';
import { DayCycle } from './engine/daycycle.ts';
import type { DifficultyId } from './engine/difficulty.ts';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from './engine/difficulty.ts';
import { Input } from './engine/input.ts';
import { Particles } from './engine/particles.ts';
import { Sfx } from './engine/sfx.ts';
import { Sky } from './engine/sky.ts';
import { ItemManager } from './entities/item.ts';
import { MobManager } from './entities/mobs.ts';
import type { Villager } from './entities/villager.ts';
import { VillagerManager } from './entities/villagers.ts';
import { Item, isBlockItem, toolOf } from './items/items.ts';
import { Hand } from './player/hand.ts';
import { HOTBAR_SIZE, Hotbar } from './player/hotbar.ts';
import { Inventory } from './player/inventory.ts';
import { Player } from './player/player.ts';
import { BLOCKS, Block, isBreakable, isPlaceable, isWater } from './world/blocks.ts';
import { CHUNK_SIZE } from './world/chunk.ts';
import { SEA_LEVEL, terrainHeight } from './world/terrain.ts';
import { updateFluidAnimation } from './world/textures.ts';
import { World, raycast } from './world/world.ts';
import { Hud } from './ui/hud.ts';
import { InventoryScreen } from './ui/inventory.ts';
import { TradeScreen } from './ui/trade.ts';

const RENDER_DISTANCE = 6;
const REACH = 6;
const PHYSICS_TICK = 0.08;
const FIST_DAMAGE = 2;
const ATTACK_COOLDOWN = 0.35;
const MINE_SWING_INTERVAL = 0.3;
/** Seconds of mining per point of block hardness with bare hands. */
const HARDNESS_SECONDS = 1.4;
const BREAD_HEAL = 4;
const GLASS_SHARD_COLOR = 0xcfe6f2;
const UNDERWATER_COLOR = 0x12356b;
const LAVA_COLOR = 0x8a2a04;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app container');

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const hudRoot = document.createElement('div');
hudRoot.className = 'hud';
app.appendChild(hudRoot);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
const fogFar = RENDER_DISTANCE * CHUNK_SIZE;
scene.fog = new THREE.Fog(0x000000, fogFar * 0.55, fogFar);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const world = new World(scene, RENDER_DISTANCE);
const day = new DayCycle();
const sky = new Sky(scene);
const mobs = new MobManager(scene, world);
const villagers = new VillagerManager(scene, world);
const items = new ItemManager(scene, world);
const particles = new Particles(scene);
const sfx = new Sfx();
const inventory = new Inventory();
const hotbar = new Hotbar();

const spawnHeight = Math.max(terrainHeight(8, 8), SEA_LEVEL) + 2;
const player = new Player(8.5, spawnHeight, 8.5);
const hand = new Hand();
hand.setAspect(window.innerWidth / window.innerHeight);

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
);
highlight.visible = false;
scene.add(highlight);

const hud = new Hud(hudRoot, HOTBAR_SIZE);
const menu = new InventoryScreen(hudRoot, inventory, hotbar);
const trade = new TradeScreen(hudRoot, inventory);
const input = new Input(renderer.domElement);

hudRoot.addEventListener('mousedown', (event) => {
  if (menu.open || trade.open) return;
  event.preventDefault();
  void input.requestLock();
});

function refreshHotbar(): void {
  hud.setHotbar(
    hotbar.slots,
    hotbar.slots.map((id) => (id === null ? 0 : inventory.count(id))),
  );
  hud.setSelected(hotbar.selected);
}

function updateOverlay(): void {
  hud.setOverlayVisible(!input.locked && !menu.open && !trade.open);
}

menu.onClose = () => {
  updateOverlay();
  void input.requestLock();
};

menu.onChange = refreshHotbar;

trade.onClose = () => {
  updateOverlay();
  void input.requestLock();
};

trade.onChange = refreshHotbar;

input.onLockChange = (locked) => {
  if (locked) sfx.unlock();
  updateOverlay();
};

let difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY];
mobs.setDifficulty(difficulty);
hud.setDifficulty(difficulty.id);

hud.onSelectDifficulty = (id: DifficultyId) => {
  sfx.unlock();
  difficulty = DIFFICULTIES[id];
  mobs.setDifficulty(difficulty);
  hud.setDifficulty(id);
  void input.requestLock();
};

function openMenu(atTable: boolean): void {
  menu.show(atTable);
  document.exitPointerLock();
  updateOverlay();
}

function openTrade(villager: Villager): void {
  trade.show(villager);
  document.exitPointerLock();
  updateOverlay();
}

input.onKeyPress = (code) => {
  if (code === 'KeyE') {
    if (trade.open) trade.close();
    else if (menu.open) menu.close();
    else openMenu(false);
    return;
  }
  if (code === 'KeyF') player.toggleFly();
  if (code.startsWith('Digit')) {
    const index = Number(code.slice(5)) - 1;
    if (index >= 0 && index < HOTBAR_SIZE) {
      hotbar.selected = index;
      refreshHotbar();
    }
  }
};

function heldItem(): number | null {
  const id = hotbar.item;
  return id !== null && (isBlockItem(id) ? inventory.count(id) > 0 : true) ? id : null;
}

function breakSeconds(blockId: number, toolId: number | null): number {
  const def = BLOCKS[blockId];
  const tool = toolOf(toolId);
  const matches = tool !== null && tool.kind === def.tool;
  const speed = matches ? tool.speed : def.requiresTool ? 0.25 : 1;
  return (def.hardness * HARDNESS_SECONDS) / speed;
}

input.onMouseDown = (button) => {
  if (player.health <= 0 || menu.open || trade.open) return;

  const direction = forwardVector();
  const eye = player.eyePosition;
  const hit = raycast(world, eye, direction, REACH);
  const blockDistance = hit ? eye.distanceTo(hit.block.clone().addScalar(0.5)) : Infinity;
  hand.swing();

  if (button === 0) {
    if (attackTimer > 0) return;
    const mob = mobs.raycast(eye, direction, REACH);
    const villager = villagers.raycast(eye, direction, REACH);
    const damage = toolOf(heldItem())?.damage ?? FIST_DAMAGE;
    const knockback = direction.clone().setY(0).normalize();

    const mobFirst = (mob?.distance ?? Infinity) <= (villager?.distance ?? Infinity);
    if (mob && mobFirst && mob.distance < blockDistance) {
      attackTimer = ATTACK_COOLDOWN;
      mob.mob.hurt(damage, knockback);
    } else if (villager && villager.distance < blockDistance) {
      attackTimer = ATTACK_COOLDOWN;
      villager.villager.hurt(damage, knockback);
    }
  } else if (button === 2) {
    const villager = villagers.raycast(eye, direction, REACH);
    if (villager && villager.distance < blockDistance) {
      useOnVillager(villager.villager);
      return;
    }

    if (heldItem() === Item.Bread && inventory.take(Item.Bread)) {
      player.heal(BREAD_HEAL);
      hud.showToast('Ate bread');
      refreshHotbar();
      return;
    }

    if (!hit) return;
    const targetedBlock = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    if (targetedBlock === Block.CraftingTable) {
      openMenu(true);
      return;
    }

    const blockId = hotbar.item;
    if (blockId === null || !isBlockItem(blockId) || !isPlaceable(blockId)) return;

    const target = hit.block.clone().add(hit.normal);
    if (!overlapsPlayer(target) && inventory.take(blockId)) {
      world.setBlock(target.x, target.y, target.z, blockId);
      refreshHotbar();
    }
  }
};

/** Bread feeds a villager, otherwise the use key opens their trades. */
function useOnVillager(villager: Villager): void {
  if (heldItem() === Item.Bread && !villager.baby) {
    if (!villager.feed()) {
      hud.showToast(`${villager.name} is not hungry`);
      return;
    }
    inventory.take(Item.Bread);
    refreshHotbar();
    hud.showToast(`${villager.name} looks willing`);
    return;
  }

  if (!villager.canTrade) {
    hud.showToast(`${villager.name}: "Hrmm."`);
    return;
  }

  openTrade(villager);
}

const mining = { block: null as THREE.Vector3 | null, progress: 0, swingTimer: 0 };

function updateMining(dt: number): void {
  const active = input.locked && !menu.open && !trade.open && input.isMouseDown(0) && player.health > 0;
  const hit = active ? raycast(world, player.eyePosition, forwardVector(), REACH) : null;
  const blockId = hit ? world.getBlock(hit.block.x, hit.block.y, hit.block.z) : Block.Air;
  // A mob in the way is attacked instead of mining whatever is behind it.
  const blocked =
    hit !== null &&
    (mobs.raycast(player.eyePosition, forwardVector(), REACH)?.distance ?? Infinity) <
      player.eyePosition.distanceTo(hit.block.clone().addScalar(0.5));

  if (!hit || blocked || !isBreakable(blockId)) {
    mining.block = null;
    mining.progress = 0;
    hud.setMiningProgress(null);
    return;
  }

  if (!mining.block || !mining.block.equals(hit.block)) {
    mining.block = hit.block.clone();
    mining.progress = 0;
    mining.swingTimer = MINE_SWING_INTERVAL;
  }

  mining.swingTimer += dt;
  if (mining.swingTimer >= MINE_SWING_INTERVAL) {
    mining.swingTimer = 0;
    hand.swing();
  }

  const tool = heldItem();
  mining.progress += dt / breakSeconds(blockId, tool);
  hud.setMiningProgress(mining.progress);

  if (mining.progress < 1) return;

  const def = BLOCKS[blockId];
  const toolMatches = toolOf(tool)?.kind === def.tool;
  world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Air);
  if (blockId === Block.Glass) {
    particles.burst(GLASS_SHARD_COLOR, hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
    sfx.glassBreak();
  } else if (blockId === Block.Wheat) {
    sfx.cropBreak();
  }
  if (!def.requiresTool || toolMatches) {
    items.spawn(def.drop, hit.block.x + 0.5, hit.block.y + 0.2, hit.block.z + 0.5);
  }

  mining.block = null;
  mining.progress = 0;
  hud.setMiningProgress(null);
}

/** Shows whichever tool the current target would be handled with. */
function updateHeldItem(): void {
  hand.setHeldItem(heldItem());
}

function forwardVector(): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
}

function overlapsPlayer(block: THREE.Vector3): boolean {
  const p = player.position;
  return (
    block.x + 1 > p.x - 0.3 &&
    block.x < p.x + 0.3 &&
    block.y + 1 > p.y &&
    block.y < p.y + 1.8 &&
    block.z + 1 > p.z - 0.3 &&
    block.z < p.z + 0.3
  );
}

function updateHighlight(): void {
  const hit = raycast(world, player.eyePosition, forwardVector(), REACH);
  highlight.visible = hit !== null;
  if (hit) highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
}

function updateAtmosphere(): void {
  const eye = player.eyePosition;
  const eyeBlock = world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
  const inLava = eyeBlock === Block.Lava;
  const underwater = isWater(eyeBlock);
  const fog = scene.fog as THREE.Fog;
  const skyColor = day.skyColor;

  if (inLava) {
    (scene.background as THREE.Color).setHex(LAVA_COLOR);
    fog.color.copy(scene.background as THREE.Color);
    fog.near = 0.05;
    fog.far = 1.2;
  } else if (underwater) {
    (scene.background as THREE.Color).setHex(UNDERWATER_COLOR).multiplyScalar(day.brightness);
    fog.color.copy(scene.background as THREE.Color);
    fog.near = 0.1;
    fog.far = 18;
  } else {
    (scene.background as THREE.Color).copy(skyColor);
    fog.color.copy(skyColor);
    fog.near = fogFar * 0.55;
    fog.far = fogFar;
  }

  world.setDaylight(day.brightness);
  mobs.setDaylight(day.brightness);
  villagers.setDaylight(day.brightness);
  items.setDaylight(day.brightness);
  particles.setDaylight(day.brightness);
  hand.setDaylight(day.brightness);
  sky.setVisible(!underwater && !inLava);
  sky.update(camera.position, day);
}

function respawn(): void {
  const height = Math.max(terrainHeight(8, 8), SEA_LEVEL) + 2;
  player.respawn(8.5, height, 8.5);
  hud.showBanner(null);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  hand.setAspect(camera.aspect);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
let fps = 0;
let debugTimer = 0;
let physicsTimer = 0;
let attackTimer = 0;
let deathTimer = 0;
let flashTimer = 0;
let elapsed = 0;
let lastHealth = player.health;

function animate(): void {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  fps = fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;
  attackTimer = Math.max(0, attackTimer - dt);
  elapsed += dt;
  updateFluidAnimation(elapsed);

  // The world is frozen while the cursor is free, like single-player pause.
  const running = input.locked;
  if (running) {
    day.update(dt);

    physicsTimer += dt;
    while (physicsTimer >= PHYSICS_TICK) {
      physicsTimer -= PHYSICS_TICK;
      world.tickPhysics();
    }

    player.update(dt, input, world);
    mobs.update(dt, player, day, villagers);
    villagers.update(dt, player, day, mobs.mobs);
    items.update(dt, player, inventory);
    particles.update(dt);
  }

  updateMining(dt);
  updateHeldItem();
  hand.update(dt);
  hud.update(dt);

  // Burning drains health every frame, so the flash is rate-limited.
  flashTimer = Math.max(0, flashTimer - dt);
  if (player.health < lastHealth && flashTimer === 0) {
    hud.flashDamage();
    flashTimer = 0.45;
  }
  lastHealth = player.health;
  hud.setHealth(player.health, player.maxHealth);
  hud.setBurning(player.burning);
  if (player.health <= 0) {
    hud.showBanner('You died');
    deathTimer += dt;
    if (deathTimer > 2.5) {
      deathTimer = 0;
      respawn();
      lastHealth = player.health;
    }
  }

  player.applyTo(camera);
  world.update(player.position);
  updateHighlight();
  updateAtmosphere();

  debugTimer += dt;
  if (debugTimer > 0.25) {
    debugTimer = 0;
    const p = player.position;
    refreshHotbar();
    if (menu.open) menu.refresh();
    if (trade.open) trade.refresh();
    hud.setDebug(
      `${fps.toFixed(0)} fps | xyz ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} | ` +
        `chunks ${world.chunks.size} | mobs ${mobs.mobs.length} | villagers ${villagers.villagers.length} | ` +
        `items ${items.count} | ${day.clock} ${day.isNight ? 'night' : 'day'} | ${difficulty.name}`,
    );
  }

  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(hand.scene, hand.camera);
  renderer.autoClear = true;
}

renderer.setAnimationLoop(animate);
refreshHotbar();
