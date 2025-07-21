'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import * as XLSX from 'xlsx';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';

// Modül kategorileri ve TR Kodları
const MODULE_CATEGORIES = [
  {
    moduleNr: 4,
    name: 'Fatura İşlemleri',
    description: 'Satış, satınalma ve hizmet faturaları',
    trCodes: [
      { code: 31, description: 'Satınalma Faturası' },
      { code: 32, description: 'Perakende Satış İade Faturası' },
      { code: 33, description: 'Toptan Satış İade Faturası' },
      { code: 34, description: 'Alınan Hizmet Faturası' },
      { code: 36, description: 'Satınalma İade Faturası' },
      { code: 37, description: 'Perakende Satış Faturası' },
      { code: 38, description: 'Toptan Satış Faturası' },
      { code: 39, description: 'Verilen Hizmet Faturası' },
      { code: 43, description: 'Satınalma Fiyat Farkı Faturası' },
      { code: 44, description: 'Satış Fiyat Farkı Faturası' },
      { code: 56, description: 'Müstahsil Makbuzu' }
    ]
  },
  {
    moduleNr: 5,
    name: 'Mali İşlemler',
    description: 'Nakit, dekont ve kredi kartı işlemleri',
    trCodes: [
      { code: 1, description: 'Nakit Tahsilat' },
      { code: 2, description: 'Nakit Ödeme' },
      { code: 3, description: 'Borç Dekontu' },
      { code: 4, description: 'Alacak Dekontu' },
      { code: 5, description: 'Virman Fişi' },
      { code: 6, description: 'Kur Farkı İşlemi' },
      { code: 12, description: 'Özel Fiş' },
      { code: 14, description: 'Açılış Fişi' },
      { code: 41, description: 'Verilen Vade Farkı Faturası' },
      { code: 42, description: 'Alınan Vade Farkı Faturası' },
      { code: 45, description: 'Verilen Serbest Meslek Makbuzu' },
      { code: 46, description: 'Alınan Serbest Meslek Makbuzu' },
      { code: 70, description: 'Kredi Kartı Fişi' },
      { code: 71, description: 'Kredi Kartı İade Fişi' },
      { code: 72, description: 'Firma Kredi Kartı Fişi' },
      { code: 73, description: 'Firma Kredi Kartı İade Fişi' }
    ]
  },
  {
    moduleNr: 6,
    name: 'Çek/Senet İşlemleri',
    description: 'Çek ve senet giriş/çıkış işlemleri',
    trCodes: [
      { code: 61, description: 'Çek Girişi' },
      { code: 62, description: 'Senet Girişi' },
      { code: 63, description: 'Çek Çıkışı(Cari Hesaba)' },
      { code: 64, description: 'Senet Çıkışı(Cari Hesaba)' },
      { code: 65, description: 'İşyerleri Arası İşlem Bordrosu(Müşteri Çeki)' },
      { code: 66, description: 'İşyerleri Arası İşlem Bordrosu(Müşteri Seneti)' }
    ]
  },
  {
    moduleNr: 7,
    name: 'Havale/EFT İşlemleri',
    description: 'Banka transferi ve döviz işlemleri',
    trCodes: [
      { code: 20, description: 'Gelen Havale/EFT' },
      { code: 21, description: 'Gönderilen Havale/EFT' },
      { code: 24, description: 'Döviz Alış Belgesi' },
      { code: 28, description: 'Alınan Hizmet Faturası' },
      { code: 29, description: 'Verilen Hizmet Faturası' },
      { code: 30, description: 'Müstahsil Makbuzu' }
    ]
  },
  {
    moduleNr: 10,
    name: 'Nakit İşlemler',
    description: 'Basit nakit tahsilat ve ödemeler',
    trCodes: [
      { code: 1, description: 'Nakit Tahsilat' },
      { code: 2, description: 'Nakit Ödeme' }
    ]
  }
];

// İşaret kodları
const SIGN_CODES = [
  { code: 0, description: 'Borç' },
  { code: 1, description: 'Alacak' }
];

