import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let scene, camera, renderer, controls;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const blockSize = 1;
const PLANE_MIN = -30, PLANE_MAX = 30;
const blocks = [];
let floorBlocks = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let flyUp = false, flyDown = false;
let direction = new THREE.Vector3();
const speed = 6.0;
let prevTime = performance.now();

// Load textures
const textureLoader = new THREE.TextureLoader();
const sandTexture = textureLoader.load('model/textures/Sandstone01_baseColor.jpeg');
const stoneTexture = textureLoader.load('model/textures/Sandstone02_baseColor.jpeg');
const stairsTexture = textureLoader.load('model/textures/Sandstone03_baseColor.jpeg');

const BLOCK_TYPES = [
  { name: 'Sand', color: 0xF7E9A0, map: sandTexture },
  { name: 'Stone', color: 0x888888, map: stoneTexture },
  { name: 'Grass', color: 0x4CAF50 },
  { name: 'Wood', color: 0x8B5A2B, map: sandTexture },
  { name: 'Glass', color: 0x99e6ff, transparent: true, opacity: 0.4 },
  { name: 'Sandstone Stairs', color: 0xF7E9A0, isStairs: true, map: stairsTexture }
];
let selectedBlockType = 0;

let rightHand = null, rightHandBlock = null;
function createRightHandBlock() {
  if (!rightHand) return;
  if (rightHandBlock) {
    rightHandBlock.geometry.dispose();
    rightHandBlock.material.dispose();
    rightHand.remove(rightHandBlock);
  }
  const type = BLOCK_TYPES[selectedBlockType];
  let geometry = type.isStairs ? createStairsGeometry() : new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const matOptions = {
    color: type.color,
    flatShading: true,
    transparent: type.transparent || false,
    opacity: type.opacity !== undefined ? type.opacity : 1.0
  };
  if (type.map) matOptions.map = type.map;
  const material = new THREE.MeshStandardMaterial(matOptions);
  rightHandBlock = new THREE.Mesh(geometry, material);
  rightHandBlock.position.set(0, 0.18, 0);
  if (type.isStairs) rightHandBlock.scale.set(0.18, 0.18, 0.18);
  rightHandBlock.castShadow = true;
  rightHandBlock.receiveShadow = true;
  rightHand.add(rightHandBlock);
}
// Stairs rotation state (0: 0deg, 1: 90deg, 2: 180deg, 3: 270deg)
let stairsRotation = 0;

// Start screen logic: wait for user to press Start before initializing the game
window.addEventListener('DOMContentLoaded', () => {
  const startScreen = document.getElementById('startScreen');
  const startButton = document.getElementById('startButton');
  if (startScreen && startButton) {
    startButton.addEventListener('click', () => {
      startScreen.classList.add('fade-out');
      setTimeout(() => {
        startScreen.style.display = 'none';
      }, 500);
      init();
      animate();
    });
  } else {
    // Fallback: if start screen elements are missing, start game immediately
    init();
    animate();
  }
});

