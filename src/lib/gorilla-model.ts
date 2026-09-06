import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  blendSurfaces,
  carveSurface,
  ellipsoid,
  sculptSurface,
  type Point,
  type Surface,
} from './gorilla-geometry';

function furGrain(): DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 317;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const strand = Math.sin(x * 1.7 + Math.sin(y * 0.12) * 1.5);
      const shade = Math.round(
        128 + strand * 24 + (seed / 4294967296 - 0.5) * 35,
      );
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = shade;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

export function createGorilla() {
  const body = new Group();
  const head = new Group();
  head.position.set(0, 0.81, 0.02);
  body.add(head);
  const grain = furGrain();
  const fur = new MeshPhysicalMaterial({
    color: '#30383b',
    roughness: 0.9,
    sheen: 0.65,
    sheenColor: '#9ba59b',
    sheenRoughness: 0.85,
    bumpMap: grain,
    bumpScale: 0.022,
  });
  const silverback = fur.clone();
  silverback.color.set('#ffffff');
  silverback.vertexColors = true;
  const skin = new MeshStandardMaterial({ color: '#625d55', roughness: 0.82 });
  const skinLight = new MeshStandardMaterial({
    color: '#736b5f',
    roughness: 0.8,
  });
  const skinDark = new MeshStandardMaterial({
    color: '#41423e',
    roughness: 0.84,
  });
  const noseMaterial = new MeshPhysicalMaterial({
    color: '#30332f',
    roughness: 0.6,
    clearcoat: 0.15,
  });
  const crease = new MeshStandardMaterial({ color: '#242825', roughness: 0.9 });
  const eyeWhite = new MeshStandardMaterial({
    color: '#bbb39e',
    roughness: 0.4,
  });
  const iris = new MeshPhysicalMaterial({
    color: '#8d693b',
    roughness: 0.32,
    clearcoat: 0.5,
  });
  const pupil = new MeshPhysicalMaterial({
    color: '#171b17',
    roughness: 0.2,
    clearcoat: 1,
  });
  const catchlight = new MeshStandardMaterial({
    color: '#fff4d5',
    emissive: '#bdbba5',
    emissiveIntensity: 0.3,
  });
  const cover = new MeshStandardMaterial({ color: '#a95b38', roughness: 0.78 });
  const paper = new MeshStandardMaterial({ color: '#d2c5aa', roughness: 0.95 });
  const binding = new MeshStandardMaterial({
    color: '#74452e',
    roughness: 0.85,
  });
  const sphere = new SphereGeometry(1, 24, 16);
  const detailSphere = new SphereGeometry(1, 12, 8);
  const sourceGeometries = new Set<BufferGeometry>([sphere, detailSphere]);

  function mesh(
    parent: Group,
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    position: Point = [0, 0, 0],
  ) {
    sourceGeometries.add(geometry);
    const object = new Mesh(geometry, material);
    object.position.set(...position);
    parent.add(object);
    return object;
  }

  function oval(
    parent: Group,
    material: MeshStandardMaterial,
    position: Point,
    scale: Point,
    roll = 0,
  ) {
    const geometry = Math.max(...scale) < 0.1 ? detailSphere : sphere;
    const object = mesh(parent, geometry, material, position);
    object.scale.set(...scale);
    object.rotation.z = roll;
    return object;
  }

  function stroke(
    parent: Group,
    material: MeshStandardMaterial,
    points: Point[],
    radius: number,
  ) {
    return mesh(
      parent,
      new TubeGeometry(
        new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
        16,
        radius,
        6,
        false,
      ),
      material,
    );
  }

  function sculpture(
    parent: Group,
    material: MeshStandardMaterial,
    surface: Surface,
    minimum: Point,
    maximum: Point,
    resolution: number,
  ) {
    return mesh(
      parent,
      sculptSurface(surface, minimum, maximum, resolution),
      material,
    );
  }

  const torso = sculpture(
    body,
    silverback,
    blendSurfaces(
      0.3,
      ellipsoid([0, -0.48, -0.15], [0.96, 1.03, 0.68]),
      ellipsoid([0, -1.27, -0.05], [0.78, 0.61, 0.63]),
      ellipsoid([0, 0.25, -0.03], [0.63, 0.6, 0.57]),
      ellipsoid([-0.62, -0.06, -0.11], [0.64, 0.63, 0.58], -0.24),
      ellipsoid([0.62, -0.06, -0.11], [0.6, 0.61, 0.58], 0.24),
      ellipsoid([-1.0, -0.45, 0.0], [0.47, 0.7, 0.48], -0.16),
      ellipsoid([-1.15, -0.99, 0.19], [0.39, 0.43, 0.41]),
      ellipsoid([-0.84, -1.15, 0.59], [0.62, 0.32, 0.34], -0.14),
      ellipsoid([-0.5, -1.49, 0.07], [0.43, 0.48, 0.5]),
      ellipsoid([0.5, -1.49, 0.07], [0.43, 0.48, 0.5]),
    ),
    [-1.78, -2.19, -1.12],
    [1.61, 1.1, 1.18],
    52,
  );

  const positions = torso.geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const charcoal = new Color('#30383b');
  const silver = new Color('#798177');
  const chestColor = new Color('#53554d');
  const shade = new Color();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const saddle =
      MathUtils.smoothstep(-positions.getZ(vertex), 0.17, 0.66) *
      (1 -
        MathUtils.smoothstep(
          Math.abs(positions.getY(vertex) + 0.33),
          0.45,
          1.05,
        ));
    shade.copy(charcoal).lerp(silver, saddle * 0.85);
    const chest =
      MathUtils.smoothstep(positions.getZ(vertex), 0.3, 0.54) *
      (1 - MathUtils.smoothstep(Math.abs(positions.getX(vertex)), 0.46, 0.77)) *
      (1 -
        MathUtils.smoothstep(
          Math.abs(positions.getY(vertex) + 0.35),
          0.3,
          0.63,
        ));
    shade.lerp(chestColor, chest * 0.4);
    shade.toArray(colors, vertex * 3);
  }
  torso.geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const sockets = [-1, 1].map((side) =>
    ellipsoid([side * 0.315, 0.205, 0.685], [0.215, 0.146, 0.25]),
  );
  sculpture(
    head,
    fur,
    carveSurface(
      blendSurfaces(
        0.2,
        ellipsoid([0, 0.18, -0.06], [0.83, 0.78, 0.7]),
        ellipsoid([0, -0.38, 0.11], [0.65, 0.57, 0.56]),
        ellipsoid([-0.61, -0.04, 0], [0.32, 0.55, 0.45]),
        ellipsoid([0.61, -0.04, 0], [0.32, 0.55, 0.45]),
        ellipsoid([0, 0.79, -0.15], [0.3, 0.21, 0.34]),
        ...[-1, 1].flatMap((side) => [
          ellipsoid([side * 0.73, -0.24, 0.01], [0.14, 0.26, 0.31], side * 0.5),
          ellipsoid([side * 0.59, -0.54, 0.12], [0.14, 0.24, 0.3], side * 0.4),
        ]),
      ),
      ...sockets,
    ),
    [-1.16, -1.12, -1],
    [1.16, 1.5, 1.04],
    48,
  );

  sculpture(
    head,
    skin,
    carveSurface(
      blendSurfaces(
        0.13,
        ellipsoid([-0.31, 0.39, 0.515], [0.34, 0.155, 0.25], 0.12),
        ellipsoid([0.31, 0.355, 0.515], [0.34, 0.155, 0.25], -0.015),
        ellipsoid([0, 0.155, 0.595], [0.185, 0.3, 0.25]),
        ellipsoid([-0.44, -0.17, 0.485], [0.215, 0.3, 0.25]),
        ellipsoid([0.44, -0.17, 0.485], [0.215, 0.3, 0.25]),
        ellipsoid([0, -0.22, 0.655], [0.465, 0.295, 0.27]),
        ellipsoid([0, -0.47, 0.56], [0.455, 0.245, 0.3]),
      ),
      ...sockets,
    ),
    [-0.9, -0.93, 0.15],
    [0.9, 0.76, 1.15],
    48,
  );

  sculpture(
    head,
    noseMaterial,
    carveSurface(
      blendSurfaces(
        0.07,
        ellipsoid([0, -0.025, 0.795], [0.32, 0.163, 0.19]),
        ellipsoid([-0.2, -0.065, 0.805], [0.16, 0.115, 0.14]),
        ellipsoid([0.2, -0.065, 0.805], [0.16, 0.115, 0.14]),
      ),
      ...[-1, 1].map((side) =>
        ellipsoid(
          [side * 0.14, -0.076, 0.965],
          [0.073, 0.052, 0.079],
          side * 0.2,
        ),
      ),
    ),
    [-0.52, -0.29, 0.54],
    [0.52, 0.24, 1.16],
    32,
  );
  for (const side of [-1, 1])
    oval(
      head,
      crease,
      [side * 0.14, -0.074, 0.92],
      [0.058, 0.039, 0.027],
      side * 0.2,
    );
  oval(head, skinLight, [0.012, -0.459, 0.729], [0.32, 0.072, 0.143]);
  stroke(
    head,
    crease,
    [
      [-0.357, -0.37, 0.813],
      [-0.19, -0.412, 0.894],
      [0.02, -0.418, 0.912],
      [0.21, -0.39, 0.877],
      [0.36, -0.326, 0.81],
    ],
    0.015,
  );
  for (const side of [-1, 1]) {
    stroke(
      head,
      skinDark,
      [
        [side * 0.39, -0.3, 0.79],
        [side * 0.425, -0.355, 0.749],
        [side * 0.41, -0.41, 0.728],
      ],
      0.01,
    );
  }

  const eyes: { globe: Group; lid: Group }[] = [];
  for (const side of [-1, 1]) {
    const eye = new Group();
    eye.position.set(side * 0.315, 0.205, 0.688);
    head.add(eye);
    oval(eye, eyeWhite, [0, 0, 0], [0.132, 0.085, 0.096]);
    oval(eye, iris, [-side * 0.013, -0.007, 0.076], [0.071, 0.073, 0.03]);
    oval(eye, pupil, [-side * 0.013, -0.005, 0.1], [0.036, 0.042, 0.013]);
    oval(
      eye,
      catchlight,
      [-0.025 - side * 0.013, 0.024, 0.115],
      [0.012, 0.014, 0.007],
    );
    oval(
      eye,
      catchlight,
      [0.018 - side * 0.013, -0.027, 0.113],
      [0.006, 0.007, 0.005],
    );
    const eyelid = new Group();
    eyelid.position.copy(eye.position);
    eyelid.visible = false;
    head.add(eyelid);
    eyes.push({ globe: eye, lid: eyelid });
    oval(eyelid, skinDark, [0, 0, 0.09], [0.163, 0.106, 0.044]);
    stroke(
      eyelid,
      crease,
      [
        [-0.12, -0.019, 0.121],
        [0, -0.032, 0.14],
        [0.12, -0.019, 0.121],
      ],
      0.006,
    );
    stroke(
      head,
      skinDark,
      [
        [side * 0.315 - 0.155, 0.205, 0.707],
        [side * 0.315 - 0.087, 0.292, 0.767],
        [side * 0.315 + 0.07, 0.294, 0.775],
        [side * 0.315 + 0.155, 0.205, 0.707],
      ],
      0.018,
    );

    const ear = new Group();
    ear.position.set(side * 0.836, 0.1, -0.015);
    ear.rotation.y = side * 0.42;
    head.add(ear);
    oval(ear, skinDark, [0, 0, 0], [0.188, 0.254, 0.13]);
    oval(ear, skin, [0, 0.018, 0.088], [0.12, 0.172, 0.059]);
    oval(ear, crease, [-side * 0.025, 0.012, 0.13], [0.066, 0.116, 0.016]);
    stroke(
      ear,
      skinLight,
      [
        [side * 0.014, -0.11, 0.137],
        [side * 0.067, -0.013, 0.151],
        [side * 0.063, 0.099, 0.135],
        [-side * 0.035, 0.129, 0.125],
      ],
      0.024,
    );
  }

  const rightArm = new Group();
  rightArm.position.set(0.99, -0.18, 0);
  body.add(rightArm);
  sculpture(
    rightArm,
    fur,
    blendSurfaces(
      0.19,
      ellipsoid([0, -0.03, 0], [0.475, 0.535, 0.5]),
      ellipsoid([0.15, -0.34, 0.025], [0.35, 0.56, 0.36], 0.16),
      ellipsoid([0.2, -0.65, 0.06], [0.3, 0.32, 0.3]),
    ),
    [-0.7, -1.1, -0.7],
    [0.79, 0.74, 0.72],
    36,
  );
  const rightForearm = new Group();
  rightForearm.position.set(0.2, -0.65, 0.06);
  rightArm.add(rightForearm);
  sculpture(
    rightForearm,
    fur,
    blendSurfaces(
      0.15,
      ellipsoid([0, 0, 0], [0.32, 0.32, 0.31]),
      ellipsoid([-0.047, -0.31, 0.11], [0.305, 0.46, 0.3], -0.12),
    ),
    [-0.58, -0.99, -0.5],
    [0.52, 0.52, 0.65],
    36,
  );

  function hand(parent: Group, position: Point, side: number, roll = 0) {
    const palm = new Group();
    palm.position.set(...position);
    palm.rotation.z = roll;
    parent.add(palm);
    oval(palm, skinDark, [0, 0, 0], [0.237, 0.24, 0.15]);
    oval(palm, skin, [0, -0.075, 0.075], [0.21, 0.19, 0.09]);
    for (let finger = 0; finger < 4; finger++) {
      const x = -0.145 + finger * 0.096;
      const length = 0.24 + Math.sin((finger / 3) * Math.PI) * 0.05;
      stroke(
        palm,
        skin,
        [
          [x, -0.08, 0.06],
          [x, -0.22, 0.145],
          [x, -length - 0.07, 0.128],
          [x, -length - 0.1, 0.065],
        ],
        0.046,
      );
      oval(palm, skin, [x, -length - 0.1, 0.065], [0.046, 0.046, 0.046]);
      oval(palm, skinDark, [x, -0.17, 0.162], [0.032, 0.015, 0.006]);
      oval(
        palm,
        noseMaterial,
        [x, -length - 0.05, 0.151],
        [0.029, 0.045, 0.014],
      );
    }
    stroke(
      palm,
      skin,
      [
        [-side * 0.18, 0.06, 0.02],
        [-side * 0.268, -0.049, 0.15],
        [-side * 0.21, -0.18, 0.171],
      ],
      0.069,
    );
    oval(palm, skin, [-side * 0.21, -0.18, 0.171], [0.069, 0.069, 0.069]);
    oval(
      palm,
      noseMaterial,
      [-side * 0.211, -0.173, 0.22],
      [0.04, 0.044, 0.009],
      side * 0.3,
    );
    return palm;
  }
  hand(rightForearm, [-0.095, -0.67, 0.225], 1, -0.1);
  hand(body, [-0.616, -0.91, 1.01], -1, -0.21);

  for (const side of [-1, 1]) {
    oval(
      body,
      skinDark,
      [side * 0.49, -1.91, 0.34],
      [0.325, 0.16, 0.49],
      side * -0.12,
    );
    for (let toe = 0; toe < 4; toe++) {
      const x = side * (0.29 + toe * 0.105);
      const z = 0.714 - toe * 0.028;
      oval(body, skin, [x, -1.93, z], [0.067, 0.115, 0.165]);
      const nail = oval(
        body,
        noseMaterial,
        [x, -1.898, z + 0.135],
        [0.043, 0.017, 0.046],
      );
      nail.rotation.x = 0.24;
    }
    oval(
      body,
      skin,
      [side * 0.2, -1.935, 0.46],
      [0.1, 0.11, 0.18],
      side * 0.36,
    );
  }

  const notebook = new Group();
  notebook.position.set(-0.185, -1.04, 0.962);
  notebook.rotation.set(-0.075, -0.16, -0.105);
  body.add(notebook);
  mesh(notebook, new RoundedBoxGeometry(0.76, 0.96, 0.11, 3, 0.032), paper);
  const coverGeometry = new RoundedBoxGeometry(0.805, 1.0, 0.035, 3, 0.018);
  mesh(notebook, coverGeometry, cover, [0, 0, 0.073]);
  mesh(notebook, coverGeometry, cover, [0, 0, -0.073]);
  mesh(
    notebook,
    new RoundedBoxGeometry(0.075, 1.0, 0.17, 3, 0.025),
    binding,
    [-0.379, 0, 0],
  );
  mesh(
    notebook,
    new RoundedBoxGeometry(0.027, 0.995, 0.016, 2, 0.007),
    binding,
    [0.235, 0, 0.095],
  );
  stroke(
    notebook,
    paper,
    [
      [-0.145, 0.115, 0.099],
      [-0.235, 0.035, 0.099],
      [-0.145, -0.045, 0.099],
    ],
    0.013,
  );
  stroke(
    notebook,
    paper,
    [
      [0.065, 0.115, 0.099],
      [0.155, 0.035, 0.099],
      [0.065, -0.045, 0.099],
    ],
    0.013,
  );
  stroke(
    notebook,
    paper,
    [
      [0.022, 0.14, 0.1],
      [-0.065, -0.08, 0.1],
    ],
    0.011,
  );
  mesh(
    notebook,
    new RoundedBoxGeometry(0.06, 0.18, 0.012, 2, 0.005),
    cover,
    [0.08, -0.53, 0.01],
  );

  // Bake static parts per joint and material, leaving the eyes and greeting arm articulated.
  const joints: Group[] = [];
  body.traverse((object) => {
    if (object instanceof Group) joints.push(object);
  });
  for (const joint of joints) {
    const batches = new Map<Material, BufferGeometry[]>();
    for (const part of [...joint.children]) {
      if (!(part instanceof Mesh)) continue;
      part.updateMatrix();
      const material = part.material as Material;
      const geometry = (
        part.geometry.index
          ? part.geometry.toNonIndexed()
          : part.geometry.clone()
      ).applyMatrix4(part.matrix);
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(geometry);
      joint.remove(part);
    }
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries);
      joint.add(new Mesh(geometry, material));
      for (const source of geometries) source.dispose();
    }
  }
  for (const geometry of sourceGeometries) geometry.dispose();

  return { body, head, eyes, rightArm, rightForearm };
}
