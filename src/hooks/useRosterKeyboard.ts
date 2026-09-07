import { useCallback, useEffect, useRef } from 'react';

export interface RosterKeyboardOptions {
  /** Ordered list of focusable node ids (main + visible nested rows). */
  focusableIds: readonly string[];
  onToggleExpand: (nodeId: string) => void;
  enabled?: boolean;
}

/**
 * Roving focus within the roster: ArrowUp/Down move between rows;
 * Enter/Space toggles expand on the focused row.
 */
export function useRosterKeyboard({
  focusableIds,
  onToggleExpand,
  enabled = true,
}: RosterKeyboardOptions): {
  rosterRef: React.RefObject<HTMLElement | null>;
  focusNode: (nodeId: string) => void;
} {
  const rosterRef = useRef<HTMLElement | null>(null);
  const focusedIdRef = useRef<string | null>(null);

  const focusNode = useCallback(
    (nodeId: string) => {
      if (!enabled) return;
      const root = rosterRef.current;
      if (!root) return;
      const row = root.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
      if (!row) return;
      focusedIdRef.current = nodeId;
      row.focus();
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.dataset.nodeId) return;

      const currentId = target.dataset.nodeId;
      const index = focusableIds.indexOf(currentId);
      if (index === -1) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = focusableIds[index + 1];
        if (next) focusNode(next);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = focusableIds[index - 1];
        if (prev) focusNode(prev);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggleExpand(currentId);
      }
    };

    const root = rosterRef.current;
    root?.addEventListener('keydown', handleKeyDown);
    return () => root?.removeEventListener('keydown', handleKeyDown);
  }, [enabled, focusableIds, focusNode, onToggleExpand]);

  return { rosterRef, focusNode };
}
