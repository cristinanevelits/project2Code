import test from 'node:test';
import assert from 'node:assert/strict';
import { objectRegionBounds, buildObjectField, sampleObjectField, rotateReferenceVertex, reprojectIndentTargets, chooseIndentTargets, buildWidthProfile, narrowWristSlice, widthSliceAt } from './objectForm.js';

const mesh = {
  vertices: [
    [0, 0, 1], [2, 0, 1], [0, 4, 3], [2, 4, 3], [1, 10, 8]
  ],
  faces: [[0, 1, 3], [0, 3, 2]],
  bounds: { minX: 0, maxX: 2, minY: 0, maxY: 10, minZ: 1, maxZ: 8 }
};

test('default hand region includes the wrist and near palm but excludes fingers', () => {
  const cropped = objectRegionBounds(mesh, 'wrist-palm');
  assert.ok(Math.abs(cropped.cutoff - 4.6) < 1e-9);
  assert.equal(cropped.maxY, 4);
  assert.equal(cropped.maxZ, 3);
  assert.equal(objectRegionBounds(mesh, 'whole').maxY, 10);
});

test('projected field preserves surface height rather than a preset bowl', () => {
  const field = buildObjectField(mesh, { sheet: 12, scale: 1, region: 'wrist-palm', resolution: 49 });
  const low = sampleObjectField(field, 6, 4.5);
  const high = sampleObjectField(field, 6, 7.5);
  assert.ok(high.height > low.height + 1);
  assert.equal(low.distance, 0);
  assert.equal(high.distance, 0);
  assert.ok(sampleObjectField(field, 1, 1).distance > 2);
  assert.ok(field.projectedVertices.every(point => point.raw[1] <= field.bounds.cutoff));
  assert.deepEqual(chooseIndentTargets(field, 0, field.center, 10, 10, 0), []);
});

test('half-turn exposes the opposite OBJ surface and a full turn restores the original', () => {
  const slab = {
    vertices: [
      [0, 0, 0], [2, 0, 0], [0, 2, 0], [2, 2, 0],
      [0, 0, 1], [2, 0, 1], [0, 2, 2], [2, 2, 2]
    ],
    faces: [[0, 1, 3], [0, 3, 2], [4, 5, 7], [4, 7, 6]],
    bounds: { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 }
  };
  const options = { sheet: 12, scale: 2, region: 'whole', resolution: 49 };
  const back = buildObjectField(slab, { ...options, rotationDegrees: 0 });
  const palm = buildObjectField(slab, { ...options, rotationDegrees: 180 });
  const restored = buildObjectField(slab, { ...options, rotationDegrees: 360 });
  assert.ok(sampleObjectField(back, 6, 4).height < sampleObjectField(back, 6, 8).height);
  assert.ok(Math.abs(sampleObjectField(palm, 6, 4).height - sampleObjectField(palm, 6, 8).height) < 0.01);
  assert.ok(Math.abs(sampleObjectField(restored, 6, 4).height - sampleObjectField(back, 6, 4).height) < 0.01);
  const original = back.projectedVertices.find(point => point.sourceIndex === 4);
  const flipped = reprojectIndentTargets(palm, [4])[0];
  assert.notEqual(original.x, flipped.x);
  assert.deepEqual(flipped.raw, slab.vertices[4]);
  assert.deepEqual(rotateReferenceVertex([2, 0, 1], 180, { x: 1, z: 1 }).map(Math.round), [0, 0, 1]);
});

test('wrist width starts at the narrow lower-Y transition and follows a moved slice', () => {
  const vertices = [];
  for (let y = 0; y <= 128; y++) {
    const width = 1 + Math.abs(y / 128 - 0.4) * 5;
    vertices.push([-width / 2, y, 0], [width / 2, y, 0]);
  }
  const scan = { vertices, bounds: { minX: -2, maxX: 2, minY: 0, maxY: 128, minZ: 0, maxZ: 0 } };
  const field = { scale: 20, rotationDegrees: 0, rotationCenter: { x: 0, z: 0 } };
  const profile = buildWidthProfile(scan, field);
  const wrist = narrowWristSlice(profile);
  assert.ok(Math.abs(wrist.fraction - 0.4) < 0.02);
  assert.ok(wrist.width > 20 && wrist.width < 22);
  const moved = widthSliceAt(profile, 0.6);
  assert.ok(Math.abs(moved.fraction - 0.6) < 0.01);
  assert.ok(moved.width > wrist.width);
  assert.equal(buildWidthProfile(scan, { ...field, scale: 40 })[profile.indexOf(wrist)].width, wrist.width * 2);
});
