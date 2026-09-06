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
  Texture,
  WebGLRenderer,
  type Material,
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

export function mountGorilla(element: HTMLElement): () => void {
  const canvas = element.querySelector<HTMLCanvasElement>('canvas')!;
  const poster = element.querySelector<HTMLImageElement>('.gorilla-poster')!;
  const controls = element.querySelector<HTMLElement>('.gorilla-controls')!;
  const motionButton = element.querySelector<HTMLButtonElement>(
    '[data-gorilla-motion]',
  )!;
  const greetingStatus = element.querySelector<HTMLElement>(
    '[data-gorilla-status]',
  )!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const { signal } = events;
  const scene = new Scene();
  const camera = new OrthographicCamera(-2.65, 2.65, 2.65, -2.65, 0.1, 30);
  camera.position.set(0, 0.65, 8);
  camera.lookAt(0, -0.04, 0);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    element.dataset.state = 'fallback';
    return () => {};
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  let gorilla: ReturnType<typeof createGorilla>;
  try {
    gorilla = createGorilla();
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
  const { body, head, eyes, rightArm, rightForearm } = gorilla;
  body.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(body);
  const floorMaterial = new MeshBasicMaterial({
    color: '#25251f',
    map: contactShadow(),
    transparent: true,
    depthWrite: false,
    opacity: 0.32,
  });
  const floor = new Mesh(new PlaneGeometry(4.1, 3), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  const groundY = -2.085;
  floor.position.y = groundY;
  scene.add(floor);
  const ambient = new HemisphereLight('#f7f3e9', '#666575', 1.8);
  const key = new DirectionalLight('#fff5e4', 2.7);
  key.position.set(-3, 5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 3;
  const fill = new DirectionalLight('#dfeaff', 1.2);
  fill.position.set(4, 1, 3);
  const rim = new DirectionalLight('#dfe4db', 2.7);
  rim.position.set(1, 3, -4);
  scene.add(ambient, key, fill, rim);

  let inView = true;
  let hasContext = true;
  let motionEnabled = !reducedMotion.matches;
  let frame = 0;
  let lastRender = 0;
  let lastPoseTime = 0;
  let yaw = -0.2;
  let headX = 0;
  let headY = 0;
  let greetingStart = -Infinity;
  let greetingPose = 0;
  let greetingTimeout: ReturnType<typeof setTimeout> | undefined;
  let pointerId: number | undefined;
  let pointerX = 0;
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
    if (!hasContext || !inView || document.hidden) return;
    const delta = MathUtils.clamp((time - lastPoseTime) / 1000, 0, 0.1);
    lastPoseTime = time;
    const elapsed = (time - greetingStart) / 1900;
    const greeting =
      motionEnabled && elapsed >= 0 && elapsed < 1
        ? MathUtils.smoothstep(elapsed, 0, 0.25) *
          (1 - MathUtils.smoothstep(elapsed, 0.72, 1))
        : greetingPose;
    const idle = motionEnabled ? Math.sin(time / 1800) * 0.003 : 0;
    const blinkTime = (time + 2700) % 5200;
    const blink =
      motionEnabled && blinkTime < 160
        ? Math.sin((blinkTime / 160) * Math.PI) ** 2
        : 0;
    body.rotation.y = yaw;
    body.scale.y = 1 + idle;
    body.position.y = -groundY * idle;
    for (const { globe, lid } of eyes) {
      globe.scale.y = 1 - blink * 0.94;
      lid.visible = blink > 0.02;
      lid.scale.y = blink;
      lid.position.y = globe.position.y + (1 - blink) * 0.095;
    }
    rightArm.rotation.z = greeting * 1.1;
    rightForearm.rotation.z =
      greeting *
      (2.15 +
        (motionEnabled && greeting
          ? Math.sin(elapsed * Math.PI * 6) * 0.14
          : 0));
    const pitch = headX + greeting * 0.07;
    const roll = -0.02 + greeting * 0.06;
    head.rotation.set(
      motionEnabled ? MathUtils.damp(head.rotation.x, pitch, 10, delta) : pitch,
      motionEnabled ? MathUtils.damp(head.rotation.y, headY, 10, delta) : headY,
      motionEnabled ? MathUtils.damp(head.rotation.z, roll, 10, delta) : roll,
    );
    renderer.render(scene, camera);
  }

  function animate(time: number) {
    frame = requestAnimationFrame(animate);
    // A small portrait needs at most 30 frames per second, including on high-refresh screens.
    if (time - lastRender < 1000 / 30) return;
    lastRender = time;
    draw(time);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    draw();
    if (motionEnabled && inView && hasContext && !document.hidden) {
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 480 ? 1.5 : 2));
    renderer.setSize(width, height, false);
    const halfWidth = (camera.top * width) / height;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.updateProjectionMatrix();
    draw();
  }

  function greet() {
    clearTimeout(greetingTimeout);
    greetingStart = performance.now();
    greetingPose = motionEnabled ? 0 : greetingPose ? 0 : 1;
    greetingStatus.textContent = '嗨，欢迎来逛逛。';
    greetingTimeout = setTimeout(() => {
      greetingStatus.textContent = '';
    }, 2600);
    draw();
  }

  function resetView() {
    clearTimeout(greetingTimeout);
    greetingStatus.textContent = '';
    greetingStart = -Infinity;
    yaw = -0.2;
    headX = 0;
    headY = 0;
    greetingPose = 0;
    draw();
  }

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointerId = event.pointerId;
      pointerX = event.clientX;
      dragDistance = 0;
      canvas.setPointerCapture(event.pointerId);
    },
    { signal },
  );

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (pointerId === event.pointerId) {
        const distance = event.clientX - pointerX;
        dragDistance += Math.abs(distance);
        yaw += distance * 0.012;
        pointerX = event.clientX;
        draw();
      } else if (event.pointerType === 'mouse' && motionEnabled) {
        const bounds = canvas.getBoundingClientRect();
        headX =
          MathUtils.clamp(
            (event.clientY - bounds.top) / bounds.height - 0.5,
            -0.5,
            0.5,
          ) * 0.12;
        headY =
          MathUtils.clamp(
            (event.clientX - bounds.left) / bounds.width - 0.5,
            -0.5,
            0.5,
          ) * 0.2;
      }
    },
    { signal },
  );

  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (pointerId !== event.pointerId) return;
      pointerId = undefined;
      canvas.releasePointerCapture(event.pointerId);
      if (dragDistance < 5) greet();
    },
    { signal },
  );
  canvas.addEventListener(
    'lostpointercapture',
    () => {
      pointerId = undefined;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerleave',
    () => {
      headX = 0;
      headY = 0;
    },
    { signal },
  );

  canvas.addEventListener(
    'keydown',
    (event) => {
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
    },
    { signal },
  );

  element
    .querySelector('[data-gorilla-greet]')!
    .addEventListener('click', greet, { signal });
  element
    .querySelector('[data-gorilla-reset]')!
    .addEventListener('click', resetView, { signal });
  motionButton.addEventListener(
    'click',
    () => {
      motionEnabled = !motionEnabled;
      greetingPose = 0;
      greetingStart = -Infinity;
      updateMotionButton();
      syncAnimation();
    },
    { signal },
  );
  reducedMotion.addEventListener(
    'change',
    () => {
      motionEnabled = !reducedMotion.matches;
      greetingPose = 0;
      greetingStart = -Infinity;
      updateMotionButton();
      syncAnimation();
    },
    { signal },
  );
  document.addEventListener('visibilitychange', syncAnimation, { signal });

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      hasContext = false;
      showCanvas(false);
      syncAnimation();
    },
    { signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      hasContext = true;
      resize();
      showCanvas(true);
      syncAnimation();
    },
    { signal },
  );

  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    syncAnimation();
  });
  visibility.observe(element);
  const dimensions = new ResizeObserver(resize);
  dimensions.observe(canvas.parentElement!);
  function updateLighting() {
    const dark = document.documentElement.dataset.theme === 'dark';
    ambient.intensity = dark ? 1.6 : 1.8;
    rim.intensity = dark ? 3.2 : 2.7;
    floorMaterial.opacity = dark ? 0.55 : 0.32;
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

  return () => {
    clearTimeout(greetingTimeout);
    greetingStatus.textContent = '';
    cancelAnimationFrame(frame);
    events.abort();
    visibility.disconnect();
    dimensions.disconnect();
    theme.disconnect();
    key.shadow.dispose();
    const geometries = new Set<Mesh['geometry']>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const material of [object.material].flat()) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    showCanvas(false);
    // A lost WebGL context belongs to its canvas and cannot be reused on remount.
    canvas.replaceWith(canvas.cloneNode());
  };
}
