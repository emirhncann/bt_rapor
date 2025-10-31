'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from './components/DashboardLayout';
import SessionManager from './components/SessionManager';
import { fetchUserReports, getCurrentUser, getAuthorizedReports, groupReportsByCategory, isSuperAdmin } from './utils/simple-permissions';
import type { ReportWithAccess } from './utils/simple-permissions';
import { sendSecureProxyRequest } from './utils/api';

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [accessDeniedInfo, setAccessDeniedInfo] = useState<{show: boolean, report: string} | null>(null);
  const [userReports, setUserReports] = useState<ReportWithAccess[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [planInfo, setPlanInfo] = useState<{planName: string, licenceEnd: string}>({planName: '', licenceEnd: ''});
  const [pinnedReports, setPinnedReports] = useState<string[]>([]); // Sabitlenmiş rapor ID'leri
  const [showPinnedSelector, setShowPinnedSelector] = useState(false);
  const [stats, setStats] = useState({
    totalReports: 0,
    accessibleReports: 0,
    activeUsers: 0,
    userCount: 0, // Sadece user tipindeki kullanıcılar
    monthlyQueries: 0,
    systemStatus: 'Kontrol ediliyor...'
  });
  const router = useRouter();
  
  // Animation data'yı yükleyelim
  const [animationData, setAnimationData] = useState(null);
  
  // Saat güncellemesi - gerçek zamanlı olarak her saniye güncelle
  useEffect(() => {
    // İlk yüklenmede saati ayarla
    setCurrentTime(new Date());
    
    // Her saniye saati güncelle
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Component unmount olduğunda timer'ı temizle
    return () => clearInterval(timer);
  }, []);

  // Stats güncellemesi - sadece dashboard yüklendiğinde
  useEffect(() => {
    if (isAuthenticated && !loadingReports) {
      const updateStats = async () => {
        const accessibleReports = userReports.filter(r => r.has_access).length;
        const userData = await fetchActiveUsers(); // Gerçek kullanıcı sayısını çek
        const systemStatus = await testSystemStatus(); // Sistem durumunu kontrol et
        
        setStats({
          totalReports: userReports.length,
          accessibleReports: accessibleReports,
          activeUsers: userData.totalUsers,
          userCount: userData.userCount,
          monthlyQueries: 0, // Artık kullanılmıyor ama state'te var
          systemStatus: systemStatus
        });
      };
      
      setTimeout(updateStats, 500);
    }
  }, [isAuthenticated, loadingReports, userReports.length]);
  
  // URL parametrelerini kontrol et (erişim reddedildi mesajı için)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    const report = searchParams.get('report');
    
    if (error === 'access_denied' && report) {
      const reportNames: {[key: string]: string} = {
        'enpos-ciro': 'Enpos Ciro Raporu',
        'c-bakiye': 'Cari Bakiye Raporu',
        'hareket-gormeyen-cariler': 'Hareket Görmeyen Cariler'
      };
      
      setAccessDeniedInfo({
        show: true,
        report: reportNames[report] || report
      });
      
      // URL'den parametreleri temizle
      window.history.replaceState({}, '', '/');
      
      // 10 saniye sonra mesajı gizle
      setTimeout(() => {
        setAccessDeniedInfo(null);
      }, 10000);
    }
  }, []);

  // Favori raporları api.btrapor.com'dan yükle
  const loadPinnedReports = async () => {
    try {
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      
      if (!currentUser || !companyRef) {
        console.warn('Kullanıcı bilgisi veya companyRef bulunamadı');
        return;
      }

      console.log('🔄 api.btrapor.com\'dan favori raporlar yükleniyor...');
      
      const response = await fetch(`https://api.btrapor.com/get-favorite-reports?user_ref=${currentUser.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 API Response:', data);
        
        if (data.status === 'success' && data.data) {
          // API'den gelen string array'ini işle
          const pinnedReports = data.data.flatMap((item: string) => 
            item.split('-').filter((id: string) => id.trim() !== '')
          );
          setPinnedReports(pinnedReports);
          console.log('📌 api.btrapor.com\'dan favori raporlar yüklendi:', pinnedReports);
        } else {
          console.warn('⚠️ api.btrapor.com\'dan veri alınamadı, localStorage kontrol ediliyor');
          // Fallback: localStorage'dan yükle
          const savedPinned = sessionStorage.getItem('pinnedReports');
          if (savedPinned) {
            try {
              const pinned = JSON.parse(savedPinned);
              setPinnedReports(pinned);
              console.log('📌 LocalStorage\'dan favori raporlar yüklendi:', pinned);
            } catch (e) {
              console.error('❌ LocalStorage parse hatası:', e);
              setPinnedReports([]);
            }
          } else {
            setPinnedReports([]);
          }
        }
      } else {
        console.warn('⚠️ api.btrapor.com bağlantısı başarısız, localStorage kontrol ediliyor');
        // Fallback: localStorage'dan yükle
        const savedPinned = sessionStorage.getItem('pinnedReports');
        if (savedPinned) {
          try {
            const pinned = JSON.parse(savedPinned);
            setPinnedReports(pinned);
            console.log('📌 LocalStorage\'dan favori raporlar yüklendi:', pinned);
          } catch (e) {
            console.error('❌ LocalStorage parse hatası:', e);
            setPinnedReports([]);
          }
        } else {
          setPinnedReports([]);
        }
      }
    } catch (error) {
      console.error('❌ Favori raporlar yüklenirken hata:', error);
      // Fallback: localStorage'dan yükle
      try {
        const savedPinned = sessionStorage.getItem('pinnedReports');
        if (savedPinned) {
          const pinned = JSON.parse(savedPinned);
          setPinnedReports(pinned);
          console.log('📌 LocalStorage\'dan favori raporlar yüklendi:', pinned);
        } else {
          setPinnedReports([]);
        }
      } catch (localError) {
        console.error('❌ LocalStorage\'dan da yüklenemedi:', localError);
        setPinnedReports([]);
      }
    }
  };

  // Favori raporu ekle/çıkar
  const togglePinnedReport = async (reportId: string) => {
    const newPinned = pinnedReports.includes(reportId) 
      ? pinnedReports.filter(id => id !== reportId)
      : pinnedReports.length < 6 
        ? [...pinnedReports, reportId]
        : pinnedReports;
    
    setPinnedReports(newPinned);
    
    // Hem localStorage'a hem api.btrapor.com'a kaydet
    sessionStorage.setItem('pinnedReports', JSON.stringify(newPinned));
    
    try {
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      
      if (currentUser && companyRef) {
        console.log('💾 api.btrapor.com\'a favori raporlar kaydediliyor...');
        
        const response = await fetch('https://api.btrapor.com/save-favorite-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_ref: currentUser.id,
            report_id: newPinned.join('-')
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success') {
            console.log('✅ api.btrapor.com\'a favori raporlar kaydedildi');
          } else {
            console.warn('⚠️ api.btrapor.com\'a kaydedilemedi:', data.message);
          }
        } else {
          console.warn('⚠️ api.btrapor.com bağlantısı başarısız, sadece localStorage kullanılıyor');
        }
      }
    } catch (error) {
      console.error('❌ api.btrapor.com\'a kaydedilirken hata:', error);
    }
    
    console.log('📌 Favori raporlar güncellendi:', newPinned);
  };

  // Kullanıcı raporlarını yükle ve localStorage'a kaydet
  const loadUserReports = async () => {
    try {
      setLoadingReports(true);
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      
      if (!companyRef) {
        console.warn('Company ref bulunamadı');
        setLoadingReports(false);
        return;
      }

      console.log('🔄 Dashboard - Kullanıcı raporları yükleniyor...');
      
      // fetchUserReports fonksiyonunu kullan (rol bazlı yetki kontrolü ile)
      const {reports: allReports, planInfo: planData} = await fetchUserReports(companyRef, currentUser?.id);
      
      console.log('📊 Dashboard - Çekilen raporlar:', allReports);
      console.log('📋 Dashboard - Plan bilgileri:', planData);
      
      // State'e raporları kaydet
      setUserReports(allReports);
      setPlanInfo(planData);
      
      // LocalStorage'a sadece yetkili raporları kaydet (diğer sayfalar için)
      const authorizedReports = getAuthorizedReports(allReports);
      sessionStorage.setItem('userAuthorizedReports', JSON.stringify(authorizedReports));
      sessionStorage.setItem('userReportsLastUpdate', Date.now().toString());
      
      console.log('💾 Dashboard - Raporlar yüklendi, yetkili raporlar localStorage\'a kaydedildi');
      
    } catch (error) {
      console.error('❌ Dashboard - Raporlar yüklenirken hata:', error);
      setUserReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      const name = sessionStorage.getItem('userName');
      const role = sessionStorage.getItem('userRole');
      const company = sessionStorage.getItem('companyName');
      
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        setUserName(name || '');
        setUserRole(role || '');
        setCompanyName(company || '');
        loadConnectionInfoToStorage();
        loadUserReports(); // Kullanıcı raporlarını yükle
        loadPinnedReports(); // Sabitlenmiş raporları yükle
        
        // Dashboard görüntüleme tracking
        
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Aktif kullanıcı sayısını API'den çek
  const fetchActiveUsers = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('Company ref bulunamadı, kullanıcı sayısı çekilemedi');
        return { totalUsers: 0, userCount: 0 };
      }

      console.log('👥 Aktif kullanıcı sayısı çekiliyor...');
      
      const response = await fetch('https://api.btrapor.com/user-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_ref: companyRef
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('👥 Kullanıcı sayısı API response:', result);
        
        if (result.status === 'success' && result.data) {
          const adminCount = Number(result.data.admin) || 0;
          const userCount = Number(result.data.user) || 0;
          const totalUsers = adminCount + userCount;
          console.log(`✅ Toplam aktif kullanıcı: ${totalUsers} (Admin: ${adminCount}, User: ${userCount})`);
          return { totalUsers, userCount };
        } else {
          console.log('⚠️ Kullanıcı sayısı API hatası:', result.message);
          return { totalUsers: 0, userCount: 0 };
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Kullanıcı sayısı HTTP hatası:', response.status, errorText);
        return { totalUsers: 0, userCount: 0 };
      }
    } catch (error) {
      console.error('❌ Kullanıcı sayısı çekilirken hata:', error);
      return { totalUsers: 0, userCount: 0 };
    }
  };

  // Sistem durumu test fonksiyonu
  const testSystemStatus = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('Company ref bulunamadı, sistem durumu test edilemedi');
        return 'Pasif';
      }

      console.log('🔍 Sistem durumu test ediliyor...');
      
      // Basit bir test sorgusu - sadece bağlantıyı kontrol et
      const testQuery = 'SELECT 1 AS test_result';
      
      // sendSecureProxyRequest kullanarak şifreli proxy üzerinden test et
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key', // Ana veritabanı
        {
          query: testQuery
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 Test sorgusu sonucu:', result);
        
        // Farklı response formatlarını kontrol et
        let testResult = null;
        if (Array.isArray(result) && result.length > 0) {
          testResult = result[0];
        } else if (result && Array.isArray(result.data) && result.data.length > 0) {
          testResult = result.data[0];
        } else if (result && Array.isArray(result.recordset) && result.recordset.length > 0) {
          testResult = result.recordset[0];
        }
        
        if (testResult && testResult.test_result === 1) {
          console.log('✅ Sistem durumu: Aktif');
          return 'Aktif';
        } else {
          console.log('⚠️ Sistem durumu: Pasif (test sorgusu başarısız)');
          return 'Pasif';
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Sistem durumu: Pasif (HTTP hatası)', response.status, errorText);
        return 'Pasif';
      }
    } catch (error) {
      console.error('❌ Sistem durumu test edilirken hata:', error);
      return 'Pasif';
    }
  };

  // Connection bilgilerini localStorage'a kaydet
  const loadConnectionInfoToStorage = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('Company ref bulunamadı, connection bilgileri yüklenemedi');
        return;
      }

      console.log('🔄 Ana sayfada connection bilgileri localStorage\'a kaydediliyor...');
      
      const response = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
      const data = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
        const connectionInfo = data.data;
        sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
        console.log('✅ Connection bilgileri localStorage\'a kaydedildi:', connectionInfo);
        
        // Connection bilgileri yüklendikten sonra sistem durumunu test et
        const systemStatus = await testSystemStatus();
        
        // Aktif kullanıcı sayısını çek
        const userData = await fetchActiveUsers();
        
        setStats(prev => ({ 
          ...prev, 
          systemStatus,
          activeUsers: userData.totalUsers,
          userCount: userData.userCount
        }));
      } else {
        console.log('⚠️ Connection bilgileri alınamadı:', data.message);
        setStats(prev => ({ ...prev, systemStatus: 'Pasif' }));
      }
    } catch (error) {
      console.error('❌ Connection bilgileri yüklenirken hata:', error);
      setStats(prev => ({ ...prev, systemStatus: 'Pasif' }));
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/animations/rapor.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.log('Animation yüklenemedi:', err));
    }
  }, [isAuthenticated]);

  // Super admin kontrolü - super admin ise sistem yönetimine yönlendir
  useEffect(() => {
    if (isAuthenticated && isSuperAdmin()) {
      router.push('/super-admin');
      return;
    }
  }, [isAuthenticated, router]);

  // Authentication kontrolü devam ediyorsa loading göster
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-white/20">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white/30 rounded-full animate-spin border-l-white"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-l-white/50"></div>
            </div>
            <p className="text-white font-medium text-lg mt-6">Sistem Başlatılıyor...</p>
            <p className="text-white/70 text-sm mt-2">Lütfen bekleyiniz</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Super admin ise bu sayfayı gösterme
  if (isSuperAdmin()) {
    return null;
  }

  return (
    <DashboardLayout title="İş Zekası Dashboard">
      <SessionManager />
      <div className="space-y-8">
        {/* Erişim Reddedildi Uyarısı */}
        {accessDeniedInfo?.show && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Rapor Erişimi Reddedildi
                </h3>
                <div className="mt-1 text-sm text-red-700">
                  <p>
                    <strong>{accessDeniedInfo.report}</strong>'na erişim yetkiniz bulunmamaktadır.
                  </p>
                  <p className="mt-1">
                    Rapor yetkisi almak için lütfen yöneticiniz ile iletişime geçin veya{' '}
                    <button
                      onClick={() => router.push('/ayarlar')}
                      className="underline hover:no-underline font-medium"
                    >
                      buradan yetki talebi oluşturun
                    </button>
                    .
                  </p>
                </div>
              </div>
              <div className="ml-3 flex-shrink-0">
                <button
                  onClick={() => setAccessDeniedInfo(null)}
                  className="inline-flex text-red-400 hover:text-red-600 focus:outline-none"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modern Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-red-900 via-red-800 to-red-900 rounded-2xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-red-800/20 to-red-600/20"></div>
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-red-400/20 to-red-600/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-60 h-60 bg-gradient-to-tl from-red-400/20 to-red-500/20 rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative px-8 py-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex flex-col items-start w-full">
                  <div className="bg-white rounded-xl sm:rounded-2xl shadow-md p-2 mb-2 max-w-[120px] sm:max-w-[160px] w-full flex items-center justify-center">
                    <img
                      src="/img/btRapor.png"
                      alt="btRapor Logo"
                      className="w-full h-auto rounded-lg sm:rounded-xl"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-3 mb-2">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                        Merhaba, {userName}! 👋
                      </h1>
                    </div>
                    <p className="text-base sm:text-lg lg:text-xl text-red-100 font-medium mb-2">
                      İş Dünyasına Dair Tüm Raporlar
                    </p>
                    {companyName && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <p className="text-red-200 text-sm sm:text-base lg:text-lg">
                          🏢 {companyName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="hidden lg:block">
                <div className="text-right space-y-2">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                   
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                      {currentTime.toLocaleTimeString('tr-TR', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-red-300 text-xs sm:text-sm">
                      {currentTime.toLocaleDateString('tr-TR', { 
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Toplam Rapor */}
          <div className="group">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs sm:text-sm font-medium"> Erişilebilir Rapor</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{stats.accessibleReports}</p>
                  <div className="flex flex-col mt-1 sm:mt-2 space-y-1">
                    
                    <div className="flex items-center space-x-1">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-blue-200 text-xs sm:text-sm">{stats.totalReports} Toplam Rapor</span>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Aktif Kullanıcılar */}
          <div className="group">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-xs sm:text-sm font-medium">Aktif Kullanıcı</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{stats.activeUsers}</p>
                  <div className="flex items-center mt-1 sm:mt-2 space-x-1">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-green-200 text-xs sm:text-sm">{stats.userCount} Alt Kullanıcı</span>
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Bilgileri */}
          <div className="group">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs sm:text-sm font-medium">Aktif Plan</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 sm:mt-2">
                    {planInfo.planName ? `${planInfo.planName}` : 'Plan Yükleniyor...'}
                  </p>
                  <div className="flex items-center mt-1 sm:mt-2 space-x-1">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-orange-200 text-xs sm:text-sm">
                      {planInfo.licenceEnd ? formatLicenseDate(planInfo.licenceEnd) : 'Lisans bilgisi yükleniyor...'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sistem Durumu */}
          <div className="group">
            <div className={`bg-gradient-to-br ${
              stats.systemStatus === 'Aktif' ? 'from-green-600 to-green-700' : 
              stats.systemStatus === 'Kontrol ediliyor...' ? 'from-yellow-600 to-yellow-700' : 
              'from-red-600 to-red-700'
            } rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs sm:text-sm font-medium">Sistem Durumu</p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 sm:mt-2 text-white">{stats.systemStatus}</p>
                  <div className="flex items-center mt-1 sm:mt-2 space-x-1">
                    <div className={`w-2 h-2 ${
                      stats.systemStatus === 'Aktif' ? 'bg-green-400' : 
                      stats.systemStatus === 'Kontrol ediliyor...' ? 'bg-yellow-400' : 
                      'bg-red-400'
                    } rounded-full ${
                      stats.systemStatus === 'Aktif' || stats.systemStatus === 'Kontrol ediliyor...' ? 'animate-pulse' : ''
                    }`}></div>
                    <span className="text-white/90 text-xs sm:text-sm">
                      {stats.systemStatus === 'Aktif' ? 'Tüm servisler çalışıyor' : 
                       stats.systemStatus === 'Kontrol ediliyor...' ? 'Bağlantı test ediliyor' : 
                       'Bağlantı Sorunu'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  {stats.systemStatus === 'Aktif' ? (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l5 5L20 7" />
                    </svg>
                  ) : stats.systemStatus === 'Kontrol ediliyor...' ? (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Toolbar */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-4">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Favori Raporlar</h3>
              <button
                onClick={() => setShowPinnedSelector(!showPinnedSelector)}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Özelleştir</span>
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-gray-500">
                {pinnedReports.length > 0 ? `${pinnedReports.length}/6 favori` : 'Tüm servisler hazır'}
              </span>
            </div>
          </div>
          
          {/* Rapor Seçici Modal */}
          {showPinnedSelector && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Favori Raporlar Özelleştir</h3>
                  <button
                    onClick={() => setShowPinnedSelector(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-600 mb-4">En fazla 6 rapor seçebilirsiniz. Sık kullandığınız raporları favorilere ekleyin.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {userReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                                                 <input
                           type="checkbox"
                           checked={pinnedReports.includes(report.id.toString())}
                           onChange={() => togglePinnedReport(report.id.toString())}
                           disabled={!pinnedReports.includes(report.id.toString()) && pinnedReports.length >= 6}
                           className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                         />
                        <div>
                          <p className="font-medium text-gray-900">{report.report_name}</p>
                          <p className="text-sm text-gray-500">{report.report_description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                                                 {pinnedReports.includes(report.id.toString()) && (
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                        {!report.has_access && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                            Kilitli
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setPinnedReports([])}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Tümünü Kaldır
                  </button>
                  <button
                    onClick={() => setShowPinnedSelector(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Tamam
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 items-stretch">
            {/* Dinamik Rapor Kartları */}
            {loadingReports ? (
              // Loading kartları
              Array.from({length: 6}).map((_, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200 animate-pulse h-full flex flex-col">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-300 rounded-xl"></div>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gray-300 rounded"></div>
                  </div>
                  <div className="h-4 sm:h-5 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 sm:h-4 bg-gray-300 rounded mb-3 sm:mb-4"></div>
                  <div className="flex items-center space-x-2 mt-auto">
                    <div className="w-10 h-4 sm:w-12 sm:h-5 bg-gray-300 rounded-full"></div>
                    <div className="w-16 h-3 sm:w-20 sm:h-3 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))
            ) : (
              // Sabitlenmiş raporlar varsa onları göster, yoksa ilk 3 raporu göster
              (() => {
                const reportsToShow = pinnedReports.length > 0 
                  ? pinnedReports.map(pinnedId => 
                      userReports.find(report => report.id.toString() === pinnedId)
                    ).filter(Boolean).slice(0, 6)
                  : userReports.slice(0, 6);
                
                return reportsToShow.map((report, idx) => {
                  if (!report) return null;
                  
                  const colors = getReportCardColors(report, idx);
                  const isPinned = pinnedReports.includes(report.id.toString());
                  
                  return (
                    <div key={report.id} className="group cursor-pointer" 
                         onClick={() => handleReportClick(report, router)}>
                      <div className={`bg-gradient-to-br ${colors.bgGradient} rounded-xl p-4 sm:p-6 border ${colors.border} hover:${colors.hoverBorder} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${colors.opacity} relative h-full flex flex-col`}>
                        {/* Sabitlenmiş rapor işareti */}
                        {isPinned && (
                          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            </div>
                          </div>
                        )}
                        
                        {/* Kilitli rapor overlay'i */}
                        {!report.has_access && !isPinned && (
                          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${colors.iconBg} rounded-xl flex items-center justify-center text-white`}>
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getReportIcon(report.report_name)} />
                            </svg>
                          </div>
                          {report.has_access ? (
                            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.arrowColor} group-hover:${colors.arrowHover} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          ) : (
                            <div className="text-gray-400 text-xs font-medium bg-gray-200 px-2 py-1 rounded-full">
                              Kilitli
                            </div>
                          )}
                        </div>
                        <h4 className={`text-base sm:text-lg font-semibold ${colors.textColor} mb-1 sm:mb-2`}>{report.report_name}</h4>
                        <p className={`${colors.textColor} text-xs sm:text-sm mb-3 sm:mb-4`}>{report.report_description}</p>
                        <div className="flex items-center space-x-2 mt-auto">
                                                  <span className={`${colors.badgeBg} text-white text-xs px-2 py-1 rounded-full`}>
                          {report.has_access ? (isPinned ? 'Favori' : 'Hazır') : 'Premium'}
                        </span>
                          <span className="text-xs text-gray-500">
                            {report.has_access ? 'Son güncelleme: Bugün' : 'Paket gerekli'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}

            {/* Eğer 6'dan az rapor varsa boş kartları doldur */}
            {!loadingReports && (() => {
              const reportsToShow = pinnedReports.length > 0 
                ? pinnedReports.map(pinnedId => 
                    userReports.find(report => report.id.toString() === pinnedId)
                  ).filter(Boolean).slice(0, 6)
                : userReports.slice(0, 6);
              
              return reportsToShow.length < 6 && (
                Array.from({length: 6 - reportsToShow.length}).map((_, index) => (
                  <div key={`empty-${index}`} className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200 opacity-50 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-300 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>
                    <h4 className="text-base sm:text-lg font-semibold text-gray-500 mb-1 sm:mb-2">
                      Favori Rapor Ekleyin
                    </h4>
                    <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
                      Özelleştir butonuna tıklayarak buraya favori raporlarınızı ekleyebilirsiniz
                    </p>
                    <div className="flex items-center space-x-2 mt-auto">
                      <span className="bg-gray-300 text-gray-600 text-xs px-2 py-1 rounded-full">
                        Özelleştir
                      </span>
                    </div>
                  </div>
                ))
              );
            })()}

            {/* Eğer hiç rapor yoksa */}
            {!loadingReports && (() => {
              const reportsToShow = pinnedReports.length > 0 
                ? pinnedReports.map(pinnedId => 
                    userReports.find(report => report.id.toString() === pinnedId)
                  ).filter(Boolean).slice(0, 6)
                : userReports.slice(0, 6);
              
              return reportsToShow.length === 0 && (
                <div className="md:col-span-3 lg:col-span-3 xl:col-span-6 text-center py-8 sm:py-12">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-base sm:text-lg">
                    {pinnedReports.length > 0 ? 'Favori rapor bulunmuyor' : 'Henüz erişilebilir rapor bulunmuyor'}
                  </p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-2">
                    {pinnedReports.length > 0 
                      ? 'Özelleştir butonuna tıklayarak rapor seçin veya favorileri kaldırın'
                      : 'Yöneticinizle iletişime geçerek rapor erişimi talep edebilirsiniz'
                    }
                  </p>
                </div>
              );
            })()}


          </div>
        </div>

        {/* Tanımlı Raporlar Bölümü */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Tanımlı Raporlar</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm text-gray-500">
                  {loadingReports ? 'Yükleniyor...' : `${userReports.length} rapor mevcut`}
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {loadingReports ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-2 text-sm text-gray-500">Raporlar yükleniyor...</span>
              </div>
            ) : userReports.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">Henüz erişilebilir rapor bulunmuyor</p>
                <p className="text-gray-400 text-sm mt-2">Yöneticinizle iletişime geçerek rapor erişimi talep edebilirsiniz</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Raporları kategoriye göre grupla
                  const groupedReports = userReports.reduce((groups: {[key: string]: ReportWithAccess[]}, report) => {
                    const category = report.category || 'Diğer Raporlar';
                    if (!groups[category]) {
                      groups[category] = [];
                    }
                    groups[category].push(report);
                    return groups;
                  }, {});

                  return Object.entries(groupedReports).map(([categoryName, reports]) => (
                    <div key={categoryName} className="border border-gray-200 rounded-lg">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">{categoryName}</h4>
                              <p className="text-sm text-gray-500">{reports.length} rapor</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {reports.map((report) => (
                            <div
                              key={report.id}
                              className={`group cursor-pointer p-4 border rounded-lg transition-all duration-200 hover:shadow-md ${
                                report.has_access 
                                  ? 'border-gray-200 hover:border-red-300 hover:bg-red-50' 
                                  : 'border-gray-200 bg-gray-50 opacity-60'
                              }`}
                              onClick={() => handleReportClick(report, router)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h5 className="text-sm font-medium text-gray-900 mb-1">
                                    {report.report_name}
                                  </h5>
                                  <p className="text-xs text-gray-500 line-clamp-2">
                                    {report.report_description}
                                  </p>
                                </div>
                                <div className="ml-3 flex-shrink-0">
                                  {report.has_access ? (
                                    <svg className="w-4 h-4 text-red-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                  ) : (
                                    <div className="w-6 h-6 bg-gray-400 rounded flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  report.has_access 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {report.has_access ? 'Erişilebilir' : 'Kilitli'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  #{report.id}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper fonksiyonlar
const formatLicenseDate = (dateString: string) => {
  if (!dateString) return 'Tarih bilgisi yok';
  
  const targetDate = new Date(dateString);
  const currentDate = new Date();
  
  // Türkçe ay isimleri (kısa)
  const months = [
    'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
    'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
  ];
  
  // Formatlanmış tarih (gg ay yyyy)
  const day = targetDate.getDate();
  const month = months[targetDate.getMonth()];
  const year = targetDate.getFullYear();
  
  // Kalan gün hesaplama
  const timeDiff = targetDate.getTime() - currentDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  if (daysDiff < 0) {
    return `${day} ${month} ${year} (Dolmuş)`;
  } else if (daysDiff === 0) {
    return `${day} ${month} ${year} (Bugün)`;
  } else if (daysDiff <= 30) {
    return `${day} ${month} ${year} (${daysDiff} gün)`;
  } else {
    const months = Math.floor(daysDiff / 30);
    return `${day} ${month} ${year} (${months} ay)`;
  }
};

const colorPalette = [
  {
    bgGradient: 'from-blue-50 to-blue-100',
    border: 'border-blue-200',
    hoverBorder: 'border-blue-300',
    iconBg: 'from-blue-500 to-blue-600',
    arrowColor: 'text-blue-400',
    arrowHover: 'text-blue-600',
    badgeBg: 'bg-blue-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  },
  {
    bgGradient: 'from-red-50 to-red-100',
    border: 'border-red-200',
    hoverBorder: 'border-red-300',
    iconBg: 'from-red-500 to-red-600',
    arrowColor: 'text-red-400',
    arrowHover: 'text-red-600',
    badgeBg: 'bg-red-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  },
  {
    bgGradient: 'from-emerald-50 to-emerald-100',
    border: 'border-emerald-200',
    hoverBorder: 'border-emerald-300',
    iconBg: 'from-emerald-500 to-emerald-600',
    arrowColor: 'text-emerald-400',
    arrowHover: 'text-emerald-600',
    badgeBg: 'bg-emerald-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  },
  {
    bgGradient: 'from-orange-50 to-orange-100',
    border: 'border-orange-200',
    hoverBorder: 'border-orange-300',
    iconBg: 'from-orange-500 to-orange-600',
    arrowColor: 'text-orange-400',
    arrowHover: 'text-orange-600',
    badgeBg: 'bg-orange-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  },
  {
    bgGradient: 'from-purple-50 to-purple-100',
    border: 'border-purple-200',
    hoverBorder: 'border-purple-300',
    iconBg: 'from-purple-500 to-purple-600',
    arrowColor: 'text-purple-400',
    arrowHover: 'text-purple-600',
    badgeBg: 'bg-purple-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  },
  {
    bgGradient: 'from-pink-50 to-pink-100',
    border: 'border-pink-200',
    hoverBorder: 'border-pink-300',
    iconBg: 'from-pink-500 to-pink-600',
    arrowColor: 'text-pink-400',
    arrowHover: 'text-pink-600',
    badgeBg: 'bg-pink-500',
    textColor: 'text-gray-900',
    opacity: 'opacity-100'
  }
];

const getReportCardColors = (report: ReportWithAccess, idx?: number) => {
  if (!report.has_access) {
    return {
      bgGradient: 'from-gray-50 to-gray-100',
      border: 'border-gray-200',
      hoverBorder: 'border-gray-300',
      iconBg: 'from-gray-400 to-gray-500',
      arrowColor: 'text-gray-400',
      arrowHover: 'text-gray-500',
      badgeBg: 'bg-gray-400',
      textColor: 'text-gray-600',
      opacity: 'opacity-60'
    };
  }
  // Favorilerde index verilirse sıraya göre renk
  if (typeof idx === 'number') {
    return colorPalette[idx % colorPalette.length];
  }
  // Diğer kartlar için id'ye göre renk
  const idIdx = report.id % colorPalette.length;
  return colorPalette[idIdx];
};

const getReportRoute = (report: ReportWithAccess) => {
  // Önce API'den gelen route bilgisini kullan
  if (report.route_path) {
    return report.route_path;
  } else if (report.route) {
    return `/${report.route}`;
  }
  
  // API'de route bilgisi yoksa fallback olarak isim bazlı eşleştirme yap
  const reportName = report.report_name;
  if (reportName.toLocaleLowerCase('tr-TR').includes('cari') || reportName.toLocaleLowerCase('tr-TR').includes('bakiye')) {
    return '/c-bakiye';
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('enpos') && reportName.toLocaleLowerCase('tr-TR').includes('ciro')) {
    return '/enpos-ciro';
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('stok') || reportName.toLocaleLowerCase('tr-TR').includes('envanter')) {
    return '/envanter-raporu';
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('fatura') && reportName.toLocaleLowerCase('tr-TR').includes('kontrol')) {
    return '/fatura-kontrol';
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('hareket') && reportName.toLocaleLowerCase('tr-TR').includes('görmeyen')) {
    return '/hareket-gormeyen-cariler';
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('satılan') || reportName.toLocaleLowerCase('tr-TR').includes('malzeme')) {
    return '/en-cok-satilan-malzemeler';
  }
  
  return null; // Henüz route'u olmayan raporlar
};

const getReportIcon = (reportName: string) => {
  if (reportName.toLocaleLowerCase('tr-TR').includes('cari') || reportName.toLocaleLowerCase('tr-TR').includes('bakiye')) {
    return "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('ciro') || reportName.toLocaleLowerCase('tr-TR').includes('satış')) {
    return "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1";
  } else if (reportName.toLocaleLowerCase('tr-TR').includes('stok') || reportName.toLocaleLowerCase('tr-TR').includes('envanter')) {
    return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
  } else {
    return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
  }
};

const handleReportClick = (report: ReportWithAccess, router: any) => {
  console.log(`🔍 handleReportClick - Rapor: ${report.report_name}, has_access: ${report.has_access}`);
  
  // Erişim yetkisi kontrolü
  if (!report.has_access) {
    console.log(`❌ Erişim reddedildi - ${report.report_name} için yetki yok`);
    alert(`🔒 ${report.report_name} rapora erişim yetkiniz bulunmamaktadır.\n\nBu raporu kullanabilmek için paket yükseltmesi yapmanız gerekmektedir.\n\nPaket bilgileri için Ayarlar > Plan Yönetimi bölümünü ziyaret edebilirsiniz.`);
    return;
  }
  
  // Route'u belirle (API'den gelen bilgi öncelikli)
  const route = getReportRoute(report);
  
  if (!route) {
    alert(`${report.report_name} henüz hazır değil. Yakında erişilebilir olacak.`);
    return;
  }
  
  console.log(`✅ Erişim onaylandı - ${report.report_name} raporu açılıyor: ${route}`);
  router.push(route);
}; 