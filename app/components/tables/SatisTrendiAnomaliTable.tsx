'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';
import ColumnManager from '../ColumnManager';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const COLUMN_DEFS = [
  { key: 'Tarih', label: 'Tarih', defaultVisible: true, defaultWidth: 110 },
  { key: 'Satis', label: 'Satış', defaultVisible: true, defaultWidth: 110 },
  { key: 'Iade', label: 'İade', defaultVisible: true, defaultWidth: 110 },
  { key: 'NetSatis', label: 'Net Satış', defaultVisible: true, defaultWidth: 110 },
  { key: 'GunlukDegisim', label: 'Günlük Değişim', defaultVisible: true, defaultWidth: 110 },
  { key: 'KumulatifSatis', label: 'Küm. Satış', defaultVisible: true, defaultWidth: 110 },
  { key: 'KumulatifNetSatis', label: 'Küm. Net', defaultVisible: true, defaultWidth: 110 },
  { key: 'IadeOrani', label: 'İade Oranı %', defaultVisible: true, defaultWidth: 100 },
  { key: 'NetSatisDurum', label: 'Net Satış Durum', defaultVisible: true, defaultWidth: 130 },
  { key: 'IadeDurum', label: 'İade Durum', defaultVisible: true, defaultWidth: 130 },
];

function formatDateTR(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR');
  } catch {
    return '—';
  }
}

