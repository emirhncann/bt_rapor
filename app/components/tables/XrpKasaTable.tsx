'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';
import ColumnManager from '../ColumnManager';

const COLUMN_DEFS = [
  { key: 'BELGETARIH', label: 'Belge Tarihi', defaultVisible: true, defaultWidth: 140 },
  { key: 'Şube No', label: 'Şube No', defaultVisible: true, defaultWidth: 90 },
  { key: 'Şube Adı', label: 'Şube Adı', defaultVisible: true, defaultWidth: 180 },
  { key: 'Kasa_No', label: 'Kasa No', defaultVisible: true, defaultWidth: 100 },
  { key: 'Adet', label: 'Adet', defaultVisible: true, defaultWidth: 80 },
];

interface XrpKasaTableProps {
  data: any[];
}

type SortDirection = 'asc' | 'desc' | null;

function formatDate(val: unknown): string {
  if (!val) return '-';
  const s = String(val);
  try {
    if (s.includes('T')) {
      const d = new Date(s);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}.${mm}.${yy}`;
    }
    return s;
  } catch {
    return s;
  }
}

export default function XrpKasaTable({ data }: XrpKasaTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('BELGETARIH');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const committedWidthsRef = useRef<Record<string, number>>({});
  const [localWidths, setLocalWidths] = useState<Record<string, number>>({});

  const {
    orderedColumns,
    toggle,
    reorder,
    showAll,
    hideAll,
    columnWidths: savedWidths,
    saveWidths,
  } = useColumnPreferences('xrp-kasa-raporu', COLUMN_DEFS);

  const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
    COLUMN_DEFS.map((d) => [d.key, d.defaultWidth ?? 120])
  );

  const getColWidth = (key: string) =>
    localWidths[key] ??
    committedWidthsRef.current[key] ??
    savedWidths[key] ??
    DEFAULT_WIDTHS[key] ??
    150;

  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizingColumn(column);
    const startX = e.clientX;
    const startWidth = getColWidth(column);
    let latestWidths: Record<string, number> = { ...savedWidths, ...committedWidthsRef.current };
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (e.clientX - startX));
      latestWidths = { ...latestWidths, [column]: newWidth };
      setLocalWidths((prev) => ({ ...prev, [column]: newWidth }));
    };
    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      committedWidthsRef.current = latestWidths;
      saveWidths(latestWidths);
      setLocalWidths({});
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragStart = (e: React.DragEvent, column: string) => {
    if (resizingColumn) {
      e.preventDefault();
      return;
    }
    setDraggedCol(column);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', column);
  };
  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (column !== draggedCol) setDragOverCol(column);
  };
  const handleDrop = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === column) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    const fromIdx = orderedColumns.findIndex((c) => c.key === draggedCol);
    const toIdx = orderedColumns.findIndex((c) => c.key === column);
    if (fromIdx !== -1 && toIdx !== -1) reorder(fromIdx, toIdx);
    setDraggedCol(null);
    setDragOverCol(null);
  };
  const handleDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const columns = orderedColumns
    .filter((c) => c.visible)
    .map((c) => {
      const def = COLUMN_DEFS.find((d) => d.key === c.key)!;
      return { key: c.key, label: def.label, sortable: true };
    });

  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return COLUMN_DEFS.some((c) => {
      const v = item[c.key];
      return v != null && String(v).toLowerCase().includes(term);
    });
  });

  const parseDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    if (dateStr.includes('T')) return new Date(dateStr).getTime();
    if (dateStr.includes('.')) {
      const [d, m, y] = dateStr.split('.');
      return new Date(`${y}-${m}-${d}`).getTime();
    }
    return new Date(dateStr).getTime() || 0;
  };

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;
    let av = a[sortColumn];
    let bv = b[sortColumn];
    if (sortColumn === 'BELGETARIH') {
      av = parseDate(av);
      bv = parseDate(bv);
    }
    if (av < bv) return sortDirection === 'asc' ? -1 : 1;
    if (av > bv) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageData = sortedData.slice(startIdx, startIdx + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortColumn, sortDirection]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const exportToExcel = () => {
    const rows = sortedData.map((item) =>
      columns.reduce(
        (acc, col) => {
          if (col.key === 'BELGETARIH') {
            acc[col.label] = formatDate(item[col.key]);
          } else {
            acc[col.label] = item[col.key] ?? '-';
          }
          return acc;
        },
        {} as Record<string, unknown>
      )
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'XRP Kasa Raporu');
    XLSX.writeFile(wb, `xrp_kasa_raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalAdet = sortedData.reduce((sum, r) => sum + (Number(r.Adet) || 0), 0);

  if (data.length === 0 && !searchTerm) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Tarih aralığı seçip &quot;Raporu Getir&quot; ile veri çekin.</p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="p-8 text-center text-slate-700 bg-slate-50 rounded-xl border border-slate-200">
        <p className="font-medium">Tüm kolonlar gizli.</p>
        <button
          onClick={showAll}
          className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          Tüm Kolonları Göster
        </button>
      </div>
    );
  }

  const tableWidth = columns.reduce((s, c) => s + getColWidth(c.key), 0);

  return (
    <div className={`w-full select-none ${resizingColumn ? 'cursor-col-resize' : ''}`}>
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Belge tarihi, şube, kasa no ile ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ColumnManager
              orderedColumns={orderedColumns}
              columnDefs={COLUMN_DEFS}
              onToggle={toggle}
              onReorder={reorder}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2 py-1.5 bg-white">
              <span className="text-xs text-gray-500">Satır:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <span className="text-sm text-slate-600 ml-2">
              {sortedData.length} kayıt · {totalAdet} adet
            </span>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table
          className="border-collapse"
          style={{
            tableLayout: 'fixed',
            width: `${tableWidth}px`,
            minWidth: `${tableWidth}px`,
          }}
        >
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: `${getColWidth(col.key)}px` }} />
            ))}
            <col style={{ width: 'auto' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-800 text-white">
              {columns.map((column) => {
                const w = getColWidth(column.key);
                const isDragging = draggedCol === column.key;
                const isDragOver = dragOverCol === column.key && draggedCol !== column.key;
                return (
                  <th
                    key={column.key}
                    draggable={!resizingColumn}
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
                    }}
                    className={`relative text-left text-xs font-bold uppercase tracking-wider select-none border-b border-slate-700 transition-colors ${
                      isDragging ? 'opacity-30' : ''
                    } ${isDragOver ? 'bg-slate-600' : ''}`}
                    style={{ width: w, minWidth: 0, overflow: 'hidden' }}
                  >
                    {isDragOver && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 z-20" />
                    )}
                    <div
                      className="flex items-center gap-1.5 px-3 py-3 cursor-grab active:cursor-grabbing hover:bg-slate-700/60 transition-colors"
                      onClick={() => !draggedCol && column.sortable && handleSort(column.key)}
                    >
                      <svg
                        className="w-2.5 h-2.5 text-slate-500 flex-shrink-0 opacity-70"
                        fill="currentColor"
                        viewBox="0 0 10 16"
                      >
                        <circle cx="2.5" cy="3" r="1.5" />
                        <circle cx="2.5" cy="8" r="1.5" />
                        <circle cx="2.5" cy="13" r="1.5" />
                        <circle cx="7.5" cy="3" r="1.5" />
                        <circle cx="7.5" cy="8" r="1.5" />
                        <circle cx="7.5" cy="13" r="1.5" />
                      </svg>
                      <span className="truncate flex-1">{column.label}</span>
                      {column.sortable && sortColumn === column.key && (
                        <span className="flex-shrink-0 text-emerald-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                    <div
                      draggable={false}
                      onMouseDown={(e) => handleMouseDown(e, column.key)}
                      className={`absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center group z-10 ${
                        resizingColumn === column.key ? 'bg-emerald-400/30' : ''
                      }`}
                      title="Sürükleyerek genişlet"
                    >
                      <div
                        className={`w-0.5 h-4/5 rounded-full transition-all ${
                          resizingColumn === column.key
                            ? 'bg-emerald-400 w-1'
                            : 'bg-slate-600 group-hover:bg-emerald-400 group-hover:w-1'
                        }`}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageData.map((row, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-emerald-50/60 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2.5 text-sm text-gray-800 border-r border-gray-100 last:border-r-0"
                      style={{ width: getColWidth(col.key), minWidth: 0, overflow: 'hidden' }}
                    >
                      {col.key === 'BELGETARIH' ? formatDate(row[col.key]) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Önceki
          </button>
          <span className="text-sm text-slate-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
