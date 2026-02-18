'use client';

import { useState, useRef } from 'react';
import type { ColumnDef, ColumnPref } from '../hooks/useColumnPreferences';

interface ColumnManagerProps {
  orderedColumns: ColumnPref[];
  columnDefs: ColumnDef[];
  onToggle: (key: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export default function ColumnManager({
  orderedColumns,
  columnDefs,
  onToggle,
  onReorder,
  onShowAll,
  onHideAll,
}: ColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const defMap = new Map(columnDefs.map(d => [d.key, d]));

  // Sadece hideable kolonları yönetilebilir yap
  const manageableColumns = orderedColumns.filter(c => {
    const def = defMap.get(c.key);
    return !def || def.hideable !== false;
  });

  const hideableKeys = new Set(manageableColumns.map(c => c.key));

  const visibleCount = manageableColumns.filter(c => c.visible).length;

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === toIndex) {
      setDragOverIndex(null);
      return;
    }

    // orderedColumns içindeki gerçek index'leri bul
    const fromKey = manageableColumns[dragIndexRef.current].key;
    const toKey = manageableColumns[toIndex].key;
    const realFrom = orderedColumns.findIndex(c => c.key === fromKey);
    const realTo = orderedColumns.findIndex(c => c.key === toKey);

    onReorder(realFrom, realTo);
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Kolonları yönet"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-200 ${
          open
            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        Kolonlar
        <span className="text-xs bg-white/20 text-current px-1 rounded">
          {visibleCount}/{manageableColumns.length}
        </span>
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {/* Başlık */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Kolon Görünürlüğü</span>
              <div className="flex gap-2">
                <button
                  onClick={onShowAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Tümü
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={onHideAll}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Tümünü Gizle
                </button>
              </div>
            </div>

            {/* Kolon listesi */}
            <div className="max-h-80 overflow-y-auto py-1">
              {manageableColumns.map((col, index) => {
                const def = defMap.get(col.key);
                const label = def?.label ?? col.key;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={col.key}
                    draggable
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDrop={e => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-grab active:cursor-grabbing select-none transition-colors ${
                      isDragOver
                        ? 'bg-blue-50 border-t-2 border-blue-400'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Sürükle ikonu */}
                    <svg
                      className="w-4 h-4 text-gray-300 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                    </svg>

                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      id={`col-${col.key}`}
                      checked={col.visible}
                      onChange={() => onToggle(col.key)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />

                    {/* Etiket */}
                    <label
                      htmlFor={`col-${col.key}`}
                      className={`text-sm flex-1 cursor-pointer ${
                        col.visible ? 'text-gray-800' : 'text-gray-400'
                      }`}
                    >
                      {label}
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Alt bilgi */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Sürükleyerek sıralayabilirsiniz
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
