import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { describe, expect, it } from 'vitest';

import { makeDocument } from '../../domain/diagram/testFixtures';
import type { DiagramDocument } from '../../domain/diagram/types';
import { DiagramCanvas } from './DiagramCanvas';

function documentWithWords(): DiagramDocument {
  return {
    ...makeDocument(),
    elements: [
      { id: 'word-1', type: 'word', tokenId: 'token-1', x: 120, y: 80 },
      { id: 'word-2', type: 'word', tokenId: 'token-2', x: 250, y: 180 },
    ],
  };
}

describe('DiagramCanvas', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: vi.fn(() => ({
        x: 120,
        y: 61,
        width: 58,
        height: 24,
      })),
    });
  });

  it('renders words from their referenced tokens at document SVG coordinates', () => {
    render(<DiagramCanvas document={documentWithWords()} />);

    const firstWord = screen.getByTestId('word-element-word-1');
    const secondWord = screen.getByTestId('word-element-word-2');

    expect(firstWord).toHaveTextContent('same');
    expect(firstWord).toHaveAttribute('x', '120');
    expect(firstWord).toHaveAttribute('y', '80');
    expect(secondWord).toHaveAttribute('data-diagram-element-id', 'word-2');
  });

  it('keeps SVG layers ordered and renders selection in the top layer only', () => {
    const { container } = render(
      <DiagramCanvas document={documentWithWords()} selectedElementId="word-1" />,
    );

    expect(
      [...container.querySelectorAll('[data-diagram-layer]')].map((layer) =>
        layer.getAttribute('data-diagram-layer'),
      ),
    ).toEqual([
      'background',
      'connectors',
      'junctions',
      'words',
      'selection-and-previews',
    ]);
    expect(screen.getByTestId('selection-overlay-word-1')).toBeInTheDocument();
    expect(screen.queryByTestId('selection-overlay-word-2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move word 1: same' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Move word 2: same' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('selection-overlay-word-1').querySelector('rect')).toHaveAttribute('width', '70');
  });

  it('omits a word with a missing token reference without crashing', () => {
    const invalidDocument: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'orphan-word', type: 'word', tokenId: 'missing-token', x: 10, y: 20 },
      ],
    };

    render(<DiagramCanvas document={invalidDocument} selectedElementId="orphan-word" />);

    expect(screen.getByRole('group', { name: 'Diagram SVG workspace' })).toBeInTheDocument();
    expect(screen.queryByTestId('word-element-orphan-word')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selection-overlay-orphan-word')).not.toBeInTheDocument();
  });
});
