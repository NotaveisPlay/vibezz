import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SUPABASE_ASSETS_BUCKET, getPublicAssetUrl, supabase } from "./supabaseClient.js";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const startButton = document.querySelector("#start-button");
const hud = document.querySelector("#hud");
const fullscreenButton = document.querySelector("#fullscreen-button");
const joystick = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystick-knob");
const expandModeButton = document.querySelector("#expand-mode-button");
const expandPanel = document.querySelector("#expand-panel");
const closeExpandButton = document.querySelector("#close-expand-button");
const unlockExpandButton = document.querySelector("#unlock-expand-button");
const coinCount = document.querySelector("#coin-count");
const expandAmountInput = document.querySelector("#expand-amount");
const expandAmountLabel = document.querySelector("#expand-amount-label");
const expandCostLabel = document.querySelector("#expand-cost-label");
const sideButtons = document.querySelectorAll(".side-button");
const shopButton = document.querySelector("#shop-button");
const shopPanel = document.querySelector("#shop-panel");
const closeShopButton = document.querySelector("#close-shop-button");
const refreshShopButton = document.querySelector("#refresh-shop-button");
const shopStatus = document.querySelector("#shop-status");
const shopList = document.querySelector("#shop-list");
const shopPreviewCanvas = document.querySelector("#shop-preview");
const shopItemName = document.querySelector("#shop-item-name");
const shopItemPath = document.querySelector("#shop-item-path");
const shopItemPrice = document.querySelector("#shop-item-price");
const shopItemCategory = document.querySelector("#shop-item-category");
const shopItemSource = document.querySelector("#shop-item-source");
const placeShopItemButton = document.querySelector("#place-shop-item-button");
const catalogPrevButton = document.querySelector("#catalog-prev-button");
const catalogNextButton = document.querySelector("#catalog-next-button");
const editRoomButton = document.querySelector("#edit-room-button");
const editPanel = document.querySelector("#edit-panel");
const closeEditButton = document.querySelector("#close-edit-button");
const editStatus = document.querySelector("#edit-status");
const moveButtons = document.querySelectorAll(".move-button");
const editZoomInButton = document.querySelector("#edit-zoom-in-button");
const editZoomOutButton = document.querySelector("#edit-zoom-out-button");
const objectToolButtons = document.querySelectorAll(".object-tool-button");

const START_ROOM_SIZE = 5;
const EXPAND_MODULE_SIZE = 3;
const EXPAND_MODULE_COST = 3000;
const PLAYER_RADIUS = 0.28;
const PLAYER_HEIGHT = 1.62;
const MOVE_SPEED = 3.0;
const MOUSE_SENSITIVITY = 0.0022;
const TOUCH_LOOK_SENSITIVITY = 0.004;
const JOYSTICK_RADIUS = 48;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171923);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 60);
camera.rotation.order = "YXZ";

const shopRenderer = new THREE.WebGLRenderer({
  canvas: shopPreviewCanvas,
  alpha: true,
  antialias: false,
  powerPreference: "high-performance",
});
shopRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
shopRenderer.outputColorSpace = THREE.SRGBColorSpace;

const shopScene = new THREE.Scene();
const shopCamera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
shopCamera.position.set(0, 1.2, 4.2);
shopCamera.lookAt(0, 0.8, 0);
shopScene.add(new THREE.HemisphereLight(0xffffff, 0x53617a, 2.4));

const shopKeyLight = new THREE.DirectionalLight(0xffffff, 2.1);
shopKeyLight.position.set(2.5, 4, 3.5);
shopScene.add(shopKeyLight);

const player = {
  position: new THREE.Vector3(0, PLAYER_HEIGHT, 0),
  yaw: 0,
  pitch: 0,
  keyboard: new THREE.Vector2(0, 0),
  joystick: new THREE.Vector2(0, 0),
};

const room = {
  left: -START_ROOM_SIZE / 2,
  right: START_ROOM_SIZE / 2,
  back: -START_ROOM_SIZE / 2,
  front: START_ROOM_SIZE / 2,
  coins: 5000,
};

const view = {
  mode: "play",
  orbitYaw: Math.PI * 0.24,
  orbitPitch: 0.86,
  orbitDistance: 9.2,
  orbitTarget: new THREE.Vector3(0, 0.8, 0),
  isOrbiting: false,
  lastPointerX: 0,
  lastPointerY: 0,
  editPosition: new THREE.Vector3(),
};

const expansion = {
  side: "right",
  modules: 1,
};

const keys = new Set();
const activeTouches = {
  joystickId: null,
  lookId: null,
  lastLookX: 0,
  lastLookY: 0,
};

let roomGroup = null;
const roomWalls = {
  back: null,
  front: null,
  left: null,
  right: null,
};
let expansionPreview = null;
let shopItems = [];
let selectedShopItem = null;
let shopPreviewModel = null;
const editableObjects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x77d6a8);

const editor = {
  selected: null,
  isDraggingObject: false,
};

selectionBox.visible = false;
scene.add(selectionBox);

