'use client';

import { useState, useEffect } from 'react';
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
  isLoading?: boolean;
  selectedGrupKodlari?: string[];
  selectedOzelKod1?: string[];
}

type SortDirection = 'asc' | 'desc' | null;

export default function EnCokSatilanMalzemelerTable({ 
  data,
  isLoading = false,
  selectedGrupKodlari = [],
  selectedOzelKod1 = []
}: EnCokSatilanMalzemelerTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Toplam Miktar');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Checkbox filtre state'leri
  // const [selectedGrupKodlari, setSelectedGrupKodlari] = useState<string[]>([]);
  // const [selectedOzelKod1, setSelectedOzelKod1] = useState<string[]>([]);

  // Tablodaki mevcut kodlardan filtre seçeneklerini türet
  const grupKodlari = Array.from(new Set(data.map(item => item['Grup Kodu']).filter(Boolean))).sort();
  const ozelKod1ler = Array.from(new Set(data.map(item => item['Özel Kod 1']).filter(Boolean))).sort();

  // Checkbox filtreleme fonksiyonları
  // const handleGrupKodChange = (kod: string) => {
  //   setCurrentPage(1);
  //   setSelectedGrupKodlari(prev =>
  //     prev.includes(kod) ? prev.filter(k => k !== kod) : [...prev, kod]
  //   );
  // };
  // const handleOzelKod1Change = (kod: string) => {
  //   setCurrentPage(1);
  //   setSelectedOzelKod1(prev =>
  //     prev.includes(kod) ? prev.filter(k => k !== kod) : [...prev, kod]
  //   );
  // };

  // Tablo kolonları
  const columns = [
    'Malzeme Kodu',
    'Malzeme Adı',
    'Toplam Miktar',
    'Toplam Tutar',
    'Grup Kodu',
    'Grup Açıklama',
    'Özel Kod 1',
    'Özel Kod 2',
    'Özel Kod 3',
    'Özel Kod 4',
    'Özel Kod 5'
  ];

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

  // Arama ve filtreleme
  const filteredData = data.filter(item => {
    if (!searchTerm) {
      // Checkbox filtreleri uygula (artık props ile geliyor)
      if (
        (selectedGrupKodlari.length === 0 || selectedGrupKodlari.includes(item['Grup Kodu'])) &&
        (selectedOzelKod1.length === 0 || selectedOzelKod1.includes(item['Özel Kod 1']))
      ) {
        return true;
      }
      return false;
    }
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      (item['Malzeme Kodu'] || '').toLowerCase().includes(searchLower) ||
      (item['Malzeme Adı'] || '').toLowerCase().includes(searchLower) ||
      (item['Grup Kodu'] || '').toLowerCase().includes(searchLower) ||
      (item['Grup Açıklama'] || '').toLowerCase().includes(searchLower)
    );
    // Checkbox filtreleri uygula
    if (!matchesSearch) return false;
    if (
      (selectedGrupKodlari.length > 0 && !selectedGrupKodlari.includes(item['Grup Kodu'])) ||
      (selectedOzelKod1.length > 0 && !selectedOzelKod1.includes(item['Özel Kod 1']))
    ) {
      return false;
    }
    return true;
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Satış verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Filtreler kaldırıldı, sadece props ile filtreleme yapılacak */}
      {/* Header Controls */}
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Malzeme kodu, adı veya grup kodu ile arama..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort(column)}
                  >
                    <div className="flex items-center gap-1">
                      {column}
                      {getSortIcon(column)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item['Malzeme Kodu'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Malzeme Adı']}>
                    {item['Malzeme Adı'] || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    {formatNumber(item['Toplam Miktar'])}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    ₺{formatNumber(item['Toplam Tutar'], true)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item['Grup Kodu'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Grup Açıklama']}>
                    {item['Grup Açıklama'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Özel Kod 1']}>
                    {item['Özel Kod 1'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Özel Kod 2']}>
                    {item['Özel Kod 2'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Özel Kod 3']}>
                    {item['Özel Kod 3'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Özel Kod 4']}>
                    {item['Özel Kod 4'] || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item['Özel Kod 5']}>
                    {item['Özel Kod 5'] || '-'}
                  </td>
                </tr>
              ))}
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