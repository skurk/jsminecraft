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
import { BLOCKS, Block, blockSurface, isBreakable, isLava, isLog, isPlaceable, isWater } from "./world/blocks.js";
import { CHUNK_SIZE } from "./world/chunk.js";
import { SEA_LEVEL, biomeNameAt, terrainHeight } from "./world/terrain.js";
import { updateFluidAnimation } from "./world/textures.js";
import { World, raycast } from "./world/world.js";
import { Hud } from "./ui/hud.js";
import { InventoryScreen } from "./ui/inventory.js";
import { TradeScreen } from "./ui/trade.js";
const RENDER_DISTANCE = 6;
const REACH = 6;
const PHYSICS_TICK = 0.08;
const FIST_DAMAGE = 2;
const ATTACK_COOLDOWN = 0.35;
const GLASS_SHARD_COLOR = 0xcfe6f2;
const MINE_SWING_INTERVAL = 0.3;
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
const fogFar = RENDER_DISTANCE * CHUNK_SIZE;
scene.fog = new THREE.Fog(0x000000, fogFar * 0.55, fogFar);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const world = new World(scene, RENDER_DISTANCE);
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
    if (!hotbar.has(id)) {
        const free = hotbar.firstEmpty();
        if (free >= 0)
            hotbar.assign(free, id);
    }
    refreshHotbar();
};
/** Dry land with headroom; the cheap height test runs first so few chunks are generated. */
function findSpawn() {
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
input.onLockChange = updateOverlay;
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
    document.exitPointerLock();
    updateOverlay();
}
function openTrade(villager) {
    trade.show(villager);
    document.exitPointerLock();
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
input.onKeyPress = (code) => {
    if (code === 'KeyE') {
        if (trade.open)
            trade.close();
        else if (menu.open)
            menu.close();
        else
            openMenu(false);
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
const mining = { block: null, progress: 0, swingTimer: 0 };
function updateMining(dt) {
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
    else if (blockId === Block.Wheat) {
        audio.playCropBreak();
    }
    if (!def.requiresTool || toolMatches) {
        items.spawn(def.drop, hit.block.x + 0.5, hit.block.y + 0.2, hit.block.z + 0.5);
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
let debugTimer = 0;
let physicsTimer = 0;
let attackTimer = 0;
let eatTimer = 0;
let deathTimer = 0;
let flashTimer = 0;
let elapsed = 0;
let lastHealth = player.health;
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
            `chunks ${world.chunks.size} | mobs ${mobs.mobs.length} | villagers ${villagers.villagers.length} | items ${items.count} | ` +
            `${biomeNameAt(Math.floor(p.x), Math.floor(p.z))} | ${weather.label} | ` +
            `${day.clock} ${day.isNight ? 'night' : 'day'} | ${difficulty.name}`);
    }
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(hand.scene, hand.camera);
    renderer.autoClear = true;
}
renderer.setAnimationLoop(animate);
refreshHotbar();
