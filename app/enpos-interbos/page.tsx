'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnposCiroTable from '../components/tables/CiroTable';
import DashboardLayout from '../components/DashboardLayout';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

const INTERBOS_CONNECTION_TYPES = ['second_db_key', 'first_db_key', 'enpos_db_key'] as const;

function isSqlPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('permission was denied') || lower.includes('select permission');
}

function parseProxyRows(jsonData: any): any[] {
  if (Array.isArray(jsonData)) return jsonData;
  if (jsonData?.data && Array.isArray(jsonData.data)) return jsonData.data;
  if (jsonData?.recordset && Array.isArray(jsonData.recordset)) return jsonData.recordset;
  if (jsonData?.results && Array.isArray(jsonData.results)) return jsonData.results;
  return [];
}

async function runInterbosSql(
  companyRef: string,
  query: string,
  preferredConnectionType?: string
): Promise<{ data: any[]; connectionType: string }> {
  const types = preferredConnectionType
    ? [preferredConnectionType, ...INTERBOS_CONNECTION_TYPES.filter((t) => t !== preferredConnectionType)]
    : [...INTERBOS_CONNECTION_TYPES];

  let lastError = 'Sorgu çalıştırılamadı';

  for (const connType of types) {
    try {
      const response = await sendSecureProxyRequest(companyRef, connType, { query });
      const responseText = await response.text();

      if (!response.ok) {
        try {
          const errJson = JSON.parse(responseText);
          lastError = String(errJson.error || errJson.message || responseText);
        } catch {
          lastError = responseText || `HTTP ${response.status}`;
        }
        if (isSqlPermissionError(lastError)) {
          console.warn(`⚠️ ${connType}: SELECT izni yok, alternatif bağlantı deneniyor...`);
        }
        continue;
      }

      let jsonData: any;
      try {
        jsonData = JSON.parse(responseText);
      } catch {
        lastError = 'Geçersiz JSON yanıtı';
        continue;
      }

      const errMsg =
        jsonData?.status === 'error' || jsonData?.error || jsonData?.curl_error
          ? String(jsonData.message || jsonData.error || jsonData.curl_error || '')
          : '';

      if (errMsg) {
        lastError = errMsg;
        if (isSqlPermissionError(errMsg)) {
          console.warn(`⚠️ ${connType}: SELECT izni yok, alternatif bağlantı deneniyor...`);
        }
        continue;
      }

      const rows = parseProxyRows(jsonData);
      if (rows.length === 0 && !Array.isArray(jsonData) && !jsonData?.data && !jsonData?.recordset && !jsonData?.results) {
        lastError = 'Beklenmeyen veri formatı';
        continue;
      }

      console.log(`✅ Interbos sorgu başarılı (${connType}, ${rows.length} kayıt)`);
      return { data: rows, connectionType: connType };
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn(`⚠️ ${connType} bağlantı hatası:`, lastError);
    }
  }

  throw new Error(lastError);
}

