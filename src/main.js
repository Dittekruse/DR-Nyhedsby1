/*
  DR NYHEDSBY – VERSION 2
  -----------------------
  Nu kan spilleren:
  1. Starte med 100 mønter.
  2. Klikke på en byggegrund.
  3. Bygge et hus for 50 mønter.
  4. Se huset dukke op i 3D-byen.
  Vi bruger Three.js til 3D-grafikken.
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { supabase } from './supabase.js';
import { refreshFlags } from './rewards.js';
let viewingFriend =
  new URLSearchParams(window.location.search).has('user');
// ---------- 1. SPILLETS INDSTILLINGER ----------


const savedPoints =
  localStorage.getItem('drNyhedsbyPoints') ??
  localStorage.getItem('drNyhedsbyPoints');

let points = Number(savedPoints ?? 500);
localStorage.setItem('drNyhedsbyPoints', String(points));

let selectedPlot = null;
// Spilleren vælger først, hvilken bygning der skal bygges.
let selectedBuilding = 'redHouse';

// Alle byggepriser samlet ét sted.
const BUILDING_PRICES = {
  redHouse: 40,
  timberHouse: 50,
  school: 90,
  hospital: 120,
  windmill: 120,
  turbine: 140,
  roundTower: 150,
  drByen: 180
};

// Bygninger, der kun må bygges én gang.
const UNIQUE_BUILDINGS = [
  'school',
  'hospital',
  'roundTower',
  'drByen'
];

// Bygningernes navne i spillet.
const BUILDING_NAMES = {
  redHouse: 'Rødt hus',
  timberHouse: 'Bindingsværkshus',
  school: 'Skole',
  hospital: 'Hospital',
  windmill: 'Mølle',
  turbine: 'Moderne vindmølle',
  roundTower: 'Rundetårn',
  drByen: 'DR Byen'
};


const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9dce8');

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(13, 15, 18);

// ---------- 2. GRAFIK OG LYS ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Behold spillets HTML-elementer, og læg kun 3D-grafikken ind.
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';
renderer.domElement.style.display = 'block';
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#ffffff', '#78936b', 2));

const sunlight = new THREE.DirectionalLight('#ffffff', 3);
sunlight.position.set(10, 18, 8);
sunlight.castShadow = true;
scene.add(sunlight);

// ---------- 3. GRUND OG VEJE ----------

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(30, 0.3, 30),
  new THREE.MeshStandardMaterial({ color: '#82bd73' })
);
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

function createRoad(x, z, width, length) {
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, length),
    new THREE.MeshStandardMaterial({ color: '#646b73' })
  );
  road.position.set(x, 0.01, z);
  road.receiveShadow = true;
  scene.add(road);
}

createRoad(0, 0, 4, 30);
createRoad(0, 0, 30, 4);

/*
  FORTOVE
  Lyse fliser langs vejene giver byen et mere
  realistisk dansk villakvarter.
*/

function createSidewalk(x, z, width, length) {
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.1, length),
    new THREE.MeshStandardMaterial({
      color: '#d8d5ca',
      roughness: 1
    })
  );

  sidewalk.position.set(x, 0.08, z);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);
}

// Fortove langs den lodrette vej
createSidewalk(-2.35, 0, 0.65, 30);
createSidewalk(2.35, 0, 0.65, 30);

// Fortove langs den vandrette vej
createSidewalk(0, -2.35, 30, 0.65);
createSidewalk(0, 2.35, 30, 0.65);

// Små stier mellem byggegrundene og fortovene
function createGardenPath(x, z, width, length) {
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, length),
    new THREE.MeshStandardMaterial({
      color: '#c9c5b9',
      roughness: 1
    })
  );

  path.position.set(x, 0.07, z);
  path.receiveShadow = true;
  scene.add(path);
}