export default function HareketGormeyenler() {
  // Ana veriler
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  
  // SQL Filtre parametreleri 
  const [lastDate, setLastDate] = useState('2025-06-01');
  const [allModules, setAllModules] = useState(true);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [allTRCodes, setAllTRCodes] = useState(true);
  const [selectedTRCodes, setSelectedTRCodes] = useState<number[]>([]);
  const [allSigns, setAllSigns] = useState(true);
  const [selectedSigns, setSelectedSigns] = useState<number[]>([]);
  
  // Frontend Cari Filtreleri
  const [cariFilters, setCariFilters] = useState({
    cariKoduInclude: '',
    cariKoduExclude: '',
    unvanInclude: '',
    unvanExclude: '',
    ozelKod1Include: [] as string[],
    ozelKod1Exclude: [] as string[],
    ozelKod2Include: [] as string[],
    ozelKod2Exclude: [] as string[],
    ozelKod3Include: [] as string[],
    ozelKod3Exclude: [] as string[],
    ozelKod4Include: [] as string[],
    ozelKod4Exclude: [] as string[],
    ozelKod5Include: [] as string[],
    ozelKod5Exclude: [] as string[]
  });
  
  const [showCariFilters, setShowCariFilters] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  
  // Sayfalama state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const router = useRouter();
  
  // Animation data'ları
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);

  // Benzersiz özel kod değerlerini ve açıklamalarını çıkar
  const uniqueSpecialCodes = useMemo(() => {
    const codes = {
      ozelKod1: new Map<string, string>(),
      ozelKod2: new Map<string, string>(),
      ozelKod3: new Map<string, string>(),
      ozelKod4: new Map<string, string>(),
      ozelKod5: new Map<string, string>()
    };

    data.forEach(row => {
      if (row['Ozel Kod 1']) {
        codes.ozelKod1.set(row['Ozel Kod 1'], row['Ozel Kod 1 Açıklama'] || '');
      }
      if (row['Ozel Kod 2']) {
        codes.ozelKod2.set(row['Ozel Kod 2'], row['Ozel Kod 2 Açıklama'] || '');
      }
      if (row['Ozel Kod 3']) {
        codes.ozelKod3.set(row['Ozel Kod 3'], row['Ozel Kod 3 Açıklama'] || '');
      }
      if (row['Ozel Kod 4']) {
        codes.ozelKod4.set(row['Ozel Kod 4'], row['Ozel Kod 4 Açıklama'] || '');
      }
      if (row['Ozel Kod 5']) {
        codes.ozelKod5.set(row['Ozel Kod 5'], row['Ozel Kod 5 Açıklama'] || '');
      }
    });

    return {
      ozelKod1: Array.from(codes.ozelKod1.entries()).sort(([a], [b]) => a.localeCompare(b, 'tr-TR')),
      ozelKod2: Array.from(codes.ozelKod2.entries()).sort(([a], [b]) => a.localeCompare(b, 'tr-TR')),
      ozelKod3: Array.from(codes.ozelKod3.entries()).sort(([a], [b]) => a.localeCompare(b, 'tr-TR')),
      ozelKod4: Array.from(codes.ozelKod4.entries()).sort(([a], [b]) => a.localeCompare(b, 'tr-TR')),
      ozelKod5: Array.from(codes.ozelKod5.entries()).sort(([a], [b]) => a.localeCompare(b, 'tr-TR'))
    };
  }, [data]);

  // Frontend filtreleme
  useEffect(() => {
    if (!data.length) {
      setFilteredData([]);
      return;
    }

    let filtered = data.filter(row => {
      // LOGICALREF = 1 olan kaydı hariç tut
      if (row.LOGICALREF === 1) {
        return false;
      }

      // Cari kodu filtreleri
      if (cariFilters.cariKoduExclude && row.CODE?.toLocaleLowerCase('tr-TR').includes(cariFilters.cariKoduExclude.toLocaleLowerCase('tr-TR'))) {
        return false;
      }
      if (cariFilters.cariKoduInclude && !row.CODE?.toLocaleLowerCase('tr-TR').includes(cariFilters.cariKoduInclude.toLocaleLowerCase('tr-TR'))) {
        return false;
      }

      // Ünvan filtreleri
      if (cariFilters.unvanExclude && row.DEFINITION_?.toLocaleLowerCase('tr-TR').includes(cariFilters.unvanExclude.toLocaleLowerCase('tr-TR'))) {
        return false;
      }
      if (cariFilters.unvanInclude && !row.DEFINITION_?.toLocaleLowerCase('tr-TR').includes(cariFilters.unvanInclude.toLocaleLowerCase('tr-TR'))) {
        return false;
      }

      // Özel kod filtreleri - sadece checkbox desteği
      const checkSpecialCode = (
        codeValue: string, 
        includeList: string[], 
        excludeList: string[]
      ) => {
        // Eğer değer yoksa
        if (!codeValue) {
          // Dahil et listesi varsa ve boş değer dahil değilse, gösterme
          if (includeList.length > 0) {
            return false;
          }
          // Diğer durumlarda göster (exclude filtresi boş değeri etkilemez)
          return true;
        }
        
        // Önce EXCLUDE kontrolü - eğer hariç tutulacaksa direkt false
        if (excludeList.length > 0 && excludeList.includes(codeValue)) {
          return false;
        }
        
        // Sonra INCLUDE kontrolü - eğer dahil edilecek liste varsa, değer listede olmalı
        if (includeList.length > 0) {
          return includeList.includes(codeValue);
        }

        return true;
      };

      if (!checkSpecialCode(row['Ozel Kod 1'], cariFilters.ozelKod1Include, cariFilters.ozelKod1Exclude)) return false;
      if (!checkSpecialCode(row['Ozel Kod 2'], cariFilters.ozelKod2Include, cariFilters.ozelKod2Exclude)) return false;
      if (!checkSpecialCode(row['Ozel Kod 3'], cariFilters.ozelKod3Include, cariFilters.ozelKod3Exclude)) return false;
      if (!checkSpecialCode(row['Ozel Kod 4'], cariFilters.ozelKod4Include, cariFilters.ozelKod4Exclude)) return false;
      if (!checkSpecialCode(row['Ozel Kod 5'], cariFilters.ozelKod5Include, cariFilters.ozelKod5Exclude)) return false;

      return true;
    });

    setFilteredData(filtered);
    setCurrentPage(1); // Filtre değiştiğinde sayfa 1'e dön
  }, [data, cariFilters]);

  // Sayfalanmış veri hesaplama
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Sayfalama bilgileri
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startItem = filteredData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

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
        console.log('🔍 Hareket Görmeyen Cariler - Rapor erişim yetkisi kontrol ediliyor...');
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
        
        // Hareket görmeyen cariler raporu şirketin paketinde var mı kontrol et
        const hareketGormeyenlerReport = allReports.find(report => 
                  report.report_name.toLocaleLowerCase('tr-TR').includes('hareket') &&
        report.report_name.toLocaleLowerCase('tr-TR').includes('görmeyen') ||
        report.report_name.toLocaleLowerCase('tr-TR').includes('cari') &&
        report.report_name.toLocaleLowerCase('tr-TR').includes('hareket')
        );
        
        if (!hareketGormeyenlerReport) {
          console.log('❌ Hareket Görmeyen Cariler raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü (admin de dahil)
        const hasAccess = hareketGormeyenlerReport.has_access;
        
        console.log('📊 Hareket Görmeyen Cariler raporu şirket paketinde:', !!hareketGormeyenlerReport);
        console.log('🔐 Hareket Görmeyen Cariler raporu erişim yetkisi:', hasAccess);
        
        setHasAccess(hasAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasAccess) {
          console.log('❌ Hareket Görmeyen Cariler raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=hareket-gormeyenler');
          return;
        }

      } catch (error) {
        console.error('❌ Hareket Görmeyen Cariler - Rapor erişimi kontrol edilirken hata:', error);
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
          console.log('✅ Connection bilgileri zaten mevcut (Hareket Görmeyen Cariler)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Hareket Görmeyen Cariler)...');
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? `/api/btrapor/connection-info/${companyRef}`
          : `https://api.btrapor.com/connection-info/${companyRef}`;
        
        const connectionResponse = await fetch(apiUrl);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Hareket Görmeyen Cariler)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

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

  // Hareket görmeyen cariler verilerini çek
  const fetchHareketGormeyenlerData = async () => {
    console.log('🔄 Hareket görmeyen cariler verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = localStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          connectionInfo = JSON.parse(cachedConnectionInfo);
        } catch (e) {
          console.error('Connection bilgileri parse edilemedi:', e);
          showErrorMessage('Bağlantı bilgileri geçersiz. Lütfen tekrar giriş yapın.');
          return;
        }
      }

      if (!connectionInfo) {
        showErrorMessage('Bağlantı bilgileri bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
      }

      const firmaNo = connectionInfo.first_firma_no || '009';
      const donemNo = connectionInfo.first_donem_no || '01';

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile hareket görmeyen cariler verileri çekiliyor...`);

      // SQL sorgusu parametrelerini hazırla
      const formattedDate = `${lastDate} 00:00:00.000`;
      
      // Modül filtresi
      const modulesCondition = allModules ? '' : 
        selectedModules.length > 0 ? `AND MODULENR IN (${selectedModules.join(',')})` : '';
      
      // TR kod filtresi
      const trCodesCondition = allTRCodes ? '' : 
        selectedTRCodes.length > 0 ? `AND TRCODE IN (${selectedTRCodes.join(',')})` : '';
      
      // İşaret filtresi
      const signsCondition = allSigns ? '' : 
        selectedSigns.length > 0 ? `AND SIGN IN (${selectedSigns.join(',')})` : '';

      // Güncellenmiş SQL sorgusu
      const sqlQuery = `
        DECLARE @LASTDATE DATETIME = '${formattedDate}';

        SELECT 
            C.LOGICALREF, 
            C.CODE, 
            C.DEFINITION_,

            C.SPECODE     AS [Ozel Kod 1],
            S1.DEFINITION_ AS [Ozel Kod 1 Açıklama],

            C.SPECODE2    AS [Ozel Kod 2],
            S2.DEFINITION_ AS [Ozel Kod 2 Açıklama],

            C.SPECODE3    AS [Ozel Kod 3],
            S3.DEFINITION_ AS [Ozel Kod 3 Açıklama],

            C.SPECODE4    AS [Ozel Kod 4],
            S4.DEFINITION_ AS [Ozel Kod 4 Açıklama],

            C.SPECODE5    AS [Ozel Kod 5],
            S5.DEFINITION_ AS [Ozel Kod 5 Açıklama],

            C.CYPHCODE    AS [Yetki Kodu],
            Y.DEFINITION_ AS [Yetki Kodu Açıklama],

            LASTOP.DATE_ AS [Son Hareket Tarihi],
            CASE LASTOP.TRCODE
                WHEN 1 THEN 'Satınalma İrsaliyesi'
                WHEN 2 THEN 'Perakende Satış İade İrsaliyesi'
                WHEN 3 THEN 'Toptan Satış İade İrsaliyesi'
                WHEN 4 THEN 'Konsinye Çıkış İade İrsaliyesi'
                WHEN 5 THEN 'Konsinye Giriş İrsaliyesi'
                WHEN 6 THEN 'Satınalma İade İrsaliyesi'
                WHEN 7 THEN 'Perakende Satış İrsaliyesi'
                WHEN 8 THEN 'Toptan Satış İrsaliyesi'
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
                WHEN 1 THEN 'Nakit Tahsilat'
                WHEN 2 THEN 'Nakit Ödeme'
                WHEN 3 THEN 'Borç Dekontu'
                WHEN 4 THEN 'Alacak Dekontu'
                WHEN 5 THEN 'Virman Fişi'
                WHEN 6 THEN 'Kur Farkı İşlemi'
                WHEN 12 THEN 'Özel Fiş'
                WHEN 14 THEN 'Açılış Fişi'
                WHEN 20 THEN 'Gelen Havale/EFT'
                WHEN 21 THEN 'Gönderilen Havale/EFT'
                WHEN 41 THEN 'Verilen Vade Farkı Faturası'
                WHEN 42 THEN 'Alınan Vade Farkı Faturası'
                WHEN 45 THEN 'Verilen Serbest Meslek Makbuzu'
                WHEN 46 THEN 'Alınan Serbest Meslek Makbuzu'
                WHEN 61 THEN 'Çek Girişi'
                WHEN 62 THEN 'Senet Girişi'
                WHEN 63 THEN 'Çek Çıkışı(Cari Hesaba)'
                WHEN 64 THEN 'Senet Çıkışı(Cari Hesaba)'
                WHEN 65 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Çeki)'
                WHEN 66 THEN 'İşyerleri Arası İşlem Bordrosu(Müşteri Seneti)'
                WHEN 70 THEN 'Kredi Kartı Fişi'
                WHEN 71 THEN 'Kredi Kartı İade Fişi'
                WHEN 72 THEN 'Firma Kredi Kartı Fişi'
                WHEN 73 THEN 'Firma Kredi Kartı İade Fişi'
                ELSE CONCAT('TRCODE: ', CAST(LASTOP.TRCODE AS VARCHAR))
            END AS [Son İşlem Türü]

        FROM LG_${firmaNo.padStart(3, '0')}_CLCARD C

        -- Hareketsiz cariyi bulmak için LEFT JOIN (sadece belirtilen tarih sonrası hareketi olanlar)
        LEFT JOIN (
            SELECT DISTINCT CLIENTREF
            FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_CLFLINE
            WHERE 
                DATE_ >= @LASTDATE
                AND CANCELLED = 0
                AND TRCODE > 0
                AND (
                    ${allModules ? '1 = 1' : selectedModules.length > 0 ? `MODULENR IN (${selectedModules.join(',')})` : '1 = 0'}
                )
                AND (
                    ${allTRCodes ? '1 = 1' : selectedTRCodes.length > 0 ? `TRCODE IN (${selectedTRCodes.join(',')})` : '1 = 0'}
                )
                AND (
                    ${allSigns ? '1 = 1' : selectedSigns.length > 0 ? `SIGN IN (${selectedSigns.join(',')})` : '1 = 0'}
                )
        ) AS H ON C.LOGICALREF = H.CLIENTREF

        -- OUTER APPLY ile son hareketin alınması (tarih sınırı olmadan)
        OUTER APPLY (
            SELECT TOP 1 DATE_, TRCODE
            FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_CLFLINE L
            WHERE 
                L.CLIENTREF = C.LOGICALREF
                AND L.CANCELLED = 0
                AND L.TRCODE > 0
                AND (
                    ${allModules ? '1 = 1' : selectedModules.length > 0 ? `L.MODULENR IN (${selectedModules.join(',')})` : '1 = 1'}
                )
                AND (
                    ${allTRCodes ? '1 = 1' : selectedTRCodes.length > 0 ? `L.TRCODE IN (${selectedTRCodes.join(',')})` : '1 = 1'}
                )
                AND (
                    ${allSigns ? '1 = 1' : selectedSigns.length > 0 ? `L.SIGN IN (${selectedSigns.join(',')})` : '1 = 1'}
                )
            ORDER BY L.DATE_ DESC
        ) LASTOP

        -- Açıklamalar için OUTER APPLY
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.SPECODE  AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP1 = 1) S1
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.SPECODE2 AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP2 = 1) S2
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.SPECODE3 AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP3 = 1) S3
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.SPECODE4 AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP4 = 1) S4
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.SPECODE5 AND CODETYPE = 1 AND SPECODETYPE = 26 AND SPETYP5 = 1) S5
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES WHERE SPECODE = C.CYPHCODE AND CODETYPE = 2 AND SPECODETYPE = 26) Y

        WHERE 
            C.ACTIVE = 0
            AND H.CLIENTREF IS NULL
        ORDER BY C.DEFINITION_;
      `;

      console.log('🔍 SQL Sorgusu:', sqlQuery);

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        {
          query: sqlQuery
        },
        'https://api.btrapor.com/proxy',
        300000 // 5 dakika timeout
      );

      // İlk olarak response type kontrolü
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('❌ API HTML döndürdü - proxy hatası olabilir');
        showErrorMessage('Proxy sunucusuna erişilemiyor. Lütfen sistem yöneticinize başvurun.');
        return;
      }

      if (!response.ok) {
        let errorMessage = 'Hareket görmeyen cariler verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          // JSON parse edilemezse response text'i al
          const errorText = await response.text();
          console.error('❌ API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
        return;
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setData(result.results);
        console.log('✅ Hareket görmeyen cariler verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
      } else if (result.data && Array.isArray(result.data)) {
        // Alternatif response formatı
        setData(result.data);
        console.log('✅ Hareket görmeyen cariler verileri başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }

    } catch (error: any) {
      console.error('❌ Hareket görmeyen cariler verileri çekilirken hata:', error);
      
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

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    await fetchHareketGormeyenlerData();
    setHasFetched(true);
  };

  // Module toggle
  const toggleModule = (moduleNr: number) => {
    setSelectedModules(prev => 
      prev.includes(moduleNr) 
        ? prev.filter(m => m !== moduleNr)
        : [...prev, moduleNr]
    );
  };

  // TR Code toggle
  const toggleTRCode = (code: number) => {
    setSelectedTRCodes(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  // Sign toggle
  const toggleSign = (sign: number) => {
    setSelectedSigns(prev => 
      prev.includes(sign) 
        ? prev.filter(s => s !== sign)
        : [...prev, sign]
    );
  };

  // Seçili modüllere göre TR kodlarını getir
  const getAvailableTRCodes = () => {
    if (allModules) {
      return MODULE_CATEGORIES.flatMap(cat => cat.trCodes);
    }
    
    return MODULE_CATEGORIES
      .filter(cat => selectedModules.includes(cat.moduleNr))
      .flatMap(cat => cat.trCodes);
  };

  // Cari filtre helper fonksiyonları
  const updateCariFilter = (field: keyof typeof cariFilters, value: any) => {
    setCariFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSpecialCodeFilter = (codeType: 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5', filterType: 'Include' | 'Exclude', value: string) => {
    const fieldName = `${codeType}${filterType}` as keyof typeof cariFilters;
    const currentList = cariFilters[fieldName] as string[];
    
    updateCariFilter(fieldName, 
      currentList.includes(value) 
        ? currentList.filter(v => v !== value)
        : [...currentList, value]
    );
  };

  // Filtreleri temizle
  const clearCariFilters = () => {
    setCariFilters({
      cariKoduInclude: '',
      cariKoduExclude: '',
      unvanInclude: '',
      unvanExclude: '',
      ozelKod1Include: [],
      ozelKod1Exclude: [],
      ozelKod2Include: [],
      ozelKod2Exclude: [],
      ozelKod3Include: [],
      ozelKod3Exclude: [],
      ozelKod4Include: [],
      ozelKod4Exclude: [],
      ozelKod5Include: [],
      ozelKod5Exclude: []
    });
  };

  // Aktif filtre sayısı
  const getActiveFilterCount = () => {
    let count = 0;
    if (cariFilters.cariKoduInclude) count++;
    if (cariFilters.cariKoduExclude) count++;
    if (cariFilters.unvanInclude) count++;
    if (cariFilters.unvanExclude) count++;
    
    Object.entries(cariFilters).forEach(([key, value]) => {
      if (!['cariKoduInclude', 'cariKoduExclude', 'unvanInclude', 'unvanExclude'].includes(key)) {
        // Array filtreleri (checkbox lists)
        if (Array.isArray(value) && value.length > 0) {
          count++;
        }
      }
    });
    
    return count;
  };

  // Excel Export fonksiyonu
  const exportToExcel = () => {
    try {
      if (filteredData.length === 0) {
        alert('Export edilecek veri bulunamadı.');
        return;
      }

      // Kullanıcı bilgisini al
      const currentUser = getCurrentUser();
      const userName = currentUser ? (currentUser.name || 'Kullanıcı') : 'Bilinmeyen Kullanıcı';

      // Export verilerini hazırla
      const exportData = filteredData.map(row => ({
        'Cari Kodu': row.CODE || '',
        'Cari Ünvanı': row.DEFINITION_ || '',
        'Son Hareket Tarihi': row['Son Hareket Tarihi'] ? 
          new Date(row['Son Hareket Tarihi']).toLocaleDateString('tr-TR') : 
          'Hiç hareket yok',
        'Son İşlem Türü': row['Son İşlem Türü'] && !row['Son İşlem Türü'].startsWith('TRCODE:') ? 
          row['Son İşlem Türü'] : '-',
        'Özel Kod 1': row['Ozel Kod 1'] || '',
        'Özel Kod 1 Açıklama': row['Ozel Kod 1 Açıklama'] || '',
        'Özel Kod 2': row['Ozel Kod 2'] || '',
        'Özel Kod 2 Açıklama': row['Ozel Kod 2 Açıklama'] || '',
        'Özel Kod 3': row['Ozel Kod 3'] || '',
        'Özel Kod 3 Açıklama': row['Ozel Kod 3 Açıklama'] || '',
        'Özel Kod 4': row['Ozel Kod 4'] || '',
        'Özel Kod 4 Açıklama': row['Ozel Kod 4 Açıklama'] || '',
        'Özel Kod 5': row['Ozel Kod 5'] || '',
        'Özel Kod 5 Açıklama': row['Ozel Kod 5 Açıklama'] || '',
        'Yetki Kodu': row['Yetki Kodu'] || '',
        'Yetki Kodu Açıklama': row['Yetki Kodu Açıklama'] || ''
      }));

      // Filtre bilgilerini ayrı bir sheet'e ekle
      const filterInfo = [
        ['Hareket Görmeyen Cariler Raporu - Filtre Bilgileri'],
        [''],
        ['Rapor Tarihi:', new Date().toLocaleString('tr-TR')],
        ['Son Hareket Tarihi:', lastDate],
        [''],
        ['SQL Filtreleri:'],
        ['Modüller:', allModules ? 'Tüm Modüller' : `${selectedModules.length} Modül Seçili`],
        ['İşlem Türleri:', allTRCodes ? 'Tüm Türler' : `${selectedTRCodes.length} Tür Seçili`],
        ['İşaret Türü:', allSigns ? 'Tüm İşaretler' : `${selectedSigns.length} İşaret Seçili`],
        [''],
        ['Frontend Filtreleri:'],
        ['Cari Kodu (Dahil):', cariFilters.cariKoduInclude || 'Boş'],
        ['Cari Kodu (Hariç):', cariFilters.cariKoduExclude || 'Boş'],
        ['Ünvan (Dahil):', cariFilters.unvanInclude || 'Boş'],
        ['Ünvan (Hariç):', cariFilters.unvanExclude || 'Boş'],
        [''],
        ['Özel Kod Filtreleri:']
      ];

      // Özel kod filtrelerini ekle
      [1, 2, 3, 4, 5].forEach(num => {
        const codeType = `ozelKod${num}` as 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5';
        const includeList = cariFilters[`${codeType}Include` as keyof typeof cariFilters] as string[];
        const excludeList = cariFilters[`${codeType}Exclude` as keyof typeof cariFilters] as string[];
        
        if (includeList.length > 0 || excludeList.length > 0) {
          filterInfo.push([`Özel Kod ${num}:`]);
          if (includeList.length > 0) {
            filterInfo.push([`  Dahil Et: ${includeList.join(', ')}`]);
          }
          if (excludeList.length > 0) {
            filterInfo.push([`  Hariç Tut: ${excludeList.join(', ')}`]);
          }
        }
      });

      filterInfo.push([''], [`Toplam Kayıt: ${data.length} / Filtrelenmiş: ${filteredData.length}`], [''], ['Rapor Notu:'], [`Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde`], [`${userName} tarafından BT Rapor sistemi üzerinden alınmıştır.`], [`${lastDate} tarihinden sonra hiç hareket görmeyen cari hesaplar listelenmektedir.`]);

      // Workbook oluştur
      const workbook = XLSX.utils.book_new();
      
      // Ana veri sheet'i
      const dataWorksheet = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(workbook, dataWorksheet, 'Hareket Görmeyen Cariler');

      // Filtre bilgileri sheet'i
      const filterWorksheet = XLSX.utils.aoa_to_sheet(filterInfo);
      XLSX.utils.book_append_sheet(workbook, filterWorksheet, 'Filtre Bilgileri');

      // Sütun genişliklerini ayarla
      dataWorksheet['!cols'] = [
        { wch: 15 }, // Cari Kodu
        { wch: 40 }, // Cari Ünvanı
        { wch: 18 }, // Son Hareket Tarihi
        { wch: 30 }, // Son İşlem Türü
        { wch: 12 }, // Özel Kod 1
        { wch: 25 }, // Özel Kod 1 Açıklama
        { wch: 12 }, // Özel Kod 2
        { wch: 25 }, // Özel Kod 2 Açıklama
        { wch: 12 }, // Özel Kod 3
        { wch: 25 }, // Özel Kod 3 Açıklama
        { wch: 12 }, // Özel Kod 4
        { wch: 25 }, // Özel Kod 4 Açıklama
        { wch: 12 }, // Özel Kod 5
        { wch: 25 }, // Özel Kod 5 Açıklama
        { wch: 12 }, // Yetki Kodu
        { wch: 25 }  // Yetki Kodu Açıklama
      ];

      filterWorksheet['!cols'] = [
        { wch: 30 },
        { wch: 50 }
      ];

      // Dosyayı indir
      const fileName = `Hareket_Görmeyen_Cariler_${new Date().toLocaleDateString('tr-TR').replace(/\//g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      console.log('✅ Excel export tamamlandı:', fileName);
    } catch (error) {
      console.error('❌ Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  // PDF Export fonksiyonu
  const exportToPDF = () => {
    try {
      if (filteredData.length === 0) {
        alert('Yazdırılacak veri bulunamadı.');
        return;
      }

      // Kullanıcı bilgisini al
      const currentUser = getCurrentUser();
      const userName = currentUser ? (currentUser.name || 'Kullanıcı') : 'Bilinmeyen Kullanıcı';

      // Yazdırma için HTML oluştur
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle PDF yazdırma penceresi açılamıyor.');
        return;
      }

      // Filtre bilgilerini hazırla
      const activeFilters = [];
      if (cariFilters.cariKoduInclude) activeFilters.push(`Cari Kodu (Dahil): ${cariFilters.cariKoduInclude}`);
      if (cariFilters.cariKoduExclude) activeFilters.push(`Cari Kodu (Hariç): ${cariFilters.cariKoduExclude}`);
      if (cariFilters.unvanInclude) activeFilters.push(`Ünvan (Dahil): ${cariFilters.unvanInclude}`);
      if (cariFilters.unvanExclude) activeFilters.push(`Ünvan (Hariç): ${cariFilters.unvanExclude}`);
      
      [1, 2, 3, 4, 5].forEach(num => {
        const codeType = `ozelKod${num}` as 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5';
        const includeList = cariFilters[`${codeType}Include` as keyof typeof cariFilters] as string[];
        const excludeList = cariFilters[`${codeType}Exclude` as keyof typeof cariFilters] as string[];
        
        if (includeList.length > 0) {
          activeFilters.push(`Özel Kod ${num} (Dahil): ${includeList.join(', ')}`);
        }
        if (excludeList.length > 0) {
          activeFilters.push(`Özel Kod ${num} (Hariç): ${excludeList.join(', ')}`);
        }
      });

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Hareket Görmeyen Cariler Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 11px; }
            .header { margin-bottom: 30px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: white; margin: 0 0 8px 0; font-size: 22px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-align: left; }
            .pdf-info { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin-bottom: 25px; border-radius: 4px; }
            .pdf-info strong { color: #92400e; }
            
            /* İstatistik Kutuları */
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-box.primary { border-color: #991b1b; background-color: #fef2f2; }
            .stat-box.success { border-color: #059669; background-color: #ecfdf5; }
            .stat-box.warning { border-color: #d97706; background-color: #fffbeb; }
            .stat-title { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 14px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 8px; color: #9ca3af; margin-top: 2px; }
            
            /* Filtre Bilgileri */
            .filter-info { background-color: #f0f9ff; border: 1px solid #0ea5e9; padding: 12px; margin-bottom: 20px; border-radius: 6px; }
            .filter-info h3 { margin: 0 0 8px 0; color: #0c4a6e; font-size: 12px; }
            .filter-item { font-size: 9px; color: #374151; margin: 2px 0; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 8px; }
            th, td { border: 1px solid #ddd; padding: 3px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 8px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .center { text-align: center; }
            
            @media print {
              body { margin: 0; font-size: 10px; }
              .pdf-info { display: none; }
              .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px; }
              .stat-box { padding: 8px; }
              table { font-size: 7px; }
              th, td { padding: 2px; }
              .header { margin-bottom: 20px; padding: 15px; }
              .header-top { gap: 15px; margin-bottom: 10px; }
              .logo { width: 75px; }
              .header h1 { font-size: 16px; margin: 0 0 3px 0; }
              .header p { font-size: 9px; margin: 1px 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>HAREKET GÖRMEYEN CARİLER RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleString('tr-TR')}</p>
                <p><strong>Son Hareket Tarihi:</strong> ${lastDate}</p>
                <p><strong>Sistem:</strong> BT Rapor - Cari Hesap Analiz Sistemi</p>
              </div>
            </div>
          </div>

          <div class="pdf-info">
            <strong>PDF Raporu:</strong> Bu rapor yazdırma için optimize edilmiştir. Tarayıcınızın yazdır menüsünden "PDF olarak kaydet" seçeneğini kullanabilirsiniz.
          </div>

          <!-- İstatistikler -->
          <div class="stats-grid">
                         <div class="stat-box primary">
               <div class="stat-title">TOPLAM HAM VERİ</div>
               <div class="stat-value">${data.length}</div>
               <div class="stat-subtitle">Veritabanından çekilen</div>
             </div>
                         <div class="stat-box success">
               <div class="stat-title">FİLTRELENMİŞ VERİ</div>
               <div class="stat-value">${filteredData.length}</div>
               <div class="stat-subtitle">Gösterilen kayıt</div>
             </div>
                                      <div class="stat-box warning">
                <div class="stat-title">AKTİF FİLTRELER</div>
                <div class="stat-value">${getActiveFilterCount()}</div>
                <div class="stat-subtitle">Ekran filtresi</div>
               </div>
          </div>

          <!-- Filtre Bilgileri -->
          ${activeFilters.length > 0 ? `
          <div class="filter-info">
            <h3>Aktif Filtreler:</h3>
            ${activeFilters.map(filter => `<div class="filter-item">• ${filter}</div>`).join('')}
          </div>
          ` : ''}

          <!-- SQL Filtre Parametreleri -->
          <div class="filter-info">
            <h3>Filtre Parametreleri:</h3>
            <div class="filter-item">• Modüller: ${allModules ? 'Tüm Modüller' : `${selectedModules.length} Modül Seçili`}</div>
            <div class="filter-item">• İşlem Türleri: ${allTRCodes ? 'Tüm Türler' : `${selectedTRCodes.length} Tür Seçili`}</div>
            <div class="filter-item">• İşaret Türü: ${allSigns ? 'Tüm İşaretler' : `${selectedSigns.length} İşaret Seçili`}</div>
          </div>

          <!-- Veri Tablosu -->
          <table>
            <thead>
              <tr>
                <th>Cari Kodu</th>
                <th>Cari Ünvanı</th>
                <th>Son Hareket Tarihi</th>
                <th>Son İşlem Türü</th>
                <th>Özel Kod 1</th>
                <th>Özel Kod 2</th>
                <th>Özel Kod 3</th>
                <th>Özel Kod 4</th>
                <th>Özel Kod 5</th>
                <th>Yetki Kodu</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map(row => `
                <tr>
                  <td>${row.CODE || ''}</td>
                  <td>${row.DEFINITION_ || ''}</td>
                  <td>${row['Son Hareket Tarihi'] ? 
                    new Date(row['Son Hareket Tarihi']).toLocaleDateString('tr-TR') : 
                    'Hiç hareket yok'}</td>
                  <td>${row['Son İşlem Türü'] && !row['Son İşlem Türü'].startsWith('TRCODE:') ? 
                    row['Son İşlem Türü'] : '-'}</td>
                  <td>${row['Ozel Kod 1'] || ''}</td>
                  <td>${row['Ozel Kod 2'] || ''}</td>
                  <td>${row['Ozel Kod 3'] || ''}</td>
                  <td>${row['Ozel Kod 4'] || ''}</td>
                  <td>${row['Ozel Kod 5'] || ''}</td>
                  <td>${row['Yetki Kodu'] || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
                     <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
             <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde ${userName} tarafından BT Rapor sistemi üzerinden alınmıştır. 
             ${lastDate} tarihinden sonra hiç hareket görmeyen cari hesaplar listelenmektedir.
           </div>
          
          <script>
            // Sayfa yüklendiğinde otomatik yazdırma diyaloğunu aç
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            
            // Yazdırma tamamlandığında veya iptal edildiğinde pencereyi kapat
            window.onafterprint = function() {
              window.close();
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();

      console.log('✅ PDF export (yazdır) başlatıldı');
    } catch (error) {
      console.error('❌ PDF export hatası:', error);
      alert('PDF yazdırma işlemi sırasında hata oluştu.');
    }
  };

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Hareket Görmeyen Cariler">
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
    <DashboardLayout title="Hareket Görmeyen Cariler">
      <div className="space-y-6">
        {/* Modern Header Section */}
        <div className="bg-gradient-to-r from-gray-900 via-red-900 to-red-800 rounded-xl shadow-lg border border-red-800">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mr-6 shadow-lg">
                  <img 
                    src="/img/btRapor.png" 
                    alt="btRapor Logo" 
                    className="h-10 w-auto"
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Hareket Görmeyen Cariler</h1>
                  <div className="flex flex-wrap items-center gap-4 text-red-100 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>Son Tarih: {lastDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span>Ham Veri: {data.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🔍</span>
                      <span>Filtrelenmiş: {filteredData.length}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 lg:mt-0 flex flex-col space-y-3">
                <div className="text-right">
                  <p className="text-red-100 text-sm">Rapor Tarihi</p>
                  <p className="text-xl font-semibold text-white">{new Date().toLocaleDateString('tr-TR')}</p>
                </div>
                {data.length > 0 && (
                  <button
                    onClick={() => setShowCariFilters(!showCariFilters)}
                    className="px-6 py-2.5 bg-white bg-opacity-10 backdrop-blur-sm text-white rounded-lg hover:bg-opacity-20 transition-all duration-200 font-medium flex items-center justify-center gap-2 border border-white border-opacity-20"
                  >
                    <span>🔍</span>
                    Cari Filtreleri
                    {getActiveFilterCount() > 0 && (
                      <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold">
                        {getActiveFilterCount()}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modern Filtre Paneli */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Filtre Başlığı */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-lg">🎯</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Filtre Parametreleri</h3>
                  <p className="text-sm text-gray-500">Raporlama kriterlerinizi belirleyin</p>
                </div>
              </div>
              <button
                onClick={handleFetchReport}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <span>📊</span>
                    Raporu Getir
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filtre İçeriği */}
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Tarih Kartı */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📅</span>
                  </div>
                  <h4 className="text-sm font-semibold text-blue-900">Son Hareket Tarihi</h4>
                </div>
                <input
                  type="date"
                  value={lastDate}
                  onChange={(e) => setLastDate(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                />
                <p className="text-xs text-blue-600 mt-2">
                  Bu tarihten sonra hareket görmemiş cariler
                </p>
              </div>

              {/* Modül Kartı */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">⚙️</span>
                  </div>
                  <h4 className="text-sm font-semibold text-green-900">İşlem Modülleri</h4>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allModules}
                      onChange={(e) => {
                        setAllModules(e.target.checked);
                        if (e.target.checked) {
                          setSelectedModules([]);
                          setAllTRCodes(true);
                          setSelectedTRCodes([]);
                        }
                      }}
                      className="rounded border-green-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm text-green-800 font-medium">Tüm Modüller</span>
                  </label>
                  
                  {!allModules && (
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white rounded border border-green-200 p-2">
                      {MODULE_CATEGORIES.map(module => (
                        <label key={module.moduleNr} className="flex items-start text-xs">
                          <input
                            type="checkbox"
                            checked={selectedModules.includes(module.moduleNr)}
                            onChange={() => toggleModule(module.moduleNr)}
                            className="rounded border-green-300 text-green-600 focus:ring-green-500 mt-0.5 mr-2"
                          />
                          <div>
                            <div className="font-medium text-gray-800">{module.name}</div>
                            <div className="text-gray-500">{module.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* İşlem Türleri Kartı */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">📋</span>
                  </div>
                  <h4 className="text-sm font-semibold text-purple-900">İşlem Türleri</h4>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allTRCodes}
                      onChange={(e) => {
                        setAllTRCodes(e.target.checked);
                        if (e.target.checked) {
                          setSelectedTRCodes([]);
                        }
                      }}
                      className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="ml-2 text-sm text-purple-800 font-medium">Tüm Türler</span>
                  </label>
                  
                  {!allTRCodes && (
                    <div className="max-h-32 overflow-y-auto bg-white rounded border border-purple-200 p-2">
                      {getAvailableTRCodes().map(trCode => (
                        <label key={`${trCode.code}`} className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={selectedTRCodes.includes(trCode.code)}
                            onChange={() => toggleTRCode(trCode.code)}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 mr-2"
                          />
                          <span className="text-gray-600">
                            {trCode.code} - {trCode.description}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* İşaret Türü Kartı */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">⚖️</span>
                  </div>
                  <h4 className="text-sm font-semibold text-orange-900">İşaret Türü</h4>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allSigns}
                      onChange={(e) => {
                        setAllSigns(e.target.checked);
                        if (e.target.checked) {
                          setSelectedSigns([]);
                        }
                      }}
                      className="rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-orange-800 font-medium">Tüm İşaretler</span>
                  </label>
                  
                  {!allSigns && (
                    <div className="space-y-1">
                      {SIGN_CODES.map(signCode => (
                        <label key={signCode.code} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={selectedSigns.includes(signCode.code)}
                            onChange={() => toggleSign(signCode.code)}
                            className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 mr-2"
                          />
                          <span className="text-orange-800">{signCode.description}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Cari Filtreleri */}
        {showCariFilters && data.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {/* Filtre Başlığı */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">🔍</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">Cari Filtreleri</h3>
                    <div className="text-sm text-blue-600 space-y-1">
                      <p>Mevcut veriler üzerinde detaylı filtreleme</p>
                      <p className="text-xs">
                        💡 <span className="font-medium text-green-700">Dahil Et:</span> Sadece seçilen değerleri gösterir | 
                        <span className="font-medium text-red-700 ml-2">Hariç Tut:</span> Seçilen değerleri gizler
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={clearCariFilters}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <span>🧹</span>
                    Temizle
                  </button>
                  <button
                    onClick={() => setShowCariFilters(false)}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <span>✕</span>
                    Kapat
                  </button>
                </div>
              </div>
            </div>
            
            {/* Filtre İçeriği */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Metin Filtreleri */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-green-600 rounded text-white text-xs flex items-center justify-center">📝</span>
                      Cari Kodu Filtreleri
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-green-700 font-medium mb-1 block">Dahil Et:</label>
                        <input
                          type="text"
                          value={cariFilters.cariKoduInclude}
                          onChange={(e) => updateCariFilter('cariKoduInclude', e.target.value)}
                          placeholder="Cari kodunda ara..."
                          className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-700 font-medium mb-1 block">Hariç Tut:</label>
                        <input
                          type="text"
                          value={cariFilters.cariKoduExclude}
                          onChange={(e) => updateCariFilter('cariKoduExclude', e.target.value)}
                          placeholder="Hariç tutulacak kodlar..."
                          className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
                    <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-purple-600 rounded text-white text-xs flex items-center justify-center">🏢</span>
                      Cari Ünvan Filtreleri
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-green-700 font-medium mb-1 block">Dahil Et:</label>
                        <input
                          type="text"
                          value={cariFilters.unvanInclude}
                          onChange={(e) => updateCariFilter('unvanInclude', e.target.value)}
                          placeholder="Ünvanda ara..."
                          className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-red-700 font-medium mb-1 block">Hariç Tut:</label>
                        <input
                          type="text"
                          value={cariFilters.unvanExclude}
                          onChange={(e) => updateCariFilter('unvanExclude', e.target.value)}
                          placeholder="Hariç tutulacak ünvanlar..."
                          className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Özel Kod Filtreleri */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <span className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white text-sm flex items-center justify-center shadow-md">🏷️</span>
                    Özel Kod Filtreleri
                  </h4>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {[1, 2, 3, 4, 5].map(codeNum => {
                      const codeType = `ozelKod${codeNum}` as 'ozelKod1' | 'ozelKod2' | 'ozelKod3' | 'ozelKod4' | 'ozelKod5';
                      const availableCodes = uniqueSpecialCodes[codeType];
                      
                      if (availableCodes.length === 0) return null;

                      return (
                        <div key={codeNum} className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="w-7 h-7 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg text-white text-xs flex items-center justify-center shadow-sm font-bold">{codeNum}</span>
                            <span className="text-gray-800">Özel Kod {codeNum}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {availableCodes.length} değer
                            </span>
                          </h5>
                          
                          {/* Sadece Checkbox Filtreleri */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <label className="text-xs text-green-800 font-medium mb-2 block flex items-center gap-1">
                                <span className="w-4 h-4 bg-green-600 rounded text-white text-xs flex items-center justify-center">✓</span>
                                Dahil Et
                                <span className="text-green-600 font-normal">(Seçilenleri göster)</span>
                              </label>
                                                             <div className="max-h-28 overflow-y-auto bg-white border border-green-300 rounded-md p-2 space-y-1.5">
                                  {availableCodes.map(([code, description]) => (
                                    <label key={`${codeType}-include-${code}`} className="flex items-start text-xs group hover:bg-green-50 p-1 rounded transition-colors cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(cariFilters[`${codeType}Include` as keyof typeof cariFilters] as string[]).includes(code)}
                                        onChange={() => toggleSpecialCodeFilter(codeType, 'Include', code)}
                                        className="rounded border-green-300 text-green-600 focus:ring-green-500 mr-2 mt-0.5 transition-colors flex-shrink-0"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-gray-800 group-hover:text-green-800 font-medium">{code}</div>
                                        {description && (
                                          <div className="text-gray-500 group-hover:text-green-700 text-xs mt-0.5 truncate">{description}</div>
                                        )}
                                      </div>
                                    </label>
                                  ))}
                                  {availableCodes.length === 0 && (
                                    <span className="text-xs text-gray-400 italic">Değer bulunamadı</span>
                                  )}
                                </div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                              <label className="text-xs text-red-800 font-medium mb-2 block flex items-center gap-1">
                                <span className="w-4 h-4 bg-red-600 rounded text-white text-xs flex items-center justify-center">✕</span>
                                Hariç Tut
                                <span className="text-red-600 font-normal">(Seçilenleri gizle)</span>
                              </label>
                                                             <div className="max-h-28 overflow-y-auto bg-white border border-red-300 rounded-md p-2 space-y-1.5">
                                  {availableCodes.map(([code, description]) => (
                                    <label key={`${codeType}-exclude-${code}`} className="flex items-start text-xs group hover:bg-red-50 p-1 rounded transition-colors cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(cariFilters[`${codeType}Exclude` as keyof typeof cariFilters] as string[]).includes(code)}
                                        onChange={() => toggleSpecialCodeFilter(codeType, 'Exclude', code)}
                                        className="rounded border-red-300 text-red-600 focus:ring-red-500 mr-2 mt-0.5 transition-colors flex-shrink-0"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-gray-800 group-hover:text-red-800 font-medium">{code}</div>
                                        {description && (
                                          <div className="text-gray-500 group-hover:text-red-700 text-xs mt-0.5 truncate">{description}</div>
                                        )}
                                      </div>
                                    </label>
                                  ))}
                                  {availableCodes.length === 0 && (
                                    <span className="text-xs text-gray-400 italic">Değer bulunamadı</span>
                                  )}
                                </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Aktif Filtreler Gösterimi */}
        {hasFetched && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                <span className="text-blue-600">🔍</span>
                Aktif Filtreler
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Son Hareket Tarihi:</span>
                <span className="ml-2 text-blue-700">{lastDate}</span>
              </div>
              <div>
                <span className="font-medium text-blue-800">Modüller:</span>
                <span className="ml-2 text-blue-700">
                  {allModules ? 'Hepsi' : selectedModules.length > 0 ? `${selectedModules.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">İşlem Türleri:</span>
                <span className="ml-2 text-blue-700">
                  {allTRCodes ? 'Hepsi' : selectedTRCodes.length > 0 ? `${selectedTRCodes.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
              <div>
                <span className="font-medium text-blue-800">İşaret:</span>
                <span className="ml-2 text-blue-700">
                  {allSigns ? 'Hepsi' : selectedSigns.length > 0 ? `${selectedSigns.length} seçili` : 'Hiçbiri'}
                </span>
              </div>
            </div>
            
            {/* Frontend Filtre Özeti */}
            {getActiveFilterCount() > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-blue-800">Ekran Filtreleri:</span>
                  <span className="text-blue-700">{getActiveFilterCount()} aktif filtre</span>
                  <span className="text-blue-600">→</span>
                  <span className="font-medium text-blue-800">{filteredData.length} / {data.length} kayıt gösteriliyor</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sonuç Bilgi ve Export Kartı */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-green-800">
                <span>✅</span>
                <span className="font-medium">
                  Toplam {data.length} hareket görmeyen cari bulundu
                  {getActiveFilterCount() > 0 && `, ${filteredData.length} tanesi filtreleme sonrası gösteriliyor`}
                </span>
              </div>
              
              {/* Export Butonları */}
              {filteredData.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-sm"
                    title="Excel olarak indir (Filtre bilgileri dahil)"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    Excel
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-sm"
                    title="PDF olarak yazdır (Filtre bilgileri dahil)"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    PDF
                  </button>
                </div>
              )}
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
              <h3 className="text-lg font-medium text-gray-900">Hareket Görmeyen Cariler Raporu</h3>
              <p className="text-sm text-gray-500">Belirtilen tarihten sonra hareket görmemiş cari hesapları görüntüleyin</p>
              {data.length > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  💡 Rapor geldikten sonra "Cari Filtreleri" butonu ile ek filtreleme yapabilirsiniz
                </p>
              )}
            </div>
            <button
              onClick={handleFetchReport}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Raporu Getir
                </>
              )}
            </button>
          </div>
        </div>

        {/* Export Seçenekleri */}
        {filteredData.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    </span>
                    Rapor Export İşlemleri
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Filtrelenmiş verileri Excel veya PDF formatında indirebilirsiniz
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={exportToExcel}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    Excel İndir
                    <span className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
                      {filteredData.length} kayıt
                    </span>
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    PDF Yazdır
                    <span className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
                      {filteredData.length} kayıt
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-gray-600">Excel: 2 sheet (Veri + Filtre Bilgileri)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-gray-600">PDF: Yazdırma optimizasyonlu</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-gray-600">Filtreler: Tüm aktif filtreler dahil</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              {animationData && (
                <div className="w-24 h-24 mb-4">
                  <Lottie animationData={animationData} loop={true} />
                </div>
              )}
              <p className="text-gray-600 font-medium">Hareket görmeyen cariler yükleniyor...</p>
            </div>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cari Kodu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cari Adı
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son Hareket Tarihi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Son İşlem Türü
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 2
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 3
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 4
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Özel Kod 5
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Yetki Kodu
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.CODE}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.DEFINITION_}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {row['Son Hareket Tarihi'] ? 
                          new Date(row['Son Hareket Tarihi']).toLocaleDateString('tr-TR') : 
                          <span className="text-gray-400 italic">Hiç hareket yok</span>
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {row['Son İşlem Türü'] && !row['Son İşlem Türü'].startsWith('TRCODE:') ? 
                          row['Son İşlem Türü'] : 
                          <span className="text-gray-400 italic">-</span>
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 1']}</div>
                          {row['Ozel Kod 1 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 1 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 2']}</div>
                          {row['Ozel Kod 2 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 2 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 3']}</div>
                          {row['Ozel Kod 3 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 3 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 4']}</div>
                          {row['Ozel Kod 4 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 4 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Ozel Kod 5']}</div>
                          {row['Ozel Kod 5 Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Ozel Kod 5 Açıklama']}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{row['Yetki Kodu']}</div>
                          {row['Yetki Kodu Açıklama'] && (
                            <div className="text-xs text-gray-400">{row['Yetki Kodu Açıklama']}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Sayfalama ve Özet Bilgi */}
            {filteredData.length > 0 && (
              <div className="bg-white border-t px-4 py-3 flex items-center justify-between sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sonraki
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{startItem}</span> - <span className="font-medium">{endItem}</span> arası, 
                      toplam <span className="font-medium">{filteredData.length}</span> kayıt
                    </p>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-700">Sayfa başına:</label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">İlk sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Önceki sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {/* Sayfa numaraları */}
                      {(() => {
                        const pages = [];
                        const showRange = 2; // Her iki tarafta gösterilecek sayfa sayısı
                        let startPage = Math.max(1, currentPage - showRange);
                        let endPage = Math.min(totalPages, currentPage + showRange);
                        
                        // İlk sayfalar
                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              onClick={() => setCurrentPage(1)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(
                              <span key="start-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            );
                          }
                        }
                        
                        // Orta sayfalar
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                i === currentPage
                                  ? 'z-10 bg-red-50 border-red-500 text-red-600'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Son sayfalar
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="end-ellipsis" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            );
                          }
                          pages.push(
                            <button
                              key={totalPages}
                              onClick={() => setCurrentPage(totalPages)}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {totalPages}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Sonraki sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Son sayfa</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm-6 0a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : hasFetched ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="text-center">
              <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {data.length > 0 ? 'Filtre sonucu kayıt bulunamadı' : 'Hareket görmeyen cari bulunamadı'}
              </h3>
              <p className="text-gray-500">
                {data.length > 0 
                  ? 'Filtreleri değiştirip tekrar deneyin veya filtreleri temizleyin'
                  : 'Seçilen kriterlere göre hareket görmeyen cari bulunmuyor'
                }
              </p>
            </div>
          </div>
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