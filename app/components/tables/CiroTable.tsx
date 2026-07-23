'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getCurrentUser } from '../../utils/simple-permissions';
import { useColumnPreferences } from '../../hooks/useColumnPreferences';
import ColumnManager from '../ColumnManager';

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
  onSubeInfoClick?: (subeNo: number) => void;
  onBelgeSayisiClick?: (row: { belgetarih: string; subeNo: number; belgeSayisi: number }) => void;
  storageKey?: string;
  defaultSortColumn?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function formatBelgeTarih(val: unknown): string {
  if (!val) return '-';
  const s = String(val);
  try {
    if (s.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}.${mm}.${yy}`;
    }
    return s;
  } catch {
    return s;
  }
}

export default function EnposCiroTable({
  data,
  startDate,
  endDate,
  onSubeInfoClick,
  onBelgeSayisiClick,
  storageKey = 'enpos-ciro',
  defaultSortColumn = 'Sube_No',
}: CiroTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterColumn, setFilterColumn] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Kaydedilen genişliklerin senkron bridge'i (savedWidths state async güncellenene kadar)
  const committedWidthsRef = useRef<Record<string, number>>({});
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // resize için aktif genişlikleri local tut, mouseUp'ta hook'a kaydet
  const [localWidths, setLocalWidths] = useState<Record<string, number>>({});

  const countColumns = ['Belge Sayısı'];

  // Sayısal sütunlar (para + sayaç)
  const numericColumns = data.length > 0 ? Object.keys(data[0]).filter(key => 
    key === 'NAKİT SATIŞ' || key === 'KREDİ KARTI İLE SATIŞ' || key === 'YEMEK KARTI' || 
    key === 'NAKİT İADE' || key === 'KREDİ KARTI İADE' || key === 'TOPLAM' || key === 'Sube_No' ||
    countColumns.includes(key)
  ) : ['NAKİT SATIŞ', 'KREDİ KARTI İLE SATIŞ', 'YEMEK KARTI', 'NAKİT İADE', 'KREDİ KARTI İADE', 'TOPLAM', 'Belge Sayısı'];

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
            const value = safeParseFloat(row[key]);
            if (countColumns.includes(key)) {
              newRow[key] = Math.round(value);
            } else {
              // Para formatında TL işaretiyle
              newRow[key] = value.toLocaleString('tr-TR', { 
                style: 'currency', 
                currency: 'TRY',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
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
      // Kullanıcı bilgisini al
      const currentUser = getCurrentUser();
      const userName = currentUser ? (currentUser.name || 'Kullanıcı') : 'Bilinmeyen Kullanıcı';
      
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
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde ${userName} tarafından BT Rapor sistemi üzerinden alınmıştır. 
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

    // Tarih kolonu
    if (sortColumn === 'BELGETARIH') {
      const aTime = new Date(String(aValue ?? '')).getTime() || 0;
      const bTime = new Date(String(bValue ?? '')).getTime() || 0;
      return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    }
    
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

  // Sütun genişliği resize — mouseUp'ta persist et
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    setResizingColumn(column);

    const startX = e.clientX;
    const startWidth = getColWidth(column);
    // Mevcut tüm genişlikleri başlangıç noktası olarak al (committedRef + savedWidths birleşimi)
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
      // Senkron bridge'i güncelle — savedWidths async güncellenene kadar doğru değeri verir
      committedWidthsRef.current = latestWidths;
      saveWidths(latestWidths);
      setLocalWidths({});
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ── SÜRÜKLE-BIRAK KOLON SIRASI ──────────────────────────────
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
    if (!draggedCol || draggedCol === column) {
      setDraggedCol(null); setDragOverCol(null); return;
    }
    // ciroOrdered içindeki index'leri bul (gizli kolonlar dahil tam liste)
    const fromIdx = ciroOrdered.findIndex(c => c.key === draggedCol);
    const toIdx   = ciroOrdered.findIndex(c => c.key === column);
    if (fromIdx !== -1 && toIdx !== -1) ciroReorder(fromIdx, toIdx);
    setDraggedCol(null); setDragOverCol(null);
  };

  const handleDragEnd = () => { setDraggedCol(null); setDragOverCol(null); };

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

  const allCiroColumns = Object.keys(data[0]);

  // Varsayılan genişlikler
  const DEFAULT_WIDTHS: Record<string, number> = {
    'BELGETARIH': 120,
    'Sube_No': 80,
    'NAME': 220,
    'Belge Sayısı': 120,
    'NAKİT SATIŞ': 160,
    'KREDİ KARTI İLE SATIŞ': 190,
    'YEMEK KARTI': 150,
    'NAKİT İADE': 150,
    'KREDİ KARTI İADE': 165,
    'TOPLAM': 160,
  };

  const columnLabel = (k: string) => {
    if (k === 'NAME') return 'Şube Adı';
    if (k === 'BELGETARIH') return 'Tarih';
    if (k === 'Sube_No') return 'Şube No';
    if (k === 'Belge Sayısı') return 'Belge Sayısı';
    return k;
  };

  const ciroColDefs = useMemo(
    () => allCiroColumns.map(k => ({
      key: k,
      label: columnLabel(k),
      defaultVisible: true,
      defaultWidth: DEFAULT_WIDTHS[k] ?? 150,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCiroColumns.join('|')]
  );

  const {
    orderedColumns: ciroOrdered,
    toggle: ciroToggle,
    reorder: ciroReorder,
    showAll: ciroShowAll,
    hideAll: ciroHideAll,
    columnWidths: savedWidths,
    saveWidths,
    getWidth,
  } = useColumnPreferences(storageKey, ciroColDefs);

  // Aktif genişlik: resize sırasında local, sonra commit ref (async bridge), sonra savedWidths
  const getColWidth = (key: string) =>
    localWidths[key] ?? committedWidthsRef.current[key] ?? savedWidths[key] ?? DEFAULT_WIDTHS[key] ?? 150;

  const columns = ciroOrdered.filter(c => c.visible).map(c => c.key).length > 0
    ? ciroOrdered.filter(c => c.visible).map(c => c.key)
    : allCiroColumns;

  return (
    <div className={`w-full select-none ${resizingColumn ? 'cursor-col-resize' : ''}`}>

      {/* ── TOOLBAR ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Arama */}
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Şube ara... (örn: şube*, *ltd)"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 placeholder-gray-400"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sağ taraf butonlar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtre */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filtre
              {(filterColumn || searchTerm) && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
            </button>

            {/* Sütun Yöneticisi */}
            <ColumnManager
              orderedColumns={ciroOrdered}
              columnDefs={ciroColDefs}
              onToggle={ciroToggle}
              onReorder={ciroReorder}
              onShowAll={ciroShowAll}
              onHideAll={ciroHideAll}
            />

            {/* Excel */}
            <button onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* PDF */}
            <button onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Sayfa başına */}
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2 py-1.5 bg-white">
              <span className="text-xs text-gray-500">Satır:</span>
              <select value={itemsPerPage} onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="text-xs font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Gelişmiş Filtre Paneli */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sütun</label>
              <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
                <option value="">Seçiniz</option>
                {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min</label>
              <input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="0"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max</label>
              <input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} placeholder="∞"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white" />
            </div>
            <div className="flex items-end">
              <button onClick={clearFilters}
                className="w-full px-4 py-2 text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Temizle
              </button>
            </div>
          </div>
        )}

        {/* Sonuç bilgisi */}
        {(searchTerm || filterColumn) && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className="text-xs text-gray-500">
              {filteredData.length} kayıt bulundu
              {searchTerm && <span> · &quot;{searchTerm}&quot; arandı</span>}
            </span>
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLO ───────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        {/*
          Tablo stratejisi:
          - Veri kolonları: kesin piksel genişliği (tableLayout fixed ile)
          - Filler kolonu (son, veri yok): kalan boşluğu alır → tablo her zaman tam genişlikte
          - minWidth: toplam kolon genişliği → yatay scroll gereken yerde devreye girer
        */}
        <table
          className="w-full border-collapse"
          style={{
            tableLayout: 'fixed',
            minWidth: `${columns.reduce((sum, col) => sum + getColWidth(col), 0)}px`,
          }}
        >
          <colgroup>
            {columns.map(col => (
              <col key={col} style={{ width: `${getColWidth(col)}px` }} />
            ))}
            {/* Filler: kalan boşluğu sessizce kaplar */}
            <col style={{ width: 'auto' }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-800 text-white">
              {columns.map((column) => {
                const w = getColWidth(column);
                const isResizingThis = resizingColumn === column;
                const isDragging  = draggedCol  === column;
                const isDragOver  = dragOverCol === column && draggedCol !== column;
                return (
                  <th key={column}
                    draggable={!resizingColumn}
                    onDragStart={(e) => handleDragStart(e, column)}
                    onDragOver={(e)  => handleDragOver(e, column)}
                    onDrop={(e)      => handleDrop(e, column)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
                    }}
                    className={`relative text-left text-xs font-bold uppercase tracking-wider select-none border-b border-slate-700 transition-colors ${
                      isDragging ? 'opacity-30' : ''
                    } ${isDragOver ? 'bg-slate-600' : ''}`}
                    style={{ width: w, minWidth: 0, overflow: 'hidden' }}
                  >
                    {/* Bırakma göstergesi — sol kenar çizgisi */}
                    {isDragOver && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 z-20" />
                    )}

                    {/* Başlık + sıralama */}
                    <div
                      className="flex items-center gap-1.5 px-3 py-3 cursor-grab active:cursor-grabbing hover:bg-slate-700/60 transition-colors"
                      onClick={() => !draggedCol && handleSort(column)}
                    >
                      {/* Grip ikonu */}
                      <svg className="w-2.5 h-2.5 text-slate-500 flex-shrink-0 opacity-70" fill="currentColor" viewBox="0 0 10 16">
                        <circle cx="2.5" cy="3"  r="1.5"/>
                        <circle cx="2.5" cy="8"  r="1.5"/>
                        <circle cx="2.5" cy="13" r="1.5"/>
                        <circle cx="7.5" cy="3"  r="1.5"/>
                        <circle cx="7.5" cy="8"  r="1.5"/>
                        <circle cx="7.5" cy="13" r="1.5"/>
                      </svg>
                      <span className="truncate flex-1">{columnLabel(column)}</span>
                      <span className="flex-shrink-0">{getSortIcon(column)}</span>
                    </div>

                    {/* Resize handle */}
                    <div
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, column); }}
                      className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center group z-10"
                      title="Sürükleyerek genişlet"
                    >
                      <div className={`w-0.5 h-4/5 rounded-full transition-all ${
                        isResizingThis ? 'bg-emerald-400 w-1' : 'bg-slate-600 group-hover:bg-emerald-400 group-hover:w-1'
                      }`}></div>
                    </div>
                  </th>
                );
              })}
              {/* Filler th */}
              <th className="bg-slate-800 border-b border-slate-700" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((row, index) => {
              const subeNo = Math.round(safeParseFloat(row['Sube_No']));
              const isEven = index % 2 === 0;
              return (
                <tr key={index} className={`transition-colors hover:bg-emerald-50/60 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                  {columns.map((column) => {
                    const w = getColWidth(column);
                    const isNumeric = numericColumns.includes(column);
                    return (
                      <td key={column}
                        className={`px-3 py-2.5 text-sm whitespace-nowrap overflow-hidden ${isNumeric ? 'text-right font-medium tabular-nums' : 'text-gray-800'}`}
                        style={{ width: w, minWidth: 0, overflow: 'hidden' }}
                      >
                        {column === 'BELGETARIH' ? (
                          <span className="font-medium text-gray-900 tabular-nums">
                            {formatBelgeTarih(row[column])}
                          </span>
                        ) : column === 'Sube_No' ? (
                          <span className="inline-flex items-center justify-center w-8 h-6 bg-slate-100 text-slate-700 rounded-md text-xs font-bold">
                            {subeNo}
                          </span>
                        ) : column === 'Belge Sayısı' ? (
                          onBelgeSayisiClick ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBelgeSayisiClick({
                                  belgetarih: String(row.BELGETARIH ?? ''),
                                  subeNo,
                                  belgeSayisi: Math.round(safeParseFloat(row[column])),
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold tabular-nums text-sm transition-colors"
                              title="Belge tipi dağılımını göster"
                            >
                              {Math.round(safeParseFloat(row[column])).toLocaleString('tr-TR')}
                              <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="font-bold tabular-nums text-gray-800">
                              {Math.round(safeParseFloat(row[column])).toLocaleString('tr-TR')}
                            </span>
                          )
                        ) : column === 'NAME' ? (
                          <span className="font-medium text-gray-900 truncate block">
                            {(() => {
                              const fullName = String(row[column] || '');
                              const dashIndex = fullName.indexOf('-');
                              return dashIndex !== -1 ? fullName.substring(dashIndex + 1).trim() : fullName;
                            })()}
                          </span>
                        ) : column === 'KREDİ KARTI İLE SATIŞ' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-gray-800">{formatCurrency(safeParseFloat(row[column]))}</span>
                            {onSubeInfoClick && (
                              <button onClick={(e) => { e.stopPropagation(); onSubeInfoClick(subeNo); }}
                                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                                title="Banka detayları">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ) : isNumeric ? (
                          <span className={column.includes('İADE') ? 'text-red-500' : 'text-gray-800'}>
                            {formatCurrency(safeParseFloat(row[column]))}
                          </span>
                        ) : (
                          <span className="truncate block">{String(row[column] || '')}</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Filler td */}
                  <td className={isEven ? 'bg-white' : 'bg-gray-50/50'} />
                </tr>
              );
            })}
          </tbody>

          {/* Toplam satırı */}
          {paginatedData.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-sm">
                {columns.map((column, i) => {
                  const w = getColWidth(column);
                  if (i === 0) return (
                    <td key={column} className="px-3 py-2.5 text-xs font-bold text-slate-600 uppercase" style={{ width: w }}>
                      TOPLAM
                    </td>
                  );
                  if (column === 'NAME') return <td key={column} className="px-3 py-2.5" style={{ width: w }}></td>;
                  if (!numericColumns.includes(column) || column === 'Sube_No') {
                    return <td key={column} className="px-3 py-2.5" style={{ width: w }}></td>;
                  }
                  const total = filteredData.reduce((s, r) => s + safeParseFloat(r[column]), 0);
                  if (countColumns.includes(column)) {
                    return (
                      <td key={column} className="px-3 py-2.5 text-right tabular-nums text-slate-900" style={{ width: w }}>
                        {Math.round(total).toLocaleString('tr-TR')}
                      </td>
                    );
                  }
                  return (
                    <td key={column} className={`px-3 py-2.5 text-right tabular-nums ${column.includes('İADE') ? 'text-red-600' : 'text-slate-900'}`} style={{ width: w }}>
                      {formatCurrency(total)}
                    </td>
                  );
                })}
                {/* Filler td */}
                <td className="bg-slate-100" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── MOBİL KARTLAR ───────────────────────────────────────── */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginatedData.map((row, index) => {
          const subeNo = Math.round(safeParseFloat(row['Sube_No']));
          const subeName = (() => {
            const fullName = String(row['NAME'] || '');
            const di = fullName.indexOf('-');
            return di !== -1 ? fullName.substring(di + 1).trim() : fullName;
          })();
          return (
            <div key={index} className="p-4 bg-white hover:bg-gray-50 transition-colors">
              {/* Başlık */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-6 bg-slate-800 text-white rounded text-xs font-bold flex items-center justify-center">{subeNo}</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {row.BELGETARIH ? `${formatBelgeTarih(row.BELGETARIH)} · ` : ''}
                    {subeName || `Şube ${subeNo}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {row['Belge Sayısı'] != null && (
                    onBelgeSayisiClick ? (
                      <button
                        type="button"
                        onClick={() =>
                          onBelgeSayisiClick({
                            belgetarih: String(row.BELGETARIH ?? ''),
                            subeNo,
                            belgeSayisi: Math.round(safeParseFloat(row['Belge Sayısı'])),
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                      >
                        {Math.round(safeParseFloat(row['Belge Sayısı'])).toLocaleString('tr-TR')} belge
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-gray-600">
                        {Math.round(safeParseFloat(row['Belge Sayısı'])).toLocaleString('tr-TR')} belge
                      </span>
                    )
                  )}
                  {onSubeInfoClick && (
                  <button onClick={() => onSubeInfoClick(subeNo)}
                    className="text-blue-500 hover:text-blue-700 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
                </div>
              </div>

              {/* Satış grid */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[
                  { label: 'Nakit Satış', key: 'NAKİT SATIŞ', color: 'emerald' },
                  { label: 'Kredi Kartı', key: 'KREDİ KARTI İLE SATIŞ', color: 'blue' },
                  { label: 'Yemek Kartı', key: 'YEMEK KARTI', color: 'orange' },
                  { label: 'Toplam İade', key: 'NAKİT İADE', color: 'red', extra: 'KREDİ KARTI İADE' },
                ].map(({ label, key, color, extra }) => {
                  const val = safeParseFloat(row[key]) + (extra ? safeParseFloat(row[extra]) : 0);
                  const colors: Record<string, string> = {
                    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
                    blue: 'bg-blue-50 border-blue-100 text-blue-700',
                    orange: 'bg-orange-50 border-orange-100 text-orange-700',
                    red: 'bg-red-50 border-red-100 text-red-600',
                  };
                  return (
                    <div key={key} className={`rounded-xl border p-2.5 ${colors[color]}`}>
                      <p className="text-xs opacity-70 font-medium mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-right tabular-nums">{formatCurrency(val)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Net ciro */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Ciro</span>
                <span className={`text-base font-bold tabular-nums ${
                  safeParseFloat(row['TOPLAM']) < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {formatCurrency(safeParseFloat(row['TOPLAM']))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SAYFALAMA ───────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-gray-500">
          Toplam <strong className="text-gray-800">{filteredData.length}</strong> kayıt ·{' '}
          <strong className="text-gray-800">{((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong> gösteriliyor
        </p>

        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
            className="px-2 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            «
          </button>
          <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
            className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ‹
          </button>

          {getPageNumbers().map(page => (
            <button key={page} onClick={() => setCurrentPage(page)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                currentPage === page
                  ? 'bg-slate-800 text-white border border-slate-800'
                  : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
              }`}>
              {page}
            </button>
          ))}

          <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
            className="px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ›
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
            className="px-2 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            »
          </button>
        </div>
      </div>
    </div>
  );
} 