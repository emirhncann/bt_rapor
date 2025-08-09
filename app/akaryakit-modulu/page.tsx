'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';

// XML verisinden çıkarılan örnek veriler
const sampleData = {
  globalParams: {
    version: "TURPAK Pumpomat V9.2.0 Build: 27",
    companyCode: "7732",
    stationCode: "000299",
    reportDate: "27 Mart 2025"
  },
  tankTotals: [
    {
      tankNo: 1,
      tankName: "MOTORIN",
      fuelType: "MOTORIN",
      currentVolume: 12265,
      previousVolume: 13059,
      delta: 794,
      deliveryVolume: 0
    },
    {
      tankNo: 2,
      tankName: "MOTORIN",
      fuelType: "MOTORIN", 
      currentVolume: 14677,
      previousVolume: 14680,
      delta: 3,
      deliveryVolume: 0
    },
    {
      tankNo: 3,
      tankName: "OPTIMUM MOTORIN",
      fuelType: "OPTIMUM MOTORIN",
      currentVolume: 13832,
      previousVolume: 14560,
      delta: 728,
      deliveryVolume: 0
    },
    {
      tankNo: 4,
      tankName: "OPTIMUM KURSUNSUZ 95",
      fuelType: "OPTIMUM KURSUNSUZ 95",
      currentVolume: 9114,
      previousVolume: 9279,
      delta: 165,
      deliveryVolume: 0
    },
    {
      tankNo: 5,
      tankName: "MOTORIN",
      fuelType: "MOTORIN",
      currentVolume: 6609,
      previousVolume: 6774,
      delta: 165,
      deliveryVolume: 0
    },
    {
      tankNo: 101,
      tankName: "LPG",
      fuelType: "LPG",
      currentVolume: 0,
      previousVolume: 0,
      delta: 0,
      deliveryVolume: 0
    }
  ],
  pumpTotalizers: [
    { pumpName: "01", nozzles: 4, totalSales: 387353049 },
    { pumpName: "02", nozzles: 4, totalSales: 159428571 },
    { pumpName: "03", nozzles: 4, totalSales: 243799906 },
    { pumpName: "04", nozzles: 4, totalSales: 446496748 },
    { pumpName: "05", nozzles: 4, totalSales: 344650667 },
    { pumpName: "06", nozzles: 4, totalSales: 321252022 },
    { pumpName: "07", nozzles: 1, totalSales: 4880876 },
    { pumpName: "08", nozzles: 1, totalSales: 4895588 }
  ],
  salesSummary: {
    totalTransactions: 75,
    totalAmount: 10850000, // Toplam satış tutarı (kuruş)
    totalVolume: 123456, // Toplam satış hacmi (litre)
    fuelTypes: {
      "MOTORIN": { volume: 65432, amount: 6500000 },
      "OPTIMUM MOTORIN": { volume: 32100, amount: 2800000 },
      "OPTIMUM KURSUNSUZ 95": { volume: 21500, amount: 1400000 },
      "LPG": { volume: 4424, amount: 150000 }
    }
  },
  attendantPerformance: [
    {
      id: 1,
      name: "Ahmet YILMAZ",
      shift: "Sabah (06:00-14:00)",
      totalTransactions: 28,
      totalAmount: 4250000,
      totalVolume: 45600,
      averageTransaction: 151786,
      efficiency: 95,
      pumpsHandled: ["01", "02", "03"],
      startTime: "06:00",
      endTime: "14:00"
    },
    {
      id: 2,
      name: "Mehmet KAYA",
      shift: "Öğle (14:00-22:00)", 
      totalTransactions: 32,
      totalAmount: 4800000,
      totalVolume: 52300,
      averageTransaction: 150000,
      efficiency: 98,
      pumpsHandled: ["04", "05", "06"],
      startTime: "14:00",
      endTime: "22:00"
    },
    {
      id: 3,
      name: "Ali ÖZKAN",
      shift: "Gece (22:00-06:00)",
      totalTransactions: 15,
      totalAmount: 1800000,
      totalVolume: 25556,
      averageTransaction: 120000,
      efficiency: 89,
      pumpsHandled: ["07", "08"],
      startTime: "22:00",
      endTime: "06:00"
    }
  ]
};

