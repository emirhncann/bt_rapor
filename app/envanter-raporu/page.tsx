'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnvanterRaporuTable from '../components/tables/EnvanterRaporuTable';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

export default function EnvanterRaporu() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [dynamicColumns, setDynamicColumns] = useState<string[]>([]);
  
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
  const fetchEnvanterData = async () => {
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
      try {
        const cachedConnectionInfo = localStorage.getItem('connectionInfo');
        if (cachedConnectionInfo) {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } else {
          throw new Error('Connection bilgileri bulunamadı');
        }
      } catch (error) {
        console.error('Connection bilgileri alınırken hata:', error);
        showErrorMessage('Bağlantı bilgileri alınamadı. Lütfen sayfayı yenileyin.');
        return;
      }

      const firmaNo = connectionInfo.first_firma_no || '009';
      
      console.log('📦 Envanter API çağrısı yapılıyor:', { companyRef, firmaNo });

      // SQL sorgusu - Diğer raporlarla tutarlı format (string interpolation)
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

        -- 3. Dinamik sorgu
        SET @sql = '
        SELECT 
          [Malzeme Ref],
          [Durumu],
          [Malzeme Kodu],
          [Malzeme Adı],
          ' + @kolonlarNullsuz + '
        FROM (
          SELECT 
            I.LOGICALREF AS [Malzeme Ref],
            I.ACTIVE AS [Durumu],
            I.CODE AS [Malzeme Kodu],
            I.NAME AS [Malzeme Adı],
            WH.NAME AS [Ambar Adı],
            ISNULL(S.ONHAND, 0) AS ONHAND
          FROM LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK)
          LEFT JOIN LV_${firmaNo.padStart(3, '0')}_01_STINVTOT S WITH(NOLOCK) ON I.LOGICALREF = S.STOCKREF
          LEFT JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK) ON WH.FIRMNR = ${firmaNo} AND WH.NR = ISNULL(S.INVENNO, 0)
          WHERE I.ACTIVE IN (0, 1) -- Sadece aktif ve pasif ürünler
            AND WH.FIRMNR IS NOT NULL -- Geçerli ambar kontrolü
        ) AS Kaynak
        PIVOT (
          SUM(ONHAND) FOR [Ambar Adı] IN (' + @kolonlar + ')
        ) AS PivotTablo
        ORDER BY [Malzeme Kodu];';

        -- 4. Sorguyu çalıştır
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
            !['Malzeme Ref', 'Durumu', 'Malzeme Kodu', 'Malzeme Adı'].includes(col)
          );
          setDynamicColumns(dynamicCols);
        }
        
        console.log('✅ Envanter verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
        console.log('📋 Dinamik kolonlar:', result.results.length > 0 ? Object.keys(result.results[0]).filter(col => 
          !['Malzeme Ref', 'Durumu', 'Malzeme Kodu', 'Malzeme Adı'].includes(col)
        ) : []);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setData(result.data);
        
        if (result.data.length > 0) {
          const dynamicCols = Object.keys(result.data[0]).filter(col => 
            !['Malzeme Ref', 'Durumu', 'Malzeme Kodu', 'Malzeme Adı'].includes(col)
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

  // Sayfa yüklendiğinde verileri çek
  useEffect(() => {
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      fetchEnvanterData();
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Envanter Raporu</h1>
          <button
            onClick={fetchEnvanterData}
            disabled={loading}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Yenileniyor...' : 'Yenile 🔄'}
          </button>
        </div>
        
        {/* Hata mesajı */}
        {showError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
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
        
        {/* Loading animasyonu */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            {animationData && (
              <div className="w-96 h-96">
                <Lottie animationData={animationData} loop={true} />
              </div>
            )}
            <p className="mt-4 text-gray-600 text-lg">Envanter verileri yükleniyor...</p>
          </div>
        ) : (
          /* Envanter tablosu */
          <EnvanterRaporuTable 
            data={data} 
            dynamicColumns={dynamicColumns}
          />
        )}
      </div>
    </DashboardLayout>
  );
} 