// Ensure hoverMesh is added to the scene during initialization
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB); // Sky blue

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 3, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.getObject());

  document.body.addEventListener('click', () => {
    controls.lock();
  });

  // Add hover mesh for placement preview
  const hoverGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const hoverMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });
  hoverMesh = new THREE.Mesh(hoverGeometry, hoverMaterial);
  hoverMesh.visible = false;
  hoverMesh.castShadow = false;
  hoverMesh.receiveShadow = false;
  scene.add(hoverMesh);

  // Add a big temple at the opposite side of the pyramids
  const templeX = PLANE_MIN - 30;
  const templeZ = 0;
  const templeWidth = 15;
  const templeDepth = 11;
  const templeHeight = 7;
  // Temple base (sand blocks)
  for (let tx = -Math.floor(templeWidth/2); tx <= Math.floor(templeWidth/2); tx++) {
    for (let tz = -Math.floor(templeDepth/2); tz <= Math.floor(templeDepth/2); tz++) {
      const baseBlock = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, blockSize, blockSize),
        new THREE.MeshStandardMaterial({
          color: BLOCK_TYPES[0].color,
          flatShading: true,
          map: BLOCK_TYPES[0].map
        })
      );
      baseBlock.position.set(templeX + tx, 0, templeZ + tz);
      baseBlock.castShadow = false;
      baseBlock.receiveShadow = false;
      scene.add(baseBlock);
    }
  }
  // Temple columns (front and back rows)
  for (let col = -6; col <= 6; col += 3) {
    for (let h = 1; h <= templeHeight; h++) {
      // Front row
      const frontCol = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, blockSize, blockSize),
        new THREE.MeshStandardMaterial({
          color: BLOCK_TYPES[0].color,
          flatShading: true,
          map: BLOCK_TYPES[0].map
        })
      );
      frontCol.position.set(templeX + col, h, templeZ - Math.floor(templeDepth/2));
      frontCol.castShadow = false;
      frontCol.receiveShadow = false;
      scene.add(frontCol);
      // Back row
      const backCol = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, blockSize, blockSize),
        new THREE.MeshStandardMaterial({
          color: BLOCK_TYPES[0].color,
          flatShading: true,
          map: BLOCK_TYPES[0].map
        })
      );
      backCol.position.set(templeX + col, h, templeZ + Math.floor(templeDepth/2));
      backCol.castShadow = false;
      backCol.receiveShadow = false;
      scene.add(backCol);
    }
  }
  // Temple roof (flat sand blocks)
  for (let rx = -Math.floor(templeWidth/2); rx <= Math.floor(templeWidth/2); rx++) {
    for (let rz = -Math.floor(templeDepth/2); rz <= Math.floor(templeDepth/2); rz++) {
      const roofBlock = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, blockSize, blockSize),
        new THREE.MeshStandardMaterial({
          color: BLOCK_TYPES[0].color,
          flatShading: true,
          map: BLOCK_TYPES[0].map
        })
      );
      roofBlock.position.set(templeX + rx, templeHeight + 1, templeZ + rz);
      roofBlock.castShadow = false;
      roofBlock.receiveShadow = false;
      scene.add(roofBlock);
    }
  }

  // Add small houses near the temple
  // Each house: 3x3 base, 2 blocks high, 1 block roof, made of wood and stone
  const houseConfigs = [
    { x: templeX - 20, z: templeZ - 8 },
    { x: templeX - 20, z: templeZ + 8 },
    { x: templeX - 28, z: templeZ },
    { x: templeX - 12, z: templeZ },
  ];
  houseConfigs.forEach(({ x, z }) => {
    // Floor (stone)
    for (let hx = -1; hx <= 1; hx++) {
      for (let hz = -1; hz <= 1; hz++) {
        const floorBlock = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize, blockSize, blockSize),
          new THREE.MeshStandardMaterial({
            color: BLOCK_TYPES[1].color,
            flatShading: true,
            map: BLOCK_TYPES[1].map
          })
        );
        floorBlock.position.set(x + hx, 0, z + hz);
        floorBlock.castShadow = false;
        floorBlock.receiveShadow = false;
        scene.add(floorBlock);
      }
    }

    // Walls (wood), with door and windows
    for (let hy = 1; hy <= 3; hy++) {
      for (let hx = -1; hx <= 1; hx++) {
        for (let hz = -1; hz <= 1; hz++) {
          // Door opening (front center, only at y=1, facing -z)
          if (hz === -1 && hx === 0 && hy === 1) continue;
          // Windows (left/right at y=2, front/back)
          if ((hy === 2) && ((hz === -1 && Math.abs(hx) === 1) || (hz === 1 && Math.abs(hx) === 1))) continue;
          // Only place wall blocks on the edge
          if (hx === -1 || hx === 1 || hz === -1 || hz === 1) {
            const wallBlock = new THREE.Mesh(
              new THREE.BoxGeometry(blockSize, blockSize, blockSize),
              new THREE.MeshStandardMaterial({
                color: BLOCK_TYPES[3].color,
                flatShading: true,
                map: BLOCK_TYPES[3].map
              })
            );
            wallBlock.position.set(x + hx, hy, z + hz);
            wallBlock.castShadow = false;
            wallBlock.receiveShadow = false;
            scene.add(wallBlock);
          }
          // Glass for windows
          if ((hy === 2) && ((hz === -1 && Math.abs(hx) === 1) || (hz === 1 && Math.abs(hx) === 1))) {
            const glassBlock = new THREE.Mesh(
              new THREE.BoxGeometry(blockSize, blockSize, blockSize),
              new THREE.MeshStandardMaterial({
                color: BLOCK_TYPES[4].color,
                transparent: true,
                opacity: BLOCK_TYPES[4].opacity,
                flatShading: true
              })
            );
            glassBlock.position.set(x + hx, hy, z + hz);
            glassBlock.castShadow = false;
            glassBlock.receiveShadow = false;
            scene.add(glassBlock);
          }
        }
      }
    }

    // Sloped roof using stairs blocks (sandstone stairs)
    // First layer (y=4, stairs facing out)
    for (let hx = -2; hx <= 2; hx++) {
      for (let hz = -2; hz <= 2; hz++) {
        // Only on the edge
        if (Math.abs(hx) === 2 || Math.abs(hz) === 2) {
          const roofStairs = new THREE.Mesh(
            createStairsGeometry(),
            new THREE.MeshStandardMaterial({
              color: BLOCK_TYPES[5].color,
              flatShading: true,
              map: BLOCK_TYPES[5].map
            })
          );
          roofStairs.position.set(x + hx, 4, z + hz);
          // Rotate stairs to face outwards
          if (hz === -2) roofStairs.rotation.y = Math.PI;
          else if (hz === 2) roofStairs.rotation.y = 0;
          else if (hx === -2) roofStairs.rotation.y = Math.PI / 2;
          else if (hx === 2) roofStairs.rotation.y = -Math.PI / 2;
          roofStairs.castShadow = false;
          roofStairs.receiveShadow = false;
          scene.add(roofStairs);
        }
      }
    }
    // Second layer (y=5, smaller)
    for (let hx = -1; hx <= 1; hx++) {
      for (let hz = -1; hz <= 1; hz++) {
        // Only on the edge
        if (Math.abs(hx) === 1 || Math.abs(hz) === 1) {
          const roofStairs = new THREE.Mesh(
            createStairsGeometry(),
            new THREE.MeshStandardMaterial({
              color: BLOCK_TYPES[5].color,
              flatShading: true,
              map: BLOCK_TYPES[5].map
            })
          );
          roofStairs.position.set(x + hx, 5, z + hz);
          // Rotate stairs to face outwards
          if (hz === -1) roofStairs.rotation.y = Math.PI;
          else if (hz === 1) roofStairs.rotation.y = 0;
          else if (hx === -1) roofStairs.rotation.y = Math.PI / 2;
          else if (hx === 1) roofStairs.rotation.y = -Math.PI / 2;
          roofStairs.castShadow = false;
          roofStairs.receiveShadow = false;
          scene.add(roofStairs);
        }
      }
    }
    // Roof cap (block at top)
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(blockSize, blockSize, blockSize),
      new THREE.MeshStandardMaterial({
        color: BLOCK_TYPES[5].color,
        flatShading: true,
        map: BLOCK_TYPES[5].map
      })
    );
    roofCap.position.set(x, 6, z);
    roofCap.castShadow = false;
    roofCap.receiveShadow = false;
    scene.add(roofCap);
  });

  controls.addEventListener('lock', () => {
    document.getElementById('instructions').style.display = 'none';
  });
  controls.addEventListener('unlock', () => {
    document.getElementById('instructions').style.display = '';
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  let sun = new THREE.PointLight(0xffffff, 0.8);
  sun.position.set(10, 10, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  scene.add(sun);

  // Ground (floor) - larger area
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xE5D8B0, flatShading: true }); // Light sand
  for (let x = PLANE_MIN; x < PLANE_MAX; x++) {
    for (let z = PLANE_MIN; z < PLANE_MAX; z++) {
      const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
      const cube = new THREE.Mesh(geometry, floorMaterial);
      cube.position.set(Math.round(x * blockSize), 0, Math.round(z * blockSize));
      cube.receiveShadow = true;
      scene.add(cube);
      floorBlocks.push(cube);
    }
  }

  // Add player body (bigger cylinder) and two smaller ball hands
  const bodyGeometry = new THREE.CylinderGeometry(0.45, 0.45, 1.5, 20);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8888ff });
  const playerBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  playerBody.castShadow = true;
  playerBody.receiveShadow = true;
  playerBody.position.set(0, -0.75, 0); // Centered below camera
  playerBody.visible = true;

  // Smaller ball hands
  const handGeometry = new THREE.SphereGeometry(0.18, 24, 24);
  const handMaterial = new THREE.MeshStandardMaterial({ color: 0x44ff44 });
  const leftHand = new THREE.Mesh(handGeometry, handMaterial);
  leftHand.castShadow = true;
  leftHand.position.set(-0.38, -0.18, -0.55);
  rightHand = new THREE.Mesh(handGeometry, handMaterial);
  rightHand.castShadow = true;
  rightHand.position.set(0.38, -0.18, -0.55);
  // Create the initial right hand block preview
  createRightHandBlock();

  // Attach to camera so they move with the player
  camera.add(playerBody);
  camera.add(leftHand);
  camera.add(rightHand);
  scene.add(camera);

  // Add preview pyramid (semi-transparent, not interactive)
  const pyramidBase = 7; // 7x7 base
  const pyramidHeight = 5;
  const previewMaterial = new THREE.MeshStandardMaterial({ color: 0xC2B280, opacity: 0.5, transparent: true });
  const pyramidCenterX = 0;
  const pyramidCenterZ = 10;
  for (let y = 0; y < pyramidHeight; y++) {
    const size = pyramidBase - y * 2;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        const block = new THREE.Mesh(geometry, previewMaterial);
        block.position.set(
          pyramidCenterX + (x - (size - 1) / 2),
          y + 0.5,
          pyramidCenterZ + (z - (size - 1) / 2)
        );
        block.castShadow = false;
        block.receiveShadow = false;
        scene.add(block);
      }
    }
  }

  // Add three big pyramids (like Giza) outside the borders, each on its own sand plane
  const gizaPyramids = [
    { base: 17, height: 9, x: PLANE_MAX + 30, z: -20 }, // Great Pyramid
    { base: 13, height: 7, x: PLANE_MAX + 45, z: 0 },   // Khafre
    { base: 9, height: 5, x: PLANE_MAX + 55, z: 20 }    // Menkaure
  ];
  gizaPyramids.forEach(({ base, height, x, z }, idx) => {
    // Add sand plane under each pyramid (base+4 x base+4)
    for (let fx = -Math.floor((base+4)/2); fx <= Math.floor((base+4)/2); fx++) {
      for (let fz = -Math.floor((base+4)/2); fz <= Math.floor((base+4)/2); fz++) {
        const floorBlock = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize, blockSize, blockSize),
          new THREE.MeshStandardMaterial({
            color: BLOCK_TYPES[0].color,
            flatShading: true,
            map: BLOCK_TYPES[0].map
          })
        );
        floorBlock.position.set(x + fx, 0, z + fz);
        floorBlock.castShadow = false;
        floorBlock.receiveShadow = false;
        scene.add(floorBlock);
      }
    }
    // Build the pyramid (all sand blocks)
    for (let y = 0; y < height; y++) {
      const size = base - y * 2;
      for (let px = 0; px < size; px++) {
        for (let pz = 0; pz < size; pz++) {
          const block = new THREE.Mesh(
            new THREE.BoxGeometry(blockSize, blockSize, blockSize),
            new THREE.MeshStandardMaterial({
              color: BLOCK_TYPES[0].color,
              flatShading: true,
              map: BLOCK_TYPES[0].map
            })
          );
          block.position.set(
            x + (px - (size - 1) / 2),
            y + 0.5,
            z + (pz - (size - 1) / 2)
          );
          block.castShadow = false;
          block.receiveShadow = false;
          scene.add(block);
        }
      }
    }
  });


  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onClick);
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Restored critical sections for hoverMesh, animate, and onClick logic
// Restored hoverMesh logic for placement preview
let hoverMesh = null;
function updateHoverMeshMaterial() {
  const type = BLOCK_TYPES[selectedBlockType];
  hoverMesh.material.color.setHex(type.color);
  hoverMesh.material.opacity = type.opacity !== undefined ? type.opacity : 0.4;
  hoverMesh.material.transparent = type.transparent || type.opacity !== undefined;
  if (type.isStairs) {
    if (!(hoverMesh.geometry && hoverMesh.geometry.isBufferGeometry && hoverMesh.geometry.attributes.position.count === createStairsGeometry().attributes.position.count)) {
      hoverMesh.geometry.dispose();
      hoverMesh.geometry = createStairsGeometry();
    }
    hoverMesh.rotation.y = stairsRotation * Math.PI / 2;
  } else {
    if (!(hoverMesh.geometry && hoverMesh.geometry.type === 'BoxGeometry')) {
      hoverMesh.geometry.dispose();
      hoverMesh.geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    }
    hoverMesh.rotation.y = 0;
  }
}

