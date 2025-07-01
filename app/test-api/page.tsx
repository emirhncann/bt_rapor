'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';

export default function TestApi() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyRef, setCompanyRef] = useState('');
  const router = useRouter();

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      const storedCompanyRef = localStorage.getItem('companyRef');
      
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        setCompanyRef(storedCompanyRef || '3');
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  // API test
  const testApi = async () => {
    if (!companyRef) {
      setError('Company Ref bulunamadı');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 API test ediliyor:', `https://api.btrapor.com/reports-by-company/${companyRef}`);
      
      const response = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
      const data = await response.json();
      
      console.log('✅ API Response:', data);
      setApiResponse(data);
      
    } catch (err: any) {
      console.error('❌ API Hatası:', err);
      setError(`API Hatası: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı yetki testi
  const testUserPermissions = async () => {
    if (!companyRef) {
      setError('Company Ref bulunamadı');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setError('Kullanıcı bilgisi bulunamadı');
        return;
      }

      console.log('🔐 Kullanıcı yetkileri test ediliyor...');
      
      // Kullanıcının tüm raporlarını çek
      const userReports = await fetchUserReports(companyRef, currentUser.id);
      
      // Yetki durumunu analiz et
      const permissionAnalysis = {
        user: {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role
        },
        companyRef,
        totalReports: userReports.length,
        accessibleReports: userReports.filter(r => r.has_access).length,
        deniedReports: userReports.filter(r => !r.has_access).length,
        reports: userReports.map(report => ({
          id: report.id,
          name: report.report_name,
          description: report.report_description,
          route: report.route_path,
          category: report.category,
          icon: report.icon,
          hasAccess: report.has_access,
          status: report.has_access ? '✅ Erişebilir' : '❌ Erişemez'
        })),
        testTime: new Date().toLocaleString('tr-TR')
      };
      
      console.log('✅ Yetki Analizi:', permissionAnalysis);
      setApiResponse(permissionAnalysis);
      
    } catch (err: any) {
      console.error('❌ Yetki Test Hatası:', err);
      setError(`Yetki Test Hatası: ${err.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex flex-col items-center justify-center">
            <svg className="animate-spin h-12 w-12 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-700 font-medium text-lg mt-4">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout title="API Test">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">API Entegrasyon Testi</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Ref
              </label>
              <input
                type="text"
                value={companyRef}
                onChange={(e) => setCompanyRef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="3"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={testApi}
                disabled={loading}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Test Ediliyor...' : '📊 Raporları Test Et'}
              </button>
              
              <button
                onClick={testUserPermissions}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Test Ediliyor...' : '🔐 Yetkileri Test Et'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {apiResponse && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">API Response:</h3>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
} 