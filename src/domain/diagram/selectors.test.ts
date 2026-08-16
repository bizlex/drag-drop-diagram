import { describe, expect, it } from 'vitest';

import {
  selectAvailableTokens,
  selectConnectorsForElement,
  selectElementById,
  selectPlacedTokenIds,
  selectTokenById,
} from './selectors';
import { makeDocument } from './testFixtures';
import type { DiagramDocument } from './types';

describe('diagram selectors', () => {
  it('finds elements and tokens by ID', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
      ],
    };

    expect(selectElementById(document, 'word-1')).toEqual(document.elements[0]);
    expect(selectElementById(document, 'missing')).toBeUndefined();
    expect(selectTokenById(document, 'token-2')).toEqual(document.tokens[1]);
    expect(selectTokenById(document, 'missing')).toBeUndefined();
  });

  it('selects placed IDs and available tokens in source order', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-2', type: 'word', tokenId: 'token-2', x: 1, y: 2 },
      ],
    };

    expect([...selectPlacedTokenIds(document)]).toEqual(['token-2']);
    expect(selectAvailableTokens(document)).toEqual([document.tokens[0]]);
  });

  it('selects only connectors semantically attached to an element', () => {
    const document: DiagramDocument = {
      ...makeDocument(),
      elements: [
        { id: 'word-1', type: 'word', tokenId: 'token-1', x: 1, y: 2 },
        {
          id: 'attached',
          type: 'connector',
          variant: 'line',
          start: { kind: 'word-anchor', elementId: 'word-1', anchor: 'left' },
          end: { kind: 'point', x: 5, y: 6 },
        },
        {
          id: 'free',
          type: 'connector',
          variant: 'line',
          start: { kind: 'point', x: 1, y: 2 },
          end: { kind: 'point', x: 3, y: 4 },
        },
      ],
    };

    expect(selectConnectorsForElement(document, 'word-1').map(({ id }) => id)).toEqual([
      'attached',
    ]);
  });
});
