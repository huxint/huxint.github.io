import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import { addEyes } from './gorilla-eyes';
import {
  blendSurfaces,
  carveSurface,
  ellipsoid,
  sculptSurface,
  type Point,
  type Surface,
} from './gorilla-geometry';

export function createGorilla() {
  const body = new Group();
  const head = new Group();
  head.position.set(0, 1.94, 0.19);
  body.add(head);

  const coat = new MeshPhysicalMaterial({
    color: '#494d50',
    roughness: 0.91,
    sheen: 0.32,
    sheenColor: '#747774',
    sheenRoughness: 0.92,
  });
  const face = new MeshStandardMaterial({ color: '#8a8379', roughness: 0.88 });
  const nose = new MeshStandardMaterial({ color: '#3b3b39', roughness: 0.66 });
  const ink = new MeshStandardMaterial({ color: '#4f4843', roughness: 0.9 });

  function sculpt(
    parent: Group,
    surface: Surface,
    material: MeshStandardMaterial,
    min: Point,
    max: Point,
    resolution: number,
  ) {
    const mesh = new Mesh(
      sculptSurface(surface, min, max, resolution),
      material,
    );
    parent.add(mesh);
    return mesh;
  }

  // A seated ape carries its weight on the outside knuckles. The forearms
  // sweep forward from the elbows, leaving daylight on either side of the belly.
  const trunk = blendSurfaces(
    0.22,
    ellipsoid([0, 1.19, -0.15], [0.72, 0.9, 0.63], 0, -0.13),
    ellipsoid([0, 0.62, -0.19], [0.66, 0.49, 0.55]),
    ellipsoid([0, 1.62, -0.2], [0.94, 0.5, 0.59]),
    ...[-1, 1].flatMap((s) => [
      ellipsoid([s * 0.82, 1.53, -0.08], [0.49, 0.46, 0.44], s * 0.25),
      ellipsoid([s * 0.38, 1.36, 0.232], [0.43, 0.32, 0.25], s * 0.18),
      ellipsoid(
        [s * 1.085, 1.17, -0.005],
        [0.322, 0.575, 0.346],
        s * 0.31,
        -0.19,
      ),
      ellipsoid(
        [s * 1.208, 0.71, s * 0.045 + 0.215],
        [0.263, 0.49, 0.308],
        s * 0.055,
        -0.54,
      ),
      ellipsoid([s * 0.5, 0.5, 0.02], [0.349, 0.388, 0.44], s * 0.18),
    ]),
  );
  const handsAndFeet: Surface[] = [];
  for (const s of [-1, 1]) {
    const wristZ = 0.452 + s * 0.045;
    const knuckles = Array.from({ length: 4 }, (_, i) =>
      ellipsoid(
        [
          s * (1.014 + i * 0.127),
          0.136 + i * 0.003,
          wristZ + 0.153 - 0.017 * (i - 1) ** 2,
        ],
        [0.085, 0.126 - 0.004 * i, 0.126],
        -s * (i - 1) * 0.051,
        -0.44,
      ),
    );
    handsAndFeet.push(
      blendSurfaces(
        0.035,
        ellipsoid(
          [s * 1.195, 0.283, wristZ - 0.007],
          [0.255, 0.244, 0.216],
          -s * 0.055,
          -0.38,
        ),
        ...knuckles,
        ellipsoid(
          [s * 0.995, 0.231, wristZ + 0.036],
          [0.104, 0.154, 0.139],
          -s * 0.3,
          -0.32,
        ),
      ),
    );
    const footZ = 0.31 - s * 0.07;
    handsAndFeet.push(
      blendSurfaces(
        0.038,
        ellipsoid([s * 0.48, 0.205, footZ - 0.035], [0.303, 0.179, 0.344]),
        ellipsoid(
          [s * 0.312, 0.137, footZ + 0.228],
          [0.133, 0.123, 0.211],
          s * 0.13,
        ),
        ...[0, 1, 2].map((i) =>
          ellipsoid(
            [s * (0.469 + i * 0.108), 0.122, footZ + 0.271 - 0.035 * i],
            [0.084, 0.109, 0.151 - i * 0.011],
          ),
        ),
      ),
    );
  }
  const saddle = coat.clone();
  saddle.color.set('#ffffff');
  saddle.vertexColors = true;
  const torso = sculpt(
    body,
    blendSurfaces(0.12, trunk, ...handsAndFeet),
    saddle,
    [-1.72, -0.17, -1.03],
    [1.72, 2.39, 1.09],
    62,
  );
  const positions = torso.geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const silver = new Color('#777b79');
  const palms = new Color('#66615c');
  const shade = new Color();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const x = Math.abs(positions.getX(i));
    const z = positions.getZ(i);
    const back =
      MathUtils.smoothstep(-z, 0.1, 0.64) * MathUtils.smoothstep(y, 0.52, 1.48);
    shade
      .copy(coat.color)
      .lerp(silver, back)
      .lerp(
        palms,
        (1 - MathUtils.smoothstep(y, 0.18, 0.44)) *
          MathUtils.smoothstep(z, 0.23, 0.51) *
          MathUtils.lerp(0.68, 1, MathUtils.smoothstep(x, 0.79, 1.01)),
      )
      .toArray(colors, 3 * i);
  }
  torso.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  // Keep the dark temples proud of the face on the three-quarter view.
  sculpt(
    head,
    blendSurfaces(
      0.13,
      ellipsoid([0, 0.245, -0.08], [0.876, 0.706, 0.66]),
      ellipsoid([0, 0.59, -0.225], [0.476, 0.416, 0.497], 0, -0.14),
      ellipsoid([0, -0.17, 0.055], [0.752, 0.553, 0.558]),
      ...[-1, 1].map((s) =>
        ellipsoid([s * 0.639, -0.039, 0.025], [0.25, 0.411, 0.388], -s * 0.2),
      ),
      ...[-1, 1].map((s) =>
        ellipsoid([s * 0.846, 0.09, -0.075], [0.123, 0.155, 0.125], -s * 0.22),
      ),
    ),
    coat,
    [-1.18, -0.874, -0.91],
    [1.18, 1.22, 0.87],
    52,
  );
  const earSurface = carveSurface(
    ellipsoid([0, 0, 0], [0.144, 0.188, 0.119]),
    ellipsoid([0, 0.012, 0.105], [0.089, 0.127, 0.086], -0.12),
  );
  const earGeometry = sculptSurface(
    blendSurfaces(
      0.027,
      earSurface,
      ellipsoid([-0.038, -0.037, 0.079], [0.052, 0.065, 0.031], 0.3),
    ),
    [-0.19, -0.239, -0.17],
    [0.19, 0.239, 0.17],
    25,
  );
  const earMaterial = new MeshStandardMaterial({
    color: '#746f68',
    roughness: 0.92,
  });
  for (const s of [-1, 1]) {
    const ear = new Mesh(earGeometry, earMaterial);
    ear.position.set(s * 0.932, 0.104, -0.016);
    ear.rotation.set(0.04, s * 0.69, -s * 0.18);
    ear.scale.x = s;
    head.add(ear);
  }

  const faceSurface = blendSurfaces(
    0.093,
    ellipsoid([0, 0.096, 0.529], [0.205, 0.273, 0.187]),
    ...[-1, 1].flatMap((s) => [
      ellipsoid([s * 0.304, 0.187, 0.469], [0.304, 0.209, 0.19], s * 0.09),
      ellipsoid(
        [s * 0.322, 0.287 + 0.012 * s, 0.531],
        [0.283, 0.108, 0.148],
        -s * 0.12,
      ),
      ellipsoid([s * 0.381, -0.025, 0.476], [0.219, 0.252, 0.185], -s * 0.2),
      ellipsoid([s * 0.235, -0.238, 0.655], [0.333, 0.199, 0.242], s * 0.11),
    ]),
    ellipsoid([0, -0.425, 0.52], [0.468, 0.244, 0.299]),
    ellipsoid([0, -0.412, 0.717], [0.316, 0.077, 0.134]),
  );
  sculpt(head, faceSurface, face, [-0.73, -0.8, 0.13], [0.73, 0.58, 1.02], 52);
  // Sample the sculpt itself so the eyes and the tapered smile sit flush.
  function faceDepth(x: number, y: number): number {
    let inside = 0.503;
    let outside = 1.04;
    for (let i = 0; i < 13; i++) {
      const z = (inside + outside) / 2;
      if (faceSurface(x, y, z) < 0) inside = z;
      else outside = z;
    }
    return (inside + outside) / 2;
  }

  const bridge = blendSurfaces(
    0.049,
    ellipsoid([0, 0.003, 0.744], [0.193, 0.125, 0.157]),
    ellipsoid([0, -0.051, 0.796], [0.16, 0.091, 0.145]),
    ...[-1, 1].map((s) =>
      ellipsoid([s * 0.186, -0.034, 0.777], [0.144, 0.1, 0.153], -s * 0.13),
    ),
  );
  sculpt(
    head,
    carveSurface(
      bridge,
      ...[-1, 1].map((s) =>
        ellipsoid(
          [s * 0.166, -0.069, 0.918],
          [0.077, 0.046, 0.081],
          -s * 0.36,
          -0.26,
        ),
      ),
    ),
    nose,
    [-0.428, -0.259, 0.5],
    [0.428, 0.24, 1.05],
    40,
  );

  const smile = new BufferGeometry();
  const lip: number[] = [];
  const triangles: number[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const x = (t - 0.5) * 0.63;
    const y = -0.372 + 0.044 * (2 * t - 1) ** 2 + 0.021 * t;
    const half = 0.01 * Math.sin(Math.PI * t) ** 0.7;
    for (const edge of [y - half, y + half])
      lip.push(x, edge, faceDepth(x, edge) + 0.002);
    if (i > 0) {
      const a = (i - 1) * 2;
      triangles.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  smile.setAttribute('position', new Float32BufferAttribute(lip, 3));
  smile.setIndex(triangles);
  smile.computeVertexNormals();
  head.add(new Mesh(smile, ink));

  return { body, head, setEyes: addEyes(head, faceDepth) };
}