// Restored animate function for rendering and movement
function animate(time) {
  if (controls.isLocked) {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(blocks.concat(floorBlocks), false);
    if (intersects.length > 0) {
      const face = intersects[0].face;
      const obj = intersects[0].object;
      const normal = face.normal.clone().add(obj.position);
      hoverMesh.position.set(Math.round(normal.x), Math.round(normal.y), Math.round(normal.z));
      hoverMesh.visible = true;
      updateHoverMeshMaterial();
    } else {
      hoverMesh.visible = false;
    }
  } else {
    hoverMesh.visible = false;
  }
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = (now - prevTime) / 1000;
  prevTime = now;

  if (controls.isLocked) {
    direction.set(0, 0, 0);
    if (moveForward) direction.z += 1;
    if (moveBackward) direction.z -= 1;
    if (moveLeft) direction.x -= 1;
    if (moveRight) direction.x += 1;
    direction.normalize();
    if (direction.lengthSq() > 0) {
      controls.moveRight(direction.x * speed * delta);
      controls.moveForward(direction.z * speed * delta);
    }
    if (flyUp) controls.getObject().position.y += speed * delta;
    if (flyDown) controls.getObject().position.y -= speed * delta;
    controls.getObject().position.y = Math.max(2, controls.getObject().position.y);
    controls.getObject().position.x = Math.max(PLANE_MIN + 0.5, Math.min(PLANE_MAX - 0.5, controls.getObject().position.x));
    controls.getObject().position.z = Math.max(PLANE_MIN + 0.5, Math.min(PLANE_MAX - 0.5, controls.getObject().position.z));
  }
  renderer.render(scene, camera);
}

