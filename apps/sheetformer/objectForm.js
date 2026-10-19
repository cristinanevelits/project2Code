const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The default hand scan runs from wrist (minimum Y) toward fingertips.
// Keep the wrist and the near edge of the palm, but not the fingers.
export function objectRegionBounds(mesh, region) {
  const cutoff = region === 'wrist-palm'
    ? mesh.bounds.minY + (mesh.bounds.maxY - mesh.bounds.minY) * 0.46
    : region === 'lower'
      ? mesh.bounds.minY + (mesh.bounds.maxY - mesh.bounds.minY) * 0.32
      : Infinity;
  const selected = mesh.vertices.filter(vertex => vertex[1] <= cutoff);
  if (!selected.length) throw new Error('No vertices in the selected OBJ region');
  const result = { cutoff, minX: Infinity, maxX: -Infinity, minY: Infinity,
    maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const [x, y, z] of selected) {
    result.minX = Math.min(result.minX, x); result.maxX = Math.max(result.maxX, x);
    result.minY = Math.min(result.minY, y); result.maxY = Math.max(result.maxY, y);
    result.minZ = Math.min(result.minZ, z); result.maxZ = Math.max(result.maxZ, z);
  }
  return result;
}

// Rotate around the OBJ's long Y axis (wrist to fingertips). At 180° the
// opposite, palm-side surface faces the sheet instead of the default back.
export function rotateReferenceVertex([x, y, z], degrees, center) {
  const radians = (degrees % 360) * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  const dx = x - center.x, dz = z - center.z;
  return [center.x + dx * cosine + dz * sine, y,
    center.z - dx * sine + dz * cosine];
}

// Top-view caliper widths along the OBJ's long Y axis. The 128 narrow bands
// make the line draggable without rebuilding the expensive forming field.
// These are projected outline widths, not anatomical circumferences.
export function buildWidthProfile(mesh, field, binCount = 128) {
  const { minY, maxY } = mesh.bounds;
  const span = maxY - minY;
  if (!(span > 0)) return [];
  const bins = Array.from({ length: binCount }, () => ({ left: Infinity, right: -Infinity, count: 0 }));
  for (const vertex of mesh.vertices) {
    const index = clamp(Math.floor((vertex[1] - minY) / span * binCount), 0, binCount - 1);
    const x = rotateReferenceVertex(vertex, field.rotationDegrees, field.rotationCenter)[0];
    const bin = bins[index];
    bin.left = Math.min(bin.left, x);
    bin.right = Math.max(bin.right, x);
    bin.count++;
  }
  const minPoints = Math.max(2, Math.floor(mesh.vertices.length / 5000));
  return bins.map((bin, index) => bin.count < minPoints ? null : {
    fraction: (index + 0.5) / binCount,
    y: minY + (index + 0.5) / binCount * span,
    left: bin.left, right: bin.right,
    width: (bin.right - bin.left) * field.scale
  });
}

export function narrowWristSlice(profile) {
  // On the default scan, forearm is low Y and palm begins around 45% of its
  // length. Exclude the cropped forearm end and finger gaps from auto-pick.
  return profile.filter(slice => slice && slice.fraction >= 0.29 && slice.fraction <= 0.46)
    .reduce((best, slice) => !best || slice.width < best.width ? slice : best, null);
}

export function widthSliceAt(profile, fraction) {
  return profile.filter(Boolean).reduce((best, slice) =>
    !best || Math.abs(slice.fraction - fraction) < Math.abs(best.fraction - fraction) ? slice : best, null);
}

