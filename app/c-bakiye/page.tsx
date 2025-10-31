'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import CBakiyeTable from '../components/tables/c_bakiye_table';
import DashboardLayout from '../components/DashboardLayout';
import CurrencySelector from '../components/CurrencySelector';
import { getCurrencyByNo, getCurrencyByCode } from '../../types/currency';
import { fetchUserReports, getCurrentUser, getAuthorizedReports } from '../utils/simple-permissions';
import type { ReportWithAccess } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

export default function CBakiye() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
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

  // ⚡ Döviz türü değişikliklerinde cache'i temizle (farklı döviz türleri farklı sonuçlar getirir)
  useEffect(() => {
    console.log('💱 Seçili döviz türleri değişti, cache temizleniyor...', selectedCurrencies);
    setPreloadedDetails({});
  }, [selectedCurrencies]);
  
  // Animation data'yı yükleyelim
  const [animationData, setAnimationData] = useState(null);
  
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
        console.log('🔍 Cari Bakiye - Rapor erişim yetkisi kontrol ediliyor...');
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
        
        // Cari Bakiye raporu şirketin paketinde var mı kontrol et
        const cariBakiyeReport = allReports.find(report => 
                  report.report_name.toLocaleLowerCase('tr-TR').includes('cari') &&
        report.report_name.toLocaleLowerCase('tr-TR').includes('bakiye')
        );
        
        if (!cariBakiyeReport) {
          console.log('❌ Cari Bakiye raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasCariBakiyeAccess = cariBakiyeReport.has_access;
        
        console.log('📊 Cari Bakiye raporu şirket paketinde:', !!cariBakiyeReport);
        console.log('🔐 Cari Bakiye erişim yetkisi:', hasCariBakiyeAccess);
        
        setHasAccess(hasCariBakiyeAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasCariBakiyeAccess) {
          console.log('❌ Cari Bakiye raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=c-bakiye');
          return;
        }

      } catch (error) {
        console.error('❌ Cari Bakiye - Rapor erişimi kontrol edilirken hata:', error);
        setHasAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkReportAccess();
  }, []);

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
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.log('⚠️ CompanyRef bulunamadı');
        return;
      }

      try {
        console.log('🔄 Connection bilgileri önceden yükleniyor (C-Bakiye)...');
        const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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
  const fetchMultipleClientDetails = async (clientRefs: string[], connectionInfo: any, selectedCurrencies: number[] = []): Promise<{[key: string]: any[]}> => {
    try {
      if (!Array.isArray(clientRefs) || clientRefs.length === 0) {
        return {};
      }
      
      // CompanyRef'i al
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        console.warn('⚠️ CompanyRef bulunamadı, hareket detayları yüklenemedi');
        return {};
      }
      
      // Firma no ve dönem no'yu al (backend için gerekli olabilir)
      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';
      
      // ClientRef'leri IN sorgusu için hazırla
      const clientRefList = clientRefs.map(ref => `'${ref}'`).join(', ');
      
      // Currency No'yu TRCURR değerine map et (Modal'dakiyle aynı)
      const mapCurrencyNoToTRCURR = (currencyNo: number): number => {
        switch(currencyNo) {
          case 53: return 0;  // TL -> TRCURR 0
          case 1: return 1;   // USD -> TRCURR 1
          case 20: return 20; // EUR -> TRCURR 20
          default: return currencyNo; // Diğer kurlar için aynı değer
        }
      };

      // ⚡ GÜNCEL: Modal'dakiyle aynı döviz türü filtreleme mantığı
      const getSelectedTRCURRValues = (): number[] => {
        if (!selectedCurrencies || selectedCurrencies.length === 0) {
          return []; // Hiç döviz türü seçilmemişse tüm döviz türlerini göster
        }
        return selectedCurrencies.map(mapCurrencyNoToTRCURR);
      };

      // ⚡ GÜNCEL SQL SORGUSU - Modal'da yenile butonundakiyle %100 aynı (toplu hali)
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
          CASE 
            WHEN SIGN=0 THEN 
              CASE TRCURR
                WHEN 0 THEN AMOUNT  -- TL ise TL tutarı
                ELSE TRNET          -- Başka döviz ise orijinal döviz tutarı
              END
            WHEN SIGN=1 THEN 0
          END AS [Borç],
          CASE 
            WHEN SIGN=0 THEN 0
            WHEN SIGN=1 THEN 
              CASE TRCURR
                WHEN 0 THEN AMOUNT  -- TL ise TL tutarı
                ELSE TRNET          -- Başka döviz ise orijinal döviz tutarı
              END
          END AS [Alacak],
          CASE TRCURR
            WHEN 0 THEN 'TL'
            WHEN 1 THEN 'USD'
            WHEN 20 THEN 'EURO'
          END AS [Döviz],
          TRRATE [Kur],
          AMOUNT [Tutar(TL)],
          CASE CANCELLED
            WHEN 0 THEN 'İptal Edilmemiş'
            WHEN 1 THEN 'İptal Edilmiş'
          END AS [İptal Durumu]
        FROM LG_${firmaNo}_${donemNo}_CLFLINE CLFLINE
        WHERE CLIENTREF IN (${clientRefList})
        ${(() => {
          const selectedTRCURRValues = getSelectedTRCURRValues();
          if (selectedTRCURRValues.length > 0) {
            return `AND TRCURR IN (${selectedTRCURRValues.join(',')})`;
          }
          return '';
        })()}
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
          
          response = await sendSecureProxyRequest(
            companyRef,
            'first_db_key', // Cari bakiye için first database kullan
            {
              query: detailQuery
            }
          );
          
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
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      
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
      const groupedDetails = await fetchMultipleClientDetails(missingRefs, connectionInfo, selectedCurrencies);
      
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
  }, [selectedCurrencies]); // ⚡ GÜNCEL: selectedCurrencies değiştiğinde throttle fonksiyonu da yenilenmeli

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
  }, [throttledPreloadClientDetails]); // ⚡ throttledPreloadClientDetails artık selectedCurrencies'e bağlı

  // Preloaded details güncelleme callback'i
  const handleUpdatePreloadedDetails = useCallback((clientRef: string, details: any[]) => {
    setPreloadedDetails(prev => ({
      ...prev,
      [clientRef]: details
    }));
    console.log(`✅ Cache güncellendi - ClientRef ${clientRef}: ${details.length} hareket`);
  }, []);

  // Multi-currency istatistikleri hesapla
  const calculateMultiCurrencyStats = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return { currencies: [], totalCustomers: 0 };
    }

    // Seçili döviz türleri için istatistik toplama
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

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchSqlData();
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      alert('Cache temizlenirken bir hata oluştu!');
    }
  };

  const fetchSqlData = async () => {
    if (!isAuthenticated) return;
    
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
    
    setLoading(true);
    try {
      // Mobil debug için initial check
      console.log('🔄 fetchSqlData başlatılıyor - Mobil Debug');
      
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
          console.log('✅ Connection bilgileri localStorage\'dan alındı:', connectionInfo);
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

        console.log('🔄 Connection bilgileri API\'den alınıyor...');
        
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
          console.log('💾 Connection bilgileri localStorage\'a kaydedildi');
                 } catch (error: any) {
           clearTimeout(timeoutId);
           if (error.name === 'AbortError') {
             console.error('❌ Connection bilgileri timeout:', error);
             alert('Bağlantı zaman aşımı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
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

      // SQL sorgusunu proxy üzerinden çalıştır - Mobil için geliştirilmiş retry logic
      let response: Response | undefined;
      const maxRetries = isMobile ? 3 : 2; // Mobilde daha az deneme
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Proxy çağrısı deneme ${attempt}/${maxRetries} (C-Bakiye${isMobile ? ' - Mobil' : ''})...`);
          
          // Debug: Gönderilen payload'u logla
          const requestPayload = {
            companyRef: companyRef,
            connectionType: 'first_db_key', // Cari bakiye için first database kullan
            payload: {
              query: sqlQuery
            }
          };
          console.log('🚀 Backend\'e gönderilen payload:', requestPayload);
          console.log('📋 CompanyRef değeri:', companyRef);
          console.log('🔑 ConnectionType değeri:', 'first_db_key');
          
          // Mobil cihazlar için timeout kontrolü
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), isMobile ? 20000 : 15000); // Mobilde daha uzun timeout
          
          response = await sendSecureProxyRequest(
            companyRef,
            'first_db_key', // Cari bakiye için first database kullan
            {
              query: sqlQuery
            }
          );
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log(`✅ Proxy çağrısı ${attempt}. denemede başarılı (C-Bakiye${isMobile ? ' - Mobil' : ''})`);
            break; // Başarılı, döngüden çık
          } else if (attempt === maxRetries) {
            console.error(`❌ Tüm denemeler başarısız - HTTP ${response.status} (C-Bakiye${isMobile ? ' - Mobil' : ''})`);
          } else {
            console.log(`⚠️ Deneme ${attempt} başarısız (${response.status}), tekrar denenecek... (C-Bakiye${isMobile ? ' - Mobil' : ''})`);
            await new Promise(resolve => setTimeout(resolve, isMobile ? 200 : 100)); // Mobilde daha uzun bekleme
          }
                 } catch (error: any) {
           if (error.name === 'AbortError') {
             console.error(`❌ Proxy çağrısı timeout (deneme ${attempt})`);
             if (attempt === maxRetries) {
               alert('İstek zaman aşımı. Lütfen internet bağlantınızı kontrol edin.');
               setLoading(false);
               return;
             }
           } else if (attempt === maxRetries) {
             console.error(`❌ Tüm denemeler başarısız (C-Bakiye${isMobile ? ' - Mobil' : ''}):`, error);
             throw error;
           } else {
             console.log(`⚠️ Deneme ${attempt} hata aldı, tekrar denenecek (C-Bakiye${isMobile ? ' - Mobil' : ''}):`, error);
             await new Promise(resolve => setTimeout(resolve, isMobile ? 200 : 100)); // Mobilde daha uzun bekleme
           }
         }
      }

      // HTTP Status kontrolü
      if (!response || !response.ok) {
        const status = response?.status || 'Bilinmeyen';
        const statusText = response?.statusText || 'Bağlantı hatası';
        
        // Backend'den gelen hata mesajını oku
        let errorMessage = `HTTP ${status}: ${statusText}`;
        if (response) {
          try {
            const errorData = await response.json();
            console.error('❌ Backend hata detayı:', errorData);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            console.error('❌ Backend hata response\'u okunamadı:', e);
          }
        }
        
        console.error('HTTP hatası:', status, statusText);
        alert(`Bağlantı hatası: ${errorMessage}`);
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

      console.log(`✅ MOBIL DEBUG: ${finalData.length} kayıt başarıyla yüklendi`);
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
    } catch (error: any) {
      console.error('Veri çekme hatası:', error);
      // Mobil debug için detaylı hata mesajı
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        alert(`Mobil cihazda veri yükleme hatası: ${error.message || 'Bilinmeyen hata'}`);
      } else {
        alert('Veri yüklenirken hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
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
            <strong>Cari Bakiye Raporu</strong>'na erişim yetkiniz bulunmamaktadır. 
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
                  Seçili Döviz Türleri: {selectedCurrencies.map(no => getCurrencyByNo(no)?.Kodu).filter(Boolean).join(', ')}
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
                  💱 Döviz Türü Seçimi
                </button>
                <button
                  onClick={clearCacheAndReload}
                  disabled={loading || selectedCurrencies.length === 0}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cache'i temizle ve yeni veri getir"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Yeniden Yükle
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
            onCurrencyChange={(currencies) => {
              setSelectedCurrencies(currencies);
            }}
            className="mb-4"
          />
        )}

        {/* Stats Cards */}
        <div className="space-y-6">
          {/* Genel İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Seçili Döviz Türleri</p>
                  <p className="text-2xl font-semibold text-gray-900">{selectedCurrencies.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCurrencies.map(no => getCurrencyByNo(no)?.Kodu).filter(Boolean).slice(0, 3).join(', ')}
                    {selectedCurrencies.length > 3 ? '...' : ''}
                  </p>
                </div>
              </div>
            </div>


          </div>

          {/* Döviz Türü Bazlı İstatistikler - Basitleştirilmiş */}
          {multiCurrencyStats.currencies.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">💰 Döviz Türü Bazlı Özet</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {multiCurrencyStats.currencies.map((currency, index) => (
                  <div key={currency.code} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">{currency.code}</h4>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {getCurrencyByCode(currency.code)?.Adı || currency.code}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Borç:</span>
                        <span className="font-medium text-red-600">
                          {currency.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Alacak:</span>
                        <span className="font-medium text-green-600">
                          {currency.alacak.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-sm font-medium text-gray-900">Net Bakiye:</span>
                        <span className={`font-bold ${
                          currency.bakiye < 0 ? 'text-red-600' : 
                          currency.bakiye > 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {Math.abs(currency.bakiye).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          {currency.bakiye !== 0 && (
                            <span className="ml-1 text-xs">
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
          selectedCurrencies={selectedCurrencies}
          onUpdatePreloadedDetails={handleUpdatePreloadedDetails}
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