// Restored onClick logic for block placement and removal
function onClick(event) {
  if (!controls.isLocked) return;
  event.preventDefault();
  mouse.x = 0;
  mouse.y = 0;
  raycaster.setFromCamera(mouse, camera);
  if (event.button === 0) {
    const intersects = raycaster.intersectObjects(blocks.concat(floorBlocks), false);
    if (intersects.length > 0) {
      const face = intersects[0].face;
      const obj = intersects[0].object;
      const normal = face.normal.clone().add(obj.position);
      const playerPos = controls.getObject().position;
      // Prevent placing a block where the player is standing
      if (
        Math.abs(normal.x - playerPos.x) < 0.8 &&
        Math.abs(normal.y - playerPos.y) < 1.7 &&
        Math.abs(normal.z - playerPos.z) < 0.8
      ) {
        return;
      }
      addBlock(normal.x, normal.y, normal.z, selectedBlockType);
    }
  } else if (event.button === 2) {
    const intersects = raycaster.intersectObjects(blocks, false);
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      scene.remove(obj);
      blocks.splice(blocks.indexOf(obj), 1);
      obj.geometry.dispose();
      obj.material.dispose();
    }
  }
}

// Call after DOM loaded
window.addEventListener('DOMContentLoaded', renderHotbar);

// Update hotbar on block type change
function setSelectedBlockType(idx) {
  selectedBlockType = idx;
  updateHoverMeshMaterial();
  renderHotbar();
  createRightHandBlock();
}

