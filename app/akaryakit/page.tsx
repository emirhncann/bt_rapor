'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { encryptPayloadSecure } from '../utils/api';
import Lottie from 'lottie-react';

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
  const [companyRef, setCompanyRef] = useState<string>('');
  const [showFileInput, setShowFileInput] = useState<boolean>(true);
  const [selectedFileType, setSelectedFileType] = useState<string>('xml');
  const [parsedData, setParsedData] = useState<{
    movements?: MovementData[];
    pumps?: PumpData[];
    sales?: SalesData;
    globalParams?: any;
    rawRows?: any[];
  } | null>(null);

  // Şirket akaryakıt ayarları için state
  const [companySettings, setCompanySettings] = useState<any[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);
  
  // Yeni state'ler
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [shiftNumber, setShiftNumber] = useState<number>(1);
  
  // Animasyon state'leri
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Para formatlaması için yardımcı fonksiyon
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // parsedData değiştiğinde scroll yap
  useEffect(() => {
    if (parsedData && parsedData.movements && parsedData.movements.length > 0) {
      // Veri yüklendiğinde satış özetine scroll yap
      setTimeout(() => {
        const element = document.getElementById('satis-ozeti');
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 300); // 300ms bekle
    }
  }, [parsedData]);

  // Desteklenen dosya tipleri
  const supportedFileTypes = [
    { value: 'xml', label: 'XML Dosyası (.xml)', extension: '.xml' },
    { value: 'txt', label: 'Metin Dosyası (.txt)', extension: '.txt' },
    { value: 'd1a', label: 'D1A Dosyası (.d1a)', extension: '.d1a' },
    { value: 'd1b', label: 'D1B Dosyası (.d1b)', extension: '.d1b' },
    { value: 'd1c', label: 'D1C Dosyası (.d1c)', extension: '.d1c' },
    { value: 'f1d', label: 'F1D Dosyası (.f1d)', extension: '.f1d' }
  ];

  // Şirket akaryakıt ayarlarını yükle
  const loadCompanySettings = async () => {
    try {
      setIsLoadingSettings(true);
      console.log('🔍 Akaryakıt Vardiya - Şirket ayarları yükleniyor... Company Ref:', companyRef);

      const response = await fetch(`https://api.btrapor.com/akaryakit/by-company/${companyRef}`);
      
      if (!response.ok) {
        throw new Error(`API Hatası: ${response.status}`);
      }

      const result = await response.json();
      console.log('📥 Şirket ayarları:', result);

      if (result.status === 'success' && result.data) {
        setCompanySettings(result.data);
        console.log('✅ Şirket ayarları yüklendi:', result.data.length, 'ayar');
      } else {
        console.warn('⚠️ Şirket ayarları bulunamadı veya boş');
        setCompanySettings([]);
      }

    } catch (error) {
      console.error('❌ Şirket ayarları yükleme hatası:', error);
      setCompanySettings([]);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Sayfa yüklendiğinde localStorage'dan company ref'i al
  useEffect(() => {
    const initializeCompanyRef = async () => {
      const storedCompanyRef = localStorage.getItem('companyRef');
      if (storedCompanyRef) {
        console.log('📋 LocalStorage\'dan company ref alındı:', storedCompanyRef);
        setCompanyRef(storedCompanyRef);
      } else {
        console.log('⚠️ LocalStorage\'da company ref bulunamadı, API\'den alınıyor...');
        // Company ref yoksa API'den al ve sayfayı yenile
        const success = await fetchCompanyRefFromAPI();
        if (success) {
          console.log('✅ Company ref API\'den alındı, sayfa yenileniyor...');
          // Kısa bir gecikme sonrası sayfayı yenile ki yeni company ref ile çalışabilsin
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          console.log('❌ Company ref alınamadı, login sayfasına yönlendiriliyor...');
          // Company ref alınamazsa login sayfasına yönlendir
          window.location.href = '/login';
        }
      }
    };

    initializeCompanyRef();
  }, []);

  // API'den company ref alma fonksiyonu
  const fetchCompanyRefFromAPI = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.log('❌ User ID bulunamadı, company ref alınamadı');
        return false;
      }

      console.log('🔄 API\'den company ref alınıyor...');
      const response = await fetch(`https://api.btrapor.com/user/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.user && data.user.company_ref) {
          console.log('✅ API\'den company ref alındı:', data.user.company_ref);
          localStorage.setItem('companyRef', data.user.company_ref);
          setCompanyRef(data.user.company_ref);
          
          // Diğer kullanıcı bilgilerini de güncelle
          if (data.user.name) localStorage.setItem('userName', data.user.name);
          if (data.user.role) localStorage.setItem('userRole', data.user.role);
          if (data.user.company_name) localStorage.setItem('companyName', data.user.company_name);
          
          return true;
        } else {
          console.log('❌ API\'den company ref alınamadı');
          return false;
        }
      } else {
        console.log('❌ API\'den company ref alınamadı, HTTP hatası:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Company ref alma hatası:', error);
      return false;
    }
  };

  // Company ref değiştiğinde şirket ayarlarını yükle
  useEffect(() => {
    if (companyRef) {
      console.log('🔍 Akaryakıt Vardiya - Company ref değişti:', companyRef);
      loadCompanySettings();
    }
  }, [companyRef]);

  // Animasyonları yükle
  useEffect(() => {
    fetch('/animations/failed.json')
      .then(res => res.json())
      .then(data => setFailedAnimationData(data))
      .catch(err => console.log('Failed animation yüklenemedi:', err));
  }, []);

  const sanitizeText = (input: string): string => {
    if (!input) return '';
    let s = input
      .replace(/\uFFFD/g, '') // replacement char
      .replace(/[\x00-\x1F\x7F]/g, ' ') // kontrol karakterleri
      .replace(/\u00A0/g, ' '); // NBSP
    s = s.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return s;
  };

  const readAkaryakitFile = async (filePath: string, fileType: string, retryCount: number = 0) => {
    if (!filePath.trim()) {
      setResult({ success: false, error: 'Dosya yolu boş olamaz' });
      return;
    }

    // Sadece ilk denemede loading'i başlat
    if (retryCount === 0) {
    setIsReading(true);
    setResult(null);
    setParsedData(null);
    }

    const maxRetries = 2; // Maksimum 3 deneme (0, 1, 2)

    try {
      // Module ve payload verilerini hazırla
      const moduleData = { id: 2, mode: 'offline' };
      const payloadData = { 
        filePath: filePath,
        fileType: fileType 
      };

      console.log(`🔍 === AKARYAKIT DOSYA OKUMA (Deneme ${retryCount + 1}/${maxRetries + 1}) ===`);
      console.log('📍 Company Ref:', companyRef);
      console.log('📁 Dosya Yolu:', filePath);
      console.log('📄 Dosya Tipi:', fileType);

      // Verileri şifrele
      const encryptedModule = await encryptPayloadSecure(moduleData, companyRef);
      const encryptedPayload = await encryptPayloadSecure(payloadData, companyRef);

      // Request body'yi oluştur
      const requestBody = {
        companyRef: companyRef,
        encryptedModule: encryptedModule,
        encryptedPayload: encryptedPayload,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };

      // İsteği gönder
      const response = await fetch('https://api.btrapor.com/akaryakit-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Company-Ref': companyRef
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Dosya bulunamadı hatası kontrolü
        if (errorText.includes('Dosya bulunamadı') || errorText.includes('File not found')) {
          throw new Error('Vardiya bulunamadı');
        }
        
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 Response Data:', result);

      // JSON response'da hata kontrolü
      if (result.status === 'error') {
        if (result.message && (result.message.includes('Dosya bulunamadı') || result.message.includes('File not found'))) {
          throw new Error('Vardiya bulunamadı');
        }
        throw new Error(result.message || 'Bilinmeyen hata');
      }

      // Sonucu işle
      let processedResult: FileReadResult = { success: true };

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
      
      // Başarılı olduğunda loading'i kapat
      setIsReading(false);

    } catch (error) {
      console.error(`❌ Dosya okuma hatası (Deneme ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // Eğer hala deneme hakkı varsa, tekrar dene
      if (retryCount < maxRetries) {
        console.log(`🔄 ${retryCount + 1}. deneme başarısız, ${retryCount + 2}. deneme yapılıyor...`);
        
        // 2 saniye bekle ve tekrar dene
        setTimeout(() => {
          readAkaryakitFile(filePath, fileType, retryCount + 1);
        }, 2000);
        
        return; // Bu denemeyi sonlandır, yeni deneme başlat
      }
      
      // Tüm denemeler başarısız oldu
      console.error('❌ Tüm denemeler başarısız oldu!');
      const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      
      // Vardiya bulunamadı hatası kontrolü
      if (errorMsg.includes('Vardiya bulunamadı')) {
        setErrorMessage('Vardiya bulunamadı');
        setShowErrorModal(true);
      } else {
      setResult({
        success: false,
          error: `Dosya okuma başarısız (${maxRetries + 1} deneme): ${errorMsg}`
        });
      }
      
      // Tüm denemeler başarısız olduğunda loading'i kapat
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
      let rawRows: any[] | undefined = undefined;

      if (fileType === 'xml' && typeof data === 'string') {
        // XML parse
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(data, 'text/xml');
          const ns = doc.documentElement.namespaceURI || undefined;

          // POAS formatı kontrolü
          const isPOASFormat = doc.documentElement.tagName === 'POAS';

          const q = (parent: Element | Document, tag: string) => {
            return ns
              ? (parent as any).getElementsByTagNameNS(ns, tag)
              : (parent as any).getElementsByTagName(tag);
          };

          const textNode = (parent: Element | Document, tag: string): string => {
            const nodes = q(parent, tag);
            const n = nodes && nodes.length > 0 ? (nodes[0] as Element) : null;
            return n && n.textContent ? n.textContent.trim() : '';
          };

          movements = [];
          const dynamicRows: any[] = [];

          if (isPOASFormat) {
            // POAS formatı için özel parsing
            const satislarNodes = q(doc, 'Satislar');
            if (satislarNodes && satislarNodes.length > 0) {
              for (let i = 0; i < satislarNodes.length; i++) {
                const satis = satislarNodes[i] as Element;
                
                const tarih = textNode(satis, 'TARIH');
                const saat = textNode(satis, 'SAAT');
                const filoAdi = textNode(satis, 'FILOADI');
                const kodu = textNode(satis, 'KODU');
                const plaka = textNode(satis, 'PLAKA');
                const yakit = textNode(satis, 'YAKIT');
                const litreStr = textNode(satis, 'LITRE');
                const fytStr = textNode(satis, 'FYT');
                const tutarStr = textNode(satis, 'TUTAR');
                const tabanca = textNode(satis, 'TABANCA');
                const pompa = textNode(satis, 'POMPA');
                const fisNo = textNode(satis, 'FISNO');
                const plaka2 = textNode(satis, 'PLAKA2');
                const tagId = textNode(satis, 'TAGID');

                const volume = parseFloat(litreStr) || 0;
                const unitPrice = parseFloat(fytStr) || 0;
                const amount = parseFloat(tutarStr) || 0;

                movements.push({
                  id: movements.length + 1,
                  date: sanitizeText(tarih),
                  time: sanitizeText(saat),
                  pumpNo: sanitizeText(pompa),
                  nozzleNo: sanitizeText(tabanca),
                  fuelType: sanitizeText(yakit),
                  volume: volume,
                  amount: amount,
                  unitPrice: unitPrice,
                  transactionType: 'Nakit',
                  attendantName: sanitizeText(filoAdi) || 'Bilinmeyen',
                  vehiclePlate: sanitizeText(plaka2 || plaka),
                  cardNumber: '',
                  fileName: fileName,
                  fileType: fileType.toUpperCase(),
                  fisNo: fisNo,
                  kodu: kodu
                } as MovementData);

                // Dinamik tablo için ham satır
                const row: Record<string, string> = {
                  TARIH: tarih,
                  SAAT: saat,
                  FILOADI: filoAdi,
                  KODU: kodu,
                  PLAKA: plaka,
                  YAKIT: yakit,
                  LITRE: litreStr,
                  FYT: formatCurrency(parseFloat(fytStr) || 0),
                  TUTAR: formatCurrency(parseFloat(tutarStr) || 0),
                  TABANCA: tabanca,
                  POMPA: pompa,
                  FISNO: fisNo,
                  PLAKA2: plaka2,
                  TAGID: tagId
                };
                dynamicRows.push(row);
              }
            }

            // Global params
            globalParams = {
              version: 'POAS XML Format',
              companyCode: 'POAS',
              stationCode: 'POAS',
              reportDate: new Date().toLocaleDateString('tr-TR')
            };

            rawRows = dynamicRows;
          } else {
            // TURPAK XML formatı için parsing
            console.log('TURPAK XML formatı parse ediliyor...');
            
            const txnsNodes = q(doc, 'Txn');
            if (txnsNodes && txnsNodes.length > 0) {
              for (let i = 0; i < txnsNodes.length; i++) {
                const txn = txnsNodes[i] as Element;
                
                // TagDetails
                const tagDetails = q(txn, 'TagDetails')[0] as Element;
                const fleetCode = textNode(tagDetails, 'FleetCode');
                const fleetName = textNode(tagDetails, 'FleetName');
                const tagNr = textNode(tagDetails, 'TagNr');
                const plate = textNode(tagDetails, 'Plate');
                
                // SaleDetails
                const saleDetails = q(txn, 'SaleDetails')[0] as Element;
                const dateTime = textNode(saleDetails, 'DateTime');
                const receiptNr = textNode(saleDetails, 'ReceiptNr');
                const fuelType = textNode(saleDetails, 'FuelType');
                const unitPrice = textNode(saleDetails, 'UnitPrice');
                const amount = textNode(saleDetails, 'Amount');
                const total = textNode(saleDetails, 'Total');
                const pumpNr = textNode(saleDetails, 'PumpNr');
                const nozzleNr = textNode(saleDetails, 'NozzleNr');
                const paymentType = textNode(saleDetails, 'PaymentType');
                const ecrPlate = textNode(saleDetails, 'ECRPlate');
                
                // Tarih ve saat formatını çevir (20250327000211 -> 2025-03-27 00:02:11)
                let formattedDate = '';
                let formattedTime = '';
                if (dateTime && dateTime.length >= 14) {
                  const year = dateTime.substring(0, 4);
                  const month = dateTime.substring(4, 6);
                  const day = dateTime.substring(6, 8);
                  const hour = dateTime.substring(8, 10);
                  const minute = dateTime.substring(10, 12);
                  const second = dateTime.substring(12, 14);
                  
                  formattedDate = `${year}-${month}-${day}`;
                  formattedTime = `${hour}:${minute}:${second}`;
                }
                
                // Yakıt türü mapping
                const fuelTypeMapping: {[key: string]: string} = {
                  '4': 'OPTIMUM KURSUNSUZ 95',
                  '5': 'LPG',
                  '6': 'MOTORIN',
                  '8': 'OPTIMUM MOTORIN'
                };
                
                const fuelTypeName = fuelTypeMapping[fuelType] || `Yakıt ${fuelType}`;
                
                // Sayısal değerleri parse et
                const volume = parseFloat(amount) || 0;
                const price = parseFloat(unitPrice) / 100 || 0; // Kuruş cinsinden geliyor
                const totalAmount = parseFloat(total) / 100 || 0; // Kuruş cinsinden geliyor
                
                if (volume > 0 && totalAmount > 0) {
                  movements.push({
                    id: i + 1,
                    date: sanitizeText(formattedDate),
                    time: sanitizeText(formattedTime),
                    pumpNo: sanitizeText(pumpNr),
                    nozzleNo: sanitizeText(nozzleNr),
                    fuelType: sanitizeText(fuelTypeName),
                    volume: volume,
                    amount: totalAmount,
                    unitPrice: price,
                    transactionType: paymentType === '0' ? 'Nakit' : 'Kart',
                    attendantName: sanitizeText(fleetName) || 'Bilinmeyen',
                    vehiclePlate: sanitizeText(ecrPlate || plate),
                    cardNumber: sanitizeText(tagNr),
                    fileName: fileName,
                    fileType: fileType.toUpperCase(),
                    fisNo: receiptNr,
                    kodu: fleetCode
                  } as MovementData);
                  
                  // Dinamik tablo için ham satır
                  const row: Record<string, string> = {
                    TARIH: formattedDate,
                    SAAT: formattedTime,
                    'FILO ADI': fleetName,
                    KODU: fleetCode,
                    'PLAKA/POMPACI': ecrPlate || plate,
                    YAKIT: fuelTypeName,
                    LITRE: volume.toFixed(2),
                    FYT: formatCurrency(price),
                    TUTAR: formatCurrency(totalAmount),
                    TABANCA: nozzleNr,
                    POMPA: pumpNr,
                    'FIS NO': receiptNr,
                    'ODEME TURU': paymentType === '0' ? 'Nakit' : 'Kart',
                    'TAG NO': tagNr
                  };
                  dynamicRows.push(row);
                }
              }
            }
            
            // Global params
            const globalParamsNode = q(doc, 'GlobalParams')[0] as Element;
            if (globalParamsNode) {
              globalParams = {
                version: textNode(globalParamsNode, 'Version'),
                companyCode: textNode(globalParamsNode, 'CompanyCode'),
                stationCode: textNode(globalParamsNode, 'StationCode'),
                reportDate: new Date().toLocaleDateString('tr-TR')
              };
            }
            
            rawRows = dynamicRows;
          }

          // Satış özeti
          const totalTransactions = movements.length;
          const totalAmount = movements.reduce((s: number, m: any) => s + m.amount, 0);
          const totalVolume = movements.reduce((s: number, m: any) => s + m.volume, 0);
          const fuelTypes: any = {};
          movements.forEach((m: any) => {
            if (!fuelTypes[m.fuelType]) fuelTypes[m.fuelType] = { volume: 0, amount: 0 };
            fuelTypes[m.fuelType].volume += m.volume;
            fuelTypes[m.fuelType].amount += m.amount;
          });
          sales = { totalTransactions, totalAmount, totalVolume, fuelTypes };

        } catch (e) {
          console.error('XML parse hatası:', e);
          movements = [];
          sales = { totalTransactions: 0, totalAmount: 0, totalVolume: 0, fuelTypes: {} };
        }
      } else if (fileType === 'd1c' && typeof data === 'string') {
        // D1C formatı parse
        try {
          console.log('D1C formatı parse ediliyor...');
          
          const lines = data.trim().split('\n');
          
          // Header satırını atla
          const dataLines = lines.filter(line => 
            line.trim() && 
            !line.includes('TARIH') && 
            !line.includes('SAAT') && 
            !line.includes('FILO ADI') &&
            !line.includes('TL') &&
            line.length > 100 // D1C formatı daha uzun satırlar içerir
          );

          movements = [];
          const dynamicRows: any[] = [];

          // Yakıt türü mapping
          const fuelTypeMapping: {[key: string]: string} = {
            'POGAZ': 'LPG',
            'M YN V/MAX': 'MOTORIN',
            'KBN95 YN V': 'OPTIMUM KURSUNSUZ 95',
            'MOTORIN': 'MOTORIN',
            'BENZIN': 'BENZIN'
          };

          dataLines.forEach((line, index) => {
            try {
              // D1C formatına göre sabit pozisyonlardan veri çıkar
              // 0-10 tarih, 11-19 saat, 20-50 filo adı, 51-57 kodu, 58-67 plaka, 68-77 yakıt, 78-84 litre, 85-89 fiyat, 90-98 tutar, 99-101 tabanca, 102-104 pompa, 105-111 fiş no
              
              if (line.length < 111) return; // Minimum uzunluk kontrolü

              const dateStr = line.substring(0, 10).trim();
              const timeStr = line.substring(11, 19).trim();
              const fleetName = line.substring(20, 50).trim();
              const code = line.substring(51, 57).trim();
              const plate = line.substring(58, 67).trim();
              const fuelTypeRaw = line.substring(68, 78).trim();
              const volumeStr = line.substring(78, 85).trim();
              const priceStr = line.substring(85, 90).trim();
              const amountStr = line.substring(90, 99).trim();
              const nozzleStr = line.substring(99, 102).trim();
              const pumpStr = line.substring(102, 105).trim();
              const receiptStr = line.substring(105, 112).trim();

              // Sayısal değerleri parse et - D1C formatında özel parsing
              // Litre: 000775 -> 7.75 (3 basamak ondalık)
              const volume = volumeStr ? parseFloat(volumeStr) / 100 : 0;
              
              // Fiyat: 2579 -> 25.79 (2 basamak ondalık)
              const unitPrice = priceStr ? parseFloat(priceStr) / 100 : 0;
              
              // Tutar: 00020000 -> 200.00 (2 basamak ondalık)
              const amount = amountStr ? parseFloat(amountStr) / 100 : 0;
              
              const nozzle = parseInt(nozzleStr) || 0;
              const pump = parseInt(pumpStr) || 0;
              const receipt = parseInt(receiptStr) || 0;

              // Yakıt türünü belirle
              let fuelType = '';
              for (const [key, value] of Object.entries(fuelTypeMapping)) {
                if (fuelTypeRaw.includes(key)) {
                  fuelType = value;
                  break;
                }
              }

              if (!fuelType) {
                fuelType = fuelTypeRaw; // Eğer mapping'de yoksa ham değeri kullan
              }

              if (fuelType && volume > 0 && amount > 0) {
                movements.push({
                  id: index + 1,
                  date: sanitizeText(dateStr),
                  time: sanitizeText(timeStr),
                  pumpNo: pump.toString(),
                  nozzleNo: nozzle.toString(),
                  fuelType: sanitizeText(fuelType),
                  volume: volume,
                  amount: amount,
                  unitPrice: unitPrice,
                  transactionType: 'Nakit',
                  attendantName: sanitizeText(fleetName) || 'Bilinmeyen',
                  vehiclePlate: sanitizeText(plate),
                  cardNumber: '',
                  fileName: fileName,
                  fileType: fileType.toUpperCase(),
                  fisNo: receipt.toString(),
                  kodu: code
                } as MovementData);

                // Dinamik tablo için ham satır - parse edilmiş değerlerle
                const row: Record<string, string> = {
                  TARIH: dateStr,
                  SAAT: timeStr,
                  'FILO ADI': fleetName,
                  KODU: code,
                  'PLAKA/POMPACI': plate,
                  YAKIT: fuelTypeRaw,
                  LITRE: volume.toFixed(2),
                  FYT: formatCurrency(unitPrice),
                  TUTAR: formatCurrency(amount),
                  TABANCA: nozzleStr,
                  POMPA: pumpStr,
                  'FIS NO': receiptStr
                };
                dynamicRows.push(row);
              }
            } catch (lineError) {
              console.warn('D1C satır parse hatası:', line, lineError);
            }
          });

          // Global params
          globalParams = {
            version: 'D1C Format Rapor',
            companyCode: '7732',
            stationCode: '000299',
            reportDate: new Date().toLocaleDateString('tr-TR')
          };

          rawRows = dynamicRows;

          // Satış özeti
          const totalTransactions = movements.length;
          const totalAmount = movements.reduce((s: number, m: any) => s + m.amount, 0);
          const totalVolume = movements.reduce((s: number, m: any) => s + m.volume, 0);
          const fuelTypes: any = {};
          movements.forEach((m: any) => {
            if (!fuelTypes[m.fuelType]) fuelTypes[m.fuelType] = { volume: 0, amount: 0 };
            fuelTypes[m.fuelType].volume += m.volume;
            fuelTypes[m.fuelType].amount += m.amount;
          });
          sales = { totalTransactions, totalAmount, totalVolume, fuelTypes };

        } catch (e) {
          console.error('D1C parse hatası:', e);
          movements = [];
          sales = { totalTransactions: 0, totalAmount: 0, totalVolume: 0, fuelTypes: {} };
        }
      } else if (fileType === 'd1a' && typeof data === 'string') {
        // D1A formatı parse
        try {
          console.log('D1A formatı parse ediliyor...');
          
          const lines = data.trim().split('\n');
          
          // Header satırını atla
          const dataLines = lines.filter(line => 
            line.trim() && 
            !line.includes('TARIH') && 
            !line.includes('SAAT') && 
            !line.includes('FILO ADI') &&
            !line.includes('TL') &&
            line.length > 50
          );

          movements = [];
          const dynamicRows: any[] = [];

          // Yakıt türü mapping
          const fuelTypeMapping: {[key: string]: string} = {
            'Optımum Mo': 'OPTIMUM MOTORIN',
            'OPTİMUM KU': 'OPTIMUM KURSUNSUZ 95', 
            'Motorin': 'MOTORIN',
            'LPG': 'LPG'
          };

          dataLines.forEach((line, index) => {
            try {
              // Satırı parse et
              const parts = line.split(/\s+/);
              if (parts.length < 8) return;

              // Tarih ve saat
              const dateStr = parts[0];
              const timeStr = parts[1];
              
              // Yakıt türü ve miktar
              let fuelType = '';
              let volume = 0;
              let amount = 0;
              let price = 0;

              // Yakıt türünü bul
              for (let i = 2; i < parts.length - 3; i++) {
                const part = parts[i];
                if (fuelTypeMapping[part]) {
                  fuelType = fuelTypeMapping[part];
                  break;
                }
              }

              // Litre ve tutar bilgilerini bul - D1A formatında özel parsing
              for (let i = parts.length - 4; i < parts.length; i++) {
                const part = parts[i];
                if (part.match(/^\d+$/)) {
                  if (volume === 0) {
                    // D1A'da litre 3 basamak ondalık olabilir
                    volume = parseFloat(part) / 100;
                  } else if (amount === 0) {
                    // D1A'da tutar 2 basamak ondalık
                    amount = parseFloat(part) / 100;
                  } else if (price === 0) {
                    // D1A'da fiyat 2 basamak ondalık
                    price = parseFloat(part) / 100;
                  }
                }
              }

              if (fuelType && volume > 0 && amount > 0) {
                movements.push({
                  id: index + 1,
                  date: sanitizeText(dateStr),
                  time: sanitizeText(timeStr),
                  pumpNo: '1',
                  nozzleNo: '1',
                  fuelType: sanitizeText(fuelType),
                  volume: volume,
                  amount: amount,
                  unitPrice: price,
                  transactionType: 'Nakit',
                  attendantName: 'Bilinmeyen',
                  vehiclePlate: '',
                  cardNumber: '',
                  fileName: fileName,
                  fileType: fileType.toUpperCase(),
                  fisNo: (index + 1).toString(),
                  kodu: ''
                } as MovementData);

                // Dinamik tablo için ham satır - parse edilmiş değerlerle
                const row: Record<string, string> = {
                  TARIH: dateStr,
                  SAAT: timeStr,
                  'FILO ADI': 'ISTASYON',
                  KODU: 'C0000',
                  PLAKA: 'BILINMEYEN',
                  YAKIT: fuelType,
                  LITRE: volume.toFixed(2),
                  FYT: formatCurrency(price),
                  TUTAR: formatCurrency(amount),
                  TABANCA: '1',
                  POMPA: '1',
                  'FIS NO': (index + 1).toString()
                };
                dynamicRows.push(row);
              }
            } catch (lineError) {
              console.warn('D1A satır parse hatası:', line, lineError);
            }
          });

          // Global params
          globalParams = {
            version: 'D1A Format Rapor',
            companyCode: '7732',
            stationCode: '000299',
            reportDate: new Date().toLocaleDateString('tr-TR')
          };

          rawRows = dynamicRows;

          // Satış özeti
          const totalTransactions = movements.length;
          const totalAmount = movements.reduce((s: number, m: any) => s + m.amount, 0);
          const totalVolume = movements.reduce((s: number, m: any) => s + m.volume, 0);
          const fuelTypes: any = {};
          movements.forEach((m: any) => {
            if (!fuelTypes[m.fuelType]) fuelTypes[m.fuelType] = { volume: 0, amount: 0 };
            fuelTypes[m.fuelType].volume += m.volume;
            fuelTypes[m.fuelType].amount += m.amount;
          });
          sales = { totalTransactions, totalAmount, totalVolume, fuelTypes };

        } catch (e) {
          console.error('D1A parse hatası:', e);
          movements = [];
          sales = { totalTransactions: 0, totalAmount: 0, totalVolume: 0, fuelTypes: {} };
        }
      } else {
        // Diğer dosya formatları için basit parse
        console.log('Diğer formatlar - parsing eklenecek');
        movements = [];
        sales = { totalTransactions: 0, totalAmount: 0, totalVolume: 0, fuelTypes: {} };
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
        globalParams,
        rawRows
      });

      console.log('✅ ParseAndDisplayData tamamlandı');

    } catch (error) {
      console.error('Veri parse hatası:', error);
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

  // Şirket ayarlarından dosya okuma
  const readFromCompanySettings = async (setting: any) => {
    try {
      console.log('🔍 Şirket ayarından dosya okunuyor:', setting);
      
      // Dosya tipini belirle
      let fileType = 'xml'; // varsayılan
      if (setting.file_type === 'asis' || setting.file_type === 'd1c') {
        fileType = 'd1c';
      } else if (setting.file_type === 'd1c') {
        fileType = 'd1c';
      } else if (setting.file_type === 'turpak' || setting.file_type === 'xml') {
        fileType = 'xml';
      }

      // Dosya yolunu ayarla
      const filePath = setting.path || setting.online_path;
      
      if (!filePath) {
        alert('Dosya yolu bulunamadı!');
        return;
      }

      // Dosyayı oku (retry özelliği ile)
      await readAkaryakitFile(filePath, fileType);
      
      // Başarı mesajı
      console.log('✅ Şirket ayarından dosya başarıyla okundu:', setting.branch_name);
      
    } catch (error) {
      console.error('❌ Şirket ayarından dosya okuma hatası:', error);
      alert(`Dosya okuma hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
      // Hata durumunda loading'i kapat
      setIsReading(false);
    }
  };

  // Seçili şirketten dosya okuma
  const readFromSelectedCompany = async () => {
    if (!selectedCompany) {
      alert('Lütfen bir şirket seçin!');
      return;
    }

    if (!selectedDate) {
      alert('Lütfen bir tarih seçin!');
      return;
    }

    try {
      console.log('🔍 Seçili şirketten dosya okunuyor:', selectedCompany);
      console.log('📅 Seçili tarih:', selectedDate);
      console.log('🔄 Vardiya numarası:', shiftNumber);
      
      // Dosya tipini belirle
      let fileType = 'xml'; // varsayılan
      if (selectedCompany.file_type === 'asis' || selectedCompany.file_type === 'd1c') {
        fileType = 'd1c';
      } else if (selectedCompany.file_type === 'd1c') {
        fileType = 'd1c';
      } else if (selectedCompany.file_type === 'turpak' || selectedCompany.file_type === 'xml') {
        fileType = 'xml';
      } else if (selectedCompany.file_type === 'turpak') {
        fileType = 'xml'; // TURPAK formatı XML olarak işlenir
      }

      // Dosya yolunu ayarla
      let filePath = selectedCompany.path || selectedCompany.online_path;
      
      if (!filePath) {
        alert('Dosya yolu bulunamadı!');
        return;
      }

      // ASIS formatı için özel dosya yolu oluşturma
      if (selectedCompany.file_type === 'asis') {
        // Tarihi 20250804 formatına çevir
        const dateParts = selectedDate.split('-');
        const formattedDate = `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;
        
        // Vardiya numarasına göre dosya uzantısını belirle
        let fileExtension = 'd1a'; // varsayılan
        switch (shiftNumber) {
          case 1:
            fileExtension = 'd1a';
            break;
          case 2:
            fileExtension = 'd1b';
            break;
          case 3:
            fileExtension = 'd1c';
            break;
          case 4:
            fileExtension = 'd1d';
            break;
          default:
            fileExtension = 'd1a';
            break;
        }
        
        // Dosya adını oluştur: 20250804.d1a
        const fileName = `${formattedDate}.${fileExtension}`;
        
        // Dosya yolunu birleştir
        filePath = filePath.endsWith('\\') || filePath.endsWith('/') 
          ? `${filePath}${fileName}`
          : `${filePath}\\${fileName}`;
        
        console.log('📁 ASIS formatı dosya yolu oluşturuldu:', filePath);
        console.log('📅 Formatlanmış tarih:', formattedDate);
        console.log('📄 Dosya uzantısı:', fileExtension);
      }
      
      // TURPAK formatı için özel dosya yolu oluşturma
      if (selectedCompany.file_type === 'turpak') {
        // Tarihi 20250326 formatına çevir (YYYYMMDD)
        const dateParts = selectedDate.split('-');
        const formattedDate = `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;
        
        // Vardiya numarasını 2 haneli formata çevir (01, 02, 03, 04)
        const formattedShift = shiftNumber.toString().padStart(2, '0');
        
        // Dosya adını oluştur: 2025032601.XML
        const fileName = `${formattedDate}${formattedShift}.XML`;
        
        // Dosya yolunu birleştir
        filePath = filePath.endsWith('\\') || filePath.endsWith('/') 
          ? `${filePath}${fileName}`
          : `${filePath}\\${fileName}`;
        
        console.log('📁 TURPAK formatı dosya yolu oluşturuldu:', filePath);
        console.log('📅 Formatlanmış tarih:', formattedDate);
        console.log('🔄 Vardiya numarası:', formattedShift);
      }

      // Dosyayı oku (retry özelliği ile)
      await readAkaryakitFile(filePath, fileType);
      
      // Başarı mesajı
      console.log('✅ Seçili şirketten dosya başarıyla okundu:', selectedCompany.branch_name);
      
    } catch (error) {
      console.error('❌ Seçili şirketten dosya okuma hatası:', error);
      const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      
      // Vardiya bulunamadı hatası kontrolü
      if (errorMsg.includes('Vardiya bulunamadı')) {
        setErrorMessage('Vardiya bulunamadı');
        setShowErrorModal(true);
      } else {
        alert(`Dosya okuma hatası: ${errorMsg}`);
      }
      // Hata durumunda loading'i kapat
      setIsReading(false);
    }
  };

  // D1C test verisi yükleme fonksiyonu
  const loadD1CTestData = () => {
    try {
      setIsReading(true);
      
    const d1cTestData = `07:59:18 TL
TARIH      SAAT     FILO ADI                       KODU   PLAKA     YAKIT      LITRE  FYT  TUTAR    TBNCPU FIS NO
15/08/2025 00:02:31                       ISTASYON  C0000 RECAİ GÜN POGAZ OTOG 000775 2579 00020000  1 09 459612
15/08/2025 00:14:16                       ISTASYON  C0000 RECAİ GÜN POGAZ OTOG 003095 2579 00079820  1 08 459613
15/08/2025 00:28:45                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 005665 5296 00300000  1 05 459614
15/08/2025 00:45:32                    HASAN BİLGE  C007    14S0026 M YN V/MAX 005287 5296 00280000  3 04 459615
15/08/2025 00:58:05              HÜSEYİN ÇAVUŞOĞLU  C136    14S0027 M YN V/MAX 012538 5296 00664012  1 05 459616
15/08/2025 01:38:13                       ISTASYON  C0000 RECAİ GÜN KBN95 YN V 000381 5246 00020000  4 05 459617
15/08/2025 01:53:19                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 001937 5164 00100000  1 05 459618
15/08/2025 02:01:22                       ISTASYON  C0000 RECAİ GÜN KBN95 YN V 000490 5246 00025705  1 06 459619
15/08/2025 02:21:23                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 004086 5217 00213167  3 06 459620
15/08/2025 02:30:51                       ISTASYON  C0000 RECAİ GÜN KBN95 YN V 000381 5246 00020000  4 05 459621
15/08/2025 02:59:24                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 000383 5217 00020000  1 05 459622
15/08/2025 04:47:06                       ISTASYON  C0000 RECAİ GÜN KBN95 YN V 000381 5246 00020000  4 05 459623
15/08/2025 05:19:26                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 004261 5164 00220038  4 04 459624
15/08/2025 06:54:37 DEVLET MALZEME OFİSİ GENEL MÜD 149289  014AC217 M YN V/MAX 004677 5296 00247694  3 01 459625
15/08/2025 07:38:03                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 004023 5296 00213058  3 04 459626
15/08/2025 07:51:43                       ISTASYON  C0000 RECAİ GÜN KBN95 YN V 000249 5246 00013063  4 05 459627
15/08/2025 07:52:53                       ISTASYON  C0000 RECAİ GÜN M YN V/MAX 002712 5164 00140048  3 04 459628`;
    
    // D1C test verisi için özel işlem
    setSelectedFileType('d1c');
    setFilePath('C:\\temp\\akaryakit\\test.d1c');
    parseAndDisplayData(d1cTestData, 'd1c', 'C:\\temp\\akaryakit\\test.d1c');
      
      // Başarı mesajı
      setResult({ success: true, data: d1cTestData });
      
    } catch (error) {
      console.error('❌ D1C test verisi yükleme hatası:', error);
      setResult({ success: false, error: 'Test verisi yükleme hatası' });
    } finally {
      setIsReading(false);
    }
  };

  const handleClearResult = () => {
    console.log('🔍 Clear Result çağrıldı');
    setResult(null);
    setParsedData(null);
    setShowFileInput(true);
    console.log('🔍 showFileInput true yapıldı');
  };



  // PDF export fonksiyonu - Yazdır/PDF formatında
  const exportToPDF = () => {
    if (!parsedData || !parsedData.movements || parsedData.movements.length === 0) {
      alert('Export edilecek veri bulunamadı. Önce bir dosya yükleyin.');
      return;
    }

    try {
      // Yazdırma için HTML oluştur (PDF'e optimize edilmiş)
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up engelleyici nedeniyle PDF yazdırma penceresi açılamıyor.');
        return;
      }

      // Helper function para birimi formatlaması için
      const formatCurrency = (value: any, currency: string = 'TRY') => {
        if (typeof value === 'number') {
          return value.toLocaleString('tr-TR', { style: 'currency', currency: currency });
        }
        return value;
      };

      // Helper function hacim formatlaması için
      const formatVolume = (value: any) => {
        if (typeof value === 'number') {
          return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
        }
        return value;
      };

      // Rapor başlığı ve bilgileri
      const headerHTML = `
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
          <h1 style="color: #1e40af; margin: 0; font-size: 24px;">⛽ AKARYAKIT SATIŞ RAPORU</h1>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">
            <strong>Dosya:</strong> ${parsedData.movements[0]?.fileName || 'Bilinmeyen'} | 
            <strong>Format:</strong> ${parsedData.movements[0]?.fileType || 'Bilinmeyen'} | 
            <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}
          </p>
        </div>
      `;

      // Satış özeti
      const summaryHTML = parsedData.sales ? `
        <div style="margin-bottom: 20px; background-color: #f8fafc; padding: 15px; border-radius: 8px;">
          <h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 18px;">📊 SATIŞ ÖZETİ</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px;">
              <div style="font-size: 12px; color: #666;">Toplam İşlem</div>
              <div style="font-size: 20px; font-weight: bold; color: #1e40af;">${parsedData.sales.totalTransactions}</div>
            </div>
            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px;">
              <div style="font-size: 12px; color: #666;">Toplam Tutar</div>
              <div style="font-size: 20px; font-weight: bold; color: #059669;">${formatCurrency(parsedData.sales.totalAmount)}</div>
            </div>
            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px;">
              <div style="font-size: 12px; color: #666;">Toplam Hacim</div>
              <div style="font-size: 20px; font-weight: bold; color: #7c3aed;">${formatVolume(parsedData.sales.totalVolume)}</div>
            </div>
          </div>
        </div>
      ` : '';

      // Yakıt türü bazında satışlar
      const fuelTypesHTML = parsedData.sales?.fuelTypes ? `
        <h3 class="section-title">⛽ YAKIT TÜRÜ BAZINDA SATIŞLAR</h3>
        
        <table>
          <thead>
            <tr>
              <th>Yakıt Tipi</th>
              <th class="number">Hacim</th>
              <th class="number currency">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(parsedData.sales.fuelTypes).map(([fuelType, data]) => `
              <tr>
                <td><strong>${fuelType}</strong></td>
                <td class="number">${formatVolume(data.volume)}</td>
                <td class="number currency">${formatCurrency(data.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      // Detaylı satış hareketleri
      const movementsHTML = `
        <h3 class="section-title">📋 DETAYLI SATIŞ HAREKETLERİ</h3>
        
        <table>
          <thead>
            <tr>
              <th class="center">Tarih/Saat</th>
              <th>Filo Adı</th>
              <th>Plaka</th>
              <th>Yakıt Türü</th>
              <th class="number">Miktar</th>
              <th class="number">Fiyat</th>
              <th class="number currency">Tutar</th>
              <th class="center">Tabanca</th>
              <th class="center">Pompa</th>
              <th class="center">Fiş No</th>
            </tr>
          </thead>
          <tbody>
            ${parsedData.movements.map((movement, index) => `
              <tr>
                <td class="center">
                  <div>${movement.date}</div>
                  <div style="color: #666; font-size: 10px;">${movement.time}</div>
                </td>
                <td>${movement.attendantName || '-'}</td>
                <td>${movement.vehiclePlate || '-'}</td>
                <td><strong>${movement.fuelType}</strong></td>
                <td class="number">${formatVolume(movement.volume)}</td>
                <td class="number">${formatCurrency(movement.unitPrice)}</td>
                <td class="number currency">${formatCurrency(movement.amount)}</td>
                <td class="center">${movement.nozzleNo}</td>
                <td class="center">${movement.pumpNo}</td>
                <td class="center">${movement.fisNo}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // Tam HTML'i oluştur
      const fullHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Akaryakıt Satış Raporu - PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 13px; }
            .header { margin-bottom: 30px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: white; margin: 0 0 8px 0; font-size: 24px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-align: left; }
            .pdf-info { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin-bottom: 25px; border-radius: 4px; }
            .pdf-info strong { color: #92400e; }
            
            /* İstatistik Kutuları */
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-box.primary { border-color: #991b1b; background-color: #fef2f2; }
            .stat-box.success { border-color: #059669; background-color: #ecfdf5; }
            .stat-box.purple { border-color: #7c3aed; background-color: #f3f4f6; }
            .stat-title { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 16px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 10px; color: #9ca3af; margin-top: 2px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 11px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .center { text-align: center; }
            .section-title { color: #991b1b; margin: 20px 0 10px 0; font-size: 16px; border-bottom: 2px solid #991b1b; padding-bottom: 5px; }
            
            @media print {
              body { margin: 0; font-size: 12px; }
              .pdf-info { display: none; }
              .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px; }
              .stat-box { padding: 8px; }
              table { font-size: 10px; }
              th, td { padding: 4px; }
              .header { margin-bottom: 20px; padding: 15px; }
              .header-top { gap: 15px; margin-bottom: 10px; }
              .logo { width: 75px; }
              .header h1 { font-size: 18px; margin: 0 0 3px 0; }
              .header p { font-size: 11px; margin: 1px 0; }
              .stat-title { font-size: 11px; }
              .stat-value { font-size: 14px; }
              .stat-subtitle { font-size: 9px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>AKARYAKIT SATIŞ RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
                <p><strong>Dosya:</strong> ${parsedData.movements[0]?.fileName || 'Bilinmeyen'}</p>
                <p><strong>Format:</strong> ${parsedData.movements[0]?.fileType || 'Bilinmeyen'}</p>
                <p><strong>Toplam İşlem:</strong> ${parsedData.movements.length} adet</p>
              </div>
            </div>
          </div>
          
          <div class="pdf-info">
            <strong>📄 PDF Olarak Kaydetmek İçin:</strong><br>
            Yazdırma diyaloğunda "Hedef" kısmından <strong>"PDF olarak kaydet"</strong> seçeneğini seçin.
          </div>
          
          <!-- İstatistik Kutuları -->
          <div class="stats-grid">
            <div class="stat-box primary">
              <div class="stat-title">Toplam İşlem</div>
              <div class="stat-value">${parsedData.sales?.totalTransactions || 0}</div>
              <div class="stat-subtitle">Günlük satış işlemi</div>
            </div>
            
            <div class="stat-box success">
              <div class="stat-title">Toplam Tutar</div>
              <div class="stat-value">${formatCurrency(parsedData.sales?.totalAmount || 0)}</div>
              <div class="stat-subtitle">Günlük satış tutarı</div>
            </div>
            
            <div class="stat-box purple">
              <div class="stat-title">Toplam Hacim</div>
              <div class="stat-value">${formatVolume(parsedData.sales?.totalVolume || 0)}</div>
              <div class="stat-subtitle">Günlük satış hacmi</div>
            </div>
          </div>

          ${fuelTypesHTML}
          ${movementsHTML}
          
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6; border-radius: 6px; font-size: 9px; color: #6b7280;">
            <strong>Rapor Notu:</strong> Bu rapor ${new Date().toLocaleString('tr-TR')} tarihinde BT Rapor sistemi tarafından otomatik olarak oluşturulmuştur. 
            Akaryakıt satış verileri ${parsedData.movements[0]?.fileType || 'bilinmeyen'} formatından parse edilmiştir. 
            Tüm tutarlar Türk Lirası cinsinden, hacimler litre cinsinden gösterilmiştir.
          </div>
          
          <script>
            // Sayfa yüklendiğinde otomatik yazdırma diyaloğunu aç
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `;

      // Yeni pencerede HTML'i yazdır
      printWindow.document.write(fullHTML);
      printWindow.document.close();

      console.log('✅ PDF export (yazdır) başlatıldı');

    } catch (error) {
      console.error('❌ PDF export hatası:', error);
      alert('PDF export sırasında bir hata oluştu: ' + error);
    }
  };

  return (
    <DashboardLayout title="Akaryakıt Raporu">
      {/* Hata Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                {failedAnimationData ? (
                  <div className="w-12 h-12">
                    <Lottie animationData={failedAnimationData} loop={false} />
                  </div>
                ) : (
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Hata!</h2>
              <p className="text-gray-600 text-center mb-6">{errorMessage}</p>
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-6">
        <div className="w-full">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-red-800 to-red-900 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-red-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">⛽ Akaryakıt Vardiya Raporu</h1>
                  <p className="text-red-100 mt-1">Vardiya bazlı akaryakıt satış verilerini görüntüleyin ve analiz edin</p>
                </div>
              </div>
              <div className="text-right text-white">
                <div className="text-sm text-red-100">Son Güncelleme</div>
                <div className="text-lg font-semibold">{new Date().toLocaleDateString('tr-TR')}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            
           

            {/* Şirket Ayarları */}
            {companySettings.length > 0 && (
              <div className="mb-6 p-6 bg-green-50 rounded-lg border-2 border-dashed border-green-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-green-900">🏢 Şube ve Vardiya Ayarları</h2>
                
                </div>
                
                {isLoadingSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <span className="ml-3 text-green-700">Ayarlar yükleniyor...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* İstasyon Seçimi */}
                    <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-3">📍 İstasyon Seçimi</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {companySettings.map((setting) => (
                          <button
                            key={setting.id}
                            onClick={() => setSelectedCompany(setting)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                              selectedCompany?.id === setting.id
                                ? 'border-green-500 bg-green-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-25'
                            }`}
                          >
                            <div className="font-medium text-gray-900 mb-1">
                              🏢 {setting.branch_name}
                            </div>
                                                          <div className="text-xs text-gray-600">
                                <div className="mb-1">
                                  <span className="font-medium">Otomasyon Tipi:</span>
                                  <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                  {setting.file_type?.toUpperCase()}
                                </span>
                              </div>
                                </div>
                            </button>
                        ))}
                          </div>
                        </div>

                    {/* Tarih ve Vardiya Seçimi */}
                    {selectedCompany && (
                      <div className="bg-gradient-to-br from-white to-green-50 rounded-xl p-6 border-2 border-green-200 shadow-lg">
                        <div className="flex items-center mb-6">
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                      </div>
                          <h3 className="text-xl font-bold text-gray-800">📅 Tarih ve Vardiya Seçimi</h3>
                  </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                          {/* Tarih Seçimi */}
                          <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Tarih Seçin
                    </label>
                            <div className="relative">
                    <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-lg bg-white shadow-sm hover:border-green-300"
                                style={{
                                  backgroundImage: 'none',
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  appearance: 'none'
                                }}
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                              <svg className="w-4 h-4 text-orange-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              Gelecek tarihler seçilemez
                            </p>
                  </div>
                  
                          {/* Vardiya Numarası */}
                          <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Vardiya Numarası
                    </label>
                            <div className="flex items-center justify-center space-x-3">
                              <button
                                onClick={() => setShiftNumber(Math.max(1, shiftNumber - 1))}
                                className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 shadow-lg flex items-center justify-center text-xl font-bold"
                              >
                                -
                              </button>
                              <div className="w-24 h-12 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg flex items-center justify-center">
                                <span className="text-2xl font-bold text-blue-800">{shiftNumber}</span>
                              </div>
                              <button
                                onClick={() => setShiftNumber(Math.min(4, shiftNumber + 1))}
                                className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-lg flex items-center justify-center text-xl font-bold"
                              >
                                +
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 mt-3 text-center">
                              1-4 arası vardiya seçimi
                            </p>
                          </div>
                  </div>
                  
                        {/* Uyarı Kutusu */}
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-4 mb-6">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h4 className="text-sm font-semibold text-yellow-800">Dikkat!</h4>
                              <p className="text-sm text-yellow-700 mt-1">
                                Vardiya numarası olarak otomasyonu baz almanız gerekmektedir.
                              </p>
                            </div>
                  </div>
                </div>

                        {/* Vardiya Getir Butonu */}
                        <div className="text-center">
                  <button
                            onClick={readFromSelectedCompany}
                            disabled={isReading || !selectedDate}
                            className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 mx-auto"
                  >
                    {isReading ? (
                      <>
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                <span>Vardiya Getiriliyor...</span>
                      </>
                    ) : (
                      <>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                Vardiya Getir
                      </>
                    )}
                  </button>
                          {!selectedDate && (
                            <p className="text-sm text-red-600 mt-3 flex items-center justify-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              Lütfen önce bir tarih seçin
                            </p>
                          )}
                </div>
                      </div>
                    )}


                      </div>
                )}
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
                {/* Satış Özeti */}
                {parsedData.sales && (
                  <div id="satis-ozeti">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Satış Özeti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <span className="text-sm text-blue-600">Toplam İşlem</span>
                        <p className="text-2xl font-bold text-blue-900">{parsedData.sales.totalTransactions || 0}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <span className="text-sm text-green-600">Toplam Tutar</span>
                        <p className="text-2xl font-bold text-green-900">
                          {new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: 'TRY'
                          }).format(parsedData.sales.totalAmount || 0)}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <span className="text-sm text-purple-600">Toplam Hacim</span>
                        <p className="text-2xl font-bold text-purple-900">
                          {new Intl.NumberFormat('tr-TR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(parsedData.sales.totalVolume || 0)} L
                        </p>
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
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Intl.NumberFormat('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }).format(data.volume)} L
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Intl.NumberFormat('tr-TR', {
                                    style: 'currency',
                                    currency: 'TRY'
                                  }).format(data.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Dinamik Sütunlu Ham Tablo */}
                {parsedData.rawRows && parsedData.rawRows.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                       
                      </h3>
                                              <div className="flex gap-2">
                  <button
                    onClick={exportToPDF}
                    disabled={!parsedData || !parsedData.movements || parsedData.movements.length === 0}
                            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-md transform hover:scale-105 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                            📄 PDF
                  </button>
                </div>
              </div>
                    <div className="relative">
                      <div className="overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table className="w-full">
                          <thead className="sticky top-0 z-10">
                            <tr className="bg-gradient-to-r from-red-900 to-red-800 text-white">
                              {Object.keys((parsedData.rawRows || [{}])[0]).map((key) => (
                                <th
                                  key={key}
                                  className="px-1 py-1 text-center text-xs font-bold uppercase tracking-wider border-b border-red-800"
                                >
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(parsedData.rawRows || []).map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-gray-50 text-xs">
                                {Object.keys((parsedData.rawRows || [{}])[0]).map((key) => (
                                  <td
                                    key={key}
                                    className="px-1 py-1 whitespace-nowrap text-xs text-gray-900 text-center"
                                  >
                                    <div className="truncate">{sanitizeText(row[key] || '')}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
            </div>
              </div>
            </div>
                )}
              </div>
            )}

            
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