// Stier fra husenes grunde mod den centrale vej
createGardenPath(-3.8, -7, 2.4, 0.85);
createGardenPath(3.8, -7, 2.4, 0.85);
createGardenPath(-3.8, 7, 2.4, 0.85);
createGardenPath(3.8, 7, 2.4, 0.85);

// ---------- 4. BYGNINGER ----------

function createHouse(x, z, wallColor = '#f1d5a7') {
  const house = new THREE.Group();

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2, 2.5),
    new THREE.MeshStandardMaterial({ color: wallColor })
  );
  walls.position.y = 1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  house.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2, 1.3, 4),
    new THREE.MeshStandardMaterial({ color: '#9c493c' })
  );
  roof.position.y = 2.65;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: '#68442d' })
  );
  door.position.set(0, 0.5, 1.29);
  house.add(door);
  
  // Vinduer på husets forside
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#a9d9e8',
    emissive: '#244d5b',
    emissiveIntensity: 0.15
  });

  for (const windowX of [-0.7, 0.7]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.09),
      windowMaterial
    );

    windowMesh.position.set(windowX, 1.25, 1.29);
    house.add(windowMesh);

    // Vinduesrammer
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.06),
      new THREE.MeshStandardMaterial({ color: '#fffaf0' })
    );

    frame.position.set(windowX, 1.25, 1.25);
    house.add(frame);
  }

  // Lille skorsten på taget
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.85, 0.35),
    new THREE.MeshStandardMaterial({ color: '#9b5947' })
  );

  chimney.position.set(0.55, 3.05, -0.35);
  chimney.rotation.z = -0.15;
  chimney.castShadow = true;
  house.add(chimney);


  house.position.set(x, 0, z);
  scene.add(house);
  return house;
}

 // ---------- NYE BYGNINGER ----------

// Rødt, klassisk dansk hus.
function createRedHouse(x, z) {
  return createHouse(x, z, '#a94335');
}

// Dansk bindingsværkshus.
function createTimberHouse(x, z) {
  const house = createHouse(x, z, '#f4e5c5');

  const beamMaterial = new THREE.MeshStandardMaterial({
    color: '#493126'
  });

  // Mørke bjælker på husets facade.
  for (const beamX of [-0.85, 0, 0.85]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.9, 0.08),
      beamMaterial
    );
    beam.position.set(beamX, 1, 1.29);
    house.add(beam);
  }

  const crossBeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.12, 0.08),
    beamMaterial
  );
  crossBeam.position.set(0, 1.65, 1.29);
  house.add(crossBeam);

  return house;
}

// Skole med rødt tag og vinduer.
function createSchool(x, z) {
  const school = new THREE.Group();

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.2, 3.2),
    new THREE.MeshStandardMaterial({ color: '#e8d4ad' })
  );
  walls.position.y = 1.1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  school.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.1, 1.3, 4),
    new THREE.MeshStandardMaterial({ color: '#a94335' })
  );
  roof.position.y = 2.85;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.25, 1, 0.95);
  roof.castShadow = true;
  school.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.25, 0.1),
    new THREE.MeshStandardMaterial({ color: '#65432f' })
  );
  door.position.set(0, 0.63, 1.65);
  school.add(door);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#a9d9e8',
    emissive: '#244d5b',
    emissiveIntensity: 0.15
  });

  for (const windowX of [-1.35, -0.7, 0.7, 1.35]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.08),
      windowMaterial
    );
    windowMesh.position.set(windowX, 1.35, 1.65);
    school.add(windowMesh);
  }

  school.position.set(x, 0, z);
  scene.add(school);
  return school;
}

