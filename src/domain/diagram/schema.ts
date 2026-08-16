import { z } from 'zod';

import type {
  ConnectorEndpoint,
  DiagramDocument,
  DiagramElement,
} from './types';

const entityIdSchema = z.string().min(1, 'Entity IDs must not be empty');
const finiteNumberSchema = z.number().finite('Coordinates must be finite');
const timestampSchema = z.iso.datetime({ offset: true });

const sourceTokenSchema = z
  .object({
    id: entityIdSchema,
    index: z.number().int().nonnegative(),
    text: z.string(),
  })
  .strict();

const canvasSettingsSchema = z
  .object({
    width: finiteNumberSchema,
    height: finiteNumberSchema,
    background: z.string(),
  })
  .strict();

const pointEndpointSchema = z
  .object({
    kind: z.literal('point'),
    x: finiteNumberSchema,
    y: finiteNumberSchema,
  })
  .strict();

const wordAnchorEndpointSchema = z
  .object({
    kind: z.literal('word-anchor'),
    elementId: entityIdSchema,
    anchor: z.enum(['top', 'right', 'bottom', 'left']),
  })
  .strict();

const junctionEndpointSchema = z
  .object({
    kind: z.literal('junction'),
    elementId: entityIdSchema,
  })
  .strict();

export const connectorEndpointSchema = z.discriminatedUnion('kind', [
  pointEndpointSchema,
  wordAnchorEndpointSchema,
  junctionEndpointSchema,
]);

const wordElementSchema = z
  .object({
    id: entityIdSchema,
    type: z.literal('word'),
    tokenId: entityIdSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
  })
  .strict();

const junctionElementSchema = z
  .object({
    id: entityIdSchema,
    type: z.literal('junction'),
    x: finiteNumberSchema,
    y: finiteNumberSchema,
  })
  .strict();

const connectorElementSchema = z
  .object({
    id: entityIdSchema,
    type: z.literal('connector'),
    variant: z.enum(['line', 'arrow']),
    start: connectorEndpointSchema,
    end: connectorEndpointSchema,
  })
  .strict();

export const diagramElementSchema = z.discriminatedUnion('type', [
  wordElementSchema,
  junctionElementSchema,
  connectorElementSchema,
]);

function endpointsAreIdentical(start: ConnectorEndpoint, end: ConnectorEndpoint) {
  if (start.kind !== end.kind) return false;

  if (start.kind === 'point' && end.kind === 'point') {
    return start.x === end.x && start.y === end.y;
  }

  if (start.kind === 'word-anchor' && end.kind === 'word-anchor') {
    return start.elementId === end.elementId && start.anchor === end.anchor;
  }

  return (
    start.kind === 'junction' &&
    end.kind === 'junction' &&
    start.elementId === end.elementId
  );
}

function addDocumentInvariantIssues(
  document: DiagramDocument,
  context: z.RefinementCtx,
) {
  const tokenIds = new Set<string>();
  const allEntityIds = new Set<string>([document.id]);

  document.tokens.forEach((token, position) => {
    if (tokenIds.has(token.id)) {
      context.addIssue({
        code: 'custom',
        path: ['tokens', position, 'id'],
        message: `Duplicate token ID: ${token.id}`,
      });
    }
    tokenIds.add(token.id);

    if (allEntityIds.has(token.id)) {
      context.addIssue({
        code: 'custom',
        path: ['tokens', position, 'id'],
        message: `Entity ID must be globally unique: ${token.id}`,
      });
    }
    allEntityIds.add(token.id);

    if (token.index !== position) {
      context.addIssue({
        code: 'custom',
        path: ['tokens', position, 'index'],
        message: `Token indexes must be the ordered sequence 0..${Math.max(0, document.tokens.length - 1)}`,
      });
    }
  });

  const elementsById = new Map<string, DiagramElement>();
  document.elements.forEach((element, position) => {
    if (elementsById.has(element.id)) {
      context.addIssue({
        code: 'custom',
        path: ['elements', position, 'id'],
        message: `Duplicate element ID: ${element.id}`,
      });
    }
    elementsById.set(element.id, element);

    if (allEntityIds.has(element.id)) {
      context.addIssue({
        code: 'custom',
        path: ['elements', position, 'id'],
        message: `Entity ID must be globally unique: ${element.id}`,
      });
    }
    allEntityIds.add(element.id);
  });

  const placedTokenIds = new Set<string>();
  document.elements.forEach((element, position) => {
    if (element.type === 'word') {
      if (!tokenIds.has(element.tokenId)) {
        context.addIssue({
          code: 'custom',
          path: ['elements', position, 'tokenId'],
          message: `Word references missing token: ${element.tokenId}`,
        });
      }
      if (placedTokenIds.has(element.tokenId)) {
        context.addIssue({
          code: 'custom',
          path: ['elements', position, 'tokenId'],
          message: `Token is placed more than once: ${element.tokenId}`,
        });
      }
      placedTokenIds.add(element.tokenId);
      return;
    }

    if (element.type !== 'connector') return;

    (['start', 'end'] as const).forEach((side) => {
      const endpoint = element[side];
      if (endpoint.kind === 'point') return;

      const referencedElement = elementsById.get(endpoint.elementId);
      if (!referencedElement) {
        context.addIssue({
          code: 'custom',
          path: ['elements', position, side, 'elementId'],
          message: `Connector endpoint references missing element: ${endpoint.elementId}`,
        });
        return;
      }

      const expectedType = endpoint.kind === 'word-anchor' ? 'word' : 'junction';
      if (referencedElement.type !== expectedType) {
        context.addIssue({
          code: 'custom',
          path: ['elements', position, side, 'elementId'],
          message: `${endpoint.kind} endpoint must reference a ${expectedType} element`,
        });
      }
    });

    if (endpointsAreIdentical(element.start, element.end)) {
      context.addIssue({
        code: 'custom',
        path: ['elements', position, 'end'],
        message: 'Connector start and end must be distinct',
      });
    }
  });
}

export const diagramDocumentSchema: z.ZodType<DiagramDocument> = z
  .object({
    schemaVersion: z.custom<1>(
      (value) => value === 1,
      'Unsupported schemaVersion: only version 1 is supported',
    ),
    id: entityIdSchema,
    title: z.string(),
    sourceText: z.string(),
    tokens: z.array(sourceTokenSchema),
    elements: z.array(diagramElementSchema),
    canvas: canvasSettingsSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine(addDocumentInvariantIssues);

export function validateDiagramDocument(input: unknown) {
  return diagramDocumentSchema.safeParse(input);
}
