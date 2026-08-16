import { describe, expect, it } from 'vitest';

import { validateDiagramDocument } from './schema';
import { makeDocument } from './testFixtures';
import type { ConnectorElement, DiagramDocument } from './types';

function withElements(
  document: DiagramDocument,
  elements: DiagramDocument['elements'],
): DiagramDocument {
  return { ...document, elements };
}

describe('diagramDocumentSchema', () => {
  it('accepts a correct minimal document and repeated token strings with distinct IDs', () => {
    const document = makeDocument();

    const result = validateDiagramDocument(document);

    expect(result.success).toBe(true);
  });

  it('rejects an unknown schema version with a useful error', () => {
    const result = validateDiagramDocument({
      ...makeDocument(),
      schemaVersion: 2,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('only version 1');
    }
  });

  it('rejects unknown fields at document and discriminated-union levels', () => {
    const document = makeDocument();
    const rootResult = validateDiagramDocument({ ...document, unexpected: true });
    const tokenResult = validateDiagramDocument({
      ...document,
      tokens: [{ ...document.tokens[0], unexpected: true }, document.tokens[1]],
    });
    const canvasResult = validateDiagramDocument({
      ...document,
      canvas: { ...document.canvas, unexpected: true },
    });
    const elementResult = validateDiagramDocument({
      ...document,
      elements: [
        {
          id: 'junction-1',
          type: 'junction',
          x: 1,
          y: 2,
          unexpected: true,
        },
      ],
    });
    const endpointResult = validateDiagramDocument({
      ...document,
      elements: [
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'point', x: 1, y: 2, unexpected: true },
          end: { kind: 'point', x: 3, y: 4 },
        },
      ],
    });

    expect(rootResult.success).toBe(false);
    expect(tokenResult.success).toBe(false);
    expect(canvasResult.success).toBe(false);
    expect(elementResult.success).toBe(false);
    expect(endpointResult.success).toBe(false);
  });

  it('rejects duplicate IDs among tokens, elements, and entity kinds', () => {
    const document = makeDocument();
    const duplicateToken = validateDiagramDocument({
      ...document,
      tokens: [document.tokens[0], { ...document.tokens[1], id: 'token-1' }],
    });
    const duplicateElement = validateDiagramDocument(
      withElements(document, [
        { id: 'element-1', type: 'junction', x: 1, y: 1 },
        { id: 'element-1', type: 'junction', x: 2, y: 2 },
      ]),
    );
    const crossKindDuplicate = validateDiagramDocument(
      withElements(document, [
        { id: 'token-1', type: 'junction', x: 1, y: 1 },
      ]),
    );
    const duplicateDocumentId = validateDiagramDocument({
      ...document,
      id: 'token-1',
    });

    expect(duplicateToken.success).toBe(false);
    expect(duplicateElement.success).toBe(false);
    expect(crossKindDuplicate.success).toBe(false);
    expect(duplicateDocumentId.success).toBe(false);
  });

  it('rejects duplicate, out-of-order, or non-contiguous token indexes', () => {
    const document = makeDocument();
    const duplicate = validateDiagramDocument({
      ...document,
      tokens: document.tokens.map((token) => ({ ...token, index: 0 })),
    });
    const gap = validateDiagramDocument({
      ...document,
      tokens: [document.tokens[0], { ...document.tokens[1], index: 2 }],
    });

    expect(duplicate.success).toBe(false);
    expect(gap.success).toBe(false);
  });

  it('rejects missing token references and placing a token twice', () => {
    const document = makeDocument();
    const missingToken = validateDiagramDocument(
      withElements(document, [
        { id: 'word-1', type: 'word', tokenId: 'missing', x: 1, y: 2 },
      ]),
    );
    const placedTwice = validateDiagramDocument(
      withElements(document, [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
        { id: 'word-2', type: 'word', tokenId: 'token-1', x: 3, y: 4 },
      ]),
    );

    expect(missingToken.success).toBe(false);
    expect(placedTwice.success).toBe(false);
  });

  it('rejects missing connector references and endpoint references of the wrong type', () => {
    const document = makeDocument();
    const connector: ConnectorElement = {
      id: 'connector-1',
      type: 'connector',
      variant: 'line',
      start: { kind: 'junction', elementId: 'missing' },
      end: { kind: 'point', x: 5, y: 5 },
    };
    const missingReference = validateDiagramDocument(
      withElements(document, [connector]),
    );
    const wrongType = validateDiagramDocument(
      withElements(document, [
        { id: 'junction-1', type: 'junction', x: 1, y: 2 },
        {
          ...connector,
          start: {
            kind: 'word-anchor',
            elementId: 'junction-1',
            anchor: 'top',
          },
        },
      ]),
    );

    expect(missingReference.success).toBe(false);
    expect(wrongType.success).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite coordinate %s',
    (coordinate) => {
      const result = validateDiagramDocument(
        withElements(makeDocument(), [
          { id: 'junction-1', type: 'junction', x: coordinate, y: 0 },
        ]),
      );

      expect(result.success).toBe(false);
    },
  );

  it('rejects equal free connector endpoints', () => {
    const result = validateDiagramDocument(
      withElements(makeDocument(), [
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'point', x: 5, y: 8 },
          end: { kind: 'point', x: 5, y: 8 },
        },
      ]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects identical semantic connector endpoints', () => {
    const result = validateDiagramDocument(
      withElements(makeDocument(), [
        { id: 'junction-1', type: 'junction', x: 5, y: 8 },
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'arrow',
          start: { kind: 'junction', elementId: 'junction-1' },
          end: { kind: 'junction', elementId: 'junction-1' },
        },
      ]),
    );

    expect(result.success).toBe(false);
  });

  it('rejects malformed timestamps', () => {
    const result = validateDiagramDocument({
      ...makeDocument(),
      createdAt: '2026-08-15',
      updatedAt: 'not-a-timestamp',
    });

    expect(result.success).toBe(false);
  });

  it('does not guess rendered geometry for distinct word anchors in P1-02', () => {
    const result = validateDiagramDocument(
      withElements(makeDocument(), [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 5, y: 8 },
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'top' },
          end: { kind: 'word-anchor', elementId: 'word-1', anchor: 'bottom' },
        },
      ]),
    );

    expect(result.success).toBe(true);
  });
});
