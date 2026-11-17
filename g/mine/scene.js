// The 3D picture: a shaft seen from the front, a miner swinging a pick, the blocks
// below him, and whatever flies out of them. One scene unit is one block (one metre).
// It gets dark below ground: the miner's lamp lights the blocks near him and the ore glows.
import { layerAt } from "./rules.js";

const ROWS = 13; // rows of ground kept as meshes; they are reused as the shaft deepens
const ROWS_ABOVE = 5;
const GRAVITY = 14;
const FUSE = 0.055; // seconds between one block going off and the next in a blast
const PROPS_EVERY = 8; // rows between timber frames, and between lanterns
const SIGN_EVERY = 10;
const MINER_SIZE = 1.2;
const DARK_BY = 7; // depth at which daylight is gone

// Per layer: the block being dug, its own glow, the ore in the walls, and the tint of the dim light.
const GROUND = [
  { block: 0xb47b3d, glow: 0x000000, ore: 0xffc928, air: 0xffffff },
  { block: 0x8d939c, glow: 0x000000, ore: 0xffc928, air: 0xf2f4ff },
  { block: 0xc98f7a, glow: 0x000000, ore: 0xc77dff, air: 0xffe9e0 },
  { block: 0x4d5780, glow: 0x000000, ore: 0x6fe3ff, air: 0xcdd8ff },
  { block: 0x93301a, glow: 0x5c1600, ore: 0xff8a2a, air: 0xffb48c },
  { block: 0x2fb3c6, glow: 0x0b4753, ore: 0xff7ad9, air: 0xb4f6ff },
];
export const PICK_HEADS = [0x8f5f43, 0xc3c9cf, 0x74859e, 0xf4c531, 0x63e6f5, 0xb07cff, 0xff5fb4, 0xffffff];
const HEAT = [0x000000, 0xffc928, 0xff9a2a, 0xff5a2a, 0xff4fa8]; // the glow under the miner per combo step
const GOLD = 0xffc928;
const FIND_GLOW = { nugget: [GOLD, 0.9], lode: [GOLD, 1.9], diamond: [0x7ff2ff, 1.7], fossil: [0xfff2cf, 1.3] };

