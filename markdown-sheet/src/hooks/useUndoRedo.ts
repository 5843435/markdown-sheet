import { useCallback, useRef, useState } from "react";

export function useUndoRedo<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const push = useCallback(
    (next: T) => {
      undoStack.current.push(structuredClone(state));
      redoStack.current = [];
      setState(next);
    },
    [state]
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(structuredClone(state));
    setState(prev);
  }, [state]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(structuredClone(state));
    setState(next);
  }, [state]);

  const reset = useCallback((val: T) => {
    undoStack.current = [];
    redoStack.current = [];
    setState(val);
  }, []);

  return {
    state,
    push,
    undo,
    redo,
    reset,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