// Hvidt hospital med røde kors.
function createHospital(x, z) {
  const hospital = new THREE.Group();

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 2.8, 3.2),
    new THREE.MeshStandardMaterial({ color: '#f5f5f0' })
  );
  walls.position.y = 1.4;
  walls.castShadow = true;
  walls.receiveShadow = true;
  hospital.add(walls);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.18, 3.4),
    new THREE.MeshStandardMaterial({ color: '#7d858b' })
  );
  roof.position.y = 2.85;
  hospital.add(roof);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#a9d9e8'
  });

  for (const windowX of [-1.15, 0, 1.15]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.6, 0.08),
      windowMaterial
    );
    windowMesh.position.set(windowX, 1.8, 1.65);
    hospital.add(windowMesh);
  }

  const crossMaterial = new THREE.MeshStandardMaterial({
    color: '#d62828'
  });

  const verticalCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.9, 0.12),
    crossMaterial
  );
  verticalCross.position.set(0, 1.05, 1.7);
  hospital.add(verticalCross);

  const horizontalCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.28, 0.12),
    crossMaterial
  );
  horizontalCross.position.set(0, 1.05, 1.7);
  hospital.add(horizontalCross);

  hospital.position.set(x, 0, z);
  scene.add(hospital);
  return hospital;
}

// Moderne vindmølle med tre roterende vinger.
function createTurbine(x, z) {
  const turbine = new THREE.Group();

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.32, 5.8, 12),
    new THREE.MeshStandardMaterial({ color: '#e6e9eb' })
  );
  tower.position.y = 2.9;
  tower.castShadow = true;
  turbine.add(tower);

  const nacelle = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.45, 0.55),
    new THREE.MeshStandardMaterial({ color: '#f4f5f5' })
  );
  nacelle.position.set(0, 5.8, 0);
  turbine.add(nacelle);

  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12),
    new THREE.MeshStandardMaterial({ color: '#f5f5f5' })
  );
  hub.position.set(0, 5.8, 0.35);
  turbine.add(hub);

  const blades = new THREE.Group();
  blades.position.set(0, 5.8, 0.4);

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff'
  });

  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 2.3, 0.12),
      bladeMaterial
    );
    blade.position.y = 1.25;
    blade.rotation.z = -0.12;
    blade.castShadow = true;

    const bladePivot = new THREE.Group();
    bladePivot.rotation.z = i * (Math.PI * 2 / 3);
    bladePivot.add(blade);
    blades.add(bladePivot);
  }

  turbine.add(blades);
  turbine.userData.turbineBlades = blades;

  turbine.position.set(x, 0, z);
  scene.add(turbine);
  return turbine;
}

// Rundetårn.
function createRoundTower(x, z) {
  const tower = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.25, 4.2, 24),
    new THREE.MeshStandardMaterial({ color: '#c9ad7d' })
  );
  body.position.y = 2.1;
  body.castShadow = true;
  body.receiveShadow = true;
  tower.add(body);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.28, 0.25, 24),
    new THREE.MeshStandardMaterial({ color: '#51483e' })
  );
  roof.position.y = 4.3;
  tower.add(roof);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#6b8790'
  });

  for (const y of [1.2, 2.3, 3.4]) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.48, 0.08),
      windowMaterial
    );
    windowMesh.position.set(0, y, 1.17);
    tower.add(windowMesh);
  }

  tower.position.set(x, 0, z);
  scene.add(tower);
  return tower;
}

// DR Byen – moderne, kantet bygning i blå nuancer.
function createDRByen(x, z) {
  const drByen = new THREE.Group();

  const mainBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 1.5, 3.2),
    new THREE.MeshStandardMaterial({ color: '#253d83' })
  );
  mainBuilding.position.y = 0.75;
  mainBuilding.castShadow = true;
  mainBuilding.receiveShadow = true;
  drByen.add(mainBuilding);

  const upperBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 1.3, 2.6),
    new THREE.MeshStandardMaterial({ color: '#354f9c' })
  );
  upperBuilding.position.set(0.2, 2.15, -0.1);
  upperBuilding.rotation.y = -0.12;
  upperBuilding.castShadow = true;
  drByen.add(upperBuilding);

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#80c7e8',
    metalness: 0.35,
    roughness: 0.25,
    emissive: '#173d66',
    emissiveIntensity: 0.2
  });

  for (let i = 0; i < 5; i++) {
    const windowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.85, 0.06),
      glassMaterial
    );
    windowMesh.position.set(-1.5 + i * 0.75, 0.8, 1.63);
    drByen.add(windowMesh);
  }

  drByen.position.set(x, 0, z);
  scene.add(drByen);
  return drByen;
}
// Samlet oversigt over spillets bygninger.
const BUILDING_CREATORS = {
  redHouse: createRedHouse,
  timberHouse: createTimberHouse,
  school: createSchool,
  hospital: createHospital,
  windmill: createWindmill,
  turbine: createTurbine,
  roundTower: createRoundTower,
  drByen: createDRByen
};