const proceduralCatalog = [
  { id: "desk_setup", name: "Mesa Setup", price: 420, kind: "procedural", category: "Setup" },
  { id: "pc_tower", name: "PC Gamer", price: 320, kind: "procedural", category: "Setup" },
  { id: "cozy_bed", name: "Cama Cozy", price: 520, kind: "procedural", category: "Quarto" },
  { id: "small_shelf", name: "Prateleira Geek", price: 260, kind: "procedural", category: "Decor" },
  { id: "poster_frame", name: "Poster Pixel", price: 120, kind: "procedural", category: "Parede" },
  { id: "tv_stand", name: "Rack com TV", price: 460, kind: "procedural", category: "Setup" },
  { id: "led_bar", name: "Barra LED", price: 160, kind: "procedural", category: "Luz" },
];

function makeMaterial(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function makeWallMaterial(color) {
  return new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity: 0.92,
  });
}

function addBoxToGroup(group, { name, size, position, color }) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, makeMaterial(color));
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addModelBox(group, name, size, position, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), makeMaterial(color));
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addModelCylinder(group, name, radius, height, position, color, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), makeMaterial(color));
  mesh.name = name;
  mesh.position.copy(position);
  group.add(mesh);
  return mesh;
}

function addWallToGroup(group, { name, side, size, position, color }) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, makeWallMaterial(color));
  mesh.name = name;
  mesh.position.copy(position);
  mesh.userData.wallSide = side;
  group.add(mesh);
  roomWalls[side] = mesh;
  return mesh;
}

function createRoom() {
  if (roomGroup) {
    scene.remove(roomGroup);
  }

  roomWalls.back = null;
  roomWalls.front = null;
  roomWalls.left = null;
  roomWalls.right = null;

  roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const wallThickness = 0.12;
  const wallHeight = 3;
  const wallY = wallHeight / 2;
  const width = room.right - room.left;
  const depth = room.front - room.back;
  const centerX = (room.left + room.right) / 2;
  const centerZ = (room.back + room.front) / 2;

  addBoxToGroup(roomGroup, {
    name: "Floor",
    size: new THREE.Vector3(width, 0.12, depth),
    position: new THREE.Vector3(centerX, -0.06, centerZ),
    color: 0xc9965b,
  });

  addWallToGroup(roomGroup, {
    name: "BackWall",
    side: "back",
    size: new THREE.Vector3(width, wallHeight, wallThickness),
    position: new THREE.Vector3(centerX, wallY, room.back),
    color: 0xf0d9bd,
  });

  addWallToGroup(roomGroup, {
    name: "FrontWall",
    side: "front",
    size: new THREE.Vector3(width, wallHeight, wallThickness),
    position: new THREE.Vector3(centerX, wallY, room.front),
    color: 0xe9c7da,
  });

  addWallToGroup(roomGroup, {
    name: "LeftWall",
    side: "left",
    size: new THREE.Vector3(wallThickness, wallHeight, depth),
    position: new THREE.Vector3(room.left, wallY, centerZ),
    color: 0xd6edf0,
  });

  addWallToGroup(roomGroup, {
    name: "RightWall",
    side: "right",
    size: new THREE.Vector3(wallThickness, wallHeight, depth),
    position: new THREE.Vector3(room.right, wallY, centerZ),
    color: 0xd9e8bd,
  });

}

function createDashedRectangle(points, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: 0.24, gapSize: 0.16 }));
  line.computeLineDistances();
  return line;
}

function createExpansionPreview() {
  if (expansionPreview) {
    scene.remove(expansionPreview);
  }

  expansionPreview = new THREE.Group();
  expansionPreview.visible = false;
  scene.add(expansionPreview);

  updateExpansionPreview();
}

function updateExpansionPreview() {
  if (!expansionPreview) return;
  expansionPreview.clear();

  const preview = getExpansionBounds();
  const y = 0.03;
  const wallHeight = 3;
  const color = 0xffffff;
  const width = preview.x2 - preview.x1;
  const depth = preview.z2 - preview.z1;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color: 0x79d6ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((preview.x1 + preview.x2) / 2, 0.02, (preview.z1 + preview.z2) / 2);
  expansionPreview.add(floor);

  expansionPreview.add(
    createDashedRectangle(
      [
        new THREE.Vector3(preview.x1, y, preview.z1),
        new THREE.Vector3(preview.x2, y, preview.z1),
        new THREE.Vector3(preview.x2, y, preview.z2),
        new THREE.Vector3(preview.x1, y, preview.z2),
        new THREE.Vector3(preview.x1, y, preview.z1),
      ],
      color,
    ),
  );

  expansionPreview.add(
    createDashedRectangle(
      [
        new THREE.Vector3(preview.outerA.x, y, preview.outerA.z),
        new THREE.Vector3(preview.outerA.x, wallHeight, preview.outerA.z),
        new THREE.Vector3(preview.outerB.x, wallHeight, preview.outerB.z),
        new THREE.Vector3(preview.outerB.x, y, preview.outerB.z),
        new THREE.Vector3(preview.outerA.x, y, preview.outerA.z),
      ],
      color,
    ),
  );
}

function getExpansionDistance() {
  return expansion.modules * EXPAND_MODULE_SIZE;
}

function getExpansionCost() {
  return expansion.modules * EXPAND_MODULE_COST;
}

