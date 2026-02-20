'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';
import ColumnManager from '../ColumnManager';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// jsPDF türleri için extend
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface EnCokSatilanMalzemelerTableProps {
  data: any[];
  filterCodes?: any[];
  loadingFilterCodes?: boolean;
  selectedFilters?: Record<string, string[]>;
  onToggleFilter?: (codeType: string, value: string) => void;
}

type SortDirection = 'asc' | 'desc' | null;

const COLUMN_DEFS = [
  { key: 'Malzeme Kodu',   label: 'Malzeme Kodu',   defaultVisible: true, defaultWidth: 140 },
  { key: 'Malzeme Adı',    label: 'Malzeme Adı',    defaultVisible: true, defaultWidth: 220 },
  { key: 'Toplam Miktar',  label: 'Toplam Miktar',  defaultVisible: true, defaultWidth: 130 },
  { key: 'Toplam Tutar',   label: 'Toplam Tutar',   defaultVisible: true, defaultWidth: 130 },
  { key: 'Grup Kodu',      label: 'Grup Kodu',      defaultVisible: true, defaultWidth: 110 },
  { key: 'Grup Açıklama',  label: 'Grup Açıklama',  defaultVisible: true, defaultWidth: 160 },
  { key: 'Özel Kod 1',     label: 'Özel Kod 1',     defaultVisible: true, defaultWidth: 100 },
  { key: 'Özel Kod 2',     label: 'Özel Kod 2',     defaultVisible: true, defaultWidth: 100 },
  { key: 'Özel Kod 3',     label: 'Özel Kod 3',     defaultVisible: true, defaultWidth: 100 },
  { key: 'Özel Kod 4',     label: 'Özel Kod 4',     defaultVisible: true, defaultWidth: 100 },
  { key: 'Özel Kod 5',     label: 'Özel Kod 5',     defaultVisible: true, defaultWidth: 100 },
];

