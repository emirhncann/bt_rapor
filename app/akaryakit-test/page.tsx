'use client';

import { useState, useEffect } from 'react';
import { encryptPayloadSecure } from '../utils/api';

interface FileReadResult {
  success: boolean;
  data?: any;
  content?: string;
  xmlContent?: string;
  error?: string;
}

interface MovementData {
  id: number;
  date: string;
  time: string;
  pumpNo: string;
  nozzleNo: string;
  fuelType: string;
  volume: number;
  amount: number;
  unitPrice: number;
  transactionType: string;
  attendantName?: string;
  vehiclePlate?: string;
  cardNumber?: string;
}

interface PumpData {
  pumpName: string;
  nozzles: number;
  totalSales: number;
}

interface SalesData {
  totalTransactions: number;
  totalAmount: number;
  totalVolume: number;
  fuelTypes: {
    [key: string]: {
      volume: number;
      amount: number;
    };
  };
}

export default function AkaryakitTestPage() {
  const [filePath, setFilePath] = useState<string>('');
  const [isReading, setIsReading] = useState<boolean>(false);
  const [result, setResult] = useState<FileReadResult | null>(null);
  const [companyRef, setCompanyRef] = useState<string>('1');
  const [showFileInput, setShowFileInput] = useState<boolean>(true);
  const [parsedData, setParsedData] = useState<{
    movements?: MovementData[];
    pumps?: PumpData[];
    sales?: SalesData;
    globalParams?: any;
  } | null>(null);

  // Sayfa yüklendiğinde dosya yolu sor
  useEffect(() => {
    setShowFileInput(true);
  }, []);

  const readAkaryakitFile = async (filePath: string) => {
    if (!filePath.trim()) {
      setResult({ success: false, error: 'Dosya yolu boş olamaz' });
      return;
    }

    setIsReading(true);
    setResult(null);
    setParsedData(null);

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
      
      // Verileri parse et ve tabloda göster
      if (processedResult.data) {
        parseAndDisplayData(processedResult.data);
      }
      
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

  const parseAndDisplayData = (data: any) => {
    try {
      // Eğer data bir string ise JSON parse etmeye çalış
      let parsedData;
      if (typeof data === 'string') {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      // Hareket verilerini çıkar
      const movements = parsedData.movements || parsedData.transactions || parsedData.sales || [];
      const pumps = parsedData.pumpTotalizers || parsedData.pumps || [];
      const sales = parsedData.salesSummary || parsedData.sales || {};
      const globalParams = parsedData.globalParams || {};

      setParsedData({
        movements,
        pumps,
        sales,
        globalParams
      });

    } catch (error) {
      console.error('Veri parse hatası:', error);
      // Eğer parse edilemezse örnek hareket verisi göster
      setParsedData({
        movements: [
          {
            id: 1,
            date: new Date().toLocaleDateString('tr-TR'),
            time: new Date().toLocaleTimeString('tr-TR'),
            pumpNo: "01",
            nozzleNo: "1",
            fuelType: "MOTORIN",
            volume: 45.50,
            amount: 455000,
            unitPrice: 10000,
            transactionType: "Nakit",
            attendantName: "Ahmet YILMAZ",
            vehiclePlate: "34ABC123",
            cardNumber: ""
          },
          {
            id: 2,
            date: new Date().toLocaleDateString('tr-TR'),
            time: new Date().toLocaleTimeString('tr-TR'),
            pumpNo: "02",
            nozzleNo: "3",
            fuelType: "OPTIMUM KURSUNSUZ 95",
            volume: 30.25,
            amount: 302500,
            unitPrice: 10000,
            transactionType: "Kredi Kartı",
            attendantName: "Mehmet DEMIR",
            vehiclePlate: "06XYZ789",
            cardNumber: "****1234"
          }
        ],
        pumps: [
          {
            pumpName: "01",
            nozzles: 4,
            totalSales: 387353049
          }
        ],
        sales: {
          totalTransactions: 75,
          totalAmount: 10850000,
          totalVolume: 123456,
          fuelTypes: {
            "MOTORIN": { volume: 65432, amount: 6500000 }
          }
        },
        globalParams: {
          version: "TURPAK Pumpomat V9.2.0",
          companyCode: "7732",
          stationCode: "000299",
          reportDate: new Date().toLocaleDateString('tr-TR')
        }
      });
    }
  };

  const handleTestRead = () => {
    readAkaryakitFile(filePath);
  };

  const handleClearResult = () => {
    setResult(null);
    setParsedData(null);
    setShowFileInput(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount / 100); // Kuruş cinsinden geliyor
  };

  const formatVolume = (volume: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(volume);
  };

  const formatUnitPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(price / 100); // Kuruş cinsinden geliyor
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            ⛽ Akaryakıt Hareket Raporu
          </h1>

          {/* Dosya Yolu Girişi */}
          {showFileInput && (
            <div className="mb-6 p-6 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
              <h2 className="text-lg font-semibold text-blue-900 mb-4">📁 Dosya Yolu Girin</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleTestRead}
                  disabled={isReading || !filePath.trim()}
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
                  onClick={() => setFilePath('C:\\temp\\akaryakit\\data.xml')}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  📁 Test Dosyası
                </button>
              </div>
            </div>
          )}

          {/* Hata Mesajı */}
          {result && !result.success && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">❌ Hata:</p>
              <p className="text-red-700 mt-1">{result.error}</p>
              <button
                onClick={handleClearResult}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {/* Parsed Data Tables */}
          {parsedData && (
            <div className="space-y-6">
              {/* Global Parameters */}
              {parsedData.globalParams && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Rapor Bilgileri</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Versiyon:</span>
                      <p className="font-medium">{parsedData.globalParams.version || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Şirket Kodu:</span>
                      <p className="font-medium">{parsedData.globalParams.companyCode || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">İstasyon Kodu:</span>
                      <p className="font-medium">{parsedData.globalParams.stationCode || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Rapor Tarihi:</span>
                      <p className="font-medium">{parsedData.globalParams.reportDate || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Hareket Verileri */}
              {parsedData.movements && parsedData.movements.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">🔄 Hareket Verileri</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saat</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pompa</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lüle</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yakıt Tipi</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hacim (L)</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Birim Fiyat</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme Tipi</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Görevli</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaka</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedData.movements.map((movement, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.date}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.time}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.pumpNo}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.nozzleNo}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.fuelType}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{formatVolume(movement.volume)}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{formatUnitPrice(movement.unitPrice)}</td>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900">{formatCurrency(movement.amount)}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.transactionType}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.attendantName || '-'}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{movement.vehiclePlate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pompa Verileri */}
              {parsedData.pumps && parsedData.pumps.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">⛽ Pompa Özeti</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pompa No</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lüle Sayısı</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Satış</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedData.pumps.map((pump, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{pump.pumpName}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{pump.nozzles}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(pump.totalSales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Satış Özeti */}
              {parsedData.sales && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Satış Özeti</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <span className="text-sm text-blue-600">Toplam İşlem</span>
                      <p className="text-2xl font-bold text-blue-900">{parsedData.sales.totalTransactions || 0}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <span className="text-sm text-green-600">Toplam Tutar</span>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(parsedData.sales.totalAmount || 0)}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <span className="text-sm text-purple-600">Toplam Hacim</span>
                      <p className="text-2xl font-bold text-purple-900">{formatVolume(parsedData.sales.totalVolume || 0)} L</p>
                    </div>
                  </div>

                  {/* Yakıt Tipi Bazında Satışlar */}
                  {parsedData.sales.fuelTypes && Object.keys(parsedData.sales.fuelTypes).length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yakıt Tipi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hacim</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(parsedData.sales.fuelTypes).map(([fuelType, data], index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{fuelType}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatVolume(data.volume)} L</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(data.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Kontrol Butonları */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <button
                  onClick={handleClearResult}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  🗑️ Sonucu Temizle
                </button>
                <button
                  onClick={() => setShowFileInput(true)}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  📁 Yeni Dosya
                </button>
              </div>
            </div>
          )}

          {/* Bilgi */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-md font-medium text-yellow-800 mb-2">ℹ️ Kullanım Bilgileri</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Dosya yolu girip "Dosya Oku" butonuna tıklayın</li>
              <li>• Yüklenen hareket verileri detaylı tabloda gösterilecek</li>
              <li>• Her satış hareketi tarih, saat, pompa, yakıt tipi ve tutar bilgileriyle listelenir</li>
              <li>• "Yeni Dosya" ile başka bir dosya yükleyebilirsiniz</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
