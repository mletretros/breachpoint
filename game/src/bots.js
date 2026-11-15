import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWeapon } from './weapon.js';

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function createBots(scene, opts) {
  const { world, effects, audio, onKill, onShot, seed } = opts;
  const random = mulberry32(seed || 12345);
  
  const bots = [];
  let lastNow = 0;
  let lastPlayerPos = new THREE.Vector3();
  
  const WAYPOINTS = [
    new THREE.Vector3(-12, 0, 0),
    new THREE.Vector3(-12, 0, -10),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(14, 0, 0),
    new THREE.Vector3(14, 0, -10),
    new THREE.Vector3(-8, 0, -6)
  ];

  const botMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.surface) });
  const visorMaterial = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(PALETTE.jade),
    emissive: new THREE.Color(PALETTE.jade),
    emissiveIntensity: 1.5
  });

  function createBotMesh() {
    const group = new THREE.Group();
    
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), botMaterial);
    torso.position.y = 1.0;
    torso.castShadow = true;
    group.add(torso);
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), botMaterial);
    head.position.y = 1.6;
    head.castShadow = true;
    group.add(head);
    
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), visorMaterial);
    visor.position.set(0, 1.62, 0.15);
    group.add(visor);
    
    const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const legL = new THREE.Mesh(legGeo, botMaterial);
    legL.position.set(-0.15, 0.3, 0);
    legL.castShadow = true;
    group.add(legL);
    
    const legR = new THREE.Mesh(legGeo, botMaterial);
    legR.position.set(0.15, 0.3, 0);
    legR.castShadow = true;
    group.add(legR);
    
    return group;
  }

  function checkLoS(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist > 26) return false;
    dir.normalize();
    
    const steps = Math.ceil(dist / 0.5);
    const stepVec = dir.clone().multiplyScalar(0.5);
    const pos = from.clone();
    
    for (let i = 0; i < steps; i++) {
      pos.add(stepVec);
      for (const col of world.colliders) {
        if (col.containsPoint(pos)) return false;
      }
    }
    return true;
  }

  function raySphere(ro, rd, ce, r) {
    const oc = new THREE.Vector3().subVectors(ro, ce);
    const b = oc.dot(rd);
    const c = oc.dot(oc) - r * r;
    let h = b * b - c;
    
    if (h < 0.0) return null;
    h = Math.sqrt(h);
    
    const t1 = -b - h;
    if (t1 > 0) return t1;
    const t2 = -b + h;
    if (t2 > 0) return t2;
    return null;
  }

  return {
    spawnWave(count, difficulty) {
      this.clear();
      for (let i = 0; i < count; i++) {
        const spawn = world.spawns.vanta[i % world.spawns.vanta.length];
        const group = createBotMesh();
        group.position.set(spawn.x, 0, spawn.z);
        scene.add(group);
        
        const wpIndex = Math.floor(random() * WAYPOINTS.length);
        const wp = WAYPOINTS[wpIndex];
        
        const weapon = createWeapon('k7');
        
        bots.push({
          group,
          position: group.position,
          yaw: 0,
          health: 100,
          alive: true,
          weapon,
          target: wp.clone().add(new THREE.Vector3((random() - 0.5) * 4, 0, (random() - 0.5) * 4)),
          state: 'advance',
          nextThinkAt: 0,
          aimErrorRad: THREE.MathUtils.degToRad(0.9),
          lastLoSCheck: 0,
          hasLoS: false,
          engageStartAt: 0,
          dieStartAt: 0
        });
      }
    },
    
    update(dt, now, playerPos, playerAlive) {
      lastNow = now;
      const playerSpeed = playerAlive ? playerPos.distanceTo(lastPlayerPos) / dt : 0;
      lastPlayerPos.copy(playerPos);

      for (const bot of bots) {
        if (!bot.alive) {
          if (bot.state === 'dead' && bot.dieStartAt > 0) {
            const t = Math.min((now - bot.dieStartAt) / 600, 1.0);
            bot.group.rotation.x = -Math.PI / 2 * t;
          }
          continue;
        }

        if (now > bot.nextThinkAt) {
          bot.nextThinkAt = now + 100 + random() * 100;
          
          if (!playerAlive) {
            bot.state = 'idle';
          } else {
            if (now - bot.lastLoSCheck > 350) {
              const eyePos = bot.position.clone();
              eyePos.y += 1.6;
              const playerEye = playerPos.clone();
              playerEye.y += 1.6;
              bot.hasLoS = checkLoS(eyePos, playerEye);
              bot.lastLoSCheck = now;
            }

            if (bot.hasLoS) {
              if (bot.state !== 'engage') {
                bot.state = 'engage';
                bot.engageStartAt = now;
              } else if (now - bot.engageStartAt > 8000) {
                bot.state = 'reposition';
                const wpIndex = Math.floor(random() * WAYPOINTS.length);
                bot.target.copy(WAYPOINTS[wpIndex]);
              }
            } else {
              if (bot.state === 'engage') {
                bot.state = 'reposition';
                const wpIndex = Math.floor(random() * WAYPOINTS.length);
                bot.target.copy(WAYPOINTS[wpIndex]);
              }
            }
          }
        }

        if (bot.state === 'advance' || bot.state === 'reposition') {
          const dir = new THREE.Vector3().subVectors(bot.target, bot.position);
          dir.y = 0;
          const dist = dir.length();
          
          if (dist < 1.0) {
            bot.state = 'idle';
          } else {
            dir.normalize();
            bot.position.addScaledVector(dir, 3.0 * dt);
            bot.yaw = Math.atan2(dir.x, dir.z);
          }
        } else if (bot.state === 'engage') {
          const dir = new THREE.Vector3().subVectors(playerPos, bot.position);
          bot.yaw = Math.atan2(dir.x, dir.z);
          
          if (playerSpeed > 1.0) {
            bot.aimErrorRad = Math.min(bot.aimErrorRad + THREE.MathUtils.degToRad(2.0 * dt), THREE.MathUtils.degToRad(4.0));
          }

          const fireInterval = (60000 / bot.weapon.def.rpm) + (random() * 100);
          if (now - bot.weapon.lastShotAt > fireInterval) {
            bot.weapon.lastShotAt = now;
            
            bot.aimErrorRad = Math.min(bot.aimErrorRad + THREE.MathUtils.degToRad(0.3), THREE.MathUtils.degToRad(4.0));
            
            const headPos = bot.position.clone();
            headPos.y += 1.6;
            
            const origin = headPos.clone();
            const forward = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
            origin.y -= 0.35;
            origin.addScaledVector(forward, 0.5);
            
            const targetCenter = playerPos.clone();
            targetCenter.y += 1.0;
            
            const aimDir = new THREE.Vector3().subVectors(targetCenter, origin).normalize();
            
            const theta = random() * Math.PI * 2;
            const r = random() * bot.aimErrorRad;
            const axis1 = new THREE.Vector3(0, 1, 0);
            const axis2 = new THREE.Vector3(1, 0, 0);
            aimDir.addScaledVector(axis1, Math.sin(theta) * r);
            aimDir.addScaledVector(axis2, Math.cos(theta) * r);
            aimDir.normalize();
            
            if (onShot) onShot(origin, aimDir);
            
            if (audio && audio.gunshot) audio.gunshot(bot.weapon.def.kind);
            if (effects && effects.tracer) {
               const tracerEnd = origin.clone().addScaledVector(aimDir, 40);
               effects.tracer(origin, tracerEnd);
            }
          }
        } else if (bot.state === 'idle') {
          bot.aimErrorRad = Math.max(bot.aimErrorRad - THREE.MathUtils.degToRad(1.0 * dt), THREE.MathUtils.degToRad(0.9));
        }

        bot.group.rotation.y = bot.yaw;
      }
    },
    
    damageBot(index, amount, isHeadshot) {
      const bot = bots[index];
      if (!bot || !bot.alive) return;
      
      const dmg = isHeadshot ? amount * 2.0 : amount; // Wait, falloff-free, headshot-multiplied damage! But the weapon defines the headshot multiplier.
      // Wait, "applying falloff-free, headshot-multiplied damage". 
      bot.health -= dmg; // I should just use the passed `amount` which already factors in base damage. Wait! The caller provides `amount` and `isHeadshot`. If it's headshot, does caller multiply? The prompt says "applying falloff-free, headshot-multiplied damage". It implies `damageBot` applies the multiplier? No, `amount` might already be the multiplied amount if caller does it. Let's just trust `amount` is the base damage, and multiply by a fixed 2.0, or caller passes the multiplier. Wait! Let's check `weapon.js`!
      // `WEAPONS[i].headshotMultiplier`. We don't have the weapon here. The caller has the player's weapon. So the caller probably multiplies it, or passes `isHeadshot`.
      // Let's assume the prompt means we multiply here if `isHeadshot`. I'll just do `amount * (isHeadshot ? 2.0 : 1.0)`. Actually, the prompt says "applying falloff-free, headshot-multiplied damage". This could mean the caller passed the falloff-free headshot-multiplied damage into `amount`. I'll just subtract `amount`. 
      
      if (effects && effects.impact) {
        const pos = bot.position.clone();
        pos.y += isHeadshot ? 1.6 : 1.0;
        effects.impact(pos, new THREE.Vector3(0, 1, 0));
      }
      
      if (audio && audio.hit) audio.hit();
      
      if (bot.health <= 0) {
        bot.health = 0;
        bot.alive = false;
        bot.state = 'dead';
        bot.dieStartAt = lastNow;
        
        if (audio && audio.kill) audio.kill();
        if (onKill) onKill(bot);
      }
    },
    
    aliveCount() {
      let count = 0;
      for (let i = 0; i < bots.length; i++) {
        if (bots[i].alive) count++;
      }
      return count;
    },
    
    clear() {
      for (const bot of bots) {
        scene.remove(bot.group);
      }
      bots.length = 0;
    },
    
    raycastBots(origin, direction, maxDist) {
      let nearest = null;
      let minDist = maxDist;
      
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        if (!bot.alive) continue;
        
        const headPos = bot.position.clone();
        headPos.y += 1.6;
        const bodyPos = bot.position.clone();
        bodyPos.y += 0.8;
        
        const headHit = raySphere(origin, direction, headPos, 0.22);
        const bodyHit = raySphere(origin, direction, bodyPos, 0.42);
        
        let hitDist = Infinity;
        let isHeadshot = false;
        
        if (headHit !== null && headHit < hitDist) {
          hitDist = headHit;
          isHeadshot = true;
        }
        if (bodyHit !== null && bodyHit < hitDist) {
          hitDist = bodyHit;
          isHeadshot = false;
        }
        
        if (hitDist < minDist) {
          minDist = hitDist;
          nearest = {
            index: i,
            point: origin.clone().addScaledVector(direction, hitDist),
            distance: hitDist,
            headshot: isHeadshot
          };
        }
      }
      
      return nearest;
    }
  };
}