function getExpansionBounds() {
  const distance = getExpansionDistance();

  if (expansion.side === "right") {
    return {
      x1: room.right,
      x2: room.right + distance,
      z1: room.back,
      z2: room.front,
      outerA: new THREE.Vector3(room.right + distance, 0, room.back),
      outerB: new THREE.Vector3(room.right + distance, 0, room.front),
    };
  }

  if (expansion.side === "left") {
    return {
      x1: room.left - distance,
      x2: room.left,
      z1: room.back,
      z2: room.front,
      outerA: new THREE.Vector3(room.left - distance, 0, room.front),
      outerB: new THREE.Vector3(room.left - distance, 0, room.back),
    };
  }

  if (expansion.side === "front") {
    return {
      x1: room.left,
      x2: room.right,
      z1: room.front,
      z2: room.front + distance,
      outerA: new THREE.Vector3(room.left, 0, room.front + distance),
      outerB: new THREE.Vector3(room.right, 0, room.front + distance),
    };
  }

  return {
    x1: room.left,
    x2: room.right,
    z1: room.back - distance,
    z2: room.back,
    outerA: new THREE.Vector3(room.right, 0, room.back - distance),
    outerB: new THREE.Vector3(room.left, 0, room.back - distance),
  };
}

function createLighting() {
  scene.add(new THREE.HemisphereLight(0xfff4de, 0x4d5a78, 1.8));

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
}

function registerEditableObject(object, displayName) {
  object.userData.editableRoot = object;
  object.userData.displayName = displayName;
  object.userData.baseScale = object.scale.clone();
  object.userData.scaleMultiplier = 1;

  object.traverse((child) => {
    child.userData.editableRoot = object;
    child.userData.displayName = displayName;
  });

  if (!editableObjects.includes(object)) {
    editableObjects.push(object);
  }
}

function unregisterEditableObject(object) {
  const index = editableObjects.indexOf(object);
  if (index >= 0) editableObjects.splice(index, 1);
}

function selectEditableObject(object) {
  editor.selected = object;
  selectionBox.setFromObject(object);
  selectionBox.visible = true;
  editStatus.textContent = `${object.userData.displayName || object.name} selecionado. Arraste ou use as setas.`;
  updateMoveButtons();
}

function clearSelection() {
  editor.selected = null;
  selectionBox.visible = false;
  editStatus.textContent = "Toque em um objeto para selecionar.";
  updateMoveButtons();
}

function updateSelectionBox() {
  if (!editor.selected) return;
  selectionBox.setFromObject(editor.selected);
}

function updateMoveButtons() {
  moveButtons.forEach((button) => {
    button.disabled = !editor.selected;
  });
  objectToolButtons.forEach((button) => {
    button.disabled = !editor.selected;
  });
}

function moveSelectedObject(direction) {
  if (!editor.selected) return;

  const step = 0.25;
  if (direction === "forward") editor.selected.position.z -= step;
  if (direction === "back") editor.selected.position.z += step;
  if (direction === "left") editor.selected.position.x -= step;
  if (direction === "right") editor.selected.position.x += step;

  clampObjectToRoom(editor.selected);
  updateSelectionBox();
}

function transformSelectedObject(action) {
  if (!editor.selected) return;

  if (action === "delete") {
    deleteSelectedObject();
    return;
  }

  if (action === "raise") {
    editor.selected.position.y = THREE.MathUtils.clamp(editor.selected.position.y + 0.1, -0.5, 3);
  }

  if (action === "lower") {
    editor.selected.position.y = THREE.MathUtils.clamp(editor.selected.position.y - 0.1, -0.5, 3);
  }

  if (action === "rotate-left") {
    editor.selected.rotation.y += THREE.MathUtils.degToRad(15);
  }

  if (action === "rotate-right") {
    editor.selected.rotation.y -= THREE.MathUtils.degToRad(15);
  }

  if (action === "scale-up" || action === "scale-down") {
    const nextMultiplier =
      action === "scale-up"
        ? editor.selected.userData.scaleMultiplier + 0.1
        : editor.selected.userData.scaleMultiplier - 0.1;

    editor.selected.userData.scaleMultiplier = THREE.MathUtils.clamp(nextMultiplier, 0.25, 3);
    editor.selected.scale.copy(editor.selected.userData.baseScale).multiplyScalar(editor.selected.userData.scaleMultiplier);
  }

  clampObjectToRoom(editor.selected);
  updateSelectionBox();
}

function deleteSelectedObject() {
  if (!editor.selected) return;

  const object = editor.selected;
  unregisterEditableObject(object);
  object.removeFromParent();
  clearSelection();
}

function clampObjectToRoom(object) {
  object.position.x = THREE.MathUtils.clamp(object.position.x, room.left + 0.25, room.right - 0.25);
  object.position.z = THREE.MathUtils.clamp(object.position.z, room.back + 0.25, room.front - 0.25);
}

function setPointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickEditableObject(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObjects(editableObjects, true);
  if (intersections.length === 0) return null;

  return intersections[0].object.userData.editableRoot || null;
}

function getFloorPoint(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(floorPlane, dragPoint);
}

