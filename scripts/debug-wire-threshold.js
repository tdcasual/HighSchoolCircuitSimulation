/* eslint-disable no-console */
import {
  findNearbyWireSegment,
  splitWireAtPointInternal,
} from '../src/ui/interaction/WireInteractions.js';

function buildContext(scale) {
  const wire = {
    id: 'wire_test',
    a: { x: 0, y: 0 },
    b: { x: 100, y: 0 },
  };
  const circuit = {
    getWire(id) {
      return id === wire.id ? wire : null;
    },
    getAllWires() {
      return [wire];
    },
    addWire(newWire) {
      // Keep only one wire for diagnostics.
      if (newWire && newWire.id) {
        wire.id = newWire.id;
        wire.a = newWire.a;
        wire.b = newWire.b;
      }
    },
  };
  const renderer = {
    refreshWire() {},
    addWire() {},
  };
  return { scale, circuit, renderer };
}

function runSplitCheck(scale, screenDistancePx) {
  const ctx = buildContext(scale);
  const canvasDistance = screenDistancePx / scale;
  const result = splitWireAtPointInternal.call(
    ctx,
    'wire_test',
    canvasDistance,
    0
  );
  return { created: !!result?.created };
}

function runSegmentCheck(scale, screenDistancePx) {
  const ctx = buildContext(scale);
  const canvasDistance = screenDistancePx / scale;
  const threshold = 10 / scale;
  const result = findNearbyWireSegment.call(
    ctx,
    canvasDistance,
    0,
    threshold,
    null
  );
  return { found: !!result };
}

const scales = [0.5, 1, 2, 3];
const screenDistances = [2, 4, 6, 8];

console.log('Split too-close check (expect: consistent across scale)');
for (const d of screenDistances) {
  const row = scales.map((s) => {
    const { created } = runSplitCheck(s, d);
    return created ? 'split' : 'blocked';
  });
  console.log(`screen=${d}px -> ${row.join(' | ')}`);
}

console.log('\nSegment endpoint proximity check (expect: consistent across scale)');
for (const d of screenDistances) {
  const row = scales.map((s) => {
    const { found } = runSegmentCheck(s, d);
    return found ? 'segment' : 'endpoint';
  });
  console.log(`screen=${d}px -> ${row.join(' | ')}`);
}