export default function AkaryakitModulu() {
  const [selectedTab, setSelectedTab] = useState('upload');
  const [tankData, setTankData] = useState(sampleData.tankTotals);
  const [pumpData, setPumpData] = useState(sampleData.pumpTotalizers);
  const [attendantData, setAttendantData] = useState(sampleData.attendantPerformance);
  const [salesData, setSalesData] = useState(sampleData.salesSummary);
  const [globalInfo, setGlobalInfo] = useState(sampleData.globalParams);
  const [xmlInput, setXmlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState('');

  // Tank durumu renk kodları
  const getTankStatus = (currentVolume: number, previousVolume: number) => {
    const percentage = (currentVolume / previousVolume) * 100;
    if (percentage > 80) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Dolu' };
    if (percentage > 50) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Orta' };
    if (percentage > 20) return { color: 'text-orange-600', bg: 'bg-orange-100', status: 'Düşük' };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Kritik' };
  };

  // Yakıt türü ikonu
  const getFuelIcon = (fuelType: string) => {
    if (fuelType.includes('LPG')) {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  };

  // Formatters
  const formatVolume = (volume: number) => {
    return new Intl.NumberFormat('tr-TR').format(volume) + ' L';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount); // D1A formatında tutarlar zaten TL cinsinden
  };

  // D1A format parse fonksiyonu
  const parseD1AData = (d1aString: string) => {
    try {
      const lines = d1aString.trim().split('\n');
      
      // Header satırını atla
      const dataLines = lines.filter(line => 
        line.trim() && 
        !line.includes('TARIH') && 
        !line.includes('SAAT') && 
        !line.includes('FILO ADI') &&
        !line.includes('TL') &&
        line.length > 50
      );

      // Global parametreler
      const globalParams = {
        version: "D1A Format Rapor",
        companyCode: "7732",
        stationCode: "000299", 
        reportDate: new Date().toLocaleDateString('tr-TR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      };

      // Yakıt türü mapping
      const fuelTypeMapping: {[key: string]: string} = {
        'Optımum Mo': 'OPTIMUM MOTORIN',
        'OPTİMUM KU': 'OPTIMUM KURSUNSUZ 95', 
        'Motorin': 'MOTORIN',
        'LPG': 'LPG'
      };

      // Satış verilerini analiz et
      const fuelTypes: {[key: string]: {volume: number, amount: number}} = {};
      let totalAmount = 0;
      let totalVolume = 0;
      const transactions: any[] = [];

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

          // Litre ve tutar bilgilerini bul
          for (let i = parts.length - 4; i < parts.length; i++) {
            const part = parts[i];
            if (part.match(/^\d+$/)) {
              if (volume === 0) {
                volume = parseInt(part);
              } else if (amount === 0) {
                amount = parseInt(part);
              } else if (price === 0) {
                price = parseInt(part);
              }
            }
          }

          if (fuelType && volume > 0 && amount > 0) {
            // Fuel type'a göre grupla
            if (!fuelTypes[fuelType]) {
              fuelTypes[fuelType] = { volume: 0, amount: 0 };
            }
            
            fuelTypes[fuelType].volume += volume;
            fuelTypes[fuelType].amount += amount;
            totalAmount += amount;
            totalVolume += volume;

            // İşlem kaydı
            transactions.push({
              id: index + 1,
              date: dateStr,
              time: timeStr,
              fuelType,
              volume,
              amount,
              price
            });
          }
        } catch (lineError) {
          console.warn('Satır parse hatası:', line, lineError);
        }
      });

      const salesSummary = {
        totalTransactions: transactions.length,
        totalAmount,
        totalVolume,
        fuelTypes
      };

      // Tank verilerini simüle et (D1A'da tank bilgisi yok)
      const tanks = Object.entries(fuelTypes).map(([fuelType, data], index) => ({
        tankNo: index + 1,
        tankName: fuelType,
        fuelType: fuelType,
        currentVolume: Math.floor(data.volume * 0.8), // %80 doluluk simülasyonu
        previousVolume: Math.floor(data.volume * 0.9),
        delta: Math.floor(data.volume * 0.1),
        deliveryVolume: Math.floor(data.volume * 0.2)
      }));

      // Pompa verilerini simüle et
      const pumps = [
        { pumpName: "Pompa 1", nozzles: 2, totalSales: Math.floor(totalAmount * 0.25) },
        { pumpName: "Pompa 2", nozzles: 2, totalSales: Math.floor(totalAmount * 0.25) },
        { pumpName: "Pompa 3", nozzles: 2, totalSales: Math.floor(totalAmount * 0.25) },
        { pumpName: "Pompa 4", nozzles: 2, totalSales: Math.floor(totalAmount * 0.25) }
      ];

      // Pompacı verilerini simüle et
      const attendants = [
        {
          id: 1,
          name: "Pompacı A",
          shift: "Sabah (06:00-14:00)",
          totalTransactions: Math.ceil(transactions.length * 0.4),
          totalAmount: Math.ceil(totalAmount * 0.4),
          totalVolume: Math.ceil(totalVolume * 0.4),
          averageTransaction: Math.ceil(totalAmount * 0.4 / Math.ceil(transactions.length * 0.4)),
          efficiency: 92 + Math.floor(Math.random() * 8),
          pumpsHandled: pumps.slice(0, 2).map(p => p.pumpName),
          startTime: "06:00",
          endTime: "14:00"
        },
        {
          id: 2,
          name: "Pompacı B", 
          shift: "Öğle (14:00-22:00)",
          totalTransactions: Math.ceil(transactions.length * 0.45),
          totalAmount: Math.ceil(totalAmount * 0.45),
          totalVolume: Math.ceil(totalVolume * 0.45),
          averageTransaction: Math.ceil(totalAmount * 0.45 / Math.ceil(transactions.length * 0.45)),
          efficiency: 90 + Math.floor(Math.random() * 10),
          pumpsHandled: pumps.slice(2, 4).map(p => p.pumpName),
          startTime: "14:00",
          endTime: "22:00"
        },
        {
          id: 3,
          name: "Pompacı C",
          shift: "Gece (22:00-06:00)", 
          totalTransactions: Math.ceil(transactions.length * 0.15),
          totalAmount: Math.ceil(totalAmount * 0.15),
          totalVolume: Math.ceil(totalVolume * 0.15),
          averageTransaction: Math.ceil(totalAmount * 0.15 / Math.ceil(transactions.length * 0.15)),
          efficiency: 85 + Math.floor(Math.random() * 10),
          pumpsHandled: pumps.slice(0, 2).map(p => p.pumpName),
          startTime: "22:00",
          endTime: "06:00"
        }
      ];

      // State'leri güncelle
      setGlobalInfo(globalParams);
      setTankData(tanks);
      setPumpData(pumps);
      setSalesData(salesSummary as any);
      setAttendantData(attendants);
      setSelectedTab('tanks');
      
      alert('✅ D1A verisi başarıyla yüklendi ve analiz edildi!');

    } catch (error) {
      console.error('D1A Parse Error:', error);
      setParseError(`D1A verisi işlenirken hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // XML parse fonksiyonu
  const parseXmlData = (xmlString: string) => {
    try {
      setIsLoading(true);
      setParseError('');

      // D1A format kontrolü
      if (xmlString.includes('TARIH') && xmlString.includes('SAAT') && xmlString.includes('LITRE') && xmlString.includes('TUTAR')) {
        return parseD1AData(xmlString);
      }

      // XML string'i DOM parser ile parse et
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "text/xml");
      
      // Parse error kontrolü
      const parseErrorElement = xmlDoc.querySelector("parsererror");
      if (parseErrorElement) {
        throw new Error("Geçersiz XML formatı");
      }

      // Global parametreleri çıkar
      const globalParams = {
        version: xmlDoc.querySelector("Version")?.textContent || "",
        companyCode: xmlDoc.querySelector("CompanyCode")?.textContent || "", 
        stationCode: xmlDoc.querySelector("StationCode")?.textContent || "",
        reportDate: new Date().toLocaleDateString('tr-TR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      };

      // Tank verilerini çıkar
      const tankElements = xmlDoc.querySelectorAll("TankDetails");
      const tanks = Array.from(tankElements).map(tank => ({
        tankNo: parseInt(tank.querySelector("TankNo")?.textContent || "0"),
        tankName: tank.querySelector("TankName")?.textContent || "",
        fuelType: tank.querySelector("FuelType")?.textContent || "",
        currentVolume: parseInt(tank.querySelector("CurrentVolume")?.textContent || "0"),
        previousVolume: parseInt(tank.querySelector("PreviousVolume")?.textContent || "0"),
        delta: parseInt(tank.querySelector("Delta")?.textContent || "0"),
        deliveryVolume: parseInt(tank.querySelector("DeliveryVolume")?.textContent || "0")
      }));

      // Pompa verilerini çıkar  
      const pumpElements = xmlDoc.querySelectorAll("Pump");
      const pumps = Array.from(pumpElements).map(pump => {
        const nozzles = pump.querySelectorAll("Nozzle");
        const totalSales = Array.from(nozzles).reduce((sum, nozzle) => {
          return sum + parseInt(nozzle.querySelector("Totalizer")?.textContent || "0");
        }, 0);
        
        return {
          pumpName: pump.querySelector("PumpName")?.textContent || "",
          nozzles: nozzles.length,
          totalSales: totalSales
        };
      });

      // Satış işlemlerini analiz et
      const txnElements = xmlDoc.querySelectorAll("Txn");
      const transactions = Array.from(txnElements);
      
      const fuelTypes: {[key: string]: {volume: number, amount: number}} = {};
      let totalAmount = 0;
      let totalVolume = 0;

      transactions.forEach(txn => {
        const fuelTypeElement = txn.querySelector("FuelType");
        const amountElement = txn.querySelector("Amount"); 
        const totalElement = txn.querySelector("Total");
        
        if (fuelTypeElement && amountElement && totalElement) {
          const fuelTypeCode = fuelTypeElement.textContent;
          const amount = parseInt(amountElement.textContent || "0");
          const total = parseInt(totalElement.textContent || "0");

          // Fuel type kod to name mapping
          let fuelTypeName = "";
          switch(fuelTypeCode) {
            case "4": fuelTypeName = "OPTIMUM KURSUNSUZ 95"; break;
            case "5": fuelTypeName = "LPG"; break; 
            case "6": fuelTypeName = "MOTORIN"; break;
            case "8": fuelTypeName = "OPTIMUM MOTORIN"; break;
            default: fuelTypeName = `Yakıt Türü ${fuelTypeCode}`;
          }

          if (!fuelTypes[fuelTypeName]) {
            fuelTypes[fuelTypeName] = { volume: 0, amount: 0 };
          }
          
          fuelTypes[fuelTypeName].volume += amount;
          fuelTypes[fuelTypeName].amount += total;
          totalAmount += total;
          totalVolume += amount;
        }
      });

      const salesSummary = {
        totalTransactions: transactions.length,
        totalAmount,
        totalVolume,
        fuelTypes
      };

      // Pompacı verilerini simüle et (XML'de pompacı bilgisi olmadığı için)
      const attendants = [
        {
          id: 1,
          name: "Pompacı A",
          shift: "Sabah (06:00-14:00)",
          totalTransactions: Math.ceil(transactions.length * 0.4),
          totalAmount: Math.ceil(totalAmount * 0.4),
          totalVolume: Math.ceil(totalVolume * 0.4),
          averageTransaction: Math.ceil(totalAmount * 0.4 / Math.ceil(transactions.length * 0.4)),
          efficiency: 92 + Math.floor(Math.random() * 8),
          pumpsHandled: pumps.slice(0, 3).map(p => p.pumpName),
          startTime: "06:00",
          endTime: "14:00"
        },
        {
          id: 2,
          name: "Pompacı B", 
          shift: "Öğle (14:00-22:00)",
          totalTransactions: Math.ceil(transactions.length * 0.45),
          totalAmount: Math.ceil(totalAmount * 0.45),
          totalVolume: Math.ceil(totalVolume * 0.45),
          averageTransaction: Math.ceil(totalAmount * 0.45 / Math.ceil(transactions.length * 0.45)),
          efficiency: 90 + Math.floor(Math.random() * 10),
          pumpsHandled: pumps.slice(3, 6).map(p => p.pumpName),
          startTime: "14:00",
          endTime: "22:00"
        },
        {
          id: 3,
          name: "Pompacı C",
          shift: "Gece (22:00-06:00)", 
          totalTransactions: Math.ceil(transactions.length * 0.15),
          totalAmount: Math.ceil(totalAmount * 0.15),
          totalVolume: Math.ceil(totalVolume * 0.15),
          averageTransaction: Math.ceil(totalAmount * 0.15 / Math.ceil(transactions.length * 0.15)),
          efficiency: 85 + Math.floor(Math.random() * 10),
          pumpsHandled: pumps.slice(6).map(p => p.pumpName),
          startTime: "22:00",
          endTime: "06:00"
        }
      ];

      // State'leri güncelle
      setGlobalInfo(globalParams);
      setTankData(tanks);
      setPumpData(pumps);
             setSalesData(salesSummary as any);
      setAttendantData(attendants);
      setSelectedTab('tanks');
      
      alert('✅ XML başarıyla yüklendi ve analiz edildi!');

    } catch (error) {
      console.error('XML Parse Error:', error);
      setParseError(`XML işlenirken hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Akaryakıt Modülü - Test Raporu">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Akaryakıt İstasyonu Raporu</h1>
              <p className="text-blue-200 text-sm">
                İstasyon Kodu: {globalInfo.stationCode} | 
                Şirket Kodu: {globalInfo.companyCode}
              </p>
              <p className="text-blue-200 text-sm">
                Sistem: {globalInfo.version}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{globalInfo.reportDate}</p>
              <p className="text-blue-200 text-sm">Günlük Rapor</p>
            </div>
          </div>
        </div>

        {/* Özet Kartlar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Toplam İşlem</p>
                <p className="text-2xl font-bold text-gray-900">{salesData.totalTransactions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Toplam Satış</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.totalAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Toplam Hacim</p>
                <p className="text-2xl font-bold text-gray-900">{formatVolume(salesData.totalVolume)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Aktif Pompalar</p>
                <p className="text-2xl font-bold text-gray-900">{pumpData.length}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'upload', name: 'XML Yükle', icon: '📄' },
                { id: 'tanks', name: 'Tank Durumu', icon: '🛢️' },
                { id: 'pumps', name: 'Pompa Verileri', icon: '⛽' },
                { id: 'attendants', name: 'Pompacılar', icon: '👨‍💼' },
                { id: 'sales', name: 'Satış Detayları', icon: '💳' },
                { id: 'analysis', name: 'Yakıt Analizi', icon: '📊' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm ${
                    selectedTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {selectedTab === 'upload' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">XML Veri Yükleme</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h4 className="font-semibold text-blue-900 mb-3">📄 TURPAK XML veya D1A Verisi Yükleyin</h4>
                  <p className="text-blue-800 text-sm mb-4">
                    TURPAK Pumpomat sisteminden aldığınız XML verisini veya D1A formatındaki satış raporunu aşağıdaki alana yapıştırın. 
                    Sistem otomatik olarak formatı algılayıp tank durumu, pompa verileri ve satış bilgilerini analiz edecektir.
                  </p>
                  <textarea
                    value={xmlInput}
                    onChange={(e) => setXmlInput(e.target.value)}
                    placeholder="XML verinizi buraya yapıştırın..."
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {parseError && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-800 text-sm">❌ {parseError}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => setXmlInput('')}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Temizle
                    </button>
                    <button
                      onClick={() => parseXmlData(xmlInput)}
                      disabled={!xmlInput.trim() || isLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>İşleniyor...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span>XML'i Analiz Et</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                                 {/* Örnek format gösterimi */}
                 <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                   <h4 className="font-semibold text-gray-900 mb-3">💡 Desteklenen Formatlar</h4>
                   
                   <div className="space-y-4">
                     <div>
                       <h5 className="font-medium text-gray-800 mb-2">📄 XML Formatı</h5>
                       <p className="text-gray-700 text-sm mb-2">
                         XML veriniz aşağıdaki gibi SaleData elementi ile başlamalıdır:
                       </p>
                       <pre className="bg-white p-3 rounded-lg text-xs text-gray-600 border overflow-x-auto">
{`<SaleData xmlns="http://tempuri.org/Sale.xsd">
  <GlobalParams>
    <Version>TURPAK Pumpomat V9.2.0 Build: 27</Version>
    <CompanyCode>7732</CompanyCode>
    <StationCode>000299</StationCode>
  </GlobalParams>
  <TankTotals>
    <TankDetails>
      <TankNo>1</TankNo>
      <TankName>MOTORIN</TankName>
      <CurrentVolume>12265</CurrentVolume>
      ...
    </TankDetails>
  </TankTotals>
  ...
</SaleData>`}
                       </pre>
                     </div>
                     
                     <div>
                       <h5 className="font-medium text-gray-800 mb-2">📋 D1A Formatı</h5>
                       <p className="text-gray-700 text-sm mb-2">
                         D1A formatındaki satış raporu aşağıdaki gibi olmalıdır:
                       </p>
                       <pre className="bg-white p-3 rounded-lg text-xs text-gray-600 border overflow-x-auto">
{`TARIH      SAAT     FILO ADI                       KODU   PLAKA     YAKIT      LITRE  FYT  TUTAR
08/04/2020 06:23:08                       ISTASYON  C0000 RUHİ AKMA Optımum Mo 000320 5370 00001718
08/04/2020 07:22:09 Avek Lojistik İçecek Araç Kira 101951  06FA4351    Motorin 030000 5320 00159600
08/04/2020 07:29:41                       ISTASYON  C0000 RUHİ AKMA OPTİMUM KU 004190 5370 00022500`}
                       </pre>
                     </div>
                   </div>
                 </div>
              </div>
            )}
            
            {selectedTab === 'tanks' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Tank Durumu Raporu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tankData.map((tank) => {
                    const status = getTankStatus(tank.currentVolume, tank.previousVolume);
                    const usagePercent = tank.previousVolume > 0 ? ((tank.previousVolume - tank.currentVolume) / tank.previousVolume * 100) : 0;
                    
                    return (
                      <div key={tank.tankNo} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${status.bg}`}>
                              {getFuelIcon(tank.fuelType)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">Tank {tank.tankNo}</h4>
                              <p className="text-sm text-gray-600">{tank.tankName}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.status}
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Mevcut</span>
                            <span className="font-medium">{formatVolume(tank.currentVolume)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Önceki</span>
                            <span className="font-medium">{formatVolume(tank.previousVolume)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Fark</span>
                            <span className={`font-medium ${tank.delta < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {tank.delta > 0 ? '+' : ''}{formatVolume(tank.delta)}
                            </span>
                          </div>
                          {tank.deliveryVolume > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Teslimat</span>
                              <span className="font-medium text-blue-600">{formatVolume(tank.deliveryVolume)}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Doluluk Oranı</span>
                            <span>{(tank.currentVolume / tank.previousVolume * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status.status === 'Dolu' ? 'bg-green-500' :
                                status.status === 'Orta' ? 'bg-yellow-500' :
                                status.status === 'Düşük' ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, (tank.currentVolume / tank.previousVolume * 100)))}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTab === 'pumps' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Pompa Performans Raporu</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {pumpData.map((pump) => (
                    <div key={pump.pumpName} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="font-bold text-blue-600">{pump.pumpName}</span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">Pompa {pump.pumpName}</h4>
                            <p className="text-sm text-gray-600">{pump.nozzles} Nozzle</p>
                          </div>
                        </div>
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Toplam Satış</span>
                          <span className="font-medium">{new Intl.NumberFormat('tr-TR').format(pump.totalSales)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Günlük Ortalama</span>
                          <span className="font-medium">{new Intl.NumberFormat('tr-TR').format(Math.floor(pump.totalSales / 30))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Durum</span>
                          <span className="text-green-600 font-medium">Aktif</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'attendants' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Pompacı Performans Raporu</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {attendantData.map((attendant) => (
                    <div key={attendant.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            {attendant.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{attendant.name}</h4>
                            <p className="text-sm text-gray-600">{attendant.shift}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-3 h-3 rounded-full ${
                            attendant.efficiency >= 95 ? 'bg-green-400' :
                            attendant.efficiency >= 90 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-700">%{attendant.efficiency}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Toplam İşlem</span>
                          <span className="font-medium">{attendant.totalTransactions}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Toplam Satış</span>
                          <span className="font-medium">{formatCurrency(attendant.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Toplam Hacim</span>
                          <span className="font-medium">{formatVolume(attendant.totalVolume)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Ortalama İşlem</span>
                          <span className="font-medium">{formatCurrency(attendant.averageTransaction)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Vardiya</span>
                          <span className="font-medium text-blue-600">{attendant.startTime} - {attendant.endTime}</span>
                        </div>
                      </div>

                      {/* Sorumlu pompalar */}
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Sorumlu Pompalar</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {attendant.pumpsHandled.length} pompa
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {attendant.pumpsHandled.map((pump) => (
                            <span key={pump} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {pump}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Performans bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Verimlilik</span>
                          <span>%{attendant.efficiency}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              attendant.efficiency >= 95 ? 'bg-green-500' :
                              attendant.efficiency >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${attendant.efficiency}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toplu performans özeti */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-4">📊 Genel Performans Özeti</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round(attendantData.reduce((sum, att) => sum + att.efficiency, 0) / attendantData.length)}%
                      </div>
                      <div className="text-sm text-gray-600">Ortalama Verimlilik</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {attendantData.reduce((sum, att) => sum + att.totalTransactions, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Toplam İşlem</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(attendantData.reduce((sum, att) => sum + att.totalTransactions, 0) / attendantData.length)}
                      </div>
                      <div className="text-sm text-gray-600">Pompacı Başı Ortalama</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {attendantData.filter(att => att.efficiency >= 90).length}/{attendantData.length}
                      </div>
                      <div className="text-sm text-gray-600">Yüksek Performans</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'sales' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Günlük Satış Detayları</h3>
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.entries(salesData.fuelTypes).map(([fuelType, data]) => (
                      <div key={fuelType} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            {getFuelIcon(fuelType)}
                          </div>
                          <h4 className="font-medium text-gray-900">{fuelType}</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Hacim</span>
                            <span className="font-medium">{formatVolume(data.volume)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Tutar</span>
                            <span className="font-medium">{formatCurrency(data.amount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Ortalama Fiyat</span>
                            <span className="font-medium">{formatCurrency(Math.floor(data.amount / data.volume * 100))}/L</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Örnek Satış İşlemleri Tablosu */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900">Son İşlemler</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fiş No</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yakıt Türü</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaka</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Miktar</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pompa</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {[
                          { receiptNr: 71148, fuelType: 'OPTIMUM KURSUNSUZ 95', plate: '14ACN805', amount: 105, total: 5000, pump: 4 },
                          { receiptNr: 71147, fuelType: 'OPTIMUM KURSUNSUZ 95', plate: '14AAT340', amount: 633, total: 30000, pump: 5 },
                          { receiptNr: 71146, fuelType: 'LPG', plate: '14BY795', amount: 531, total: 14000, pump: 7 },
                          { receiptNr: 71145, fuelType: 'LPG', plate: '14BZ136', amount: 758, total: 20000, pump: 7 },
                          { receiptNr: 71144, fuelType: 'LPG', plate: '14DK669', amount: 910, total: 24004, pump: 8 }
                        ].map((transaction) => (
                          <tr key={transaction.receiptNr} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {transaction.receiptNr}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {transaction.fuelType}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {transaction.plate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatVolume(transaction.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatCurrency(transaction.total)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {transaction.pump}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'analysis' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Yakıt Türü Analizi</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Yakıt Türü Dağılımı */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Satış Hacmi Dağılımı</h4>
                    <div className="space-y-4">
                      {Object.entries(salesData.fuelTypes).map(([fuelType, data]) => {
                        const percentage = (data.volume / salesData.totalVolume * 100);
                        return (
                          <div key={fuelType} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">{fuelType}</span>
                              <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  fuelType.includes('MOTORIN') ? 'bg-blue-500' :
                                  fuelType.includes('KURSUNSUZ') ? 'bg-green-500' :
                                  fuelType.includes('LPG') ? 'bg-purple-500' : 'bg-gray-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gelir Analizi */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Gelir Dağılımı</h4>
                    <div className="space-y-4">
                      {Object.entries(salesData.fuelTypes).map(([fuelType, data]) => {
                        const percentage = (data.amount / salesData.totalAmount * 100);
                        return (
                          <div key={fuelType} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">{fuelType}</span>
                              <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  fuelType.includes('MOTORIN') ? 'bg-blue-500' :
                                  fuelType.includes('KURSUNSUZ') ? 'bg-green-500' :
                                  fuelType.includes('LPG') ? 'bg-purple-500' : 'bg-gray-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Performans Metrikleri */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Performans Göstergeleri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {((salesData.totalAmount / 100) / salesData.totalVolume).toFixed(2)} ₺
                      </div>
                      <div className="text-sm text-gray-600">Ortalama Litre Fiyatı</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {(salesData.totalVolume / salesData.totalTransactions).toFixed(0)} L
                      </div>
                      <div className="text-sm text-gray-600">İşlem Başı Ortalama</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {(salesData.totalAmount / 100 / salesData.totalTransactions).toFixed(0)} ₺
                      </div>
                      <div className="text-sm text-gray-600">İşlem Başı Tutar</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 