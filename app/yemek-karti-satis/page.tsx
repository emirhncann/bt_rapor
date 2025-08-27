'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import YemekKartiSatisTable from '../components/tables/YemekKartiSatisTable';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

// Yardımcı fonksiyon: Date'i 'YYYY-MM-DD' formatına çevir
function formatDateToYMD(date: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Şube seçenekleri dinamik olarak API'den gelecek

export default function YemekKartiSatis() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  
  const router = useRouter();
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Rapor parametreleri
  const [selectedDate, setSelectedDate] = useState(formatDateToYMD(new Date()));
  const [selectedSubeler, setSelectedSubeler] = useState<number[]>([]); // Çoklu şube seçimi
  const [subeler, setSubeler] = useState<{value: number, label: string}[]>([]);
  const [loadingSubeler, setLoadingSubeler] = useState(false);
  const [showSubeDropdown, setShowSubeDropdown] = useState(false);

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
        console.log('🔍 Yemek Kartı Satış - Rapor erişim yetkisi kontrol ediliyor...');
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
        
        // Yemek kartı satış raporu şirketin paketinde var mı kontrol et
        const yemekKartiRaporu = allReports.find(report => 
          report.route === 'yemek-karti-satis' ||
          report.route_path === '/yemek-karti-satis' ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('yemek') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('kart')
        );
        
        if (!yemekKartiRaporu) {
          console.log('❌ Yemek kartı satış raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasYemekKartiAccess = yemekKartiRaporu.has_access;
        
        console.log('📊 Yemek kartı satış raporu şirket paketinde:', !!yemekKartiRaporu);
        console.log('🔐 Yemek kartı satış raporu erişim yetkisi:', hasYemekKartiAccess);
        
        setHasAccess(hasYemekKartiAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasYemekKartiAccess) {
          console.log('❌ Yemek kartı satış raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=yemek-karti-satis');
          return;
        }

      } catch (error) {
        console.error('❌ Yemek Kartı Satış - Rapor erişimi kontrol edilirken hata:', error);
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
          console.log('✅ Connection bilgileri zaten mevcut (Yemek Kartı)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Yemek Kartı)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Yemek Kartı)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // Şubeleri yükle (authentication sonrası)
  useEffect(() => {
    console.log('🔄 useEffect [şubeler]: Auth durumu kontrol ediliyor...', {
      isAuthenticated,
      hasAccess,
      isCheckingAccess
    });
    
    if (isAuthenticated && hasAccess && !isCheckingAccess) {
      console.log('✅ Auth koşulları sağlandı, şubeler yükleniyor...');
      fetchSubeler();
    } else {
      console.log('⏳ Auth koşulları henüz sağlanmadı, bekleniyor...');
    }
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showSubeDropdown && !target.closest('.relative')) {
        setShowSubeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSubeDropdown]);

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

  // Şubeleri yükle (diğer raporlar gibi direkt ENPOS'tan)
  const fetchSubeler = async () => {
    console.log('🚀 fetchSubeler çağrıldı');
    setLoadingSubeler(true);
    try {
      const companyRef = localStorage.getItem('companyRef');
      console.log('📋 CompanyRef:', companyRef);
      
      if (!companyRef) {
        console.warn('⚠️ CompanyRef bulunamadı, şubeler yüklenemedi');
        showErrorMessage('Şirket bilgisi bulunamadı');
        return;
      }

      console.log('🏢 Şubeler ENPOS ciro tablosundan yükleniyor...');
      console.log('📊 ENPOS DB Key kullanılıyor: enpos_db_key');

      // ENPOS ciro tablosundan şubeleri çek - daha basit sorgu
      const subeQuery = `
        SELECT 
          value,
          label
        FROM (
          SELECT DISTINCT 
            D.NR as value,
            RIGHT(D.NAME,LEN(D.NAME)-CHARINDEX('-',D.NAME)) as label
          FROM GO3..L_CAPIDIV D 
          WHERE D.FIRMNR=9 
            AND D.NR IS NOT NULL
            AND D.NAME IS NOT NULL
            AND D.NAME LIKE '%-%'
        ) AS SubelerData
        ORDER BY CAST(value AS INT)
      `;

      console.log('🔍 Şube Listesi SQL Sorgusu:', subeQuery);

      // Güvenli proxy request gönder
      console.log('📡 Proxy request gönderiliyor...');
      const response = await sendSecureProxyRequest(
        companyRef,
        'enpos_db_key', // ENPOS veritabanı için özel connection type
        {
          query: subeQuery
        },
        'https://api.btrapor.com/proxy',
        60000 // 1 dakika timeout
      );
      
      console.log('📡 Proxy response alındı:', response.status, response.statusText);

      // Response kontrolü
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Şube listesi API hatası:', errorText);
        showErrorMessage('Şube listesi alınırken hata oluştu');
        
        // Fallback: Varsayılan şube listesi
        console.log('🔄 Fallback şube listesi kullanılıyor...');
        setSubeler([
          { value: 1, label: 'Şube 1' },
          { value: 2, label: 'Şube 2' },
          { value: 3, label: 'Şube 3' }
        ]);
        // Fallback'te de hiçbir şube varsayılan seçili gelmesin
        return;
      }

      const result = await response.json();
      console.log('📊 API Response Data:', result);
      
      // Veri formatını kontrol et
      let subelerData = [];
      if (result.results && Array.isArray(result.results)) {
        subelerData = result.results;
        console.log('✅ Subeler result.results\'tan alındı:', subelerData.length);
      } else if (result.data && Array.isArray(result.data)) {
        subelerData = result.data;
        console.log('✅ Subeler result.data\'dan alındı:', subelerData.length);
      } else if (Array.isArray(result)) {
        subelerData = result;
        console.log('✅ Subeler direkt result\'tan alındı:', subelerData.length);
      } else {
        console.warn('⚠️ API response beklenmeyen formatta:', typeof result, result);
      }

      if (subelerData.length > 0) {
        setSubeler(subelerData);
        
        // Hiçbir şube varsayılan olarak seçili gelmesin
        // Kullanıcı manuel olarak seçsin
        
        console.log('✅ Şube listesi başarıyla yüklendi:', subelerData.length, 'şube');
      } else {
        console.log('⚠️ Şube bulunamadı, fallback kullanılıyor');
        // Fallback: Varsayılan şube listesi
        setSubeler([
          { value: 1, label: 'Şube 1' },
          { value: 2, label: 'Şube 2' },
          { value: 3, label: 'Şube 3' }
        ]);
        // Fallback'te de hiçbir şube varsayılan seçili gelmesin
      }

    } catch (error: any) {
      console.error('❌ Şube listesi yüklenirken hata:', error);
      showErrorMessage(`Şube listesi alınırken hata: ${error.message}`);
      
      // Fallback: Varsayılan şube listesi
      console.log('🔄 Catch fallback şube listesi kullanılıyor...');
      setSubeler([
        { value: 1, label: 'Şube 1' },
        { value: 2, label: 'Şube 2' },
        { value: 3, label: 'Şube 3' }
      ]);
      // Catch fallback'te de hiçbir şube varsayılan seçili gelmesin
    } finally {
      setLoadingSubeler(false);
    }
  };

  // Yemek kartı satış verilerini çek (diğer raporlar gibi direkt ENPOS'tan)
  const fetchYemekKartiData = async () => {
    console.log('🔄 Yemek kartı satış verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      console.log(`🔄 Tarih: ${selectedDate}, Şubeler: ${selectedSubeler.join(', ')} ile yemek kartı verileri çekiliyor...`);

      // ENPOS veritabanı için SQL sorgusu
      const sqlQuery = `
        SELECT DISTINCT
          B.BELGETARIH as Tarih,
          b.Sube_No as 'Şube No',
          RIGHT(D.NAME,LEN(D.NAME)-CHARINDEX('-',D.NAME)) as 'Şube',
          K.Tus_No,
          K.Info as 'Yemek Kartı',
          CAST(SUM(O.TUTAR) AS decimal(18,2)) as Tutar
        FROM INTER_BOS..ODEME O
        JOIN INTER_BOS..BELGE B ON B.Belge_ID=O.Belge_ID
        LEFT JOIN INTER_BOS..[POS_KREDI] K ON O.Tus_No=K.Tus_No
        LEFT JOIN GO3..L_CAPIDIV D ON B.Sube_No=D.NR AND D.FIRMNR=9
        WHERE B.Iptal=0 
          AND O.Tus_No > 5 
          AND BELGETARIH='${selectedDate} 00:00:00.000' 
          AND B.Sube_No IN (${selectedSubeler.join(',')})
        GROUP BY 
          B.BELGETARIH,
          b.Sube_No,
          D.NAME,
          K.Tus_No,
          K.Info
        ORDER BY B.BELGETARIH, b.Sube_No, K.Tus_No
      `;

      console.log('🔍 Yemek Kartları SQL Sorgusu:', sqlQuery);

      // ENPOS veritabanı için proxy request
      const response = await sendSecureProxyRequest(
        companyRef,
        'enpos_db_key', // ENPOS veritabanı için özel connection type
        {
          query: sqlQuery
        },
        'https://api.btrapor.com/proxy',
        120000 // 2 dakika timeout
      );

      // Response kontrolü
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Yemek Kartları Satış API hatası:', errorText);
        showErrorMessage('Veri alınırken hata oluştu');
        return;
      }

      const result = await response.json();
      
      // Veri formatını kontrol et
      let data = [];
      if (result.results && Array.isArray(result.results)) {
        data = result.results;
      } else if (result.data && Array.isArray(result.data)) {
        data = result.data;
      } else if (Array.isArray(result)) {
        data = result;
      }

      setData(data);
      console.log('✅ Yemek kartı satış verileri başarıyla yüklendi:', data.length, 'kayıt');

    } catch (error: any) {
      console.error('❌ Yemek kartı satış verileri çekilirken hata:', error);
      
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

  // Şube seçim toggle fonksiyonu
  const toggleSube = (subeValue: number) => {
    setSelectedSubeler(prev => {
      if (prev.includes(subeValue)) {
        return prev.filter(s => s !== subeValue);
      } else {
        return [...prev, subeValue];
      }
    });
  };

  // Tüm şubeleri seç/seçimi kaldır
  const toggleAllSubeler = () => {
    if (selectedSubeler.length === subeler.length) {
      setSelectedSubeler([]);
    } else {
      setSelectedSubeler(subeler.map(s => s.value));
    }
  };

  // İstatistik hesaplama fonksiyonları
  const calculateStats = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        totalAmount: 0,
        totalTransactions: 0,
        cardTypes: [],
        branches: []
      };
    }

    let totalAmount = 0;
    const cardTypeStats: { [key: string]: { count: number, amount: number } } = {};
    const branchStats: { [key: string]: { count: number, amount: number } } = {};
    
    data.forEach(item => {
      const amount = parseFloat(item.Tutar) || 0;
      totalAmount += amount;
      
      // Yemek kartı türü istatistikleri
      const cardType = item['Yemek Kartı'] || 'Bilinmeyen';
      if (!cardTypeStats[cardType]) {
        cardTypeStats[cardType] = { count: 0, amount: 0 };
      }
      cardTypeStats[cardType].count += 1;
      cardTypeStats[cardType].amount += amount;
      
      // Şube istatistikleri
      const branch = item['Şube'] || 'Bilinmeyen';
      if (!branchStats[branch]) {
        branchStats[branch] = { count: 0, amount: 0 };
      }
      branchStats[branch].count += 1;
      branchStats[branch].amount += amount;
    });

    // En çok kullanılan kartları sırala
    const sortedCardTypes = Object.entries(cardTypeStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount);

    // Şubeleri tutara göre sırala
    const sortedBranches = Object.entries(branchStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalAmount,
      totalTransactions: data.length,
      cardTypes: sortedCardTypes,
      branches: sortedBranches
    };
  };

  const stats = calculateStats();

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    // Validation
    if (!selectedDate) {
      showErrorMessage('Lütfen tarih seçiniz');
      return;
    }
    
    if (!selectedSubeler || selectedSubeler.length === 0) {
      showErrorMessage('Lütfen en az bir şube seçiniz');
      return;
    }
    
    await fetchYemekKartiData();
    setHasFetched(true);
  };

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Yemek Kartları Satış Raporu">
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
    <DashboardLayout title="Yemek Kartları Satış Raporu">
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
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">Yemek Kartları Satış Raporu</h2>
                <p className="text-red-100 text-sm">
                  Toplam Kayıt: {data.length} | Seçili Tarih: {selectedDate} | 
                  Şubeler: {selectedSubeler.length === 0 ? 'Seçiniz' : 
                    selectedSubeler.length === subeler.length ? 'Tümü' :
                    `${selectedSubeler.length} şube seçili`}
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
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>🍽️</span>
                  Raporu Getir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Parametreler */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-red-50 to-pink-50">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">⚙️</span>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">Rapor Parametreleri</div>
                <div className="text-sm text-gray-600 font-normal">Yemek kartı satış verilerinizi filtrelemek için parametreleri ayarlayın</div>
              </div>
            </h3>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Parametreler Kartı */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100 shadow-inner">
              <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                  </svg>
                </div>
                Filtreleme Seçenekleri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Rapor Tarihi
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="pl-16">
                      <div className="relative">
                        <DatePicker 
                          value={selectedDate}
                          onChange={(date) => setSelectedDate(formatDateToYMD(date))}
                        />
                        <style jsx>{`
                          :global(.date-picker-input) {
                            width: 100%;
                            padding: 12px 16px;
                            background: linear-gradient(to right, #ffffff, #f9fafb);
                            border: 2px solid #e5e7eb;
                            border-radius: 12px;
                            transition: all 0.2s;
                          }
                          :global(.date-picker-input:hover) {
                            border-color: #93c5fd;
                          }
                          :global(.date-picker-input:focus) {
                            border-color: #3b82f6;
                            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                          }
                        `}</style>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏢 Şube Seçimi
                  </label>
                  
                  {loadingSubeler ? (
                    <div className="flex items-center justify-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                      <span className="text-blue-700 font-medium">ENPOS'tan şubeler yükleniyor...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Dropdown Trigger */}
                      <button
                        type="button"
                        onClick={() => setShowSubeDropdown(!showSubeDropdown)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl hover:border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-sm">
                              {selectedSubeler.length}
                            </span>
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">
                              {selectedSubeler.length === 0 
                                ? 'Şube seçiniz' 
                                : selectedSubeler.length === subeler.length 
                                  ? 'Tüm şubeler seçili'
                                  : `${selectedSubeler.length} şube seçili`
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                              {selectedSubeler.length > 0 && selectedSubeler.length < subeler.length && (
                                selectedSubeler.slice(0, 2).map(id => 
                                  subeler.find(s => s.value === id)?.label
                                ).join(', ') + (selectedSubeler.length > 2 ? '...' : '')
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                            {selectedSubeler.length}/{subeler.length}
                          </span>
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showSubeDropdown ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Dropdown Content */}
                      {showSubeDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                🏢 Şube Listesi
                              </h3>
                              <button
                                onClick={toggleAllSubeler}
                                className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                              >
                                {selectedSubeler.length === subeler.length ? '❌ Tümünü Kaldır' : '✅ Tümünü Seç'}
                              </button>
                            </div>
                          </div>
                          
                          <div className="max-h-64 overflow-y-auto">
                            {subeler.map((sube, index) => (
                              <label 
                                key={sube.value} 
                                className="flex items-center p-4 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 cursor-pointer transition-all duration-150 border-b border-gray-50 last:border-b-0 group"
                              >
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={selectedSubeler.includes(sube.value)}
                                    onChange={() => toggleSube(sube.value)}
                                    className="w-5 h-5 rounded-md border-2 border-gray-300 text-red-600 focus:ring-red-500 focus:ring-2 transition-all duration-200"
                                  />
                                  {selectedSubeler.includes(sube.value) && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                                  )}
                                </div>
                                
                                <div className="ml-4 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900 group-hover:text-red-700 transition-colors">
                                      {sube.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                        #{sube.value}
                                      </span>
                                      {selectedSubeler.includes(sube.value) && (
                                        <span className="text-xs text-green-600 font-medium">
                                          ✓ Seçili
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </label>
                            ))}
                            
                            {subeler.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                                  🏢
                                </div>
                                <p className="font-medium">Şube bulunamadı</p>
                                <p className="text-sm">ENPOS'tan şube verileri alınamadı</p>
                              </div>
                            )}
                          </div>
                          
                          {subeler.length > 0 && (
                            <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">
                                  Toplam {subeler.length} şube
                                </span>
                                <button
                                  onClick={() => setShowSubeDropdown(false)}
                                  className="px-3 py-1.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                                >
                                  Kapat ✕
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Seçili Şubeler Özetı */}
                  {selectedSubeler.length > 0 && !showSubeDropdown && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSubeler.slice(0, 4).map(id => {
                        const sube = subeler.find(s => s.value === id);
                        return sube ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium rounded-full shadow-md hover:shadow-lg transition-shadow"
                          >
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            {sube.label}
                            <button
                              onClick={() => toggleSube(id)}
                              className="ml-1 w-4 h-4 hover:bg-white hover:bg-opacity-20 rounded-full flex items-center justify-center transition-colors"
                            >
                              ✕
                            </button>
                          </span>
                        ) : null;
                      })}
                      {selectedSubeler.length > 4 && (
                        <span className="inline-flex items-center px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded-full">
                          +{selectedSubeler.length - 4} daha
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sonuç Bilgisi */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span>✅</span>
              <span className="font-medium">
                {data.length} yemek kartı satış kaydı başarıyla getirildi
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

        {/* Action Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Yemek Kartları Satış Raporu</h3>
              <p className="text-sm text-gray-500">Yemek kartı satış verilerinizi görüntüleyin ve analiz edin</p>
            </div>
            <button
              onClick={handleFetchReport}
              disabled={loading || loadingSubeler || selectedSubeler.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rapor Hazırlanıyor...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
              <p className="text-gray-600 font-medium">Yemek kartı satış verileri yükleniyor...</p>
            </div>
          </div>
        ) : (
          <>
            {/* İstatistik Kartları */}
            {data.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  📊 Yemek Kartı Satış İstatistikleri
                </h3>
                
                {/* Genel İstatistikler */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-600">Toplam İşlem</div>
                    <div className="text-2xl font-bold text-blue-900">{stats.totalTransactions}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-600">Toplam Tutar</div>
                    <div className="text-2xl font-bold text-green-900">
                      {stats.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-purple-600">Kart Türü Sayısı</div>
                    <div className="text-2xl font-bold text-purple-900">{stats.cardTypes.length}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-orange-600">Aktif Şube</div>
                    <div className="text-2xl font-bold text-orange-900">{stats.branches.length}</div>
                  </div>
                </div>

                {/* Yemek Kartı Türleri - Büyük Kartlar */}
                {stats.cardTypes.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-lg">🍽️</span>
                      </div>
                      Yemek Kartı Türleri
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                      {stats.cardTypes.map((cardType, index) => {
                        // Kartlara farklı renkler atayalım
                        const colors = [
                          'from-red-500 to-red-600',
                          'from-blue-500 to-blue-600', 
                          'from-green-500 to-green-600',
                          'from-purple-500 to-purple-600',
                          'from-orange-500 to-orange-600',
                          'from-indigo-500 to-indigo-600',
                          'from-pink-500 to-pink-600',
                          'from-teal-500 to-teal-600'
                        ];
                        const colorClass = colors[index % colors.length];
                        
                        return (
                          <div key={cardType.name} className="relative overflow-hidden bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className={`h-2 bg-gradient-to-r ${colorClass}`}></div>
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-3">
                                <div className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center shadow-lg`}>
                                  <span className="text-white font-bold text-lg">#{index + 1}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Kart Türü
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {cardType.count} işlem
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                                  {cardType.name}
                                </h3>
                                <div className="text-2xl font-bold text-gray-900">
                                  {cardType.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  <span className="text-gray-600 font-medium">Aktif</span>
                                </div>
                                <div className="text-gray-500">
                                  ₺{(cardType.amount / cardType.count).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ortalama
                                </div>
                              </div>
                              
                              {/* Progress bar - toplam tutara göre */}
                              <div className="mt-4">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>Toplam payı</span>
                                  <span>{((cardType.amount / stats.totalAmount) * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                                    style={{ width: `${(cardType.amount / stats.totalAmount) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Şube Performansı Detay */}
                {stats.branches.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-lg">🏢</span>
                      </div>
                      Şube Performansı
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {stats.branches.map((branch, index) => (
                        <div key={branch.name} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                              <span className="text-white font-bold text-sm">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{branch.name}</div>
                              <div className="text-sm text-gray-500">{branch.count} işlem</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {branch.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                            <div className="text-sm text-gray-500">
                              {((branch.amount / stats.totalAmount) * 100).toFixed(1)}% pay
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ana Tablo */}
            <div className="bg-white rounded-lg shadow">
              <YemekKartiSatisTable 
                data={data}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
