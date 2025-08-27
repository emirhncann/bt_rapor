import { NextRequest, NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../utils/api';

export async function POST(request: NextRequest) {
  try {
    console.log('🍽️ Yemek Kartları Satış API endpoint çağrıldı');
    
    const body = await request.json();
    const { companyRef, tarih, subeNo } = body;
    
    // Validation
    if (!companyRef) {
      return NextResponse.json({ error: 'CompanyRef gerekli' }, { status: 400 });
    }
    
    if (!tarih) {
      return NextResponse.json({ error: 'Tarih gerekli' }, { status: 400 });
    }

    if (!subeNo) {
      return NextResponse.json({ error: 'Şube No gerekli' }, { status: 400 });
    }

    console.log('📋 Yemek Kartları Satış parametreleri:', { companyRef, tarih, subeNo });

    // ENPOS veritabanı için SQL sorgusu
    const sqlQuery = `
      SELECT DISTINCT
        B.BELGETARIH as Tarih,
        b.Sube_No as 'Şube No',
        RIGHT(D.NAME,LEN(D.NAME)-CHARINDEX('-',D.NAME)) as 'Şube',
        K.Tus_No,
        K.Info as 'Yemek Kartı',
        CAST(SUM(O.TUTAR) AS decimal(18,2)) as Tutar
      FROM INTER_BOS..ODEME O
      JOIN INTER_BOS..BELGE B ON B.Belge_ID=O.Belge_ID
      LEFT JOIN INTER_BOS..[POS_KREDI] K ON O.Tus_No=K.Tus_No
      LEFT JOIN GO3..L_CAPIDIV D ON B.Sube_No=D.NR AND D.FIRMNR=9
      WHERE B.Iptal=0 
        AND O.Tus_No > 5 
        AND BELGETARIH='${tarih}' 
        AND B.Sube_No=${subeNo}
      GROUP BY 
        B.BELGETARIH,
        b.Sube_No,
        D.NAME,
        K.Tus_No,
        K.Info
      ORDER BY B.BELGETARIH, b.Sube_No, K.Tus_No
    `;

    console.log('🔍 Yemek Kartları SQL Sorgusu:', sqlQuery);

    // ENPOS veritabanı için proxy request
    const response = await sendSecureProxyRequest(
      companyRef,
      'enpos_db_key', // ENPOS veritabanı için özel connection type
      {
        query: sqlQuery
      },
      'https://api.btrapor.com/proxy',
      120000 // 2 dakika timeout
    );

    // Response kontrolü
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Yemek Kartları Satış API hatası:', errorText);
      
      return NextResponse.json({
        error: 'Veri alınırken hata oluştu',
        details: errorText
      }, { status: response.status });
    }

    const result = await response.json();
    
    // Veri formatını kontrol et
    let data = [];
    if (result.results && Array.isArray(result.results)) {
      data = result.results;
    } else if (result.data && Array.isArray(result.data)) {
      data = result.data;
    } else if (Array.isArray(result)) {
      data = result;
    }

    console.log('✅ Yemek Kartları Satış verileri başarıyla alındı:', data.length, 'kayıt');

    return NextResponse.json({
      success: true,
      data: data,
      count: data.length,
      message: `${data.length} yemek kartı satış kaydı bulundu`
    });

  } catch (error: any) {
    console.error('❌ Yemek Kartları Satış API genel hatası:', error);
    
    return NextResponse.json({
      error: 'Sunucu hatası',
      message: error.message || 'Bilinmeyen hata oluştu'
    }, { status: 500 });
  }
}



// GET metodu da ekleyelim - test amaçlı
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Yemek Kartları Satış API endpoint\'i aktif',
    method: 'POST bekleniyor',
    parameters: {
      companyRef: 'string (gerekli)',
      tarih: 'string (YYYY-MM-DD format, gerekli)',
      subeNo: 'number (gerekli)'
    }
  });
}