async function saveCity() {
    
 if (viewingFriend) {
  console.warn('Du kan ikke gemme ændringer, mens du besøger en vens by.');
  return;
}

  const savedBuildings = plots
    .filter((plot) => plot.userData.buildingType)
    .map((plot) => ({
      plotId: plot.userData.id,
      buildingType: plot.userData.buildingType
    }));

  // Gem lokalt som backup
  localStorage.setItem(
    'drNyhedsbyBuildings',
    JSON.stringify(savedBuildings)
  );

  // Gem også byen i Supabase
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const user = sessionData?.session?.user;

  if (sessionError || !user) {
    console.warn('Byen er gemt lokalt, men du er ikke logget ind i Supabase.');
    return;
  }

  const { error } = await supabase
    .from('cities')
    .upsert(
      {
        user_id: user.id,
        city_name: 'Min by',
        points: points,
        buildings: savedBuildings,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('Kunne ikke gemme byen i Supabase:', error.message);
    plotMessage.textContent =
      'Byen er gemt lokalt, men kunne ikke gemmes online.';
  } else {
    console.log('Byen er gemt online!');
  }
}

async function loadCity() {
  const requestedUserId = new URLSearchParams(
    window.location.search
  ).get('user');

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const user = sessionData?.session?.user;

  if (sessionError || !user) {
    console.warn('Du skal være logget ind for at indlæse byen.');
    updateHUD();
    return;
  }

  viewingFriend =
  requestedUserId !== null && requestedUserId !== user.id;
  const cityUserId = viewingFriend ? requestedUserId : user.id;

  const { data, error } = await supabase
    .from('cities')
    .select('buildings, points')
    .eq('user_id', cityUserId)
    .maybeSingle();

  if (error) {
    console.error('Kunne ikke hente byen:', error.message);
    updateHUD();
    return;
  }

  if (viewingFriend && !data) {
    console.warn('Vennens by kunne ikke findes eller tilgås.');
    updateHUD();
    return;
  }

  let savedBuildings = data?.buildings ?? [];

  if (!viewingFriend) {
    if (typeof data?.points === 'number') {
      points = data.points;
    }

    localStorage.setItem(
      'drNyhedsbyBuildings',
      JSON.stringify(savedBuildings)
    );
    localStorage.setItem('drNyhedsbyPoints', String(points));

    if (!data) {
      try {
        savedBuildings = JSON.parse(
          localStorage.getItem('drNyhedsbyBuildings') ?? '[]'
        );
      } catch (error) {
        console.warn('Kunne ikke indlæse den lokale by.', error);
      }
    }
  }

  for (const saved of savedBuildings) {
    const plot = plots.find(
      (item) => item.userData.id === saved.plotId
    );

    const createBuilding = BUILDING_CREATORS[saved.buildingType];

    if (!plot || !createBuilding || plot.userData.built) continue;

    createBuilding(plot.userData.x, plot.userData.z);

    plot.userData.built = true;
    plot.userData.buildingType = saved.buildingType;
    plot.material.color.set('#8cbd83');
    plot.material.emissive.set('#000000');
  }

  if (viewingFriend) {
    document.body.dataset.viewingFriend = 'true';
  }

  updateHUD();
}

// ---------- 5. BYGGEGRUNDE ----------

const plots = [];
const plotPositions = [
  { x: -7, z: -7 },
  { x: 7, z: -7 },
  { x: -7, z: 7 },
  { x: 7, z: 7 }
];

plotPositions.forEach((position, index) => {
  // Hver grund er et klikbart felt i 3D-verdenen.
  const plot = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.12, 4),
    new THREE.MeshStandardMaterial({
      color: '#c5e6a6',
      emissive: '#000000'
    })
  );

  plot.position.set(position.x, 0.04, position.z);
  plot.receiveShadow = true;
  plot.userData = {
    id: index,
    x: position.x,
    z: position.z,
    built: false
  };

  scene.add(plot);
  plots.push(plot);

  // Små hjørnemarkeringer viser byggegrundens placering.
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshStandardMaterial({ color: '#ffffff' })
  );
  marker.position.set(position.x, 0.19, position.z);
  scene.add(marker);
});

