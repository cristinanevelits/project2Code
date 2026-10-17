// Convert a dense Rhino OBJ into a browser-sized preview without touching the source.
// 3D grid clustering preserves the entire scan while reducing redundant triangles.
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

const [source, destination, cellArg = '0.04'] = process.argv.slice(2);
const cell = Number(cellArg);
if (!source || !destination || !Number.isFinite(cell) || cell <= 0) {
  throw new Error('Usage: node simplifyReference.mjs source.obj destination.obj [cell size]');
}

const clusters = new Map();
const vertexMap = [0]; // OBJ indices are one-based.
const facesSeen = new Set();
const output = createWriteStream(destination);
const lines = createInterface({ input: createReadStream(source), crlfDelay: Infinity });
let flushedVertices = false;
let writtenFaces = 0;

async function write(line) {
  if (!output.write(line)) await once(output, 'drain');
}

async function flushVertices() {
  if (flushedVertices) return;
  flushedVertices = true;
  await write(`# Simplified preview of ${source.split('/').at(-1)}; source remains unchanged\n`);
  for (const vertex of clusters.values()) {
    await write(`v ${(vertex.x / vertex.count).toFixed(6)} ${(vertex.y / vertex.count).toFixed(6)} ${(vertex.z / vertex.count).toFixed(6)}\n`);
  }
}

for await (const line of lines) {
  if (line.startsWith('v ')) {
    if (flushedVertices) throw new Error('This converter expects all vertices before faces');
    const [, xs, ys, zs] = line.trim().split(/\s+/);
    const x = Number(xs), y = Number(ys), z = Number(zs);
    if (![x, y, z].every(Number.isFinite)) throw new Error('Invalid source vertex');
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    let vertex = clusters.get(key);
    if (!vertex) {
      vertex = { index: clusters.size + 1, x: 0, y: 0, z: 0, count: 0 };
      clusters.set(key, vertex);
    }
    vertex.x += x; vertex.y += y; vertex.z += z; vertex.count++;
    vertexMap.push(vertex.index);
  } else if (line.startsWith('f ')) {
    await flushVertices();
    const indices = line.trim().split(/\s+/).slice(1).map(token => Number(token.split('/')[0]));
    if (indices.some(index => !Number.isInteger(index) || index < 1 || index >= vertexMap.length)) {
      throw new Error('Invalid source face index');
    }
    for (let i = 1; i < indices.length - 1; i++) {
      const a = vertexMap[indices[0]], b = vertexMap[indices[i]], c = vertexMap[indices[i + 1]];
      if (a === b || b === c || c === a) continue;
      const key = [a, b, c].sort((u, v) => u - v).join(',');
      if (facesSeen.has(key)) continue;
      facesSeen.add(key);
      await write(`f ${a} ${b} ${c}\n`);
      writtenFaces++;
    }
  }
}
await flushVertices();
output.end();
await once(output, 'finish');
console.log(`${vertexMap.length - 1} source vertices → ${clusters.size} preview vertices; ${writtenFaces} faces`);
