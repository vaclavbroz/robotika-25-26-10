import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';

// SCÉNA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 5, 25);

const ambient = new THREE.AmbientLight(0x222222);
scene.add(ambient);

// KAMERA
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 10);

// RENDERER
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// SVĚTLO
const flashlight = new THREE.SpotLight(
  0xffffff,
  6,
  80,
  Math.PI / 3,
  0.3
);
flashlight.castShadow = true;

scene.add(flashlight);
scene.add(flashlight.target);

// ZEM
const groundGeometry = new THREE.BoxGeometry(50, 1, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.y = -0.5;
scene.add(ground);

// HRÁČ
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({
  color: 0x0000FF,
  emissive: 0x000070,
  roughness: 1
});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 2;
scene.add(player);

// ===== NEPŘÍTEL =====
const enemyGeometry = new THREE.BoxGeometry(1, 2, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x2F0000 });
const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);

enemy.position.set(0, 1, -20);
scene.add(enemy);

const libraryEnemy = new THREE.Mesh(
  enemyGeometry.clone(),
  new THREE.MeshStandardMaterial({ color: 0x5a0000, emissive: 0x220000, roughness: 0.95 }),
);
libraryEnemy.visible = false;
libraryEnemy.position.set(0, -100, 0);
scene.add(libraryEnemy);

// ===== MEČ =====
const swordGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
const swordMaterial = new THREE.MeshStandardMaterial({
  color: 0xaaaaaa,
  metalness: 0.8,
  roughness: 0.2
});
const sword = new THREE.Mesh(swordGeometry, swordMaterial);

sword.position.set(0.6, 0, 0);
sword.rotation.z = Math.PI / 4;
player.add(sword);

// Stav útoku
let isAttacking = false;
let attackProgress = 0;

// POHYB
let velocityY = 0;
let isOnGround = true;
const gravity = -0.01;
const moveSpeed = 0.1;
let speedX = 0;
let speedZ = 0;
const playerHalfSize = 0.5;
const RUIN_SECTOR_SIZE = 24;
const RUIN_VISIBLE_RADIUS = 3;
const RUIN_START_Z = -96;

let enemySpeed = 0.02;
let cameraModeIndex = 0;

const ruinsGroup = new THREE.Group();
scene.add(ruinsGroup);

const worldState = {
  ruinSectors: new Map(),
  libraryTrigger: null,
};
const playerForward = new THREE.Vector3();
const playerRight = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const moveState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

// PLATFORMY
const platforms = [];

function createPlatform(x, y, z, width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const platform = new THREE.Mesh(geometry, material);

  platform.position.set(x, y, z);
  scene.add(platform);

  platforms.push(platform);
}

