import { generateEntityId, type IdGenerator } from '../../shared/ids';
import { currentIsoTimestamp, type Clock } from '../../shared/time';
import { validateDiagramDocument } from './schema';
import { tokenizeSourceText } from './tokenizer';
import type {
  CanvasSettings,
  ConnectorElement,
  ConnectorEndpoint,
  DiagramDocument,
  EntityId,
  SourceToken,
} from './types';

export type DomainErrorCode =
  | 'DOCUMENT_INVALID'
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_ALREADY_PLACED'
  | 'ELEMENT_NOT_FOUND'
  | 'ELEMENT_NOT_MOVABLE'
  | 'ENDPOINT_NOT_FREE'
  | 'EMPTY_SOURCE_TEXT';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  issues?: readonly string[];
}

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export interface DomainDependencies {
  generateId: IdGenerator;
  now: Clock;
}

export const defaultDomainDependencies: DomainDependencies = {
  generateId: generateEntityId,
  now: currentIsoTimestamp,
};

export interface CreateDocumentInput {
  title: string;
  sourceText: string;
  tokens: SourceToken[];
  canvas: CanvasSettings;
}

export interface CreateDocumentFromTextInput {
  title: string;
  sourceText: string;
  canvas: CanvasSettings;
}

export interface ResetDocumentFromTextInput {
  sourceText: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface PlaceTokenInput extends Position {
  tokenId: EntityId;
}

export interface MoveElementInput extends Position {
  elementId: EntityId;
}

export interface AddConnectorInput {
  variant: ConnectorElement['variant'];
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
}

export interface MoveConnectorEndpointInput extends Position {
  connectorId: EntityId;
  endpoint: 'start' | 'end';
}

function failure(code: DomainErrorCode, message: string): DomainResult<never> {
  return { ok: false, error: { code, message } };
}

function sourceTextIsEmpty(sourceText: string) {
  return !/\S/u.test(sourceText);
}

function invalidSourceText(): DomainResult<never> {
  return failure('EMPTY_SOURCE_TEXT', 'Source text must contain at least one non-whitespace character');
}

function validateCandidate(candidate: unknown): DomainResult<DiagramDocument> {
  const result = validateDiagramDocument(candidate);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    error: {
      code: 'DOCUMENT_INVALID',
      message: 'The diagram document violates domain invariants',
      issues: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      }),
    },
  };
}

function cloneEndpoint(endpoint: ConnectorEndpoint): ConnectorEndpoint {
  return { ...endpoint };
}

function withUpdatedAt(
  document: DiagramDocument,
  dependencies: DomainDependencies,
): DiagramDocument {
  return { ...document, updatedAt: dependencies.now() };
}

