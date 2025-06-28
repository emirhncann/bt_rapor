'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import CBakiyeTable from '../components/tables/c_bakiye_table';
import DashboardLayout from '../components/DashboardLayout';
import CurrencySelector from '../components/CurrencySelector';
import { getCurrencyByNo, getCurrencyByCode } from '../../types/currency';

export default function CBakiye() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedCurrencies, setSelectedCurrencies] = useState<number[]>([53]); // Varsayılan: TRY (No: 53)
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [preloadedDetails, setPreloadedDetails] = useState<{[key: string]: any[]}>({});
  const [isPreloading, setIsPreloading] = useState(false);
  const router = useRouter();
  
  // Preload throttling için ref
  const lastPreloadTime = useRef<number>(0);
  const preloadTimeout = useRef<NodeJS.Timeout | null>(null);
  const preloadedDetailsRef = useRef(preloadedDetails);
  
  // preloadedDetails ref'ini güncel tut
  useEffect(() => {
    preloadedDetailsRef.current = preloadedDetails;
  }, [preloadedDetails]);
  
  // Animation data'yı yükleyelim
  const [animationData, setAnimationData] = useState(null);
  
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
      
      // Önce localStorage'dan kontrol et
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri zaten mevcut (C-Bakiye)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (C-Bakiye)...');
        const connectionResponse = await fetch(`https://btrapor.boluteknoloji.tr/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (C-Bakiye)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Birden fazla müşteri için hareket detaylarını çek (IN operatörü ile)
  const fetchMultipleClientDetails = async (clientRefs: string[], connectionInfo: any): Promise<{[key: string]: any[]}> => {
    try {
      if (!Array.isArray(clientRefs) || clientRefs.length === 0) {
        return {};
      }
      
      // public_ip'den dış IP ve portu ayır
      let externalIP = 'localhost';
      let servicePort = '45678';
      
      if (connectionInfo.public_ip) {
        const [ip, port] = connectionInfo.public_ip.split(':');
        externalIP = ip || 'localhost';
        servicePort = port || '45678';
      }

      // Connection string'i oluştur
      const connectionString = `Server=${connectionInfo.first_server_name || ''};Database=${connectionInfo.first_db_name || ''};User Id=${connectionInfo.first_username || ''};Password=${connectionInfo.first_password || ''};`;
      
      // Firma no ve dönem no'yu al
      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';
      
      // ClientRef'leri IN sorgusu için hazırla
      const clientRefList = clientRefs.map(ref => `'${ref}'`).join(', ');
      
      // SQL sorgusu - IN operatörü ile birden fazla müşteri
      const detailQuery = `
        SELECT 
          CLIENTREF,
          DATE_ + [dbo].[fn_LogoTimetoSystemTime](FTIME) AS [Tarih],
          TRANNO AS [Fiş No],
          CASE MODULENR
            WHEN 4 THEN
              CASE TRCODE
                WHEN 31 THEN 'Satınalma Faturası'
                WHEN 32 THEN 'Perakende Satış İade Faturası'
                WHEN 33 THEN 'Toptan Satış İade Faturası'
                WHEN 34 THEN 'Alınan Hizmet Faturası'
                WHEN 36 THEN 'Satınalma İade Faturası'
                WHEN 37 THEN 'Perakende Satış Faturası'
                WHEN 38 THEN 'Toptan Satış Faturası'
                WHEN 39 THEN 'Verilen Hizmet Faturası'
                WHEN 43 THEN 'Satınalma Fiyat Farkı Faturası'
                WHEN 44 THEN 'Satış Fiyat Farkı Faturası'
                WHEN 56 THEN 'Müstahsil Makbuzu'
              END
            WHEN 5 THEN
              CASE TRCODE
                WHEN 1  THEN 'Nakit Tahsilat'
                WHEN 2  THEN 'Nakit Ödeme'
                WHEN 3  THEN 'Borç Dekontu'
                WHEN 4  THEN 'Alacak Dekontu'
                WHEN 5  THEN 'Virman Fişi'
                WHEN 6  THEN 'Kur Farkı İşlemi'
                WHEN 12 THEN 'Özel Fiş'
                WHEN 14 THEN 'Açılış Fişi'
                WHEN 41 THEN 'Verilen Vade Farkı Faturası'
                WHEN 42 THEN 'Alınan Vade Farkı Faturası'
                WHEN 45 THEN 'Verilen Serbest Meslek Makbuzu'
                WHEN 46 THEN 'Alınan Serbest Meslek Makbuzu'
                WHEN 70 THEN 'Kredi Kartı Fişi'
                WHEN 71 THEN 'Kredi Kartı İade Fişi'
                WHEN 72 THEN 'Firma Kredi Kartı Fişi'
                WHEN 73 THEN 'Firma Kredi Kartı İade Fişi'
              END
            WHEN 6 THEN
              CASE TRCODE
                WHEN 61 THEN 'Çek Girişi'
                WHEN 62 THEN 'Senet Girişi'
                WHEN 63 THEN 'Çek Çıkışı(Cari Hesaba)'
                WHEN 64 THEN 'Senet Çıkışı(Cari Hesaba)'
                WHEN 65 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Çeki)'
                WHEN 66 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Seneti)'
              END
            WHEN 7 THEN
              CASE TRCODE
                WHEN 20 THEN 'Gelen Havale/EFT'
                WHEN 21 THEN 'Gönderilen Havale/EFT'
                WHEN 24 THEN 'Döviz Alış Belgesi'
                WHEN 28 THEN 'Alınan Hizmet Faturası'
                WHEN 29 THEN 'Verilen Hizmet Faturası'
                WHEN 30 THEN 'Müstahsil Makbuzu'
              END
            WHEN 10 THEN
              CASE TRCODE
                WHEN 1 THEN 'Nakit Tahsilat'
                WHEN 2 THEN 'Nakit Ödeme'
              END
            ELSE 'Diğer'
          END AS [Fiş Türü],
          LINEEXP AS [Açıklama],
          FORMAT(DEBIT, 'N', 'tr-TR') AS [Borç],
          FORMAT(CREDIT, 'N', 'tr-TR') AS [Alacak],
          CASE TRCURR
            WHEN 0 THEN 'TL'
            WHEN 1 THEN 'USD'
            WHEN 20 THEN 'EURO'
          END AS [Döviz],
          CASE CANCELLED
            WHEN 0 THEN 'İptal Edilmemiş'
            WHEN 1 THEN 'İptal Edilmiş'
          END AS [İptal Durumu]
        FROM LV_${firmaNo}_${donemNo}_CLEKSTRE 
        WHERE CLIENTREF IN (${clientRefList})
        ORDER BY CLIENTREF, DATE_ + [dbo].[fn_LogoTimetoSystemTime](FTIME) ASC
      `;

      // Proxy üzerinden istek gönder - Geliştirilmiş retry logic ile
      let response: Response | undefined;
      const maxRetries = 4; // Proxy sorunları için 4 deneme
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Exponential backoff: 1. deneme hemen, 2. deneme 300ms, 3. deneme 600ms, 4. deneme 1200ms
          if (attempt > 1) {
            const delay = Math.min(300 * Math.pow(2, attempt - 2), 1200);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          response = await fetch('https://btrapor.boluteknoloji.tr/proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              target_url: `http://${externalIP}:${servicePort}/sql`,
              payload: {
                connectionString,
                query: detailQuery
              }
            })
          });
          
          if (response.ok) {
            break; // Başarılı, döngüden çık
          } else if (response.status === 502 && attempt < maxRetries) {
            console.log(`⚠️ Çoklu müşteri sorgusu deneme ${attempt}: 502 Bad Gateway - Tekrar deneniyor...`);
            continue;
          } else if (attempt === maxRetries) {
            console.warn(`⚠️ Çoklu müşteri sorgusu için detay çekilemedi - Tüm denemeler başarısız: HTTP ${response.status}`);
            return {};
          } else {
            console.log(`⚠️ Çoklu müşteri sorgusu deneme ${attempt} başarısız (${response.status}), tekrar denenecek...`);
          }
        } catch (error) {
          if (attempt === maxRetries) {
            console.warn(`⚠️ Çoklu müşteri sorgusu için detay çekilirken hata:`, error);
            return {};
          } else {
            console.log(`⚠️ Çoklu müşteri sorgusu deneme ${attempt} hata aldı, tekrar denenecek:`, error);
          }
        }
      }

      if (!response || !response.ok) {
        console.warn(`⚠️ Çoklu müşteri sorgusu için detay çekilemedi: HTTP ${response?.status || 'Bilinmeyen'}`);
        return {};
      }

      const jsonData = await response.json();
      
      // Error kontrolü
      if (jsonData.status === 'error' || jsonData.error || jsonData.curl_error) {
        const errorMsg = jsonData.message || jsonData.error || jsonData.curl_error || 'Bilinmeyen hata';
        console.warn(`⚠️ Çoklu müşteri sorgusu için detay çekilemedi: ${errorMsg}`);
        return {};
      }
      
      // Veriyi parse et
      let rawData: any[] = [];
      if (Array.isArray(jsonData)) {
        rawData = jsonData;
      } else if (jsonData && Array.isArray(jsonData.data)) {
        rawData = jsonData.data;
      } else if (jsonData && Array.isArray(jsonData.recordset)) {
        rawData = jsonData.recordset;
      } else {
        console.warn(`⚠️ Çoklu müşteri sorgusu için beklenmeyen veri formatı:`, {
          type: typeof jsonData,
          keys: jsonData ? Object.keys(jsonData) : 'null',
          sample: jsonData
        });
        return {};
      }
      
      // Verileri ClientRef'e göre grupla
      const groupedData: {[key: string]: any[]} = {};
      
      // Her müşteri için boş array başlat
      clientRefs.forEach(clientRef => {
        groupedData[clientRef] = [];
      });
      
      // Verileri grupla
      rawData.forEach(row => {
        const clientRef = row.CLIENTREF || row.clientref;
        if (clientRef && groupedData.hasOwnProperty(clientRef)) {
          groupedData[clientRef].push(row);
        }
      });
      
      // Log sonuçları
      let totalRecords = 0;
      Object.keys(groupedData).forEach(clientRef => {
        const count = groupedData[clientRef].length;
        totalRecords += count;
        if (count > 0) {
          console.log(`🟢 ClientRef ${clientRef}: ${count} hareket başarıyla yüklendi`);
        } else {
          console.log(`🟡 ClientRef ${clientRef}: Hareket bulunamadı (boş sonuç)`);
        }
      });
      
      console.log(`📊 Toplam ${rawData.length} kayıt ${Object.keys(groupedData).length} müşteriye dağıtıldı`);
      
      return groupedData;
      
    } catch (error) {
      console.warn(`⚠️ Çoklu müşteri sorgusu için detay çekilirken hata:`, error);
      return {};
    }
  };

  // Throttled preload function
  const throttledPreloadClientDetails = useCallback(async (clientRefs: string[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastPreloadTime.current;
    
    // 3 saniye içinde tekrar çağrı yapılmasını engelle (tek sorgu kullandığımız için daha kısa)
    if (timeSinceLastCall < 3000) {
      console.log(`⏳ Throttling: Son çağrıdan bu yana ${Math.round(timeSinceLastCall/1000)}s geçti, 3s bekleniyor`);
      return;
    }
    
    lastPreloadTime.current = now;
    
    if (!Array.isArray(clientRefs) || clientRefs.length === 0) return;

    // Sadece henüz yüklenmemiş client ref'leri filtrele
    const missingRefs = clientRefs.filter(ref => !preloadedDetailsRef.current[ref]);
    
    if (missingRefs.length === 0) {
      return; // Sessizce çık
    }

    console.log(`🔄 ${missingRefs.length} yeni müşteri için hareket detayları arka planda yükleniyor...`);
    setIsPreloading(true);

    try {
      // Connection bilgilerini al
      let connectionInfo = null;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } catch (e) {
          console.warn('⚠️ localStorage connection bilgileri parse edilemedi');
          setIsPreloading(false);
          return;
        }
      }

      if (!connectionInfo) {
        console.warn('⚠️ Connection bilgileri bulunamadı, hareket detayları yüklenemedi');
        setIsPreloading(false);
        return;
      }

      const newPreloadedData = { ...preloadedDetailsRef.current };
      
      // Artık tek sorguda tüm müşterilerin verilerini çekiyoruz (çok daha verimli!)
      const groupedDetails = await fetchMultipleClientDetails(missingRefs, connectionInfo);
      
      // Sonuçları mevcut preloaded data'ya ekle
      Object.keys(groupedDetails).forEach(clientRef => {
        newPreloadedData[clientRef] = groupedDetails[clientRef];
      });

      setPreloadedDetails(newPreloadedData);
      console.log(`✅ ${missingRefs.length} müşterinin hareket detayları arka planda hazırlandı`);
      
    } catch (error) {
      console.error('❌ Hareket detayları yüklenirken hata:', error);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  // onPageChange callback'ini memoize et
  const handlePageChange = useCallback((pageData: any[], currentPage: number, itemsPerPage: number) => {
    console.log(`📄 Sayfa değişti: ${currentPage} (${itemsPerPage} kayıt/sayfa)`);
    
    // Sayfa değiştiğinde bellekteki tüm detayları temizle
    setPreloadedDetails((prev) => {
      console.log(`🧹 Bellekteki veriler temizleniyor (${Object.keys(prev).length} müşteri)`);
      return {};
    });
    
    // Mevcut sayfadaki müşteriler için hareket detaylarını yükle
    const pageClientRefs = pageData
      .map((row: any) => row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref)
      .filter((ref: any) => ref && ref !== '');
    
    if (pageClientRefs.length > 0) {
      console.log(`🔄 Yeni sayfa için ${pageClientRefs.length} müşteri detayı yüklenecek`);
      // Küçük bir delay ile yükle (UI responsiv kalsın)
      setTimeout(() => {
        throttledPreloadClientDetails(pageClientRefs);
      }, 300);
    }
  }, [throttledPreloadClientDetails]);

  // Multi-currency istatistikleri hesapla
  const calculateMultiCurrencyStats = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return { currencies: [], totalCustomers: 0 };
    }

    // Seçili kurlar için istatistik toplama
    const currencyStats: { [key: string]: { code: string, borc: number, alacak: number, bakiye: number } } = {};
    
    // Veri satırlarını işle
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        // Kur kodlarını çıkar
        const borcMatch = key.match(/^(.+)_Borç$/);
        const alacakMatch = key.match(/^(.+)_Alacak$/);
        const bakiyeMatch = key.match(/^(.+)_Bakiye$/);
        
        if (borcMatch) {
          const currencyCode = borcMatch[1];
          if (!currencyStats[currencyCode]) {
            currencyStats[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
          }
          
          // String ise sayıyı parse et (1.234,56 formatından)
          let value = row[key];
          if (typeof value === 'string') {
            value = value.replace(/\./g, '').replace(',', '.');
          }
          currencyStats[currencyCode].borc += safeParseFloat(value);
        }
        
        if (alacakMatch) {
          const currencyCode = alacakMatch[1];
          if (!currencyStats[currencyCode]) {
            currencyStats[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
          }
          
          let value = row[key];
          if (typeof value === 'string') {
            value = value.replace(/\./g, '').replace(',', '.');
          }
          currencyStats[currencyCode].alacak += safeParseFloat(value);
        }
        
        if (bakiyeMatch) {
          const currencyCode = bakiyeMatch[1];
          if (!currencyStats[currencyCode]) {
            currencyStats[currencyCode] = { code: currencyCode, borc: 0, alacak: 0, bakiye: 0 };
          }
          
          // Bakiye için özel parse - (A) ve (B) kontrolü
          let value = row[key];
          if (typeof value === 'string') {
            if (value.includes('(A)')) {
              value = '-' + value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            } else if (value.includes('(B)')) {
              value = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            } else {
              value = value.replace(/\./g, '').replace(',', '.');
            }
          }
          currencyStats[currencyCode].bakiye += safeParseFloat(value);
        }
      });
    });

    // Eski format desteği (tek kur)
    if (Object.keys(currencyStats).length === 0) {
      // BORÇ, ALACAK, BAKİYE sütunları için
      const legacyStats = { code: 'TRY', borc: 0, alacak: 0, bakiye: 0 };
      
      data.forEach(row => {
        if (row.BORÇ !== undefined) {
          let value = row.BORÇ;
          if (typeof value === 'string') {
            value = value.replace(/\./g, '').replace(',', '.');
          }
          legacyStats.borc += safeParseFloat(value);
        }
        
        if (row.ALACAK !== undefined) {
          let value = row.ALACAK;
          if (typeof value === 'string') {
            value = value.replace(/\./g, '').replace(',', '.');
          }
          legacyStats.alacak += safeParseFloat(value);
        }
        
        if (row.BAKİYE !== undefined || row.BAKIYE !== undefined) {
          let value = row.BAKİYE || row.BAKIYE;
          if (typeof value === 'string') {
            if (value.includes('(A)')) {
              value = '-' + value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            } else if (value.includes('(B)')) {
              value = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
            } else {
              value = value.replace(/\./g, '').replace(',', '.');
            }
          }
          legacyStats.bakiye += safeParseFloat(value);
        }
      });
      
      if (legacyStats.borc > 0 || legacyStats.alacak > 0) {
        currencyStats.TRY = legacyStats;
      }
    }

    return {
      currencies: Object.values(currencyStats),
      totalCustomers: data.length
    };
  };

  const multiCurrencyStats = calculateMultiCurrencyStats();

  const fetchSqlData = async () => {
    if (!isAuthenticated) return;
    
    // Eğer zaten loading ise, duplicate tıklamayı engelle
    if (loading) {
      console.log('⚠️ Zaten rapor yükleniyor, duplicate tıklama engellendi');
      return;
    }
    
    setLoading(true);
    try {
      // Önce localStorage'dan connection bilgilerini kontrol et
      let connectionInfo = null;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri localStorage\'dan alındı:', connectionInfo);
        } catch (e) {
          console.log('⚠️ localStorage\'daki connection bilgileri parse edilemedi, API\'den alınacak');
        }
      }
      
      // Eğer localStorage'da yoksa API'den al
      if (!connectionInfo) {
        const companyRef = localStorage.getItem('companyRef');
        if (!companyRef) {
          console.error('Company ref bulunamadı');
          alert('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
          setLoading(false);
          return;
        }

        console.log('🔄 Connection bilgileri API\'den alınıyor...');
        const connectionResponse = await fetch(`https://btrapor.boluteknoloji.tr/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        console.log('📡 Connection Response:', connectionData);

        if (!connectionResponse.ok || connectionData.status !== 'success' || !connectionData.data) {
          console.error('Connection bilgileri alınamadı:', connectionData);
          alert('Veritabanı bağlantı bilgileri alınamadı. Lütfen sistem yöneticisi ile iletişime geçin.');
          setLoading(false);
          return;
        }

        connectionInfo = connectionData.data;
        // API'den alınan bilgileri localStorage'a kaydet
        localStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
        console.log('💾 Connection bilgileri localStorage\'a kaydedildi');
      }
      
      // public_ip'den dış IP ve portu ayır
      let externalIP = 'localhost';
      let servicePort = '45678';
      
      if (connectionInfo.public_ip) {
        const [ip, port] = connectionInfo.public_ip.split(':');
        externalIP = ip || 'localhost';
        servicePort = port || '45678';
      }

      // Connection string'i oluştur
      const connectionString = `Server=${connectionInfo.first_server_name || ''};Database=${connectionInfo.first_db_name || ''};User Id=${connectionInfo.first_username || ''};Password=${connectionInfo.first_password || ''};`;
      
      // Firma no ve dönem no'yu al
      const firmaNo = connectionInfo.first_firma_no || '009'; // Varsayılan 009
      const donemNo = connectionInfo.first_donem_no || '01';  // Varsayılan 01
      
      console.log('🔗 Oluşturulan Connection String:', connectionString);
      console.log('🏢 Firma No:', firmaNo);
      console.log('📅 Dönem No:', donemNo);
      console.log('🌐 Hedef Service:', `http://${externalIP}:${servicePort}/sql`);

      // Dinamik SQL sorgusu oluştur - Multi-Currency PIVOT desteği ile
      let sqlQuery = '';
      
      if (selectedCurrencies.length === 1 && selectedCurrencies.includes(53)) {
        // Sadece TRY seçiliyse eski sorguyu kullan
        sqlQuery = `
        SELECT CLCARD.LOGICALREF, CLCARD.CODE AS [Cari Kodu], CLCARD.DEFINITION_ AS [Cari Ünvanı], 
               FORMAT(SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET), 'N', 'tr-TR') AS [Borç], 
               FORMAT(SUM(CLFLINE.SIGN * CLFLINE.TRNET), 'N', 'tr-TR') AS [Alacak], 
               CASE 
                 WHEN SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET) - SUM(CLFLINE.SIGN * CLFLINE.TRNET) > 0 
                   THEN FORMAT(SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET) - SUM(CLFLINE.SIGN * CLFLINE.TRNET), 'N', 'tr-TR') + ' (B)'
                 WHEN SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET) - SUM(CLFLINE.SIGN * CLFLINE.TRNET) < 0 
                   THEN FORMAT(ABS(SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET) - SUM(CLFLINE.SIGN * CLFLINE.TRNET)), 'N', 'tr-TR') + ' (A)'
                 ELSE FORMAT(0, 'N', 'tr-TR')
               END AS [Bakiye]
        FROM LG_${firmaNo}_${donemNo}_CLFLINE CLFLINE 
        RIGHT JOIN LG_${firmaNo}_CLCARD CLCARD ON CLFLINE.CLIENTREF = CLCARD.LOGICALREF 
        WHERE CLFLINE.CANCELLED = 0 AND CLFLINE.TRCURR = 0 AND CLCARD.ACTIVE = 0
        GROUP BY CLCARD.LOGICALREF, CLCARD.CODE, CLCARD.DEFINITION_
        HAVING SUM((1 - CLFLINE.SIGN) * CLFLINE.TRNET) > 0 OR SUM(CLFLINE.SIGN * CLFLINE.TRNET) > 0
        ORDER BY CLCARD.DEFINITION_`;
      } else {
        // Multi-currency dinamik PIVOT yaklaşımı
        const currencyNos = selectedCurrencies.map(no => no === 53 ? '0' : no.toString());
        
        // 1. PIVOT sütunları oluştur: [CUR_0_Borç], [CUR_0_Alacak]
        const pivotCols = currencyNos.map(currNo => 
          `[CUR_${currNo}_Borç], [CUR_${currNo}_Alacak]`
        ).join(', ');
        
        // 2. Bakiye hesaplama sütunları oluştur
        const bakiyeCols = currencyNos.map(currNo => {
          const currency = getCurrencyByNo(currNo === '0' ? 53 : parseInt(currNo));
          const currencyCode = currency ? currency.Kodu : `CUR${currNo}`;
          
          return `
    FORMAT(ISNULL([CUR_${currNo}_Borç],0),'N','tr-TR') AS [${currencyCode}_Borç],
    FORMAT(ISNULL([CUR_${currNo}_Alacak],0),'N','tr-TR') AS [${currencyCode}_Alacak],
    CASE 
      WHEN [CUR_${currNo}_Borç] IS NULL AND [CUR_${currNo}_Alacak] IS NULL THEN NULL
      WHEN ISNULL([CUR_${currNo}_Borç],0) - ISNULL([CUR_${currNo}_Alacak],0) > 0 
        THEN FORMAT(ISNULL([CUR_${currNo}_Borç],0) - ISNULL([CUR_${currNo}_Alacak],0),'N','tr-TR') + ' (B)'
      WHEN ISNULL([CUR_${currNo}_Borç],0) - ISNULL([CUR_${currNo}_Alacak],0) < 0 
        THEN FORMAT(ABS(ISNULL([CUR_${currNo}_Borç],0) - ISNULL([CUR_${currNo}_Alacak],0)),'N','tr-TR') + ' (A)'
      ELSE FORMAT(0,'N','tr-TR')
    END AS [${currencyCode}_Bakiye]`;
        }).join(',');
        
        // 3. Dinamik sorguyu birleştir
        sqlQuery = `
        WITH hareket AS (
          SELECT 
            C.CLIENTREF AS LOGICALREF,
            CLC.CODE AS [Cari Kodu],
            CLC.DEFINITION_ AS [Cari Ünvanı],
            'CUR_' + CAST(C.TRCURR AS VARCHAR) AS CURR_CODE,
            C.SIGN,
            C.TRNET
          FROM LG_${firmaNo}_${donemNo}_CLFLINE C
          INNER JOIN LG_${firmaNo}_CLCARD CLC ON CLC.LOGICALREF = C.CLIENTREF
          WHERE C.CANCELLED = 0 AND CLC.ACTIVE = 0 AND C.TRCURR IN (${currencyNos.join(',')})
        ),
        pivot_data AS (
          SELECT 
            LOGICALREF,
            [Cari Kodu],
            [Cari Ünvanı],
            CURR_CODE + CASE SIGN WHEN 0 THEN '_Borç' ELSE '_Alacak' END AS colname,
            SUM(TRNET) AS TUTAR
          FROM hareket
          GROUP BY LOGICALREF, [Cari Kodu], [Cari Ünvanı], CURR_CODE, SIGN
        ),
        pivoted AS (
          SELECT *
          FROM pivot_data
          PIVOT (
            SUM(TUTAR)
            FOR colname IN (${pivotCols})
          ) p
        )
        SELECT 
          LOGICALREF,
          [Cari Kodu],
          [Cari Ünvanı],${bakiyeCols}
        FROM pivoted
        WHERE ${currencyNos.map(currNo => `([CUR_${currNo}_Borç] > 0 OR [CUR_${currNo}_Alacak] > 0)`).join(' OR ')}
        ORDER BY [Cari Ünvanı]`;
      }

      console.log('📝 Dinamik SQL Sorgusu:', sqlQuery);

      // SQL sorgusunu proxy üzerinden çalıştır - Retry logic ile
      let response: Response | undefined;
      const maxRetries = 2;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Proxy çağrısı deneme ${attempt}/${maxRetries} (C-Bakiye)...`);
          response = await fetch('https://btrapor.boluteknoloji.tr/proxy', {
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
            console.log(`✅ Proxy çağrısı ${attempt}. denemede başarılı (C-Bakiye)`);
            break; // Başarılı, döngüden çık
          } else if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız - HTTP ${response.status} (C-Bakiye)`);
          } else {
            console.log(`⚠️ Deneme ${attempt} başarısız (${response.status}), tekrar denenecek... (C-Bakiye)`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms bekle
          }
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız (C-Bakiye):`, error);
            throw error;
          } else {
            console.log(`⚠️ Deneme ${attempt} hata aldı, tekrar denenecek (C-Bakiye):`, error);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms bekle
          }
        }
      }

      // HTTP Status kontrolü
      if (!response || !response.ok) {
        const status = response?.status || 'Bilinmeyen';
        const statusText = response?.statusText || 'Bağlantı hatası';
        console.error('HTTP hatası:', status, statusText);
        alert(`Bağlantı hatası: ${status} - ${statusText}`);
        setData([]);
        return;
      }

      const jsonData = await response.json();
      
      // localhost:45678'den gelen data formatını kontrol et
      console.log('Gelen data:', jsonData);
      
      // Error kontrolü - çeşitli hata formatlarını kontrol et
      if (jsonData.status === 'error' || jsonData.error || jsonData.curl_error) {
        const errorMsg = jsonData.message || jsonData.error || jsonData.curl_error || 'Bilinmeyen hata';
        console.error('Server hatası:', errorMsg);
        alert(`Veritabanı bağlantı hatası: ${errorMsg}`);
        setData([]);
        return;
      }
      
      // Eğer data array değilse, uygun formata çevir
      let finalData: any[] = [];
      if (Array.isArray(jsonData)) {
        finalData = jsonData;
      } else if (jsonData && Array.isArray(jsonData.data)) {
        finalData = jsonData.data;
      } else if (jsonData && Array.isArray(jsonData.recordset)) {
        finalData = jsonData.recordset;
      } else {
        console.error('Beklenmeyen data formatı:', jsonData);
        alert('Beklenmeyen veri formatı alındı. Lütfen sistem yöneticisi ile iletişime geçin.');
        setData([]);
        return;
      }

      setData(finalData);
      
      // Ana rapor verisi geldikten sonra arka planda hareket detaylarını çek
      if (finalData.length > 0) {
        // Ana loading'i false yap, arka plan yükleme başlasın
        setLoading(false);
        
        // İlk sayfa için hareket detaylarını arka planda çek (varsayılan 10 kayıt)
        setTimeout(() => {
          const defaultPageSize = 10;
          const firstPageData = finalData.slice(0, defaultPageSize);
          const firstPageClientRefs = firstPageData
            .map(row => row.CLIENTREF || row.LOGICALREF || row.clientref || row.logicalref)
            .filter(ref => ref && ref !== '');
          
          if (firstPageClientRefs.length > 0) {
            throttledPreloadClientDetails(firstPageClientRefs);
          }
        }, 500); // 500ms bekleyerek kullanıcının ana veriyi görmesini sağla
        
        return; // Burada return, aşağıdaki setLoading(false) çalışmasın
      }
    } catch (error) {
      console.error('Veri çekme hatası:', error);
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

  // Bakiye sütun adını bul
  const getBakiyeColumnName = () => {
    if (!Array.isArray(data) || data.length === 0) return 'BAKİYE';
    const keys = Object.keys(data[0]);
    return keys.find(key => 
      key === 'BAKİYE' || key === 'BAKIYE' || 
      key.includes('BAKIYE') || key.includes('BAKİYE')
    ) || 'BAKİYE';
  };

  return (
    <DashboardLayout title="Cari Bakiye Raporu">
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
                <h2 className="text-2xl lg:text-3xl font-bold mb-2">Cari Bakiye Raporu</h2>
                <p className="text-red-100 text-sm">
                  Seçili Kurlar: {selectedCurrencies.map(no => getCurrencyByNo(no)?.Kodu).filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col space-y-2">
              <div className="text-left lg:text-right">
                <p className="text-red-100 text-sm">Bugün</p>
                <p className="text-lg lg:text-xl font-semibold">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowCurrencySelector(!showCurrencySelector)}
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium"
                >
                  💱 Kur Seçimi
                </button>
                <button
                  onClick={fetchSqlData}
                  disabled={loading || selectedCurrencies.length === 0}
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Raporu Getir
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Currency Selector */}
        {showCurrencySelector && (
          <CurrencySelector
            selectedCurrencies={selectedCurrencies}
            onCurrencyChange={setSelectedCurrencies}
            className="mb-4"
          />
        )}

        {/* Stats Cards */}
        <div className="space-y-6">
          {/* Genel İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Toplam Müşteri</p>
                  <p className="text-2xl font-semibold text-gray-900">{multiCurrencyStats.totalCustomers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Seçili Kurlar</p>
                  <p className="text-2xl font-semibold text-gray-900">{selectedCurrencies.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCurrencies.map(no => getCurrencyByNo(no)?.Kodu).filter(Boolean).slice(0, 3).join(', ')}
                    {selectedCurrencies.length > 3 ? '...' : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Rapor Durumu</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {Array.isArray(data) && data.length > 0 ? 'Hazır' : loading ? 'Yükleniyor...' : 'Bekliyor'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Array.isArray(data) && data.length > 0 ? `${data.length} kayıt` : 'Raporu getirmek için butona tıklayın'}
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
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Aktif Kurlar</p>
                  <p className="text-2xl font-semibold text-gray-900">{multiCurrencyStats.currencies.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {multiCurrencyStats.currencies.length > 1 ? 'Multi-currency' : 'Tek kur'}
                  </p>
                </div>
              </div>
            </div>
          </div>



          {/* Kur Bazlı İstatistikler */}
          {multiCurrencyStats.currencies.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">💰 Kur Bazlı Toplamlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {multiCurrencyStats.currencies.map((currency, index) => (
                  <div key={currency.code} className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">💱</span>
                        {currency.code}
                      </h4>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        {getCurrencyByCode(currency.code)?.Adı || currency.code}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">💸 Toplam Borç:</span>
                        <span className="font-semibold text-red-600">
                          {currency.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">💰 Toplam Alacak:</span>
                        <span className="font-semibold text-green-600">
                          {currency.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="border-t pt-2 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">⚖️ Net Bakiye:</span>
                        <span className={`font-bold ${
                          currency.bakiye < 0 ? 'text-red-600' : 
                          currency.bakiye > 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {Math.abs(currency.bakiye).toLocaleString('tr-TR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                          {currency.bakiye !== 0 && (
                            <span className="ml-1">
                              {currency.bakiye < 0 ? '(A)' : '(B)'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Cari Hesap Raporu</h3>
              <p className="text-sm text-gray-500">Müşteri hesap bakiyelerini görüntüleyin ve analiz edin</p>
            </div>
      <button
        onClick={fetchSqlData}
        disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
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
              <svg className="animate-spin h-8 w-8 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Veriler yükleniyor...</p>
            </div>
          </div>
      ) : Array.isArray(data) && data.length > 0 ? (
        <CBakiyeTable 
          data={data} 
          preloadedDetails={preloadedDetails}
          onPageChange={handlePageChange}
        />
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