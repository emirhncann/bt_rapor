'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isAdmin } from '../utils/simple-permissions';
import { fetchUserReports, CompanyReport } from '../utils/simple-permissions';
import DashboardLayout from '../components/DashboardLayout';

interface User {
  id: number;
  name: string;
  role: string;
}

interface UserReportPermission {
  user_id: number;
  report_id: number;
  report_name: string;
  has_access: boolean;
  granted_by: number;
  granted_at: string;
}

export default function KullaniciYetkiYonetimi() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Veriler
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<CompanyReport[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserReportPermission[]>([]);
  const [permissionChanges, setPermissionChanges] = useState<{[key: string]: boolean}>({});

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        
        // Admin kontrolü
        const admin = isAdmin();
        setIsAdminUser(admin);
        
        if (!admin) {
          router.push('/');
          return;
        }
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // Sayfa yüklendiğinde verileri çek
  useEffect(() => {
    if (isAuthenticated && isAdminUser) {
      loadData();
    }
  }, [isAuthenticated, isAdminUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadReports()
      ]);
    } catch (error) {
      console.error('Veriler yüklenirken hata:', error);
      setMessage({type: 'error', text: 'Veriler yüklenirken hata oluştu.'});
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        throw new Error('Company ref bulunamadı');
      }

      // Ayarlar sayfasındaki gibi doğrudan API'den kullanıcıları çek
      const response = await fetch(`https://api.btrapor.com/users-by-company/${companyRef}`);
      const data = await response.json();
      
      console.log('API Response:', data); // Debug için

      if (response.ok && data.status === 'success') {
        console.log('Users data:', data.data); // Debug için
        setUsers(data.data || []);
      } else {
        throw new Error(data.message || 'Kullanıcılar yüklenemedi');
      }
    } catch (error) {
      console.error('Kullanıcılar yüklenirken hata:', error);
      setMessage({type: 'error', text: 'Kullanıcılar yüklenirken hata oluştu.'});
    }
  };

  const loadReports = async () => {
    try {
      const companyRef = localStorage.getItem('companyRef');
      if (!companyRef) {
        throw new Error('Company ref bulunamadı');
      }

      // Firma raporlarını doğrudan API'den çek (kullanıcı filtrelemesi olmadan)
      const response = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.all_reports) {
        // API'den gelen raporları işle
        const companyReports = data.all_reports.map((report: any) => {
          return {
            ...report,
            // API'den gelen bilgileri kullan, yoksa varsayılan değerler ata
            route_path: report.route_path || `/${(report.route || report.report_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}`,
            icon: report.icon || 'folder',
            category: report.category || 'Diğer Raporlar'
          };
        });
        setReports(companyReports);
      } else {
        throw new Error(data.message || 'Firma raporları yüklenemedi');
      }
    } catch (error) {
      console.error('Raporlar yüklenirken hata:', error);
      setMessage({type: 'error', text: 'Raporlar yüklenirken hata oluştu.'});
    }
  };

  const loadUserPermissions = async (userId: number) => {
    try {
      setLoading(true);
      
      // Direkt external API'den kullanıcının mevcut yetkilerini çek (yeni API yapısı)
      const response = await fetch(`https://api.btrapor.com/user-report-permissions/${userId}`);
      const data = await response.json();
      
      let userReportIds: number[] = [];
      
      if (data.status === 'success' && data.report_ids) {
        userReportIds = data.report_ids; // Artık direkt report_id listesi
      }
      
      // Firma raporlarının tümü için yetki durumunu oluştur
      const allPermissions = reports.map(report => {
        // Kullanıcının bu rapor için yetkisi var mı?
        const hasAccess = userReportIds.includes(report.id);
        
        return {
          user_id: userId,
          report_id: report.id,
          report_name: report.report_name,
          has_access: hasAccess,
          granted_by: hasAccess ? 1 : 0, // Geçici değer
          granted_at: hasAccess ? new Date().toISOString() : ''
        };
      });
      
      setUserPermissions(allPermissions);
      
      // Değişiklikleri sıfırla
      setPermissionChanges({});
      
    } catch (error) {
      console.error('Kullanıcı yetkileri yüklenirken hata:', error);
      setMessage({type: 'error', text: 'Kullanıcı yetkileri yüklenirken hata oluştu.'});
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    loadUserPermissions(user.id);
  };

  const handlePermissionChange = (reportId: number, hasAccess: boolean) => {
    const key = `${selectedUser?.id}_${reportId}`;
    setPermissionChanges(prev => ({
      ...prev,
      [key]: hasAccess
    }));

    // Mevcut yetkileri güncelle
    setUserPermissions(prev => 
      prev.map(perm => 
        perm.report_id === reportId 
          ? { ...perm, has_access: hasAccess }
          : perm
      )
    );
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      console.log('🔄 Yetkiler kaydediliyor...', { selectedUser: selectedUser.id, changes: permissionChanges });
      
      // Değişen yetkileri grupla
      const reportIdsToAdd: number[] = [];
      const reportIdsToRemove: number[] = [];
      
      Object.entries(permissionChanges).forEach(([key, hasAccess]) => {
        const [userId, reportId] = key.split('_').map(Number);
        if (hasAccess) {
          reportIdsToAdd.push(reportId);
        } else {
          reportIdsToRemove.push(reportId);
        }
      });

      console.log('📊 Yetki değişiklikleri:', { 
        eklenen: reportIdsToAdd, 
        silinen: reportIdsToRemove 
      });

      // Yetkileri sil
      if (reportIdsToRemove.length > 0) {
        console.log('🗑️ Yetkiler siliniyor:', reportIdsToRemove);
        const deleteResponse = await fetch('https://api.btrapor.com/user-report-permissions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: selectedUser.id,
            report_ids: reportIdsToRemove
          })
        });
        
        const deleteData = await deleteResponse.json();
        console.log('🗑️ Silme yanıtı:', deleteData);
        
        if (deleteData.status !== 'success') {
          throw new Error(deleteData.message || 'Yetkiler silinemedi');
        }
      }

      // Yetkileri ekle
      if (reportIdsToAdd.length > 0) {
        console.log('➕ Yetkiler ekleniyor:', reportIdsToAdd);
        const addResponse = await fetch('https://api.btrapor.com/user-report-permissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: selectedUser.id,
            report_ids: reportIdsToAdd
          })
        });
        
        const addData = await addResponse.json();
        console.log('➕ Ekleme yanıtı:', addData);
        
        if (addData.status !== 'success') {
          throw new Error(addData.message || 'Yetkiler eklenemedi');
        }
      }

      setMessage({type: 'success', text: 'Kullanıcı yetkileri başarıyla güncellendi.'});
      setPermissionChanges({});
      // Yetkileri yeniden yükle
      await loadUserPermissions(selectedUser.id);
      
    } catch (error) {
      console.error('❌ Yetkiler kaydedilirken hata:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      setMessage({type: 'error', text: `Yetkiler kaydedilirken hata oluştu: ${errorMessage}`});
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = Object.keys(permissionChanges).length > 0;

  // Tümünü seç
  const selectAll = () => {
    if (!selectedUser) return;
    
    reports.forEach(report => {
      const key = `${selectedUser.id}_${report.id}`;
      setPermissionChanges(prev => ({
        ...prev,
        [key]: true
      }));
      
      setUserPermissions(prev => 
        prev.map(perm => 
          perm.report_id === report.id 
            ? { ...perm, has_access: true }
            : perm
        )
      );
    });
  };

  // Hiçbirini seçme
  const selectNone = () => {
    if (!selectedUser) return;
    
    reports.forEach(report => {
      const key = `${selectedUser.id}_${report.id}`;
      setPermissionChanges(prev => ({
        ...prev,
        [key]: false
      }));
      
      setUserPermissions(prev => 
        prev.map(perm => 
          perm.report_id === report.id 
            ? { ...perm, has_access: false }
            : perm
        )
      );
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdminUser) {
    return null;
  }

  return (
    <DashboardLayout title="Kullanıcı Yetki Yönetimi">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Kullanıcı Yetki Yönetimi</h2>
          <p className="text-sm md:text-base text-gray-600">Kullanıcılara rapor bazında erişim yetkisi tanımlayın</p>
        </div>

        {/* Mesaj */}
        {message && (
          <div className={`p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kullanıcı Listesi */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Kullanıcılar</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Yükleniyor...</p>
                  </div>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-blue-50 border-r-4 border-blue-600' : ''
                      }`}
                      onClick={() => handleUserSelect(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{user.name}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Yetki Yönetimi */}
          <div className="lg:col-span-2">
            {selectedUser ? (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        {selectedUser.name} - Rapor Yetkileri
                      </h2>
                      <p className="text-sm text-gray-500">Rol: {selectedUser.role === 'admin' ? 'Admin' : 'Kullanıcı'}</p>
                    </div>
                    {hasUnsavedChanges && (
                      <button
                        onClick={savePermissions}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Kaydediliyor...
                          </>
                        ) : (
                          'Değişiklikleri Kaydet'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {loading ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Yetkiler yükleniyor...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Toplu Seçim Butonları */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Toplu İşlemler</h3>
                          <p className="text-sm text-gray-500">Tüm raporlar için yetki durumunu değiştirin</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={selectAll}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Tümünü Seç
                          </button>
                          <button
                            onClick={selectNone}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Tümünü Kaldır
                          </button>
                        </div>
                      </div>
                      {reports.map((report) => {
                        const permission = userPermissions.find(p => p.report_id === report.id);
                        const hasAccess = permission?.has_access || false;
                        
                        return (
                          <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-gray-900">
                                {report.report_name}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {report.report_description}
                              </p>
                              {report.category && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mt-2">
                                  {report.category}
                                </span>
                              )}
                            </div>
                            <div className="ml-4">
                              <label className="inline-flex items-center">
                                <input
                                  type="checkbox"
                                  checked={hasAccess}
                                  onChange={(e) => handlePermissionChange(report.id, e.target.checked)}
                                  className="form-checkbox h-5 w-5 text-blue-600 transition duration-150 ease-in-out"
                                />
                                <span className="ml-2 text-sm text-gray-700">
                                  {hasAccess ? 'Erişim Var' : 'Erişim Yok'}
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow">
                <div className="p-12 text-center">
                  <div className="mx-auto h-12 w-12 text-gray-400">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Kullanıcı Seçin</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Yetkilerini yönetmek için sol taraftan bir kullanıcı seçin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
