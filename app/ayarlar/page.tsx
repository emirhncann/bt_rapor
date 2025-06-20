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
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    newUserName: '',
    newUserEmail: '',
    newUserRole: 'user',
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
        year: new Date().getFullYear(),
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
        year: new Date().getFullYear() - 1,
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
        year: new Date().getFullYear() - 2,
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
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

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

  const handleDatabaseChange = (dbIndex: number, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      databases: prev.databases.map((db, index) => 
        index === dbIndex ? { ...db, [field]: value } : db
      )
    }));
  };

  const handleDatabaseSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Database ayarları kaydetme
    console.log('Database ayarları:', formData.databases);
    
    alert('Database ayarları kaydedildi!');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Yeni kullanıcı ekleme
    console.log('Yeni kullanıcı:', {
      name: formData.newUserName,
      email: formData.newUserEmail,
      role: formData.newUserRole
    });
    
    alert('Kullanıcı eklendi!');
    setFormData(prev => ({
      ...prev,
      newUserName: '',
      newUserEmail: '',
      newUserPassword: '',
      newUserRole: 'user'
    }));
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
                            type="text"
                            value={db.firmaNo}
                            onChange={(e) => handleDatabaseChange(index, 'firmaNo', e.target.value)}
                            placeholder="001"
                            className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Yeni Kullanıcı Ekle</h3>
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rol
                      </label>
                      <select
                        name="newUserRole"
                        value={formData.newUserRole}
                        onChange={handleInputChange}
                        className="w-full px-3 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="user">Kullanıcı</option>
                        <option value="admin">Yönetici</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full md:w-auto bg-red-600 text-white px-4 py-3 md:py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Kullanıcı Ekle
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Mevcut Kullanıcılar</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-600 text-sm">
                      Kullanıcı listesi ve yönetim özellikleri yakında eklenecek...
                    </p>
                  </div>
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