// ---------- 6. SPILLETS BRUGERFLADE ----------

/*
  DANSK MØLLE
  En rigtig 3D-model med rødt møllehus,
  hvidt tårn og fire vinger.
*/

function createWindmill(x, z) {
  const mill = new THREE.Group();

  // Fundament af sten
  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.2, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: '#aaa49a' })
  );
  foundation.position.y = 0.18;
  foundation.castShadow = true;
  mill.add(foundation);

  // Møllens røde murstenshus
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.05, 2.1, 8),
    new THREE.MeshStandardMaterial({ color: '#a94335' })
  );
  base.position.y = 1.35;
  base.castShadow = true;
  base.receiveShadow = true;
  mill.add(base);

  // Det mørke, kegleformede tag
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.05, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: '#493b35' })
  );
  roof.position.y = 2.85;
  mill.add(roof);

  // Dør på forsiden
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.8, 0.12),
    new THREE.MeshStandardMaterial({ color: '#4b3024' })
  );
  door.position.set(0, 0.65, 0.91);
  mill.add(door);

  // Aksel, som vingerne sidder fast på
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: '#ddd6c5' })
  );

  // Vingerne placeres på forsiden af møllen
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 2.65, 1.02);
  mill.add(hub);

  // Gruppe, der gør det muligt at dreje alle fire vinger
  const sails = new THREE.Group();
  sails.position.set(0, 2.65, 1.27);
  mill.add(sails);

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();

    // Lang, hvid vinge
    const sail = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 1.55, 0.09),
      new THREE.MeshStandardMaterial({ color: '#f7f2df' })
    );
    sail.position.y = 0.85;
    sail.castShadow = true;
    blade.add(sail);

    // Bredere spids på vingen
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.35, 0.1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' })
    );
    tip.position.y = 1.48;
    blade.add(tip);

    blade.rotation.z = i * Math.PI / 2;
    sails.add(blade);
  }

  // Saml møllen og placér den på byggegrunden
  mill.position.set(x, 0, z);
  scene.add(mill);

  // Gem vingegruppen, så vi senere kan animere den
  mill.userData.sails = sails;

  return mill;
}

/*
  FORHAVER
  Små blomsterbede og hække giver hver grund
  sit eget hyggelige udtryk.
*/

function createGardenBed(x, z, width, depth) {
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.16, depth),
    new THREE.MeshStandardMaterial({ color: '#557f45' })
  );

  bed.position.set(x, 0.04, z);
  bed.receiveShadow = true;
  scene.add(bed);

  // Små blomster i bedet
  const flowerColors = ['#e88ca6', '#f5d45d', '#ffffff'];

  for (let i = 0; i < 3; i++) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshStandardMaterial({
        color: flowerColors[i]
      })
    );

    flower.position.set(
      x - width / 3 + i * width / 3,
      0.22,
      z
    );

    scene.add(flower);
  }
}

