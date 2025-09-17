'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface ExcelData {
  headers: string[];
  rows: any[][];
  summary: {
    totalRows: number;
    totalColumns: number;
    fileName: string;
    fileSize: string;
    uploadTime: string;
  };
}

interface ExcelUploaderProps {
  onDataLoaded?: (data: ExcelData) => void;
  onError?: (error: string) => void;
  acceptedFormats?: string[];
  maxFileSize?: number; // MB cinsinden
  showPreview?: boolean;
  showDownload?: boolean;
}

export default function ExcelUploader({
  onDataLoaded,
  onError,
  acceptedFormats = ['.xlsx', '.xls', '.csv'],
  maxFileSize = 10, // 10MB
  showPreview = true,
  showDownload = true
}: ExcelUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Dosya boyutu kontrolü
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Dosya boyutu ${maxFileSize}MB'dan büyük olamaz.`;
    }

    // Dosya türü kontrolü
    const fileExtension = file.name.toLocaleLowerCase('tr-TR').substring(file.name.lastIndexOf('.'));
    if (!acceptedFormats.includes(fileExtension)) {
      return `Sadece ${acceptedFormats.join(', ')} dosyaları kabul edilir.`;
    }

    return null;
  };

  const processExcelFile = async (file: File): Promise<ExcelData> => {
    let jsonData: any[][];
    
    // Dosya türüne göre okuma yöntemi belirle
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      // CSV dosyası
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      jsonData = lines.map(line => line.split(',').map(cell => cell.trim()));
    } else {
      // Excel dosyası
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Excel'i JSON'a çevir - tarihleri string olarak bırak
      jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false, // Ham değerleri kullanma, formatlanmış değerleri kullan
        dateNF: 'dd.mm.yyyy' // Tarih formatını belirt
      });
    }
    
    if (jsonData.length < 1) {
      throw new Error('Excel dosyası boş veya geçersiz.');
    }

    // İlk satırı başlık olarak al
    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1);

    return {
      headers,
      rows,
      summary: {
        totalRows: rows.length,
        totalColumns: headers.length,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        uploadTime: new Date().toLocaleString('tr-TR')
      }
    };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setExcelData(null);

    try {
      const data = await processExcelFile(file);
      setExcelData(data);
      onDataLoaded?.(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Dosya okunurken hata oluştu';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const downloadExcel = () => {
    if (!excelData) return;

    try {
      // Başlıkları ve verileri birleştir
      const allData = [excelData.headers, ...excelData.rows];
      
      const worksheet = XLSX.utils.aoa_to_sheet(allData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Veri');

      // Sütun genişliklerini ayarla
      const columnWidths = excelData.headers.map(() => ({ wch: 15 }));
      worksheet['!cols'] = columnWidths;

      const fileName = `islenmis_${excelData.summary.fileName}`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Excel export hatası:', error);
      alert('Excel dosyası oluşturulurken hata oluştu.');
    }
  };

  const resetForm = () => {
    setExcelData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Dosya Yükleme Alanı */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={(e) => {
          // Eğer tıklanan element button ise, event'i durdur
          if ((e.target as HTMLElement).tagName === 'BUTTON') {
            return;
          }
          fileInputRef.current?.click();
        }}
      >
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mb-4">
          <p className="text-lg font-medium text-gray-900">
            Excel dosyası seçin veya sürükleyin
          </p>
          <p className="text-sm text-gray-500">
            {acceptedFormats.join(', ')} dosyaları kabul edilir (Maks. {maxFileSize}MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isLoading}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'İşleniyor...' : 'Dosya Seç'}
        </button>
      </div>

      {/* Hata Mesajı */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
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

      {/* Özet Bilgiler */}
      {excelData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">
                Dosya Başarıyla Yüklendi
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Dosya Adı</p>
              <p className="text-lg font-bold text-blue-600 truncate">{excelData.summary.fileName}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Toplam Satır</p>
              <p className="text-2xl font-bold text-green-600">{excelData.summary.totalRows}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Toplam Sütun</p>
              <p className="text-2xl font-bold text-purple-600">{excelData.summary.totalColumns}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Dosya Boyutu</p>
              <p className="text-lg font-bold text-orange-600">{excelData.summary.fileSize}</p>
            </div>
          </div>

          <div className="flex space-x-4">
            {showDownload && (
              <button
                onClick={downloadExcel}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Excel Olarak İndir
              </button>
            )}
            <button
              onClick={resetForm}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Yeni Dosya Yükle
            </button>
          </div>
        </div>
      )}

      {/* Veri Önizleme */}
      {excelData && showPreview && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setPreviewExpanded(!previewExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👁️</span>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Excel Verileri Önizleme</h3>
                  <p className="text-sm text-gray-500">
                    {excelData.summary.totalRows} satır, {excelData.summary.totalColumns} sütun
                  </p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  previewExpanded ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {previewExpanded && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {excelData.headers.map((header, index) => (
                      <th
                        key={index}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {excelData.rows.slice(0, 50).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >
                          {cell !== null && cell !== undefined ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelData.rows.length > 50 && (
                <div className="px-6 py-4 bg-gray-50 text-sm text-gray-500">
                  İlk 50 satır gösteriliyor. Toplam {excelData.rows.length} satır var.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 