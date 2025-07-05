import { NextRequest, NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../utils/api';

export async function POST(request: NextRequest) {
  try {
    const { companyRef, firmaNo } = await request.json();
    
    console.log('📦 Envanter raporu API çağrısı:', { companyRef, firmaNo });
    
    if (!companyRef || !firmaNo) {
      return NextResponse.json(
        { error: 'Gerekli parametreler eksik', details: 'companyRef ve firmaNo gerekli' },
        { status: 400 }
      );
    }

    // Dinamik PIVOT sorgusu - maskeli çalıştırma yöntemi ile
    const sqlQuery = `
      DECLARE @kolonlar NVARCHAR(MAX);
      DECLARE @kolonlarNullsuz NVARCHAR(MAX);
      DECLARE @sql NVARCHAR(MAX);

      -- 1. Pivot kolonları
      SELECT @kolonlar = STUFF(( 
          SELECT DISTINCT ', ' + QUOTENAME(WH.NAME)
          FROM GO3..L_CAPIWHOUSE WH
          WHERE WH.FIRMNR = ${firmaNo}
          FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '');

      -- 2. ISNULL'lu kolonlar
      SELECT @kolonlarNullsuz = STUFF(( 
          SELECT DISTINCT ', ISNULL(' + QUOTENAME(WH.NAME) + ', 0) AS ' + QUOTENAME(WH.NAME)
          FROM GO3..L_CAPIWHOUSE WH
          WHERE WH.FIRMNR = ${firmaNo}
          FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '');

      -- 3. Dinamik sorgu
      SET @sql = '
      SELECT 
        [Malzeme Ref],
        [Durumu],
        [Malzeme Kodu],
        [Malzeme Adı],
        ' + @kolonlarNullsuz + '
      FROM (

        SELECT 
          I.LOGICALREF AS [Malzeme Ref],
          I.ACTIVE AS [Durumu],
          I.CODE AS [Malzeme Kodu],
          I.NAME AS [Malzeme Adı],
          WH.NAME AS [Ambar Adı],
          S.ONHAND
        FROM LV_${firmaNo.padStart(3, '0')}_01_STINVTOT S WITH(NOLOCK)
        LEFT JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK) ON I.LOGICALREF = S.STOCKREF
        LEFT JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK) ON WH.FIRMNR = ${firmaNo} AND WH.NR = S.INVENNO
        WHERE S.INVENNO <> -1

        UNION ALL

        SELECT 
          I.LOGICALREF AS [Malzeme Ref],
          I.ACTIVE AS [Durumu],
          I.CODE AS [Malzeme Kodu],
          I.NAME AS [Malzeme Adı],
          WH.NAME AS [Ambar Adı],
          0 AS ONHAND
        FROM LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK)
        CROSS JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK)
        WHERE WH.FIRMNR = ${firmaNo}
          AND NOT EXISTS (
              SELECT 1
              FROM LV_${firmaNo.padStart(3, '0')}_01_STINVTOT S
              WHERE S.STOCKREF = I.LOGICALREF AND S.INVENNO = WH.NR
          )

      ) AS Kaynak
      PIVOT (
        SUM(ONHAND) FOR [Ambar Adı] IN (' + @kolonlar + ')
      ) AS PivotTablo
      ORDER BY [Malzeme Kodu];';

      -- 4. Düzeltilmiş çalıştırma
      EXEC sp_executesql @sql;
    `;

    console.log('🔍 Envanter raporu SQL sorgusu hazırlanıyor...');
    
    // Büyük envanter raporu için 5 dakika timeout
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key', // Envanter raporu için first database kullan
      {
        query: sqlQuery
      },
      undefined, // Default endpoint kullan
      300000 // 5 dakika timeout (büyük envanter raporu için)
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Envanter raporu API hatası:', errorText);
      return NextResponse.json(
        { error: 'Envanter raporu verisi alınamadı', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Envanter raporu verisi alındı:', data.results?.length || 0, 'kayıt');

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('❌ Envanter raporu API genel hatası:', error);
    return NextResponse.json(
      { error: 'Envanter raporu işlenirken hata oluştu', details: error?.message || 'Bilinmeyen hata' },
      { status: 500 }
    );
  }
} 