'use client';

import { useState, useEffect } from 'react';
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
  const [loadingFilters, setLoadingFilters] = useState(false);
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

  // Rapor parametreleri
  const [startDate, setStartDate] = useState('2025-07-01');
  const [endDate, setEndDate] = useState('2025-07-14');
  const [sirala, setSirala] = useState('DESC'); // ASC veya DESC
  const [olcu, setOlcu] = useState('MIKTAR'); // MIKTAR veya TUTAR
  const [topCount, setTopCount] = useState(50);
  const trCodeList = '7,8'; // Sabit, kullanıcıya gösterilmiyor
  const [ioCodeList, setIoCodeList] = useState('4');
  
  // Filtreler
  const [stGrpCode, setStGrpCode] = useState('');
  const [specode1, setSpecode1] = useState('');
  const [specode2, setSpecode2] = useState('');
  const [specode3, setSpecode3] = useState('');
  const [specode4, setSpecode4] = useState('');
  const [specode5, setSpecode5] = useState('');

  // Gelişmiş filtreler için state
  const [selectedGrupKodlari, setSelectedGrupKodlari] = useState<string[]>([]);
  const [selectedOzelKod1, setSelectedOzelKod1] = useState<string[]>([]);

  // Filtre seçenekleri için state
  const [availableGrupKodlari, setAvailableGrupKodlari] = useState<string[]>([]);
  const [availableOzelKod1, setAvailableOzelKod1] = useState<string[]>([]);

  // Checkbox filtreleme fonksiyonları
  const handleGrupKodChange = (kod: string) => {
    setSelectedGrupKodlari(prev =>
      prev.includes(kod) ? prev.filter(k => k !== kod) : [...prev, kod]
    );
  };
  const handleOzelKod1Change = (kod: string) => {
    setSelectedOzelKod1(prev =>
      prev.includes(kod) ? prev.filter(k => k !== kod) : [...prev, kod]
    );
  };

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
        const companyRef = localStorage.getItem('companyRef');
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
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
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
      const companyRef = localStorage.getItem('companyRef');
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
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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

      const firmaNo = connectionInfo.first_firma_no || '5';
      const donemNo = connectionInfo.first_donem_no || '1';

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile satış verileri çekiliyor...`);

      // Tablo adları
      const tableSTLINE = `LG_${firmaNo.toString().padStart(3, '0')}_${donemNo.toString().padStart(2, '0')}_STLINE`;
      const tableITEMS = `LG_${firmaNo.toString().padStart(3, '0')}_ITEMS`;
      const specodesTable = `LG_${firmaNo.toString().padStart(3, '0')}_SPECODES`;

      // Dinamik SQL oluştur
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

-- Filtreler
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
        WHEN I.SPECODE IS NOT NULL AND S1.DEFINITION_ IS NOT NULL 
        THEN I.SPECODE + '' - '' + S1.DEFINITION_
        WHEN I.SPECODE IS NOT NULL 
        THEN I.SPECODE
        ELSE NULL
    END AS [Özel Kod 1],
    CASE 
        WHEN I.SPECODE2 IS NOT NULL AND S2.DEFINITION_ IS NOT NULL 
        THEN I.SPECODE2 + '' - '' + S2.DEFINITION_
        WHEN I.SPECODE2 IS NOT NULL 
        THEN I.SPECODE2
        ELSE NULL
    END AS [Özel Kod 2],
    CASE 
        WHEN I.SPECODE3 IS NOT NULL AND S3.DEFINITION_ IS NOT NULL 
        THEN I.SPECODE3 + '' - '' + S3.DEFINITION_
        WHEN I.SPECODE3 IS NOT NULL 
        THEN I.SPECODE3
        ELSE NULL
    END AS [Özel Kod 3],
    CASE 
        WHEN I.SPECODE4 IS NOT NULL AND S4.DEFINITION_ IS NOT NULL 
        THEN I.SPECODE4 + '' - '' + S4.DEFINITION_
        WHEN I.SPECODE4 IS NOT NULL 
        THEN I.SPECODE4
        ELSE NULL
    END AS [Özel Kod 4],
    CASE 
        WHEN I.SPECODE5 IS NOT NULL AND S5.DEFINITION_ IS NOT NULL 
        THEN I.SPECODE5 + '' - '' + S5.DEFINITION_
        WHEN I.SPECODE5 IS NOT NULL 
        THEN I.SPECODE5
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

-- EXECUTE
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
  };

  // Filtre seçeneklerini yükle
  const fetchFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
  
      const connectionInfo = localStorage.getItem('connectionInfo');
      if (!connectionInfo) {
        showErrorMessage('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
      }
  
      const connData = JSON.parse(connectionInfo);
      const firmaNo = connData.first_firma_no || '5';
      const specodesTable = `LG_${firmaNo.toString().padStart(3, '0')}_SPECODES`;
      const itemsTable = `LG_${firmaNo.toString().padStart(3, '0')}_ITEMS`;
  
      const filterOptionsQuery = `
        -- Grup Kodları
        SELECT DISTINCT 
          I.STGRPCODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'GRUP' AS [TIP]
        FROM ${itemsTable} I
        LEFT JOIN ${specodesTable} S ON I.STGRPCODE = S.SPECODE AND S.CODETYPE = 4 AND S.SPECODETYPE = 0
        WHERE I.STGRPCODE IS NOT NULL AND I.STGRPCODE != ''
  
        UNION ALL
  
        -- Özel Kod 1
        SELECT DISTINCT 
          I.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'OZEL1' AS [TIP]
        FROM ${itemsTable} I
        LEFT JOIN ${specodesTable} S ON I.SPECODE = S.SPECODE AND S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP1 = 1
        WHERE I.SPECODE IS NOT NULL AND I.SPECODE != ''
  
        ORDER BY [TIP], [KOD]
      `;
  
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: filterOptionsQuery },
        'https://api.btrapor.com/proxy',
        60000 // 1 dakika timeout
      );
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Filtre seçenekleri API hatası:', errorText);
        showErrorMessage('Filtre seçenekleri yüklenemedi');
        return;
      }
  
      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
               const grupKodlari = result.results
         .filter((item: any) => item.TIP === 'GRUP')
         .map((item: any) => item.KOD)
         .sort();
       
       const ozelKod1ler = result.results
         .filter((item: any) => item.TIP === 'OZEL1')
         .map((item: any) => item.KOD)
         .sort();
        
        setAvailableGrupKodlari(grupKodlari);
        setAvailableOzelKod1(ozelKod1ler);
        
        console.log('✅ Filtre seçenekleri yüklendi');
        console.log('📊 Grup kodları:', grupKodlari.length);
        console.log('📊 Özel kod 1:', ozelKod1ler.length);
      }
  
    } catch (error: any) {
      console.error('❌ Filtre seçenekleri yüklenirken hata:', error);
      showErrorMessage('Filtre seçenekleri yüklenirken hata oluştu');
    } finally {
      setLoadingFilters(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      fetchFilterOptions(); // Filtre seçeneklerini yükle
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

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
        <div className="bg-gradient-to-r from-purple-800 to-purple-900 rounded-lg shadow p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <img 
                src="/img/btRapor.png" 
                alt="btRapor Logo" 
                className="h-12 lg:h-16 w-auto mb-4 lg:mb-0 lg:mr-6 bg-white rounded-lg p-2 self-start"
              />
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">En Çok / En Az Satılan Malzemeler</h2>
                <p className="text-purple-100 text-sm">
                  Toplam Kayıt: {data.length} | Analiz Kriteri: {olcu === 'MIKTAR' ? 'Miktar' : 'Tutar'} | Sıralama: {sirala === 'ASC' ? 'En Az' : 'En Çok'}
                </p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col space-y-2">
              <div className="text-left lg:text-right">
                <p className="text-purple-100 text-sm">Rapor Dönemi</p>
                <p className="text-lg lg:text-xl font-semibold text-white">{startDate} - {endDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Parametreler */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center gap-2">
            <span>⚙️</span>
            Rapor Parametreleri
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Tarih Aralığı */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Tarihi</label>
                <DatePicker 
                  value={startDate}
                  onChange={(date) => setStartDate(formatDateToYMD(date))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi</label>
                <DatePicker 
                  value={endDate}
                  onChange={(date) => setEndDate(formatDateToYMD(date))}
                />
              </div>
            </div>

            {/* Analiz Kriterleri */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Analiz Kriteri</label>
                <select
                  value={olcu}
                  onChange={(e) => setOlcu(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="MIKTAR">Miktar Bazlı</option>
                  <option value="TUTAR">Tutar Bazlı</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sıralama</label>
                <select
                  value={sirala}
                  onChange={(e) => setSirala(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="DESC">En Çok Satılan</option>
                  <option value="ASC">En Az Satılan</option>
                </select>
              </div>
            </div>

            {/* Kayıt Sayısı ve Kodlar */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gösterilecek Kayıt Sayısı</label>
                <select
                  value={topCount}
                  onChange={(e) => setTopCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={20}>Top 20</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                  <option value={200}>Top 200</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gelişmiş Filtreler */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-md font-medium mb-4 text-gray-900 flex items-center gap-2">
              <span>🔍</span>
              Gelişmiş Filtreler (Opsiyonel)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grup Kodu</label>
                {loadingFilters ? (
                  <div className="text-xs text-gray-500">Yükleniyor...</div>
                ) : (
                <div className="flex flex-wrap gap-2 max-w-xs">
                  {availableGrupKodlari.length === 0 ? (
                    <span className="text-gray-400 text-xs">Veri yok</span>
                  ) : (
                    availableGrupKodlari.map(kod => (
                      <label key={kod} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGrupKodlari.includes(kod)}
                          onChange={() => handleGrupKodChange(kod)}
                          className="accent-red-600"
                        />
                        <span>{kod}</span>
                      </label>
                    ))
                  )}
                </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Özel Kod 1</label>
                {loadingFilters ? (
                  <div className="text-xs text-gray-500">Yükleniyor...</div>
                ) : (
                <div className="flex flex-wrap gap-2 max-w-xs">
                  {availableOzelKod1.length === 0 ? (
                    <span className="text-gray-400 text-xs">Veri yok</span>
                  ) : (
                    availableOzelKod1.map(kod => (
                      <label key={kod} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedOzelKod1.includes(kod)}
                          onChange={() => handleOzelKod1Change(kod)}
                          className="accent-blue-600"
                        />
                        <span>{kod}</span>
                      </label>
                    ))
                  )}
                </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Özel Kod 2</label>
                <input
                  type="text"
                  value={specode2}
                  onChange={(e) => setSpecode2(e.target.value)}
                  placeholder="Özel kod 2..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Raporu Getir Butonu */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleFetchReport}
              disabled={loading}
              className="w-full lg:w-auto px-8 py-3 bg-gradient-to-r from-purple-800 to-purple-900 text-white font-medium rounded-lg shadow hover:from-purple-900 hover:to-purple-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rapor Hazırlanıyor...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Raporu Getir
                </>
              )}
            </button>
          </div>
        </div>

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

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow">
          <EnCokSatilanMalzemelerTable 
            data={data}
            isLoading={loading}
            selectedGrupKodlari={selectedGrupKodlari}
            selectedOzelKod1={selectedOzelKod1}
          />
        </div>
      </div>
    </DashboardLayout>
  );
} 