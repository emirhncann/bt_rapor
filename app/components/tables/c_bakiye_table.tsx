'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Lottie from 'lottie-react';
import { sendSecureProxyRequest } from '../../utils/api';

// jsPDF türleri için extend
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface CBakiyeTableProps {
  data: any[];
  preloadedDetails?: {[key: string]: any[]};
  onPageChange?: (pageData: any[], currentPage: number, itemsPerPage: number) => void;
  selectedCurrencies?: number[];
}

type SortDirection = 'asc' | 'desc' | null;

export default function CBakiyeTable({ data, preloadedDetails = {}, onPageChange, selectedCurrencies = [] }: CBakiyeTableProps) {
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
  
  // Detay görüntüleme için yeni state'ler
  const [selectedClientRef, setSelectedClientRef] = useState<string | null>(null);
  const [clientDetails, setClientDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingAnimation, setLoadingAnimation] = useState(null);

  // Basitleştirilmiş filtre kategorileri - sadece temel 3 seçenek
  const filterCategories = ['Borç', 'Alacak', 'Bakiye'];
  
  // Hangi sütunları hangi kategoride araması gerektiğini belirle
  const getColumnsByCategory = (category: string): string[] => {
    if (!data.length) return [];
    
    const allColumns = Object.keys(data[0]);
    
    switch(category) {
      case 'Borç':
        return allColumns.filter(col => 
          col === 'BORÇ' || col === 'Borç' || 
          col.includes('_Borç') || col.endsWith('_Borç')
        );
      case 'Alacak':
        return allColumns.filter(col => 
          col === 'ALACAK' || col === 'Alacak' || 
          col.includes('_Alacak') || col.endsWith('_Alacak')
        );
      case 'Bakiye':
        return allColumns.filter(col => 
          col === 'BAKİYE' || col === 'BAKIYE' || col === 'Bakiye' ||
          col.includes('_Bakiye') || col.endsWith('_Bakiye') ||
          col.includes('BAKIYE') || col.includes('BAKİYE')
        );
      default:
        return [];
    }
  };

  // Loading animasyonunu yükle
  useEffect(() => {
    fetch('/animations/loading.json')
      .then(res => res.json())
      .then(data => setLoadingAnimation(data))
      .catch(err => console.log('Loading animasyonu yüklenemedi:', err));
  }, []);

  // Arama terimi veya filtreler değiştiğinde otomatik olarak 1. sayfaya git
  useEffect(() => {
    setCurrentPage(1);
    if (searchTerm.trim() !== '') {
      console.log(`🔍 Arama yapıldı: "${searchTerm}" - 1. sayfaya dönüldü`);
    } else if (filterColumn && (minValue || maxValue)) {
      console.log(`📊 Sayısal filtre uygulandı: ${filterColumn} - 1. sayfaya dönüldü`);
    } else {
      console.log('🧹 Filtreler temizlendi - 1. sayfaya dönüldü');
    }
  }, [searchTerm, filterColumn, minValue, maxValue]);



  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Currency No'yu TRCURR değerine map et
  const mapCurrencyNoToTRCURR = (currencyNo: number): number => {
    switch(currencyNo) {
      case 53: return 0;  // TL -> TRCURR 0
      case 1: return 1;   // USD -> TRCURR 1
      case 20: return 20; // EUR -> TRCURR 20
      default: return currencyNo; // Diğer kurlar için aynı değer
    }
  };

  // Seçili kurları TRCURR değerlerine çevir
  const getSelectedTRCURRValues = (): number[] => {
    if (!selectedCurrencies || selectedCurrencies.length === 0) {
      return []; // Hiç kur seçilmemişse tüm kurları göster
    }
    return selectedCurrencies.map(mapCurrencyNoToTRCURR);
  };

  // Müşteri detaylarını getir
  const fetchClientDetails = async (clientRef: string, clientName: string, bypassCache: boolean = false) => {
    setSelectedClientRef(clientRef);
    setShowDetails(true);
    
    // Cache bypass kontrolü - yenile butonunda cache'i atla
    if (!bypassCache && preloadedDetails[clientRef]) {
      console.log(`✅ ClientRef ${clientRef} için hazır veri kullanılıyor:`, preloadedDetails[clientRef].length, 'hareket');
      setClientDetails(preloadedDetails[clientRef]);
      setLoadingDetails(false);
      return;
    }
    
    // API'den çek (preloaded data yok veya cache bypass edildi)
    console.log(`🔄 ClientRef ${clientRef} için API çağrısı yapılıyor ${bypassCache ? '(cache bypass)' : '(preloaded data yok)'}`);
    setLoadingDetails(true);
    
    try {
      // Connection bilgilerini al
      const connectionInfo = localStorage.getItem('connectionInfo');
      if (!connectionInfo) {
        alert('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyin.');
        return;
      }

      const connData = JSON.parse(connectionInfo);
      
      // public_ip'den dış IP ve portu ayır
      let externalIP = 'localhost';
      let servicePort = '45678';
      
      if (connData.public_ip) {
        const [ip, port] = connData.public_ip.split(':');
        externalIP = ip || 'localhost';
        servicePort = port || '45678';
      }

      // Connection string'i oluştur
      const connectionString = `Server=${connData.first_server_name || ''};Database=${connData.first_db_name || ''};User Id=${connData.first_username || ''};Password=${connData.first_password || ''};`;
      
      // Firma no ve dönem no'yu al
      const firmaNo = connData.first_firma_no || '009';
      const donemNo = connData.first_donem_no || '01';
      
      console.log('🌐 Hedef Service:', `http://${externalIP}:${servicePort}/sql`);
      
      // SQL sorgusu - detay sorgusu
      const detailQuery = `
        SELECT 
          CLIENTREF,
          DATE_ + [dbo].[fn_LogoTimetoSystemTime](FTIME) AS [Tarih],
          TRANNO AS [Fiş No],
          CASE MODULENR
            WHEN 4 THEN
              CASE TRCODE
                WHEN 31 THEN 'Satınalma Faturası'
                WHEN 32 THEN 'Perakende Satış İade Faturası'
                WHEN 33 THEN 'Toptan Satış İade Faturası'
                WHEN 34 THEN 'Alınan Hizmet Faturası'
                WHEN 36 THEN 'Satınalma İade Faturası'
                WHEN 37 THEN 'Perakende Satış Faturası'
                WHEN 38 THEN 'Toptan Satış Faturası'
                WHEN 39 THEN 'Verilen Hizmet Faturası'
                WHEN 43 THEN 'Satınalma Fiyat Farkı Faturası'
                WHEN 44 THEN 'Satış Fiyat Farkı Faturası'
                WHEN 56 THEN 'Müstahsil Makbuzu'
              END
            WHEN 5 THEN
              CASE TRCODE
                WHEN 1  THEN 'Nakit Tahsilat'
                WHEN 2  THEN 'Nakit Ödeme'
                WHEN 3  THEN 'Borç Dekontu'
                WHEN 4  THEN 'Alacak Dekontu'
                WHEN 5  THEN 'Virman Fişi'
                WHEN 6  THEN 'Kur Farkı İşlemi'
                WHEN 12 THEN 'Özel Fiş'
                WHEN 14 THEN 'Açılış Fişi'
                WHEN 41 THEN 'Verilen Vade Farkı Faturası'
                WHEN 42 THEN 'Alınan Vade Farkı Faturası'
                WHEN 45 THEN 'Verilen Serbest Meslek Makbuzu'
                WHEN 46 THEN 'Alınan Serbest Meslek Makbuzu'
                WHEN 70 THEN 'Kredi Kartı Fişi'
                WHEN 71 THEN 'Kredi Kartı İade Fişi'
                WHEN 72 THEN 'Firma Kredi Kartı Fişi'
                WHEN 73 THEN 'Firma Kredi Kartı İade Fişi'
              END
            WHEN 6 THEN
              CASE TRCODE
                WHEN 61 THEN 'Çek Girişi'
                WHEN 62 THEN 'Senet Girişi'
                WHEN 63 THEN 'Çek Çıkışı(Cari Hesaba)'
                WHEN 64 THEN 'Senet Çıkışı(Cari Hesaba)'
                WHEN 65 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Çeki)'
                WHEN 66 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Seneti)'
              END
            WHEN 7 THEN
              CASE TRCODE
                WHEN 20 THEN 'Gelen Havale/EFT'
                WHEN 21 THEN 'Gönderilen Havale/EFT'
                WHEN 24 THEN 'Döviz Alış Belgesi'
                WHEN 28 THEN 'Alınan Hizmet Faturası'
                WHEN 29 THEN 'Verilen Hizmet Faturası'
                WHEN 30 THEN 'Müstahsil Makbuzu'
              END
            WHEN 10 THEN
              CASE TRCODE
                WHEN 1 THEN 'Nakit Tahsilat'
                WHEN 2 THEN 'Nakit Ödeme'
              END
            ELSE 'Diğer'
          END AS [Fiş Türü],
          LINEEXP AS [Açıklama],
          CASE 
            WHEN SIGN=0 THEN 
              CASE TRCURR
                WHEN 0 THEN AMOUNT  -- TL ise TL tutarı
                ELSE TRNET          -- Başka döviz ise orijinal döviz tutarı
              END
            WHEN SIGN=1 THEN 0
          END AS [Borç],
          CASE 
            WHEN SIGN=0 THEN 0
            WHEN SIGN=1 THEN 
              CASE TRCURR
                WHEN 0 THEN AMOUNT  -- TL ise TL tutarı
                ELSE TRNET          -- Başka döviz ise orijinal döviz tutarı
              END
          END AS [Alacak],
          CASE TRCURR
            WHEN 0 THEN 'TL'
            WHEN 1 THEN 'USD'
            WHEN 20 THEN 'EURO'
          END AS [Döviz],
          TRRATE [Kur],
          AMOUNT [Tutar(TL)],
          CASE CANCELLED
            WHEN 0 THEN 'İptal Edilmemiş'
            WHEN 1 THEN 'İptal Edilmiş'
          END AS [İptal Durumu]
        FROM LG_${firmaNo}_${donemNo}_CLFLINE CLFLINE
        WHERE CLIENTREF = ${clientRef}
        ${(() => {
          const selectedTRCURRValues = getSelectedTRCURRValues();
          if (selectedTRCURRValues.length > 0) {
            return `AND TRCURR IN (${selectedTRCURRValues.join(',')})`;
          }
          return '';
        })()}
        ORDER BY DATE_ + [dbo].[fn_LogoTimetoSystemTime](FTIME) ASC
      `;

      // CompanyRef'i al
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        alert('Şirket bilgisi bulunamadı. Lütfen sayfayı yenileyin.');
        return;
      }
      
      // Proxy üzerinden istek gönder - Retry logic ile
      let response: Response | undefined;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Müşteri detay proxy çağrısı deneme ${attempt}/${maxRetries}...`);
          
          // Debug: Gönderilen payload'u logla
          const requestPayload = {
            companyRef: companyRef,
            connectionType: 'first_db_key', // Cari bakiye için first database kullan
            payload: {
              query: detailQuery
            }
          };
          console.log('🚀 Table Backend\'e gönderilen payload:', requestPayload);
          console.log('📋 CompanyRef değeri:', companyRef);
          console.log('🔑 ConnectionType değeri:', 'first_db_key');
          
          response = await sendSecureProxyRequest(
            companyRef,
            'first_db_key', // Cari bakiye için first database kullan
            {
              query: detailQuery
            }
          );
          
          if (response.ok) {
            console.log(`✅ Müşteri detay çağrısı ${attempt}. denemede başarılı`);
            break; // Başarılı, döngüden çık
          } else if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız - HTTP ${response.status}`);
          } else {
            console.log(`⚠️ Deneme ${attempt} başarısız (${response.status}), tekrar denenecek...`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 1 saniye bekle
          }
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız:`, error);
            throw error;
          } else {
            console.log(`⚠️ Deneme ${attempt} hata aldı, tekrar denenecek:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
          }
        }
      }

      if (!response) {
        throw new Error('Response alınamadı');
      }

      const result = await response.json();

      if (response.ok && (result.success || result.status === 'success')) {
        setClientDetails(result.data || []);
        console.log(`📋 ${result.data?.length || 0} adet müşteri hareketi yüklendi`);
      } else {
        console.error('Detay sorgusu hatası:', result);
        alert('Müşteri detayları yüklenirken hata oluştu: ' + (result.error || 'Bilinmeyen hata'));
        setClientDetails([]);
      }
    } catch (error) {
      console.error('Detay fetch hatası:', error);
      alert('Müşteri detayları yüklenirken hata oluştu.');
      setClientDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Detayları kapat
  const closeDetails = () => {
    setShowDetails(false);
    setSelectedClientRef(null);
    setClientDetails([]);
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
            th { background-color: #1f2937 !important; color: white !important; font-weight: bold; font-size: 9px; border: 1px solid #000 !important; }
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
              th { background-color: #000000 !important; color: white !important; font-weight: bold !important; border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

  // Müşteri detayları Excel export fonksiyonu
  const exportClientDetailsToExcel = () => {
    try {
      if (!clientDetails || clientDetails.length === 0) {
        alert('İndirilecek müşteri hareketi bulunamadı.');
        return;
      }

      // Müşteri bilgilerini al
      const clientName = data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.['Cari Ünvanı'] || data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.ÜNVANI || 'Müşteri';

      const clientCode = data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.['Cari Kodu'] || data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.KODU || selectedClientRef;

      // Excel verisini hazırla
      const exportData = clientDetails.map(detail => ({
        'Tarih': detail.Tarih ? new Date(detail.Tarih).toLocaleDateString('tr-TR') : '',
        'Fiş No': detail['Fiş No'] || '',
        'Fiş Türü': detail['Fiş Türü'] || '',
        'Açıklama': detail.Açıklama || '',
        'Borç': detail.Borç && detail.Borç !== '0,00' ? 
          `${safeParseFloat(detail.Borç).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        'Alacak': detail.Alacak && detail.Alacak !== '0,00' ? 
          `${safeParseFloat(detail.Alacak).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        'Döviz': detail.Döviz || '',
        'Kur': detail.Döviz !== 'TL' && detail.Kur && detail.Kur > 0 ? 
          safeParseFloat(detail.Kur).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '',
        'Tutar (TL)': detail['Tutar(TL)'] ? 
          `${safeParseFloat(detail['Tutar(TL)']).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '',
        'İptal Durumu': detail['İptal Durumu'] || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Müşteri Hareketleri');

      // Sütun genişliklerini ayarla
      const columnWidths = [
        { wch: 12 }, // Tarih
        { wch: 15 }, // Fiş No
        { wch: 30 }, // Fiş Türü
        { wch: 40 }, // Açıklama
        { wch: 15 }, // Borç
        { wch: 15 }, // Alacak
        { wch: 8 },  // Döviz
        { wch: 12 }, // Kur
        { wch: 15 }, // Tutar
        { wch: 15 }  // İptal Durumu
      ];
      worksheet['!cols'] = columnWidths;

      // Dosyayı indir
      const fileName = `Musteri_Hareketleri_${clientCode}_${new Date().toLocaleDateString('tr-TR').replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Müşteri detayları Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  // Müşteri detayları PDF export fonksiyonu
  const exportClientDetailsToPDF = () => {
    try {
      if (!clientDetails || clientDetails.length === 0) {
        alert('Yazdırılacak müşteri hareketi bulunamadı.');
        return;
      }

      // Müşteri bilgilerini al
      const clientName = data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.['Cari Ünvanı'] || data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.ÜNVANI || 'Müşteri';

      const clientCode = data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.['Cari Kodu'] || data.find(row => 
        (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
      )?.KODU || selectedClientRef;

      // Yazdırma için HTML oluştur
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle PDF yazdırma penceresi açılamıyor.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Müşteri Hesap Hareketleri - ${clientCode}</title>
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
            
            .client-info { background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #991b1b; }
            .client-info h3 { margin: 0 0 5px 0; color: #991b1b; font-size: 16px; }
            .client-info p { margin: 2px 0; color: #374151; font-size: 12px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color:rgb(102, 0, 0) !important; color: white !important; font-weight: bold; font-size: 9px; border: 1px solid #000 !important; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .center { text-align: center; }
            @media print {
              body { margin: 0; font-size: 10px; }
              .pdf-info { display: none; }
              table { font-size: 8px; }
              th, td { padding: 3px; }
              th { background-color: rgb(102, 0, 0)!important; color: white !important; font-weight: bold !important; border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
                <h1>MÜŞTERİ HESAP HAREKETLERİ</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                <p><strong>Toplam Hareket:</strong> ${clientDetails.length} adet</p>
              </div>
            </div>
          </div>
          
          <div class="pdf-info">
            <strong>📄 PDF Olarak Kaydetmek İçin:</strong><br>
            Yazdırma diyaloğunda "Hedef" kısmından <strong>"PDF olarak kaydet"</strong> seçeneğini seçin.
          </div>
          
          <div class="client-info">
            <h3>👤 MÜŞTERİ BİLGİLERİ</h3>
            <p><strong>Müşteri Kodu:</strong> ${clientCode}</p>
            <p><strong>Müşteri Ünvanı:</strong> ${clientName}</p>
          </div>
          
          <h3 style="color: #991b1b; margin: 20px 0 10px 0; font-size: 14px; border-bottom: 2px solid #991b1b; padding-bottom: 5px;">DETAYLI HAREKET LİSTESİ</h3>
          
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Fiş No</th>
                <th>Fiş Türü</th>
                <th>Açıklama</th>
                <th>Borç</th>
                <th>Alacak</th>
                <th>Döviz</th>
                <th>Kur</th>
                <th>Tutar (TL)</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${clientDetails.map(detail => `
                <tr>
                  <td class="center">${detail.Tarih ? new Date(detail.Tarih).toLocaleDateString('tr-TR') : '-'}</td>
                  <td>${detail['Fiş No'] || '-'}</td>
                  <td>${detail['Fiş Türü'] || '-'}</td>
                  <td>${detail.Açıklama || '-'}</td>
                  <td class="number currency">${detail.Borç && detail.Borç !== '0,00' ? 
                    `${safeParseFloat(detail.Borç).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                  <td class="number currency">${detail.Alacak && detail.Alacak !== '0,00' ? 
                    `${safeParseFloat(detail.Alacak).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                  <td class="center">${detail.Döviz || '-'}</td>
                  <td class="number">${detail.Döviz !== 'TL' && detail.Kur && detail.Kur > 0 ? 
                    safeParseFloat(detail.Kur).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-'}</td>
                  <td class="number currency">${detail['Tutar(TL)'] ? 
                    `${safeParseFloat(detail['Tutar(TL)']).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '-'}</td>
                  <td class="center">${detail['İptal Durumu'] === 'İptal Edilmiş' ? '❌' : '✅'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde BT Rapor sistemi tarafından otomatik olarak oluşturulmuştur. 
            Müşteri: ${clientName} (${clientCode}). Toplam ${clientDetails.length} hareket listelenmektedir.
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
      console.error('Müşteri detayları PDF yazdırma hatası:', error);
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
            th { background-color: #1f2937 !important; color: white !important; font-weight: bold; font-size: 9px; border: 1px solid #000 !important; }
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
               th { background-color: #000000 !important; color: white !important; font-weight: bold !important; border: 1px solid #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    // Kategori bazlı sayısal aralık filtresi
    if (filterColumn && (minValue || maxValue)) {
      // Gelişmiş parse fonksiyonu - formatlanmış para değerleri ve (A)/(B) göstergeleri için
      const parseFilterValue = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0;
        
        if (typeof value === 'string') {
          let numStr = value;
          
          // (A) ve (B) göstergeli bakiye değerleri için
          if (value.includes('(A)')) {
            // Alacaklı - negatif değer olarak kabul et
            numStr = value.replace(/[^\d.,]/g, '');
            if (numStr) {
              numStr = numStr.replace(/\./g, '').replace(',', '.');
              return -safeParseFloat(numStr);
            }
            return 0;
          } else if (value.includes('(B)')) {
            // Borçlu - pozitif değer olarak kabul et
            numStr = value.replace(/[^\d.,]/g, '');
            if (numStr) {
              numStr = numStr.replace(/\./g, '').replace(',', '.');
              return safeParseFloat(numStr);
            }
            return 0;
          }
          
          // Türkçe format: "1.234.567,89" -> 1234567.89
          // Nokta binlik ayırıcı, virgül ondalık ayırıcı
          if (numStr.includes('.') && numStr.includes(',')) {
            // Hem nokta hem virgül var: "1.234,56"
            numStr = numStr.replace(/\./g, '').replace(',', '.');
          } else if (numStr.includes(',') && !numStr.includes('.')) {
            // Sadece virgül var: "1234,56"
            numStr = numStr.replace(',', '.');
          } else if (numStr.includes('.') && !numStr.includes(',')) {
            // Sadece nokta var - bu ondalık ayırıcı mı yoksa binlik ayırıcı mı?
            const parts = numStr.split('.');
            if (parts.length === 2 && parts[1].length <= 2) {
              // Son kısım 2 haneli veya daha az: ondalık ayırıcı
              // Hiçbir şey yapma
            } else {
              // Binlik ayırıcı olarak varsay
              numStr = numStr.replace(/\./g, '');
            }
          }
          
          return safeParseFloat(numStr);
        }
        
        return safeParseFloat(value);
      };
      
      // Seçilen kategoriye ait tüm sütunları kontrol et
      const categoryColumns = getColumnsByCategory(filterColumn);
      
      if (categoryColumns.length === 0) return true; // Kategori sütunu bulunamadıysa geçir
      
      // Bu satırda seçilen kategorinin herhangi bir sütununda filtreye uyan değer var mı?
      const matchesFilter = categoryColumns.some(column => {
        const columnValue = item[column];
        if (columnValue === null || columnValue === undefined) return false;
        
        const itemValue = parseFilterValue(columnValue);
        const min = minValue ? parseFloat(minValue) : -Infinity;
        const max = maxValue ? parseFloat(maxValue) : Infinity;
        
        // NaN kontrolü
        if (isNaN(itemValue)) return false;
        
        return itemValue >= min && itemValue <= max;
      });
      
      return matchesFilter;
    }
    return true;
  });

  // Sıralama fonksiyonu
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;
    
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    // Sayısal değerler için - hem eski format hem de multi-currency format
    const isNumericColumn = sortColumn === 'BORÇ' || sortColumn === 'ALACAK' || 
                           sortColumn === 'BAKİYE' || sortColumn === 'BAKIYE' || 
                           sortColumn?.includes('BAKIYE') || sortColumn?.includes('BAKİYE') ||
                           sortColumn?.includes('_Borç') || sortColumn?.includes('_Alacak') || 
                           sortColumn?.includes('_Bakiye') || sortColumn?.includes('Borç') || 
                           sortColumn?.includes('Alacak') || sortColumn?.includes('Bakiye');
    
    if (isNumericColumn) {
      // Özel parse fonksiyonu - (A) ve (B) ile birlikte gelen değerleri de işler
      const parseNumericValue = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0;
        
        if (typeof value === 'string') {
          // (A) ve (B) göstergeli bakiye değerleri için
          if (value.includes('(A)')) {
            // Alacaklı - negatif değer
            const numStr = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            return -safeParseFloat(numStr);
          } else if (value.includes('(B)')) {
            // Borçlu - pozitif değer
            const numStr = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            return safeParseFloat(numStr);
          } else {
            // Normal sayısal değer
            const numStr = value.replace(/\./g, '').replace(',', '.');
            return safeParseFloat(numStr);
          }
        }
        
        return safeParseFloat(value);
      };
      
      const aNum = parseNumericValue(aValue);
      const bNum = parseNumericValue(bValue);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    // String değerler için
    const aStr = String(aValue || '').toLocaleLowerCase('tr-TR');
    const bStr = String(bValue || '').toLocaleLowerCase('tr-TR');
    
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

  // Pagination değişikliklerini parent'a bildir
  useEffect(() => {
    if (onPageChange) {
      // Debounce ile sürekli tetiklenmeyi önle
      const timeoutId = setTimeout(() => {
        // Mevcut sayfadaki veriyi hesapla
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentPageData = sortedData.slice(startIndex, endIndex);
        
        // Parent'a bildir
        onPageChange(currentPageData, currentPage, itemsPerPage);
      }, 100); // 100ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [currentPage, itemsPerPage, sortedData.length, onPageChange]);

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
    setCurrentPage(1); // Filtreler temizlendiğinde 1. sayfaya dön
    console.log('🧹 Tüm filtreler temizlendi - 1. sayfaya dönüldü');
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

  // Modern sayfa numaralarını oluştur
  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      // 7 sayfa veya daha az - hepsini göster
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 7'den fazla sayfa - akıllı ellipsis sistemi
      if (currentPage <= 4) {
        // Başta: 1 2 3 4 5 ... 10
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Sonda: 1 ... 6 7 8 9 10
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        // Ortada: 1 ... 4 5 6 ... 10
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    
    return pages;
  };

  // Sayfa değiştirme fonksiyonu
  const handlePageClick = (page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      console.log(`🎯 Sayfa ${page}'e gidildi`);
    }
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
            🔍 Metin Arama
          </label>
          <div className="relative">
            <input
              id="search"
              type="text"
              placeholder="Firma adı, cari kodu veya herhangi bir değer arayın..."
              className="w-full p-3 pl-10 border-2 border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-600"
                title="Aramayı temizle"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <strong>Arama İpuçları:</strong> &quot;m*&quot; (m ile başlayanlar) • &quot;*m&quot; (m ile bitenler) • &quot;a*z&quot; (a-z arası) • Normal metin arama da yapılabilir
          </div>
        </div>
        
        {/* Gelişmiş Filtreler */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">💰 Sayısal Filtreler</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Parametre
                </label>
                <select
                  value={filterColumn}
                  onChange={(e) => {
                    setFilterColumn(e.target.value);
                    // Kategori değiştiğinde min/max değerleri temizle
                    if (e.target.value !== filterColumn) {
                      setMinValue('');
                      setMaxValue('');
                    }
                  }}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                >
                  <option value="">📊 Kategori seçiniz</option>
                  {filterCategories.map((category) => {
                    const categoryColumns = getColumnsByCategory(category);
                    return (
                      <option key={category} value={category} disabled={categoryColumns.length === 0}>
                        {category === 'Borç' ? '🔴 ' : category === 'Alacak' ? '🟢 ' : '⚖️ '}
                        {category}
                        {categoryColumns.length > 0 ? ` (${categoryColumns.length} sütun)` : ' (yok)'}
                      </option>
                    );
                  })}
                </select>
                {filterColumn && (
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>{filterColumn}</strong> kategorisinde {getColumnsByCategory(filterColumn).length} sütun var: {getColumnsByCategory(filterColumn).join(', ') || 'Hiçbiri'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Min Değer
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Minimum..."
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  disabled={!filterColumn}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {filterColumn ? 'Negatif değer: (A) bakiye' : 'Önce sütun seçin'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Max Değer
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Maksimum..."
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  disabled={!filterColumn}
                  className="w-full p-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {filterColumn ? 'Pozitif değer: (B) bakiye' : 'Önce sütun seçin'}
                </p>
              </div>
              
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                  title="Tüm filtreleri temizle"
                >
                  🧹 Temizle
                </button>
              </div>
            </div>
            
            {/* Gelişmiş Filtre Bilgisi */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
              <p className="font-medium mb-1">ℹ️ Kategori Filtreleme İpuçları:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li><strong>🔴 Borç:</strong> Tüm kur türlerindeki borç sütunlarını kapsar (TRY_Borç, USD_Borç, EUR_Borç vb.)</li>
                <li><strong>🟢 Alacak:</strong> Tüm kur türlerindeki alacak sütunlarını kapsar (TRY_Alacak, USD_Alacak, EUR_Alacak vb.)</li>
                <li><strong>⚖️ Bakiye:</strong> Tüm kur türlerindeki bakiye sütunlarını kapsar - Negatif: (A), Pozitif: (B)</li>
                <li><strong>Para formatları:</strong> "1.234,56" ve "1234,56" formatları desteklenir</li>
                <li><strong>Örnek Borç filtresi:</strong> Min: 1000 → Herhangi bir kurda 1000+ borcu olan müşteriler</li>
                <li><strong>Örnek Bakiye filtresi:</strong> Min: -5000, Max: 0 → Alacaklı olan müşteriler</li>
              </ul>
            </div>
            
            {/* Aktif Filtre Göstergesi */}
            {(filterColumn && (minValue || maxValue)) && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-700">
                    <strong>🎯 Aktif Filtre:</strong> {filterColumn}
                    {minValue && ` ≥ ${parseFloat(minValue).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    {minValue && maxValue && ' ve '}
                    {maxValue && ` ≤ ${parseFloat(maxValue).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                    {filteredData.length} sonuç
                  </span>
                </div>
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
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        console.log('🔍 Row keys:', Object.keys(row));
                        console.log('🔍 Row data:', row);
                        const clientRef = row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref || '';
                        const clientName = row.ÜNVANI || row['Cari Ünvanı'] || row.unvani || 'Müşteri';
                        console.log('🔍 ClientRef:', clientRef);
                        console.log('🔍 ClientName:', clientName);
                        if (clientRef) {
                          fetchClientDetails(clientRef, clientName);
                        } else {
                          alert('Müşteri referansı bulunamadı!');
                        }
                      }}
                      className={`transition-colors ${
                        preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] 
                          ? 'text-green-600 hover:text-green-800' 
                          : 'text-gray-600 hover:text-red-800'
                      }`}
                      title={
                        preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] 
                          ? `Hazır! ${preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref]?.length || 0} hareket`
                          : 'Detayları görüntüle (API çağrısı yapılacak)'
                      }
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    {/* Hazır data göstergesi */}
                    {preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Hareket detayları hazır"></div>
                    )}
                  </div>
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
        {paginatedData.map((row, index) => {
          // Multi-currency sütunları dinamik olarak bul
          const borcColumns = Object.entries(row).filter(([key]) => 
            key === 'BORÇ' || key === 'Borç' || key.includes('_Borç') || key.endsWith('_Borç')
          );
          const alacakColumns = Object.entries(row).filter(([key]) => 
            key === 'ALACAK' || key === 'Alacak' || key.includes('_Alacak') || key.endsWith('_Alacak')
          );
          const bakiyeColumns = Object.entries(row).filter(([key]) => 
            key === 'BAKİYE' || key === 'BAKIYE' || key === 'Bakiye' ||
            key.includes('_Bakiye') || key.endsWith('_Bakiye') ||
            key.includes('BAKIYE') || key.includes('BAKİYE')
          );
          
          // Müşteri bilgileri
          const clientCode = row['Cari Kodu'] || row.KODU || row.CODE || row.code || '';
          const clientName = row['Cari Ünvanı'] || row.ÜNVANI || row.DEFINITION_ || row.definition || '';
          
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {/* Müşteri Başlığı */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-700 mb-1">
                    {String(clientCode)}
                  </h3>
                  <p className="text-gray-700 text-sm leading-tight">
                    {String(clientName)}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 ml-2">
                  <button
                    onClick={() => {
                      const clientRef = row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref || '';
                      if (clientRef) {
                        fetchClientDetails(clientRef, clientName);
                      } else {
                        alert('Müşteri referansı bulunamadı!');
                      }
                    }}
                    className={`transition-colors p-2 rounded-lg ${
                      preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] 
                        ? 'text-green-600 hover:text-green-800 bg-green-50' 
                        : 'text-gray-600 hover:text-red-800 bg-gray-50'
                    }`}
                    title={
                      preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] 
                        ? `Hazır! ${preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref]?.length || 0} hareket`
                        : 'Detayları görüntüle'
                    }
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 616 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  
                  {/* Hazır data göstergesi */}
                  {preloadedDetails[row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref] && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Hareket detayları hazır"></div>
                  )}
                </div>
              </div>
              
              {/* Multi-Currency Borç/Alacak Grid */}
              {(borcColumns.length > 0 || alacakColumns.length > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Borç Sütunları */}
                  <div className="bg-red-50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-red-700 mb-2">
                      BORÇ
                    </h4>
                    {borcColumns.length > 0 ? (
                      <div className="space-y-1">
                        {borcColumns.map(([key, value]) => {
                          const currencyCode = key.replace('_Borç', '').replace('Borç', '').replace('BORÇ', '') || 'TRY';
                          return (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-xs text-red-600 font-medium">{currencyCode}:</span>
                              <span className="text-sm font-bold text-red-800">
                                {typeof value === 'string' && (value.includes('.') || value.includes(',')) ? 
                                  value : formatCurrency(safeParseFloat(value))
                                }
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">₺0,00</p>
                    )}
                  </div>
                  
                  {/* Alacak Sütunları */}
                  <div className="bg-green-50 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-green-700 mb-2">
                      ALACAK
                    </h4>
                    {alacakColumns.length > 0 ? (
                      <div className="space-y-1">
                        {alacakColumns.map(([key, value]) => {
                          const currencyCode = key.replace('_Alacak', '').replace('Alacak', '').replace('ALACAK', '') || 'TRY';
                          return (
                            <div key={key} className="flex justify-between items-center">
                              <span className="text-xs text-green-600 font-medium">{currencyCode}:</span>
                              <span className="text-sm font-bold text-green-800">
                                {typeof value === 'string' && (value.includes('.') || value.includes(',')) ? 
                                  value : formatCurrency(safeParseFloat(value))
                                }
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">₺0,00</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Multi-Currency Bakiye */}
              {bakiyeColumns.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    NET BAKİYE
                  </h4>
                  <div className="space-y-2">
                    {bakiyeColumns.map(([key, value]) => {
                      const currencyCode = key.replace('_Bakiye', '').replace('Bakiye', '').replace('BAKIYE', '').replace('BAKİYE', '') || 'TRY';
                      
                      // Bakiye değeri analizi
                      let displayValue = '';
                      let colorClass = 'text-gray-900';
                      
                      if (typeof value === 'string') {
                        displayValue = value;
                        if (value.includes('(A)')) {
                          colorClass = 'text-red-600';
                        } else if (value.includes('(B)')) {
                          colorClass = 'text-green-600';
                        }
                      } else {
                        const numValue = safeParseFloat(value);
                        const formattedCurrency = formatCurrency(Math.abs(numValue));
                        
                        if (numValue === 0) {
                          displayValue = formattedCurrency;
                          colorClass = 'text-gray-900';
                        } else {
                          const indicator = numValue < 0 ? '(A)' : '(B)';
                          displayValue = `${formattedCurrency} ${indicator}`;
                          colorClass = numValue < 0 ? 'text-red-600' : 'text-green-600';
                        }
                      }
                      
                      return (
                        <div key={key} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                          <span className="text-sm font-medium text-gray-700">{currencyCode}:</span>
                          <span className={`font-bold text-base ${colorClass}`}>
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Fallback - Eğer hiç veri yoksa */}
              {borcColumns.length === 0 && alacakColumns.length === 0 && bakiyeColumns.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">Veri bulunamadı</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modern Sayfalama */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          {/* Sol: Sayfa Başına Kayıt */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 font-medium">Göster:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="rounded-lg border-gray-300 py-1.5 pl-3 pr-8 text-sm focus:border-red-500 focus:ring-red-500 bg-white shadow-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">kayıt</span>
            </div>
            
            <div className="hidden sm:flex items-center text-sm text-gray-700">
              <span className="font-medium">{sortedData.length}</span>
              <span className="ml-1">sonuç bulundu</span>
            </div>
          </div>

          {/* Orta: Modern Sayfa Numaraları */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* İlk Sayfa */}
              <button
                onClick={() => handlePageClick(1)}
                disabled={currentPage === 1}
                className="inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="İlk sayfa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Önceki Sayfa */}
              <button
                onClick={() => handlePageClick(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border-t border-b border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Önceki sayfa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Sayfa Numaraları */}
              {generatePageNumbers().map((page, index) => {
                if (page === '...') {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border-t border-b border-gray-300"
                    >
                      ...
                    </span>
                  );
                }

                const pageNum = page as number;
                const isActive = pageNum === currentPage;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageClick(pageNum)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium border-t border-b border-gray-300 transition-colors ${
                      isActive
                        ? 'z-10 bg-red-50 border-red-500 text-red-600 font-semibold'
                        : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={`Sayfa ${pageNum}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Sonraki Sayfa */}
              <button
                onClick={() => handlePageClick(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border-t border-b border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Sonraki sayfa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Son Sayfa */}
              <button
                onClick={() => handlePageClick(totalPages)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Son sayfa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Sağ: Sayfa Bilgisi */}
          <div className="flex flex-col sm:flex-row items-center gap-2 text-sm text-gray-700">
            <div className="flex items-center gap-1">
              <span>Sayfa</span>
              <span className="font-semibold text-red-600">{currentPage}</span>
              <span>/</span>
              <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="sm:hidden text-xs text-gray-500">
              {sortedData.length} sonuç
            </div>
          </div>
        </div>
      </div>

      {/* Müşteri Detay Modal Pop-up */}
      {showDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeDetails}
          ></div>
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
            <div className="relative w-full max-w-[98vw] xl:max-w-[90vw] bg-white rounded-lg shadow-xl">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-800 to-red-900 text-white p-6 rounded-t-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold">📋 Müşteri Hesap Hareketleri</h3>
                    <p className="text-red-100 text-sm mt-2">
                      Müşteri Kodu: {selectedClientRef} {clientDetails.length > 0 && `• ${clientDetails.length} hareket bulundu`}
                      {(() => {
                        const selectedTRCURRValues = getSelectedTRCURRValues();
                        if (selectedTRCURRValues.length > 0) {
                          const currencyNames = selectedTRCURRValues.map(trcurr => {
                            switch(trcurr) {
                              case 0: return 'TL';
                              case 1: return 'USD';
                              case 20: return 'EUR';
                              default: return `Kur-${trcurr}`;
                            }
                          });
                          return ` • Sadece: ${currencyNames.join(', ')}`;
                        }
                        return ' • Tüm kurlar';
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Excel Export Button - Dikkat Çekici */}
                    <button
                      onClick={() => exportClientDetailsToExcel()}
                      disabled={loadingDetails || clientDetails.length === 0}
                      className="bg-green-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-400 hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-2 border-green-300 shadow-md"
                      title="Müşteri hareketlerini Excel'e aktar"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z"/>
                          <path d="M9 9h6v6H9V9zm1 1v4h4v-4h-4z"/>
                        </svg>
                        <span className="text-sm font-bold">EXCEL</span>
                      </div>
                    </button>

                    {/* PDF Export Button - Dikkat Çekici */}
                    <button
                      onClick={() => exportClientDetailsToPDF()}
                      disabled={loadingDetails || clientDetails.length === 0}
                      className="bg-blue-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-400 hover:shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-2 border-blue-300 shadow-md"
                      title="Müşteri hareketlerini PDF'e aktar"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span className="text-sm font-bold">YAZDIR/PDF</span>
                      </div>
                    </button>

                    {/* Refresh Button */}
                    <button
                      onClick={() => {
                        if (selectedClientRef) {
                          const clientName = data.find(row => 
                            (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
                          )?.['Cari Ünvanı'] || data.find(row => 
                            (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
                          )?.ÜNVANI || 'Müşteri';
                                                     console.log(`🔄 Modal'dan yenile tıklandı - ClientRef: ${selectedClientRef}`);
                           fetchClientDetails(selectedClientRef, clientName, true); // Cache bypass ile yenile
                        }
                      }}
                      disabled={loadingDetails}
                      className="text-white hover:text-red-200 transition-colors p-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Hareketleri yenile (Veritabanından güncel veri çek)"
                    >
                      <svg className={`w-6 h-6 ${loadingDetails ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={closeDetails}
                      className="text-white hover:text-red-200 transition-colors p-2 rounded-lg hover:bg-red-700"
                      title="Detayları kapat"
                    >
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-3 sm:p-6 max-h-[80vh] overflow-y-auto">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    {loadingAnimation && (
                      <Lottie 
                        animationData={loadingAnimation} 
                        style={{ width: 120, height: 120 }}
                        loop={true}
                      />
                    )}
                    <span className="text-gray-700 font-medium text-xl mt-4">Müşteri hareketleri yükleniyor...</span>
                    <span className="text-gray-500 text-sm mt-2">Lütfen bekleyin, veriler getiriliyor</span>
                  </div>
                ) : clientDetails.length > 0 ? (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full min-w-[800px] divide-y divide-gray-200">
                          <thead className="bg-gray-800">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-24">Tarih</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-28">Fiş No</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-40">Fiş Türü</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider w-60">Açıklama</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider w-24">Borç</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider w-24">Alacak</th>
                              <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-16">Döviz</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider w-20">Kur</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider w-20">Tutar</th>
                              <th className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider w-20">Durum</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {clientDetails.map((detail, index) => (
                              <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-red-50 transition-colors`}>
                                <td className="px-3 py-3 text-sm text-gray-900 font-medium w-24">
                                  <div className="text-xs leading-tight">
                                    {detail.Tarih ? new Date(detail.Tarih).toLocaleDateString('tr-TR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit'
                                    }) : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-blue-700 font-semibold w-20">
                                  <div className="text-xs break-all">
                                    {detail['Fiş No']}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-700 w-40">
                                  <div className="text-xs leading-tight break-words">
                                    {detail['Fiş Türü']}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-gray-600 w-60">
                                  <div className="text-xs leading-tight break-words max-h-12 overflow-hidden" title={detail.Açıklama}>
                                    {detail.Açıklama || '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-right font-bold text-gray-900 w-24">
                                  <div className="text-xs">
                                    {detail.Borç && detail.Borç !== '0,00' ? 
                                      `${safeParseFloat(detail.Borç).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                      : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-right font-bold text-gray-900 w-24">
                                  <div className="text-xs">
                                    {detail.Alacak && detail.Alacak !== '0,00' ? 
                                      `${safeParseFloat(detail.Alacak).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                      : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-center w-16">
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    detail.Döviz === 'TL' ? 'bg-red-100 text-red-800' :
                                    detail.Döviz === 'USD' ? 'bg-green-100 text-green-800' :
                                    detail.Döviz === 'EURO' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {detail.Döviz}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-sm text-right font-bold text-gray-700 w-20">
                                  <div className="text-xs">
                                    {detail.Döviz !== 'TL' && detail.Kur && detail.Kur > 0 ? 
                                      safeParseFloat(detail.Kur).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                                      : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-right font-bold text-gray-900 w-20">
                                  <div className="text-xs">
                                    {detail['Tutar(TL)'] ? 
                                      `${safeParseFloat(detail['Tutar(TL)']).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                                      : '-'}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-sm text-center w-20">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    detail['İptal Durumu'] === 'İptal Edilmiş' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {detail['İptal Durumu'] === 'İptal Edilmiş' ? '❌' : '✅'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile/Tablet Card View */}
                    <div className="lg:hidden space-y-4">
                      {clientDetails.map((detail, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3 pb-3 border-b border-gray-100">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg font-bold text-blue-700">#{detail['Fiş No']}</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  detail['İptal Durumu'] === 'İptal Edilmiş' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {detail['İptal Durumu'] === 'İptal Edilmiş' ? '❌ İptal' : '✅ Aktif'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {detail.Tarih ? new Date(detail.Tarih).toLocaleDateString('tr-TR') : ''}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                detail.Döviz === 'TL' ? 'bg-red-100 text-red-800' :
                                detail.Döviz === 'USD' ? 'bg-green-100 text-green-800' :
                                detail.Döviz === 'EURO' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {detail.Döviz}
                              </span>
                              {detail.Döviz !== 'TL' && detail.Kur && detail.Kur > 0 && (
                                <span className="text-xs text-gray-500">
                                  Kur: {safeParseFloat(detail.Kur).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Fiş Türü - Full Width */}
                          <div className="mb-3">
                            <p className="text-xs text-gray-600 mb-1">FİŞ TÜRÜ</p>
                            <p className="text-sm font-medium text-gray-700">
                              {detail['Fiş Türü']}
                            </p>
                          </div>

                          {/* Açıklama - Full Width */}
                          {detail.Açıklama && detail.Açıklama !== '-' && (
                            <div className="mb-3">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1">AÇIKLAMA</p>
                                <p className="text-sm text-gray-800 break-words">
                                  {detail.Açıklama}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Amount Row */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-red-50 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">BORÇ ({detail.Döviz})</p>
                              <p className="text-lg font-bold text-red-800">
                                {detail.Borç && detail.Borç !== '0,00' ? 
                                  `${safeParseFloat(detail.Borç).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                  : '-'}
                              </p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">ALACAK ({detail.Döviz})</p>
                              <p className="text-lg font-bold text-green-800">
                                {detail.Alacak && detail.Alacak !== '0,00' ? 
                                  `${safeParseFloat(detail.Alacak).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                                  : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Tutar Row */}
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-gray-600 mb-1">TUTAR (TL)</p>
                            <p className="text-lg font-bold text-blue-800">
                              {detail['Tutar(TL)'] ? 
                                `${safeParseFloat(detail['Tutar(TL)']).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
                                : '-'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20">
                    <svg className="mx-auto h-20 w-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-6 text-xl font-medium text-gray-900">Hareket bulunamadı</h3>
                    <p className="mt-3 text-base text-gray-500">Bu müşteri için herhangi bir hesap hareketi bulunmuyor.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 rounded-b-lg">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {clientDetails.length > 0 && (
                      <span>Toplam {clientDetails.length} hareket • En eski tarihten en yeniye sıralı</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (selectedClientRef) {
                          const clientName = data.find(row => 
                            (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
                          )?.['Cari Ünvanı'] || data.find(row => 
                            (row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref) === selectedClientRef
                          )?.ÜNVANI || 'Müşteri';
                          fetchClientDetails(selectedClientRef, clientName, true); // Cache bypass ile yenile
                        }
                      }}
                      disabled={loadingDetails}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className={`w-4 h-4 ${loadingDetails ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {loadingDetails ? 'Yenileniyor...' : 'Yenile'}
                    </button>
                    <button
                      onClick={closeDetails}
                      className="px-6 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors font-medium"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 