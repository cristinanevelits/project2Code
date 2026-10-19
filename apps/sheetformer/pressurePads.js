const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A selected OBJ point can make a complete circular pad only while its entire
// footprint is inside the formable face and its centre is actually indented.
export function activePressurePads(targets, { sheet, clampInset, radius, baseAt }) {
  const margin = radius + 1;
  return targets.filter(({ x, y }) =>
    x >= clampInset + margin && x <= sheet - clampInset - margin &&
    y >= clampInset + margin && y <= sheet - clampInset - margin &&
    baseAt(x, y) < -0.5);
}

// An aligned array of pads over the real OBJ depression. Require the centre
// and the full circumference to remain inside the imprint and clamp border.
export function linearPressurePads({ sheet, clampInset, diameter, centerX, centerY, seed = 50, baseAt }) {
  if (diameter <= 0) return [];
  const radius = diameter / 2;
  const margin = radius + 1;
  const spacing = diameter * 1.6;
  // Seed is a continuous grid phase, not randomness. 50 preserves the current
  // placement; either direction slides the rows across the OBJ imprint.
  const phase = (clamp(seed, 0, 100) - 50) / 50;
  const originX = centerX + phase * spacing * 0.5;
  const originY = centerY + phase * spacing / 3;
  const min = clampInset + margin, max = sheet - clampInset - margin;
  const minColumn = Math.ceil((min - originX) / spacing);
  const maxColumn = Math.floor((max - originX) / spacing);
  const minRow = Math.ceil((min - originY) / spacing);
  const maxRow = Math.floor((max - originY) / spacing);
  const pads = [];
  for (let row = minRow; row <= maxRow; row++) {
    const y = originY + row * spacing;
    for (let column = minColumn; column <= maxColumn; column++) {
      const x = originX + column * spacing;
      if (baseAt(x, y) >= -0.5) continue;
      let inside = true;
      for (let sample = 0; sample < 48; sample++) {
        const angle = sample * Math.PI / 24;
        if (baseAt(x + radius * Math.cos(angle), y + radius * Math.sin(angle)) >= -0.5) {
          inside = false;
          break;
        }
      }
      if (inside) pads.push({ x, y });
    }
  }
  return pads;
}

// Circular recess profile on the virtual forming object: a flat-bottomed
// centre and a smooth annular shoulder. Overlaps use the deepest recess.
export function pressurePadLift(x, y, targets, radius, height) {
  if (height <= 0 || radius <= 0) return 0;
  let lift = 0;
  const coreRadius = radius * 0.55;
  for (const target of targets) {
    const distance = Math.hypot(x - target.x, y - target.y);
    if (distance >= radius) continue;
    const t = clamp((radius - distance) / (radius - coreRadius), 0, 1);
    lift = Math.max(lift, height * t * t * (3 - 2 * t));
  }
  return lift;
}

// A recess removes relief from the forming object before the sheet is imprinted.
// The resulting sheet may be locally higher than its surrounding depression,
// but can never rise above the original, unformed sheet plane (Z = 0).
export function recessedImprintDepth(objectDepth, recessDepth) {
  return Math.max(0, objectDepth - Math.max(0, recessDepth));
}
