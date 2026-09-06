import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
} from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export type Point = [number, number, number];
export type Surface = (x: number, y: number, z: number) => number;

export function ellipsoid(center: Point, radii: Point, roll = 0): Surface {
  const [cx, cy, cz] = center;
  const [rx, ry, rz] = radii;
  const radius = Math.min(...radii);
  const cosine = Math.cos(roll);
  const sine = Math.sin(roll);
  return (x, y, z) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = (dx * cosine + dy * sine) / rx;
    const v = (dy * cosine - dx * sine) / ry;
    const w = (z - cz) / rz;
    return (Math.sqrt(u * u + v * v + w * w) - 1) * radius;
  };
}

export function blendSurfaces(width: number, ...surfaces: Surface[]): Surface {
  return (x, y, z) => {
    let distance = surfaces[0](x, y, z);
    for (let index = 1; index < surfaces.length; index++) {
      const next = surfaces[index](x, y, z);
      const overlap = Math.max(width - Math.abs(distance - next), 0) / width;
      distance = Math.min(distance, next) - overlap * overlap * width * 0.25;
    }
    return distance;
  };
}

export function carveSurface(surface: Surface, ...cutouts: Surface[]): Surface {
  return (x, y, z) => {
    let distance = surface(x, y, z);
    for (const cutout of cutouts)
      distance = Math.max(distance, -cutout(x, y, z));
    return distance;
  };
}

export function sculptSurface(
  surface: Surface,
  minimum: Point,
  maximum: Point,
  resolution: number,
): BufferGeometry {
  const material = new MeshBasicMaterial();
  const triangleBudget = 40000;
  const volume = new MarchingCubes(
    resolution,
    material,
    false,
    false,
    triangleBudget,
  );
  volume.isolation = 0;
  const size = minimum.map((value, index) => maximum[index] - value);
  for (let z = 0; z < resolution; z++) {
    const pz = minimum[2] + (z / resolution) * size[2];
    for (let y = 0; y < resolution; y++) {
      const py = minimum[1] + (y / resolution) * size[1];
      for (let x = 0; x < resolution; x++) {
        const px = minimum[0] + (x / resolution) * size[0];
        volume.field[x + resolution * (y + resolution * z)] = -surface(
          px,
          py,
          pz,
        );
      }
    }
  }
  volume.update();
  if (volume.count > triangleBudget * 3) {
    volume.geometry.dispose();
    material.dispose();
    throw new Error('Gorilla sculpture exceeds its geometry budget.');
  }

  // Keep only the extracted surface; the sampling volume is not needed by the renderer.
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      volume.geometry.getAttribute('position').array.slice(0, volume.count * 3),
      3,
    ),
  );
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(
      volume.geometry.getAttribute('normal').array.slice(0, volume.count * 3),
      3,
    ),
  );
  geometry.scale(size[0] / 2, size[1] / 2, size[2] / 2);
  geometry.translate(
    minimum[0] + size[0] / 2,
    minimum[1] + size[1] / 2,
    minimum[2] + size[2] / 2,
  );
  volume.geometry.dispose();
  material.dispose();

  const positions = geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  const centerX = (minimum[0] + maximum[0]) / 2;
  const centerZ = (minimum[2] + maximum[2]) / 2;
  for (let vertex = 0; vertex < positions.count; vertex++) {
    uv[vertex * 2] =
      Math.atan2(
        positions.getZ(vertex) - centerZ,
        positions.getX(vertex) - centerX,
      ) /
        (Math.PI * 2) +
      0.5;
    uv[vertex * 2 + 1] = (positions.getY(vertex) - minimum[1]) / size[1];
  }
  // Unwrap triangles crossing the back seam instead of stretching their texture across it.
  for (let vertex = 0; vertex < positions.count; vertex += 3) {
    const offsets = [vertex * 2, (vertex + 1) * 2, (vertex + 2) * 2];
    if (
      Math.max(...offsets.map((offset) => uv[offset])) -
        Math.min(...offsets.map((offset) => uv[offset])) >
      0.5
    ) {
      for (const offset of offsets) if (uv[offset] < 0.5) uv[offset] += 1;
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  return geometry;
}
