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

interface CBakiyeTableProps {
  data: any[];
}

type SortDirection = 'asc' | 'desc' | null;

export default function CBakiyeTable({ data }: CBakiyeTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sayısal sütunlar - Multi-currency PIVOT desteği ile
  const numericColumns = data.length > 0 ? Object.keys(data[0]).filter(key => 
    key === 'BORÇ' || key === 'ALACAK' || key === 'BAKİYE' || key === 'BAKIYE' || key === 'Borç' || key === 'Alacak' || key === 'Bakiye' ||
    key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('Bakiye') ||
    key.includes('_Borç') || key.includes('_Alacak') || key.includes('_Bakiye') ||
    key.includes('CUR_') || key.endsWith('_Borç') || key.endsWith('_Alacak') || key.endsWith('_Bakiye')
  ) : ['BORÇ', 'ALACAK', 'BAKİYE'];

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
          if (key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo') {
            if (key === 'BORÇ' || key === 'ALACAK' || key.includes('_Borç') || key.includes('_Alacak') || key === 'Borç' || key === 'Alacak') {
              // Multi-currency para formatı
              if (typeof row[key] === 'string' && (row[key].includes('.') || row[key].includes(',') || row[key].includes(' '))) {
                // Zaten formatlanmış değer
                newRow[key] = row[key];
              } else {
                // Formatlanmamış değer
                const value = safeParseFloat(row[key]);
                newRow[key] = value.toLocaleString('tr-TR', { 
                  style: 'currency', 
                  currency: 'TRY',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
              }
            } else if (key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('_Bakiye') || key === 'Bakiye') {
              // Multi-currency bakiye formatı
              if (typeof row[key] === 'string' && (row[key].includes('(A)') || row[key].includes('(B)') || row[key] === '0')) {
                // Zaten formatlanmış değer
                newRow[key] = row[key];
              } else {
                // Formatlanmamış değer
                const value = safeParseFloat(row[key]);
                const formattedCurrency = Math.abs(value).toLocaleString('tr-TR', { 
                  style: 'currency', 
                  currency: 'TRY',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                });
                
                if (value === 0) {
                  newRow[key] = formattedCurrency;
                } else {
                  const indicator = value < 0 ? '(A)' : '(B)';
                  newRow[key] = `${formattedCurrency} ${indicator}`;
                }
              }
            } else {
              newRow[key] = row[key] || '';
            }
          }
        });
        return newRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cari Bakiye');

      // Sütun genişliklerini ayarla
      const columnWidths = Object.keys(exportData[0] || {}).map(key => {
        if (key === 'ÜNVANI') return { wch: 30 };
        if (key === 'KODU') return { wch: 15 };
        if (key === 'BORÇ' || key === 'ALACAK' || key === 'BAKİYE' || key === 'BAKIYE') return { wch: 15 };
        return { wch: 12 };
      });
      worksheet['!cols'] = columnWidths;

      // Dosyayı indir
      const fileName = `Cari_Bakiye_${new Date().toLocaleDateString('tr-TR').replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  const exportToPDF = () => {
    try {
      // Basit toplam hesaplaması (tüm formatları destekler)
      const totalCustomers = filteredData.length;
      const isMultiCurrency = filteredData.length > 0 && Object.keys(filteredData[0]).some(key => key.includes('_Borç') || key.includes('_Alacak') || key.includes('_Bakiye'));
      
      // Multi-currency istatistikleri için
      const currencyStats: any[] = [];
      
      if (isMultiCurrency) {
        const currencyTotals: { [key: string]: { code: string, borc: number, alacak: number, bakiye: number } } = {};
        
        filteredData.forEach(row => {
          Object.keys(row).forEach(key => {
            const borcMatch = key.match(/^(.+)_Borç$/);
            const alacakMatch = key.match(/^(.+)_Alacak$/);
            const bakiyeMatch = key.match(/^(.+)_Bakiye$/);
            
            if (borcMatch) {
              const currencyCode = borcMatch[1];
              if (!currencyTotals[currencyCode]) {
                currencyTotals[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
              }
              let value = row[key];
              if (typeof value === 'string') {
                value = value.replace(/\./g, '').replace(',', '.');
              }
              currencyTotals[currencyCode].borc += safeParseFloat(value);
            }
            
            if (alacakMatch) {
              const currencyCode = alacakMatch[1];
              if (!currencyTotals[currencyCode]) {
                currencyTotals[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
              }
              let value = row[key];
              if (typeof value === 'string') {
                value = value.replace(/\./g, '').replace(',', '.');
              }
              currencyTotals[currencyCode].alacak += safeParseFloat(value);
            }
            
            if (bakiyeMatch) {
              const currencyCode = bakiyeMatch[1];
              if (!currencyTotals[currencyCode]) {
                currencyTotals[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
              }
              let value = row[key];
              if (typeof value === 'string') {
                if (value.includes('(A)')) {
                  value = '-' + value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
                } else if (value.includes('(B)')) {
                  value = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
                } else {
                  value = value.replace(/\./g, '').replace(',', '.');
                }
              }
              currencyTotals[currencyCode].bakiye += safeParseFloat(value);
            }
          });
        });
        
        currencyStats.push(...Object.values(currencyTotals));
      }

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
          <title>Cari Bakiye Raporu - PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 30px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: white; margin: 0 0 8px 0; font-size: 22px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-align: left; }
            .pdf-info { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin-bottom: 25px; border-radius: 4px; }
            .pdf-info strong { color: #92400e; }
            
            /* İstatistik Kutuları */
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-box.primary { border-color: #991b1b; background-color: #fef2f2; }
            .stat-box.success { border-color: #059669; background-color: #ecfdf5; }
            .stat-box.warning { border-color: #d97706; background-color: #fffbeb; }
            .stat-box.danger { border-color: #dc2626; background-color: #fef2f2; }
            .stat-title { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 14px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 8px; color: #9ca3af; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .positive { color: #059669; }
            .negative { color: #dc2626; }
            @media print {
              body { margin: 0; font-size: 10px; }
              .pdf-info { display: none; }
              .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
              .stat-box { padding: 8px; }
              table { font-size: 8px; }
              th, td { padding: 3px; }
              .header { margin-bottom: 20px; padding: 15px; }
              .header-top { gap: 15px; margin-bottom: 10px; }
              .logo { width: 75px; }
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
                <h1>CARİ BAKİYE RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                <p><strong>Toplam Müşteri:</strong> ${filteredData.length} adet</p>
                <p><strong>Rapor Türü:</strong> Detaylı Cari Hesap Bakiye Analizi</p>
              </div>
            </div>
          </div>
          
          <div class="pdf-info">
            <strong>📄 PDF Olarak Kaydetmek İçin:</strong><br>
            Yazdırma diyaloğunda "Hedef" kısmından <strong>"PDF olarak kaydet"</strong> seçeneğini seçin.
          </div>
          
          <!-- İstatistik Kutuları -->
          <div style="margin-bottom: 20px;">
            <div class="stats-grid">
              <div class="stat-box primary">
                <div class="stat-title">Toplam Müşteri</div>
                <div class="stat-value">${totalCustomers}</div>
              </div>
              
              ${isMultiCurrency ? `
              <div class="stat-box success">
                <div class="stat-title">Aktif Kurlar</div>
                <div class="stat-value">${currencyStats.length}</div>
              </div>
              ` : `
              <div class="stat-box success">
                <div class="stat-title">Rapor Formatı</div>
                <div class="stat-value">Tekli Kur</div>
              </div>
              `}
            </div>
            
            ${isMultiCurrency ? `
            <h3 style="color: #991b1b; font-size: 14px; margin: 15px 0 10px 0;">💰 Kur Bazlı Toplamlar</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
              ${currencyStats.map(currency => `
              <div class="stat-box" style="border-left: 4px solid #991b1b;">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 8px;">
                  <strong style="font-size: 16px; color: #991b1b;">💱 ${currency.code}</strong>
                </div>
                <div style="font-size: 10px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                  <span>💸 Borç:</span>
                  <strong style="color: #dc2626; text-align: right;">${currency.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style="font-size: 10px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                  <span>💰 Alacak:</span>
                  <strong style="color: #059669; text-align: right;">${currency.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style="font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 5px; display: flex; justify-content: space-between; align-items: center;">
                  <span>⚖️ Bakiye:</span>
                  <strong style="color: ${currency.bakiye < 0 ? '#dc2626' : currency.bakiye > 0 ? '#059669' : '#1f2937'}; text-align: right;">
                    ${Math.abs(currency.bakiye).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    ${currency.bakiye !== 0 ? (currency.bakiye < 0 ? ' (A)' : ' (B)') : ''}
                  </strong>
                </div>
              </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
          
          <h3 style="color: #991b1b; margin: 20px 0 10px 0; font-size: 14px; border-bottom: 2px solid #991b1b; padding-bottom: 5px;">DETAYLI CARİ HESAP LİSTESİ</h3>
          
          <table>
            <thead>
              <tr>
                ${Object.keys(filteredData[0] || {})
                  .filter(key => key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo')
                  .map(header => `<th>${header}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  ${Object.keys(row)
                    .filter(key => key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo')
                    .map(key => {
                      const value = row[key];
                      
                      // Multi-currency borç/alacak sütunları
                      if (key === 'BORÇ' || key === 'ALACAK' || key === 'Borç' || key === 'Alacak' || 
                          key.includes('_Borç') || key.includes('_Alacak')) {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi kullan
                        if (typeof value === 'string' && (value.includes('.') || value.includes(',') || value.includes(' '))) {
                          return `<td class="number currency">${String(value)}</td>`;
                        }
                        // Formatlanmamış değer ise formatla
                        const numValue = safeParseFloat(value);
                        return `<td class="number currency">${numValue.toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}</td>`;
                      } 
                      
                      // Multi-currency bakiye sütunları
                      else if (key === 'BAKİYE' || key === 'BAKIYE' || key === 'Bakiye' || 
                               key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('_Bakiye')) {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi kullan
                        if (typeof value === 'string' && (value.includes('(A)') || value.includes('(B)') || value === '0' || value === '0,00')) {
                          const colorClass = value.includes('(A)') ? 'negative' : value.includes('(B)') ? 'positive' : '';
                          return `<td class="number currency ${colorClass}">${String(value)}</td>`;
                        }
                        // Formatlanmamış değer ise formatla
                        const numValue = safeParseFloat(value);
                        const formatted = Math.abs(numValue).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        });
                        const colorClass = numValue < 0 ? 'negative' : numValue > 0 ? 'positive' : '';
                        const indicator = numValue === 0 ? '' : numValue < 0 ? ' (A)' : ' (B)';
                        return `<td class="number currency ${colorClass}">${formatted}${indicator}</td>`;
                      }
                      
                      // Diğer sütunlar - String'e çevir ve [object Object] sorununu önle
                      return `<td>${String(value || '')}</td>`;
                    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde BT Rapor sistemi tarafından otomatik olarak oluşturulmuştur. 
            Tüm tutarlar Türk Lirası (₺) cinsindendir. Bakiye gösterimi: (A) = Alacaklı, (B) = Borçlu.
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
          <title>Cari Bakiye Raporu</title>
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
                 <h1>CARİ BAKİYE RAPORU</h1>
                 <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                 <p>Toplam Müşteri: ${filteredData.length} adet</p>
               </div>
             </div>
           </div>
          <table>
            <thead>
              <tr>
                ${Object.keys(filteredData[0] || {})
                  .filter(key => key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo')
                  .map(header => `<th>${header}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  ${Object.keys(row)
                    .filter(key => key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo')
                    .map(key => {
                      const value = row[key];
                      
                      // Multi-currency borç/alacak sütunları
                      if (key === 'BORÇ' || key === 'ALACAK' || key === 'Borç' || key === 'Alacak' || 
                          key.includes('_Borç') || key.includes('_Alacak')) {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi kullan
                        if (typeof value === 'string' && (value.includes('.') || value.includes(',') || value.includes(' '))) {
                          return `<td class="number currency">${String(value)}</td>`;
                        }
                        // Formatlanmamış değer ise formatla
                        const numValue = safeParseFloat(value);
                        return `<td class="number currency">${numValue.toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}</td>`;
                      } 
                      
                      // Multi-currency bakiye sütunları
                      else if (key === 'BAKİYE' || key === 'BAKIYE' || key === 'Bakiye' || 
                               key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('_Bakiye')) {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi kullan
                        if (typeof value === 'string' && (value.includes('(A)') || value.includes('(B)') || value === '0' || value === '0,00')) {
                          const colorClass = value.includes('(A)') ? 'negative' : value.includes('(B)') ? 'positive' : '';
                          return `<td class="number currency ${colorClass}">${String(value)}</td>`;
                        }
                        // Formatlanmamış değer ise formatla
                        const numValue = safeParseFloat(value);
                        const formatted = Math.abs(numValue).toLocaleString('tr-TR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        });
                        const colorClass = numValue < 0 ? 'negative' : numValue > 0 ? 'positive' : '';
                        const indicator = numValue === 0 ? '' : numValue < 0 ? ' (A)' : ' (B)';
                        return `<td class="number currency ${colorClass}">${formatted}${indicator}</td>`;
                      }
                      
                      // Diğer sütunlar - String'e çevir ve [object Object] sorununu önle
                      return `<td>${String(value || '')}</td>`;
                    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde BT Rapor sistemi tarafından otomatik olarak oluşturulmuştur. 
            Tüm tutarlar Türk Lirası (₺) cinsindendir. Bakiye gösterimi: (A) = Alacaklı, (B) = Borçlu.
          </div>
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

  // Sütun genişliği ayarlama fonksiyonları
  const getColumnWidth = (column: string): number => {
    return columnWidths[column] || (column === 'DETAY' ? 50 : 150);
  };

  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setIsResizing(true);
    setResizingColumn(column);
    
    const startX = e.clientX;
    const startWidth = getColumnWidth(column);
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff); // Minimum 50px
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

  // Sayfa başına kayıt sayısını değiştirme
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Sayfa sayısı değiştiğinde ilk sayfaya dön
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        {/* Başlık ve İstatistikler */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Cari Hesap Listesi</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-sm text-gray-500">
              {filteredData.length} / {data.length} kayıt
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
      <div className="hidden md:block relative">
        <div 
          className="w-full overflow-auto max-h-[70vh] border border-gray-200 rounded-lg" 
          style={{ 
            scrollbarWidth: 'auto',
            msOverflowStyle: 'auto'
          }}
        >
          <table className="w-full border-separate border-spacing-0" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="bg-gradient-to-r from-red-900 to-red-800 text-white">
                <th 
                  className="py-4 text-center text-sm font-bold uppercase tracking-wider border-b border-red-800 relative"
                  style={{ 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 10,
                    background: 'linear-gradient(to right, rgb(127 29 29), rgb(153 27 27))',
                    width: getColumnWidth('DETAY'),
                    minWidth: getColumnWidth('DETAY'),
                    maxWidth: getColumnWidth('DETAY')
                  }}
                >
                  <div className="px-6">DETAY</div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-red-600 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleMouseDown(e, 'DETAY')}
                  />
                </th>
                {data.length > 0 &&
                  Object.keys(data[0])
                    .filter(header => header !== 'LOGICALREF' && header !== 'CLIENTREF' && header !== 'CurrencyNo')
                    .map((header) => (
                      <th
                        key={header}
                        className="py-4 text-left text-sm font-bold uppercase tracking-wider border-b border-red-800 cursor-pointer hover:bg-red-800 transition-colors duration-200 relative"
                        style={{ 
                          position: 'sticky', 
                          top: 0, 
                          zIndex: 10,
                          background: 'linear-gradient(to right, rgb(127 29 29), rgb(153 27 27))',
                          width: getColumnWidth(header),
                          minWidth: getColumnWidth(header),
                          maxWidth: getColumnWidth(header)
                        }}
                        onClick={() => handleSort(header)}
                      >
                        <div className="flex items-center justify-between px-6">
                          <span>{header}</span>
                          {getSortIcon(header)}
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-red-600 opacity-0 hover:opacity-100 transition-opacity z-20"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e, header);
                          }}
                        />
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
                <td 
                  className="py-4 text-center border-b border-gray-200"
                  style={{
                    width: getColumnWidth('DETAY'),
                    minWidth: getColumnWidth('DETAY'),
                    maxWidth: getColumnWidth('DETAY')
                  }}
                >
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
                  .filter(([key]) => key !== 'LOGICALREF' && key !== 'CLIENTREF' && key !== 'CurrencyNo')
                  .map(([key, value], cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`py-4 whitespace-nowrap text-sm border-b border-gray-200 ${
                        key === 'BORÇ' || key === 'ALACAK' || key.includes('_Borç') || key.includes('_Alacak') || key === 'Borç' || key === 'Alacak'
                          ? 'text-right font-bold text-red-800'
                          : (key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('_Bakiye') || key === 'Bakiye')
                          ? (() => {
                              // Multi-currency bakiye renklendirme
                              if (typeof value === 'string') {
                                if (value.includes('(A)')) return 'text-right font-bold text-red-600';
                                if (value.includes('(B)')) return 'text-right font-bold text-green-600';
                                // 0 değeri için siyah renk (gray-900)
                                if (value === '0' || value === '0,00' || !value.includes('(')) return 'text-right font-bold text-gray-900';
                              }
                              const numValue = safeParseFloat(value);
                              return `text-right font-bold ${numValue < 0 ? 'text-red-600' : numValue > 0 ? 'text-green-600' : 'text-gray-900'}`;
                            })()
                          : key === 'KODU' || key === 'Cari Kodu'
                          ? 'text-red-700 font-semibold'
                          : key === 'ÜNVANI' || key === 'Cari Ünvanı'
                          ? 'text-gray-700 font-medium'
                          : key === 'Para Birimi'
                          ? 'text-blue-700 font-semibold text-center'
                          : 'text-gray-800 font-medium'
                      }`}
                      style={{
                        width: getColumnWidth(key),
                        minWidth: getColumnWidth(key),
                        maxWidth: getColumnWidth(key)
                      }}
                    >
                      <div className="px-6 overflow-hidden text-ellipsis">
                    {(() => {
                      // Multi-currency BAKİYE formatı
                      if (key === 'BAKİYE' || key === 'BAKIYE' || key.includes('BAKIYE') || key.includes('BAKİYE') || key.includes('_Bakiye') || key === 'Bakiye') {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi döndür
                        if (typeof value === 'string' && (value.includes('(A)') || value.includes('(B)') || value === '0')) {
                          return value;
                        }
                        
                        const parsedValue = safeParseFloat(value);
                        const formattedCurrency = formatCurrency(Math.abs(parsedValue));
                        
                        if (parsedValue === 0) {
                          return formattedCurrency;
                        }
                        
                        const indicator = parsedValue < 0 ? '(A)' : '(B)';
                        return `${formattedCurrency} ${indicator}`;
                      }
                      
                      // Multi-currency BORÇ/ALACAK formatı
                      if (key === 'BORÇ' || key === 'ALACAK' || key.includes('_Borç') || key.includes('_Alacak') || key === 'Borç' || key === 'Alacak') {
                        // Eğer değer zaten formatlanmışsa (SQL'den geliyorsa) olduğu gibi döndür
                        if (typeof value === 'string' && (value.includes('.') || value.includes(',') || value.includes(' '))) {
                          return value;
                        }
                        
                        const parsedValue = safeParseFloat(value);
                        return formatCurrency(parsedValue);
                      }
                      
                      return String(value || '');
                    })()}
                      </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-5 py-2 text-sm font-medium text-white bg-red-800 rounded-lg hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Önceki
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sayfa başına:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">kayıt</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            Sayfa {currentPage} / {totalPages}
          </span>
          <span className="text-sm text-gray-600">
            ({sortedData.length} kayıt)
          </span>
        </div>
        
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