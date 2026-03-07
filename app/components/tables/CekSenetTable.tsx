'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';
import ColumnManager from '../ColumnManager';

const COLUMN_DEFS = [
  { key: 'Referans',           label: 'Referans',           defaultVisible: false, defaultWidth: 90  },
  { key: 'Portföy No',        label: 'Portföy No',        defaultVisible: true,  defaultWidth: 120 },
  { key: 'Seri No',           label: 'Seri No',           defaultVisible: true,  defaultWidth: 120 },
  { key: 'Tür',               label: 'Tür',               defaultVisible: true,  defaultWidth: 120 },
  { key: 'İlgili Hesap',      label: 'İlgili Hesap',      defaultVisible: true,  defaultWidth: 180 },
  { key: 'Çek/Senet Sahibi',  label: 'Çek/Senet Sahibi',  defaultVisible: true,  defaultWidth: 140 },
  { key: 'Güncel Durumu',     label: 'Güncel Durumu',     defaultVisible: true,  defaultWidth: 140 },
  { key: 'Devir',             label: 'Devir',             defaultVisible: true,  defaultWidth: 80  },
  { key: 'Düzenlenme Tarihi', label: 'Düzenlenme Tarihi', defaultVisible: true,  defaultWidth: 120 },
  { key: 'Vade Tarihi',       label: 'Vade Tarihi',       defaultVisible: true,  defaultWidth: 120 },
  { key: 'Dövizli Tutar',     label: 'Dövizli Tutar',     defaultVisible: true,  defaultWidth: 110 },
  { key: 'Döviz Türü',        label: 'Döviz Türü',        defaultVisible: true,  defaultWidth: 90  },
  { key: 'Tutar',             label: 'Tutar',             defaultVisible: true,  defaultWidth: 110 },
];

// jsPDF türleri için extend
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface CekSenetTableProps {
  data: any[];
  /** Timeline veya veri kaynağı değiştiğinde filtreleri sıfırlamak için. data referansı yerine bu kullanılır (checkbox seçiminde yanlış sıfırlama olmasın diye). */
  filterResetKey?: string;
  stats?: {
    totalCount: number;
    turDagilimi: { name: string; count: number }[];
    statuDagilimi: { name: string; count: number }[];
    modulDagilimi: { name: string; count: number }[];
  };
  currentUser?: { name: string | null; email?: string; id: number | string } | null;
}

type SortDirection = 'asc' | 'desc' | null;