function getNiceItemName(fileName) {
  return fileName
    .replace(/\.(glb|gltf)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makeShopItem(fileName) {
  return {
    id: `remote:${fileName}`,
    name: getNiceItemName(fileName),
    kind: "remote",
    category: "Supabase",
    path: `models/${fileName}`,
    price: 250,
  };
}

function createProceduralModel(id) {
  const group = new THREE.Group();
  group.name = id;

  if (id === "desk_setup") {
    addModelBox(group, "DeskTop", new THREE.Vector3(1.45, 0.12, 0.62), new THREE.Vector3(0, 0.74, 0), 0x566cc9);
    addModelBox(group, "DeskLegA", new THREE.Vector3(0.1, 0.72, 0.1), new THREE.Vector3(-0.6, 0.36, -0.22), 0x2f3446);
    addModelBox(group, "DeskLegB", new THREE.Vector3(0.1, 0.72, 0.1), new THREE.Vector3(0.6, 0.36, -0.22), 0x2f3446);
    addModelBox(group, "DeskLegC", new THREE.Vector3(0.1, 0.72, 0.1), new THREE.Vector3(-0.6, 0.36, 0.22), 0x2f3446);
    addModelBox(group, "DeskLegD", new THREE.Vector3(0.1, 0.72, 0.1), new THREE.Vector3(0.6, 0.36, 0.22), 0x2f3446);
    addModelBox(group, "Monitor", new THREE.Vector3(0.68, 0.42, 0.06), new THREE.Vector3(0, 1.08, -0.24), 0x151925);
    addModelBox(group, "MonitorStand", new THREE.Vector3(0.1, 0.25, 0.08), new THREE.Vector3(0, 0.9, -0.2), 0x202638);
    addModelBox(group, "Keyboard", new THREE.Vector3(0.52, 0.04, 0.16), new THREE.Vector3(-0.18, 0.83, 0.08), 0x252b3e);
    addModelBox(group, "Mousepad", new THREE.Vector3(0.36, 0.03, 0.24), new THREE.Vector3(0.32, 0.83, 0.08), 0x77d6a8);
  }

  if (id === "pc_tower") {
    addModelBox(group, "Case", new THREE.Vector3(0.42, 0.78, 0.62), new THREE.Vector3(0, 0.39, 0), 0x222838);
    addModelBox(group, "Glass", new THREE.Vector3(0.03, 0.58, 0.46), new THREE.Vector3(-0.225, 0.44, 0), 0x1b708a);
    addModelBox(group, "FrontLed", new THREE.Vector3(0.035, 0.62, 0.05), new THREE.Vector3(0.225, 0.44, -0.22), 0x77d6a8);
    addModelCylinder(group, "FanTop", 0.1, 0.035, new THREE.Vector3(-0.23, 0.57, 0.12), 0x79d6ff);
    addModelCylinder(group, "FanBottom", 0.1, 0.035, new THREE.Vector3(-0.23, 0.31, 0.12), 0xf0b33f);
  }

  if (id === "cozy_bed") {
    addModelBox(group, "Base", new THREE.Vector3(1.85, 0.32, 1.08), new THREE.Vector3(0, 0.16, 0), 0x3c455d);
    addModelBox(group, "Mattress", new THREE.Vector3(1.72, 0.22, 0.98), new THREE.Vector3(0, 0.43, 0), 0xe8d8c6);
    addModelBox(group, "Blanket", new THREE.Vector3(1.72, 0.08, 0.55), new THREE.Vector3(0, 0.6, 0.2), 0x6d7fd1);
    addModelBox(group, "PillowA", new THREE.Vector3(0.55, 0.12, 0.28), new THREE.Vector3(-0.38, 0.62, -0.32), 0xf5eadb);
    addModelBox(group, "PillowB", new THREE.Vector3(0.55, 0.12, 0.28), new THREE.Vector3(0.38, 0.62, -0.32), 0xf5eadb);
    addModelBox(group, "Headboard", new THREE.Vector3(1.92, 0.72, 0.12), new THREE.Vector3(0, 0.42, -0.58), 0x2e3346);
  }

  if (id === "small_shelf") {
    addModelBox(group, "ShelfBack", new THREE.Vector3(1.15, 0.08, 0.16), new THREE.Vector3(0, 1.05, 0), 0x47372f);
    addModelBox(group, "ShelfTop", new THREE.Vector3(1.25, 0.08, 0.28), new THREE.Vector3(0, 1.24, 0), 0x6f5140);
    addModelBox(group, "ShelfMid", new THREE.Vector3(1.25, 0.08, 0.28), new THREE.Vector3(0, 0.92, 0), 0x6f5140);
    addModelBox(group, "BookA", new THREE.Vector3(0.1, 0.3, 0.16), new THREE.Vector3(-0.38, 1.08, 0), 0x6d7fd1);
    addModelBox(group, "BookB", new THREE.Vector3(0.1, 0.25, 0.16), new THREE.Vector3(-0.25, 1.05, 0), 0xf0b33f);
    addModelCylinder(group, "PlantPot", 0.1, 0.16, new THREE.Vector3(0.36, 1.04, 0), 0xd48b62);
    addModelBox(group, "Plant", new THREE.Vector3(0.18, 0.22, 0.18), new THREE.Vector3(0.36, 1.23, 0), 0x77d6a8);
  }

  if (id === "poster_frame") {
    addModelBox(group, "Frame", new THREE.Vector3(0.78, 1.08, 0.06), new THREE.Vector3(0, 0.74, 0), 0x1c2030);
    addModelBox(group, "Art", new THREE.Vector3(0.64, 0.88, 0.065), new THREE.Vector3(0, 0.74, -0.005), 0x79d6ff);
    addModelBox(group, "PixelSun", new THREE.Vector3(0.18, 0.18, 0.07), new THREE.Vector3(-0.16, 0.88, -0.02), 0xf0b33f);
    addModelBox(group, "PixelHill", new THREE.Vector3(0.48, 0.22, 0.07), new THREE.Vector3(0.08, 0.52, -0.02), 0x77d6a8);
  }

  if (id === "tv_stand") {
    addModelBox(group, "Stand", new THREE.Vector3(1.42, 0.36, 0.44), new THREE.Vector3(0, 0.18, 0), 0x30354a);
    addModelBox(group, "DrawerA", new THREE.Vector3(0.5, 0.2, 0.05), new THREE.Vector3(-0.34, 0.2, -0.225), 0x48506d);
    addModelBox(group, "DrawerB", new THREE.Vector3(0.5, 0.2, 0.05), new THREE.Vector3(0.34, 0.2, -0.225), 0x48506d);
    addModelBox(group, "TV", new THREE.Vector3(1.1, 0.64, 0.08), new THREE.Vector3(0, 0.9, -0.12), 0x151925);
    addModelBox(group, "TVStand", new THREE.Vector3(0.18, 0.28, 0.1), new THREE.Vector3(0, 0.54, -0.06), 0x202638);
  }

  if (id === "led_bar") {
    addModelBox(group, "LedBar", new THREE.Vector3(1.25, 0.08, 0.08), new THREE.Vector3(0, 1.05, 0), 0x77d6a8);
    addModelBox(group, "GlowFake", new THREE.Vector3(1.34, 0.12, 0.04), new THREE.Vector3(0, 1.05, -0.04), 0xb9ffe0);
  }

  return group;
}

function normalizeModelForPreview(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.15 / maxAxis;

  model.position.sub(center);
  model.scale.setScalar(scale);

  const normalizedBox = new THREE.Box3().setFromObject(model);
  model.position.y -= normalizedBox.min.y;
}

function clearShopPreview() {
  if (!shopPreviewModel) return;
  shopScene.remove(shopPreviewModel);
  shopPreviewModel = null;
}

function loadShopPreview(item) {
  clearShopPreview();
  shopItemName.textContent = item.name;
  shopItemPath.textContent =
    item.kind === "procedural"
      ? "Uma peca leve do Starter Pack, feita com formas simples para rodar bem no mobile."
      : "Modelo 3D carregado do Supabase Storage para testar assets externos.";
  shopItemPrice.textContent = `${item.price} moedas`;
  shopItemCategory.textContent = item.category;
  shopItemSource.textContent = item.kind === "procedural" ? "Starter" : "Supabase";
  shopStatus.textContent = item.kind === "procedural" ? "Starter Pack local, sem download." : `Visualizando ${item.name}.`;

  if (item.kind === "procedural") {
    shopPreviewModel = createProceduralModel(item.id);
    normalizeModelForPreview(shopPreviewModel);
    shopScene.add(shopPreviewModel);
    return;
  }

  const loader = new GLTFLoader();
  loader.load(
    getPublicAssetUrl(item.path),
    (gltf) => {
      shopPreviewModel = gltf.scene;
      normalizeModelForPreview(shopPreviewModel);
      shopScene.add(shopPreviewModel);
    },
    undefined,
    (error) => {
      shopStatus.textContent = `Nao consegui carregar o preview: ${error.message || "erro desconhecido"}`;
      console.error(error);
    },
  );
}

function renderShopList() {
  shopList.innerHTML = "";

  for (const item of shopItems) {
    const button = document.createElement("button");
    button.className = "shop-item-button";
    button.type = "button";
    button.dataset.itemId = item.id;
    button.innerHTML = `
      <span class="shop-item-icon">${String(shopItems.indexOf(item) + 1).padStart(2, "0")}</span>
      <span>
        <strong>${item.name}</strong>
        <small>${item.price} moedas - ${item.category}</small>
      </span>
    `;
    button.addEventListener("click", () => selectShopItem(item.id));
    shopList.appendChild(button);
  }
}

function selectShopItem(itemId) {
  selectedShopItem = shopItems.find((item) => item.id === itemId) || null;
  document.querySelectorAll(".shop-item-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.itemId === itemId);
  });

  if (selectedShopItem) {
    loadShopPreview(selectedShopItem);
  }
}

function selectShopOffset(offset) {
  if (shopItems.length === 0 || !selectedShopItem) return;

  const currentIndex = shopItems.findIndex((item) => item.id === selectedShopItem.id);
  const nextIndex = (currentIndex + offset + shopItems.length) % shopItems.length;
  selectShopItem(shopItems[nextIndex].id);
}

async function loadShopItems() {
  shopStatus.textContent = "Montando loja...";
  shopList.innerHTML = "";
  const localItems = proceduralCatalog.map((item) => ({ ...item }));

  const { data, error } = await supabase.storage.from(SUPABASE_ASSETS_BUCKET).list("models", {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    shopStatus.textContent = "Loja local carregada. Supabase indisponivel agora.";
    shopItems = localItems;
  } else {
    const remoteItems = data.filter((item) => /\.(glb|gltf)$/i.test(item.name)).map((item) => makeShopItem(item.name));
    shopItems = [...localItems, ...remoteItems];
    shopStatus.textContent = `${shopItems.length} item(s) disponiveis.`;
  }

  renderShopList();
  selectShopItem(shopItems[0].id);
}

function openShop() {
  resetJoystick();
  document.exitPointerLock?.();
  shopPanel.classList.add("is-visible");
  shopPanel.setAttribute("aria-hidden", "false");

  if (shopItems.length === 0) {
    loadShopItems();
  } else if (selectedShopItem) {
    loadShopPreview(selectedShopItem);
  }
}

function closeShop() {
  shopPanel.classList.remove("is-visible");
  shopPanel.setAttribute("aria-hidden", "true");
}

function placeSelectedShopItem() {
  if (!selectedShopItem) return;

  if (selectedShopItem.kind === "procedural") {
    const item = createProceduralModel(selectedShopItem.id);
    item.name = `Placed_${selectedShopItem.id}`;
    item.position.set(0.45, 0, -0.55);
    scene.add(item);
    registerEditableObject(item, selectedShopItem.name);
    closeShop();
    return;
  }

  const loader = new GLTFLoader();
  loader.load(
    getPublicAssetUrl(selectedShopItem.path),
    (gltf) => {
      const item = gltf.scene;
      item.name = `Placed_${selectedShopItem.id}`;
      item.position.set(0.85, 0, -0.8);
      item.rotation.y = Math.PI * 0.16;
      item.scale.setScalar(0.65);
      scene.add(item);
      registerEditableObject(item, selectedShopItem.name);
      closeShop();
    },
    undefined,
    (error) => {
      shopStatus.textContent = `Nao consegui colocar o item: ${error.message || "erro desconhecido"}`;
      console.error(error);
    },
  );
}

function renderShopPreview(delta) {
  if (!shopPanel.classList.contains("is-visible")) return;

  const rect = shopPreviewCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  if (shopPreviewCanvas.width !== width || shopPreviewCanvas.height !== height) {
    shopRenderer.setSize(width, height, false);
    shopCamera.aspect = width / height;
    shopCamera.updateProjectionMatrix();
  }

  if (shopPreviewModel) {
    shopPreviewModel.rotation.y += delta * 0.75;
  }

  shopRenderer.render(shopScene, shopCamera);
}

function updateKeyboardVector() {
  let x = 0;
  let y = 0;

  if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;

  player.keyboard.set(x, y);
  if (player.keyboard.lengthSq() > 1) player.keyboard.normalize();
}

function rotateLook(deltaX, deltaY, sensitivity) {
  player.yaw -= deltaX * sensitivity;
  player.pitch -= deltaY * sensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.25, 1.25);
}

function updateCamera() {
  if (view.mode === "expand" || view.mode === "edit") {
    updateOrbitCamera();
    return;
  }

  camera.position.copy(player.position);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function updateOrbitCamera() {
  const x = view.orbitTarget.x + Math.sin(view.orbitYaw) * Math.cos(view.orbitPitch) * view.orbitDistance;
  const y = view.orbitTarget.y + Math.sin(view.orbitPitch) * view.orbitDistance;
  const z = view.orbitTarget.z + Math.cos(view.orbitYaw) * Math.cos(view.orbitPitch) * view.orbitDistance;

  view.editPosition.set(x, y, z);
  camera.position.lerp(view.editPosition, 0.14);
  camera.lookAt(view.orbitTarget);
}

function updateEditorWallVisibility() {
  const allWalls = Object.values(roomWalls).filter(Boolean);

  if (view.mode !== "edit") {
    allWalls.forEach((wall) => {
      wall.visible = true;
    });
    return;
  }

  const centerX = (room.left + room.right) / 2;
  const centerZ = (room.back + room.front) / 2;
  const deadZone = 0.35;

  allWalls.forEach((wall) => {
    wall.visible = true;
  });

  if (camera.position.x > centerX + deadZone && roomWalls.right) roomWalls.right.visible = false;
  if (camera.position.x < centerX - deadZone && roomWalls.left) roomWalls.left.visible = false;
  if (camera.position.z > centerZ + deadZone && roomWalls.front) roomWalls.front.visible = false;
  if (camera.position.z < centerZ - deadZone && roomWalls.back) roomWalls.back.visible = false;
}

function updateMovement(delta) {
  if (view.mode !== "play") return;
  if (shopPanel.classList.contains("is-visible")) return;

  const input = new THREE.Vector2().copy(player.keyboard).add(player.joystick);

  if (input.lengthSq() > 1) input.normalize();
  if (input.lengthSq() === 0) return;

  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move = new THREE.Vector3();

  move.addScaledVector(forward, input.y);
  move.addScaledVector(right, input.x);
  move.normalize().multiplyScalar(MOVE_SPEED * delta);

  player.position.add(move);
  player.position.x = THREE.MathUtils.clamp(player.position.x, room.left + PLAYER_RADIUS, room.right - PLAYER_RADIUS);
  player.position.z = THREE.MathUtils.clamp(player.position.z, room.back + PLAYER_RADIUS, room.front - PLAYER_RADIUS);
}

function enterEditMode() {
  view.mode = "edit";
  resetJoystick();
  document.exitPointerLock?.();
  updateOrbitTarget();
  hud.classList.add("is-editing");
  editPanel.classList.add("is-visible");
  editPanel.setAttribute("aria-hidden", "false");
  updateMoveButtons();
}

function exitEditMode() {
  view.mode = "play";
  editor.isDraggingObject = false;
  hud.classList.remove("is-editing");
  editPanel.classList.remove("is-visible");
  editPanel.setAttribute("aria-hidden", "true");
  clearSelection();
  updateEditorWallVisibility();
}

function updateCoins() {
  coinCount.textContent = room.coins.toLocaleString("pt-BR");
  expandAmountLabel.textContent = getExpansionDistance();
  expandCostLabel.textContent = getExpansionCost().toLocaleString("pt-BR");
  unlockExpandButton.disabled = room.coins < getExpansionCost();
}

function updateOrbitTarget() {
  view.orbitTarget.set((room.left + room.right) / 2, 0.8, (room.back + room.front) / 2);
  view.orbitDistance = Math.max(room.right - room.left, room.front - room.back) + 4.2;
}

function zoomEditCamera(amount) {
  view.orbitDistance = THREE.MathUtils.clamp(view.orbitDistance + amount, 1.8, 36);
}

function enterExpandMode() {
  view.mode = "expand";
  resetJoystick();
  document.exitPointerLock?.();
  updateOrbitTarget();
  hud.classList.add("is-editing");
  expandPanel.classList.add("is-visible");
  expandPanel.setAttribute("aria-hidden", "false");
  expansionPreview.visible = true;
}

function exitExpandMode() {
  view.mode = "play";
  hud.classList.remove("is-editing");
  expandPanel.classList.remove("is-visible");
  expandPanel.setAttribute("aria-hidden", "true");
  expansionPreview.visible = false;
}

function unlockExpansion() {
  const cost = getExpansionCost();
  if (room.coins < cost) return;

  room.coins -= cost;

  if (expansion.side === "right") room.right += getExpansionDistance();
  if (expansion.side === "left") room.left -= getExpansionDistance();
  if (expansion.side === "front") room.front += getExpansionDistance();
  if (expansion.side === "back") room.back -= getExpansionDistance();

  updateOrbitTarget();
  createRoom();
  updateExpansionPreview();
  updateCoins();
}

function setExpansionSide(side) {
  expansion.side = side;
  sideButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.side === side);
  });
  updateExpansionPreview();
}

