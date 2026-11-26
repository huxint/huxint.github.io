import {
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';

const width = 0.14;
const height = 0.12;
const depth = 0.08;

// A small amber iris with a dark limbal ring, seen through the lid opening.
function eyeMap(): DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const color = new Color();
  const white = new Color('#6b6459');
  const ring = new Color('#39322b');
  const amber = new Color('#5a4839');
  const pupil = new Color('#202120');
  const reflection = new Color('#e5e1d6');
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((2 * (i + 0.5)) / size - 1) * width;
      const y = ((2 * (j + 0.5)) / size - 1) * height;
      const r = Math.hypot(x, y);
      color.copy(white).lerp(ring, 1 - MathUtils.smoothstep(r, 0.093, 0.103));
      color.lerp(
        amber,
        (1 - MathUtils.smoothstep(r, 0.079, 0.093)) * (0.62 - 2.7 * y),
      );
      color.lerp(pupil, 1 - MathUtils.smoothstep(r, 0.061, 0.067));
      const catchlight = Math.hypot((x + 0.03) / 0.016, (y - 0.031) / 0.02);
      color.lerp(reflection, 1 - MathUtils.smoothstep(catchlight, 0.52, 1));
      color.convertLinearToSRGB();
      const at = (j * size + i) * 4;
      pixels[at] = Math.round(255 * color.r);
      pixels[at + 1] = Math.round(255 * color.g);
      pixels[at + 2] = Math.round(255 * color.b);
      pixels[at + 3] = 255;
    }
  }
  const map = new DataTexture(pixels, size, size);
  map.colorSpace = SRGBColorSpace;
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

// Each eyelid follows the globe all the way to the closed pose. The outer
// edge stays tucked into the socket while the free edge meets the other lid.
function eyePatch(part: 'globe' | 'upper' | 'lower') {
  const columns = 32;
  const rows = 12;
  const lid = part !== 'globe';
  const upper = part === 'upper';
  const open = upper ? 0.85 : -0.51;
  const seam = upper ? -0.198 : -0.184;
  const outer = (upper ? 1 : -1) * Math.PI * 0.64;
  const skin = new Color(upper ? '#837d73' : '#888175');
  const edge = new Color(upper ? '#5d584f' : '#746d63');
  const shade = new Color();
  const uv: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const geometry = new BufferGeometry();
  function surface(closure: number) {
    const positions: number[] = [];
    const normals: number[] = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const rim = upper ? v : 1 - v;
      const angle = lid
        ? MathUtils.lerp(MathUtils.lerp(open, seam, closure), outer, rim)
        : (v - 0.5) * Math.PI;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      for (let i = 0; i <= columns; i++) {
        const longitude = (i / columns) * Math.PI;
        const x = -Math.cos(longitude);
        const section = Math.sin(longitude);
        const y = section * sin;
        const z = section * cos;
        positions.push(
          width * x * (lid ? 1.025 + 0.045 * rim : 1),
          height * y * (lid ? 1.055 + 0.11 * rim : 1),
          depth * z + (lid ? 0.006 * section : 0),
        );
        const length = Math.hypot(x / width, y / height, z / depth);
        normals.push(
          x / width / length,
          y / height / length,
          z / depth / length,
        );
        if (closure !== 0) continue;
        if (lid)
          shade
            .copy(skin)
            .lerp(edge, (1 - MathUtils.smoothstep(rim, 0, 0.22)) * section)
            .toArray(colors, colors.length);
        else uv.push(0.5 + x * 0.5, 0.5 + y * 0.5);
        if (i === columns || j === rows) continue;
        const a = j * (columns + 1) + i;
        indices.push(
          a,
          a + 1,
          a + columns + 1,
          a + 1,
          a + columns + 2,
          a + columns + 1,
        );
      }
    }
    return {
      position: new Float32BufferAttribute(positions, 3),
      normal: new Float32BufferAttribute(normals, 3),
    };
  }
  const rest = surface(0);
  geometry.setIndex(indices);
  geometry.setAttribute('position', rest.position);
  geometry.setAttribute('normal', rest.normal);
  if (lid) {
    // An intermediate shape keeps the lid outside the spherical cornea mid-blink.
    const halfShut = surface(0.5);
    const shut = surface(1);
    geometry.morphAttributes.position = [halfShut.position, shut.position];
    geometry.morphAttributes.normal = [halfShut.normal, shut.normal];
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  } else geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

export function addEyes(
  head: Group,
  faceDepth: (x: number, y: number) => number,
) {
  const map = eyeMap();
  const cornea = new MeshStandardMaterial({ map, roughness: 0.42 });
  const skin = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
  });
  const globe = eyePatch('globe');
  const upper = eyePatch('upper');
  const lower = eyePatch('lower');
  const lids: Mesh[] = [];
  for (const side of [-1, 1]) {
    const socket = new Group();
    const x = side * 0.309;
    const y = 0.147 + side * 0.008;
    const slope = (faceDepth(x + 0.01, y) - faceDepth(x - 0.01, y)) / 0.02;
    const verticalSlope =
      (faceDepth(x, y + 0.01) - faceDepth(x, y - 0.01)) / 0.02;
    socket.position.set(x, y, faceDepth(x, y) - 0.042);
    socket.rotation.set(
      Math.atan(verticalSlope),
      -Math.atan(slope),
      side * 0.045,
    );
    socket.add(new Mesh(globe, cornea));
    for (const shape of [upper, lower]) {
      const lid = new Mesh(shape, skin);
      socket.add(lid);
      lids.push(lid);
    }
    head.add(socket);
  }
  return (closure: number, gazeX: number, gazeY: number) => {
    for (const lid of lids) {
      const weights = lid.morphTargetInfluences!;
      weights[0] = 1 - Math.abs(2 * closure - 1);
      weights[1] = Math.max(0, 2 * closure - 1);
    }
    map.offset.set(-gazeX, -gazeY);
  };
}
