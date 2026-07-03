import { useEffect, useRef } from "react";
import { CanvasEngine } from "../engine/CanvasEngine";

/**
 * Creates and owns a single CanvasEngine bound to a stage element.
 * The engine lives for the lifetime of the component and is torn down on unmount.
 */
export function useCanvasEngine(onFirstInteraction?: () => void) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const cbRef = useRef(onFirstInteraction);
  cbRef.current = onFirstInteraction;

  useEffect(() => {
    if (!stageRef.current) return;
    const engine = new CanvasEngine(stageRef.current, {
      onFirstInteraction: () => cbRef.current?.(),
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return { stageRef, engineRef };
}
