// Ease only over-steep mesh faces. Boundary vertices can be fixed so the
// clamping area remains flat while a steep imprint spreads into nearby sheet.
export function relaxSteepFaces(vertices, faces, maxAngle, isFixed, maxPasses = 160) {
  const limit = Math.tan(maxAngle * Math.PI / 180);
  const prepared = faces.map(([ia, ib, ic]) => {
    const a = vertices[ia], b = vertices[ib], c = vertices[ic];
    const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    if (Math.abs(det) < 1e-9) return null;
    return {
      indices: [ia, ib, ic],
      cx: [(b.y - c.y) / det, (c.y - a.y) / det, (a.y - b.y) / det],
      cy: [(c.x - b.x) / det, (a.x - c.x) / det, (b.x - a.x) / det]
    };
  }).filter(Boolean);
  const fixed = vertices.map(isFixed);
  let changed = false;
  let pass = 0;
  for (; pass < maxPasses; pass++) {
    let maxExcess = 0;
    // Alternate direction to avoid pushing the whole relaxation to one side.
    const reverse = pass % 2 === 1;
    for (let k = 0; k < prepared.length; k++) {
      const face = prepared[reverse ? prepared.length - 1 - k : k];
      const { indices, cx, cy } = face;
      let gx = 0, gy = 0;
      for (let i = 0; i < 3; i++) {
        gx += cx[i] * vertices[indices[i]].z;
        gy += cy[i] * vertices[indices[i]].z;
      }
      const magnitude = Math.hypot(gx, gy);
      if (magnitude <= limit + 1e-6) continue;
      maxExcess = Math.max(maxExcess, magnitude - limit);
      const gradient = [0, 0, 0];
      let denominator = 0;
      for (let i = 0; i < 3; i++) {
        if (fixed[indices[i]]) continue;
        gradient[i] = (gx * cx[i] + gy * cy[i]) / magnitude;
        denominator += gradient[i] * gradient[i];
      }
      if (denominator < 1e-12) continue;
      const correction = (magnitude - limit) / denominator;
      for (let i = 0; i < 3; i++) {
        if (!fixed[indices[i]]) vertices[indices[i]].z -= correction * gradient[i];
      }
      changed = true;
    }
    if (maxExcess < 1e-4) break;
  }
  return { changed, passes: pass + 1 };
}

export function maxFaceSlope(vertices, faces) {
  let maxSlope = 0;
  for (const [ia, ib, ic] of faces) {
    const a = vertices[ia], b = vertices[ib], c = vertices[ic];
    const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
    if (Math.abs(det) < 1e-9) continue;
    const gx = ((b.z - a.z) * (c.y - a.y) - (c.z - a.z) * (b.y - a.y)) / det;
    const gy = ((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / det;
    maxSlope = Math.max(maxSlope, Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI);
  }
  return maxSlope;
}