function createHouse(x, z) {
  const width = 5 + Math.random() * 3;
  const height = 4 + Math.random() * 3;
  const depth = 5 + Math.random() * 3;
  const baseY = 28;
  const floorLift = 0.03;
  const wallThickness = 0.35;
  const doorWidth = Math.min(2.2, width * 0.42);
  const doorHeight = Math.min(height * 0.72, 3.4);
  const frontWallWidth = Math.max(0.8, (width - doorWidth) / 2);
  const upperWallHeight = Math.max(0.6, height - doorHeight);
  const sideWallDepth = Math.max(0.8, (depth - doorWidth) / 2);

  createPlatform(x, baseY + floorLift - wallThickness / 2, z, width, wallThickness, depth);
  createPlatform(x - width / 2 + wallThickness / 2, baseY + height / 2, z, wallThickness, height, depth);
  createPlatform(x + width / 2 - wallThickness / 2, baseY + height / 2, z, wallThickness, height, depth);
  createPlatform(x, baseY + height / 2, z - depth / 2 + wallThickness / 2, width, height, wallThickness);
  createPlatform(
    x - width / 2 + wallThickness / 2,
    baseY + height / 2,
    z + doorWidth / 2 + sideWallDepth / 2,
    wallThickness,
    height,
    sideWallDepth,
  );
  createPlatform(
    x + width / 2 - wallThickness / 2,
    baseY + height / 2,
    z + doorWidth / 2 + sideWallDepth / 2,
    wallThickness,
    height,
    sideWallDepth,
  );
  createPlatform(
    x - doorWidth / 2 - frontWallWidth / 2,
    baseY + height / 2,
    z + depth / 2 - wallThickness / 2,
    frontWallWidth,
    height,
    wallThickness,
  );
  createPlatform(
    x + doorWidth / 2 + frontWallWidth / 2,
    baseY + height / 2,
    z + depth / 2 - wallThickness / 2,
    frontWallWidth,
    height,
    wallThickness,
  );
  createPlatform(
    x,
    baseY + doorHeight + upperWallHeight / 2,
    z + depth / 2 - wallThickness / 2,
    doorWidth,
    upperWallHeight,
    wallThickness,
  );

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2d1a });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x6a4126, roughness: 0.92 });
  const frontZ = z + depth / 2 - wallThickness / 2;
  const frameSideGeometry = new THREE.BoxGeometry(wallThickness, doorHeight, wallThickness * 1.4);
  const frameTopGeometry = new THREE.BoxGeometry(doorWidth + wallThickness, wallThickness, wallThickness * 1.4);

  const leftFrame = new THREE.Mesh(frameSideGeometry, frameMaterial);
  leftFrame.position.set(x - doorWidth / 2, baseY + doorHeight / 2, frontZ);
  scene.add(leftFrame);

  const rightFrame = new THREE.Mesh(frameSideGeometry, frameMaterial);
  rightFrame.position.set(x + doorWidth / 2, baseY + doorHeight / 2, frontZ);
  scene.add(rightFrame);

  const topFrame = new THREE.Mesh(frameTopGeometry, frameMaterial);
  topFrame.position.set(x, baseY + doorHeight, frontZ);
  scene.add(topFrame);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth * 0.92, doorHeight * 0.92, wallThickness * 0.28),
    doorMaterial,
  );
  door.position.set(x - doorWidth * 0.18, baseY + doorHeight * 0.46, frontZ - wallThickness * 0.42);
  door.rotation.y = Math.PI / 4;
  scene.add(door);

  const roofGeo = new THREE.ConeGeometry(width * 0.8, height * 0.7, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x552200 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(x, baseY + height + height * 0.35, z);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);
}

