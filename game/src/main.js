import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon, damageAt, hitscan, spreadFor } from './weapon.js';
import { createBots } from './bots.js';
import { createMatch } from './match.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

let currentTime = 0;
let accumulator = 0;
let lastTime = typeof performance !== 'undefined' ? performance.now() : 0;
let frozen = false;
let audioResumed = false;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 18, 46);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const audio = createAudio();
const effects = createEffects(scene, camera);
const hud = createHud();

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    if (!audioResumed) { audio.resume(); audioResumed = true; }
    hud.hideOverlay();
    hud.currentOverlay = null;
  }
}

const input = createInput(renderer.domElement, onLockChange);

let lastShotOrigin = null;
let lastShotDirection = null;
let lastShotWallHit = null;
let lastShotNormal = null;
let killedInShot = false;

const playerEffects = {
  flash: () => effects.flash(),
  tracer: (from, to) => {
    effects.tracer(from, to);
    lastShotOrigin = from.clone();
    lastShotDirection = new THREE.Vector3().subVectors(to, from).normalize();
  },
  impact: (point, normal) => {
    lastShotWallHit = point.clone();
    lastShotNormal = normal.clone();
  }
};

const player = createPlayer(camera, { 
  world, 
  effects: playerEffects, 
  audio, 
  onHit: (amount, fromVec3) => {}
});

const bots = createBots(scene, { 
  world, 
  effects, 
  audio, 
  onKill: (bot) => {
    match.notifyBotKill();
    killedInShot = true;
    hud.killFeed('VANTA killed HALO');
    if (audio.kill) audio.kill();
  }, 
  onShot: (origin, dir) => {
    const maxDist = 100;
    const pBody = player.position.clone();
    pBody.y += player.eyeHeight / 2;
    const oc = new THREE.Vector3().subVectors(origin, pBody);
    const b = oc.dot(dir);
    const c = oc.dot(oc) - 0.4 * 0.4;
    let h = b * b - c;
    let hitPlayerDist = Infinity;
    if (h > 0.0) {
      h = Math.sqrt(h);
      const t = -b - h;
      if (t > 0 && t < maxDist) hitPlayerDist = t;
    }
    
    const hit = hitscan(origin, dir, world.colliders);
    if (hitPlayerDist !== Infinity && (!hit || hit.distance > hitPlayerDist)) {
       player.takeDamage(15, origin);
       if (player.health === 0) match.notifyPlayerDeath(currentTime);
    } else if (hit) {
       effects.impact(hit.point, new THREE.Vector3(0, 1, 0));
    }
  }, 
  seed 
});

const match = createMatch({ world, player, bots, audio, hud, seed });

hud.onPlay(() => {
  if (!audioResumed) { audio.resume(); audioResumed = true; }
  if (match.state.phase === 'matchEnd' || match.state.phase === 'warmup') {
    match.start(currentTime);
  }
  input.requestLock();
});

hud.onBuy((weaponId) => {
  if (match.buy(weaponId)) {
    hud.setRound(match.snapshot());
  }
});

window.addEventListener('mousedown', () => {
  if (!audioResumed) { audio.resume(); audioResumed = true; }
});
window.addEventListener('keydown', () => {
  if (!audioResumed) { audio.resume(); audioResumed = true; }
  if (input.state.keys.has('Escape') && !shot) {
    if (document.pointerLockElement) document.exitPointerLock();
  }
});

