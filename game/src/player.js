import { Vector3, Box3, Group, CapsuleGeometry, MeshStandardMaterial, Mesh, BoxGeometry, MathUtils } from 'three';
import { createWeapon, spreadFor, hitscan } from './weapon.js';

export function createPlayer(camera, opts) {
  let currentWeapon = null;
  
  const player = {
    position: new Vector3(),
    velocity: new Vector3(),
    yaw: 0,
    pitch: 0,
    health: 100,
    armour: 0,
    alive: true,
    crouched: false,
    onGround: false,
    eyeHeight: 1.72,
    mirrorGroup: null,
    sprinting: false,
    lastHitAt: 0,
    
    equip(id) {
      currentWeapon = createWeapon(id);
    },
    
    active() {
      return currentWeapon;
    },
    
    tryFire(now, fireOpts) {
      if (!currentWeapon) return { ok: false, reason: 'unarmed' };
      
      const isMoving = player.velocity.x ** 2 + player.velocity.z ** 2 > 0.1;
      const spreadOpts = { moving: isMoving, crouched: player.crouched, airborne: !player.onGround };
      const spreadRad = spreadFor(currentWeapon, spreadOpts);
      
      const result = currentWeapon.fire(now);
      if (!result.ok) return result;
      
      const kick = MathUtils.degToRad(result.recoil) * (Math.random() * 0.4 + 0.8);
      player.pitch += kick;
      
      const origin = camera.position.clone();
      const direction = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRad;
      const axis1 = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const axis2 = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      direction.addScaledVector(axis1, Math.sin(theta) * r);
      direction.addScaledVector(axis2, Math.cos(theta) * r);
      direction.normalize();
      
      opts.audio?.gunshot?.(currentWeapon.def.kind);
      opts.effects?.flash?.();
      
      const hit = hitscan(origin, direction, opts.world.colliders);
      if (hit) {
        const eps = 0.005;
        let normal = new Vector3(0, 1, 0);
        if (Math.abs(hit.point.x - hit.box.min.x) < eps) normal.set(-1, 0, 0);
        else if (Math.abs(hit.point.x - hit.box.max.x) < eps) normal.set(1, 0, 0);
        else if (Math.abs(hit.point.y - hit.box.min.y) < eps) normal.set(0, -1, 0);
        else if (Math.abs(hit.point.y - hit.box.max.y) < eps) normal.set(0, 1, 0);
        else if (Math.abs(hit.point.z - hit.box.min.z) < eps) normal.set(0, 0, -1);
        else if (Math.abs(hit.point.z - hit.box.max.z) < eps) normal.set(0, 0, 1);
        
        opts.effects?.impact?.(hit.point, normal);
      }
      
      const tracerEnd = hit ? hit.point : origin.clone().addScaledVector(direction, 100);
      opts.effects?.tracer?.(origin, tracerEnd);
      
      return { ...result, hit };
    },
    
    takeDamage(amount, fromVec3) {
      if (!player.alive) return;
      
      let dmg = amount;
      if (player.armour > 0) {
        if (player.armour >= dmg) {
          player.armour -= dmg;
          dmg = 0;
        } else {
          dmg -= player.armour;
          player.armour = 0;
        }
      }
      
      player.health = Math.max(0, player.health - dmg);
      player.lastHitAt = Date.now();
      
      if (player.health === 0) {
        player.alive = false;
      }
      
      opts.onHit?.(amount, fromVec3);
    },
    
    respawnAt(x, z) {
      player.position.set(x, 2.0, z);
      player.velocity.set(0, 0, 0);
      player.health = 100;
      player.alive = true;
      player.lastHitAt = 0;
    },
    
    setLook(yawRad, pitchRad) {
      player.yaw = yawRad;
      player.pitch = pitchRad;
    },
    
    mirror() {
      const group = new Group();
      
      const bodyGeo = new CapsuleGeometry(0.3, 1.2, 4, 8);
      const bodyMat = new MeshStandardMaterial({ color: 0x444444 });
      const bodyMesh = new Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0.9;
      group.add(bodyMesh);
      
      const headGroup = new Group();
      headGroup.position.y = 1.65;
      
      const headGeo = new BoxGeometry(0.25, 0.25, 0.25);
      const headMat = new MeshStandardMaterial({ color: 0xaaaaaa });
      const headMesh = new Mesh(headGeo, headMat);
      headGroup.add(headMesh);
      
      const stubGeo = new BoxGeometry(0.1, 0.1, 0.3);
      const stubMesh = new Mesh(stubGeo, new MeshStandardMaterial({ color: 0xff0000 }));
      stubMesh.position.z = -0.25;
      headGroup.add(stubMesh);
      
      group.add(headGroup);
      
      player.mirrorGroup = group;
      return group;
    },
    
    update(dt, input) {
      if (!player.alive) return;
      
      const SENSITIVITY = 0.002;
      player.yaw -= input.mouseDX * SENSITIVITY;
      player.pitch -= input.mouseDY * SENSITIVITY;
      
      const limit = MathUtils.degToRad(88);
      player.pitch = MathUtils.clamp(player.pitch, -limit, limit);
      
      player.crouched = input.crouch;
      
      let targetSpeed = 3.4;
      player.sprinting = false;
      if (player.crouched) {
        targetSpeed = 1.9;
      } else if (input.sprint && input.forward && !input.firing) {
        targetSpeed = 5.1;
        player.sprinting = true;
      }
      
      const MAX_STEP = 1.0 / 30.0;
      let remaining = dt;
      
      while (remaining > 0) {
        const stepDt = Math.min(remaining, MAX_STEP);
        remaining -= stepDt;
        
        const accel = player.onGround ? 10.0 : 2.0;
        const friction = player.onGround ? 8.0 : 0.0;
        
        const speed = Math.sqrt(player.velocity.x**2 + player.velocity.z**2);
        if (speed > 0) {
          const drop = speed * friction * stepDt;
          const newSpeed = Math.max(speed - drop, 0);
          const ratio = newSpeed / speed;
          player.velocity.x *= ratio;
          player.velocity.z *= ratio;
        }
        
        const moveDir = new Vector3();
        if (input.forward) moveDir.z -= 1;
        if (input.back) moveDir.z += 1;
        if (input.left) moveDir.x -= 1;
        if (input.right) moveDir.x += 1;
        
        if (moveDir.lengthSq() > 0) {
          moveDir.normalize();
          moveDir.applyAxisAngle(new Vector3(0, 1, 0), player.yaw);
          const currentSpeed = player.velocity.x * moveDir.x + player.velocity.z * moveDir.z;
          const addSpeed = targetSpeed - currentSpeed;
          if (addSpeed > 0) {
            const accelSpeed = Math.min(accel * targetSpeed * stepDt, addSpeed);
            player.velocity.x += moveDir.x * accelSpeed;
            player.velocity.z += moveDir.z * accelSpeed;
          }
        }
        
        if (player.onGround && input.jump) {
          player.velocity.y = 4.5;
          player.velocity.x *= 0.88;
          player.velocity.z *= 0.88;
          player.onGround = false;
        }
        
        player.velocity.y -= 15.0 * stepDt;
        
        const r = 0.3;
        const h = player.crouched ? 1.23 : 1.8;
        
        const getBox = () => new Box3(
          new Vector3(player.position.x - r, player.position.y, player.position.z - r),
          new Vector3(player.position.x + r, player.position.y + h, player.position.z + r)
        );
        
        player.position.x += player.velocity.x * stepDt;
        let box = getBox();
        for (let i = 0; i < opts.world.colliders.length; i++) {
          const col = opts.world.colliders[i];
          if (box.intersectsBox(col)) {
            if (player.velocity.x > 0) player.position.x = col.min.x - r - 0.001;
            else if (player.velocity.x < 0) player.position.x = col.max.x + r + 0.001;
            player.velocity.x = 0;
            box = getBox();
          }
        }
        
        player.position.z += player.velocity.z * stepDt;
        box = getBox();
        for (let i = 0; i < opts.world.colliders.length; i++) {
          const col = opts.world.colliders[i];
          if (box.intersectsBox(col)) {
            if (player.velocity.z > 0) player.position.z = col.min.z - r - 0.001;
            else if (player.velocity.z < 0) player.position.z = col.max.z + r + 0.001;
            player.velocity.z = 0;
            box = getBox();
          }
        }
        
        player.position.y += player.velocity.y * stepDt;
        box = getBox();
        player.onGround = false;
        for (let i = 0; i < opts.world.colliders.length; i++) {
          const col = opts.world.colliders[i];
          if (box.intersectsBox(col)) {
            if (player.velocity.y < 0) {
              player.position.y = col.max.y;
              player.onGround = true;
            } else if (player.velocity.y > 0) {
              player.position.y = col.min.y - h - 0.001;
            }
            player.velocity.y = 0;
            box = getBox();
          }
        }
        
        player.position.x = MathUtils.clamp(player.position.x, -20 + r, 20 - r);
        player.position.z = MathUtils.clamp(player.position.z, -20 + r, 20 - r);
      }
      
      const targetEye = player.crouched ? 1.15 : 1.72;
      player.eyeHeight += (targetEye - player.eyeHeight) * 10.0 * dt;
      
      camera.position.copy(player.position);
      camera.position.y += player.eyeHeight;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      
      if (player.mirrorGroup) {
        player.mirrorGroup.position.copy(player.position);
        player.mirrorGroup.rotation.y = player.yaw;
        player.mirrorGroup.children[1].rotation.x = player.pitch;
      }
    }
  };
  
  return player;
}
