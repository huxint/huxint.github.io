import {
  ACESFilmicToneMapping,
  DataTexture,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  Scene,
  RGBAFormat,
  WebGLRenderer,
} from 'three';
import { createGorilla } from '../lib/gorilla-model';

function contactShadow(): DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(
        (x / (size - 1)) * 2 - 1,
        (y / (size - 1)) * 2 - 1,
      );
      const offset = (x + y * size) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(
        255 *
          Math.exp(-radius * radius * 3) *
          (1 - MathUtils.smoothstep(radius, 0.7, 1)),
      );
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function mountGorilla(element: HTMLElement): void {
  const canvas = element.querySelector<HTMLCanvasElement>('canvas')!;
  const poster = element.querySelector<HTMLImageElement>('.gorilla-poster')!;
  const controls = element.querySelector<HTMLElement>('.gorilla-controls')!;
  const motionButton = element.querySelector<HTMLButtonElement>(
    '[data-gorilla-motion]',
  )!;
  const status = element.querySelector<HTMLElement>('[data-gorilla-status]')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.89, 1.89, 1.89, -1.89, 0.1, 30);
  camera.position.set(0, 2.66, 8);
  camera.lookAt(0, 1.44, 0);

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const { body, head, setEyes } = createGorilla();
  const neckHeight = head.position.y;
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(body);
  const floorMaterial = new MeshBasicMaterial({
    color: '#34343b',
    map: contactShadow(),
    transparent: true,
    depthWrite: false,
    opacity: 0.32,
  });
  const floor = new Mesh(new PlaneGeometry(3.55, 2.65), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ambient = new HemisphereLight('#fcf5ea', '#8a8790', 1.83);
  const key = new DirectionalLight('#fff3e1', 2.5);
  key.position.set(-4.5, 6.0, 4.3);
  key.target.position.set(0, 1.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  key.shadow.normalBias = 0.014;
  key.shadow.intensity = 0.8;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 3;
  const fill = new DirectionalLight('#e2ecfc', 0.83);
  fill.position.set(3, 2, 4);
  const rim = new DirectionalLight('#efeee8', 2.05);
  rim.position.set(2.5, 4.8, -3.5);
  scene.add(ambient, key, key.target, fill, rim);

  let inView = true;
  let hasContext = true;
  let motionEnabled = !reducedMotion.matches;
  let frame = 0;
  let lastRender = 0;
  let lastPoseTime = performance.now();
  let poseTime = 0;
  const defaultYaw = -0.32;
  let yaw = defaultYaw;
  let headX = 0;
  let headY = 0;
  let gazeX = 0;
  let gazeY = 0;
  let greetingStart = -Infinity;
  let stillGreeting = false;
  let pointerId: number | undefined;
  let pointerX = 0;
  let pointerY = 0;
  let dragDistance = 0;

  function updateMotionButton() {
    motionButton.setAttribute(
      'aria-label',
      motionEnabled ? '暂停猩猩动画' : '播放猩猩动画',
    );
    motionButton.setAttribute('title', motionEnabled ? '暂停动画' : '播放动画');
    motionButton.setAttribute('aria-pressed', String(!motionEnabled));
  }

  function draw(time = performance.now()) {
    if (!canRender()) return;
    const delta = Math.max(0, (time - lastPoseTime) / 1000);
    lastPoseTime = time;
    if (motionEnabled) poseTime += delta;
    const t = motionEnabled ? poseTime : 0;
    const since = t - greetingStart;
    let nod = stillGreeting ? 1 : 0;
    if (motionEnabled && since >= 0 && since < 0.94) {
      nod =
        MathUtils.smoothstep(since, 0, 0.34) *
        (1 - MathUtils.smoothstep(since, 0.43, 0.94));
    }
    const breath = Math.sin(t * 1.56);
    const blink =
      Math.sin(Math.PI * MathUtils.clamp(((t % 5.3) - 2.03) / 0.205, 0, 1)) **
      2;
    body.rotation.y = yaw;
    head.position.y = neckHeight + breath * 0.009 - nod * 0.022;
    const settle = motionEnabled ? 1 - Math.exp(-delta * 8) : 1;
    head.rotation.x +=
      (-0.025 + headX + 0.193 * nod + breath * 0.008 - head.rotation.x) *
      settle;
    head.rotation.y += (0.12 + headY - head.rotation.y) * settle;
    head.rotation.z += (-0.048 - 0.023 * nod - head.rotation.z) * settle;
    const glance = motionEnabled ? 1 - Math.exp(-delta * 17) : 1;
    gazeX += (headY * 0.35 - gazeX) * glance;
    gazeY += (-headX * 0.22 - nod * 0.028 - gazeY) * glance;
    setEyes(Math.max(blink, 0.4 * nod), gazeX, gazeY);
    renderer.render(scene, camera);
  }

  function animate(time: number) {
    frame = requestAnimationFrame(animate);
    // A small portrait needs at most 30 frames per second, including on high-refresh screens.
    if (time - lastRender < 1000 / 30) return;
    lastRender = time;
    draw(time);
  }

  function canRender(): boolean {
    return hasContext && inView && !document.hidden;
  }

  function applyMotion(enabled: boolean): void {
    motionEnabled = enabled;
    stillGreeting = false;
    greetingStart = -Infinity;
    if (!enabled) headX = headY = 0;
    updateMotionButton();
    syncAnimation();
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastPoseTime = performance.now();
    draw();
    if (motionEnabled && canRender()) {
      frame = requestAnimationFrame(animate);
    }
  }

  function showCanvas(ready: boolean) {
    element.dataset.state = ready ? 'ready' : 'fallback';
    canvas.hidden = !ready;
    canvas.tabIndex = ready ? 0 : -1;
    poster.hidden = ready;
    controls.hidden = !ready;
  }

  function resize() {
    const { width, height } = canvas.parentElement!.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    const halfWidth = (camera.top * width) / height;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.updateProjectionMatrix();
    draw();
  }

  function greet() {
    if (motionEnabled && poseTime - greetingStart >= 0.94)
      greetingStart = poseTime;
    stillGreeting = !motionEnabled && !stillGreeting;
    status.textContent = '猩猩向你点了点头。';
    draw();
  }

  function resetView() {
    status.textContent = '';
    greetingStart = -Infinity;
    yaw = defaultYaw;
    headX = 0;
    headY = 0;
    stillGreeting = false;
    draw();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    dragDistance = 0;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pointerId === event.pointerId) {
      const distance = event.clientX - pointerX;
      dragDistance += Math.hypot(distance, event.clientY - pointerY);
      yaw += distance * 0.012;
      pointerX = event.clientX;
      pointerY = event.clientY;
      draw();
    } else if (event.pointerType === 'mouse' && motionEnabled) {
      const bounds = canvas.getBoundingClientRect();
      headX =
        MathUtils.clamp(
          (event.clientY - bounds.top) / bounds.height - 0.5,
          -0.5,
          0.5,
        ) * 0.25;
      headY =
        MathUtils.clamp(
          (event.clientX - bounds.left) / bounds.width - 0.5,
          -0.5,
          0.5,
        ) * 0.43;
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    if (pointerId !== event.pointerId) return;
    pointerId = undefined;
    canvas.releasePointerCapture(event.pointerId);
    if (dragDistance < 5) greet();
  });
  canvas.addEventListener('lostpointercapture', () => {
    pointerId = undefined;
  });
  canvas.addEventListener('pointerleave', () => {
    headX = 0;
    headY = 0;
  });

  canvas.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowLeft':
        yaw -= Math.PI / 8;
        break;
      case 'ArrowRight':
        yaw += Math.PI / 8;
        break;
      case 'Home':
        resetView();
        break;
      case 'Enter':
      case ' ':
        greet();
        break;
      default:
        return;
    }
    event.preventDefault();
    draw();
  });

  element
    .querySelector('[data-gorilla-greet]')!
    .addEventListener('click', greet);
  element
    .querySelector('[data-gorilla-reset]')!
    .addEventListener('click', resetView);
  motionButton.addEventListener('click', () => {
    applyMotion(!motionEnabled);
  });
  reducedMotion.addEventListener('change', () => {
    applyMotion(!reducedMotion.matches);
  });
  document.addEventListener('visibilitychange', syncAnimation);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    hasContext = false;
    showCanvas(false);
    syncAnimation();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    hasContext = true;
    resize();
    showCanvas(true);
    syncAnimation();
  });

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    syncAnimation();
  });
  visibility.observe(element);
  const dimensions = new ResizeObserver(resize);
  dimensions.observe(canvas.parentElement!);
  function updateLighting() {
    const dark = document.documentElement.dataset.theme === 'dark';
    ambient.intensity = dark ? 1.86 : 1.83;
    rim.intensity = dark ? 2.85 : 2.05;
    floorMaterial.opacity = dark ? 0.54 : 0.36;
    draw();
  }
  const theme = new MutationObserver(updateLighting);
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  updateLighting();
  updateMotionButton();
  resize();
  showCanvas(true);
  syncAnimation();
}
