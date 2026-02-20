'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from './components/DashboardLayout';
import SessionManager from './components/SessionManager';
import { fetchUserReports, getCurrentUser, getAuthorizedReports, isSuperAdmin } from './utils/simple-permissions';
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
  const [pinnedReports, setPinnedReports] = useState<string[]>([]);
  const [showPinnedSelector, setShowPinnedSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Tümü');
  const [sliderIndex, setSliderIndex] = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const [stats, setStats] = useState({
    totalReports: 0,
    accessibleReports: 0,
    activeUsers: 0,
    userCount: 0,
    monthlyQueries: 0,
    systemStatus: 'Kontrol ediliyor...'
  });
  const router = useRouter();

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !loadingReports) {
      const updateStats = async () => {
        const accessibleReports = userReports.filter(r => r.has_access).length;
        const userData = await fetchActiveUsers();
        const systemStatus = await testSystemStatus();
        setStats({ totalReports: userReports.length, accessibleReports, activeUsers: userData.totalUsers, userCount: userData.userCount, monthlyQueries: 0, systemStatus });
      };
      setTimeout(updateStats, 500);
    }
  }, [isAuthenticated, loadingReports, userReports.length]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    const report = searchParams.get('report');
    if (error === 'access_denied' && report) {
      const reportNames: {[key: string]: string} = { 'enpos-ciro': 'Enpos Ciro Raporu', 'c-bakiye': 'Cari Bakiye Raporu', 'hareket-gormeyen-cariler': 'Hareket Görmeyen Cariler' };
      setAccessDeniedInfo({ show: true, report: reportNames[report] || report });
      window.history.replaceState({}, '', '/');
      setTimeout(() => setAccessDeniedInfo(null), 10000);
    }
  }, []);

  const loadPinnedReports = async () => {
    try {
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      if (!currentUser || !companyRef) return;
      const response = await fetch(`https://api.btrapor.com/get-favorite-reports?user_ref=${currentUser.id}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setPinnedReports(data.data.flatMap((item: string) => item.split('-').filter((id: string) => id.trim() !== '')));
        } else {
          const savedPinned = sessionStorage.getItem('pinnedReports');
          if (savedPinned) setPinnedReports(JSON.parse(savedPinned));
        }
      } else {
        const savedPinned = sessionStorage.getItem('pinnedReports');
        if (savedPinned) setPinnedReports(JSON.parse(savedPinned));
      }
    } catch {
      const savedPinned = sessionStorage.getItem('pinnedReports');
      if (savedPinned) { try { setPinnedReports(JSON.parse(savedPinned)); } catch { setPinnedReports([]); } }
    }
  };

  const togglePinnedReport = async (reportId: string) => {
    const newPinned = pinnedReports.includes(reportId)
      ? pinnedReports.filter(id => id !== reportId)
      : pinnedReports.length < 6 ? [...pinnedReports, reportId] : pinnedReports;
    setPinnedReports(newPinned);
    sessionStorage.setItem('pinnedReports', JSON.stringify(newPinned));
    try {
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      if (currentUser && companyRef) {
        await fetch('https://api.btrapor.com/save-favorite-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_ref: currentUser.id, report_id: newPinned.join('-') }) });
      }
    } catch { /* silent */ }
  };

  const loadUserReports = async () => {
    try {
      setLoadingReports(true);
      const currentUser = getCurrentUser();
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) { setLoadingReports(false); return; }
      const {reports: allReports, planInfo: planData} = await fetchUserReports(companyRef, currentUser?.id);
      setUserReports(allReports);
      setPlanInfo(planData);
      const authorizedReports = getAuthorizedReports(allReports);
      sessionStorage.setItem('userAuthorizedReports', JSON.stringify(authorizedReports));
      sessionStorage.setItem('userReportsLastUpdate', Date.now().toString());
    } catch { setUserReports([]); } finally { setLoadingReports(false); }
  };

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
        loadUserReports();
        loadPinnedReports();
      } else { router.push('/login'); }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  const fetchActiveUsers = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) return { totalUsers: 0, userCount: 0 };
      const response = await fetch('https://api.btrapor.com/user-count', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_ref: companyRef }) });
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) {
          const adminCount = Number(result.data.admin) || 0;
          const userCount = Number(result.data.user) || 0;
          return { totalUsers: adminCount + userCount, userCount };
        }
      }
      return { totalUsers: 0, userCount: 0 };
    } catch { return { totalUsers: 0, userCount: 0 }; }
  };

  const testSystemStatus = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) return 'Pasif';
      const response = await sendSecureProxyRequest(companyRef, 'first_db_key', { query: 'SELECT 1 AS test_result' });
      if (response.ok) {
        const result = await response.json();
        let testResult = null;
        if (Array.isArray(result) && result.length > 0) testResult = result[0];
        else if (result?.data && Array.isArray(result.data) && result.data.length > 0) testResult = result.data[0];
        else if (result?.recordset && Array.isArray(result.recordset) && result.recordset.length > 0) testResult = result.recordset[0];
        return testResult?.test_result === 1 ? 'Aktif' : 'Pasif';
      }
      return 'Pasif';
    } catch { return 'Pasif'; }
  };

  const loadConnectionInfoToStorage = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) return;
      const response = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
      const data = await response.json();
      if (response.ok && data.status === 'success' && data.data) {
        sessionStorage.setItem('connectionInfo', JSON.stringify(data.data));
        const systemStatus = await testSystemStatus();
        const userData = await fetchActiveUsers();
        setStats(prev => ({ ...prev, systemStatus, activeUsers: userData.totalUsers, userCount: userData.userCount }));
      } else {
        setStats(prev => ({ ...prev, systemStatus: 'Pasif' }));
      }
    } catch { setStats(prev => ({ ...prev, systemStatus: 'Pasif' })); }
  };

  useEffect(() => {
    if (isAuthenticated && isSuperAdmin()) router.push('/super-admin');
  }, [isAuthenticated, router]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(userReports.map(r => r.category || 'Diğer')));
    return ['Tümü', ...cats];
  }, [userReports]);

  const filteredReports = useMemo(() => {
    return userReports.filter(r => {
      const matchSearch = !searchQuery ||
        r.report_name.toLocaleLowerCase('tr-TR').includes(searchQuery.toLocaleLowerCase('tr-TR')) ||
        (r.report_description || '').toLocaleLowerCase('tr-TR').includes(searchQuery.toLocaleLowerCase('tr-TR'));
      const matchCat = activeCategory === 'Tümü' || (r.category || 'Diğer') === activeCategory;
      return matchSearch && matchCat;
    });
  }, [userReports, searchQuery, activeCategory]);

  const groupedFilteredReports = useMemo(() => {
    return filteredReports.reduce((groups: {[key: string]: ReportWithAccess[]}, report) => {
      const category = report.category || 'Diğer';
      if (!groups[category]) groups[category] = [];
      groups[category].push(report);
      return groups;
    }, {});
  }, [filteredReports]);

  const pinnedReportObjects = useMemo(() => {
    return pinnedReports.map(id => userReports.find(r => r.id.toString() === id)).filter(Boolean) as ReportWithAccess[];
  }, [pinnedReports, userReports]);

  // Slider için erişilebilir raporlar
  const sliderReports = useMemo(() => {
    return userReports.filter(r => r.has_access);
  }, [userReports]);

  // Otomatik slider
  useEffect(() => {
    if (sliderPaused || sliderReports.length <= 1) return;
    const timer = setInterval(() => {
      setSliderIndex(prev => (prev + 1) % sliderReports.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [sliderPaused, sliderReports.length]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || isSuperAdmin()) return null;

  const isSearching = searchQuery.trim().length > 0;

  return (
    <DashboardLayout title="Dashboard">
      <SessionManager />

      {/* Full-bleed wrapper — negatif margin ile DashboardLayout padding'ini aşıyoruz */}
      <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6">

        {/* ═══════════════════════════════════════════════════════
            KOYU HERO BÖLÜMÜ
        ═══════════════════════════════════════════════════════ */}
        <div className="relative bg-slate-900 overflow-hidden">
          {/* Arka plan efektleri */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-700/20 rounded-full blur-3xl"></div>
            <div className="absolute top-0 left-1/3 w-64 h-64 bg-red-900/10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-700/30 rounded-full blur-2xl"></div>
            {/* Grid desen */}
            <div className="absolute inset-0"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>
          </div>

          <div className="relative px-4 lg:px-6 pt-6 pb-7">
            {/* Üst satır: Logo + Kullanıcı + Saat */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-xl p-2 shadow-lg shadow-black/30 flex-shrink-0">
                  <img src="/img/btRapor.png" alt="btRapor" className="h-9 w-auto rounded-lg" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">İş Zekası Platformu</p>
                  <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight mt-0.5">
                    Merhaba, <span className="text-red-400">{userName}</span>
                  </h1>
                  {companyName && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="text-slate-400 text-xs">{companyName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Saat */}
              <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
                  {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-500 text-xs">
                  {currentTime.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* İstatistik Chipsleri */}
            <div className="flex flex-wrap gap-2 mb-5">
              <div className="flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/10 rounded-full px-3.5 py-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-slate-200 text-xs font-semibold">
                  {loadingReports ? '—' : stats.accessibleReports} Rapor
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/10 rounded-full px-3.5 py-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-slate-200 text-xs font-semibold">{stats.activeUsers} Kullanıcı</span>
              </div>
              <div className="flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/10 rounded-full px-3.5 py-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  stats.systemStatus === 'Aktif' ? 'bg-emerald-400 animate-pulse' :
                  stats.systemStatus === 'Kontrol ediliyor...' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                }`}></div>
                <span className="text-slate-200 text-xs font-semibold">Sistem {stats.systemStatus}</span>
              </div>
              {planInfo.planName && (
                <div className="flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/10 rounded-full px-3.5 py-1.5">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span className="text-slate-200 text-xs font-semibold">{planInfo.planName}</span>
                </div>
              )}
            </div>

            {/* Arama Çubuğu */}
            <div className="relative max-w-2xl">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rapor ara... (örn: cari bakiye, ciro, envanter)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/15 text-white placeholder-slate-500 rounded-2xl pl-11 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SAYFA İÇERİĞİ
        ═══════════════════════════════════════════════════════ */}
        <div className="px-4 lg:px-6 py-5 space-y-5 bg-gray-50 min-h-screen">

          {/* Erişim Reddedildi Uyarısı */}
          {accessDeniedInfo?.show && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Rapor Erişimi Reddedildi</p>
                <p className="text-sm text-red-700 mt-0.5">
                  <strong>{accessDeniedInfo.report}</strong> raporuna erişim yetkiniz yok.{' '}
                  <button onClick={() => router.push('/ayarlar')} className="underline font-medium">Yetki talep et</button>
                </p>
              </div>
              <button onClick={() => setAccessDeniedInfo(null)} className="text-red-400 hover:text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ─── ARAMA SONUÇLARI ──────────────────────────────────── */}
          {isSearching ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Arama Sonuçları</p>
                  <h2 className="text-base font-bold text-gray-900 mt-0.5">
                    &ldquo;{searchQuery}&rdquo; için {filteredReports.length} sonuç
                  </h2>
                </div>
                <button onClick={() => setSearchQuery('')}
                  className="text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-medium">
                  Temizle
                </button>
              </div>
              <div className="p-5">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">Sonuç bulunamadı</p>
                    <p className="text-gray-400 text-sm mt-1">Farklı bir arama terimi deneyin</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredReports.map(report => (
                      <ReportCard key={report.id} report={report} pinnedReports={pinnedReports} router={router} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ─── RAPOR BİLGİ SLİDER ──────────────────────────────── */}
              {!loadingReports && sliderReports.length > 0 && (
                <section
                  onMouseEnter={() => setSliderPaused(true)}
                  onMouseLeave={() => setSliderPaused(false)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Raporlarınız Hakkında</h2>
                    </div>
                    {/* Dot göstergeleri */}
                    <div className="flex items-center gap-1.5">
                      {sliderReports.map((_, i) => (
                        <button key={i} onClick={() => setSliderIndex(i)}
                          className={`rounded-full transition-all duration-300 ${
                            i === sliderIndex ? 'w-5 h-2 bg-slate-700' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                          }`} />
                      ))}
                    </div>
                  </div>

                  {/* Slider çerçevesi */}
                  <div className="relative overflow-hidden rounded-2xl">
                    {/* Kart */}
                    {sliderReports.map((report, i) => {
                      const info = getReportShowcaseInfo(report);
                      return (
                        <div key={report.id}
                          className={`transition-all duration-500 ${i === sliderIndex ? 'block' : 'hidden'}`}>
                          <div className={`relative overflow-hidden bg-gradient-to-br ${info.gradient} rounded-2xl`}>
                            {/* Arka plan deseni */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>
                              <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
                              <div className="absolute inset-0"
                                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 60%)' }}>
                              </div>
                            </div>

                            <div className="relative p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
                              {/* Sol: İkon + Rozet */}
                              <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center shadow-lg shadow-black/20 backdrop-blur-sm">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={getReportIcon(report.report_name)} />
                                  </svg>
                                </div>
                                <span className="mt-2 block text-center text-xs font-bold text-white/70 uppercase tracking-wider">
                                  {info.badge}
                                </span>
                              </div>

                              {/* Orta: İçerik */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white leading-tight mb-1">
                                  {report.report_name}
                                </h3>
                                <p className="text-white/80 text-sm leading-relaxed mb-4">
                                  {info.description || report.report_description || 'Bu rapor ile işletmenizin verilerini anlık olarak takip edebilirsiniz.'}
                                </p>
                                {/* Özellikler */}
                                <div className="flex flex-wrap gap-2">
                                  {info.features.map((feat, fi) => (
                                    <span key={fi}
                                      className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full text-xs font-semibold text-white px-3 py-1.5">
                                      <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                      </svg>
                                      {feat}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Sağ: CTA */}
                              <div className="flex-shrink-0 flex flex-col items-center gap-3">
                                <button
                                  onClick={() => handleReportClick(report, router)}
                                  className="group flex items-center gap-2 bg-white text-slate-800 font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                                >
                                  Rapora Git
                                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                                {/* İlerleme çubuğu */}
                                {!sliderPaused && (
                                  <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-white/60 rounded-full"
                                      style={{ animation: 'sliderProgress 5s linear infinite', animationPlayState: sliderPaused ? 'paused' : 'running' }}
                                    ></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Alt: Prev / Next okları */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 flex items-center justify-between pointer-events-none">
                              <button
                                onClick={() => setSliderIndex(prev => (prev - 1 + sliderReports.length) % sliderReports.length)}
                                className="pointer-events-auto w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all text-white"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setSliderIndex(prev => (prev + 1) % sliderReports.length)}
                                className="pointer-events-auto w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all text-white"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ─── FAVORİ RAPORLAR ──────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Favori Raporlar</h2>
                    <span className="text-xs text-gray-400 font-normal">{pinnedReports.length}/6</span>
                  </div>
                  <button onClick={() => setShowPinnedSelector(true)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                    Düzenle
                  </button>
                </div>

                {loadingReports ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {Array.from({length: 6}).map((_, i) => (
                      <div key={i} className="h-36 bg-gray-200 rounded-2xl animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {pinnedReportObjects.map((report, idx) => {
                      const pal = CARD_PALETTE[idx % CARD_PALETTE.length];
                      return (
                        <button key={report.id} onClick={() => handleReportClick(report, router)}
                          className={`group relative text-left h-36 rounded-2xl p-4 shadow-sm flex flex-col justify-between overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${pal.card}`}>
                          {/* Dekoratif daire */}
                          <div className={`absolute -bottom-5 -right-5 w-20 h-20 rounded-full opacity-20 ${pal.circle}`}></div>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${pal.icon}`}>
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getReportIcon(report.report_name)} />
                            </svg>
                          </div>
                          <div>
                            <p className={`text-sm font-bold leading-tight line-clamp-2 ${pal.text}`}>{report.report_name}</p>
                            {!report.has_access && (
                              <span className="text-xs opacity-70 mt-0.5 block">Kilitli</span>
                            )}
                          </div>
                          {report.has_access && (
                            <svg className={`absolute top-3 right-3 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity ${pal.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                          {!report.has_access && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-black/20 rounded-md flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {/* Boş slotlar */}
                    {pinnedReportObjects.length < 6 && Array.from({length: 6 - pinnedReportObjects.length}).map((_, i) => (
                      <button key={`empty-${i}`} onClick={() => setShowPinnedSelector(true)}
                        className="h-36 rounded-2xl border-2 border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50/30 flex flex-col items-center justify-center gap-2 text-gray-300 hover:text-red-400 transition-all group">
                        <div className="w-9 h-9 rounded-xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold">Favori Ekle</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* ─── TÜM RAPORLAR ────────────────────────────────────── */}
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Başlık + Kategori Tabs */}
                <div className="px-5 pt-4 pb-0 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tüm Raporlar</h2>
                      {!loadingReports && (
                        <span className="text-xs text-gray-400">{userReports.length} rapor</span>
                      )}
                    </div>
                  </div>

                  {/* Kategori Tabs - horizontal scroll */}
                  {!loadingReports && categories.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide" style={{scrollbarWidth:'none'}}>
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                          className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                            activeCategory === cat
                              ? 'border-red-600 text-red-600'
                              : 'border-transparent text-gray-500 hover:text-gray-800'
                          }`}>
                          {cat}
                          {cat !== 'Tümü' && (
                            <span className={`ml-1.5 text-xs ${activeCategory === cat ? 'text-red-400' : 'text-gray-300'}`}>
                              {userReports.filter(r => (r.category || 'Diğer') === cat).length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rapor Listesi */}
                <div className="p-5">
                  {loadingReports ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {Array.from({length: 8}).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
                      ))}
                    </div>
                  ) : filteredReports.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-400 font-medium">Bu kategoride rapor yok</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(groupedFilteredReports).map(([categoryName, reports]) => (
                        <div key={categoryName}>
                          {activeCategory === 'Tümü' && Object.keys(groupedFilteredReports).length > 1 && (
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{categoryName}</span>
                              <div className="flex-1 h-px bg-gray-100"></div>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                            {reports.map(report => (
                              <ReportCard key={report.id} report={report} pinnedReports={pinnedReports} router={router} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          FAVORİ DÜZENLEME MODAL
      ═══════════════════════════════════════════════════════ */}
      {showPinnedSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Favori Raporlar</h3>
                <p className="text-xs text-gray-400 mt-0.5">{pinnedReports.length}/6 seçili · En fazla 6 rapor</p>
              </div>
              <button onClick={() => setShowPinnedSelector(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Seçili etiketler */}
            {pinnedReports.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-700">Seçili Favoriler</p>
                  <button onClick={() => setPinnedReports([])} className="text-xs text-red-500 hover:text-red-700 font-medium">Temizle</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pinnedReportObjects.map(report => (
                    <span key={report.id} className="flex items-center gap-1 bg-blue-100 border border-blue-200 rounded-full text-xs font-medium text-blue-700 pl-2.5 pr-1 py-1">
                      {report.report_name}
                      <button onClick={() => togglePinnedReport(report.id.toString())}
                        className="w-4 h-4 bg-blue-200 hover:bg-blue-300 rounded-full flex items-center justify-center transition-colors">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rapor Listesi */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1.5">
              {userReports.map(report => {
                const isSelected = pinnedReports.includes(report.id.toString());
                const isDisabled = !isSelected && pinnedReports.length >= 6;
                return (
                  <label key={report.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                      isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100' :
                      isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' :
                      'bg-white border-gray-150 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <input type="checkbox" checked={isSelected}
                      onChange={() => !isDisabled && togglePinnedReport(report.id.toString())}
                      disabled={isDisabled}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{report.report_name}</p>
                      {report.report_description && (
                        <p className="text-xs text-gray-400 truncate">{report.report_description}</p>
                      )}
                    </div>
                    {!report.has_access && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">Kilitli</span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{6 - pinnedReports.length} slot boş</p>
              <button onClick={() => setShowPinnedSelector(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors">
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── RAPOR KARTI BİLEŞENİ ──────────────────────────────────────────────────

function ReportCard({ report, pinnedReports, router }: { report: ReportWithAccess; pinnedReports: string[]; router: ReturnType<typeof useRouter> }) {
  const isPinned = pinnedReports.includes(report.id.toString());
  return (
    <button
      onClick={() => handleReportClick(report, router)}
      className={`group w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 ${
        report.has_access
          ? 'bg-white border-gray-200 hover:border-red-200 hover:bg-red-50/40 hover:shadow-sm'
          : 'bg-gray-50 border-gray-100 opacity-55 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
          report.has_access ? 'bg-red-100 group-hover:bg-red-200' : 'bg-gray-200'
        }`}>
          <svg className={`w-4 h-4 ${report.has_access ? 'text-red-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getReportIcon(report.report_name)} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{report.report_name}</p>
          {report.report_description && (
            <p className="text-xs text-gray-400 truncate">{report.report_description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isPinned && (
            <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
          {!report.has_access ? (
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-200 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── HELPER FONKSİYONLAR ───────────────────────────────────────────────────

const CARD_PALETTE = [
  { card: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
  { card: 'bg-gradient-to-br from-red-500 to-rose-700 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
  { card: 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
  { card: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
  { card: 'bg-gradient-to-br from-violet-500 to-purple-700 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
  { card: 'bg-gradient-to-br from-pink-500 to-fuchsia-700 text-white', icon: 'bg-white/20', circle: 'bg-white', text: 'text-white' },
];

const getReportIcon = (reportName: string) => {
  const name = reportName.toLocaleLowerCase('tr-TR');
  if (name.includes('cari') || name.includes('bakiye'))
    return "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
  if (name.includes('ciro') || name.includes('satış') || name.includes('satis'))
    return "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6";
  if (name.includes('stok') || name.includes('envanter') || name.includes('malzeme'))
    return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
  if (name.includes('fatura'))
    return "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2";
  if (name.includes('çek') || name.includes('senet') || name.includes('cek'))
    return "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z";
  if (name.includes('hareket'))
    return "M13 10V3L4 14h7v7l9-11h-7z";
  if (name.includes('akaryakıt') || name.includes('akaryakit'))
    return "M12 3v1m0 16v1m8.66-13l-.87.5M4.21 15.5l-.87.5M20.66 15.5l-.87-.5M4.21 8.5l-.87-.5M21 12h-1M4 12H3";
  return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
};

const getReportRoute = (report: ReportWithAccess) => {
  if (report.route_path) return report.route_path;
  if (report.route) return `/${report.route}`;
  const name = report.report_name.toLocaleLowerCase('tr-TR');
  if (name.includes('cari') || name.includes('bakiye')) return '/c-bakiye';
  if (name.includes('enpos') && name.includes('ciro')) return '/enpos-ciro';
  if (name.includes('stok') || name.includes('envanter')) return '/envanter-raporu';
  if (name.includes('fatura') && name.includes('kontrol')) return '/fatura-kontrol';
  if (name.includes('hareket') && name.includes('görmeyen')) return '/hareket-gormeyen-cariler';
  if (name.includes('satılan') || name.includes('malzeme')) return '/en-cok-satilan-malzemeler';
  if (name.includes('xrp') && name.includes('kasa')) return '/xrp-kasa-raporu';
  return null;
};

const handleReportClick = (report: ReportWithAccess, router: ReturnType<typeof useRouter>) => {
  if (!report.has_access) {
    alert(`🔒 ${report.report_name} raporuna erişim yetkiniz bulunmamaktadır.\n\nPaket yükseltmesi için Ayarlar > Plan Yönetimi bölümünü ziyaret edin.`);
    return;
  }
  const route = getReportRoute(report);
  if (!route) {
    alert(`${report.report_name} henüz hazır değil. Yakında erişilebilir olacak.`);
    return;
  }
  router.push(route);
};

// ─── RAPOR SHOWCASE BİLGİLERİ ──────────────────────────────────────────────

interface ShowcaseInfo {
  badge: string;
  description: string;
  features: string[];
  gradient: string;
}

const getReportShowcaseInfo = (report: ReportWithAccess): ShowcaseInfo => {
  const name = report.report_name.toLocaleLowerCase('tr-TR');
  const desc = report.report_description || '';

  if (name.includes('cari') || name.includes('bakiye')) {
    return {
      badge: 'Finans',
      description: 'Tüm cari hesaplarınızın anlık borç ve alacak durumunu tek ekranda görüntüleyin. Vadesi geçen bakiyeleri tespit edin, cari bazlı ekstre alın ve finansal riskleri önceden yönetin.',
      features: ['Anlık Bakiye Takibi', 'Borç / Alacak Dengesi', 'Vadesi Geçen Kayıtlar', 'Cari Ekstre'],
      gradient: 'from-blue-600 via-blue-700 to-indigo-800',
    };
  }
  if (name.includes('ciro') || name.includes('satış') || name.includes('satis') || name.includes('enpos')) {
    return {
      badge: 'Satış',
      description: 'Günlük, haftalık ve aylık satış cirolarınızı anlık izleyin. Dönemsel karşılaştırma yapın, trend analizi ile satış performansınızı optimize edin.',
      features: ['Günlük Ciro Takibi', 'Dönem Karşılaştırma', 'Trend Analizi', 'Kasiyer Bazlı Rapor'],
      gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
    };
  }
  if (name.includes('envanter') || name.includes('stok')) {
    return {
      badge: 'Stok',
      description: 'Depo ve stok durumunuzu gerçek zamanlı takip edin. Kritik stok seviyelerini, yavaş hareket eden ürünleri ve stok maliyetlerini kolayca analiz edin.',
      features: ['Anlık Stok Durumu', 'Kritik Seviye Uyarısı', 'Maliyet Analizi', 'Depo Bazlı Görünüm'],
      gradient: 'from-orange-500 via-orange-600 to-amber-700',
    };
  }
  if (name.includes('fatura')) {
    return {
      badge: 'Muhasebe',
      description: 'Kesilen ve gelen faturaları karşılaştırın, tutarsızlıkları anında tespit edin. Fatura onay süreçlerinizi hızlandırın ve muhasebe hatalarını minimize edin.',
      features: ['Fatura Doğrulama', 'Çift Kayıt Tespiti', 'KDV Kontrolü', 'Otomatik Eşleştirme'],
      gradient: 'from-violet-600 via-purple-600 to-purple-800',
    };
  }
  if (name.includes('hareket') || name.includes('görmeyen') || name.includes('gormeyen')) {
    return {
      badge: 'CRM',
      description: 'Belirli bir süre içinde işlem yapmayan müşteri ve tedarikçileri listeleyin. Pasif cari hesapları reaktive edin, kayıp müşterilerinizi geri kazanın.',
      features: ['Pasif Cari Listesi', 'Süre Bazlı Filtreleme', 'Son İşlem Tarihi', 'Müşteri Segmentasyon'],
      gradient: 'from-rose-600 via-pink-600 to-fuchsia-700',
    };
  }
  if (name.includes('satılan') || name.includes('malzeme') || name.includes('ürün')) {
    return {
      badge: 'Analiz',
      description: 'En yüksek satış hacmine sahip ürünlerinizi ve malzemelerinizi keşfedin. Pareto analiziyle en çok gelir getiren ürünlere odaklanın ve stok planlamanızı optimize edin.',
      features: ['Satış Sıralaması', 'Pareto Analizi', 'Kategori Karşılaştırma', 'Dönemsel Trend'],
      gradient: 'from-cyan-600 via-sky-600 to-blue-700',
    };
  }
  if (name.includes('xrp') && name.includes('kasa')) {
    return {
      badge: 'Satış',
      description: 'XRP belge tipine ait kasa bazlı adet raporu. Şube ve tarih filtreleriyle ENPOS ve Logo veritabanlarından veri çeker.',
      features: ['Kasa Bazlı Adet', 'Şube Gruplaması', 'Tarih Filtresi', 'Excel İndirme'],
      gradient: 'from-indigo-600 via-indigo-700 to-purple-800',
    };
  }
  if (name.includes('çek') || name.includes('senet') || name.includes('cek')) {
    return {
      badge: 'Finans',
      description: 'Tüm çek ve senet portföyünüzü tek ekranda yönetin. Vade takibi yapın, tahsilat planlamanızı optimize edin ve nakit akışınızı öngörün.',
      features: ['Vade Takibi', 'Tahsilat Planı', 'Risk Analizi', 'Banka Bazlı Grupla'],
      gradient: 'from-slate-600 via-slate-700 to-gray-800',
    };
  }
  if (name.includes('akaryakıt') || name.includes('akaryakit')) {
    return {
      badge: 'Operasyon',
      description: 'Araç yakıt tüketimlerini takip edin, yakıt maliyetlerini analiz edin ve anormal tüketimleri tespit edin. Filonuzu daha verimli yönetin.',
      features: ['Yakıt Tüketim Takibi', 'Araç Bazlı Analiz', 'Maliyet Raporu', 'Anormallik Tespiti'],
      gradient: 'from-yellow-600 via-amber-600 to-orange-700',
    };
  }
  if (name.includes('yemek') || name.includes('kart')) {
    return {
      badge: 'İnsan Kaynakları',
      description: 'Personel yemek kartı harcamalarını takip edin, departman bazlı analizler yapın ve yemek yardımı maliyetlerini şeffaf biçimde raporlayın.',
      features: ['Personel Bazlı Harcama', 'Departman Analizi', 'Aylık Özet', 'Limit Takibi'],
      gradient: 'from-lime-600 via-green-600 to-emerald-700',
    };
  }

  // Genel fallback
  return {
    badge: 'Rapor',
    description: desc || 'Bu rapor ile işletmenizin kritik verilerini anlık olarak takip edebilir, veri odaklı kararlar alabilirsiniz.',
    features: ['Anlık Veri', 'Kolay Filtreleme', 'Excel Export', 'Detaylı Görünüm'],
    gradient: 'from-slate-700 via-slate-700 to-slate-800',
  };
};

const formatLicenseDate = (dateString: string) => {
  if (!dateString) return 'Tarih yok';
  const targetDate = new Date(dateString);
  const currentDate = new Date();
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const day = targetDate.getDate();
  const month = months[targetDate.getMonth()];
  const year = targetDate.getFullYear();
  const timeDiff = targetDate.getTime() - currentDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (daysDiff < 0) return `${day} ${month} ${year} (Dolmuş)`;
  if (daysDiff === 0) return `${day} ${month} ${year} (Bugün)`;
  if (daysDiff <= 30) return `${day} ${month} ${year} (${daysDiff} gün kaldı)`;
  return `${day} ${month} ${year} (${Math.floor(daysDiff / 30)} ay kaldı)`;
};