const ease = (from, to, amount) => from + (to - from) * amount;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
// The same number between 0 and 1 for the same row and slot, so a row looks the same each time it is shown.
const chance = (row, slot) => {
  const value = Math.sin(row * 127.1 + slot * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function createMineScene(stage) {
  const { THREE, scene, camera } = stage;
  const sky = new THREE.HemisphereLight(0xffffff, 0x77624c, 0.8);
  const sun = new THREE.DirectionalLight(0xfff0d8, 0.85);
  sun.position.set(-3, 6, 8);
  const lamp = new THREE.PointLight(0xffdca8, 0.6, 7.5);
  scene.add(sky, sun, lamp);

  const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const lit = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const part = (geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const paint = (width, height, draw) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    return new THREE.CanvasTexture(canvas);
  };
  const picture = {
    glow: paint(128, 128, drawGlow),
    rays: paint(256, 256, drawRays),
    ring: paint(256, 256, drawRing),
    star: paint(128, 128, drawStar),
    grain: paint(128, 128, drawGrain),
    tnt: paint(256, 80, drawDynamiteLabel),
  };
  const glowing = (map, color = 0xffffff) =>
    new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glowSprite = (map, color, size, x = 0, y = 0, z = 0) => {
    const sprite = new THREE.Sprite(glowing(map, color));
    sprite.scale.setScalar(size);
    sprite.position.set(x, y, z);
    return sprite;
  };

  /* ---- above ground ---- */
  const grass = matte(0x74b64d);
  const timber = matte(0x7b5433);
  const hills = matte(0x5a9a45);
  const cloudLook = lit(0xffffff);
  const cloudShape = new THREE.SphereGeometry(0.5, 12, 8);
  const clouds = [[-1.5, 3.3, 1.5], [1.3, 4.4, 1.1], [-0.4, 5.6, 0.8]].map(([x, y, size]) => {
    const cloud = part(cloudShape, cloudLook, x, y, -1.6);
    cloud.scale.set(size, size * 0.36, 0.2);
    return cloud;
  });
  const sunRays = glowSprite(picture.rays, 0xfff3b0, 3.2, 1.25, 3.1, -1.8);
  const hillShape = new THREE.SphereGeometry(1, 20, 10);
  const hillLeft = part(hillShape, hills, -1.7, 0, -1.5);
  hillLeft.scale.set(1.5, 0.7, 0.3);
  const hillRight = part(hillShape, hills, 1.9, 0, -1.4);
  hillRight.scale.set(1.3, 0.5, 0.3);
  scene.add(
    part(new THREE.PlaneGeometry(40, 16), lit(0xa9daf6), 0, 8, -2),
    sunRays,
    glowSprite(picture.glow, 0xfff7c4, 1.5, 1.25, 3.1, -1.8),
    ...clouds,
    hillLeft,
    hillRight,
    part(box(2, 0.1, 1.04), grass, -1.5, 0.05, 0),
    part(box(2, 0.1, 1.04), grass, 1.5, 0.05, 0),
    part(box(0.11, 1.75, 0.11), timber, -0.66, 0.875, -0.3),
    part(box(0.11, 1.75, 0.11), timber, 0.66, 0.875, -0.3),
    part(box(1.7, 0.13, 0.15), timber, 0, 1.75, -0.3),
  );

  /* ---- rows of ground ---- */
  const geometry = {
    block: box(0.97, 0.97, 0.97),
    wall: box(2, 0.985, 1),
    back: box(1, 1, 0.2),
    nugget: new THREE.DodecahedronGeometry(0.09),
    ore: new THREE.DodecahedronGeometry(0.07),
    diamond: new THREE.OctahedronGeometry(0.22),
    crack: box(0.34, 0.035, 0.02),
    bone: box(1, 0.055, 0.03),
    vein: box(0.5, 0.04, 0.02),
    spike: new THREE.ConeGeometry(0.085, 0.42, 5),
    post: box(0.1, 1, 0.1),
    beam: box(1, 0.12, 0.14),
    lantern: box(0.1, 0.15, 0.08),
    sign: new THREE.PlaneGeometry(0.5, 0.24),
  };
  const wallGrain = picture.grain.clone();
  wallGrain.needsUpdate = true;
  wallGrain.wrapS = THREE.RepeatWrapping;
  wallGrain.repeat.set(2, 1);
  const goldLook = matte(GOLD, { roughness: 0.3, metalness: 0.3, emissive: 0x9a6200, flatShading: true });
  const diamondLook = matte(0x9af6ff, { roughness: 0.15, emissive: 0x2fb3c8, flatShading: true });
  const boneLook = matte(0xf3ecd9, { emissive: 0x4a4436 });
  const crackLook = lit(0x1a120c, { transparent: true, opacity: 0.6 });
  const chargeLook = matte(0xd0352c);
  const labelLook = lit(0xffffff, { map: picture.tnt });
  const lanternLook = lit(0xffd27a);
  const ironLook = matte(0x2a2622);

  function makeRow() {
    const group = new THREE.Group();
    const blockLook = matte(0xffffff, { flatShading: true, map: picture.grain });
    const wallLook = matte(0xffffff, { map: wallGrain });
    const backLook = matte(0xffffff);
    const oreLook = matte(0xffffff, { roughness: 0.3, flatShading: true });
    const block = part(geometry.block, blockLook);
    const nuggets = Array.from({ length: 6 }, (_, i) => {
      const nugget = part(geometry.nugget, goldLook, (chance(i, 1) - 0.5) * 0.66, (chance(i, 2) - 0.5) * 0.66, 0.485);
      nugget.rotation.set(i, i * 2, i * 3);
      return nugget;
    });
    const diamond = part(geometry.diamond, diamondLook, 0, 0, 0.47);
    const label = part(new THREE.PlaneGeometry(0.97, 0.3), labelLook, 0, 0, 0.49);
    const bones = new THREE.Group();
    bones.add(part(geometry.bone, boneLook, 0, 0, 0.49));
    bones.children[0].scale.x = 0.62;
    bones.children[0].rotation.z = Math.PI / 2;
    for (const [y, width] of [[0.2, 0.5], [0.05, 0.56], [-0.1, 0.46], [-0.24, 0.3]]) {
      const rib = part(geometry.bone, boneLook, 0, y, 0.49);
      rib.scale.x = width;
      bones.add(rib);
    }
    const cracks = [
      [-0.12, 0.2, 0.7], [0.16, -0.05, -0.5], [-0.2, -0.24, 0.25], [0.2, 0.28, -1.1],
    ].map(([x, y, turn]) => {
      const crack = part(geometry.crack, crackLook, x, y, 0.492);
      crack.rotation.z = turn;
      return crack;
    });
    const halo = glowSprite(picture.glow, GOLD, 1, 0, 0, 0.56);
    block.add(...nuggets, diamond, label, bones, ...cracks, halo);

    // In the walls: ore, and deep down veins of lava or spikes of crystal.
    const ores = Array.from({ length: 4 }, () => part(geometry.ore, oreLook, 0, 0, 0.5));
    const veins = Array.from({ length: 2 }, () => part(geometry.vein, oreLook, 0, 0, 0.505));
    const spikes = Array.from({ length: 2 }, () => part(geometry.spike, oreLook, 0, 0, 0.55));

    // Props that only some rows have.
    const frame = new THREE.Group();
    frame.add(part(geometry.post, timber, -0.44, 0, -0.42), part(geometry.post, timber, 0.44, 0, -0.42), part(geometry.beam, timber, 0, 0.42, -0.4));
    const lantern = new THREE.Group();
    lantern.add(part(geometry.lantern, lanternLook), part(box(0.13, 0.03, 0.1), ironLook, 0, 0.09, 0), glowSprite(picture.glow, 0xffb04a, 1.5, 0, 0, 0.06));
    lantern.position.set(-0.8, 0.1, 0.54);
    const signFace = paint(128, 64, () => {});
    const sign = part(geometry.sign, lit(0xffffff, { map: signFace }), 0.82, 0.08, 0.51);

    group.add(
      block,
      part(geometry.wall, wallLook, -1.5, 0, 0),
      part(geometry.wall, wallLook, 1.5, 0, 0),
      part(geometry.back, backLook, 0, 0, -0.6),
      ...ores,
      ...veins,
      ...spikes,
      frame,
      lantern,
      sign,
    );
    scene.add(group);
    return {
      row: null, kind: null, group, block, blockLook, wallLook, backLook, oreLook, nuggets, diamond, label, bones, cracks, halo,
      ores, veins, spikes, frame, lantern, sign, signFace,
    };
  }
  const rows = Array.from({ length: ROWS }, makeRow);

  function dress(slot, row, kind) {
    slot.row = row;
    slot.kind = kind;
    slot.group.visible = row >= 0;
    if (row < 0) return;
    slot.group.position.y = -row - 0.5;
    const layer = layerAt(row);
    const ground = GROUND[layer];
    const shade = row % 2 ? 0.92 : 1;
    slot.blockLook.color.set(kind === "dynamite" ? chargeLook.color : ground.block).multiplyScalar(shade);
    slot.blockLook.emissive.set(kind === "dynamite" ? 0x3a0500 : ground.glow);
    slot.wallLook.color.set(ground.block).multiplyScalar(0.46 * shade);
    slot.wallLook.emissive.set(ground.glow).multiplyScalar(0.4);
    slot.backLook.color.set(ground.block).multiplyScalar(0.16);
    slot.oreLook.color.set(ground.ore);
    slot.oreLook.emissive.set(ground.ore).multiplyScalar(0.55);

    const gold = kind === "lode" ? 6 : kind === "nugget" ? 3 : 0;
    slot.nuggets.forEach((nugget, i) => {
      nugget.visible = i < gold;
      nugget.scale.setScalar(kind === "lode" ? 1.7 : 1.05);
    });
    slot.diamond.visible = kind === "diamond";
    slot.label.visible = kind === "dynamite";
    slot.bones.visible = kind === "fossil";
    const glow = FIND_GLOW[kind];
    slot.halo.visible = Boolean(glow);
    if (glow) slot.halo.material.color.set(glow[0]);

    slot.ores.forEach((ore, i) => {
      const side = i % 2 ? 1 : -1;
      ore.visible = row > 1 && chance(row, i) < 0.3;
      ore.position.x = side * (0.68 + chance(row, i + 10) * 0.75);
      ore.position.y = (chance(row, i + 20) - 0.5) * 0.8;
      ore.scale.setScalar(0.7 + chance(row, i + 30) * 1.1);
      ore.rotation.set(row + i, row * 2 + i, 0);
    });
    slot.veins.forEach((vein, i) => {
      const side = i % 2 ? 1 : -1;
      vein.visible = layer === 4;
      vein.position.x = side * (0.85 + chance(row, i + 40) * 0.5);
      vein.position.y = (chance(row, i + 50) - 0.5) * 0.7;
      vein.rotation.z = (chance(row, i + 60) - 0.5) * 1.6;
      vein.scale.x = 0.6 + chance(row, i + 70);
    });
    slot.spikes.forEach((spike, i) => {
      const side = i % 2 ? 1 : -1;
      spike.visible = layer === 5 && chance(row, i + 80) < 0.7;
      spike.position.x = side * (0.62 + chance(row, i + 90) * 0.5);
      spike.position.y = (chance(row, i + 100) - 0.5) * 0.6;
      spike.rotation.set(1.1, 0, side * (0.3 + chance(row, i + 110) * 0.7));
    });

    slot.frame.visible = row > 0 && row % PROPS_EVERY === 0;
    slot.lantern.visible = row % PROPS_EVERY === PROPS_EVERY / 2;
    slot.sign.visible = row > 0 && row % SIGN_EVERY === 0;
    if (slot.sign.visible) {
      drawSign(slot.signFace.image.getContext("2d"), `${row} m`);
      slot.signFace.needsUpdate = true;
    }
  }

  // A line across the shaft where the deepest dig so far ended.
  const bestLine = new THREE.Group();
  const dashLook = lit(0xffe06a);
  for (let i = -6; i <= 6; i += 1) bestLine.add(part(box(0.17, 0.045, 0.02), dashLook, i * 0.27, 0, 0.515));
  const bestStars = [-1.62, 1.62].map((x) => glowSprite(picture.star, 0xffe06a, 0.5, x, 0, 0.56));
  bestLine.add(...bestStars);
  bestLine.visible = false;
  scene.add(bestLine);

  /* ---- the miner ---- */
  const miner = new THREE.Group();
  const denim = matte(0x2f64b8);
  const skin = matte(0xf3c9a2);
  const shoulder = new THREE.Group();
  shoulder.position.set(0, 0.52, 0.1);
  const pickHead = matte(PICK_HEADS[0], { roughness: 0.4, metalness: 0.3 });
  const head = part(new THREE.TorusGeometry(0.26, 0.04, 6, 14, 1.5), pickHead, 0, 0.26, 0);
  head.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.75);
  const pickGlow = glowSprite(picture.glow, 0xffffff, 0.7, 0, 0.5, 0);
  shoulder.add(
    part(box(0.34, 0.09, 0.09), skin, 0, 0.1, 0),
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 8), timber, 0, 0.26, 0),
    head,
    pickGlow,
  );
  // The path the pick head has just come down, drawn as a streak of light.
  const streakLook = lit(0xffffff, { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  const streak = part(new THREE.TorusGeometry(0.5, 0.045, 4, 18, 2.8), streakLook, 0, 0.52, 0.1);
  streak.rotation.set(0.68, -Math.PI / 2, 0);
  const helmet = part(
    new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    matte(0xf7c51d, { roughness: 0.5 }),
    0,
    0.78,
    0,
  );
  const light = part(new THREE.SphereGeometry(0.04, 10, 8), lit(0xfffbe0), 0, 0.85, 0.16);
  const lightGlow = glowSprite(picture.glow, 0xfff0c0, 0.6, 0, 0.85, 0.2);
  const eyeLook = lit(0x20140c);
  miner.add(
    part(box(0.13, 0.3, 0.16), matte(0x3a3f55), -0.1, 0.15, 0),
    part(box(0.13, 0.3, 0.16), matte(0x3a3f55), 0.1, 0.15, 0),
    part(box(0.36, 0.34, 0.22), denim, 0, 0.46, 0),
    part(new THREE.SphereGeometry(0.15, 18, 14), skin, 0, 0.75, 0),
    part(new THREE.SphereGeometry(0.02, 8, 6), eyeLook, -0.055, 0.75, 0.14),
    part(new THREE.SphereGeometry(0.02, 8, 6), eyeLook, 0.055, 0.75, 0.14),
    helmet,
    light,
    lightGlow,
    shoulder,
    streak,
  );
  miner.rotation.y = 0.7;
  const aura = glowSprite(picture.glow, GOLD, 2.4, 0, 0, 0.3);
  aura.visible = false;
  scene.add(miner, aura);

  /* ---- things that fly ---- */
  function makeSpray(count, shape, look) {
    const mesh = new THREE.InstancedMesh(shape, look, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const bits = Array.from({ length: count }, () => ({
      life: 0, age: 0, at: new THREE.Vector3(), go: new THREE.Vector3(), size: 1, spin: 0, pull: 1, home: false,
    }));
    const pose = new THREE.Object3D();
    const tint = new THREE.Color(0xffffff);
    const way = new THREE.Vector3();
    for (let i = 0; i < count; i += 1) mesh.setColorAt(i, tint);
    let next = 0;
    scene.add(mesh);
    return {
      // `pull` scales gravity (below zero the bits rise); bits that `home` fly off to the gold count.
      toss(howMany, x, y, z, color, force, { pull = 1, home = false, wide = 0.5, life = 0.5 } = {}) {
        for (let n = 0; n < howMany; n += 1) {
          const bit = bits[next];
          const angle = Math.random() * Math.PI * 2;
          const out = force * (0.4 + Math.random());
          bit.at.set(x + (Math.random() - 0.5) * wide, y, z + Math.random() * 0.2);
          bit.go.set(Math.cos(angle) * out, force * (1.6 + Math.random() * 1.8), Math.abs(Math.sin(angle)) * out * 0.7);
          bit.life = life * (1 + Math.random() * 0.9);
          bit.age = 0;
          bit.size = 0.6 + Math.random() * 0.9;
          bit.spin = (Math.random() - 0.5) * 20;
          bit.pull = pull;
          bit.home = home;
          mesh.setColorAt(next, tint.set(color).multiplyScalar(0.75 + Math.random() * 0.4));
          next = (next + 1) % count;
        }
        mesh.instanceColor.needsUpdate = true;
      },
      step(elapsed, homeAt) {
        bits.forEach((bit, i) => {
          if (bit.life > 0) {
            bit.life -= elapsed;
            bit.age += elapsed;
            if (bit.home && bit.age > 0.26) {
              way.copy(homeAt).sub(bit.at);
              if (way.length() < 0.5) bit.life = 0;
              bit.go.lerp(way.normalize().multiplyScalar(16), Math.min(1, elapsed * 9));
            } else bit.go.y -= GRAVITY * bit.pull * elapsed;
            bit.at.addScaledVector(bit.go, elapsed);
          }
          const size = bit.life > 0 ? bit.size * Math.min(1, bit.life * 5) : 0;
          pose.position.copy(bit.at);
          pose.rotation.set(bit.spin * bit.life, bit.spin * bit.life * 0.7, 0);
          pose.scale.setScalar(size);
          pose.updateMatrix();
          mesh.setMatrixAt(i, pose.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
      clear() {
        for (const bit of bits) bit.life = 0;
      },
    };
  }
  const rubble = makeSpray(96, box(0.1, 0.1, 0.1), matte(0xffffff, { flatShading: true }));
  const goldBits = makeSpray(72, new THREE.DodecahedronGeometry(0.06), goldLook);
  const sparks = makeSpray(72, box(0.035, 0.035, 0.11), lit(0xffffff, { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));

  // Flashes of light: each grows from one size to another and fades.
  const flares = Array.from({ length: 36 }, () => {
    const sprite = new THREE.Sprite(glowing(picture.glow));
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, since: 0, life: 0, from: 1, to: 1, turn: 0, strength: 1 };
  });
  let nextFlare = 0;
  function flare(map, x, y, z, color, from, to, life, { turn = 0, strength = 1 } = {}) {
    const one = flares[nextFlare];
    nextFlare = (nextFlare + 1) % flares.length;
    Object.assign(one, { since: now, life, from, to, turn, strength });
    one.sprite.material.map = map;
    one.sprite.material.color.set(color);
    one.sprite.position.set(x, y, z);
    one.sprite.visible = true;
  }
  function stepFlares() {
    for (const one of flares) {
      if (!one.sprite.visible) continue;
      const t = (now - one.since) / one.life;
      if (t >= 1) {
        one.sprite.visible = false;
        continue;
      }
      one.sprite.scale.setScalar(ease(one.from, one.to, 1 - (1 - t) ** 2));
      one.sprite.material.opacity = one.strength * (1 - t * t);
      one.sprite.material.rotation = one.turn * t;
    }
  }

  // A find worth showing off rises out of the shaft and spins in front of a burst of rays.
  const prizes = {
    diamond: part(new THREE.OctahedronGeometry(0.34), diamondLook),
    fossil: new THREE.Group(),
  };
  prizes.fossil.add(part(new THREE.SphereGeometry(0.2, 14, 10), boneLook, 0, 0.05, 0), part(box(0.22, 0.14, 0.2), boneLook, 0, -0.14, 0.08));
  for (const x of [-0.08, 0.08]) prizes.fossil.add(part(new THREE.SphereGeometry(0.05, 8, 6), eyeLook, x, 0.06, 0.17));
  const prizeRays = glowSprite(picture.rays, 0xffffff, 1, 0, 0, 0);
  prizeRays.visible = false;
  scene.add(prizeRays);
  for (const prize of Object.values(prizes)) {
    prize.visible = false;
    scene.add(prize);
  }
  let prize = null; // { mesh, since, from, color }

  /* ---- camera ---- */
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.25 : 1; // how much the camera shakes
  let distance = 8.8;
  stage.onResize((cam) => {
    const width = cam.aspect > 0.8 ? 4.4 : 3.4; // scene units across the screen at the front of the shaft
    distance = 0.5 + width / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    cam.far = distance + 30;
  });

  let now = 0; // the scene's own time: it stands still during a hit-stop
  let freeze = 0;
  let seenDepth = 0; // where the camera is, in blocks
  let minerDepth = 0;
  let shownDepth = 0; // blocks gone in the picture; behind the real depth while a blast is going off
  let swingAt = -9;
  let hopAt = -9;
  let cheerUntil = 0;
  let nextGlint = 0;
  let jolt = 0;
  let shake = 0;
  let punch = 0;
  let rise = 0;
  let heat = 0;
  let heatSeen = 0;
  let fuses = []; // { row, at, kind }
  const lookAt = new THREE.Vector3();
  const goldHome = new THREE.Vector3();
  const air = new THREE.Color(0xffffff);
  const airNow = new THREE.Color(0xffffff);

  const hitStop = (seconds) => {
    freeze = Math.max(freeze, seconds);
  };

  // What comes out of an opened block.
  function spill(depth, kind) {
    const y = -depth - 0.3;
    rubble.toss(7, 0, y, 0.45, kind === "dynamite" ? 0xd0352c : GROUND[layerAt(depth)].block, 1.7);
    const gold = { nugget: 5, lode: 16, diamond: 6, fossil: 6 }[kind] ?? 0;
    if (gold) goldBits.toss(gold, 0, y + 0.1, 0.5, 0xffffff, kind === "lode" ? 2.4 : 1.8, { home: true, life: 0.8 });
    const glow = FIND_GLOW[kind];
    if (glow) {
      flare(picture.glow, 0, y, 0.6, glow[0], 0.5, glow[1] * 1.5, 0.3);
      flare(picture.star, 0, y, 0.62, 0xffffff, 0.2, glow[1], 0.35, { turn: 1.5 });
    }
    if (kind === "lode") {
      flare(picture.rays, 0, y, 0.6, GOLD, 0.8, 3.4, 0.55, { turn: 1.2, strength: 0.8 });
      flare(picture.ring, 0, y, 0.6, GOLD, 0.3, 2.6, 0.4);
      sparks.toss(10, 0, y, 0.6, GOLD, 2.2);
      punch = Math.max(punch, 0.5);
      hitStop(0.04);
    }
    if (prizes[kind]) {
      if (prize) prize.mesh.visible = false;
      prize = { mesh: prizes[kind], since: now, from: y - 0.1, color: glow[0] };
      flare(picture.ring, 0, y, 0.6, glow[0], 0.3, 3.4, 0.5);
      sparks.toss(14, 0, y, 0.6, glow[0], 2.4);
      punch = Math.max(punch, 0.8);
      shake = Math.max(shake, 0.12);
      hitStop(kind === "fossil" ? 0.11 : 0.08);
    }
  }

  function explode(fuse) {
    const y = -fuse.row - 0.5;
    flare(picture.glow, 0, y, 0.7, 0xff8a2a, 0.8, 3.4, 0.34);
    flare(picture.glow, 0, y, 0.72, 0xfff3c0, 0.4, 1.6, 0.2);
    flare(picture.ring, 0, y, 0.7, 0xffd9a0, 0.4, 3.6, 0.3, { strength: 0.8 });
    rubble.toss(7, 0, y, 0.45, GROUND[layerAt(fuse.row)].block, 3);
    sparks.toss(9, 0, y, 0.6, 0xffa23a, 2.8, { wide: 0.9 });
    shake = Math.min(0.5, Math.max(shake, 0.26) + 0.05);
    punch = Math.max(punch, 0.7);
    if (fuse.kind) spill(fuse.row, fuse.kind);
  }

  return {
    // The pick comes down. `loose` bits of rubble fly from the block at `depth`.
    swing(depth, loose, hard) {
      swingAt = now;
      jolt = 1;
      shake = Math.max(shake, hard ? 0.09 : 0.035);
      punch = Math.max(punch, hard ? 0.35 : 0.12);
      const y = -depth + 0.06;
      rubble.toss(loose, 0.15, y, 0.4, GROUND[layerAt(depth)].block, 1.3);
      sparks.toss(hard ? 5 : 3, 0.25, y, 0.5, 0xffd9a0, 1.5, { wide: 0.2, life: 0.22 });
      flare(picture.star, 0.25, y + 0.03, 0.62, 0xfff0c8, 0.15, hard ? 1 : 0.65, 0.14, { turn: 0.6 });
    },
    // A block gave way. One that a blast is about to reach waits for its turn.
    open(depth, kind) {
      const fuse = fuses.find((one) => one.row === depth);
      if (fuse) fuse.kind = kind;
      else spill(depth, kind);
    },
    // Dynamite went off above `depth`: the next `reach` blocks blow up one after another.
    blast(depth, reach) {
      shake = 0.4;
      hitStop(0.06);
      flare(picture.glow, 0, -depth, 0.7, 0xfff3c0, 1, 5, 0.3);
      for (let i = 0; i < reach; i += 1) fuses.push({ row: depth + i, at: now + 0.05 + i * FUSE, kind: null });
    },
    // A better pick: a ring of light, a burst of rays behind the miner, and a hop.
    upgrade(level) {
      const color = PICK_HEADS[Math.min(level, PICK_HEADS.length - 1)];
      const y = -minerDepth + 0.5;
      hopAt = now;
      hitStop(0.09);
      punch = 1;
      flare(picture.rays, 0, y, 0.2, color, 1, 4.6, 0.8, { turn: 1.6 });
      flare(picture.ring, 0, y, 0.7, color, 0.3, 5.5, 0.55);
      flare(picture.glow, 0, y, 0.72, 0xffffff, 0.6, 2.6, 0.3);
      sparks.toss(18, 0, y, 0.6, color, 3, { wide: 0.3, life: 0.4 });
    },
    // 0 to 4: how far the combo has got. The miner glows hotter with each step.
    heat(step) {
      if (step > heat) {
        flare(picture.ring, 0, -minerDepth + 0.3, 0.7, HEAT[step], 0.3, 4.4, 0.45);
        sparks.toss(12, 0, -minerDepth + 0.3, 0.6, HEAT[step], 2.6, { wide: 0.6 });
      }
      heat = step;
    },
    // A shower of gold, for passing the deepest dig or setting a record.
    cheer(seconds = 0.9) {
      cheerUntil = now + seconds;
      flare(picture.rays, 0, -minerDepth + 0.6, 0.2, GOLD, 1, 5, 0.9, { turn: 2 });
    },
    reset() {
      for (const slot of rows) slot.row = null;
      rubble.clear();
      goldBits.clear();
      sparks.clear();
      for (const one of flares) one.sprite.visible = false;
      if (prize) prize.mesh.visible = false;
      prize = null;
      prizeRays.visible = false;
      fuses = [];
      seenDepth = minerDepth = shownDepth = 0;
      shake = jolt = punch = freeze = heat = heatSeen = 0;
      cheerUntil = 0;
      swingAt = hopAt = -9;
    },
    // picture: { depth, wear, pick, kindAt(row), over, best }
    show(view, frameTime) {
      const elapsed = freeze > 0 ? 0 : frameTime;
      freeze = Math.max(0, freeze - frameTime);
      now += elapsed;

      while (fuses.length && fuses[0].at <= now) explode(fuses.shift());
      const depth = fuses.length ? Math.min(view.depth, fuses[0].row) : view.depth;
      shownDepth = depth;
      seenDepth = ease(seenDepth, depth, Math.min(1, elapsed * 9));
      minerDepth = ease(minerDepth, depth, Math.min(1, elapsed * 20));
      if (Math.abs(seenDepth - depth) < 0.002) seenDepth = depth;

      const first = Math.floor(seenDepth) - ROWS_ABOVE;
      for (let row = first; row < first + ROWS; row += 1) {
        const slot = rows[((row % ROWS) + ROWS) % ROWS];
        const kind = row >= 0 ? view.kindAt(row) : null;
        if (slot.row !== row || slot.kind !== kind) dress(slot, row, kind);
        if (row < 0) continue;
        slot.block.visible = row >= depth;
        const wear = row === depth ? view.wear : 0;
        slot.cracks.forEach((crack, i) => {
          crack.visible = wear > (i + 1) / 5;
        });
        slot.block.position.x = row === depth ? Math.sin(now * 90) * 0.035 * jolt : 0;
        if (slot.halo.visible) slot.halo.scale.setScalar(FIND_GLOW[kind][1] * (1 + 0.14 * Math.sin(now * 5 + row)));
        slot.oreLook.emissiveIntensity = 0.75 + 0.45 * Math.sin(now * 2.6 + row * 1.7);
      }
      bestLine.visible = view.best > 0;
      bestLine.position.y = -view.best;
      for (const star of bestStars) star.material.rotation = now * 1.5;

      // Daylight above, lamplight below.
      const day = clamp01(1 - seenDepth / DARK_BY);
      const layer = layerAt(Math.floor(seenDepth));
      airNow.lerp(air.set(GROUND[layer].air), Math.min(1, elapsed * 3));
      sky.color.copy(airNow);
      sky.intensity = 0.3 + 0.5 * day;
      sun.intensity = 0.1 + 0.75 * day;
      lamp.intensity = 0.5 + 1.9 * (1 - day);
      lamp.position.set(0.25, -minerDepth + 0.3, 1.9);
      sunRays.material.rotation = now * 0.12;
      clouds.forEach((cloud, i) => {
        cloud.position.x = ((cloud.position.x + elapsed * (0.05 + i * 0.03) + 2.6) % 5.2) - 2.6;
      });

      // The pick is already down when the tap lands, then swings back up.
      const sinceSwing = now - swingAt;
      const back = clamp01(sinceSwing / 0.2);
      const level = Math.min(view.pick, PICK_HEADS.length - 1);
      shoulder.rotation.x = ease(2.25, -0.55, 1 - (1 - back) ** 2);
      shoulder.scale.setScalar(1 + 0.08 * view.pick);
      pickHead.color.set(PICK_HEADS[level]);
      pickHead.emissive.set(pickHead.color).multiplyScalar(view.pick >= 2 ? 0.4 : 0);
      pickGlow.material.color.set(PICK_HEADS[level]);
      pickGlow.material.opacity = Math.min(0.9, view.pick * 0.16);
      streak.scale.setScalar(1 + 0.08 * view.pick);
      streakLook.color.set(view.pick ? PICK_HEADS[level] : 0xffe2b8);
      streakLook.opacity = clamp01(1 - sinceSwing / 0.17) * Math.min(0.85, 0.3 + 0.1 * view.pick);
      const hop = clamp01((now - hopAt) / 0.34);
      miner.position.y = -minerDepth + Math.sin(hop * Math.PI) * 0.3;
      miner.rotation.y = 0.7 + (hop < 1 ? hop * Math.PI * 2 : 0);
      miner.scale.set(MINER_SIZE, MINER_SIZE * (1 - 0.08 * jolt), MINER_SIZE);
      jolt = Math.max(0, jolt - elapsed * 9);

      heatSeen = ease(heatSeen, heat, Math.min(1, elapsed * 6));
      aura.visible = heatSeen > 0.05;
      aura.position.set(0, -minerDepth + 0.35, 0.3);
      aura.material.color.set(HEAT[Math.max(1, heat)]);
      aura.material.opacity = Math.min(0.75, 0.22 * heatSeen) * (0.85 + 0.15 * Math.sin(now * 12));
      aura.scale.setScalar(2 + 0.35 * heatSeen);
      if (elapsed > 0) {
        if (heat > 0 && Math.random() < elapsed * 7 * heat) {
          sparks.toss(1, 0, -minerDepth + 0.1, 0.5, HEAT[heat], 0.5, { pull: -0.25, wide: 1, life: 0.5 });
        }
        if (layer === 4 && Math.random() < elapsed * 9) {
          sparks.toss(1, 0, -seenDepth - 2.5 + Math.random() * 3, 0.6, 0xff7a2a, 0.3, { pull: -0.2, wide: 3.2, life: 0.7 });
        }
        if (now < cheerUntil) goldBits.toss(2, 0, -minerDepth + 0.2, 0.6, 0xffffff, 3.2, { wide: 0.8, life: 0.7 });
        // Now and then some ore in the walls catches the light.
        if (now >= nextGlint && seenDepth > 2) {
          nextGlint = now + 0.1 + Math.random() * 0.25;
          const row = Math.floor(seenDepth) - 3 + Math.floor(Math.random() * 8);
          const side = Math.random() < 0.5 ? -1 : 1;
          flare(picture.star, side * (0.65 + Math.random() * 0.8), -row - Math.random(), 0.58, GROUND[layerAt(Math.max(0, row))].ore, 0.05, 0.42, 0.5, { turn: 1.2, strength: 0.9 });
        }
      }

      // Gold flies up to the count at the top of the screen.
      goldHome.set(0, camera.position.y + 1.6, 2.5);
      rubble.step(elapsed);
      goldBits.step(elapsed, goldHome);
      sparks.step(elapsed);
      stepFlares();
      if (prize) {
        const t = (now - prize.since) / 1.2;
        prize.mesh.visible = prizeRays.visible = t < 1;
        if (t < 1) {
          const up = 1 - (1 - t) ** 3;
          const size = Math.min(1, t * 8) * (t > 0.8 ? (1 - t) * 5 : 1);
          prize.mesh.position.set(0, prize.from + 0.4 + 1.6 * up, 0.8);
          prize.mesh.rotation.y = t * 10;
          prize.mesh.scale.setScalar(size);
          prizeRays.position.set(0, prize.from + 0.4 + 1.6 * up, 0.6);
          prizeRays.material.color.set(prize.color);
          prizeRays.material.rotation = t * 3;
          prizeRays.material.opacity = 0.85 * size;
          prizeRays.scale.setScalar(2.6 * size);
        } else prize = null;
      }

      // The miner sits in the upper part of the screen so the blocks to come are in view.
      // When the round is over he moves down, clear of the result.
      rise = ease(rise, view.over ? 1 : 0, Math.min(1, elapsed * 4));
      shake *= Math.exp(-elapsed * 12);
      punch *= Math.exp(-elapsed * 10);
      const shakeX = Math.sin(now * 71) * shake * calm;
      const shakeY = Math.cos(now * 83) * shake * calm;
      const aim = -seenDepth - 0.1 + 0.9 * rise;
      camera.position.set(shakeX, aim + 1.4 + shakeY, distance - 0.45 * punch);
      camera.lookAt(lookAt.set(shakeX, aim + shakeY, 0));
      camera.rotation.z += Math.sin(now * 57) * shake * calm * 0.12; // a shake that also twists reads as a blow
      stage.render(frameTime);
    },
    // For checks: what the picture is showing.
    get state() {
      return { shownDepth, fuses: fuses.length, frozen: freeze > 0, heat, flares: flares.filter((one) => one.sprite.visible).length };
    },
  };
}

/* ---- pictures drawn once and used as textures ---- */

function drawGlow(pen, size) {
  const half = size / 2;
  const fade = pen.createRadialGradient(half, half, 0, half, half, half);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.25, "rgba(255,255,255,0.55)");
  fade.addColorStop(0.6, "rgba(255,255,255,0.13)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  pen.fillStyle = fade;
  pen.fillRect(0, 0, size, size);
}

function drawRays(pen, size) {
  const half = size / 2;
  const fade = pen.createRadialGradient(half, half, 0, half, half, half);
  fade.addColorStop(0, "rgba(255,255,255,0.95)");
  fade.addColorStop(0.5, "rgba(255,255,255,0.35)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  pen.fillStyle = fade;
  pen.translate(half, half);
  for (let i = 0; i < 12; i += 1) {
    const width = i % 2 ? 0.07 : 0.13;
    pen.rotate(Math.PI / 6);
    pen.beginPath();
    pen.moveTo(0, 0);
    pen.arc(0, 0, half, -width, width);
    pen.closePath();
    pen.fill();
  }
}

function drawRing(pen, size) {
  const half = size / 2;
  pen.strokeStyle = "#fff";
  pen.shadowColor = "#fff";
  pen.shadowBlur = size * 0.05;
  pen.lineWidth = size * 0.035;
  pen.beginPath();
  pen.arc(half, half, half * 0.82, 0, Math.PI * 2);
  pen.stroke();
}

function drawStar(pen, size) {
  const half = size / 2;
  drawGlow(pen, size);
  pen.globalAlpha = 0.9;
  pen.fillStyle = "#fff";
  pen.translate(half, half);
  for (let i = 0; i < 2; i += 1) {
    pen.rotate(Math.PI / 2);
    pen.beginPath();
    pen.moveTo(-half, 0);
    pen.quadraticCurveTo(0, -half * 0.07, half, 0);
    pen.quadraticCurveTo(0, half * 0.07, -half, 0);
    pen.fill();
  }
}

// Light, speckled stone with darker edges; the material's colour tints it.
function drawGrain(pen, size) {
  pen.fillStyle = "#e9e9e9";
  pen.fillRect(0, 0, size, size);
  for (let i = 0; i < 170; i += 1) {
    const light = Math.random() < 0.4;
    const side = 2 + Math.random() * (light ? 5 : 9);
    pen.fillStyle = light ? `rgba(255,255,255,${0.25 + Math.random() * 0.4})` : `rgba(0,0,0,${0.04 + Math.random() * 0.1})`;
    pen.fillRect(Math.random() * size, Math.random() * size, side, side * (0.5 + Math.random()));
  }
  pen.strokeStyle = "rgba(0,0,0,0.2)";
  pen.lineWidth = size * 0.05;
  pen.strokeRect(0, 0, size, size);
  pen.fillStyle = "rgba(255,255,255,0.3)";
  pen.fillRect(0, 0, size, size * 0.035);
}

function drawDynamiteLabel(pen, width, height) {
  pen.fillStyle = "#f7efe0";
  pen.fillRect(0, 0, width, height);
  pen.fillStyle = "#1c1410";
  pen.font = "900 60px system-ui, sans-serif";
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.fillText("TNT", width / 2, height * 0.55);
}

// A wooden board with the depth painted on it.
function drawSign(pen, text) {
  pen.fillStyle = "#5d3f25";
  pen.fillRect(0, 0, 128, 64);
  pen.fillStyle = "#8a6038";
  pen.fillRect(4, 4, 120, 56);
  pen.fillStyle = "#fff4d6";
  pen.font = "900 34px system-ui, sans-serif";
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.fillText(text, 64, 34);
}
