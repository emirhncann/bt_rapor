'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import Lottie from 'lottie-react';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';

export default function Settings() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [userRole, setUserRole] = useState('');
  const [showAnimation, setShowAnimation] = useState<'success' | 'failed' | null>(null);
  const [animationData, setAnimationData] = useState(null);
  const [animationMessage, setAnimationMessage] = useState('');
  const [subUsers, setSubUsers] = useState<Array<{id: number, name: string, role: string}>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: number, name: string} | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  
  // Akaryakıt modülü ayarları (dinamik liste)
  type FuelSetting = {
    id: string;
    stationName: string;
    automationName: string;
    filePath: string;
    onlineFilePath: string;
  };
  const [fuelSettings, setFuelSettings] = useState<FuelSetting[]>([]);
  
  // Rapor yetkilendirme states
  const [companyReports, setCompanyReports] = useState<any[]>([]);
  const [userReportPermissions, setUserReportPermissions] = useState<{[userId: number]: number[]}>({});
  const [loadingReports, setLoadingReports] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    newUserName: '',
    newUserEmail: '',
    newUserPassword: '',
    externalIP: '',
    servicePort: '45678',
    endpoint: '',
    logoKurulumDbName: '',
    hasMarketModule: false,
    databases: [
      {
        id: 1,
        firmaNo: '',
        donemNo: '',
        dbHost: '',
        dbName: '',
        dbUser: '',
        dbPassword: '',
        useSameDb: false,
        isCurrent: true
      },
      {
        id: 2,
        firmaNo: '',
        donemNo: '',
        dbHost: '',
        dbName: '',
        dbUser: '',
        dbPassword: '',
        useSameDb: false,
        isCurrent: false
      },
      {
        id: 3,
        firmaNo: '',
        donemNo: '',
        dbHost: '',
        dbName: '',
        dbUser: '',
        dbPassword: '',
        useSameDb: false,
        isCurrent: false
      }
    ],
    // ENPOS özel alanları
    enposFirmaNo: '',
    enposDonemNo: '',
    enposDbHost: '',
    enposDbName: '',
    enposDbUser: '',
    enposDbPassword: ''
  });
  const router = useRouter();

  // IP adresini maskeleme fonksiyonu
  const maskIPAddress = (ip: string) => {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;
    return `${parts[0]}.***.***.${parts[3]}`;
  };

  // Port numarasını maskeleme fonksiyonu
  const maskPort = (port: string) => {
    if (!port || port.length < 3) return port;
    if (port.length === 3) return `${port[0]}*${port[2]}`;
    if (port.length === 4) return `${port[0]}**${port[3]}`;
    return `${port[0]}***${port[port.length - 1]}`;
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const role = localStorage.getItem('userRole');
      
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        setUserRole(role || '');
        // Admin ise alt kullanıcıları yükle
        if (role === 'admin') {
          fetchSubUsers();
          loadCompanyReports();
        }
        // Database ayarlarını yükle
        loadDatabaseSettings();
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Akaryakıt modülü ayarlarını yükle (localStorage - şirket bazlı)
  const loadFuelSettings = () => {
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) return;
      const key = `fuel_module_settings_${companyRef}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as FuelSetting[];
        if (Array.isArray(parsed)) {
          setFuelSettings(parsed.map((item) => ({
            id: String(item.id ?? `${Date.now()}_${Math.random().toString(36).slice(2,8)}`),
            stationName: item.stationName ?? '',
            automationName: item.automationName ?? '',
            filePath: item.filePath ?? '',
            onlineFilePath: item.onlineFilePath ?? ''
          })));
        }
      }
    } catch (e) {
      console.warn('Akaryakıt ayarları yüklenemedi:', e);
    }
  };

  // İlk render sonrası akaryakıt ayarlarını da getir
  useEffect(() => {
    // Auth state set edildikten sonra çalışması yeterli
    if (typeof window !== 'undefined') {
      loadFuelSettings();
    }
  }, []);

  // Şirket raporlarını yükle
  const loadCompanyReports = async () => {
    try {
      setLoadingReports(true);
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        return;
      }

      const response = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
      const data = await response.json();

      if (data.status === 'success' && data.data) {
        setCompanyReports(data.data);
        
        // Mevcut kullanıcı izinlerini yükle
        if (subUsers.length > 0) {
          loadUserPermissions();
        }
      }
    } catch (error) {
      console.error('Raporlar yüklenirken hata:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // Kullanıcı izinlerini yükle
  const loadUserPermissions = async () => {
    const permissions: {[userId: number]: number[]} = {};
    
    for (const user of subUsers) {
      try {
        const response = await fetch(`https://api.btrapor.com/user-report-permissions/${user.id}`);
        const data = await response.json();
        
        if (data.status === 'success') {
          permissions[user.id] = data.data.map((p: any) => p.report_id);
        } else {
          permissions[user.id] = [];
        }
      } catch (error) {
        permissions[user.id] = [];
      }
    }
    
    setUserReportPermissions(permissions);
  };

  // Kullanıcı rapor izni değiştir
  const toggleUserReportPermission = async (userId: number, reportId: number) => {
    const currentPermissions = userReportPermissions[userId] || [];
    const hasPermission = currentPermissions.includes(reportId);
    
    try {
      const action = hasPermission ? 'remove' : 'add';
      const response = await fetch(`https://api.btrapor.com/user-report-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          report_id: reportId,
          action: action
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Local state'i güncelle
        setUserReportPermissions(prev => ({
          ...prev,
          [userId]: hasPermission 
            ? currentPermissions.filter(id => id !== reportId)
            : [...currentPermissions, reportId]
        }));
        
        await loadAnimation('success', `Kullanıcı yetkileri güncellendi`);
      } else {
        await loadAnimation('failed', 'Yetki güncellenirken hata oluştu');
      }
    } catch (error) {
      console.error('Yetki güncellenirken hata:', error);
      await loadAnimation('failed', 'Yetki güncellenirken hata oluştu');
    }
  };

  // Alt kullanıcıları getir
  const fetchSubUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        return;
      }

      const response = await fetch(`https://api.btrapor.com/users-by-company/${companyRef}`);
      const data = await response.json();

      console.log('API Response:', data); // Debug için

      if (response.ok && data.status === 'success') {
        console.log('Users data:', data.data); // Debug için
        setSubUsers(data.data || []);
        
        // Raporlar yüklenmişse izinleri de yükle
        if (companyReports.length > 0) {
          loadUserPermissions();
        }
      }
    } catch (error) {
      // Sessizce hata yönet
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Database ayarlarını yükle
  const loadDatabaseSettings = async () => {
    try {
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        console.log('Company ref bulunamadı');
        return;
      }

      

              const response = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
      const data = await response.json();

      console.log('📦 Database Settings Response:', data);
      console.log('📊 Connection Info Detail:', data.data);

      if (response.ok && data.status === 'success' && data.data) {
        const connectionInfo = data.data;
        
        // public_ip'den IP ve port'u ayır (örn: "178.233.252.90:45678")
        let externalIP = '';
        let servicePort = '45678'; // Varsayılan port
        
        let endpoint = '';
        if (connectionInfo.public_ip) {
          // IP:Port/Endpoint formatından ayır
          const parts = connectionInfo.public_ip.split(':');
          if (parts.length >= 2) {
            externalIP = parts[0] || '';
            const portAndEndpoint = parts[1] || '';
            
            // Port ve endpoint'i ayır (ilk sayısal kısım port)
            const portMatch = portAndEndpoint.match(/^(\d+)/);
            servicePort = portMatch ? portMatch[1] : '45678';
            
            // Endpoint kısmını al (port'tan sonraki kısım)
            endpoint = portAndEndpoint.replace(/^\d+/, '');
            console.log('🌐 IP ayırımı:', { ip: externalIP, port: servicePort, endpoint });
          }
        }
        
        // FormData'yı güncelle - API'den gelen değerleri direkt kullan
        console.log('🔧 Database ayarları işleniyor...');
        console.log('📊 İlk DB Bilgileri:', {
          firma: connectionInfo.first_firma_no,
          donem: connectionInfo.first_donem_no,
          host: connectionInfo.first_server_name,
          db: connectionInfo.first_db_name,
          user: connectionInfo.first_username
        });
        
        // Market modülü değerini localStorage'a kaydet
        const marketModuleValue = connectionInfo.market_module === 1 || connectionInfo.market_module === true;
        localStorage.setItem('market_module', marketModuleValue ? '1' : '0');
        console.log('💾 Market modülü localStorage\'a kaydedildi:', marketModuleValue ? '1' : '0');

        setFormData(prev => ({
          ...prev,
          externalIP,
          servicePort,
          endpoint: endpoint || '',
          logoKurulumDbName: connectionInfo.logoKurulumDbName || '',
          hasMarketModule: marketModuleValue,
          databases: [
            {
              ...prev.databases[0],
              firmaNo: connectionInfo.first_firma_no || '',
              donemNo: connectionInfo.first_donem_no || '',
              dbHost: connectionInfo.first_server_name || '',
              dbName: connectionInfo.first_db_name || '',
              dbUser: connectionInfo.first_username || '',
              dbPassword: connectionInfo.first_password || ''
            },
            {
              ...prev.databases[1],
              firmaNo: connectionInfo.second_firma_no || '',
              donemNo: connectionInfo.second_donem_no || '',
              dbHost: connectionInfo.second_server_name || '',
              dbName: connectionInfo.second_db_name || '',
              dbUser: connectionInfo.second_username || '',
              dbPassword: connectionInfo.second_password || ''
            },
            {
              ...prev.databases[2],
              firmaNo: connectionInfo.third_firma_no || '',
              donemNo: connectionInfo.third_donem_no || '',
              dbHost: connectionInfo.third_server_name || '',
              dbName: connectionInfo.third_db_name || '',
              dbUser: connectionInfo.third_username || '',
              dbPassword: connectionInfo.third_password || ''
            }
          ],
          // ENPOS alanlarını da güncelle
          enposFirmaNo: connectionInfo.enpos_firma_no || '',
          enposDonemNo: connectionInfo.enpos_donem_no || '',
          enposDbHost: connectionInfo.enpos_server_name || '',
          enposDbName: connectionInfo.enpos_database_name || '',  // backend'den enpos_database_name geliyor
          enposDbUser: connectionInfo.enpos_username || '',
          enposDbPassword: connectionInfo.enpos_password || ''
        }));

        console.log('✅ Database ayarları başarıyla yüklendi');
      } else {
        console.log('⚠️ Database ayarları bulunamadı veya hata:', data.message);
      }
    } catch (error) {
      console.error('❌ Database ayarları yüklenirken hata:', error);
    }
  };

  // Alt kullanıcı silme onayı
  const handleDeleteUser = (user: {id: number, name: string}) => {
    console.log('Silinecek kullanıcı:', user); // Debug için
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Alt kullanıcı silme işlemi
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    console.log('Silme API URL:', `https://api.btrapor.com/delete-sub-user/${userToDelete.id}`); // Debug için

    setIsDeletingUser(true);
    try {
      const response = await fetch(`https://api.btrapor.com/delete-sub-user/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      console.log('Silme API Response:', data); // Debug için

      if (response.ok && data.status === 'success') {
        loadAnimation('success', 'Alt kullanıcı başarıyla silindi!');
        fetchSubUsers(); // Listeyi güncelle
        setShowDeleteModal(false);
        setUserToDelete(null);
      } else {
        loadAnimation('failed', data.message || 'Alt kullanıcı silinirken bir hata oluştu!');
      }
    } catch (error) {
      loadAnimation('failed', 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Silme modalını kapat
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  // Authentication kontrolü devam ediyorsa loading göster
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center justify-center">
            <svg className="animate-spin h-12 w-12 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-700 font-medium text-lg mt-4">Yükleniyor...</p>
            <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const loadAnimation = async (type: 'success' | 'failed', message: string = '') => {
    try {
      // Cache busting için timestamp ekliyoruz
      const timestamp = new Date().getTime();
      const response = await fetch(`/animations/${type}.json?v=${timestamp}`);
      const animationData = await response.json();
      setAnimationData(animationData);
      setShowAnimation(type);
      setAnimationMessage(message);
      
      // 3 saniye sonra animasyonu kapat
      setTimeout(() => {
        setShowAnimation(null);
        setAnimationData(null);
        setAnimationMessage('');
      }, 3000);
    } catch (error) {
      console.error('Animasyon yüklenirken hata:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      loadAnimation('failed', 'Yeni şifreler eşleşmiyor!');
      return;
    }

    if (!formData.currentPassword || !formData.newPassword) {
      loadAnimation('failed', 'Lütfen tüm alanları doldurun!');
      return;
    }

    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        loadAnimation('failed', 'Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

              const response = await fetch('https://api.btrapor.com/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          old_password: formData.currentPassword,
          new_password: formData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        loadAnimation('success', 'Şifreniz başarıyla değiştirildi!');
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else {
        loadAnimation('failed', data.message || 'Şifre değiştirme başarısız! Mevcut şifrenizi kontrol edin.');
      }
    } catch (error) {
      console.error('Şifre değiştirme hatası:', error);
      loadAnimation('failed', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const handleDatabaseChange = (dbIndex: number, field: string, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      databases: prev.databases.map((db, index) => 
        index === dbIndex ? { ...db, [field]: value } : db
      )
    }));
  };

  const handleDatabaseSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Company ref'i localStorage'dan al
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        loadAnimation('failed', 'Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // 3 database'in bilgilerini tek objede topla
      const connectionData = {
        company_ref: companyRef,
        
        // Sistem ayarları - IP, Port ve Endpoint birleştirilerek public_ip olarak gönderilir
        public_ip: formData.externalIP && formData.servicePort 
          ? `${formData.externalIP}:${formData.servicePort}${formData.endpoint || ''}` 
          : '',
        
        // Endpoint - Port + Endpoint birleştirilmiş
        endpoint: formData.servicePort && formData.endpoint 
          ? `${formData.servicePort}${formData.endpoint}` 
          : formData.endpoint || '',
        
        // Logo Kurulum Veritabanı Adı
        logoKurulumDbName: formData.logoKurulumDbName || '',
        
        // Market Modülü
        market_module: formData.hasMarketModule ? 1 : 0,
        
        // İlk database (index 0)
        first_server_name: formData.databases[0]?.dbHost || '',
        first_db_name: formData.databases[0]?.dbName || '',
        first_username: formData.databases[0]?.dbUser || '',
        first_password: formData.databases[0]?.dbPassword || '',
        first_firma_no: formData.databases[0]?.firmaNo ? 
          (formData.databases[0].firmaNo.toString().length === 3 ? 
            formData.databases[0].firmaNo.toString() : 
            String(formData.databases[0].firmaNo).padStart(3, '0')) : '',
        first_donem_no: formData.databases[0]?.donemNo || '',
        
        // İkinci database (index 1)
        second_server_name: formData.databases[1]?.dbHost || '',
        second_db_name: formData.databases[1]?.dbName || '',
        second_username: formData.databases[1]?.dbUser || '',
        second_password: formData.databases[1]?.dbPassword || '',
        second_firma_no: formData.databases[1]?.firmaNo ? 
          (formData.databases[1].firmaNo.toString().length === 3 ? 
            formData.databases[1].firmaNo.toString() : 
            String(formData.databases[1].firmaNo).padStart(3, '0')) : '',
        second_donem_no: formData.databases[1]?.donemNo || '',
        
        // Üçüncü database (index 2)
        third_server_name: formData.databases[2]?.dbHost || '',
        third_db_name: formData.databases[2]?.dbName || '',
        third_username: formData.databases[2]?.dbUser || '',
        third_password: formData.databases[2]?.dbPassword || '',
        third_firma_no: formData.databases[2]?.firmaNo ? 
          (formData.databases[2].firmaNo.toString().length === 3 ? 
            formData.databases[2].firmaNo.toString() : 
            String(formData.databases[2].firmaNo).padStart(3, '0')) : '',
        third_donem_no: formData.databases[2]?.donemNo || '',

        // ENPOS özel alanları
        enpos_firma_no: formData.enposFirmaNo || '',
        enpos_donem_no: formData.enposDonemNo || '',
        enpos_server_name: formData.enposDbHost || '',
        enpos_database_name: formData.enposDbName || '',  // backend'de enpos_database_name bekleniyor
        enpos_username: formData.enposDbUser || '',
        enpos_password: formData.enposDbPassword || ''
      };

      console.log('🚀 API İsteği Gönderiliyor:');
      console.log('📋 URL:', 'https://api.btrapor.com/save-connections');
      console.log('📦 Gönderilen Data:', connectionData);
      console.log('💾 JSON String:', JSON.stringify(connectionData, null, 2));

      const response = await fetch('https://api.btrapor.com/save-connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionData)
      });

      console.log('📡 Response Status:', response.status);
      console.log('📡 Response Status Text:', response.statusText);
      console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

      const responseData = await response.text();
      console.log('📄 Response Raw Text:', responseData);

      if (response.ok) {
        try {
          const jsonResponse = JSON.parse(responseData);
          console.log('✅ Response JSON:', jsonResponse);
          
          // Market modülü değerini localStorage'a kaydet
          localStorage.setItem('market_module', formData.hasMarketModule ? '1' : '0');
          console.log('💾 Market modülü localStorage\'a kaydedildi:', formData.hasMarketModule ? '1' : '0');
          
          loadAnimation('success', 'Tüm veritabanı ayarları başarıyla kaydedildi!');
        } catch (e) {
          console.log('⚠️ Response JSON Parse Hatası:', e);
          
          // Market modülü değerini localStorage'a kaydet
          localStorage.setItem('market_module', formData.hasMarketModule ? '1' : '0');
          console.log('💾 Market modülü localStorage\'a kaydedildi:', formData.hasMarketModule ? '1' : '0');
          
          loadAnimation('success', 'Tüm veritabanı ayarları başarıyla kaydedildi!');
        }
      } else {
        console.error('❌ Database ayarları kaydedilemedi:', response.status);
        console.error('❌ Error Response:', responseData);
        loadAnimation('failed', 'Veritabanı ayarları kaydedilemedi!');
      }
    } catch (error) {
      console.error('Database ayarları kaydedilirken hata:', error);
      loadAnimation('failed', 'Veritabanı ayarları kaydedilirken bir hata oluştu!');
    }
  };

  // Akaryakıt ayarlarında tek satırı güncelle
  const updateFuelSetting = (id: string, field: keyof Omit<FuelSetting, 'id'>, value: string) => {
    setFuelSettings((prev) => prev.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  // Yeni akaryakıt istasyonu satırı ekle
  const addFuelSetting = () => {
    const newId = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    setFuelSettings((prev) => ([
      ...prev,
      { id: newId, stationName: '', automationName: '', filePath: '', onlineFilePath: '' }
    ]));
  };

  // Satırı sil
  const removeFuelSetting = (id: string) => {
    setFuelSettings((prev) => prev.filter((row) => row.id !== id));
  };

  // Akaryakıt ayarlarını kaydet (localStorage + PHP API)
  const handleSaveFuelSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    console.log('🚀 handleSaveFuelSettings fonksiyonu başlatıldı!');
    alert('Debug: handleSaveFuelSettings fonksiyonu başlatıldı!');
    
    try {
      const companyRef = localStorage.getItem('companyRef');
      const userId = localStorage.getItem('userId');
      
      console.log('🔍 localStorage Değerleri:', { companyRef, userId });
      alert(`Debug: localStorage - companyRef: ${companyRef}, userId: ${userId}`);
      
      if (!companyRef || !userId) {
        await loadAnimation('failed', 'Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      console.log('📋 fuelSettings:', fuelSettings);
      alert(`Debug: fuelSettings array - ${fuelSettings.length} adet ayar var`);

      // Her bir akaryakıt ayarını PHP API'sine gönder
      for (const setting of fuelSettings) {
        const payload = {
          company_ref: parseInt(companyRef),
          branch_name: setting.stationName,
          file_type: setting.automationName,
          path: setting.filePath,
          online_path: setting.onlineFilePath,
          user_by: parseInt(userId)
        };

        console.log('🚀 Akaryakıt ayarı kaydediliyor:', payload);
        console.log('📤 Gönderilen JSON:', JSON.stringify(payload, null, 2));
        alert(`Debug: API'ye gönderilecek veri:\n${JSON.stringify(payload, null, 2)}`);

        const response = await fetch('https://api.btrapor.com/akaryakit-save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        console.log('📡 HTTP Yanıt Durumu:', response.status, response.statusText);
        console.log('📡 HTTP Yanıt Başlıkları:', Object.fromEntries(response.headers.entries()));

        const result = await response.json();
        console.log('📥 API Yanıtı (Ham):', result);
        console.log('📥 API Yanıtı (JSON):', JSON.stringify(result, null, 2));
        alert(`Debug: API Yanıtı:\n${JSON.stringify(result, null, 2)}`);
        
        if (result.status === 'success') {
          console.log('✅ Akaryakıt ayarı kaydedildi:', result);
          alert('✅ API başarılı yanıt aldı!');
        } else {
          console.error('❌ Akaryakıt ayarı kaydedilemedi:', result);
          console.error('❌ Hata Detayı:', result.message);
          alert(`❌ API Hatası: ${result.message}`);
          await loadAnimation('failed', `❌ Hata: ${result.message}`);
          return;
        }
      }

      // Başarılı ise localStorage'a da kaydet
      const key = `fuel_module_settings_${companyRef}`;
      localStorage.setItem(key, JSON.stringify(fuelSettings));
      
      await loadAnimation('success', 'Tüm akaryakıt modülü ayarları başarıyla kaydedildi!');
      
    } catch (error) {
      console.error('❌ Akaryakıt ayarları kaydedilirken hata:', error);
      console.error('❌ Hata Türü:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Hata Mesajı:', error instanceof Error ? error.message : String(error));
      console.error('❌ Hata Stack:', error instanceof Error ? error.stack : 'Stack trace yok');
      alert(`❌ Hata oluştu:\n${error instanceof Error ? error.message : String(error)}`);
      await loadAnimation('failed', 'Akaryakıt ayarları kaydedilirken bir hata oluştu!');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.newUserName || !formData.newUserEmail || !formData.newUserPassword) {
      loadAnimation('failed', 'Lütfen tüm alanları doldurun!');
      return;
    }

    try {
      const companyRef = localStorage.getItem('companyRef');
      const parentRef = localStorage.getItem('userId');
      const currentUserName = localStorage.getItem('userName');
      
      if (!companyRef || !parentRef) {
        loadAnimation('failed', 'Kullanıcı bilgileri eksik. Lütfen tekrar giriş yapın.');
        return;
      }

      // Mevcut tarih ve saati formatla (YYYY-MM-DD HH:mm:ss)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      const apiData = {
        company_ref: companyRef,
        parent_ref: parentRef,
        name: formData.newUserName,
        email: formData.newUserEmail,
        password_hash: formData.newUserPassword, // Backend'de hash'lenecek
        created_at: formattedDate,
        created_by: parentRef, // localStorage'dan gelen userId
        role: 'user' // Sabit user rolü
      };

              const response = await fetch('https://api.btrapor.com/add-sub-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData)
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        loadAnimation('success', 'Alt kullanıcı başarıyla eklendi!');
        setFormData(prev => ({
          ...prev,
          newUserName: '',
          newUserEmail: '',
          newUserPassword: ''
        }));
        // Alt kullanıcı eklendikten sonra listeyi güncelle
        fetchSubUsers();
      } else {
        loadAnimation('failed', data.message || 'Alt kullanıcı eklenirken bir hata oluştu!');
      }
    } catch (error) {
      loadAnimation('failed', 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.');
    }
  };



  const tabs = [
    { id: 'profile', name: 'Profil & Şifre', icon: '👤' },
    { id: 'database', name: 'Veritabanı ve Sistem Ayarları', icon: '🗄️', adminOnly: true },
    { id: 'users', name: 'Kullanıcı Yönetimi', icon: '👥', adminOnly: true },
    { id: 'permissions', name: 'Rapor Yetkilendirme', icon: '📊', adminOnly: true },
    { id: 'system', name: 'Sistem', icon: '⚙️', adminOnly: true }
  ];

  return (
    <DashboardLayout title="Ayarlar">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Sistem Ayarları</h2>
          <p className="text-sm md:text-base text-gray-600">Sistem ayarlarını ve kullanıcı tercihlerini yönetin</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          {/* Mobile Tab Selector */}
          <div className="block md:hidden border-b border-gray-200">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border-0 focus:outline-none focus:ring-0"
            >
              {tabs.map((tab) => {
                // Admin kontrolü
                if (tab.adminOnly && userRole !== 'admin') return null;
                
                return (
                  <option key={tab.id} value={tab.id}>
                    {tab.icon} {tab.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden md:block border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                // Admin kontrolü
                if (tab.adminOnly && userRole !== 'admin') return null;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-red-500 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 md:p-6">
            {/* Profil & Şifre Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Şifre Değiştir</h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-full md:max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mevcut Şifre
                      </label>
                      <input
                        type="password"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Yeni Şifre
                      </label>
                      <input
                        type="password"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Yeni Şifre (Tekrar)
                      </label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full md:w-auto bg-red-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Şifreyi Güncelle
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Veritabanı Tab */}
            {activeTab === 'database' && userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Veritabanı & Sistem Ayarları</h3>
                <p className="text-gray-600 text-sm mb-6">Sistem bağlantı ayarları ve firma bazlı veritabanı konfigürasyonları</p>
                
                <form onSubmit={handleDatabaseSave} className="space-y-6">
                  {/* Market Modülü Checkbox */}
                  <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                    <h4 className="text-md font-medium text-green-900 mb-4">Market Modülü Ayarları</h4>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="hasMarketModule"
                        name="hasMarketModule"
                        checked={formData.hasMarketModule}
                        onChange={(e) => setFormData(prev => ({...prev, hasMarketModule: e.target.checked}))}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="hasMarketModule" className="ml-3 text-sm font-medium text-green-800">
                        Market modülü varsa işaretleyin
                      </label>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      Bu seçenek market modülü kullanan müşteriler için gereklidir
                    </p>
                  </div>
                  {/* Sistem Ayarları - En Üstte */}
                  <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
                    <h4 className="text-md font-medium text-blue-900 mb-4">BT Service Bağlantı Ayarları</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dış IP Adresi
                        </label>
                        <input
                          type="text"
                          name="externalIP"
                          value={formData.externalIP}
                          onChange={handleInputChange}
                          placeholder="192.168.1.100"
                          className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Sabit dış IP adresi</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Port
                        </label>
                        <input
                          type="text"
                          name="servicePort"
                          value={formData.servicePort}
                          onChange={handleInputChange}
                          placeholder="45678"
                          className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">BT Service portu</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Endpoint
                        </label>
                        <input
                          type="text"
                          name="endpoint"
                          value={formData.endpoint}
                          onChange={handleInputChange}
                          placeholder="/api/btrapor"
                          className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">API endpoint</p>
                      </div>
                    </div>
                  </div>

                

                  {/* Logo Kurulum Veritabanı Adı */}
                  <div className="border-2 border-orange-300 bg-orange-50 rounded-lg p-4">
                    <h4 className="text-md font-medium text-orange-900 mb-4">Logo Kurulum Veritabanı</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🗄️ Logo Kurulum Veritabanı Adı
                      </label>
                      <input
                        type="text"
                        name="logoKurulumDbName"
                        value={formData.logoKurulumDbName}
                        onChange={handleInputChange}
                        placeholder="Database bölünmüşse ilk veritabanı adını yazınız. Örn: GOWINGS"
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Logo kurulum sistemi veritabanı adı</p>
                    </div>
                  </div>
                  
                  {formData.databases.map((db, index) => (
                    <div key={db.id} className={`border rounded-lg p-4 ${
                      db.isCurrent 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`text-md font-medium ${
                          db.isCurrent ? 'text-red-900' : 'text-gray-900'
                        }`}>
                          {index === 0 ? 'Güncel Yıl' : 
                           index === 1 ? 'Bir Önceki Yıl' : 
                           '2 Önceki Yıl'} Ayarları
                        </h4>
                        {index > 0 && (
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={db.useSameDb}
                              onChange={(e) => handleDatabaseChange(index, 'useSameDb', e.target.checked)}
                              className="rounded mr-2"
                            />
                            <span className="text-sm text-gray-600">Aynı veritabanı bilgilerini kullan</span>
                          </label>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Firma No
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={db.firmaNo}
                            onChange={(e) => handleDatabaseChange(index, 'firmaNo', e.target.value)}
                            placeholder="Örn: 1 (001 olarak kaydedilir)"
                            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            3 hane olarak kaydedilir (1→001, 15→015)
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dönem No
                          </label>
                          <input
                            type="text"
                            value={db.donemNo}
                            onChange={(e) => handleDatabaseChange(index, 'donemNo', e.target.value)}
                            placeholder="01"
                            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      {(!db.useSameDb || index === 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Host/Server
                            </label>
                            <input
                              type="text"
                              value={db.dbHost}
                              onChange={(e) => handleDatabaseChange(index, 'dbHost', e.target.value)}
                              placeholder="192.168.2.100"
                              className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Veritabanı Adı
                            </label>
                            <input
                              type="text"
                              value={db.dbName}
                              onChange={(e) => handleDatabaseChange(index, 'dbName', e.target.value)}
                              placeholder="GOWINGS"
                              className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Kullanıcı Adı
                            </label>
                            <input
                              type="text"
                              value={db.dbUser}
                              onChange={(e) => handleDatabaseChange(index, 'dbUser', e.target.value)}
                              placeholder="sa"
                              className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Şifre
                            </label>
                            <input
                              type="password"
                              value={db.dbPassword}
                              onChange={(e) => handleDatabaseChange(index, 'dbPassword', e.target.value)}
                              className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        </div>
                      )}

                      {db.useSameDb && index > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-700">
                            Bu yıl için ilk veritabanı ayarları kullanılacak.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="submit"
                    className="w-full md:w-auto bg-red-600 text-white px-6 py-3 md:py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Tüm Ayarları Kaydet
                  </button>
                </form>

                {/* ENPOS Veritabanı Bilgileri - Tüm müşteriler için */}
                  <div className="mt-12 pt-8 border-t border-gray-200">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <div className="bg-purple-100 p-2 rounded-lg mr-3">
                          <span className="text-xl">🏪</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-purple-800">ENPOS Veritabanı Bilgileri</h3>
                          <p className="text-sm text-purple-600">POS sistemi için özel veritabanı ayarları</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-purple-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              🏢 ENPOS Firma No
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="999"
                              value={formData.enposFirmaNo || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposFirmaNo: e.target.value}))}
                              placeholder="Örn: 9"
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <p className="text-xs text-purple-500 mt-1">
                              ENPOS sistemindeki firma numarası
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              📅 ENPOS Dönem No
                            </label>
                            <input
                              type="text"
                              value={formData.enposDonemNo || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposDonemNo: e.target.value}))}
                              placeholder="01"
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              🖥️ ENPOS Server
                            </label>
                            <input
                              type="text"
                              value={formData.enposDbHost || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposDbHost: e.target.value}))}
                              placeholder="192.168.2.101"
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              🗄️ ENPOS Database
                            </label>
                            <input
                              type="text"
                              value={formData.enposDbName || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposDbName: e.target.value}))}
                              placeholder="ENPOS"
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              👤 ENPOS Kullanıcı
                            </label>
                            <input
                              type="text"
                              value={formData.enposDbUser || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposDbUser: e.target.value}))}
                              placeholder="sa"
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-purple-700 mb-2">
                              🔐 ENPOS Şifre
                            </label>
                            <input
                              type="password"
                              value={formData.enposDbPassword || ''}
                              onChange={(e) => setFormData(prev => ({...prev, enposDbPassword: e.target.value}))}
                              className="w-full px-3 py-3 md:py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>

                        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-start">
                            <span className="text-purple-500 mr-2 mt-0.5">ℹ️</span>
                            <div>
                              <p className="text-sm font-medium text-purple-800">ENPOS Özel Ayarları</p>
                              <p className="text-xs text-purple-600 mt-1">
                                Bu ayarlar sadece ENPOS POS sistemi entegrasyonu olan müşteriler için görünür. 
                                Ciro raporları bu veritabanından çekilecektir.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                    {/* Akaryakıt Modülü Ayarları */}
                    <div className="border-2 border-indigo-300 bg-indigo-50 rounded-lg p-4 mt-12 pt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-md font-medium text-indigo-900">Akaryakıt Modülü Ayarları</h4>
                        <p className="text-xs text-indigo-700 mt-1">Birden fazla istasyon/otomasyon için ayar ekleyebilirsiniz</p>
                      </div>
                      <button
                        type="button"
                        onClick={addFuelSetting}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                        title="İstasyon ayarı ekle"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Ekle
                      </button>
                    </div>

                    {fuelSettings.length === 0 ? (
                      <div className="bg-white border border-indigo-200 rounded-lg p-4 text-sm text-indigo-900">
                        Henüz bir ayar eklenmemiş. Yeni bir istasyon/otomasyon eklemek için "Ekle" butonuna basın.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {fuelSettings.map((row) => (
                          <div key={row.id} className="bg-white border border-indigo-200 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">İstasyon Adı</label>
                                <input
                                  type="text"
                                  value={row.stationName}
                                  onChange={(e) => updateFuelSetting(row.id, 'stationName', e.target.value)}
                                  placeholder="Örn: Merkez İstasyon"
                                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Otomasyon Adı</label>
                                <input
                                  type="text"
                                  value={row.automationName}
                                  onChange={(e) => updateFuelSetting(row.id, 'automationName', e.target.value)}
                                  placeholder="Örn: TURPAK / Asis / Petronet"
                                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Dosya Yolu</label>
                                <input
                                  type="text"
                                  value={row.filePath}
                                  onChange={(e) => updateFuelSetting(row.id, 'filePath', e.target.value)}
                                  placeholder="Örn: C:\\TURPAK\\Reports"
                                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Online Dosya Yolu</label>
                                <input
                                  type="text"
                                  value={row.onlineFilePath}
                                  onChange={(e) => updateFuelSetting(row.id, 'onlineFilePath', e.target.value)}
                                  placeholder="Örn: \\ Fileserver\\share\\TURPAK"
                                  className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeFuelSetting(row.id)}
                                className="inline-flex items-center px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                                title="Satırı kaldır"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0h8l-1-2H10l-1 2z" />
                                </svg>
                                Kaldır
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-xs text-indigo-700">Değişiklikleri kaydetmeyi unutmayın</div>
                      <button
                        type="button"
                        onClick={handleSaveFuelSettings}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
              </div>
              
            )}

            {/* Kullanıcı Yönetimi Tab */}
            {activeTab === 'users' && userRole === 'admin' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Alt Kullanıcı Ekle</h3>
                  <form onSubmit={handleAddUser} className="space-y-4 max-w-full md:max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ad Soyad
                      </label>
                      <input
                        type="text"
                        name="newUserName"
                        value={formData.newUserName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        E-posta
                      </label>
                      <input
                        type="email"
                        name="newUserEmail"
                        value={formData.newUserEmail}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Şifre
                      </label>
                      <input
                        type="password"
                        name="newUserPassword"
                        value={formData.newUserPassword}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full md:w-auto bg-red-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Alt Kullanıcı Ekle
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Mevcut Kullanıcılar</h3>
                  
                  {isLoadingUsers ? (
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                      <svg className="animate-spin h-8 w-8 text-red-600 mr-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-gray-600">Kullanıcılar yükleniyor...</span>
                    </div>
                  ) : subUsers.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-600 text-sm text-center">
                        Henüz alt kullanıcı bulunmuyor.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ad Soyad
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rol
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                İşlem
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {subUsers.map((user, index) => {
                              console.log('User in table:', user); // Debug için
                              return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                                      <span className="text-red-600 font-medium text-sm">
                                        {user.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-gray-900">
                                        {user.name}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    user.role === 'admin' 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                                  </span>
                                </td>
                                                                 <td className="px-6 py-4 whitespace-nowrap text-center">
                                   {user.role === 'user' ? (
                                     <button 
                                       onClick={() => handleDeleteUser({id: user.id, name: user.name})}
                                       className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                       title="Kullanıcıyı Sil"
                                     >
                                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                       </svg>
                                     </button>
                                   ) : (
                                     <span className="text-gray-400 text-sm">-</span>
                                                                      )}
                                 </td>
                               </tr>
                               );
                             })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Rapor Yetkilendirme Tab */}
            {activeTab === 'permissions' && userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rapor Yetkilendirme</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Kullanıcıların hangi raporlara erişebileceğini belirleyin. Admin kullanıcılar tüm raporlara erişebilir.
                </p>

                {loadingReports ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-2 text-sm text-gray-500">Raporlar yükleniyor...</span>
                  </div>
                ) : companyReports.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Şirket raporları bulunamadı</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Rapor Listesi */}
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-medium text-gray-900">Mevcut Raporlar</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {companyReports.length} rapor bulundu
                        </p>
                      </div>

                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {companyReports.map((report) => (
                            <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="ml-3 flex-1">
                                  <h5 className="text-sm font-medium text-gray-900">
                                    {report.report_name}
                                  </h5>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {report.report_description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Kullanıcı Yetkilendirme Tablosu */}
                    {subUsers.length > 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                          <h4 className="text-lg font-medium text-gray-900">Kullanıcı Yetkilendirme</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Her kullanıcının rapor erişim yetkilerini yönetin
                          </p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Kullanıcı
                                </th>
                                {companyReports.map((report) => (
                                  <th key={report.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-24">
                                    <div className="flex flex-col items-center">
                                      <span className="truncate max-w-20" title={report.report_name}>
                                        {report.report_name.split(' ')[0]}
                                      </span>
                                      <span className="text-gray-400 text-xs">
                                        #{report.id}
                                      </span>
                                    </div>
                                  </th>
                                ))}
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Toplam
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {subUsers.map((user) => {
                                const userPermissions = userReportPermissions[user.id] || [];
                                const permissionCount = userPermissions.length;
                                
                                return (
                                  <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                                          <span className="text-red-600 font-medium text-sm">
                                            {user.name.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="ml-3">
                                          <div className="text-sm font-medium text-gray-900">
                                            {user.name}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    {companyReports.map((report) => {
                                      const hasPermission = userPermissions.includes(report.id);
                                      const isDisabled = user.role === 'admin'; // Admin her şeye erişebilir
                                      
                                      return (
                                        <td key={report.id} className="px-3 py-4 text-center">
                                          <div className="flex justify-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={isDisabled || hasPermission}
                                                disabled={isDisabled}
                                                onChange={() => toggleUserReportPermission(user.id, report.id)}
                                                className="sr-only"
                                              />
                                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                isDisabled 
                                                  ? 'bg-green-100 border-green-300 cursor-not-allowed'
                                                  : hasPermission 
                                                    ? 'bg-red-600 border-red-600 hover:bg-red-700' 
                                                    : 'border-gray-300 hover:border-red-400'
                                              }`}>
                                                {(isDisabled || hasPermission) && (
                                                  <svg className={`w-3 h-3 ${isDisabled ? 'text-green-600' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                  </svg>
                                                )}
                                              </div>
                                            </label>
                                          </div>
                                        </td>
                                      );
                                    })}
                                    <td className="px-6 py-4 text-center">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        user.role === 'admin' 
                                          ? 'bg-green-100 text-green-800'
                                          : permissionCount > 0 
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {user.role === 'admin' ? 'Tümü' : `${permissionCount}/${companyReports.length}`}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Henüz kullanıcı bulunamadı</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sistem Tab */}
            {activeTab === 'system' && userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sistem Bilgileri</h3>
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Sistem Durumu</h4>
                    <p className="text-gray-600 text-sm mb-3">
                      Sistem bileşenlerinin anlık durumu
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Versiyon:</span>
                        <span className="ml-2 font-medium">v1.0.0</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Son Güncelleme:</span>
                        <span className="ml-2 font-medium">20.06.2025</span>
                      </div>
                      <div>
                        <span className="text-gray-600">BT Service:</span>
                        <span className="ml-2 font-medium text-green-600">Aktif</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Database:</span>
                        <span className="ml-2 font-medium text-green-600">Bağlı</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
                        <button className="w-full md:w-auto bg-gray-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-gray-700 transition-colors">
                          Service'i Yeniden Başlat
                        </button>
                        <button className="w-full md:w-auto bg-blue-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-blue-700 transition-colors">
                          Sistem Loglarını Görüntüle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Kullanıcıyı Sil
                </h3>
                <p className="text-sm text-gray-500">
                  Bu işlem geri alınamaz.
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                <strong>{userToDelete.name}</strong> adlı kullanıcıyı silmek istediğinizden emin misiniz?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                disabled={isDeletingUser}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                İptal
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isDeletingUser ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Siliniyor...
                  </>
                ) : (
                  'Sil'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Modal */}
      {showAnimation && animationData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center">
            <Lottie 
              animationData={animationData} 
              style={{ height: 150, width: 150 }} 
              className="mx-auto"
            />
            <h3 className={`text-lg font-semibold mt-4 ${
              showAnimation === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {animationMessage || (showAnimation === 'success' 
                ? 'İşlem Başarılı!' 
                : 'İşlem Başarısız!'
              )}
            </h3>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
} 