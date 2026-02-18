'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import CekSenetTable from '../components/tables/CekSenetTable';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

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
      // Tür
      const tur = item.Tur || 'Bilinmeyen';
      turCount[tur] = (turCount[tur] || 0) + 1;

      // Statü
      const statu = item.Statu || 'Bilinmeyen';
      statuCount[statu] = (statuCount[statu] || 0) + 1;

      // Modül
      const modul = item.Modul || 'Bilinmeyen';
      modulCount[modul] = (modulCount[modul] || 0) + 1;
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
      
      // SQL Sorgusu
      const sqlQuery = `
        SELECT DISTINCT 
          [Referans] = CSC.LOGICALREF,
          [Devir] = CASE CST.DEVIR  
            WHEN 0 THEN '' 
            ELSE 'D' 
          END,
          [Portföy No] = CSC.PORTFOYNO,
          [Seri No] = CSC.NEWSERINO,
          [Tur] = CASE CSC.DOC   
            WHEN 1 THEN 'Müşteri Çeki'  
            WHEN 2 THEN 'Müşteri Senedi' 
            WHEN 3 THEN 'Kendi Çekimiz' 
            WHEN 4 THEN 'Borç Senedimiz' 
            ELSE 'Bilinmeyen' 
          END, 
          [Statu] = CASE CST.STATUS 
            WHEN 1 THEN 'Portföyde'     
            WHEN 2 THEN 'Ciro Edildi' 
            WHEN 3 THEN 'Teminata Verildi' 
            WHEN 4 THEN 'Tahsile Verildi' 
            WHEN 5 THEN 'Protestolu Tahsile Verildi' 
            WHEN 6 THEN 'Iade Edildi' 
            WHEN 7 THEN 'Protesto Edildi' 
            WHEN 8 THEN 'Tahsil Edildi' 
            WHEN 9 THEN 'Kendi Çekimiz-Verilen Çek'
            WHEN 10 THEN 'Borç Senedimiz' 
            WHEN 11 THEN 'Karsiligi Yok' 
            WHEN 12 THEN 'Tahsil Edilemiyor' 
            ELSE 'Bilinmiyor' 
          END, 
          [Modul] = CASE CST.CARDMD 
            WHEN 5 THEN 'Cari Hesap'    
            WHEN 7 THEN 'Banka' 
            ELSE 'Bulunamadi' 
          END, 
          [Düzenlenme Tarihi] = CSC.SETDATE,
          [Hareket Tarihi] = CST.DATE_,
          [Vade Tarihi] = CSC.DUEDATE
        FROM LG_${firmaNo}_${donemNo}_CSCARD CSC, LG_${firmaNo}_${donemNo}_CSTRANS CST 
        WHERE (CAST(CSC.DUEDATE AS DATE) >= CONVERT(date, '${startDateSQL}', 104)) 
          AND (CAST(CSC.DUEDATE AS DATE) <= CONVERT(date, '${endDateSQL}', 104)) 
          AND CST.CSREF = CSC.LOGICALREF
        ORDER BY CSC.PORTFOYNO, CST.DATE_
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
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center justify-center">
              {animationData ? (
                <Lottie 
                  animationData={animationData}
                  style={{ height: 150, width: 150 }}
                  loop={true}
                  autoplay={true}
                />
              ) : (
                <svg className="animate-spin h-12 w-12 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <p className="text-gray-700 font-medium text-lg mt-4">Rapor hazırlanıyor...</p>
              <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 rounded-lg shadow-lg p-4 lg:p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col lg:flex-row lg:items-center">
              <img 
                src="/img/btRapor.png" 
                alt="btRapor Logo" 
                className="h-12 lg:h-16 w-auto mb-4 lg:mb-0 lg:mr-6 bg-white rounded-lg p-2 self-start"
              />
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-2">📋 Çek/Senet Raporu</h2>
                <p className="text-red-100 text-sm">
                  Vade tarihine göre çek ve senet hareketlerini görüntüleyin
                </p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0">
              <div className="text-left lg:text-right">
                <p className="text-red-100 text-sm">Bugün</p>
                <p className="text-lg lg:text-xl font-semibold">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtre ve Arama */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">📅 Vade Tarihi Aralığı</h3>
          
          {/* Hızlı Seçenekler */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setQuickDateRange('thisMonth')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Bu Ay
            </button>
            <button
              onClick={() => setQuickDateRange('nextMonth')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Gelecek Ay
            </button>
            <button
              onClick={() => setQuickDateRange('next3Months')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              3 Aylık
            </button>
            <button
              onClick={() => setQuickDateRange('thisYear')}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Bu Yıl
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Raporu Getir
                </>
              )}
            </button>
          </div>
        </div>

        {/* Özet Kartlar */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Toplam Kayıt</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Farklı Tür</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.turDagilimi.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Farklı Statü</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.statuDagilimi.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Farklı Modül</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.modulDagilimi.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tablo */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Veriler yükleniyor...</p>
            </div>
          </div>
        ) : Array.isArray(data) && data.length > 0 ? (
          <CekSenetTable 
            data={data} 
            stats={stats || undefined}
            currentUser={getCurrentUser()}
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Henüz veri yok</h3>
              <p className="text-gray-500 mb-4">Raporu getirmek için tarih aralığı seçin ve "Raporu Getir" butonuna tıklayın</p>
              <button
                onClick={fetchData}
                className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Raporu Getir
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

