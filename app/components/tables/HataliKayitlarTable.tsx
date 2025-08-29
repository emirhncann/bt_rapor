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

interface HataliKayitlarTableProps {
  data: any[];
  currentUser?: { name: string | null; email?: string; id: number | string } | null;
}

type SortDirection = 'asc' | 'desc' | null;

export default function HataliKayitlarTable({ data, currentUser }: HataliKayitlarTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Tarih');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Tablo kolonları
  const columns = [
    { key: 'Tarih', label: 'Tarih', sortable: true },
    { key: 'Şube No', label: 'Şube No', sortable: true },
    { key: 'Fiş Tipi', label: 'Fiş Tipi', sortable: true },
    { key: 'Şube', label: 'Şube', sortable: true },
    { key: 'Yemek Kartı', label: 'Yemek Kartı', sortable: true },
    { key: 'Tutar', label: 'Tutar (₺)', sortable: true, isNumeric: true },
    { key: 'Hata Türü', label: 'Hata Türü', sortable: false }
  ];

  // Hata türünü belirle
  const getHataTuru = (fisType: string, odemeYontemi: string): string => {
    if (odemeYontemi === 'Nakit' && fisType !== 'NAKIT') {
      return 'Nakit Ödeme - Yanlış Ödeme Tipi';
    }
    if (fisType === 'NAKIT' && odemeYontemi !== 'Nakit') {
      return 'Nakit Fiş - Yanlış Ödeme';
    }
    return 'Kart Türü Uyumsuzluğu';
  };

  // Veriyi hata türü ile zenginleştir
  const enrichedData = data.map(item => ({
    ...item,
    'Hata Türü': getHataTuru(item['Fiş Tipi'], item['Yemek Kartı'])
  }));

  // Arama ve filtreleme
  const filteredData = enrichedData.filter(item => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (item['Şube']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Yemek Kartı']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Fiş Tipi']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Hata Türü']?.toString().toLowerCase().includes(searchLower))
    );
  });

  // Sıralama
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    // Sayısal sütunlar için özel işlem
    if (sortColumn === 'Tutar') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
    }

    // Tarih sütunu için özel işlem
    if (sortColumn === 'Tarih') {
      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        
        if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.');
          return new Date(`${year}-${month}-${day}`).getTime();
        }
        
        return new Date(dateStr).getTime() || 0;
      };
      
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
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Sıralama fonksiyonu
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // PDF Export
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(18);
    doc.text('Hatalı Kayıtlar Raporu', 14, 22);
    
    // Alt başlık
    doc.setFontSize(12);
    doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 32);
    if (currentUser?.name) {
      doc.text(`Raporu Hazırlayan: ${currentUser.name}`, 14, 40);
    }
    
    // İstatistikler
    doc.setFontSize(10);
    doc.text(`Toplam Hatalı Kayıt: ${data.length}`, 14, 50);
    const toplamTutar = data.reduce((sum, item) => sum + (parseFloat(item.Tutar) || 0), 0);
    doc.text(`Toplam Hatalı Tutar: ${toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`, 14, 56);
    
    // Tablo
    const tableData = sortedData.map(item => [
      item.Tarih?.toString().replace('T00:00:00', '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') || '',
      item['Şube No'] || '',
      item['Fiş Tipi'] || '',
      item['Şube'] || '',
      item['Yemek Kartı'] || '',
      `${parseFloat(item.Tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
      item['Hata Türü'] || ''
    ]);

    doc.autoTable({
      head: [['Tarih', 'Şube No', 'Fiş Tipi', 'Şube', 'Yemek Kartı', 'Tutar', 'Hata Türü']],
      body: tableData,
      startY: 65,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [220, 53, 69],
        textColor: 255
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      }
    });

    doc.save('hatali-kayitlar-raporu.pdf');
  };

  // Excel Export
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hatalı Kayıtlar');
    
    // Sütun genişliklerini ayarla
    const columnWidths = [
      { wch: 12 }, // Tarih
      { wch: 8 },  // Şube No
      { wch: 12 }, // Fiş Tipi
      { wch: 15 }, // Şube
      { wch: 15 }, // Yemek Kartı
      { wch: 12 }, // Tutar
      { wch: 25 }  // Hata Türü
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.writeFile(workbook, 'hatali-kayitlar-raporu.xlsx');
  };

  // Yazdır
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hatalı Kayıtlar Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .stats { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #dc3545; color: white; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .error-type { color: #dc3545; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Hatalı Kayıtlar Raporu</h1>
            <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
            ${currentUser?.name ? `<p>Raporu Hazırlayan: ${currentUser.name}</p>` : ''}
          </div>
          
          <div class="stats">
            <p><strong>Toplam Hatalı Kayıt:</strong> ${data.length}</p>
            <p><strong>Toplam Hatalı Tutar:</strong> ${data.reduce((sum, item) => sum + (parseFloat(item.Tutar) || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Şube No</th>
                <th>Fiş Tipi</th>
                <th>Şube</th>
                <th>Yemek Kartı</th>
                <th>Tutar</th>
                <th>Hata Türü</th>
              </tr>
            </thead>
            <tbody>
              ${sortedData.map(item => `
                <tr>
                  <td>${item.Tarih?.toString().replace('T00:00:00', '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') || ''}</td>
                  <td>${item['Şube No'] || ''}</td>
                  <td>${item['Fiş Tipi'] || ''}</td>
                  <td>${item['Şube'] || ''}</td>
                  <td>${item['Yemek Kartı'] || ''}</td>
                  <td>${parseFloat(item.Tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                  <td class="error-type">${item['Hata Türü'] || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Hatalı Kayıt Bulunamadı!</h3>
        <p className="text-gray-600">Seçilen tarih aralığında uyumsuz kayıt bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Hatalı Kayıtlar</h2>
              <p className="text-red-100 text-sm">
                {data.length} hatalı kayıt bulundu • 
                Toplam: {data.reduce((sum, item) => sum + (parseFloat(item.Tutar) || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              📊 Excel
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              🖨️ Yazdır/PDF
            </button>
          </div>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Hatalı kayıtlarda ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value={10}>10 kayıt</option>
              <option value={25}>25 kayıt</option>
              <option value={50}>50 kayıt</option>
              <option value={100}>100 kayıt</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => column.sortable && handleSort(column.key)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${
                    column.sortable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-red-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item, index) => (
              <tr key={index} className="hover:bg-red-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.Tarih?.toString().replace('T00:00:00', '').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') || ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item['Şube No']}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {item['Fiş Tipi']}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item['Şube']}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {item['Yemek Kartı']}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {parseFloat(item.Tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {item['Hata Türü']}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Önceki
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sonraki
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium">{startIndex + 1}</span> - <span className="font-medium">{Math.min(endIndex, sortedData.length)}</span> arası, toplam <span className="font-medium">{sortedData.length}</span> kayıt
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? 'z-10 bg-red-50 border-red-500 text-red-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
