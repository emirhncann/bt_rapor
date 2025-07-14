import { NextRequest, NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../utils/api';

export async function POST(request: NextRequest) {
  try {
    const { itemRef, connectionInfo, companyRef, marketModule } = await request.json();

    if (!itemRef || !connectionInfo || !companyRef) {
      return NextResponse.json(
        { error: 'ItemRef, connectionInfo ve companyRef gerekli' },
        { status: 400 }
      );
    }

    const firmaNo = connectionInfo.first_firma_no || '009';
    const donemNo = connectionInfo.first_donem_no || '01';
    const logoKurulumDbName = connectionInfo.logoKurulumDbName || 'GO3';
    const isMarketModule = marketModule === 1;

    console.log('🔄 Envanter detay sorgusu çalıştırılıyor...', { 
      itemRef, 
      firmaNo, 
      donemNo, 
      marketModule, 
      isMarketModule 
    });

    let sqlQuery: string;

    if (isMarketModule) {
      // Market modülü aktif - mevcut sorgu (market fiyatları dahil)
      sqlQuery = `
        DECLARE @ItemRef INT = ${itemRef};

        SELECT 
            I.LOGICALREF AS [Item Ref],
            I.CODE AS [Malzeme Kodu],
            I.NAME AS [Malzeme Adı],
            DIV.NR AS [İşyeri No],
            DIV.NAME AS [İşyeri Adı],

            -- Son Satış Net/Birim
            STR(ISNULL(
                CASE 
                    WHEN Satis.AMOUNT > 0 THEN Satis.LINENET / Satis.AMOUNT
                    WHEN DevirSatis.AMOUNT > 0 THEN DevirSatis.LINENET / DevirSatis.AMOUNT
                    ELSE 0 
                END, 0), 20, 5) AS [Son Satış Net Fiyat],
            STR(ISNULL(ISNULL(Satis.PRICE, DevirSatis.PRICE), 0), 20, 5) AS [Son Satış Birim Fiyat],

            -- Son Alış Net/Birim
            STR(ISNULL(
                CASE 
                    WHEN Alis.AMOUNT > 0 THEN Alis.LINENET / Alis.AMOUNT
                    WHEN DevirAlis.AMOUNT > 0 THEN DevirAlis.LINENET / DevirAlis.AMOUNT
                    ELSE 0
                END, 0), 20, 5) AS [Son Alış Net Fiyat],
            STR(ISNULL(ISNULL(Alis.PRICE, DevirAlis.PRICE), 0), 20, 5) AS [Son Alış Birim Fiyat],

            -- Tanımlı Fiyatlar
            STR(ISNULL(CASE WHEN TanimliSatis.INCVAT = 1 THEN TanimliSatis.PRICE / (1 + I.VAT / 100.0) ELSE TanimliSatis.PRICE END, 0), 20, 5) AS [Tanımlı Satış Net Fiyat],
            STR(ISNULL(CASE WHEN TanimliAlis.INCVAT = 1 THEN TanimliAlis.PRICE / (1 + I.VAT / 100.0) ELSE TanimliAlis.PRICE END, 0), 20, 5) AS [Tanımlı Alış Net Fiyat],

            -- Market Satış (sadece market modülü aktifse)
            STR(ISNULL(Market.BUYPRICE, 0), 20, 2) AS [Market Satış Fiyatı]

        FROM LG_${firmaNo}_ITEMS I
        CROSS JOIN ${logoKurulumDbName}.dbo.L_CAPIDIV DIV

        -- Son Satış (Fatura)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.IOCODE = 4 AND SL.TRCODE NOT IN (2,3,4,10,6)
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS Satis

        -- Son Alış (Fatura)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.IOCODE = 1 AND SL.TRCODE NOT IN (2,3,4,10,6)
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS Alis

        -- Devir Satış (yedek)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.TRCODE = 14 AND SL.IOCODE = 4
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS DevirSatis

        -- Devir Alış (yedek)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.TRCODE = 14 AND SL.IOCODE = 1
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS DevirAlis

        -- Tanımlı Satış Fiyatı
        OUTER APPLY (
            SELECT TOP 1 P.PRICE, P.INCVAT
            FROM LG_${firmaNo}_PRCLIST P
            WHERE P.MTRLTYPE = 0 AND P.PTYPE = 1 AND P.ACTIVE = 0
              AND P.CARDREF = I.LOGICALREF AND P.BRANCH IN (-1, DIV.NR)
            ORDER BY CASE WHEN P.BRANCH = DIV.NR THEN 0 ELSE 1 END, P.CAPIBLOCK_MODIFIEDDATE DESC
        ) AS TanimliSatis

        -- Tanımlı Alış Fiyatı
        OUTER APPLY (
            SELECT TOP 1 P.PRICE, P.INCVAT
            FROM LG_${firmaNo}_PRCLIST P
            WHERE P.MTRLTYPE = 0 AND P.PTYPE = 2 AND P.ACTIVE = 0
              AND P.CARDREF = I.LOGICALREF AND P.BRANCH IN (-1, DIV.NR)
            ORDER BY CASE WHEN P.BRANCH = DIV.NR THEN 0 ELSE 1 END, P.CAPIBLOCK_MODIFIEDDATE DESC
        ) AS TanimliAlis

        -- Market Fiyatı (sadece market modülü aktifse)
        OUTER APPLY (
            SELECT P.BUYPRICE
            FROM LK_${firmaNo}_PRCLIST P
            WHERE P.STREF = I.LOGICALREF AND P.OFFICECODE = DIV.NR
        ) AS Market

        WHERE I.LOGICALREF = ${itemRef} AND DIV.FIRMNR = ${parseInt(firmaNo)}
        ORDER BY DIV.NR;
      `;
    } else {
      // Market modülü pasif - yeni sorgu (market fiyatları olmadan)
      sqlQuery = `
        DECLARE @ItemRef INT = ${itemRef};

        SELECT 
            I.LOGICALREF AS [Item Ref],
            I.CODE AS [Malzeme Kodu],
            I.NAME AS [Malzeme Adı],
            DIV.NR AS [İşyeri No],
            DIV.NAME AS [İşyeri Adı],

            -- Son Satış Net/Birim
            STR(ISNULL(
                CASE 
                    WHEN Satis.AMOUNT > 0 THEN Satis.LINENET / Satis.AMOUNT
                    WHEN DevirSatis.AMOUNT > 0 THEN DevirSatis.LINENET / DevirSatis.AMOUNT
                    ELSE 0 
                END, 0), 20, 5) AS [Son Satış Net Fiyat],
            STR(ISNULL(ISNULL(Satis.PRICE, DevirSatis.PRICE), 0), 20, 5) AS [Son Satış Birim Fiyat],

            -- Son Alış Net/Birim
            STR(ISNULL(
                CASE 
                    WHEN Alis.AMOUNT > 0 THEN Alis.LINENET / Alis.AMOUNT
                    WHEN DevirAlis.AMOUNT > 0 THEN DevirAlis.LINENET / DevirAlis.AMOUNT
                    ELSE 0
                END, 0), 20, 5) AS [Son Alış Net Fiyat],
            STR(ISNULL(ISNULL(Alis.PRICE, DevirAlis.PRICE), 0), 20, 5) AS [Son Alış Birim Fiyat],

            -- Tanımlı Fiyatlar
            STR(ISNULL(CASE WHEN TanimliSatis.INCVAT = 1 THEN TanimliSatis.PRICE / (1 + I.VAT / 100.0) ELSE TanimliSatis.PRICE END, 0), 20, 5) AS [Tanımlı Satış Net Fiyat],
            STR(ISNULL(CASE WHEN TanimliAlis.INCVAT = 1 THEN TanimliAlis.PRICE / (1 + I.VAT / 100.0) ELSE TanimliAlis.PRICE END, 0), 20, 5) AS [Tanımlı Alış Net Fiyat]

        FROM LG_${firmaNo}_ITEMS I
        CROSS JOIN ${logoKurulumDbName}.dbo.L_CAPIDIV DIV

        -- Son Satış (Fatura)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.IOCODE = 4 AND SL.TRCODE NOT IN (2,3,4,10,6)
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS Satis

        -- Son Alış (Fatura)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.IOCODE = 1 AND SL.TRCODE NOT IN (2,3,4,10,6)
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS Alis

        -- Devir Satış (yedek)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.TRCODE = 14 AND SL.IOCODE = 4
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS DevirSatis

        -- Devir Alış (yedek)
        OUTER APPLY (
            SELECT TOP 1 SL.LINENET, SL.AMOUNT, SL.PRICE
            FROM LG_${firmaNo}_${donemNo}_STLINE SL
            INNER JOIN ${logoKurulumDbName}.dbo.L_CAPIWHOUSE WH ON WH.NR = SL.SOURCEINDEX AND WH.FIRMNR = ${parseInt(firmaNo)}
            WHERE SL.STOCKREF = I.LOGICALREF AND SL.LINETYPE = 0 AND SL.CANCELLED = 0
              AND SL.TRCODE = 14 AND SL.IOCODE = 1
              AND WH.DIVISNR = DIV.NR
            ORDER BY SL.DATE_ +dbo.fn_LogoTimetoSystemTime(SL.FTIME) DESC
        ) AS DevirAlis

        -- Tanımlı Satış Fiyatı
        OUTER APPLY (
            SELECT TOP 1 P.PRICE, P.INCVAT
            FROM LG_${firmaNo}_PRCLIST P
            WHERE P.MTRLTYPE = 0 AND P.PTYPE = 1 AND P.ACTIVE = 0
              AND P.CARDREF = I.LOGICALREF AND P.BRANCH IN (-1, DIV.NR)
            ORDER BY CASE WHEN P.BRANCH = DIV.NR THEN 0 ELSE 1 END, P.CAPIBLOCK_MODIFIEDDATE DESC
        ) AS TanimliSatis

        -- Tanımlı Alış Fiyatı
        OUTER APPLY (
            SELECT TOP 1 P.PRICE, P.INCVAT
            FROM LG_${firmaNo}_PRCLIST P
            WHERE P.MTRLTYPE = 0 AND P.PTYPE = 2 AND P.ACTIVE = 0
              AND P.CARDREF = I.LOGICALREF AND P.BRANCH IN (-1, DIV.NR)
            ORDER BY CASE WHEN P.BRANCH = DIV.NR THEN 0 ELSE 1 END, P.CAPIBLOCK_MODIFIEDDATE DESC
        ) AS TanimliAlis

        WHERE I.LOGICALREF = ${itemRef} AND DIV.FIRMNR = ${parseInt(firmaNo)}
        ORDER BY DIV.NR;
      `;
    }

    // Proxy üzerinden SQL sorgusunu çalıştır
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key', // Envanter için first database kullan
      {
        query: sqlQuery
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Envanter detay sorgu hatası:', response.status, errorText);
      return NextResponse.json(
        { error: `Sorgu hatası: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    if (result.success || result.status === 'success') {
      console.log('✅ Envanter detay verileri başarıyla çekildi:', result.data?.length || 0, 'kayıt');
      return NextResponse.json({
        success: true,
        data: result.data || []
      });
    } else {
      console.error('❌ Envanter detay sorgu sonucu hatası:', result);
      return NextResponse.json(
        { error: result.error || 'Veri çekilemedi' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Envanter detay API hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
} 