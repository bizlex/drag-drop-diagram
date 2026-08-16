import type {
  ConnectorElement,
  DiagramDocument,
  EntityId,
} from './types';

export function selectElementById(document: DiagramDocument, elementId: EntityId) {
  return document.elements.find((element) => element.id === elementId);
}

export function selectTokenById(document: DiagramDocument, tokenId: EntityId) {
  return document.tokens.find((token) => token.id === tokenId);
}

export function selectPlacedTokenIds(document: DiagramDocument): Set<EntityId> {
  return new Set(
    document.elements.flatMap((element) =>
      element.type === 'word' ? [element.tokenId] : [],
    ),
  );
}

export function selectAvailableTokens(document: DiagramDocument) {
  const placedTokenIds = selectPlacedTokenIds(document);
  return document.tokens.filter((token) => !placedTokenIds.has(token.id));
}

export function selectConnectorsForElement(
  document: DiagramDocument,
  elementId: EntityId,
): ConnectorElement[] {
  return document.elements.filter(
    (element): element is ConnectorElement =>
      element.type === 'connector' &&
      [element.start, element.end].some(
        (endpoint) =>
          endpoint.kind !== 'point' && endpoint.elementId === elementId,
      ),
  );
}