export default function EnposInterbos() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');

  // ReportFilterPanel için birleşik filtre state'i
  const [filterValues, setFilterValues] = useState<FilterValues>({
    dateRange: { start: '', end: '' },
    autoRefresh: false,
  });

  // YYYY-MM-DD → DD/MM/YYYY dönüşümü (mevcut fetchCiroData'yla uyumluluk için)
  const isoToDisplay = (iso: string) => {
    if (!iso || !iso.includes('-')) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    if (key === 'dateRange') {
      const dr = value as DateRangeValue;
      setStartDate(isoToDisplay(dr.start ?? ''));
      setEndDate(isoToDisplay(dr.end ?? ''));
      setDatePreset('');
    } else if (key === 'autoRefresh') {
      setAutoRefresh(value as boolean);
    }
  };

  const handleFilterReset = () => {
    setFilterValues({ dateRange: { start: '', end: '' }, autoRefresh: false });
    setStartDate(''); setEndDate(''); setDatePreset(''); setAutoRefresh(false);
  };

  // Otomatik yenileme state'leri
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Kredi kartı detayları için state'ler
  const [krediKartiDetaylari, setKrediKartiDetaylari] = useState<any[]>([]);
  const [bankalar, setBankalar] = useState<{[key: string]: string}>({});
  const [showKrediKartiDetaylari, setShowKrediKartiDetaylari] = useState(false);
  const [selectedSubeNo, setSelectedSubeNo] = useState<number | null>(null);
  
  const router = useRouter();
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        // Sayfa görüntüleme tracking
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
        console.log('🔍 Enpos Interbos - Rapor erişim yetkisi kontrol ediliyor...');
        setIsCheckingAccess(true);

        const currentUser = getCurrentUser();
        if (!currentUser) {
          console.log('❌ Kullanıcı bilgisi bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den şirketin tüm raporlarını çek
        const companyRef = sessionStorage.getItem('companyRef');
        if (!companyRef) {
          console.log('❌ CompanyRef bulunamadı');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const {reports: allReports} = await fetchUserReports(companyRef, currentUser.id);
        
        const interbosReport = allReports.find(report => {
          const name = report.report_name.toLocaleLowerCase('tr-TR');
          return (
            report.route === 'enpos-interbos' ||
            report.route_path === '/enpos-interbos' ||
            name.includes('interbos') ||
            (name.includes('enpos') && name.includes('inter'))
          );
        });

        if (!interbosReport) {
          console.log('⚠️ Enpos Interbos raporu pakette tanımlı değil, erişim veriliyor');
          setHasAccess(true);
          setIsCheckingAccess(false);
          return;
        }

        const hasInterbosAccess = interbosReport.has_access;

        console.log('📊 Enpos Interbos raporu şirket paketinde:', !!interbosReport);
        console.log('🔐 Enpos Interbos erişim yetkisi:', hasInterbosAccess);

        setHasAccess(hasInterbosAccess);

        if (!hasInterbosAccess) {
          console.log('❌ Enpos Interbos raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=enpos-interbos');
          return;
        }

      } catch (error) {
        console.error('❌ Enpos Interbos - Rapor erişimi kontrol edilirken hata:', error);
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

  // Banka listesini yükle
  useEffect(() => {
    const fetchBankalar = async () => {
      try {
        const response = await fetch('https://api.btrapor.com/bankalar');
        const bankaData = await response.json();
        
        if (bankaData.status === 'success' && Array.isArray(bankaData.data)) {
          const bankaMap: {[key: string]: string} = {};
          bankaData.data.forEach((banka: any) => {
            const bankaKodu = banka.banka_kodu;
            const bankaAdi = banka.banka_adi;
            
            // Orijinal formatı ekle (örn: "064")
            bankaMap[bankaKodu] = bankaAdi;
            
            // Eğer başında sıfır varsa, sıfırı kaldırarak da ekle (örn: "64")
            if (bankaKodu.startsWith('0') && bankaKodu.length > 1) {
              const trimmedKodu = bankaKodu.replace(/^0+/, '');
              if (trimmedKodu !== bankaKodu) {
                bankaMap[trimmedKodu] = bankaAdi;
              }
            }
            
            // Eğer başında sıfır yoksa, başına sıfır ekleyerek de ekle (örn: "064")
            if (!bankaKodu.startsWith('0') && bankaKodu.length <= 2) {
              const paddedKodu = bankaKodu.padStart(3, '0');
              if (paddedKodu !== bankaKodu) {
                bankaMap[paddedKodu] = bankaAdi;
              }
            }
          });
          setBankalar(bankaMap);
          console.log('✅ Banka listesi yüklendi:', bankaData.data.length, 'banka,', Object.keys(bankaMap).length, 'eşleşme formatı');
        }
      } catch (error) {
        console.error('❌ Banka listesi yüklenirken hata:', error);
      }
    };

    if (isAuthenticated) {
      fetchBankalar();
    }
  }, [isAuthenticated]);

  // Connection bilgilerini önceden getir
  useEffect(() => {
    const preloadConnectionInfo = async () => {
      if (!isAuthenticated) return;
      
      // Önce localStorage'dan kontrol et
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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
      const companyRef = sessionStorage.getItem('companyRef');
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
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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
    
    // Tarih filtresi tracking
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

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchCiroData();
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      showErrorMessage('Cache temizlenirken bir hata oluştu!');
    }
  };

  const fetchCiroData = async () => {
    if (!isAuthenticated) return;
    
    if (!startDate || !endDate) {
      showErrorMessage('Lütfen tarih aralığı seçiniz');
      return;
    }

    // Eğer zaten loading ise, duplicate tıklamayı engelle
    if (loading) {
      console.log('⚠️ Zaten rapor yükleniyor, duplicate tıklama engellendi');
      return;
    }
    
    // Company ref'i önce al
    const companyRef = sessionStorage.getItem('companyRef');
    if (!companyRef) {
      console.error('Company ref bulunamadı');
      alert('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    
    // Display formatından YYMMDD formatına çevir
    const startYYMMDD = convertDisplayToYYMMDD(startDate);
    const endYYMMDD = convertDisplayToYYMMDD(endDate);
    
    setLoading(true);
    try {
      // Mobil debug için initial check
      console.log('🔄 fetchCiroData başlatılıyor - Mobil Debug');
      
      // User Agent kontrolü (mobil debug için)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('📱 Mobil cihaz tespit edildi:', isMobile);
      
      // Önce localStorage'dan connection bilgilerini kontrol et
      let connectionInfo = null;
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      
      // Mobil localStorage kontrolü
      if (!cachedConnectionInfo) {
        console.log('⚠️ MOBIL DEBUG: localStorage\'da connectionInfo bulunamadı');
        // Mobil cihazlarda localStorage sorunları için alternatif kontrol
        try {
          sessionStorage.setItem('test', 'test');
          sessionStorage.removeItem('test');
          console.log('✅ MOBIL DEBUG: localStorage çalışıyor');
        } catch (e) {
          console.error('❌ MOBIL DEBUG: localStorage erişim sorunu:', e);
          alert('Mobil cihazınızda localStorage sorunu tespit edildi. Lütfen gizli sekme kullanmayın ve çerezleri etkinleştirin.');
          setLoading(false);
          return;
        }
      } else {
        console.log('✅ MOBIL DEBUG: localStorage\'da connectionInfo mevcut');
      }
      
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri localStorage\'dan alındı (Ciro):', connectionInfo);
        } catch (e) {
          console.log('⚠️ localStorage\'daki connection bilgileri parse edilemedi, API\'den alınacak');
          // Mobil debug için
          if (isMobile) {
            console.log('📱 MOBIL DEBUG: JSON parse hatası:', e);
          }
        }
      }
      
      // Eğer localStorage'da yoksa API'den al
      if (!connectionInfo) {

        console.log('🔄 Connection bilgileri API\'den alınıyor (Ciro)...');
        
        // Mobil cihazlar için timeout ekleyelim
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), isMobile ? 15000 : 10000); // Mobilde daha uzun timeout
        
        try {
          const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`, {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json'
            }
          });
          clearTimeout(timeoutId);
          
          const connectionData = await connectionResponse.json();

          console.log('📡 Connection Response:', connectionData);

          if (!connectionResponse.ok || connectionData.status !== 'success' || !connectionData.data) {
            console.error('Connection bilgileri alınamadı:', connectionData);
            const errorMsg = connectionData.message || 'Veritabanı bağlantı bilgileri alınamadı';
            alert(`${errorMsg}. Lütfen sistem yöneticisi ile iletişime geçin.`);
            setLoading(false);
            return;
          }

          connectionInfo = connectionData.data;
          // API'den alınan bilgileri localStorage'a kaydet
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
          console.log('💾 Connection bilgileri localStorage\'a kaydedildi (Ciro)');
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.error('❌ Connection bilgileri timeout:', error);
            alert('Bağlantı zaman aşımı. Lütfen internet bağlantınızı kontrol edin.');
          } else {
            console.error('❌ Connection bilgileri alınırken hata:', error);
            alert('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.');
          }
          setLoading(false);
          return;
        }
      }

      // public_ip'den dış IP ve portu ayır
      let externalIP = 'localhost';
      let servicePort = '45678';
      
      if (connectionInfo.public_ip) {
        const [ip, port] = connectionInfo.public_ip.split(':');
        externalIP = ip || 'localhost';
        servicePort = port || '45678';
      }

      console.log('🔗 MOBIL DEBUG - Target Service:', `http://${externalIP}:${servicePort}/sql`);

      const enposDatabaseName = connectionInfo.enpos_database_name || 'INTER_BOS';
      const enposDb = `[${enposDatabaseName}]`;

      console.log('🏪 ENPOS DB:', enposDatabaseName);
      console.log('🌐 Hedef Service (Interbos):', `http://${externalIP}:${servicePort}/sql`);

      const sqlQuery = `
        SELECT 
          B.Sube_No,
          SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT', 'EFA') THEN CASHTOTAL ELSE 0 END) AS 'NAKİT SATIŞ',
          SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT', 'EFA') THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İLE SATIŞ',
          SUM(CASE WHEN B.Belge_Tipi='YMK' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS 'YEMEK KARTI',
          SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL ELSE 0 END) AS 'NAKİT İADE',
          SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İADE',
          SUM(CASE WHEN B.Belge_Tipi NOT IN ('GPS','XRP','ZRP') THEN CREDITTOTAL+CASHTOTAL ELSE 0 END)
            + SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS TOPLAM
        FROM ${enposDb}..BELGE B
        WHERE B.Iptal=0
          AND B.BELGETARIH BETWEEN '${formatToSQLDate(startYYMMDD)} 00:00:00.000' AND '${formatToSQLDate(endYYMMDD)} 23:59:59.000'
          AND B.Belge_Tipi NOT IN ('XRP','ZRP')
        GROUP BY B.Sube_No
      `;

      console.log('📝 Dinamik SQL Sorgusu (Interbos):', sqlQuery);

      let finalData: any[] = [];
      let activeConnectionType: string | undefined;

      try {
        const result = await runInterbosSql(companyRef, sqlQuery);
        finalData = result.data;
        activeConnectionType = result.connectionType;
      } catch (sqlError: any) {
        const errorMsg = sqlError?.message || String(sqlError);
        console.error('SQL hatası:', errorMsg);
        alert(
          `Bağlantı hatası: ${errorMsg}\n\n` +
          `ENPOS kullanıcısının ${enposDatabaseName} veritabanında BELGE tablosuna SELECT yetkisi olmayabilir. ` +
          `Ayarlar > ENPOS bağlantı bilgilerini kontrol edin veya SQL yöneticinize yetki tanımlatın.`
        );
        setData([]);
        return;
      }

      console.log(`✅ MOBIL DEBUG: ${finalData.length} kayıt başarıyla yüklendi (Interbos, ${activeConnectionType})`);
      setData(finalData);
      
      // Rapor oluşturma tracking
      const totalAmount = finalData.reduce((sum: number, item: any) => 
        sum + (safeParseFloat(item['TOPLAM']) || 0), 0);
      
      // İkinci sorgu: Kredi kartı detaylarını çek
      console.log('🔄 Kredi kartı detayları sorgusu başlatılıyor...');
      
      const krediKartiDetaySQL = `
        SELECT 
          B.Sube_No,
          o.Tus_No,
          K.Info,
          o.AcquirerID,
          CASE WHEN o.AcquirerID > 0 AND ISNULL(o.Kredi_Kart_No,'') <> '' THEN 1 ELSE -1 END AS KrediKartiMi,
          SUM(o.TUTAR) AS Tutar
        FROM ${enposDb}..ODEME o
        LEFT JOIN ${enposDb}..BELGE b ON o.Belge_ID = b.belge_ID
        JOIN ${enposDb}..POS_KREDI K ON o.Tus_No = k.Tus_No
        WHERE B.Belge_Tipi IN ('EAR', 'FIS', 'FAT', 'EFA') 
          AND B.Iptal = 0 
          AND B.BELGETARIH BETWEEN '${formatToSQLDate(startYYMMDD)} 00:00:00.000' 
          AND '${formatToSQLDate(endYYMMDD)} 23:59:59.000'
        GROUP BY B.Sube_No, o.Tus_No, K.Info, o.AcquirerID,
          CASE WHEN o.AcquirerID > 0 AND ISNULL(o.Kredi_Kart_No,'') <> '' THEN 1 ELSE -1 END
      `;

      console.log('📝 Kredi Kartı Detay SQL Sorgusu:', krediKartiDetaySQL);

      try {
        const krediKartiResult = await runInterbosSql(companyRef, krediKartiDetaySQL, activeConnectionType);
        const detaylarWithBanka = krediKartiResult.data.map((item: any) => {
              const acquirerID = String(item.AcquirerID || '0');
              
              let bankaAdi = '';
              
              if (acquirerID === '0') {
                bankaAdi = item.Info || 'Diğer Kartlar';
              } else {
                bankaAdi = bankalar[acquirerID];
                
                if (!bankaAdi) {
                  const paddedID = acquirerID.padStart(3, '0');
                  bankaAdi = bankalar[paddedID];
                }
                
                if (!bankaAdi && acquirerID.startsWith('0')) {
                  const trimmedID = acquirerID.replace(/^0+/, '');
                  bankaAdi = bankalar[trimmedID];
                }
                
                if (!bankaAdi) {
                  bankaAdi = `Banka Kodu: ${acquirerID}`;
                }
              }
              
              return {
                ...item,
                Banka_Adi: bankaAdi,
                Tutar: safeParseFloat(item.Tutar || item.TUTAR || 0),
                KrediKartiMi: item.KrediKartiMi === 1 || item.KrediKartiMi === '1',
                OdemeTipiLabel: (item.KrediKartiMi === 1 || item.KrediKartiMi === '1') ? 'Kredi Kartı' : 'NFC, QR, vb.'
              };
            });
            
        setKrediKartiDetaylari(detaylarWithBanka);
        console.log(`✅ ${detaylarWithBanka.length} kredi kartı detay kaydı yüklendi (${krediKartiResult.connectionType})`);
      } catch (error) {
        console.error('❌ Kredi kartı detayları çekilirken hata:', error);
        setKrediKartiDetaylari([]);
      }
      
    } catch (error) {
      console.error('Veri çekme hatası:', error);
      alert('Veri çekerken hata oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

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

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">
            {isCheckingAuth ? 'Giriş kontrolü yapılıyor...' : 'Rapor yetkileri kontrol ediliyor...'}
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erişim Reddedildi</h2>
          <p className="text-slate-400 text-sm mb-6">
            <strong className="text-slate-200">Enpos Interbos Ciro Raporu</strong>&apos;na erişim yetkiniz bulunmamaktadır.
          </p>
          <div className="space-y-2">
            <button onClick={() => router.push('/')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium">
              Anasayfaya Dön
            </button>
            <button onClick={() => router.push('/ayarlar')}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium">
              Yetki Talebi Oluştur
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="Enpos Interbos Ciro Raporu">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full mx-4 text-center">
            {animationData ? (
              <Lottie animationData={animationData} style={{ height: 120, width: 120 }} loop autoplay className="mx-auto" />
            ) : (
              <div className="w-14 h-14 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
            )}
            <p className="text-gray-800 font-bold text-base mt-4">Rapor Hazırlanıyor</p>
            <p className="text-gray-400 text-sm mt-1">Veriler çekiliyor, lütfen bekleyin...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {showError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full mx-4 text-center">
            {failedAnimationData ? (
              <Lottie animationData={failedAnimationData} style={{ height: 120, width: 120 }} loop={false} autoplay className="mx-auto" />
            ) : (
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <p className="text-red-600 font-bold text-base mt-4">Hata Oluştu</p>
            <p className="text-gray-500 text-sm mt-1">{errorMessage}</p>
            <button onClick={() => setShowError(false)}
              className="mt-5 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">
              Tamam
            </button>
          </div>
        </div>
      )}

      {/* Kredi Kartı Detayları Modal */}
      {showKrediKartiDetaylari && krediKartiDetaylari.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-lg md:rounded-lg shadow-2xl w-full h-full md:h-auto md:max-w-6xl md:max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-semibold text-gray-900">
                  Kredi Kartı Detayları
                  {selectedSubeNo && (
                    <span className="ml-2 text-sm md:text-base font-normal text-gray-500">
                      (Şube: {selectedSubeNo})
                    </span>
                  )}
                </h3>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  {selectedSubeNo 
                    ? `Şube ${selectedSubeNo} için banka ve kart tipi detayları`
                    : 'Şube bazında banka ve kart tipi detayları'}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {selectedSubeNo && (
                  <button
                    onClick={() => {
                      setSelectedSubeNo(null);
                    }}
                    className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    title="Tüm şubeleri göster"
                  >
                    Tümü
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowKrediKartiDetaylari(false);
                    setSelectedSubeNo(null);
                  }}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6">
              {(() => {
                // Seçili şubeye göre filtrele
                const filteredDetaylar = selectedSubeNo 
                  ? krediKartiDetaylari.filter(item => item.Sube_No === selectedSubeNo)
                  : krediKartiDetaylari;
                
                const toplamTutar = filteredDetaylar.reduce((sum, item) => sum + item.Tutar, 0);
                
                // Banka bazında toplamları hesapla (genel + Kredi Kartı / NFC, QR vb. ayrımı)
                const bankaToplamlari: {[key: string]: number} = {};
                const bankaKrediKarti: {[key: string]: number} = {};
                const bankaNfcQr: {[key: string]: number} = {};
                filteredDetaylar.forEach((item) => {
                  const bankaAdi = item.Banka_Adi || 'Diğer';
                  const tutar = item.Tutar || 0;
                  bankaToplamlari[bankaAdi] = (bankaToplamlari[bankaAdi] || 0) + tutar;
                  if (item.KrediKartiMi) {
                    bankaKrediKarti[bankaAdi] = (bankaKrediKarti[bankaAdi] || 0) + tutar;
                  } else {
                    bankaNfcQr[bankaAdi] = (bankaNfcQr[bankaAdi] || 0) + tutar;
                  }
                });
                
                // Banka toplamlarını sırala (en yüksekten en düşüğe)
                const sortedBankalar = Object.entries(bankaToplamlari)
                  .sort(([, a], [, b]) => b - a);
                
                return (
                  <div className="space-y-4 md:space-y-6">
                    {/* Banka Bazında Toplam Kartları */}
                    {sortedBankalar.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                        <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3">Banka Bazında Toplamlar</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                          {sortedBankalar.map(([bankaAdi, toplam], index) => {
                            const krediTutar = bankaKrediKarti[bankaAdi] || 0;
                            const nfcQrTutar = bankaNfcQr[bankaAdi] || 0;
                            return (
                            <div 
                              key={index}
                              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-500 truncate mb-1">
                                    {bankaAdi}
                                  </p>
                                  <p className="text-lg font-bold text-gray-900">
                                    {formatCurrency(toplam)}
                                  </p>
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                              {(krediTutar > 0 || nfcQrTutar > 0) && (
                                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                  {krediTutar > 0 && (
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">Kredi Kartı:</span> {formatCurrency(krediTutar)}
                                    </p>
                                  )}
                                  {nfcQrTutar > 0 && (
                                    <p className="text-xs text-gray-600">
                                      <span className="font-medium">NFC, QR, vb.:</span> {formatCurrency(nfcQrTutar)}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                                    style={{ width: `${(toplam / toplamTutar) * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  %{((toplam / toplamTutar) * 100).toFixed(1)}
                                </p>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        {/* Genel Toplam */}
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Genel Toplam:</span>
                            <span className="text-xl font-bold text-blue-600">
                              {formatCurrency(toplamTutar)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Detay Tablosu - Desktop */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Şube No
                            </th>
                            <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Şube Adı
                            </th>
                            <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Banka
                            </th>
                            <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ödeme Tipi
                            </th>
                            <th className="px-4 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tutar
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredDetaylar.length > 0 ? (
                            filteredDetaylar.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {item.Sube_No}
                                </td>
                                <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-900">
                                  {item.NAME || `Şube ${item.Sube_No}`}
                                </td>
                                <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {item.Banka_Adi}
                                  </span>
                                </td>
                                <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.KrediKartiMi ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {item.OdemeTipiLabel || (item.KrediKartiMi ? 'Kredi Kartı' : 'NFC, QR, vb.')}
                                  </span>
                                </td>
                                <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                                  {formatCurrency(item.Tutar)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                                {selectedSubeNo 
                                  ? `Şube ${selectedSubeNo} için kredi kartı detayı bulunamadı.`
                                  : 'Kredi kartı detayı bulunamadı.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {filteredDetaylar.length > 0 && (
                          <tfoot className="bg-gray-50 sticky bottom-0">
                            <tr>
                              <td colSpan={4} className="px-4 md:px-6 py-2 md:py-3 text-sm font-semibold text-gray-900 text-right">
                                Toplam:
                              </td>
                              <td className="px-4 md:px-6 py-2 md:py-3 text-sm font-bold text-gray-900 text-right">
                                {formatCurrency(toplamTutar)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Mobil Kart Görünümü */}
                    <div className="md:hidden space-y-3">
                      {filteredDetaylar.length > 0 ? (
                        filteredDetaylar.map((item, index) => (
                          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">Şube {item.Sube_No}</p>
                                <p className="text-xs text-gray-600 mt-1">{item.NAME || `Şube ${item.Sube_No}`}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {item.Banka_Adi}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.KrediKartiMi ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {item.OdemeTipiLabel || (item.KrediKartiMi ? 'Kredi Kartı' : 'NFC, QR, vb.')}
                                </span>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600">Tutar:</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {formatCurrency(item.Tutar)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
                          <p className="text-sm text-gray-500">
                            {selectedSubeNo 
                              ? `Şube ${selectedSubeNo} için kredi kartı detayı bulunamadı.`
                              : 'Kredi kartı detayı bulunamadı.'}
                          </p>
                        </div>
                      )}
                      {filteredDetaylar.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">Toplam:</span>
                            <span className="text-lg font-bold text-blue-600">
                              {formatCurrency(toplamTutar)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* ─── FULL-BLEED WRAPPER ───────────────────────────────────── */}
      <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6">

        {/* KOYU HERO */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-emerald-700/10 rounded-full blur-2xl"></div>
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          </div>

          <div className="relative px-4 lg:px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              {/* Sol: Geri + İkon + Başlık */}
              <div className="flex items-center gap-4">
                <button onClick={() => router.push('/')}
                  className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-11 h-11 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-white">Enpos Interbos Ciro Raporu</h1>
                    <span className="hidden sm:inline text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">Satış</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">Şube bazlı ENPOS ciro analizi (Logo bağımsız)</p>
                </div>
              </div>

              {/* Sağ: Oto yenileme + Tarih */}
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-slate-300 text-xs font-medium">Oto Yenile</span>
                  <button
                    type="button"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ${autoRefresh ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  {autoRefresh && <span className="text-xs text-emerald-400 font-medium">30s</span>}
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Bugün</p>
                  <p className="text-slate-200 text-sm font-semibold">{new Date().toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAYFA İÇERİĞİ */}
        <div className="px-4 lg:px-6 py-5 bg-gray-50 min-h-screen space-y-5">

          {/* ── ÖZET STAT KARTLARI ─────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Toplam Şube */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Şube</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{Array.isArray(data) ? data.length : 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Toplam şube sayısı</p>
                </div>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Nakit Satış */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nakit Satış</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1 truncate">{formatCurrency(totals.nakitSatis)}</p>
                  <p className="text-xs text-gray-400 mt-1">Nakit tahsilat</p>
                </div>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Kredi Kartı */}
            <div
              className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${krediKartiDetaylari.length > 0 ? 'border-blue-100 hover:border-blue-200 hover:shadow-md cursor-pointer' : 'border-gray-100 hover:shadow-md'}`}
              onClick={() => { if (krediKartiDetaylari.length > 0) { setShowKrediKartiDetaylari(true); setSelectedSubeNo(null); } }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kredi Kartı</p>
                    {krediKartiDetaylari.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">Detay</span>
                    )}
                  </div>
                  <p className="text-xl font-bold text-blue-600 mt-1 truncate">{formatCurrency(totals.krediKartiSatis)}</p>
                  <p className="text-xs text-gray-400 mt-1">Kart tahsilat</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Net Ciro */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Ciro</p>
                  <p className={`text-xl font-bold mt-1 truncate ${totals.toplam < 0 ? 'text-red-600' : totals.toplam > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatCurrency(totals.toplam)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Toplam gelir</p>
                </div>
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Detay kartlar - veri varsa */}
          {data.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Yemek Kartı</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{formatCurrency(totals.yemekKarti)}</p>
                    <p className="text-xs text-gray-400 mt-1">Yemek kartı satışları</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Toplam İade</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(totals.nakitIade + totals.krediKartiIade)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">Nakit: {formatCurrency(totals.nakitIade)}</span>
                      <span className="text-xs text-gray-400">KK: {formatCurrency(totals.krediKartiIade)}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center ml-2">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ort. Şube Cirosu</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.length > 0 ? totals.toplam / data.length : 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">Şube başına ortalama</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FİLTRELER ───────────────────────────────────────── */}
          <ReportFilterPanel
            filters={[
              {
                type: 'dateRange',
                id: 'dateRange',
                presets: ['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth'],
              },
              {
                type: 'toggle',
                id: 'autoRefresh',
                label: 'Otomatik Yenileme',
                description: '30 saniyede bir yeniler',
              },
            ]}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={fetchCiroData}
            onReset={handleFilterReset}
            loading={loading}
          />

          {/* ── TABLO ───────────────────────────────────────────── */}
          {data.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <EnposCiroTable
                data={data}
                storageKey="enpos-interbos"
                onSubeInfoClick={(subeNo) => { setSelectedSubeNo(subeNo); setShowKrediKartiDetaylari(true); }}
              />
            </div>
          ) : (
            !loading && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-700 mb-1">Henüz Veri Yok</h3>
                <p className="text-gray-400 text-sm">Tarih aralığı seçip <strong className="text-emerald-600">Raporu Getir</strong> butonuna tıklayın</p>
              </div>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
} 