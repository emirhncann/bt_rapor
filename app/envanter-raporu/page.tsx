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

      const response = await fetch('/api/inventory-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyRef,
          firmaNo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Envanter API hatası:', errorData);
        showErrorMessage(errorData.error || 'Envanter verileri alınamadı');
        return;
      }

      const result = await response.json();
      console.log('✅ Envanter API başarılı:', result);

      // Error kontrolü - çeşitli hata formatlarını kontrol et
      if (result.status === 'error' || result.error || result.curl_error) {
        const errorMsg = result.message || result.error || result.curl_error || 'Bilinmeyen hata';
        console.error('Server hatası:', errorMsg);
        showErrorMessage(`Veritabanı bağlantı hatası: ${errorMsg}`);
        return;
      }

      // Eğer data array değilse, uygun formata çevir
      let finalData: any[] = [];
      if (Array.isArray(result)) {
        finalData = result;
      } else if (result && Array.isArray(result.data)) {
        finalData = result.data;
      } else if (result && Array.isArray(result.recordset)) {
        finalData = result.recordset;
      } else if (result && Array.isArray(result.results)) {
        finalData = result.results;
      } else {
        console.error('Beklenmeyen data formatı:', result);
        showErrorMessage('Beklenmeyen veri formatı alındı. Lütfen sistem yöneticisi ile iletişime geçin.');
        return;
      }

      setData(finalData);
      
      // Dinamik kolonları çıkar (sabit kolonlar hariç)
      if (finalData.length > 0) {
        const firstRow = finalData[0];
        const fixedColumns = ['Malzeme Ref', 'Durumu', 'Malzeme Kodu', 'Malzeme Adı'];
        const dynamicCols = Object.keys(firstRow).filter(key => !fixedColumns.includes(key));
        setDynamicColumns(dynamicCols);
        console.log('🏢 Dinamik şube kolonları:', dynamicCols);
      }
      
      console.log('✅ Envanter verileri yüklendi:', finalData.length, 'kayıt');

    } catch (error: any) {
      console.error('❌ Envanter verisi çekme hatası:', error);
      showErrorMessage('Envanter verisi çekilirken hata oluştu: ' + (error?.message || 'Bilinmeyen hata'));
    } finally {
      setLoading(false);
    }
  };

  // Yetki kontrolü tamamlandıktan sonra otomatik veri yükle
  useEffect(() => {
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      fetchEnvanterData();
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

  // Yetki kontrolü devam ediyor
  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Envanter Raporu">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Yetki kontrolü yapılıyor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Yetki yok
  if (!hasAccess) {
    return (
      <DashboardLayout title="Envanter Raporu">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Erişim Reddedildi</h2>
            <p className="text-gray-600 mb-4">Envanter raporunu görüntüleme yetkiniz bulunmamaktadır.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Envanter Raporu">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Başlık */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 rounded-xl shadow-lg">
              <div className="text-white text-2xl">📦</div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Envanter Raporu</h1>
              <p className="text-gray-600 mt-1">Malzeme stoklarını şube bazında görüntüleyin</p>
            </div>
          </div>
        </div>

        {/* Hata mesajı */}
        {showError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center">
            {failedAnimationData && (
              <div className="mr-3">
                <Lottie animationData={failedAnimationData} loop={false} style={{ width: 24, height: 24 }} />
              </div>
            )}
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Kontrol butonları */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={fetchEnvanterData}
              disabled={loading}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Yükleniyor...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Verileri Yenile</span>
                </>
              )}
            </button>
            
            {data.length > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-green-600">✅</span>
                <span>Toplam {data.length} malzeme</span>
                <span className="text-blue-600">•</span>
                <span>{dynamicColumns.length} şube</span>
              </div>
            )}
          </div>
        </div>

        {/* Yükleniyor animasyonu */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              {animationData && (
                <Lottie animationData={animationData} loop={true} style={{ width: 120, height: 120 }} />
              )}
              <div>
                <p className="text-xl font-semibold text-gray-700 mb-2">Envanter Raporu Hazırlanıyor</p>
                <p className="text-gray-500">Malzeme stokları şube bazında çekiliyor...</p>
              </div>
            </div>
          </div>
        )}

        {/* Tablo */}
        {!loading && data.length > 0 && (
          <EnvanterRaporuTable 
            data={data} 
            dynamicColumns={dynamicColumns}
          />
        )}

        {/* Veri yok */}
        {!loading && data.length === 0 && !showError && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Envanter Verisi Bulunamadı</h3>
            <p className="text-gray-500 mb-4">Şu anda görüntülenecek envanter verisi bulunmamaktadır.</p>
            <button
              onClick={fetchEnvanterData}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 