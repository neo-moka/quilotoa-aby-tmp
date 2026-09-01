/**
 * Screen-space geometry for a graph edge: a quadratic curve trimmed to the
 * node circles plus an explicit arrowhead polygon aligned with the curve's
 * end tangent.
 *
 * The arrowhead is drawn as a polygon rather than an SVG `<marker>` because
 * marker content does not inherit the referencing path's color — every
 * marker rendered in one hue regardless of the edge it capped — and because
 * a polygon can scale with 3D depth and pick up the edge's gradient end
 * color exactly.
 */

export type EdgeGeometry = {
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** `points` attribute for the arrowhead `<polygon>`. */
  arrowPoints: string;
};

export function curvedEdgeGeometry({
  fromX,
  fromY,
  toX,
  toY,
  startTrim,
  endTrim,
  bow,
  arrowSize,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Distance from the source center where the curve starts. */
  startTrim: number;
  /** Distance from the target center where the arrow tip lands. */
  endTrim: number;
  /** Perpendicular offset of the control point; sign picks the side. */
  bow: number;
  arrowSize: number;
}): EdgeGeometry {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;

  const startX = fromX + unitX * startTrim;
  const startY = fromY + unitY * startTrim;
  const tipX = toX - unitX * endTrim;
  const tipY = toY - unitY * endTrim;

  const controlX = (startX + tipX) / 2 - unitY * bow;
  const controlY = (startY + tipY) / 2 + unitX * bow;

  // The curve stops where the arrow begins; the polygon owns the tip.
  const tangentLength = Math.hypot(tipX - controlX, tipY - controlY) || 1;
  const tangentX = (tipX - controlX) / tangentLength;
  const tangentY = (tipY - controlY) / tangentLength;
  const baseX = tipX - tangentX * arrowSize;
  const baseY = tipY - tangentY * arrowSize;
  const normalX = -tangentY;
  const normalY = tangentX;
  const wing = arrowSize * 0.48;

  return {
    d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${baseX} ${baseY}`,
    startX,
    startY,
    endX: tipX,
    endY: tipY,
    arrowPoints: [
      `${tipX},${tipY}`,
      `${baseX + normalX * wing},${baseY + normalY * wing}`,
      `${baseX - normalX * wing},${baseY - normalY * wing}`,
    ].join(" "),
  };
}