function createLibrary(x, z) {
  const width = 11;
  const height = 6.5;
  const depth = 9;
  const baseY = 28;
  const floorLift = 0.03;
  const wallThickness = 0.4;
  const doorWidth = 3.2;
  const doorHeight = 3.8;
  const frontWallWidth = (width - doorWidth) / 2;
  const upperWallHeight = height - doorHeight;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7a62, roughness: 0.96 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.88 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5a321c, roughness: 0.9 });

  createPlatform(x, baseY + floorLift - wallThickness / 2, z, width, wallThickness, depth);
  createPlatform(x - width / 2 + wallThickness / 2, baseY + height / 2, z, wallThickness, height, depth);
  createPlatform(x + width / 2 - wallThickness / 2, baseY + height / 2, z, wallThickness, height, depth);
  createPlatform(x, baseY + height / 2, z - depth / 2 + wallThickness / 2, width, height, wallThickness);
  createPlatform(
    x - doorWidth / 2 - frontWallWidth / 2,
    baseY + height / 2,
    z + depth / 2 - wallThickness / 2,
    frontWallWidth,
    height,
    wallThickness,
  );
  createPlatform(
    x + doorWidth / 2 + frontWallWidth / 2,
    baseY + height / 2,
    z + depth / 2 - wallThickness / 2,
    frontWallWidth,
    height,
    wallThickness,
  );
  createPlatform(
    x,
    baseY + doorHeight + upperWallHeight / 2,
    z + depth / 2 - wallThickness / 2,
    doorWidth,
    upperWallHeight,
    wallThickness,
  );

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 1.2, wallThickness, depth + 1.2),
    trimMaterial,
  );
  roof.position.set(x, baseY + height + wallThickness / 2, z);
  scene.add(roof);

  const step = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 1.6, 0.35, 1.6),
    trimMaterial,
  );
  step.position.set(x, baseY + 0.175, z + depth / 2 + 0.45);
  scene.add(step);

  const frameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, doorHeight, wallThickness * 1.5),
    trimMaterial,
  );
  frameLeft.position.set(x - doorWidth / 2, baseY + doorHeight / 2, z + depth / 2 - wallThickness / 2);
  scene.add(frameLeft);

  const frameRight = frameLeft.clone();
  frameRight.position.set(x + doorWidth / 2, baseY + doorHeight / 2, z + depth / 2 - wallThickness / 2);
  scene.add(frameRight);

  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + wallThickness, wallThickness, wallThickness * 1.5),
    trimMaterial,
  );
  frameTop.position.set(x, baseY + doorHeight, z + depth / 2 - wallThickness / 2);
  scene.add(frameTop);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth * 0.48, doorHeight * 0.9, wallThickness * 0.24),
    doorMaterial,
  );
  door.position.set(x - doorWidth * 0.22, baseY + doorHeight * 0.45, z + depth / 2 - wallThickness);
  door.rotation.y = Math.PI / 3.8;
  scene.add(door);

  const columnGeometry = new THREE.BoxGeometry(0.55, height - 0.2, 0.55);
  for (const offset of [-3.3, -1.1, 1.1, 3.3]) {
    const column = new THREE.Mesh(columnGeometry, trimMaterial);
    column.position.set(x + offset, baseY + (height - 0.2) / 2, z + depth / 2 + 0.25);
    scene.add(column);
  }

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 0.8, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x26354a, roughness: 0.7 }),
  );
  sign.position.set(x, baseY + height - 1.1, z + depth / 2 + 0.28);
  scene.add(sign);

  const letters = createTextSprite("KNIHOVNA", {
    width: 640,
    height: 120,
    font: "bold 58px serif",
    color: "#f4f1e8",
  });
  letters.position.set(x, baseY + height - 1.1, z + depth / 2 + 0.42);
  scene.add(letters);

  const windowGeometry = new THREE.BoxGeometry(1.6, 1.4, 0.12);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ac7de,
    emissive: 0x1a2a34,
    roughness: 0.35,
    metalness: 0.08,
  });
  for (const offset of [-3.2, 3.2]) {
    const upperFrontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    upperFrontWindow.position.set(x + offset, baseY + height - 2.3, z + depth / 2 + 0.25);
    scene.add(upperFrontWindow);
  }

  const sideWindowGeometry = new THREE.BoxGeometry(0.12, 1.5, 1.8);
  for (const side of [-1, 1]) {
    for (const depthOffset of [-2.2, 0, 2.2]) {
      const sideWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
      sideWindow.position.set(x + side * (width / 2 + 0.02), baseY + height - 2.1, z + depthOffset);
      scene.add(sideWindow);
    }
  }

  const frontAwning = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth + 2.8, 0.25, 1.4),
    bodyMaterial,
  );
  frontAwning.position.set(x, baseY + doorHeight + 0.5, z + depth / 2 + 0.75);
  scene.add(frontAwning);

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.8, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x5e544c, roughness: 0.96 }),
  );
  pedestal.position.set(x, baseY + 0.4, z - 1.2);
  scene.add(pedestal);

  const leftPageMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createBookPageTexture("Vedle tebe", "je nepritel."),
    roughness: 0.84,
  });
  const rightPageMaterial = new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.84 });
  const leftPage = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.06, 0.7),
    leftPageMaterial,
  );
  leftPage.position.set(x - 0.38, baseY + 0.88, z - 1.2);
  leftPage.rotation.z = 0.16;
  leftPage.rotation.y = 0.2;
  scene.add(leftPage);

  const rightPage = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.06, 0.7),
    rightPageMaterial,
  );
  rightPage.position.set(x + 0.38, baseY + 0.88, z - 1.2);
  rightPage.rotation.z = -0.16;
  rightPage.rotation.y = -0.2;
  scene.add(rightPage);

  worldState.libraryTrigger = {
    x,
    z: z - 1.2,
    activated: false,
  };
}

function createTextSprite(text, { width, height, font, color }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, width, height);
  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.5, 1.05, 1);
  return sprite;
}

