'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
  defaultWidth?: number;
  hideable?: boolean;
}

export interface ColumnPref {
  key: string;
  visible: boolean;
}

const API_BASE = 'https://api.btrapor.com';
const LS_PREFIX = 'btrapor_colprefs_';
const LS_WIDTHS_PREFIX = 'btrapor_colwidths_';

function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('userId');
}

function lsKey(userId: string, reportSlug: string) {
  return `${LS_PREFIX}${userId}_${reportSlug}`;
}

function lsWidthsKey(userId: string, reportSlug: string) {
  return `${LS_WIDTHS_PREFIX}${userId}_${reportSlug}`;
}

function mergeWithDefaults(saved: ColumnPref[], defaults: ColumnDef[]): ColumnPref[] {
  const savedKeys = new Set(saved.map(c => c.key));
  const merged = [...saved];
  for (const def of defaults) {
    if (!savedKeys.has(def.key)) {
      merged.push({ key: def.key, visible: def.defaultVisible !== false });
    }
  }
  const defKeys = new Set(defaults.map(d => d.key));
  return merged.filter(c => defKeys.has(c.key));
}

export function useColumnPreferences(reportSlug: string, defaultColumns: ColumnDef[]) {
  const [orderedColumns, setOrderedColumns] = useState<ColumnPref[]>(() =>
    defaultColumns.map(d => ({ key: d.key, visible: d.defaultVisible !== false }))
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveWidthsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevDefaultLenRef = useRef(0);
  useEffect(() => {
    if (defaultColumns.length > 0 && defaultColumns.length !== prevDefaultLenRef.current) {
      prevDefaultLenRef.current = defaultColumns.length;
      setOrderedColumns(prev =>
        prev.length === 0
          ? defaultColumns.map(d => ({ key: d.key, visible: d.defaultVisible !== false }))
          : mergeWithDefaults(prev, defaultColumns)
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColumns.length]);

  // İlk yükleme: API → localStorage fallback
  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Sütun genişliklerini localStorage'dan yükle
    const savedWidths = localStorage.getItem(lsWidthsKey(userId, reportSlug));
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch { /* invalid JSON, ignore */ }
    }

    const loadPreferences = async () => {
      // Önce localStorage'dan yükle (hızlı görüntü için)
      const ls = localStorage.getItem(lsKey(userId, reportSlug));
      if (ls) {
        try {
          const parsed: ColumnPref[] = JSON.parse(ls);
          setOrderedColumns(mergeWithDefaults(parsed, defaultColumns));
        } catch { /* invalid JSON, ignore */ }
      }

      // API'den çek
      try {
        const res = await fetch(
          `${API_BASE}/column-preferences?user_id=${userId}&report_slug=${encodeURIComponent(reportSlug)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.columns && Array.isArray(data.columns)) {
            const merged = mergeWithDefaults(data.columns, defaultColumns);
            setOrderedColumns(merged);
            localStorage.setItem(lsKey(userId, reportSlug), JSON.stringify(merged));
          }
        }
      } catch {
        // API erişilemezse localStorage ile devam et
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSlug]);

  const saveToApi = useCallback(
    (cols: ColumnPref[]) => {
      const userId = getUserId();
      if (!userId) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        localStorage.setItem(lsKey(userId, reportSlug), JSON.stringify(cols));
        try {
          await fetch(`${API_BASE}/column-preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: parseInt(userId),
              report_slug: reportSlug,
              columns: cols,
            }),
          });
        } catch {
          // Ağ hatası: localStorage'daki veri korunur
        }
      }, 600);
    },
    [reportSlug]
  );

  // Sütun genişliklerini kaydet (localStorage + API debounced)
  const saveWidths = useCallback(
    (widths: Record<string, number>) => {
      const userId = getUserId();
      if (!userId) return;

      setColumnWidths(widths);

      if (saveWidthsTimerRef.current) clearTimeout(saveWidthsTimerRef.current);
      saveWidthsTimerRef.current = setTimeout(async () => {
        localStorage.setItem(lsWidthsKey(userId, reportSlug), JSON.stringify(widths));
        try {
          await fetch(`${API_BASE}/column-preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: parseInt(userId),
              report_slug: reportSlug,
              column_widths: widths,
            }),
          });
        } catch {
          // Ağ hatası: localStorage'daki veri korunur
        }
      }, 800);
    },
    [reportSlug]
  );

  // Sütun genişliğini al (saved → defaultWidth → built-in default)
  const getWidth = useCallback(
    (key: string, builtInDefault?: number): number => {
      if (columnWidths[key]) return columnWidths[key];
      const def = defaultColumns.find(d => d.key === key);
      if (def?.defaultWidth) return def.defaultWidth;
      return builtInDefault ?? 150;
    },
    [columnWidths, defaultColumns]
  );

  const toggle = useCallback(
    (key: string) => {
      setOrderedColumns(prev => {
        const next = prev.map(c => (c.key === key ? { ...c, visible: !c.visible } : c));
        saveToApi(next);
        return next;
      });
    },
    [saveToApi]
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setOrderedColumns(prev => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        saveToApi(next);
        return next;
      });
    },
    [saveToApi]
  );

  const showAll = useCallback(() => {
    setOrderedColumns(prev => {
      const next = prev.map(c => ({ ...c, visible: true }));
      saveToApi(next);
      return next;
    });
  }, [saveToApi]);

  const hideAll = useCallback(() => {
    setOrderedColumns(prev => {
      const next = prev.map(c => ({ ...c, visible: false }));
      saveToApi(next);
      return next;
    });
  }, [saveToApi]);

  const visibleColumns = orderedColumns.filter(c => c.visible);

  return {
    orderedColumns,
    visibleColumns,
    columnWidths,
    getWidth,
    saveWidths,
    toggle,
    reorder,
    showAll,
    hideAll,
    isLoading,
  };
}
