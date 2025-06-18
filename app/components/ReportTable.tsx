'use client';

import { useState } from 'react';

interface ReportTableProps {
  data: any[];
}

type SortDirection = 'asc' | 'desc' | null;

export default function ReportTable({ data }: ReportTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 25;

  // Sayısal sütunlar
  const numericColumns = data.length > 0 ? Object.keys(data[0]).filter(key => 
    key === 'BORÇ' || key === 'ALACAK' || key === 'BAKİYE' || key === 'BAKIYE' || 
    key.includes('BAKIYE') || key.includes('BAKİYE')
  ) : ['BORÇ', 'ALACAK', 'BAKİYE'];

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Arama fonksiyonu
  const filteredData = data.filter((item) =>
    Object.entries(item).some(([key, value]) => {
      const valueStr = String(value).toLowerCase();
      const searchStr = searchTerm.toLowerCase();
      
      // Özel arama desenleri
      if (searchStr.endsWith('*') && !searchStr.startsWith('*')) {
        // "m*" -> m ile başlayanlar
        return valueStr.startsWith(searchStr.slice(0, -1));
      } else if (searchStr.startsWith('*') && !searchStr.endsWith('*')) {
        // "*m" -> m ile bitenler
        return valueStr.endsWith(searchStr.slice(1));
      } else if (searchStr.includes('*') && searchStr.indexOf('*') > 0 && searchStr.indexOf('*') < searchStr.length - 1) {
        // "a*z" -> a ile başlayıp z ile bitenler
        const parts = searchStr.split('*');
        if (parts.length === 2) {
          return valueStr.startsWith(parts[0]) && valueStr.endsWith(parts[1]);
        }
      }
      
      // Normal arama (içerir)
      return valueStr.includes(searchStr);
    })
  ).filter((item) => {
    // Sayısal aralık filtresi
    if (filterColumn && (minValue || maxValue)) {
      const itemValue = safeParseFloat(item[filterColumn]);
      const min = minValue ? parseFloat(minValue) : -Infinity;
      const max = maxValue ? parseFloat(maxValue) : Infinity;
      return itemValue >= min && itemValue <= max;
    }
    return true;
  });

  // Sıralama fonksiyonu
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    // Sayısal değerler için
    if (sortColumn === 'BORÇ' || sortColumn === 'ALACAK' || sortColumn === 'BAKİYE' || sortColumn === 'BAKIYE' || sortColumn?.includes('BAKIYE') || sortColumn?.includes('BAKİYE')) {
      const aNum = safeParseFloat(aValue);
      const bNum = safeParseFloat(bValue);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // String değerler için
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr, 'tr');
    } else {
      return bStr.localeCompare(aStr, 'tr');
    }
  });

  // Sayfalama
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Sıralama değiştirme fonksiyonu
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtreleri temizle
  const clearFilters = () => {
    setFilterColumn('');
    setMinValue('');
    setMaxValue('');
    setSearchTerm('');
  };

  // Sıralama ikonu
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
  };

  // Para formatı
  const formatCurrency = (value: number) => {
    // Eğer değer geçerli bir sayı değilse 0 olarak formatla
    const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        {/* Başlık ve İstatistikler */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Cari Hesap Listesi</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {filteredData.length} / {data.length} kayıt
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtreler
            </button>
          </div>
        </div>
        
        {/* Arama Kutusu */}
        <div className="mb-4">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Metin Arama
          </label>
          <input
            id="search"
            type="text"
            placeholder="Firma adı, kod vb. arayın..."
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50 shadow-sm transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="mt-1 text-xs text-gray-500">
            İpuçları: &quot;m*&quot; (m ile başlayanlar) • &quot;*m&quot; (m ile bitenler) • &quot;a*z&quot; (a-z arası)
          </div>
        </div>
        
        {/* Gelişmiş Filtreler */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Sayısal Filtreler</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Parametre
                </label>
                <select
                  value={filterColumn}
                  onChange={(e) => setFilterColumn(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                >
                  <option value="">Seçiniz</option>
                  {numericColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Min Değer
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Max Değer
                </label>
                <input
                  type="number"
                  placeholder="999999"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Temizle
                </button>
              </div>
            </div>
            
            {/* Aktif Filtre Göstergesi */}
            {(filterColumn && (minValue || maxValue)) && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                <span className="text-sm text-red-700">
                  <strong>Aktif Filtre:</strong> {filterColumn} 
                  {minValue && ` ≥ ${parseFloat(minValue).toLocaleString('tr-TR')}`}
                  {minValue && maxValue && ' ve '}
                  {maxValue && ` ≤ ${parseFloat(maxValue).toLocaleString('tr-TR')}`}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Genel Arama İpuçları */}
        {searchTerm && (
          <div className="mt-2 text-xs text-gray-500">
            <strong>Arama sonucu:</strong> {filteredData.length} kayıt bulundu
          </div>
        )}
      </div>

      {/* Desktop Tablo Görünümü */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gradient-to-r from-red-900 to-red-800 text-white">
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider border-b border-red-800">
                DETAY
              </th>
              {data.length > 0 &&
                Object.keys(data[0])
                  .filter(header => header !== 'LOGICALREF')
                  .map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider border-b border-red-800 cursor-pointer hover:bg-red-800 transition-colors duration-200"
                      onClick={() => handleSort(header)}
                    >
                      <div className="flex items-center justify-between">
                        <span>{header}</span>
                        {getSortIcon(header)}
                      </div>
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr
                key={index}
                className={`${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } hover:bg-red-50 transition-colors duration-200`}
              >
                <td className="px-6 py-4 text-center border-b border-gray-200">
                  <button
                    onClick={() => {
                      // İleride detay modal açılacak
                      console.log('Detay göster:', row);
                    }}
                    className="text-gray-600 hover:text-red-800 transition-colors"
                    title="Detayları görüntüle"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </td>
                {Object.entries(row)
                  .filter(([key]) => key !== 'LOGICALREF')
                  .map(([key, value], cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-6 py-4 whitespace-nowrap text-sm border-b border-gray-200 ${
                        key === 'BORÇ' || key === 'ALACAK'
                          ? 'text-right font-bold text-red-800'
                          : (key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE'))
                          ? `text-right font-bold ${safeParseFloat(value) < 0 ? 'text-red-600' : 'text-green-600'}`
                          : key === 'KODU'
                          ? 'text-red-700 font-semibold'
                          : key === 'ÜNVANI'
                          ? 'text-gray-700 font-medium'
                          : 'text-gray-800 font-medium'
                      }`}
                    >
                    {(() => {
                      // BAKİYE özel formatı
                      if (key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE')) {
                        const parsedValue = safeParseFloat(value);
                        const formattedCurrency = formatCurrency(Math.abs(parsedValue));
                        
                        if (parsedValue === 0) {
                          return formattedCurrency; // Sadece para formatı, (A) veya (B) yok
                        }
                        
                        const indicator = parsedValue < 0 ? '(A)' : '(B)';
                        return `${formattedCurrency} ${indicator}`;
                      }
                      
                      // Diğer para formatları
                      if (key === 'BORÇ' || key === 'ALACAK') {
                        const parsedValue = safeParseFloat(value);
                        return formatCurrency(parsedValue);
                      }
                      
                      return String(value);
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil Card Görünümü */}
      <div className="md:hidden space-y-4 bg-gray-50 rounded-lg p-4">
        {paginatedData.map((row, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-700 mb-1">
                  {String(Object.entries(row).find(([key]) => key === 'KODU')?.[1] || '')}
                </h3>
                <p className="text-gray-700 text-sm">
                  {String(Object.entries(row).find(([key]) => key === 'ÜNVANI')?.[1] || '')}
                </p>
              </div>
              <button
                onClick={() => {
                  // İleride detay modal açılacak
                  console.log('Detay göster:', row);
                }}
                className="text-gray-600 hover:text-red-800 transition-colors p-2"
                title="Detayları görüntüle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">BORÇ</p>
                <p className="text-red-800 font-bold">
                  {(() => {
                    const borcValue = Object.entries(row).find(([key]) => key === 'BORÇ')?.[1];
                    return formatCurrency(safeParseFloat(borcValue));
                  })()}
                </p>
              </div>
              
              <div className="bg-green-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">ALACAK</p>
                <p className="text-red-800 font-bold">
                  {(() => {
                    const alacakValue = Object.entries(row).find(([key]) => key === 'ALACAK')?.[1];
                    return formatCurrency(safeParseFloat(alacakValue));
                  })()}
                </p>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">BAKİYE:</span>
                <span className={`font-bold text-lg ${
                  (() => {
                    const bakiyeEntry = Object.entries(row).find(([key]) => 
                      key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE')
                    );
                    const bakiyeValue = safeParseFloat(bakiyeEntry?.[1]);
                    return bakiyeValue < 0 ? 'text-red-600' : bakiyeValue > 0 ? 'text-green-600' : 'text-gray-900';
                  })()
                }`}>
                  {(() => {
                    const bakiyeEntry = Object.entries(row).find(([key]) => 
                      key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE')
                    );
                    const bakiyeValue = safeParseFloat(bakiyeEntry?.[1]);
                    const formattedCurrency = formatCurrency(Math.abs(bakiyeValue));
                    
                    if (bakiyeValue === 0) {
                      return formattedCurrency;
                    }
                    
                    const indicator = bakiyeValue < 0 ? '(A)' : '(B)';
                    return `${formattedCurrency} ${indicator}`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t border-gray-200">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-5 py-2 text-sm font-medium text-white bg-red-800 rounded-lg hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Önceki
        </button>
        <span className="text-sm font-medium text-gray-700">
          Sayfa {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-5 py-2 text-sm font-medium text-white bg-red-800 rounded-lg hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
} 