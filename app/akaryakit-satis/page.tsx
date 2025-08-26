'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import { sendSecureProxyRequest, encryptPayloadSecure } from '../utils/api';

export default function AkaryakitSatis() {
  const [companySettings, setCompanySettings] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isReading, setIsReading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [companyRef, setCompanyRef] = useState<string>('');
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(false);
  const router = useRouter();

  // Para formatlaması için yardımcı fonksiyon
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Animation data'yı yükleyelim
  useEffect(() => {
    fetch('/animations/failed.json')
      .then(res => res.json())
      .then(data => setFailedAnimationData(data))
      .catch(err => console.log('Failed animasyonu yüklenemedi:', err));
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
          const apiCompanyRef = data.user.company_ref;
          console.log('✅ API\'den company ref alındı:', apiCompanyRef);
          
          // localStorage'a kaydet
          localStorage.setItem('companyRef', apiCompanyRef);
          setCompanyRef(apiCompanyRef);
          
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

  // Şirket akaryakıt ayarlarını yükle
  const loadCompanySettings = async () => {
    try {
      setIsLoadingSettings(true);
      console.log('🔍 Akaryakıt Satış - Şirket ayarları yükleniyor... Company Ref:', companyRef);

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
  }, []); // Sadece bir kez çalışsın

  // Company ref değiştiğinde şirket ayarlarını yükle
  useEffect(() => {
    if (companyRef) {
      console.log('🔍 Akaryakıt Satış - Company ref değişti:', companyRef);
      loadCompanySettings();
    }
  }, [companyRef]);

    // Seçili şirketten veri okuma
  const readFromSelectedCompany = async (retryCount: number = 0) => {
    if (!selectedCompany || !selectedDate) {
      alert('Lütfen istasyon ve tarih seçin');
      return;
    }

    // Sadece ilk denemede loading'i başlat
    if (retryCount === 0) {
      setIsReading(true);
      setParsedData(null);
    }

    const maxRetries = 2; // Maksimum 3 deneme (0, 1, 2)

    try {
      // Tarihi RsDDMMYYYY formatına çevir
      const dateParts = selectedDate.split('-');
      const day = dateParts[2];
      const month = dateParts[1];
      const year = dateParts[0]; // YYYY'den YY al
      
      // Turpak için zip dosyası kontrolü
      const isTurpak = selectedCompany.file_type?.toLowerCase() === 'turpak' || 
                      selectedCompany.module_name?.toLowerCase().includes('turpak');
      
      let filePath: string;
      let fileType: string;
      
      if (isTurpak) {
        // Turpak için sadece zip dosyası formatı: YYYYMMDD01.zip
        const zipFileName = `${year}${month}${day}01.zip`;
        filePath = `${selectedCompany.online_path}${zipFileName}`;
        fileType = 'turpak';
        console.log(`🔍 === TURPAK ZIP DOSYA OKUMA (Deneme ${retryCount + 1}/${maxRetries + 1}) ===`);
        console.log('📍 Company Ref:', companyRef);
        console.log('📁 Zip Dosya Yolu:', filePath);
        console.log('📄 Dosya Tipi:', 'turpak');
        console.log('📋 Zip Dosya Adı:', zipFileName);
        console.log('📋 Zip Dosya Tam Yolu:', filePath);
        console.log('📋 Online Path:', selectedCompany.online_path);
      } else {
        // Normal XML formatı
        const fileName = `Rs${day}${month}${year}-T1.xml`;
        filePath = `${selectedCompany.online_path}${fileName}`;
        fileType = 'xml';
        console.log(`🔍 === AKARYAKIT SATIŞ DOSYA OKUMA (Deneme ${retryCount + 1}/${maxRetries + 1}) ===`);
        console.log('📍 Company Ref:', companyRef);
        console.log('📁 Dosya Yolu:', filePath);
        console.log('📄 Dosya Tipi:', 'xml');
      }

      // Module ve payload verilerini hazırla
      const moduleData = { id: 2, mode: 'offline' };
      const payloadData = { 
        filePath: filePath,
        fileType: fileType 
      };

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
          throw new Error('Satış verisi bulunamadı');
        }
        
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 Response Data:', result);
      console.log('📋 Response Status:', result.status);
      console.log('📋 Response Message:', result.message);
      console.log('📋 Has Content:', !!result.content);
      console.log('📋 Has Data:', !!result.data);

      // JSON response'da hata kontrolü
      if (result.status === 'error') {
        if (result.message && (result.message.includes('Dosya bulunamadı') || result.message.includes('File not found'))) {
          throw new Error('Satış verisi bulunamadı');
        }
        throw new Error(result.message || 'Bilinmeyen hata');
      }

      // Sonucu işle
      let processedResult: any = { success: true };

      // Response'da parsedData varsa direkt kullan
      if (result.parsedData && result.parsedData.elements) {
        console.log('📊 Parse edilmiş veri bulundu:', result.parsedData);
        parseAndDisplayData(result.parsedData, 'parsed');
      } else if (result.content) {
        processedResult.data = result.content;
        processedResult.content = result.content;
        parseAndDisplayData(processedResult.data, isTurpak ? 'turpak' : 'xml');
      } else if (result.data?.content) {
        processedResult.data = result.data.content;
        processedResult.content = result.data.content;
        parseAndDisplayData(processedResult.data, isTurpak ? 'turpak' : 'xml');
      } else if (result.data?.xmlContent) {
        processedResult.data = result.data.xmlContent;
        processedResult.xmlContent = result.data.xmlContent;
        parseAndDisplayData(processedResult.data, isTurpak ? 'turpak' : 'xml');
      } else {
        processedResult.data = result;
        parseAndDisplayData(processedResult.data, isTurpak ? 'turpak' : 'xml');
      }
      
      console.log('✅ Dosya okuma başarılı:', processedResult);
      
      // Başarılı olduğunda loading'i kapat
      setIsReading(false);

    } catch (error) {
      console.error(`❌ Dosya okuma hatası (Deneme ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // Turpak için özel hata mesajı
      const isTurpak = selectedCompany.file_type?.toLowerCase() === 'turpak' || 
                      selectedCompany.module_name?.toLowerCase().includes('turpak');
      
      if (isTurpak && error instanceof Error && 
          (error.message.includes('Satış verisi bulunamadı') || error.message.includes('Dosya bulunamadı'))) {
        
        console.log('❌ Turpak Zip dosyası bulunamadı!');
        console.log('📋 Aranan dosya formatı: YYYYMMDD01.zip');
        console.log('📋 Örnek: 2025081001.zip');
      }
      
      // Eğer hala deneme hakkı varsa, tekrar dene
      if (retryCount < maxRetries) {
        console.log(`🔄 ${retryCount + 1}. deneme başarısız, ${retryCount + 2}. deneme yapılıyor...`);
        
        // 2 saniye bekle ve tekrar dene
        setTimeout(() => {
          readFromSelectedCompany(retryCount + 1);
        }, 2000);
        
        return; // Bu denemeyi sonlandır, yeni deneme başlat
      }
      
      // Tüm denemeler başarısız oldu
      console.error('❌ Tüm denemeler başarısız oldu!');
      const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      
      // Satış verisi bulunamadı hatası kontrolü
      if (errorMsg.includes('Satış verisi bulunamadı')) {
        setErrorMessage('Satış verisi bulunamadı');
        setShowErrorModal(true);
      } else {
        alert(`Veri okuma hatası: ${errorMsg}`);
      }
      
      // Tüm denemeler başarısız olduğunda loading'i kapat
      setIsReading(false);
    }
  };

  // XML verilerini parse et ve görüntüle
  const parseAndDisplayData = (content: any, fileType: string) => {
    try {
      if (fileType === 'parsed') {
        // Parse edilmiş veri formatını işle
        console.log('🔍 Parse edilmiş veri işleniyor:', content);
        
        // Station bilgilerini al
        const stationElement = content.elements.find((el: any) => el.element === 'station');
        const stationInfo = stationElement ? {
          code: stationElement.attributes.code || '',
          name: stationElement.attributes.name || '',
          companyCode: stationElement.attributes.companycode || ''
        } : {};

        // Sale verilerini al
        const sales = content.elements
          .filter((el: any) => el.element === 'sale')
          .map((sale: any) => ({
            tarih: sale.attributes.tarih || '',
            saat: sale.attributes.saat || '',
            filo: sale.attributes.filo || '',
            filoKodu: sale.attributes.filokodu || '',
            plaka: sale.attributes.plaka || '',
            urun: sale.attributes.urun || '',
            litre: parseFloat(sale.attributes.litre || '0'),
            tutar: parseFloat(sale.attributes.tutar || '0'),
            birimFiyat: parseFloat(sale.attributes.birimfiyat || '0'),
            tabanca: sale.attributes.tabanca || '',
            pompa: sale.attributes.pompa || '',
            rfID: sale.attributes.rfid || '',
            km: sale.attributes.km || '',
            plaka2: sale.attributes.plaka2 || '',
            ykFisNo: sale.attributes.ykfisno || ''
          }));

        console.log('📊 Parse edilmiş satış verileri:', sales);
        
        // Satış özeti hesapla
        const salesSummary = {
          toplamSatis: sales.length,
          toplamLitre: sales.reduce((sum: number, sale: any) => sum + sale.litre, 0),
          toplamTutar: sales.reduce((sum: number, sale: any) => sum + sale.tutar, 0)
        };

        // Ürün bazlı özet
        const productSummary = sales.reduce((acc: any, sale: any) => {
          if (!acc[sale.urun]) {
            acc[sale.urun] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[sale.urun].litre += sale.litre;
          acc[sale.urun].tutar += sale.tutar;
          acc[sale.urun].adet += 1;
          return acc;
        }, {} as any);

        // Filo bazlı özet - en çok tutar olana göre sırala ve 6 adet ile sınırla
        const fleetSummary = sales.reduce((acc: any, sale: any) => {
          if (!acc[sale.filo]) {
            acc[sale.filo] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[sale.filo].litre += sale.litre;
          acc[sale.filo].tutar += sale.tutar;
          acc[sale.filo].adet += 1;
          return acc;
        }, {} as any);

        // Filo özetini en çok tutar olana göre sırala ve 6 adet ile sınırla
        const sortedFleetSummary = Object.entries(fleetSummary)
          .sort(([, a]: [string, any], [, b]: [string, any]) => b.tutar - a.tutar)
          .slice(0, 6)
          .reduce((acc: any, [key, value]: [string, any]) => {
            acc[key] = value;
            return acc;
          }, {} as any);

        setParsedData({
          stationInfo,
          sales,
          salesSummary,
          productSummary,
          fleetSummary: sortedFleetSummary,
          rawRows: sales.map((sale: any, index: number) => ({
            'Sıra': index + 1,
            'Tarih': sale.tarih,
            'Saat': sale.saat,
            'Filo': sale.filo,
            'Filo Kodu': sale.filoKodu,
            'Plaka': sale.plaka,
            'Ürün': sale.urun,
            'Litre': sale.litre.toFixed(2),
            'Tutar': formatCurrency(sale.tutar),
            'Birim Fiyat': formatCurrency(sale.birimFiyat),
            'Tabanca': sale.tabanca,
            'Pompa': sale.pompa,
            'RFID': sale.rfID,
            'KM': sale.km,
            'Plaka 2': sale.plaka2,
            'YK Fiş No': sale.ykFisNo
          }))
        });

        // Satış özeti bölümüne scroll
        setTimeout(() => {
          const element = document.getElementById('satis-ozeti');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);

      } else if (fileType === 'xml') {
        // ASIS XML formatını parse et
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        // Station bilgilerini al
        const stationElement = xmlDoc.querySelector('Station');
        const stationInfo = stationElement ? {
          code: stationElement.getAttribute('Code') || '',
          name: stationElement.getAttribute('Name') || '',
          companyCode: stationElement.getAttribute('CompanyCode') || ''
        } : {};

        // Sale verilerini al
        const sales = Array.from(xmlDoc.querySelectorAll('Sale')).map(sale => ({
          tarih: sale.getAttribute('Tarih') || '',
          saat: sale.getAttribute('Saat') || '',
          filo: sale.getAttribute('Filo') || '',
          filoKodu: sale.getAttribute('FiloKodu') || '',
          plaka: sale.getAttribute('Plaka') || '',
          urun: sale.getAttribute('Urun') || '',
          litre: parseFloat(sale.getAttribute('Litre') || '0'),
          tutar: parseFloat(sale.getAttribute('Tutar') || '0'),
          birimFiyat: parseFloat(sale.getAttribute('BirimFiyat') || '0'),
          tabanca: sale.getAttribute('Tabanca') || '',
          pompa: sale.getAttribute('Pompa') || '',
          rfID: sale.getAttribute('RfID') || '',
          km: sale.getAttribute('Km') || '',
          plaka2: sale.getAttribute('Plaka2') || '',
          ykFisNo: sale.getAttribute('YKfisNo') || ''
        }));

        // Satış özeti hesapla
        const salesSummary = {
          toplamSatis: sales.length,
          toplamLitre: sales.reduce((sum, sale) => sum + sale.litre, 0),
          toplamTutar: sales.reduce((sum, sale) => sum + sale.tutar, 0)
        };

        // Ürün bazlı özet
        const productSummary = sales.reduce((acc, sale) => {
          if (!acc[sale.urun]) {
            acc[sale.urun] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[sale.urun].litre += sale.litre;
          acc[sale.urun].tutar += sale.tutar;
          acc[sale.urun].adet += 1;
          return acc;
        }, {} as any);

        // Filo bazlı özet - en çok tutar olana göre sırala ve 6 adet ile sınırla
        const fleetSummary = sales.reduce((acc, sale) => {
          if (!acc[sale.filo]) {
            acc[sale.filo] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[sale.filo].litre += sale.litre;
          acc[sale.filo].tutar += sale.tutar;
          acc[sale.filo].adet += 1;
          return acc;
        }, {} as any);

        // Filo özetini en çok tutar olana göre sırala ve 6 adet ile sınırla
        const sortedFleetSummary = Object.entries(fleetSummary)
          .sort(([, a]: [string, any], [, b]: [string, any]) => b.tutar - a.tutar)
          .slice(0, 6)
          .reduce((acc: any, [key, value]: [string, any]) => {
            acc[key] = value;
            return acc;
          }, {} as any);

        setParsedData({
          stationInfo,
          sales,
          salesSummary,
          productSummary,
          fleetSummary: sortedFleetSummary,
          rawRows: sales.map((sale, index) => ({
            'Sıra': index + 1,
            'Tarih': sale.tarih,
            'Saat': sale.saat,
            'Filo': sale.filo,
            'Filo Kodu': sale.filoKodu,
            'Plaka': sale.plaka,
            'Ürün': sale.urun,
            'Litre': sale.litre.toFixed(2),
            'Tutar': formatCurrency(sale.tutar),
            'Birim Fiyat': formatCurrency(sale.birimFiyat),
            'Tabanca': sale.tabanca,
            'Pompa': sale.pompa,
            'RFID': sale.rfID,
            'KM': sale.km,
            'Plaka 2': sale.plaka2,
            'YK Fiş No': sale.ykFisNo
          }))
        });

        // Satış özeti bölümüne scroll
        setTimeout(() => {
          const element = document.getElementById('satis-ozeti');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);

      } else if (fileType === 'turpak') {
        // Turpak zip dosyasından çıkarılan veriyi parse et
        console.log('🚀 Turpak parse bloğuna girdi!');
        console.log('🔍 Content tipi:', typeof content);
        console.log('🔍 Content uzunluğu:', content?.length || 0);
        console.log('🔍 Content önizleme:', typeof content === 'string' ? content.substring(0, 200) : content);
        
                    // Turpak formatı için özel parse işlemi
        let sales: any[] = [];
        let stationInfo: any = { code: '', name: 'Turpak İstasyonu', companyCode: '' }; // Define at higher scope
        
        // Eğer content bir string ise, XML olarak parse et
        if (typeof content === 'string') {
          try {
            console.log('🔍 XML içeriği uzunluğu:', content.length);
            console.log('🔍 XML içeriği başlangıcı:', content.substring(0, 200));
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'text/xml');
            
            // XML parse hatası kontrolü
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
              console.error('❌ XML parse hatası:', parseError.textContent);
              throw new Error('XML parse hatası');
            }
            
                        // XML'deki tüm elementleri kontrol et
            console.log('🔍 XML root element:', xmlDoc.documentElement?.tagName);
            console.log('🔍 XML namespace:', xmlDoc.documentElement?.namespaceURI);
            
            // Namespace farkında olmaksızın elementleri bul
            // XML'de namespace varsa local-name() kullanmak gerekir
            const hasNamespace = xmlDoc.documentElement?.namespaceURI;
            console.log('🔍 Namespace var mı:', !!hasNamespace);
            
            // Namespace ile element erişimi - getElementsByTagNameNS kullan
            let globalParams = xmlDoc.getElementsByTagName('GlobalParams')[0];
            if (!globalParams && hasNamespace) {
              globalParams = xmlDoc.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'GlobalParams')[0];
            }
            if (!globalParams && hasNamespace) {
              globalParams = xmlDoc.getElementsByTagNameNS('*', 'GlobalParams')[0];
            }
            
            const unitPriceDecimal = globalParams ? parseInt(globalParams.getAttribute('UnitPriceDecimal') || '2') : 2;
            const amountDecimal = globalParams ? parseInt(globalParams.getAttribute('AmountDecimal') || '2') : 2;
            const totalDecimal = globalParams ? parseInt(globalParams.getAttribute('TotalDecimal') || '2') : 2;
            
            console.log('🔢 Decimal değerleri:', { unitPriceDecimal, amountDecimal, totalDecimal });
            console.log('🔍 GlobalParams bulundu:', !!globalParams);
            
            // Station bilgilerini al
            let stationElement = xmlDoc.getElementsByTagName('Station')[0];
            if (!stationElement && hasNamespace) {
              stationElement = xmlDoc.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'Station')[0];
            }
            if (!stationElement && hasNamespace) {
              stationElement = xmlDoc.getElementsByTagNameNS('*', 'Station')[0];
            }
            
            stationInfo = { // Assign to higher scope variable
              code: globalParams ? (globalParams.getAttribute('StationCode') || '') : '',
              name: stationElement ? (stationElement.getAttribute('Name') || 'Turpak İstasyonu') : 'Turpak İstasyonu',
              companyCode: globalParams ? (globalParams.getAttribute('CompanyCode') || '') : ''
            };
            
            console.log('🏢 Station bilgileri:', stationInfo);
            
            // Txns konteynerini bul ve içindeki Txn elementlerini al
            let txnsContainer = xmlDoc.getElementsByTagName('Txns')[0];
            if (!txnsContainer && hasNamespace) {
              txnsContainer = xmlDoc.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'Txns')[0];
            }
            if (!txnsContainer && hasNamespace) {
              txnsContainer = xmlDoc.getElementsByTagNameNS('*', 'Txns')[0];
            }
            console.log('🔍 Txns container bulundu:', !!txnsContainer);
            
            let txnElements = [];
            if (txnsContainer) {
              // Namespace ile Txn elementlerini bul
              txnElements = Array.from(txnsContainer.getElementsByTagName('Txn'));
              if (txnElements.length === 0 && hasNamespace) {
                txnElements = Array.from(txnsContainer.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'Txn'));
              }
              if (txnElements.length === 0 && hasNamespace) {
                txnElements = Array.from(txnsContainer.getElementsByTagNameNS('*', 'Txn'));
              }
            } else {
              // Fallback: Doğrudan Txn elementlerini ara
              txnElements = Array.from(xmlDoc.getElementsByTagName('Txn'));
              if (txnElements.length === 0 && hasNamespace) {
                txnElements = Array.from(xmlDoc.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'Txn'));
              }
              if (txnElements.length === 0 && hasNamespace) {
                txnElements = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Txn'));
              }
            }
            
            console.log('📊 Bulunan Txn elementleri:', txnElements.length);
            
            // Debug: Txn container ve elementlerini detaylı incele
            console.log('🔍 Txns Container Debug:');
            console.log('- Txns container bulundu:', !!txnsContainer);
            if (txnsContainer) {
              console.log('- Txns container innerHTML uzunluğu:', txnsContainer.innerHTML.length);
              console.log('- Txns container children sayısı:', txnsContainer.children.length);
              console.log('- Txns container children tag names:', Array.from(txnsContainer.children).map(child => child.tagName));
            }
            console.log('- Txn elements sayısı:', txnElements.length);
            
            // İlk Txn element'ini detaylı incele
            if (txnElements.length > 0) {
              const firstTxn = txnElements[0];
              console.log('🔍 İlk Txn elementi:');
              console.log('- Tag name:', firstTxn.tagName);
              console.log('- Children sayısı:', firstTxn.children.length);
              console.log('- Children tag names:', Array.from(firstTxn.children).map(child => child.tagName));
              console.log('- innerHTML uzunluğu:', firstTxn.innerHTML.length);
              console.log('- innerHTML örneği:', firstTxn.innerHTML.substring(0, 300));
            }
            
            // Debug: Namespace URI'yi tam kontrol et
            console.log('🔍 Document namespace URI:', xmlDoc.documentElement?.namespaceURI);
            console.log('🔍 Trying different namespace approaches...');
            
            // Farklı yöntemlerle Txn arama denemeleri
            const debug1 = xmlDoc.getElementsByTagName('Txn').length;
            const debug2 = xmlDoc.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'Txn').length;
            const debug3 = xmlDoc.getElementsByTagNameNS('*', 'Txn').length;
            const debug4 = xmlDoc.getElementsByTagNameNS(null, 'Txn').length;
            
            console.log('🔍 getElementsByTagName("Txn"):', debug1);
            console.log('🔍 getElementsByTagNameNS("http://tempuri.org/Sale.xsd", "Txn"):', debug2);
            console.log('🔍 getElementsByTagNameNS("*", "Txn"):', debug3);
            console.log('🔍 getElementsByTagNameNS(null, "Txn"):', debug4);
            
            // Eğer Txn bulunamazsa, tüm elementleri kontrol et
            if (txnElements.length === 0) {
              console.log('🔍 Tüm XML elementleri:', Array.from(xmlDoc.getElementsByTagName('*')).map(el => el.tagName));
              console.log('🔍 Root element children:', Array.from(xmlDoc.documentElement.children).map(el => el.tagName));
              
              // Manuel olarak Txns konteynerini ara
              const allElements = Array.from(xmlDoc.getElementsByTagName('*'));
              const txnsElements = allElements.filter(el => el.tagName === 'Txns' || el.localName === 'Txns');
              console.log('🔍 Manuel Txns arama:', txnsElements.length);
              
              if (txnsElements.length > 0) {
                const manualTxnElements = Array.from(txnsElements[0].children).filter(child => 
                  child.tagName === 'Txn' || child.localName === 'Txn'
                );
                console.log('🔍 Manuel Txn children:', manualTxnElements.length);
                
                if (manualTxnElements.length > 0) {
                  txnElements = manualTxnElements as Element[];
                  console.log('✅ Manuel yöntemle Txn elementleri bulundu:', txnElements.length);
                }
              }
            }
             
             sales = txnElements.map((txn, index) => {
               // Debug için ilk birkaç Txn'i detaylı incele
               if (index < 3) {
                 console.log(`🔍 Txn ${index} Debug:`);
                 console.log('- Txn innerHTML:', txn.innerHTML.substring(0, 200));
                 console.log('- Txn children:', Array.from(txn.children).map(child => child.tagName));
               }

               // TagDetails ve SaleDetails elementlerini al (namespace'e uygun)
               let tagDetails = txn.getElementsByTagName('TagDetails')[0];
               let saleDetails = txn.getElementsByTagName('SaleDetails')[0];
               
               // Namespace ile denemeler
               if (!tagDetails && hasNamespace) {
                 tagDetails = txn.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'TagDetails')[0];
               }
               if (!tagDetails && hasNamespace) {
                 tagDetails = txn.getElementsByTagNameNS('*', 'TagDetails')[0];
               }
               if (!saleDetails && hasNamespace) {
                 saleDetails = txn.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', 'SaleDetails')[0];
               }
               if (!saleDetails && hasNamespace) {
                 saleDetails = txn.getElementsByTagNameNS('*', 'SaleDetails')[0];
               }
               
               if (!saleDetails) {
                 console.warn('⚠️ SaleDetails bulunamadı, Txn atlanıyor:', index);
                 if (index < 3) {
                   console.log('🔍 Bu Txn elementinde bulunan children:', Array.from(txn.children).map(child => child.tagName));
                 }
                 return null;
               }
               
               // Debug için ilk birkaç SaleDetails'i incele
               if (index < 3) {
                 console.log(`🔍 SaleDetails ${index} attributeleri:`, Array.from(saleDetails.attributes).map(attr => `${attr.name}="${attr.value}"`));
               }
               
               // Debug için ilk birkaç Txn'in içeriğini log et
               if (index < 3) {
                 console.log(`🔍 Txn ${index} elementleri:`, {
                   tagDetails: !!tagDetails,
                   saleDetails: !!saleDetails,
                   tagDetailsInnerHTML: tagDetails ? tagDetails.innerHTML.substring(0, 200) : null,
                   saleDetailsInnerHTML: saleDetails ? saleDetails.innerHTML.substring(0, 200) : null,
                   tagDetailsAttributes: tagDetails ? {
                     FleetCode: tagDetails.getAttribute('FleetCode'),
                     FleetName: tagDetails.getAttribute('FleetName'),
                     Plate: tagDetails.getAttribute('Plate')
                   } : null,
                   saleDetailsAttributes: saleDetails ? {
                     DateTime: saleDetails.getAttribute('DateTime'),
                     FuelType: saleDetails.getAttribute('FuelType'),
                     UnitPrice: saleDetails.getAttribute('UnitPrice'),
                     Amount: saleDetails.getAttribute('Amount'),
                     Total: saleDetails.getAttribute('Total')
                   } : null
                 });
               }
               
               // Attribute değerlerini güvenli bir şekilde al
               const getSaleValue = (element: Element, attrName: string) => {
                 // Önce exact match dene
                 let value = element.getAttribute(attrName);
                 if (value) return value;
                 
                 // Sonra child element dene
                 const childElement = element.getElementsByTagName(attrName)[0] ||
                                    element.getElementsByTagNameNS('http://tempuri.org/Sale.xsd', attrName)[0] ||
                                    element.getElementsByTagNameNS('*', attrName)[0];
                 return childElement ? childElement.textContent || '' : '';
               };

               // Decimal değerlerini kullanarak sayısal değerleri hesapla
               const unitPriceRaw = parseInt(getSaleValue(saleDetails, 'UnitPrice') || '0');
               const amountRaw = parseInt(getSaleValue(saleDetails, 'Amount') || '0');
               const totalRaw = parseInt(getSaleValue(saleDetails, 'Total') || '0');
               
               const unitPrice = unitPriceRaw / Math.pow(10, unitPriceDecimal);
               const amount = amountRaw / Math.pow(10, amountDecimal);
               const total = totalRaw / Math.pow(10, totalDecimal);
               
               // DateTime'ı tarih ve saat olarak ayır
               const dateTime = getSaleValue(saleDetails, 'DateTime');
               let tarih = '';
               let saat = '';
               if (dateTime.length >= 14) {
                 // Format: YYYYMMDDHHMMSS
                 tarih = `${dateTime.substring(0, 4)}-${dateTime.substring(4, 6)}-${dateTime.substring(6, 8)}`;
                 saat = `${dateTime.substring(8, 10)}:${dateTime.substring(10, 12)}:${dateTime.substring(12, 14)}`;
               }
               
               // FuelType'ı ürün adına çevir
               const fuelType = getSaleValue(saleDetails, 'FuelType');
               let urun = '';
               switch (fuelType) {
                 case '4': urun = 'OPTIMUM KURSUNSUZ 95'; break;
                 case '5': urun = 'LPG'; break;
                 case '6': urun = 'MOTORIN'; break;
                 case '8': urun = 'OPTIMUM MOTORIN'; break;
                 default: urun = `Yakıt Tipi ${fuelType}`;
               }
               
               // Debug için ilk satışın değerlerini göster
               if (index === 0) {
                 console.log('🔍 İlk satış raw değerleri:', {
                   dateTime: dateTime,
                   unitPriceRaw: unitPriceRaw,
                   amountRaw: amountRaw,
                   totalRaw: totalRaw,
                   fuelType: fuelType,
                   unitPrice: unitPrice,
                   amount: amount,
                   total: total
                 });
               }
               
               return {
                 tarih: tarih,
                 saat: saat,
                 filo: tagDetails ? (getSaleValue(tagDetails, 'FleetName') || '').trim() : '',
                 filoKodu: tagDetails ? getSaleValue(tagDetails, 'FleetCode') : '',
                 plaka: tagDetails ? (getSaleValue(tagDetails, 'Plate') || '').trim() : '',
                 urun: urun,
                 litre: amount, // Amount genellikle litre değerini temsil eder
                 tutar: total, // Total genellikle toplam tutarı temsil eder
                 birimFiyat: unitPrice,
                 tabanca: getSaleValue(saleDetails, 'NozzleNr'),
                 pompa: getSaleValue(saleDetails, 'PumpNr'),
                 rfID: tagDetails ? getSaleValue(tagDetails, 'TagNr') : '',
                 km: tagDetails ? getSaleValue(tagDetails, 'Odometer') : '',
                 plaka2: getSaleValue(saleDetails, 'ECRPlate'),
                 ykFisNo: getSaleValue(saleDetails, 'ReceiptNr')
               };
             }).filter(sale => sale !== null); // null değerleri filtrele

            console.log('📊 Turpak satış verileri parse edildi:', sales.length, 'kayıt');
            console.log('📊 İlk 3 satış verisi örneği:', sales.slice(0, 3));
            
            // Debug için XML yapısını logla
            console.log('🔍 XML Debug Bilgileri:');
            console.log('- XML uzunluğu:', content.length);
            console.log('- Namespace var mı:', !!hasNamespace);
            console.log('- Root element:', xmlDoc.documentElement?.tagName);
            
            // İlk satış verisini detaylı göster
            if (sales.length > 0) {
              console.log('🔍 İlk satış verisi detay:', {
                tarih: sales[0].tarih,
                saat: sales[0].saat,
                filo: sales[0].filo,
                plaka: sales[0].plaka,
                urun: sales[0].urun,
                litre: sales[0].litre,
                tutar: sales[0].tutar,
                birimFiyat: sales[0].birimFiyat
              });
            }
            
          } catch (e) {
            console.error('❌ Turpak XML parse hatası:', e);
            // Fallback olarak eski formatı dene
            try {
              const parsedContent = JSON.parse(content);
              if (parsedContent.sales || parsedContent.data) {
                sales = parsedContent.sales || parsedContent.data || [];
              }
            } catch (jsonError) {
              console.error('❌ JSON parse hatası da:', jsonError);
              sales = [];
            }
          }
        } else if (content.sales || content.data) {
          // Content zaten bir obje ise
          sales = content.sales || content.data || [];
        }

        console.log('📊 Turpak satış verileri:', sales);
        console.log('📊 Sales array uzunluğu:', sales?.length || 0);
        
        // Eğer sales boşsa, detaylı debug bilgisi ver
        if (!sales || sales.length === 0) {
          console.error('❌ Sales verisi boş! Detaylı debug başlıyor...');
          console.log('📄 Ham content tipi:', typeof content);
          console.log('📄 Ham content uzunluğu:', content?.length || 0);
          console.log('📄 Ham content başlangıcı:', typeof content === 'string' ? content.substring(0, 500) : content);
          
          // Turpak parse bloğuna geçip geçmediğini kontrol et
          if (typeof content === 'string' && content.includes('<SaleData')) {
            console.log('🔍 XML formatı tespit edildi ama parse edilemedi');
          }
        }

        // Satış özeti hesapla
        const salesSummary = {
          toplamSatis: sales.length,
          toplamLitre: sales.reduce((sum: number, sale: any) => sum + (sale.litre || 0), 0),
          toplamTutar: sales.reduce((sum: number, sale: any) => sum + (sale.tutar || 0), 0)
        };

        // Ürün bazlı özet
        const productSummary = sales.reduce((acc: any, sale: any) => {
          const urun = sale.urun || 'Bilinmeyen Ürün';
          if (!acc[urun]) {
            acc[urun] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[urun].litre += sale.litre || 0;
          acc[urun].tutar += sale.tutar || 0;
          acc[urun].adet += 1;
          return acc;
        }, {} as any);

        // Filo bazlı özet - en çok tutar olana göre sırala ve 6 adet ile sınırla
        const fleetSummary = sales.reduce((acc: any, sale: any) => {
          const filo = sale.filo || 'Bilinmeyen Filo';
          if (!acc[filo]) {
            acc[filo] = { litre: 0, tutar: 0, adet: 0 };
          }
          acc[filo].litre += sale.litre || 0;
          acc[filo].tutar += sale.tutar || 0;
          acc[filo].adet += 1;
          return acc;
        }, {} as any);

        // Filo özetini en çok tutar olana göre sırala ve 6 adet ile sınırla
        const sortedFleetSummary = Object.entries(fleetSummary)
          .sort(([, a]: [string, any], [, b]: [string, any]) => b.tutar - a.tutar)
          .slice(0, 6)
          .reduce((acc: any, [key, value]: [string, any]) => {
            acc[key] = value;
            return acc;
          }, {} as any);

        // Turpak için station bilgileri parse bloğunda zaten tanımlandı
        // Eğer stationInfo yoksa default değer kullan
        const finalStationInfo = {
          code: '000299', // XML'den alınan StationCode
          name: 'Turpak İstasyonu',
          companyCode: '7732' // XML'den alınan CompanyCode
        };

        console.log('🏢 Final Station bilgileri:', finalStationInfo);
        console.log('🎯 setParsedData çağrılıyor, sales.length:', sales.length);

        setParsedData({
          stationInfo: finalStationInfo,
          sales,
          salesSummary,
          productSummary,
          fleetSummary: sortedFleetSummary,
          rawRows: sales.map((sale: any, index: number) => ({
            'Sıra': index + 1,
            'Tarih': sale.tarih || '',
            'Saat': sale.saat || '',
            'Filo': sale.filo || '',
            'Filo Kodu': sale.filoKodu || '',
            'Plaka': sale.plaka || '',
            'Ürün': sale.urun || '',
            'Litre': (sale.litre || 0).toFixed(2),
            'Tutar': formatCurrency(sale.tutar || 0),
            'Birim Fiyat': formatCurrency(sale.birimFiyat || 0),
            'Tabanca': sale.tabanca || '',
            'Pompa': sale.pompa || '',
            'RFID': sale.rfID || '',
            'KM': sale.km || '',
            'Plaka 2': sale.plaka2 || '',
            'YK Fiş No': sale.ykFisNo || ''
          }))
        });

        console.log('✅ setParsedData tamamlandı!');

        // Satış özeti bölümüne scroll
        setTimeout(() => {
          const element = document.getElementById('satis-ozeti');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
    } catch (error) {
      console.error('Veri parse hatası:', error);
      alert('Veri işlenirken bir hata oluştu');
    }
  };

  // PDF export fonksiyonu
  const exportToPDF = () => {
    if (!parsedData || !parsedData.rawRows) {
      alert('Yazdırılacak veri bulunamadı');
      return;
    }

    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(18);
    doc.text('Akaryakıt Satış Raporu', 14, 22);
    
    // Tarih
    doc.setFontSize(12);
    doc.text(`Tarih: ${selectedDate}`, 14, 32);
    doc.text(`İstasyon: ${selectedCompany?.name || ''}`, 14, 40);
    
    // Satış özeti
    doc.setFontSize(14);
    doc.text('Satış Özeti', 14, 55);
    doc.setFontSize(10);
    doc.text(`Toplam Satış: ${parsedData.salesSummary.toplamSatis}`, 14, 65);
    doc.text(`Toplam Litre: ${parsedData.salesSummary.toplamLitre.toFixed(2)}`, 14, 72);
    doc.text(`Toplam Tutar: ${formatCurrency(parsedData.salesSummary.toplamTutar)}`, 14, 79);
    
    // Tablo
    const tableData = parsedData.rawRows.map((row: any) => [
      row['Sıra'],
      row['Tarih'],
      row['Filo'],
      row['Plaka'],
      row['Ürün'],
      row['Litre'],
      row['Tutar'],
      row['Birim Fiyat'],
      row['Tabanca'],
      row['Pompa']
    ]);

    doc.autoTable({
      startY: 90,
      head: [['Sıra', 'Tarih', 'Filo', 'Plaka', 'Ürün', 'Litre', 'Tutar', 'Birim Fiyat', 'Tabanca', 'Pompa']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [220, 53, 69] },
      styles: { fontSize: 8 }
    });

    doc.save(`akaryakit-satis-${selectedDate}.pdf`);
  };

  // useEffect for scroll to sales summary
  useEffect(() => {
    if (parsedData) {
      setTimeout(() => {
        const element = document.getElementById('satis-ozeti');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [parsedData]);

  return (
    <DashboardLayout title="Akaryakıt Satış Raporu">
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
                  <h1 className="text-2xl font-bold text-white">⛽ Akaryakıt Satış Raporu</h1>
                  <p className="text-red-100 mt-1">Günlük akaryakıt satış verilerini görüntüleyin ve analiz edin</p>
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
                  <h2 className="text-lg font-semibold text-green-900">🏢 Şube ve Satış Ayarları</h2>
                
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
                             key={setting.id || setting.module_name}
                            onClick={() => setSelectedCompany(setting)}
                                                         className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                               selectedCompany?.id === setting.id || selectedCompany === setting
                                 ? 'border-green-500 bg-green-50 shadow-md'
                                 : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-25'
                             }`}
                          >
                                                         <div className="font-medium text-gray-900 mb-1">
                               🏢 {setting.branch_name || setting.module_name}
                             </div>
                            <div className="text-xs text-gray-600">
                              <div className="mb-1">
                                <span className="font-medium">Otomasyon Tipi:</span>
                                <span className={`ml-1 px-2 py-0.5 rounded ${
                                  (setting.file_type?.toLowerCase() === 'turpak' || 
                                   setting.module_name?.toLowerCase().includes('turpak'))
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {(setting.file_type?.toLowerCase() === 'turpak' || 
                                    setting.module_name?.toLowerCase().includes('turpak'))
                                    ? 'TURPAK (ZIP)'
                                    : (setting.file_type?.toUpperCase() || 'XML')
                                  }
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tarih Seçimi */}
                    {selectedCompany && (
                      <div className="bg-gradient-to-br from-white to-green-50 rounded-xl p-6 border-2 border-green-200 shadow-lg">
                        <div className="flex items-center mb-6">
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-bold text-gray-800">📅 Tarih Seçimi</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
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
                                Satış verilerini görüntülemek için önce istasyon ve tarih seçimi yapmanız gerekmektedir.
                              </p>
                            </div>
                          </div>
                        </div>



                        {/* Satış Verilerini Getir Butonu */}
                        <div className="text-center">
                                                     <button
                             onClick={() => readFromSelectedCompany()}
                             disabled={isReading || !selectedDate}
                            className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200 mx-auto"
                          >
                            {isReading ? (
                              <>
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                <span>
                                  {(selectedCompany?.file_type?.toLowerCase() === 'turpak' || 
                                    selectedCompany?.module_name?.toLowerCase().includes('turpak'))
                                    ? 'Turpak Zip Dosyası İşleniyor...'
                                    : 'Satış Verileri Getiriliyor...'
                                  }
                                </span>
                              </>
                            ) : (
                              <>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                {(selectedCompany?.file_type?.toLowerCase() === 'turpak' || 
                                  selectedCompany?.module_name?.toLowerCase().includes('turpak'))
                                  ? 'Turpak Zip Dosyasını Oku'
                                  : 'Satış Verilerini Getir'
                                }
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

            {/* İstasyon bulunamadı durumu */}
            {!isLoadingSettings && companySettings.length === 0 && (
              <div className="mb-6 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center py-8">
                  <div className="text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">İstasyon bulunamadı</p>
                    <p className="text-sm text-gray-600">Bu şirket için akaryakıt istasyonu ayarlanmamış</p>
                  </div>
                </div>
              </div>
            )}

            

            {/* Sonuçlar */}
            {parsedData && (
              <>
                {/* Satış Özeti */}
                <div id="satis-ozeti" className="mb-8">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border-2 border-green-200 shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      📊 Satış Özeti
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="text-sm text-gray-600">Toplam Satış</div>
                        <div className="text-2xl font-bold text-green-600">{parsedData.salesSummary.toplamSatis}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="text-sm text-gray-600">Toplam Litre</div>
                        <div className="text-2xl font-bold text-blue-600">{parsedData.salesSummary.toplamLitre.toFixed(2)}</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <div className="text-sm text-gray-600">Toplam Tutar</div>
                        <div className="text-2xl font-bold text-purple-600">{formatCurrency(parsedData.salesSummary.toplamTutar)}</div>
                      </div>
                    </div>

                    {/* Ürün Bazlı Özet */}
                    <div className="mb-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">🛢️ Ürün Bazlı Özet</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(parsedData.productSummary).map(([urun, data]: [string, any]) => (
                          <div key={urun} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="font-medium text-gray-900 mb-2">{urun}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Adet:</span>
                                <span className="font-medium">{data.adet}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Litre:</span>
                                <span className="font-medium">{data.litre.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tutar:</span>
                                <span className="font-medium">{formatCurrency(data.tutar)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Filo Bazlı Özet */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">🚛 Filo Bazlı Özet</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(parsedData.fleetSummary).map(([filo, data]: [string, any]) => (
                          <div key={filo} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="font-medium text-gray-900 mb-2">{filo}</div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Adet:</span>
                                <span className="font-medium">{data.adet}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Litre:</span>
                                <span className="font-medium">{data.litre.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tutar:</span>
                                <span className="font-medium">{formatCurrency(data.tutar)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>



                {/* Ham Veriler */}
                {parsedData.rawRows && parsedData.rawRows.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                      <h3 className="text-xl font-semibold text-gray-900">📋 Satış Detayları</h3>
                      <button
                        onClick={exportToPDF}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-md transform hover:scale-105 transition-all duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF Yazdır
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(parsedData.rawRows[0]).map((header) => (
                              <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {parsedData.rawRows.map((row: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              {Object.values(row).map((value: any, cellIndex: number) => (
                                <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
