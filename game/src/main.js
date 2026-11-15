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
import { createViewmodel } from './viewmodel.js';

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

const world = createWorld(scene, renderer);
const audio = createAudio();
const effects = createEffects(scene, camera);
const hud = createHud();
const viewmodel = createViewmodel(camera, PALETTE);

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
    if (match.state.phase !== 'live' || !player.alive) return;
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

let lastWeaponId = null;

function step(dt) {
  const wasPhase = match.state.phase;
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
  if (w && player.alive && match.state.phase === 'live' && input.state.keys.has('KeyR')) {
    w.startReload(currentTime);
  }
  
  if (w) {
    if (w.def.id !== lastWeaponId) {
      viewmodel.set(w.def.id);
      lastWeaponId = w.def.id;
    }
    viewmodel.visible(true);
    viewmodel.reload(w.reloadProgress(currentTime));
    if (w.stepReload(currentTime)) {
      if (audio.reloadClick) audio.reloadClick();
    }
  } else {
    viewmodel.visible(false);
  }
  
  const isMoving = player.velocity.x ** 2 + player.velocity.z ** 2 > 0.1;
  viewmodel.lower(player.sprinting);
  viewmodel.sway(dt, playerInput.mouseDX, playerInput.mouseDY, isMoving, player.crouched);

  if (match.state.phase === 'live' && input.state.firing && player.alive) {
    killedInShot = false;
    lastShotOrigin = null;
    lastShotDirection = null;
    lastShotWallHit = null;
    lastShotNormal = null;
    
    const isMoving = player.velocity.x ** 2 + player.velocity.z ** 2 > 0.1;
    const fireOpts = { moving: isMoving, crouched: player.crouched };
    const res = player.tryFire(currentTime, fireOpts);
    
    if (res.ok) {
      viewmodel.kick(res.recoil);
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
  
  if (match.state.phase === 'live') bots.update(dt, currentTime, player.position, player.alive);
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
      const winner = s.roundWinner.toUpperCase();
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
    match.state.phase = 'buy';
    match.state.roundNumber = 1;
    player.setLook(0, 0);
    bots.spawnWave(3, 1.0);
    settle(10);
    hud.showOverlay('buy', null);
  } else if (name === 'play') {
    match.state.credits = 5000;
    match.buy('k7');
    match.buy('armour');
    match.startLive(currentTime);
    match.state.roundNumber = 3;
    player.respawnAt(1.5, 7);
    player.setLook(0, 0);
    bots.spawnWave(3, 1.0);
    bots.list[0].position.set(1.5, 0, -5);
    bots.list[1].position.set(2.5, 0, -8);
    bots.list[2].position.set(0.5, 0, -6);
    
    bots.damageBot(2, 1000, true);
    settle(40);
    
    player.health = 78;
    player.armour = 45;
    player.active().ammo = 15;
    
    input.state.firing = true;
    for (let i = 0; i < 3; i++) {
      step(FIXED_STEP);
    }
    input.state.firing = false;
    hud.hideOverlay();
  } else if (name === 'site') {
    match.state.credits = 4000;
    match.buy('ar4');
    match.buy('armour');
    match.startLive(currentTime);
    match.state.roundNumber = 5;
    player.respawnAt(-6.3, -6);
    player.setLook(Math.PI / 2, 0);
    
    bots.spawnWave(2, 1.0);
    bots.list[0].position.set(-14, 0, -5);
    bots.list[1].position.set(-15, 0, -7);
    
    settle(10);
    // Capture a real accumulated transmission using the match's simulation.
    for (let i = 0; i < 330; i++) {
      currentTime += FIXED_STEP * 1000;
      match.update(FIXED_STEP, currentTime);
    }
    hud.hideOverlay();
  } else if (name === 'end') {
    match.state.scoreHalo = 4;
    match.state.scoreVanta = 4;
    match.state.roundNumber = 9;
    settle(30);
    match.startLive(currentTime);
    player.takeDamage(100, player.position);
    match.notifyPlayerDeath(currentTime);
    if (match.state.phase !== 'matchEnd') throw new Error('End capture did not finish the match');
    settle(10);
    hud.showOverlay('matchEnd', match.state.roundWinner.toUpperCase());
  }
  
  const s = match.snapshot();
  hud.setRound(s);
  hud.setHealth(player.health, player.armour);
  if (player.active()) {
    const w = player.active();
    hud.setAmmo(w.ammo, w.reserve, w.reloading);
    hud.setWeapon(w.def.name);
    hud.setCrosshairSpread(0.02);
    
    viewmodel.set(w.def.id);
    if (name === 'play') {
      viewmodel.kick(w.def.recoilKick || 1.5);
    }
  }
  viewmodel.sway(FIXED_STEP, 0, 0, false, false);
  hud.setUplink(s.uplinkProgress, s.uplinkHolder);
  
  paintTwiceThenReady();
  window.__shotState = { ...s, health: player.health, botsAlive: bots.aliveCount() };
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