function createBookPageTexture(lineA, lineB) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f2eadb";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#6d5d47";
  context.fillRect(30, 30, canvas.width - 60, canvas.height - 60);
  context.fillStyle = "#f7f0e2";
  context.fillRect(46, 46, canvas.width - 92, canvas.height - 92);
  context.fillStyle = "#24170f";
  context.font = "bold 86px serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(lineA, canvas.width / 2, canvas.height / 2 - 72);
  context.fillText(lineB, canvas.width / 2, canvas.height / 2 + 52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createRubblePatch(x, z, seed, parent = scene) {
  const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a433d, roughness: 1 });
  const count = 7 + (seed % 4);

  for (let i = 0; i < count; i++) {
    const width = 0.6 + ((seed + i) % 3) * 0.35;
    const height = 0.35 + ((seed + i * 2) % 4) * 0.22;
    const depth = 0.7 + ((seed + i * 3) % 3) * 0.45;
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      rubbleMaterial,
    );
    const offsetX = ((i % 4) - 1.5) * 1.1 + (seed % 2) * 0.35;
    const offsetZ = (Math.floor(i / 2) - 2) * 0.9;
    chunk.position.set(x + offsetX, 27 + height / 2, z + offsetZ);
    chunk.rotation.y = (seed + i) * 0.37;
    parent.add(chunk);
  }
}

function createDeadTreesPatch(x, z, seed, parent = scene) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: 1 });
  const branchMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2d24, roughness: 1 });

  for (let i = 0; i < 4; i++) {
    const trunkHeight = 2.8 + ((seed + i) % 3) * 0.7;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.22, trunkHeight, 6),
      trunkMaterial,
    );
    const offsetX = (i - 1.5) * 2.1;
    const offsetZ = ((i % 2) * 2 - 1) * 1.3;
    trunk.position.set(x + offsetX, 27 + trunkHeight / 2, z + offsetZ);
    trunk.rotation.z = ((seed + i) % 3 - 1) * 0.18;
    parent.add(trunk);

    for (let branchIndex = 0; branchIndex < 2; branchIndex++) {
      const branch = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.1, 0.12),
        branchMaterial,
      );
      branch.position.set(
        trunk.position.x + (branchIndex === 0 ? -0.25 : 0.25),
        trunk.position.y + trunkHeight * 0.18,
        trunk.position.z,
      );
      branch.rotation.z = branchIndex === 0 ? -0.9 : 0.9;
      branch.rotation.x = 0.4;
      parent.add(branch);
    }
  }
}

function createBrokenRoadPatch(x, z, seed, parent = scene) {
  const asphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3034, roughness: 0.94 });
  const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0x8c7e4c, roughness: 0.85 });

  for (let i = 0; i < 4; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.18, 1.8),
      asphaltMaterial,
    );
    slab.position.set(x + (i - 1.5) * 2.4, 27.05 + (i % 2) * 0.08, z + ((seed + i) % 2 === 0 ? -0.35 : 0.35));
    slab.rotation.y = ((seed + i) % 5 - 2) * 0.08;
    parent.add(slab);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.02, 0.8),
      stripeMaterial,
    );
    stripe.position.set(slab.position.x, slab.position.y + 0.1, slab.position.z);
    stripe.rotation.y = slab.rotation.y;
    parent.add(stripe);
  }
}

function createRuinedSector(sectorX, sectorZ) {
  const sectorKey = `${sectorX}:${sectorZ}`;
  if (worldState.ruinSectors.has(sectorKey)) {
    return;
  }

  const sector = new THREE.Group();
  ruinsGroup.add(sector);
  worldState.ruinSectors.set(sectorKey, sector);

  const worldX = sectorX * RUIN_SECTOR_SIZE;
  const worldZ = sectorZ * RUIN_SECTOR_SIZE;
  const variant = Math.abs((sectorX * 7 + sectorZ * 11) % 3);
  const seed = sectorX * 17 + sectorZ * 13;

  if (variant === 0) {
    createRubblePatch(worldX, worldZ, seed, sector);
    return;
  }

  if (variant === 1) {
    createDeadTreesPatch(worldX, worldZ, seed, sector);
    return;
  }

  createBrokenRoadPatch(worldX, worldZ, seed, sector);
}

