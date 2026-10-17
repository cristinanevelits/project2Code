import test from 'node:test';
import assert from 'node:assert/strict';
import { activePressurePads, linearPressurePads, pressurePadLift } from './pressurePads.js';

test('each pad has a circular plateau and blends to the unchanged surface', () => {
  const targets = [{ x: 50, y: 50 }];
  assert.equal(pressurePadLift(50, 50, targets, 10, 6), 6);
  assert.equal(pressurePadLift(54, 50, targets, 10, 6), 6);
  assert.ok(pressurePadLift(58, 50, targets, 10, 6) > 0);
  assert.equal(pressurePadLift(60, 50, targets, 10, 6), 0);
  assert.equal(pressurePadLift(50, 60, targets, 10, 6), 0);
  assert.equal(pressurePadLift(50, 50, targets, 10, 0), 0);
});

test('moving an OBJ point outside the formable face removes its pad', () => {
  const targets = [{ x: 50, y: 50 }, { x: 14, y: 50 }, { x: 50, y: 14 }, { x: 80, y: 80 }];
  const active = activePressurePads(targets, {
    sheet: 100, clampInset: 10, radius: 8,
    baseAt: (x, y) => x === 80 ? 0 : -10
  });
  assert.deepEqual(active, [targets[0]]);
});

test('linear pads form aligned rows only where full circles fit in the imprint', () => {
  const baseAt = (x, y) => Math.hypot(x - 50, y - 50) < 32 ? -5 : 0;
  const pads = linearPressurePads({ sheet: 100, clampInset: 10, diameter: 10,
    centerX: 50, centerY: 50, baseAt });
  assert.ok(pads.length > 4);
  assert.ok(pads.every(({ x, y }) => (x - 50) % 16 === 0 && (y - 50) % 16 === 0));
  assert.ok(pads.every(({ x, y }) => Math.hypot(x - 50, y - 50) + 5 < 32));
  assert.ok(pads.every(({ x, y }) => x >= 16 && x <= 84 && y >= 16 && y <= 84));
  assert.deepEqual(linearPressurePads({ sheet: 100, clampInset: 10, diameter: 10,
    centerX: 50, centerY: 50, baseAt: () => 0 }), []);
});

test('pattern seed translates the aligned grid while keeping pads within the imprint', () => {
  const baseAt = (x, y) => Math.hypot(x - 50, y - 50) < 32 ? -5 : 0;
  const options = { sheet: 100, clampInset: 10, diameter: 10,
    centerX: 50, centerY: 50, baseAt };
  const centered = linearPressurePads({ ...options, seed: 50 });
  const shifted = linearPressurePads({ ...options, seed: 75 });
  assert.notDeepEqual(shifted, centered);
  assert.ok(shifted.length > 0);
  assert.ok(shifted.every(({ x, y }) =>
    Math.abs((x - 54) / 16 - Math.round((x - 54) / 16)) < 1e-9 &&
    Math.abs((y - 50 - 16 / 6) / 16 - Math.round((y - 50 - 16 / 6) / 16)) < 1e-9));
  assert.ok(shifted.every(({ x, y }) => Math.hypot(x - 50, y - 50) + 5 < 32));
});
