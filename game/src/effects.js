// Visual effects engine. Manages object pooling for tracers, sparks, and decals
// to avoid GC pauses. All textures are procedurally generated via Canvas API.

import * as THREE from 'three';

export function createEffects(scene, camera) {
  // Generate a texture using the 2D Canvas API.
  function createTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    return new THREE.CanvasTexture(canvas);
  }

  // A bright, soft radial gradient for sparks.
  const sparkTexture = createTexture(32, (ctx, size) => {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 1)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });

  // A solid dark circle for bullet hole decals.
  const decalTexture = createTexture(32, (ctx, size) => {
    const center = size / 2;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(center, center, center * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });

  // A screen-edge glow for muzzle flashes.
  const flashTexture = createTexture(128, (ctx, size) => {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, size);
    gradient.addColorStop(0, 'rgba(255, 220, 100, 0)');
    gradient.addColorStop(0.8, 'rgba(255, 200, 50, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });

  // --- Materials ---
  const tracerMaterial = new THREE.LineBasicMaterial({
    color: 0xffddaa,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });

  const sparkMaterial = new THREE.SpriteMaterial({
    map: sparkTexture,
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });

  const decalMaterial = new THREE.MeshBasicMaterial({
    map: decalTexture,
    color: 0x222222,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const flashMaterial = new THREE.MeshBasicMaterial({
    map: flashTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    opacity: 0,
  });

  // --- Object Pools ---
  const MAX_TRACERS = 48;
  const tracers = [];
  let tracerIdx = 0;

  for (let i = 0; i < MAX_TRACERS; i++) {
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geom, tracerMaterial.clone());
    line.visible = false;
    scene.add(line);
    tracers.push({ mesh: line, life: 0 });
  }

  const MAX_DECALS = 64;
  const decals = [];
  let decalIdx = 0;
  const decalGeom = new THREE.PlaneGeometry(0.15, 0.15);

  for (let i = 0; i < MAX_DECALS; i++) {
    const mesh = new THREE.Mesh(decalGeom, decalMaterial.clone());
    mesh.visible = false;
    scene.add(mesh);
    decals.push({ mesh, life: 0 });
  }

  const MAX_SPARKS = 128;
  const sparks = [];
  let sparkIdx = 0;

  for (let i = 0; i < MAX_SPARKS; i++) {
    const sprite = new THREE.Sprite(sparkMaterial.clone());
    sprite.scale.set(0.05, 0.05, 0.05);
    sprite.visible = false;
    scene.add(sprite);
    sparks.push({ mesh: sprite, life: 0, velocity: new THREE.Vector3() });
  }

  // Muzzle flash quad attached to the camera
  const flashGeom = new THREE.PlaneGeometry(2, 2);
  const flashMesh = new THREE.Mesh(flashGeom, flashMaterial);
  flashMesh.position.set(0, 0, -0.1);
  camera.add(flashMesh);
  let flashLife = 0;

  return {
    tracer(fromVec3, toVec3) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % MAX_TRACERS;
      
      const positions = t.mesh.geometry.attributes.position;
      positions.setXYZ(0, fromVec3.x, fromVec3.y, fromVec3.z);
      positions.setXYZ(1, toVec3.x, toVec3.y, toVec3.z);
      positions.needsUpdate = true;
      
      t.mesh.material.opacity = 0.8;
      t.mesh.visible = true;
      t.life = 0.08; // 80ms fade out
    },

    impact(pointVec3, normalVec3) {
      if (normalVec3) {
        const d = decals[decalIdx];
        decalIdx = (decalIdx + 1) % MAX_DECALS;
        
        d.mesh.position.copy(pointVec3);
        // Slightly offset to prevent z-fighting
        d.mesh.position.addScaledVector(normalVec3, 0.005);
        d.mesh.lookAt(pointVec3.clone().add(normalVec3));
        
        d.mesh.visible = true;
        d.mesh.material.opacity = 0.8;
      }

      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const s = sparks[sparkIdx];
        sparkIdx = (sparkIdx + 1) % MAX_SPARKS;
        
        s.mesh.position.copy(pointVec3);
        s.velocity.set(
          (Math.random() - 0.5) * 4,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 4
        );
        if (normalVec3) {
           s.velocity.addScaledVector(normalVec3, 2);
        }
        
        s.mesh.visible = true;
        s.mesh.material.opacity = 1.0;
        s.life = 0.2 + Math.random() * 0.2;
      }
    },

    muzzle() {
      flashLife = 0.05;
      flashMesh.material.opacity = 1.0;
    },

    flash() {
      this.muzzle();
    },

    step(dt) {
      for (const t of tracers) {
        if (t.life > 0) {
          t.life -= dt;
          t.mesh.material.opacity = (t.life / 0.08) * 0.8;
          if (t.life <= 0) t.mesh.visible = false;
        }
      }

      for (const s of sparks) {
        if (s.life > 0) {
          s.life -= dt;
          s.velocity.y -= 9.8 * dt; // Gravity
          s.mesh.position.addScaledVector(s.velocity, dt);
          s.mesh.material.opacity = s.life / 0.4;
          if (s.life <= 0) s.mesh.visible = false;
        }
      }

      if (flashLife > 0) {
        flashLife -= dt;
        flashMesh.material.opacity = flashLife / 0.05;
      } else {
        flashMesh.material.opacity = 0;
      }
    },

    clear() {
      for (const t of tracers) t.mesh.visible = false;
      for (const s of sparks) s.mesh.visible = false;
      for (const d of decals) d.mesh.visible = false;
      flashMesh.material.opacity = 0;
    }
  };
}