// Blomsterbede ved de fire byggegrunde
createGardenBed(-8.5, -9.1, 2.2, 0.6);
createGardenBed(8.5, -9.1, 2.2, 0.6);
createGardenBed(-8.5, 9.1, 2.2, 0.6);
createGardenBed(8.5, 9.1, 2.2, 0.6);

/*
  DEKORATIONER – TRÆER OG BLOMSTER
  Giver byen mere liv uden at ændre byggefunktionen.
*/

function createTree(x, z) {
  // Træets stamme
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.2, 7),
    new THREE.MeshStandardMaterial({ color: '#795238' })
  );

  trunk.position.set(x, 0.6, z);
  trunk.castShadow = true;
  scene.add(trunk);

  // Træets grønne krone
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 8, 7),
    new THREE.MeshStandardMaterial({ color: '#39854b' })
  );

  leaves.position.set(x, 1.65, z);
  leaves.castShadow = true;
  scene.add(leaves);
}

function createFlower(x, z, color) {
  const flower = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    new THREE.MeshStandardMaterial({ color })
  );

  flower.position.set(x, 0.2, z);
  flower.scale.y = 0.65;
  scene.add(flower);
}

// Træer langs vejene og i byens grønne områder
[
  [-12, -3],
  [12, 3],
  [-3, -12],
  [3, 12],
  [-12, 10],
  [12, -10]
].forEach(([x, z]) => createTree(x, z));

// Små blomster ved husene
[
  [-9, -6, '#e88ca6'],
  [-8.5, -6, '#f5d45d'],
  [5, -8.5, '#e88ca6'],
  [5.5, -8.5, '#ffffff'],
  [-9, 8.5, '#f5d45d'],
  [-8.5, 8.5, '#ffffff'],
  [5, 8.5, '#e88ca6'],
  [5.5, 8.5, '#f5d45d']
].forEach(([x, z, color]) => createFlower(x, z, color));


 // ---------- BYGGEMENU OG BYGGELOGIK ----------

// Opretter menuen oven på 3D-byen.
const hud = document.createElement('div');

hud.style.cssText = `
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 10;
  width: min(340px, calc(100vw - 36px));
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: 18px;
  border-radius: 14px;
  background: white;
  color: #173b63;
  font-family: Arial, sans-serif;
  box-shadow: 0 5px 20px #0003;
`;

const BUILDING_ICONS = {
  redHouse: '🏠',
  timberHouse: '🏡',
  school: '🏫',
  hospital: '🏥',
  windmill: '🌾',
  turbine: '🌬️',
  roundTower: '🏛️',
  drByen: '📡'
};

hud.innerHTML = `
  <div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#c8202f">
    <a href="/index.html" style="text-decoration:none;color:inherit;">DR NYHEDSBY</a>
  </div>

  <h2 style="margin:8px 0">Byg din egen by</h2>

  <div id="coin-count"
  style="font-size:19px;font-weight:bold;margin-bottom:6px">
<img src="./icons/point.svg" width="22" height="22" style="vertical-align:middle"></div>

<div data-total-flags
  style="font-size:16px;font-weight:bold;margin-bottom:12px">
  🚩 Henter flag...
</div>

  <p id="plot-message" style="font-size:14px;line-height:1.5">
    Klik på en grøn byggegrund for at vælge den.
  </p>

  <h3 style="font-size:15px;margin:14px 0 8px">
    Vælg en bygning
  </h3>

  <div id="building-menu"
    style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
  </div>

  <button id="build-button" disabled
    style="width:100%;margin-top:12px;padding:12px;border:0;
    border-radius:9px;background:#d6dce3;color:#526174;
    font-weight:bold;font-size:15px;cursor:pointer">
    Vælg en grund først
  </button>

  <p style="font-size:12px;color:#667788;margin-bottom:0">
    Drej byen med musen. Zoom med scrollhjulet.
  </p>
`;


