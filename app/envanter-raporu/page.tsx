'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnvanterRaporuTable from '../components/tables/EnvanterRaporuTable';
import DashboardLayout from '../components/DashboardLayout';
import MalzemeDetayModal from '../components/MalzemeDetayModal';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import { buildInventoryFilters } from '../utils/buildFilter';
import ReportFilterPanel, { FilterValues } from '../components/ReportFilterPanel';

// Şube isimlerini doğal sırayla (1,2,10 yerine 1,2,3) sıralamak için yardımcı fonksiyon
const naturalSort = (a:string, b:string) => {
  const numA = parseInt(a.match(/\d+/)?.[0] || '',10);
  const numB = parseInt(b.match(/\d+/)?.[0] || '',10);
  if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
  return a.localeCompare(b,'tr');
};

export default function EnvanterRaporu() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);
  const [filterCodes, setFilterCodes] = useState<any[]>([]);
  const [loadingFilterCodes, setLoadingFilterCodes] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const selectedFiltersRef = useRef(selectedFilters);
  useEffect(()=>{selectedFiltersRef.current = selectedFilters;},[selectedFilters]);
  
  // ReportFilterPanel state
  const [filterValues, setFilterValues] = useState<FilterValues>({});

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    setSelectedFilters(prev => ({ ...prev, [key]: (value as string[]) ?? [] }));
  };

  const handleFilterReset = () => {
    setSelectedFilters({});
    setFilterValues({});
  };
  
  const router = useRouter();
  
  // filterCodes'dan ReportFilterPanel için filter tanımları oluştur
  const filterDefs = useMemo(() => {
    // Unique ALAN değerlerini bul
    const alanlar = Array.from(new Set(filterCodes.map(fc => fc.ALAN)));
    return alanlar.map(alan => ({
      type: 'multiSelect' as const,
      id: alan,
      label: alan === 'STRGRPCODE' ? 'Grup Kodu' :
             alan === 'SPECODE'    ? 'Özel Kod 1' :
             alan === 'SPECODE2'   ? 'Özel Kod 2' :
             alan === 'SPECODE3'   ? 'Özel Kod 3' :
             alan === 'SPECODE4'   ? 'Özel Kod 4' :
             alan === 'SPECODE5'   ? 'Özel Kod 5' : alan,
      options: filterCodes
        .filter(fc => fc.ALAN === alan)
        .map(fc => ({ value: fc.KOD, label: `${fc.KOD}${fc.AÇIKLAMA ? ' - ' + fc.AÇIKLAMA : ''}` })),
      searchable: true,
    }));
  }, [filterCodes]);
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // MalzemeDetayModal için state'ler
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMalzemeForDetail, setSelectedMalzemeForDetail] = useState<{
    itemRef: string;
    malzemeKodu: string;
    malzemeAdi: string;
    clientRef: string;
  } | null>(null);

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
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
        console.log('🔍 Envanter Raporu - Rapor erişim yetkisi kontrol ediliyor...');
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
        
        // Envanter raporu şirketin paketinde var mı kontrol et
        const envanterRaporu = allReports.find(report => 
                  report.report_name.toLocaleLowerCase('tr-TR').includes('envanter') ||
        report.report_name.toLocaleLowerCase('tr-TR').includes('stok')
        );
        
        if (!envanterRaporu) {
          console.log('❌ Envanter raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasEnvanterAccess = envanterRaporu.has_access;
        
        console.log('📊 Envanter raporu şirket paketinde:', !!envanterRaporu);
        console.log('🔐 Envanter raporu erişim yetkisi:', hasEnvanterAccess);
        
        setHasAccess(hasEnvanterAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasEnvanterAccess) {
          console.log('❌ Envanter raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=envanter-raporu');
          return;
        }

      } catch (error) {
        console.error('❌ Envanter Raporu - Rapor erişimi kontrol edilirken hata:', error);
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
          console.log('✅ Connection bilgileri zaten mevcut (Envanter)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Envanter)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Envanter)');
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

  // Envanter verilerini çek
  const fetchEnvanterData = async (filtersState?:Record<string,string[]>) => {
    console.log('🔄 Envanter verileri çekiliyor...');
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

      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';
      const logoKurulumDbName = connectionInfo.logoKurulumDbName || 'GO3';
      const specodesTable = `LG_${firmaNo.padStart(3, '0')}_SPECODES`;

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile envanter verileri çekiliyor...`);

      const currentFilters = filtersState || selectedFiltersRef.current;
      // Filtre koşulları
      const rawFilters = buildInventoryFilters({
        grpcod: currentFilters['STRGRPCODE'] || [],
        specode: currentFilters['SPECODE'] || [],
        specode2: currentFilters['SPECODE2'] || [],
        specode3: currentFilters['SPECODE3'] || [],
        specode4: currentFilters['SPECODE4'] || [],
        specode5: currentFilters['SPECODE5'] || []
      });

      // İç dinamik SQL'de tek tırnakları kaçırmak için
      const whereFilters = rawFilters.replace(/'/g, "''");

      // Yeni SQL sorgusu - tüm ürünlerle grup/özel kod açıklamaları
      const sqlQuery = `
        DECLARE @kolonlar NVARCHAR(MAX);
        DECLARE @kolonlarNullsuz NVARCHAR(MAX);
        DECLARE @sql NVARCHAR(MAX);

        -- 1. Pivot kolonları
        SELECT @kolonlar = STUFF(( 
            SELECT DISTINCT ', ' + QUOTENAME(WH.NAME)
            FROM ${logoKurulumDbName}..L_CAPIWHOUSE WH
            WHERE WH.FIRMNR = ${firmaNo}
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '');

        -- 2. ISNULL'lu kolonlar
        SELECT @kolonlarNullsuz = STUFF(( 
            SELECT DISTINCT ', ISNULL(' + QUOTENAME(WH.NAME) + ', 0) AS ' + QUOTENAME(WH.NAME)
            FROM ${logoKurulumDbName}..L_CAPIWHOUSE WH
            WHERE WH.FIRMNR = ${firmaNo}
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '');

        -- 3. Dinamik SQL sorgusu
        SET @sql = '
        SELECT 
          [Malzeme Ref],
          [Malzeme Kodu],
          [Malzeme Adı],
          [Grup Kodu],
          [Grup Kodu Açıklaması],
          [Özel Kod],
          [Özel Kod Açıklaması],
          [Özel Kod2],
          [Özel Kod2 Açıklaması],
          [Özel Kod3],
          [Özel Kod3 Açıklaması],
          [Özel Kod4],
          [Özel Kod4 Açıklaması],
          [Özel Kod5],
          [Özel Kod5 Açıklaması],
          ' + @kolonlarNullsuz + '
        FROM (
          SELECT 
            I.LOGICALREF AS [Malzeme Ref],
            I.CODE AS [Malzeme Kodu],
            I.NAME AS [Malzeme Adı],
            I.STGRPCODE AS [Grup Kodu],
            S7.DEFINITION_ AS [Grup Kodu Açıklaması],
            I.SPECODE AS [Özel Kod],
            S1.DEFINITION_ AS [Özel Kod Açıklaması],
            I.SPECODE2 AS [Özel Kod2],
            S2.DEFINITION_ AS [Özel Kod2 Açıklaması],
            I.SPECODE3 AS [Özel Kod3],
            S3.DEFINITION_ AS [Özel Kod3 Açıklaması],
            I.SPECODE4 AS [Özel Kod4],
            S4.DEFINITION_ AS [Özel Kod4 Açıklaması],
            I.SPECODE5 AS [Özel Kod5],
            S5.DEFINITION_ AS [Özel Kod5 Açıklaması],
            WH.NAME AS [Ambar Adı],
            S.ONHAND
          FROM LV_${firmaNo.padStart(3, '0')}_${donemNo}_STINVTOT S WITH(NOLOCK)
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK) ON I.LOGICALREF = S.STOCKREF
          LEFT JOIN ${logoKurulumDbName}..L_CAPIWHOUSE WH WITH(NOLOCK) ON WH.FIRMNR = ${firmaNo} AND WH.NR = S.INVENNO

          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S7 WHERE I.STGRPCODE = S7.SPECODE AND S7.CODETYPE = 4 AND S7.SPECODETYPE = 0) S7
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S1 WHERE I.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1) S1
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S2 WHERE I.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1) S2
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S3 WHERE I.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1) S3
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S4 WHERE I.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1) S4
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S5 WHERE I.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1) S5
          WHERE S.INVENNO <> -1 ${whereFilters}

          UNION ALL

          SELECT 
            I.LOGICALREF,
            I.CODE,
            I.NAME,
            I.STGRPCODE,
            S7.DEFINITION_,
            I.SPECODE,
            S1.DEFINITION_,
            I.SPECODE2,
            S2.DEFINITION_,
            I.SPECODE3,
            S3.DEFINITION_,
            I.SPECODE4,
            S4.DEFINITION_,
            I.SPECODE5,
            S5.DEFINITION_,
            WH.NAME,
            0
          FROM LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK)
          CROSS JOIN ${logoKurulumDbName}..L_CAPIWHOUSE WH WITH(NOLOCK)
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S7 WHERE I.STGRPCODE = S7.SPECODE AND S7.CODETYPE = 4 AND S7.SPECODETYPE = 0) S7
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S1 WHERE I.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1) S1
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S2 WHERE I.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1) S2
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S3 WHERE I.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1) S3
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S4 WHERE I.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1) S4
          OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S5 WHERE I.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1) S5
          WHERE WH.FIRMNR = ${firmaNo} ${whereFilters}
            AND NOT EXISTS (
                SELECT 1 FROM LV_${firmaNo.padStart(3, '0')}_${donemNo}_STINVTOT S WHERE S.STOCKREF = I.LOGICALREF AND S.INVENNO = WH.NR
            )

        ) AS Kaynak
        PIVOT (
          SUM(ONHAND) FOR [Ambar Adı] IN (' + @kolonlar + ')
        ) AS PivotTablo
        ORDER BY [Malzeme Kodu];';

        -- 4. Çalıştır
        EXEC sp_executesql @sql;
      `;

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key', // Diğer raporlarla tutarlı connection type
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
        let errorMessage = 'Envanter verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ Envanter API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          // JSON parse edilemezse response text'i al
          const errorText = await response.text();
          console.error('❌ Envanter API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
        return;
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setData(result.results);
        
        // Dinamik kolonları ayarla (ilk kayıttan al)
        if (result.results.length > 0) {
          const dynamicCols = Object.keys(result.results[0]).filter(col => 
            !['Malzeme Ref', 'Malzeme Kodu', 'Malzeme Adı', 'Grup Kodu', 'Grup Kodu Açıklaması', 'Özel Kod', 'Özel Kod Açıklaması', 'Özel Kod2', 'Özel Kod2 Açıklaması', 'Özel Kod3', 'Özel Kod3 Açıklaması', 'Özel Kod4', 'Özel Kod4 Açıklaması', 'Özel Kod5', 'Özel Kod5 Açıklaması'].includes(col)
          ).sort(naturalSort);
          setDynamicColumns(dynamicCols);
        }
        
        console.log('✅ Envanter verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
        console.log('📋 Dinamik kolonlar:', result.results.length > 0 ? Object.keys(result.results[0]).filter(col => 
          !['Malzeme Ref', 'Malzeme Kodu', 'Malzeme Adı', 'Grup Kodu', 'Grup Kodu Açıklaması', 'Özel Kod', 'Özel Kod Açıklaması', 'Özel Kod2', 'Özel Kod2 Açıklaması', 'Özel Kod3', 'Özel Kod3 Açıklaması', 'Özel Kod4', 'Özel Kod4 Açıklaması', 'Özel Kod5', 'Özel Kod5 Açıklaması'].includes(col)
        ) : []);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setData(result.data);
        
        if (result.data.length > 0) {
          const dynamicCols = Object.keys(result.data[0]).filter(col => 
            !['Malzeme Ref', 'Malzeme Kodu', 'Malzeme Adı', 'Grup Kodu', 'Grup Kodu Açıklaması', 'Özel Kod', 'Özel Kod Açıklaması', 'Özel Kod2', 'Özel Kod2 Açıklaması', 'Özel Kod3', 'Özel Kod3 Açıklaması', 'Özel Kod4', 'Özel Kod4 Açıklaması', 'Özel Kod5', 'Özel Kod5 Açıklaması'].includes(col)
          ).sort(naturalSort);
          setDynamicColumns(dynamicCols);
        }
        
        console.log('✅ Envanter verileri başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }

    } catch (error: any) {
      console.error('❌ Envanter verileri çekilirken hata:', error);
      
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

  const fetchFilterCodes = async () => {
    try {
      setLoadingFilterCodes(true);
      
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.warn('⚠️ CompanyRef bulunamadı, filtreleme kodları yüklenemedi');
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
        }
      }
      
      if (!connectionInfo) {
        console.warn('⚠️ Connection bilgileri bulunamadı, filtreleme kodları yüklenemedi');
        return;
      }
      
      const firmaNo = connectionInfo.first_firma_no || '009';
      const specodesTable = `LG_${firmaNo.padStart(3, '0')}_SPECODES`;
      
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

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key', // Diğer raporlarla tutarlı connection type
        {
          query: filterCodesQuery
        },
        'https://api.btrapor.com/proxy',
        600000 // 10 dakika timeout
      );

      // İlk olarak response type kontrolü
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ Filtreleme kodları - API HTML döndürdü - proxy hatası olabilir');
        showErrorMessage('Proxy sunucusuna erişilemiyor. Lütfen sistem yöneticinize başvurun.');
        return;
      }

      if (!response.ok) {
        let errorMessage = 'Filtreleme kodları alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ Filtreleme kodları API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          // JSON parse edilemezse response text'i al
          const errorText = await response.text();
          console.error('❌ Filtreleme kodları API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
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

  // Filtre kodlarını ve animasyonları yükle
  useEffect(() => {
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      fetchFilterCodes(); // Sadece filtre kodlarını yükle
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    await fetchEnvanterData(selectedFiltersRef.current);
    setHasFetched(true);
  };

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchEnvanterData(selectedFiltersRef.current);
      setHasFetched(true);
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      showErrorMessage('Cache temizlenirken bir hata oluştu!');
    }
  };

  // MalzemeDetayModal'ı açma fonksiyonu
  const handleOpenMalzemeDetail = (itemRef: string, malzemeKodu: string, malzemeAdi: string, clientRef: string) => {
    console.log('🔍 MalzemeDetayModal açılıyor:', { itemRef, malzemeKodu, malzemeAdi, clientRef });
    setSelectedMalzemeForDetail({
      itemRef,
      malzemeKodu,
      malzemeAdi,
      clientRef
    });
    setIsDetailModalOpen(true);
  };

  // Kod çoklu seçim handler
  const toggleFilterValue = (codeType: string, value: string) => {
    setSelectedFilters(prev => {
      const currentArr = prev[codeType] || [];
      const newArr = currentArr.includes(value)
        ? currentArr.filter(v => v !== value)
        : [...currentArr, value];
      // Sync filterValues
      setFilterValues(filterPrev => ({ ...filterPrev, [codeType]: newArr }));
      return { ...prev, [codeType]: newArr };
    });
  };

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

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Envanter Raporu">
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
    <DashboardLayout title="Envanter Raporu">
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 mb-5">
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-16 -right-16 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-teal-700/10 rounded-full blur-2xl" />
              <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>
            <div className="relative px-4 lg:px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={() => router.push('/')}
                    className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-11 h-11 bg-teal-500/20 border border-teal-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-bold text-white">Envanter Raporu</h1>
                      <span className="hidden sm:inline text-xs font-semibold bg-teal-500/20 border border-teal-500/30 text-teal-300 px-2 py-0.5 rounded-full">Stok</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {data.length > 0 ? `${data.length} ürün` : 'Anlık stok durumu'}
                    </p>
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ReportFilterPanel */}
        {filterDefs.length > 0 && (
          <ReportFilterPanel
            filters={filterDefs}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleFetchReport}
            onReset={handleFilterReset}
            loading={loading}
          />
        )}
        {filterDefs.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Filtre kodu yükleniyor...</span>
            <button onClick={handleFetchReport} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm">
              {loading ? 'Yükleniyor...' : 'Raporu Getir →'}
            </button>
          </div>
        )}

        {/* Filtre Bilgi Kartı */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span>✅</span>
              <span className="font-medium">
                {Object.entries(selectedFilters).some(([, codes]) => codes.length > 0) 
                  ? `${data.length} kayıt filtrelenmiş sonuçlardan gösteriliyor`
                  : `${data.length} kayıt gösteriliyor`
                }
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
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              {animationData && (
                <div className="w-24 h-24 mb-4">
                  <Lottie animationData={animationData} loop={true} />
                </div>
              )}
              <p className="text-gray-600 font-medium">Envanter verileri yükleniyor...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <EnvanterRaporuTable 
              data={data} 
              dynamicColumns={dynamicColumns}
              filterCodes={filterCodes}
              loadingFilterCodes={loadingFilterCodes}
              selectedFilters={selectedFilters}
              onToggleFilter={toggleFilterValue}
              onOpenMalzemeDetail={handleOpenMalzemeDetail}
            />
          </div>
        )}
      </div>

      {/* Malzeme Detay Modal */}
      {selectedMalzemeForDetail && (
        <MalzemeDetayModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedMalzemeForDetail(null);
          }}
          malzemeKodu={selectedMalzemeForDetail.malzemeKodu}
          malzemeAdi={selectedMalzemeForDetail.malzemeAdi}
          itemRef={selectedMalzemeForDetail.itemRef}
          clientRef={selectedMalzemeForDetail.clientRef}
          startDate={new Date().toISOString().split('T')[0]}
          endDate={new Date().toISOString().split('T')[0]}
        />
      )}
    </DashboardLayout>
  );
} 