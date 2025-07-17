'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

// Modül kategorileri ve TR Kodları
const MODULE_CATEGORIES = [
  {
    moduleNr: 4,
    name: 'Fatura İşlemleri',
    description: 'Satış, satınalma ve hizmet faturaları',
    trCodes: [
      { code: 31, description: 'Satınalma Faturası' },
      { code: 32, description: 'Perakende Satış İade Faturası' },
      { code: 33, description: 'Toptan Satış İade Faturası' },
      { code: 34, description: 'Alınan Hizmet Faturası' },
      { code: 36, description: 'Satınalma İade Faturası' },
      { code: 37, description: 'Perakende Satış Faturası' },
      { code: 38, description: 'Toptan Satış Faturası' },
      { code: 39, description: 'Verilen Hizmet Faturası' },
      { code: 43, description: 'Satınalma Fiyat Farkı Faturası' },
      { code: 44, description: 'Satış Fiyat Farkı Faturası' },
      { code: 56, description: 'Müstahsil Makbuzu' }
    ]
  },
  {
    moduleNr: 5,
    name: 'Mali İşlemler',
    description: 'Nakit, dekont ve kredi kartı işlemleri',
    trCodes: [
      { code: 1, description: 'Nakit Tahsilat' },
      { code: 2, description: 'Nakit Ödeme' },
      { code: 3, description: 'Borç Dekontu' },
      { code: 4, description: 'Alacak Dekontu' },
      { code: 5, description: 'Virman Fişi' },
      { code: 6, description: 'Kur Farkı İşlemi' },
      { code: 12, description: 'Özel Fiş' },
      { code: 14, description: 'Açılış Fişi' },
      { code: 41, description: 'Verilen Vade Farkı Faturası' },
      { code: 42, description: 'Alınan Vade Farkı Faturası' },
      { code: 45, description: 'Verilen Serbest Meslek Makbuzu' },
      { code: 46, description: 'Alınan Serbest Meslek Makbuzu' },
      { code: 70, description: 'Kredi Kartı Fişi' },
      { code: 71, description: 'Kredi Kartı İade Fişi' },
      { code: 72, description: 'Firma Kredi Kartı Fişi' },
      { code: 73, description: 'Firma Kredi Kartı İade Fişi' }
    ]
  },
  {
    moduleNr: 6,
    name: 'Çek/Senet İşlemleri',
    description: 'Çek ve senet giriş/çıkış işlemleri',
    trCodes: [
      { code: 61, description: 'Çek Girişi' },
      { code: 62, description: 'Senet Girişi' },
      { code: 63, description: 'Çek Çıkışı(Cari Hesaba)' },
      { code: 64, description: 'Senet Çıkışı(Cari Hesaba)' },
      { code: 65, description: 'İşyerleri Arası İşlem Bordrosu(Müşteri Çeki)' },
      { code: 66, description: 'İşyerleri Arası İşlem Bordrosu(Müşteri Seneti)' }
    ]
  },
  {
    moduleNr: 7,
    name: 'Havale/EFT İşlemleri',
    description: 'Banka transferi ve döviz işlemleri',
    trCodes: [
      { code: 20, description: 'Gelen Havale/EFT' },
      { code: 21, description: 'Gönderilen Havale/EFT' },
      { code: 24, description: 'Döviz Alış Belgesi' },
      { code: 28, description: 'Alınan Hizmet Faturası' },
      { code: 29, description: 'Verilen Hizmet Faturası' },
      { code: 30, description: 'Müstahsil Makbuzu' }
    ]
  },
  {
    moduleNr: 10,
    name: 'Nakit İşlemler',
    description: 'Basit nakit tahsilat ve ödemeler',
    trCodes: [
      { code: 1, description: 'Nakit Tahsilat' },
      { code: 2, description: 'Nakit Ödeme' }
    ]
  }
];

// İşaret kodları
const SIGN_CODES = [
  { code: 0, description: 'Borç' },
  { code: 1, description: 'Alacak' }
];

