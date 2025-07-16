'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import { sendSecureProxyRequest } from '../utils/api';
import * as XLSX from 'xlsx';

export default function ExcelCompare() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [animationData, setAnimationData] = useState(null);
  const [successAnimationData, setSuccessAnimationData] = useState(null);
  const [failedAnimationData, setFailedAnimationData] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Animasyonları yükle
  useState(() => {
    fetch('/animations/loading.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.log('Loading animation yüklenemedi:', err));
    
    fetch('/animations/success.json')
      .then(res => res.json())
      .then(data => setSuccessAnimationData(data))
      .catch(err => console.log('Success animation yüklenemedi:', err));
    
    fetch('/animations/failed.json')
      .then(res => res.json())
      .then(data => setFailedAnimationData(data))
      .catch(err => console.log('Failed animation yüklenemedi:', err));
  });

  // localStorage'dan connection bilgilerini oku
  useEffect(() => {
    const loadConnectionInfo = async () => {
      const storedConnectionInfo = localStorage.getItem('connectionInfo');
      if (storedConnectionInfo) {
        try {
          const parsedInfo = JSON.parse(storedConnectionInfo);
          setConnectionInfo(parsedInfo);
          console.log('🔗 Mevcut connection bilgileri yüklendi:', {
            company_ref: parsedInfo.company_ref,
            first_firma_no: parsedInfo.first_firma_no,
            first_donem_no: parsedInfo.first_donem_no,
            first_db_name: parsedInfo.first_db_name
          });
        } catch (error) {
          console.error('❌ Connection bilgileri parse edilemedi:', error);
        }
      } else {
        console.log('⚠️ localStorage\'da connectionInfo bulunamadı, API\'den yükleniyor...');
        // Eğer localStorage'da yoksa API'den yüklemeyi dene
        try {
          const companyRef = localStorage.getItem('companyRef');
          if (companyRef) {
            const response = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
            const data = await response.json();
            
            if (response.ok && data.status === 'success' && data.data) {
              const connectionInfo = data.data;
              localStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
              setConnectionInfo(connectionInfo);
              console.log('✅ Connection bilgileri API\'den yüklendi:', connectionInfo);
            } else {
              console.log('⚠️ API\'den connection bilgileri alınamadı:', data.message);
            }
          } else {
            console.log('⚠️ companyRef bulunamadı');
          }
        } catch (error) {
          console.error('❌ API\'den connection bilgileri yüklenirken hata:', error);
        }
      }
    };
    
    loadConnectionInfo();
  }, []);

  const processExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Excel'i JSON'a çevir
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject(new Error('Excel dosyası boş veya geçersiz.'));
            return;
          }
          
          // İlk satırı başlık olarak al
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);
          
          // Fatura verilerini işle - B kolonu (index 1) fatura numarası
          const invoices = rows.map((row: unknown, rowIndex: number) => {
            const rowArray = row as any[];
            const invoice: any = {};
            headers.forEach((header, index) => {
              invoice[header] = rowArray[index] || '';
            });
            
            // B kolonu (index 1) fatura numarası olarak ata
            invoice['Fatura No'] = rowArray[1] || '';
            
            return invoice;
          });
          
          resolve(invoices);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsArrayBuffer(file);
    });
  };

  // LOGO veritabanından fatura bilgilerini çek (Proxy üzerinden)
  const fetchLogoInvoices = async (faturaNumbers: string[]) => {
    try {
      const companyRef = connectionInfo.company_ref?.toString() || '';
      const firmaNo = connectionInfo.first_firma_no?.toString() || '';
      const donemNo = connectionInfo.first_donem_no?.toString() || '';
      const logoDb = connectionInfo.first_db_name?.toString() || '';

      if (!companyRef) {
        throw new Error('Company reference bulunamadı');
      }

      // Fatura numaralarını SQL için hazırla (SQL injection'a karşı escape)
      const faturaList = faturaNumbers.map(fn => `'${fn.toString().replace(/'/g, "''")}'`).join(',');
      
      // SQL sorgusunu hazırla
      const sqlQuery = `
        SELECT 
          FICHENO as fatura_no,
          DATE_ as tarih
        FROM [${logoDb}]..LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_INVOICE 
        WHERE TRCODE IN (1,2,3,4) 
          AND FICHENO IN (${faturaList})
      `;

      console.log('🔍 SQL Sorgusu:', sqlQuery);
      console.log('📊 Fatura sayısı:', faturaNumbers.length);

      // Güvenli proxy request gönder
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        {
          query: sqlQuery
        },
        'https://api.btrapor.com/proxy',
        120000 // 2 dakika timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LOGO veritabanından fatura bilgileri alınamadı: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Proxy'den gelen yanıtı işle
      if (Array.isArray(data)) {
        return data;
      } else if (data.results && Array.isArray(data.results)) {
        return data.results;
      } else if (data.data && Array.isArray(data.data)) {
        return data.data;
      } else if (data.status === 'success' && data.data) {
        return Array.isArray(data.data) ? data.data : [];
      } else {
        console.warn('Beklenmeyen veri formatı:', data);
        return [];
      }
    } catch (error) {
      console.error('❌ LOGO veritabanı hatası:', error);
      throw error;
    }
  };

  // Fatura karşılaştırma işlemi
  const compareInvoices = (excelInvoices: any[], logoInvoices: any[]) => {
    const excelFaturaNumbers = new Set(
      excelInvoices
        .map(invoice => invoice['Fatura No']?.toString().trim())
        .filter(faturaNo => faturaNo && faturaNo !== '')
    );

    const logoFaturaNumbers = new Set(
      logoInvoices.map(invoice => invoice.fatura_no?.toString().trim())
    );

    // LOGO'da olmayan faturalar (B kolonu fatura numarası)
    const missingInvoices = excelInvoices.filter(invoice => {
      const faturaNo = invoice['Fatura No']?.toString().trim();
      return faturaNo && faturaNo !== '' && !logoFaturaNumbers.has(faturaNo);
    });

    // LOGO'da olan faturalar (B kolonu fatura numarası)
    const existingInvoices = excelInvoices.filter(invoice => {
      const faturaNo = invoice['Fatura No']?.toString().trim();
      return faturaNo && faturaNo !== '' && logoFaturaNumbers.has(faturaNo);
    });

    return {
      totalInvoices: excelInvoices.length,
      existingInvoices: existingInvoices.length,
      missingInvoices: missingInvoices.length,
      missingInvoicesDetails: missingInvoices,
      existingInvoicesDetails: existingInvoices
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Dosya formatı kontrolü
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
      ];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Lütfen geçerli bir Excel dosyası (.xlsx, .xls) veya CSV dosyası seçin.');
        return;
      }
      
      // Dosya boyutu kontrolü (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Dosya boyutu 10MB\'dan küçük olmalıdır.');
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Lütfen bir dosya seçin.');
      return;
    }

    if (!connectionInfo) {
      setError('Connection bilgileri bulunamadı. Lütfen önce connection bilgilerini yükleyin.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Excel dosyasını işle
      console.log('📊 Excel dosyası işleniyor...');
      const excelInvoices = await processExcelFile(file);
      console.log('✅ Excel işlendi, fatura sayısı:', excelInvoices.length);

      // Fatura numaralarını çıkar (B kolonu - index 1)
      const faturaNumbers = excelInvoices
        .map(invoice => invoice['Fatura No'])
        .filter(faturaNo => faturaNo && faturaNo.toString().trim() !== '');

      console.log('🔍 Fatura numaraları:', faturaNumbers);

      if (faturaNumbers.length === 0) {
        setError('Excel dosyasında geçerli fatura numarası bulunamadı.');
        setLoading(false);
        return;
      }

      // LOGO veritabanından fatura bilgilerini çek
      console.log('🗄️ LOGO veritabanından fatura bilgileri çekiliyor...');
      const logoInvoices = await fetchLogoInvoices(faturaNumbers);
      console.log('✅ LOGO veritabanından fatura bilgileri alındı:', logoInvoices.length);

      // Faturaları karşılaştır
      console.log('🔍 Faturalar karşılaştırılıyor...');
      const comparisonResult = compareInvoices(excelInvoices, logoInvoices);

      setResult({
        success: true,
        ...comparisonResult
      });

      console.log('✅ Karşılaştırma tamamlandı:', comparisonResult);

    } catch (err) {
      console.error('❌ İşlem hatası:', err);
      setError(err instanceof Error ? err.message : 'Dosya işlenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
      setResult(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };





  return (
    <DashboardLayout title="Fatura Kontrol">
      <div className="w-full px-2">
        {/* Başlık Kartı */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fatura Kontrol</h1>
                <p className="text-gray-600 mt-1">Excel dosyanızdaki faturaları LOGO veritabanı ile karşılaştırın</p>
              </div>
            </div>
            <button
              onClick={() => window.open('http://dosya.btrapor.com/fatura_karsilastirma_sablon.xlsx', '_blank')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Örnek Şablonu İndir</span>
            </button>
          </div>
        </div>

        {/* Bilgilendirme Kartı */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Nasıl Kullanılır?</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-800">1</span>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800">
                      <a href="http://efatura.elogo.com.tr/" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-blue-600">
                        e-Fatura Portalı
                      </a>
                      'na giriş yapın
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-800">2</span>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800">
                      Sol tarafından<strong> gelen faturalar</strong> bölümüne gidin
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-800">3</span>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800">
                      Fatura tarihi ve oluşturma tarihi parametrelerini istediğiniz gibi doldurun ve <strong>Excel olarak toplu indirin</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-800">4</span>
                  </div>
                  <div>
                    <p className="text-sm text-blue-800">
                      İndirdiğiniz dosyayı aşağıdaki alana yükleyin ve karşılaştırmayı başlatın
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dosya Yükleme Kartı */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            {/* Dosya Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel Dosyası Seçin
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-red-400'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={(e) => {
                  // Eğer tıklanan element button ise, event'i durdur
                  if ((e.target as HTMLElement).tagName === 'BUTTON') {
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      Dosyayı buraya sürükleyin veya{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        dosya seçin
                      </button>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Desteklenen formatlar: .xlsx, .xls, .csv (Maksimum 10MB)
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Seçilen Dosya Bilgisi */}
            {file && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{file.name}</p>
                    <p className="text-xs text-green-600">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-green-600 hover:text-green-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Hata Mesajı */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Karşılaştır Butonu */}
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!file || loading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  !file || loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    {animationData && (
                      <div className="w-5 h-5">
                        <Lottie animationData={animationData} loop={true} />
                      </div>
                    )}
                    <span>Karşılaştırılıyor...</span>
                  </div>
                ) : (
                  'Karşılaştırmayı Başlat'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sonuç Kartı */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              {result.success ? (
                <>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    {successAnimationData ? (
                      <div className="w-5 h-5">
                        <Lottie animationData={successAnimationData} loop={false} />
                      </div>
                    ) : (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Karşılaştırma Tamamlandı</h2>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    {failedAnimationData ? (
                      <div className="w-5 h-5">
                        <Lottie animationData={failedAnimationData} loop={false} />
                      </div>
                    ) : (
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Karşılaştırma Hatası</h2>
                </>
              )}
            </div>

            {result.success ? (
              <div className="space-y-4">
                {/* İstatistikler */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Toplam Fatura</p>
                        <p className="text-2xl font-bold text-blue-900">{result.totalInvoices || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800">Mevcut Faturalar</p>
                        <p className="text-2xl font-bold text-green-900">{result.existingInvoices || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-800">Eksik Faturalar</p>
                        <p className="text-2xl font-bold text-red-900">{result.missingInvoices || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Eksik Faturalar Tablosu */}
                {(result.missingInvoicesDetails || []).length > 0 && (
                  <div className="border border-gray-200 rounded-lg">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900">Eksik Faturalar Detayları</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                              Fatura No
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                              Tür
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                              Tarih
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                              Gönderici VKN
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                              Alıcı VKN
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                              Toplam Tutar
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                              Vergi Hariç Tutar
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                              KDV Toplamı
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Gönderici Adı
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(result.missingInvoicesDetails || []).map((invoice: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                {invoice['Fatura No']}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  invoice['Tür'] === 'Satış' 
                                    ? 'bg-green-100 text-green-800' 
                                    : invoice['Tür'] === 'Alış'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {invoice['Tür']}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice['Tarih']}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice['Gönderici VKN']}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice['Alıcı VKN']}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {typeof invoice['Toplam Tutar'] === 'number' 
                                  ? invoice['Toplam Tutar'].toLocaleString('tr-TR', { 
                                      style: 'currency', 
                                      currency: 'TRY' 
                                    })
                                  : invoice['Toplam Tutar']
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {typeof invoice['Vergi Hariç Tutar'] === 'number'
                                  ? invoice['Vergi Hariç Tutar'].toLocaleString('tr-TR', { 
                                      style: 'currency', 
                                      currency: 'TRY' 
                                    })
                                  : invoice['Vergi Hariç Tutar']
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {typeof invoice['KDV Toplamı'] === 'number'
                                  ? invoice['KDV Toplamı'].toLocaleString('tr-TR', { 
                                      style: 'currency', 
                                      currency: 'TRY' 
                                    })
                                  : invoice['KDV Toplamı']
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {invoice['Gönderici Adı']}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{result.error || 'Bilinmeyen bir hata oluştu.'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 