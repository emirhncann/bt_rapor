'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import MalzemeDetayModal from '../components/MalzemeDetayModal';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import { useColumnPreferences } from '../hooks/useColumnPreferences';
import ColumnManager from '../components/ColumnManager';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';

const COLUMN_DEFS = [
  { key: 'Malzeme Kodu', label: 'Malzeme Kodu', defaultVisible: true },
  { key: 'Malzeme Adı',  label: 'Malzeme Adı',  defaultVisible: true },
];

// Yardımcı fonksiyon: Date'i 'YYYY-MM-DD' formatına çevir
function formatDateToYMD(date: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

interface CariHesap {
  logicalRef: number;
  code: string;
  definition: string;
  specode?: string;
  specodeDefinition?: string;
  specode2?: string;
  specode2Definition?: string;
  specode3?: string;
  specode3Definition?: string;
  specode4?: string;
  specode4Definition?: string;
  specode5?: string;
  specode5Definition?: string;
  taxNumber?: string;
  phone1?: string;
  phone2?: string;
  faxNumber?: string;
  emailAddress?: string;
  address1?: string;
  address2?: string;
  city?: string;
  country?: string;
  postCode?: string;
}

interface TedarikciMalzeme {
  'Malzeme LogicalRef': number;
  'Malzeme Kodu': string;
  'Malzeme Adı': string;
  'Toplam Miktar'?: number;
  'Toplam Tutar'?: number;
  'Son Alış Tarihi'?: string;
  'Son Alış Fiyatı'?: number;
  'Ortalama Fiyat'?: number;
}

export default function TedarikciMalzemeRaporu() {
  const [data, setData] = useState<TedarikciMalzeme[]>([]);
  const [cariHesaplar, setCariHesaplar] = useState<CariHesap[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCariHesaplar, setLoadingCariHesaplar] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  
  const router = useRouter();

  const { orderedColumns, toggle, reorder, showAll, hideAll } = useColumnPreferences(
    'tedarikci-bazli-malzeme',
    COLUMN_DEFS
  );
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Rapor parametreleri
  const [startDate, setStartDate] = useState(formatDateToYMD(new Date()));
  const [endDate, setEndDate] = useState(formatDateToYMD(new Date()));
  const [selectedTedarikci, setSelectedTedarikci] = useState<string>('');
  
  // ReportFilterPanel state
  const [filterValues, setFilterValues] = useState<FilterValues>({
    dateRange: { start: startDate, end: endDate },
    tedarikci: selectedTedarikci,
  });

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    if (key === 'dateRange') {
      const dr = value as DateRangeValue;
      if (dr.start) setStartDate(dr.start);
      if (dr.end) setEndDate(dr.end);
    } else if (key === 'tedarikci') {
      setSelectedTedarikci((value as string) ?? '');
    }
  };

  const handleFilterReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today); setEndDate(today);
    setSelectedTedarikci('');
    setFilterValues({ dateRange: { start: today, end: today }, tedarikci: '' });
  };

  const handleApplyFilters = async () => {
    await fetchReportData();
    setHasFetched(true);
    setCurrentPage(1);
  };
  
  // Arama ve filtreleme
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState<TedarikciMalzeme[]>([]);
  const [filteredCariHesaplar, setFilteredCariHesaplar] = useState<CariHesap[]>([]);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedMalzemeForDetail, setSelectedMalzemeForDetail] = useState<{
    kodu: string;
    adi: string;
    itemRef: string;
  } | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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
        console.log('🔍 Tedarikçi Bazlı Malzeme - Rapor erişim yetkisi kontrol ediliyor...');
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
        
        // Tedarikçi bazlı malzeme raporu için genel envanter yetkisini kontrol et
        const tedarikciRaporu = allReports.find(report => 
          report.route === 'tedarikci-bazli-malzeme' ||
          report.route_path === '/tedarikci-bazli-malzeme' ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('tedarikçi') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('malzeme') ||
          report.report_name.toLocaleLowerCase('tr-TR').includes('envanter') // Genel envanter yetkisi
        );
        
        if (!tedarikciRaporu) {
          console.log('❌ Tedarikçi bazlı malzeme raporu şirketin paketinde bulunmuyor');
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        // API'den gelen yetki kontrolü
        const hasTedarikciAccess = tedarikciRaporu.has_access;
        
        console.log('📊 Tedarikçi bazlı malzeme raporu şirket paketinde:', !!tedarikciRaporu);
        console.log('🔐 Tedarikçi bazlı malzeme raporu erişim yetkisi:', hasTedarikciAccess);
        
        setHasAccess(hasTedarikciAccess);
        
        // Eğer erişim yoksa kullanıcıyı dashboard'a yönlendir
        if (!hasTedarikciAccess) {
          console.log('❌ Tedarikçi bazlı malzeme raporu erişimi reddedildi - dashboard\'a yönlendiriliyor');
          router.push('/?error=access_denied&report=tedarikci-bazli-malzeme');
          return;
        }

      } catch (error) {
        console.error('❌ Tedarikçi Bazlı Malzeme - Rapor erişimi kontrol edilirken hata:', error);
        setHasAccess(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkReportAccess();
  }, []);

  // Sync filterValues when startDate, endDate, or selectedTedarikci change externally
  useEffect(() => {
    setFilterValues(prev => ({
      ...prev,
      dateRange: { start: startDate, end: endDate },
      tedarikci: selectedTedarikci,
    }));
  }, [startDate, endDate, selectedTedarikci]);

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
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      if (cachedConnectionInfo) {
        try {
          JSON.parse(cachedConnectionInfo);
          console.log('✅ Connection bilgileri zaten mevcut (Tedarikçi Bazlı Malzeme)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Tedarikçi Bazlı Malzeme)...');
        const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
          console.log('💾 Connection bilgileri önceden yüklendi ve kaydedildi (Tedarikçi Bazlı Malzeme)');
        } else {
          console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', connectionData);
        }
      } catch (error) {
        console.log('⚠️ Connection bilgileri önceden yüklenirken hata:', error);
      }
    };

    preloadConnectionInfo();
  }, [isAuthenticated]);

  // Cari hesapları çek (sayfa yüklenirken otomatik)
  useEffect(() => {
    const fetchCariHesaplarOnLoad = async () => {
      if (!isAuthenticated || !hasAccess || isCheckingAccess) return;
      
      console.log('🔄 Cari hesaplar yükleniyor...');
      setLoadingCariHesaplar(true);
      
      try {
        const companyRef = sessionStorage.getItem('companyRef');
        if (!companyRef) {
          showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
          return;
        }

        // Connection bilgilerini al
        let connectionInfo;
        const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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
        
        console.log(`🔄 Firma No: ${firmaNo} ile cari hesaplar çekiliyor...`);

        // Tedarikçi cari hesapları özel kodları ile beraber çek
        const sqlQuery = `
          SELECT 
            C.LOGICALREF as logicalRef,
            C.CODE as code,
            C.DEFINITION_ as definition,
            C.SPECODE as specode,
            S1.DEFINITION_ as specodeDefinition,
            C.SPECODE2 as specode2,
            S2.DEFINITION_ as specode2Definition,
            C.SPECODE3 as specode3,
            S3.DEFINITION_ as specode3Definition,
            C.SPECODE4 as specode4,
            S4.DEFINITION_ as specode4Definition,
            C.SPECODE5 as specode5,
            S5.DEFINITION_ as specode5Definition
           
          FROM LG_${firmaNo.padStart(3, '0')}_CLCARD C
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S1 ON C.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S2 ON C.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S3 ON C.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S4 ON C.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1
          LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S5 ON C.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1
          WHERE C.ACTIVE = 0 -- Aktif olanlar
          ORDER BY C.CODE
        `;

        console.log('🔍 Cari Hesaplar SQL Sorgusu:');
        console.log(sqlQuery);
        console.log('📊 Bağlantı Bilgileri:', connectionInfo);

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
          let errorMessage = 'Cari hesaplar alınamadı';
          try {
            const errorData = await response.json();
            console.error('❌ Cari hesaplar API hatası:', errorData);
            errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
          } catch (e) {
            const errorText = await response.text();
            console.error('❌ Cari hesaplar API ham hata:', errorText);
            errorMessage = 'Sunucu yanıtı işlenemedi';
          }
          showErrorMessage(errorMessage);
          return;
        }

        const result = await response.json();
        
        if (result.results && Array.isArray(result.results)) {
          setCariHesaplar(result.results);
          setFilteredCariHesaplar([]); // Başlangıçta boş olsun
          console.log('✅ Cari hesaplar başarıyla yüklendi');
          console.log('📊 Toplam tedarikçi sayısı:', result.results.length);
        } else if (result.data && Array.isArray(result.data)) {
          setCariHesaplar(result.data);
          setFilteredCariHesaplar([]); // Başlangıçta boş olsun
          console.log('✅ Cari hesaplar başarıyla yüklendi (alternatif format)');
        } else {
          console.error('❌ Cari hesaplar API yanıtı geçersiz format:', result);
          showErrorMessage('Sunucu yanıtı geçersiz formatta');
        }

      } catch (error: any) {
        console.error('❌ Cari hesaplar çekilirken hata:', error);
        
        if (error.name === 'AbortError') {
          showErrorMessage('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
        } else if (error.message?.includes('Failed to fetch')) {
          showErrorMessage('Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.');
        } else {
          showErrorMessage('Cari hesaplar alınırken bir hata oluştu. Lütfen tekrar deneyin.');
        }
      } finally {
        setLoadingCariHesaplar(false);
      }
    };

    fetchCariHesaplarOnLoad();
  }, [isAuthenticated, hasAccess, isCheckingAccess]);

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



  // Rapor verilerini çek
  const fetchReportData = async () => {
    console.log('🔄 Tedarikçi bazlı malzeme verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Connection bilgilerini al
      let connectionInfo;
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile tedarikçi malzeme verileri çekiliyor...`);

      const sqlQuery = `
        SELECT DISTINCT
          I.LOGICALREF as [Malzeme LogicalRef],
          I.CODE as [Malzeme Kodu],
          I.NAME as [Malzeme Adı]
        FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_STLINE S
        LEFT JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I ON S.STOCKREF = I.LOGICALREF
        WHERE S.CLIENTREF = '${selectedTedarikci}' 
          AND S.LINETYPE = 0 AND S.TRCODE=1        ORDER BY I.CODE
      `;

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
        let errorMessage = 'Tedarikçi malzeme verileri alınamadı';
        try {
          const errorData = await response.json();
          console.error('❌ Tedarikçi malzeme API hatası:', errorData);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('❌ Tedarikçi malzeme API ham hata:', errorText);
          errorMessage = 'Sunucu yanıtı işlenemedi';
        }
        showErrorMessage(errorMessage);
        return;
      }

      const result = await response.json();
      
      if (result.results && Array.isArray(result.results)) {
        setData(result.results);
        setFilteredData(result.results);
        console.log('✅ Tedarikçi bazlı malzeme verileri başarıyla yüklendi');
        console.log('📊 Toplam kayıt sayısı:', result.results.length);
        
        // Rapor oluşturma tracking
        const totalAmount = result.results.reduce((sum: number, item: any) => 
          sum + (parseFloat(item['Toplam Tutar']) || 0), 0);
      } else if (result.data && Array.isArray(result.data)) {
        setData(result.data);
        setFilteredData(result.data);
        console.log('✅ Tedarikçi bazlı malzeme verileri başarıyla yüklendi (alternatif format)');
      } else {
        console.error('❌ API yanıtı geçersiz format:', result);
        showErrorMessage('Sunucu yanıtı geçersiz formatta');
      }

    } catch (error: any) {
      console.error('❌ Tedarikçi bazlı malzeme verileri çekilirken hata:', error);
      
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

  // Pagination hesaplamaları
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Sayfa değiştirme fonksiyonları
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // İlk sayfaya dön
  };

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    await fetchReportData();
    setHasFetched(true);
    setIsFilterCollapsed(true); // Filtre kısmını küçült
    setCurrentPage(1); // İlk sayfaya dön
  };

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchReportData();
      setHasFetched(true);
      setIsFilterCollapsed(true);
      setCurrentPage(1);
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      showErrorMessage('Cache temizlenirken bir hata oluştu!');
    }
  };

  // Arama fonksiyonu
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data);
    } else {
      const normalizedSearchTerm = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filtered = data.filter(item => {
        const normalizedCode = item['Malzeme Kodu'].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const normalizedName = item['Malzeme Adı'].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        return normalizedCode.includes(normalizedSearchTerm) || 
               normalizedName.includes(normalizedSearchTerm) ||
               item['Malzeme Kodu'].toLowerCase().includes(searchTerm.toLowerCase()) ||
               item['Malzeme Adı'].toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredData(filtered);
    }
    // Arama yapıldığında ilk sayfaya dön
    setCurrentPage(1);
  }, [searchTerm, data]);

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <DashboardLayout title="Tedarikçi Bazlı Malzeme Raporu">
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
    <DashboardLayout title="Tedarikçi Bazlı Malzeme Raporu">
      <div className="space-y-6 overflow-visible">
        {/* FULL-BLEED WRAPPER for hero */}
        <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 mb-5">
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-16 -right-16 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-violet-700/10 rounded-full blur-2xl" />
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
                  <div className="w-11 h-11 bg-violet-500/20 border border-violet-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-bold text-white">Tedarikçi Bazlı Malzeme</h1>
                      <span className="hidden sm:inline text-xs font-semibold bg-violet-500/20 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full">Satın Alma</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {cariHesaplar.length > 0 ? `${cariHesaplar.length} tedarikçi` : 'Tedarikçi bazlı malzeme analizi'}
                    </p>
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER PANEL */}
        <ReportFilterPanel
          filters={[
            {
              type: 'dateRange',
              id: 'dateRange',
              presets: ['today', 'thisWeek', 'thisMonth', 'lastMonth'],
            },
            {
              type: 'select',
              id: 'tedarikci',
              label: 'Tedarikçi',
              options: cariHesaplar.map(c => ({ value: c.logicalRef.toString(), label: `${c.code} - ${c.definition}` })),
              placeholder: 'Tedarikçi seçin',
              searchable: true,
              clearable: true,
            },
          ]}
          values={filterValues}
          onChange={handleFilterChange}
          onApply={handleApplyFilters}
          onReset={handleFilterReset}
          loading={loading}
        />

        {/* Malzeme Tablosu */}
        {hasFetched && data.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600">📦</span>
                </div>
                Tedarikçi Malzemeleri
                <span className="text-sm font-normal text-gray-500">
                  ({data.length} malzeme)
                </span>
              </h3>
            </div>
            
            {/* Malzeme Arama Kutusu */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Malzeme Ara
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Malzeme kodu veya adı ile arayın..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm shadow-sm transition-all duration-200"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Arama Sonuçları, Temizleme ve Kolon Yönetimi */}
                <div className="flex items-center gap-3">
                  {searchTerm && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{filteredData.length}</span> sonuç bulundu
                    </div>
                  )}
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Temizle
                    </button>
                  )}
                  <ColumnManager
                    orderedColumns={orderedColumns}
                    columnDefs={COLUMN_DEFS}
                    onToggle={toggle}
                    onReorder={reorder}
                    onShowAll={showAll}
                    onHideAll={hideAll}
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-green-50 to-green-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          #
                        </th>
                        {orderedColumns.filter(c => c.visible).map(col => (
                          <th key={col.key} className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                            {COLUMN_DEFS.find(d => d.key === col.key)?.label ?? col.key}
                          </th>
                        ))}
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          İşlemler
                        </th>
                      </tr>
                    </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentItems.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {indexOfFirstItem + index + 1}
                      </td>
                      {orderedColumns.filter(c => c.visible).map(col => (
                        <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                          {col.key === 'Malzeme Kodu' ? (
                            <span className="text-sm font-bold text-gray-900 bg-gradient-to-r from-blue-100 to-blue-200 px-3 py-1 rounded-lg shadow-sm">
                              {item['Malzeme Kodu']}
                            </span>
                          ) : col.key === 'Malzeme Adı' ? (
                            <div className="text-sm font-medium text-gray-900">
                              {item['Malzeme Adı']}
                            </div>
                          ) : null}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedMalzemeForDetail({
                              kodu: item['Malzeme Kodu'],
                              adi: item['Malzeme Adı'],
                              itemRef: item['Malzeme LogicalRef'].toString()
                            });
                            setIsDetailModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all duration-200"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Kontrolleri */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                {/* Sol taraf - Sayfa bilgisi ve items per page */}
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{indexOfFirstItem + 1}</span>
                    {' - '}
                    <span className="font-medium">
                      {Math.min(indexOfLastItem, filteredData.length)}
                    </span>
                    {' / '}
                    <span className="font-medium">{filteredData.length}</span>
                    {' malzeme'}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Sayfa başına:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
                
                {/* Sağ taraf - Sayfa navigasyonu */}
                <div className="flex items-center gap-2">
                  {/* İlk sayfa */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    İlk
                  </button>
                  
                  {/* Önceki sayfa */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  
                  {/* Sayfa numaraları */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            currentPage === pageNumber
                              ? 'bg-red-500 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Sonraki sayfa */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                  
                  {/* Son sayfa */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Son
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sonuç Bilgisi */}
        {hasFetched && data.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <span>✅</span>
              <span className="font-medium">
                {data.length} malzeme başarıyla getirildi
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

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              {animationData && (
                <div className="w-24 h-24 mb-4">
                  <Lottie animationData={animationData} loop={true} />
                </div>
              )}
              <p className="text-gray-600 font-medium">Tedarikçi malzeme verileri yükleniyor...</p>
            </div>
          </div>
        )}
      </div>

      {/* Malzeme Detay Modal */}
      {selectedMalzemeForDetail && (
        <MalzemeDetayModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedMalzemeForDetail(null);
          }}
          malzemeKodu={selectedMalzemeForDetail.kodu}
          malzemeAdi={selectedMalzemeForDetail.adi}
          itemRef={selectedMalzemeForDetail.itemRef}
          clientRef={selectedTedarikci || ''}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </DashboardLayout>
  );
}
