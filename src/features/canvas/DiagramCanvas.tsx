import { useCallback, useLayoutEffect, useState } from 'react';

import type { DiagramDocument, EntityId, WordElement as WordElementModel } from '../../domain/diagram/types';
import { WordElement } from './WordElement';
import type { CanvasInteractionPreview } from './useCanvasInteraction';
import styles from './DiagramCanvas.module.css';

interface DiagramCanvasProps {
  document: DiagramDocument | null;
  interactionPreview?: CanvasInteractionPreview | null;
  onSvgChange?: (svg: SVGSVGElement | null) => void;
  selectedElementId?: EntityId | null;
}

const SELECTION_PADDING = 6;

interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function SelectionOverlay({
  document,
  svg,
  word,
}: {
  document: DiagramDocument;
  svg: SVGSVGElement | null;
  word: WordElementModel;
}) {
  const token = document.tokens.find((item) => item.id === word.tokenId);
  const [bounds, setBounds] = useState<TextBounds | null>(null);

  useLayoutEffect(() => {
    setBounds(null);
    if (!svg || !token) return;

    const text = [...svg.querySelectorAll<SVGTextElement>('text')].find(
      (element) => element.dataset.diagramElementId === word.id,
    );
    if (!text) return;

    let cancelled = false;
    const measure = () => {
      try {
        const nextBounds = text.getBBox();
        if (
          !cancelled &&
          [nextBounds.x, nextBounds.y, nextBounds.width, nextBounds.height].every(
            Number.isFinite,
          )
        ) {
          setBounds(nextBounds);
        }
      } catch {
        if (!cancelled) setBounds(null);
      }
    };

    measure();
    const frameId = requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [svg, token, word.id, word.x, word.y]);

  if (!token || !bounds) return null;

  const x = bounds.x - SELECTION_PADDING;
  const y = bounds.y - SELECTION_PADDING;
  const width = bounds.width + SELECTION_PADDING * 2;
  const height = bounds.height + SELECTION_PADDING * 2;

  return (
    <g
      aria-label={`Selected word: ${token.text}`}
      data-selected-element-id={word.id}
      data-testid={`selection-overlay-${word.id}`}
    >
      <rect className={styles.selectionOutline} height={height} width={width} x={x} y={y} />
      <rect className={styles.selectionHandle} height="5" width="5" x={x - 2.5} y={y - 2.5} />
      <rect className={styles.selectionHandle} height="5" width="5" x={x + width - 2.5} y={y + height - 2.5} />
    </g>
  );
}

export function DiagramCanvas({
  document,
  interactionPreview = null,
  onSvgChange,
  selectedElementId = null,
}: DiagramCanvasProps) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const setSvgRef = useCallback((node: SVGSVGElement | null) => {
    setSvg(node);
    onSvgChange?.(node);
  }, [onSvgChange]);

  if (!document) {
    return (
      <div className={styles.emptyState} role="status">
        Create a diagram from source text to open the SVG workspace.
      </div>
    );
  }

  const renderedWords = document.elements.flatMap((element) => {
    if (element.type !== 'word') return [];
    if (interactionPreview?.kind === 'move' && interactionPreview.elementId === element.id) {
      return [{ ...element, ...interactionPreview.position }];
    }
    return [element];
  });
  const selectedWord = renderedWords.find(
    (element): element is WordElementModel =>
      element.id === selectedElementId,
  );
  const placementToken =
    interactionPreview?.kind === 'placement'
      ? document.tokens.find((token) => token.id === interactionPreview.tokenId)
      : null;

  return (
    <div className={styles.scrollArea}>
      <svg
        aria-label="Diagram SVG workspace"
        className={styles.canvas}
        data-canvas-interaction-surface="canvas"
        height={document.canvas.height}
        role="group"
        ref={setSvgRef}
        viewBox={`0 0 ${document.canvas.width} ${document.canvas.height}`}
        width={document.canvas.width}
      >
        <g data-diagram-layer="background">
          <rect
            data-canvas-interaction-surface="canvas"
            data-testid="canvas-background"
            fill={document.canvas.background}
            height={document.canvas.height}
            width={document.canvas.width}
            x="0"
            y="0"
          />
        </g>
        <g data-diagram-layer="connectors" />
        <g data-diagram-layer="junctions" />
        <g data-diagram-layer="words">
          {renderedWords.map((element) => (
            <WordElement
              document={document}
              element={element}
              key={element.id}
              selected={element.id === selectedElementId}
            />
          ))}
        </g>
        <g
          className={styles.selectionLayer}
          data-diagram-layer="selection-and-previews"
        >
          {selectedWord && <SelectionOverlay document={document} svg={svg} word={selectedWord} />}
          {placementToken && interactionPreview?.kind === 'placement' && (
            <text
              aria-hidden="true"
              className={styles.interactionPreview}
              data-testid={`placement-preview-${placementToken.id}`}
              x={interactionPreview.position.x}
              y={interactionPreview.position.y}
            >
              {placementToken.text}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