export function createDiagramDocument(
  input: CreateDocumentInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  const timestamp = dependencies.now();
  return validateCandidate({
    schemaVersion: 1,
    id: dependencies.generateId(),
    title: input.title,
    sourceText: input.sourceText,
    tokens: input.tokens.map((token) => ({ ...token })),
    elements: [],
    canvas: { ...input.canvas },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function createDocumentFromText(
  input: CreateDocumentFromTextInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  if (sourceTextIsEmpty(input.sourceText)) return invalidSourceText();
  const timestamp = dependencies.now();
  const documentId = dependencies.generateId();
  return validateCandidate({
    schemaVersion: 1,
    id: documentId,
    title: input.title,
    sourceText: input.sourceText,
    tokens: tokenizeSourceText(input.sourceText, dependencies.generateId),
    elements: [],
    canvas: { ...input.canvas },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function resetDocumentFromText(
  document: DiagramDocument,
  input: ResetDocumentFromTextInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  if (sourceTextIsEmpty(input.sourceText)) return invalidSourceText();

  return validateCandidate({
    ...document,
    sourceText: input.sourceText,
    tokens: tokenizeSourceText(input.sourceText, dependencies.generateId),
    elements: [],
    updatedAt: dependencies.now(),
  });
}

export function placeToken(
  document: DiagramDocument,
  input: PlaceTokenInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  if (!document.tokens.some((token) => token.id === input.tokenId)) {
    return failure('TOKEN_NOT_FOUND', `Token does not exist: ${input.tokenId}`);
  }
  if (
    document.elements.some(
      (element) => element.type === 'word' && element.tokenId === input.tokenId,
    )
  ) {
    return failure(
      'TOKEN_ALREADY_PLACED',
      `Token is already placed: ${input.tokenId}`,
    );
  }

  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: [
      ...document.elements,
      {
        id: dependencies.generateId(),
        type: 'word',
        tokenId: input.tokenId,
        x: input.x,
        y: input.y,
      },
    ],
  });
}

export function moveElement(
  document: DiagramDocument,
  input: MoveElementInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  const element = document.elements.find((item) => item.id === input.elementId);
  if (!element) {
    return failure('ELEMENT_NOT_FOUND', `Element does not exist: ${input.elementId}`);
  }
  if (element.type === 'connector') {
    return failure(
      'ELEMENT_NOT_MOVABLE',
      `Connector must be moved through one of its endpoints: ${input.elementId}`,
    );
  }

  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: document.elements.map((item) =>
      item.id === input.elementId ? { ...item, x: input.x, y: input.y } : item,
    ),
  });
}

export function addJunction(
  document: DiagramDocument,
  position: Position,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: [
      ...document.elements,
      {
        id: dependencies.generateId(),
        type: 'junction',
        x: position.x,
        y: position.y,
      },
    ],
  });
}

export function addConnector(
  document: DiagramDocument,
  input: AddConnectorInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: [
      ...document.elements,
      {
        id: dependencies.generateId(),
        type: 'connector',
        variant: input.variant,
        start: cloneEndpoint(input.start),
        end: cloneEndpoint(input.end),
      },
    ],
  });
}

export function moveConnectorEndpoint(
  document: DiagramDocument,
  input: MoveConnectorEndpointInput,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  const connector = document.elements.find(
    (element): element is ConnectorElement =>
      element.id === input.connectorId && element.type === 'connector',
  );
  if (!connector) {
    return failure(
      'ELEMENT_NOT_FOUND',
      `Connector does not exist: ${input.connectorId}`,
    );
  }
  if (connector[input.endpoint].kind !== 'point') {
    return failure(
      'ENDPOINT_NOT_FREE',
      `Connector ${input.endpoint} endpoint is attached and cannot be moved as a free point`,
    );
  }

  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: document.elements.map((element) => {
      if (element.id !== input.connectorId || element.type !== 'connector') {
        return element;
      }
      return {
        ...element,
        [input.endpoint]: { kind: 'point', x: input.x, y: input.y },
      };
    }),
  });
}

function connectorReferencesElement(
  connector: ConnectorElement,
  elementId: EntityId,
) {
  return [connector.start, connector.end].some(
    (endpoint) => endpoint.kind !== 'point' && endpoint.elementId === elementId,
  );
}

export function deleteElement(
  document: DiagramDocument,
  elementId: EntityId,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  const target = document.elements.find((element) => element.id === elementId);
  if (!target) {
    return failure('ELEMENT_NOT_FOUND', `Element does not exist: ${elementId}`);
  }

  return validateCandidate({
    ...withUpdatedAt(document, dependencies),
    elements: document.elements.filter((element) => {
      if (element.id === elementId) return false;
      return !(
        target.type !== 'connector' &&
        element.type === 'connector' &&
        connectorReferencesElement(element, elementId)
      );
    }),
  });
}

export function replaceDocumentFromImport(
  importedDocument: DiagramDocument,
  dependencies: DomainDependencies = defaultDomainDependencies,
): DomainResult<DiagramDocument> {
  const validation = validateDiagramDocument(importedDocument);
  if (!validation.success) return validateCandidate(importedDocument);

  return validateCandidate({
    ...validation.data,
    updatedAt: dependencies.now(),
  });
}
