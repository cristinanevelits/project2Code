import test from 'node:test';
import assert from 'node:assert/strict';
import { routeContours, traceSurfaceBridge } from './toolpath.js';

function circle(cx, cy, radius, z) {
  const points = Array.from({ length: 48 }, (_, index) => {
    const angle = index / 48 * Math.PI * 2;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, z };
  });
  return [...points, { ...points[0] }];
}

test('nested contours descend as one feed chain without repeated jogs', () => {
  const contours = [circle(0, 0, 8, -1), circle(0, 0, 6, -2), circle(0, 0, 4, -3)];
  const route = routeContours(contours, {
    sampleSurface: (x, y) => -1 - (8 - Math.hypot(x, y)) / 2
  });
  assert.equal(route.chains, 1);
  assert.equal(route.islandTransitions, 0);
  assert.equal(route.points.filter(p => p.move === 'jog').length, 2);
  assert.equal(route.points.filter(p => p.move === 'plunge').length, 1);
  assert.ok(route.points.some(p => p.move === 'feed' && p.z < -1 && p.z > -2));
});

test('separate islands get a safe lift and a new approach', () => {
  const route = routeContours([circle(0, 0, 5, -1), circle(25, 0, 5, -1)], {
    sampleSurface: () => 0
  });
  assert.equal(route.chains, 2);
  assert.equal(route.islandTransitions, 1);
  assert.equal(route.points.filter(p => p.move === 'jog').length, 4);
  assert.equal(route.points.filter(p => p.move === 'plunge').length, 2);
});

test('a bridge that would climb over unformed sheet remains a separate island', () => {
  const route = routeContours([circle(0, 0, 8, -1), circle(0, 0, 4, -2)], {
    sampleSurface: () => 0
  });
  assert.equal(route.chains, 2);
  assert.equal(route.islandTransitions, 1);
});

test('a descending bridge bends at a grid edge instead of cutting through the mesh', () => {
  const surface = x => x <= 1 ? -1 - 0.1 * x : -1.1 - 1.9 * (x - 1);
  const bridge = traceSurfaceBridge(
    { x: 0, y: 0.5, z: -1 }, { x: 2, y: 0.5, z: -3 },
    surface, [0, 1, 2]
  );
  assert.ok(bridge);
  assert.ok(bridge.some(point => Math.abs(point.x - 1) < 1e-8 && Math.abs(point.z + 1.1) < 1e-8));
  const path = [{ x: 0, y: 0.5, z: -1 }, ...bridge];
  for (let index = 1; index < path.length; index++) {
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const x = path[index - 1].x + (path[index].x - path[index - 1].x) * t;
      const z = path[index - 1].z + (path[index].z - path[index - 1].z) * t;
      assert.ok(z >= surface(x) - 1e-8);
    }
  }
});

test('a bridge also bends at the triangle diagonal', () => {
  const surface = (x, y) => y <= x ? -1 - 2 * y : -1 - y - x;
  const bridge = traceSurfaceBridge(
    { x: 0, y: 0.1, z: -1.1 }, { x: 1, y: 0.9, z: -2.8 },
    surface, [0, 1]
  );
  assert.ok(bridge);
  assert.ok(bridge.some(point => Math.abs(point.x - 0.5) < 1e-8 && Math.abs(point.y - 0.5) < 1e-8));
});

test('a ridge on the mesh forces a jog rather than a climbing link', () => {
  const surface = x => x <= 1 ? -1 + 0.8 * x : -0.2 - 1.8 * (x - 1);
  assert.equal(traceSurfaceBridge(
    { x: 0, y: 0.5, z: -1 }, { x: 2, y: 0.5, z: -2 },
    surface, [0, 1, 2]
  ), null);
});
