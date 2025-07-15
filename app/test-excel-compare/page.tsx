'use client';

import React, { useState } from 'react';

export default function TestExcelCompare() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testAPI = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test için basit bir Excel dosyası oluştur
      const testData = [
        ['Fatura No', 'Gönderici VKN', 'Alıcı VKN', 'Toplam Tutar', 'Vergi Hariç Tutar', 'KDV Toplamı', 'Fatura Tarihi', 'Gönderici Adı', 'Tür'],
        ['TEST001', '1234567890', '0987654321', 1000, 900, 100, '01.01.2024', 'Test Firma A', 'Satış'],
        ['TEST002', '1234567890', '0987654321', 2000, 1800, 200, '02.01.2024', 'Test Firma A', 'Satış']
      ];

      // CSV formatında test verisi oluştur
      const csvContent = testData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'test.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('excelFile', file);

      console.log('🧪 Test API çağrısı başlatılıyor...');

      const response = await fetch('/api/excel-compare', {
        method: 'POST',
        body: formData,
        headers: {
          'firma-no': '005',
          'donem-no': '01',
          'logo-db': 'GOWINGS',
          'company-ref': '1'
        }
      });

      console.log('📡 API yanıtı:', response.status, response.statusText);

      const data = await response.json();
      console.log('📊 API verisi:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setResult(data);
    } catch (err) {
      console.error('❌ Test hatası:', err);
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Excel Karşılaştırma API Test
          </h1>

          <div className="mb-6">
            <button
              onClick={testAPI}
              disabled={isLoading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Test Ediliyor...' : 'API Test Et'}
            </button>
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sonuç */}
          {result && (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-green-800 mb-4">Test Sonucu</h3>
                <pre className="bg-white p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Test Bilgileri */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Test Bilgileri</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Test dosyası: CSV formatında 2 test faturası</li>
              <li>• Firma No: 005</li>
              <li>• Dönem No: 01</li>
              <li>• LOGO DB: GOWINGS</li>
              <li>• Company Ref: 1</li>
              <li>• Connection Type: first_db_key</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 