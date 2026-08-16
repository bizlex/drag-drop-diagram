import { afterEach, describe, expect, it, vi } from 'vitest';

import { clientPointToSvg } from './clientPointToSvg';

class MockDOMPoint {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  matrixTransform(matrix: { offsetX: number; offsetY: number }) {
    return { x: this.x + matrix.offsetX, y: this.y + matrix.offsetY };
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('clientPointToSvg', () => {
  it('converts client coordinates with the inverse screen transformation matrix', () => {
    vi.stubGlobal('DOMPoint', MockDOMPoint);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const inverse = vi.fn(() => ({ offsetX: -40, offsetY: -15 }));
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: vi.fn(() => ({ inverse } as unknown as DOMMatrix)),
    });

    expect(clientPointToSvg(svg, 150, 90)).toEqual({ x: 110, y: 75 });
    expect(inverse).toHaveBeenCalledOnce();
  });

  it('throws a clear error when the SVG transformation matrix is unavailable', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: vi.fn(() => null),
    });

    expect(() => clientPointToSvg(svg, 0, 0)).toThrow(
      'SVG transformation matrix is unavailable',
    );
  });

  it('rejects a non-invertible transformation instead of returning invalid coordinates', () => {
    vi.stubGlobal('DOMPoint', MockDOMPoint);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'getScreenCTM', {
      configurable: true,
      value: vi.fn(() => ({ inverse: () => ({ offsetX: Number.NaN, offsetY: 0 }) } as unknown as DOMMatrix)),
    });

    expect(() => clientPointToSvg(svg, 150, 90)).toThrow(
      'SVG transformation matrix cannot be inverted',
    );
  });
});