export default function HareketGormeyenler() {
  // Ana veriler
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  
  // SQL Filtre parametreleri 
  const [lastDate, setLastDate] = useState('2025-06-01');
  const [allModules, setAllModules] = useState(true);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [allTRCodes, setAllTRCodes] = useState(true);
  const [selectedTRCodes, setSelectedTRCodes] = useState<number[]>([]);
  const [allSigns, setAllSigns] = useState(true);
  const [selectedSigns, setSelectedSigns] = useState<number[]>([]);
  
  // Frontend Cari Filtreleri
  const [cariFilters, setCariFilters] = useState({
    cariKoduInclude: '',
    cariKoduExclude: '',
    unvanInclude: '',
    unvanExclude: '',
    ozelKod1Include: [] as string[],
    ozelKod1Exclude: [] as string[],
    ozelKod1IncludePattern: '',
    ozelKod1ExcludePattern: '',
    ozelKod2Include: [] as string[],
    ozelKod2Exclude: [] as string[],
    ozelKod2IncludePattern: '',
    ozelKod2ExcludePattern: '',
    ozelKod3Include: [] as string[],
    ozelKod3Exclude: [] as string[],
    ozelKod3IncludePattern: '',
    ozelKod3ExcludePattern: '',
    ozelKod4Include: [] as string[],
    ozelKod4Exclude: [] as string[],
    ozelKod4IncludePattern: '',
    ozelKod4ExcludePattern: '',
    ozelKod5Include: [] as string[],
    ozelKod5Exclude: [] as string[],
    ozelKod5IncludePattern: '',
    ozelKod5ExcludePattern: ''
  });
  
  const [showCariFilters, setShowCariFilters] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  
  // Sayfalama state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const router = useRouter();
  
  // Animation data'ları
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);

  // Benzersiz özel kod değerlerini çıkar
  const uniqueSpecialCodes = useMemo(() => {
    const codes = {
      ozelKod1: new Set<string>(),
      ozelKod2: new Set<string>(),
      ozelKod3: new Set<string>(),
      ozelKod4: new Set<string>(),
      ozelKod5: new Set<string>()
    };

    data.forEach(row => {
      if (row['Ozel Kod 1']) codes.ozelKod1.add(row['Ozel Kod 1']);
      if (row['Ozel Kod 2']) codes.ozelKod2.add(row['Ozel Kod 2']);
      if (row['Ozel Kod 3']) codes.ozelKod3.add(row['Ozel Kod 3']);
      if (row['Ozel Kod 4']) codes.ozelKod4.add(row['Ozel Kod 4']);
      if (row['Ozel Kod 5']) codes.ozelKod5.add(row['Ozel Kod 5']);
    });

    return {
      ozelKod1: Array.from(codes.ozelKod1).sort(),
      ozelKod2: Array.from(codes.ozelKod2).sort(),
      ozelKod3: Array.from(codes.ozelKod3).sort(),
      ozelKod4: Array.from(codes.ozelKod4).sort(),
      ozelKod5: Array.from(codes.ozelKod5).sort()
    };
  }, [data]);

  // Frontend filtreleme
  useEffect(() => {
    if (!data.length) {
      setFilteredData([]);
      return;
    }

    let filtered = data.filter(row => {
      // Cari kodu filtreleri
      if (cariFilters.cariKoduExclude && row.CODE?.toLowerCase().includes(cariFilters.cariKoduExclude.toLowerCase())) {
        return false;
      }
      if (cariFilters.cariKoduInclude && !row.CODE?.toLowerCase().includes(cariFilters.cariKoduInclude.toLowerCase())) {
        return false;
      }

      // Ünvan filtreleri
      if (cariFilters.unvanExclude && row.DEFINITION_?.toLowerCase().includes(cariFilters.unvanExclude.toLowerCase())) {
        return false;
      }
      if (cariFilters.unvanInclude && !row.DEFINITION_?.toLowerCase().includes(cariFilters.unvanInclude.toLowerCase())) {
        return false;
      }

      // Özel kod filtreleri - hem checkbox hem pattern desteği
      const matchesPattern = (value: string, pattern: string): boolean => {
        if (!pattern) return true;
        
        // Wildcard (*) desteği
        if (pattern.includes('*')) {
          const regexPattern = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\\\*/g, '.*'); // Convert * to .*
          const regex = new RegExp(`^${regexPattern}$`, 'i');
          return regex.test(value);
        }
        
        // Normal string içerme kontrolü
        return value.toLowerCase().includes(pattern.toLowerCase());
      };

      const checkSpecialCode = (
        codeValue: string, 
        includeList: string[], 
        excludeList: string[],
        includePattern: string,
        excludePattern: string
      ) => {
        if (!codeValue) return true;
        
        // Önce exclude pattern kontrolü
        if (excludePattern && matchesPattern(codeValue, excludePattern)) {
          return false;
        }
        
        // Sonra exclude list kontrolü
        if (excludeList.length > 0 && excludeList.includes(codeValue)) {
          return false;
        }
        
        // Include pattern kontrolü
        if (includePattern && !matchesPattern(codeValue, includePattern)) {
          return false;
        }
        
        // Include list kontrolü
        if (includeList.length > 0 && !includeList.includes(codeValue)) {
          return false;
        }

        return true; // Hiçbir filtre yoksa veya tüm filtreler geçerse dahil et
      };

      if (!checkSpecialCode(row['Ozel Kod 1'], cariFilters.ozelKod1Include, cariFilters.ozelKod1Exclude, cariFilters.ozelKod1IncludePattern, cariFilters.ozelKod1ExcludePattern)) return false;
      if (!checkSpecialCode(row['Ozel Kod 2'], cariFilters.ozelKod2Include, cariFilters.ozelKod2Exclude, cariFilters.ozelKod2IncludePattern, cariFilters.ozelKod2ExcludePattern)) return false;
      if (!checkSpecialCode(row['Ozel Kod 3'], cariFilters.ozelKod3Include, cariFilters.ozelKod3Exclude, cariFilters.ozelKod3IncludePattern, cariFilters.ozelKod3ExcludePattern)) return false;
      if (!checkSpecialCode(row['Ozel Kod 4'], cariFilters.ozelKod4Include, cariFilters.ozelKod4Exclude, cariFilters.ozelKod4IncludePattern, cariFilters.ozelKod4ExcludePattern)) return false;
      if (!checkSpecialCode(row['Ozel Kod 5'], cariFilters.ozelKod5Include, cariFilters.ozelKod5Exclude, cariFilters.ozelKod5IncludePattern, cariFilters.ozelKod5ExcludePattern)) return false;

      return true;
    });

    setFilteredData(filtered);
    setCurrentPage(1); // Filtre değiştiğinde sayfa 1'e dön
  }, [data, cariFilters]);

  // Sayfalanmış veri hesaplama
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Sayfalama bilgileri
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startItem = filteredData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Kullanıcının rapor erişim yetkilerini kontrol et
  useEffect(() => {
    const checkReportAccess = async () => {
      try {
        console.log('🔍 Hareket Görmeyen Cariler - Rapor erişim yetkisi kontrol ediliyor...');
        setIsCheckingAccess(true);

        const currentUser = getCurrentUser();
        if (!currentUser) {
          console.log('❌ Kullanıcı bilgisi bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den şirketin tüm raporlarını çek
        const companyRef = localStorage.getItem('companyRef');
        if (!companyRef) {
          console.log('❌ CompanyRef bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const {reports: allReports} = await fetchUserReports(companyRef, currentUser.id);
        
        // Hareket görmeyen cariler raporu şirketin paketinde var mı kontrol et
        const hareketGormeyenlerReport = allReports.find(report => 
          report.report_name.toLowerCase().includes('hareket') && 
          report.report_name.toLowerCase().includes('görmeyen') ||
          report.report_name.toLowerCase().includes('cari') && 
          report.report_name.toLowerCase().includes('hareket')
        );
        
        if (!hareketGormeyenlerReport) {
          console.log('❌ Hareket Görmeyen Cariler raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasAccess = hareketGormeyenlerReport.has_access;
        
        console.log('📊 Hareket Görmeyen Cariler raporu şirket paketinde:', !!hareketGormeyenlerReport);
        console.log('🔐 Hareket Görmeyen Cariler raporu erişim yetkisi:', hasAccess);
        
        setHasAccess(hasAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasAccess) {
          console.log('❌ Hareket Görmeyen Cariler raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=hareket-gormeyenler');
          return;
        }

      } catch (error) {
        console.error('❌ Hareket Görmeyen Cariler - Rapor erişimi kontrol edilirken hata:', error);
        setHasAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkReportAccess();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Rapor animasyonunu yükle
      fetch('/animations/rapor.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.log('Rapor animation yüklenemedi:', err));
      
      // Failed animasyonunu yükle
      fetch('/animations/failed.json')
        .then(res => res.json())
        .then(data => setFailedAnimationData(data))
        .catch(err => console.log('Failed animation yüklenemedi:', err));
    }
  }, [isAuthenticated]);

  // Connection bilgilerini önceden getir
  useEffect(() => {
    const preloadConnectionInfo = async () => {
      if (!isAuthenticated) return;
      
      // Önce localStorage'dan kontrol et
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri zaten mevcut (Hareket Görmeyen Cariler)');
          return;
        } catch (e) {
          console.log('⚠️ localStorage\'daki connection bilgileri geçersiz, yeniden alınacak');
        }
      }
      
      // localStorage'da yoksa API'den al
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('⚠️ CompanyRef bulunamadı');
        return;
      }

      try {
        console.log('🔄 Connection bilgileri önceden yükleniyor (Hareket Görmeyen Cariler)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Hareket Görmeyen Cariler)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // Hata mesajı göster
  const showErrorMessage = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    
    // 5 saniye sonra hata mesajını gizle
    setTimeout(() => {
      setShowError(false);
      setErrorMessage('');
    }, 5000);
  };

  // Hareket görmeyen cariler verilerini çek
  const fetchHareketGormeyenlerData = async () => {
    console.log('🔄 Hareket görmeyen cariler verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } catch (e) {
          console.error('Connection bilgileri parse edilemedi:', e);
          showErrorMessage('Bağlantı bilgileri geçersiz. Lütfen tekrar giriş yapın.');
          return;
        }
      }

      if (!connectionInfo) {
        showErrorMessage('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
      }

      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile hareket görmeyen cariler verileri çekiliyor...`);

      // SQL sorgusu parametrelerini hazırla
      const formattedDate = `${lastDate} 00:00:00.000`;
      
      // Modül filtresi
      const modulesCondition = allModules ? '' : 
        selectedModules.length > 0 ? `AND MODULENR IN (${selectedModules.join(',')})` : '';
      
      // TR kod filtresi
      const trCodesCondition = allTRCodes ? '' : 
        selectedTRCodes.length > 0 ? `AND TRCODE IN (${selectedTRCodes.join(',')})` : '';
      
      // İşaret filtresi
      const signsCondition = allSigns ? '' : 
        selectedSigns.length > 0 ? `AND SIGN IN (${selectedSigns.join(',')})` : '';

      // Güncellenmiş SQL sorgusu
      const sqlQuery = `
        DECLARE @LASTDATE DATETIME = '${formattedDate}';

        SELECT 
            C.LOGICALREF, 
            C.CODE, 
            C.DEFINITION_,

            C.SPECODE     AS [Ozel Kod 1],
            S1.DEFINITION_ AS [Ozel Kod 1 Açıklama],

            C.SPECODE2    AS [Ozel Kod 2],
            S2.DEFINITION_ AS [Ozel Kod 2 Açıklama],

            C.SPECODE3    AS [Ozel Kod 3],
            S3.DEFINITION_ AS [Ozel Kod 3 Açıklama],

            C.SPECODE4    AS [Ozel Kod 4],
            S4.DEFINITION_ AS [Ozel Kod 4 Açıklama],

            C.SPECODE5    AS [Ozel Kod 5],
            S5.DEFINITION_ AS [Ozel Kod 5 Açıklama],

            C.CYPHCODE    AS [Yetki Kodu],
            Y.DEFINITION_ AS [Yetki Kodu Açıklama]

        FROM LG_${firmaNo.padStart(3, '0')}_CLCARD C
        LEFT JOIN (
            SELECT DISTINCT CLIENTREF
            FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_CLFLINE
            WHERE 
                DATE_ >= @LASTDATE
                AND CANCELLED = 0
                AND TRCODE > 0
                AND (
                    ${allModules ? '1 = 1' : selectedModules.length > 0 ? `MODULENR IN (${selectedModules.join(',')})` : '1 = 0'}
                )
                AND (
                    ${allTRCodes ? '1 = 1' : selectedTRCodes.length > 0 ? `TRCODE IN (${selectedTRCodes.join(',')})` : '1 = 0'}
                )
                AND (
                    ${allSigns ? '1 = 1' : selectedSigns.length > 0 ? `SIGN IN (${selectedSigns.join(',')})` : '1 = 0'}
                )
        ) AS H ON C.LOGICALREF = H.CLIENTREF

        -- Özel Kod 1-5 Açıklamaları
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.SPECODE 
              AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP1 = 1
        ) S1
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.SPECODE2 
              AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP2 = 1
        ) S2
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.SPECODE3 
              AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP3 = 1
        ) S3
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.SPECODE4 
              AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP4 = 1
        ) S4
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.SPECODE5 
              AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP5 = 1
        ) S5

        -- Yetki Kodu Açıklaması
        OUTER APPLY (
            SELECT DEFINITION_ 
            FROM LG_${firmaNo.padStart(3, '0')}_SPECODES 
            WHERE SPECODE = C.CYPHCODE 
              AND CODETYPE = 2 AND SPECODETYPE = 26
        ) Y

        WHERE C.ACTIVE = 0
          AND H.CLIENTREF IS NULL
        ORDER BY C.DEFINITION_;
      `;

      console.log('🔍 SQL Sorgusu:', sqlQuery);

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
        showErrorMessage('Proxy sunucusuna erişilemiyor. Lütfen sistem yöneticinize başvurun.');
        return;
      }

      if (!response.ok) {
        let errorMessage = 'Hareket görmeyen cariler verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          // JSON parse edilemezse response text'i al
          const errorText = await response.text();
          console.error('❌ API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
        return;
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setData(result.results);
        console.log('✅ Hareket görmeyen cariler verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setData(result.data);
        console.log('✅ Hareket görmeyen cariler verileri başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }

    } catch (error: any) {
      console.error('❌ Hareket görmeyen cariler verileri çekilirken hata:', error);
      
      if (error.name === 'AbortError') {
        showErrorMessage('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (error.message?.includes('Failed to fetch')) {
        showErrorMessage('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.');
      } else {
        showErrorMessage('Veriler alınırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    await fetchHareketGormeyenlerData();
    setHasFetched(true);
  };

  // Module toggle
  const toggleModule = (moduleNr: number) => {
    setSelectedModules(prev => 
      prev.includes(moduleNr) 
        ? prev.filter(m => m !== moduleNr)
        : [...prev, moduleNr]
    );
  };

  // TR Code toggle
  const toggleTRCode = (code: number) => {
    setSelectedTRCodes(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  // Sign toggle
  const toggleSign = (sign: number) => {
    setSelectedSigns(prev => 
      prev.includes(sign) 
        ? prev.filter(s => s !== sign)
        : [...prev, sign]
    );
  };

  // Seçili modüllere göre TR kodlarını getir
  const getAvailableTRCodes = () => {
    if (allModules) {
      return MODULE_CATEGORIES.flatMap(cat => cat.trCodes);
    }
    
    return MODULE_CATEGORIES
      .filter(cat => selectedModules.includes(cat.moduleNr))
      .flatMap(cat => cat.trCodes);
  };

  // Cari filtre helper fonksiyonları
  const updateCariFilter = (field: keyof typeof cariFilters, value: any) => {
    setCariFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSpecialCodeFilter = (codeType: 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5', filterType: 'Include' | 'Exclude', value: string) => {
    const fieldName = `${codeType}${filterType}` as keyof typeof cariFilters;
    const currentList = cariFilters[fieldName] as string[];
    
    updateCariFilter(fieldName, 
      currentList.includes(value) 
        ? currentList.filter(v => v !== value)
        : [...currentList, value]
    );
  };

  // Filtreleri temizle
  const clearCariFilters = () => {
    setCariFilters({
      cariKoduInclude: '',
      cariKoduExclude: '',
      unvanInclude: '',
      unvanExclude: '',
      ozelKod1Include: [],
      ozelKod1Exclude: [],
      ozelKod1IncludePattern: '',
      ozelKod1ExcludePattern: '',
      ozelKod2Include: [],
      ozelKod2Exclude: [],
      ozelKod2IncludePattern: '',
      ozelKod2ExcludePattern: '',
      ozelKod3Include: [],
      ozelKod3Exclude: [],
      ozelKod3IncludePattern: '',
      ozelKod3ExcludePattern: '',
      ozelKod4Include: [],
      ozelKod4Exclude: [],
      ozelKod4IncludePattern: '',
      ozelKod4ExcludePattern: '',
      ozelKod5Include: [],
      ozelKod5Exclude: [],
      ozelKod5IncludePattern: '',
      ozelKod5ExcludePattern: ''
    });
  };

  // Aktif filtre sayısı
  const getActiveFilterCount = () => {
    let count = 0;
    if (cariFilters.cariKoduInclude) count++;
    if (cariFilters.cariKoduExclude) count++;
    if (cariFilters.unvanInclude) count++;
    if (cariFilters.unvanExclude) count++;
    
    Object.entries(cariFilters).forEach(([key, value]) => {
      if (!['cariKoduInclude', 'cariKoduExclude', 'unvanInclude', 'unvanExclude'].includes(key)) {
        // Array filtreleri (checkbox lists)
        if (Array.isArray(value) && value.length > 0) {
          count++;
        }
        // String filtreleri (pattern fields)
        else if (typeof value === 'string' && value.trim()) {
          count++;
        }
      }
    });
    
    return count;
  };

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Hareket Görmeyen Cariler">
        <div className="flex items-center justify-center min-h-screen">
          {animationData && (
            <div className="w-96 h-96">
              <Lottie animationData={animationData} loop={true} />
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (!hasAccess) {
    return null; // Router zaten dashboard'a yönlendirecek
  }

  return (
    <DashboardLayout title="Hareket Görmeyen Cariler">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 rounded-lg shadow p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <img 
                src="/img/btRapor.png" 
                alt="btRapor Logo" 
                className="h-12 lg:h-16 w-auto mb-4 lg:mb-0 lg:mr-6 bg-white rounded-lg p-2 self-start"
              />
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">Hareket Görmeyen Cariler</h2>
                <p className="text-red-100 text-sm">
                  {lastDate} tarihinden sonra hareket görmemiş cariler | 
                  Ham Veri: {data.length} | 
                  Filtrelenmiş: {filteredData.length}
                </p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col space-y-2">
              <div className="text-left lg:text-right">
                <p className="text-red-100 text-sm">Bugün</p>
                <p className="text-lg lg:text-xl font-semibold text-white">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleFetchReport}
                  disabled={loading}
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>📊</span>
                  Raporu Getir
                </button>
                {data.length > 0 && (
                  <button
                    onClick={() => setShowCariFilters(!showCariFilters)}
                    className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <span>🔍</span>
                    Cari Filtreleri
                    {getActiveFilterCount() > 0 && (
                      <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        {getActiveFilterCount()}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SQL Filtre Parametreleri */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <span>🎯</span>
            Filtre Parametreleri
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sol taraf: Tarih ve Modül */}
            <div className="space-y-6">
              {/* Tarih Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Son Hareket Tarihi
                </label>
                <input
                  type="date"
                  value={lastDate}
                  onChange={(e) => setLastDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bu tarihten sonra hareket görmemiş cariler gösterilecek
                </p>
              </div>

              {/* Modül Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşlem Modülleri
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allModules}
                      onChange={(e) => {
                        setAllModules(e.target.checked);
                        if (e.target.checked) {
                          setSelectedModules([]);
                          setAllTRCodes(true);
                          setSelectedTRCodes([]);
                        }
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 font-medium">Tüm Modüller</span>
                  </label>
                  
                  {!allModules && (
                    <div className="max-h-40 overflow-y-auto space-y-2 border rounded p-3">
                      {MODULE_CATEGORIES.map(module => (
                        <label key={module.moduleNr} className="flex items-start">
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(module.moduleNr)}
                            onChange={() => toggleModule(module.moduleNr)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5"
                          />
                          <div className="ml-2">
                            <div className="text-sm font-medium text-gray-800">{module.name}</div>
                            <div className="text-xs text-gray-500">{module.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sağ taraf: TR Kodları ve İşaretler */}
            <div className="space-y-6">
              {/* TR Code Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşlem Türleri
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allTRCodes}
                      onChange={(e) => {
                        setAllTRCodes(e.target.checked);
                        if (e.target.checked) {
                          setSelectedTRCodes([]);
                        }
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 font-medium">Tüm İşlem Türleri</span>
                  </label>
                  
                  {!allTRCodes && (
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                      {getAvailableTRCodes().map(trCode => (
                        <label key={`${trCode.code}`} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedTRCodes.includes(trCode.code)}
                            onChange={() => toggleTRCode(trCode.code)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="ml-2 text-xs text-gray-600">
                            {trCode.code} - {trCode.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sign Seçimi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşaret Türü
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allSigns}
                      onChange={(e) => {
                        setAllSigns(e.target.checked);
                        if (e.target.checked) {
                          setSelectedSigns([]);
                        }
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 font-medium">Tüm İşaretler</span>
                  </label>
                  
                  {!allSigns && (
                    <div className="space-y-1">
                      {SIGN_CODES.map(signCode => (
                        <label key={signCode.code} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedSigns.includes(signCode.code)}
                            onChange={() => toggleSign(signCode.code)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            {signCode.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Frontend Cari Filtreleri */}
        {showCariFilters && data.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <span>🔍</span>
                Cari Filtreleri
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={clearCariFilters}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Filtreleri Temizle
                </button>
                <button
                  onClick={() => setShowCariFilters(false)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  Kapat
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Metin Filtreleri */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cari Kodu Filtreleri
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-green-700 font-medium mb-1">Dahil Et:</div>
                      <input
                        type="text"
                        value={cariFilters.cariKoduInclude}
                        onChange={(e) => updateCariFilter('cariKoduInclude', e.target.value)}
                        placeholder="Cari kodunda ara..."
                        className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-red-700 font-medium mb-1">Hariç Tut:</div>
                      <input
                        type="text"
                        value={cariFilters.cariKoduExclude}
                        onChange={(e) => updateCariFilter('cariKoduExclude', e.target.value)}
                        placeholder="Hariç tutulacak kodlar..."
                        className="w-full px-2 py-1 text-sm border border-red-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cari Ünvan Filtreleri
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-green-700 font-medium mb-1">Dahil Et:</div>
                      <input
                        type="text"
                        value={cariFilters.unvanInclude}
                        onChange={(e) => updateCariFilter('unvanInclude', e.target.value)}
                        placeholder="Ünvanda ara..."
                        className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-red-700 font-medium mb-1">Hariç Tut:</div>
                      <input
                        type="text"
                        value={cariFilters.unvanExclude}
                        onChange={(e) => updateCariFilter('unvanExclude', e.target.value)}
                        placeholder="Hariç tutulacak ünvanlar..."
                        className="w-full px-2 py-1 text-sm border border-red-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Özel Kod Filtreleri */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(codeNum => {
                  const codeType = `ozelKod${codeNum}` as 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5';
                  const availableCodes = uniqueSpecialCodes[codeType];
                  
                  if (availableCodes.length === 0) return null;

                  return (
                    <div key={codeNum}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Özel Kod {codeNum}
                      </label>
                      
                      {/* Pattern Filtreleri */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-green-700 font-medium mb-1">Dahil Et Pattern (*, abc*):</div>
                          <input
                            type="text"
                            value={cariFilters[`${codeType}IncludePattern` as keyof typeof cariFilters] as string}
                            onChange={(e) => updateCariFilter(`${codeType}IncludePattern` as keyof typeof cariFilters, e.target.value)}
                            placeholder="abc* veya *xyz"
                            className="w-full px-2 py-1 text-xs border border-green-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-red-700 font-medium mb-1">Hariç Tut Pattern (*, abcd*):</div>
                          <input
                            type="text"
                            value={cariFilters[`${codeType}ExcludePattern` as keyof typeof cariFilters] as string}
                            onChange={(e) => updateCariFilter(`${codeType}ExcludePattern` as keyof typeof cariFilters, e.target.value)}
                            placeholder="abcd* veya *test"
                            className="w-full px-2 py-1 text-xs border border-red-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Aktif Filtreler Gösterimi */}
        {hasFetched && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <span className="text-blue-600">🔍</span>
                Aktif Filtreler
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Son Hareket Tarihi:</span>
                <span className="ml-2 text-blue-700">{lastDate}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Modüller:</span>
                <span className="ml-2 text-blue-700">
                  {allModules ? 'Hepsi' : selectedModules.length > 0 ? `${selectedModules.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">İşlem Türleri:</span>
                <span className="ml-2 text-blue-700">
                  {allTRCodes ? 'Hepsi' : selectedTRCodes.length > 0 ? `${selectedTRCodes.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">İşaret:</span>
                <span className="ml-2 text-blue-700">
                  {allSigns ? 'Hepsi' : selectedSigns.length > 0 ? `${selectedSigns.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
            </div>
            
            {/* Frontend Filtre Özeti */}
            {getActiveFilterCount() > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-blue-800">Frontend Filtreleri:</span>
                  <span className="text-blue-700">{getActiveFilterCount()} aktif filtre</span>
                  <span className="text-blue-600">→</span>
                  <span className="font-medium text-blue-800">{filteredData.length} / {data.length} kayıt gösteriliyor</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sonuç Bilgi Kartı */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span>✅</span>
              <span className="font-medium">
                Toplam {data.length} hareket görmeyen cari bulundu
                {getActiveFilterCount() > 0 && `, ${filteredData.length} tanesi filtreleme sonrası gösteriliyor`}
              </span>
            </div>
          </div>
        )}

        {/* Hata mesajı */}
        {showError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow" role="alert">
            <div className="flex">
              <div className="flex-shrink-0">
                {failedAnimationData && (
                  <div className="w-6 h-6">
                    <Lottie animationData={failedAnimationData} loop={false} />
                  </div>
                )}
              </div>
              <div className="ml-3">
                <p>{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Hareket Görmeyen Cariler Raporu</h3>
              <p className="text-sm text-gray-500">Belirtilen tarihten sonra hareket görmemiş cari hesapları görüntüleyin</p>
              {data.length > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  💡 Rapor geldikten sonra "Cari Filtreleri" butonu ile ek filtreleme yapabilirsiniz
                </p>
              )}
            </div>
            <button
              onClick={handleFetchReport}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Raporu Getir
                </>
              )}
            </button>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              {animationData && (
                <div className="w-24 h-24 mb-4">
                  <Lottie animationData={animationData} loop={true} />
                </div>
              )}
              <p className="text-gray-600 font-medium">Hareket görmeyen cariler yükleniyor...</p>
            </div>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cari Kodu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cari Adı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 2
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 3
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 4
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 5
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Yetki Kodu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.CODE}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.DEFINITION_}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 1']}</div>
                          {row['Ozel Kod 1 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 1 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 2']}</div>
                          {row['Ozel Kod 2 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 2 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 3']}</div>
                          {row['Ozel Kod 3 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 3 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 4']}</div>
                          {row['Ozel Kod 4 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 4 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 5']}</div>
                          {row['Ozel Kod 5 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 5 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Yetki Kodu']}</div>
                          {row['Yetki Kodu Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Yetki Kodu Açıklama']}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Sayfalama ve Özet Bilgi */}
            {filteredData.length > 0 && (
              <div className="bg-white border-t px-4 py-3 flex items-center justify-between sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{startItem}</span> - <span className="font-medium">{endItem}</span> arası, 
                      toplam <span className="font-medium">{filteredData.length}</span> kayıt
                    </p>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Sayfa başına:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">İlk sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Önceki sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* Sayfa numaraları */}
                      {(() => {
                        const pages = [];
                        const showRange = 2; // Her iki tarafta gösterilecek sayfa sayısı
                        let startPage = Math.max(1, currentPage - showRange);
                        let endPage = Math.min(totalPages, currentPage + showRange);
                        
                        // İlk sayfalar
                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              onClick={() => setCurrentPage(1)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(
                              <span key="start-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            );
                          }
                        }
                        
                        // Orta sayfalar
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                i === currentPage
                                  ? 'z-10 bg-red-50 border-red-500 text-red-600'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Son sayfalar
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            );
                          }
                          pages.push(
                            <button
                              key={totalPages}
                              onClick={() => setCurrentPage(totalPages)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {totalPages}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Sonraki sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Son sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm-6 0a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : hasFetched ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {data.length > 0 ? 'Filtre sonucu kayıt bulunamadı' : 'Hareket görmeyen cari bulunamadı'}
              </h3>
              <p className="text-gray-500">
                {data.length > 0 
                  ? 'Filtreleri değiştirip tekrar deneyin veya filtreleri temizleyin'
                  : 'Seçilen kriterlere göre hareket görmeyen cari bulunmuyor'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Henüz veri yok</h3>
              <p className="text-gray-500">Raporu getirmek için yukarıdaki butona tıklayın</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 