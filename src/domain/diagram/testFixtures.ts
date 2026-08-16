import type { DiagramDocument } from './types';

export const CREATED_AT = '2026-08-15T10:00:00.000Z';
export const UPDATED_AT = '2026-08-15T11:00:00.000Z';

export function makeDocument(): DiagramDocument {
  return {
    schemaVersion: 1,
    id: 'document-1',
    title: 'Test diagram',
    sourceText: 'same same',
    tokens: [
      { id: 'token-1', index: 0, text: 'same' },
      { id: 'token-2', index: 1, text: 'same' },
    ],
    elements: [],
    canvas: { width: 800, height: 600, background: '#ffffff' },
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}