function updateInfiniteRuins() {
  const centerSectorX = Math.round(player.position.x / RUIN_SECTOR_SIZE);
  const centerSectorZ = Math.round(player.position.z / RUIN_SECTOR_SIZE);
  const requiredKeys = new Set();

  for (let dx = -RUIN_VISIBLE_RADIUS; dx <= RUIN_VISIBLE_RADIUS; dx++) {
    for (let dz = -RUIN_VISIBLE_RADIUS; dz <= RUIN_VISIBLE_RADIUS; dz++) {
      const sectorX = centerSectorX + dx;
      const sectorZ = centerSectorZ + dz;
      const worldZ = sectorZ * RUIN_SECTOR_SIZE;
      if (worldZ > RUIN_START_Z) {
        continue;
      }

      const key = `${sectorX}:${sectorZ}`;
      requiredKeys.add(key);
      createRuinedSector(sectorX, sectorZ);
    }
  }

  for (const [key, sector] of worldState.ruinSectors) {
    if (requiredKeys.has(key)) {
      continue;
    }
    ruinsGroup.remove(sector);
    worldState.ruinSectors.delete(key);
  }
}

function shouldCreateLibrary(column, row) {
  return (column === 1 && row === 3) || (column === 3 && row === 1) || (column === 4 && row === 4);
}

function createBuildingDistrict() {
  for (let column = 0; column < 5; column++) {
    for (let row = 0; row < 5; row++) {
      const x = column * 12;
      const z = -72 - row * 12;

      if (shouldCreateLibrary(column, row)) {
        createLibrary(x, z);
        continue;
      }

      createHouse(x, z);
    }
  }
}

// velká zem
  const bigGroundGeometry = new THREE.BoxGeometry(200, 2, 200);
  const bigGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });

  const bigGround = new THREE.Mesh(bigGroundGeometry, bigGroundMaterial);
  bigGround.position.set(0, 27, -170);
  scene.add(bigGround);

// OVLÁDÁNÍ
document.addEventListener("keydown", (event) => {
  if (event.code === "F5") {
    event.preventDefault();
    cameraModeIndex = (cameraModeIndex + 1) % 3;
    return;
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") moveState.left = true;
  if (event.code === "ArrowRight" || event.code === "KeyD") moveState.right = true;
  if (event.code === "ArrowUp" || event.code === "KeyW") moveState.forward = true;
  if (event.code === "ArrowDown" || event.code === "KeyS") moveState.backward = true;

  if (event.code === "Space" && isOnGround) {
    velocityY = 0.28;
    isOnGround = false;
  }
});

document.addEventListener("keyup", (event) => {
  if (
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight" ||
    event.code === "KeyA" ||
    event.code === "KeyD"
  ) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") moveState.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") moveState.right = false;
  }

  if (
    event.code === "ArrowUp" ||
    event.code === "ArrowDown" ||
    event.code === "KeyW" ||
    event.code === "KeyS"
  ) {
    if (event.code === "ArrowUp" || event.code === "KeyW") moveState.forward = false;
    if (event.code === "ArrowDown" || event.code === "KeyS") moveState.backward = false;
  }
});

// KAMERA
let angle = 0;
let pitch = 0.3;
const distance = 8;

document.addEventListener("mousedown", (event) => {
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }

  if (event.button === 0 && !isAttacking) {
    isAttacking = true;
    attackProgress = 0;
  }
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== renderer.domElement) return;

  angle -= event.movementX * 0.005;
  pitch += event.movementY * 0.005;

  pitch = Math.max(-1.2, Math.min(1.2, pitch));
});

