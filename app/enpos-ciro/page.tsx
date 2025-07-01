'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnposCiroTable from '../components/tables/CiroTable';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import { fetchUserReports, getCurrentUser, hasReportAccess, getAuthorizedReports } from '../utils/simple-permissions';

export default function EnposCiro() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');
  
  // Otomatik yenileme state'leri
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
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
        console.log('🔍 Enpos Ciro - Rapor erişim yetkisi kontrol ediliyor...');
        setIsCheckingAccess(true);

        const currentUser = getCurrentUser();
        if (!currentUser) {
          console.log('❌ Kullanıcı bilgisi bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // Admin kontrolü
        if (currentUser.role === 'admin') {
          console.log('✅ Admin kullanıcı - Tüm raporlara erişim var');
          setHasAccess(true);
          setIsCheckingAccess(false);
          return;
        }

        // LocalStorage'dan kullanıcı raporlarını kontrol et
        const authorizedReportsJson = localStorage.getItem('userAuthorizedReports');
        const lastUpdate = localStorage.getItem('userReportsLastUpdate');
        
        if (!authorizedReportsJson || !lastUpdate) {
          console.log('❌ LocalStorage\'da rapor bilgisi bulunamadı - API\'den çekiliyor...');
          // API'den çek
          const companyRef = localStorage.getItem('companyRef');
          if (!companyRef) {
            setHasAccess(false);
            setIsCheckingAccess(false);
            return;
          }

          const allReports = await fetchUserReports(companyRef, currentUser.id);
          const authorizedReports = getAuthorizedReports(allReports);
          
          // LocalStorage'a kaydet
          localStorage.setItem('userAuthorizedReports', JSON.stringify(authorizedReports));
          localStorage.setItem('userReportsLastUpdate', Date.now().toString());
          
          // Erişim kontrolü
          const hasEnposCiroAccess = authorizedReports.some(report => 
            report.report_name.toLowerCase().includes('enpos') && 
            report.report_name.toLowerCase().includes('ciro')
          );
          
          console.log('📊 API\'den çekilen Enpos Ciro erişimi:', hasEnposCiroAccess);
          setHasAccess(hasEnposCiroAccess);
        } else {
          // LocalStorage'dan kontrol et
          const authorizedReports = JSON.parse(authorizedReportsJson);
          const updateTime = parseInt(lastUpdate);
          
          // 5 dakikadan eski mi? (Cache süresi)
          const cacheExpiry = 5 * 60 * 1000; // 5 dakika
          const isExpired = Date.now() - updateTime > cacheExpiry;
          
          if (isExpired) {
            console.log('⏰ LocalStorage cache süresi dolmuş - yenileniyor...');
            const companyRef = localStorage.getItem('companyRef');
            if (!companyRef) {
              setHasAccess(false);
              setIsCheckingAccess(false);
              return;
            }

            const allReports = await fetchUserReports(companyRef, currentUser.id);
            const newAuthorizedReports = getAuthorizedReports(allReports);
            
            localStorage.setItem('userAuthorizedReports', JSON.stringify(newAuthorizedReports));
            localStorage.setItem('userReportsLastUpdate', Date.now().toString());
            
            const hasEnposCiroAccess = newAuthorizedReports.some(report => 
              report.report_name.toLowerCase().includes('enpos') && 
              report.report_name.toLowerCase().includes('ciro')
            );
            
            console.log('🔄 Cache yenilendi - Enpos Ciro erişimi:', hasEnposCiroAccess);
            setHasAccess(hasEnposCiroAccess);
          } else {
            // Cache geçerli - localStorage'dan kontrol et
            const hasEnposCiroAccess = authorizedReports.some((report: any) => 
              report.report_name.toLowerCase().includes('enpos') && 
              report.report_name.toLowerCase().includes('ciro')
            );
            
            console.log('💾 LocalStorage\'dan Enpos Ciro erişimi:', hasEnposCiroAccess);
            setHasAccess(hasEnposCiroAccess);
          }
        }

      } catch (error) {
        console.error('❌ Enpos Ciro - Rapor erişimi kontrol edilirken hata:', error);
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
          console.log('✅ Connection bilgileri zaten mevcut (Ciro)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Ciro)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Ciro)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // Otomatik yenileme useEffect'i
  useEffect(() => {
    if (autoRefresh && startDate && endDate && data.length > 0) {
      // 30 saniyede bir yenile
      const interval = setInterval(() => {
        console.log('🔄 Otomatik yenileme başlıyor...');
        fetchCiroData();
      }, 30000); // 30 saniye
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      // Otomatik yenileme kapalıysa mevcut interval'ı temizle
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [autoRefresh, startDate, endDate, data.length]);

  // Component unmount olduğunda interval'ı temizle
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  // YYMMDD formatında tarih oluştur (arka plan için)
  const formatToYYMMDD = (date: Date) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yy + mm + dd;
  };

  // DD/MM/YYYY formatında tarih oluştur (görüntü için)
  const formatToDisplay = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  // DD/MM/YYYY formatını YYMMDD'ye çevir
  const convertDisplayToYYMMDD = (displayDate: string) => {
    if (displayDate.includes('/')) {
      const [dd, mm, yyyy] = displayDate.split('/');
      if (dd && mm && yyyy && yyyy.length === 4) {
        const yy = yyyy.slice(-2);
        return yy + mm + dd;
      }
    }
    return displayDate;
  };

  // YYMMDD'yi DD/MM/YYYY'ye çevir
  const convertYYMMDDToDisplay = (yymmdd: string) => {
    if (yymmdd.length === 6) {
      const yy = yymmdd.substring(0, 2);
      const mm = yymmdd.substring(2, 4);
      const dd = yymmdd.substring(4, 6);
      return `${dd}/${mm}/20${yy}`;
    }
    return yymmdd;
  };

  // Tarih preset'lerini ayarla
  const setDatePresetRange = (preset: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let start: Date;
    let end: Date = new Date(today);

    switch (preset) {
      case 'today':
        start = new Date(year, month, date);
        end = new Date(year, month, date);
        break;
      case 'yesterday':
        start = new Date(year, month, date - 1);
        end = new Date(year, month, date - 1);
        break;
      case 'thisWeek':
        const dayOfWeek = today.getDay();
        const startOfWeek = date - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Pazartesi başlangıcı
        start = new Date(year, month, startOfWeek);
        end = new Date(year, month, startOfWeek + 6);
        break;
      case 'thisMonth':
        start = new Date(year, month, 1);
        end = new Date(year, month + 1, 0); // Ayın son günü
        break;
      case 'lastMonth':
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0); // Geçen ayın son günü
        break;
      default:
        return;
    }

    const startDisplay = formatToDisplay(start);
    const endDisplay = formatToDisplay(end);
    
    console.log(`${preset} seçildi:`, {
      start: start.toDateString(),
      end: end.toDateString(),
      startDisplay,
      endDisplay
    });
    
    setStartDate(startDisplay);
    setEndDate(endDisplay);
    setDatePreset(preset);
  };

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    
    // Eğer zaten sayı ise direkt döndür
    if (typeof value === 'number' && !isNaN(value)) return value;
    
    // String'e çevir ve parse et (veritabanından nokta ile geliyor)
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  // YYMMDD formatını YYYY-MM-DD'ye çevirme fonksiyonu
  const formatToSQLDate = (yymmdd: string) => {
    if (yymmdd.length === 6) {
      const yy = yymmdd.substring(0, 2);
      const mm = yymmdd.substring(2, 4);
      const dd = yymmdd.substring(4, 6);
      return `20${yy}-${mm}-${dd}`;
    }
    return yymmdd;
  };

  // Hata gösterme fonksiyonu
  const showErrorMessage = (message: string) => {
    setErrorMessage(message);
    setShowError(true);
    
    // 3 saniye sonra otomatik kapat
    setTimeout(() => {
      setShowError(false);
      setErrorMessage('');
    }, 3000);
  };

  const fetchCiroData = async () => {
    if (!isAuthenticated) return;
    
    if (!startDate || !endDate) {
      showErrorMessage('Lütfen tarih aralığı seçiniz');
      return;
    }

    // Eğer zaten loading ise, duplicate tıklamayı engelle
    if (loading) {
      console.log('⚠️ Zaten rapor yükleniyokur, duplicate tıklama engellendi');
      return;
    }
    
    // Display formatından YYMMDD formatına çevir
    const startYYMMDD = convertDisplayToYYMMDD(startDate);
    const endYYMMDD = convertDisplayToYYMMDD(endDate);
    
    setLoading(true);
    try {
      // Önce localStorage'dan connection bilgilerini kontrol et
      let connectionInfo = null;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri localStorage\'dan alındı (Ciro):', connectionInfo);
        } catch (e) {
          console.log('⚠️ localStorage\'daki connection bilgileri parse edilemedi, API\'den alınacak');
        }
      }
      
      // Eğer localStorage'da yoksa API'den al
      if (!connectionInfo) {
        const companyRef = localStorage.getItem('companyRef');
        if (!companyRef) {
          showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
          setLoading(false);
          return;
        }

        console.log('🔄 Connection bilgileri API\'den alınıyor (Ciro)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (!connectionResponse.ok || connectionData.status !== 'success' || !connectionData.data) {
          showErrorMessage('Veritabanı bağlantı bilgileri alınamadı. Lütfen sistem yöneticisi ile iletişime geçin.');
          setLoading(false);
          return;
        }

        connectionInfo = connectionData.data;
        localStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
        console.log('💾 Connection bilgileri localStorage\'a kaydedildi (Ciro)');
      }

      // public_ip'den dış IP ve portu ayır
      let externalIP = 'localhost';
      let servicePort = '45678';
      
      if (connectionInfo.public_ip) {
        const [ip, port] = connectionInfo.public_ip.split(':');
        externalIP = ip || 'localhost';
        servicePort = port || '45678';
      }

      // ENPOS bilgileri varsa onları kullan, yoksa normal database bilgilerini kullan
      const useEnposDb = connectionInfo.enpos_server_name && connectionInfo.enpos_database_name;
      
      const connectionString = useEnposDb ? 
        `Server=${connectionInfo.enpos_server_name};Database=${connectionInfo.enpos_database_name};User Id=${connectionInfo.enpos_username || ''};Password=${connectionInfo.enpos_password || ''};` :
        `Server=${connectionInfo.second_server_name || connectionInfo.first_server_name || ''};Database=${connectionInfo.second_db_name || connectionInfo.first_db_name || ''};User Id=${connectionInfo.second_username || connectionInfo.first_username || ''};Password=${connectionInfo.second_password || connectionInfo.first_password || ''};`;
      
      // Firma no'yu al - ENPOS varsa enpos_firma_no kullan
      const firmaNo = useEnposDb ? 
        (connectionInfo.enpos_firma_no || '9') : 
        (connectionInfo.second_firma_no || connectionInfo.first_firma_no || '9');
      
      console.log('🔗 Oluşturulan Connection String (Ciro):', connectionString);
      console.log('🏢 Firma No (Ciro):', firmaNo);
      console.log('🏪 ENPOS DB Kullanılıyor:', useEnposDb ? 'EVET' : 'HAYIR');
      console.log('🌐 Hedef Service (Ciro):', `http://${externalIP}:${servicePort}/sql`);

      // Dinamik SQL sorgusu oluştur
      const sqlQuery = `
             SELECT 
    B.Sube_No,
    D.NAME,
    SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT') THEN CASHTOTAL ELSE 0 END) AS 'NAKİT SATIŞ',
    SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT') THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İLE SATIŞ',
    SUM(CASE WHEN B.Belge_Tipi='YMK' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS 'YEMEK KARTI',
    SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL ELSE 0 END) AS 'NAKİT İADE',
    SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İADE',
    SUM(CASE WHEN B.Belge_Tipi NOT IN ('GPS','XRP','ZRP') THEN CREDITTOTAL+CASHTOTAL ELSE 0 END) + SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS TOPLAM

FROM BELGE B
LEFT JOIN GO3..L_CAPIDIV D ON B.Sube_No=D.NR AND D.FIRMNR=${firmaNo}
WHERE Iptal=0 AND BELGETARIH BETWEEN '${formatToSQLDate(startYYMMDD)} 00:00:00.000' AND '${formatToSQLDate(endYYMMDD)} 23:59:59.000' AND B.Belge_Tipi NOT IN ('XRP','ZRP')
GROUP BY B.Sube_No,D.NAME
`;

      console.log('📝 Dinamik SQL Sorgusu (Ciro):', sqlQuery);

      const proxyUrl = process.env.NODE_ENV === 'development' 
        ? '/api/btrapor/proxy'
        : 'https://api.btrapor.com/proxy';
      
      // Retry logic - bazen ilk deneme başarısız oluyor
      let response;
      let lastError;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Proxy çağrısı deneme ${attempt}/${maxRetries}...`);
          response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              target_url: `http://${externalIP}:${servicePort}/sql`,
              payload: {
                connectionString,
                query: sqlQuery
              }
            })
          });
          
          if (response.ok) {
            console.log(`✅ Proxy çağrısı ${attempt}. denemede başarılı`);
            break; // Başarılı, döngüden çık
          } else if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız - HTTP ${response.status}`);
          } else {
            console.log(`⚠️ Deneme ${attempt} başarısız (${response.status}), tekrar denenecek...`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms bekle
          }
        } catch (error) {
          lastError = error;
          if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız:`, error);
            throw error;
          } else {
            console.log(`⚠️ Deneme ${attempt} hata aldı, tekrar denenecek:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
          }
        }
      }

      // HTTP Status kontrolü
      if (!response || !response.ok) {
        const status = response?.status || 'Bilinmeyen';
        const statusText = response?.statusText || 'Bağlantı hatası';
        console.error('HTTP hatası:', status, statusText);
        showErrorMessage(`Bağlantı hatası: ${status} - ${statusText}`);
        setData([]);
        return;
      }

      const jsonData = await response.json();
      
      console.log('Gelen ciro data:', jsonData);
      
      // Error kontrolü - çeşitli hata formatlarını kontrol et
      if (jsonData.status === 'error' || jsonData.error || jsonData.curl_error) {
        const errorMsg = jsonData.message || jsonData.error || jsonData.curl_error || 'Bilinmeyen hata';
        console.error('Server hatası:', errorMsg);
        showErrorMessage(`Veritabanı bağlantı hatası: ${errorMsg}`);
        setData([]);
        return;
      }
      
      // Success response'u kontrol et
      if (jsonData.status === 'success' && Array.isArray(jsonData.data)) {
        setData(jsonData.data);
      } else if (Array.isArray(jsonData)) {
        setData(jsonData);
      } else if (jsonData && Array.isArray(jsonData.data)) {
        setData(jsonData.data);
      } else if (jsonData && Array.isArray(jsonData.recordset)) {
        setData(jsonData.recordset);
      } else {
        console.error('Beklenmeyen data formatı:', jsonData);
        showErrorMessage('Beklenmeyen veri formatı alındı. Lütfen sistem yöneticisi ile iletişime geçin.');
        setData([]);
      }
    } catch (error) {
      console.error('Veri çekme hatası:', error);
      showErrorMessage('Veri çekerken hata oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setLoading(false);
    }
  };

  // Authentication kontrolü devam ediyorsa loading göster
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center justify-center">
            <svg className="animate-spin h-12 w-12 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-700 font-medium text-lg mt-4">Yükleniyor...</p>
            <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
          </div>
        </div>
      </div>
    );
  }

  // Eğer kullanıcı authenticated değilse, login sayfasına yönlendirme zaten yapıldı
  if (!isAuthenticated) {
    return null;
  }

  // Toplam hesaplamalar
  const calculateTotals = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        nakitSatis: 0,
        krediKartiSatis: 0,
        yemekKarti: 0,
        nakitIade: 0,
        krediKartiIade: 0,
        toplam: 0
      };
    }

    return data.reduce((acc, item) => ({
      nakitSatis: acc.nakitSatis + safeParseFloat(item['NAKİT SATIŞ']),
      krediKartiSatis: acc.krediKartiSatis + safeParseFloat(item['KREDİ KARTI İLE SATIŞ']),
      yemekKarti: acc.yemekKarti + safeParseFloat(item['YEMEK KARTI']),
      nakitIade: acc.nakitIade + safeParseFloat(item['NAKİT İADE']),
      krediKartiIade: acc.krediKartiIade + safeParseFloat(item['KREDİ KARTI İADE']),
      toplam: acc.toplam + safeParseFloat(item['TOPLAM'])
    }), {
      nakitSatis: 0,
      krediKartiSatis: 0,
      yemekKarti: 0,
      nakitIade: 0,
      krediKartiIade: 0,
      toplam: 0
    });
  };

  const totals = calculateTotals();

  // Para formatı
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Loading ve erişim kontrolleri
  if (isCheckingAuth || isCheckingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isCheckingAuth ? 'Giriş kontrolü yapılıyor...' : 'Rapor yetkileri kontrol ediliyor...'}
          </p>
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
            <strong>Enpos Ciro Raporu</strong>'na erişim yetkiniz bulunmamaktadır. 
            <br />Lütfen yöneticiniz ile iletişime geçin.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Anasayfaya Dön
            </button>
            <button
              onClick={() => router.push('/ayarlar')}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Yetki Talebi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Enpos Ciro Raporu">
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
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <p className="text-gray-700 font-medium text-lg mt-4">Rapor hazırlanıyor...</p>
              <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Overlay */}
      {showError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center justify-center">
              {failedAnimationData ? (
                <Lottie 
                  animationData={failedAnimationData}
                  style={{ height: 150, width: 150 }}
                  loop={false}
                  autoplay={true}
                />
              ) : (
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <p className="text-red-700 font-medium text-lg mt-4 text-center">Hata!</p>
              <p className="text-gray-600 text-sm mt-2 text-center">{errorMessage}</p>
              <button
                onClick={() => setShowError(false)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 rounded-lg shadow-lg p-4 lg:p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col lg:flex-row lg:items-center">
              <img 
                src="/img/btRapor.png" 
                alt="btRapor Logo" 
                className="h-12 lg:h-16 w-auto mb-4 lg:mb-0 lg:mr-6 bg-white rounded-lg p-2 self-start"
              />
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-2">Enpos Ciro Raporu</h2>
                <p className="text-red-100 text-base lg:text-lg">BT Rapor - Şube Bazlı Enpos Ciro Analiz Sistemi</p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 lg:hidden xl:block">
              <div className="text-left lg:text-right">
                <p className="text-red-100 text-sm">Bugün</p>
                <p className="text-lg lg:text-xl font-semibold">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Filter Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tarih Filtresi</h3>
          
          {/* Quick Date Presets */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <button
              onClick={() => setDatePresetRange('today')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                datePreset === 'today'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bugün
            </button>
            <button
              onClick={() => setDatePresetRange('yesterday')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                datePreset === 'yesterday'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Dün
            </button>
            <button
              onClick={() => setDatePresetRange('thisWeek')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                datePreset === 'thisWeek'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bu Hafta
            </button>
            <button
              onClick={() => setDatePresetRange('thisMonth')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                datePreset === 'thisMonth'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => setDatePresetRange('lastMonth')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                datePreset === 'lastMonth'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Geçen Ay
            </button>
          </div>

          {/* Auto Refresh Switch */}
          <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900">Otomatik Yenileme</h4>
                <p className="text-xs text-gray-500">30 saniyede bir rapor otomatik olarak yenilenir</p>
              </div>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 ${
                autoRefresh ? 'bg-red-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={autoRefresh}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <span className="sr-only">Otomatik yenileme</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                  autoRefresh ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Custom Date Range */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <DatePicker
                label="Başlangıç Tarihi"
                placeholder="DD/MM/YYYY (örn: 21/01/2025)"
                value={startDate}
                onChange={(date) => {
                  setStartDate(date);
                  setDatePreset('');
                }}
              />
            </div>
            <div className="flex-1">
              <DatePicker
                label="Bitiş Tarihi"
                placeholder="DD/MM/YYYY (örn: 21/01/2025)"
                value={endDate}
                onChange={(date) => {
                  setEndDate(date);
                  setDatePreset('');
                }}
              />
            </div>
            <button
              onClick={fetchCiroData}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Yükleniyor...' : 'Raporu Getir'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Şube</p>
                <p className="text-2xl font-semibold text-gray-900">{Array.isArray(data) ? data.length : 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Nakit Satış</p>
                <p className="text-2xl font-semibold text-gray-900 text-left">
                  {formatCurrency(totals.nakitSatis)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Kredi Kartı Satış</p>
                <p className="text-2xl font-semibold text-gray-900 text-left">
                  {formatCurrency(totals.krediKartiSatis)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Net Ciro</p>
                <p className={`text-2xl font-semibold text-left ${
                  totals.toplam < 0 ? 'text-red-600' : totals.toplam > 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {formatCurrency(totals.toplam)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Stats Cards - Only show when data exists */}
        {data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Yemek Kartı Satış</p>
                  <p className="text-2xl font-semibold text-orange-600">
                    {formatCurrency(totals.yemekKarti)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-500">
                  <span>Yemek kartı ile yapılan satışlar</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Toplam İade</p>
                  <p className="text-2xl font-semibold text-red-600">
                    {formatCurrency(totals.nakitIade + totals.krediKartiIade)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nakit İade:</span>
                  <span className="text-gray-900 text-right">{formatCurrency(totals.nakitIade)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">KK İade:</span>
                  <span className="text-gray-900 text-right">{formatCurrency(totals.krediKartiIade)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ortalama Şube Cirosu</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {formatCurrency(data.length > 0 ? totals.toplam / data.length : 0)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm text-gray-500">
                  <span>Şube başına ortalama performans</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Section */}
        {data.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <EnposCiroTable data={data} />
          </div>
        ) : (
          !loading && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="flex flex-col items-center justify-center">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz veri yok</h3>
                <p className="text-gray-500">Raporu görüntülemek için tarih aralığı seçip "Raporu Getir" butonuna tıklayın</p>
              </div>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
} 