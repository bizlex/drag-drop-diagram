export type EntityId = string;

export interface DiagramDocument {
  schemaVersion: 1;
  id: EntityId;
  title: string;
  sourceText: string;
  tokens: SourceToken[];
  elements: DiagramElement[];
  canvas: CanvasSettings;
  createdAt: string;
  updatedAt: string;
}

export interface SourceToken {
  id: EntityId;
  index: number;
  text: string;
}

export interface CanvasSettings {
  width: number;
  height: number;
  background: string;
}

export type DiagramElement = WordElement | JunctionElement | ConnectorElement;

export interface WordElement {
  id: EntityId;
  type: 'word';
  tokenId: EntityId;
  x: number;
  y: number;
}

export interface JunctionElement {
  id: EntityId;
  type: 'junction';
  x: number;
  y: number;
}

export interface ConnectorElement {
  id: EntityId;
  type: 'connector';
  variant: 'line' | 'arrow';
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
}

export type ConnectorEndpoint =
  | { kind: 'point'; x: number; y: number }
  | {
      kind: 'word-anchor';
      elementId: EntityId;
      anchor: 'top' | 'right' | 'bottom' | 'left';
    }
  | { kind: 'junction'; elementId: EntityId };
