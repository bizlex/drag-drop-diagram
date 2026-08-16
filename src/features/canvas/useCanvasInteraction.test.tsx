import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDiagramReducer, type DiagramAction } from '../../domain/diagram/reducer';
import { makeDocument } from '../../domain/diagram/testFixtures';
import type { DiagramDocument } from '../../domain/diagram/types';
import { SourceTextPanel } from '../source-text/SourceTextPanel';
import { DiagramCanvas } from './DiagramCanvas';
import { useCanvasInteraction } from './useCanvasInteraction';

const SVG_BOUNDS = {
  bottom: 650,
  height: 600,
  left: 100,
  right: 900,
  top: 50,
  width: 800,
  x: 100,
  y: 50,
  toJSON: () => ({}),
};

const setPointerCapture = vi.fn();
const releasePointerCapture = vi.fn();
let generatedId = 0;
let transformMode: 'valid' | 'missing' | 'non-invertible' | 'non-finite' = 'valid';

const reducer = createDiagramReducer({
  generateId: () => `generated-${++generatedId}`,
  now: () => '2026-08-16T12:00:00.000Z',
});

class TestDOMPoint {
  constructor(
    public x: number,
    public y: number,
  ) {}

  matrixTransform() {
    if (transformMode === 'non-finite') return { x: Number.NaN, y: Infinity };
    return { x: this.x - SVG_BOUNDS.left, y: this.y - SVG_BOUNDS.top };
  }
}

class TestPointerEvent extends MouseEvent {
  readonly isPrimary: boolean;
  readonly pointerId: number;
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? true;
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? '';
  }
}

interface HarnessProps {
  initialDocument?: DiagramDocument;
  onAction?: (action: DiagramAction) => void;
}

function documentWithPlacedWord(): DiagramDocument {
  return {
    ...makeDocument(),
    elements: [
      { id: 'word-1', type: 'word', tokenId: 'token-1', x: 120, y: 80 },
    ],
  };
}

function InteractionHarness({
  initialDocument = makeDocument(),
  onAction = () => undefined,
}: HarnessProps) {
  const [document, setDocument] = useState(initialDocument);
  const commit = useCallback(
    (action: DiagramAction) => {
      onAction(action);
      setDocument((current) => {
        const result = reducer(current, action);
        return result.ok ? result.value : current;
      });
    },
    [onAction],
  );
  const interaction = useCanvasInteraction({ document, onCommit: commit });

  return (
    <main data-testid="interaction-root" {...interaction.rootHandlers}>
      <SourceTextPanel
        document={document}
        draftSourceText={document.sourceText}
        onCreate={() => undefined}
        onDraftChange={() => undefined}
        onReset={() => undefined}
      />
      <DiagramCanvas
        document={document}
        interactionPreview={interaction.preview}
        onSvgChange={interaction.setCanvasSvg}
        selectedElementId={interaction.selectedElementId}
      />
      <button
        onClick={() => setDocument({ ...makeDocument(), id: 'replacement-document' })}
        type="button"
      >
        Replace document
      </button>
      <output data-testid="document-state">{JSON.stringify(document)}</output>
      <output data-testid="selection-state">{interaction.selectedElementId ?? ''}</output>
      {interaction.error && <p role="alert">{interaction.error}</p>}
    </main>
  );
}

function pointerDown(
  target: Element,
  options: Partial<PointerEventInit> & { pointerId?: number; pointerType?: string } = {},
) {
  fireEvent.pointerDown(target, {
    button: 0,
    clientX: 20,
    clientY: 20,
    pointerId: 1,
    pointerType: 'mouse',
    ...options,
  });
}

function pointerMove(
  target: Element,
  options: Partial<PointerEventInit> & { pointerId?: number; pointerType?: string } = {},
) {
  fireEvent.pointerMove(target, {
    clientX: 240,
    clientY: 150,
    pointerId: 1,
    pointerType: 'mouse',
    ...options,
  });
}

function pointerUp(
  target: Element,
  options: Partial<PointerEventInit> & { pointerId?: number; pointerType?: string } = {},
) {
  fireEvent.pointerUp(target, {
    clientX: 250,
    clientY: 150,
    pointerId: 1,
    pointerType: 'mouse',
    ...options,
  });
}

