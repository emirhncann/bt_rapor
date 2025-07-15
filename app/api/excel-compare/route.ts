import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { sendSecureProxyRequest } from '../../utils/api';

interface ExcelRow {
  'Fatura No': string;
  'Gönderici VKN': string;
  'Alıcı VKN': string;
  'Toplam Tutar': number;
  'Vergi Hariç Tutar': number;
  'KDV Toplamı': number;
  'Fatura Tarihi': string;
  'Gönderici Adı': string;
  'Tür': string;
}

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

// Tarih formatını dönüştür
function convertDateFormat(dateValue: any): string {
  if (!dateValue) return '';
  
  let date: Date;
  
  // Excel serial number kontrolü
  if (typeof dateValue === 'number') {
    date = XLSX.SSF.parse_date_code(dateValue);
  } else {
    const dateStr = String(dateValue);
    
    // DD.MM.YYYY formatı
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('.');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // DD.MM.YYYY HH:mm:ss formatı
    else if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      const [datePart, timePart] = dateStr.split(' ');
      const [day, month, year] = datePart.split('.');
      const [hour, minute, second] = timePart.split(':');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                     parseInt(hour), parseInt(minute), parseInt(second));
    }
    // Diğer formatlar için Date.parse dene
    else {
      date = new Date(dateValue);
    }
  }
  
  // Geçerli tarih kontrolü
  if (isNaN(date.getTime())) {
    return '';
  }
  
  // UTC+3 saat dilimi için 3 saat ekle
  date.setHours(date.getHours() + 3);
  
  // YYYY-MM-DD 03:00:00 formatına dönüştür
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day} 03:00:00`;
}

// LOGO'da fatura kontrolü
async function checkInvoicesInLogo(faturaNumbers: string[], firmaNo: string, donemNo: string, logoDb: string, companyRef: string): Promise<string[]> {
  try {
    if (faturaNumbers.length === 0) {
      console.log('⚠️ Fatura numarası bulunamadı');
      return [];
    }

    // Fatura numaralarını SQL için hazırla
    const faturaList = faturaNumbers.map(fn => `'${fn}'`).join(',');
    
    const sqlQuery = `
      SELECT FICHENO 
      FROM [${logoDb}]..LG_${firmaNo.padStart(3, '0')}_${donemNo}_INVOICE 
      WHERE TRCODE IN (1,2,3,4) 
        AND FICHENO IN (${faturaList})
    `;

    console.log('🔍 LOGO sorgusu:', sqlQuery);
    console.log('🔐 Proxy ayarları:', { companyRef, firmaNo, donemNo, logoDb });

    // Proxy isteği gönder - connectionType'ı 'first_db_key' olarak değiştir
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key', // connectionType'ı 'first_db_key' olarak değiştirdim
      { query: sqlQuery },
      'https://api.btrapor.com/proxy',
      120000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LOGO sorgu hatası:', errorText);
      throw new Error(`LOGO sorgu hatası: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('📊 LOGO yanıtı:', result);
    
    const existingInvoices = result.results || result.data || [];
    
    // Mevcut fatura numaralarını döndür
    return existingInvoices.map((row: any) => row.FICHENO || row.FICHENO);

  } catch (error) {
    console.error('❌ LOGO kontrol hatası:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Excel karşılaştırma API başlatıldı');
    
    const formData = await request.formData();
    const excelFile = formData.get('excelFile') as File;
    
    if (!excelFile) {
      console.log('❌ Excel dosyası bulunamadı');
      return NextResponse.json(
        { error: 'Excel dosyası bulunamadı.' },
        { status: 400 }
      );
    }

    console.log('📁 Dosya adı:', excelFile.name, 'Boyut:', excelFile.size);

    let jsonData: any[][];
    
    try {
      // Dosya türüne göre okuma yöntemi belirle
      if (excelFile.type === 'text/csv' || excelFile.name.endsWith('.csv')) {
        // CSV dosyası
        const text = await excelFile.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        jsonData = lines.map(line => line.split(',').map(cell => cell.trim()));
      } else {
        // Excel dosyası
        const buffer = await excelFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Excel'i JSON'a çevir
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      }
    } catch (fileError) {
      console.error('❌ Dosya okuma hatası:', fileError);
      return NextResponse.json(
        { error: 'Dosya okunamadı. Dosya formatını kontrol edin.' },
        { status: 400 }
      );
    }
    
    if (!jsonData || jsonData.length < 2) {
      return NextResponse.json(
        { error: 'Excel dosyası boş veya geçersiz.' },
        { status: 400 }
      );
    }

    // İlk satırı başlık olarak al
    const headers = jsonData[0] as string[];
    const requiredColumns = [
      'Fatura No', 'Gönderici VKN', 'Alıcı VKN', 'Toplam Tutar',
      'Vergi Hariç Tutar', 'KDV Toplamı', 'Fatura Tarihi', 'Gönderici Adı', 'Tür'
    ];

    // Gerekli sütunları kontrol et
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      console.log('Excel dosyasındaki sütunlar:', headers);
      console.log('Gerekli sütunlar:', requiredColumns);
      console.log('Eksik sütunlar:', missingColumns);
      
      return NextResponse.json(
        { 
          error: `Excel dosyasında gerekli sütunlar eksik. Eksik sütunlar: ${missingColumns.join(', ')}. Excel dosyasındaki mevcut sütunlar: ${headers.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Sütun indekslerini bul
    const columnIndexes = {
      faturaNo: headers.indexOf('Fatura No'),
      gondericiVKN: headers.indexOf('Gönderici VKN'),
      aliciVKN: headers.indexOf('Alıcı VKN'),
      toplamTutar: headers.indexOf('Toplam Tutar'),
      vergiHariçTutar: headers.indexOf('Vergi Hariç Tutar'),
      kdvToplami: headers.indexOf('KDV Toplamı'),
      faturaTarihi: headers.indexOf('Fatura Tarihi'),
      gondericiAdi: headers.indexOf('Gönderici Adı'),
      tur: headers.indexOf('Tür')
    };

    // Request headers'dan firma bilgilerini al
    const firmaNo = request.headers.get('firma-no') || '005';
    const donemNo = request.headers.get('donem-no') || '01';
    const logoDb = request.headers.get('logo-db') || 'GO3';
    const companyRef = request.headers.get('company-ref') || '01';
    
    console.log('📊 Excel\'den', jsonData.length - 1, 'satır okundu');
    console.log('🏢 Firma bilgileri:', { firmaNo, donemNo, logoDb, companyRef });
    
    // Excel'den fatura numaralarını çıkar
    const faturaNumbers: string[] = [];
    const excelRows: any[] = [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const faturaNo = String(row[columnIndexes.faturaNo] || '');
      if (!faturaNo || faturaNo.trim() === '') continue;

      faturaNumbers.push(faturaNo);
      excelRows.push({
        faturaNo,
        row,
        columnIndexes
      });
    }

    console.log('🔍 LOGO\'da', faturaNumbers.length, 'fatura numarası aranıyor...');

    if (faturaNumbers.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalExcelRows: jsonData.length - 1,
          totalLogoInvoices: 0,
          missingInvoices: 0,
          processedAt: new Date().toLocaleString('tr-TR')
        },
        missingInvoices: [],
        message: 'Excel dosyasında geçerli fatura numarası bulunamadı.'
      });
    }

    // LOGO'da mevcut faturaları kontrol et
    const existingInvoices = await checkInvoicesInLogo(faturaNumbers, firmaNo, donemNo, logoDb, companyRef);
    
    console.log('✅ LOGO\'da bulunan faturalar:', existingInvoices.length);
    console.log('❌ LOGO\'da bulunamayan faturalar:', faturaNumbers.length - existingInvoices.length);

    // Eksik faturaları bul
    const missingInvoices: MissingInvoice[] = [];
    
    excelRows.forEach(({ faturaNo, row, columnIndexes }) => {
      if (!existingInvoices.includes(faturaNo)) {
        const missingInvoice: MissingInvoice = {
          'Fatura No': faturaNo,
          'Tarih': convertDateFormat(row[columnIndexes.faturaTarihi]),
          'Gönderici VKN': String(row[columnIndexes.gondericiVKN] || ''),
          'Alıcı VKN': String(row[columnIndexes.aliciVKN] || ''),
          'Toplam Tutar': parseFloat(row[columnIndexes.toplamTutar] || 0),
          'Vergi Hariç Tutar': parseFloat(row[columnIndexes.vergiHariçTutar] || 0),
          'KDV Toplamı': parseFloat(row[columnIndexes.kdvToplami] || 0),
          'Fatura Tarihi': String(row[columnIndexes.faturaTarihi] || ''),
          'Gönderici Adı': String(row[columnIndexes.gondericiAdi] || ''),
          'Tür': String(row[columnIndexes.tur] || '')
        };
        
        missingInvoices.push(missingInvoice);
      }
    });

    const result = {
      success: true,
      summary: {
        totalExcelRows: jsonData.length - 1,
        totalLogoInvoices: existingInvoices.length,
        missingInvoices: missingInvoices.length,
        processedAt: new Date().toLocaleString('tr-TR')
      },
      missingInvoices,
      message: `Excel'de ${jsonData.length - 1} fatura bulundu. LOGO'da ${existingInvoices.length} fatura mevcut. ${missingInvoices.length} fatura LOGO'da bulunamadı.`
    };

    console.log('✅ Karşılaştırma tamamlandı:', result.summary);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Excel karşılaştırma hatası:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata oluştu',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 