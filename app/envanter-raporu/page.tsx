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
                  onClick={fetchEnvanterData}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Ürün</p>
                <p className="text-2xl font-semibold text-gray-900">{data.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Ambar</p>
                <p className="text-2xl font-semibold text-gray-900">{dynamicColumns.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Aktif Ürün</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.filter(item => item.Durumu === 0 || item.Durumu === '0').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pasif Ürün</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {data.filter(item => item.Durumu === 1 || item.Durumu === '1').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        
        {/* Action Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Envanter Raporu</h3>
              <p className="text-sm text-gray-500">Ürün stok durumlarını görüntüleyin ve analiz edin</p>
            </div>
            <button
              onClick={fetchEnvanterData}
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
                  Raporu Yenile
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
        ) : Array.isArray(data) && data.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <EnvanterRaporuTable 
              data={data} 
              dynamicColumns={dynamicColumns}
            />
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