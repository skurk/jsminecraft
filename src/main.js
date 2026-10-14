import * as THREE from 'three';
import { DayCycle } from "./engine/daycycle.js";
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "./engine/difficulty.js";
import { Input } from "./engine/input.js";
import { audio } from "./engine/audio.js";
import { pushOutOfEntities } from "./engine/physics.js";
import { Sky } from "./engine/sky.js";
import { Weather } from "./engine/weather.js";
import { Explosions } from "./engine/explosion.js";
import { Particles } from "./engine/particles.js";
import { ItemManager } from "./entities/item.js";
import { MobManager } from "./entities/mobs.js";
import { VillagerManager } from "./entities/villagers.js";
import { CHICKEN } from "./entities/mob.js";
import { Item, foodOf, isBlockItem, isStackable, toolOf } from "./items/items.js";
import { Hand } from "./player/hand.js";
import { HOTBAR_SIZE, Hotbar } from "./player/hotbar.js";
import { Inventory } from "./player/inventory.js";
import { Player } from "./player/player.js";
import { BLOCKS, Block, DOOR_FACINGS, blockDrops, blockSurface, doorId, isBreakable, isCrop, isDoor, isDoorOpen, isLava, isLog, isPlaceable, isSowable, isTillable, isWater } from "./world/blocks.js";
import { CHUNK_SIZE } from "./world/chunk.js";
import { DoorManager } from "./world/doors.js";
import { SEA_LEVEL, biomeNameAt, terrainHeight } from "./world/terrain.js";
import { nearestVillage } from "./world/village.js";
import { updateFluidAnimation } from "./world/textures.js";
import { World, raycast } from "./world/world.js";
import { Hud } from "./ui/hud.js";
import { InventoryScreen } from "./ui/inventory.js";
import { TradeScreen } from "./ui/trade.js";
const RENDER_DISTANCE = 6;
/** Closest the view may be pulled in when the frame rate cannot keep up. */
const MIN_RENDER_DISTANCE = 3;
const TARGET_FPS = 60;
// Tolerances around the target, so a display capped at 60 does not shrink forever
// and the view does not oscillate between two distances.
const SHRINK_FPS = TARGET_FPS - 8;
const GROW_FPS = TARGET_FPS - 2;
const ADAPT_INTERVAL = 1.5;
/** Frames are unreliable until the first chunks are in, so adapting waits. */
const ADAPT_WARMUP = 4;
const REACH = 6;
const PHYSICS_TICK = 0.08;
const FIST_DAMAGE = 2;
const ATTACK_COOLDOWN = 0.35;
const GLASS_SHARD_COLOR = 0xcfe6f2;
/** Debris colour for each plant, so a cut crop scatters its own blades or straw. */
const PLANT_SHARD_COLORS = {
    [Block.TallGrass]: 0x5c9e3e,
    [Block.WheatSprout]: 0x6ea04a,
    [Block.WheatYoung]: 0x6ea04a,
    [Block.WheatTall]: 0x6ea04a,
    [Block.Wheat]: 0xcea83c,
};
const MINE_SWING_INTERVAL = 0.3;
/** Radians per second the view drifts behind the difficulty screen. */
const TITLE_PAN_SPEED = 0.06;
const EAT_COOLDOWN = 0.8;
/** Chance a thrown egg hatches where it lands. */
const EGG_HATCH_CHANCE = 0.25;
/** Seconds of mining per point of block hardness with bare hands. */
const HARDNESS_SECONDS = 1.4;
const UNDERWATER_COLOR = 0x12356b;
const LAVA_COLOR = 0x8a2a04;
/** Half-width of the area the starting position is drawn from. */
const SPAWN_RANGE = 4000;
const SPAWN_ATTEMPTS = 200;
/** Rings of regions searched for a village before giving up on ?spawnpoint=village. */
const VILLAGE_SEARCH_RINGS = 4;
/** Offsets from a village well to try standing on, along the road arms. */
const VILLAGE_SPAWN_OFFSETS = [];
for (const distance of [16, 12, 8])
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        VILLAGE_SPAWN_OFFSETS.push([dx * distance, dz * distance]);
const OVERCAST_COLOR = new THREE.Color(0x5c6572);
const LIGHTNING_COLOR = new THREE.Color(0xdfe7f5);
const app = document.querySelector('#app');
if (!app)
    throw new Error('Missing #app container');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);