function resolvePlayerPlatformCollisions(previousPosition) {
  isOnGround = false;

  for (const platform of platforms) {
    const px = platform.position.x;
    const py = platform.position.y;
    const pz = platform.position.z;

    const halfW = platform.geometry.parameters.width / 2;
    const halfD = platform.geometry.parameters.depth / 2;
    const halfH = platform.geometry.parameters.height / 2;

    const dx = player.position.x - px;
    const dy = player.position.y - py;
    const dz = player.position.z - pz;

    const overlapX = halfW + playerHalfSize - Math.abs(dx);
    const overlapY = halfH + playerHalfSize - Math.abs(dy);
    const overlapZ = halfD + playerHalfSize - Math.abs(dz);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
      continue;
    }

    const previousBottom = previousPosition.y - playerHalfSize;
    const previousTop = previousPosition.y + playerHalfSize;
    const platformTop = py + halfH;
    const platformBottom = py - halfH;

    const cameFromAbove = previousBottom >= platformTop && velocityY <= 0;
    const cameFromBelow = previousTop <= platformBottom && velocityY >= 0;

    if (cameFromAbove) {
      player.position.y = platformTop + playerHalfSize;
      velocityY = 0;
      isOnGround = true;
      continue;
    }

    if (cameFromBelow) {
      player.position.y = platformBottom - playerHalfSize;
      velocityY = Math.min(0, velocityY);
      continue;
    }

    if (overlapX <= overlapZ) {
      player.position.x = px + (dx < 0 ? -(halfW + playerHalfSize) : halfW + playerHalfSize);
      speedX = 0;
      continue;
    }

    player.position.z = pz + (dz < 0 ? -(halfD + playerHalfSize) : halfD + playerHalfSize);
    speedZ = 0;
  }
}

