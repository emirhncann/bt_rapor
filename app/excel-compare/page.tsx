'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface MissingInvoice {
  'Fatura No': string;
  'Tarih': string;
  'Gönderici VKN': string;
  'Alıcı VKN': string;
  'Toplam Tutar': number;
  'Vergi Hariç Tutar': number;
  'KDV Toplamı': number;
  'Fatura Tarihi': string;
  'Gönderici Adı': string;
  'Tür': string;
}

interface CompareResponse {
  success: boolean;
  summary: {
    totalExcelRows: number;
    totalLogoInvoices: number;
    missingInvoices: number;
    processedAt: string;
  };
  missingInvoices: MissingInvoice[];
  message: string;
}

export default function ExcelCompare() {
  const [isLoading, setIsLoading] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bağlantı ayarları
  const [firmaNo, setFirmaNo] = useState('005');
  const [donemNo, setDonemNo] = useState('01');
  const [logoDb, setLogoDb] = useState('GO3');
  const [companyRef, setCompanyRef] = useState('01');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Dosya türünü kontrol et
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Sadece .xlsx, .xls veya .csv dosyaları kabul edilir');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCompareResult(null);

    try {
      const formData = new FormData();
      formData.append('excelFile', file);

      const response = await fetch('/api/excel-compare', {
        method: 'POST',
        body: formData,
        headers: {
          'firma-no': firmaNo,
          'donem-no': donemNo,
          'logo-db': logoDb,
          'company-ref': companyRef
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Dosya işlenirken hata oluştu');
      }

      setCompareResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadMissingInvoices = () => {
    if (!compareResult?.missingInvoices) return;

    try {
      const worksheet = XLSX.utils.json_to_sheet(compareResult.missingInvoices);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Eksik Faturalar');

      // Sütun genişliklerini ayarla
      const columnWidths = [
        { wch: 20 }, // Fatura No
        { wch: 15 }, // Tarih
        { wch: 15 }, // Gönderici VKN
        { wch: 15 }, // Alıcı VKN
        { wch: 15 }, // Toplam Tutar
        { wch: 15 }, // Vergi Hariç Tutar
        { wch: 15 }, // KDV Toplamı
        { wch: 20 }, // Fatura Tarihi
        { wch: 30 }, // Gönderici Adı
        { wch: 15 }  // Tür
      ];
      worksheet['!cols'] = columnWidths;

      const fileName = `logo_eksik_faturalar_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  const resetForm = () => {
    setCompareResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Excel - LOGO Fatura Karşılaştırma
          </h1>
          
          <p className="text-gray-600 text-center mb-8">
            Excel dosyanızdaki faturaları LOGO veritabanıyla karşılaştırın ve eksik faturaları tespit edin.
          </p>

          {/* Bağlantı Ayarları */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">LOGO Bağlantı Ayarları</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firma No
                </label>
                <input
                  type="text"
                  value={firmaNo}
                  onChange={(e) => setFirmaNo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="005"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dönem No
                </label>
                <input
                  type="text"
                  value={donemNo}
                  onChange={(e) => setDonemNo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LOGO Veritabanı
                </label>
                <input
                  type="text"
                  value={logoDb}
                  onChange={(e) => setLogoDb(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="GO3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Ref
                </label>
                <input
                  type="text"
                  value={companyRef}
                  onChange={(e) => setCompanyRef(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="01"
                />
              </div>
            </div>
          </div>

          {/* Dosya Yükleme */}
          <div className="mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="mb-4">
                <p className="text-lg font-medium text-gray-900">
                  Excel dosyası seçin
                </p>
                <p className="text-sm text-gray-500">
                  .xlsx, .xls veya .csv dosyaları kabul edilir
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Dosya şu sütunları içermeli: Fatura No, Gönderici VKN, Alıcı VKN, Toplam Tutar, Vergi Hariç Tutar, KDV Toplamı, Fatura Tarihi, Gönderici Adı, Tür
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Karşılaştırılıyor...' : 'Dosya Seç ve Karşılaştır'}
              </button>
            </div>
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

          {/* Sonuçlar */}
          {compareResult && (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-green-800">
                      Karşılaştırma Tamamlandı
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Excel Satırları</p>
                    <p className="text-2xl font-bold text-blue-600">{compareResult.summary.totalExcelRows}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-500">LOGO'da Bulunan</p>
                    <p className="text-2xl font-bold text-green-600">{compareResult.summary.totalLogoInvoices}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Eksik Faturalar</p>
                    <p className="text-2xl font-bold text-red-600">{compareResult.summary.missingInvoices}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-gray-500">İşlem Zamanı</p>
                    <p className="text-sm font-bold text-purple-600">{compareResult.summary.processedAt}</p>
                  </div>
                </div>

                <p className="text-green-800 mb-4">{compareResult.message}</p>

                <div className="flex space-x-4">
                  {compareResult.missingInvoices.length > 0 && (
                    <button
                      onClick={downloadMissingInvoices}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                    >
                      Eksik Faturaları İndir
                    </button>
                  )}
                  <button
                    onClick={resetForm}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                  >
                    Yeni Karşılaştırma
                  </button>
                </div>
              </div>

              {/* Eksik Faturalar Tablosu */}
              {compareResult.missingInvoices.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">LOGO'da Bulunamayan Faturalar</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fatura No</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gönderici VKN</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alıcı VKN</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Tutar</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gönderici Adı</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {compareResult.missingInvoices.slice(0, 20).map((invoice, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {invoice['Fatura No']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invoice['Tarih']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invoice['Gönderici VKN']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invoice['Alıcı VKN']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invoice['Toplam Tutar']?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {invoice['Gönderici Adı']}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {compareResult.missingInvoices.length > 20 && (
                    <div className="px-6 py-4 bg-gray-50 text-sm text-gray-500">
                      İlk 20 satır gösteriliyor. Toplam {compareResult.missingInvoices.length} eksik fatura var.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 