function step(dt) {
  currentTime += dt * 1000;
  
  const look = input.takeLook();
  const playerInput = {
    mouseDX: look.x,
    mouseDY: look.y,
    forward: input.state.keys.has('KeyW'),
    back: input.state.keys.has('KeyS'),
    left: input.state.keys.has('KeyA'),
    right: input.state.keys.has('KeyD'),
    jump: input.state.keys.has('Space'),
    crouch: input.state.keys.has('ControlLeft') || input.state.keys.has('KeyC'),
    sprint: input.state.keys.has('ShiftLeft'),
    firing: input.state.firing
  };
  
  player.update(dt, playerInput);
  
  const w = player.active();
  if (w && input.state.keys.has('KeyR')) {
    w.startReload(currentTime);
  }
  if (w) {
    if (w.stepReload(currentTime)) {
      if (audio.reloadClick) audio.reloadClick();
    }
  }
  
  if (input.state.firing && player.alive) {
    killedInShot = false;
    lastShotOrigin = null;
    lastShotDirection = null;
    lastShotWallHit = null;
    lastShotNormal = null;
    
    const isMoving = player.velocity.x ** 2 + player.velocity.z ** 2 > 0.1;
    const fireOpts = { moving: isMoving, crouched: player.crouched };
    const res = player.tryFire(currentTime, fireOpts);
    
    if (res.ok) {
      if (lastShotOrigin && lastShotDirection) {
        const botHit = bots.raycastBots(lastShotOrigin, lastShotDirection, res.hit ? res.hit.distance : 100);
        if (botHit) {
          const dmg = damageAt(w, botHit.distance);
          bots.damageBot(botHit.index, dmg, botHit.headshot);
          hud.hitMarker(killedInShot);
        } else if (res.hit && lastShotWallHit && lastShotNormal) {
          effects.impact(lastShotWallHit, lastShotNormal);
        }
      }
    }
  }
  
  bots.update(dt, currentTime, player.position, player.alive);
  let wasPhase = match.state.phase;
  match.update(dt, currentTime);
  const currentPhase = match.state.phase;
  
  if (wasPhase !== currentPhase) {
    if (currentPhase === 'buy' || currentPhase === 'roundEnd' || currentPhase === 'halftime' || currentPhase === 'matchEnd') {
      if (!shot && document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }
  
  effects.step(dt);
  
  if (!shot && !document.pointerLockElement) {
    const s = match.state;
    if (s.phase === 'buy') {
      if (hud.currentOverlay !== 'buy') { hud.showOverlay('buy', null); hud.currentOverlay = 'buy'; }
    } else if (s.phase === 'roundEnd' || s.phase === 'halftime') {
      const winner = s.scoreHalo > s.scoreVanta ? 'HALO' : 'VANTA';
      if (hud.currentOverlay !== 'roundEnd') { hud.showOverlay('roundEnd', winner); hud.currentOverlay = 'roundEnd'; }
    } else if (s.phase === 'matchEnd') {
      const winner = s.scoreHalo > s.scoreVanta ? 'HALO' : 'VANTA';
      if (hud.currentOverlay !== 'matchEnd') { hud.showOverlay('matchEnd', winner); hud.currentOverlay = 'matchEnd'; }
    } else if (s.phase === 'warmup') {
      if (hud.currentOverlay !== 'start') { hud.showOverlay('start', null); hud.currentOverlay = 'start'; }
    } else {
      if (hud.currentOverlay !== 'paused') { hud.showOverlay('paused', null); hud.currentOverlay = 'paused'; }
    }
  } else {
    hud.currentOverlay = null;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) return;
  
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    step(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (accumulator > FIXED_STEP * 5) accumulator = 0;
  
  const s = match.snapshot();
  hud.setRound(s);
  hud.setHealth(player.health, player.armour);
  if (player.active()) {
    const w = player.active();
    hud.setAmmo(w.ammo, w.reserve, w.reloading);
    hud.setWeapon(w.def.name);
    const isMoving = player.velocity.x ** 2 + player.velocity.z ** 2 > 0.1;
    const spreadOpts = { moving: isMoving, crouched: player.crouched, airborne: !player.onGround };
    hud.setCrosshairSpread(spreadFor(w, spreadOpts));
  }
  hud.setUplink(s.uplinkProgress, s.uplinkHolder);
  
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i++) {
    step(FIXED_STEP);
  }
}

function runShot(name) {
  hud.hideOverlay();
  match.start(0);
  
  if (name === 'buy') {
    player.respawnAt(0, 17);
    player.setLook(0, 0); // Z=17 is North, looks toward mid lane (which is around Z=0)
    settle(10);
    hud.showOverlay('buy', null);
  } else if (name === 'play') {
    match.buy('k7');
    settle(10);
    match.startLive(currentTime);
    player.respawnAt(2, 6);
    player.setLook(0, 0);
    bots.spawnWave(4, 1.0);
    settle(180);
    
    let foundYaw = 0;
    let foundPitch = 0;
    let minDist = Infinity;
    const origin = player.position.clone();
    origin.y += player.eyeHeight;
    for (let y = -Math.PI; y < Math.PI; y += 0.05) {
      for (let p = -0.5; p < 0.5; p += 0.05) {
        const dir = new THREE.Vector3(0, 0, -1);
        const euler = new THREE.Euler(p, y, 0, 'YXZ');
        dir.applyEuler(euler);
        const hit = bots.raycastBots(origin, dir, 100);
        if (hit && hit.distance < minDist) {
          minDist = hit.distance;
          foundYaw = y;
          foundPitch = p;
        }
      }
    }
    player.setLook(foundYaw, foundPitch);
    
    input.state.firing = true;
    for (let i = 0; i < 5; i++) {
      step(FIXED_STEP);
    }
    input.state.firing = false;
    hud.hideOverlay();
  } else if (name === 'site') {
    match.buy('ar4');
    settle(10);
    match.startLive(currentTime);
    player.respawnAt(-8, -3.2);
    player.setLook(0, 0);
    bots.spawnWave(4, 1.0);
    
    settle(30);
    match.state.uplinkProgress = 0.65;
    match.state.uplinkHolder = 'vanta';
    hud.hideOverlay();
  } else if (name === 'end') {
    match.state.scoreHalo = 5;
    match.state.scoreVanta = 4;
    match.endRound('halo', 'elimination', currentTime);
    settle(10);
    hud.showOverlay('matchEnd', 'HALO');
  }
  
  const s = match.snapshot();
  hud.setRound(s);
  hud.setHealth(player.health, player.armour);
  if (player.active()) {
    const w = player.active();
    hud.setAmmo(w.ammo, w.reserve, w.reloading);
    hud.setWeapon(w.def.name);
    hud.setCrosshairSpread(0.02);
  }
  hud.setUplink(s.uplinkProgress, s.uplinkHolder);
  
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) {
  runShot(shot);
} else {
  console.log('Breachpoint Booted');
  requestAnimationFrame(frame);
}