const hudRoot = document.createElement('div');
hudRoot.className = 'hud';
app.appendChild(hudRoot);
const scene = new THREE.Scene();
scene.background = new THREE.Color();
let fogFar = RENDER_DISTANCE * CHUNK_SIZE;
scene.fog = new THREE.Fog(0x000000, fogFar * 0.55, fogFar);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const world = new World(scene, RENDER_DISTANCE);
const doors = new DoorManager(scene, world.solidMaterial);
world.onDoors = (chunkKey, list) => doors.sync(chunkKey, list);
const day = new DayCycle();
const sky = new Sky(scene);
const weather = new Weather(scene);
weather.onStrike = (distance) => audio.playThunder(distance);
const explosions = new Explosions(scene);
const mobs = new MobManager(scene, world);
const items = new ItemManager(scene, world);
const villagers = new VillagerManager(scene, world);
const particles = new Particles(scene);
mobs.onDropItem = (id, x, y, z) => items.spawn(id, x, y, z);
mobs.onShoot = (origin, direction, damage) => items.throwItem(Item.Arrow, origin, direction, { speed: 26, hurts: damage, lift: 0 });
mobs.onExplode = (position, power) => explosions.spawn(position, power);
items.onThrownBreak = (id, position) => {
    if (id === Item.Egg && Math.random() < EGG_HATCH_CHANCE)
        mobs.spawnAt(CHICKEN, position.clone());
};
const inventory = new Inventory();
const hotbar = new Hotbar();
// The hotbar starts bare, so the first of anything you collect claims a free slot.
items.onPickup = (id) => {
    audio.playPickup();
    if (!hotbar.has(id)) {
        const free = hotbar.firstEmpty();
        if (free >= 0)
            hotbar.assign(free, id);
    }
    refreshHotbar();
};
/** Dry land with headroom; the cheap height test runs first so few chunks are generated. */
function findSpawn() {
    if (new URLSearchParams(window.location.search).get('spawnpoint') === 'village') {
        const village = findVillageSpawn();
        if (village)
            return village;
    }
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
        const x = Math.floor((Math.random() * 2 - 1) * SPAWN_RANGE);
        const z = Math.floor((Math.random() * 2 - 1) * SPAWN_RANGE);
        const height = terrainHeight(x, z);
        if (height <= SEA_LEVEL + 1)
            continue;
        const ground = world.getBlock(x, height, z);
        if (isLava(ground) || !world.isSolidAt(x, height, z))
            continue;
        if (world.getBlock(x, height + 1, z) !== Block.Air)
            continue;
        if (world.getBlock(x, height + 2, z) !== Block.Air)
            continue;
        return new THREE.Vector3(x + 0.5, height + 1, z + 0.5);
    }
    return new THREE.Vector3(8.5, Math.max(terrainHeight(8, 8), SEA_LEVEL) + 2, 8.5);
}
/** A standable spot on the outskirts of the village nearest a random column. */
function findVillageSpawn() {
    const x = Math.floor((Math.random() * 2 - 1) * SPAWN_RANGE);
    const z = Math.floor((Math.random() * 2 - 1) * SPAWN_RANGE);
    const site = nearestVillage(x, z, VILLAGE_SEARCH_RINGS);
    if (!site)
        return null;
    for (const [dx, dz] of VILLAGE_SPAWN_OFFSETS) {
        const spot = standingSpot(site.centerX + dx, site.centerZ + dz, site.level);
        if (spot)
            return spot;
    }
    return null;
}
/**
 * The surface of a column near a known ground level. Villages flatten the land
 * they sit on, so the generated terrain height is no guide there.
 */
