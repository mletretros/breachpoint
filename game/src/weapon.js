import { MathUtils, Vector3 } from 'three';

export const WEAPONS = [
  {
    id: 'vp9', name: 'VP-9', kind: 'pistol',
    damage: 32, headshotMultiplier: 2.0, rpm: 400, magSize: 12, reserve: 36,
    reloadSec: 1.5, spreadDeg: 0.8, recoilKick: 1.0,
    falloff: { start: 10, end: 30, minFactor: 0.5 }, auto: false, price: 200
  },
  {
    id: 'k7', name: 'K-7', kind: 'smg',
    damage: 22, headshotMultiplier: 1.5, rpm: 800, magSize: 30, reserve: 90,
    reloadSec: 1.2, spreadDeg: 1.2, recoilKick: 0.8,
    falloff: { start: 8, end: 20, minFactor: 0.3 }, auto: true, price: 1000
  },
  {
    id: 'ar4', name: 'AR-4', kind: 'rifle',
    damage: 40, headshotMultiplier: 2.5, rpm: 600, magSize: 30, reserve: 90,
    reloadSec: 2.0, spreadDeg: 0.4, recoilKick: 1.5,
    falloff: { start: 20, end: 50, minFactor: 0.7 }, auto: true, price: 2500
  },
  {
    id: 'm2', name: 'M-2', kind: 'marksman',
    damage: 85, headshotMultiplier: 3.0, rpm: 150, magSize: 10, reserve: 30,
    reloadSec: 2.5, spreadDeg: 0.1, recoilKick: 3.0,
    falloff: { start: 40, end: 80, minFactor: 0.9 }, auto: false, price: 4000
  }
];

export function createWeapon(id) {
  const def = WEAPONS.find(w => w.id === id);
  if (!def) throw new Error(`Unknown weapon: ${id}`);
  
  let reloadStartTime = 0;
  
  return {
    def,
    ammo: def.magSize,
    reserve: def.reserve,
    reloading: false,
    lastShotAt: 0,
    
    canFire(now) {
      if (this.reloading || this.ammo <= 0) return false;
      const delayMs = 60000 / def.rpm;
      return (now - this.lastShotAt) >= delayMs;
    },
    
    fire(now) {
      if (this.reloading) return { ok: false, reason: 'reloading' };
      if (this.ammo <= 0) return { ok: false, reason: 'empty' };
      
      const delayMs = 60000 / def.rpm;
      if (now - this.lastShotAt < delayMs) return { ok: false, reason: 'rate' };
      
      this.ammo--;
      this.lastShotAt = now;
      
      return { ok: true, spreadRad: MathUtils.degToRad(def.spreadDeg), recoil: def.recoilKick };
    },
    
    startReload(now) {
      if (this.reloading || this.ammo === def.magSize || this.reserve <= 0) return false;
      this.reloading = true;
      reloadStartTime = now;
      return true;
    },
    
    stepReload(now) {
      if (!this.reloading) return false;
      const progress = (now - reloadStartTime) / (def.reloadSec * 1000);
      if (progress >= 1.0) {
        const needed = def.magSize - this.ammo;
        const taken = Math.min(needed, this.reserve);
        this.ammo += taken;
        this.reserve -= taken;
        this.reloading = false;
        return true;
      }
      return false;
    },
    
    reloadProgress(now) {
      if (!this.reloading) return 0;
      return MathUtils.clamp((now - reloadStartTime) / (def.reloadSec * 1000), 0, 1);
    },
    
    addReserve(n) {
      this.reserve += n;
    }
  };
}

export function spreadFor(weapon, opts) {
  let spread = weapon.def.spreadDeg;
  if (opts.moving) spread *= 1.9;
  if (opts.crouched) spread *= 0.62;
  if (opts.airborne) spread *= 2.4;
  return MathUtils.degToRad(Math.min(spread, 6.0));
}

export function damageAt(weapon, distance) {
  const { start, end, minFactor } = weapon.def.falloff;
  if (distance <= start) return weapon.def.damage;
  if (distance >= end) return weapon.def.damage * minFactor;
  const t = (distance - start) / (end - start);
  return weapon.def.damage * (1 - t * (1 - minFactor));
}

export function hitscan(origin, direction, colliders) {
  let closestDist = Infinity;
  let closestBox = null;
  
  const invDx = 1.0 / direction.x;
  const invDy = 1.0 / direction.y;
  const invDz = 1.0 / direction.z;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    
    let tmin = (box.min.x - origin.x) * invDx;
    let tmax = (box.max.x - origin.x) * invDx;
    if (tmin > tmax) { const temp = tmin; tmin = tmax; tmax = temp; }

    let tymin = (box.min.y - origin.y) * invDy;
    let tymax = (box.max.y - origin.y) * invDy;
    if (tymin > tymax) { const temp = tymin; tymin = tymax; tymax = temp; }

    if ((tmin > tymax) || (tymin > tmax)) continue;
    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (box.min.z - origin.z) * invDz;
    let tzmax = (box.max.z - origin.z) * invDz;
    if (tzmin > tzmax) { const temp = tzmin; tzmin = tzmax; tzmax = temp; }

    if ((tmin > tzmax) || (tzmin > tmax)) continue;
    if (tzmin > tmin) tmin = tzmin;
    if (tzmax < tmax) tmax = tzmax;

    if (tmax > 0.0 && tmin < closestDist) {
      closestDist = tmin > 0.0 ? tmin : 0.0;
      closestBox = box;
    }
  }

  if (closestBox) {
    const point = new Vector3(
      origin.x + direction.x * closestDist,
      origin.y + direction.y * closestDist,
      origin.z + direction.z * closestDist
    );
    return { point, box: closestBox, distance: closestDist };
  }
  return null;
}
