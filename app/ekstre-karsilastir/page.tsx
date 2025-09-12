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
    differences: true
  });

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

  const toggleSection = (section: 'matches' | 'differences') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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

  // Tutar bazlı çapraz karşılaştırma fonksiyonu - Her işlem kendi tutarıyla eşleşmeli
  const performComparison = (excelData: any, systemData: any[], columnMapping: ColumnMapping): ExtraitComparisonResult => {
    const matches: any[] = [];
    const differences: any[] = [];
    
    // Debug için sistem verilerini logla
    console.log('🔍 performComparison - Excel Data:', excelData);
    console.log('🔍 performComparison - System Data:', systemData);
    console.log('🔍 performComparison - System Data Length:', systemData.length);
    console.log('🔍 performComparison - Column Mapping:', columnMapping);
    
    // Sistem verilerini kopyala ve eşleşen kayıtları işaretlemek için kullan
    const availableSystemRecords = [...systemData];
    
    // Excel'deki her satırı tek tek işle
    excelData.rows.forEach((excelRow: any[], index: number) => {
      const dateIndex = excelData.headers.indexOf(columnMapping.dateColumn);
      if (dateIndex === -1) {
        console.log('❌ Tarih kolonu bulunamadı:', columnMapping.dateColumn);
        return;
      }
      
      const excelDate = excelRow[dateIndex];
      console.log(`🔍 Excel Satır ${index}:`, excelRow);
      console.log(`🔍 Excel Tarih Ham Değer:`, excelDate, 'Type:', typeof excelDate);
      
      // Excel tarih formatını normalize et - Basitleştirilmiş versiyon
      let dateKey;
      try {
        console.log(`🔍 Tarih parse ediliyor:`, excelDate, 'Type:', typeof excelDate);
        
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
              } else {
                console.error('❌ Geçersiz yıl:', year);
                parsedDate = new Date(); // Bugünün tarihi
              }
            } else {
              parsedDate = new Date(excelDate);
            }
          } else {
            parsedDate = new Date(excelDate);
          }
          
          // Tarih geçerliliği kontrolü
          if (isNaN(parsedDate.getTime())) {
            console.error('❌ Geçersiz tarih:', excelDate);
            dateKey = new Date().toDateString();
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
          } else {
            dateKey = actualDate.toDateString();
          }
          
        } else {
          console.error('❌ Boş veya geçersiz tarih değeri:', excelDate);
          dateKey = new Date().toDateString();
        }
        
        console.log(`🔍 Final dateKey:`, dateKey);
        
        // Gelecekteki tarih kontrolü
        const parsedDate = new Date(dateKey);
        const currentYear = new Date().getFullYear();
        if (parsedDate.getFullYear() > currentYear + 10) {
          console.error('❌ Gelecekteki tarih tespit edildi:', dateKey, 'Ham değer:', excelDate);
        }
        
      } catch (error) {
        console.error('❌ Tarih parse hatası:', excelDate, error);
        dateKey = new Date().toDateString();
      }
      
      // Excel'deki borç ve alacak tutarlarını al
      const debitIndex = excelData.headers.indexOf(columnMapping.debitColumn);
      const creditIndex = excelData.headers.indexOf(columnMapping.creditColumn);
      
      console.log(`🔍 Excel Kolon İndeksleri - Borç: ${debitIndex}, Alacak: ${creditIndex}`);
      console.log(`🔍 Excel Kolon Adları - Borç: ${columnMapping.debitColumn}, Alacak: ${columnMapping.creditColumn}`);
      
      const excelDebit = debitIndex !== -1 ? parseFloat(excelRow[debitIndex]) || 0 : 0;
      const excelCredit = creditIndex !== -1 ? parseFloat(excelRow[creditIndex]) || 0 : 0;
      
      console.log(`🔍 Excel Tutarlar - Borç: ${excelDebit}, Alacak: ${excelCredit}`);
      
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
      const tolerance = 1.00;
      
      // Sistem verilerinde tutar bazında eşleşme ara
      let matchedSystemRecord = null;
      let matchIndex = -1;
      
      // Çapraz karşılaştırma: Logo alacak ↔ Excel borç, Excel alacak ↔ Logo borç
      console.log(`🔍 Sistem kayıtları aranıyor (${availableSystemRecords.length} adet)...`);
      
      for (let i = 0; i < availableSystemRecords.length; i++) {
        const systemRecord = availableSystemRecords[i];
        const systemDebit = parseFloat(systemRecord.Borç) || 0;
        const systemCredit = parseFloat(systemRecord.Alacak) || 0;
        
        console.log(`🔍 Sistem Kayıt ${i}:`, {
          Borç: systemDebit,
          Alacak: systemCredit,
          DATE_: systemRecord.DATE_
        });
        
        // Çapraz karşılaştırma kontrolü
        const logoCreditVsExcelDebit = Math.abs(systemCredit - excelDebit);
        const excelCreditVsLogoDebit = Math.abs(excelCredit - systemDebit);
        
        console.log(`🔍 Karşılaştırma ${i}:`, {
          logoCreditVsExcelDebit: logoCreditVsExcelDebit.toFixed(2),
          excelCreditVsLogoDebit: excelCreditVsLogoDebit.toFixed(2),
          tolerance: tolerance.toFixed(2),
          logoCreditMatch: logoCreditVsExcelDebit <= tolerance,
          excelCreditMatch: excelCreditVsLogoDebit <= tolerance,
          bothMatch: logoCreditVsExcelDebit <= tolerance && excelCreditVsLogoDebit <= tolerance
        });
        
        // Her iki karşılaştırma da tolerans içinde olmalı
        if (logoCreditVsExcelDebit <= tolerance && excelCreditVsLogoDebit <= tolerance) {
          console.log(`✅ Eşleşme bulundu! Sistem kayıt ${i}`);
          matchedSystemRecord = systemRecord;
          matchIndex = i;
          break;
        }
      }
      
      if (matchedSystemRecord) {
        // Eşleşen kayıt bulundu - sistem kaydını kullanıldı olarak işaretle
        const systemDebit = parseFloat(matchedSystemRecord.Borç) || 0;
        const systemCredit = parseFloat(matchedSystemRecord.Alacak) || 0;
        
        // Kullanılan kaydı listeden çıkar (tekrar kullanılmasın)
        availableSystemRecords.splice(matchIndex, 1);
        
        matches.push({
          date: new Date(dateKey).toLocaleDateString('tr-TR'),
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
        differences.push({
          date: new Date(dateKey).toLocaleDateString('tr-TR'),
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
      const systemDebit = parseFloat(systemRecord.Borç) || 0;
      const systemCredit = parseFloat(systemRecord.Alacak) || 0;
      
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

  const exportResults = () => {
    if (!comparisonResult) return;
    
    try {
      // Excel export için veri hazırla
      const exportData = [
        ['Tarih', 'Müşteri Bakiyesi', 'Sistem Bakiyesi', 'Fark', 'Durum'],
        ...comparisonResult.matches.map(match => [
          match.date,
          match.customerBalance,
          match.systemBalance,
          match.difference,
          'Eşleşti'
        ]),
        ...comparisonResult.differences.map(diff => [
          diff.date,
          diff.customerBalance,
          diff.systemBalance,
          diff.difference,
          'Farklı'
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
      console.error('Export hatası:', error);
      alert('Sonuçlar indirilirken hata oluştu');
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            3. Excel Dosyası Yükleme
          </h2>
          <ExcelUploader
            onDataLoaded={handleExcelDataLoaded}
            onError={handleExcelError}
            acceptedFormats={['.xlsx', '.xls', '.csv']}
            maxFileSize={10}
            showPreview={true}
            showDownload={false}
          />
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
              <button
                onClick={exportResults}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Sonuçları İndir
              </button>
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
              <div className="mb-6">
                <div 
                  className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => toggleSection('differences')}
                >
                  <h3 className="text-md font-semibold text-red-900">
                    Eşleşmeyen Kayıtlar ({comparisonResult.differences.length} adet)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">
                      {expandedSections.differences ? 'Gizle' : 'Göster'}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-red-600 transition-transform ${expandedSections.differences ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {expandedSections.differences && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tarih
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Belge No
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            İşlem Türü
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Borç
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Alacak
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Borç
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Alacak
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Alacak ↔ Excel Borç Farkı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Alacak ↔ Logo Borç Farkı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResult.differences.map((diff, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {diff.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {diff.excelDocNo || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {diff.excelTransactionType || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {diff.excelDebit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {diff.excelCredit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {diff.systemDebit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {diff.systemCredit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              diff.logoCreditVsExcelDebitDifference > 0 
                                ? 'bg-red-100 text-red-800' 
                                : diff.logoCreditVsExcelDebitDifference < 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {diff.logoCreditVsExcelDebitDifference > 0 ? '+' : ''}{diff.logoCreditVsExcelDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              diff.excelCreditVsLogoDebitDifference > 0 
                                ? 'bg-green-100 text-green-800' 
                                : diff.excelCreditVsLogoDebitDifference < 0
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {diff.excelCreditVsLogoDebitDifference > 0 ? '+' : ''}{diff.excelCreditVsLogoDebitDifference.toLocaleString('tr-TR')} ₺
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              diff.status === 'Sistemde Yok' 
                                ? 'bg-red-100 text-red-800'
                                : diff.status === 'Excel\'de Yok'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {diff.status}
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

            {/* Eşleşen Kayıtlar Akordiyon */}
            {comparisonResult.matches.length > 0 && (
              <div>
                <div 
                  className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => toggleSection('matches')}
                >
                  <h3 className="text-md font-semibold text-green-900">
                    Eşleşen Kayıtlar ({comparisonResult.summary.totalMatches} adet)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">
                      {expandedSections.matches ? 'Gizle' : 'Göster'}
                    </span>
                    <svg 
                      className={`w-5 h-5 text-green-600 transition-transform ${expandedSections.matches ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {expandedSections.matches && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tarih
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Belge No
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            İşlem Türü
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Borç
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Alacak
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Borç
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Alacak
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Logo Alacak ↔ Excel Borç Farkı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Excel Alacak ↔ Logo Borç Farkı
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Durum
                          </th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResult.matches.map((match, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                            {match.excelCredit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {match.systemDebit.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                            {match.systemCredit.toLocaleString('tr-TR')} ₺
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
