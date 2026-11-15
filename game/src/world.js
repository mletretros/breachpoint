import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    const isSteel = name === 'steel';
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: isSteel ? 0.55 : 0.9,
      metalness: isSteel ? 0.35 : 0.05,
    });
  }
  materials.jadeGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.jade),
    emissive: new THREE.Color(PALETTE.jade),
    emissiveIntensity: 1.4,
    roughness: 0.9,
    metalness: 0.05,
  });

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Floor: 40x40m
  box(40, 0.4, 40, 0, -0.2, 0, 'surface');

  // Perimeter walls: 5m high
  box(40, 5, 0.4, 0, 2.5, -20.2, 'surface');
  box(40, 5, 0.4, 0, 2.5, 20.2, 'surface');
  box(0.4, 5, 40, -20.2, 2.5, 0, 'surface');
  box(0.4, 5, 40, 20.2, 2.5, 0, 'surface');

  // Map Layout: Cinder Yard
  // Mid corridor: simple walls splitting mid
  box(1.5, 2.2, 8, -4, 1.1, 0, 'surface');
  box(1.5, 2.2, 8, 4, 1.1, 0, 'surface');

  // Mid cover
  box(2, 1.0, 1.2, 0, 0.5, 5, 'steel'); // crouch cover south
  box(2, 1.0, 1.2, 0, 0.5, -5, 'steel'); // crouch cover north
  box(1.2, 1.8, 1.2, 0, 0.9, 0, 'steel'); // full cover mid

  // West loading dock (x: -12 to -18)
  box(3, 2.2, 6, -15, 1.1, 8, 'steel');
  box(3, 2.2, 6, -15, 1.1, -8, 'steel');
  box(3, 2.2, 6, -11, 1.1, 0, 'steel');
  // Dock cover
  box(1.5, 1.0, 1.5, -11, 0.5, 7, 'hairline');
  box(1.5, 1.8, 1.5, -15, 0.9, 0, 'hairline');

  // East pipe gallery (x: 12 to 18)
  box(4, 2.2, 2, 16, 1.1, 10, 'surface');
  box(4, 2.2, 2, 16, 1.1, -10, 'surface');
  box(2, 2.2, 12, 12, 1.1, 0, 'surface');
  box(1.2, 1.1, 2.4, 16, 0.55, 0, 'steel'); // crouch cover

  // Additional covers along lanes
  box(1.2, 1.0, 1.2, -6, 0.5, 12, 'steel');
  box(1.2, 1.0, 1.2, 6, 0.5, 12, 'steel');
  box(1.2, 1.0, 1.2, 6, 0.5, -12, 'steel');
  box(1.2, 1.8, 1.2, -6, 0.9, -12, 'steel');

  // Site B7: 5x5 pad at x=-8, z=-6, 0.25m high
  const padCenterX = -8;
  const padCenterZ = -6;
  const padY = 0.25;
  const padMesh = box(5, padY, 5, padCenterX, padY / 2, padCenterZ, 'surface');
  const pads = [new THREE.Box3().setFromObject(padMesh)];
  const padCenter = new THREE.Vector3(padCenterX, padY, padCenterZ);
  const padRadius = 2.2;

  // Railing on 3 sides (north, west, south)
  box(5, 0.8, 0.2, padCenterX, padY + 0.4, padCenterZ - 2.4, 'steel');
  box(5, 0.8, 0.2, padCenterX, padY + 0.4, padCenterZ + 2.4, 'steel');
  box(0.2, 0.8, 5, padCenterX - 2.4, padY + 0.4, padCenterZ, 'steel');

  // Jade rim light strip
  box(4.8, 0.05, 0.1, padCenterX, padY + 0.025, padCenterZ + 2.3, 'jadeGlow');
  box(4.8, 0.05, 0.1, padCenterX, padY + 0.025, padCenterZ - 2.3, 'jadeGlow');
  box(0.1, 0.05, 4.8, padCenterX - 2.3, padY + 0.025, padCenterZ, 'jadeGlow');
  box(0.1, 0.05, 4.8, padCenterX + 2.3, padY + 0.025, padCenterZ, 'jadeGlow');

  // Spawns
  const spawns = {
    vanta: [
      { x: -4, z: 18 },
      { x: -1, z: 17 },
      { x: 2, z: 19 },
      { x: 5, z: 18 },
    ],
    halo: [
      { x: -5, z: -18 },
      { x: -2, z: -17 },
      { x: 1, z: -19 },
      { x: 4, z: -18 },
    ],
  };

  // Lamps: 4 sodium point lights
  const lamps = [];
  const lampPositions = [
    { x: -12, y: 4, z: 12 },
    { x: 12, y: 4, z: 12 },
    { x: -12, y: 4, z: -12 },
    { x: 12, y: 4, z: -12 },
  ];
  for (const pos of lampPositions) {
    const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 9, 22, 2);
    light.position.set(pos.x, pos.y, pos.z);
    scene.add(light);
    lamps.push(light);
  }

  // Lighting
  const sky = new THREE.HemisphereLight(new THREE.Color(PALETTE.surface), new THREE.Color(PALETTE.canvas), 0.7);
  scene.add(sky);

  const moon = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 1.1);
  moon.position.set(15, 20, 10);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -22;
  moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 22;
  moon.shadow.camera.bottom = -22;
  moon.shadow.camera.far = 60;
  moon.shadow.bias = -0.0005;
  scene.add(moon, moon.target);

  return { colliders, shootables, group, pads, spawns, lamps, padCenter, padRadius };
}