function formatNumber(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function getDurumBadgeClass(durum: string | undefined): string {
  if (!durum) return 'bg-gray-100 text-gray-600';
  const d = durum.toLowerCase();
  if (d.includes('güçlü anomali')) return 'bg-red-100 text-red-700';
  if (d.includes('anomali')) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

interface SatisTrendiAnomaliTableProps {
  data: Record<string, unknown>[];
  showOnlyAnomalies?: boolean;
}

export default function SatisTrendiAnomaliTable({ data, showOnlyAnomalies = false }: SatisTrendiAnomaliTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Tarih');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [columnFilterSelections, setColumnFilterSelections] = useState<Record<string, string[]>>({});
  const filterTriggerRef = useRef<HTMLElement | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [filterDropdownRect, setFilterDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

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
  } = useColumnPreferences('satis-trendi-anomali-raporu', COLUMN_DEFS);

  const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
    COLUMN_DEFS.map(d => [d.key, d.defaultWidth])
  );

  const getColWidth = (key: string) =>
    localWidths[key] ?? committedWidthsRef.current[key] ?? savedWidths[key] ?? DEFAULT_WIDTHS[key] ?? 120;

  const columns = orderedColumns
    .filter(c => c.visible)
    .map(c => {
      const def = COLUMN_DEFS.find(d => d.key === c.key)!;
      return { key: c.key, label: def.label, sortable: true };
    });

  const getVal = (row: Record<string, unknown>, key: string): unknown => {
    const camel = key.charAt(0).toLowerCase() + key.slice(1);
    return row[key] ?? row[camel];
  };

  const filteredData = useMemo(() => {
    let result = [...data];
    if (showOnlyAnomalies) {
      result = result.filter(r => {
        const net = String(getVal(r, 'NetSatisDurum') ?? '');
        const iade = String(getVal(r, 'IadeDurum') ?? '');
        return net.toLowerCase().includes('anomali') || iade.toLowerCase().includes('anomali');
      });
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    for (const [colKey, selected] of Object.entries(columnFilterSelections)) {
      if (!selected?.length) continue;
      result = result.filter(r => selected.includes(String(getVal(r, colKey) ?? '')));
    }
    return result;
  }, [data, showOnlyAnomalies, searchTerm, columnFilterSelections]);

  const columnOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const row of filteredData) {
        const v = getVal(row, col.key);
        if (v != null && String(v).trim()) set.add(String(v).trim());
      }
      out[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR'));
    }
    return out;
  }, [filteredData, columns]);

  const toggleFilterValue = (colKey: string, value: string) => {
    setColumnFilterSelections(prev => {
      const cur = prev[colKey] ?? [];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      if (!next.length) {
        const { [colKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [colKey]: next };
    });
  };

  const clearColumnFilter = (colKey: string) => {
    setColumnFilterSelections(prev => {
      const { [colKey]: _, ...rest } = prev;
      return rest;
    });
  };

  const activeFilterCount = Object.values(columnFilterSelections).filter(a => a?.length).length;

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    return [...filteredData].sort((a, b) => {
      const av = getVal(a, sortColumn);
      const bv = getVal(b, sortColumn);
      const aNum = Number(av);
      const bNum = Number(bv);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortDirection === 'asc' ? as.localeCompare(bs, 'tr-TR') : bs.localeCompare(as, 'tr-TR');
    });
  }, [filteredData, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIdx, startIdx + itemsPerPage);

  const handleSort = (col: string) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortColumn, sortDirection, columnFilterSelections]);

  useEffect(() => {
    if (!openFilterColumn) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filterTriggerRef.current?.contains(t) || filterDropdownRef.current?.contains(t)) return;
      setOpenFilterColumn(null);
      setFilterDropdownRect(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openFilterColumn]);

  const handleMouseDown = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    setResizingColumn(col);
    const startX = e.clientX;
    const startW = getColWidth(col);
    let latest: Record<string, number> = { ...savedWidths, ...committedWidthsRef.current };
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(60, startW + (ev.clientX - startX));
      latest = { ...latest, [col]: w };
      setLocalWidths(p => ({ ...p, [col]: w }));
    };
    const onUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      committedWidthsRef.current = latest;
      saveWidths(latest);
      setLocalWidths({});
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleDragStart = (e: React.DragEvent, col: string) => {
    if (resizingColumn) return;
    setDraggedCol(col);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', col);
  };
  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (col !== draggedCol) setDragOverCol(col);
  };
  const handleDrop = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === col) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    const from = orderedColumns.findIndex(c => c.key === draggedCol);
    const to = orderedColumns.findIndex(c => c.key === col);
    if (from !== -1 && to !== -1) reorder(from, to);
    setDraggedCol(null);
    setDragOverCol(null);
  };
  const handleDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const exportToExcel = () => {
    const rows = sortedData.map(r => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        const v = getVal(r, col.key);
        if (col.key === 'Tarih') out[col.label] = formatDateTR(String(v ?? ''));
        else if (typeof v === 'number') out[col.label] = v;
        else out[col.label] = v ?? '';
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Satis Trendi');
    XLSX.writeFile(wb, `satis_trendi_anomali_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Satış Trendi ve Anomali Analiz Raporu', 14, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')} | Kayıt: ${sortedData.length}`, 14, 19);
    doc.setTextColor(0, 0, 0);

    const head = columns.map(c => c.label);
    const body = sortedData.map(r =>
      columns.map(c => {
        const v = getVal(r, c.key);
        if (c.key === 'Tarih') return formatDateTR(String(v ?? ''));
        if (typeof v === 'number') return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(v);
        return v != null ? String(v) : '-';
      })
    );

    doc.autoTable({
      head: [head],
      body,
      startY: 28,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const fy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 50;
    doc.text('btRapor - Satış Trendi Anomali', 14, fy + 8);
    doc.save(`satis_trendi_anomali_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up engelleyici nedeniyle yazdırma penceresi açılamıyor.');
      return;
    }
    const ths = columns.map(c => `<th>${c.label}</th>`).join('');
    const trs = sortedData.map(r =>
      `<tr>${columns.map(c => {
        const v = getVal(r, c.key);
        let disp: string;
        if (c.key === 'Tarih') disp = formatDateTR(String(v ?? ''));
        else if (typeof v === 'number') disp = formatNumber(v);
        else disp = v != null ? String(v) : '-';
        return `<td>${disp}</td>`;
      }).join('')}</tr>`
    ).join('');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Satış Trendi Anomali</title>
      <style>body{font-family:Arial;margin:15px;font-size:11px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}
      th{background:#0f172a;color:#fff}tr:nth-child(even){background:#f8fafc}
      @media print{body{margin:0}th,td{padding:4px;font-size:9px}}</style></head>
      <body>
        <h1>Satış Trendi ve Anomali Analiz Raporu</h1>
        <p>${new Date().toLocaleDateString('tr-TR')} | Toplam: ${sortedData.length}</p>
        <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
        <script>window.onload=function(){setTimeout(function(){window.print();window.close()},300)}</script>
      </body></html>
    `);
    win.document.close();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilterSelections({});
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Tarih, satış, iade, durum ile ara..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <button
                onClick={exportToExcel}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Yazdır
              </button>
              <button
                onClick={exportToPDF}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
              <div className="hidden md:block">
                <ColumnManager
                  orderedColumns={orderedColumns}
                  columnDefs={COLUMN_DEFS}
                  onToggle={toggle}
                  onReorder={reorder}
                  onShowAll={showAll}
                  onHideAll={hideAll}
                />
              </div>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
              <span className="text-sm text-amber-800">{activeFilterCount} kolon filtresi aktif</span>
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-amber-700 hover:text-amber-900">
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="md:hidden p-4 space-y-3">
          {paginatedData.length === 0 ? (
            <p className="text-slate-500 text-center py-6 text-sm">
              {showOnlyAnomalies ? 'Anomali kaydı bulunamadı' : 'Veri yok'}
            </p>
          ) : (
            paginatedData.map((row, idx) => {
              const netDurum = String(getVal(row, 'NetSatisDurum') ?? '');
              const iadeDurum = String(getVal(row, 'IadeDurum') ?? '');
              const hasAnomali = netDurum.toLowerCase().includes('anomali') || iadeDurum.toLowerCase().includes('anomali');
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 shadow-sm ${hasAnomali ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex justify-between mb-3">
                    <span className="font-semibold text-slate-800">{formatDateTR(String(getVal(row, 'Tarih') ?? ''))}</span>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDurumBadgeClass(netDurum)}`}>{netDurum || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDurumBadgeClass(iadeDurum)}`}>{iadeDurum || '—'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Satış</span><span className="font-medium tabular-nums">{formatNumber(Number(getVal(row, 'Satis')))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">İade</span><span className="font-medium tabular-nums text-amber-700">{formatNumber(Number(getVal(row, 'Iade')))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Net Satış</span><span className="font-semibold tabular-nums">{formatNumber(Number(getVal(row, 'NetSatis')))}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">İade Oranı</span><span className="font-medium tabular-nums">{formatNumber(Number(getVal(row, 'IadeOrani')))}%</span></div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table
            className="border-collapse w-full text-sm"
            style={{
              tableLayout: 'fixed',
              width: columns.reduce((s, c) => s + getColWidth(c.key), 0),
              minWidth: columns.reduce((s, c) => s + getColWidth(c.key), 0),
            }}
          >
            <colgroup>
              {columns.map(c => <col key={c.key} style={{ width: getColWidth(c.key) }} />)}
            </colgroup>
            <thead>
              <tr className="bg-slate-800 text-white">
                {columns.map(col => {
                  const w = getColWidth(col.key);
                  const opts = columnOptions[col.key] ?? [];
                  const sel = columnFilterSelections[col.key] ?? [];
                  const hasActive = sel.length > 0;
                  const isResizing = resizingColumn === col.key;
                  const isDragging = draggedCol === col.key;
                  const isDragOver = dragOverCol === col.key && draggedCol !== col.key;
                  return (
                    <th
                      key={col.key}
                      draggable={!resizingColumn}
                      onDragStart={e => handleDragStart(e, col.key)}
                      onDragOver={e => handleDragOver(e, col.key)}
                      onDrop={e => handleDrop(e, col.key)}
                      onDragEnd={handleDragEnd}
                      className={`relative text-left text-xs font-bold uppercase tracking-wider select-none border-b border-slate-700 ${isDragging ? 'opacity-30' : ''} ${isDragOver ? 'bg-slate-600' : ''}`}
                      style={{ width: w, minWidth: 0 }}
                    >
                      <div className="flex items-center gap-1.5 px-3 py-3">
                        <div
                          className="flex-1 cursor-grab active:cursor-grabbing flex items-center gap-1.5"
                          onClick={() => handleSort(col.key)}
                        >
                          <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 10 16">
                            <circle cx="2.5" cy="3" r="1.5" /><circle cx="2.5" cy="8" r="1.5" /><circle cx="2.5" cy="13" r="1.5" />
                            <circle cx="7.5" cy="3" r="1.5" /><circle cx="7.5" cy="8" r="1.5" /><circle cx="7.5" cy="13" r="1.5" />
                          </svg>
                          <span className="truncate">{col.label}</span>
                          {sortColumn === col.key && <span className="text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            const next = openFilterColumn === col.key ? null : col.key;
                            if (next) {
                              filterTriggerRef.current = e.currentTarget as HTMLElement;
                              const th = (e.currentTarget as HTMLElement).closest('th');
                              const rect = th?.getBoundingClientRect();
                              setFilterDropdownRect(rect ? { top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 160) } : null);
                            } else setFilterDropdownRect(null);
                            setOpenFilterColumn(next);
                          }}
                          className={`px-1.5 py-1 rounded text-[10px] border ${hasActive ? 'border-emerald-400 bg-slate-900 text-emerald-200' : 'border-slate-600 bg-slate-900 text-slate-200'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.382a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 14.414V19l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.09A1 1 0 013 6.382V4z" />
                          </svg>
                        </button>
                      </div>
                      {!isResizing && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-400/50"
                          onMouseDown={e => handleMouseDown(e, col.key)}
                        />
                      )}
                      {openFilterColumn === col.key && filterDropdownRect && typeof document !== 'undefined' && createPortal(
                        <div
                          ref={filterDropdownRef}
                          className="fixed z-[9999] min-w-[160px] max-w-xs bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-auto"
                          style={{ top: filterDropdownRect.top, left: filterDropdownRect.left, width: filterDropdownRect.width }}
                        >
                          <div className="flex justify-between px-2 py-1 border-b border-slate-600 text-[11px] text-slate-200">
                            <span>{col.label} filtresi</span>
                            {hasActive && <button type="button" onClick={() => clearColumnFilter(col.key)} className="text-emerald-300 hover:text-emerald-200 text-[10px]">Temizle</button>}
                          </div>
                          <div className="py-1 max-h-48 overflow-auto">
                            {opts.map(val => (
                              <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 cursor-pointer text-sm text-slate-200">
                                <input type="checkbox" checked={sel.includes(val)} onChange={() => toggleFilterValue(col.key, val)} className="rounded border-gray-400 text-emerald-500" />
                                <span className="truncate">{val}</span>
                              </label>
                            ))}
                          </div>
                        </div>,
                        document.body
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-8 text-center text-slate-500">
                    {showOnlyAnomalies ? 'Anomali kaydı bulunamadı' : 'Veri yok'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-slate-50/80">
                    {columns.map(c => {
                      const v = getVal(row, c.key);
                      const num = Number(v);
                      const isNum = !isNaN(num);
                      const isDurum = c.key === 'NetSatisDurum' || c.key === 'IadeDurum';
                      return (
                        <td key={c.key} className={`py-3 px-4 ${isNum ? 'text-right tabular-nums' : 'text-left'}`}>
                          {c.key === 'Tarih' ? formatDateTR(String(v ?? '')) :
                           isDurum ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getDurumBadgeClass(String(v ?? ''))}`}>
                              {String(v ?? '—')}
                            </span>
                          ) : isNum ? formatNumber(num) : (v != null ? String(v) : '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-slate-600">
          <span>
            Toplam {sortedData.length} kayıt • Sayfa {currentPage} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Önceki
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
