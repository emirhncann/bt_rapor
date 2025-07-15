'use client';

import React from 'react';
import ExcelUploader from '../components/ExcelUploader';

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

export default function ExcelUpload() {
  const handleDataLoaded = (data: ExcelData) => {
    console.log('Excel verisi yüklendi:', data);
    // Burada veriyi işleyebilir veya başka bir yere gönderebilirsiniz
  };

  const handleError = (error: string) => {
    console.error('Excel yükleme hatası:', error);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Excel Dosyası Yükleme ve Okuma
          </h1>
          
          <p className="text-gray-600 text-center mb-8">
            Excel dosyalarınızı yükleyin, içeriğini görüntüleyin ve işleyin.
          </p>

          <ExcelUploader
            onDataLoaded={handleDataLoaded}
            onError={handleError}
            acceptedFormats={['.xlsx', '.xls', '.csv']}
            maxFileSize={10}
            showPreview={true}
            showDownload={true}
          />
        </div>
      </div>
    </div>
  );
} 