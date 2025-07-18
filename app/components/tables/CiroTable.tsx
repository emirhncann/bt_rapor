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

interface CiroTableProps {
  data: any[];
  startDate?: string;
  endDate?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export default function EnposCiroTable({ data, startDate, endDate }: CiroTableProps) {
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

  // Export fonksiyonları
  const exportToExcel = () => {
    try {
      // Filtered data'yı kullan
      const exportData = filteredData.map(row => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
          if (key === 'Sube_No') {
            newRow[key] = Math.round(safeParseFloat(row[key]));
          } else if (key === 'NAME') {
            const fullName = String(row[key] || '');
            const dashIndex = fullName.indexOf('-');
            newRow[key] = dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName;
          } else if (numericColumns.includes(key) && key !== 'Sube_No') {
            // Para formatında TL işaretiyle
            const value = safeParseFloat(row[key]);
            newRow[key] = value.toLocaleString('tr-TR', { 
              style: 'currency', 
              currency: 'TRY',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          } else {
            newRow[key] = row[key];
          }
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Enpos Ciro');

      // Sütun genişliklerini ayarla
      const columnWidths = Object.keys(exportData[0] || {}).map(key => {
        if (key === 'NAME') return { wch: 30 };
        if (key === 'Sube_No') return { wch: 10 };
        if (numericColumns.includes(key)) return { wch: 18 };
        return { wch: 15 };
      });
      worksheet['!cols'] = columnWidths;

      // Dosyayı indir
      const fileName = `Enpos_Ciro_${new Date().toLocaleDateString('tr-TR').replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  const exportToPDF = () => {
    try {
      // Toplam hesaplamalar
      const totals = filteredData.reduce((acc, item) => ({
        nakitSatis: acc.nakitSatis + safeParseFloat(item['NAKİT SATIŞ']),
        krediKartiSatis: acc.krediKartiSatis + safeParseFloat(item['KREDİ KARTI İLE SATIŞ']),
        yemekKarti: acc.yemekKarti + safeParseFloat(item['YEMEK KARTI']),
        nakitIade: acc.nakitIade + safeParseFloat(item['NAKİT İADE']),
        krediKartiIade: acc.krediKartiIade + safeParseFloat(item['KREDİ KARTI İADE']),
        toplam: acc.toplam + safeParseFloat(item['TOPLAM'])
      }), {
        nakitSatis: 0,
        krediKartiSatis: 0,
        yemekKarti: 0,
        nakitIade: 0,
        krediKartiIade: 0,
        toplam: 0
      });

      // Yazdırma için HTML oluştur (PDF'e optimize edilmiş)
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle PDF yazdırma penceresi açılamıyor.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Enpos Ciro Raporu - PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 30px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: #991b1b; margin: 0 0 8px 0; font-size: 22px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-align: left; }
            .header .date-range { background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 6px; margin-top: 10px; border-left: 3px solid #fbbf24; }
            .pdf-info { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin-bottom: 25px; border-radius: 4px; }
            .pdf-info strong { color: #92400e; }
            
            /* İstatistik Kutuları */
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-box.primary { border-color: #991b1b; background-color: #fef2f2; }
            .stat-box.success { border-color: #059669; background-color: #ecfdf5; }
            .stat-box.info { border-color: #0284c7; background-color: #f0f9ff; }
            .stat-box.warning { border-color: #d97706; background-color: #fffbeb; }
            .stat-box.danger { border-color: #dc2626; background-color: #fef2f2; }
            .stat-box.purple { border-color: #7c3aed; background-color: #f5f3ff; }
            .stat-box.indigo { border-color: #4338ca; background-color: #eef2ff; }
            .stat-title { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 14px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 8px; color: #9ca3af; margin-top: 2px; }
            
            /* Detay Kutuları */
            .detail-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .detail-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; background-color: #ffffff; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .positive { color: #1f2937; }
            .negative { color: #dc2626; }
            
            @media print {
              body { margin: 0; font-size: 10px; }
              .pdf-info { display: none; }
              .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
              .detail-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px; }
              .stat-box, .detail-box { padding: 8px; }
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
                <h1>ENPOS CİRO RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                <p><strong>Toplam Şube:</strong> ${filteredData.length} adet</p>
                <p><strong>Rapor Türü:</strong> Şube Bazlı Enpos Ciro Raporu</p>
              </div>
            </div>
            ${startDate && endDate ? `<div class="date-range"><strong>📅 Seçilen Tarih Aralığı:</strong> ${startDate} - ${endDate}</div>` : ''}
          </div>
          
          <div class="pdf-info">
            <strong>📄 PDF Olarak Kaydetmek İçin:</strong><br>
            Yazdırma diyaloğunda "Hedef" kısmından <strong>"PDF olarak kaydet"</strong> seçeneğini seçin.
          </div>
          
          <!-- Ana İstatistikler -->
          <div class="stats-grid">
            <div class="stat-box primary">
              <div class="stat-title">Toplam Şube</div>
              <div class="stat-value">${filteredData.length}</div>
              <div class="stat-subtitle">Aktif şube sayısı</div>
            </div>
            
            <div class="stat-box success">
              <div class="stat-title">Nakit Satış</div>
              <div class="stat-value">${totals.nakitSatis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">Nakit ödeme geliri</div>
            </div>
            
            <div class="stat-box info">
              <div class="stat-title">Kredi Kartı Satış</div>
              <div class="stat-value">${totals.krediKartiSatis.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">Kart ödeme geliri</div>
            </div>
            
            <div class="stat-box purple">
              <div class="stat-title">Net Ciro</div>
              <div class="stat-value">${totals.toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">Toplam net gelir</div>
            </div>
          </div>
          
          <!-- Detaylı İstatistikler -->
          <div class="detail-stats">
            <div class="detail-box">
              <div class="stat-title">Yemek Kartı Satış</div>
              <div class="stat-value" style="color: #d97706;">${totals.yemekKarti.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">Yemek kartı ile yapılan satışlar</div>
            </div>
            
            <div class="detail-box">
              <div class="stat-title">Toplam İade</div>
              <div class="stat-value" style="color: #dc2626;">${(totals.nakitIade + totals.krediKartiIade).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">
                Nakit: ${totals.nakitIade.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺<br>
                KK: ${totals.krediKartiIade.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              </div>
            </div>
            
            <div class="detail-box">
              <div class="stat-title">Ortalama Şube Cirosu</div>
              <div class="stat-value" style="color: #4338ca;">${(filteredData.length > 0 ? totals.toplam / filteredData.length : 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
              <div class="stat-subtitle">Şube başına ortalama performans</div>
            </div>
          </div>
          
          <h3 style="color: #991b1b; margin: 20px 0 10px 0; font-size: 14px; border-bottom: 2px solid #991b1b; padding-bottom: 5px;">DETAYLI ŞUBE ANALİZİ</h3>
          
          <table>
            <thead>
              <tr>
                ${Object.keys(filteredData[0] || {})
                  .map(header => `<th>${header}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  ${Object.keys(row)
                    .map(key => {
                      const value = row[key];
                      if (key === 'Sube_No') {
                        return `<td class="number">${Math.round(safeParseFloat(value))}</td>`;
                      } else if (key === 'NAME') {
                        const fullName = String(value || '');
                        const dashIndex = fullName.indexOf('-');
                        const displayName = dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName;
                        return `<td>${displayName}</td>`;
                      } else if (numericColumns.includes(key) && key !== 'Sube_No') {
                        const numValue = safeParseFloat(value);
                        const isIade = key.includes('İADE');
                        const colorClass = isIade ? 'negative' : 'positive';
                        return `<td class="number currency ${colorClass}">${numValue.toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}</td>`;
                      }
                      return `<td>${value || ''}</td>`;
                    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde BT Rapor sistemi tarafından otomatik olarak oluşturulmuştur. 
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
      console.error('PDF yazdırma hatası:', error);
      alert('PDF yazdırma işlemi sırasında hata oluştu.');
    }
  };

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
          <title>Enpos Ciro Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 15px; }
            .header-top { display: flex; align-items: flex-start; gap: 15px; }
            .logo { width: 60px; height: auto; flex-shrink: 0; }
            .header-content { flex: 1; }
            .header h1 { color: #991b1b; margin: 0 0 5px 0; font-size: 16px; text-align: left; }
            .header p { margin: 2px 0; color: #666; font-size: 10px; text-align: left; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .positive { color: #1f2937; }
            .negative { color: #dc2626; }
            @media print {
              body { margin: 0; font-size: 9px; }
              .no-print { display: none; }
              table { font-size: 8px; }
              th, td { padding: 3px; }
              .header { margin-bottom: 10px; }
              .header-top { gap: 10px; }
              .logo { width: 45px; }
              .header h1 { font-size: 14px; margin: 0 0 3px 0; }
              .header p { font-size: 8px; margin: 1px 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>Enpos Ciro Raporu</h1>
                <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
                <p>Toplam Kayıt: ${filteredData.length}</p>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${Object.keys(filteredData[0] || {})
                  .map(header => `<th>${header}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  ${Object.keys(row)
                    .map(key => {
                      const value = row[key];
                      if (key === 'Sube_No') {
                        return `<td class="number">${Math.round(safeParseFloat(value))}</td>`;
                      } else if (key === 'NAME') {
                        const fullName = String(value || '');
                        const dashIndex = fullName.indexOf('-');
                        const displayName = dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName;
                        return `<td>${displayName}</td>`;
                      } else if (numericColumns.includes(key) && key !== 'Sube_No') {
                        const numValue = safeParseFloat(value);
                        const isIade = key.includes('İADE');
                        const colorClass = isIade ? 'negative' : 'positive';
                        return `<td class="number currency ${colorClass}">${numValue.toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}</td>`;
                      }
                      return `<td>${value || ''}</td>`;
                    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Yazdırma diyalogunu aç
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      alert('Yazdırma işlemi sırasında hata oluştu.');
    }
  };

  // Arama fonksiyonu
  const filteredData = data.filter((item) =>
    Object.entries(item).some(([key, value]) => {
      const valueStr = String(value).toLocaleLowerCase('tr-TR');
      const searchStr = searchTerm.toLocaleLowerCase('tr-TR');
      
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
    const aStr = String(aValue).toLocaleLowerCase('tr-TR');
    const bStr = String(bValue).toLocaleLowerCase('tr-TR');
    
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
    if (columnWidths[column]) return columnWidths[column];
    // Özel sütun genişlikleri
    if (column === 'Sube_No') return 30;
    if (column === 'NAME') return 250;
    // Diğer sütunlar için varsayılan
    return 150;
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
            
            {/* Export Butonları */}
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-2"
                title="Excel olarak indir"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z"/>
                  <path d="M9 9h6v6H9V9zm1 1v4h4v-4h-4z"/>
                </svg>
                <span className="hidden sm:inline">Excel</span>
              </button>
              
              <button
                onClick={exportToPDF}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                title="PDF olarak yazdır"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span className="hidden sm:inline">PDF</span>
              </button>
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

      {/* Desktop Tablo Görünümü */}
      <div className="hidden md:block overflow-x-auto">
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
                    <span className="truncate">{column === 'NAME' ? 'Şube' : column}</span>
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
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                      numericColumns.includes(column) ? 'text-right' : ''
                    }`}
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

      {/* Mobil Card Görünümü */}
      <div className="md:hidden space-y-4 bg-gray-50 rounded-lg p-4">
        {paginatedData.map((row, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-700 mb-1">
                  Şube {Math.round(safeParseFloat(row['Sube_No']))}
                </h3>
                <p className="text-gray-700 text-sm">
                  {(() => {
                    const fullName = String(row['NAME'] || '');
                    const dashIndex = fullName.indexOf('-');
                    return dashIndex !== -1 ? fullName.substring(dashIndex + 1) : fullName;
                  })()}
                </p>
              </div>
            </div>
            
            {/* Satış Bilgileri */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">NAKİT SATIŞ</p>
                <p className="text-green-600 font-bold text-sm text-right">
                  {formatCurrency(safeParseFloat(row['NAKİT SATIŞ']))}
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">KREDİ KARTI SATIŞ</p>
                <p className="text-green-600 font-bold text-sm text-right">
                  {formatCurrency(safeParseFloat(row['KREDİ KARTI İLE SATIŞ']))}
                </p>
              </div>
              
              <div className="bg-orange-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">YEMEK KARTI</p>
                <p className="text-green-600 font-bold text-sm text-right">
                  {formatCurrency(safeParseFloat(row['YEMEK KARTI']))}
                </p>
              </div>
              
              <div className="bg-red-50 rounded-md p-3">
                <p className="text-xs text-gray-600 mb-1">TOPLAM İADE</p>
                <p className="text-red-600 font-bold text-sm text-right">
                  {formatCurrency(safeParseFloat(row['NAKİT İADE']) + safeParseFloat(row['KREDİ KARTI İADE']))}
                </p>
              </div>
            </div>
            
            {/* İade Detayları */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="text-xs flex justify-between">
                <span className="text-gray-500">Nakit İade:</span>
                <span className="text-red-600 font-medium">
                  {formatCurrency(safeParseFloat(row['NAKİT İADE']))}
                </span>
              </div>
              <div className="text-xs flex justify-between">
                <span className="text-gray-500">KK İade:</span>
                <span className="text-red-600 font-medium">
                  {formatCurrency(safeParseFloat(row['KREDİ KARTI İADE']))}
                </span>
              </div>
            </div>
            
            {/* Net Toplam */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">NET CİRO:</span>
                <span className={`font-bold text-lg ${
                  safeParseFloat(row['TOPLAM']) < 0 
                    ? 'text-red-600' 
                    : safeParseFloat(row['TOPLAM']) > 0 
                    ? 'text-green-600' 
                    : 'text-gray-900'
                }`}>
                  {formatCurrency(safeParseFloat(row['TOPLAM']))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sayfalama */}
      <div className="px-4 lg:px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-700">
            Toplam {filteredData.length} kayıttan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} arası gösteriliyor
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2">
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
            
            <div className="flex gap-1">
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