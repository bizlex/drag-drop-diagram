import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from 'react';

import type { DiagramAction } from '../../domain/diagram/reducer';
import { selectElementById } from '../../domain/diagram/selectors';
import type {
  DiagramDocument,
  EntityId,
} from '../../domain/diagram/types';
import { clientPointToSvg, type SvgPoint } from '../../shared/geometry';

const MOVEMENT_THRESHOLD_PX = 4;
const COORDINATE_ERROR_MESSAGE =
  'The pointer position could not be mapped to the diagram. The gesture was cancelled.';
const CAPTURE_ERROR_MESSAGE =
  'The pointer gesture could not be started. Please try again.';

type CaptureTarget = HTMLElement;

interface GestureBase {
  pointerId: number;
  captureTarget: CaptureTarget;
  documentAtStart: DiagramDocument;
  startClientPoint: SvgPoint;
}

interface PlacementGesture extends GestureBase {
  kind: 'placement';
  tokenId: EntityId;
}

interface MoveGesture extends GestureBase {
  kind: 'move';
  elementId: EntityId;
  grabOffset: SvgPoint;
  movedBeyondThreshold: boolean;
}

type ActiveGesture = PlacementGesture | MoveGesture;

export type CanvasInteractionPreview =
  | { kind: 'placement'; tokenId: EntityId; position: SvgPoint }
  | { kind: 'move'; elementId: EntityId; position: SvgPoint };

interface UseCanvasInteractionOptions {
  document: DiagramDocument | null;
  onCommit: (action: DiagramAction) => void;
}

interface CanvasInteractionRootHandlers {
  onLostPointerCapture: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
}

export interface CanvasInteractionController {
  error: string;
  preview: CanvasInteractionPreview | null;
  rootHandlers: CanvasInteractionRootHandlers;
  selectedElementId: EntityId | null;
  setCanvasSvg: (svg: SVGSVGElement | null) => void;
}

function isPrimaryActivation(event: ReactPointerEvent<HTMLElement>) {
  return event.isPrimary && event.button === 0;
}

function clientPointIsInsideSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
) {
  const bounds = svg.getBoundingClientRect();
  return (
    [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite) &&
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

function movementExceededThreshold(
  gesture: GestureBase,
  clientX: number,
  clientY: number,
) {
  return Math.hypot(
    clientX - gesture.startClientPoint.x,
    clientY - gesture.startClientPoint.y,
  ) >= MOVEMENT_THRESHOLD_PX;
}

function closestDataValue(target: EventTarget | null, attribute: string) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(`[${attribute}]`)?.getAttribute(attribute) ?? null;
}

function reportInteractionError(message: string, error: unknown) {
  console.error(message, error);
}

export function useCanvasInteraction({
  document,
  onCommit,
}: UseCanvasInteractionOptions): CanvasInteractionController {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<EntityId | null>(null);
  const [preview, setPreview] = useState<CanvasInteractionPreview | null>(null);
  const [error, setError] = useState('');

  const setCanvasSvg = useCallback((svg: SVGSVGElement | null) => {
    svgRef.current = svg;
  }, []);

  const releasePointer = useCallback((gesture: ActiveGesture) => {
    try {
      gesture.captureTarget.releasePointerCapture(gesture.pointerId);
    } catch (captureError) {
      // Browsers throw if capture was already lost. The gesture is still safely
      // cleared below, while the diagnostic remains available to developers.
      reportInteractionError('Pointer capture could not be released.', captureError);
    }
  }, []);

  const finishGesture = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setPreview(null);
    if (gesture) releasePointer(gesture);
  }, [releasePointer]);

  const cancelGesture = useCallback(() => {
    finishGesture();
  }, [finishGesture]);

  const capturePointer = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      gesture: ActiveGesture,
    ) => {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (captureError) {
        reportInteractionError('Pointer capture could not be established.', captureError);
        setError(CAPTURE_ERROR_MESSAGE);
        return false;
      }

      gestureRef.current = gesture;
      return true;
    },
    [],
  );

  const convertClientPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) throw new Error('SVG workspace is unavailable');
    return clientPointToSvg(svg, clientX, clientY);
  }, []);

  const handlePointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (gestureRef.current || !document || !isPrimaryActivation(event)) return;

      const tokenId = closestDataValue(event.target, 'data-source-token-id');
      if (tokenId) {
        setError('');
        capturePointer(event, {
          captureTarget: event.currentTarget,
          documentAtStart: document,
          kind: 'placement',
          pointerId: event.pointerId,
          startClientPoint: { x: event.clientX, y: event.clientY },
          tokenId,
        });
        return;
      }

      const elementId = closestDataValue(event.target, 'data-diagram-element-id');
      if (elementId) {
        const element = selectElementById(document, elementId);
        if (!element || element.type !== 'word') return;

        setSelectedElementId(elementId);
        setError('');
        const moveGesture: MoveGesture = {
          captureTarget: event.currentTarget,
          documentAtStart: document,
          kind: 'move',
          pointerId: event.pointerId,
          startClientPoint: { x: event.clientX, y: event.clientY },
          elementId,
          grabOffset: { x: 0, y: 0 },
          movedBeyondThreshold: false,
        };
        if (
          !capturePointer(event, moveGesture)
        ) {
          return;
        }

        try {
          const point = convertClientPoint(event.clientX, event.clientY);
          gestureRef.current = {
            ...moveGesture,
            grabOffset: { x: point.x - element.x, y: point.y - element.y },
          };
        } catch (coordinateError) {
          reportInteractionError(COORDINATE_ERROR_MESSAGE, coordinateError);
          setError(COORDINATE_ERROR_MESSAGE);
          cancelGesture();
        }
        return;
      }

      const canvasTarget = closestDataValue(event.target, 'data-canvas-interaction-surface');
      if (canvasTarget) setSelectedElementId(null);
    },
    [cancelGesture, capturePointer, convertClientPoint, document],
  );

  const handlePointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (gesture.documentAtStart !== document) {
        cancelGesture();
        return;
      }

      const svg = svgRef.current;
      if (!svg || !clientPointIsInsideSvg(svg, event.clientX, event.clientY)) {
        setPreview(null);
        return;
      }

      try {
        const point = convertClientPoint(event.clientX, event.clientY);
        if (gesture.kind === 'placement') {
          setPreview({ kind: 'placement', tokenId: gesture.tokenId, position: point });
          return;
        }

        const movedBeyondThreshold =
          gesture.movedBeyondThreshold ||
          movementExceededThreshold(gesture, event.clientX, event.clientY);
        gestureRef.current = { ...gesture, movedBeyondThreshold };
        setPreview({
          kind: 'move',
          elementId: gesture.elementId,
          position: {
            x: point.x - gesture.grabOffset.x,
            y: point.y - gesture.grabOffset.y,
          },
        });
      } catch (coordinateError) {
        reportInteractionError(COORDINATE_ERROR_MESSAGE, coordinateError);
        setError(COORDINATE_ERROR_MESSAGE);
        cancelGesture();
      }
    },
    [cancelGesture, convertClientPoint, document],
  );

  const handlePointerUp = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      try {
        if (gesture.documentAtStart !== document) return;

        const svg = svgRef.current;
        if (!svg || !clientPointIsInsideSvg(svg, event.clientX, event.clientY)) return;

        let point: SvgPoint;
        try {
          point = convertClientPoint(event.clientX, event.clientY);
        } catch (coordinateError) {
          reportInteractionError(COORDINATE_ERROR_MESSAGE, coordinateError);
          setError(COORDINATE_ERROR_MESSAGE);
          return;
        }

        if (gesture.kind === 'placement') {
          onCommit({
            type: 'PLACE_TOKEN',
            payload: { tokenId: gesture.tokenId, x: point.x, y: point.y },
          });
          return;
        }

        if (
          gesture.movedBeyondThreshold ||
          movementExceededThreshold(gesture, event.clientX, event.clientY)
        ) {
          onCommit({
            type: 'MOVE_ELEMENT',
            payload: {
              elementId: gesture.elementId,
              x: point.x - gesture.grabOffset.x,
              y: point.y - gesture.grabOffset.y,
            },
          });
        }
      } finally {
        finishGesture();
      }
    },
    [convertClientPoint, document, finishGesture, onCommit],
  );

  const handlePointerCancel = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      cancelGesture();
    },
    [cancelGesture],
  );

  const handleLostPointerCapture = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      // Capture is already gone, so only clear the transient gesture. Calling
      // releasePointerCapture here would be redundant and may throw.
      gestureRef.current = null;
      setPreview(null);
    },
    [],
  );

  useEffect(() => {
    const gesture = gestureRef.current;
    if (gesture && gesture.documentAtStart !== document) cancelGesture();
  }, [cancelGesture, document]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (gestureRef.current) cancelGesture();
      else setSelectedElementId(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelGesture]);

  useEffect(() => {
    if (
      selectedElementId &&
      (!document || !selectElementById(document, selectedElementId))
    ) {
      setSelectedElementId(null);
    }
  }, [document, selectedElementId]);

  useEffect(
    () => () => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture) releasePointer(gesture);
    },
    [releasePointer],
  );

  return {
    error,
    preview,
    rootHandlers: {
      onLostPointerCapture: handleLostPointerCapture,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    selectedElementId,
    setCanvasSvg,
  };
}
