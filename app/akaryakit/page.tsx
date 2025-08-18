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
    rawRows?: any[];
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

  const sanitizeText = (input: string): string => {
    if (!input) return '';
    let s = input
      .replace(/\uFFFD/g, '') // replacement char
      .replace(/[\x00-\x1F\x7F]/g, ' ') // kontrol karakterleri
      .replace(/\u00A0/g, ' '); // NBSP
    s = s.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return s;
  };

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
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 Response Data:', result);

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
                  FYT: fytStr,
                  TUTAR: tutarStr,
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
            // Eski XML formatı için mevcut parsing (basitleştirilmiş)
            console.log('Eski XML formatı - parsing eklenecek');
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
                  PLAKA: plate,
                  YAKIT: fuelTypeRaw,
                  LITRE: volume.toFixed(2),
                  FYT: unitPrice.toFixed(2),
                  TUTAR: amount.toFixed(2),
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
                  FYT: price.toFixed(2),
                  TUTAR: amount.toFixed(2),
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

  // D1C test verisi yükleme fonksiyonu
  const loadD1CTestData = () => {
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
      <div className="p-6">
        <div className="w-full">
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
                    onClick={loadD1CTestData}
                    disabled={isReading}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isReading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        İşleniyor...
                      </>
                    ) : (
                      <>
                        🧪 D1C Test Verisi
                      </>
                    )}
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

                {/* Dinamik Sütunlu Ham Tablo */}
                {parsedData.rawRows && parsedData.rawRows.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {selectedFileType === 'xml' ? '🧾 Ham XML Verileri' : 
                       selectedFileType === 'd1a' ? '📊 Ham D1A Verileri' : 
                       selectedFileType === 'd1c' ? '📊 Ham D1C Verileri' :
                       '📊 Ham Veriler'}
                    </h3>
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
                  <button
                    onClick={exportToPDF}
                    disabled={!parsedData || !parsedData.movements || parsedData.movements.length === 0}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    📄 PDF Yazdır
                  </button>
                </div>
              </div>
            )}

            {/* Bilgi */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-md font-medium text-yellow-800 mb-2">ℹ️ Kullanım Bilgileri</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Dosya tipini seçin ve dosya yolu girip "Dosya Oku" butonuna tıklayın</li>
                <li>• Desteklenen formatlar: XML (POAS formatı dahil), TXT, D1A, D1B, D1C, F1D</li>
                <li>• "D1C Test Verisi" butonu ile örnek D1C formatını test edebilirsiniz</li>
                <li>• Yüklenen hareket verileri sıralı rapor halinde tabloda gösterilecek</li>
                <li>• Her satış hareketi dosya bilgileriyle birlikte listelenir</li>
                <li>• "Yeni Dosya" ile başka bir dosya yükleyebilirsiniz</li>
              </ul>
            </div>

            {/* D1C Format Bilgisi */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-md font-medium text-blue-800 mb-2">📋 D1C Format Bilgisi</h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p><strong>D1C Formatı:</strong> Sabit pozisyonlu akaryakıt satış raporu formatı</p>
                <p><strong>Kolon Pozisyonları:</strong></p>
                <ul className="ml-4 space-y-1 text-xs">
                  <li>• 0-10: Tarih</li>
                  <li>• 11-19: Saat</li>
                  <li>• 20-50: Filo Adı</li>
                  <li>• 51-57: Kodu</li>
                  <li>• 58-67: Plaka</li>
                  <li>• 68-78: Yakıt Türü</li>
                  <li>• 78-85: Litre (3 basamak ondalık: 000775 → 7.75)</li>
                  <li>• 85-90: Fiyat (2 basamak ondalık: 2579 → 25.79)</li>
                  <li>• 90-99: Tutar (2 basamak ondalık: 00020000 → 200.00)</li>
                  <li>• 99-102: Tabanca</li>
                  <li>• 102-105: Pompa</li>
                  <li>• 105-112: Fiş No</li>
                </ul>
                <p><strong>Desteklenen Yakıt Türleri:</strong> POGAZ, M YN V/MAX, KBN95 YN V</p>
                <p><strong>Sayısal Format:</strong> Litre 3 basamak, Fiyat/Tutar 2 basamak ondalık</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
