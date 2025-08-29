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

interface YemekKartiSatisTableProps {
  data: any[];
  stats?: {
    totalAmount: number;
    totalTransactions: number;
    cardTypes: { name: string; count: number; amount: number }[];
    branches: { name: string; count: number; amount: number }[];
  };
  currentUser?: { name: string | null; email?: string; id: number | string } | null;
}

type SortDirection = 'asc' | 'desc' | null;

export default function YemekKartiSatisTable({ data, stats, currentUser }: YemekKartiSatisTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>('Tarih');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Tablo kolonları
  const columns = [
    { key: 'Tarih', label: 'Tarih', sortable: true },
    { key: 'Şube No', label: 'Şube No', sortable: true },
    { key: 'Belge Alt Tipi', label: 'Belge Alt Tipi', sortable: true },
    { key: 'Fiş Tipi', label: 'Fiş Tipi', sortable: true },
    { key: 'Şube', label: 'Şube', sortable: true },
    { key: 'Tus_No', label: 'Tuş No', sortable: true },
    { key: 'Yemek Kartı', label: 'Yemek Kartı', sortable: true },
    { key: 'Tutar', label: 'Tutar (₺)', sortable: true, isNumeric: true }
  ];

  // Arama ve filtreleme
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (item['Şube']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Yemek Kartı']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Şube No']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Tus_No']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Belge Alt Tipi']?.toString().toLowerCase().includes(searchLower)) ||
      (item['Fiş Tipi']?.toString().toLowerCase().includes(searchLower))
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
      // DD.MM.YYYY formatından YYYY-MM-DD formatına çevir
      const parseDate = (dateStr: string) => {
        if (!dateStr) return 0;
        
        // DD.MM.YYYY formatında mı?
        if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.');
          return new Date(`${year}-${month}-${day}`).getTime();
        }
        
        // Diğer formatlar için standart parse
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
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  // Sayfa değişimi
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortColumn, sortDirection]);

  // Sıralama işlevi
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Excel export
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Yemek Kartı Satışları');
    XLSX.writeFile(workbook, `yemek_karti_satislari_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Yazdırma fonksiyonu
  const handlePrint = () => {
    try {
      // Yazdırma için HTML oluştur
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle yazdırma penceresi açılamıyor.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Yemek Kartları Satış Raporu</title>
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
            .number { text-align: right; }
            .currency { font-weight: bold; }
            @media print {
              body { margin: 0; font-size: 10px; }
              .no-print { display: none; }
              table { font-size: 9px; }
              th, td { padding: 4px; }
              .header { margin-bottom: 10px; }
              .header-top { gap: 10px; }
              .logo { width: 45px; }
              .header h1 { font-size: 16px; margin: 0 0 3px 0; }
              .header p { font-size: 9px; margin: 1px 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>🍽️ Yemek Kartları Satış Raporu</h1>
                <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
                <p>Toplam Kayıt: ${sortedData.length}</p>
                ${searchTerm ? `<p>Arama Filtresi: "${searchTerm}"</p>` : ''}
                ${sortColumn ? `<p>Sıralama: ${columns.find(col => col.key === sortColumn)?.label || sortColumn} (${sortDirection === 'asc' ? 'Artan' : 'Azalan'})</p>` : ''}
              </div>
            </div>
          </div>
          
          ${stats ? `
          <!-- İstatistik Kartları -->
          <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
            <h3 style="margin: 0 0 15px 0; color: #dc2626; font-size: 16px; font-weight: bold;">📊 Genel İstatistikler</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
              <div style="background: #dbeafe; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 11px; color: #1e40af; font-weight: bold;">Toplam İşlem</div>
                <div style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${stats.totalTransactions}</div>
              </div>
              <div style="background: #dcfce7; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 11px; color: #166534; font-weight: bold;">Toplam Tutar</div>
                <div style="font-size: 18px; font-weight: bold; color: #14532d;">${stats.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
              </div>
              <div style="background: #f3e8ff; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 11px; color: #7c3aed; font-weight: bold;">Kart Türü</div>
                <div style="font-size: 18px; font-weight: bold; color: #5b21b6;">${stats.cardTypes.length}</div>
              </div>
              <div style="background: #fef3c7; padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 11px; color: #d97706; font-weight: bold;">Aktif Şube</div>
                <div style="font-size: 18px; font-weight: bold; color: #92400e;">${stats.branches.length}</div>
              </div>
            </div>
            
            ${stats.cardTypes.length > 0 ? `
            <h4 style="margin: 15px 0 10px 0; color: #dc2626; font-size: 14px; font-weight: bold;">🍽️ Yemek Kartı Türleri</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px;">
              ${stats.cardTypes.map((cardType, index) => `
                <div style="background: white; padding: 8px; border-radius: 6px; border-left: 4px solid #dc2626;">
                  <div style="font-size: 11px; font-weight: bold; color: #374151;">${cardType.name}</div>
                  <div style="font-size: 14px; font-weight: bold; color: #dc2626;">${cardType.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                  <div style="font-size: 9px; color: #6b7280;">${cardType.count} işlem | ${((cardType.amount / stats.totalAmount) * 100).toFixed(1)}%</div>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            ${stats.branches.length > 0 ? `
            <h4 style="margin: 15px 0 10px 0; color: #dc2626; font-size: 14px; font-weight: bold;">🏢 Şube Performansı</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              ${stats.branches.map((branch, index) => `
                <div style="background: white; padding: 8px; border-radius: 6px; border-left: 4px solid #059669;">
                  <div style="font-size: 11px; font-weight: bold; color: #374151;">${branch.name}</div>
                  <div style="font-size: 14px; font-weight: bold; color: #059669;">${branch.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                  <div style="font-size: 9px; color: #6b7280;">${branch.count} işlem | ${((branch.amount / stats.totalAmount) * 100).toFixed(1)}%</div>
                </div>
              `).join('')}
            </div>
            ` : ''}
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
                    const value = row[col.key];
                    let displayValue = value?.toString() || '';
                    
                    // Tarih formatını düzelt
                    if (col.key === 'Tarih' && value) {
                      // Eğer tarih string ise ve DD.MM.YYYY formatındaysa, aynı kalacak
                      if (typeof value === 'string' && value.includes('.')) {
                        // Saat bilgisi varsa kaldır (örn: "28.08.2025 14:30:25" -> "28.08.2025")
                        displayValue = value.split(' ')[0];
                      }
                      // Eğer ISO format tarih ise (2025-08-27T00:00:00) DD/MM/YYYY formatına çevir
                      else if (typeof value === 'string' && value.includes('T')) {
                        const date = new Date(value);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        displayValue = `${day}/${month}/${year}`;
                      }
                      // Eğer Date objesi ise DD/MM/YYYY formatına çevir
                      else if (value instanceof Date) {
                        const day = String(value.getDate()).padStart(2, '0');
                        const month = String(value.getMonth() + 1).padStart(2, '0');
                        const year = value.getFullYear();
                        displayValue = `${day}/${month}/${year}`;
                      }
                    }
                    else if (col.isNumeric && typeof value === 'number') {
                      displayValue = value.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
                    }
                    
                    const cellClass = col.isNumeric ? 'number' : '';
                    return `<td class="${cellClass}">${displayValue}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 10px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde ${currentUser?.name || 'Bilinmeyen Kullanıcı'} tarafından BT Rapor sistemi üzerinden alınmıştır. 
            Tüm tutarlar Türk Lirası (₺) cinsindendir.
          </div>
          
          <script>
            // Sayfa yüklendiğinde otomatik yazdırma diyaloğunu aç
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            
            // Yazdırma tamamlandığında veya iptal edildiğinde pencereyi kapat
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
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Başlık ve logo alanı
    doc.setFillColor(220, 53, 69); // Kırmızı arkaplan
    doc.rect(0, 0, 297, 25, 'F'); // Üst kısım için kırmızı arkaplan
    
    // Başlık
    doc.setTextColor(255, 255, 255); // Beyaz metin
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('🍽️ Yemek Kartları Satış Raporu', 14, 15);
    
    // Alt başlık
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Toplam Kayıt: ${sortedData.length}`, 14, 22);
    
    // Metin rengini siyaha çevir
    doc.setTextColor(0, 0, 0);
    
    // Filtre bilgileri
    if (searchTerm) {
      doc.setFontSize(8);
      doc.text(`Arama Filtresi: "${searchTerm}"`, 14, 32);
    }
    
    // Sıralama bilgisi
    if (sortColumn) {
      const sortText = `Sıralama: ${columns.find(col => col.key === sortColumn)?.label || sortColumn} (${sortDirection === 'asc' ? 'Artan' : 'Azalan'})`;
      doc.text(sortText, 14, 36);
    }

    // Tablo verilerini hazırla
    const tableColumns = columns.map(col => col.label);
    const tableRows = sortedData.map(item => 
      columns.map(col => {
        const value = item[col.key];
        
        // Tarih formatını düzelt
        if (col.key === 'Tarih' && value) {
          // Eğer tarih string ise ve DD.MM.YYYY formatındaysa, aynı kalacak
          if (typeof value === 'string' && value.includes('.')) {
            // Saat bilgisi varsa kaldır (örn: "28.08.2025 14:30:25" -> "28.08.2025")
            return value.split(' ')[0];
          }
          // Eğer ISO format tarih ise (2025-08-27T00:00:00) DD/MM/YYYY formatına çevir
          if (typeof value === 'string' && value.includes('T')) {
            const date = new Date(value);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          }
          // Eğer Date objesi ise DD/MM/YYYY formatına çevir
          if (value instanceof Date) {
            const day = String(value.getDate()).padStart(2, '0');
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const year = value.getFullYear();
            return `${day}/${month}/${year}`;
          }
        }
        
        if (col.isNumeric && typeof value === 'number') {
          return value.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        }
        return value?.toString() || '';
      })
    );

    // Tablo oluştur
    doc.autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: searchTerm || sortColumn ? 42 : 32,
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
                columnStyles: {
            0: { cellWidth: 22 }, // Tarih
            1: { cellWidth: 15 }, // Şube No
            2: { cellWidth: 20 }, // Belge Alt Tipi
            3: { cellWidth: 25 }, // Fiş Tipi
            4: { cellWidth: 25 }, // Şube
            5: { cellWidth: 15 }, // Tuş No
            6: { cellWidth: 30 }, // Yemek Kartı
            7: { cellWidth: 20, halign: 'right' } // Tutar - sağa hizalı
          },
      margin: { top: 5, right: 14, bottom: 14, left: 14 }
    });

    // Alt bilgi
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('btRapor - Yemek Kartları Satış Raporu', 14, finalY);
    doc.text(`Sayfa 1`, 280, finalY);

    doc.save(`yemek_karti_satislari_${new Date().toISOString().split('T')[0]}.pdf`);
  };



  return (
    <div className="space-y-6">
      {/* Kontroller */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Arama */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Şube, yemek kartı adı veya tuş no ile ara..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Kontroller */}
          <div className="flex items-center gap-3">
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
            
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Yazdır
            </button>
          </div>
        </div>


      </div>

      {/* Tablo */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
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
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.Tarih ? new Date(item.Tarih).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item['Şube No']}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item['Belge Alt Tipi'] || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item['Fiş Tipi'] || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item['Şube']}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.Tus_No}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item['Yemek Kartı']}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {typeof item.Tutar === 'number' 
                      ? item.Tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                      : parseFloat(item.Tutar || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                    } ₺
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
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
                    const maxVisiblePages = 7; // Maksimum görünecek sayfa sayısı
                    
                    if (totalPages <= maxVisiblePages) {
                      // Tüm sayfaları göster
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      // Akıllı pagination
                      const currentPageNum = currentPage;
                      const halfVisible = Math.floor(maxVisiblePages / 2);
                      
                      // İlk sayfaları göster
                      if (currentPageNum <= halfVisible + 1) {
                        for (let i = 1; i <= maxVisiblePages - 1; i++) {
                          pages.push(i);
                        }
                        pages.push('...');
                        pages.push(totalPages);
                      }
                      // Son sayfaları göster
                      else if (currentPageNum >= totalPages - halfVisible) {
                        pages.push(1);
                        pages.push('...');
                        for (let i = totalPages - maxVisiblePages + 2; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      }
                      // Orta sayfaları göster
                      else {
                        pages.push(1);
                        pages.push('...');
                        for (let i = currentPageNum - halfVisible; i <= currentPageNum + halfVisible; i++) {
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
            {searchTerm ? 'Arama kriterlerinize uygun kayıt bulunamadı.' : 'Henüz yemek kartı satış kaydı bulunmuyor.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 text-sm text-red-600 hover:text-red-800"
            >
              Aramayı temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
