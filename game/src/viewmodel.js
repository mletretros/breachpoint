import { Group, Mesh, BoxGeometry, MeshStandardMaterial, CylinderGeometry, Color } from 'three';

export function createViewmodel(camera, palette) {
  const group = new Group();
  // x 0.17, y -0.16, z -0.42 in camera space
  group.position.set(0.17, -0.16, -0.42);
  // rotated a few degrees inward so the barrel converges with the crosshair
  group.rotation.y = 0.05;
  camera.add(group);

  // Materials: roughness ~0.45, metalness 0.3
  const matBase = new MeshStandardMaterial({ color: new Color(palette.surface), roughness: 0.45, metalness: 0.3 });
  const matDark = new MeshStandardMaterial({ color: new Color(palette.canvas), roughness: 0.45, metalness: 0.3 });
  const matAccent = new MeshStandardMaterial({ color: new Color(palette.accent), roughness: 0.45, metalness: 0.3 });
  const matGlove = new MeshStandardMaterial({ color: new Color(palette.hairline), roughness: 0.8, metalness: 0.1 });

  // Parts
  const receiver = new Mesh(new BoxGeometry(0.03, 0.05, 0.15), matBase);
  group.add(receiver);

  const barrel = new Mesh(new CylinderGeometry(0.008, 0.008, 0.2, 8), matDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.15);
  group.add(barrel);

  const gasBlock = new Mesh(new BoxGeometry(0.02, 0.02, 0.05), matBase);
  gasBlock.position.set(0, 0.01, -0.12);
  group.add(gasBlock);

  const magazine = new Mesh(new BoxGeometry(0.02, 0.08, 0.04), matDark);
  magazine.position.set(0, -0.05, -0.02);
  const magGroup = new Group();
  magGroup.add(magazine);
  group.add(magGroup);

  const stock = new Mesh(new BoxGeometry(0.025, 0.06, 0.1), matBase);
  stock.position.set(0, -0.01, 0.12);
  group.add(stock);

  const grip = new Mesh(new BoxGeometry(0.02, 0.06, 0.03), matDark);
  grip.position.set(0, -0.05, 0.05);
  grip.rotation.x = 0.2;
  group.add(grip);

  const rearSight = new Mesh(new BoxGeometry(0.01, 0.02, 0.02), matDark);
  rearSight.position.set(0, 0.035, 0.05);
  group.add(rearSight);

  const frontSight = new Mesh(new BoxGeometry(0.005, 0.02, 0.01), matDark);
  frontSight.position.set(0, 0.03, -0.22);
  group.add(frontSight);

  // Accent strip
  const accent = new Mesh(new BoxGeometry(0.031, 0.005, 0.08), matAccent);
  accent.position.set(0, 0.01, 0);
  group.add(accent);

  // Hand
  const hand = new Group();
  const palm = new Mesh(new BoxGeometry(0.03, 0.05, 0.04), matGlove);
  palm.position.set(0.015, -0.05, 0.05);
  const fingers = new Mesh(new BoxGeometry(0.01, 0.04, 0.04), matGlove);
  fingers.position.set(0.005, -0.05, 0.03);
  hand.add(palm);
  hand.add(fingers);
  group.add(hand);

  let currentId = 'ar4';
  let swayTime = 0;
  let kickPitch = 0;
  let kickZ = 0;
  let isLowered = false;
  let reloadDip = 0;

  const basePos = group.position.clone();
  const baseRot = group.rotation.clone();

  return {
    set(id) {
      currentId = id;
      if (id === 'vp9') {
        barrel.scale.set(1, 0.3, 1);
        barrel.position.z = -0.08;
        frontSight.position.z = -0.1;
        magazine.scale.set(1, 0.5, 0.5);
        stock.visible = false;
        gasBlock.visible = false;
        accent.material.color.set(palette.muted);
      } else if (id === 'k7') {
        barrel.scale.set(1, 0.6, 1);
        barrel.position.z = -0.1;
        frontSight.position.z = -0.15;
        magazine.scale.set(1, 0.8, 0.8);
        stock.visible = true;
        stock.scale.set(1, 0.8, 0.5);
        stock.position.z = 0.08;
        gasBlock.visible = true;
        gasBlock.position.z = -0.08;
        accent.material.color.set(palette.jade);
      } else if (id === 'ar4') {
        barrel.scale.set(1, 1, 1);
        barrel.position.z = -0.15;
        frontSight.position.z = -0.22;
        magazine.scale.set(1, 1, 1);
        stock.visible = true;
        stock.scale.set(1, 1, 1);
        stock.position.z = 0.12;
        gasBlock.visible = true;
        gasBlock.position.z = -0.12;
        accent.material.color.set(palette.accent);
      } else if (id === 'm2') {
        barrel.scale.set(1, 1.5, 1);
        barrel.position.z = -0.2;
        frontSight.position.z = -0.32;
        magazine.scale.set(1, 0.6, 1);
        stock.visible = true;
        stock.scale.set(1, 1, 1.2);
        stock.position.z = 0.14;
        gasBlock.visible = true;
        gasBlock.position.z = -0.15;
        accent.material.color.set(palette.ink);
      }
    },
    sway(dt, lookDeltaX, lookDeltaY, moving, crouched) {
      swayTime += dt * (moving ? (crouched ? 6 : 10) : 2);
      
      const breathX = Math.sin(swayTime * 0.5) * 0.001;
      const breathY = Math.cos(swayTime) * 0.002;
      
      const bobX = moving ? Math.sin(swayTime) * 0.005 : 0;
      const bobY = moving ? Math.abs(Math.cos(swayTime)) * 0.005 : 0;
      
      const lagX = -lookDeltaX * 0.0005;
      const lagY = lookDeltaY * 0.0005;
      
      const targetX = basePos.x + breathX + bobX + lagX;
      const targetY = basePos.y + breathY + bobY + lagY;
      
      kickPitch -= kickPitch * 10 * dt;
      kickZ -= kickZ * 10 * dt;
      
      let lowerY = 0;
      let lowerRotX = 0;
      let lowerRotZ = 0;
      if (isLowered) {
        lowerY = -0.1;
        lowerRotX = -0.4;
        lowerRotZ = 0.2;
      }
      
      group.position.x += (targetX - group.position.x) * 10 * dt;
      group.position.y = targetY + lowerY - reloadDip * 0.05;
      group.position.z = basePos.z + kickZ + reloadDip * 0.02;
      
      group.rotation.x = baseRot.x + kickPitch + lowerRotX - reloadDip * 0.2;
      group.rotation.y = baseRot.y;
      group.rotation.z = baseRot.z + lowerRotZ;
    },
    kick(amount) {
      kickPitch += amount * 0.05;
      kickZ += amount * 0.02;
    },
    reload(progress01) {
      reloadDip = progress01 > 0 && progress01 < 1 ? Math.sin(progress01 * Math.PI) : 0;
      magGroup.position.y = -reloadDip * 0.1;
    },
    lower(flag) {
      isLowered = flag;
    },
    visible(flag) {
      group.visible = flag;
    }
  };
}