function onKeyDown(event) {
  switch (event.code) {
    case 'Digit1': setSelectedBlockType(0); break;
    case 'Digit2': setSelectedBlockType(1); break;
    case 'Digit3': setSelectedBlockType(2); break;
    case 'Digit4': setSelectedBlockType(3); break;
    case 'Digit5': setSelectedBlockType(4); break;
    case 'Digit6': setSelectedBlockType(5); break;
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Space': flyUp = true; break;
    case 'ShiftLeft':
    case 'ShiftRight': flyDown = true; break;
    case 'KeyR':
      // Only rotate if stairs is selected
      if (BLOCK_TYPES[selectedBlockType].isStairs) {
        stairsRotation = (stairsRotation + 1) % 4;
        updateHoverMeshMaterial();
      }
      break;
  }
}
function onKeyUp(event) {
  switch (event.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
    case 'Space': flyUp = false; break;
    case 'ShiftLeft':
    case 'ShiftRight': flyDown = false; break;
  }
}

// Restored missing renderHotbar function
function renderHotbar() {
  const hotbar = document.getElementById('hotbar');
  hotbar.innerHTML = '';
  BLOCK_TYPES.forEach((type, idx) => {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (selectedBlockType === idx ? ' selected' : '');
    const block = document.createElement('div');
    block.className = 'hotbar-block';
    block.style.background = `#${type.color.toString(16).padStart(6, '0')}`;
    if (type.transparent) {
      block.style.opacity = type.opacity || 0.5;
      block.style.border = '1.5px dashed #44a';
    }
    if (type.isStairs) {
      block.style.background = 'repeating-linear-gradient(135deg, #C2B280 0 6px, #b2a170 6px 12px)';
      block.style.border = '1.5px solid #C2B280';
    }
    slot.appendChild(block);
    const label = document.createElement('div');
    label.className = 'hotbar-label';
    label.textContent = (idx + 1).toString();
    slot.appendChild(label);
    hotbar.appendChild(slot);
  });
}

// Restored missing createStairsGeometry function
function createStairsGeometry() {
  const stairGeo = new THREE.BufferGeometry();
  const stepGeo = new THREE.BoxGeometry(blockSize, blockSize / 4, blockSize / 4);
  let merged = null;
  for (let i = 0; i < 4; i++) {
    const step = stepGeo.clone();
    step.translate(0, -0.375 + i * 0.25, -0.375 + i * 0.25);
    if (!merged) {
      merged = step;
    } else {
      merged = mergeBufferGeometries([merged, step]);
    }
  }
  return merged;
}

// Define the missing addBlock function to handle block placement.
function addBlock(x, y, z, typeIndex) {
  const type = BLOCK_TYPES[typeIndex];
  const geometry = type.isStairs ? createStairsGeometry() : new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const materialOptions = {
    color: type.color,
    flatShading: true,
    transparent: type.transparent || false,
    opacity: type.opacity !== undefined ? type.opacity : 1.0
  };
  if (type.map) materialOptions.map = type.map;
  const material = new THREE.MeshStandardMaterial(materialOptions);

  const block = new THREE.Mesh(geometry, material);
  block.position.set(x, y, z);
  block.castShadow = true;
  block.receiveShadow = true;

  scene.add(block);
  blocks.push(block);
}
