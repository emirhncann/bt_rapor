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

  // Toplam stok kolon adı
  const totalColumn = 'Toplam Stok';
  
  // Filtreleme kodları için state'ler
  const [selectedCodeType, setSelectedCodeType] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [codeSearchTerm, setCodeSearchTerm] = useState<string>('');
  const [showCodeSelector, setShowCodeSelector] = useState(true);

  // Sabit kolonlar
  const fixedColumns = ['Malzeme Ref', 'Malzeme Kodu', 'Malzeme Adı', 'Grup Kodu', 'Grup Kodu Açıklaması', 'Özel Kod Açıklaması', 'Özel Kod2 Açıklaması', 'Özel Kod3 Açıklaması', 'Özel Kod4 Açıklaması', 'Özel Kod5 Açıklaması'];
  // Tüm kolonlar (sabit + dinamik)
  const allColumns = [...fixedColumns, ...dynamicColumns, totalColumn];

  // Sayısal sütunlar (dinamik kolonlar)
  const numericColumns = [...dynamicColumns, totalColumn];

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    // Türkçe formatlı sayıları dönüştür: 1.234,56 -> 1234.56
    const cleaned = String(value)
      .replace(/\./g, '')   // binlik ayırıcıları sil
      .replace(/,/g, '.');   // virgülü ondalık noktasına çevir
    const parsed = parseFloat(cleaned);
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
    'Özel Kod Açıklaması': 200,
    'Özel Kod2 Açıklaması': 200,
    'Özel Kod3 Açıklaması': 200,
    'Özel Kod4 Açıklaması': 200,
    'Özel Kod5 Açıklaması': 200,
    [totalColumn]: 150,
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

  // Kod tiplerine karşılık gelen tablo alanları (global kullanım için)
  const codeFieldMap: {[key: string]: string} = {
    'STRGRPCODE': 'Grup Kodu',
    'SPECODE': 'Özel Kod',
    'SPECODE2': 'Özel Kod2',
    'SPECODE3': 'Özel Kod3',
    'SPECODE4': 'Özel Kod4',
    'SPECODE5': 'Özel Kod5'
  };

  // Veri üzerinde toplam stok sütunu ekle
  const dataWithTotal = data.map(item => ({
    ...item,
    [totalColumn]: dynamicColumns.reduce((sum, col) => sum + safeParseFloat(item[col]), 0)
  }));

  // Filtrelenmiş ve sıralanmış veri
  const filteredData = dataWithTotal.filter(item => {
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
    
    // Kod filtreleri - her kod tipi için seçilen değerlerin KESİŞİMİ
    const matchesCodes = Object.entries(selectedFilters).every(([type, codes]) => {
      if (!codes || codes.length === 0) return true; // bu tipte seçim yoksa sorun değil
      const codeField = codeFieldMap[type];
      if (!codeField) return true;
      return codes.includes(item[codeField]);
    });
    
    return matchesSearch && matchesNumeric && matchesCodes;
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
      const email = prompt('PDF raporunu göndermek istediğiniz e-posta adresini girin:');
      if (!email) {
        console.log('📄 PDF e-posta gönderimi iptal edildi.');
        return;
      }
      console.log('📄 PDF e-posta gönderilecek adres:', email);

      // API isteğini arka planda yap
      try {
        const companyRef = localStorage.getItem('companyRef') || '';
        const connectionInfoStr = localStorage.getItem('connectionInfo') || '{}';
        const connectionInfo = JSON.parse(connectionInfoStr);
        const firmaNo = connectionInfo.first_firma_no || '009';
        const donemNo = connectionInfo.first_donem_no || '01';

        // Filtreleri hazırla
        const apiFilters = {
          grpcod: selectedFilters['STRGRPCODE'] || [],
          specode: selectedFilters['SPECODE'] || [],
          specode2: selectedFilters['SPECODE2'] || [],
          specode3: selectedFilters['SPECODE3'] || [],
          specode4: selectedFilters['SPECODE4'] || [],
          specode5: selectedFilters['SPECODE5'] || []
        };

        console.log('📤 PDF export API isteği gönderiliyor...', { companyRef, firmaNo, donemNo, email, apiFilters });

        fetch('/api/envanter-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyRef, firmaNo, donemNo, email, filters: apiFilters })
        }).then(async res => {
          if (res.ok) {
            console.log('✅ PDF raporu e-posta ile gönderildi.');
            alert('Rapor arka planda hazırlanıp e-posta ile gönderilecektir.');
          } else {
            const err = await res.json().catch(()=>({}));
            console.error('❌ PDF e-posta hatası:', err);
            alert('E-posta gönderiminde hata oluştu.');
          }
        }).catch(err => {
          console.error('❌ PDF e-posta fetch hatası:', err);
          alert('Sunucuya bağlanılamadı.');
        });
      } catch (err) {
        console.error('❌ PDF e-posta ön hazırlık hatası:', err);
      }
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
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    clearFilters();
    setSelectedCodeType('');
    setSelectedCode('');
    setCodeSearchTerm('');
    setShowCodeSelector(false);
    // Tüm seçili filtreleri temizle
    Object.keys(selectedFilters).forEach(codeType => {
      selectedFilters[codeType].forEach(code => {
        onToggleFilter(codeType, code);
      });
    });
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
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Arama Kutusu */}
            <div className="relative">
              <input
                type="text"
                placeholder="Ürün ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
              />
              <span className="absolute left-3 top-3 text-gray-400">🔍</span>
            </div>

            {/* Tüm Filtreleri Temizle Butonu */}
            {(searchTerm || filterColumn || minValue || maxValue || Object.entries(selectedFilters).some(([, codes]) => codes.length > 0)) && (
              <button
                onClick={clearAllFilters}
                className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 flex items-center gap-2"
              >
                <span>🧹</span>
                Tüm Filtreleri Temizle
              </button>
            )}

            {/* Filtre Butonları */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showFilters 
                    ? 'bg-red-100 text-red-700 border border-red-200' 
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>📊</span>
                {showFilters ? 'Filtreleri Gizle' : 'Sayısal Filtreler'}
              </button>

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

            {!loadingFilterCodes && filterCodes.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2">
                <span>ℹ️</span>
                Filtreleme kodları bulunamadı
              </div>
            )}
          </div>

          {/* Export Butonları */}
          <div className="flex items-center gap-3">
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
            >
              <option value={10}>10 Satır</option>
              <option value={25}>25 Satır</option>
              <option value={50}>50 Satır</option>
              <option value={100}>100 Satır</option>
            </select>

            <button
              onClick={exportToExcel}
              className="px-4 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2 shadow-sm"
            >
              <span>📊</span>
              Excel
            </button>

            <button
              onClick={exportToPDF}
              className="px-4 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2 shadow-sm"
            >
              <span>📄</span>
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Sayısal filtreler */}
      {showFilters && (
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">📈</span>
              <select
                value={filterColumn}
                onChange={(e) => setFilterColumn(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
              >
                <option value="">Sütun Seçin</option>
                {numericColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Min:</span>
              <input
                type="number"
                placeholder="Min Değer"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm w-32"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Max:</span>
              <input
                type="number"
                placeholder="Max Değer"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm w-32"
              />
            </div>

            <button
              onClick={clearFilters}
              className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 flex items-center gap-2"
            >
              <span>🧹</span>
              Filtreleri Temizle
            </button>
          </div>
        </div>
      )}

      {/* Kod Filtreleri */}
      {showCodeSelector && filterCodes.length > 0 && (
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <span>🏷️</span>
                Kod Filtreleri
              </h3>
              <button
                onClick={clearCodeFilters}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                Temizle
              </button>
            </div>

            {/* Kod Tipi Seçimi */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span>📋</span>
                Kod Tipi:
              </label>
              <select
                value={selectedCodeType}
                onChange={(e) => {
                  setSelectedCodeType(e.target.value);
                  setSelectedCode('');
                  setCodeSearchTerm('');
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm min-w-48"
              >
                <option value="">Kod Tipi Seçin</option>
                {getCodeTypes().map(type => (
                  <option key={type} value={type}>{getCodeTypeLabel(type)}</option>
                ))}
              </select>
            </div>

            {/* Kod Arama ve Seçimi */}
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
                <div className="max-h-80 overflow-y-auto border border-gray-300 rounded-lg bg-white shadow-sm">
                  {getFilteredCodes().map(code => (
                    <div
                      key={`${code.ALAN}-${code.KOD}`}
                      onClick={() => {
                        setSelectedCode(code.KOD);
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
                {Object.entries(selectedFilters).some(([,arr])=>arr.length>0) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <span>✅</span>
                      Seçili Kodlar
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedFilters).map(([type,codes])=>
                        codes.map(kod=> {
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
                                onClick={(e)=>{e.stopPropagation(); onToggleFilter(type,kod);}} 
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

      {/* Tablo container */}
      <div className="overflow-x-auto w-full" style={{ maxWidth: '100vw' }}>
        <table className="w-full table-auto divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              {allColumns.map(column => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer select-none relative group hover:bg-gray-200 transition-colors duration-200"
                  style={{ 
                    width: `${100 / allColumns.length}%`,
                    minWidth: column === 'Malzeme Adı' ? '250px' : '100px'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{column}</span>
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
              <tr key={rowIndex} className={`hover:bg-gray-50 transition-colors duration-200 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
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
                      <span className="font-medium text-right block text-gray-900">
                        {formatNumber(safeParseFloat(row[column]))}
                      </span>
                    ) : (
                      <div className="truncate text-gray-700" title={row[column]}>
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
      <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Toplam <span className="font-semibold text-gray-900">{filteredData.length}</span> kayıt
            {itemsPerPage < filteredData.length && (
              <span> (Sayfa <span className="font-semibold text-gray-900">{currentPage}</span> / {totalPages})</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageClick(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              ⏮️
            </button>
            <button
              onClick={() => handlePageClick(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              ◀️
            </button>
            
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => handlePageClick(page)}
                disabled={page === '...'}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  page === currentPage
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                } ${page === '...' ? 'cursor-default' : ''}`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageClick(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              ▶️
            </button>
            <button
              onClick={() => handlePageClick(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              ⏭️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 