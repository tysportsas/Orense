'use client';

import { useEffect } from 'react';

const KEY = 'orense_sheet_sync_at';
const EVERY_MS = 3 * 60 * 1000;

/** Al abrir la app sincroniza con la hoja de Google Sheets y recarga si llegaron informes nuevos. */
export default function SheetAutoSync() {
  useEffect(() => {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < EVERY_MS) return;
    localStorage.setItem(KEY, String(Date.now()));
    fetch('/api/sync-sheet')
      .then((r) => r.json())
      .then((d) => {
        if (d?.nuevos > 0 && !d.cached) window.location.reload();
      })
      .catch(() => {});
  }, []);
  return null;
}
