import { useCallback, useLayoutEffect, useState } from 'react';

import type { DiagramDocument, EntityId, WordElement as WordElementModel } from '../../domain/diagram/types';
import { WordElement } from './WordElement';
import styles from './DiagramCanvas.module.css';

interface DiagramCanvasProps {
  document: DiagramDocument | null;
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

export function DiagramCanvas({ document, selectedElementId = null }: DiagramCanvasProps) {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const setSvgRef = useCallback((node: SVGSVGElement | null) => {
    setSvg(node);
  }, []);

  if (!document) {
    return (
      <div className={styles.emptyState} role="status">
        Create a diagram from source text to open the SVG workspace.
      </div>
    );
  }

  const selectedWord = document.elements.find(
    (element): element is WordElementModel =>
      element.id === selectedElementId && element.type === 'word',
  );

  return (
    <div className={styles.scrollArea}>
      <svg
        aria-label="Diagram SVG workspace"
        className={styles.canvas}
        height={document.canvas.height}
        role="img"
        ref={setSvgRef}
        viewBox={`0 0 ${document.canvas.width} ${document.canvas.height}`}
        width={document.canvas.width}
      >
        <g data-diagram-layer="background">
          <rect
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
          {document.elements.map((element) =>
            element.type === 'word' ? (
              <WordElement document={document} element={element} key={element.id} />
            ) : null,
          )}
        </g>
        <g data-diagram-layer="selection-and-previews">
          {selectedWord && <SelectionOverlay document={document} svg={svg} word={selectedWord} />}
        </g>
      </svg>
    </div>
  );
}
