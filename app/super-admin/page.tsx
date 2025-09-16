'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, isSuperAdmin } from '../utils/simple-permissions';
import SuperAdminLayout from '../components/SuperAdminLayout';
import CompaniesTable from '../components/tables/CompaniesTable';
import CompanyModal from '../components/modals/CompanyModal';

interface SystemStats {
  total_companies: number;
  total_users: number;
  total_modules: number;
  active_plans: number;
  recent_activity: Array<{
    id: number;
    action: string;
    user_name: string;
    company_name: string;
    created_at: string;
  }>;
}

function SuperAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<SystemStats | null>(null);
  
  // Company management states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // URL'den tab parametresini al
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Sayfa yüklendiğinde istatistikleri çek
  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // Mock data - gerçek API hazır olana kadar
      const mockStats: SystemStats = {
        total_companies: 12,
        total_users: 45,
        total_modules: 8,
        active_plans: 3,
        recent_activity: [
          {
            id: 1,
            action: 'Yeni şirket eklendi',
            user_name: 'Bolu Teknoloji',
            company_name: 'ABC Şirketi',
            created_at: new Date().toISOString()
          },
          {
            id: 2,
            action: 'Kullanıcı yetkisi güncellendi',
            user_name: 'Bolu Teknoloji',
            company_name: 'XYZ Ltd.',
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 3,
            action: 'Modül aktifleştirildi',
            user_name: 'Bolu Teknoloji',
            company_name: 'DEF A.Ş.',
            created_at: new Date(Date.now() - 7200000).toISOString()
          }
        ]
      };
      
      // API'den veri çek
      const response = await fetch('/api/super-admin/statistics');
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        setStats(data.data);
      } else {
        // API başarısız olursa mock data kullan
        setStats(mockStats);
      }
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
      // Hata durumunda da mock data göster
      setStats({
        total_companies: 0,
        total_users: 0,
        total_modules: 0,
        active_plans: 0,
        recent_activity: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Company management functions
  const handleCreateCompany = () => {
    setEditingCompany(null);
    setShowCompanyModal(true);
  };

  const handleEditCompany = (company: any) => {
    setEditingCompany(company);
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async (companyData: any) => {
    try {
      const url = editingCompany ? '/api/super-admin/companies' : '/api/super-admin/companies';
      const method = editingCompany ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData)
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage({type: 'success', text: editingCompany ? 'Şirket güncellendi' : 'Şirket oluşturuldu'});
        setShowCompanyModal(false);
        setEditingCompany(null);
        // Refresh stats
        loadStatistics();
      } else {
        setMessage({type: 'error', text: data.message || 'İşlem başarısız'});
      }
    } catch (error) {
      console.error('Şirket kaydedilirken hata:', error);
      setMessage({type: 'error', text: 'Şirket kaydedilirken hata oluştu'});
    }
  };

  const handleDeleteCompany = async (companyId: number) => {
    if (!confirm('Bu şirketi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/companies?companyId=${companyId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage({type: 'success', text: 'Şirket silindi'});
        // Refresh stats
        loadStatistics();
      } else {
        setMessage({type: 'error', text: data.message || 'Şirket silinirken hata oluştu'});
      }
    } catch (error) {
      console.error('Şirket silinirken hata:', error);
      setMessage({type: 'error', text: 'Şirket silinirken hata oluştu'});
    }
  };

  const handleViewModules = (companyId: number) => {
    // TODO: Implement module view
    console.log('View modules for company:', companyId);
  };

  return (
    <SuperAdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="p-4">
          {/* Header - Compact */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sistem Yönetimi</h1>
                    <p className="text-gray-600 text-sm">Tüm sistem bileşenlerini yönetin ve izleyin</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Son güncelleme</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date().toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}


          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {activeTab === 'dashboard' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Sistem İstatistikleri</h2>
                    <p className="text-gray-600 text-sm">Sistem genelinde önemli metrikleri görüntüleyin</p>
                  </div>
                  <button
                    onClick={loadStatistics}
                    disabled={loading}
                    className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{loading ? 'Yükleniyor...' : 'Yenile'}</span>
                  </button>
                </div>
                
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">İstatistikler yükleniyor...</p>
                    </div>
                  </div>
                ) : stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 mb-1">Toplam Şirket</p>
                          <p className="text-3xl font-bold text-blue-900">{stats.total_companies}</p>
                          <p className="text-xs text-blue-500 mt-1">Aktif şirketler</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-1">Toplam Kullanıcı</p>
                          <p className="text-3xl font-bold text-green-900">{stats.total_users}</p>
                          <p className="text-xs text-green-500 mt-1">Kayıtlı kullanıcılar</p>
                        </div>
                        <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-600 mb-1">Toplam Modül</p>
                          <p className="text-3xl font-bold text-purple-900">{stats.total_modules}</p>
                          <p className="text-xs text-purple-500 mt-1">Mevcut modüller</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-orange-600 mb-1">Aktif Plan</p>
                          <p className="text-3xl font-bold text-orange-900">{stats.active_plans}</p>
                          <p className="text-xs text-orange-500 mt-1">Aktif abonelikler</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">İstatistikler yüklenemedi</p>
                </div>
              )}

                  {/* Recent Activity */}
                  {stats && stats.recent_activity && stats.recent_activity.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Son Aktiviteler</h3>
                        <span className="text-sm text-gray-500">Son 24 saat</span>
                      </div>
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                        <div className="space-y-4">
                          {stats.recent_activity.slice(0, 5).map((activity, index) => (
                            <div key={activity.id} className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                              <div className="flex items-center space-x-4">
                                <div className={`w-3 h-3 rounded-full ${
                                  index === 0 ? 'bg-green-500' : 
                                  index === 1 ? 'bg-blue-500' : 
                                  index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}></div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                                  <p className="text-xs text-gray-500">
                                    {activity.user_name} • {activity.company_name}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-gray-400">
                                  {new Date(activity.created_at).toLocaleTimeString('tr-TR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <p className="text-xs text-gray-500">
                                  {new Date(activity.created_at).toLocaleDateString('tr-TR')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Şirket Yönetimi</h2>
                  <p className="text-gray-600">Sistemdeki tüm şirketleri yönetin</p>
                </div>
                <button 
                  onClick={handleCreateCompany}
                  className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Yeni Şirket</span>
                </button>
              </div>
              <CompaniesTable
                onEdit={handleEditCompany}
                onDelete={handleDeleteCompany}
                onViewModules={handleViewModules}
              />
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Modül Yönetimi</h2>
                  <p className="text-gray-600">Sistem modüllerini yönetin ve yapılandırın</p>
                </div>
                <button className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Yeni Modül</span>
                </button>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-12 text-center border border-purple-200">
                <div className="w-16 h-16 bg-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-purple-900 mb-2">Modül Yönetimi</h3>
                <p className="text-purple-600 mb-4">Modül yönetimi bileşeni geliştiriliyor...</p>
                <p className="text-sm text-purple-500">Yakında kullanıma sunulacak</p>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Kullanıcı Yönetimi</h2>
                  <p className="text-gray-600">Tüm kullanıcıları yönetin ve yetkilendirin</p>
                </div>
                <button className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Yeni Kullanıcı</span>
                </button>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-12 text-center border border-orange-200">
                <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-orange-900 mb-2">Kullanıcı Yönetimi</h3>
                <p className="text-orange-600 mb-4">Kullanıcı yönetimi bileşeni geliştiriliyor...</p>
                <p className="text-sm text-orange-500">Yakında kullanıma sunulacak</p>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Yönetimi</h2>
                  <p className="text-gray-600">Abonelik planlarını yönetin ve fiyatlandırın</p>
                </div>
                <button className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Yeni Plan</span>
                </button>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-12 text-center border border-indigo-200">
                <div className="w-16 h-16 bg-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-indigo-900 mb-2">Plan Yönetimi</h3>
                <p className="text-indigo-600 mb-4">Plan yönetimi bileşeni geliştiriliyor...</p>
                <p className="text-sm text-indigo-500">Yakında kullanıma sunulacak</p>
              </div>
            </div>
          )}
          </div>

          {/* Company Modal */}
          <CompanyModal
            isOpen={showCompanyModal}
            onClose={() => {
              setShowCompanyModal(false);
              setEditingCompany(null);
            }}
            onSave={handleSaveCompany}
            company={editingCompany}
            title={editingCompany ? 'Şirket Düzenle' : 'Yeni Şirket Ekle'}
          />
        </div>
      </div>
    </SuperAdminLayout>
  );
}

export default function SuperAdmin() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SuperAdminContent />
    </Suspense>
  );
}
