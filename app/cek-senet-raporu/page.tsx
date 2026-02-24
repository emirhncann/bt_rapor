'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import CekSenetTable from '../components/tables/CekSenetTable';
import CekSenetTimeline from '../components/CekSenetTimeline';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';
import DatePicker from '../components/DatePicker';

export default function CekSenetRaporu() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [animationData, setAnimationData] = useState(null);
  
  // Tarih filtreleri - yerel saat dilimine göre
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const year = firstDayOfMonth.getFullYear();
    const month = String(firstDayOfMonth.getMonth() + 1).padStart(2, '0');
    const day = String(firstDayOfMonth.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const year = lastDayOfMonth.getFullYear();
    const month = String(lastDayOfMonth.getMonth() + 1).padStart(2, '0');
    const day = String(lastDayOfMonth.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  const router = useRouter();

  // ReportFilterPanel state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    dateRange: { start: startDate, end: endDate },
  });

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    if (key === 'dateRange') {
      const dr = value as DateRangeValue;
      if (dr.start) setStartDate(dr.start);
      if (dr.end) setEndDate(dr.end);
    }
  };

  const handleFilterReset = () => {
    const defaultStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; })();
    const defaultEnd = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]; })();
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setFilterValues({ dateRange: { start: defaultStart, end: defaultEnd } });
  };

  // Tür (CSC.DOC) filtre durumu
  const [docType, setDocType] = useState<string>('');

  // İstatistikler
  const [stats, setStats] = useState<{
    totalCount: number;
    turDagilimi: { name: string; count: number }[];
    statuDagilimi: { name: string; count: number }[];
    modulDagilimi: { name: string; count: number }[];
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
        console.log('🔍 Çek/Senet Raporu - Rapor erişim yetkisi kontrol ediliyor...');
        setIsCheckingAccess(true);

        const currentUser = getCurrentUser();
        if (!currentUser) {
          console.log('❌ Kullanıcı bilgisi bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const companyRef = sessionStorage.getItem('companyRef');
        if (!companyRef) {
          console.log('❌ CompanyRef bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const { reports: allReports } = await fetchUserReports(companyRef, currentUser.id);
        
        // Çek/Senet raporu şirketin paketinde var mı kontrol et
        const cekSenetReport = allReports.find(report => 
          report.report_name.toLocaleLowerCase('tr-TR').includes('çek') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('senet')
        );
        
        if (!cekSenetReport) {
          console.log('❌ Çek/Senet raporu şirketin paketinde bulunmuyor');
          // Şimdilik erişime izin verelim (rapor henüz tanımlı değilse bile)
          setHasAccess(true);
          setIsCheckingAccess(false);
          return;
        }

        const hasCekSenetAccess = cekSenetReport.has_access;
        
        console.log('📊 Çek/Senet raporu şirket paketinde:', !!cekSenetReport);
        console.log('🔐 Çek/Senet erişim yetkisi:', hasCekSenetAccess);
        
        setHasAccess(hasCekSenetAccess);
        
        if (!hasCekSenetAccess) {
          console.log('❌ Çek/Senet raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=cek-senet-raporu');
          return;
        }

      } catch (error) {
        console.error('❌ Çek/Senet - Rapor erişimi kontrol edilirken hata:', error);
        // Hata durumunda erişime izin ver (geçici)
        setHasAccess(true);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkReportAccess();
  }, [router]);

  // Animation yükle
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/animations/rapor.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.log('Animation yüklenemedi:', err));
    }
  }, [isAuthenticated]);

  // Connection bilgilerini önceden getir
  useEffect(() => {
    const preloadConnectionInfo = async () => {
      if (!isAuthenticated) return;
      
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri zaten mevcut (Çek/Senet)');
          return;
        } catch (e) {
          console.log('⚠️ sessionStorage\'daki connection bilgileri geçersiz, yeniden alınacak');
        }
      }
      
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('⚠️ CompanyRef bulunamadı');
        return;
      }

      try {
        console.log('🔄 Connection bilgileri önceden yükleniyor (Çek/Senet)...');
        const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Çek/Senet)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // İstatistik hesaplama fonksiyonu
  const calculateStats = (data: any[]) => {
    if (!data || data.length === 0) {
      return null;
    }

    // Tür dağılımı
    const turCount: { [key: string]: number } = {};
    // Statü dağılımı
    const statuCount: { [key: string]: number } = {};
    // Modül dağılımı
    const modulCount: { [key: string]: number } = {};

    data.forEach(item => {
      // Tür (yeni sorguda [Tür])
      const tur = item['Tür'] ?? item.Tur ?? 'Bilinmeyen';
      turCount[tur] = (turCount[tur] || 0) + 1;

      // Güncel Durumu (yeni sorguda [Güncel Durumu], eski Statu)
      const statu = item['Güncel Durumu'] ?? item.Statu ?? 'Bilinmeyen';
      statuCount[statu] = (statuCount[statu] || 0) + 1;

      // Döviz Türü dağılımı (Modül yerine)
      const modul = item['Döviz Türü'] ?? item.Modul ?? '';
      if (modul) modulCount[modul] = (modulCount[modul] || 0) + 1;
    });

    return {
      totalCount: data.length,
      turDagilimi: Object.entries(turCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      statuDagilimi: Object.entries(statuCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      modulDagilimi: Object.entries(modulCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    };
  };

  // Veri çekme fonksiyonu
  const fetchData = async () => {
    if (!isAuthenticated) return;
    
    if (loading) {
      console.log('⚠️ Zaten rapor yükleniyor, duplicate tıklama engellendi');
      return;
    }
    
    const companyRef = sessionStorage.getItem('companyRef');
    if (!companyRef) {
      console.error('Company ref bulunamadı');
      alert('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔄 Çek/Senet verisi çekiliyor...');
      
      // Connection bilgilerini al
      let connectionInfo = null;
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri sessionStorage\'dan alındı');
        } catch (e) {
          console.log('⚠️ sessionStorage\'daki connection bilgileri parse edilemedi, API\'den alınacak');
        }
      }
      
      if (!connectionInfo) {
        console.log('🔄 Connection bilgileri API\'den alınıyor...');
        const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (!connectionResponse.ok || connectionData.status !== 'success' || !connectionData.data) {
          console.error('Connection bilgileri alınamadı:', connectionData);
          alert('Veritabanı bağlantı bilgileri alınamadı. Lütfen sistem yöneticisi ile iletişime geçin.');
          setLoading(false);
          return;
        }

        connectionInfo = connectionData.data;
        sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
      }
      
      const firmaNo = connectionInfo.first_firma_no || '006';
      const donemNo = connectionInfo.first_donem_no || '01';

      // Tarih formatını SQL için düzenle
      const formatDateForSQL = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}.${month}.${year}`;
      };

      const startDateSQL = formatDateForSQL(startDate);
      const endDateSQL = formatDateForSQL(endDate);
      
      console.log('📅 Tarih aralığı:', startDateSQL, '-', endDateSQL);
      
      // DOC tipi filtresi (ör: 1=Müşteri Çeki, 2=Müşteri Senedi, 3=Kendi Çekimiz, 4=Borç Senedimiz)
      const docFilterClause = docType ? ` AND CSC.DOC = ${docType}` : '';

      // SQL Sorgusu (OUTER APPLY ile son hareket, CLCARD ile ilgili hesap)
      const sqlQuery = `
        SELECT
          [Referans] = CSC.LOGICALREF,
          [Devir] = CASE CSC.DEVIR
            WHEN 0 THEN ''
            ELSE 'D'
          END,
          [Portföy No] = CSC.PORTFOYNO,
          [Seri No] = CSC.NEWSERINO,
          [Tür] = CASE CSC.DOC
            WHEN 1 THEN 'Müşteri Çeki'
            WHEN 2 THEN 'Müşteri Senedi'
            WHEN 3 THEN 'Kendi Çekimiz'
            WHEN 4 THEN 'Borç Senedimiz'
            ELSE 'Bilinmeyen'
          END,
          [İlgili Hesap] = CLC.CODE + ' ' + CLC.DEFINITION_,
          [Çek/Senet Sahibi] = CSC.OWING,
          [Güncel Durumu-Kod] = CSC.CURRSTAT,
          [Güncel Durumu] = CASE CSC.CURRSTAT
            WHEN 1 THEN 'Portföyde'
            WHEN 2 THEN 'Ciro Edildi'
            WHEN 3 THEN 'Teminata Verildi'
            WHEN 4 THEN 'Tahsile Verildi'
            WHEN 5 THEN 'Protestolu Tahsile Verildi'
            WHEN 6 THEN 'Iade Edildi'
            WHEN 7 THEN 'Protesto Edildi'
            WHEN 8 THEN 'Tahsil Edildi'
            WHEN 9 THEN 'Kendi Çekimiz'
            WHEN 10 THEN 'Borç Senedimiz'
            WHEN 11 THEN 'Karsiligi Yok'
            WHEN 12 THEN 'Tahsil Edilemiyor'
            ELSE 'Bilinmiyor'
          END,
          [Düzenlenme Tarihi] = CSC.SETDATE,
          [Vade Tarihi] = CSC.DUEDATE,
          [Dövizli Tutar] = CSC.TRNET,
          [Döviz Türü] = CASE CSC.TRCURR
            WHEN 0 THEN 'TL'
            WHEN 1 THEN 'USD'
            WHEN 20 THEN 'EURO'
            ELSE ''
          END,
          [Tutar] = CSC.AMOUNT
        FROM LG_${firmaNo}_${donemNo}_CSCARD CSC
        OUTER APPLY (
          SELECT TOP 1 *
          FROM LG_${firmaNo}_${donemNo}_CSTRANS T
          WHERE T.CSREF = CSC.LOGICALREF
          ORDER BY T.DATE_ DESC, T.LOGICALREF DESC
        ) CST
        LEFT JOIN LG_${firmaNo}_CLCARD CLC ON CLC.LOGICALREF = CST.CARDREF AND CST.CARDMD=5
        WHERE (CAST(CSC.DUEDATE AS DATE) >= CONVERT(date, '${startDateSQL}', 104))
          AND (CAST(CSC.DUEDATE AS DATE) <= CONVERT(date, '${endDateSQL}', 104))
          ${docFilterClause}
        ORDER BY CSC.DUEDATE, CSC.PORTFOYNO
      `;

      console.log('📝 SQL Sorgusu:', sqlQuery);

      // Proxy üzerinden sorgu gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API hatası:', errorData);
        alert(`Veri çekilirken hata oluştu: ${errorData.error || response.statusText}`);
        setData([]);
        return;
      }

      const jsonData = await response.json();
      console.log('📊 Gelen veri:', jsonData);

      // Veriyi parse et
      let finalData: any[] = [];
      if (Array.isArray(jsonData)) {
        finalData = jsonData;
      } else if (jsonData && Array.isArray(jsonData.data)) {
        finalData = jsonData.data;
      } else if (jsonData && Array.isArray(jsonData.recordset)) {
        finalData = jsonData.recordset;
      } else {
        console.error('Beklenmeyen veri formatı:', jsonData);
        alert('Beklenmeyen veri formatı alındı.');
        setData([]);
        return;
      }

      console.log(`✅ ${finalData.length} kayıt başarıyla yüklendi`);
      setData(finalData);
      
      // İstatistikleri hesapla
      const calculatedStats = calculateStats(finalData);
      setStats(calculatedStats);

    } catch (error: any) {
      console.error('Veri çekme hatası:', error);
      alert('Veri yüklenirken hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  // Tarih formatı için yardımcı fonksiyon (yerel saat dilimi)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Hızlı tarih seçiciler
  const setQuickDateRange = (range: string) => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (range) {
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'nextMonth':
        start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        break;
      case 'next3Months':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 3, 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDate(formatDateLocal(start));
    setEndDate(formatDateLocal(end));
  };

  // Loading ve erişim kontrolleri
  if (isCheckingAuth || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-white/20">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white/30 rounded-full animate-spin border-l-white"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-l-white/50"></div>
            </div>
            <p className="text-white font-medium text-lg mt-6">
              {isCheckingAuth ? 'Giriş kontrolü yapılıyor...' : 'Rapor yetkileri kontrol ediliyor...'}
            </p>
            <p className="text-white/70 text-sm mt-2">Lütfen bekleyiniz</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600 mb-4">
            <strong>Çek/Senet Raporu</strong>'na erişim yetkiniz bulunmamaktadır. 
            <br />Lütfen yöneticiniz ile iletişime geçin.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Anasayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout title="Çek/Senet Raporu">
      {/* Loading Overlay - keep existing as-is */}
      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
            {animationData ? (
              <Lottie animationData={animationData} style={{ height: 120, width: 120 }} loop autoplay />
            ) : (
              <svg className="animate-spin w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <p className="text-gray-700 font-semibold">Rapor hazırlanıyor...</p>
          </div>
        </div>
      )}

      <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
        {/* HERO */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-blue-700/10 rounded-full blur-2xl" />
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
                <div className="w-11 h-11 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-white">Çek/Senet Raporu</h1>
                    <span className="hidden sm:inline text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">Finans</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">Vade tarihine göre çek ve senet hareketleri</p>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-3">
                <span className="text-slate-400 text-sm">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="px-4 lg:px-6 py-5 bg-gray-50 min-h-screen space-y-5">
          {/* Filter Panel */}
          <ReportFilterPanel
            filters={[
              {
                type: 'dateRange',
                id: 'dateRange',
                label: 'Vade Tarihi Aralığı',
                presets: ['thisMonth', 'nextMonth', 'next3Months', 'thisYear'],
              },
            ]}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={fetchData}
            onReset={handleFilterReset}
            loading={loading}
          />

          {/* Tür (DOC) filtre seçimi */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Tür filtresi:</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            >
              <option value="">Tüm türler</option>
              <option value="1">Müşteri Çeki</option>
              <option value="2">Müşteri Senedi</option>
              <option value="3">Kendi Çekimiz</option>
              <option value="4">Borç Senedimiz</option>
            </select>
            {docType && (
              <button
                type="button"
                onClick={() => setDocType('')}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Tür filtresini temizle
              </button>
            )}
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Toplam Kayıt</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
                  </div>
                </div>
              </div>
              {stats.turDagilimi.slice(0, 1).map(t => (
                <div key={t.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{t.name}</p>
                      <p className="text-2xl font-bold text-gray-900">{t.count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {data.length > 0 && (
            <CekSenetTimeline data={data} />
          )}

          {/* Table */}
          {data.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <CekSenetTable data={data} />
            </div>
          ) : (
            !loading && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-700 mb-1">Henüz Veri Yok</h3>
                <p className="text-gray-400 text-sm">Tarih aralığı seçip <strong className="text-blue-600">Raporu Getir</strong> butonuna tıklayın</p>
              </div>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

