'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { sendSecureProxyRequest } from '../utils/api';

export default function TestApiPage() {
  // Input state'leri
  const [query, setQuery] = useState('SELECT TOP 10 * FROM YOUR_TABLE');
  const [connectionType, setConnectionType] = useState('first_db_key');
  const [endpoint, setEndpoint] = useState('https://api.btrapor.com/proxy');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Parola koruması için state'ler
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(true);

  const router = useRouter();

  // Authentication kontrolü (oturum yoksa login'e yönlendir)
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
      router.push('/login');
      return;
    }
    
    // Parola doğrulaması yapılmış mı kontrol et
    const apiTestAuth = localStorage.getItem('apiTestAuth');
    if (apiTestAuth === 'true') {
      setIsAuthenticated(true);
      setShowPasswordForm(false);
    }
  }, [router]);

  // Parola doğrulama fonksiyonu
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Ozt129103') {
      setIsAuthenticated(true);
      setShowPasswordForm(false);
      localStorage.setItem('apiTestAuth', 'true');
    } else {
      alert('Yanlış parola!');
      setPassword('');
    }
  };

  const handleSendRequest = async () => {
    if (!query.trim()) {
      alert('SQL sorgusu boş olamaz');
      return;
    }

    const companyRef = localStorage.getItem('companyRef');
    if (!companyRef) {
      alert('CompanyRef bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const response = await sendSecureProxyRequest(
        companyRef,
        connectionType,
        { query },
        endpoint,
        180000 // 3 dakika timeout
      );

      if (!response.ok) {
        const errText = await response.text();
        setResult(`HTTP ${response.status} - ${errText}`);
        return;
      }

      const json = await response.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (error: any) {
      setResult(`Hata: ${error.message || error.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      alert('Sonuç kopyalandı');
    } catch (e) {
      alert('Kopyalama başarısız');
    }
  };

  return (
    <DashboardLayout title="Test API">
      {showPasswordForm ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-white p-8 rounded-lg shadow-lg border max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">🔒 API Test Sayfası</h1>
              <p className="text-gray-600">Bu sayfaya erişmek için parola gerekli</p>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Parola
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Parolayı girin"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                Giriş Yap
              </button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => router.push('/')}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Test API</h1>
            <button
              onClick={() => {
                localStorage.removeItem('apiTestAuth');
                setShowPasswordForm(true);
                setIsAuthenticated(false);
              }}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Çıkış Yap
            </button>
          </div>

          <div className="space-y-2">
            <label className="block font-medium">Connection Tipi</label>
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="first_db_key">first_db_key (Ana DB)</option>
              <option value="second_db_key">second_db_key (İkinci DB)</option>
              <option value="enpos_db_key">enpos_db_key (ENPOS DB)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block font-medium">Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-medium">SQL Sorgusu</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-40 border rounded p-2 font-mono text-sm"
            />
          </div>

          <button
            onClick={handleSendRequest}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Gönderiliyor...' : 'Gönder'}
          </button>

          {result && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold">Sonuç</h2>
                <button
                  onClick={handleCopyResult}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Kopyala
                </button>
              </div>
              <pre className="bg-gray-100 p-4 rounded max-h-96 overflow-auto text-xs">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
} 