// A downward, single-valued forming preview: ray-project the OBJ triangles onto
// the sheet. This cannot model undercuts, plastic strain, or tool collisions.
export function buildObjectField(mesh, { sheet, scale, region, rotationDegrees = 0, resolution = 385 }) {
  const { vertices, faces } = mesh;
  const bounds = objectRegionBounds(mesh, region);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const rotationCenter = { x: midX, z: (bounds.minZ + bounds.maxZ) / 2 };
  const cutoff = bounds.cutoff;
  const xy = vertices.map(vertex => {
    const [x, y, z] = rotateReferenceVertex(vertex, rotationDegrees, rotationCenter);
    return [sheet / 2 + (x - midX) * scale, sheet / 2 + (y - midY) * scale, z];
  });
  const projectedVertices = [];
  const stride = sheet / (resolution - 1);
  const top = new Float32Array(resolution * resolution);
  top.fill(-Infinity);
  let zMin = Infinity, zMax = -Infinity;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < vertices.length; i++) {
    if (vertices[i][1] > cutoff) continue;
    const [x, y, z] = xy[i];
    projectedVertices.push({ x, y, z, sourceIndex: i, raw: vertices[i] });
    zMin = Math.min(zMin, z); zMax = Math.max(zMax, z);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(zMin)) throw new Error('No vertices in the selected OBJ region');
  const yLimit = Number.isFinite(cutoff) ? sheet / 2 + (cutoff - midY) * scale : Infinity;
  const put = (i, j, z) => {
    if (i < 0 || j < 0 || i >= resolution || j >= resolution || j * stride > yLimit) return;
    const index = j * resolution + i;
    if (z > top[index]) top[index] = z;
  };
  for (const [ia, ib, ic] of faces) {
    const a = xy[ia], b = xy[ib], c = xy[ic];
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(det) < 1e-9) continue;
    const loX = clamp(Math.floor(Math.min(a[0], b[0], c[0]) / stride), 0, resolution - 1);
    const hiX = clamp(Math.ceil(Math.max(a[0], b[0], c[0]) / stride), 0, resolution - 1);
    const loY = clamp(Math.floor(Math.min(a[1], b[1], c[1]) / stride), 0, resolution - 1);
    const hiY = clamp(Math.ceil(Math.max(a[1], b[1], c[1]) / stride), 0, resolution - 1);
    for (let j = loY; j <= hiY; j++) {
      const y = j * stride;
      if (y > yLimit) continue;
      for (let i = loX; i <= hiX; i++) {
        const x = i * stride;
        const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
        const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det;
        const w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-7) put(i, j, u * a[2] + v * b[2] + w * c[2]);
      }
    }
  }
  // Preserve thin edges and support vertex-only OBJs too.
  for (let k = 0; k < vertices.length; k++) {
    if (vertices[k][1] > cutoff) continue;
    const [x, y, z] = xy[k];
    put(Math.round(x / stride), Math.round(y / stride), z);
  }
  const distance = new Float32Array(top.length);
  const nearest = new Float32Array(top.length);
  const occupied = [];
  for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
    const k = j * resolution + i;
    if (top[k] > -Infinity) {
      distance[k] = 0; nearest[k] = top[k]; occupied.push({ x: i * stride, y: j * stride, z: top[k] });
    } else distance[k] = Infinity;
  }
  if (!occupied.length) throw new Error('OBJ has no projected surface on the sheet at this scale');
  const adopt = (k, neighbor, step) => {
    const candidate = distance[neighbor] + step;
    if (candidate < distance[k]) { distance[k] = candidate; nearest[k] = nearest[neighbor]; }
  };
  for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
    const k = j * resolution + i;
    if (i) adopt(k, k - 1, stride);
    if (j) adopt(k, k - resolution, stride);
    if (i && j) adopt(k, k - resolution - 1, stride * Math.SQRT2);
    if (i < resolution - 1 && j) adopt(k, k - resolution + 1, stride * Math.SQRT2);
  }
  for (let j = resolution - 1; j >= 0; j--) for (let i = resolution - 1; i >= 0; i--) {
    const k = j * resolution + i;
    if (i < resolution - 1) adopt(k, k + 1, stride);
    if (j < resolution - 1) adopt(k, k + resolution, stride);
    if (i < resolution - 1 && j < resolution - 1) adopt(k, k + resolution + 1, stride * Math.SQRT2);
    if (i && j < resolution - 1) adopt(k, k + resolution - 1, stride * Math.SQRT2);
  }
  return { sheet, resolution, stride, top, distance, nearest, occupied, projectedVertices, zMin, zMax, bounds, scale,
    rotationDegrees, rotationCenter,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    footprint: occupied.length * stride * stride };
}

export function sampleObjectField(field, x, y) {
  if (x < 0 || y < 0 || x > field.sheet || y > field.sheet) {
    return { distance: Infinity, height: field.zMin };
  }
  const u = clamp(x / field.stride, 0, field.resolution - 1);
  const v = clamp(y / field.stride, 0, field.resolution - 1);
  const i = Math.floor(u), j = Math.floor(v);
  const i2 = Math.min(i + 1, field.resolution - 1), j2 = Math.min(j + 1, field.resolution - 1);
  const tx = u - i, ty = v - j;
  const blend = array => {
    const a = array[j * field.resolution + i] * (1 - tx) + array[j * field.resolution + i2] * tx;
    const b = array[j2 * field.resolution + i] * (1 - tx) + array[j2 * field.resolution + i2] * tx;
    return a * (1 - ty) + b * ty;
  };
  const corners = [
    [j * field.resolution + i, (1 - tx) * (1 - ty)],
    [j * field.resolution + i2, tx * (1 - ty)],
    [j2 * field.resolution + i, (1 - tx) * ty],
    [j2 * field.resolution + i2, tx * ty]
  ];
  let total = 0, surface = 0;
  for (const [index, weight] of corners) {
    if (field.top[index] === -Infinity) continue;
    surface += field.top[index] * weight;
    total += weight;
  }
  return { distance: blend(field.distance), height: total > 0 ? surface / total : blend(field.nearest) };
}

export function chooseIndentTargets(field, count, center, width, length, clampInset) {
  if (count <= 0) return [];
  const candidates = field.projectedVertices.filter(p =>
    p.x > clampInset + 12 && p.x < field.sheet - clampInset - 12 &&
    p.y > clampInset + 12 && p.y < field.sheet - clampInset - 12 &&
    Math.abs(p.x - center.x) < width * .48 && Math.abs(p.y - center.y) < length * .48 &&
    p.z >= sampleObjectField(field, p.x, p.y).height - 0.15);
  if (!candidates.length) return [];
  const targets = [candidates.reduce((best, p) =>
    Math.hypot(p.x - center.x, p.y - center.y) <
    Math.hypot(best.x - center.x, best.y - center.y) ? p : best)];
  while (targets.length < count) {
    let best = null, bestScore = 0;
    for (const p of candidates) {
      const spread = Math.min(...targets.map(t => Math.hypot(p.x - t.x, p.y - t.y)));
      if (spread < 11) continue;
      const relief = clamp((p.z - field.zMin) / Math.max(.001, field.zMax - field.zMin), 0, 1);
      const score = spread * (.85 + .15 * relief);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (!best) break;
    targets.push(best);
  }
  return targets.map(({ x, y, z, sourceIndex, raw }) => ({ x, y, z, sourceIndex, raw }));
}

export function reprojectIndentTargets(field, sourceIndices) {
  const projected = new Map(field.projectedVertices.map(point => [point.sourceIndex, point]));
  return sourceIndices.map(index => projected.get(index)).filter(Boolean);
}