export default function CekSenetTable({ data, filterResetKey, stats, currentUser }: CekSenetTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Vade Tarihi');
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [columnFilterSelections, setColumnFilterSelections] = useState<Record<string, string[]>>({});
  const filterTriggerRef = useRef<HTMLElement | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const [filterDropdownRect, setFilterDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Dışarı tıklayınca filtre dropdown'unu kapat
  useEffect(() => {
    if (!openFilterColumn) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        filterTriggerRef.current?.contains(target) ||
        filterDropdownRef.current?.contains(target)
      )
        return;
      setOpenFilterColumn(null);
      setFilterDropdownRect(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openFilterColumn]);

  // Timeline/veri kaynağı değişince arama ve kolon filtrelerini sıfırla (filterResetKey ile; data referansı gereksiz sıfırlamaya yol açmasın)
  useEffect(() => {
    setSearchTerm('');
    setColumnFilterSelections({});
    setCurrentPage(1);
  }, [filterResetKey ?? null]);

  // Kolon genişliği ve sürükle-bırak
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
  } = useColumnPreferences('cek-senet-raporu', COLUMN_DEFS);

  const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
    COLUMN_DEFS.map(d => [d.key, d.defaultWidth])
  );

  const getColWidth = (key: string) =>
    localWidths[key] ?? committedWidthsRef.current[key] ?? savedWidths[key] ?? DEFAULT_WIDTHS[key] ?? 150;

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizingColumn(column);
    const startX = e.clientX;
    const startWidth = getColWidth(column);
    let latestWidths: Record<string, number> = { ...savedWidths, ...committedWidthsRef.current };
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (e.clientX - startX));
      latestWidths = { ...latestWidths, [column]: newWidth };
      setLocalWidths(prev => ({ ...prev, [column]: newWidth }));
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

  // Drag-to-reorder handlers
  const handleDragStart = (e: React.DragEvent, column: string) => {
    if (resizingColumn) { e.preventDefault(); return; }
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
    if (!draggedCol || draggedCol === column) { setDraggedCol(null); setDragOverCol(null); return; }
    const fromIdx = orderedColumns.findIndex(c => c.key === draggedCol);
    const toIdx = orderedColumns.findIndex(c => c.key === column);
    if (fromIdx !== -1 && toIdx !== -1) reorder(fromIdx, toIdx);
    setDraggedCol(null); setDragOverCol(null);
  };
  const handleDragEnd = () => { setDraggedCol(null); setDragOverCol(null); };

  // Görünür kolonlar (sıralı) — export/print için de kullanılır
  const columns = orderedColumns
    .filter(c => c.visible)
    .map(c => {
      const def = COLUMN_DEFS.find(d => d.key === c.key)!;
      return { key: c.key, label: def.label, sortable: true };
    });

  // Kolon bazlı filtrelerde ve seçenek listesinde kullanılacak hücre metni
  const getFilterDisplayValue = (item: any, colKey: string): string => {
    let value: any;
    if (colKey === 'Tür') {
      value = item['Tür'] ?? item.Tur;
    } else if (colKey === 'Güncel Durumu') {
      value = item['Güncel Durumu'] ?? item.Statu;
    } else if (colKey === 'Döviz Türü') {
      value = item['Döviz Türü'] ?? item.Modul;
    } else {
      value = item[colKey];
    }
    return value != null ? String(value) : '';
  };

  // Her kolon için benzersiz değer listesi (Excel checkbox filtresi için)
  const columnOptions = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const item of data) {
        const v = getFilterDisplayValue(item, col.key);
        if (v) set.add(v);
      }
      result[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR'));
    }
    return result;
  }, [data, columns]);

  const toggleFilterValue = (colKey: string, value: string) => {
    setColumnFilterSelections(prev => {
      const current = prev[colKey] ?? [];
      const exists = current.includes(value);
      const next = exists ? current.filter(v => v !== value) : [...current, value];
      if (next.length === 0) {
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

  const activeFilterCount = Object.values(columnFilterSelections).filter(
    (arr) => arr && arr.length > 0
  ).length;

  const clearFilters = () => {
    setSearchTerm('');
    setColumnFilterSelections({});
  };

  // Arama ve filtreleme
  const filteredData = data.filter(item => {
    // Arama filtresi
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        (item['Portföy No']?.toString().toLowerCase().includes(searchLower)) ||
        (item['Seri No']?.toString().toLowerCase().includes(searchLower)) ||
        ((item['Tür'] ?? item.Tur)?.toString().toLowerCase().includes(searchLower)) ||
        ((item['Güncel Durumu'] ?? item.Statu)?.toString().toLowerCase().includes(searchLower)) ||
        (item['İlgili Hesap']?.toString().toLowerCase().includes(searchLower)) ||
        ((item['Döviz Türü'] ?? item.Modul)?.toString().toLowerCase().includes(searchLower))
      );
      if (!matchesSearch) return false;
    }

    // Kolon bazlı checkbox filtreleri (Excel benzeri)
    for (const [colKey, selectedValues] of Object.entries(columnFilterSelections)) {
      if (!selectedValues || selectedValues.length === 0) continue;
      const cellStr = getFilterDisplayValue(item, colKey);
      if (!selectedValues.includes(cellStr)) {
        return false;
      }
    }

    return true;
  });

  // Tarih parse fonksiyonu
  const parseDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    
    // ISO format (2026-01-15T00:00:00)
    if (dateStr.includes('T')) {
      return new Date(dateStr).getTime();
    }
    
    // DD.MM.YYYY formatı
    if (dateStr.includes('.')) {
      const [day, month, year] = dateStr.split('.');
      return new Date(`${year}-${month}-${day}`).getTime();
    }
    
    return new Date(dateStr).getTime() || 0;
  };

  // Sıralama
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    // Tarih sütunları için özel işlem
    if (sortColumn.includes('Tarihi') || sortColumn.includes('Tarih')) {
      aValue = parseDate(aValue);
      bValue = parseDate(bValue);
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Sayfalama
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  // Sayfa değişimi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortColumn, sortDirection, columnFilterSelections]);

  // Sıralama işlevi
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Tarihi formatla
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    
    try {
      // ISO format (2026-01-15T00:00:00)
      if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      }
      
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Excel export
  const exportToExcel = () => {
    const exportData = sortedData.map(item => ({
      'Referans': item.Referans,
      'Portföy No': item['Portföy No'],
      'Seri No': item['Seri No'],
      'Tür': item['Tür'] ?? item.Tur,
      'İlgili Hesap': item['İlgili Hesap'],
      'Çek/Senet Sahibi': item['Çek/Senet Sahibi'],
      'Güncel Durumu': item['Güncel Durumu'] ?? item.Statu,
      'Devir': item.Devir,
      'Düzenlenme Tarihi': formatDate(item['Düzenlenme Tarihi']),
      'Vade Tarihi': formatDate(item['Vade Tarihi']),
      'Dövizli Tutar': item['Dövizli Tutar'],
      'Döviz Türü': item['Döviz Türü'] ?? item.Modul,
      'Tutar': item.Tutar
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Çek Senet Raporu');
    XLSX.writeFile(workbook, `cek_senet_raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Yazdırma fonksiyonu
  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle yazdırma penceresi açılamıyor.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Çek Senet Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 12px; }
            .header { margin-bottom: 15px; }
            .header-top { display: flex; align-items: flex-start; gap: 15px; }
            .logo { width: 60px; height: auto; flex-shrink: 0; }
            .header-content { flex: 1; }
            .header h1 { color: #dc2626; margin: 0 0 5px 0; font-size: 18px; text-align: left; }
            .header p { margin: 2px 0; color: #666; font-size: 11px; text-align: left; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
            th { background-color: #dc2626; color: white; font-weight: bold; font-size: 10px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
            .stat-card { background: #f3f4f6; padding: 10px; border-radius: 6px; text-align: center; }
            .stat-title { font-size: 10px; color: #6b7280; margin-bottom: 3px; }
            .stat-value { font-size: 16px; font-weight: bold; color: #111827; }
            @media print {
              body { margin: 0; font-size: 10px; }
              table { font-size: 9px; }
              th, td { padding: 4px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>📋 Çek/Senet Raporu</h1>
                <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
                <p>Toplam Kayıt: ${sortedData.length}</p>
                ${searchTerm ? `<p>Arama Filtresi: "${searchTerm}"</p>` : ''}
              </div>
            </div>
          </div>
          
          ${stats ? `
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-title">Toplam Kayıt</div>
              <div class="stat-value">${stats.totalCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Farklı Tür</div>
              <div class="stat-value">${stats.turDagilimi.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-title">Farklı Güncel Durum</div>
              <div class="stat-value">${stats.statuDagilimi.length}</div>
            </div>
          </div>
          ` : ''}
          
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sortedData.map(row => `
                <tr>
                  ${columns.map(col => {
                    let value = row[col.key] ?? (col.key === 'Tür' ? row.Tur : col.key === 'Güncel Durumu' ? row.Statu : col.key === 'Döviz Türü' ? row.Modul : undefined);
                    if (col.key.includes('Tarihi') || col.key.includes('Tarih')) {
                      value = formatDate(value);
                    } else if (col.key === 'Tutar' || col.key === 'Dövizli Tutar') {
                      value = value != null ? Number(value).toLocaleString('tr-TR') : '-';
                    }
                    return `<td>${value != null && value !== '' ? value : '-'}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 10px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde ${currentUser?.name || 'Bilinmeyen Kullanıcı'} tarafından BT Rapor sistemi üzerinden alınmıştır.
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            window.onafterprint = function() {
              window.close();
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      alert('Yazdırma işlemi sırasında hata oluştu.');
    }
  };

  // PDF export
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Başlık alanı
    doc.setFillColor(220, 53, 69);
    doc.rect(0, 0, 297, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Çek/Senet Raporu', 14, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Toplam Kayıt: ${sortedData.length}`, 14, 22);
    
    doc.setTextColor(0, 0, 0);

    // Tablo verilerini hazırla
    const tableColumns = columns.map(col => col.label);
    const tableRows = sortedData.map(item => 
      columns.map(col => {
        let value = item[col.key] ?? (col.key === 'Tür' ? item.Tur : col.key === 'Güncel Durumu' ? item.Statu : col.key === 'Döviz Türü' ? item.Modul : undefined);
        if (col.key.includes('Tarihi') || col.key.includes('Tarih')) {
          value = formatDate(value);
        } else if (col.key === 'Tutar' || col.key === 'Dövizli Tutar') {
          value = value != null ? Number(value).toLocaleString('tr-TR') : '-';
        }
        return value != null && value !== '' ? String(value) : '-';
      })
    );

    // Tablo oluştur
    doc.autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: 32,
      styles: { 
        fontSize: 7,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [220, 53, 69],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: { 
        fillColor: [248, 249, 250] 
      },
      margin: { top: 5, right: 14, bottom: 14, left: 14 }
    });

    // Alt bilgi
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('btRapor - Çek/Senet Raporu', 14, finalY);
    doc.text(`Sayfa 1`, 280, finalY);

    doc.save(`cek_senet_raporu_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Güncel durum / Statü için renk belirleme
  const getStatuColor = (statu: string): string => {
    switch (statu) {
      case 'Portföyde': return 'bg-blue-100 text-blue-800';
      case 'Ciro Edildi': return 'bg-purple-100 text-purple-800';
      case 'Teminata Verildi': return 'bg-yellow-100 text-yellow-800';
      case 'Tahsile Verildi': return 'bg-orange-100 text-orange-800';
      case 'Tahsil Edildi': return 'bg-green-100 text-green-800';
      case 'Protesto Edildi': return 'bg-red-100 text-red-800';
      case 'Kendi Çekimiz-Verilen Çek': return 'bg-indigo-100 text-indigo-800';
      case 'Kendi Çekimiz': return 'bg-indigo-100 text-indigo-800';
      case 'Borç Senedimiz': return 'bg-pink-100 text-pink-800';
      case 'Karsiligi Yok': return 'bg-red-100 text-red-800';
      case 'Iade Edildi': return 'bg-gray-100 text-gray-800';
      case 'Tahsil Edilemiyor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Tür için renk belirleme
  const getTurColor = (tur: string): string => {
    switch (tur) {
      case 'Müşteri Çeki': return 'bg-cyan-100 text-cyan-800';
      case 'Müşteri Senedi': return 'bg-teal-100 text-teal-800';
      case 'Kendi Çekimiz': return 'bg-amber-100 text-amber-800';
      case 'Borç Senedimiz': return 'bg-rose-100 text-rose-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Kontroller */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow">
        <div className="flex flex-col gap-4">
          {/* Üst satır: Arama ve Export */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Arama */}
            <div className="flex-1 w-full max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Portföy no, seri no, tür, güncel durum veya ilgili hesap ile ara..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Kontroller */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {/* Sayfa başına kayıt */}
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              {/* Export butonları */}
              <button
                onClick={exportToExcel}
                className="px-3 py-2 md:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Excel</span>
              </button>
              
              <button
                onClick={handlePrint}
                className="px-3 py-2 md:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span className="hidden sm:inline">Yazdır</span>
              </button>

              <button
                onClick={exportToPDF}
                className="px-3 py-2 md:px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">PDF</span>
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

          {/* Alt satır: (eski tür/kategori filtreleri kaldırıldı) */}
        </div>
      </div>

      {/* Tablo alanı: Mobil kart + Masaüstü tablo + Sayfalama */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Mobil: Kart görünümü */}
      <div className="md:hidden">
        {activeFilterCount > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <span className="text-sm text-amber-800">{activeFilterCount} filtre aktif</span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-amber-700 hover:text-amber-900"
            >
              Filtreleri temizle
            </button>
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {paginatedData.map((item, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={index}
                className={`p-4 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">
                      {item['Portföy No']} / {item['Seri No']}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTurColor((item['Tür'] ?? item.Tur) || '')}`}>
                        {item['Tür'] ?? item.Tur}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatuColor((item['Güncel Durumu'] ?? item.Statu) || '')}`}>
                        {item['Güncel Durumu'] ?? item.Statu}
                      </span>
                      {item.Devir === 'D' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">D</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">
                      {item.Tutar != null ? Number(item.Tutar).toLocaleString('tr-TR') : '-'} ₺
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{formatDate(item['Vade Tarihi'])}</div>
                  </div>
                </div>
                {item['İlgili Hesap'] && (
                  <div className="text-xs text-gray-600 truncate" title={item['İlgili Hesap']}>
                    {item['İlgili Hesap']}
                  </div>
                )}
                {item['Çek/Senet Sahibi'] && (
                  <div className="text-xs text-gray-500 mt-0.5">{item['Çek/Senet Sahibi']}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Masaüstü: Tablo görünümü */}
      <div className="hidden md:block overflow-visible">
        <div className="overflow-x-auto overflow-y-visible relative">
          <table
            className="border-collapse"
            style={{
              tableLayout: 'fixed',
              width: `${columns.reduce((s, c) => s + getColWidth(c.key), 0)}px`,
              minWidth: `${columns.reduce((s, c) => s + getColWidth(c.key), 0)}px`,
            }}
          >
            <colgroup>
              {columns.map(col => <col key={col.key} style={{ width: `${getColWidth(col.key)}px` }} />)}
              <col style={{ width: 'auto' }} />
            </colgroup>
            <thead>
              {/* Başlık satırı + Excel tarzı popup filtre */}
              <tr className="bg-slate-800 text-white">
                {columns.map((column) => {
                  const w = getColWidth(column.key);
                  const options = columnOptions[column.key] ?? [];
                  const selected = columnFilterSelections[column.key] ?? [];
                  const hasActive = selected.length > 0;
                  const isResizingThis = resizingColumn === column.key;
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
                      style={{ width: w, minWidth: 0, overflow: 'visible' }}
                    >
                      {isDragOver && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 z-20" />
                      )}
                      <div className="flex items-center gap-1.5 px-3 py-3 hover:bg-slate-700/60 transition-colors">
                        <div
                          className="flex items-center gap-1.5 flex-1 cursor-grab active:cursor-grabbing"
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
                        {/* Excel tarzı filtre butonu */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = openFilterColumn === column.key ? null : column.key;
                            if (next) {
                              filterTriggerRef.current = e.currentTarget as HTMLElement;
                              const th = (e.currentTarget as HTMLElement).closest('th');
                              const rect = th?.getBoundingClientRect();
                              setFilterDropdownRect(
                                rect
                                  ? {
                                      top: rect.bottom + 4,
                                      left: rect.left,
                                      width: Math.max(rect.width, 180),
                                    }
                                  : null
                              );
                            } else {
                              setFilterDropdownRect(null);
                            }
                            setOpenFilterColumn(next);
                          }}
                          className={`ml-1 flex items-center justify-center rounded px-1.5 py-1 text-[10px] border ${
                            hasActive
                              ? 'border-emerald-400 bg-slate-900 text-emerald-200'
                              : 'border-slate-600 bg-slate-900 text-slate-200'
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.382a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 14.414V19l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.09A1 1 0 013 6.382V4z"
                            />
                          </svg>
                        </button>
                      </div>
                      {/* Kolon filtre dropdown'u - portal ile body'de (z-index sorunu için) */}
                      {openFilterColumn === column.key &&
                        filterDropdownRect &&
                        typeof document !== 'undefined' &&
                        createPortal(
                          <div
                            ref={filterDropdownRef}
                            className="fixed z-[9999] min-w-[180px] max-w-xs bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-72 overflow-auto"
                            style={{
                              top: filterDropdownRect.top,
                              left: filterDropdownRect.left,
                              width: filterDropdownRect.width,
                            }}
                          >
                            <div className="flex items-center justify-between px-2 py-1 border-b border-slate-600 text-[11px] text-slate-200">
                              <span>{column.label} filtresi</span>
                              {hasActive && (
                                <button
                                  type="button"
                                  onClick={() => clearColumnFilter(column.key)}
                                  className="text-[10px] text-emerald-300 hover:text-emerald-200"
                                >
                                  Temizle
                                </button>
                              )}
                            </div>
                            <div className="px-2 py-1 space-y-1">
                              {options.length === 0 ? (
                                <div className="text-[11px] text-slate-400 px-1 py-1">
                                  Değer bulunamadı
                                </div>
                              ) : (
                                options.map(opt => (
                                  <label
                                    key={opt}
                                    className="flex items-center gap-2 text-[11px] text-slate-100 cursor-pointer hover:bg-slate-700 rounded px-1 py-0.5"
                                  >
                                    <input
                                      type="checkbox"
                                      className="w-3.5 h-3.5 rounded text-emerald-500 accent-emerald-500"
                                      checked={selected.includes(opt)}
                                      onChange={() => toggleFilterValue(column.key, opt)}
                                    />
                                    <span className="truncate" title={opt}>
                                      {opt}
                                    </span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>,
                          document.body
                        )}
                      <div
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, column.key);
                        }}
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center group z-10"
                      >
                        <div
                          className={`w-0.5 h-4/5 rounded-full transition-all ${
                            isResizingThis
                              ? 'bg-emerald-400 w-1'
                              : 'bg-slate-600 group-hover:bg-emerald-400 group-hover:w-1'
                          }`}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="bg-slate-800 border-b border-slate-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((item, index) => {
                const isEven = index % 2 === 0;
                return (
                  <tr key={index} className={`transition-colors hover:bg-blue-50/40 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                    {columns.map(col => (
                      <td key={col.key}
                        className="px-3 py-2.5 text-sm whitespace-nowrap overflow-hidden"
                        style={{ width: getColWidth(col.key), minWidth: 0, overflow: 'hidden' }}
                      >
                        {col.key === 'Referans' && <span className="text-gray-600 text-xs">{item.Referans}</span>}
                        {col.key === 'Portföy No' && <span className="font-medium text-gray-900">{item['Portföy No']}</span>}
                        {col.key === 'Seri No' && <span className="text-gray-700">{item['Seri No']}</span>}
                        {col.key === 'Tür' && <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTurColor((item['Tür'] ?? item.Tur) || '')}`}>{item['Tür'] ?? item.Tur}</span>}
                        {col.key === 'İlgili Hesap' && <span className="text-gray-700 truncate block max-w-[200px]" title={item['İlgili Hesap']}>{item['İlgili Hesap']}</span>}
                        {col.key === 'Çek/Senet Sahibi' && <span className="text-gray-700">{item['Çek/Senet Sahibi']}</span>}
                        {col.key === 'Güncel Durumu' && <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatuColor((item['Güncel Durumu'] ?? item.Statu) || '')}`}>{item['Güncel Durumu'] ?? item.Statu}</span>}
                        {col.key === 'Devir' && (item.Devir === 'D' ? <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 font-medium">D</span> : <span className="text-gray-300">-</span>)}
                        {col.key === 'Düzenlenme Tarihi' && <span className="text-gray-700">{formatDate(item['Düzenlenme Tarihi'])}</span>}
                        {col.key === 'Vade Tarihi' && <span className="font-medium text-gray-900">{formatDate(item['Vade Tarihi'])}</span>}
                        {col.key === 'Dövizli Tutar' && <span className="text-gray-700">{item['Dövizli Tutar'] != null ? Number(item['Dövizli Tutar']).toLocaleString('tr-TR') : ''}</span>}
                        {col.key === 'Döviz Türü' && <span className="text-gray-700">{item['Döviz Türü'] ?? item.Modul}</span>}
                        {col.key === 'Tutar' && <span className="font-medium text-gray-900">{item.Tutar != null ? Number(item.Tutar).toLocaleString('tr-TR') : ''}</span>}
                      </td>
                    ))}
                    <td className={isEven ? 'bg-white' : 'bg-gray-50/50'} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

        {/* Sayfalama (mobil + masaüstü) */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Önceki
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sonraki
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{startIndex + 1}</span> - <span className="font-medium">{Math.min(startIndex + itemsPerPage, sortedData.length)}</span> arası, 
                  toplam <span className="font-medium">{sortedData.length}</span> kayıt
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Önceki</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {(() => {
                    const pages = [];
                    const maxVisiblePages = 7;
                    
                    if (totalPages <= maxVisiblePages) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      const halfVisible = Math.floor(maxVisiblePages / 2);
                      
                      if (currentPage <= halfVisible + 1) {
                        for (let i = 1; i <= maxVisiblePages - 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      } else if (currentPage >= totalPages - halfVisible) {
                        pages.push(1);
                        pages.push('...');
                        for (let i = totalPages - maxVisiblePages + 2; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        pages.push('...');
                        for (let i = currentPage - halfVisible; i <= currentPage + halfVisible; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                    }
                    
                    return pages.map((page, index) => {
                      if (page === '...') {
                        return (
                          <span
                            key={`ellipsis-${index}`}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                          >
                            ...
                          </span>
                        );
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-red-50 border-red-500 text-red-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Sonraki</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Veri yoksa */}
      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Kayıt bulunamadı</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || activeFilterCount > 0 
              ? 'Arama ve filtre kriterlerinize uygun kayıt bulunamadı.' 
              : 'Henüz çek/senet kaydı bulunmuyor.'}
          </p>
          {(searchTerm || activeFilterCount > 0) && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-red-600 hover:text-red-800"
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

