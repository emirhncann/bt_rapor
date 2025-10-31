'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import YemekKartiSatisTable from '../components/tables/YemekKartiSatisTable';
import HataliKayitlarTable from '../components/tables/HataliKayitlarTable';
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

// DD/MM/YYYY formatında tarih oluştur (görüntü için)
function formatToDisplay(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// DD/MM/YYYY formatını YYYY-MM-DD'ye çevir (SQL için)
function convertDisplayToSQL(displayDate: string): string {
  if (displayDate.includes('/')) {
    const [dd, mm, yyyy] = displayDate.split('/');
    if (dd && mm && yyyy && yyyy.length === 4) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return displayDate;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState(''); // Hızlı tarih seçenekleri için
  const [selectedSubeler, setSelectedSubeler] = useState<number[]>([]); // Çoklu şube seçimi
  const [subeler, setSubeler] = useState<{value: number, label: string}[]>([]);
  const [loadingSubeler, setLoadingSubeler] = useState(false);
  const [showSubeDropdown, setShowSubeDropdown] = useState(false);
  const [expandedZRaporu, setExpandedZRaporu] = useState<string | null>(null);

  // Akordiyon state'leri
  const [accordionState, setAccordionState] = useState({
    fisTipiAnalizi: true,    // Fiş Tipi Analizi varsayılan olarak açık
    yemekKartiTurleri: false,
    subePerformansi: false,
    zRaporu: false,
    tablo: false,
    hataliKayitlar: false
  });

  // Akordiyon toggle fonksiyonu
  const toggleAccordion = (section: keyof typeof accordionState) => {
    const newState = !accordionState[section];
    setAccordionState(prev => ({
      ...prev,
      [section]: newState
    }));
    // Akordiyon açma/kapama tracking
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        // Sayfa görüntülendiğinde tracking
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
        const companyRef = sessionStorage.getItem('companyRef');
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
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
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
      const companyRef = sessionStorage.getItem('companyRef');
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
          sessionStorage.setItem('connectionInfo', JSON.stringify(connectionData.data));
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

  // Tarih preset'lerini ayarla
  const setDatePresetRange = (preset: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();

    let start: Date;
    let end: Date;

    switch (preset) {
      case 'today':
        start = new Date(year, month, date, 0, 0, 0, 0);
        end = new Date(year, month, date, 23, 59, 59, 999);
        break;
      case 'yesterday':
        start = new Date(year, month, date - 1, 0, 0, 0, 0);
        end = new Date(year, month, date - 1, 23, 59, 59, 999);
        break;
      case 'thisWeek':
        const dayOfWeek = today.getDay();
        const startOfWeek = date - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Pazartesi başlangıcı
        start = new Date(year, month, startOfWeek, 0, 0, 0, 0);
        end = new Date(year, month, startOfWeek + 6, 23, 59, 59, 999);
        break;
      case 'thisMonth':
        start = new Date(year, month, 1, 0, 0, 0, 0);
        end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Ayın son günü
        break;
      case 'lastMonth':
        start = new Date(year, month - 1, 1, 0, 0, 0, 0);
        end = new Date(year, month, 0, 23, 59, 59, 999); // Geçen ayın son günü
        break;
      default:
        return;
    }

    const startDisplay = formatToDisplay(start);
    const endDisplay = formatToDisplay(end);
    
    console.log(`${preset} seçildi:`, {
      start: start.toDateString() + ' ' + start.toTimeString(),
      end: end.toDateString() + ' ' + end.toTimeString(),
      startDisplay,
      endDisplay
    });
    
    setStartDate(startDisplay);
    setEndDate(endDisplay);
    setDatePreset(preset);
    
    // Tarih filtresi tracking
  };

  // Şubeleri yükle (diğer raporlar gibi direkt ENPOS'tan)
  const fetchSubeler = async () => {
    console.log('🚀 fetchSubeler çağrıldı');
    setLoadingSubeler(true);
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      console.log('📋 CompanyRef:', companyRef);
      
      if (!companyRef) {
        console.warn('⚠️ CompanyRef bulunamadı, şubeler yüklenemedi');
        showErrorMessage('Şirket bilgisi bulunamadı');
        return;
      }

      // Connection bilgilerini al
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      if (!cachedConnectionInfo) {
        console.warn('⚠️ Connection bilgileri bulunamadı');
        showErrorMessage('Bağlantı bilgileri bulunamadı');
        return;
      }

      const connectionInfo = JSON.parse(cachedConnectionInfo);
      const logoKurulumDbName = connectionInfo.logoKurulumDbName || 'GO3';
      const firmaNo = connectionInfo.firmaNo || 9;

      console.log('🏢 Şubeler ENPOS ciro tablosundan yükleniyor...');
      console.log('📊 ENPOS DB Key kullanılıyor: enpos_db_key');
      console.log('🏭 Logo Kurulum DB:', logoKurulumDbName, 'Firma No:', firmaNo);

      // ENPOS ciro tablosundan şubeleri çek - daha basit sorgu
      const subeQuery = `
        SELECT 
          value,
          label
        FROM (
          SELECT DISTINCT 
            D.NR as value,
            RIGHT(D.NAME,LEN(D.NAME)-CHARINDEX('-',D.NAME)) as label
          FROM ${logoKurulumDbName}..L_CAPIDIV D 
          WHERE D.FIRMNR=${firmaNo} 
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

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = async () => {
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      
      // Connection info cache'ini temizle
      sessionStorage.removeItem('connectionInfo');
      
      console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
      await fetchYemekKartiData();
      
    } catch (error) {
      console.error('❌ Cache temizlenirken hata:', error);
      showErrorMessage('Cache temizlenirken bir hata oluştu!');
    }
  };

  // Yemek kartı satış verilerini çek (diğer raporlar gibi direkt ENPOS'tan)
  const fetchYemekKartiData = async () => {
    console.log('🔄 Yemek kartı satış verileri çekiliyor...');
    setLoading(true);
    setShowError(false);
    
    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Connection bilgilerini al
      const cachedConnectionInfo = sessionStorage.getItem('connectionInfo');
      if (!cachedConnectionInfo) {
        showErrorMessage('Bağlantı bilgileri bulunamadı');
        return;
      }

      const connectionInfo = JSON.parse(cachedConnectionInfo);
      const logoKurulumDbName = connectionInfo.logoKurulumDbName || 'GO3';
      const firmaNo = connectionInfo.firmaNo || 9;
      const enposDatabaseName = connectionInfo.enpos_database_name || 'INTER_BOS';

      console.log(`🔄 Tarih: ${startDate} - ${endDate}, Şubeler: ${selectedSubeler.join(', ')} ile yemek kartı verileri çekiliyor...`);
      console.log(`📅 SQL Tarih Dönüşümü: ${convertDisplayToSQL(startDate)} - ${convertDisplayToSQL(endDate)}`);
      console.log('🏭 Logo Kurulum DB:', logoKurulumDbName, 'Firma No:', firmaNo, 'ENPOS DB:', enposDatabaseName);

      // ENPOS veritabanı için SQL sorgusu
      const sqlQuery = `
        SELECT DISTINCT
          B.BELGETARIH as Tarih,
          b.Sube_No as 'Şube No',
          B.Sicil_No,
          B.Z_No,
          b.belge_no,
          B.Belge_Alttipi,
          T.NAME as 'Fiş Tipi',
          RIGHT(D.NAME,LEN(D.NAME)-CHARINDEX('-',D.NAME)) as 'Şube',
          O.Tus_No,
          CASE O.Tus_No 
            WHEN 0 THEN 'Nakit' 
            ELSE K.Info 
          END AS 'Yemek Kartı',
          CAST(SUM(O.TUTAR) AS decimal(18,2)) as Tutar
        FROM ${enposDatabaseName}..ODEME O
        JOIN ${enposDatabaseName}..BELGE B ON B.Belge_ID=O.Belge_ID
        LEFT JOIN ${enposDatabaseName}..[POS_KREDI] K ON O.Tus_No=K.Tus_No
        JOIN ${logoKurulumDbName}..L_CAPIDIV D ON B.Sube_No=D.NR AND D.FIRMNR=${firmaNo}
        LEFT JOIN ${enposDatabaseName}..[SERVER_TICKETFIRM] T ON B.Belge_AltTipi=T.FIRMNO
        WHERE B.Iptal=0 
          AND b.Belge_Tipi='YMK'
          AND CAST(B.BELGETARIH AS DATE) BETWEEN '${convertDisplayToSQL(startDate)}' AND '${convertDisplayToSQL(endDate)}'
          AND B.Sube_No IN (${selectedSubeler.join(',')})
        GROUP BY 
          B.BELGETARIH,
          b.Sube_No,
          B.Sicil_No,
          B.Z_No,
          b.belge_no,
          B.Belge_Alttipi,
          T.NAME,
          D.NAME,
          K.Tus_No,
          O.Tus_No,
          K.Info
        ORDER BY B.BELGETARIH DESC
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
      
      // Rapor oluşturma tracking
      const totalAmount = data.reduce((sum: number, item: any) => sum + (parseFloat(item.Tutar) || 0), 0);

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
      const newSelection = prev.includes(subeValue) 
        ? prev.filter(s => s !== subeValue)
        : [...prev, subeValue];
      
      // Şube seçimi tracking
      const selectedBranchNames = newSelection.map(id => 
        subeler.find(s => s.value === id)?.label || `Şube ${id}`
      );
      
      return newSelection;
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

  // Uyumsuzluk kontrol fonksiyonu
  const checkUyumsuzluk = (fisType: string, odemeYontemi: string): boolean => {
    // Fiş tipi ile ödeme yöntemi uyumsuzluğu kontrolü
    const uyumsuzluklar = [
      // Nakit ödeme yöntemi olduğunda, fiş tipi de NAKIT olmalı
      { fisType: 'SETCARD', odemeYontemi: 'Nakit' },
      { fisType: 'SETCARD POS', odemeYontemi: 'Nakit' },
      { fisType: 'SETCART', odemeYontemi: 'Nakit' },
      { fisType: 'SETCART POS', odemeYontemi: 'Nakit' },
      { fisType: 'MULTINET', odemeYontemi: 'Nakit' },
      { fisType: 'MULTINET POS', odemeYontemi: 'Nakit' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'Nakit' },
      { fisType: 'TOKENFLEX POS', odemeYontemi: 'Nakit' },
      { fisType: 'SODEXO', odemeYontemi: 'Nakit' },
      { fisType: 'SODEXO POS', odemeYontemi: 'Nakit' },
      { fisType: 'TICKET', odemeYontemi: 'Nakit' },
      { fisType: 'TICKET POS', odemeYontemi: 'Nakit' },
      { fisType: 'METROPOL', odemeYontemi: 'Nakit' },
      { fisType: 'METROPOL POS', odemeYontemi: 'Nakit' },
      { fisType: 'IWALLET', odemeYontemi: 'Nakit' },
      { fisType: 'IWALLET POS', odemeYontemi: 'Nakit' },
      // Nakit fiş tipi olup kart ödemesi yapılanlar da uyumsuz
      { fisType: 'NAKIT', odemeYontemi: 'MULTINET' },
      { fisType: 'NAKIT', odemeYontemi: 'MULTINET POS' },
      { fisType: 'NAKIT', odemeYontemi: 'SETCARD' },
      { fisType: 'NAKIT', odemeYontemi: 'SETCARD POS' },
      { fisType: 'NAKIT', odemeYontemi: 'SETCART' },
      { fisType: 'NAKIT', odemeYontemi: 'SETCART POS' },
      { fisType: 'NAKIT', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'NAKIT', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'NAKIT', odemeYontemi: 'SODEXO' },
      { fisType: 'NAKIT', odemeYontemi: 'SODEXO POS' },
      { fisType: 'NAKIT', odemeYontemi: 'TICKET' },
      { fisType: 'NAKIT', odemeYontemi: 'TICKET POS' },
      { fisType: 'NAKIT', odemeYontemi: 'METROPOL' },
      { fisType: 'NAKIT', odemeYontemi: 'METROPOL POS' },
      { fisType: 'NAKIT', odemeYontemi: 'IWALLET' },
      { fisType: 'NAKIT', odemeYontemi: 'IWALLET POS' },
      // Farklı kart türleri arası uyumsuzluklar
      { fisType: 'SODEXO', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'SODEXO', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'SODEXO', odemeYontemi: 'SETCARD' },
      { fisType: 'SODEXO', odemeYontemi: 'SETCARD POS' },
      { fisType: 'SODEXO', odemeYontemi: 'SETCART' },
      { fisType: 'SODEXO', odemeYontemi: 'SETCART POS' },
      { fisType: 'SODEXO', odemeYontemi: 'MULTINET' },
      { fisType: 'SODEXO', odemeYontemi: 'MULTINET POS' },
      { fisType: 'SODEXO', odemeYontemi: 'TICKET' },
      { fisType: 'SODEXO', odemeYontemi: 'TICKET POS' },
      { fisType: 'SODEXO', odemeYontemi: 'METROPOL' },
      { fisType: 'SODEXO', odemeYontemi: 'METROPOL POS' },
      { fisType: 'SODEXO', odemeYontemi: 'IWALLET' },
      { fisType: 'SODEXO', odemeYontemi: 'IWALLET POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SODEXO' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SODEXO POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SETCARD' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SETCARD POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SETCART' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'SETCART POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'MULTINET' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'MULTINET POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'TICKET' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'TICKET POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'METROPOL' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'METROPOL POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'IWALLET' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'IWALLET POS' },
      { fisType: 'SETCARD', odemeYontemi: 'SODEXO' },
      { fisType: 'SETCARD', odemeYontemi: 'SODEXO POS' },
      { fisType: 'SETCARD', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'SETCARD', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'SETCARD', odemeYontemi: 'MULTINET' },
      { fisType: 'SETCARD', odemeYontemi: 'MULTINET POS' },
      { fisType: 'SETCARD', odemeYontemi: 'TICKET' },
      { fisType: 'SETCARD', odemeYontemi: 'TICKET POS' },
      { fisType: 'SETCARD', odemeYontemi: 'METROPOL' },
      { fisType: 'SETCARD', odemeYontemi: 'METROPOL POS' },
      { fisType: 'SETCARD', odemeYontemi: 'IWALLET' },
      { fisType: 'SETCARD', odemeYontemi: 'IWALLET POS' },
      { fisType: 'MULTINET', odemeYontemi: 'SODEXO' },
      { fisType: 'MULTINET', odemeYontemi: 'SODEXO POS' },
      { fisType: 'MULTINET', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'MULTINET', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'MULTINET', odemeYontemi: 'SETCARD' },
      { fisType: 'MULTINET', odemeYontemi: 'SETCARD POS' },
      { fisType: 'MULTINET', odemeYontemi: 'SETCART' },
      { fisType: 'MULTINET', odemeYontemi: 'SETCART POS' },
      { fisType: 'MULTINET', odemeYontemi: 'TICKET' },
      { fisType: 'MULTINET', odemeYontemi: 'TICKET POS' },
      { fisType: 'MULTINET', odemeYontemi: 'METROPOL' },
      { fisType: 'MULTINET', odemeYontemi: 'METROPOL POS' },
      { fisType: 'MULTINET', odemeYontemi: 'IWALLET' },
      { fisType: 'MULTINET', odemeYontemi: 'IWALLET POS' },
      { fisType: 'TICKET', odemeYontemi: 'SODEXO' },
      { fisType: 'TICKET', odemeYontemi: 'SODEXO POS' },
      { fisType: 'TICKET', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'TICKET', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'TICKET', odemeYontemi: 'SETCARD' },
      { fisType: 'TICKET', odemeYontemi: 'SETCARD POS' },
      { fisType: 'TICKET', odemeYontemi: 'SETCART' },
      { fisType: 'TICKET', odemeYontemi: 'SETCART POS' },
      { fisType: 'TICKET', odemeYontemi: 'MULTINET' },
      { fisType: 'TICKET', odemeYontemi: 'MULTINET POS' },
      { fisType: 'TICKET', odemeYontemi: 'METROPOL' },
      { fisType: 'TICKET', odemeYontemi: 'METROPOL POS' },
      { fisType: 'TICKET', odemeYontemi: 'IWALLET' },
      { fisType: 'TICKET', odemeYontemi: 'IWALLET POS' },
      { fisType: 'METROPOL', odemeYontemi: 'SODEXO' },
      { fisType: 'METROPOL', odemeYontemi: 'SODEXO POS' },
      { fisType: 'METROPOL', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'METROPOL', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'METROPOL', odemeYontemi: 'SETCARD' },
      { fisType: 'METROPOL', odemeYontemi: 'SETCARD POS' },
      { fisType: 'METROPOL', odemeYontemi: 'SETCART' },
      { fisType: 'METROPOL', odemeYontemi: 'SETCART POS' },
      { fisType: 'METROPOL', odemeYontemi: 'MULTINET' },
      { fisType: 'METROPOL', odemeYontemi: 'MULTINET POS' },
      { fisType: 'METROPOL', odemeYontemi: 'TICKET' },
      { fisType: 'METROPOL', odemeYontemi: 'TICKET POS' },
      { fisType: 'METROPOL', odemeYontemi: 'IWALLET' },
      { fisType: 'METROPOL', odemeYontemi: 'IWALLET POS' },
      { fisType: 'IWALLET', odemeYontemi: 'SODEXO' },
      { fisType: 'IWALLET', odemeYontemi: 'SODEXO POS' },
      { fisType: 'IWALLET', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'IWALLET', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'IWALLET', odemeYontemi: 'SETCARD' },
      { fisType: 'IWALLET', odemeYontemi: 'SETCARD POS' },
      { fisType: 'IWALLET', odemeYontemi: 'SETCART' },
      { fisType: 'IWALLET', odemeYontemi: 'SETCART POS' },
      { fisType: 'IWALLET', odemeYontemi: 'MULTINET' },
      { fisType: 'IWALLET', odemeYontemi: 'MULTINET POS' },
      { fisType: 'IWALLET', odemeYontemi: 'TICKET' },
      { fisType: 'IWALLET', odemeYontemi: 'TICKET POS' },
      { fisType: 'IWALLET', odemeYontemi: 'METROPOL' },
      { fisType: 'IWALLET', odemeYontemi: 'METROPOL POS' },
      // SETCART'ın diğer kart türleri ile uyumsuzlukları
      { fisType: 'SETCART', odemeYontemi: 'SODEXO' },
      { fisType: 'SETCART', odemeYontemi: 'SODEXO POS' },
      { fisType: 'SETCART', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'SETCART', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'SETCART', odemeYontemi: 'MULTINET' },
      { fisType: 'SETCART', odemeYontemi: 'MULTINET POS' },
      { fisType: 'SETCART', odemeYontemi: 'TICKET' },
      { fisType: 'SETCART', odemeYontemi: 'TICKET POS' },
      { fisType: 'SETCART', odemeYontemi: 'METROPOL' },
      { fisType: 'SETCART', odemeYontemi: 'METROPOL POS' },
      { fisType: 'SETCART', odemeYontemi: 'IWALLET' },
      { fisType: 'SETCART', odemeYontemi: 'IWALLET POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'SODEXO' },
      { fisType: 'SETCART POS', odemeYontemi: 'SODEXO POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'SETCART POS', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'MULTINET' },
      { fisType: 'SETCART POS', odemeYontemi: 'MULTINET POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'TICKET' },
      { fisType: 'SETCART POS', odemeYontemi: 'TICKET POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'METROPOL' },
      { fisType: 'SETCART POS', odemeYontemi: 'METROPOL POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'IWALLET' },
      { fisType: 'SETCART POS', odemeYontemi: 'IWALLET POS' }
    ];
    
    // Debug için log - sadece uyumsuzluk durumunda
    // console.log('🔍 Uyumsuzluk kontrolü:', { fisType, odemeYontemi });
    
    // Önce uyumluluk kontrolü yap - aynı türde olanlar uyumlu
    const fisTypeUpper = (fisType || null)?.toString()?.toUpperCase() || '';
    const odemeYontemiUpper = (odemeYontemi || null)?.toString()?.toUpperCase() || '';
    
    // Sadece tam eşleşen kombinasyonlar uyumlu
    const uyumluKombinasyonlar = [
      // Nakit ödemesi için sadece NAKIT fiş tipi uyumlu
      { fisType: 'NAKIT', odemeYontemi: 'Nakit' },
      // Kart türleri için uyumlu kombinasyonlar
      { fisType: 'TICKET', odemeYontemi: 'TICKET' },
      { fisType: 'TICKET', odemeYontemi: 'TICKET POS' },
      { fisType: 'TICKET POS', odemeYontemi: 'TICKET' },
      { fisType: 'TICKET POS', odemeYontemi: 'TICKET POS' },
      { fisType: 'SODEXO', odemeYontemi: 'SODEXO' },
      { fisType: 'SODEXO', odemeYontemi: 'SODEXO POS' },
      { fisType: 'SODEXO POS', odemeYontemi: 'SODEXO' },
      { fisType: 'SODEXO POS', odemeYontemi: 'SODEXO POS' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'TOKENFLEX', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'TOKENFLEX POS', odemeYontemi: 'TOKENFLEX' },
      { fisType: 'TOKENFLEX POS', odemeYontemi: 'TOKENFLEX POS' },
      { fisType: 'SETCARD', odemeYontemi: 'SETCARD' },
      { fisType: 'SETCARD', odemeYontemi: 'SETCARD POS' },
      { fisType: 'SETCARD POS', odemeYontemi: 'SETCARD' },
      { fisType: 'SETCARD POS', odemeYontemi: 'SETCARD POS' },
      { fisType: 'SETCART', odemeYontemi: 'SETCART' },
      { fisType: 'SETCART', odemeYontemi: 'SETCART POS' },
      { fisType: 'SETCART POS', odemeYontemi: 'SETCART' },
      { fisType: 'SETCART POS', odemeYontemi: 'SETCART POS' },
      { fisType: 'MULTINET', odemeYontemi: 'MULTINET' },
      { fisType: 'MULTINET', odemeYontemi: 'MULTINET POS' },
      { fisType: 'MULTINET POS', odemeYontemi: 'MULTINET' },
      { fisType: 'MULTINET POS', odemeYontemi: 'MULTINET POS' },
      { fisType: 'METROPOL', odemeYontemi: 'METROPOL' },
      { fisType: 'METROPOL', odemeYontemi: 'METROPOL POS' },
      { fisType: 'METROPOL POS', odemeYontemi: 'METROPOL' },
      { fisType: 'METROPOL POS', odemeYontemi: 'METROPOL POS' },
      { fisType: 'IWALLET', odemeYontemi: 'IWALLET' },
      { fisType: 'IWALLET', odemeYontemi: 'IWALLET POS' },
      { fisType: 'IWALLET POS', odemeYontemi: 'IWALLET' },
      { fisType: 'IWALLET POS', odemeYontemi: 'IWALLET POS' }
    ];
    
    // Önce uyumlu kombinasyonları kontrol et - sadece tam eşleşme
    const isUyumlu = uyumluKombinasyonlar.some(u => {
      const fisMatch = fisTypeUpper === ((u.fisType || null)?.toString()?.toUpperCase() || '');
      const odemeMatch = odemeYontemiUpper === ((u.odemeYontemi || null)?.toString()?.toUpperCase() || '');
      
      // if (fisMatch && odemeMatch) {
      //   console.log('✅ Uyumlu kombinasyon bulundu:', { fisType, odemeYontemi, rule: u });
      // }
      
      return fisMatch && odemeMatch;
    });
    
          if (isUyumlu) {
        // console.log('✅ Uyumlu kombinasyon:', { fisType, odemeYontemi });
        return false; // Uyumlu ise uyumsuz değil
      }
    
    // Uyumsuzluk kontrolü
    const isUyumsuz = uyumsuzluklar.some(u => {
      // Fiş tipi tam eşleşmesi kontrolü
      const fisTypeMatch = fisTypeUpper === u.fisType || 
                          (fisTypeUpper && u.fisType && fisTypeUpper.includes(u.fisType)) && 
                          !fisTypeUpper.includes('POS') && 
                          !fisTypeUpper.includes('KART');
      
      // Ödeme yöntemi tam eşleşmesi kontrolü - Nakit için daha esnek kontrol
      const odemeMatch = odemeYontemiUpper === u.odemeYontemi || 
                        (u.odemeYontemi === 'Nakit' && odemeYontemiUpper && odemeYontemiUpper.includes('NAKIT'));
      
      if (fisTypeMatch && odemeMatch) {
        console.log('🚨 Uyumsuzluk bulundu:', { fisType, odemeYontemi, rule: u });
      }
      
      return fisTypeMatch && odemeMatch;
    });
    
    return isUyumsuz;
  };

  // Hatalı kayıtları filtrele
  const hataliKayitlar = data.filter(kayit => {
    return checkUyumsuzluk(kayit['Fiş Tipi'], kayit['Yemek Kartı']);
  });

  // Hata analizi tracking (sadece hata varsa)
  useEffect(() => {
    if (hataliKayitlar.length > 0) {
      const totalErrorAmount = hataliKayitlar.reduce((sum, item) => sum + (parseFloat(item.Tutar) || 0), 0);
    }
  }, [hataliKayitlar.length]);

  // İstatistik hesaplama fonksiyonları
  const calculateStats = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        totalAmount: 0,
        totalTransactions: 0,
        cardTypes: [],
        branches: [],
        fisTypes: []
      };
    }

    let totalAmount = 0;
    const cardTypeStats: { [key: string]: { count: number, amount: number } } = {};
    const branchStats: { [key: string]: { count: number, amount: number } } = {};
    const fisTypeStats: { [key: string]: { 
      count: number, 
      amount: number, 
      uyumsuzCount: number, 
      uyumsuzAmount: number,
      uyumsuzDetay: string[]
    } } = {};
    
    data.forEach(item => {
      const amount = parseFloat(item.Tutar) || 0;
      totalAmount += amount;
      
      // Fiş tipi istatistikleri
      const fisType = item['Fiş Tipi'] || 'Bilinmeyen';
      const odemeYontemi = item['Yemek Kartı'] || 'Bilinmeyen';
      
      if (!fisTypeStats[fisType]) {
        fisTypeStats[fisType] = { 
          count: 0, 
          amount: 0, 
          uyumsuzCount: 0, 
          uyumsuzAmount: 0,
          uyumsuzDetay: []
        };
      }
      fisTypeStats[fisType].count += 1;
      fisTypeStats[fisType].amount += amount;
      
      // Uyumsuzluk kontrolü
      const isUyumsuz = checkUyumsuzluk(fisType, odemeYontemi);
      if (isUyumsuz) {
        fisTypeStats[fisType].uyumsuzCount += 1;
        fisTypeStats[fisType].uyumsuzAmount += amount;
        fisTypeStats[fisType].uyumsuzDetay.push(`${odemeYontemi} ödeme`);
        console.log('🚨 Uyumsuzluk tespit edildi:', { 
          fisType, 
          odemeYontemi, 
          amount,
          currentUyumsuzCount: fisTypeStats[fisType].uyumsuzCount,
          currentUyumsuzAmount: fisTypeStats[fisType].uyumsuzAmount,
          uyumsuzDetay: fisTypeStats[fisType].uyumsuzDetay
        });
      }
      
      // Debug için sadece uyumsuz kayıtları logla
      if (isUyumsuz) {
        console.log('🔍 Uyumsuz kayıt:', { 
          fisType, 
          odemeYontemi, 
          amount,
          fisTypeUpper: (fisType || null)?.toString()?.toUpperCase() || '',
          odemeYontemiUpper: (odemeYontemi || null)?.toString()?.toUpperCase() || ''
        });
      }
      
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

    // Fiş tiplerini tutara göre sırala
    const sortedFisTypes = Object.entries(fisTypeStats)
      .map(([name, stats]) => ({ 
        name, 
        ...stats,
        uyumsuzOrani: stats.count > 0 ? ((stats.uyumsuzCount / stats.count) * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.amount - a.amount);

    // Debug: Toplam uyumsuzluk sayılarını logla
    console.log('📊 Toplam Uyumsuzluk Özeti:');
    sortedFisTypes.forEach(fisType => {
      if (fisType.uyumsuzCount > 0) {
        console.log(`  ${fisType.name}: ${fisType.uyumsuzCount} işlem / ${fisType.uyumsuzAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`);
        console.log(`    Detay: ${fisType.uyumsuzDetay.join(', ')}`);
      }
    });

    // En çok kullanılan kartları sırala
    const sortedCardTypes = Object.entries(cardTypeStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount);

    // Şubeleri tutara göre sırala
    const sortedBranches = Object.entries(branchStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.amount - a.amount);

    // Z Raporu istatistikleri - Sicil No ve Z No'ya göre grupla
    const zRaporuStats: { [key: string]: { 
      sicilNo: string, 
      zNo: string, 
      count: number, 
      amount: number,
      subeler: Set<string>,
      fisTipleri: Set<string>,
      yemekKartlari: Set<string>,
      firstDate: string,
      lastDate: string,
      fisTipiDetay: { [key: string]: { count: number, amount: number } },
      yemekKartiDetay: { [key: string]: { count: number, amount: number } }
    } } = {};
    
    data.forEach(item => {
      const sicilNo = item.Sicil_No || 'Bilinmeyen';
      const zNo = item.Z_No || 'Bilinmeyen';
      const key = `${sicilNo}_${zNo}`;
      const amount = parseFloat(item.Tutar) || 0;
      const tarih = item.Tarih || '';
      const fisType = item['Fiş Tipi'] || 'Bilinmeyen';
      const yemekKarti = item['Yemek Kartı'] || 'Bilinmeyen';
      
      if (!zRaporuStats[key]) {
        zRaporuStats[key] = { 
          sicilNo, 
          zNo, 
          count: 0, 
          amount: 0,
          subeler: new Set(),
          fisTipleri: new Set(),
          yemekKartlari: new Set(),
          firstDate: tarih,
          lastDate: tarih,
          fisTipiDetay: {},
          yemekKartiDetay: {}
        };
      }
      
      zRaporuStats[key].count += 1;
      zRaporuStats[key].amount += amount;
      zRaporuStats[key].subeler.add(item['Şube'] || 'Bilinmeyen');
      zRaporuStats[key].fisTipleri.add(fisType);
      zRaporuStats[key].yemekKartlari.add(yemekKarti);
      
      // Fiş tipi detayları
      if (!zRaporuStats[key].fisTipiDetay[fisType]) {
        zRaporuStats[key].fisTipiDetay[fisType] = { count: 0, amount: 0 };
      }
      zRaporuStats[key].fisTipiDetay[fisType].count += 1;
      zRaporuStats[key].fisTipiDetay[fisType].amount += amount;
      
      // Yemek kartı detayları
      if (!zRaporuStats[key].yemekKartiDetay[yemekKarti]) {
        zRaporuStats[key].yemekKartiDetay[yemekKarti] = { count: 0, amount: 0 };
      }
      zRaporuStats[key].yemekKartiDetay[yemekKarti].count += 1;
      zRaporuStats[key].yemekKartiDetay[yemekKarti].amount += amount;
      
      // Tarih karşılaştırması için
      if (tarih && (!zRaporuStats[key].firstDate || tarih < zRaporuStats[key].firstDate)) {
        zRaporuStats[key].firstDate = tarih;
      }
      if (tarih && (!zRaporuStats[key].lastDate || tarih > zRaporuStats[key].lastDate)) {
        zRaporuStats[key].lastDate = tarih;
      }
    });

    // Z raporlarını tutara göre sırala
    const sortedZRaporlari = Object.entries(zRaporuStats)
      .map(([key, stats]) => ({ 
        key,
        ...stats,
        subeListesi: Array.from(stats.subeler).join(', '),
        fisTipiListesi: Array.from(stats.fisTipleri).join(', '),
        yemekKartiListesi: Array.from(stats.yemekKartlari).join(', ')
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalAmount,
      totalTransactions: data.length,
      cardTypes: sortedCardTypes,
      branches: sortedBranches,
      fisTypes: sortedFisTypes,
      zRaporlari: sortedZRaporlari
    };
  };

  const stats = calculateStats();

  // Raporu getir butonu handler
  const handleFetchReport = async () => {
    // Validation
    if (!startDate) {
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
                  Toplam Kayıt: {data.length} | Seçili Tarih: {startDate} | 
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
                  onClick={clearCacheAndReload}
                  disabled={loading}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="Cache'i temizle ve yeni veri getir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Yeniden Yükle
                </button>
                <button
                  onClick={handleFetchReport}
                  disabled={loading}
                  className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
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
                  {/* Tarih Aralığı */}
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
                  </div>
                  
                  {/* Hızlı Tarih Seçenekleri */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">⚡ Hızlı Seçim</label>
                      {startDate && endDate && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                          📅 {startDate} - {endDate}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDatePresetRange('today')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          datePreset === 'today'
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                        }`}
                      >
                        📅 Bugün
                      </button>
                      <button
                        onClick={() => setDatePresetRange('yesterday')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          datePreset === 'yesterday'
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                        }`}
                      >
                        📅 Dün
                      </button>
                      <button
                        onClick={() => setDatePresetRange('thisWeek')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          datePreset === 'thisWeek'
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                        }`}
                      >
                        📅 Bu Hafta
                      </button>
                      <button
                        onClick={() => setDatePresetRange('thisMonth')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          datePreset === 'thisMonth'
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                        }`}
                      >
                        📅 Bu Ay
                      </button>
                      <button
                        onClick={() => setDatePresetRange('lastMonth')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          datePreset === 'lastMonth'
                            ? 'bg-blue-600 text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                        }`}
                      >
                        📅 Geçen Ay
                      </button>
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
                    <div className="text-sm font-medium text-purple-600">Fiş Tipi Sayısı</div>
                    <div className="text-2xl font-bold text-purple-900">{stats.fisTypes?.length || 0}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-orange-600">Aktif Şube</div>
                    <div className="text-2xl font-bold text-orange-900">{stats.branches.length}</div>
                  </div>
                </div>

                {/* Fiş Tipi İstatistikleri - Akordiyon */}
                {stats.fisTypes && stats.fisTypes.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => toggleAccordion('fisTipiAnalizi')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                          <span className="text-white text-lg">🎫</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">Fiş Tipi Analizi</h4>
                        <span className="text-sm text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
                          {stats.fisTypes.length} fiş tipi
                        </span>
                      </div>
                      <svg 
                        className={`w-6 h-6 text-indigo-600 transition-transform duration-200 ${accordionState.fisTipiAnalizi ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {accordionState.fisTipiAnalizi && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                      {stats.fisTypes.map((fisType, index) => {
                        // Fiş tiplerine farklı renkler atayalım
                        const colors = [
                          'from-indigo-500 to-indigo-600',
                          'from-cyan-500 to-cyan-600', 
                          'from-emerald-500 to-emerald-600',
                          'from-amber-500 to-amber-600',
                          'from-rose-500 to-rose-600',
                          'from-violet-500 to-violet-600',
                          'from-sky-500 to-sky-600',
                          'from-lime-500 to-lime-600'
                        ];
                        const colorClass = colors[index % colors.length];
                        
                        // Uyumsuzluk oranına göre uyarı rengi
                        const uyumsuzOrani = parseFloat(fisType.uyumsuzOrani);
                        const warningColor = uyumsuzOrani > 20 ? 'text-red-600' : uyumsuzOrani > 10 ? 'text-orange-600' : 'text-green-600';
                        const warningIcon = uyumsuzOrani > 20 ? '⚠️' : uyumsuzOrani > 10 ? '⚡' : '✅';
                        
                        return (
                          <div key={fisType.name} className="relative overflow-hidden bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className={`h-2 bg-gradient-to-r ${colorClass}`}></div>
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-3">
                                <div className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center shadow-lg`}>
                                  <span className="text-white font-bold text-lg">#{index + 1}</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Fiş Tipi
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {fisType.count} işlem
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
                                  {fisType.name}
                                </h3>
                                <div className="text-2xl font-bold text-gray-900">
                                  {fisType.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </div>
                              </div>
                              

                              
                              {/* Uyumsuzluk detayı */}
                              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                <div className="text-xs text-gray-600 mb-1">Uyumsuzluk Detayı:</div>
                                <div className="text-sm font-medium text-gray-900">
                                  {fisType.uyumsuzCount} işlem / {fisType.uyumsuzAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                </div>
                                {fisType.uyumsuzDetay.length > 0 && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {fisType.uyumsuzDetay.slice(0, 2).join(', ')}
                                    {fisType.uyumsuzDetay.length > 2 && '...'}
                                  </div>
                                )}
                              </div>
                              
                              {/* Progress bar - toplam tutara göre */}
                              <div className="mt-4">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>Toplam payı</span>
                                  <span>{((fisType.amount / stats.totalAmount) * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                                    style={{ width: `${(fisType.amount / stats.totalAmount) * 100}%` }}
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
                  </div>
                )}

                {/* Yemek Kartı Türleri - Akordiyon */}
                {stats.cardTypes && stats.cardTypes.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => toggleAccordion('yemekKartiTurleri')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                          <span className="text-white text-lg">🍽️</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">Yemek Kartı Türleri (Ödeme Yöntemleri)</h4>
                        <span className="text-sm text-purple-600 bg-purple-100 px-2 py-1 rounded-md">
                          {stats.cardTypes.length} kart türü
                        </span>
                      </div>
                      <svg 
                        className={`w-6 h-6 text-purple-600 transition-transform duration-200 ${accordionState.yemekKartiTurleri ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {accordionState.yemekKartiTurleri && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
                  </div>
                )}

                {/* Şube Performansı Detay - Akordiyon */}
                {stats.branches && stats.branches.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => toggleAccordion('subePerformansi')}
                      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                          <span className="text-white text-lg">🏢</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">Şube Performansı</h4>
                        <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-md">
                          {stats.branches.length} şube
                        </span>
                      </div>
                      <svg 
                        className={`w-6 h-6 text-green-600 transition-transform duration-200 ${accordionState.subePerformansi ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {accordionState.subePerformansi && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
              </div>
            )}

            {/* Z Raporu Analizi - Akordiyon */}
            {stats.zRaporlari && stats.zRaporlari.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => toggleAccordion('zRaporu')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl hover:from-yellow-100 hover:to-yellow-200 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white text-lg">📋</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Z Raporu Analizi</h4>
                    <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded-md">
                      {stats.zRaporlari.length} Z raporu
                    </span>
                  </div>
                  <svg 
                    className={`w-6 h-6 text-yellow-600 transition-transform duration-200 ${accordionState.zRaporu ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {accordionState.zRaporu && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-yellow-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Detay
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Sicil No
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Z No
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                İşlem Sayısı
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Toplam Tutar
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Şubeler
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-yellow-700 uppercase tracking-wider">
                                Tarih Aralığı
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {stats.zRaporlari.map((zRapor, index) => (
                              <React.Fragment key={zRapor.key}>
                                <tr className={index % 2 === 0 ? 'bg-white' : 'bg-yellow-25'}>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                    <button
                                      onClick={() => setExpandedZRaporu(expandedZRaporu === zRapor.key ? null : zRapor.key)}
                                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full hover:bg-yellow-200 transition-colors"
                                    >
                                      {expandedZRaporu === zRapor.key ? '🔽 Gizle' : '🔍 Detay'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {zRapor.sicilNo}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {zRapor.zNo}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {zRapor.count} işlem
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {zRapor.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                    <div className="truncate" title={zRapor.subeListesi}>
                                      {zRapor.subeListesi.length > 50 ? zRapor.subeListesi.substring(0, 50) + '...' : zRapor.subeListesi}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="text-xs">
                                      <div>{zRapor.firstDate ? new Date(zRapor.firstDate).toLocaleDateString('tr-TR') : '-'}</div>
                                      {zRapor.firstDate !== zRapor.lastDate && (
                                        <div className="text-gray-500">→ {zRapor.lastDate ? new Date(zRapor.lastDate).toLocaleDateString('tr-TR') : '-'}</div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Detay Satırı */}
                                {expandedZRaporu === zRapor.key && (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-4 bg-gradient-to-r from-yellow-25 to-yellow-50">
                                      <div className="space-y-6">
                                        {/* Fiş Tipi Detayları */}
                                        <div>
                                          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="text-blue-600">🎫</span>
                                            Fiş Tipi Analizi
                                          </h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.entries(zRapor.fisTipiDetay).map(([fisType, detay]) => (
                                              <div key={fisType} className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                                                <div className="font-medium text-sm text-gray-900 mb-1">{fisType}</div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                  <div>İşlem: {detay.count}</div>
                                                  <div className="font-semibold text-blue-600">
                                                    {detay.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    %{((detay.amount / zRapor.amount) * 100).toFixed(1)}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        {/* Yemek Kartı Detayları */}
                                        <div>
                                          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <span className="text-green-600">🍽️</span>
                                            Yemek Kartı Analizi
                                          </h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.entries(zRapor.yemekKartiDetay).map(([kartType, detay]) => (
                                              <div key={kartType} className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                                                <div className="font-medium text-sm text-gray-900 mb-1">{kartType}</div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                  <div>İşlem: {detay.count}</div>
                                                  <div className="font-semibold text-green-600">
                                                    {detay.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    %{((detay.amount / zRapor.amount) * 100).toFixed(1)}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Z Raporu Özet İstatistikleri */}
                      <div className="bg-yellow-50 px-4 py-3 border-t border-yellow-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-yellow-700 font-medium">
                            Toplam {stats.zRaporlari.length} farklı Z raporu
                          </span>
                          <span className="text-yellow-600">
                            Toplam Tutar: {stats.zRaporlari.reduce((sum, z) => sum + z.amount, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ana Tablo - Akordiyon */}
            <div className="mb-6">
              <button
                onClick={() => toggleAccordion('tablo')}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white text-lg">📊</span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900">Detaylı Tablo</h4>
                  <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                    {data.length} kayıt
                  </span>
                </div>
                <svg 
                  className={`w-6 h-6 text-blue-600 transition-transform duration-200 ${accordionState.tablo ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {accordionState.tablo && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white rounded-lg shadow">
                    <YemekKartiSatisTable 
                      data={data}
                      stats={stats}
                      currentUser={getCurrentUser()}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hatalı Kayıtlar Tablosu - Akordiyon */}
            {hataliKayitlar.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => toggleAccordion('hataliKayitlar')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white text-lg">⚠️</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Hatalı Kayıtlar</h4>
                    <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded-md">
                      {hataliKayitlar.length} hatalı kayıt
                    </span>
                  </div>
                  <svg 
                    className={`w-6 h-6 text-red-600 transition-transform duration-200 ${accordionState.hataliKayitlar ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {accordionState.hataliKayitlar && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <HataliKayitlarTable 
                      data={hataliKayitlar}
                      currentUser={getCurrentUser()}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
