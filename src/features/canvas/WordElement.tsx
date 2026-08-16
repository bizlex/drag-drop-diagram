import { selectTokenById } from '../../domain/diagram/selectors';
import type { DiagramDocument, WordElement as WordElementModel } from '../../domain/diagram/types';

interface WordElementProps {
  document: DiagramDocument;
  element: WordElementModel;
}

/**
 * SVG text uses x/y as the left edge and alphabetic-baseline position.
 * The document owns both the position and token reference; this component
 * resolves the text from that authoritative document on every render.
 */
export function WordElement({ document, element }: WordElementProps) {
  const token = selectTokenById(document, element.tokenId);

  // A validated document always has this token. Do not substitute copied text
  // if an invalid document reaches the renderer.
  if (!token) return null;

  return (
    <text
      data-diagram-element-id={element.id}
      data-testid={`word-element-${element.id}`}
      x={element.x}
      y={element.y}
    >
      {token.text}
    </text>
  );
}
