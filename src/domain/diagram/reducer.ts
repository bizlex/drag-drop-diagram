import {
  addConnector,
  addJunction,
  defaultDomainDependencies,
  deleteElement,
  moveConnectorEndpoint,
  moveElement,
  placeToken,
  replaceDocumentFromImport,
  type AddConnectorInput,
  type DomainDependencies,
  type DomainResult,
  type MoveConnectorEndpointInput,
  type MoveElementInput,
  type PlaceTokenInput,
  type Position,
} from './operations';
import type { DiagramDocument, EntityId } from './types';

export type DiagramAction =
  | { type: 'PLACE_TOKEN'; payload: PlaceTokenInput }
  | { type: 'MOVE_ELEMENT'; payload: MoveElementInput }
  | { type: 'ADD_JUNCTION'; payload: Position }
  | { type: 'ADD_CONNECTOR'; payload: AddConnectorInput }
  | { type: 'MOVE_CONNECTOR_ENDPOINT'; payload: MoveConnectorEndpointInput }
  | { type: 'DELETE_ELEMENT'; payload: { elementId: EntityId } }
  | {
      type: 'REPLACE_DOCUMENT_FROM_IMPORT';
      payload: { document: DiagramDocument };
    };

export type DiagramReducer = (
  document: DiagramDocument,
  action: DiagramAction,
) => DomainResult<DiagramDocument>;

export function createDiagramReducer(
  dependencies: DomainDependencies = defaultDomainDependencies,
): DiagramReducer {
  return (document, action) => {
    switch (action.type) {
      case 'PLACE_TOKEN':
        return placeToken(document, action.payload, dependencies);
      case 'MOVE_ELEMENT':
        return moveElement(document, action.payload, dependencies);
      case 'ADD_JUNCTION':
        return addJunction(document, action.payload, dependencies);
      case 'ADD_CONNECTOR':
        return addConnector(document, action.payload, dependencies);
      case 'MOVE_CONNECTOR_ENDPOINT':
        return moveConnectorEndpoint(document, action.payload, dependencies);
      case 'DELETE_ELEMENT':
        return deleteElement(document, action.payload.elementId, dependencies);
      case 'REPLACE_DOCUMENT_FROM_IMPORT':
        return replaceDocumentFromImport(action.payload.document, dependencies);
    }
  };
}

export const diagramReducer = createDiagramReducer();
