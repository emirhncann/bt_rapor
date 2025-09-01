import { NextRequest, NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../utils/api';

export async function POST(request: NextRequest) {
  try {
    const { 
      startDate, 
      endDate, 
      selectedTedarikci, 
      connectionInfo, 
      companyRef 
    } = await request.json();

    if (!startDate || !endDate || !connectionInfo || !companyRef) {
      return NextResponse.json(
        { error: 'StartDate, endDate, connectionInfo ve companyRef gerekli' },
        { status: 400 }
      );
    }

    const firmaNo = connectionInfo.first_firma_no || '009';
    const donemNo = connectionInfo.first_donem_no || '01';

    console.log('🔄 Tedarikçi bazlı malzeme sorgusu çalıştırılıyor...', { 
      startDate, 
      endDate, 
      selectedTedarikci, 
      firmaNo, 
      donemNo 
    });

    // Tedarikçi filtresi
    const tedarikciFilter = selectedTedarikci ? `AND C.LOGICALREF = ${selectedTedarikci}` : '';

    const sqlQuery = `
      SELECT 
        C.CODE AS [Tedarikçi Kodu],
        C.DEFINITION_ AS [Tedarikçi Adı],
        I.CODE AS [Malzeme Kodu],
        I.NAME AS [Malzeme Adı],
        SUM(S.AMOUNT) AS [Toplam Miktar],
        SUM(S.LINENET) AS [Toplam Tutar],
        MAX(S.DATE_) AS [Son Alış Tarihi],
        CASE 
          WHEN SUM(S.AMOUNT) > 0 THEN SUM(S.LINENET) / SUM(S.AMOUNT)
          ELSE 0
        END AS [Ortalama Fiyat],
        CASE 
          WHEN MAX(SonAlis.AMOUNT) > 0 THEN MAX(SonAlis.LINENET) / MAX(SonAlis.AMOUNT)
          ELSE 0
        END AS [Son Alış Fiyatı]
      FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_STLINE S
      INNER JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I ON I.LOGICALREF = S.STOCKREF
      INNER JOIN LG_${firmaNo.padStart(3, '0')}_CLCARD C ON C.LOGICALREF = S.CLIENTREF
      OUTER APPLY (
        SELECT TOP 1 S2.AMOUNT, S2.LINENET
        FROM LG_${firmaNo.padStart(3, '0')}_${donemNo.padStart(2, '0')}_STLINE S2
        WHERE S2.STOCKREF = S.STOCKREF 
          AND S2.CLIENTREF = S.CLIENTREF
          AND S2.LINETYPE = 0 
          AND S2.CANCELLED = 0
          AND S2.IOCODE = 1 -- Giriş (Alış)
          AND S2.TRCODE IN (1, 9) -- Satın Alma Faturası, Konsinye Alış
          AND S2.DATE_ BETWEEN '${startDate}' AND '${endDate}'
        ORDER BY S2.DATE_ DESC, S2.FTIME DESC
      ) AS SonAlis
      WHERE S.LINETYPE = 0 
        AND S.CANCELLED = 0
        AND S.IOCODE = 1 -- Giriş (Alış)
        AND S.TRCODE IN (1, 9) -- Satın Alma Faturası, Konsinye Alış
        AND S.DATE_ BETWEEN '${startDate}' AND '${endDate}'
        AND C.CARDTYPE = 1 -- Tedarikçi
        ${tedarikciFilter}
      GROUP BY 
        C.CODE, C.DEFINITION_, I.CODE, I.NAME
      HAVING SUM(S.AMOUNT) > 0 -- Sadece miktar > 0 olanları getir
      ORDER BY 
        C.CODE, SUM(S.LINENET) DESC
    `;

    console.log('🔍 Tedarikçi Bazlı Malzeme SQL Sorgusu:');
    console.log(sqlQuery);
    console.log('📊 Sorgu Parametreleri:', { startDate, endDate, selectedTedarikci, firmaNo, donemNo });

    // Proxy üzerinden SQL sorgusunu çalıştır
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key', // Stok hareketleri için first database kullan
      {
        query: sqlQuery
      },
      'https://api.btrapor.com/proxy',
      300000 // 5 dakika timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Tedarikçi bazlı malzeme sorgu hatası:', response.status, errorText);
      return NextResponse.json(
        { error: `Sorgu hatası: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (result.success || result.status === 'success') {
      console.log('✅ Tedarikçi bazlı malzeme verileri başarıyla çekildi:', result.results?.length || result.data?.length || 0, 'kayıt');
      return NextResponse.json({
        success: true,
        results: result.results || result.data || []
      });
    } else {
      console.error('❌ Tedarikçi bazlı malzeme sorgu sonucu hatası:', result);
      return NextResponse.json(
        { error: result.error || 'Veri çekilemedi' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Tedarikçi bazlı malzeme API hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Cari hesapları çeken ayrı endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyRef = searchParams.get('companyRef');
    const connectionInfoStr = searchParams.get('connectionInfo');

    if (!companyRef || !connectionInfoStr) {
      return NextResponse.json(
        { error: 'CompanyRef ve connectionInfo gerekli' },
        { status: 400 }
      );
    }

    const connectionInfo = JSON.parse(decodeURIComponent(connectionInfoStr));
    const firmaNo = connectionInfo.first_firma_no || '009';

    console.log('🔄 Cari hesaplar (tedarikçiler) sorgusu çalıştırılıyor...', { firmaNo });

         // Tedarikçi cari hesapları özel kodları ile beraber çek
     const sqlQuery = `
       SELECT 
         C.LOGICALREF as logicalRef,
         C.CODE as code,
         C.DEFINITION_ as definition,
         C.SPECODE as specode,
         S1.DEFINITION_ as specodeDefinition,
         C.SPECODE2 as specode2,
         S2.DEFINITION_ as specode2Definition,
         C.SPECODE3 as specode3,
         S3.DEFINITION_ as specode3Definition,
         C.SPECODE4 as specode4,
         S4.DEFINITION_ as specode4Definition,
         C.SPECODE5 as specode5,
         S5.DEFINITION_ as specode5Definition,
       FROM LG_${firmaNo.padStart(3, '0')}_CLCARD C
       LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S1 ON C.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1 AND S1.SPETYP1 = 1
       LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S2 ON C.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1 AND S2.SPETYP2 = 1
       LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S3 ON C.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1 AND S3.SPETYP3 = 1
       LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S4 ON C.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1 AND S4.SPETYP4 = 1
       LEFT JOIN LG_${firmaNo.padStart(3, '0')}_SPECODES S5 ON C.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1 AND S5.SPETYP5 = 1
       WHERE C.ACTIVE = 0 -- Aktif olanlar
       ORDER BY C.CODE
     `;

     console.log('🔍 Cari Hesaplar SQL Sorgusu (GET):');
     console.log(sqlQuery);
     console.log('📊 Bağlantı Bilgileri:', connectionInfo);

    // Proxy üzerinden SQL sorgusunu çalıştır
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key',
      {
        query: sqlQuery
      },
      'https://api.btrapor.com/proxy',
      300000 // 5 dakika timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cari hesaplar sorgu hatası:', response.status, errorText);
      return NextResponse.json(
        { error: `Sorgu hatası: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (result.success || result.status === 'success') {
      console.log('✅ Cari hesaplar başarıyla çekildi:', result.results?.length || result.data?.length || 0, 'kayıt');
      return NextResponse.json({
        success: true,
        results: result.results || result.data || []
      });
    } else {
      console.error('❌ Cari hesaplar sorgu sonucu hatası:', result);
      return NextResponse.json(
        { error: result.error || 'Cari hesaplar çekilemedi' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Cari hesaplar API hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
