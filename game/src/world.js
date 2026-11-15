import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene, renderer) {
  const anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
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

  const textures = {};
  function getTexture(name) {
    if (textures[name]) return textures[name];
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    if (name === 'concrete') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.5)';
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      ctx.moveTo(Math.random() * 128, 0);
      ctx.lineTo(Math.random() * 128 + 20, 64);
      ctx.lineTo(Math.random() * 128 - 20, 128);
      ctx.stroke();
    } else if (name === 'panel') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, 2, 128);
      ctx.fillRect(64, 0, 2, 128);
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    } else if (name === 'steel') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let i = 0; i < 150; i++) {
        ctx.fillRect(0, Math.random() * 128, 128, Math.random() * 2);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      for (let i = 0; i < 150; i++) {
        ctx.fillRect(0, Math.random() * 128, 128, Math.random() * 2);
      }
    } else if (name === 'jade') {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#888888');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    textures[name] = tex;
    return tex;
  }

  const matFloor = materials['surface'].clone();
  matFloor.map = getTexture('concrete');

  const matWall = materials['surface'].clone();
  matWall.map = getTexture('panel');

  const matCrate = materials['steel'].clone();
  matCrate.map = getTexture('steel');

  const matCrateHairline = materials['hairline'].clone();
  matCrateHairline.map = getTexture('steel');

  const matPad = materials['surface'].clone();
  matPad.map = getTexture('jade');

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, materialName, texType) {
    let mat = materials[materialName];
    let tileSize = 1;
    
    if (texType === 'floor') { mat = matFloor; tileSize = 4; }
    else if (texType === 'wall') { mat = matWall; tileSize = 2; }
    else if (texType === 'crate') { mat = (materialName === 'hairline' ? matCrateHairline : matCrate); tileSize = 1; }
    else if (texType === 'pad') { mat = matPad; tileSize = 5; }
    
    const geo = new THREE.BoxGeometry(width, height, depth);
    if (texType) {
      // per-material sensible tiling scale applied via UVs to handle different box dimensions
      const uv = geo.attributes.uv;
      const normal = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normal.getX(i));
        const ny = Math.abs(normal.getY(i));
        
        let u = uv.getX(i);
        let v = uv.getY(i);
        
        if (nx > 0.5) { u *= depth / tileSize; v *= height / tileSize; }
        else if (ny > 0.5) { u *= width / tileSize; v *= depth / tileSize; }
        else { u *= width / tileSize; v *= height / tileSize; }
        
        uv.setXY(i, u, v);
      }
    }
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Floor: 40x40m
  box(40, 0.4, 40, 0, -0.2, 0, 'surface', 'floor');

  // Perimeter walls: 5m high
  box(40, 5, 0.4, 0, 2.5, -20.2, 'surface', 'wall');
  box(40, 5, 0.4, 0, 2.5, 20.2, 'surface', 'wall');
  box(0.4, 5, 40, -20.2, 2.5, 0, 'surface', 'wall');
  box(0.4, 5, 40, 20.2, 2.5, 0, 'surface', 'wall');

  // Map Layout: Cinder Yard
  // Mid corridor: simple walls splitting mid
  box(1.5, 2.2, 8, -4, 1.1, 0, 'surface', 'wall');
  box(1.5, 2.2, 8, 4, 1.1, 0, 'surface', 'wall');

  // Mid cover
  box(2, 1.0, 1.2, 0, 0.5, 5, 'steel', 'crate'); // crouch cover south
  box(2, 1.0, 1.2, 0, 0.5, -5, 'steel', 'crate'); // crouch cover north
  box(1.2, 1.8, 1.2, 0, 0.9, 0, 'steel', 'crate'); // full cover mid

  // West loading dock (x: -12 to -18)
  box(3, 2.2, 6, -15, 1.1, 8, 'steel', 'crate');
  box(3, 2.2, 6, -15, 1.1, -8, 'steel', 'crate');
  box(3, 2.2, 6, -11, 1.1, 0, 'steel', 'crate');
  // Dock cover
  box(1.5, 1.0, 1.5, -11, 0.5, 7, 'hairline', 'crate');
  box(1.5, 1.8, 1.5, -15, 0.9, 0, 'hairline', 'crate');

  // East pipe gallery (x: 12 to 18)
  box(4, 2.2, 2, 16, 1.1, 10, 'surface', 'wall');
  box(4, 2.2, 2, 16, 1.1, -10, 'surface', 'wall');
  box(2, 2.2, 12, 12, 1.1, 0, 'surface', 'wall');
  box(1.2, 1.1, 2.4, 16, 0.55, 0, 'steel', 'crate'); // crouch cover

  // Additional covers along lanes
  box(1.2, 1.0, 1.2, -6, 0.5, 12, 'steel', 'crate');
  box(1.2, 1.0, 1.2, 6, 0.5, 12, 'steel', 'crate');
  box(1.2, 1.0, 1.2, 6, 0.5, -12, 'steel', 'crate');
  box(1.2, 1.8, 1.2, -6, 0.9, -12, 'steel', 'crate');

  // Site B7: 5x5 pad at x=-8, z=-6, 0.25m high
  const padCenterX = -8;
  const padCenterZ = -6;
  const padY = 0.25;
  const padMesh = box(5, padY, 5, padCenterX, padY / 2, padCenterZ, 'surface', 'pad');
  const pads = [new THREE.Box3().setFromObject(padMesh)];
  const padCenter = new THREE.Vector3(padCenterX, padY, padCenterZ);
  const padRadius = 2.2;

  // Railing on 3 sides (north, west, south)
  box(5, 0.8, 0.2, padCenterX, padY + 0.4, padCenterZ - 2.4, 'steel', 'crate');
  box(5, 0.8, 0.2, padCenterX, padY + 0.4, padCenterZ + 2.4, 'steel', 'crate');
  box(0.2, 0.8, 5, padCenterX - 2.4, padY + 0.4, padCenterZ, 'steel', 'crate');

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
