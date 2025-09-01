'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import DatePicker from '../components/DatePicker';
import MalzemeDetayModal from '../components/MalzemeDetayModal';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import { trackReportView, trackReportGeneration } from '../utils/yandex-metrica';

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
  
  // Animation data'ları yükleyelim
  const [animationData, setAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Rapor parametreleri
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState(formatDateToYMD(new Date()));
  const [selectedTedarikci, setSelectedTedarikci] = useState<string>('');
  
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
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        trackReportView('tedarikci_bazli_malzeme');
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
        const companyRef = localStorage.getItem('companyRef');
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
          console.log('✅ Connection bilgileri zaten mevcut (Tedarikçi Bazlı Malzeme)');
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
        console.log('🔄 Connection bilgileri önceden yükleniyor (Tedarikçi Bazlı Malzeme)...');
        const connectionResponse = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const connectionData = await connectionResponse.json();

        if (connectionResponse.ok && connectionData.status === 'success' && connectionData.data) {
          localStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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

      console.log(`🔄 Firma No: ${firmaNo}, Dönem No: ${donemNo} ile tedarikçi malzeme verileri çekiliyor...`);

      const sqlQuery = `
        SELECT DISTINCT
          I.LOGICALREF as [Malzeme LogicalRef],
          I.CODE as [Malzeme Kodu],
          I.NAME as [Malzeme Adı]
        FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_STLINE S
        LEFT JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I ON S.STOCKREF = I.LOGICALREF
        WHERE S.CLIENTREF = '${selectedTedarikci}' 
          AND S.LINETYPE = 0
        ORDER BY I.CODE
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
        trackReportGeneration('tedarikci_bazli_malzeme', result.results.length, totalAmount);
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
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

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

  // Arama fonksiyonu
  useEffect(() => {
    if (!searchTerm) {
      setFilteredData(data);
    } else {
      const filtered = data.filter(item =>
        item['Malzeme Kodu'].toLowerCase().includes(searchTerm.toLowerCase()) ||
        item['Malzeme Adı'].toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    }
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
                <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-white">Tedarikçi Bazlı Malzeme Raporu</h2>
                <p className="text-red-100 text-sm">
                  Toplam Tedarikçi: {cariHesaplar.length} | Yüklenen: {filteredCariHesaplar.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tedarikçi Seçimi */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600">👥</span>
                </div>
                Tedarikçi Cari Hesapları
              </h3>
              {hasFetched && (
                <button
                  onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>{isFilterCollapsed ? 'Genişlet' : 'Küçült'}</span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isFilterCollapsed ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isFilterCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'
          }`}>
            <div className="p-6">
                        {/* Arama Kutusu */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Tedarikçi Ara ({cariHesaplar.length} adet)
              </label>
              <input
                type="text"
                placeholder="Tedarikçi kodu veya adı ile arayın..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm shadow-sm transition-all duration-200"
                onChange={(e) => {
                  const searchTerm = e.target.value.toLowerCase().trim();
                  if (searchTerm === '') {
                    setFilteredCariHesaplar([]); // Boş arama yapıldığında liste gizlensin
                  } else {
                    const filtered = cariHesaplar.filter(cari => {
                      const code = cari.code.toLowerCase();
                      const definition = cari.definition.toLowerCase();
                      const normalizedSearchTerm = searchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      const normalizedCode = code.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      const normalizedDefinition = definition.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      
                      return normalizedCode.includes(normalizedSearchTerm) || 
                             normalizedDefinition.includes(normalizedSearchTerm) ||
                             code.includes(searchTerm) || 
                             definition.includes(searchTerm);
                    });
                    setFilteredCariHesaplar(filtered);
                  }
                }}
              />
            </div>
            
            {/* Tedarikçi Listesi */}
            {filteredCariHesaplar.length > 0 && (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredCariHesaplar.map((cari) => (
                  <div 
                    key={cari.logicalRef}
                    onClick={() => setSelectedTedarikci(cari.logicalRef.toString())}
                    className={`p-4 bg-white border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedTedarikci === cari.logicalRef.toString()
                        ? 'border-red-500 bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                        selectedTedarikci === cari.logicalRef.toString()
                          ? 'border-red-500 bg-red-500 shadow-md'
                          : 'border-gray-300'
                      }`}>
                        {selectedTedarikci === cari.logicalRef.toString() && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-bold text-gray-900 bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-1 rounded-lg shadow-sm">
                            {cari.code}
                          </span>
                          <h3 className="text-sm font-medium text-gray-900">
                            {cari.definition}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Seçim Bilgisi */}
            {selectedTedarikci && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <span>✅</span>
                  <span>
                    Seçili Tedarikçi: {
                      cariHesaplar.find(c => c.logicalRef.toString() === selectedTedarikci)?.definition || 'Bilinmeyen'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Tarih Seçimi */}
            <div className="mt-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-500 rounded-full"></span>
                Tarih Aralığı
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Başlangıç Tarihi</label>
                  <DatePicker 
                    value={startDate}
                    onChange={(date) => setStartDate(date)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Bitiş Tarihi</label>
                  <DatePicker 
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                  />
                </div>
              </div>
            </div>

            {/* Raporu Getir Butonu */}
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Tedarikçi Bazlı Malzeme Raporu</h3>
                  <p className="text-sm text-gray-500">Tedarikçilerinizden aldığınız malzemeleri analiz edin</p>
                  {selectedTedarikci && (
                    <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                      <span>🔍</span>
                      Seçili tedarikçi filtresi uygulanacak
                    </p>
                  )}
                </div>
                <button
                  onClick={handleFetchReport}
                  disabled={loading || !selectedTedarikci}
                  className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
          </div>
        </div>
        </div>

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
            
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                                    <thead className="bg-gradient-to-r from-green-50 to-green-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          Malzeme Kodu
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          Malzeme Adı
                        </th>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900 bg-gradient-to-r from-blue-100 to-blue-200 px-3 py-1 rounded-lg shadow-sm">
                          {item['Malzeme Kodu']}
                        </span>
                      </td>
                                              <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {item['Malzeme Adı']}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedMalzemeForDetail({
                                kodu: item['Malzeme Kodu'],
                                adi: item['Malzeme Adı'],
                                itemRef: item['Malzeme LogicalRef'].toString() // LogicalRef'i string olarak gönder
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
                      {Math.min(indexOfLastItem, data.length)}
                    </span>
                    {' / '}
                    <span className="font-medium">{data.length}</span>
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
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </DashboardLayout>
  );
}
