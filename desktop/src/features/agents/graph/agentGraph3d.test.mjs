import assert from "node:assert/strict";
import test from "node:test";

import { project, spherePositions } from "./agentGraph3d.ts";

test("sphere positions stay on the sphere and keep count", () => {
  const points = spherePositions(7, 200);
  assert.equal(points.length, 7);
  for (const point of points) {
    const radius = Math.hypot(point.x, point.y / 0.72, point.z);
    assert.ok(Math.abs(radius - 200) < 1e-6);
  }
});

test("closer points project larger", () => {
  const near = project({ x: 0, y: 0, z: -200 }, 0, 0, 320, 720);
  const far = project({ x: 0, y: 0, z: 200 }, 0, 0, 320, 720);
  assert.ok(near.scale > 1);
  assert.ok(far.scale < 1);
  assert.ok(near.scale > far.scale);
});

test("a half-turn of yaw swaps near and far", () => {
  const point = { x: 0, y: 0, z: -200 };
  const front = project(point, 0, 0, 320, 720);
  const back = project(point, Math.PI, 0, 320, 720);
  assert.ok(front.z < back.z);
});
