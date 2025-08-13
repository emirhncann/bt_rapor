'use client';

import { useState } from 'react';
import { encryptPayloadSecure } from '../utils/api';

interface FileReadResult {
  success: boolean;
  data?: any;
  content?: string;
  xmlContent?: string;
  error?: string;
}

export default function AkaryakitTestPage() {
  const [filePath, setFilePath] = useState<string>('C:\\temp\\akaryakit\\data.xml');
  const [isReading, setIsReading] = useState<boolean>(false);
  const [result, setResult] = useState<FileReadResult | null>(null);
  const [companyRef, setCompanyRef] = useState<string>('1');

  const readAkaryakitFile = async (filePath: string) => {
    if (!filePath.trim()) {
      setResult({ success: false, error: 'Dosya yolu boş olamaz' });
      return;
    }

    setIsReading(true);
    setResult(null);

    try {
      // Module ve payload verilerini hazırla
      const moduleData = { id: 2, mode: 'offline' };
      const payloadData = { filePath: filePath };

      console.log('🔍 === AKARYAKIT DOSYA OKUMA TEST ===');
      console.log('📍 Company Ref:', companyRef);
      console.log('📁 Dosya Yolu:', filePath);
      console.log('🔧 Module Data (şifresiz):', moduleData);
      console.log('📦 Payload Data (şifresiz):', payloadData);

      // Verileri şifrele
      const encryptedModule = await encryptPayloadSecure(moduleData, companyRef);
      const encryptedPayload = await encryptPayloadSecure(payloadData, companyRef);

      console.log('🔐 Encrypted Module:', encryptedModule);
      console.log('🔐 Encrypted Payload:', encryptedPayload);

      // Request body'yi oluştur
      const requestBody = {
        companyRef: companyRef,
        encryptedModule: encryptedModule,
        encryptedPayload: encryptedPayload,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };

      console.log('📤 Request Body (şifresiz):', requestBody);
      console.log('📤 Request Body (şifreli):', {
        ...requestBody,
        encryptedModule: encryptedModule.substring(0, 50) + '...',
        encryptedPayload: encryptedPayload.substring(0, 50) + '...'
      });

      // İsteği gönder
      const response = await fetch('https://api.btrapor.com/akaryakit-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Company-Ref': companyRef
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response Status:', response.status);
      console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Hatası:', errorText);
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 Response Data:', result);

      // Sonucu işle
      let processedResult: FileReadResult = { success: true };

      if (result.data?.content) {
        processedResult.data = result.data.content;
        processedResult.content = result.data.content;
      } else if (result.data?.xmlContent) {
        processedResult.data = result.data.xmlContent;
        processedResult.xmlContent = result.data.xmlContent;
      } else if (result.content) {
        processedResult.data = result.content;
        processedResult.content = result.content;
      } else {
        processedResult.data = result;
      }

      setResult(processedResult);
      console.log('✅ Dosya okuma başarılı:', processedResult);

    } catch (error) {
      console.error('❌ Dosya okuma hatası:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });
    } finally {
      setIsReading(false);
    }
  };

  const handleTestRead = () => {
    readAkaryakitFile(filePath);
  };

  const handleClearResult = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🔧 Akaryakıt Dosya Okuma Test Sayfası
          </h1>

          {/* Test Ayarları */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">Test Ayarları</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Ref
                </label>
                <input
                  type="text"
                  value={companyRef}
                  onChange={(e) => setCompanyRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dosya Yolu
                </label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="C:\temp\akaryakit\data.xml"
                />
              </div>
            </div>
          </div>

          {/* Test Butonları */}
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={handleTestRead}
              disabled={isReading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isReading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Dosya Okunuyor...
                </>
              ) : (
                <>
                  📖 Dosya Oku
                </>
              )}
            </button>

            <button
              onClick={handleClearResult}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              🗑️ Sonucu Temizle
            </button>

            <button
              onClick={() => setFilePath('C:\\temp\\akaryakit\\data.xml')}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              📁 Test Dosyası
            </button>
          </div>

          {/* Sonuç */}
          {result && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {result.success ? '✅ Başarılı' : '❌ Hata'}
              </h2>

              {result.success ? (
                <div className="space-y-4">
                  {/* XML Content */}
                  {result.xmlContent && (
                    <div>
                      <h3 className="text-md font-medium text-gray-700 mb-2">XML İçerik:</h3>
                      <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                          {result.xmlContent}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Regular Content */}
                  {result.content && !result.xmlContent && (
                    <div>
                      <h3 className="text-md font-medium text-gray-700 mb-2">İçerik:</h3>
                      <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                          {result.content}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Raw Data */}
                  <div>
                    <h3 className="text-md font-medium text-gray-700 mb-2">Ham Veri:</h3>
                    <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Hata:</p>
                  <p className="text-red-700 mt-1">{result.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Bilgi */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-md font-medium text-yellow-800 mb-2">ℹ️ Test Bilgileri</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Endpoint: <code className="bg-yellow-100 px-1 rounded">https://api.btrapor.com/akaryakit-proxy</code></li>
              <li>• Hedef: <code className="bg-yellow-100 px-1 rounded">http://PUBLIC_IP/sql/akaryakit</code></li>
              <li>• Şifreleme: AES-GCM ile şifrelenmiş module ve payload</li>
              <li>• Module: <code className="bg-yellow-100 px-1 rounded">{'{ id: 2, mode: "offline" }'}</code></li>
              <li>• Payload: <code className="bg-yellow-100 px-1 rounded">{'{ filePath: "..." }'}</code></li>
              <li>• Console'da şifreli ve şifresiz verileri görebilirsiniz</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
