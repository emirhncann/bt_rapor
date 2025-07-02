'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from './components/DashboardLayout';
import { fetchUserReports, getCurrentUser, getAuthorizedReports, groupReportsByCategory } from './utils/simple-permissions';
import type { ReportWithAccess } from './utils/simple-permissions';

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
  const [stats, setStats] = useState({
    totalReports: 0,
    accessibleReports: 0,
    activeUsers: 0,
    monthlyQueries: 0,
    systemStatus: 'Aktif'
  });
  const router = useRouter();
  
  // Animation data'yı yükleyelim
  const [animationData, setAnimationData] = useState(null);
  
  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animated counters effect - gerçek verilerle
  useEffect(() => {
    if (isAuthenticated && !loadingReports) {
      const animateStats = () => {
        const accessibleReports = userReports.filter(r => r.has_access).length;
        const targets = { 
          totalReports: userReports.length, 
          accessibleReports: accessibleReports,
          activeUsers: 12
        };
        let currentStats = { totalReports: 0, accessibleReports: 0, activeUsers: 0 };
        
        const duration = 2000;
        const stepTime = 50;
        const steps = duration / stepTime;
        
        const increment = {
          totalReports: targets.totalReports / steps,
          accessibleReports: targets.accessibleReports / steps,
          activeUsers: targets.activeUsers / steps
        };
        
        const timer = setInterval(() => {
          currentStats.totalReports = Math.min(currentStats.totalReports + increment.totalReports, targets.totalReports);
          currentStats.accessibleReports = Math.min(currentStats.accessibleReports + increment.accessibleReports, targets.accessibleReports);
          currentStats.activeUsers = Math.min(currentStats.activeUsers + increment.activeUsers, targets.activeUsers);
          
          setStats({
            totalReports: Math.round(currentStats.totalReports),
            accessibleReports: Math.round(currentStats.accessibleReports),
            activeUsers: Math.round(currentStats.activeUsers),
            monthlyQueries: 0, // Artık kullanılmıyor ama state'te var
            systemStatus: 'Aktif'
          });
          
          if (currentStats.totalReports >= targets.totalReports && 
              currentStats.accessibleReports >= targets.accessibleReports &&
              currentStats.activeUsers >= targets.activeUsers) {
            clearInterval(timer);
          }
        }, stepTime);
      };
      
      setTimeout(animateStats, 500);
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
        'c-bakiye': 'Cari Bakiye Raporu'
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

  // Kullanıcı raporlarını yükle ve localStorage'a kaydet
  const loadUserReports = async () => {
    try {
      setLoadingReports(true);
      const currentUser = getCurrentUser();
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        console.warn('Company ref bulunamadı');
        setLoadingReports(false);
        return;
      }

      console.log('🔄 Dashboard - Kullanıcı raporları yükleniyor...');
      
      // API'den tüm raporları çek (yetki bilgisi ile birlikte)
      const {reports: allReports, planInfo: planData} = await fetchUserReports(companyRef, currentUser?.id);
      console.log('📊 Dashboard - Çekilen raporlar:', allReports);
      console.log('📋 Dashboard - Plan bilgileri:', planData);
      
      // State'e tüm raporları kaydet (kilitli olanlar dahil)
      setUserReports(allReports);
      setPlanInfo(planData);
      
      // LocalStorage'a sadece yetkili raporları kaydet (diğer sayfalar için)
      const authorizedReports = getAuthorizedReports(allReports);
      localStorage.setItem('userAuthorizedReports', JSON.stringify(authorizedReports));
      localStorage.setItem('userReportsLastUpdate', Date.now().toString());
      
      console.log('💾 Dashboard - Tüm raporlar yüklendi, yetkili raporlar localStorage\'a kaydedildi');
      
    } catch (error) {
      console.error('❌ Dashboard - Raporlar yüklenirken hata:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const name = localStorage.getItem('userName');
      const role = localStorage.getItem('userRole');
      const company = localStorage.getItem('companyName');
      
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        setUserName(name || '');
        setUserRole(role || '');
        setCompanyName(company || '');
        loadConnectionInfoToStorage();
        loadUserReports(); // Kullanıcı raporlarını yükle
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Connection bilgilerini localStorage'a kaydet
  const loadConnectionInfoToStorage = async () => {
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('Company ref bulunamadı, connection bilgileri yüklenemedi');
        return;
      }

      console.log('🔄 Ana sayfada connection bilgileri localStorage\'a kaydediliyor...');
      
      const response = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
      const data = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
        const connectionInfo = data.data;
        localStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
        console.log('✅ Connection bilgileri localStorage\'a kaydedildi:', connectionInfo);
      } else {
        console.log('⚠️ Connection bilgileri alınamadı:', data.message);
      }
    } catch (error) {
      console.error('❌ Connection bilgileri yüklenirken hata:', error);
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

  return (
    <DashboardLayout title="İş Zekası Dashboard">
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
                <div className="relative">
                  <img 
                    src="/img/btRapor.png" 
                    alt="btRapor Logo" 
                    className="h-20 w-auto bg-white rounded-2xl p-3 border border-white/20"
                  />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-4xl font-bold text-white">
                      Merhaba, {userName}! 👋
                    </h1>
                  </div>
                  <p className="text-xl text-red-100 font-medium mb-2">
                    İş Dünyasına Dair Tüm Raporlar
                  </p>
                  {companyName && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <p className="text-red-200 text-lg">
                        🏢 {companyName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="hidden lg:block">
                <div className="text-right space-y-2">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                   
                    <p className="text-2xl font-bold text-white">
                      {currentTime.toLocaleTimeString('tr-TR', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-red-300 text-sm">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Toplam Rapor */}
          <div className="group">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Toplam Rapor</p>
                  <p className="text-3xl font-bold mt-2">{stats.totalReports}</p>
                  <div className="flex items-center mt-2 space-x-1">
                    <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-yellow-300 text-sm">{stats.accessibleReports} erişilebilir</span>
                  </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Aktif Kullanıcılar */}
          <div className="group">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Aktif Kullanıcı</p>
                  <p className="text-3xl font-bold mt-2">{stats.activeUsers}</p>
                  <div className="flex items-center mt-2 space-x-1">
                    <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-green-300 text-sm">+3 yeni kullanıcı</span>
                  </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Bilgileri */}
          <div className="group">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Aktif Plan</p>
                  <p className="text-2xl font-bold mt-2">
                    {planInfo.planName ? `${planInfo.planName} Paket` : 'Plan Yükleniyor...'}
                  </p>
                  <div className="flex items-center mt-2 space-x-1">
                    <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-yellow-300 text-sm">
                      {planInfo.licenceEnd ? formatLicenseDate(planInfo.licenceEnd) : 'Lisans bilgisi yükleniyor...'}
                    </span>
                  </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sistem Durumu */}
          <div className="group">
            <div className="bg-gradient-to-br from-red-700 to-red-800 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Sistem Durumu</p>
                  <p className="text-2xl font-bold mt-2 text-white">{stats.systemStatus}</p>
                  <div className="flex items-center mt-2 space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm">Tüm servisler çalışıyor</span>
                  </div>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l5 5L20 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Toolbar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Hızlı Erişim</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Tüm servisler hazır</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dinamik Rapor Kartları */}
            {loadingReports ? (
              // Loading kartları
              Array.from({length: 3}).map((_, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-200 animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-xl"></div>
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                  </div>
                  <div className="h-5 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded mb-4"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-12 h-5 bg-gray-300 rounded-full"></div>
                    <div className="w-20 h-3 bg-gray-300 rounded"></div>
                  </div>
                </div>
              ))
            ) : (
              // Gerçek rapor kartları
              userReports.slice(0, 3).map((report) => {
                const colors = getReportCardColors(report.report_name, report.has_access);
                const route = getReportRoute(report.report_name);
                
                return (
                  <div key={report.id} className="group cursor-pointer" 
                       onClick={() => handleReportClick(report, route, router)}>
                    <div className={`bg-gradient-to-br ${colors.bgGradient} rounded-xl p-6 border ${colors.border} hover:${colors.hoverBorder} transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${colors.opacity} relative`}>
                      {/* Kilitli rapor overlay'i */}
                      {!report.has_access && (
                        <div className="absolute top-3 right-3">
                          <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 bg-gradient-to-br ${colors.iconBg} rounded-xl flex items-center justify-center text-white`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getReportIcon(report.report_name)} />
                          </svg>
                        </div>
                        {report.has_access ? (
                          <svg className={`w-5 h-5 ${colors.arrowColor} group-hover:${colors.arrowHover} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        ) : (
                          <div className="text-gray-400 text-xs font-medium bg-gray-200 px-2 py-1 rounded-full">
                            Kilitli
                          </div>
                        )}
                      </div>
                      <h4 className={`text-lg font-semibold ${colors.textColor} mb-2`}>{report.report_name}</h4>
                      <p className={`${colors.textColor} text-sm mb-4`}>{report.report_description}</p>
                      <div className="flex items-center space-x-2">
                        <span className={`${colors.badgeBg} text-white text-xs px-2 py-1 rounded-full`}>
                          {report.has_access ? 'Hazır' : 'Premium'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {report.has_access ? 'Son güncelleme: Bugün' : 'Paket gerekli'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Eğer 3'ten az rapor varsa boş kartları doldur */}
            {!loadingReports && userReports.length > 0 && userReports.length < 3 && (
              Array.from({length: 3 - userReports.length}).map((_, index) => (
                <div key={`empty-${index}`} className="bg-gray-50 rounded-xl p-6 border border-gray-200 opacity-50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-500 mb-2">Yakında</h4>
                  <p className="text-gray-400 text-sm mb-4">Yeni raporlar ekleniyor...</p>
                  <div className="flex items-center space-x-2">
                    <span className="bg-gray-300 text-gray-600 text-xs px-2 py-1 rounded-full">Geliştiriliyor</span>
                  </div>
                </div>
              ))
            )}

            {/* Eğer hiç rapor yoksa */}
            {!loadingReports && userReports.length === 0 && (
              <div className="md:col-span-3 text-center py-12">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">Henüz erişilebilir rapor bulunmuyor</p>
                <p className="text-gray-400 text-sm mt-2">Yöneticinizle iletişime geçerek rapor erişimi talep edebilirsiniz</p>
              </div>
            )}

            {/* Gelişmiş Analiz */}
            <div className="group">
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 hover:border-red-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-700 to-red-800 rounded-xl flex items-center justify-center text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <svg className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Gelişmiş Analiz</h4>
                <p className="text-gray-600 text-sm mb-4">AI destekli veri analizi ve tahmine dayalı raporlama</p>
                <div className="flex items-center space-x-2">
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">Yakında</span>
                  <span className="text-xs text-gray-500">Geliştiriliyor</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Raporlar Bölümü - Kategoriler */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">Rapor Kategorileri</h3>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-500">6 kategori, 15-20 rapor hazırlanıyor</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Finansal Raporlar Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 hover:border-red-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Finansal Raporlar</h4>
                  <p className="text-gray-600 text-sm mb-4">Cari bakiye, gelir-gider ve mali tablolar</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-medium">5-6 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>

              {/* Satış Raporları Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 hover:border-blue-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Satış Raporları</h4>
                  <p className="text-gray-600 text-sm mb-4">Ciro, performans ve satış analizleri</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">4-5 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>

              {/* Stok Raporları Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Stok Raporları</h4>
                  <p className="text-gray-600 text-sm mb-4">Envanter, stok hareket ve analiz raporları</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">3-4 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>

              {/* Müşteri Raporları Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200 hover:border-orange-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-orange-400 group-hover:text-orange-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Müşteri Raporları</h4>
                  <p className="text-gray-600 text-sm mb-4">Müşteri analizi, segmentasyon ve CRM raporları</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-medium">3-4 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>

              {/* Analiz Raporları Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 hover:border-purple-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Analiz Raporları</h4>
                  <p className="text-gray-600 text-sm mb-4">Trend analizi, karşılaştırma ve istatistikler</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium">2-3 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>

              {/* Diğer Raporlar Kategorisi */}
              <div className="group cursor-pointer">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center text-white">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Diğer Raporlar</h4>
                  <p className="text-gray-600 text-sm mb-4">Özel raporlar ve sistem kayıtları</p>
                  <div className="flex items-center justify-between">
                    <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full font-medium">1-2 Rapor</span>
                    <span className="text-xs text-gray-500">Hazırlanıyor</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alt Bilgi */}
            <div className="mt-8 text-center p-6 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200">
              <div className="flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-lg font-semibold text-gray-900">Rapor Geliştirme Süreci</h4>
              </div>
              <p className="text-gray-600 mb-4">
                Tüm rapor kategorilerinde toplam 15-20 adet detaylı rapor hazırlanmaktadır. Her kategori kendi özel sayfasına sahip olacak ve gelişmiş filtreleme seçenekleri sunacaktır.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Aktif Geliştirme</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Kullanıcı Odaklı</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Modern Tasarım</span>
                </div>
              </div>
            </div>
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

const getReportCardColors = (reportName: string, hasAccess: boolean = true) => {
  // Kilitli raporlar için gri tema
  if (!hasAccess) {
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

  if (reportName.toLowerCase().includes('cari') || reportName.toLowerCase().includes('bakiye')) {
    return {
      bgGradient: 'from-red-50 to-red-100',
      border: 'border-red-200',
      hoverBorder: 'border-red-300',
      iconBg: 'from-red-500 to-red-600',
      arrowColor: 'text-red-400',
      arrowHover: 'text-red-600',
      badgeBg: 'bg-red-500',
      textColor: 'text-gray-900',
      opacity: 'opacity-100'
    };
  } else if (reportName.toLowerCase().includes('ciro') || reportName.toLowerCase().includes('satış')) {
    return {
      bgGradient: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      hoverBorder: 'border-blue-300',
      iconBg: 'from-blue-500 to-blue-600',
      arrowColor: 'text-blue-400',
      arrowHover: 'text-blue-600',
      badgeBg: 'bg-blue-500',
      textColor: 'text-gray-900',
      opacity: 'opacity-100'
    };
  } else if (reportName.toLowerCase().includes('stok') || reportName.toLowerCase().includes('envanter')) {
    return {
      bgGradient: 'from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      hoverBorder: 'border-emerald-300',
      iconBg: 'from-emerald-500 to-emerald-600',
      arrowColor: 'text-emerald-400',
      arrowHover: 'text-emerald-600',
      badgeBg: 'bg-emerald-500',
      textColor: 'text-gray-900',
      opacity: 'opacity-100'
    };
  } else {
    return {
      bgGradient: 'from-purple-50 to-purple-100',
      border: 'border-purple-200',
      hoverBorder: 'border-purple-300',
      iconBg: 'from-purple-500 to-purple-600',
      arrowColor: 'text-purple-400',
      arrowHover: 'text-purple-600',
      badgeBg: 'bg-purple-500',
      textColor: 'text-gray-900',
      opacity: 'opacity-100'
    };
  }
};

const getReportRoute = (reportName: string) => {
  if (reportName.toLowerCase().includes('cari') || reportName.toLowerCase().includes('bakiye')) {
    return '/c-bakiye';
  } else if (reportName.toLowerCase().includes('enpos') && reportName.toLowerCase().includes('ciro')) {
    return '/enpos-ciro';
  }
  return null; // Henüz route'u olmayan raporlar
};

const getReportIcon = (reportName: string) => {
  if (reportName.toLowerCase().includes('cari') || reportName.toLowerCase().includes('bakiye')) {
    return "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
  } else if (reportName.toLowerCase().includes('ciro') || reportName.toLowerCase().includes('satış')) {
    return "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1";
  } else if (reportName.toLowerCase().includes('stok') || reportName.toLowerCase().includes('envanter')) {
    return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
  } else {
    return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
  }
};

const handleReportClick = (report: ReportWithAccess, route: string | null, router: any) => {
  // Erişim yetkisi kontrolü
  if (!report.has_access) {
    alert(`🔒 ${report.report_name} rapora erişim yetkiniz bulunmamaktadır.\n\nBu raporu kullanabilmek için paket yükseltmesi yapmanız gerekmektedir.\n\nPaket bilgileri için Ayarlar > Plan Yönetimi bölümünü ziyaret edebilirsiniz.`);
    return;
  }
  
  if (!route) {
    alert(`${report.report_name} henüz hazır değil. Yakında erişilebilir olacak.`);
    return;
  }
  
  console.log(`🔄 Dashboard - ${report.report_name} raporu açılıyor...`);
  router.push(route);
}; 