export default function EnCokSatilanMalzemelerTable({ 
  data,
  filterCodes = [],
  loadingFilterCodes = false,
  selectedFilters = {},
  onToggleFilter = () => {}
}: EnCokSatilanMalzemelerTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Toplam Miktar');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filtreleme state'leri (envanter raporundaki gibi)
  const [showFilters, setShowFilters] = useState(false);
  const [showCodeSelector, setShowCodeSelector] = useState(true);
  const [selectedCodeType, setSelectedCodeType] = useState<string>('');
  const [codeSearchTerm, setCodeSearchTerm] = useState<string>('');

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
  } = useColumnPreferences('en-cok-satilan-malzemeler', COLUMN_DEFS);

  const columns = orderedColumns.filter(c => c.visible).map(c => c.key);

  // Filtreleme kodları için helper fonksiyonlar
  const getCodeTypes = () => {
    const types = Array.from(new Set(filterCodes.map(code => code.ALAN)));
    return types.sort();
  };

  const getFilteredCodes = () => {
    if (!selectedCodeType) return [];
    
    const codes = filterCodes
      .filter(code => code.ALAN === selectedCodeType)
      .filter(code => 
        code.KOD.toLocaleLowerCase('tr-TR').includes(codeSearchTerm.toLocaleLowerCase('tr-TR')) ||
        (code.AÇIKLAMA && code.AÇIKLAMA.toLocaleLowerCase('tr-TR').includes(codeSearchTerm.toLocaleLowerCase('tr-TR')))
      );
    
    return codes.sort((a, b) => a.KOD.localeCompare(b.KOD));
  };

  const getCodeTypeLabel = (codeType: string) => {
    const labels: {[key: string]: string} = {
      'STRGRPCODE': 'Grup Kodu',
      'SPECODE': 'Özel Kod 1',
      'SPECODE2': 'Özel Kod 2',
      'SPECODE3': 'Özel Kod 3',
      'SPECODE4': 'Özel Kod 4',
      'SPECODE5': 'Özel Kod 5'
    };
    return labels[codeType] || codeType;
  };

  const isCodeSelected = (codeType: string, kod: string) => {
    const arr = selectedFilters[codeType] || [];
    return arr.includes(kod);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCodeType('');
    setCodeSearchTerm('');
    setShowCodeSelector(false);
    setCurrentPage(1);
    // Tüm filtreleri temizle
    Object.keys(selectedFilters).forEach(codeType => {
      const codes = selectedFilters[codeType] || [];
      codes.forEach(code => onToggleFilter(codeType, code));
    });
  };
  // const handleOzelKod1Change = (kod: string) => {
  //   setCurrentPage(1);
  //   setSelectedOzelKod1(prev =>
  //     prev.includes(kod) ? prev.filter(k => k !== kod) : [...prev, kod]
  //   );
  // };

  // Sıralama fonksiyonu
  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
    COLUMN_DEFS.map(d => [d.key, d.defaultWidth])
  );

  const getColWidth = (key: string) =>
    localWidths[key] ?? committedWidthsRef.current[key] ?? savedWidths[key] ?? DEFAULT_WIDTHS[key] ?? 150;

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

  // Kod tiplerine karşılık gelen tablo alanları
  const codeFieldMap: {[key: string]: string} = {
    'STRGRPCODE': 'Grup Kodu',
    'SPECODE': 'Özel Kod 1',
    'SPECODE2': 'Özel Kod 2',
    'SPECODE3': 'Özel Kod 3',
    'SPECODE4': 'Özel Kod 4',
    'SPECODE5': 'Özel Kod 5'
  };

  // Arama ve filtreleme (envanter raporundaki gibi)
  const filteredData = data.filter(item => {
    // Arama filtresi
    const matchesSearch = !searchTerm || Object.values(item).some(value => 
      String(value).toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
    );
    
    // Kod filtreleri - her kod tipi için seçilen değerlerin KESİŞİMİ
    const matchesCodes = Object.entries(selectedFilters).every(([type, codes]) => {
      if (!codes || codes.length === 0) return true; // bu tipte seçim yoksa sorun değil
      const codeField = codeFieldMap[type];
      if (!codeField) return true;
      // Özel kod alanları için düzenleme - sadece kod kısmını al (açıklama kısmını çıkar)
      let itemValue = item[codeField];
      if (codeField.includes('Özel Kod') && itemValue && itemValue.includes(' - ')) {
        itemValue = itemValue.split(' - ')[0]; // "000001 - AÇIKLAMA" formatından sadece "000001" al
      }
      return codes.includes(itemValue);
    });
    
    return matchesSearch && matchesCodes;
  });

  // Sıralanmış veri
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    // Sayısal değerler için
    if (sortColumn === 'Toplam Miktar' || sortColumn === 'Toplam Tutar') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Sayfalama
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  // Excel export
  const exportToExcel = () => {
    if (sortedData.length === 0) {
      alert('Dışa aktarılacak veri bulunmuyor.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(sortedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'En Çok Satılan Malzemeler');
    
    // Tarih damgası ekle
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(workbook, `en-cok-satilan-malzemeler-${timestamp}.xlsx`);
  };

  // PDF export
  const exportToPDF = () => {
    if (sortedData.length === 0) {
      alert('Dışa aktarılacak veri bulunmuyor.');
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
    
    // Başlık
    doc.setFontSize(16);
    doc.text('En Çok / En Az Satılan Malzemeler Raporu', 20, 20);
    
    // Tarih
    doc.setFontSize(10);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 20, 30);
    doc.text(`Toplam Kayıt: ${sortedData.length}`, 20, 35);

    // Tablo için veri hazırla
    const tableData = sortedData.map(item => [
      item['Malzeme Kodu'] || '',
      item['Malzeme Adı'] || '',
      parseFloat(item['Toplam Miktar'] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
      parseFloat(item['Toplam Tutar'] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
      item['Grup Kodu'] || '',
      item['Grup Açıklama'] || '',
      item['Özel Kod 1'] || '',
      item['Özel Kod 2'] || '',
      item['Özel Kod 3'] || '',
      item['Özel Kod 4'] || '',
      item['Özel Kod 5'] || ''
    ]);

    // AutoTable kullanarak tabloyu oluştur
    doc.autoTable({
      head: [['Malzeme Kodu', 'Malzeme Adı', 'Toplam Miktar', 'Toplam Tutar', 'Grup Kodu', 'Grup Açıklama', 'Özel Kod 1', 'Özel Kod 2', 'Özel Kod 3', 'Özel Kod 4', 'Özel Kod 5']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 7 }, // Font boyutunu küçülttük çünkü daha fazla kolon var
      headStyles: { fillColor: [220, 38, 38] }, // Tailwind red-600
      margin: { top: 45 }
    });

    // Dosyayı kaydet
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    doc.save(`en-cok-satilan-malzemeler-${timestamp}.pdf`);
  };

  // Değer formatlama fonksiyonları
  const formatNumber = (value: any, isPrice: boolean = false) => {
    const num = parseFloat(value) || 0;
    if (isPrice) {
      return num.toLocaleString('tr-TR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }
    return num.toLocaleString('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    });
  };

  const getSortIcon = (columnName: string) => {
    if (sortColumn !== columnName) {
      return <span className="text-gray-400">↕️</span>;
    }
    return sortDirection === 'asc' ? 
      <span className="text-blue-600">↑</span> : 
      <span className="text-blue-600">↓</span>;
  };

  // Loading durumu artık ana sayfada kontrol ediliyor

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      {/* Arama ve filtre kontrolleri */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Arama Kutusu */}
            <div className="relative">
              <input
                type="text"
                placeholder="Malzeme ara..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
              />
              <span className="absolute left-3 top-3 text-gray-400">🔍</span>
            </div>

            {/* Tüm Filtreleri Temizle Butonu */}
            {(searchTerm || Object.entries(selectedFilters).some(([, codes]) => codes.length > 0)) && (
              <button
                onClick={clearAllFilters}
                className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 flex items-center gap-2"
              >
                <span>🧹</span>
                Tüm Filtreleri Temizle
              </button>
            )}

            {/* Filtre Butonları */}
            {filterCodes.length > 0 && (
              <button
                onClick={() => setShowCodeSelector(!showCodeSelector)}
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showCodeSelector 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>🏷️</span>
                {showCodeSelector ? 'Kod Filtrelerini Gizle' : 'Kod Filtreleri'}
              </button>
            )}
          </div>

          {loadingFilterCodes && (
            <div className="px-4 py-3 text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
              Filtreleme kodları yükleniyor...
            </div>
          )}
        </div>
      </div>

      {/* Kod Filtreleri Bölümü (envanter raporundaki gibi) */}
      {showCodeSelector && filterCodes.length > 0 && (
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="space-y-4">
            {/* Kod Tipi Seçimi */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span>🏷️</span>
                Kod Tipi:
              </label>
              <select
                value={selectedCodeType}
                onChange={(e) => {
                  setSelectedCodeType(e.target.value);
                  setCodeSearchTerm('');
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              >
                <option value="">Kod tipi seçin...</option>
                {getCodeTypes().map(type => (
                  <option key={type} value={type}>{getCodeTypeLabel(type)}</option>
                ))}
              </select>
            </div>

            {selectedCodeType && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>🔍</span>
                    Kod Ara:
                  </label>
                  <input
                    type="text"
                    placeholder="Kod veya açıklama ara..."
                    value={codeSearchTerm}
                    onChange={(e) => setCodeSearchTerm(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm flex-1"
                  />
                </div>

                {/* Kod Listesi */}
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg">
                  {getFilteredCodes().map(code => (
                    <div
                      key={`${code.ALAN}-${code.KOD}`}
                      onClick={() => {
                        onToggleFilter(selectedCodeType, code.KOD);
                      }}
                      className={`p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors duration-200 ${
                        isCodeSelected(selectedCodeType, code.KOD) ? 'bg-blue-100 border-blue-200' : ''
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">{code.KOD}</div>
                      <div className="text-xs text-gray-600 mt-1">{code.AÇIKLAMA}</div>
                    </div>
                  ))}
                  
                  {getFilteredCodes().length === 0 && (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      {codeSearchTerm ? '🔍 Arama kriterine uygun kod bulunamadı' : '📋 Bu kod tipinde kod bulunamadı'}
                    </div>
                  )}
                </div>

                {/* Seçili Kodlar */}
                {Object.entries(selectedFilters).some(([, codes]) => codes.length > 0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <span>✅</span>
                      Seçili Kodlar
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedFilters).map(([type, codes]) =>
                        codes.map(kod => {
                          // Filtre kodundan açıklamayı bul
                          const filterCode = filterCodes.find(fc => fc.ALAN === type && fc.KOD === kod);
                          const description = filterCode ? filterCode.AÇIKLAMA : '';
                          
                          return (
                            <span key={`${type}-${kod}`} className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-3 py-2 rounded-lg border border-blue-200">
                              <span className="text-blue-600 mr-2">🏷️</span>
                              <span className="font-semibold">{getCodeTypeLabel(type)}:</span>
                              <span className="ml-1">{kod}</span>
                              {description && (
                                <span className="ml-2 text-blue-600 text-xs opacity-75">
                                  ({description})
                                </span>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation(); 
                                  onToggleFilter(type, kod);
                                }} 
                                className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                ✖
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Controls */}
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Filtrelenmiş kayıt sayısı */}
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Toplam {filteredData.length} kayıt</span> 
              {data.length !== filteredData.length && (
                <span> ({data.length} kayıttan filtrelenmiş)</span>
              )}
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <ColumnManager
              orderedColumns={orderedColumns}
              columnDefs={COLUMN_DEFS}
              onToggle={toggle}
              onReorder={reorder}
              onShowAll={showAll}
              onHideAll={hideAll}
            />
            
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value={10}>10 satır</option>
              <option value={25}>25 satır</option>
              <option value={50}>50 satır</option>
              <option value={100}>100 satır</option>
            </select>
            
            <button
              onClick={exportToExcel}
              disabled={sortedData.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>📊</span>
              Excel
            </button>
            
            <button
              onClick={exportToPDF}
              disabled={sortedData.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <span>📄</span>
              PDF
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>{filteredData.length} kayıt bulundu</span>
          <span>{startIndex + 1}-{Math.min(endIndex, sortedData.length)} / {sortedData.length} gösteriliyor</span>
        </div>
      </div>

      {/* Table */}
      {currentData.length > 0 ? (
        <div className="overflow-x-auto">
          <table
            className="border-collapse"
            style={{
              tableLayout: 'fixed',
              width: `${columns.reduce((s, c) => s + getColWidth(c), 0)}px`,
              minWidth: `${columns.reduce((s, c) => s + getColWidth(c), 0)}px`,
            }}
          >
            <colgroup>
              {columns.map(col => <col key={col} style={{ width: `${getColWidth(col)}px` }} />)}
              <col style={{ width: 'auto' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-800 text-white">
                {columns.map((column) => {
                  const w = getColWidth(column);
                  const isResizingThis = resizingColumn === column;
                  const isDragging = draggedCol === column;
                  const isDragOver = dragOverCol === column && draggedCol !== column;
                  return (
                    <th key={column}
                      draggable={!resizingColumn}
                      onDragStart={(e) => handleDragStart(e, column)}
                      onDragOver={(e) => handleDragOver(e, column)}
                      onDrop={(e) => handleDrop(e, column)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                      className={`relative text-left text-xs font-bold uppercase tracking-wider select-none border-b border-slate-700 transition-colors ${isDragging ? 'opacity-30' : ''} ${isDragOver ? 'bg-slate-600' : ''}`}
                      style={{ width: w, minWidth: 0, overflow: 'hidden' }}
                    >
                      {isDragOver && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 z-20" />}
                      <div
                        className="flex items-center gap-1.5 px-3 py-3 cursor-grab active:cursor-grabbing hover:bg-slate-700/60 transition-colors"
                        onClick={() => !draggedCol && handleSort(column)}
                      >
                        <svg className="w-2.5 h-2.5 text-slate-500 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 10 16">
                          <circle cx="2.5" cy="3" r="1.5"/><circle cx="2.5" cy="8" r="1.5"/><circle cx="2.5" cy="13" r="1.5"/>
                          <circle cx="7.5" cy="3" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/><circle cx="7.5" cy="13" r="1.5"/>
                        </svg>
                        <span className="truncate flex-1">{column}</span>
                        {sortColumn === column && (
                          <span className="flex-shrink-0 text-emerald-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                      <div
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, column); }}
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center group z-10"
                      >
                        <div className={`w-0.5 h-4/5 rounded-full transition-all ${isResizingThis ? 'bg-emerald-400 w-1' : 'bg-slate-600 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                      </div>
                    </th>
                  );
                })}
                <th className="bg-slate-800 border-b border-slate-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentData.map((item, index) => {
                const isEven = index % 2 === 0;
                return (
                  <tr key={index} className={`transition-colors hover:bg-amber-50/40 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                    {columns.map(col => (
                      <td key={col}
                        className="px-3 py-2.5 text-sm whitespace-nowrap overflow-hidden"
                        style={{ width: getColWidth(col), minWidth: 0, overflow: 'hidden' }}
                      >
                        {col === 'Malzeme Kodu' && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-medium text-gray-700">{item['Malzeme Kodu']}</span>}
                        {col === 'Malzeme Adı' && <span className="font-medium text-gray-900">{item['Malzeme Adı']}</span>}
                        {col === 'Toplam Miktar' && <span className="text-right block tabular-nums text-gray-800">{item['Toplam Miktar']?.toLocaleString('tr-TR')}</span>}
                        {col === 'Toplam Tutar' && <span className="text-right block tabular-nums text-gray-800">{typeof item['Toplam Tutar'] === 'number' ? item['Toplam Tutar'].toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : item['Toplam Tutar']}</span>}
                        {!['Malzeme Kodu','Malzeme Adı','Toplam Miktar','Toplam Tutar'].includes(col) && (
                          <span className="text-gray-600 truncate block">{item[col] ?? '-'}</span>
                        )}
                      </td>
                    ))}
                    <td className={isEven ? 'bg-white' : 'bg-gray-50/50'} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Veri Bulunamadı</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Arama kriterlerinize uygun kayıt bulunamadı.' : 'Henüz rapor verisi bulunmamaktadır.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Önceki
              </button>
              
              <span className="text-sm text-gray-700">
                Sayfa {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sonraki
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              Toplam {sortedData.length} kayıt
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 