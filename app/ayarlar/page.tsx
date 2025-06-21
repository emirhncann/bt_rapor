'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import Lottie from 'lottie-react';

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
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    newUserName: '',
    newUserEmail: '',
    newUserPassword: '',
    externalIP: '',
    servicePort: '45678',
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
    ]
  });
  const router = useRouter();

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

  // Alt kullanıcıları getir
  const fetchSubUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        return;
      }

      const response = await fetch(`https://btrapor.boluteknoloji.tr/users-by-company/${companyRef}`);
      const data = await response.json();

      console.log('API Response:', data); // Debug için

      if (response.ok && data.status === 'success') {
        console.log('Users data:', data.data); // Debug için
        setSubUsers(data.data || []);
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

      console.log('🔄 Database ayarları yükleniyor...');
      console.log('📋 URL:', `https://btrapor.boluteknoloji.tr/connection-info/${companyRef}`);

      const response = await fetch(`https://btrapor.boluteknoloji.tr/connection-info/${companyRef}`);
      const data = await response.json();

      console.log('📦 Database Settings Response:', data);

      if (response.ok && data.status === 'success' && data.data) {
        const connectionInfo = data.data;
        
        // FormData'yı güncelle
        setFormData(prev => ({
          ...prev,
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
          ]
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

    console.log('Silme API URL:', `https://btrapor.boluteknoloji.tr/delete-sub-user/${userToDelete.id}`); // Debug için

    setIsDeletingUser(true);
    try {
      const response = await fetch(`https://btrapor.boluteknoloji.tr/delete-sub-user/${userToDelete.id}`, {
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

      const response = await fetch('https://btrapor.boluteknoloji.tr/change-password', {
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
        
        // İlk database (index 0)
        first_server_name: formData.databases[0]?.dbHost || '',
        first_db_name: formData.databases[0]?.dbName || '',
        first_username: formData.databases[0]?.dbUser || '',
        first_password: formData.databases[0]?.dbPassword || '',
        first_firma_no: formData.databases[0]?.firmaNo ? String(formData.databases[0].firmaNo).padStart(3, '0') : '',
        first_donem_no: formData.databases[0]?.donemNo || '',
        
        // İkinci database (index 1)
        second_server_name: formData.databases[1]?.dbHost || '',
        second_db_name: formData.databases[1]?.dbName || '',
        second_username: formData.databases[1]?.dbUser || '',
        second_password: formData.databases[1]?.dbPassword || '',
        second_firma_no: formData.databases[1]?.firmaNo ? String(formData.databases[1].firmaNo).padStart(3, '0') : '',
        second_donem_no: formData.databases[1]?.donemNo || '',
        
        // Üçüncü database (index 2)
        third_server_name: formData.databases[2]?.dbHost || '',
        third_db_name: formData.databases[2]?.dbName || '',
        third_username: formData.databases[2]?.dbUser || '',
        third_password: formData.databases[2]?.dbPassword || '',
        third_firma_no: formData.databases[2]?.firmaNo ? String(formData.databases[2].firmaNo).padStart(3, '0') : '',
        third_donem_no: formData.databases[2]?.donemNo || ''
      };

      console.log('🚀 API İsteği Gönderiliyor:');
      console.log('📋 URL:', 'https://btrapor.boluteknoloji.tr/save-connections');
      console.log('📦 Gönderilen Data:', connectionData);
      console.log('💾 JSON String:', JSON.stringify(connectionData, null, 2));

      const response = await fetch('https://btrapor.boluteknoloji.tr/save-connections', {
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
          loadAnimation('success', 'Tüm veritabanı ayarları başarıyla kaydedildi!');
        } catch (e) {
          console.log('⚠️ Response JSON Parse Hatası:', e);
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

      const response = await fetch('https://btrapor.boluteknoloji.tr/add-sub-user', {
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

  const handleSystemSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sistem ayarları kaydetme
    console.log('Sistem ayarları:', {
      externalIP: formData.externalIP,
      servicePort: formData.servicePort
    });
    
    alert('Sistem ayarları kaydedildi!');
  };

  const tabs = [
    { id: 'profile', name: 'Profil & Şifre', icon: '👤' },
    { id: 'database', name: 'Veritabanı', icon: '🗄️', adminOnly: true },
    { id: 'users', name: 'Kullanıcı Yönetimi', icon: '👥', adminOnly: true },
    { id: 'permissions', name: 'Yetkiler', icon: '🔐', adminOnly: true },
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
                <h3 className="text-lg font-medium text-gray-900 mb-4">Firma Bazlı Veritabanı Ayarları</h3>
                <p className="text-gray-600 text-sm mb-6">Son 3 yıl için firma ve dönem bazlı veritabanı konfigürasyonları</p>
                
                <form onSubmit={handleDatabaseSave} className="space-y-6">
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

            {/* Yetkiler Tab */}
            {activeTab === 'permissions' && userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Kullanıcı Kısıtlamaları</h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Rapor Erişimi</h4>
                    <p className="text-gray-600 text-sm mb-3">
                      Kullanıcıların hangi raporlara erişebileceğini belirleyin
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" defaultChecked />
                        <span className="text-sm">Cari Bakiye Raporu</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" />
                        <span className="text-sm">Satış Raporları</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" />
                        <span className="text-sm">Stok Raporları</span>
                      </label>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Sistem Erişimi</h4>
                    <p className="text-gray-600 text-sm mb-3">
                      Kullanıcıların sistem özelliklerine erişimini kontrol edin
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" />
                        <span className="text-sm">Ayarlar Sayfası</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" />
                        <span className="text-sm">Kullanıcı Yönetimi</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded mr-2" />
                        <span className="text-sm">Database Ayarları</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sistem Tab */}
            {activeTab === 'system' && userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sistem Ayarları</h3>
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">BT Service Ayarları</h4>
                    <p className="text-gray-600 text-sm mb-3">
                      Service bağlantı konfigürasyonu
                    </p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dış IP Adresi
                          </label>
                          <input
                            type="text"
                            name="externalIP"
                            value={formData.externalIP}
                            onChange={handleInputChange}
                            placeholder="192.168.1.100"
                            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Sabit dış IP adresi</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Port
                          </label>
                          <input
                            type="number"
                            name="servicePort"
                            value={formData.servicePort}
                            onChange={handleInputChange}
                            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
                                                  <button 
                            onClick={handleSystemSave}
                            className="w-full md:w-auto bg-red-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-red-700 transition-colors"
                          >
                          Ayarları Kaydet
                        </button>
                        <button className="w-full md:w-auto bg-gray-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-gray-700 transition-colors">
                          Service'i Yeniden Başlat
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Sistem Bilgisi</h4>
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