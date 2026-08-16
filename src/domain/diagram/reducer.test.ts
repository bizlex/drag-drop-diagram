import { describe, expect, it } from 'vitest';

import type { DomainDependencies, DomainResult } from './operations';
import { createDiagramReducer } from './reducer';
import { makeDocument } from './testFixtures';
import type { DiagramDocument } from './types';

function dependencies(...ids: string[]): DomainDependencies {
  let index = 0;
  return {
    generateId: () => {
      const id = ids[index];
      if (!id) throw new Error('Test ID generator exhausted');
      index += 1;
      return id;
    },
    now: () => '2026-08-16T15:00:00.000Z',
  };
}

function unwrap(result: DomainResult<DiagramDocument>): DiagramDocument {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('diagramReducer', () => {
  it('delegates placement, movement, junction, connector, endpoint, and deletion actions', () => {
    const reduce = createDiagramReducer(
      dependencies('word-1', 'junction-1', 'line-1', 'arrow-1'),
    );
    const placed = unwrap(
      reduce(makeDocument(), {
        type: 'PLACE_TOKEN',
        payload: { tokenId: 'token-1', x: 1, y: 2 },
      }),
    );
    const moved = unwrap(
      reduce(placed, {
        type: 'MOVE_ELEMENT',
        payload: { elementId: 'word-1', x: 10, y: 20 },
      }),
    );
    const junction = unwrap(
      reduce(moved, { type: 'ADD_JUNCTION', payload: { x: 30, y: 40 } }),
    );
    const line = unwrap(
      reduce(junction, {
        type: 'ADD_CONNECTOR',
        payload: {
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'right' },
          end: { kind: 'junction', elementId: 'junction-1' },
        },
      }),
    );
    const arrow = unwrap(
      reduce(line, {
        type: 'ADD_CONNECTOR',
        payload: {
          variant: 'arrow',
          start: { kind: 'point', x: 1, y: 1 },
          end: { kind: 'point', x: 2, y: 2 },
        },
      }),
    );
    const endpointMoved = unwrap(
      reduce(arrow, {
        type: 'MOVE_CONNECTOR_ENDPOINT',
        payload: { connectorId: 'arrow-1', endpoint: 'end', x: 5, y: 6 },
      }),
    );
    const deleted = unwrap(
      reduce(endpointMoved, {
        type: 'DELETE_ELEMENT',
        payload: { elementId: 'word-1' },
      }),
    );

    expect(deleted.elements.map(({ id }) => id)).toEqual([
      'junction-1',
      'arrow-1',
    ]);
    expect(deleted.elements).toContainEqual(
      expect.objectContaining({
        id: 'arrow-1',
        end: { kind: 'point', x: 5, y: 6 },
      }),
    );
  });

  it('delegates document replacement and preserves operation errors', () => {
    const reduce = createDiagramReducer(dependencies('unused'));
    const current = makeDocument();
    const imported: DiagramDocument = {
      ...makeDocument(),
      id: 'imported',
      title: 'Imported document',
    };

    const replacement = reduce(current, {
      type: 'REPLACE_DOCUMENT_FROM_IMPORT',
      payload: { document: imported },
    });
    const invalidPlacement = reduce(current, {
      type: 'PLACE_TOKEN',
      payload: { tokenId: 'missing', x: 1, y: 2 },
    });

    expect(unwrap(replacement).title).toBe('Imported document');
    expect(invalidPlacement).toMatchObject({
      ok: false,
      error: { code: 'TOKEN_NOT_FOUND' },
    });
    expect(current).toEqual(makeDocument());
  });
});
