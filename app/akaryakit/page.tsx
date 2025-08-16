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
      let rawRows: any[] | undefined = undefined;

                      // D1A ve D1C dosya formatları için özel parse (sabit kolonlu)
        if ((fileType === 'd1a' || fileType === 'd1c') && typeof data === 'string') {
          console.log(`🔍 ${fileType.toUpperCase()} Parse (fixed-width) başlıyor...`);
          const lines = data.split('\r\n').filter(line => line.length > 0);

          if (lines.length < 3) {
            console.warn(`${fileType.toUpperCase()}: Yetersiz satır sayısı`);
            movements = [];
          } else {
            // D1A için sabit pozisyonlar
            if (fileType === 'd1a') {
              const dataLines = lines.slice(2); // İlk 2 satırı atla
              movements = dataLines.map((line: string, idx: number) => {
                // Sabit pozisyonlara göre veri çıkar
                const tarih = line.substring(0, 10).trim();
                const saat = line.substring(11, 19).trim();
                const filoAdi = line.substring(19, 50).trim();
                const kodu = line.substring(51, 57).trim();
                const plaka1 = line.substring(58, 67).trim();
                const yakit = line.substring(68, 78).trim();
                const litreStr = line.substring(79, 85).trim();
                const fytStr = line.substring(86, 90).trim();
                const tutarStr = line.substring(91, 99).trim();
                const tabanca = line.substring(100, 102).trim();
                const pompa = line.substring(103, 105).trim();
                const fisNo = line.substring(106, 113).trim();
                const plaka2 = line.substring(114, 133).trim();
                const ykFno = line.substring(134, 143).trim();
                const kmStr = line.substring(144, 155).trim();
                const amrGiris = line.substring(156, 160).trim();

                
                const litreRaw = parseInt(litreStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const fytRaw = parseInt(fytStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const tutarRaw = parseInt(tutarStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const kmRaw = parseInt(kmStr.replace(/[^0-9-]/g, ''), 10) || 0;

                const volume = litreRaw / 100;
                const unitPriceKurus = fytRaw / 100; // Fiyat 100'e bölünüyor
                const amountKurus = tutarRaw;

                return {
                  id: idx + 1,
                  date: tarih,
                  time: saat,
                  pumpNo: pompa,
                  nozzleNo: ykFno,
                  fuelType: yakit,
                  volume: volume,
                  amount: amountKurus,
                  unitPrice: unitPriceKurus,
                  transactionType: 'Nakit',
                  attendantName: filoAdi || 'Bilinmeyen',
                  vehiclePlate: plaka2 || plaka1,
                  cardNumber: '',
                  fileName: fileName,
                  fileType: fileType.toUpperCase(),
                  fisNo: fisNo,
                  km: kmRaw,
                  kodu: kodu
                } as MovementData;
              }).filter(Boolean) as MovementData[];

              // RawRows oluştur
              rawRows = dataLines.map((line: string, idx: number) => {
                const litreRaw = parseInt(line.substring(79, 85).trim().replace(/[^0-9-]/g, ''), 10) || 0;
                const fytRaw = parseInt(line.substring(86, 90).trim().replace(/[^0-9-]/g, ''), 10) || 0;
                const tutarRaw = parseInt(line.substring(91, 99).trim().replace(/[^0-9-]/g, ''), 10) || 0;
                
                const volume = litreRaw / 100;
                const unitPrice = fytRaw / 100;
                const amount = tutarRaw / 10; // 1718 kuruş = 17.18 TL
                
                return {
                  TARIH: line.substring(0, 10).trim(),
                  SAAT: line.substring(11, 19).trim(),
                  'FILO ADI': line.substring(19, 50).trim(),
                  KODU: line.substring(51, 57).trim(),
                  PLAKA: line.substring(58, 67).trim(),
                  YAKIT: line.substring(68, 78).trim(),
                  LITRE: volume.toFixed(2) + ' L',
                  FYT: unitPrice.toFixed(2) + ' ₺',
                  TUTAR: amount.toFixed(2) + ' ₺',
                  TABANCA: line.substring(100, 102).trim(),
                  POMPA: line.substring(103, 105).trim(),
                  'FIS NO': line.substring(106, 113).trim(),
                  PLAKA2: line.substring(113, 133).trim(),
                  'YK.FNO': line.substring(134, 143).trim(),
                  KM: line.substring(144, 155).trim(),
                  'AMR GIRIS': line.substring(156, 160).trim()
                };
              });

            } else {
              // D1C için mevcut parsing
              const headerLine = lines[1];

              // Başlık üzerinde kolon başlangıçlarını bul
              const findAll = (str: string, label: string): number[] => {
                const idxs: number[] = [];
                let pos = 0;
                while (true) {
                  const i = str.indexOf(label, pos);
                  if (i === -1) break;
                  idxs.push(i);
                  pos = i + label.length;
                }
                return idxs;
              };

              const positionsRaw: { key: string; label: string; pos: number }[] = [];
              const pushPos = (key: string, label: string, occIndex = 0) => {
                const arr = findAll(headerLine, label);
                const pos = arr[occIndex] ?? -1;
                positionsRaw.push({ key, label, pos });
              };

              pushPos('date', 'TARIH');
              pushPos('time', 'SAAT');
              pushPos('filo', 'FILO ADI');
              pushPos('kodu', 'KODU');
              pushPos('plaka1', 'PLAKA', 0);
              pushPos('yakit', 'YAKIT');
              pushPos('litre', 'LITRE');
              pushPos('fyt', 'FYT');
              pushPos('tutar', 'TUTAR');
              pushPos('tbncpu', 'TBNCPU');
              pushPos('fisno', 'FIS NO');
              pushPos('ykfno', 'YK.FNO');
              pushPos('km', 'KM');
              pushPos('amr', 'AMR GIRIS');

              const columns = positionsRaw
                .filter(c => c.pos >= 0)
                .sort((a, b) => a.pos - b.pos)
                .map((c, i, arr) => ({
                  key: c.key,
                  start: c.pos,
                  end: i < arr.length - 1 ? arr[i + 1].pos : headerLine.length + 50
                }));

              const pick = (line: string, key: string) => {
                const col = columns.find(c => c.key === key);
                if (!col) return '';
                return line.slice(col.start, col.end).trim();
              };

              const dataLines = lines.slice(2);
              movements = dataLines.map((line: string, idx: number) => {
                const tarih = pick(line, 'date');
                const saat = pick(line, 'time');
                const filoAdi = pick(line, 'filo');
                const kodu = pick(line, 'kodu');
                const plaka1 = pick(line, 'plaka1');
                const yakit = pick(line, 'yakit');
                const litreStr = pick(line, 'litre');
                const fytStr = pick(line, 'fyt');
                const tutarStr = pick(line, 'tutar');
                const tbncpu = pick(line, 'tbncpu');
                const fisNo = pick(line, 'fisno');
                const ykFno = pick(line, 'ykfno');
                const kmStr = pick(line, 'km');

                const litreRaw = parseInt(litreStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const fytRaw = parseInt(fytStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const tutarRaw = parseInt(tutarStr.replace(/[^0-9-]/g, ''), 10) || 0;
                const kmRaw = parseInt(kmStr.replace(/[^0-9-]/g, ''), 10) || 0;

                const volume = litreRaw / 100;
                const unitPriceKurus = fytRaw / 100; // Fiyat 100'e bölünüyor
                const amountKurus = tutarRaw;

                return {
                  id: idx + 1,
                  date: tarih,
                  time: saat,
                  pumpNo: tbncpu,
                  nozzleNo: ykFno,
                  fuelType: yakit,
                  volume: volume,
                  amount: amountKurus,
                  unitPrice: unitPriceKurus,
                  transactionType: 'Nakit',
                  attendantName: filoAdi || 'Bilinmeyen',
                  vehiclePlate: plaka1,
                  cardNumber: '',
                  fileName: fileName,
                  fileType: fileType.toUpperCase(),
                  fisNo: fisNo,
                  km: kmRaw,
                  kodu: kodu
                } as MovementData;
              }).filter(Boolean) as MovementData[];

              // D1C için rawRows oluştur
              rawRows = dataLines.map((line: string, idx: number) => {
                const parts = line.split(/\s+/).filter(part => part.trim() !== '');
                
                const litreRaw = parseInt((parts[parts.length - 9] || '').replace(/[^0-9-]/g, ''), 10) || 0;
                const fytRaw = parseInt((parts[parts.length - 8] || '').replace(/[^0-9-]/g, ''), 10) || 0;
                const tutarRaw = parseInt((parts[parts.length - 7] || '').replace(/[^0-9-]/g, ''), 10) || 0;
                
                const volume = litreRaw / 100;
                const unitPrice = fytRaw / 100;
                const amount = tutarRaw / 10; // 1718 kuruş = 17.18 TL
                
                return {
                  TARIH: parts[0] || '',
                  SAAT: parts[1] || '',
                  'FILO ADI': parts.slice(2, -12).join(' ') || '',
                  KODU: parts[parts.length - 12] || '',
                  PLAKA: parts[parts.length - 11] || '',
                  YAKIT: parts[parts.length - 10] || '',
                  LITRE: volume.toFixed(2) + ' L',
                  FYT: unitPrice.toFixed(2) + ' ₺',
                  TUTAR: amount.toFixed(2) + ' ₺',
                  TBNCPU: parts[parts.length - 6] || '',
                  'FIS NO': parts[parts.length - 5] || '',
                  'YK.FNO': parts[parts.length - 4] || '',
                  KM: parts[parts.length - 3] || '',
                  'AMR GIRIS': parts[parts.length - 2] || ''
                };
              });
            }

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
              version: `${fileType.toUpperCase()} Format`,
              companyCode: fileType.toUpperCase(),
              stationCode: fileType.toUpperCase(),
              reportDate: new Date().toLocaleDateString('tr-TR')
            };
          }

      } else if (fileType === 'xml' && typeof data === 'string') {
        // XML parse
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(data, 'text/xml');
          const ns = doc.documentElement.namespaceURI || undefined;

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

          // Global params
          const gpNodes = q(doc, 'GlobalParams');
          if (gpNodes && gpNodes.length > 0) {
            const gp = gpNodes[0] as Element;
            globalParams = {
              version: textNode(gp, 'Version'),
              companyCode: textNode(gp, 'CompanyCode'),
              stationCode: textNode(gp, 'StationCode'),
              unitPriceDecimal: textNode(gp, 'UnitPriceDecimal'),
              amountDecimal: textNode(gp, 'AmountDecimal'),
              totalDecimal: textNode(gp, 'TotalDecimal'),
              reportDate: new Date().toLocaleDateString('tr-TR')
            };
          }

          // Fuel type map from TankTotals
          const fuelTypeMap: Record<string, string> = {};
          const tankTotalsNodes = q(doc, 'TankTotals');
          if (tankTotalsNodes && tankTotalsNodes.length > 0) {
            const details = q(tankTotalsNodes[0] as Element, 'TankDetails');
            for (let i = 0; i < details.length; i++) {
              const d = details[i] as Element;
              const code = textNode(d, 'PmpFuelType');
              const fname = sanitizeText(textNode(d, 'FuelType') || textNode(d, 'TankName'));
              if (code) fuelTypeMap[code] = fname || code;
            }
          }

          const toDateTime = (yyyymmddhhmmss: string) => {
            if (!yyyymmddhhmmss || yyyymmddhhmmss.length < 14) return { date: '', time: '' };
            const y = yyyymmddhhmmss.slice(0, 4);
            const m = yyyymmddhhmmss.slice(4, 6);
            const d = yyyymmddhhmmss.slice(6, 8);
            const hh = yyyymmddhhmmss.slice(8, 10);
            const mm = yyyymmddhhmmss.slice(10, 12);
            const ss = yyyymmddhhmmss.slice(12, 14);
            return { date: `${d}/${m}/${y}`, time: `${hh}:${mm}:${ss}` };
          };

          const paymentTypeName = (code: string): string => {
            switch (code) {
              case '0': return 'Nakit';
              case '1': return 'Kredi Kartı';
              case '2': return 'Diğer Kart';
              case '3': return 'Cari/Diğer';
              default: return 'Bilinmeyen';
            }
          };

          movements = [];
          const txnsNodes = q(doc, 'Txns');
          const dynamicRows: any[] = [];
          if (txnsNodes && txnsNodes.length > 0) {
            const txnNodes = q(txnsNodes[0] as Element, 'Txn');
            for (let i = 0; i < txnNodes.length; i++) {
              const txn = txnNodes[i] as Element;
              const tag = q(txn, 'TagDetails')[0] as Element;
              const sale = q(txn, 'SaleDetails')[0] as Element;
              if (!sale) continue;

              const dt = textNode(sale, 'DateTime');
              const { date: d, time: t } = toDateTime(dt);
              const pumpNr = textNode(sale, 'PumpNr');
              const nozzleNr = textNode(sale, 'NozzleNr');
              const fuelCode = textNode(sale, 'FuelType');
              const fuelName = sanitizeText(fuelTypeMap[fuelCode] || fuelCode);
              const amountStr = textNode(sale, 'Amount');
              const totalStr = textNode(sale, 'Total');
              const fullUnitStr = textNode(sale, 'FullUnitPrice');
              const unitPriceStr = textNode(sale, 'UnitPrice');
              const payment = textNode(sale, 'PaymentType');
              const fleetName = tag ? textNode(tag, 'FleetName') : '';
              const tagPlate = tag ? textNode(tag, 'Plate') : '';
              const ecrPlate = textNode(sale, 'ECRPlate');
              const loyaltyCardNo = textNode(sale, 'LoyaltyCardNo');
              const receipt = textNode(sale, 'ReceiptNr');

              const volume = (parseInt((amountStr || '').replace(/[^0-9-]/g, ''), 10) || 0) / 100;
              const unitPrice = (parseInt((fullUnitStr || '').replace(/[^0-9-]/g, ''), 10) || 0)
                || (parseInt((unitPriceStr || '').replace(/[^0-9-]/g, ''), 10) || 0);
              const totalKurus = parseInt((totalStr || '').replace(/[^0-9-]/g, ''), 10) || 0;

              movements.push({
                id: movements.length + 1,
                date: sanitizeText(d),
                time: sanitizeText(t),
                pumpNo: sanitizeText(pumpNr),
                nozzleNo: sanitizeText(nozzleNr),
                fuelType: sanitizeText(fuelName),
                volume: volume,
                amount: totalKurus,
                unitPrice: unitPrice,
                transactionType: sanitizeText(paymentTypeName(payment)),
                attendantName: sanitizeText(fleetName) || 'Bilinmeyen',
                vehiclePlate: sanitizeText(ecrPlate || tagPlate),
                cardNumber: sanitizeText(loyaltyCardNo),
                fileName: fileName,
                fileType: fileType.toUpperCase(),
                fisNo: receipt
              } as MovementData);

              // Dinamik tablo için ham satır
              const row: Record<string, string> = {};
              if (tag) {
                ['FleetCode','FleetName','TagNr','Plate','EngineHour','Odometer'].forEach(k => {
                  const v = textNode(tag, k);
                  if (v !== '') row[k] = v;
                });
              }
              ['TxnType','DateTime','ReceiptNr','FuelType','UnitPrice','Amount','Total','PumpNr','NozzleNr','PaymentType','ECRPlate','ECRReceiptNr','Redemption','DiscountAmount','EarnedPoints','EarnedMoney','LoyaltyCardNo','LoyaltyCardType','FullUnitPrice']
                .forEach(k => {
                  const v = textNode(sale, k);
                  if (v !== '') row[k] = v;
                });
              dynamicRows.push(row);
            }
          }

          // Satış özeti
          const totalTransactions = (movements as any[]).length;
          const totalAmount = (movements as any[]).reduce((s: number, m: any) => s + m.amount, 0);
          const totalVolume = (movements as any[]).reduce((s: number, m: any) => s + m.volume, 0);
          const fuelTypes: any = {};
          (movements as any[]).forEach((m: any) => {
            if (!fuelTypes[m.fuelType]) fuelTypes[m.fuelType] = { volume: 0, amount: 0 };
            fuelTypes[m.fuelType].volume += m.volume;
            fuelTypes[m.fuelType].amount += m.amount;
          });
          sales = { totalTransactions, totalAmount, totalVolume, fuelTypes };
          rawRows = dynamicRows;

        } catch (e) {
          console.error('XML parse hatası:', e);
          movements = [];
          sales = { totalTransactions: 0, totalAmount: 0, totalVolume: 0, fuelTypes: {} };
        }
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
         globalParams,
         rawRows
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
    }).format(amount); // Artık TL cinsinden geliyor
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
    }).format(price); // Artık TL cinsinden geliyor
  };

  // Türkçe karakter ve mojibake düzeltme yardımcıları
  const fixTurkishMojibake = (input: string): string => {
    if (!input) return '';
    const map: Record<string, string> = {
      'Ã‡': 'Ç', 'Ã§': 'ç',
      'Ã–': 'Ö', 'Ã¶': 'ö',
      'Ãœ': 'Ü', 'Ã¼': 'ü',
      'Ä°': 'İ', 'Ä±': 'ı',
      'ÅŸ': 'ş', 'Åž': 'Ş',
      'ÄŸ': 'ğ', 'Äž': 'Ğ',
      'â€“': '–', 'â€”': '—',
      'â€˜': '‘', 'â€™': '’',
      'â€œ': '“', 'â€	d': '”', 'â€': '”',
      'â€¦': '…',
      'â€¢': '•'
    };
    let s = input;
    for (const [k, v] of Object.entries(map)) {
      s = s.split(k).join(v);
    }
    return s;
  };

  // Şüpheli metinleri farklı encoding varsayımlarıyla tekrar decode etmeyi dener
  const smartDecode = (input: string): string => {
    try {
      const bytes = new Uint8Array(Array.from(input, ch => ch.charCodeAt(0) & 0xff));
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const win1254 = new TextDecoder('windows-1254', { fatal: false }).decode(bytes);
      const score = (s: string) => {
        const turkish = (s.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
        const repl = (s.match(/[\uFFFD]/g) || []).length;
        return turkish * 5 - repl;
      };
      const candidates = [input, utf8, win1254].map(s => fixTurkishMojibake(s));
      candidates.sort((a, b) => score(b) - score(a));
      return candidates[0];
    } catch {
      return input;
    }
  };

  const sanitizeText = (input: string): string => {
    if (!input) return '';
    let s = input
      .replace(/\uFFFD/g, '') // replacement char
      .replace(/[\x00-\x1F\x7F]/g, ' ') // kontrol karakterleri
      .replace(/\u00A0/g, ' '); // NBSP
    if (/Ã|Â|Å|Ä|Ð|Þ|ý|þ|ð/.test(s)) {
      s = smartDecode(s);
    }
    s = fixTurkishMojibake(s);
    s = s.normalize('NFKC').replace(/\s+/g, ' ').trim();
    // Tamamı büyük harf ise Türkçe yerel kurallarla normalize et
    if (s && s === s.toUpperCase()) {
      s = s.toLocaleLowerCase('tr-TR').toLocaleUpperCase('tr-TR');
    }
    return s;
  };

  // Dinamik tablo başlık ve değer formatları
  const dynamicHeaderMap: Record<string, string> = {
    DateTime: 'Tarih Saat',
    ReceiptNr: 'Fiş No',
    FuelType: 'Yakıt Kodu',
    UnitPrice: 'Birim Fiyat (TL/L)',
    FullUnitPrice: 'Birim Fiyat (TL/L)',
    Amount: 'Hacim (L)',
    Total: 'Tutar (TL)',
    PumpNr: 'Pompa No',
    NozzleNr: 'Tabanca No',
    PaymentType: 'Ödeme Tipi',
    ECRPlate: 'ECR Plaka',
    ECRReceiptNr: 'ECR Fiş No',
    Redemption: 'Puan Kullanımı',
    DiscountAmount: 'İndirim',
    EarnedPoints: 'Kazanılan Puan',
    EarnedMoney: 'Kazanılan Para',
    LoyaltyCardNo: 'Sadakat Kart No',
    LoyaltyCardType: 'Sadakat Kart Tipi',
    FleetCode: 'Filo Kodu',
    FleetName: 'Müşteri/Filo',
    Plate: 'Plaka',
    EngineHour: 'Motor Saati',
    Odometer: 'Kilometre',
    TagNr: 'Etiket No',
    TxnType: 'İşlem Tipi'
  };

  const dynamicNumberColumns = new Set<string>([
    'Amount', 'Total', 'UnitPrice', 'FullUnitPrice', 'DiscountAmount', 'EarnedPoints', 'EarnedMoney', 'Odometer', 'EngineHour'
  ]);

  const formatDateTime14 = (val: string) => {
    const s = (val || '').toString().trim();
    if (s.length !== 14) return s;
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    const hh = s.slice(8, 10);
    const mm = s.slice(10, 12);
    const ss = s.slice(12, 14);
    return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
  };

  const formatPayment = (code: string) => {
    switch (code) {
      case '0': return 'Nakit';
      case '1': return 'Kredi Kartı';
      case '2': return 'Diğer Kart';
      case '3': return 'Cari/Diğer';
      default: return code;
    }
  };

  const formatDynamicValue = (key: string, value: any) => {
    const raw = sanitizeText((value ?? '').toString());
    const toInt = (v: string) => parseInt(v.replace(/[^0-9-]/g, ''), 10) || 0;
    if (key === 'DateTime') return formatDateTime14(raw);
    if (key === 'Amount') return `${formatVolume(toInt(raw) / 100)} L`;
    if (key === 'FullUnitPrice') return formatUnitPrice(toInt(raw)); // kuruş
    if (key === 'UnitPrice') return formatUnitPrice(toInt(raw)); // kuruş
    if (key === 'Total') return formatCurrency(toInt(raw));
    if (key === 'PaymentType') return formatPayment(raw);
    if (key === 'Odometer' || key === 'EngineHour') return toInt(raw).toString();
    return raw;
  };

  // Dinamik tablo kolon genişlikleri (px)
  const getDynamicColumnWidth = (key: string): number => {
    switch (key) {
      case 'DateTime':
        return 160;
      case 'ReceiptNr':
      case 'ECRReceiptNr':
        return 110;
      case 'FuelType':
        return 120;
      case 'UnitPrice':
      case 'FullUnitPrice':
        return 150;
      case 'Amount':
        return 120;
      case 'Total':
        return 140;
      case 'PumpNr':
      case 'NozzleNr':
        return 100;
      case 'PaymentType':
        return 130;
      case 'ECRPlate':
      case 'Plate':
        return 130;
      case 'FleetName':
        return 220;
      case 'FleetCode':
      case 'LoyaltyCardNo':
      case 'TagNr':
        return 160;
      case 'DiscountAmount':
      case 'EarnedMoney':
        return 130;
      case 'EarnedPoints':
      case 'LoyaltyCardType':
        return 120;
      case 'Odometer':
      case 'EngineHour':
        return 120;
      default:
        return 140;
    }
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

                {/* Hareket Verileri tablosu kaldırıldı - sadece dinamik tablo kullanılacak */}

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

                {/* Dinamik Sütunlu Ham Tablo */}
                {((selectedFileType === 'xml' || selectedFileType === 'd1c' || selectedFileType === 'd1a') && parsedData.rawRows && parsedData.rawRows.length > 0) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {selectedFileType === 'xml' ? '🧾 Ham XML Kolonları' : 
                       selectedFileType === 'd1a' ? '📊 Ham D1A Verileri' : 
                       '📊 Ham D1C Verileri'}
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
                                style={{ width: `${getDynamicColumnWidth(key)}px`, minWidth: `${getDynamicColumnWidth(key)}px` }}
                              >
                                {dynamicHeaderMap[key] || key}
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
                                  className={`px-1 py-1 whitespace-nowrap text-xs text-gray-900 text-center`}
                                  style={{ width: `${getDynamicColumnWidth(key)}px`, minWidth: `${getDynamicColumnWidth(key)}px` }}
                                >
                                  <div className="truncate">{sanitizeText(formatDynamicValue(key, row[key]))}</div>
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
