'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
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
  fileName?: string;
  fileType?: string;
  fisNo?: string;
  km?: number;
  kodu?: string;
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

export default function AkaryakitPage() {
  const [filePath, setFilePath] = useState<string>('');
  const [isReading, setIsReading] = useState<boolean>(false);
  const [result, setResult] = useState<FileReadResult | null>(null);
  const [companyRef, setCompanyRef] = useState<string>('1');
  const [showFileInput, setShowFileInput] = useState<boolean>(true);
  const [selectedFileType, setSelectedFileType] = useState<string>('xml');
  const [parsedData, setParsedData] = useState<{
    movements?: MovementData[];
    pumps?: PumpData[];
    sales?: SalesData;
    globalParams?: any;
  } | null>(null);

  // Desteklenen dosya tipleri
  const supportedFileTypes = [
    { value: 'xml', label: 'XML Dosyası (.xml)', extension: '.xml' },
    { value: 'txt', label: 'Metin Dosyası (.txt)', extension: '.txt' },
    { value: 'd1a', label: 'D1A Dosyası (.d1a)', extension: '.d1a' },
    { value: 'd1b', label: 'D1B Dosyası (.d1b)', extension: '.d1b' },
    { value: 'd1c', label: 'D1C Dosyası (.d1c)', extension: '.d1c' },
    { value: 'f1d', label: 'F1D Dosyası (.f1d)', extension: '.f1d' }
  ];

     // Sayfa yüklendiğinde dosya yolu sor
   useEffect(() => {
     console.log('🔍 Sayfa yüklendi, showFileInput true yapılıyor');
     setShowFileInput(true);
   }, []);

  const readAkaryakitFile = async (filePath: string, fileType: string) => {
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
      const payloadData = { 
        filePath: filePath,
        fileType: fileType 
      };

      console.log('🔍 === AKARYAKIT DOSYA OKUMA ===');
      console.log('📍 Company Ref:', companyRef);
      console.log('📁 Dosya Yolu:', filePath);
      console.log('📄 Dosya Tipi:', fileType);
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

       console.log('Raw result:', result);

       if (result.content) {
         // D1A ve diğer text formatları için
         processedResult.data = result.content;
         processedResult.content = result.content;
       } else if (result.data?.content) {
         processedResult.data = result.data.content;
         processedResult.content = result.data.content;
       } else if (result.data?.xmlContent) {
         processedResult.data = result.data.xmlContent;
         processedResult.xmlContent = result.data.xmlContent;
       } else {
         processedResult.data = result;
       }

      setResult(processedResult);
      
             // Verileri parse et ve tabloda göster
       console.log('🔍 Processed Result Data:', processedResult.data);
       console.log('🔍 File Type:', fileType);
       console.log('🔍 File Path:', filePath);
       
       if (processedResult.data) {
         parseAndDisplayData(processedResult.data, fileType, filePath);
        } else {
         console.error('❌ Processed result data is empty!');
         setParsedData({
           movements: [],
           pumps: [],
           sales: {
             totalTransactions: 0,
             totalAmount: 0,
             totalVolume: 0,
             fuelTypes: {}
           },
           globalParams: {}
         });
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

  const parseAndDisplayData = (data: any, fileType: string, filePath: string) => {
    try {
      // Dosya adını çıkar
      const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'Bilinmeyen';

      let movements: any[] = [];
      let pumps: any[] = [];
      let sales: any = {};
      let globalParams: any = {};

             // D1A dosya formatı için özel parse
       if (fileType === 'd1a' && typeof data === 'string') {
         console.log('🔍 D1A Parse başlıyor...');
         console.log('🔍 Raw data:', data);
         
         const lines = data.split('\r\n').filter(line => line.trim());
         
         console.log('🔍 D1A Lines:', lines);
         console.log('🔍 Lines length:', lines.length);
         
         // İlk satır zaman damgası, ikinci satır başlık, veriler 3. satırdan başlıyor
         const dataLines = lines.slice(2);
         console.log('🔍 Data Lines:', dataLines);
         console.log('🔍 Data Lines length:', dataLines.length);
         
         movements = dataLines.map((line: string, index: number) => {
           console.log('Processing line:', line);
           
           // D1A formatı: TARIH SAAT FILO_ADI KODU PLAKA YAKIT LITRE FYT TUTAR TBNCPU FIS_NO PLAKA YK_FNO KM AMR_GIRIS
           const parts = line.split(/\s+/);
           
           console.log('Parts:', parts);
           
           if (parts.length >= 13) {
             const tarih = parts[0];
             const saat = parts[1];
             
             // FILO ADI kısmını bul - KODU'dan önceki tüm kısım
             let filoAdi = "";
             let koduIndex = -1;
             
             // KODU'yu bul (genellikle C ile başlayan 4-5 karakterli kod)
             for (let i = 2; i < parts.length - 11; i++) {
               if (parts[i].match(/^[A-Z]\d{3,4}$/)) {
                 koduIndex = i;
                 break;
               }
             }
             
             if (koduIndex > 2) {
               filoAdi = parts.slice(2, koduIndex).join(' ');
             }
             
             const kodu = koduIndex > 0 ? parts[koduIndex] : parts[parts.length - 12];
             const plaka = parts[parts.length - 11];
             const yakit = parts[parts.length - 10];
             const litre = parseFloat(parts[parts.length - 9]) || 0;
             const fyt = parseFloat(parts[parts.length - 8]) || 0;
             const tutar = parseFloat(parts[parts.length - 7]) || 0;
             const tbncpu = parts[parts.length - 6];
             const fisNo = parts[parts.length - 5];
             const plaka2 = parts[parts.length - 4];
             const ykFno = parts[parts.length - 3];
             const km = parseFloat(parts[parts.length - 2]) || 0;
             const amrGiris = parts[parts.length - 1];

             console.log('Parsed data:', {
               tarih, saat, filoAdi, kodu, plaka, yakit, litre, fyt, tutar,
               tbncpu, fisNo, plaka2, ykFno, km, amrGiris
             });

             return {
               id: index + 1,
               date: tarih,
               time: saat,
               pumpNo: tbncpu,
               nozzleNo: ykFno,
               fuelType: yakit,
               volume: litre,
               amount: tutar * 100, // Kuruş cinsine çevir
               unitPrice: fyt * 100, // Kuruş cinsine çevir
               transactionType: "Nakit",
               attendantName: filoAdi || "Bilinmeyen",
               vehiclePlate: plaka || plaka2,
               cardNumber: "",
               fileName: fileName,
               fileType: fileType.toUpperCase(),
               fisNo: fisNo,
               km: km,
               kodu: kodu
             };
           }
           return null;
                  }).filter(Boolean);

         console.log('🔍 Parsed movements:', movements);
         console.log('🔍 Movements length:', movements.length);

         // Satış özeti hesapla
         const totalTransactions = movements.length;
        const totalAmount = movements.reduce((sum, m) => sum + m.amount, 0);
        const totalVolume = movements.reduce((sum, m) => sum + m.volume, 0);

        // Yakıt tipi bazında grupla
        const fuelTypes: any = {};
        movements.forEach(m => {
          if (!fuelTypes[m.fuelType]) {
            fuelTypes[m.fuelType] = { volume: 0, amount: 0 };
          }
          fuelTypes[m.fuelType].volume += m.volume;
          fuelTypes[m.fuelType].amount += m.amount;
        });

        sales = {
          totalTransactions,
          totalAmount,
          totalVolume,
          fuelTypes
        };

        globalParams = {
          version: "D1A Format",
          companyCode: "D1A",
          stationCode: "D1A",
          reportDate: new Date().toLocaleDateString('tr-TR')
        };

      } else {
        // Diğer dosya formatları için mevcut parse
        let parsedData;
        if (typeof data === 'string') {
          parsedData = JSON.parse(data);
        } else {
          parsedData = data;
        }

        // Hareket verilerini çıkar
        const movementsData = parsedData.movements || parsedData.transactions || parsedData.sales || [];
        pumps = parsedData.pumpTotalizers || parsedData.pumps || [];
        sales = parsedData.salesSummary || parsedData.sales || {};
        globalParams = parsedData.globalParams || {};

        // Hareket verilerine dosya bilgilerini ekle
        movements = movementsData.map((movement: any, index: number) => ({
          ...movement,
          id: index + 1,
          fileName: fileName,
          fileType: fileType.toUpperCase()
        }));
      }

             console.log('🔍 Final parsed data:', {
         movements: movements.length,
         pumps: pumps.length,
         sales,
         globalParams
       });

       setParsedData({
         movements,
         pumps,
         sales,
         globalParams
       });

       console.log('✅ ParseAndDisplayData tamamlandı');

    } catch (error) {
      console.error('Veri parse hatası:', error);
      // Parse edilemezse boş veri göster
      setParsedData({
        movements: [],
        pumps: [],
        sales: {
          totalTransactions: 0,
          totalAmount: 0,
          totalVolume: 0,
          fuelTypes: {}
        },
        globalParams: {}
      });
    }
  };

  const handleTestRead = () => {
    readAkaryakitFile(filePath, selectedFileType);
  };

     const handleClearResult = () => {
     console.log('🔍 Clear Result çağrıldı');
     setResult(null);
     setParsedData(null);
     setShowFileInput(true);
     console.log('🔍 showFileInput true yapıldı');
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

  const getTestFilePath = (fileType: string) => {
    const basePath = 'C:\\temp\\akaryakit\\';
    const extensions = {
      'xml': 'data.xml',
      'txt': 'data.txt',
      'd1a': 'data.d1a',
      'd1b': 'data.d1b',
      'd1c': 'data.d1c',
      'f1d': 'data.f1d'
    };
    return basePath + (extensions[fileType as keyof typeof extensions] || 'data.xml');
  };

     return (
      <DashboardLayout title="Akaryakıt Raporu">
       <div className="p-6">
         <div className="max-w-7xl mx-auto">
           <div className="bg-white rounded-lg shadow-lg p-6">
             <h1 className="text-2xl font-bold text-gray-900 mb-6">
               ⛽ Akaryakıt Rapor Sayfası
             </h1>
              
              {/* Debug Info */}
              <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                {`Debug: showFileInput=${showFileInput.toString()}, parsedData=${parsedData ? 'var' : 'yok'}, result=${result ? 'var' : 'yok'}`}
              </div>

                         {/* Dosya Yolu Girişi */}
            {showFileInput && (
              <div className="mb-6 p-6 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
                <h2 className="text-lg font-semibold text-blue-900 mb-4">📁 Dosya Yolu ve Tipi Seçin</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                      Dosya Tipi
                    </label>
                    <select
                      value={selectedFileType}
                      onChange={(e) => setSelectedFileType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {supportedFileTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
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
                      placeholder={`C:\\temp\\akaryakit\\data.${selectedFileType}`}
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
                    onClick={() => setFilePath(getTestFilePath(selectedFileType))}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    📁 Test Dosyası
                  </button>
                </div>

                {/* Desteklenen Dosya Tipleri Bilgisi */}
                <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Desteklenen Dosya Tipleri:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-700">
                    {supportedFileTypes.map((type) => (
                      <div key={type.value} className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        {type.label}
                      </div>
                    ))}
                  </div>
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
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sıra</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dosya</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saat</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pompa</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lüle</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yakıt</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hacim</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Birim Fiyat</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Görevli</th>
                             <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaka</th>
                             {selectedFileType === 'd1a' && (
                               <>
                                 <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FIS NO</th>
                                 <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KM</th>
                                 <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KODU</th>
                               </>
                             )}
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200">
                           {parsedData.movements.map((movement, index) => (
                             <tr key={index} className="hover:bg-gray-50">
                               <td className="px-2 py-3 text-sm text-gray-900 font-medium">{movement.id}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.fileName}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.fileType}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.date}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.time}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.pumpNo}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.nozzleNo}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.fuelType}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{formatVolume(movement.volume)}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{formatUnitPrice(movement.unitPrice)}</td>
                               <td className="px-2 py-3 text-sm font-medium text-gray-900">{formatCurrency(movement.amount)}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.transactionType}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.attendantName || '-'}</td>
                               <td className="px-2 py-3 text-sm text-gray-900">{movement.vehiclePlate || '-'}</td>
                               {selectedFileType === 'd1a' && (
                                 <>
                                   <td className="px-2 py-3 text-sm text-gray-900">{movement.fisNo || '-'}</td>
                                   <td className="px-2 py-3 text-sm text-gray-900">{movement.km || 0}</td>
                                   <td className="px-2 py-3 text-sm text-gray-900">{movement.kodu || '-'}</td>
                                 </>
                               )}
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
                <li>• Dosya tipini seçin ve dosya yolu girip "Dosya Oku" butonuna tıklayın</li>
                <li>• Desteklenen formatlar: XML, TXT, D1A, D1B, D1C, F1D</li>
                <li>• Yüklenen hareket verileri sıralı rapor halinde tabloda gösterilecek</li>
                <li>• Her satış hareketi dosya bilgileriyle birlikte listelenir</li>
                <li>• "Yeni Dosya" ile başka bir dosya yükleyebilirsiniz</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
     </DashboardLayout>
  );
}
