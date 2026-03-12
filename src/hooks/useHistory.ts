import { useState, useCallback } from 'react';
import type { HistoryState } from '../types';

const MAX_HISTORY = 50;

interface Store {
  history: HistoryState[];
  index: number;
}

export function useHistory(initialState: HistoryState) {
  // Single atomic state to avoid stale-closure issues with index
  const [store, setStore] = useState<Store>({
    history: [initialState],
    index: 0,
  });

  const current = store.history[store.index];

  // push is stable (empty deps) because it uses functional setState
  const push = useCallback((newState: HistoryState) => {
    setStore(prev => {
      const newHistory = [...prev.history.slice(0, prev.index + 1), newState];
      const trimmed = newHistory.length > MAX_HISTORY ? newHistory.slice(1) : newHistory;
      return {
        history: trimmed,
        index: Math.min(trimmed.length - 1, MAX_HISTORY - 1),
      };
    });
  }, []);

  const undo = useCallback(() => {
    setStore(prev => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  }, []);

  const redo = useCallback(() => {
    setStore(prev => ({ ...prev, index: Math.min(prev.history.length - 1, prev.index + 1) }));
  }, []);

  const canUndo = store.index > 0;
  const canRedo = store.index < store.history.length - 1;

  return { current, push, undo, redo, canUndo, canRedo };
}