function setExpansionModules(value) {
  expansion.modules = Number(value);
  updateExpansionPreview();
  updateCoins();
}

function isUsingExpandUi(target) {
  return Boolean(target.closest(".expand-panel button, .expand-controls, .coin-pill"));
}

function isUsingEditUi(target) {
  return Boolean(target.closest(".edit-panel button, .edit-panel p"));
}

function setJoystickFromPointer(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
  const angle = Math.atan2(dy, dx);
  const knobX = Math.cos(angle) * distance;
  const knobY = Math.sin(angle) * distance;

  joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  player.joystick.set(knobX / JOYSTICK_RADIUS, -knobY / JOYSTICK_RADIUS);
}

function resetJoystick() {
  player.joystick.set(0, 0);
  joystickKnob.style.transform = "translate(-50%, -50%)";
}

async function toggleFullscreen() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

  try {
    if (fullscreenElement) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
    } else {
      await (document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.());
    }
  } catch (error) {
    console.warn("Fullscreen indisponivel neste navegador.", error);
  }
}

function updateFullscreenButton() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  fullscreenButton.classList.toggle("is-active", Boolean(fullscreenElement));
  fullscreenButton.textContent = fullscreenElement ? "Sair" : "Tela";
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && shopPanel.classList.contains("is-visible")) {
    closeShop();
    return;
  }

  if (event.code === "Escape" && view.mode === "edit") {
    exitEditMode();
    return;
  }

  if (event.code === "Escape" && view.mode === "expand") {
    exitExpandMode();
    return;
  }

  keys.add(event.code);
  updateKeyboardVector();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  updateKeyboardVector();
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === canvas) {
    rotateLook(event.movementX, event.movementY, MOUSE_SENSITIVITY);
    return;
  }

  if ((view.mode === "expand" || view.mode === "edit") && view.isOrbiting && !editor.isDraggingObject) {
    view.orbitYaw -= event.movementX * 0.008;
    view.orbitPitch = THREE.MathUtils.clamp(view.orbitPitch + event.movementY * 0.006, 0.34, 1.22);
  }
});

