'use client';

import { useState } from 'react';

interface CiroTableProps {
  data: any[];
}

type SortDirection = 'asc' | 'desc' | null;

export default function EnposCiroTable({ data }: CiroTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Sube_No');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sayısal sütunlar
  const numericColumns = data.length > 0 ? Object.keys(data[0]).filter(key => 
    key === 'NAKİT SATIŞ' || key === 'KREDİ KARTI İLE SATIŞ' || key === 'YEMEK KARTI' || 
    key === 'NAKİT İADE' || key === 'KREDİ KARTI İADE' || key === 'TOPLAM' || key === 'Sube_No'
  ) : ['NAKİT SATIŞ', 'KREDİ KARTI İLE SATIŞ', 'YEMEK KARTI', 'NAKİT İADE', 'KREDİ KARTI İADE', 'TOPLAM'];

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
    if (numericColumns.includes(sortColumn)) {
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
        <svg className="w-4 h-4 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
  };

  // Para formatı
  const formatCurrency = (value: number) => {
    const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  // Sütun genişliği ayarlama fonksiyonları
  const getColumnWidth = (column: string): number => {
    return columnWidths[column] || 150;
  };

  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setIsResizing(true);
    setResizingColumn(column);
    
    const startX = e.clientX;
    const startWidth = getColumnWidth(column);
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [column]: newWidth
      }));
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

  // Sayfa değiştirme fonksiyonları
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Sayfa numaraları
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Gösterilecek veri bulunmuyor.</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="w-full">
      {/* Kontrol Paneli */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Arama ve Filtreleme */}
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Arama... (örn: 'şube*', '*ltd', 'a*z')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Filtreler
            </button>
          </div>

          {/* Sayfa Ayarları */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Sayfa başına:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Gelişmiş Filtreler */}
        {showFilters && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtre Sütunu
                </label>
                <select
                  value={filterColumn}
                  onChange={(e) => setFilterColumn(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Sütun seçin</option>
                  {numericColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Değer
                </label>
                <input
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  placeholder="Min"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Değer
                </label>
                <input
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  placeholder="Max"
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Temizle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-red-900 to-red-800 text-white">
              {columns.map((column) => (
                <th
                  key={column}
                  className="relative px-6 py-4 text-left text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-red-800 transition-colors duration-200 select-none border-b border-red-800"
                  style={{ width: `${getColumnWidth(column)}px`, minWidth: `${getColumnWidth(column)}px` }}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{column}</span>
                    {getSortIcon(column)}
                  </div>
                  
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-red-600 group opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleMouseDown(e, column)}
                  >
                    <div className="w-full h-full group-hover:bg-red-600"></div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    style={{ width: `${getColumnWidth(column)}px`, minWidth: `${getColumnWidth(column)}px` }}
                  >
                    <div className="truncate">
                      {column === 'Sube_No' 
                        ? Math.round(safeParseFloat(row[column]))
                        : column === 'NAME'
                        ? (() => {
                            const fullName = String(row[column] || '');
                            const dashIndex = fullName.indexOf('-');
                            return dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName;
                          })()
                        : numericColumns.includes(column) 
                        ? (() => {
                            const value = safeParseFloat(row[column]);
                            const isIade = column.includes('İADE');
                            const colorClass = isIade ? 'text-red-600' : 'text-green-600';
                            return <span className={colorClass}>{formatCurrency(value)}</span>;
                          })()
                        : String(row[column] || '')
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Toplam {filteredData.length} kayıttan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} arası gösteriliyor
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              İlk
            </button>
            
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            
            <div className="flex space-x-1">
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 border rounded text-sm ${
                    currentPage === page
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sonraki
            </button>
            
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Son
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 