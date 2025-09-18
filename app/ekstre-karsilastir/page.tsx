'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import ExcelUploader from '../components/ExcelUploader';
import { sendSecureProxyRequest } from '../utils/api';

interface Customer {
  logicalRef: number;
  code: string;
  definition: string;
  specode?: string;
  specodeDefinition?: string;
  specode2?: string;
  specode2Definition?: string;
  specode3?: string;
  specode3Definition?: string;
  specode4?: string;
  specode4Definition?: string;
  specode5?: string;
  specode5Definition?: string;
  taxNumber?: string;
  phone1?: string;
  phone2?: string;
  faxNumber?: string;
  emailAddress?: string;
  address1?: string;
  address2?: string;
  city?: string;
  country?: string;
  postCode?: string;
}

interface ColumnMapping {
  dateColumn: string;
  debitColumn: string;
  creditColumn: string;
}

interface ExtraitComparisonResult {
  matches: any[];
  differences: any[];
  summary: {
    totalMatches: number;
    totalDifferences: number;
    totalAmount: number;
  };
}

export default function EkstreKarsilastirPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [excelData, setExcelData] = useState<any>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateColumn: '',
    debitColumn: '',
    creditColumn: ''
  });
  const [comparisonResult, setComparisonResult] = useState<ExtraitComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    matches: true,
    differences: true,
    excelPreview: false
  });
  const [hiddenDifferences, setHiddenDifferences] = useState<Set<number>>(new Set());
  const [selectedDifferences, setSelectedDifferences] = useState<Set<number>>(new Set());

  // Müşterileri yükle
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoadingCustomers(true);
      setError(null);
      
      // Client-side kontrolü
      if (typeof window === 'undefined') {
        return;
      }
      
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        throw new Error('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } catch (e) {
          console.error('Connection bilgileri parse edilemedi:', e);
          throw new Error('Bağlantı bilgileri geçersiz. Lütfen tekrar giriş yapın.');
        }
      }

      if (!connectionInfo) {
        throw new Error('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
      }

      const firmaNo = connectionInfo.first_firma_no || '009';
      
      console.log(`🔄 Firma No: ${firmaNo} ile müşteri cari hesapları çekiliyor...`);

      // Müşteri cari hesapları çek (CARDTYPE = 2 müşteri) - Tedarikçi bazlı malzeme raporundan birebir alındı
      const sqlQuery = `
       SELECT 
            C.LOGICALREF as logicalRef,
            C.CODE as code,
            C.DEFINITION_ as definition,
            C.SPECODE as specode,
            S1.DEFINITION_ as specodeDefinition,
            C.SPECODE2 as specode2,
            S2.DEFINITION_ as specode2Definition,
            C.SPECODE3 as specode3,
            S3.DEFINITION_ as specode3Definition,
            C.SPECODE4 as specode4,
            S4.DEFINITION_ as specode4Definition,
            C.SPECODE5 as specode5,
            S5.DEFINITION_ as specode5Definition
           
          FROM LG_${firmaNo.padStart(3, '0')}_CLCARD C
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S1 ON C.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S2 ON C.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S3 ON C.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S4 ON C.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S5 ON C.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1
          WHERE C.ACTIVE = 0 -- Aktif olanlar
          ORDER BY C.CODE
      `;

      console.log('🔍 Müşteri Cari Hesapları SQL Sorgusu:');
      console.log(sqlQuery);

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        {
          query: sqlQuery
        },
        'https://api.btrapor.com/proxy',
        300000 // 5 dakika timeout
      );

      // İlk olarak response type kontrolü
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ API HTML döndürdü - proxy hatası olabilir');
        throw new Error('Proxy sunucusuna erişilemiyor. Lütfen sistem yöneticinize başvurun.');
      }

      if (!response.ok) {
        let errorMessage = 'Müşteri cari hesapları alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ Müşteri cari hesapları API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ Müşteri cari hesapları API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setCustomers(result.results);
        setFilteredCustomers([]); // Başlangıçta boş olsun
        console.log('✅ Müşteri cari hesapları başarıyla yüklendi');
        console.log('📊 Toplam müşteri sayısı:', result.results.length);
      } else if (result.data && Array.isArray(result.data)) {
        setCustomers(result.data);
        setFilteredCustomers([]); // Başlangıçta boş olsun
        console.log('✅ Müşteri cari hesapları başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ Müşteri cari hesapları API yanıtı geçersiz format:', result);
        throw new Error('Sunucu yanıtı geçersiz formatta');
      }

    } catch (err: any) {
      console.error('❌ Müşteri cari hesapları çekilirken hata:', err);
      
      if (err.name === 'AbortError') {
        setError('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (err.message?.includes('Failed to fetch')) {
        setError('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.');
      } else {
        setError(err.message || 'Müşteri cari hesapları alınırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleExcelDataLoaded = (data: any) => {
    setExcelData(data);
    setError(null);
  };

  const handleExcelError = (error: string) => {
    setError(error);
    setExcelData(null);
  };

  const handleColumnMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSection = (section: 'matches' | 'differences' | 'excelPreview') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const toggleDifferenceSelection = (index: number) => {
    setSelectedDifferences(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const hideSelectedDifferences = () => {
    setHiddenDifferences(prev => {
      const newSet = new Set(prev);
      selectedDifferences.forEach(index => newSet.add(index));
      return newSet;
    });
    setSelectedDifferences(new Set());
  };

  const showSelectedDifferences = () => {
    setHiddenDifferences(prev => {
      const newSet = new Set(prev);
      selectedDifferences.forEach(index => newSet.delete(index));
      return newSet;
    });
    setSelectedDifferences(new Set());
  };

  const selectAllDifferences = () => {
    if (!comparisonResult) return;
    setSelectedDifferences(new Set(comparisonResult.differences.map((_, index) => index)));
  };

  const deselectAllDifferences = () => {
    setSelectedDifferences(new Set());
  };

  const showAllDifferences = () => {
    setHiddenDifferences(new Set());
    setSelectedDifferences(new Set());
  };

  const validateMapping = (): boolean => {
    if (!selectedCustomer) {
      setError('Lütfen bir müşteri seçin');
      return false;
    }
    
    if (!startDate || !endDate) {
      setError('Lütfen başlangıç ve bitiş tarihlerini seçin');
      return false;
    }
    
    if (!excelData) {
      setError('Lütfen Excel dosyası yükleyin');
      return false;
    }
    
    if (!columnMapping.dateColumn) {
      setError('Tarih kolonunu seçmelisiniz');
      return false;
    }
    
    if (!columnMapping.debitColumn || !columnMapping.creditColumn) {
      setError('Excel borç ve alacak kolonlarını seçmelisiniz (çapraz karşılaştırma için gerekli)');
      return false;
    }
    
    return true;
  };

  const compareExtraits = async () => {
    if (!validateMapping()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Client-side kontrolü
      if (typeof window === 'undefined') {
        return;
      }
      
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        throw new Error('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } catch (e) {
          console.error('Connection bilgileri parse edilemedi:', e);
          throw new Error('Bağlantı bilgileri geçersiz. Lütfen tekrar giriş yapın.');
        }
      }

      if (!connectionInfo) {
        throw new Error('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
      }

      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';
      
      // Tarih kontrolü
      if (!startDate || !endDate) {
        throw new Error('Lütfen başlangıç ve bitiş tarihlerini seçin');
      }
      
      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile ekstre karşılaştırması yapılıyor...`);
      console.log(`📅 Tarih Aralığı: ${startDate} - ${endDate}`);

      // Müşteri ekstre verilerini çek - Tarih filtresi ile
      const sqlQuery = `
        SELECT 
          CLF.CLIENTREF,
          C.CODE,
          C.DEFINITION_,
          CLF.DATE_,
          CASE CLF.SIGN 
            WHEN 0 THEN CLF.AMOUNT
            ELSE 0 
          END AS [Borç],
          CASE CLF.SIGN 
            WHEN 1 THEN CLF.AMOUNT
            ELSE 0 
          END AS [Alacak],
          CASE CLF.SIGN 
            WHEN 0 THEN 
              CASE CLF.TRCURR
                WHEN 0 THEN 0
                ELSE CLF.TRNET
              END
            ELSE 0
          END AS [Dövizli Borç],
          CASE CLF.SIGN 
            WHEN 1 THEN 
              CASE CLF.TRCURR
                WHEN 0 THEN 0
                ELSE CLF.TRNET
              END
            ELSE 0
          END AS [Dövizli Alacak],
          CLF.TRCURR,
          CLF.TRRATE
        FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_CLFLINE CLF
        LEFT JOIN LG_${firmaNo.padStart(3, '0')}_CLCARD C ON CLF.CLIENTREF = C.LOGICALREF
        WHERE CLF.CLIENTREF = ${selectedCustomer}
        AND CLF.DATE_ >= '${startDate}'
        AND CLF.DATE_ <= '${endDate}'
        AND CLF.TRCURR = 0
        ORDER BY CLF.CLIENTREF, CLF.DATE_
      `;

      console.log('🔍 Müşteri Ekstre SQL Sorgusu:');
      console.log(sqlQuery);

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        {
          query: sqlQuery
        },
        'https://api.btrapor.com/proxy',
        300000 // 5 dakika timeout
      );

      // İlk olarak response type kontrolü
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ API HTML döndürdü - proxy hatası olabilir');
        throw new Error('Proxy sunucusuna erişilemiyor. Lütfen sistem yöneticinize başvurun.');
      }

      if (!response.ok) {
        let errorMessage = 'Müşteri ekstre verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ Müşteri ekstre API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ Müşteri ekstre API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Debug için response'u logla
      console.log('🔍 API Response:', result);
      console.log('🔍 Response type:', typeof result);
      console.log('🔍 Response keys:', Object.keys(result));
      
      if (!result.results && !result.data) {
        console.error('❌ Müşteri ekstre API yanıtı geçersiz format:', result);
        throw new Error('Sunucu yanıtı geçersiz formatta');
      }

      const systemData = result.results || result.data || [];
      console.log('✅ Müşteri ekstre verileri başarıyla yüklendi:', systemData.length, 'kayıt');
      console.log('🔍 İlk 3 kayıt:', systemData.slice(0, 3));

      // Excel verilerini sistem verileriyle karşılaştır
      const comparisonResult = performComparison(excelData, systemData, columnMapping);
      setComparisonResult(comparisonResult);
      
    } catch (err: any) {
      console.error('❌ Ekstre karşılaştırma hatası:', err);
      
      if (err.name === 'AbortError') {
        setError('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (err.message?.includes('Failed to fetch')) {
        setError('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.');
      } else {
        setError(err.message || 'Ekstre karşılaştırması yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Excel'den gelen sayıları TR formatına göre sağlam parse et
  // Sağdan ilk nokta/virgül ondalık ayırıcı, geri kalanı binlik ayırıcı
  const parseTurkishNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isFinite(value) ? value : 0;

    let str = String(value).trim();
    if (!str) return 0;

    // Para sembolleri ve boşlukları temizle
    str = str.replace(/\s+/g, '')
             .replace(/[₺₨$€£]/g, '')
             .replace(/\u00A0/g, '');

    // Negatiflik işaretini koru
    const isNegative = /^-/.test(str);
    str = str.replace(/^-/, '');

    // Sağdan ilk nokta veya virgülü bul (ondalık ayırıcı)
    let decimalSepIndex = -1;
    let decimalSep = '';
    
    for (let i = str.length - 1; i >= 0; i--) {
      if (str[i] === '.' || str[i] === ',') {
        decimalSepIndex = i;
        decimalSep = str[i];
        break;
      }
    }

    if (decimalSepIndex === -1) {
      // Hiç ayırıcı yok, düz sayı
      const num = parseFloat(str);
      return isNaN(num) ? 0 : (isNegative ? -num : num);
    }

    // Ondalık kısmı al (sağdan ilk ayırıcıdan sonraki kısım)
    const decimalPart = str.substring(decimalSepIndex + 1);
    
    // Tam kısmı al (sağdan ilk ayırıcıdan önceki kısım)
    const integerPart = str.substring(0, decimalSepIndex);
    
    // Tam kısmındaki tüm nokta ve virgülleri kaldır (binlik ayırıcıları)
    const cleanIntegerPart = integerPart.replace(/[.,]/g, '');
    
    // Ondalık kısmı 2 haneden fazlaysa, sadece ilk 2 hanesini al
    const cleanDecimalPart = decimalPart.length > 2 ? decimalPart.substring(0, 2) : decimalPart;
    
    // Birleştir ve parse et
    const normalized = cleanIntegerPart + '.' + cleanDecimalPart;
    const num = parseFloat(normalized);
    
    return isNaN(num) ? 0 : (isNegative ? -num : num);
  };

  // Hareket bazlı çapraz karşılaştırma fonksiyonu - Tarih ve tutar eşleşmesi
  const performComparison = (excelData: any, systemData: any[], columnMapping: ColumnMapping): ExtraitComparisonResult => {
    const matches: any[] = [];
    const differences: any[] = [];
    
    // Debug için sistem verilerini logla
    console.log('🔍 performComparison - Excel Rows:', excelData.rows?.length || 0);
    console.log('🔍 performComparison - System Records:', systemData.length);
    
    // Sistem verilerini kopyala ve eşleşen kayıtları işaretlemek için kullan
    const availableSystemRecords = [...systemData];
    
    // Excel'deki her hareketi işle
    excelData.rows.forEach((excelRow: any[], index: number) => {
      const dateIndex = excelData.headers.indexOf(columnMapping.dateColumn);
      if (dateIndex === -1) {
        console.log('❌ Tarih kolonu bulunamadı:', columnMapping.dateColumn);
        return;
      }
      
      const excelDate = excelRow[dateIndex];
      
      // Excel tarih formatını normalize et - Basitleştirilmiş versiyon
      let dateKey;
      let formattedDate;
      try {
        
        if (typeof excelDate === 'string' && excelDate.trim() !== '') {
          // String tarih formatları
          let parsedDate;
          
          // DD.MM.YYYY formatı için
          if (excelDate.includes('.')) {
            const parts = excelDate.split('.');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              
              // Yıl kontrolü - 4 haneli olmalı
              if (year.length === 4 && parseInt(year) >= 1900 && parseInt(year) <= 2100) {
                parsedDate = new Date(`${year}-${month}-${day}`);
                formattedDate = `${day}.${month}.${year}`;
            } else {
                console.error('❌ Geçersiz yıl:', year);
                parsedDate = new Date();
                formattedDate = new Date().toLocaleDateString('tr-TR');
            }
          } else {
              parsedDate = new Date(excelDate);
              formattedDate = parsedDate.toLocaleDateString('tr-TR');
          }
        } else {
            parsedDate = new Date(excelDate);
            formattedDate = parsedDate.toLocaleDateString('tr-TR');
          }
          
          // Tarih geçerliliği kontrolü
          if (isNaN(parsedDate.getTime())) {
            console.error('❌ Geçersiz tarih:', excelDate);
            dateKey = new Date().toDateString();
            formattedDate = new Date().toLocaleDateString('tr-TR');
          } else {
            dateKey = parsedDate.toDateString();
          }
          
        } else if (typeof excelDate === 'number' && excelDate > 0) {
          // Excel serial date number
          console.log(`🔍 Excel serial date:`, excelDate);
          
          // Excel'de 1900-01-01 = 1
          // 1900 yılı leap year hatası için -2 gün çıkar
          const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
          const actualDate = new Date(excelEpoch.getTime() + (excelDate * 24 * 60 * 60 * 1000));
          
          if (isNaN(actualDate.getTime())) {
            console.error('❌ Geçersiz Excel serial date:', excelDate);
            dateKey = new Date().toDateString();
            formattedDate = new Date().toLocaleDateString('tr-TR');
          } else {
            dateKey = actualDate.toDateString();
            formattedDate = actualDate.toLocaleDateString('tr-TR');
          }
          
        } else {
          console.error('❌ Boş veya geçersiz tarih değeri:', excelDate);
          dateKey = new Date().toDateString();
          formattedDate = new Date().toLocaleDateString('tr-TR');
        }
        
        
        // Gelecekteki tarih kontrolü
        const parsedDate = new Date(dateKey);
        const currentYear = new Date().getFullYear();
        if (parsedDate.getFullYear() > currentYear + 10) {
          console.error('❌ Gelecekteki tarih tespit edildi:', dateKey, 'Ham değer:', excelDate);
        }
        
      } catch (error) {
        console.error('❌ Tarih parse hatası:', excelDate, error);
        dateKey = new Date().toDateString();
        formattedDate = new Date().toLocaleDateString('tr-TR');
      }
      
      // Excel'deki borç ve alacak tutarlarını al
      const debitIndex = excelData.headers.indexOf(columnMapping.debitColumn);
      const creditIndex = excelData.headers.indexOf(columnMapping.creditColumn);
      
      const excelDebit = debitIndex !== -1 ? parseTurkishNumber(excelRow[debitIndex]) : 0;
      const excelCredit = creditIndex !== -1 ? parseTurkishNumber(excelRow[creditIndex]) : 0;
      
      // Belge numarası ve işlem türü bilgilerini al
      const docNoIndex = excelData.headers.findIndex((header: string) => 
        header.toLowerCase().includes('belge') || 
        header.toLowerCase().includes('doc') || 
        header.toLowerCase().includes('numara')
      );
      const excelDocNo = docNoIndex !== -1 ? excelRow[docNoIndex] : '';
      
      const transactionTypeIndex = excelData.headers.findIndex((header: string) => 
        header.toLowerCase().includes('işlem') || 
        header.toLowerCase().includes('tür') || 
        header.toLowerCase().includes('type')
      );
      const excelTransactionType = transactionTypeIndex !== -1 ? excelRow[transactionTypeIndex] : '';
      
      // Tolerans değeri (0.05 TL) - Küçük yuvarlama farkları için
      const tolerance = 0.05;
      
      // Sistem verilerinde tutar bazında eşleşme ara
      let matchedSystemRecord = null;
      let matchIndex = -1;
      
      // Hareket bazında karşılaştırma: Aynı tarihte aynı tutar var mı?
      for (let i = 0; i < availableSystemRecords.length; i++) {
        const systemRecord = availableSystemRecords[i];
        const systemDebit = parseTurkishNumber(systemRecord.Borç);
        const systemCredit = parseTurkishNumber(systemRecord.Alacak);
        
        // Tarih eşleşmesi kontrolü
        const systemDate = new Date(systemRecord.DATE_).toLocaleDateString('tr-TR');
        const dateMatch = systemDate === formattedDate;
        
        if (!dateMatch) continue; // Tarih eşleşmiyorsa atla
        
        // Çapraz karşılaştırma kontrolü (Excel Borç ↔ Logo Alacak, Excel Alacak ↔ Logo Borç)
        const logoCreditVsExcelDebit = Math.abs(systemCredit - excelDebit);
        const excelCreditVsLogoDebit = Math.abs(excelCredit - systemDebit);
        
        // Her iki karşılaştırma da tolerans içinde olmalı
        if (logoCreditVsExcelDebit <= tolerance && excelCreditVsLogoDebit <= tolerance) {
          console.log(`✅ Hareket eşleşmesi bulundu! Tarih: ${formattedDate}, Excel: ${excelDebit}₺/${excelCredit}₺ ↔ Logo: ${systemDebit}₺/${systemCredit}₺`);
          matchedSystemRecord = systemRecord;
          matchIndex = i;
          break;
        } else {
          // Debug: Aynı tarihte neden eşleşmediğini göster
          if (excelDebit > 0 || excelCredit > 0) {
            console.log(`🔍 Aynı tarihte eşleşmedi:`, {
              Tarih: formattedDate,
              Excel: `${excelDebit}₺/${excelCredit}₺`,
              Logo: `${systemDebit}₺/${systemCredit}₺`,
              Farklar: `${logoCreditVsExcelDebit.toFixed(2)}/${excelCreditVsLogoDebit.toFixed(2)}`,
              Tolerans: tolerance,
              HamBorç: systemRecord.Borç,
              HamAlacak: systemRecord.Alacak
            });
          }
        }
      }
      
      if (matchedSystemRecord) {
        // Eşleşen kayıt bulundu - sistem kaydını kullanıldı olarak işaretle
        const systemDebit = parseTurkishNumber(matchedSystemRecord.Borç);
        const systemCredit = parseTurkishNumber(matchedSystemRecord.Alacak);
        
        // Kullanılan kaydı listeden çıkar (tekrar kullanılmasın)
        availableSystemRecords.splice(matchIndex, 1);
        
        matches.push({
          date: formattedDate,
          excelDocNo: excelDocNo,
          excelTransactionType: excelTransactionType,
          excelDebit: excelDebit,
          excelCredit: excelCredit,
          systemDebit: systemDebit,
          systemCredit: systemCredit,
          systemRecordCount: 1,
          systemRecordDetails: [{
            date: matchedSystemRecord.DATE_,
            debit: systemDebit,
            credit: systemCredit
          }],
          // Çapraz karşılaştırma farkları
          logoCreditVsExcelDebitDifference: systemCredit - excelDebit,
          excelCreditVsLogoDebitDifference: excelCredit - systemDebit,
          logoCreditVsExcelDebitMatch: true,
          excelCreditVsLogoDebitMatch: true,
          status: 'Eşleşti'
        });
      } else {
        // Eşleşen kayıt bulunamadı
        console.log(`❌ Eşleşme bulunamadı! Excel: ${excelDebit}₺/${excelCredit}₺ (Tarih: ${formattedDate}) - Belge: ${excelDocNo || 'Yok'}`);
        differences.push({
          date: formattedDate,
          excelDocNo: excelDocNo,
          excelTransactionType: excelTransactionType,
          excelDebit: excelDebit,
          excelCredit: excelCredit,
          systemDebit: 0,
          systemCredit: 0,
          systemRecordCount: 0,
          systemRecordDetails: [],
          // Çapraz karşılaştırma farkları
          logoCreditVsExcelDebitDifference: 0 - excelDebit,
          excelCreditVsLogoDebitDifference: excelCredit - 0,
          logoCreditVsExcelDebitMatch: false,
          excelCreditVsLogoDebitMatch: false,
          status: 'Sistemde Yok'
        });
      }
    });
    
    // Kullanılmayan sistem kayıtlarını da farklı kayıtlar olarak ekle
    availableSystemRecords.forEach(systemRecord => {
      const systemDebit = parseTurkishNumber(systemRecord.Borç);
      const systemCredit = parseTurkishNumber(systemRecord.Alacak);
      
      // Sadece sıfır olmayan kayıtları ekle
      if (systemDebit > 0 || systemCredit > 0) {
        differences.push({
          date: new Date(systemRecord.DATE_).toLocaleDateString('tr-TR'),
          excelDocNo: '',
          excelTransactionType: '',
          excelDebit: 0,
          excelCredit: 0,
          systemDebit: systemDebit,
          systemCredit: systemCredit,
          systemRecordCount: 1,
          systemRecordDetails: [{
            date: systemRecord.DATE_,
            debit: systemDebit,
            credit: systemCredit
          }],
          // Çapraz karşılaştırma farkları
          logoCreditVsExcelDebitDifference: systemCredit - 0,
          excelCreditVsLogoDebitDifference: 0 - systemDebit,
          logoCreditVsExcelDebitMatch: false,
          excelCreditVsLogoDebitMatch: false,
          status: 'Excel\'de Yok'
        });
      }
    });
    
    // Tüm differences array'ini tarihe göre sırala
    differences.sort((a, b) => {
      const dateA = new Date(a.date.split('.').reverse().join('-'));
      const dateB = new Date(b.date.split('.').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
    
    const totalAmount = [...matches, ...differences].reduce((sum, item) => sum + (item.excelDebit + item.excelCredit), 0);
    
    return {
      matches,
      differences,
      summary: {
        totalMatches: matches.length,
        totalDifferences: differences.length,
        totalAmount: totalAmount
      }
    };
  };

  const exportToExcel = () => {
    if (!comparisonResult) return;
    
    try {
      // Excel export için veri hazırla - Çapraz karşılaştırma formatında
      const exportData = [
        ['Tarih', 'Belge No', 'İşlem Türü', 'Excel Borç', 'Logo Alacak', 'Logo Borç', 'Excel Alacak', 'Logo Alacak ↔ Excel Borç Farkı', 'Excel Alacak ↔ Logo Borç Farkı', 'Durum'],
        // Eşleşen kayıtlar
        ...comparisonResult.matches.map(match => [
          match.date,
          match.excelDocNo || '',
          match.excelTransactionType || '',
          match.excelDebit.toLocaleString('tr-TR'),
          match.systemCredit.toLocaleString('tr-TR'),
          match.systemDebit.toLocaleString('tr-TR'),
          match.excelCredit.toLocaleString('tr-TR'),
          match.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR'),
          match.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR'),
          'Eşleşti'
        ]),
        // Eşleşmeyen kayıtlar (gizlenenler hariç)
        ...comparisonResult.differences
          .map((diff, index) => ({ diff, index }))
          .filter(({ index }) => !hiddenDifferences.has(index))
          .map(({ diff }) => [
          diff.date,
          diff.excelDocNo || '',
          diff.excelTransactionType || '',
          diff.excelDebit.toLocaleString('tr-TR'),
          diff.systemCredit.toLocaleString('tr-TR'),
          diff.systemDebit.toLocaleString('tr-TR'),
          diff.excelCredit.toLocaleString('tr-TR'),
          diff.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR'),
          diff.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR'),
          diff.status
        ])
      ];
      
      // CSV olarak indir
      const csvContent = exportData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ekstre_karsilastirma_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Sonuçlar Excel olarak indirilirken hata oluştu');
    }
  };

  const printResults = () => {
    if (!comparisonResult) return;
    
    try {
      // Yazdırma için yeni pencere aç
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle yazdırma penceresi açılamıyor.');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ekstre Karşılaştırma Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 15px; }
            .header-top { display: flex; align-items: flex-start; gap: 15px; }
            .logo { width: 60px; height: auto; flex-shrink: 0; }
            .header-content { flex: 1; }
            .header h1 { color: #991b1b; margin: 0 0 5px 0; font-size: 16px; text-align: left; }
            .header p { margin: 2px 0; color: #666; font-size: 10px; text-align: left; }
            .summary { background: #f3f4f6; padding: 10px; margin: 15px 0; border-radius: 6px; font-size: 10px; }
            .summary h3 { margin: 0 0 8px 0; color: #374151; font-size: 12px; }
            .summary p { margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 9px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .positive { color: #1f2937; }
            .negative { color: #dc2626; }
            .matches { color: #16a34a; font-weight: bold; }
            .differences { color: #dc2626; font-weight: bold; }
            .section-title { color: #374151; font-size: 12px; font-weight: bold; margin: 20px 0 10px 0; }
            .page-break { page-break-before: always; }
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
              .summary { padding: 8px; margin: 10px 0; }
              .summary h3 { font-size: 10px; }
              .summary p { font-size: 8px; margin: 2px 0; }
              .section-title { font-size: 10px; margin: 15px 0 8px 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>Ekstre Karşılaştırma Raporu</h1>
                <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
                <p>Toplam Eşleşen: ${comparisonResult.summary.totalMatches} | Toplam Eşleşmeyen: ${comparisonResult.summary.totalDifferences}</p>
              </div>
            </div>
          </div>
          
          <div class="summary">
            <h3>Özet Bilgiler</h3>
            <p><strong>Eşleşen Kayıtlar:</strong> ${comparisonResult.summary.totalMatches} adet</p>
            <p><strong>Eşleşmeyen Kayıtlar:</strong> ${comparisonResult.summary.totalDifferences} adet</p>
            <p><strong>Toplam Tutar:</strong> ${comparisonResult.summary.totalAmount.toLocaleString('tr-TR')} ₺</p>
          </div>

          <div class="section-title">Eşleşmeyen Kayıtlar (${comparisonResult.differences.filter((_, index) => !hiddenDifferences.has(index)).length} adet)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tarih</th>
                <th>Belge No</th>
                <th>İşlem Türü</th>
                <th>Excel Borç</th>
                <th>Logo Alacak</th>
                <th>Logo Borç</th>
                <th>Excel Alacak</th>
                <th>Logo Alacak ↔ Excel Borç Farkı</th>
                <th>Excel Alacak ↔ Logo Borç Farkı</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${comparisonResult.differences
                .map((diff, index) => ({ diff, index }))
                .filter(({ index }) => !hiddenDifferences.has(index))
                .map(({ diff, index }, visibleIndex) => `
                <tr>
                  <td class="number">${visibleIndex + 1}</td>
                  <td>${diff.date}</td>
                  <td>${diff.excelDocNo || '-'}</td>
                  <td>${diff.excelTransactionType || '-'}</td>
                  <td class="number currency">${diff.excelDebit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${diff.systemCredit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${diff.systemDebit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${diff.excelCredit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${diff.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${diff.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR')} ₺</td>
                  <td class="differences">${diff.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Eşleşen Kayıtlar (${comparisonResult.matches.length} adet)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tarih</th>
                <th>Belge No</th>
                <th>İşlem Türü</th>
                <th>Excel Borç</th>
                <th>Logo Alacak</th>
                <th>Logo Borç</th>
                <th>Excel Alacak</th>
                <th>Logo Alacak ↔ Excel Borç Farkı</th>
                <th>Excel Alacak ↔ Logo Borç Farkı</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${comparisonResult.matches.map((match, index) => `
                <tr>
                  <td class="number">${index + 1}</td>
                  <td>${match.date}</td>
                  <td>${match.excelDocNo || '-'}</td>
                  <td>${match.excelTransactionType || '-'}</td>
                  <td class="number currency">${match.excelDebit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${match.systemCredit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${match.systemDebit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${match.excelCredit.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${match.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR')} ₺</td>
                  <td class="number currency">${match.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR')} ₺</td>
                  <td class="matches">${match.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde ${localStorage.getItem('userName') || 'Bilinmeyen Kullanıcı'} tarafından BT Rapor sistemi üzerinden alınmıştır. 
            Tüm tutarlar Türk Lirası (₺) cinsindendir. Çapraz karşılaştırma: Logo Alacak ↔ Excel Borç, Excel Alacak ↔ Logo Borç.
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
      
      // Yazdırma diyalogunu aç
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error('Yazdırma hatası:', error);
      alert('Yazdırma sırasında hata oluştu');
    }
  };

  return (
    <DashboardLayout title="Ekstre Karşılaştırma">
      <div className="space-y-6">
        {/* Başlık */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ekstre Karşılaştırma (Çapraz)
          </h1>
          <p className="text-gray-600">
            Karşı taraftan gelen ekstre ile sistem ekstresi arasında çapraz karşılaştırma yapın. 
            <span className="text-blue-600 font-semibold"> Logo alacak ↔ Excel borç</span> ve 
            <span className="text-green-600 font-semibold"> Excel alacak ↔ Logo borç</span> karşılaştırması yapılır.
          </p>
        </div>

        {/* Tarih Aralığı Seçimi */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. Tarih Aralığı Seçimi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Başlangıç Tarihi *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bitiş Tarihi *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Müşteri Seçimi */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            2. Müşteri Seçimi
          </h2>
          
          {/* Arama Kutusu */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Müşteri Ara ({customers.length} adet)
            </label>
            <input
              type="text"
              placeholder="Müşteri kodu veya adı ile arayın..."
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm transition-all duration-200"
              onChange={(e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                if (searchTerm === '') {
                  setFilteredCustomers([]); // Boş arama yapıldığında liste gizlensin
                } else {
                  const filtered = customers.filter(customer => {
                    const code = customer.code.toLowerCase();
                    const definition = customer.definition.toLowerCase();
                    const normalizedSearchTerm = searchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const normalizedCode = code.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const normalizedDefinition = definition.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    
                    return normalizedCode.includes(normalizedSearchTerm) || 
                           normalizedDefinition.includes(normalizedSearchTerm) ||
                           code.includes(searchTerm) || 
                           definition.includes(searchTerm);
                  });
                  setFilteredCustomers(filtered);
                }
              }}
            />
          </div>
          
          {/* Müşteri Listesi */}
          {filteredCustomers.length > 0 && (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <div 
                  key={customer.logicalRef}
                  onClick={() => setSelectedCustomer(customer.logicalRef.toString())}
                  className={`p-4 bg-white border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedCustomer === customer.logicalRef.toString()
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      selectedCustomer === customer.logicalRef.toString()
                        ? 'border-blue-500 bg-blue-500 shadow-md'
                        : 'border-gray-300'
                    }`}>
                      {selectedCustomer === customer.logicalRef.toString() && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-gray-900 bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-1 rounded-lg shadow-sm">
                          {customer.code}
                        </span>
                        <h3 className="text-sm font-medium text-gray-900">
                          {customer.definition}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Seçim Bilgisi */}
          {selectedCustomer && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <span>✅</span>
                <span>
                  Seçili Müşteri: {
                    customers.find(c => c.logicalRef.toString() === selectedCustomer)?.definition || 'Bilinmeyen'
                  }
                </span>
              </div>
            </div>
          )}

          {/* Loading durumu */}
          {loadingCustomers && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-gray-500">Müşteriler yükleniyor...</span>
            </div>
          )}
        </div>

        {/* Excel Yükleme */}
        <div className="bg-white rounded-lg shadow">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('excelPreview')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
            3. Excel Dosyası Yükleme
          </h2>
                  <p className="text-sm text-gray-500">
                    Excel dosyasını yükleyin ve verileri önizleyin
                  </p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  expandedSections.excelPreview ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {expandedSections.excelPreview && (
            <div className="p-6">
          <ExcelUploader
            onDataLoaded={handleExcelDataLoaded}
            onError={handleExcelError}
            acceptedFormats={['.xlsx', '.xls', '.csv']}
            maxFileSize={10}
            showPreview={true}
            showDownload={false}
          />
            </div>
          )}
        </div>

        {/* Kolon Eşleştirme */}
        {excelData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              4. Kolon Eşleştirme
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tarih Kolonu *
                </label>
                <select
                  value={columnMapping.dateColumn}
                  onChange={(e) => handleColumnMappingChange('dateColumn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kolon seçin...</option>
                  {excelData.headers.map((header: string, index: number) => (
                    <option key={index} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel Alacak Kolonu (Logo Borç ile karşılaştırılacak) *
                </label>
                <select
                  value={columnMapping.creditColumn}
                  onChange={(e) => handleColumnMappingChange('creditColumn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kolon seçin...</option>
                  {excelData.headers.map((header: string, index: number) => (
                    <option key={index} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Excel Borç Kolonu (Logo Alacak ile karşılaştırılacak) *
                </label>
                <select
                  value={columnMapping.debitColumn}
                  onChange={(e) => handleColumnMappingChange('debitColumn', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kolon seçin...</option>
                  {excelData.headers.map((header: string, index: number) => (
                    <option key={index} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={compareExtraits}
                disabled={loading || !selectedCustomer || !excelData || !startDate || !endDate}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Karşılaştırılıyor...' : 'Karşılaştırmayı Başlat'}
              </button>
            </div>
          </div>
        )}

        {/* Hata Mesajı */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Karşılaştırma Sonuçları */}
        {comparisonResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Karşılaştırma Sonuçları
              </h2>
              <div className="flex gap-3">
              <button
                  onClick={exportToExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel İndir
                </button>
                <button
                  onClick={printResults}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Yazdır
              </button>
              </div>
            </div>

            {/* Özet */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Eşleşen Kayıtlar</p>
                <p className="text-2xl font-bold text-green-800">
                  {comparisonResult.summary.totalMatches}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600">Farklı Kayıtlar</p>
                <p className="text-2xl font-bold text-red-800">
                  {comparisonResult.summary.totalDifferences}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600">Toplam Tutar</p>
                <p className="text-2xl font-bold text-blue-800">
                  {comparisonResult.summary.totalAmount.toLocaleString('tr-TR')} ₺
                </p>
              </div>
            </div>

            {/* Eşleşmeyen Kayıtlar Akordiyon */}
            {comparisonResult.differences.length > 0 && (
              <div className="mb-8">
                <div 
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl cursor-pointer hover:from-red-100 hover:to-red-150 transition-all duration-200 shadow-sm"
                  onClick={() => toggleSection('differences')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-900">
                        Eşleşmeyen Kayıtlar
                </h3>
                      <p className="text-sm text-red-700">
                        {comparisonResult.differences.length} adet kayıt sistemde bulunamadı
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-red-600 bg-red-200 px-3 py-1 rounded-full">
                      {expandedSections.differences ? 'Gizle' : 'Göster'}
                    </span>
                    <svg 
                      className={`w-6 h-6 text-red-600 transition-transform duration-200 ${expandedSections.differences ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {expandedSections.differences && (
                  <div className="mt-6">
                    {/* Kontrol Butonları */}
                    <div className="mb-4 flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700">
                          Seçilen: {selectedDifferences.size} | Gizlenen: {hiddenDifferences.size} / {comparisonResult.differences.length}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={selectAllDifferences}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
                          >
                            Tümünü Seç
                          </button>
                          <button
                            onClick={deselectAllDifferences}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                          >
                            Seçimi Temizle
                          </button>
                          <button
                            onClick={hideSelectedDifferences}
                            disabled={selectedDifferences.size === 0}
                            className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Seçilenleri Gizle
                          </button>
                          <button
                            onClick={showAllDifferences}
                            className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
                          >
                            Tümünü Göster
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        💡 Önce kayıtları seçin, sonra "Seçilenleri Gizle" butonunu kullanın
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-h-[600px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-50 shadow-lg border-b-2 border-gray-300">
                      <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            ☑️
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            #
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            📅 Tarih
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            📄 Belge No
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            🔄 İşlem Türü
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-red-600 uppercase tracking-wider border-r border-gray-200">
                            💸 Excel Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-green-600 uppercase tracking-wider border-r border-gray-200">
                            🏢 Logo Alacak
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-red-600 uppercase tracking-wider border-r border-gray-200">
                            🏢 Logo Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-green-600 uppercase tracking-wider border-r border-gray-200">
                            💰 Excel Alacak
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-blue-600 uppercase tracking-wider border-r border-gray-200">
                            ⚖️ Logo Alacak ↔ Excel Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-purple-600 uppercase tracking-wider border-r border-gray-200">
                            ⚖️ Excel Alacak ↔ Logo Borç
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            🏷️ Durum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {comparisonResult.differences.map((diff, index) => (
                        <tr 
                          key={index} 
                          className={`hover:bg-gray-50 transition-colors duration-150 ${
                            hiddenDifferences.has(index) ? 'opacity-50 bg-gray-100' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-25')
                          }`}
                          style={{ display: hiddenDifferences.has(index) ? 'none' : 'table-row' }}
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm border-r border-gray-100">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedDifferences.has(index)}
                                onChange={() => toggleDifferenceSelection(index)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-600 border-r border-gray-100">
                            <div className="flex items-center justify-center">
                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">📅</span>
                            {diff.date}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">📄</span>
                              {diff.excelDocNo || <span className="text-gray-400 italic">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">🔄</span>
                              {diff.excelTransactionType || <span className="text-gray-400 italic">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-red-600 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400">💸</span>
                              {diff.excelDebit > 0 ? `${diff.excelDebit.toLocaleString('tr-TR')} ₺` : <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">🏢</span>
                              {diff.systemCredit > 0 ? `${diff.systemCredit.toLocaleString('tr-TR')} ₺` : <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-red-600 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-red-400">🏢</span>
                              {diff.systemDebit > 0 ? `${diff.systemDebit.toLocaleString('tr-TR')} ₺` : <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600 border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">💰</span>
                              {diff.excelCredit > 0 ? `${diff.excelCredit.toLocaleString('tr-TR')} ₺` : <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400">⚖️</span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                diff.logoCreditVsExcelDebitDifference > 0 
                                  ? 'bg-red-100 text-red-800 border border-red-200' 
                                  : diff.logoCreditVsExcelDebitDifference < 0
                                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                {diff.logoCreditVsExcelDebitDifference > 0 ? '+' : ''}{diff.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium border-r border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400">⚖️</span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                diff.excelCreditVsLogoDebitDifference > 0 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : diff.excelCreditVsLogoDebitDifference < 0
                                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                {diff.excelCreditVsLogoDebitDifference > 0 ? '+' : ''}{diff.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">🏷️</span>
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                diff.status === 'Sistemde Yok' 
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : diff.status === 'Excel\'de Yok'
                                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                              {diff.status}
                            </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  </div>
                )}
              </div>
            )}

            {/* Eşleşen Kayıtlar Akordiyon */}
            {comparisonResult.matches.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl cursor-pointer hover:from-green-100 hover:to-green-150 transition-all duration-200 shadow-sm"
                  onClick={() => toggleSection('matches')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-900">
                        Eşleşen Kayıtlar
                </h3>
                      <p className="text-sm text-green-700">
                        {comparisonResult.summary.totalMatches} adet kayıt başarıyla eşleşti
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-green-600 bg-green-200 px-3 py-1 rounded-full">
                      {expandedSections.matches ? 'Gizle' : 'Göster'}
                    </span>
                    <svg 
                      className={`w-6 h-6 text-green-600 transition-transform duration-200 ${expandedSections.matches ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {expandedSections.matches && (
                  <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-h-[600px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-green-50 to-green-100 sticky top-0 z-50 shadow-lg border-b-2 border-green-300">
                      <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            #
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            📅 Tarih
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            📄 Belge No
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider border-r border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm">
                            🔄 İşlem Türü
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-red-600 uppercase tracking-wider border-r border-gray-200">
                            💸 Excel Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-green-600 uppercase tracking-wider border-r border-gray-200">
                            🏢 Logo Alacak
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-red-600 uppercase tracking-wider border-r border-gray-200">
                            🏢 Logo Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-green-600 uppercase tracking-wider border-r border-gray-200">
                            💰 Excel Alacak
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-blue-600 uppercase tracking-wider border-r border-gray-200">
                            ⚖️ Logo Alacak ↔ Excel Borç
                        </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-purple-600 uppercase tracking-wider border-r border-gray-200">
                            ⚖️ Excel Alacak ↔ Logo Borç
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            🏷️ Durum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResult.matches
                        .sort((a, b) => {
                          // Tarih sıralaması için önce tarih parse et
                          const dateA = new Date(a.date);
                          const dateB = new Date(b.date);
                          return dateA.getTime() - dateB.getTime();
                        })
                        .map((match, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600">
                            <div className="flex items-center justify-center">
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                                {index + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {match.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {match.excelDocNo || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {match.excelTransactionType || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {match.excelDebit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {match.systemCredit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {match.systemDebit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {match.excelCredit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              match.logoCreditVsExcelDebitDifference > 0 
                                ? 'bg-red-100 text-red-800' 
                                : match.logoCreditVsExcelDebitDifference < 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {match.logoCreditVsExcelDebitDifference > 0 ? '+' : ''}{match.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              match.excelCreditVsLogoDebitDifference > 0 
                                ? 'bg-green-100 text-green-800' 
                                : match.excelCreditVsLogoDebitDifference < 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {match.excelCreditVsLogoDebitDifference > 0 ? '+' : ''}{match.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              {match.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
