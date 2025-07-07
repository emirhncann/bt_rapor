'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnvanterRaporuTable from '../components/tables/EnvanterRaporuTable';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import { buildInventoryFilters } from '../utils/buildFilter';

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
  
  const router = useRouter();
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
        const companyRef = localStorage.getItem('companyRef');
        if (!companyRef) {
          console.log('❌ CompanyRef bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const {reports: allReports} = await fetchUserReports(companyRef, currentUser.id);
        
        // Envanter raporu şirketin paketinde var mı kontrol et
        const envanterRaporu = allReports.find(report => 
          report.report_name.toLowerCase().includes('envanter') || 
          report.report_name.toLowerCase().includes('stok')
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
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
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
      const companyRef = localStorage.getItem('companyRef');
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
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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
            FROM GO3..L_CAPIWHOUSE WH
            WHERE WH.FIRMNR = ${firmaNo}
            FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '');

        -- 2. ISNULL'lu kolonlar
        SELECT @kolonlarNullsuz = STUFF(( 
            SELECT DISTINCT ', ISNULL(' + QUOTENAME(WH.NAME) + ', 0) AS ' + QUOTENAME(WH.NAME)
            FROM GO3..L_CAPIWHOUSE WH
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
          LEFT JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK) ON WH.FIRMNR = ${firmaNo} AND WH.NR = S.INVENNO

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
          CROSS JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK)
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
          );
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
          );
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
      
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        console.warn('⚠️ CompanyRef bulunamadı, filtreleme kodları yüklenemedi');
        return;
      }
      
      const filterCodesQuery = `
       
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'STRGRPCODE' AS [ALAN]
        FROM LG_009_SPECODES S
        WHERE S.CODETYPE = 4 AND S.SPECODETYPE = 0

        UNION ALL

        -- SPECODE (Özel Kod 1)
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE' AS [ALAN]
        FROM LG_009_SPECODES S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP1 = 1

        UNION ALL

        -- SPECODE2
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE2' AS [ALAN]
        FROM LG_009_SPECODES S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP2 = 1

        UNION ALL

        -- SPECODE3
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE3' AS [ALAN]
        FROM LG_009_SPECODES S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP3 = 1

        UNION ALL

        -- SPECODE4
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE4' AS [ALAN]
        FROM LG_009_SPECODES S
        WHERE S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP4 = 1

        UNION ALL

        -- SPECODE5
        SELECT DISTINCT 
          S.SPECODE AS [KOD],
          S.DEFINITION_ AS [AÇIKLAMA],
          'SPECODE5' AS [ALAN]
        FROM LG_009_SPECODES S
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

  // Kod çoklu seçim handler
  const toggleFilterValue = (codeType: string, value: string) => {
    setSelectedFilters(prev => {
      const currentArr = prev[codeType] || [];
      if (currentArr.includes(value)) {
        return { ...prev, [codeType]: currentArr.filter(v => v !== value) };
      }
      return { ...prev, [codeType]: [...currentArr, value] };
    });
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
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">Envanter Raporu</h2>
                <p className="text-red-100 text-sm">
                  Toplam Ambar: {dynamicColumns.length} | Toplam Ürün: {data.length}
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
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Raporu Getir
                </button>
              </div>
            </div>
          </div>
        </div>

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
              <h3 className="text-lg font-medium text-gray-900">Envanter Raporu</h3>
              <p className="text-sm text-gray-500">Ürün stok durumlarını görüntüleyin ve analiz edin</p>
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
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 