document.body.appendChild(hud);

// Hent flag fra Supabase og vis dem i byens menu.
const flagsDisplay = hud.querySelector('[data-total-flags]');


async function updateFlagsDisplay() {
  flagsDisplay.innerHTML = '<img src="./icons/flag.svg" width="20" height="20" style="vertical-align:middle"> Henter flag...';

  try {
    const totalFlags = await refreshFlags();
    flagsDisplay.innerHTML = `<img src="./icons/flag.svg" width="20" height="20" style="vertical-align:middle"> ${totalFlags} flag`;
  } catch (error) {
    console.error('Kunne ikke hente flag:', error);
    flagsDisplay.innerHTML = '<img src="./icons/flag.svg" width="20" height="20" style="vertical-align:middle"> Kunne ikke hente flag';
  }
}



window.addEventListener('dr-flags-updated', (event) => {
  const totalFlags = Number(event.detail?.totalFlags ?? 0);
  flagsDisplay.innerHTML = `<img src="./icons/flag.svg" width="20" height="20" style="vertical-align:middle"> ${totalFlags} flag`;
});


void updateFlagsDisplay();

// Finder elementerne i menuen.


const coinCount = hud.querySelector('#coin-count');
const plotMessage = hud.querySelector('#plot-message');
const buildButton = hud.querySelector('#build-button');
const buildingMenu = hud.querySelector('#building-menu');

// Opretter automatisk en knap for hver bygning og dens pris.
for (const [buildingId, buildingName] of Object.entries(BUILDING_NAMES)) {
  const button = document.createElement('button');

  button.type = 'button';
  button.dataset.building = buildingId;
  button.style.cssText = `
    padding: 10px 6px;
    border: 2px solid #ddd;
    border-radius: 8px;
    background: white;
    color: #173b63;
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
  `;

  button.innerHTML = `
    <span style="font-size:20px">${BUILDING_ICONS[buildingId]}</span>
    <br>
    <strong>${buildingName}</strong>
    <br>
    ${BUILDING_PRICES[buildingId]} point
  `;

  button.addEventListener('click', () => {
        if (viewingFriend) return;
    selectedBuilding = buildingId;
    updateHUD();
  });

  buildingMenu.appendChild(button);
}

// Finder ud af, om en specialbygning allerede findes i byen.
function isUniqueBuildingBuilt(buildingId) {
  return plots.some(
    (plot) => plot.userData.buildingType === buildingId
  );
}

