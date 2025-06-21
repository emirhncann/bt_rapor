'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import CBakiyeTable from '../components/tables/c_bakiye_table';
import DashboardLayout from '../components/DashboardLayout';

export default function CBakiye() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  
  // Animation data'yı yükleyelim
  const [animationData, setAnimationData] = useState(null);
  
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

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/animations/rapor.json')
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.log('Animation yüklenemedi:', err));
    }
  }, [isAuthenticated]);

  // Güvenli sayı parse fonksiyonu
  const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  const fetchSqlData = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:45678/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionString: "Server=192.168.1.101;Database=LOGODB;User Id=sa;Password=Ozt129103;",
         // connectionString: "Server=192.168.2.100;Database=GOWINGS;User Id=sa;Password=Ozt129103;",
          query: `
      SELECT CLCARD.LOGICALREF, CLCARD.CODE AS KODU, CLCARD.DEFINITION_ AS ÜNVANI, SUM((1 - CLFLINE.SIGN) * CLFLINE.AMOUNT) AS BORÇ, SUM(CLFLINE.SIGN * CLFLINE.AMOUNT) AS ALACAK, CAST(SUM((1 - CLFLINE.SIGN) * CLFLINE.AMOUNT) - SUM(CLFLINE.SIGN * CLFLINE.AMOUNT) AS DECIMAL(18,2)) AS BAKIYE FROM LG_009_01_CLFLINE CLFLINE RIGHT JOIN LG_009_CLCARD CLCARD ON CLFLINE.CLIENTREF = CLCARD.LOGICALREF WHERE CLFLINE.CANCELLED = 0 AND CLFLINE.TRCURR = 0 GROUP BY CLCARD.LOGICALREF, CLCARD.CODE, CLCARD.DEFINITION_, CLCARD.ACTIVE HAVING CLCARD.CODE LIKE '%' AND CLCARD.DEFINITION_ LIKE '%' AND CLCARD.ACTIVE = 0 ORDER BY CLCARD.DEFINITION_
    `
        })
      });
      const jsonData = await response.json();
      
      // localhost:45678'den gelen data formatını kontrol et
      console.log('Gelen data:', jsonData);
      
      // Error kontrolü
      if (jsonData.status === 'error') {
        console.error('Server hatası:', jsonData.message);
        alert(`Veritabanı hatası: ${jsonData.message}`);
        setData([]);
        return;
      }
      
      // Eğer data array değilse, uygun formata çevir
      if (Array.isArray(jsonData)) {
        setData(jsonData);
      } else if (jsonData && Array.isArray(jsonData.data)) {
        setData(jsonData.data);
      } else if (jsonData && Array.isArray(jsonData.recordset)) {
        setData(jsonData.recordset);
      } else {
        console.error('Beklenmeyen data formatı:', jsonData);
        setData([]);
      }
    } catch (error) {
      console.error('Veri çekme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Authentication kontrolü devam ediyorsa loading göster
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
            <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
          </div>
        </div>
      </div>
    );
  }

  // Eğer kullanıcı authenticated değilse, login sayfasına yönlendirme zaten yapıldı
  if (!isAuthenticated) {
    return null;
  }

  // Bakiye sütun adını bul
  const getBakiyeColumnName = () => {
    if (!Array.isArray(data) || data.length === 0) return 'BAKİYE';
    const keys = Object.keys(data[0]);
    return keys.find(key => 
      key === 'BAKİYE' || key === 'BAKIYE' || 
      key.includes('BAKIYE') || key.includes('BAKİYE')
    ) || 'BAKİYE';
  };

  return (
    <DashboardLayout title="Cari Bakiye Raporu">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center justify-center">
              {animationData ? (
                <Lottie 
                  animationData={animationData}
                  style={{ height: 150, width: 150 }}
                  loop={true}
                  autoplay={true}
                />
              ) : (
                <svg className="animate-spin h-12 w-12 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <p className="text-gray-700 font-medium text-lg mt-4">Rapor hazırlanıyor...</p>
              <p className="text-gray-500 text-sm mt-2">Lütfen bekleyiniz</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-red-800 to-red-900 rounded-lg shadow-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/img/btRapor.png" 
                alt="btRapor Logo" 
                className="h-16 w-auto mr-6 bg-white rounded-lg p-2"
              />
              <div>
                <h2 className="text-3xl font-bold mb-2">Hoş Geldiniz!</h2>
                <p className="text-red-100 text-lg">BT Rapor - Cari Bakiye Analiz Sistemi</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-red-100 text-sm">Bugün</p>
                <p className="text-xl font-semibold">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Müşteri</p>
                <p className="text-2xl font-semibold text-gray-900">{Array.isArray(data) ? data.length : 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Alacak</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Array.isArray(data) ? data.reduce((sum, item) => sum + safeParseFloat(item.ALACAK), 0).toLocaleString('tr-TR', { 
                    style: 'currency', 
                    currency: 'TRY',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) : '₺0,00'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Toplam Borç</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Array.isArray(data) ? data.reduce((sum, item) => sum + safeParseFloat(item.BORÇ), 0).toLocaleString('tr-TR', { 
                    style: 'currency', 
                    currency: 'TRY',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }) : '₺0,00'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Net Bakiye</p>
                <p className={`text-2xl font-semibold ${
                  (() => {
                    if (!Array.isArray(data)) return 'text-gray-900';
                    const netBakiye = data.reduce((sum, item) => sum + safeParseFloat(item[getBakiyeColumnName()]), 0);
                    return netBakiye < 0 ? 'text-red-600' : netBakiye > 0 ? 'text-green-600' : 'text-gray-900';
                  })()
                }`}>
                  {(() => {
                    if (!Array.isArray(data)) return '₺0,00';
                    const netBakiye = data.reduce((sum, item) => sum + safeParseFloat(item[getBakiyeColumnName()]), 0);
                    const formattedAmount = Math.abs(netBakiye).toLocaleString('tr-TR', { 
                      style: 'currency', 
                      currency: 'TRY',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    });
                    
                    if (netBakiye === 0) {
                      return formattedAmount;
                    }
                    
                    const indicator = netBakiye < 0 ? '(A)' : '(B)';
                    return `${formattedAmount} ${indicator}`;
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Cari Hesap Raporu</h3>
              <p className="text-sm text-gray-500">Müşteri hesap bakiyelerini görüntüleyin ve analiz edin</p>
            </div>
      <button
        onClick={fetchSqlData}
        disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-red-800 to-red-900 text-white font-medium rounded-lg shadow hover:from-red-900 hover:to-red-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Raporu Yenile
                </>
              )}
      </button>
          </div>
        </div>

        {/* Data Table */}
      {loading ? (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="flex flex-col items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-red-800 mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Veriler yükleniyor...</p>
            </div>
          </div>
      ) : Array.isArray(data) && data.length > 0 ? (
        <CBakiyeTable data={data} />
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