// A WebGL view that fills its host element and lowers its own resolution when
// the device cannot keep up. Returns null when WebGL is not available.
const SLOW_FRAME = 1 / 40;
const FRAMES_BEFORE_JUDGING = 45;

export function createStage3D(host, { background = 0xffffff, shadows = true } = {}) {
  const THREE = window.THREE;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);

  let sharpness = Math.min(window.devicePixelRatio || 1, 2);
  let smoothed = 0;
  let judged = 0;
  let frameCamera = () => {};

  function fit() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(sharpness);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    frameCamera(camera);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(fit).observe(host);

  return {
    THREE,
    scene,
    camera,
    canvas: renderer.domElement,
    // onResize(camera) lets a game re-frame its camera for the new shape.
    onResize(callback) {
      frameCamera = callback;
      fit();
    },
    get sharpness() {
      return sharpness;
    },
    render(elapsed) {
      if (elapsed > 0) {
        smoothed += (elapsed - smoothed) * 0.1;
        judged += 1;
        if (judged > FRAMES_BEFORE_JUDGING && smoothed > SLOW_FRAME && sharpness > 1) {
          sharpness = Math.max(1, sharpness - 0.5);
          judged = 0;
          fit();
        }
      }
      renderer.render(scene, camera);
    },
  };
}

// A sun with shadows plus soft sky light.
export function addDaylight(stage, { sun = 1, sky = 0.6 } = {}) {
  const { THREE, scene } = stage;
  const sunLight = new THREE.DirectionalLight(0xfff4e0, sun);
  sunLight.position.set(2.5, 6, 3.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -3;
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 3;
  scene.add(sunLight, new THREE.HemisphereLight(0xffffff, 0x9a8468, sky));
  return sunLight;
}