// Opdaterer mønter, menu, byggeknap og beskeder.
function updateHUD() {
  localStorage.setItem('drNyhedsbyPoints', String(points));
coinCount.textContent = `⭐ ${points} point`;

  const price = BUILDING_PRICES[selectedBuilding];
  const buildingName = BUILDING_NAMES[selectedBuilding];
  const uniqueAlreadyBuilt =
    UNIQUE_BUILDINGS.includes(selectedBuilding) &&
    isUniqueBuildingBuilt(selectedBuilding);

  // Markerer den valgte bygning i menuen.
  buildingMenu.querySelectorAll('button').forEach((button) => {
    const isSelected = button.dataset.building === selectedBuilding;
    const alreadyBuilt =
      UNIQUE_BUILDINGS.includes(button.dataset.building) &&
      isUniqueBuildingBuilt(button.dataset.building);

    button.style.borderColor = isSelected ? '#173b63' : '#ddd';
    button.style.background = isSelected ? '#e8f0f8' : 'white';
    button.disabled = alreadyBuilt;

    if (alreadyBuilt) {
      button.style.opacity = '0.45';
      button.style.cursor = 'not-allowed';
    } else {
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  });

  if (!selectedPlot) {
    plotMessage.textContent =
      'Vælg en bygning, og klik derefter på en grøn byggegrund.';
    buildButton.textContent = 'Vælg en grund først';
    buildButton.disabled = true;
  } else if (selectedPlot.userData.built) {
    plotMessage.textContent =
      'Der står allerede en bygning på denne grund.';
    buildButton.textContent = 'Grunden er allerede bygget';
    buildButton.disabled = true;
  } else if (uniqueAlreadyBuilt) {
    plotMessage.textContent =
      `${buildingName} er allerede bygget i din by.`;
    buildButton.textContent = 'Bygningen findes allerede';
    buildButton.disabled = true;
  } else {
    plotMessage.textContent =
      `Du har valgt grund ${selectedPlot.userData.id + 1}. ` +
      `Du kan bygge ${buildingName} for ${price} point.`;

    buildButton.textContent =
      `${BUILDING_ICONS[selectedBuilding]} Byg ${buildingName} · ${price} point`;

    buildButton.disabled = points < price;
  }

  buildButton.style.background = buildButton.disabled
    ? '#d6dce3'
    : '#173b63';

  buildButton.style.color = buildButton.disabled
    ? '#526174'
    : '#ffffff';
}

// Bygger den valgte bygning på den valgte grund.
buildButton.addEventListener('click', () => {
    if (viewingFriend) {
    plotMessage.textContent = 'Du besøger en vens by. Du kan ikke bygge her.';
    return;
  }
    if (!selectedPlot || selectedPlot.userData.built) return;

  const buildingId = selectedBuilding;
  const price = BUILDING_PRICES[buildingId];
  const buildingName = BUILDING_NAMES[buildingId];

  if (UNIQUE_BUILDINGS.includes(buildingId) &&
      isUniqueBuildingBuilt(buildingId)) {
    plotMessage.textContent =
      `${buildingName} er allerede bygget i din by.`;
    updateHUD();
    return;
  }

  if (points < price) {
    plotMessage.textContent =
      `Du mangler point. ${buildingName} koster ${price} point.`;
    updateHUD();
    return;
  }

  const { x, z } = selectedPlot.userData;

  // Vælger den rigtige funktion til den valgte bygning.
 const createBuilding = BUILDING_CREATORS[buildingId];

  if (!createBuilding) {
    plotMessage.textContent = 'Denne bygning kunne ikke opføres.';
    return;
  }

  // Bygger først og trækker derefter mønterne.
  createBuilding(x, z);
  points -= price;

  selectedPlot.userData.built = true;
  selectedPlot.userData.buildingType = buildingId;
  selectedPlot.material.color.set('#8cbd83');
  selectedPlot.material.emissive.set('#000000');
  saveCity();

  updateHUD();
  plotMessage.textContent = `${buildingName} er bygget! 🎉`;
});
loadCity().catch((error) => {
  console.error('Fejl ved indlæsning af byen:', error);
  updateHUD();
});


// ---------- 7. KLIK PÅ GRUNDENE ----------

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 8;
controls.maxDistance = 35;

renderer.domElement.addEventListener('pointerdown', (event) => {
  // Undgå at behandle museklik som byggevalg,
  // hvis brugeren er ved at dreje kameraet.
  if (event.button !== 0) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(plots);

  if (hits.length > 0) {
    selectedPlot = hits[0].object;

    // Markér den valgte grund.
    plots.forEach((plot) => {
      plot.material.emissive.set(
        plot === selectedPlot ? '#426d35' : '#000000'
      );
    });

    updateHUD();
  }
});

// ---------- 8. TILPAS VINDUET ----------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 9. SPILLETS ANIMATION ----------


function animate() {
  // Opdaterer kameraets bevægelser
  controls.update();

  // Drejer møllernes vinger
  scene.traverse((object) => {
    if (object.userData.sails) {
      object.userData.sails.rotation.z += 0.01;
    }
    if (object.userData.turbineBlades) {
  object.userData.turbineBlades.rotation.z += 0.01;
}  
});

  // Tegner 3D-byen
  renderer.render(scene, camera);
}

updateHUD();
renderer.setAnimationLoop(animate);
