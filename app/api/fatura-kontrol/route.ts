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
  'Oluşturma Tarihi': string;
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
  'Oluşturma Tarihi': string;
  'Gönderici Adı': string;
  'Tür': string;
}

// Tarih formatını dönüştür - DD.MM.YYYY formatında döndür
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
    // YYYY-MM-DD HH:mm:ss formatı
    else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      const [datePart, timePart] = dateStr.split(' ');
      const [year, month, day] = datePart.split('-');
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
  
  // DD.MM.YYYY formatına dönüştür
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
}

// Test modu işleyici
async function handleTestMode(testData: any) {
  try {
    console.log('🧪 Test verileri işleniyor...');
    
    const testInvoices = testData.testData || [];
    const faturaNumbers = testInvoices.map((invoice: any) => invoice['Fatura No']);
    
    // Test için sabit değerler
    const firmaNo = '005';
    const donemNo = '01';
    const logoDb = 'GOWINGS';
    const companyRef = '1';
    
    console.log('🔍 Test faturaları:', faturaNumbers);
    
    // LOGO'da kontrol et (test için boş döndür)
    const existingInvoices: string[] = [];
    
    // Eksik faturaları bul
    const missingInvoices = testInvoices.filter((invoice: any) => 
      !existingInvoices.includes(invoice['Fatura No'])
    );
    
    const result = {
      success: true,
      totalInvoices: testInvoices.length,
      existingInvoices: existingInvoices.length,
      missingInvoices: missingInvoices.length,
      missingInvoiceNumbers: missingInvoices.map((invoice: any) => invoice['Fatura No']),
      summary: {
        totalExcelRows: testInvoices.length,
        totalLogoInvoices: existingInvoices.length,
        missingInvoices: missingInvoices.length,
        processedAt: new Date().toLocaleString('tr-TR'),
        firmaNo,
        donemNo,
        logoDb,
        companyRef
      },
      message: `Test: ${testInvoices.length} fatura bulundu. LOGO'da ${existingInvoices.length} fatura mevcut. ${missingInvoices.length} fatura LOGO'da bulunamadı.`
    };
    
    console.log('✅ Test tamamlandı:', result);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Test hatası:', error);
    return NextResponse.json(
      { error: 'Test sırasında hata oluştu' },
      { status: 500 }
    );
  }
}

