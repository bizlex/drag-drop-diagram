export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Converts viewport-relative pointer coordinates to the SVG's user-space.
 * `clientX` and `clientY` deliberately avoid page or scroll offsets; the
 * current screen transformation matrix already accounts for the SVG's layout.
 */
export function clientPointToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): SvgPoint {
  const matrix = svg.getScreenCTM();

  if (!matrix) {
    throw new Error('SVG transformation matrix is unavailable');
  }

  let inverse: DOMMatrix;
  try {
    inverse = matrix.inverse();
  } catch {
    throw new Error('SVG transformation matrix cannot be inverted');
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(inverse);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('SVG transformation matrix cannot be inverted');
  }

  return { x: point.x, y: point.y };
}