// ANIMACE
function animate() {
  requestAnimationFrame(animate);

  player.rotation.y = angle;
  playerForward.set(-Math.sin(angle), 0, -Math.cos(angle));
  playerRight.set(Math.cos(angle), 0, -Math.sin(angle));
  speedX =
    (Number(moveState.right) - Number(moveState.left)) * playerRight.x * moveSpeed +
    (Number(moveState.forward) - Number(moveState.backward)) * playerForward.x * moveSpeed;
  speedZ =
    (Number(moveState.right) - Number(moveState.left)) * playerRight.z * moveSpeed +
    (Number(moveState.forward) - Number(moveState.backward)) * playerForward.z * moveSpeed;

  flashlight.position.copy(camera.position);
  if (cameraModeIndex === 0) {
    ambient.intensity = 1.45;
    flashlight.intensity = 9;
    flashlight.angle = Math.PI / 2.8;
    flashlight.target.position.copy(camera.position);
    flashlight.target.position.addScaledVector(playerForward, 12);
    flashlight.target.position.y -= Math.sin(pitch) * 12;
  } else {
    ambient.intensity = 1;
    flashlight.intensity = 6;
    flashlight.angle = Math.PI / 3;
    flashlight.target.position.copy(player.position);
    flashlight.target.position.addScaledVector(playerForward, 6);
  }

  // POHYB HRÁČE
  const previousPosition = player.position.clone();
  velocityY += gravity;
  player.position.y += velocityY;

  player.position.x += speedX;
  player.position.z += speedZ;

  // ÚTOK MEČEM
  if (isAttacking) {
    attackProgress += 0.1;
    sword.rotation.x = Math.sin(attackProgress * Math.PI) * 1.5;

    if (attackProgress >= 1) {
      isAttacking = false;
      sword.rotation.x = 0;
    }
  }

  // POHYB NEPŘÍTELE
  const dir = new THREE.Vector3();
  dir.subVectors(player.position, enemy.position).normalize();
  enemy.position.add(dir.multiplyScalar(enemySpeed));

  if (worldState.libraryTrigger && !worldState.libraryTrigger.activated) {
    const dx = player.position.x - worldState.libraryTrigger.x;
    const dz = player.position.z - worldState.libraryTrigger.z;
    if (Math.hypot(dx, dz) < 2.8) {
      worldState.libraryTrigger.activated = true;
      libraryEnemy.visible = true;
      libraryEnemy.position.set(
        worldState.libraryTrigger.x + 1.8,
        29,
        worldState.libraryTrigger.z + 0.2,
      );
    }
  }

  if (libraryEnemy.visible) {
    const libraryEnemyDir = new THREE.Vector3();
    libraryEnemyDir.subVectors(player.position, libraryEnemy.position).normalize();
    libraryEnemy.position.add(libraryEnemyDir.multiplyScalar(0.032));
  }

  // KOLIZE HRÁČE S NEPŘÍTELEM
  if (enemy.position.distanceTo(player.position) < 1.0) {
    enemySpeed = 0.02;
    player.position.set(0, 1, 0);
    velocityY = 0;
    isOnGround = true;
    enemy.position.set(0, 1, -50);
  }

  if (libraryEnemy.visible && libraryEnemy.position.distanceTo(player.position) < 1.0) {
    player.position.set(0, 1, 0);
    velocityY = 0;
    isOnGround = true;
    libraryEnemy.visible = false;
    if (worldState.libraryTrigger) {
      worldState.libraryTrigger.activated = false;
    }
  }

  // ZÁSAH MEČEM
  if (isAttacking) {
    const swordWorldPos = new THREE.Vector3();
    sword.getWorldPosition(swordWorldPos);

    if (swordWorldPos.distanceTo(enemy.position) < 1.2) {
      enemySpeed += 0.01;
      enemy.position.set(Math.random() * 30 - 20, Math.random() * 30 - 20, Math.random() * 30 - 20);
    }

    if (libraryEnemy.visible && swordWorldPos.distanceTo(libraryEnemy.position) < 1.2) {
      libraryEnemy.visible = false;
      if (worldState.libraryTrigger) {
        worldState.libraryTrigger.activated = false;
      }
    }
  }

  // KOLIZE S PLOŠINAMI
  resolvePlayerPlatformCollisions(previousPosition);
  updateInfiniteRuins();

  // ZEM
  if (player.position.y <= -10) {
    enemySpeed = 0.02;
    player.position.set(5, 1, 0);
    velocityY = 0;
    isOnGround = true;
    enemy.position.set(0, 1, -50);
  }

  // KAMERA
  if (cameraModeIndex === 0) {
    const eyeOffset = 0.85;
    const forwardOffset = 0.18;
    const lookDistance = 10;
    player.visible = false;
    camera.position.copy(player.position);
    camera.position.addScaledVector(playerForward, forwardOffset);
    camera.position.y += eyeOffset;
    cameraTarget.copy(camera.position);
    cameraTarget.addScaledVector(playerForward, lookDistance);
    cameraTarget.y -= Math.sin(pitch) * lookDistance;
    camera.lookAt(cameraTarget);
  } else if (cameraModeIndex === 1) {
    player.visible = true;
    const shoulderDistance = 3.2;
    camera.position.copy(player.position);
    camera.position.addScaledVector(playerForward, -shoulderDistance);
    camera.position.addScaledVector(playerRight, 1.35);
    camera.position.y += 1.7;
    cameraTarget.copy(player.position);
    cameraTarget.y += 1.3;
    camera.lookAt(cameraTarget);
  } else {
    player.visible = true;
    const offsetY = Math.sin(pitch) * distance + 3;

    camera.position.copy(player.position);
    camera.position.addScaledVector(playerForward, -distance);
    camera.position.y += offsetY;
    cameraTarget.copy(player.position);
    camera.lookAt(cameraTarget);
  }

  renderer.render(scene, camera);
}
// platformy
platforms.push(ground);
platforms.push(bigGround);
createPlatform(0, 2, -5, 4, 0.5, 4);
createPlatform(5, 4, -10, 4, 0.5, 4);
createPlatform(-2, 6, -15, 4, 0.5, 4);
createPlatform(3, 8, -20, 5, 0.5, 4);
createPlatform(-4, 10, -25, 6, 0.5, 5);
createPlatform(0, 12, -30, 4, 0.5, 6);
createPlatform(6, 14, -35, 3, 0.5, 4);
createPlatform(9, 16, -40, 4, 0.5, 4);
createPlatform(7, 18, -45, 4, 0.5, 4);
createPlatform(3, 20, -50, 5, 0.5, 4);
createPlatform(-1, 22, -55, 5, 0.5, 4);
createPlatform(-4, 24, -60, 6, 0.5, 4);
createPlatform(-2, 26, -65, 4, 0.5, 4);
createPlatform(2, 28, -70, 4, 0.5, 4);
createBuildingDistrict();
updateInfiniteRuins();

animate();

// konec