canvas.addEventListener("click", () => {
  if (!startScreen.classList.contains("is-hidden")) return;
  if (view.mode !== "play") return;
  canvas.requestPointerLock?.();
});

canvas.addEventListener("pointerdown", (event) => {
  if (view.mode === "edit") {
    if (isUsingEditUi(event.target)) return;

    const picked = pickEditableObject(event);
    if (picked) {
      selectEditableObject(picked);

      const point = getFloorPoint(event);
      if (point) {
        dragOffset.copy(editor.selected.position).sub(point);
        editor.isDraggingObject = true;
        canvas.setPointerCapture(event.pointerId);
      }
      return;
    }

    clearSelection();
    view.isOrbiting = true;
    view.lastPointerX = event.clientX;
    view.lastPointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  if (view.mode !== "expand" || isUsingExpandUi(event.target)) return;
  view.isOrbiting = true;
  view.lastPointerX = event.clientX;
  view.lastPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (view.mode === "edit" && editor.isDraggingObject && editor.selected) {
    const point = getFloorPoint(event);
    if (!point) return;

    const currentY = editor.selected.position.y;
    editor.selected.position.copy(point).add(dragOffset);
    editor.selected.position.y = currentY;
    clampObjectToRoom(editor.selected);
    updateSelectionBox();
    return;
  }

  if ((view.mode !== "expand" && view.mode !== "edit") || !view.isOrbiting || event.pointerType === "mouse") return;

  const deltaX = event.clientX - view.lastPointerX;
  const deltaY = event.clientY - view.lastPointerY;
  view.lastPointerX = event.clientX;
  view.lastPointerY = event.clientY;
  view.orbitYaw -= deltaX * 0.008;
  view.orbitPitch = THREE.MathUtils.clamp(view.orbitPitch + deltaY * 0.006, 0.34, 1.22);
});

canvas.addEventListener("pointerup", (event) => {
  view.isOrbiting = false;
  editor.isDraggingObject = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  view.isOrbiting = false;
  editor.isDraggingObject = false;
});

window.addEventListener(
  "wheel",
  (event) => {
    if (view.mode !== "expand" && view.mode !== "edit") return;
    const minDistance = view.mode === "edit" ? 1.8 : 5.8;
    const maxDistance = view.mode === "edit" ? 36 : 18;
    view.orbitDistance = THREE.MathUtils.clamp(view.orbitDistance + event.deltaY * 0.012, minDistance, maxDistance);
  },
  { passive: true },
);

joystick.addEventListener("pointerdown", (event) => {
  joystick.setPointerCapture(event.pointerId);
  setJoystickFromPointer(event.clientX, event.clientY);
});

joystick.addEventListener("pointermove", (event) => {
  if (joystick.hasPointerCapture(event.pointerId)) {
    setJoystickFromPointer(event.clientX, event.clientY);
  }
});

joystick.addEventListener("pointerup", (event) => {
  joystick.releasePointerCapture(event.pointerId);
  resetJoystick();
});

joystick.addEventListener("pointercancel", resetJoystick);

window.addEventListener(
  "touchstart",
  (event) => {
    for (const touch of event.changedTouches) {
      const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
      const touchedJoystick = touchedElement?.closest("#joystick");
      const touchedUi = touchedElement?.closest("button, .expand-panel, .shop-panel, .edit-panel");

      if (touchedJoystick) {
        activeTouches.joystickId = touch.identifier;
        setJoystickFromPointer(touch.clientX, touch.clientY);
      } else if (!touchedUi && activeTouches.lookId === null && view.mode === "play") {
        activeTouches.lookId = touch.identifier;
        activeTouches.lastLookX = touch.clientX;
        activeTouches.lastLookY = touch.clientY;
      }
    }
  },
  { passive: false },
);

window.addEventListener(
  "touchmove",
  (event) => {
    const touchedElement = document.elementFromPoint(event.touches[0]?.clientX || 0, event.touches[0]?.clientY || 0);
    const isScrollingShop = Boolean(touchedElement?.closest(".shop-list, .shop-panel"));

    if (!isScrollingShop) {
      event.preventDefault();
    }

    for (const touch of event.changedTouches) {
      if (touch.identifier === activeTouches.joystickId) {
        setJoystickFromPointer(touch.clientX, touch.clientY);
      }

      if (touch.identifier === activeTouches.lookId && view.mode === "play") {
        const deltaX = touch.clientX - activeTouches.lastLookX;
        const deltaY = touch.clientY - activeTouches.lastLookY;
        activeTouches.lastLookX = touch.clientX;
        activeTouches.lastLookY = touch.clientY;
        rotateLook(deltaX, deltaY, TOUCH_LOOK_SENSITIVITY);
      }
    }
  },
  { passive: false },
);

window.addEventListener("touchend", clearEndedTouches);
window.addEventListener("touchcancel", clearEndedTouches);

function clearEndedTouches(event) {
  for (const touch of event.changedTouches) {
    if (touch.identifier === activeTouches.joystickId) {
      activeTouches.joystickId = null;
      resetJoystick();
    }

    if (touch.identifier === activeTouches.lookId) {
      activeTouches.lookId = null;
    }
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

expandModeButton.addEventListener("click", enterExpandMode);
fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
closeExpandButton.addEventListener("click", exitExpandMode);
unlockExpandButton.addEventListener("click", unlockExpansion);
expandAmountInput.addEventListener("input", (event) => setExpansionModules(event.target.value));
sideButtons.forEach((button) => {
  button.addEventListener("click", () => setExpansionSide(button.dataset.side));
});
editRoomButton.addEventListener("click", enterEditMode);
closeEditButton.addEventListener("click", exitEditMode);
editZoomInButton.addEventListener("click", () => zoomEditCamera(-1.1));
editZoomOutButton.addEventListener("click", () => zoomEditCamera(1.1));
moveButtons.forEach((button) => {
  button.addEventListener("click", () => moveSelectedObject(button.dataset.move));
});
objectToolButtons.forEach((button) => {
  button.addEventListener("click", () => transformSelectedObject(button.dataset.action));
});
shopButton.addEventListener("click", () => {
  openShop();
});
closeShopButton.addEventListener("click", closeShop);
refreshShopButton.addEventListener("click", loadShopItems);
placeShopItemButton.addEventListener("click", placeSelectedShopItem);
catalogPrevButton.addEventListener("click", () => selectShopOffset(-1));
catalogNextButton.addEventListener("click", () => selectShopOffset(1));

startButton.addEventListener("click", () => {
  startScreen.classList.add("is-hidden");
  canvas.requestPointerLock?.();
});

createRoom();
createExpansionPreview();
createLighting();
updateOrbitTarget();
updateCoins();
updateCamera();

let lastTime = performance.now();

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  updateMovement(delta);
  updateCamera();
  updateEditorWallVisibility();
  renderer.render(scene, camera);
  renderShopPreview(delta);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