function standingSpot(x, z, level) {
    for (let y = level + 6; y > level - 8; y--) {
        if (!world.isSolidAt(x, y, z))
            continue;
        if (isLava(world.getBlock(x, y, z)))
            return null;
        if (world.getBlock(x, y + 1, z) !== Block.Air || world.getBlock(x, y + 2, z) !== Block.Air)
            return null;
        return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    }
    return null;
}
const spawnPoint = findSpawn();
const player = new Player(spawnPoint.x, spawnPoint.y, spawnPoint.z);
const hand = new Hand();
hand.setAspect(window.innerWidth / window.innerHeight);
const highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
highlight.visible = false;
scene.add(highlight);
const hud = new Hud(hudRoot, HOTBAR_SIZE);
const menu = new InventoryScreen(hudRoot, inventory, hotbar);
const trade = new TradeScreen(hudRoot, inventory);
const input = new Input(renderer.domElement);
// Browsers only let an AudioContext start from a user gesture, and suspend it
// again when the tab sleeps, so every gesture gets a chance to revive it.
const wakeAudio = () => audio.resume();
window.addEventListener('pointerdown', wakeAudio);
window.addEventListener('keydown', wakeAudio);
hudRoot.addEventListener('mousedown', (event) => {
    if (menu.open || trade.open)
        return;
    event.preventDefault();
    void input.requestLock();
});
function refreshHotbar() {
    hud.setHotbar(hotbar.slots, hotbar.slots.map((id) => (id === null ? 0 : inventory.count(id))));
    hud.setSelected(hotbar.selected);
}
function updateOverlay() {
    hud.setOverlayVisible(!input.locked && !input.resuming && !menu.open && !trade.open);
}
menu.onClose = () => {
    void input.requestLock();
    updateOverlay();
};
menu.onChange = refreshHotbar;
trade.onClose = () => {
    void input.requestLock();
    updateOverlay();
};
trade.onChange = refreshHotbar;
input.onLockChange = updateOverlay;
// Escape grants no user activation, so the pointer only comes back on the next input.
input.onLockBlocked = () => hud.showToast('Press any key to resume');
let difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY];
mobs.setDifficulty(difficulty);
hud.setDifficulty(difficulty.id);
hud.onSelectDifficulty = (id) => {
    difficulty = DIFFICULTIES[id];
    mobs.setDifficulty(difficulty);
    hud.setDifficulty(id);
    void input.requestLock();
};
function openMenu(atTable) {
    menu.show(atTable);
    input.releaseLock();
    updateOverlay();
}
function openTrade(villager) {
    trade.show(villager);
    input.releaseLock();
    updateOverlay();
}
/** Bread feeds a villager, otherwise the use key opens their trades. */
function useOnVillager(villager) {
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
/** A hoe turns the grass or dirt you are looking at into farmland. */
function tillSoil(hit) {
    const soil = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    if (!isTillable(soil) || hit.normal.y !== 1)
        return;
    if (world.getBlock(hit.block.x, hit.block.y + 1, hit.block.z) !== Block.Air)
        return;
    world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Farmland);
    audio.playHit('dirt');
}
/** Seeds take in farmland or plain grass, and start at the first sprout stage. */
function sowSeeds(hit) {
    const soil = world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    const target = hit.block.clone().add(hit.normal);
    if (!isSowable(soil) || hit.normal.y !== 1) {
        hud.showToast('Seeds need grass or farmland');
        return;
    }
    if (world.getBlock(target.x, target.y, target.z) !== Block.Air)
        return;
    if (!inventory.take(Item.Seeds))
        return;
    world.setBlock(target.x, target.y, target.z, Block.WheatSprout);
    refreshHotbar();
}
/** A door hangs facing whoever put it up, and takes up the two blocks above the ground. */
function placeDoor(hit) {
    if (hit.normal.y !== 1)
        return;
    const base = hit.block.clone().add(hit.normal);
    const head = { x: base.x, y: base.y + 1, z: base.z };
    if (world.getBlock(base.x, base.y, base.z) !== Block.Air || world.getBlock(head.x, head.y, head.z) !== Block.Air)
        return;
    if (overlapsPlayer(base) || overlapsPlayer(head))
        return;
    if (!inventory.take(Item.Door))
        return;
    const facing = doorFacingFromYaw();
    world.setBlock(base.x, base.y, base.z, doorId(false, facing, false));
    world.setBlock(head.x, head.y, head.z, doorId(true, facing, false));
    audio.playDoor(false);
    refreshHotbar();
}
/** The facing whose outward normal points back at the player. */
function doorFacingFromYaw() {
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    let best = 0;
    let bestDot = -Infinity;
    DOOR_FACINGS.forEach((facing, index) => {
        const dot = facing.dx * fx + facing.dz * fz;
        if (dot > bestDot) {
            bestDot = dot;
            best = index;
        }
    });
    return best;
}
/** Q throws one of the held stack on the ground, where it stays until picked up. */
function dropHeldItem() {
    if (!input.locked || menu.open || trade.open || player.health <= 0)
        return;
    const id = heldItem();
    if (id === null || !inventory.take(id))
        return;
    const direction = forwardVector();
    const origin = player.eyePosition.addScaledVector(direction, 0.4);
    origin.y -= 0.25;
    items.dropItem(id, origin, direction);
    // The last one thrown away leaves the slot free rather than an empty icon.
    if (inventory.count(id) === 0)
        hotbar.assign(hotbar.selected, null);
    hand.swing();
    refreshHotbar();
}
input.onKeyPress = (code) => {
    if (code === 'KeyE' || code === 'Escape') {
        if (hud.controlsOpen)
            hud.hideControls();
        else if (trade.open)
            trade.close();
        else if (menu.open)
            menu.close();
        else if (code === 'KeyE')
            openMenu(false);
        return;
    }
    if (code === 'KeyQ') {
        dropHeldItem();
        return;
    }
    if (code === 'KeyF')
        player.toggleFly();
    if (code.startsWith('Digit')) {
        const index = Number(code.slice(5)) - 1;
        if (index >= 0 && index < HOTBAR_SIZE) {
            hotbar.selected = index;
            refreshHotbar();
        }
    }
};
input.onScroll = (direction) => {
    if (menu.open)
        return;
    hotbar.selected = (hotbar.selected + direction + HOTBAR_SIZE) % HOTBAR_SIZE;
    refreshHotbar();
};
function heldItem() {
    const id = hotbar.item;
    return id !== null && (isStackable(id) ? inventory.count(id) > 0 : true) ? id : null;
}
function breakSeconds(blockId, toolId) {
    const def = BLOCKS[blockId];
    const tool = toolOf(toolId);
    const matches = tool !== null && tool.kind === def.tool;
    const speed = matches ? tool.speed : def.requiresTool ? 0.25 : 1;
    return (def.hardness * HARDNESS_SECONDS) / speed;
}
input.onMouseDown = (button) => {
    if (player.health <= 0 || menu.open || trade.open)
        return;
    const direction = forwardVector();
    const eye = player.eyePosition;
    const hit = raycast(world, eye, direction, REACH);
    const blockDistance = hit ? eye.distanceTo(hit.block.clone().addScalar(0.5)) : Infinity;
    hand.swing();
    if (button === 0) {
        if (attackTimer > 0)
            return;
        const target = mobs.raycast(eye, direction, REACH);
        const villager = villagers.raycast(eye, direction, REACH);
        const damage = toolOf(heldItem())?.damage ?? FIST_DAMAGE;
        const knockback = direction.clone().setY(0).normalize();
        const mobFirst = (target?.distance ?? Infinity) <= (villager?.distance ?? Infinity);
        if (target && mobFirst && target.distance < blockDistance) {
            attackTimer = ATTACK_COOLDOWN;
            target.mob.hurt(damage, knockback);
        }
        else if (villager && villager.distance < blockDistance) {
            attackTimer = ATTACK_COOLDOWN;
            villager.villager.hurt(damage, knockback);
        }
    }
    else if (button === 2) {
        const villager = villagers.raycast(eye, direction, REACH);
        if (villager && villager.distance < blockDistance) {
            useOnVillager(villager.villager);
            return;
        }
        const targetedBlock = hit ? world.getBlock(hit.block.x, hit.block.y, hit.block.z) : Block.Air;
        if (targetedBlock === Block.CraftingTable) {
            openMenu(true);
            return;
        }
        if (isDoor(targetedBlock)) {
            const open = !isDoorOpen(targetedBlock);
            const bottom = world.setDoorOpen(hit.block.x, hit.block.y, hit.block.z, open);
            doors.setOpen(hit.block.x, bottom, hit.block.z, open);
            audio.playDoor(open);
            return;
        }
        // Food wins over picking fruit, so you can eat while stood under a tree.
        const held = heldItem();
        const food = foodOf(held);
        if (food) {
            if (eatTimer > 0)
                return;
            if (player.health >= player.maxHealth) {
                hud.showToast('Already at full health');
                return;
            }
            if (!inventory.take(held))
                return;
            player.eat(food);
            hand.eat();
            eatTimer = EAT_COOLDOWN;
            refreshHotbar();
            return;
        }
        if (held === Item.Egg) {
            if (!inventory.take(Item.Egg))
                return;
            items.throwItem(Item.Egg, eye, direction);
            refreshHotbar();
            return;
        }
        if (!hit)
            return;
        if (toolOf(held)?.kind === 'hoe') {
            tillSoil(hit);
            return;
        }
        if (held === Item.Seeds) {
            sowSeeds(hit);
            return;
        }
        if (held === Item.Door) {
            placeDoor(hit);
            return;
        }
        const blockId = hotbar.item;
        if (blockId === null || !isBlockItem(blockId) || !isPlaceable(blockId))
            return;
        const target = hit.block.clone().add(hit.normal);
        if (!overlapsPlayer(target) && inventory.take(blockId)) {
            world.setBlock(target.x, target.y, target.z, blockId);
            refreshHotbar();
        }
    }
};
const mining = { block: null, progress: 0, swingTimer: 0 };function updateMining(dt) {
    const active = input.locked && !menu.open && !trade.open && input.isMouseDown(0) && player.health > 0;
    const hit = active ? raycast(world, player.eyePosition, forwardVector(), REACH) : null;
    const blockId = hit ? world.getBlock(hit.block.x, hit.block.y, hit.block.z) : Block.Air;
    // A mob in the way is attacked instead of mining whatever is behind it.
    const blocked = hit !== null &&
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
        audio.playHit(blockSurface(blockId));
    }
    const tool = heldItem();
    mining.progress += dt / breakSeconds(blockId, tool);
    hud.setMiningProgress(mining.progress);
    if (mining.progress < 1)
        return;
    const def = BLOCKS[blockId];
    const toolMatches = toolOf(tool)?.kind === def.tool;
    world.setBlock(hit.block.x, hit.block.y, hit.block.z, Block.Air);
    if (isLog(blockId))
        audio.playTumble();
    if (blockId === Block.Glass) {
        particles.burst(GLASS_SHARD_COLOR, hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
        audio.playGlassBreak();
    }
    else if (isCrop(blockId) || blockId === Block.TallGrass) {
        audio.playCropBreak();
        particles.burst(PLANT_SHARD_COLORS[blockId], hit.block.x + 0.5, hit.block.y + 0.45, hit.block.z + 0.5, 12, 0.55);
    }
    if (!def.requiresTool || toolMatches) {
        for (const drop of blockDrops(blockId))
            items.spawn(drop, hit.block.x + 0.5, hit.block.y + 0.2, hit.block.z + 0.5);
    }
    mining.block = null;
    mining.progress = 0;
    hud.setMiningProgress(null);
}
/** Shows whichever tool the current target would be handled with. */
function updateHeldItem() {
    // Swapping mid-bite would make the last apple vanish from the hand.
    if (!hand.eating)
        hand.setHeldItem(heldItem());
}
function forwardVector() {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
}
function setRenderDistance(distance) {
    const clamped = Math.max(MIN_RENDER_DISTANCE, Math.min(RENDER_DISTANCE, distance));
    if (clamped === world.renderDistance)
        return;
    world.renderDistance = clamped;
    fogFar = clamped * CHUNK_SIZE;
}
/** Pulls the view in while frames are slow, and lets it back out once they recover. */
function adaptRenderDistance() {
    if (fps < SHRINK_FPS)
        setRenderDistance(world.renderDistance - 1);
    // Streaming chunks cost frames of their own, so growing waits for a quiet moment.
    else if (fps > GROW_FPS && world.pendingChunks === 0)
        setRenderDistance(world.renderDistance + 1);
}
function overlapsPlayer(block) {
    const p = player.position;
    return (block.x + 1 > p.x - 0.3 &&
        block.x < p.x + 0.3 &&
        block.y + 1 > p.y &&
        block.y < p.y + 1.8 &&
        block.z + 1 > p.z - 0.3 &&
        block.z < p.z + 0.3);
}
function updateHighlight() {
    const hit = raycast(world, player.eyePosition, forwardVector(), REACH);
    highlight.visible = hit !== null;
    if (hit)
        highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
}
function updateAtmosphere(dt) {
    const eye = player.eyePosition;
    const eyeBlock = world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    const inLava = isLava(eyeBlock);
    const underwater = isWater(eyeBlock);
    const fog = scene.fog;
    const brightness = Math.min(1, day.brightness * weather.lightScale + weather.flash * 0.75);
    const skyColor = day.skyColor;
    skyColor.lerp(OVERCAST_COLOR, weather.overcast * day.daylight);
    skyColor.lerp(LIGHTNING_COLOR, weather.flash * 0.75);
    if (inLava) {
        scene.background.setHex(LAVA_COLOR);
        fog.color.copy(scene.background);
        fog.near = 0.05;
        fog.far = 1.2;
    }
    else if (underwater) {
        scene.background.setHex(UNDERWATER_COLOR).multiplyScalar(day.brightness);
        fog.color.copy(scene.background);
        fog.near = 0.1;
        fog.far = 18;
    }
    else {
        scene.background.copy(skyColor);
        fog.color.copy(skyColor);
        // Rain and storms close the view in.
        const reach = fogFar * (1 - weather.intensity * 0.35);
        fog.near = reach * 0.55;
        fog.far = reach;
    }
    world.setDaylight(brightness);
    mobs.setDaylight(brightness);
    villagers.setDaylight(brightness);
    particles.setDaylight(brightness);
    items.setDaylight(brightness);
    hand.setDaylight(brightness);
    sky.setVisible(!underwater && !inLava);
    sky.update(camera.position, day, dt, weather.overcast);
}
function respawn() {
    player.respawn(spawnPoint.x, spawnPoint.y, spawnPoint.z);
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
let adaptTimer = 0;
let debugTimer = 0;
let physicsTimer = 0;
let attackTimer = 0;
let eatTimer = 0;
let deathTimer = 0;
let flashTimer = 0;
let elapsed = 0;
let lastHealth = player.health;
// The background only pans until the first difficulty pick; pausing later keeps the view still.
let titleScreen = true;
const titlePanDirection = Math.random() < 0.5 ? -1 : 1;
function animate() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    fps = fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;
    attackTimer = Math.max(0, attackTimer - dt);
    eatTimer = Math.max(0, eatTimer - dt);
    elapsed += dt;
    updateFluidAnimation(elapsed);
    // The world is frozen while the cursor is free, like single-player pause.
    const running = input.locked;
    if (running && titleScreen) {
        titleScreen = false;
        hud.setTitleScreen(false);
    }
    else if (titleScreen)
        player.yaw += titlePanDirection * TITLE_PAN_SPEED * dt;
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
        if (!player.dead) {
            pushOutOfEntities(world, player, mobs.mobs);
            pushOutOfEntities(world, player, villagers.villagers);
        }
        items.update(dt, player, inventory);
        weather.update(dt, player, world, day);
    }
    // Snow falls silently, and a roof cuts the downpour off with it.
    audio.setRain(running && weather.falling && !weather.cold ? weather.intensity : 0);
    audio.setUnderwater(running && player.submerged ? 1 : 0);
    explosions.update(dt);
    particles.update(dt);
    doors.update(dt);
    updateMining(dt);
    updateHeldItem();
    hand.update(dt);
    // Burning drains health every frame, so the flash is rate-limited.
    flashTimer = Math.max(0, flashTimer - dt);
    if (player.health < lastHealth && flashTimer === 0) {
        hud.flashDamage();
        flashTimer = 0.45;
    }
    lastHealth = player.health;
    hud.setHealth(player.health, player.maxHealth);
    hud.setAir(player.airFraction);
    hud.setBurning(player.burning);
    hud.setSick(player.sick);
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
    updateAtmosphere(dt);
    adaptTimer += dt;
    if (running && elapsed > ADAPT_WARMUP && adaptTimer > ADAPT_INTERVAL) {
        adaptTimer = 0;
        adaptRenderDistance();
    }
    debugTimer += dt;
    if (debugTimer > 0.25) {
        debugTimer = 0;
        const p = player.position;
        refreshHotbar();
        if (menu.open)
            menu.refresh();
        if (trade.open)
            trade.refresh();
        hud.setDebug(`${fps.toFixed(0)} fps | xyz ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} | ` +
            `view ${world.renderDistance} | chunks ${world.chunks.size} | mobs ${mobs.mobs.length} | villagers ${villagers.villagers.length} | items ${items.count} | ` +
            `${biomeNameAt(Math.floor(p.x), Math.floor(p.z))} | ${weather.label} | ` +
            `${day.clock} ${day.isNight ? 'night' : 'day'} | ${difficulty.name}`);
    }
    renderer.render(scene, camera);
    if (!titleScreen) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(hand.scene, hand.camera);
        renderer.autoClear = true;
    }
}
renderer.setAnimationLoop(animate);
refreshHotbar();
hud.setTitleScreen(true);
