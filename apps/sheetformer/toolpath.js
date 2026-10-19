const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function normalizedContour(line, closeTolerance) {
  if (line.length < 2) return null;
  const closed = distance(line[0], line[line.length - 1]) <= closeTolerance;
  const points = closed ? line.slice(0, -1) : line.slice();
  return points.length < 2 ? null : { points, closed, z: points[0].z };
}

function candidatePairs(a, b) {
  const strideA = Math.max(1, Math.ceil(a.length / 80));
  const strideB = Math.max(1, Math.ceil(b.length / 80));
  const coarse = [];
  for (let i = 0; i < a.length; i += strideA) {
    for (let j = 0; j < b.length; j += strideB) {
      coarse.push({ i, j, gap: distance(a[i], b[j]) });
    }
  }
  coarse.sort((x, y) => x.gap - y.gap);
  const refined = new Map();
  for (const pair of coarse.slice(0, 24)) {
    for (let di = -strideA; di <= strideA; di++) {
      for (let dj = -strideB; dj <= strideB; dj++) {
        const i = (pair.i + di + a.length) % a.length;
        const j = (pair.j + dj + b.length) % b.length;
        const key = `${i}:${j}`;
        if (!refined.has(key)) refined.set(key, { i, j, gap: distance(a[i], b[j]) });
      }
    }
  }
  return [...refined.values()].sort((x, y) => x.gap - y.gap).slice(0, 48);
}

function gridBreaks(from, to, axes) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const breaks = [0, 1];
  for (const value of axes) {
    if (Math.abs(dx) > 1e-9) {
      const t = (value - from.x) / dx;
      if (t > 1e-8 && t < 1 - 1e-8) breaks.push(t);
    }
    if (Math.abs(dy) > 1e-9) {
      const t = (value - from.y) / dy;
      if (t > 1e-8 && t < 1 - 1e-8) breaks.push(t);
    }
  }
  breaks.sort((a, b) => a - b);
  const cellAt = value => {
    let low = 0, high = axes.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (axes[mid] <= value) low = mid; else high = mid;
    }
    return low;
  };
  // The mesh splits each grid square along its a-c diagonal (u = v).
  // Add that crossing too: the surface is planar between consecutive breaks.
  const cellBreaks = [];
  for (let k = 0; k < breaks.length - 1; k++) {
    const mid = (breaks[k] + breaks[k + 1]) / 2;
    const i = cellAt(from.x + dx * mid), j = cellAt(from.y + dy * mid);
    const sx = axes[i + 1] - axes[i], sy = axes[j + 1] - axes[j];
    const slope = dx / sx - dy / sy;
    if (Math.abs(slope) < 1e-9) continue;
    const t = ((from.y - axes[j]) / sy - (from.x - axes[i]) / sx) / slope;
    if (t > breaks[k] + 1e-8 && t < breaks[k + 1] - 1e-8) cellBreaks.push(t);
  }
  return [...breaks, ...cellBreaks].sort((a, b) => a - b)
    .filter((t, index, all) => index === 0 || t - all[index - 1] > 1e-8);
}

// A feed link follows the piecewise-planar mesh, including every grid and
// triangle boundary. No straight chord may pass through an intervening face.
export function traceSurfaceBridge(from, to, sampleSurface, axes) {
  if (to.z >= from.z - 1e-4) return null;
  const fallbackSteps = Math.max(2, Math.ceil(distance(from, to) / 1.25));
  const times = axes?.length > 1 ? gridBreaks(from, to, axes)
    : Array.from({ length: fallbackSteps + 1 }, (_, step) => step / fallbackSteps);
  const path = [];
  let previousZ = from.z;
  for (const t of times.slice(1, -1)) {
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = sampleSurface(x, y);
    // A ridge requires a retract; interpolation noise up to 0.05 mm is tolerated.
    if (!Number.isFinite(z) || z > previousZ + 0.05 || z > -0.05) return null;
    path.push({ x, y, z });
    previousZ = z;
  }
  if (to.z > previousZ + 0.05) return null;
  path.push(to);
  return path;
}

function findConnection(from, to, sampleSurface, axes) {
  for (const pair of candidatePairs(from.points, to.points)) {
    const bridge = traceSurfaceBridge(from.points[pair.i], to.points[pair.j], sampleSurface, axes);
    if (bridge) return { ...pair, bridge };
  }
  return null;
}

// Join only downward, on-surface links. Each chain is one contiguous island
// traversal; the initial approach/final retract and inter-island moves jog.
export function routeContours(contours, { sampleSurface, axes, closeTolerance = 0.1, jogHeight = 100 }) {
  const nodes = contours.map(line => normalizedContour(line, closeTolerance)).filter(Boolean);
  const remaining = new Set(nodes.map((_, index) => index));
  const chains = [];
  while (remaining.size) {
    const start = [...remaining].reduce((best, index) =>
      best === null || nodes[index].z > nodes[best].z ? index : best, null);
    remaining.delete(start);
    const chain = [{ index: start, incoming: null, outgoing: null }];
    while (true) {
      const current = chain[chain.length - 1];
      const parent = nodes[current.index];
      if (!parent.closed) break;
      const candidates = [...remaining].filter(index => nodes[index].closed && nodes[index].z < parent.z - 1e-4)
        .sort((a, b) => nodes[b].z - nodes[a].z);
      let selected = null;
      for (const index of candidates) {
        const connection = findConnection(parent, nodes[index], sampleSurface, axes);
        if (!connection) continue;
        selected = { index, connection };
        break;
      }
      if (!selected) break;
      current.outgoing = selected.connection;
      chain.push({ index: selected.index, incoming: selected.connection.j, outgoing: null });
      remaining.delete(selected.index);
    }
    chains.push(chain);
  }

  const points = [];
  const feed = point => points.push({ ...point, move: 'feed' });
  const emitLoop = (node, start) => {
    const end = node.closed ? node.points.length : node.points.length - start - 1;
    for (let offset = 0; offset <= end; offset++) {
      const index = node.closed ? (start + offset) % node.points.length : start + offset;
      feed(node.points[index]);
    }
  };
  for (const chain of chains) {
    const first = chain[0];
    const firstNode = nodes[first.index];
    const firstIndex = first.outgoing?.i ?? 0;
    const start = firstNode.points[firstIndex];
    points.push({ x: start.x, y: start.y, z: jogHeight, move: 'jog' });
    points.push({ ...start, move: 'plunge' });
    for (let position = 0; position < chain.length; position++) {
      const item = chain[position];
      const node = nodes[item.index];
      const entry = position === 0 ? firstIndex : item.incoming;
      emitLoop(node, entry);
      if (item.outgoing) {
        // Follow the contour to the chosen downward exit if entry and exit
        // differ; this repeats only the necessary portion, never an air jog.
        let index = entry;
        while (index !== item.outgoing.i) {
          index = (index + 1) % node.points.length;
          feed(node.points[index]);
        }
        for (const bridgePoint of item.outgoing.bridge) feed(bridgePoint);
      }
    }
    const last = points[points.length - 1];
    points.push({ x: last.x, y: last.y, z: jogHeight, move: 'jog' });
  }
  return { points, islandTransitions: Math.max(0, chains.length - 1), chains: chains.length };
}
