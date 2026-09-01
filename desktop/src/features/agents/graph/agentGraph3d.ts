/**
 * Minimal 3D math for the agent graph's orbit mode: nodes on a sphere,
 * rotated by yaw/pitch, projected with a simple perspective divide. No
 * dependencies — a handful of nodes never justifies a scene graph.
 */

export type Vec3 = { x: number; y: number; z: number };

export type ProjectedPoint = {
  x: number;
  y: number;
  /** Perspective factor — use as a scale and a depth cue (near ≈ 1.2). */
  scale: number;
  /** Rotated depth; larger is further from the camera. */
  z: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Distribute `count` points on a sphere with a golden-angle spiral — evenly
 * spread for any count, stable order (node i keeps its place as data
 * refreshes).
 */
export function spherePositions(count: number, radius: number): Vec3[] {
  if (count === 1) return [{ x: 0, y: 0, z: 0 }];
  const points: Vec3[] = [];
  for (let index = 0; index < count; index += 1) {
    // y in (-1, 1), excluding the poles so no node hides at the top.
    const y = 1 - (2 * (index + 0.5)) / count;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = GOLDEN_ANGLE * index;
    points.push({
      x: Math.cos(angle) * ringRadius * radius,
      y: y * radius * 0.72,
      z: Math.sin(angle) * ringRadius * radius,
    });
  }
  return points;
}

export function rotateYawPitch(point: Vec3, yaw: number, pitch: number): Vec3 {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x1 = point.x * cosYaw + point.z * sinYaw;
  const z1 = -point.x * sinYaw + point.z * cosYaw;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const y2 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;
  return { x: x1, y: y2, z: z2 };
}

export function project(
  point: Vec3,
  yaw: number,
  pitch: number,
  center: number,
  focal: number,
): ProjectedPoint {
  const rotated = rotateYawPitch(point, yaw, pitch);
  const scale = focal / (focal + rotated.z);
  return {
    x: center + rotated.x * scale,
    y: center + rotated.y * scale,
    scale,
    z: rotated.z,
  };
}