function currentDocument() {
  return JSON.parse(screen.getByTestId('document-state').textContent ?? '') as DiagramDocument;
}

describe('useCanvasInteraction', () => {
  beforeEach(() => {
    generatedId = 0;
    transformMode = 'valid';
    setPointerCapture.mockReset();
    releasePointerCapture.mockReset();
    vi.stubGlobal('DOMPoint', TestDOMPoint);
    vi.stubGlobal('PointerEvent', TestPointerEvent);
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: releasePointerCapture,
    });
    Object.defineProperty(SVGSVGElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: vi.fn(() => SVG_BOUNDS),
    });
    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: vi.fn(() => {
        if (transformMode === 'missing') return null;
        return {
          inverse: () => {
            if (transformMode === 'non-invertible') {
              throw new Error('Matrix is singular');
            }
            return {};
          },
        };
      }),
    });
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: vi.fn(function (this: SVGElement) {
        const x = Number(this.getAttribute('x') ?? 120);
        const y = Number(this.getAttribute('y') ?? 80);
        return { x, y: y - 20, width: 50, height: 24 };
      }),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['mouse', 'touch'])('places a token with a single operation for %s input', (pointerType) => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');
    const token = screen.getByRole('button', { name: 'Place token 1: same' });

    pointerDown(token, { pointerId: 7, pointerType });
    pointerMove(root, { clientX: 210, clientY: 130, pointerId: 7, pointerType });
    pointerMove(root, { clientX: 230, clientY: 140, pointerId: 7, pointerType });
    pointerUp(root, { clientX: 250, clientY: 150, pointerId: 7, pointerType });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      type: 'PLACE_TOKEN',
      payload: { tokenId: 'token-1', x: 150, y: 100 },
    });
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('keeps pointer movement transient and leaves the document unchanged before pointerup', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');
    const token = screen.getByRole('button', { name: 'Place token 1: same' });
    const before = screen.getByTestId('document-state').textContent;

    pointerDown(token);
    pointerMove(root, { clientX: 210, clientY: 130 });
    pointerMove(root, { clientX: 240, clientY: 160 });

    expect(screen.getByTestId('document-state')).toHaveTextContent(before ?? '');
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('placement-preview-token-1')).toHaveAttribute('x', '140');
  });

  it('uses token identity for repeated text and removes only the placed token', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 2: same' }));
    pointerUp(root);

    expect(onAction).toHaveBeenCalledWith({
      type: 'PLACE_TOKEN',
      payload: { tokenId: 'token-2', x: 150, y: 100 },
    });
    expect(screen.getByRole('button', { name: 'Place token 1: same' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Place token 2: same' })).not.toBeInTheDocument();
  });

  it('cancels placement when pointerup is outside the visible SVG bounds', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }));
    pointerMove(root, { clientX: 400, clientY: 200 });
    pointerUp(root, { clientX: 901, clientY: 200 });

    expect(onAction).not.toHaveBeenCalled();
    expect(currentDocument().elements).toEqual([]);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('ignores right-click and non-primary pointer activation', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');
    const token = screen.getByRole('button', { name: 'Place token 1: same' });

    pointerDown(token, { button: 2, pointerId: 2 });
    pointerUp(root, { button: 2, pointerId: 2 });
    pointerDown(token, { isPrimary: false, pointerId: 3, pointerType: 'touch' });
    pointerUp(root, { isPrimary: false, pointerId: 3, pointerType: 'touch' });

    expect(onAction).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(releasePointerCapture).not.toHaveBeenCalled();
  });

  it('cancels without changing the document on Escape and pointercancel', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');
    const token = screen.getByRole('button', { name: 'Place token 1: same' });

    pointerDown(token, { pointerId: 3 });
    pointerMove(root, { pointerId: 3 });
    fireEvent.keyDown(window, { key: 'Escape' });
    pointerUp(root, { pointerId: 3 });

    pointerDown(token, { pointerId: 4, pointerType: 'touch' });
    pointerMove(root, { pointerId: 4, pointerType: 'touch' });
    fireEvent.pointerCancel(root, { pointerId: 4, pointerType: 'touch' });

    expect(onAction).not.toHaveBeenCalled();
    expect(currentDocument().elements).toEqual([]);
    expect(releasePointerCapture).toHaveBeenCalledWith(3);
    expect(releasePointerCapture).toHaveBeenCalledWith(4);
  });

  it('cancels transient state when pointer capture is lost externally', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }), {
      pointerId: 5,
      pointerType: 'touch',
    });
    pointerMove(root, { pointerId: 5, pointerType: 'touch' });
    expect(screen.getByTestId('placement-preview-token-1')).toBeInTheDocument();

    fireEvent.lostPointerCapture(root, { pointerId: 5, pointerType: 'touch' });
    pointerUp(root, { pointerId: 5, pointerType: 'touch' });

    expect(screen.queryByTestId('placement-preview-token-1')).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
    expect(releasePointerCapture).not.toHaveBeenCalled();
  });

  it('cancels an active gesture when the document is replaced', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }), {
      pointerId: 6,
    });
    pointerMove(root, { pointerId: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Replace document' }));
    pointerUp(root, { pointerId: 6 });

    expect(currentDocument().id).toBe('replacement-document');
    expect(currentDocument().elements).toEqual([]);
    expect(screen.queryByTestId('placement-preview-token-1')).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
    expect(releasePointerCapture).toHaveBeenCalledWith(6);
  });

  it('releases an active pointer capture on unmount', () => {
    const { unmount } = render(<InteractionHarness />);

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }), {
      pointerId: 7,
    });
    unmount();

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('moves one selected word once while preserving its grab offset', () => {
    const onAction = vi.fn();
    render(
      <InteractionHarness
        initialDocument={documentWithPlacedWord()}
        onAction={onAction}
      />,
    );
    const root = screen.getByTestId('interaction-root');
    const word = screen.getByRole('button', { name: 'Move word 1: same' });

    // Pointer starts 10 SVG units right and below the word's stored x/y.
    pointerDown(word, { clientX: 230, clientY: 140, pointerId: 8 });
    pointerMove(root, { clientX: 280, clientY: 190, pointerId: 8 });
    pointerMove(root, { clientX: 300, clientY: 210, pointerId: 8 });
    pointerUp(root, { clientX: 330, clientY: 240, pointerId: 8 });

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      type: 'MOVE_ELEMENT',
      payload: { elementId: 'word-1', x: 220, y: 180 },
    });
    expect(currentDocument().elements[0]).toMatchObject({ x: 220, y: 180 });
    expect(screen.getByTestId('selection-state')).toHaveTextContent('word-1');
  });

  it('keeps word movement transient and restores the original position on cancel', () => {
    const onAction = vi.fn();
    render(
      <InteractionHarness
        initialDocument={documentWithPlacedWord()}
        onAction={onAction}
      />,
    );
    const root = screen.getByTestId('interaction-root');
    const word = screen.getByRole('button', { name: 'Move word 1: same' });
    const before = screen.getByTestId('document-state').textContent;

    pointerDown(word, { clientX: 230, clientY: 140, pointerId: 9 });
    pointerMove(root, { clientX: 300, clientY: 210, pointerId: 9 });

    expect(screen.getByTestId('word-element-word-1')).toHaveAttribute('x', '190');
    expect(screen.getByTestId('selection-overlay-word-1').querySelector('rect')).toHaveAttribute('x', '184');
    expect(screen.getByTestId('document-state')).toHaveTextContent(before ?? '');
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.pointerCancel(root, { pointerId: 9, pointerType: 'mouse' });

    expect(screen.getByTestId('word-element-word-1')).toHaveAttribute('x', '120');
    expect(screen.getByTestId('selection-overlay-word-1').querySelector('rect')).toHaveAttribute('x', '114');
    expect(currentDocument().elements[0]).toMatchObject({ x: 120, y: 80 });
    expect(onAction).not.toHaveBeenCalled();
    expect(releasePointerCapture).toHaveBeenCalledWith(9);
  });

  it('treats movement below the threshold as selection without MOVE_ELEMENT', () => {
    const onAction = vi.fn();
    render(
      <InteractionHarness
        initialDocument={documentWithPlacedWord()}
        onAction={onAction}
      />,
    );
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Move word 1: same' }), {
      clientX: 230,
      clientY: 140,
    });
    pointerMove(root, { clientX: 232, clientY: 142 });
    pointerUp(root, { clientX: 232, clientY: 142 });

    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('selection-state')).toHaveTextContent('word-1');
    expect(currentDocument().elements[0]).toMatchObject({ x: 120, y: 80 });
  });

  it('commits movement at the exact four CSS pixel threshold', () => {
    const onAction = vi.fn();
    render(
      <InteractionHarness
        initialDocument={documentWithPlacedWord()}
        onAction={onAction}
      />,
    );
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Move word 1: same' }), {
      clientX: 230,
      clientY: 140,
    });
    pointerUp(root, { clientX: 234, clientY: 140 });

    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith({
      type: 'MOVE_ELEMENT',
      payload: { elementId: 'word-1', x: 124, y: 80 },
    });
  });

  it('cancels word movement when pointerup is outside the visible SVG bounds', () => {
    const onAction = vi.fn();
    render(
      <InteractionHarness
        initialDocument={documentWithPlacedWord()}
        onAction={onAction}
      />,
    );
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Move word 1: same' }), {
      clientX: 230,
      clientY: 140,
    });
    pointerMove(root, { clientX: 300, clientY: 210 });
    pointerUp(root, { clientX: 901, clientY: 210 });

    expect(onAction).not.toHaveBeenCalled();
    expect(currentDocument().elements[0]).toMatchObject({ x: 120, y: 80 });
    expect(screen.getByTestId('word-element-word-1')).toHaveAttribute('x', '120');
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('clears selection on the empty canvas and with Escape when no gesture is active', () => {
    render(<InteractionHarness initialDocument={documentWithPlacedWord()} />);
    const root = screen.getByTestId('interaction-root');
    const word = screen.getByRole('button', { name: 'Move word 1: same' });

    pointerDown(word, { clientX: 230, clientY: 140 });
    pointerUp(root, { clientX: 230, clientY: 140 });
    expect(screen.getByTestId('selection-state')).toHaveTextContent('word-1');

    pointerDown(screen.getByTestId('canvas-background'), { clientX: 400, clientY: 300 });
    expect(screen.getByTestId('selection-state')).toBeEmptyDOMElement();

    pointerDown(word, { clientX: 230, clientY: 140, pointerId: 2 });
    pointerUp(root, { clientX: 230, clientY: 140, pointerId: 2 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('selection-state')).toBeEmptyDOMElement();
  });

  it.each(['missing', 'non-invertible', 'non-finite'] as const)(
    'does not commit when the SVG transformation is %s',
    (mode) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const onAction = vi.fn();
      render(<InteractionHarness onAction={onAction} />);
      const root = screen.getByTestId('interaction-root');
      transformMode = mode;

      pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }));
      pointerUp(root);

      expect(onAction).not.toHaveBeenCalled();
      expect(currentDocument().elements).toEqual([]);
      expect(screen.getByRole('alert')).toHaveTextContent('could not be mapped');
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
      expect(consoleError).toHaveBeenCalled();
    },
  );

  it('reports capture setup failure without leaving an active gesture', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onAction = vi.fn();
    setPointerCapture.mockImplementationOnce(() => {
      throw new Error('Capture unavailable');
    });
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }));
    pointerUp(root);

    expect(onAction).not.toHaveBeenCalled();
    expect(releasePointerCapture).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be started');
    expect(consoleError).toHaveBeenCalled();
  });

  it('contains pointer capture release failures after a successful commit', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onAction = vi.fn();
    releasePointerCapture.mockImplementationOnce(() => {
      throw new Error('Capture already lost');
    });
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }));
    expect(() => pointerUp(root)).not.toThrow();

    expect(onAction).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'Pointer capture could not be released.',
      expect.any(Error),
    );
  });

  it('ignores a foreign simultaneous pointer', () => {
    const onAction = vi.fn();
    render(<InteractionHarness onAction={onAction} />);
    const root = screen.getByTestId('interaction-root');

    pointerDown(screen.getByRole('button', { name: 'Place token 1: same' }), {
      pointerId: 11,
      pointerType: 'touch',
    });
    pointerMove(root, { pointerId: 12, pointerType: 'touch' });
    pointerUp(root, { pointerId: 12, pointerType: 'touch' });

    expect(onAction).not.toHaveBeenCalled();
    expect(releasePointerCapture).not.toHaveBeenCalled();

    pointerUp(root, { pointerId: 11, pointerType: 'touch' });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(releasePointerCapture).toHaveBeenCalledWith(11);
  });
});