// LOGO'da fatura kontrolü - şimdi tutarları da kontrol edecek
async function checkInvoicesInLogo(faturaNumbers: string[], firmaNo: string, donemNo: string, logoDb: string, companyRef: string): Promise<any[]> {
  try {
    if (faturaNumbers.length === 0) {
      console.log('⚠️ Fatura numarası bulunamadı');
      return [];
    }

    // Fatura numaralarını SQL için hazırla
    const faturaList = faturaNumbers.map(fn => `'${fn}'`).join(',');
    
    const sqlQuery = `
      SELECT 
        FICHENO as fatura_no,
        NETTOTAL as toplam_tutar,
        TOTALVAT as kdv_toplami
      FROM [${logoDb}]..LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_INVOICE 
      WHERE TRCODE IN (1,2,3,4) 
        AND FICHENO IN (${faturaList})
    `;

    console.log('🔍 LOGO sorgusu:', sqlQuery);
    console.log('🔐 === PROXY İSTEĞİ DETAYLARI ===');
    console.log('📍 Company Ref:', companyRef);
    console.log('🏭 Firma No:', firmaNo);
    console.log('📅 Dönem No:', donemNo);
    console.log('🗄️ Logo DB:', logoDb);
    console.log('🔗 Proxy URL:', 'https://api.btrapor.com/proxy');
    console.log('🔐 Connection Type:', 'first_db_key');
    console.log('⏱️ Timeout:', '120000ms (2 dakika)');
    console.log('📊 Fatura sayısı:', faturaNumbers.length);
    console.log('================================');

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
    
    const logoInvoices = result.results || result.data || [];
    console.log('🔍 LOGO ham veriler (ilk 3 kayıt):', logoInvoices.slice(0, 3));
    
    // LOGO'dan gelen fatura bilgilerini döndür (fatura_no, toplam_tutar, kdv_toplami ile)
    const processedInvoices = logoInvoices.map((row: any, index: number) => {
      const processed = {
        fatura_no: row.fatura_no || row.FATURA_NO,
        toplam_tutar: parseFloat(row.toplam_tutar || row.TOPLAM_TUTAR || 0),
        kdv_toplami: parseFloat(row.kdv_toplami || row.KDV_TOPLAMI || 0)
      };
      
      // İlk 3 kaydı detaylı log'la
      if (index < 3) {
        console.log(`🔍 LOGO ${index + 1}. kayıt:`, {
          ham: row,
          islenmis: processed,
          tutar_ham: row.toplam_tutar || row.TOPLAM_TUTAR,
          kdv_ham: row.kdv_toplami || row.KDV_TOPLAMI
        });
      }
      
      return processed;
    });
    
    return processedInvoices;

  } catch (error) {
    console.error('❌ LOGO kontrol hatası:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Excel karşılaştırma API başlatıldı');
    
    // Test modu kontrolü
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const testData = await request.json();
      if (testData.test) {
        console.log('🧪 Test modu aktif');
        return handleTestMode(testData);
      }
    }
    
    const formData = await request.formData();
    const excelFile = formData.get('file') as File;
    
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
      'Vergi Hariç Tutar', 'KDV Toplamı', 'Fatura Tarihi', 'Oluşturma Tarihi', 'Gönderici Adı', 'Tür'
    ];

    // Uygulama Yanıtı kolonu var mı kontrol et
    const hasApColumn = headers.includes('Uygulama Yanıtı') || headers.includes('ap');

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
      olusturmaTarihi: headers.indexOf('Oluşturma Tarihi'),
      gondericiAdi: headers.indexOf('Gönderici Adı'),
      tur: headers.indexOf('Tür'),
      uygulamaYaniti: hasApColumn ? (headers.indexOf('Uygulama Yanıtı') !== -1 ? headers.indexOf('Uygulama Yanıtı') : headers.indexOf('ap')) : -1
    };

    // Frontend'den gelen localStorage değerlerini al
    const companyRef = request.headers.get('company-ref') || '2';
    
    // Firma bilgilerini frontend'den al
    let firmaNo = request.headers.get('firma-no') || '009'; // localStorage'dan gelen
    let donemNo = request.headers.get('donem-no') || '01';  // localStorage'dan gelen
    let logoDb = request.headers.get('logo-db') || 'LOGODB'; // localStorage'dan gelen
    
    // Firma no'yu 3 haneli yap
    firmaNo = firmaNo.padStart(3, '0');
    
    // Dönem no'yu 2 haneli yap
    donemNo = donemNo.padStart(2, '0');
    
    console.log('📊 Excel\'den', jsonData.length - 1, 'satır okundu');
    
    // DB ayarlarını detaylı olarak konsola yazdır
    console.log('🏢 === VERİTABANI AYARLARI (LOCALSTORAGE) ===');
    console.log('📍 Company Ref:', companyRef, '(localStorage: company_ref)');
    console.log('🏭 Firma No:', firmaNo, '(localStorage: first_firma_no)');
    console.log('📅 Dönem No:', donemNo, '(localStorage: first_donem_no)');
    console.log('🗄️ Logo DB:', logoDb, '(localStorage: first_db_name)');
    console.log('🔗 Proxy URL:', 'https://api.btrapor.com/proxy');
    console.log('🔐 Connection Type:', 'first_db_key');
    console.log('⏱️ Timeout:', '120000ms (2 dakika)');
    console.log('🔄 Max Retries:', '3');
    console.log('📏 Max Response Size:', '100MB');
    console.log('================================');
    
    // Excel'den fatura numaralarını çıkar
    const faturaNumbers: string[] = [];
    const excelRows: any[] = [];
    let rejectedCount = 0; // "red" olan faturaları say
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const faturaNo = String(row[columnIndexes.faturaNo] || '');
      if (!faturaNo || faturaNo.trim() === '') continue;

      // Uygulama Yanıtı kontrolü - "red" olanları karşılaştırmaya dahil etme
      if (hasApColumn && columnIndexes.uygulamaYaniti !== -1) {
        const uygulamaYaniti = String(row[columnIndexes.uygulamaYaniti] || '').toLowerCase().trim();
        if (uygulamaYaniti === 'red') {
          rejectedCount++;
          console.log(`🚫 Fatura ${faturaNo} "red" olduğu için karşılaştırmaya dahil edilmiyor`);
          continue; // Bu faturayı karşılaştırmaya dahil etme
        }
      }

      faturaNumbers.push(faturaNo);
      excelRows.push({
        faturaNo,
        toplamTutar: parseFloat(row[columnIndexes.toplamTutar] || 0),
        kdvToplami: parseFloat(row[columnIndexes.kdvToplami] || 0),
        row,
        columnIndexes
      });
    }

    console.log('🔍 LOGO\'da', faturaNumbers.length, 'fatura numarası aranıyor...');
    console.log('🔍 Excel verilerinden örnekler (ilk 3 kayıt):');
    excelRows.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. Excel kaydı:`, {
        faturaNo: item.faturaNo,
        toplamTutar: item.toplamTutar,
        kdvToplami: item.kdvToplami,
        toplamTutar_ham: item.row[item.columnIndexes.toplamTutar],
        kdvToplami_ham: item.row[item.columnIndexes.kdvToplami],
        toplamTutar_tipi: typeof item.toplamTutar,
        kdvToplami_tipi: typeof item.kdvToplami
      });
    });

    if (rejectedCount > 0) {
      console.log(`🚫 ${rejectedCount} fatura "red" (ret) olduğu için karşılaştırmaya dahil edilmedi`);
    }

    if (faturaNumbers.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalExcelRows: jsonData.length - 1,
          totalLogoInvoices: 0,
          missingInvoices: 0,
          mismatchedInvoices: 0,
          rejectedInvoices: rejectedCount,
          processedAt: new Date().toLocaleString('tr-TR')
        },
        missingInvoices: [],
        mismatchedInvoices: [],
        message: rejectedCount > 0 
          ? `Excel dosyasında ${jsonData.length - 1} fatura bulundu. ${rejectedCount} fatura "ret" olduğu için karşılaştırmaya dahil edilmedi. Geçerli fatura numarası bulunamadı.`
          : 'Excel dosyasında geçerli fatura numarası bulunamadı.'
      });
    }

    // LOGO'da mevcut faturaları kontrol et (artık tutarlarla birlikte)
    const logoInvoices = await checkInvoicesInLogo(faturaNumbers, firmaNo, donemNo, logoDb, companyRef);
    
    console.log('✅ LOGO\'da bulunan faturalar:', logoInvoices.length);

    // Eksik faturaları ve uyumsuz faturaları bul
    const missingInvoices: MissingInvoice[] = [];
    const mismatchedInvoices: any[] = [];
    let exactMatches = 0;
    
    excelRows.forEach(({ faturaNo, toplamTutar, kdvToplami, row, columnIndexes }) => {
      // LOGO'da bu fatura numarası var mı?
      const logoInvoice = logoInvoices.find(li => li.fatura_no === faturaNo);
      
      if (!logoInvoice) {
        // Fatura LOGO'da hiç yok - eksik fatura
        const missingInvoice: MissingInvoice = {
          'Fatura No': faturaNo,
          'Tarih': convertDateFormat(row[columnIndexes.faturaTarihi]),
          'Gönderici VKN': String(row[columnIndexes.gondericiVKN] || ''),
          'Alıcı VKN': String(row[columnIndexes.aliciVKN] || ''),
          'Toplam Tutar': toplamTutar,
          'Vergi Hariç Tutar': parseFloat(row[columnIndexes.vergiHariçTutar] || 0),
          'KDV Toplamı': kdvToplami,
          'Fatura Tarihi': convertDateFormat(row[columnIndexes.faturaTarihi]),
          'Oluşturma Tarihi': convertDateFormat(row[columnIndexes.olusturmaTarihi]),
          'Gönderici Adı': String(row[columnIndexes.gondericiAdi] || ''),
          'Tür': String(row[columnIndexes.tur] || '')
        };
        
        missingInvoices.push(missingInvoice);
      } else {
        // Fatura LOGO'da var, tutarları kontrol et
        const tutarUyumlu = Math.abs(logoInvoice.toplam_tutar - toplamTutar) < 0.001; // 0.1 kuruş tolerans
        const kdvUyumlu = Math.abs(logoInvoice.kdv_toplami - kdvToplami) < 0.001; // 0.1 kuruş tolerans
        
        // Debug için detaylı log
        const tutarFarki = Math.abs(logoInvoice.toplam_tutar - toplamTutar);
        const kdvFarki = Math.abs(logoInvoice.kdv_toplami - kdvToplami);
        
        console.log(`🔍 Fatura ${faturaNo} karşılaştırması:`);
        console.log(`   Excel Tutar: ${toplamTutar} (${typeof toplamTutar}) | LOGO Tutar: ${logoInvoice.toplam_tutar} (${typeof logoInvoice.toplam_tutar}) | Fark: ${tutarFarki}`);
        console.log(`   Excel KDV: ${kdvToplami} (${typeof kdvToplami}) | LOGO KDV: ${logoInvoice.kdv_toplami} (${typeof logoInvoice.kdv_toplami}) | Fark: ${kdvFarki}`);
        console.log(`   Tutar Uyumlu: ${tutarUyumlu} | KDV Uyumlu: ${kdvUyumlu}`);
        console.log(`   Tolerans: 0.001 | Tutar için gerekli: ${tutarFarki < 0.001} | KDV için gerekli: ${kdvFarki < 0.001}`);
        
        if (tutarUyumlu && kdvUyumlu) {
          // Tam uyumlu
          exactMatches++;
          console.log(`✅ Fatura ${faturaNo}: Tam uyumlu`);
        } else {
          // Tutarlar uyumsuz - hatalı fatura
          console.log(`❌ Fatura ${faturaNo}: TUTARSIZ - Tutar farkı: ${tutarFarki}, KDV farkı: ${kdvFarki}`);
          const mismatchedInvoice = {
            'Fatura No': faturaNo,
            'Tarih': convertDateFormat(row[columnIndexes.faturaTarihi]),
            'Gönderici VKN': String(row[columnIndexes.gondericiVKN] || ''),
            'Alıcı VKN': String(row[columnIndexes.aliciVKN] || ''),
            'Excel Toplam Tutar': toplamTutar,
            'LOGO Toplam Tutar': logoInvoice.toplam_tutar,
            'Excel KDV Toplamı': kdvToplami,
            'LOGO KDV Toplamı': logoInvoice.kdv_toplami,
            'Tutar Uyumlu': tutarUyumlu,
            'KDV Uyumlu': kdvUyumlu,
            'Vergi Hariç Tutar': parseFloat(row[columnIndexes.vergiHariçTutar] || 0),
            'Fatura Tarihi': convertDateFormat(row[columnIndexes.faturaTarihi]),
            'Oluşturma Tarihi': convertDateFormat(row[columnIndexes.olusturmaTarihi]),
            'Gönderici Adı': String(row[columnIndexes.gondericiAdi] || ''),
            'Tür': String(row[columnIndexes.tur] || '')
          };
          
          mismatchedInvoices.push(mismatchedInvoice);
          console.log(`❌ Fatura ${faturaNo}: Tutarlar uyumsuz - Excel Tutar: ${toplamTutar}, LOGO Tutar: ${logoInvoice.toplam_tutar}, Excel KDV: ${kdvToplami}, LOGO KDV: ${logoInvoice.kdv_toplami}`);
        }
      }
    });

    console.log(`✅ Tam uyumlu faturalar: ${exactMatches}`);
    console.log(`❌ LOGO'da bulunamayan faturalar: ${missingInvoices.length}`);
    console.log(`⚠️ Tutarları uyumsuz faturalar: ${mismatchedInvoices.length}`);

    const result = {
      success: true,
      totalInvoices: jsonData.length - 1,
      existingInvoices: exactMatches,
      missingInvoices: missingInvoices.length,
      mismatchedInvoices: mismatchedInvoices.length,
      rejectedInvoices: rejectedCount,
      missingInvoiceNumbers: missingInvoices.map(invoice => invoice['Fatura No']),
      mismatchedInvoiceNumbers: mismatchedInvoices.map(invoice => invoice['Fatura No']),
      summary: {
        totalExcelRows: jsonData.length - 1,
        totalLogoInvoices: logoInvoices.length,
        exactMatches: exactMatches,
        missingInvoices: missingInvoices.length,
        mismatchedInvoices: mismatchedInvoices.length,
        rejectedInvoices: rejectedCount,
        processedAt: new Date().toLocaleString('tr-TR'),
        firmaNo,
        donemNo,
        logoDb,
        companyRef
      },
      missingInvoicesDetails: missingInvoices,
      mismatchedInvoicesDetails: mismatchedInvoices,
      message: rejectedCount > 0 
        ? `Excel'de ${jsonData.length - 1} fatura bulundu. ${rejectedCount} fatura "ret" olduğu için karşılaştırmaya dahil edilmedi. ${exactMatches} fatura tam uyumlu, ${missingInvoices.length} fatura LOGO'da bulunamadı, ${mismatchedInvoices.length} fatura tutarları uyumsuz.`
        : `Excel'de ${jsonData.length - 1} fatura bulundu. ${exactMatches} fatura tam uyumlu, ${missingInvoices.length} fatura LOGO'da bulunamadı, ${mismatchedInvoices.length} fatura tutarları uyumsuz.`
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