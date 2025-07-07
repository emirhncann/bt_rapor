'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// jsPDF türleri için extend
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface EnvanterRaporuTableProps {
  data: any[];
  dynamicColumns: string[];
  filterCodes?: any[];
  loadingFilterCodes?: boolean;
  selectedFilters: Record<string, string[]>;
  onToggleFilter: (codeType: string, code: string) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export default function EnvanterRaporuTable({ 
  data, 
  dynamicColumns, 
  filterCodes = [], 
  loadingFilterCodes = false,
  selectedFilters,
  onToggleFilter
}: EnvanterRaporuTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Malzeme Kodu');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filtreleme kodları için state'ler
  const [selectedCodeType, setSelectedCodeType] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [codeSearchTerm, setCodeSearchTerm] = useState<string>('');
  const [showCodeSelector, setShowCodeSelector] = useState(true);

  // Sabit kolonlar
  const fixedColumns = ['Malzeme Ref', 'Malzeme Kodu', 'Malzeme Adı', 'Grup Kodu', 'Grup Kodu Açıklaması', 'Özel Kod', 'Özel Kod Açıklaması', 'Özel Kod2', 'Özel Kod2 Açıklaması', 'Özel Kod3', 'Özel Kod3 Açıklaması', 'Özel Kod4', 'Özel Kod4 Açıklaması', 'Özel Kod5', 'Özel Kod5 Açıklaması'];
  // Tüm kolonlar (sabit + dinamik)
  const allColumns = [...fixedColumns, ...dynamicColumns];

  // Sayısal sütunlar (dinamik kolonlar)
  const numericColumns = [...dynamicColumns];

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Sayı formatla
  const formatNumber = (value: number) => {
    return value.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Varsayılan sütun genişlikleri
  const defaultColumnWidths: { [key: string]: number } = {
    'Malzeme Ref': 120,
    'Malzeme Kodu': 150,
    'Malzeme Adı': 300,
    'Grup Kodu': 120,
    'Grup Kodu Açıklaması': 200,
    'Özel Kod': 120,
    'Özel Kod Açıklaması': 200,
    'Özel Kod2': 120,
    'Özel Kod2 Açıklaması': 200,
    'Özel Kod3': 120,
    'Özel Kod3 Açıklaması': 200,
    'Özel Kod4': 120,
    'Özel Kod4 Açıklaması': 200,
    'Özel Kod5': 120,
    'Özel Kod5 Açıklaması': 200,
    ...Object.fromEntries(dynamicColumns.map(col => [col, 150]))
  };

  // Sütun genişliğini al
  const getColumnWidth = (column: string): number => {
    return columnWidths[column] || defaultColumnWidths[column] || 150;
  };

  // Mouse olayları için handlers
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault(); // Seçimi önle
    setIsResizing(true);
    setResizingColumn(column);
    const startX = e.pageX;
    const startWidth = getColumnWidth(column);

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizingColumn === column) {
        const width = startWidth + (e.pageX - startX);
        setColumnWidths(prev => ({
          ...prev,
          [column]: Math.max(100, width) // Minimum 100px
        }));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Sayfa başına öğe sayısını değiştir
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

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
        code.KOD.toLowerCase().includes(codeSearchTerm.toLowerCase()) ||
        code.AÇIKLAMA.toLowerCase().includes(codeSearchTerm.toLowerCase())
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

  const clearCodeFilters = () => {
    setSelectedCodeType('');
    setSelectedCode('');
    setCodeSearchTerm('');
    setShowCodeSelector(false);
  };

  // Seçim highlight
  const isCodeSelected = (codeType:string, kod:string)=>{
    const arr = selectedFilters[codeType]||[];
    return arr.includes(kod);
  };

  // Filtrelenmiş ve sıralanmış veri
  const filteredData = data.filter(item => {
    // Arama filtresi
    const matchesSearch = Object.values(item).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Sayı filtresi
    let matchesNumeric = true;
    if (filterColumn && (minValue || maxValue)) {
      const columnValue = safeParseFloat(item[filterColumn]);
      const min = minValue ? safeParseFloat(minValue) : -Infinity;
      const max = maxValue ? safeParseFloat(maxValue) : Infinity;
      matchesNumeric = columnValue >= min && columnValue <= max;
    }
    
    // Kod filtresi - Yeni şemaya göre filtreleme
    let matchesCode = true;
    if (selectedCodeType && selectedCode) {
      const codeFieldMap: {[key: string]: string} = {
        'STRGRPCODE': 'Grup Kodu',
        'SPECODE': 'Özel Kod',
        'SPECODE2': 'Özel Kod2',
        'SPECODE3': 'Özel Kod3',
        'SPECODE4': 'Özel Kod4',
        'SPECODE5': 'Özel Kod5'
      };
      
      const codeField = codeFieldMap[selectedCodeType];
      if (codeField) {
        matchesCode = item[codeField] === selectedCode;
      }
    }
    
    return matchesSearch && matchesNumeric && matchesCode;
  }).sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    // Sayısal sütunlar için
    if (numericColumns.includes(sortColumn)) {
      const aNum = safeParseFloat(aValue);
      const bNum = safeParseFloat(bValue);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // Metin sütunları için
    const aStr = String(aValue || '').toLowerCase();
    const bStr = String(bValue || '').toLowerCase();
    
    return sortDirection === 'asc' ? 
      aStr.localeCompare(bStr, 'tr') : 
      bStr.localeCompare(aStr, 'tr');
  });

  // Sayfalama
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Export fonksiyonları
  const exportToExcel = () => {
    try {
      const exportData = filteredData.map(row => {
        const newRow: any = {};
        allColumns.forEach(key => {
          if (numericColumns.includes(key)) {
            const value = safeParseFloat(row[key]);
            newRow[key] = formatNumber(value);
          } else {
            newRow[key] = row[key];
          }
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Envanter Raporu');

      // Sütun genişliklerini ayarla
      const columnWidths = allColumns.map(key => {
        if (key === 'Malzeme Adı') return { wch: 35 };
        if (key === 'Malzeme Kodu') return { wch: 20 };
        if (key === 'Malzeme Ref') return { wch: 15 };
        if (key.includes('Açıklama')) return { wch: 25 };
        if (numericColumns.includes(key)) return { wch: 15 };
        return { wch: 12 };
      });
      worksheet['!cols'] = columnWidths;

      const fileName = `Envanter_Raporu_${new Date().toLocaleDateString('tr-TR').replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  const exportToPDF = () => {
    try {
      // Toplam hesaplamalar
      const totals = numericColumns.reduce((acc, col) => {
        acc[col] = filteredData.reduce((sum, item) => sum + safeParseFloat(item[col]), 0);
        return acc;
      }, {} as {[key: string]: number});

      // Yazdırma için HTML oluştur
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle PDF yazdırma penceresi açılamıyor.');
        return;
      }

      const statsHtml = numericColumns.map(col => `
        <div class="stat-box">
          <div class="stat-title">${col}</div>
          <div class="stat-value">${formatNumber(totals[col])}</div>
          <div class="stat-subtitle">Toplam Stok</div>
        </div>
      `).join('');

      const tableRows = filteredData.map(row => `
        <tr>
          <td>${row['Malzeme Kodu'] || ''}</td>
          <td>${row['Malzeme Adı'] || ''}</td>
          ${numericColumns.map(col => `
            <td class="number">${formatNumber(safeParseFloat(row[col]))}</td>
          `).join('')}
        </tr>
      `).join('');

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Envanter Raporu - PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 30px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: #991b1b; margin: 0 0 8px 0; font-size: 22px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-align: left; }
            .header .date-range { background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 6px; margin-top: 10px; border-left: 3px solid #fbbf24; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-title { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 14px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 8px; color: #9ca3af; margin-top: 2px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; font-weight: bold; }
            .text-center { text-align: center; }
            .status-badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; }
            .text-green-600 { color: #16a34a; }
            .bg-green-100 { background-color: #dcfce7; }
            .text-red-600 { color: #dc2626; }
            .bg-red-100 { background-color: #fee2e2; }
            .text-gray-600 { color: #6b7280; }
            .bg-gray-100 { background-color: #f3f4f6; }
            
            @media print {
              body { margin: 0; font-size: 10px; }
              .stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 15px; }
              .stat-box { padding: 8px; }
              table { font-size: 8px; }
              th, td { padding: 3px; }
              .header { margin-bottom: 20px; padding: 15px; }
              .header-top { gap: 15px; margin-bottom: 10px; }
              .logo { width: 75px; }
              .header h1 { font-size: 16px; margin: 0 0 3px 0; }
              .header p { font-size: 9px; margin: 1px 0; }
              .stat-title { font-size: 9px; }
              .stat-value { font-size: 12px; }
              .stat-subtitle { font-size: 7px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>ENVANTER RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                <p><strong>Toplam Ürün:</strong> ${filteredData.length} adet</p>
                <p><strong>Rapor Türü:</strong> Detaylı Envanter Raporu</p>
                <p><strong>Ambar Sayısı:</strong> ${dynamicColumns.length} adet</p>
              </div>
            </div>
          </div>
          
          <!-- İstatistikler -->
          <div class="stats-grid">
            ${statsHtml}
          </div>
          
          <!-- Tablo -->
          <table>
            <thead>
              <tr>
                <th>Malzeme Kodu</th>
                <th>Malzeme Adı</th>
                ${numericColumns.map(col => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
    } catch (error) {
      console.error('PDF export hatası:', error);
      alert('PDF dosyası oluşturulurken hata oluştu.');
    }
  };

  // Sıralama işlemi
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => {
        if (prev === 'asc') return 'desc';
        if (prev === 'desc') return null;
        return 'asc';
      });
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtreleri temizle
  const clearFilters = () => {
    setSearchTerm('');
    setFilterColumn('');
    setMinValue('');
    setMaxValue('');
    setCurrentPage(1);
    clearCodeFilters(); // Kod filtrelerini de temizle
  };

  // Sıralama ikonu
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return '↕️';
    if (sortDirection === 'asc') return '↑';
    if (sortDirection === 'desc') return '↓';
    return '↕️';
  };

  // Sayfalama işlemleri
  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number') {
      setCurrentPage(page);
    }
  };

  // Sayfa numaralarını oluştur
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      pageNumbers.push(1);
      if (startPage > 2) pageNumbers.push('...');
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      {/* Arama ve filtre kontrolleri */}
      <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-2.5">🔍</span>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {showFilters ? 'Filtreleri Gizle' : 'Filtreleri Göster'} 📊
          </button>

          {filterCodes.length > 0 && (
            <button
              onClick={() => setShowCodeSelector(!showCodeSelector)}
              className="px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {showCodeSelector ? 'Kod Filtrelerini Gizle' : 'Kod Filtreleri'} 🏷️
            </button>
          )}

          {loadingFilterCodes && (
            <div className="px-4 py-2 text-sm text-gray-500">
              Filtreleme kodları yükleniyor...
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value={10}>10 Satır</option>
            <option value={25}>25 Satır</option>
            <option value={50}>50 Satır</option>
            <option value={100}>100 Satır</option>
          </select>

          <button
            onClick={exportToExcel}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Excel 📊
          </button>

          <button
            onClick={exportToPDF}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            PDF 📄
          </button>
        </div>
      </div>

      {/* Sayısal filtreler */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <select
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Sütun Seçin</option>
              {numericColumns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Min Değer"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />

            <input
              type="number"
              placeholder="Max Değer"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />

            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              Filtreleri Temizle 🧹
            </button>
          </div>
        </div>
      )}

      {/* Kod Filtreleri */}
      {showCodeSelector && filterCodes.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-blue-50">
          <div className="space-y-4">
            {/* Kod Tipi Seçimi */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Kod Tipi:</label>
              <select
                value={selectedCodeType}
                onChange={(e) => {
                  setSelectedCodeType(e.target.value);
                  setSelectedCode('');
                  setCodeSearchTerm('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Kod Tipi Seçin</option>
                {getCodeTypes().map(type => (
                  <option key={type} value={type}>{getCodeTypeLabel(type)}</option>
                ))}
              </select>
            </div>

            {/* Kod Arama ve Seçimi */}
            {selectedCodeType && (
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Kod Ara:</label>
                  <input
                    type="text"
                    placeholder="Kod veya açıklama ara..."
                    value={codeSearchTerm}
                    onChange={(e) => setCodeSearchTerm(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                  />
                </div>

                {/* Kod Listesi */}
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                  {getFilteredCodes().map(code => (
                    <div
                      key={`${code.ALAN}-${code.KOD}`}
                      onClick={() => {
                        setSelectedCode(code.KOD);
                        onToggleFilter(selectedCodeType, code.KOD);
                      }}
                      className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        isCodeSelected(selectedCodeType, code.KOD) ? 'bg-blue-100 border-blue-200' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{code.KOD}</div>
                      <div className="text-xs text-gray-600">{code.AÇIKLAMA}</div>
                    </div>
                  ))}
                  
                  {getFilteredCodes().length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {codeSearchTerm ? 'Arama kriterine uygun kod bulunamadı' : 'Bu kod tipinde kod bulunamadı'}
                    </div>
                  )}
                </div>

                {/* Seçili Kod Bilgisi */}
                {selectedCode && (
                  <div className="p-3 bg-blue-100 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-blue-800">
                          Seçili: {selectedCode}
                        </div>
                        <div className="text-xs text-blue-600">
                          {filterCodes.find(c => c.KOD === selectedCode)?.AÇIKLAMA}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearCodeFilters();
                        }}
                        className="px-3 py-1 text-xs bg-blue-200 text-blue-800 rounded hover:bg-blue-300"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tablo container */}
      <div className="overflow-x-auto w-full" style={{ maxWidth: '100vw' }}>
        <table className="w-full table-auto divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {allColumns.map(column => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none relative group"
                  style={{ 
                    width: `${100 / allColumns.length}%`,
                    minWidth: column === 'Malzeme Adı' ? '250px' : '100px'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {column}
                    <span className="text-gray-400">{getSortIcon(column)}</span>
                  </div>
                  <div
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleMouseDown(e, column)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {allColumns.map(column => (
                  <td 
                    key={column} 
                    className="px-6 py-4 whitespace-nowrap text-sm"
                    style={{ 
                      width: `${100 / allColumns.length}%`,
                      minWidth: column === 'Malzeme Adı' ? '250px' : '100px'
                    }}
                  >
                    {numericColumns.includes(column) ? (
                      <span className="font-medium text-right block">
                        {formatNumber(safeParseFloat(row[column]))}
                      </span>
                    ) : (
                      <div className="truncate" title={row[column]}>
                        {row[column]}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Toplam <span className="font-medium">{filteredData.length}</span> kayıt
            {itemsPerPage < filteredData.length && (
              <span> (Sayfa <span className="font-medium">{currentPage}</span> / {totalPages})</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageClick(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⏮️
            </button>
            <button
              onClick={() => handlePageClick(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ◀️
            </button>
            
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => handlePageClick(page)}
                disabled={page === '...'}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  page === currentPage
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                } ${page === '...' ? 'cursor-default' : ''}`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageClick(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ▶️
            </button>
            <button
              onClick={() => handlePageClick(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ⏭️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 