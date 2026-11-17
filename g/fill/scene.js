// The 3D picture: a glass on a table, a jug above it, water, and now and then a duck.
// One scene unit is 100 mm.
import { addDaylight } from "../../kit/stage3d.js";
import { BRIM, FULL_FLOW } from "./rules.js";

const MM = 0.01;
const FOOT = 0.06; // thick glass bottom
const RADIUS = 0.36;
const BRIM_Y = FOOT + BRIM * MM;
const HALF_VIEW_WIDTH = 0.177; // tangent of half the horizontal field of view

function ease(from, to, amount) {
  return from + (to - from) * amount;
}

export function createPourScene(stage) {
  const { THREE, scene, camera } = stage;
  addDaylight(stage, { sun: 0.75, sky: 0.5 });

  const solid = (color, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });
  const clear = (color, opacity, roughness = 0.1) =>
    new THREE.MeshStandardMaterial({ color, roughness, opacity, transparent: true });
  const add = (geometry, material, order = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    scene.add(mesh);
    return mesh;
  };

  const table = add(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 48), solid(0xb98a5a, 0.8));
  table.position.y = -0.05;
  table.receiveShadow = true;

  // Glass: a thick foot, a see-through wall and a bright ring at the brim.
  const foot = add(new THREE.CylinderGeometry(RADIUS, RADIUS, FOOT, 48), clear(0xdfeaf0, 0.7));
  foot.position.y = FOOT / 2;
  foot.castShadow = true;
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    opacity: 0.22,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wall = add(new THREE.CylinderGeometry(RADIUS, RADIUS, BRIM_Y, 48, 1, true), wallMaterial, 3);
  wall.position.y = BRIM_Y / 2;
  const ring = add(new THREE.TorusGeometry(RADIUS, 0.012, 10, 64), clear(0xffffff, 0.85), 4);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = BRIM_Y;

  // Water: the column in the glass, the dome above the brim, the falling stream,
  // and for a flood the sheet running down the outside plus the puddle.
  const waterMaterial = clear(0x2f8fe0, 0.86, 0.15);
  const column = add(new THREE.CylinderGeometry(RADIUS - 0.012, RADIUS - 0.012, 1, 48), waterMaterial, 1);
  const domeRadius = RADIUS - 0.004;
  const dome = add(new THREE.SphereGeometry(domeRadius, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), waterMaterial, 2);
  const stream = add(new THREE.CylinderGeometry(0.035, 0.028, 1, 12), waterMaterial, 2);
  const sheet = add(new THREE.CylinderGeometry(RADIUS + 0.015, RADIUS + 0.03, BRIM_Y, 48, 1, true), waterMaterial, 5);
  sheet.position.y = BRIM_Y / 2;
  const puddle = add(new THREE.CylinderGeometry(1, 1, 0.012, 48), waterMaterial);
  puddle.position.y = 0.007;

  // Jug: body, spout and handle, hanging above the glass.
  const jug = new THREE.Group();
  const china = solid(0xf4f1ea, 0.35);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.7, 32), china);
  body.castShadow = true;
  const spout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.16), china);
  spout.position.set(-0.38, 0.3, 0);
  spout.rotation.z = -0.25;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 24, Math.PI), solid(0x2b3440));
  handle.position.x = 0.33;
  handle.rotation.z = -Math.PI / 2;
  jug.add(body, spout, handle);
  jug.scale.setScalar(0.7);
  jug.position.set(0.4, 2.05, 0);
  scene.add(jug);
  const spoutTip = new THREE.Vector3();

  // The rare visitor.
  const duck = new THREE.Group();
  const yellow = solid(0xffd21f, 0.4);
  const duckBody = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), yellow);
  duckBody.scale.set(1.25, 0.8, 1);
  const duckHead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 12), yellow);
  duckHead.position.set(-0.08, 0.1, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 10), solid(0xf07a1a));
  beak.rotation.z = Math.PI / 2;
  beak.position.set(-0.16, 0.095, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), solid(0x111111));
  eye.position.set(-0.115, 0.125, 0.05);
  duck.add(duckBody, duckHead, beak, eye);
  scene.add(duck);

  // Narrow screens keep the same width in view and gain height.
  stage.onResize((cam) => {
    cam.fov = Math.max(30, THREE.MathUtils.radToDeg(2 * Math.atan(HALF_VIEW_WIDTH / cam.aspect)));
  });

  const JUG_HEIGHT = 2.05;
  let tilt = 0;
  let lift = 0;
  let closeness = 0;
  const lookAt = new THREE.Vector3();

  // picture: { level, flow, tilted, away, wet (0..1), duck, closeUp, time }
  return function show(picture, elapsed) {
    const { level, flow } = picture;
    const strength = flow / FULL_FLOW;

    tilt = ease(tilt, picture.tilted ? 0.95 : 0, Math.min(1, elapsed * 9));
    jug.rotation.z = tilt;
    // Once the pour is over the jug leaves the frame, so nothing sits behind the result.
    lift = ease(lift, picture.away ? 1 : 0, Math.min(1, elapsed * 6));
    jug.position.y = JUG_HEIGHT + lift * 1.6;

    const surface = FOOT + Math.min(level, BRIM) * MM;
    const above = Math.max(0, level - BRIM) * MM;
    column.visible = level > 0;
    column.scale.y = Math.max(0.001, surface - FOOT);
    column.position.y = (FOOT + surface) / 2;
    dome.visible = above > 0;
    dome.position.y = surface;
    dome.scale.y = Math.max(0.001, (above / domeRadius) * 2.2); // exaggerated so 1 mm is visible

    stream.visible = flow > 0;
    if (stream.visible) {
      jug.localToWorld(spoutTip.set(-0.55, 0.26, 0));
      const length = Math.max(0.01, spoutTip.y - surface) * Math.min(1, strength * 3);
      const width = 0.4 + 0.6 * strength;
      stream.scale.set(width, length, width);
      stream.position.set(spoutTip.x, spoutTip.y - length / 2, 0);
    }

    sheet.visible = puddle.visible = picture.wet > 0;
    puddle.scale.set(0.4 + 1.5 * picture.wet, 1, 0.4 + 1.5 * picture.wet);

    duck.visible = picture.duck;
    duck.position.set(-0.14, surface + above + 0.035 + Math.sin(picture.time * 2.2) * 0.006, 0.12);
    duck.rotation.z = Math.sin(picture.time * 1.7) * 0.07;

    // The camera moves in on the brim over the last stretch.
    const near = picture.closeUp ? THREE.MathUtils.smoothstep(level, BRIM * 0.55, BRIM * 0.95) : 0;
    closeness = ease(closeness, near, Math.min(1, elapsed * 5));
    camera.position.set(0, ease(1.9, 1.5, closeness), ease(5.6, 3, closeness));
    camera.lookAt(lookAt.set(0, ease(1.15, 1.26, closeness), 0));

    stage.render(elapsed);
  };
}
