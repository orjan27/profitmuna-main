'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { RecordSheet, type RecordMode } from '@/components/RecordSheet';

interface RecordSheetContextValue {
  /** Opens the global Record sheet, defaulting to income entry. */
  openRecordSheet: (mode?: RecordMode) => void;
}

const RecordSheetContext = createContext<RecordSheetContextValue | null>(null);

/**
 * Access the global Record sheet from anywhere inside the dashboard shell.
 * Throws when used outside RecordSheetProvider so misplacement fails loudly.
 */
export function useRecordSheet(): RecordSheetContextValue {
  const ctx = useContext(RecordSheetContext);
  if (!ctx) throw new Error('useRecordSheet must be used within RecordSheetProvider');
  return ctx;
}

/**
 * Mounts the Record sheet once for the whole authenticated shell and exposes
 * an imperative opener via context. The nav's Record button and per-page
 * "Record income / expense" buttons all drive this single instance, so
 * recording works the same from anywhere.
 */
export function RecordSheetProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RecordMode>('income');

  const openRecordSheet = useCallback((nextMode: RecordMode = 'income') => {
    setMode(nextMode);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openRecordSheet }), [openRecordSheet]);

  return (
    <RecordSheetContext.Provider value={value}>
      {children}
      <RecordSheet open={open} onOpenChange={setOpen} mode={mode} onModeChange={setMode} />
    </RecordSheetContext.Provider>
  );
}
