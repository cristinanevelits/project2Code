import test from 'node:test';
import assert from 'node:assert/strict';
import { maxFaceSlope, relaxSteepFaces } from './slopeRelax.js';

function grid(n, heightAt) {
  const vertices = [];
  const faces = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    vertices.push({ x, y, z: heightAt(x, y) });
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const a = y * n + x, b = a + 1, d = a + n, c = d + 1;
    faces.push([a, b, c], [a, c, d]);
  }
  return { vertices, faces };
}

test('locally eases an over-steep pit while keeping the flat clamp boundary', () => {
  const { vertices, faces } = grid(21, (x, y) => x === 10 && y === 10 ? -10 : 0);
  const fixed = v => v.x === 0 || v.y === 0 || v.x === 20 || v.y === 20;
  const result = relaxSteepFaces(vertices, faces, 50, fixed);
  assert.equal(result.changed, true);
  assert.ok(maxFaceSlope(vertices, faces) <= 50.1);
  assert.ok(vertices[10 * 21 + 10].z < 0);
  assert.ok(vertices.filter(v => fixed(v)).every(v => v.z === 0));
});

test('leaves already-valid geometry and its full depth unchanged', () => {
  const { vertices, faces } = grid(21, (x, y) => -Math.max(0, 7 - Math.hypot(x - 10, y - 10)) * 0.5);
  const before = vertices.map(v => v.z);
  const result = relaxSteepFaces(vertices, faces, 50, () => false);
  assert.equal(result.changed, false);
  assert.deepEqual(vertices.map(v => v.z), before);
});

test('preserves a deep broad imprint while easing its steep sides', () => {
  const { vertices, faces } = grid(31, (x, y) => Math.hypot(x - 15, y - 15) < 5 ? -8 : 0);
  relaxSteepFaces(vertices, faces, 50, v => v.x === 0 || v.y === 0 || v.x === 30 || v.y === 30);
  assert.ok(maxFaceSlope(vertices, faces) <= 50.1);
  assert.ok(vertices[15 * 31 + 15].z < -7.5);
});
