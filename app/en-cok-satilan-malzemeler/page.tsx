'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnCokSatilanMalzemelerTable from '../components/tables/EnCokSatilanMalzemelerTable';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

// Yardımcı fonksiyon: Date'i 'YYYY-MM-DD' formatına çevir
function formatDateToYMD(date: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function EnCokSatilanMalzemeler() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFilterCodes, setLoadingFilterCodes] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  
  const router = useRouter();
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal state'i
  const [isParametersOpen, setIsParametersOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1:Tarih, 2:Analiz, 3:Özel Kodlar, 4:Görüntüleme

  const goNextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const goPrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // Rapor parametreleri - Bugünün tarihleri ile başlat
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFirstDayOfMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [sirala, setSirala] = useState('DESC'); // ASC veya DESC
  const [olcu, setOlcu] = useState('MIKTAR'); // MIKTAR veya TUTAR
  const [topCount, setTopCount] = useState(50);
  const [selectedTrCodes, setSelectedTrCodes] = useState(['7', '8']); // Perakende ve Toptan seçimleri
  const [ioCodeList, setIoCodeList] = useState('4');
  
  // Filtreler (Envanter raporundaki gibi selectedFilters state'i kullanacağız)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const selectedFiltersRef = useRef(selectedFilters);
  useEffect(() => { selectedFiltersRef.current = selectedFilters; }, [selectedFilters]);
  
  // Eski filtreler (backward compatibility için kalabilir)
  const [stGrpCode, setStGrpCode] = useState('');
  const [specode1, setSpecode1] = useState('');
  const [specode2, setSpecode2] = useState('');
  const [specode3, setSpecode3] = useState('');
  const [specode4, setSpecode4] = useState('');
  const [specode5, setSpecode5] = useState('');

  // Gelişmiş filtreler için state - artık kullanılmayacak, selectedFilters kullanacağız
  const [selectedGrupKodlari, setSelectedGrupKodlari] = useState<string[]>([]);
  const [selectedOzelKod1, setSelectedOzelKod1] = useState<string[]>([]);
  const [selectedOzelKod2, setSelectedOzelKod2] = useState<string[]>([]);
  const [selectedOzelKod3, setSelectedOzelKod3] = useState<string[]>([]);
  const [selectedOzelKod4, setSelectedOzelKod4] = useState<string[]>([]);
  const [selectedOzelKod5, setSelectedOzelKod5] = useState<string[]>([]);

  // Filtre seçenekleri için state - artık kullanılmayacak
  const [availableGrupKodlari, setAvailableGrupKodlari] = useState<string[]>([]);
  const [availableOzelKod1, setAvailableOzelKod1] = useState<string[]>([]);
  const [availableOzelKod2, setAvailableOzelKod2] = useState<string[]>([]);
  const [availableOzelKod3, setAvailableOzelKod3] = useState<string[]>([]);
  const [availableOzelKod4, setAvailableOzelKod4] = useState<string[]>([]);
  const [availableOzelKod5, setAvailableOzelKod5] = useState<string[]>([]);

  // Tüm özel kodlar için state yükle (Envanter gibi)
  const [filterCodes, setFilterCodes] = useState<any[]>([]);

  // Envanter raporundaki gibi toggle fonksiyonu
  const toggleFilterValue = (codeType: string, value: string) => {
    setSelectedFilters(prev => {
      const currentArr = prev[codeType] || [];
      if (currentArr.includes(value)) {
        return { ...prev, [codeType]: currentArr.filter(v => v !== value) };
      }
      return { ...prev, [codeType]: [...currentArr, value] };
    });
  };

  // Özel kod dropdown arama ve aç/kapa durumları
  const [openFilterDropdowns, setOpenFilterDropdowns] = useState<Record<string, boolean>>({});
  const [filterSearchTerms, setFilterSearchTerms] = useState<Record<string, string>>({});

  const toggleFilterDropdown = (codeType: string) => {
    setOpenFilterDropdowns(prev => ({ ...prev, [codeType]: !prev[codeType] }));
  };

  const setFilterSearch = (codeType: string, value: string) => {
    setFilterSearchTerms(prev => ({ ...prev, [codeType]: value }));
  };

  // Dropdown çoklu seçim değişimi
  const handleMultiSelectChange = (codeType: string, values: string[]) => {
    setSelectedFilters(prev => ({ ...prev, [codeType]: values }));
  };

  // Envanter raporundaki gibi kod tipi etiketleri
  const getCodeTypeLabel = (codeType: string) => {
    switch (codeType) {
      case 'STRGRPCODE':
        return 'Grup Kodu';
      case 'SPECODE':
        return 'Özel Kod';
      case 'SPECODE2':
        return 'Özel Kod 2';
      case 'SPECODE3':
        return 'Özel Kod 3';
      case 'SPECODE4':
        return 'Özel Kod 4';
      case 'SPECODE5':
        return 'Özel Kod 5';
      default:
        return codeType;
    }
  };

  // Özel kod grupları
  const codeTypes = [
    { key: 'STRGRPCODE', label: 'Grup Kodu', color: 'indigo' },
    { key: 'SPECODE', label: 'Özel Kod', color: 'red' },
    { key: 'SPECODE2', label: 'Özel Kod 2', color: 'orange' },
    { key: 'SPECODE3', label: 'Özel Kod 3', color: 'emerald' },
    { key: 'SPECODE4', label: 'Özel Kod 4', color: 'blue' },
    { key: 'SPECODE5', label: 'Özel Kod 5', color: 'purple' },
  ] as const;

  // TR Code seçim fonksiyonu
  const toggleTrCode = (code: string) => {
    setSelectedTrCodes(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  // Eski checkbox handlers - deprecated, toggle fonksiyonu kullanacağız
  const handleGrupKodChange = (kod: string) => {
    toggleFilterValue('STRGRPCODE', kod);
  };
  const handleOzelKod1Change = (kod: string) => {
    toggleFilterValue('SPECODE', kod);
  };
  const handleOzelKod2Change = (kod: string) => {
    toggleFilterValue('SPECODE2', kod);
  };
  const handleOzelKod3Change = (kod: string) => {
    toggleFilterValue('SPECODE3', kod);
  };
  const handleOzelKod4Change = (kod: string) => {
    toggleFilterValue('SPECODE4', kod);
  };
  const handleOzelKod5Change = (kod: string) => {
    toggleFilterValue('SPECODE5', kod);
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        // Sayfa görüntüleme tracking
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
        console.log('🔍 En Çok Satılan Malzemeler - Rapor erişim yetkisi kontrol ediliyor...');
        setIsCheckingAccess(true);

        const currentUser = getCurrentUser();
        if (!currentUser) {
          console.log('❌ Kullanıcı bilgisi bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den şirketin tüm raporlarını çek
        const companyRef = sessionStorage.getItem('companyRef');
        if (!companyRef) {
          console.log('❌ CompanyRef bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const {reports: allReports} = await fetchUserReports(companyRef, currentUser.id);
        
        // En çok satılan malzemeler raporu şirketin paketinde var mı kontrol et
        // Önce route bazında, sonra rapor adına göre ara
        const satilanMalzemelerRaporu = allReports.find(report => 
          report.route === 'en-cok-satilan-malzemeler' ||
          report.route_path === '/en-cok-satilan-malzemeler' ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('satılan') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('satış') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('satışlar')
        );
        
        if (!satilanMalzemelerRaporu) {
          console.log('❌ En çok satılan malzemeler raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasSatisAccess = satilanMalzemelerRaporu.has_access;
        
        console.log('📊 En çok satılan malzemeler raporu şirket paketinde:', !!satilanMalzemelerRaporu);
        console.log('🔐 En çok satılan malzemeler raporu erişim yetkisi:', hasSatisAccess);
        
        setHasAccess(hasSatisAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasSatisAccess) {
          console.log('❌ En çok satılan malzemeler raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=en-cok-satilan-malzemeler');
          return;
        }

      } catch (error) {
        console.error('❌ En Çok Satılan Malzemeler - Rapor erişimi kontrol edilirken hata:', error);
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
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri zaten mevcut (En Çok Satılan)');
          return;
        } catch (e) {
          console.log('⚠️ localStorage\'daki connection bilgileri geçersiz, yeniden alınacak');
        }
      }
      
      // localStorage'da yoksa API'den al
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('⚠️ CompanyRef bulunamadı');
        return;
      }

      try {
        console.log('🔄 Connection bilgileri önceden yükleniyor (En Çok Satılan)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (En Çok Satılan)');
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

  // Rapor verilerini çek
  const fetchReportData = async () => {
    console.log('🔄 En çok satılan malzemeler verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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

      const firmaNo = connectionInfo.first_firma_no || '5';
      const donemNo = connectionInfo.first_donem_no || '1';

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile satış verileri çekiliyor...`);

      // Tablo adları
      const tableSTLINE = `LG_${firmaNo.toString().padStart(3, '0')}_${donemNo.toString().padStart(2, '0')}_STLINE`;
      const tableITEMS = `LG_${firmaNo.toString().padStart(3, '0')}_ITEMS`;
      const specodesTable = `LG_${firmaNo.toString().padStart(3, '0')}_SPECODES`;

      // selectedFiltersRef.current kullan (async fonksiyon olduğu için)
      const currentFilters = selectedFiltersRef.current || {};
      
      // Envanter raporundaki gibi filtre koşulları oluştur
      const buildFilterConditions = () => {
        const conditions: string[] = [];
        
        // Grup Kodu filtresi
        if (currentFilters.STRGRPCODE && currentFilters.STRGRPCODE.length > 0) {
          const escaped = currentFilters.STRGRPCODE.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.STGRPCODE IN (${escaped})`);
        }
        
        // Özel Kod 1 filtresi  
        if (currentFilters.SPECODE && currentFilters.SPECODE.length > 0) {
          const escaped = currentFilters.SPECODE.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.SPECODE IN (${escaped})`);
        }
        
        // Özel Kod 2 filtresi
        if (currentFilters.SPECODE2 && currentFilters.SPECODE2.length > 0) {
          const escaped = currentFilters.SPECODE2.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.SPECODE2 IN (${escaped})`);
        }
        
        // Özel Kod 3 filtresi
        if (currentFilters.SPECODE3 && currentFilters.SPECODE3.length > 0) {
          const escaped = currentFilters.SPECODE3.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.SPECODE3 IN (${escaped})`);
        }
        
        // Özel Kod 4 filtresi
        if (currentFilters.SPECODE4 && currentFilters.SPECODE4.length > 0) {
          const escaped = currentFilters.SPECODE4.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.SPECODE4 IN (${escaped})`);
        }
        
        // Özel Kod 5 filtresi
        if (currentFilters.SPECODE5 && currentFilters.SPECODE5.length > 0) {
          const escaped = currentFilters.SPECODE5.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          conditions.push(`I.SPECODE5 IN (${escaped})`);
        }
        
        return conditions.length ? " AND " + conditions.join(" AND ") : "";
      };

      const filterConditions = buildFilterConditions();

      // Dinamik SQL oluştur
      const trCodeList = selectedTrCodes.join(',');
      const sqlQuery = `
DECLARE @FirmaNo INT = ${firmaNo};
DECLARE @DonemNo INT = ${donemNo};
DECLARE @StartDate DATE = '${startDate}';
DECLARE @EndDate DATE = '${endDate}';
DECLARE @Sirala NVARCHAR(4) = '${sirala}';
DECLARE @Olcu NVARCHAR(10) = '${olcu}';
DECLARE @TRCODE_LIST NVARCHAR(MAX) = '${trCodeList}';
DECLARE @IOCODE_LIST NVARCHAR(MAX) = '${ioCodeList}';
DECLARE @TopCount INT = ${topCount};

-- Eski metin filtreler
DECLARE @STGRPCODE NVARCHAR(25) = ${stGrpCode ? `'${stGrpCode}'` : 'NULL'};
DECLARE @SPECODE1 NVARCHAR(25) = ${specode1 ? `'${specode1}'` : 'NULL'};
DECLARE @SPECODE2 NVARCHAR(25) = ${specode2 ? `'${specode2}'` : 'NULL'};
DECLARE @SPECODE3 NVARCHAR(25) = ${specode3 ? `'${specode3}'` : 'NULL'};
DECLARE @SPECODE4 NVARCHAR(25) = ${specode4 ? `'${specode4}'` : 'NULL'};
DECLARE @SPECODE5 NVARCHAR(25) = ${specode5 ? `'${specode5}'` : 'NULL'};

-- Tablo adları
DECLARE @Table_STLINE NVARCHAR(100) = '${tableSTLINE}';
DECLARE @Table_ITEMS NVARCHAR(100) = '${tableITEMS}';
DECLARE @SpecodeTable NVARCHAR(100) = '${specodesTable}';

-- Dinamik SQL
DECLARE @SQL NVARCHAR(MAX);
SET @SQL = '
SELECT TOP (' + CAST(@TopCount AS NVARCHAR(10)) + ')
    I.CODE AS [Malzeme Kodu],
    I.NAME AS [Malzeme Adı],
    I.STGRPCODE AS [Grup Kodu],
    S7.DEFINITION_ AS [Grup Açıklama],
    CASE 
        WHEN I.SPECODE IS NOT NULL AND S1.DEFINITION_ IS NOT NULL THEN I.SPECODE + '' - '' + S1.DEFINITION_
        WHEN I.SPECODE IS NOT NULL THEN I.SPECODE
        ELSE NULL
    END AS [Özel Kod 1],
    CASE 
        WHEN I.SPECODE2 IS NOT NULL AND S2.DEFINITION_ IS NOT NULL THEN I.SPECODE2 + '' - '' + S2.DEFINITION_
        WHEN I.SPECODE2 IS NOT NULL THEN I.SPECODE2
        ELSE NULL
    END AS [Özel Kod 2],
    CASE 
        WHEN I.SPECODE3 IS NOT NULL AND S3.DEFINITION_ IS NOT NULL THEN I.SPECODE3 + '' - '' + S3.DEFINITION_
        WHEN I.SPECODE3 IS NOT NULL THEN I.SPECODE3
        ELSE NULL
    END AS [Özel Kod 3],
    CASE 
        WHEN I.SPECODE4 IS NOT NULL AND S4.DEFINITION_ IS NOT NULL THEN I.SPECODE4 + '' - '' + S4.DEFINITION_
        WHEN I.SPECODE4 IS NOT NULL THEN I.SPECODE4
        ELSE NULL
    END AS [Özel Kod 4],
    CASE 
        WHEN I.SPECODE5 IS NOT NULL AND S5.DEFINITION_ IS NOT NULL THEN I.SPECODE5 + '' - '' + S5.DEFINITION_
        WHEN I.SPECODE5 IS NOT NULL THEN I.SPECODE5
        ELSE NULL
    END AS [Özel Kod 5],
    SUM(S.AMOUNT) AS [Toplam Miktar],
    SUM(S.LINENET) AS [Toplam Tutar]
FROM ' + @Table_STLINE + ' S
INNER JOIN ' + @Table_ITEMS + ' I ON I.LOGICALREF = S.STOCKREF
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S7 WHERE I.STGRPCODE = S7.SPECODE AND S7.CODETYPE = 4 AND S7.SPECODETYPE = 0) S7
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S1 WHERE I.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1) S1
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S2 WHERE I.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1) S2
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S3 WHERE I.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1) S3
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S4 WHERE I.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1) S4
OUTER APPLY (SELECT DEFINITION_ FROM ' + @SpecodeTable + ' S5 WHERE I.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1) S5
WHERE 
    S.LINETYPE = 0
    AND S.CANCELLED = 0
    AND S.DATE_ BETWEEN @StartDate AND @EndDate
    AND S.TRCODE IN (' + @TRCODE_LIST + ')
    AND S.IOCODE IN (' + @IOCODE_LIST + ')
    AND (@STGRPCODE IS NULL OR I.STGRPCODE = @STGRPCODE)
    AND (@SPECODE1 IS NULL OR I.SPECODE = @SPECODE1)
    AND (@SPECODE2 IS NULL OR I.SPECODE2 = @SPECODE2)
    AND (@SPECODE3 IS NULL OR I.SPECODE3 = @SPECODE3)
    AND (@SPECODE4 IS NULL OR I.SPECODE4 = @SPECODE4)
    AND (@SPECODE5 IS NULL OR I.SPECODE5 = @SPECODE5)
    ${filterConditions}
GROUP BY 
    I.CODE, I.NAME, I.STGRPCODE,
    S7.DEFINITION_,
    I.SPECODE, S1.DEFINITION_,
    I.SPECODE2, S2.DEFINITION_,
    I.SPECODE3, S3.DEFINITION_,
    I.SPECODE4, S4.DEFINITION_,
    I.SPECODE5, S5.DEFINITION_
ORDER BY 
    CASE WHEN @Olcu = ''MIKTAR'' AND @Sirala = ''ASC'' THEN SUM(S.AMOUNT) END ASC,
    CASE WHEN @Olcu = ''MIKTAR'' AND @Sirala = ''DESC'' THEN SUM(S.AMOUNT) END DESC,
    CASE WHEN @Olcu = ''TUTAR'' AND @Sirala = ''ASC'' THEN SUM(S.LINENET) END ASC,
    CASE WHEN @Olcu = ''TUTAR'' AND @Sirala = ''DESC'' THEN SUM(S.LINENET) END DESC
';

-- EXEC
EXEC sp_executesql 
    @SQL,
    N'@StartDate DATE, @EndDate DATE, 
      @STGRPCODE NVARCHAR(25),
      @SPECODE1 NVARCHAR(25), @SPECODE2 NVARCHAR(25), @SPECODE3 NVARCHAR(25),
      @SPECODE4 NVARCHAR(25), @SPECODE5 NVARCHAR(25),
      @Sirala NVARCHAR(4), @Olcu NVARCHAR(10)',
    @StartDate = @StartDate,
    @EndDate = @EndDate,
    @STGRPCODE = @STGRPCODE,
    @SPECODE1 = @SPECODE1, @SPECODE2 = @SPECODE2,
    @SPECODE3 = @SPECODE3, @SPECODE4 = @SPECODE4, @SPECODE5 = @SPECODE5,
    @Sirala = @Sirala, @Olcu = @Olcu;

      `;

      // Debug: SQL sorgusunu logla
      console.log('🔍 Generated SQL Query:', sqlQuery);
      console.log('🔍 Active Filters:', currentFilters);
      console.log('🔍 Filter conditions:', filterConditions);

      // Direkt proxy'ye istek gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
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
        let errorMessage = 'Satış verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ En Çok Satılan API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          // JSON parse edilemezse response text'i al
          const errorText = await response.text();
          console.error('❌ En Çok Satılan API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
        return;
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setData(result.results);
        console.log('✅ En çok satılan malzemeler verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
        
        // Rapor oluşturma tracking
        const totalAmount = result.results.reduce((sum: number, item: any) => 
          sum + (parseFloat(item['Toplam Tutar']) || 0), 0);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setData(result.data);
        console.log('✅ En çok satılan malzemeler verileri başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }

    } catch (error: any) {
      console.error('❌ En çok satılan malzemeler verileri çekilirken hata:', error);
      
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
    await fetchReportData();
    setHasFetched(true);
    setIsParametersOpen(false); // Parametreleri kapat
  };

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchReportData();
      setHasFetched(true);
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      showErrorMessage('Cache temizlenirken bir hata oluştu!');
    }
  };

  // Filtre kodlarını yükle (envanter raporundaki gibi sayfaya girerken)
  const fetchFilterCodes = async () => {
    setLoadingFilterCodes(true);
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
  
      const connectionInfo = sessionStorage.getItem('connectionInfo');
      if (!connectionInfo) {
        showErrorMessage('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
      }
  
      const connData = JSON.parse(connectionInfo);
      const firmaNo = connData.first_firma_no || '5';
      const specodesTable = `LG_${firmaNo.toString().padStart(3, '0')}_SPECODES`;
      const itemsTable = `LG_${firmaNo.toString().padStart(3, '0')}_ITEMS`;
  
      const filterCodesQuery = `
      
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'STRGRPCODE' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 4 AND S.SPECODETYPE = 0

        UNION ALL

        -- SPECODE (Özel Kod 1)
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP1 = 1

        UNION ALL

        -- SPECODE2
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE2' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP2 = 1

        UNION ALL

        -- SPECODE3
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE3' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP3 = 1

        UNION ALL

        -- SPECODE4
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE4' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP4 = 1

        UNION ALL

        -- SPECODE5
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE5' AS [ALAN]
        FROM ${specodesTable} S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP5 = 1
        
        ORDER BY [ALAN], [KOD]
      `;
  
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: filterCodesQuery },
        'https://api.btrapor.com/proxy',
        600000 // 10 dakika timeout
      );
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Filtre seçenekleri API hatası:', errorText);
        showErrorMessage('Filtre seçenekleri yüklenemedi');
        return;
      }
  
      const result = await response.json();
      
            if (result.results && Array.isArray(result.results)) {
        setFilterCodes(result.results);
        console.log('✅ Filtreleme kodları başarıyla yüklendi');
        console.log('📊 Toplam filtreleme kodu sayısı:', result.results.length);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setFilterCodes(result.data);
        console.log('✅ Filtreleme kodları başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ Filtreleme kodları API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }
  
    } catch (error: any) {
      console.error('Filtreleme kodları yüklenirken hata:', error);
      
      if (error.name === 'AbortError') {
        showErrorMessage('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (error.message?.includes('Failed to fetch')) {
        showErrorMessage('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.');
      } else {
        showErrorMessage('Filtreleme kodları alınırken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoadingFilterCodes(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      fetchFilterCodes(); // Filtre kodlarını yükle (envanter raporundaki gibi)
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isParametersOpen) {
        setIsParametersOpen(false);
      }
    };

    if (isParametersOpen) {
      document.addEventListener('keydown', handleEscape);
      // Modal açıkken body scroll'unu engelle
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isParametersOpen]);

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="En Çok / En Az Satılan Malzemeler">
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
    <DashboardLayout title="En Çok / En Az Satılan Malzemeler">
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
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">En Çok / En Az Satılan Malzemeler</h2>
                <p className="text-red-100 text-sm">
                  Toplam Kayıt: {data.length} | Analiz Kriteri: {olcu === 'MIKTAR' ? 'Miktar' : 'Tutar'} | Sıralama: {sirala === 'ASC' ? 'En Az' : 'En Çok'} | 
                  Satış Türü: {selectedTrCodes.map(code => code === '7' ? 'Perakende' : 'Toptan').join(', ')}
                </p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col space-y-2">
              <div className="text-left lg:text-right">
                <p className="text-red-100 text-sm">Rapor Dönemi</p>
                <p className="text-lg lg:text-xl font-semibold text-white">{startDate} - {endDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Parametreler Butonu */}
        <button
          onClick={() => setIsParametersOpen(true)}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg shadow-lg p-4 flex items-center justify-between transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold">Rapor Parametreleri</h3>
              <p className="text-sm text-red-100">Filtreleri düzenlemek için tıklayın</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasFetched && (
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                Rapor Hazır
              </span>
            )}
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Modal Overlay */}
        {isParametersOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsParametersOpen(false);
              }
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Rapor Parametreleri</h3>
                    <p className="text-sm text-red-100">Tarih, analiz ve görüntüleme ayarları</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsParametersOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="space-y-3">
                  {/* Üst Satır: Tüm Temel Filtreler */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                      {/* Tarih Aralığı */}
                      <div className="lg:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tarih Aralığı</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Başlangıç</label>
                            <DatePicker value={startDate} onChange={(d) => setStartDate(formatDateToYMD(d))} />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">Bitiş</label>
                            <DatePicker value={endDate} onChange={(d) => setEndDate(formatDateToYMD(d))} />
                          </div>
                        </div>
                      </div>

                      {/* Analiz Kriteri */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kriter</label>
                        <div className="inline-flex bg-gray-50 rounded-md p-0.5 border border-gray-200 w-full">
                          <button type="button" onClick={() => setOlcu('MIKTAR')} className={`flex-1 px-2 py-1.5 text-xs font-medium rounded ${olcu === 'MIKTAR' ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Miktar</button>
                          <button type="button" onClick={() => setOlcu('TUTAR')} className={`flex-1 px-2 py-1.5 text-xs font-medium rounded ${olcu === 'TUTAR' ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Tutar</button>
                        </div>
                      </div>

                      {/* Sıralama */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Sıralama</label>
                        <div className="inline-flex bg-gray-50 rounded-md p-0.5 border border-gray-200 w-full">
                          <button type="button" onClick={() => setSirala('DESC')} className={`flex-1 px-2 py-1.5 text-xs font-medium rounded ${sirala === 'DESC' ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-white'}`}>En Çok</button>
                          <button type="button" onClick={() => setSirala('ASC')} className={`flex-1 px-2 py-1.5 text-xs font-medium rounded ${sirala === 'ASC' ? 'bg-red-600 text-white' : 'text-gray-700 hover:bg-white'}`}>En Az</button>
                        </div>
                      </div>

                      {/* Satış Türü */}
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Satış Türü</label>
                        <div className="flex gap-1.5">
                          <label className="flex-1 flex items-center bg-gray-50 rounded-md p-1.5 border border-gray-200 cursor-pointer hover:bg-gray-100">
                            <input type="checkbox" checked={selectedTrCodes.includes('7')} onChange={() => toggleTrCode('7')} className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5" />
                            <span className="ml-1.5 text-xs font-medium text-gray-700">Perakende</span>
                          </label>
                          <label className="flex-1 flex items-center bg-gray-50 rounded-md p-1.5 border border-gray-200 cursor-pointer hover:bg-gray-100">
                            <input type="checkbox" checked={selectedTrCodes.includes('8')} onChange={() => toggleTrCode('8')} className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5" />
                            <span className="ml-1.5 text-xs font-medium text-gray-700">Toptan</span>
                          </label>
                        </div>
                      </div>

                      {/* Kayıt Sayısı */}
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Kayıt</label>
                        <select value={topCount} onChange={(e) => setTopCount(Number(e.target.value))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-red-500 text-xs">
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Alt Satır: Özel Kodlar */}
                  <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-900">Özel Kodlar</h4>
                      <button type="button" onClick={() => setSelectedFilters({})} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">Temizle</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                      {codeTypes.map(ct => {
                        const options = filterCodes.filter(fc => fc.ALAN === ct.key);
                        const selected = selectedFilters[ct.key] || [];
                        if (!options || options.length === 0) return null;
                        const term = (filterSearchTerms[ct.key] || '').toLocaleLowerCase('tr-TR');
                        const filtered = term
                          ? options.filter((opt: any) =>
                              (opt.KOD || '').toLocaleLowerCase('tr-TR').includes(term) ||
                              (opt.AÇIKLAMA || '').toLocaleLowerCase('tr-TR').includes(term)
                            )
                          : options;
                        const isOpen = !!openFilterDropdowns[ct.key];
                        return (
                          <div key={ct.key} className="relative">
                            <label className="block text-[10px] font-medium text-gray-600 mb-1">{ct.label}</label>
                            <button
                              type="button"
                              onClick={() => toggleFilterDropdown(ct.key)}
                              className="w-full flex items-center justify-between px-2 py-1 bg-gray-50 border border-gray-300 rounded text-left text-xs hover:bg-white transition-colors"
                            >
                              <span className="truncate text-xs">
                                {selected.length > 0 ? `${selected.length}` : '-'}
                              </span>
                              <svg className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {isOpen && (
                              <div className="absolute z-50 mt-0.5 w-full bg-white border border-gray-200 rounded shadow-lg">
                                <div className="p-1 border-b border-gray-200">
                                  <input
                                    type="text"
                                    value={filterSearchTerms[ct.key] || ''}
                                    onChange={(e) => setFilterSearch(ct.key, e.target.value)}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                                  />
                                </div>
                                <div className="max-h-40 overflow-auto py-0.5">
                                  {filtered.length === 0 && (
                                    <div className="px-2 py-1 text-xs text-gray-500">Sonuç yok</div>
                                  )}
                                  {filtered.map((opt: any) => {
                                    const checked = selected.includes(opt.KOD);
                                    return (
                                      <label key={`${ct.key}-${opt.KOD}`} className="flex items-center px-2 py-1 gap-1 hover:bg-gray-50 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleFilterValue(ct.key, opt.KOD)}
                                          className="w-3 h-3 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-xs text-gray-800">
                                          <span className="font-medium">{opt.KOD}</span>
                                          {opt.AÇIKLAMA && <span className="text-gray-500 ml-1">- {opt.AÇIKLAMA}</span>}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between px-2 py-1 border-t border-gray-200 bg-gray-50">
                                  <button type="button" onClick={() => setSelectedFilters(prev => ({ ...prev, [ct.key]: [] }))} className="text-[10px] text-gray-600 hover:text-gray-800">Temizle</button>
                                  <button type="button" onClick={() => toggleFilterDropdown(ct.key)} className="text-[10px] text-red-600 hover:text-red-700 font-semibold">Tamam</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsParametersOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={clearCacheAndReload}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Yeniden Yükle
                </button>
                <button
                  onClick={async () => { 
                    await handleFetchReport(); 
                    setIsParametersOpen(false); 
                  }}
                  disabled={loading}
                  className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Yükleniyor...' : 'Raporu Getir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aktif Filtreler (Envanter raporundaki gibi) */}
        {hasFetched && Object.entries(selectedFilters).some(([, codes]) => codes.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <span className="text-blue-600">🔍</span>
                Aktif Filtreler
              </h3>
              <button
                onClick={() => setSelectedFilters({})}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                Tümünü Temizle
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedFilters).map(([codeType, codes]) =>
                codes.map(code => {
                  // Filtre kodundan açıklamayı bul
                  const filterCode = filterCodes.find(fc => fc.ALAN === codeType && fc.KOD === code);
                  const description = filterCode ? filterCode.AÇIKLAMA : '';
                  
                  return (
                    <div
                      key={`${codeType}-${code}`}
                      className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-3 py-2 rounded-lg border border-blue-200"
                    >
                      <span className="text-blue-600 mr-2">🏷️</span>
                      <span className="font-semibold">{getCodeTypeLabel(codeType)}:</span>
                      <span className="ml-1">{code}</span>
                      {description && (
                        <span className="ml-2 text-blue-600 text-xs opacity-75">
                          ({description})
                        </span>
                      )}
                      <button
                        onClick={() => toggleFilterValue(codeType, code)}
                        className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        ✖
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Sonuç Bilgisi */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span>✅</span>
              <span className="font-medium">
                {data.length} kayıt başarıyla getirildi - {olcu === 'MIKTAR' ? 'Miktar' : 'Tutar'} bazlı {sirala === 'ASC' ? 'en az' : 'en çok'} satılan malzemeler
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

        {/* Data Table (Envanter raporundaki gibi) */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              {animationData && (
                <div className="w-24 h-24 mb-4">
                  <Lottie animationData={animationData} loop={true} />
                </div>
              )}
              <p className="text-gray-600 font-medium">Satış verileri yükleniyor...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <EnCokSatilanMalzemelerTable 
              data={data}
              filterCodes={filterCodes}
              loadingFilterCodes={loadingFilterCodes}
              selectedFilters={selectedFilters}
              onToggleFilter={toggleFilterValue}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 