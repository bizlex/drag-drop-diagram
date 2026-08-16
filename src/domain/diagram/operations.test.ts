import { describe, expect, it } from 'vitest';

import {
  addConnector,
  addJunction,
  createDiagramDocument,
  deleteElement,
  moveConnectorEndpoint,
  moveElement,
  placeToken,
  replaceDocumentFromImport,
  type DomainDependencies,
  type DomainResult,
} from './operations';
import { CREATED_AT, makeDocument } from './testFixtures';
import type { DiagramDocument } from './types';

const MUTATION_TIME = '2026-08-16T12:00:00.000Z';

function dependencies(...ids: string[]): DomainDependencies {
  let index = 0;
  return {
    generateId: () => {
      const id = ids[index];
      if (!id) throw new Error('Test ID generator exhausted');
      index += 1;
      return id;
    },
    now: () => MUTATION_TIME,
  };
}

function unwrap<T>(result: DomainResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('diagram operations', () => {
  it('creates a validated base document from prepared tokens with deterministic ID and time', () => {
    const tokens = [
      { id: 'token-a', index: 0, text: 'word' },
      { id: 'token-b', index: 1, text: 'word' },
    ];

    const result = createDiagramDocument(
      {
        title: 'Prepared document',
        sourceText: 'word word',
        tokens,
        canvas: { width: 640, height: 480, background: 'white' },
      },
      dependencies('document-created'),
    );

    const document = unwrap(result);
    expect(document).toMatchObject({
      schemaVersion: 1,
      id: 'document-created',
      createdAt: MUTATION_TIME,
      updatedAt: MUTATION_TIME,
      elements: [],
    });
    expect(document.tokens).not.toBe(tokens);
  });

  it('places a token immutably with deterministic ID and timestamp', () => {
    const original = makeDocument();
    const snapshot = structuredClone(original);

    const result = placeToken(
      original,
      { tokenId: 'token-1', x: 10, y: 20 },
      dependencies('word-created'),
    );

    const document = unwrap(result);
    expect(original).toEqual(snapshot);
    expect(document).not.toBe(original);
    expect(document.elements).toContainEqual({
      id: 'word-created',
      type: 'word',
      tokenId: 'token-1',
      x: 10,
      y: 20,
    });
    expect(document.updatedAt).toBe(MUTATION_TIME);
  });

  it('rejects placing a missing or already placed token without changing the document', () => {
    const original = makeDocument();
    const placed = unwrap(
      placeToken(
        original,
        { tokenId: 'token-1', x: 10, y: 20 },
        dependencies('word-1'),
      ),
    );
    const snapshot = structuredClone(placed);

    const missing = placeToken(
      placed,
      { tokenId: 'missing', x: 1, y: 2 },
      dependencies('unused-1'),
    );
    const duplicate = placeToken(
      placed,
      { tokenId: 'token-1', x: 3, y: 4 },
      dependencies('unused-2'),
    );

    expect(missing).toMatchObject({ ok: false, error: { code: 'TOKEN_NOT_FOUND' } });
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: 'TOKEN_ALREADY_PLACED' },
    });
    expect(placed).toEqual(snapshot);
  });

  it('moves word and junction elements immutably', () => {
    const withWord = unwrap(
      placeToken(
        makeDocument(),
        { tokenId: 'token-1', x: 1, y: 2 },
        dependencies('word-1'),
      ),
    );
    const withJunction = unwrap(
      addJunction(withWord, { x: 3, y: 4 }, dependencies('junction-1')),
    );

    const movedWord = unwrap(
      moveElement(
        withJunction,
        { elementId: 'word-1', x: 11, y: 12 },
        dependencies('unused'),
      ),
    );
    const movedBoth = unwrap(
      moveElement(
        movedWord,
        { elementId: 'junction-1', x: 13, y: 14 },
        dependencies('unused'),
      ),
    );

    expect(withJunction.elements).toContainEqual(
      expect.objectContaining({ id: 'word-1', x: 1, y: 2 }),
    );
    expect(movedBoth.elements).toContainEqual(
      expect.objectContaining({ id: 'word-1', x: 11, y: 12 }),
    );
    expect(movedBoth.elements).toContainEqual(
      expect.objectContaining({ id: 'junction-1', x: 13, y: 14 }),
    );
    expect(movedBoth.createdAt).toBe(withJunction.createdAt);
  });

  it('keeps attached connector endpoints semantic when their element moves', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
        { id: 'junction-1', type: 'junction', x: 3, y: 4 },
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'right' },
          end: { kind: 'junction', elementId: 'junction-1' },
        },
      ],
    };

    const moved = unwrap(
      moveElement(
        document,
        { elementId: 'word-1', x: 11, y: 12 },
        dependencies('unused'),
      ),
    );

    expect(moved.elements).toContainEqual(
      expect.objectContaining({
        id: 'connector-1',
        start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'right' },
        end: { kind: 'junction', elementId: 'junction-1' },
      }),
    );
  });

  it('adds line and arrow connectors and moves a free endpoint', () => {
    const generator = dependencies('line-1', 'arrow-1');
    const lineDocument = unwrap(
      addConnector(
        makeDocument(),
        {
          variant: 'line',
          start: { kind: 'point', x: 1, y: 2 },
          end: { kind: 'point', x: 3, y: 4 },
        },
        generator,
      ),
    );
    const arrowDocument = unwrap(
      addConnector(
        lineDocument,
        {
          variant: 'arrow',
          start: { kind: 'point', x: 5, y: 6 },
          end: { kind: 'point', x: 7, y: 8 },
        },
        generator,
      ),
    );

    const moved = unwrap(
      moveConnectorEndpoint(
        arrowDocument,
        { connectorId: 'arrow-1', endpoint: 'end', x: 70, y: 80 },
        dependencies('unused'),
      ),
    );

    expect(moved.elements).toContainEqual(
      expect.objectContaining({ id: 'line-1', variant: 'line' }),
    );
    expect(moved.elements).toContainEqual(
      expect.objectContaining({
        id: 'arrow-1',
        variant: 'arrow',
        end: { kind: 'point', x: 70, y: 80 },
      }),
    );
  });

  it('rejects an invalid connector atomically', () => {
    const original = makeDocument();
    const snapshot = structuredClone(original);

    const result = addConnector(
      original,
      {
        variant: 'line',
        start: { kind: 'point', x: 1, y: 1 },
        end: { kind: 'point', x: 1, y: 1 },
      },
      dependencies('connector-invalid'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'DOCUMENT_INVALID' },
    });
    expect(original).toEqual(snapshot);
  });

  it('rejects moving a semantic endpoint and an invalid free-endpoint move atomically', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'junction-1', type: 'junction', x: 1, y: 2 },
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'junction', elementId: 'junction-1' },
          end: { kind: 'point', x: 3, y: 4 },
        },
        {
          id: 'free-connector',
          type: 'connector',
          variant: 'line',
          start: { kind: 'point', x: 5, y: 6 },
          end: { kind: 'point', x: 7, y: 8 },
        },
      ],
    };
    const snapshot = structuredClone(document);

    const attached = moveConnectorEndpoint(
      document,
      { connectorId: 'connector-1', endpoint: 'start', x: 10, y: 20 },
      dependencies('unused'),
    );
    const identical = moveConnectorEndpoint(
      document,
      { connectorId: 'free-connector', endpoint: 'end', x: 5, y: 6 },
      dependencies('unused'),
    );

    expect(attached).toMatchObject({
      ok: false,
      error: { code: 'ENDPOINT_NOT_FREE' },
    });
    expect(identical).toMatchObject({
      ok: false,
      error: { code: 'DOCUMENT_INVALID' },
    });
    expect(document).toEqual(snapshot);
  });

  it('cascade-deletes connectors attached to a deleted word or junction', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
        { id: 'junction-1', type: 'junction', x: 3, y: 4 },
        {
          id: 'attached',
          type: 'connector',
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'right' },
          end: { kind: 'junction', elementId: 'junction-1' },
        },
        {
          id: 'free',
          type: 'connector',
          variant: 'arrow',
          start: { kind: 'point', x: 10, y: 10 },
          end: { kind: 'point', x: 20, y: 20 },
        },
      ],
    };

    const afterWordDeletion = unwrap(
      deleteElement(document, 'word-1', dependencies('unused')),
    );
    const afterJunctionDeletion = unwrap(
      deleteElement(document, 'junction-1', dependencies('unused')),
    );

    expect(afterWordDeletion.elements.map(({ id }) => id)).toEqual([
      'junction-1',
      'free',
    ]);
    expect(afterJunctionDeletion.elements.map(({ id }) => id)).toEqual([
      'word-1',
      'free',
    ]);
  });

  it('deleting a connector leaves words and junctions unchanged', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
        { id: 'junction-1', type: 'junction', x: 3, y: 4 },
        {
          id: 'connector-1',
          type: 'connector',
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'right' },
          end: { kind: 'junction', elementId: 'junction-1' },
        },
      ],
    };

    const result = unwrap(
      deleteElement(document, 'connector-1', dependencies('unused')),
    );

    expect(result.elements).toEqual(document.elements.slice(0, 2));
  });

  it('atomically replaces a prevalidated imported document and updates its timestamp', () => {
    const current = makeDocument();
    const imported: DiagramDocument = {
      ...makeDocument(),
      id: 'imported-document',
      title: 'Imported',
      createdAt: CREATED_AT,
    };

    const replacement = unwrap(
      replaceDocumentFromImport(imported, dependencies('unused')),
    );

    expect(replacement).not.toBe(imported);
    expect(replacement.title).toBe('Imported');
    expect(replacement.updatedAt).toBe(MUTATION_TIME);
    expect(current).toEqual(makeDocument());
  });

  it('rejects an invalid import without producing a replacement document', () => {
    const invalidImport: DiagramDocument = {
      ...makeDocument(),
      tokens: [
        makeDocument().tokens[0],
        { ...makeDocument().tokens[1], id: 'token-1' },
      ],
    };

    const result = replaceDocumentFromImport(
      invalidImport,
      dependencies('unused'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'DOCUMENT_INVALID' },
    });
  });
});
