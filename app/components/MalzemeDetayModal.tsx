'use client';

import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { sendSecureProxyRequest } from '../utils/api';

interface MalzemeDetay {
  'İşyeri No': number;
  'İşyeri Adı': string;
  'Ambar No': number;
  'Ambar Adı': string;
  'Stok Miktarı': number;
  'Aktif Satış Fiyatı': number;
  'Fiyat Kaynağı': string;
  'Son Fiyat Değişim Tarihi': string;
  'Devir Miktarı': number;
  'Ambar Transfer Giriş Miktarı': number;
  'Son Alış Tarihi': string;
  'Son Alış Birim Fiyatı': number;
  'Son Alış Miktarı': number;
  'Son Satış Tarihi': string;
  'Son Satış Birim Fiyatı': number;
  'Dönem İçi Son Alım Tarihi': string;
  'Dönem İçi Son Alım Fiyatı': number;
  'Dönem İçi Son Alım Miktarı': number;
  'Son Satış Tarihi (Tarih Aralığı)': string;
  'Dönem İçi Son Satış Fiyatı': number;
  'Dönem İçi Satış Toplamı': number;
}

interface MalzemeDetayModalProps {
  isOpen: boolean;
  onClose: () => void;
  malzemeKodu: string;
  malzemeAdi: string;
  itemRef: string;
  clientRef: string;
  startDate: string;
  endDate: string;
}

export default function MalzemeDetayModal({
  isOpen,
  onClose,
  malzemeKodu,
  malzemeAdi,
  itemRef,
  clientRef,
  startDate,
  endDate
}: MalzemeDetayModalProps) {
  const [data, setData] = useState<MalzemeDetay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationData, setAnimationData] = useState<any>(null);
  const [spCreated, setSpCreated] = useState(false);

  // Animation data'yı yükle
  useEffect(() => {
    import('../../public/animations/loading.json').then((data) => {
      setAnimationData(data.default);
    }).catch((err) => {
      console.error("Animasyon dosyası yüklenemedi:", err);
    });
  }, []);

  // Cache'i temizleme fonksiyonu
  const clearCacheAndReload = () => {
    const spCacheKey = `sp_MalzemeDetayByItem2_${sessionStorage.getItem('companyRef')}`;
    sessionStorage.removeItem(spCacheKey);
    console.log('🗑️ Cache temizlendi, yeni veri getiriliyor...');
    setSpCreated(false);
    checkAndCreateStoredProcedure();
  };

  // Modal açıldığında veriyi getir
  useEffect(() => {
    if (isOpen && itemRef) {
      // Stored procedure kontrolünü localStorage'da cache'le
      const spCacheKey = `sp_MalzemeDetayByItem2_${sessionStorage.getItem('companyRef')}`;
      const spExists = sessionStorage.getItem(spCacheKey) === 'true';
      
      if (spExists) {
        console.log('✅ Stored procedure cache\'den mevcut, direkt veri getiriliyor...');
        setSpCreated(true);
        fetchMalzemeDetay();
      } else {
        console.log('🔍 Stored procedure kontrol ediliyor...');
        checkAndCreateStoredProcedure();
      }
    } else if (!isOpen) {
      // Modal kapandığında state'leri temizle
      setData([]);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, itemRef]);

  const checkAndCreateStoredProcedure = async () => {
    setLoading(true);
    setError(null);

    try {
      const companyRef = sessionStorage.getItem('companyRef') || 'btRapor_2024';

      // Önce stored procedure'ın mevcut olup olmadığını kontrol et
      const checkSpQuery = `
        SELECT COUNT(*) as SPCount 
        FROM sys.objects 
        WHERE object_id = OBJECT_ID(N'dbo.sp_MalzemeDetayByItem2') 
        AND type in (N'P', N'PC')
      `;

      console.log('🔍 Stored procedure kontrol ediliyor...');
      const checkResponse = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: checkSpQuery },
        'https://api.btrapor.com/proxy',
        10000 // 10 saniye timeout
      );

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        const spExists = checkResult.data && checkResult.data.length > 0 && checkResult.data[0].SPCount > 0;
        
        if (spExists) {
          console.log('✅ Stored procedure zaten mevcut, direkt veri getiriliyor...');
          setSpCreated(true);
          // Cache'i güncelle
          const spCacheKey = `sp_MalzemeDetayByItem2_${sessionStorage.getItem('companyRef')}`;
          sessionStorage.setItem(spCacheKey, 'true');
          await fetchMalzemeDetay();
        } else {
          console.log('🔧 Stored procedure mevcut değil, oluşturuluyor...');
          await createStoredProcedure();
        }
      } else {
        console.log('⚠️ Stored procedure kontrolü başarısız, oluşturuluyor...');
        await createStoredProcedure();
      }
    } catch (err) {
      console.error('Stored procedure kontrol hatası:', err);
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      setLoading(false);
    }
  };

                   const createStoredProcedure = async () => {
      // Loading state zaten checkAndCreateStoredProcedure tarafından yönetiliyor

      try {
        const companyRef = sessionStorage.getItem('companyRef') || 'btRapor_2024';

                 // Önce IdList user-defined table type'ını oluştur (eğer yoksa)
         try {
           const createIdListQuery = `
             IF NOT EXISTS (SELECT * FROM sys.types WHERE name = 'IdList' AND is_user_defined = 1)
             BEGIN
               CREATE TYPE dbo.IdList AS TABLE
               (
                 ID INT NOT NULL PRIMARY KEY
               );
             END
           `;

           console.log('🔧 IdList Type oluşturuluyor (eğer yoksa):');
           console.log('='.repeat(80));
           console.log(createIdListQuery);
           console.log('='.repeat(80));

           const createIdListResponse = await sendSecureProxyRequest(
             companyRef,
             'first_db_key',
             { query: createIdListQuery },
             'https://api.btrapor.com/proxy',
             600000 // 10 dakika timeout
           );

           if (createIdListResponse.ok) {
             console.log('✅ IdList Type başarılı');
           } else {
             console.log('⚠️ IdList Type hatası (devam ediliyor):', createIdListResponse.status);
           }
         } catch (idListError) {
           console.log('⚠️ IdList Type hatası (devam ediliyor):', idListError);
         }

         // DROP PROCEDURE hatası olursa devam et (zaten mevcut olmayabilir)
         try {
           const dropSpQuery = `
             IF OBJECT_ID('dbo.sp_MalzemeDetayByItem2','P') IS NOT NULL
               DROP PROCEDURE dbo.sp_MalzemeDetayByItem2;
           `;

          console.log('🔧 DROP PROCEDURE deneniyor (mevcut değilse hata normal):');
          console.log('='.repeat(80));
          console.log(dropSpQuery);
          console.log('='.repeat(80));

          const dropResponse = await sendSecureProxyRequest(
            companyRef,
            'first_db_key',
            { query: dropSpQuery },
            'https://api.btrapor.com/proxy',
            600000 // 10 dakika timeout
          );

          if (dropResponse.ok) {
            const dropResult = await dropResponse.json();
            console.log('✅ DROP PROCEDURE başarılı:', dropResult);
          } else {
            console.log('⚠️ DROP PROCEDURE hatası (normal, zaten mevcut değil):', dropResponse.status);
          }
        } catch (dropError) {
          console.log('⚠️ DROP PROCEDURE hatası (devam ediliyor):', dropError);
        }

        // İkinci sorgu: CREATE PROCEDURE (Yeni Optimized Version)
        const createSpQuery = `


CREATE PROCEDURE dbo.sp_MalzemeDetayByItem22
    @Firm              INT,
    @Period            INT,
    @ItemRef           INT,
    @DateFrom          DATE,
    @DateTo            DATE,
    @WarehouseList     dbo.IdList READONLY,  -- NR listesi (boş=tümü)
    @HasMarketModule   BIT,                  -- 1: sadece LK; 0: sadece LG
    @GoDb              SYSNAME = NULL,       -- GO tabloları DB (örn. GO3); NULL/'' = current DB
    @GoSchema          SYSNAME = N'dbo',     -- GO tabloları şema
    @ClientRef         INT                   -- alış tedarikçi filtresi
AS
BEGIN
    SET NOCOUNT ON;

    -- (İsteğe bağlı) SSMS≠Web plan farklarını azalt
    SET ARITHABORT ON;
    SET ANSI_WARNINGS ON;
    SET CONCAT_NULL_YIELDS_NULL ON;
    SET QUOTED_IDENTIFIER ON;
    SET ANSI_PADDING ON;
    SET NUMERIC_ROUNDABORT OFF;

    ------------------------------------------------------------
    -- 0) Firma/Dönem ve tablo adları
    ------------------------------------------------------------
    DECLARE @F3 VARCHAR(3) = RIGHT('000' + CAST(@Firm AS VARCHAR(3)), 3);
    DECLARE @P2 VARCHAR(2) = RIGHT('00' + CAST(@Period AS VARCHAR(2)), 2);

    DECLARE @T_STLINE_NAME   NVARCHAR(300) = N'LG_' + @F3 + N'_' + @P2 + N'_STLINE';
    DECLARE @T_LKPLC_NAME    NVARCHAR(300) = N'LK_' + @F3 + N'_PRCLIST';
    DECLARE @T_LKDIV_NAME    NVARCHAR(300) = N'LK_' + @F3 + N'_CAPIDIVPARAMS';
    DECLARE @T_LGPLC_NAME    NVARCHAR(300) = N'LG_' + @F3 + N'_PRCLIST';
    DECLARE @T_STINVTOT_LV   NVARCHAR(300) = N'LV_' + @F3 + N'_' + @P2 + N'_STINVTOT';
    DECLARE @T_STINVTOT_TBL  NVARCHAR(300) = N'LG_' + @F3 + N'_' + @P2 + N'_STINVTOT';

    DECLARE @T_STLINE_FQN   NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_STLINE_NAME);
    DECLARE @T_LKPLC_FQN    NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_LKPLC_NAME);
    DECLARE @T_LGPLC_FQN    NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_LGPLC_NAME);
    DECLARE @T_LKDIV_FQN    NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_LKDIV_NAME);

    DECLARE @T_STINVTOT_FQN NVARCHAR(400);
    IF OBJECT_ID(N'dbo.' + QUOTENAME(@T_STINVTOT_LV)) IS NOT NULL
        SET @T_STINVTOT_FQN = N'[dbo].' + QUOTENAME(@T_STINVTOT_LV);
    ELSE
        SET @T_STINVTOT_FQN = N'[dbo].' + QUOTENAME(@T_STINVTOT_TBL);

    ------------------------------------------------------------
    -- 1) GO tabloları (başka DB’de olabilir) - fully qualified
    ------------------------------------------------------------
    DECLARE @DbPrefix NVARCHAR(260);
    DECLARE @SchPrefix NVARCHAR(130);
    DECLARE @WH_FQN NVARCHAR(512);
    DECLARE @DIV_FQN NVARCHAR(512);

    SET @DbPrefix  = CASE WHEN @GoDb IS NULL OR LTRIM(RTRIM(@GoDb)) = '' THEN N'' ELSE QUOTENAME(@GoDb) + N'.' END;
    SET @SchPrefix = QUOTENAME(@GoSchema) + N'.';
    SET @WH_FQN    = @DbPrefix + @SchPrefix + QUOTENAME(N'L_CAPIWHOUSE');
    SET @DIV_FQN   = @DbPrefix + @SchPrefix + QUOTENAME(N'L_CAPIDIV');

    ------------------------------------------------------------
    -- 2) Ambar kolon/ifadeleri
    ------------------------------------------------------------
    DECLARE @WhExpr_STLINE       NVARCHAR(100) = N'S.[SOURCEINDEX]';
    DECLARE @WhExpr_STLINE_Dest  NVARCHAR(100) = N'S.[DESTINDEX]';
    DECLARE @WhExpr_STINVTOT     NVARCHAR(120) = N'T.[INVENNO]';

    ------------------------------------------------------------
    -- 3) Fiyat kaynak blokları (seçim: sadece LK veya sadece LG)
    ------------------------------------------------------------
    DECLARE @priceApply NVARCHAR(MAX);
    DECLARE @priceExpr  NVARCHAR(MAX);
    DECLARE @srcExpr    NVARCHAR(MAX);
    DECLARE @chgExpr    NVARCHAR(MAX);
    DECLARE @divJoin    NVARCHAR(MAX) = N'';

    IF @HasMarketModule = 1
    BEGIN
        -- Sadece LK; yoksa NULL (LG fallback YOK)
        IF OBJECT_ID(N'dbo.' + QUOTENAME(@T_LKPLC_NAME)) IS NOT NULL
            SET @priceApply = N'
        OUTER APPLY (
            SELECT TOP (1)
                   CAST(P.BUYPRICE AS DECIMAL(19,4)) AS BUYPRICE,
                   CAST(P.CHANGEDATE AS DATETIME)    AS CHANGEDATE
            FROM ' + @T_LKPLC_FQN + N' P WITH (NOLOCK)
            WHERE P.STREF = @ItemRef
              AND P.OFFICECODE = WD.DivNr
            ORDER BY P.LOGICALREF DESC
        ) AS LKP';
        ELSE
            SET @priceApply = N'
        OUTER APPLY (SELECT CAST(NULL AS DECIMAL(19,4)) AS BUYPRICE,
                            CAST(NULL AS DATETIME)      AS CHANGEDATE) AS LKP';

        SET @priceExpr = N'
            CAST(CASE WHEN LKP.BUYPRICE IS NOT NULL THEN LKP.BUYPRICE ELSE 0 END AS DECIMAL(19,4)) AS [Aktif Satış Fiyatı]';
        SET @srcExpr   = N'
            CASE WHEN LKP.BUYPRICE IS NOT NULL THEN ''Market(Kalem)'' ELSE ''tanımlı fiyat yok'' END AS [Fiyat Kaynağı]';
        SET @chgExpr   = N'
            LKP.CHANGEDATE AS [Son Fiyat Değişim Tarihi]';

        -- Market parametre tablosu varsa join
        IF OBJECT_ID(N'dbo.' + QUOTENAME(@T_LKDIV_NAME)) IS NOT NULL
            SET @divJoin = N'
JOIN ' + @T_LKDIV_FQN + N' CD WITH (NOLOCK)
  ON CD._INDEX = 1
 AND CD._VALUE = CONVERT(VARCHAR(32), WD.DivNr)';
    END
    ELSE
    BEGIN
        -- Sadece LG
        IF OBJECT_ID(N'dbo.' + QUOTENAME(@T_LGPLC_NAME)) IS NOT NULL
            SET @priceApply = N'
        OUTER APPLY (
            SELECT TOP (1)
                   CAST(P.PRICE AS DECIMAL(19,4)) AS PRICE,
                   CAST(COALESCE(P.CAPIBLOCK_MODIFIEDDATE, P.CAPIBLOCK_CREADEDDATE) AS DATETIME) AS CHANGEDATE
            FROM ' + @T_LGPLC_FQN + N' P WITH (NOLOCK)
            WHERE P.CARDREF = @ItemRef
              AND P.ACTIVE  = 0
            ORDER BY P.LOGICALREF DESC
        ) AS LGO';
        ELSE
            SET @priceApply = N'
        OUTER APPLY (SELECT CAST(NULL AS DECIMAL(19,4)) AS PRICE,
                            CAST(NULL AS DATETIME)      AS CHANGEDATE) AS LGO';

        SET @priceExpr = N'
            CAST(CASE WHEN LGO.PRICE IS NOT NULL THEN LGO.PRICE ELSE 0 END AS DECIMAL(19,4)) AS [Aktif Satış Fiyatı]';
        SET @srcExpr   = N'
            CASE WHEN LGO.PRICE IS NOT NULL THEN ''Logo'' ELSE ''tanımlı fiyat yok'' END AS [Fiyat Kaynağı]';
        SET @chgExpr   = N'
            LGO.CHANGEDATE AS [Son Fiyat Değişim Tarihi]';
    END

    ------------------------------------------------------------
    -- 4) WhFilter JOIN kararı
    ------------------------------------------------------------
    DECLARE @WhJoin NVARCHAR(200);
    IF EXISTS (SELECT 1 FROM @WarehouseList)
        SET @WhJoin = N' INNER JOIN WhFilter F ON F.NR = W.NR ';
    ELSE
        SET @WhJoin = N'';

    ------------------------------------------------------------
    -- 5) Dinamik SQL
    ------------------------------------------------------------
    DECLARE @sql NVARCHAR(MAX);

    SET @sql = N'
DECLARE @DateToPlus1 DATE = DATEADD(DAY,1,@DateTo);

;WITH WhFilter AS (
    SELECT ID AS NR FROM @WarehouseList
),
Wh AS (
    SELECT W.NR, W.NAME, W.DIVISNR
    FROM ' + @WH_FQN + N' W WITH (NOLOCK)
    ' + @WhJoin + N'
    WHERE W.FIRMNR = @Firm
),
Divs AS (
    SELECT D.NR, D.NAME
    FROM ' + @DIV_FQN + N' D WITH (NOLOCK)
    WHERE D.FIRMNR = @Firm
),
WhDiv AS (
    SELECT W.NR AS WhNr, W.NAME AS WhName, D.NR AS DivNr, D.NAME AS DivName
    FROM Wh W
    LEFT JOIN Divs D ON D.NR = W.DIVISNR
),
OnHand AS (
    SELECT ' + @WhExpr_STINVTOT + N' AS WhNr,
           SUM(CAST(T.ONHAND AS NUMERIC(19,4))) AS OnHandQty
    FROM ' + @T_STINVTOT_FQN + N' T WITH (NOLOCK)
    WHERE T.STOCKREF = @ItemRef
    GROUP BY ' + @WhExpr_STINVTOT + N'
)
SELECT
    WD.DivNr                             AS [İşyeri No],
    WD.DivName                           AS [İşyeri Adı],
    WD.WhNr                              AS [Ambar No],
    WD.WhName                            AS [Ambar Adı],
    ISNULL(O.OnHandQty,0)                AS [Stok Miktarı],
    ' + @priceExpr + N',
    ' + @srcExpr   + N',
    ' + @chgExpr   + N',
    Devir.DevirTotal                     AS [Devir Miktarı],
    Transfer.TransferTotal               AS [Ambar Transfer Giriş Miktarı],
    LBL.DATE_                            AS [Son Alış Tarihi],
    LBL.PRICE                            AS [Son Alış Birim Fiyatı],
    LBL.AMOUNT                           AS [Son Alış Miktarı],

    LSL.DATE_                            AS [Son Satış Tarihi],
    LSL.PRICE                            AS [Son Satış Birim Fiyatı],
    
    RBL.DATE_                            AS [Dönem İçi Son Alım Tarihi],
    RBL.PRICE                            AS [Dönem İçi Son Alım Fiyatı],
    RBT.BuyTotal                         AS [Dönem İçi Son Alım Miktarı],

    RSL.DATE_                            AS [Son Satış Tarihi (Tarih Aralığı)],
    RSL.PRICE                            AS [Dönem İçi Son Satış Fiyatı],
    RST.SaleTotal                        AS [Dönem İçi Satış Toplamı]
FROM WhDiv WD
LEFT JOIN OnHand O ON O.WhNr = WD.WhNr
' + @divJoin + N'

-- SON ALIŞ (global)
OUTER APPLY (
    SELECT TOP (1) S.DATE_, S.PRICE, S.AMOUNT, S.LINENET
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.STOCKREF=@ItemRef AND S.CLIENTREF=@ClientRef AND S.LINETYPE=0 AND S.IOCODE=1 AND S.TRCODE=1
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
    ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
) AS LBL

-- SON SATIŞ (global)
OUTER APPLY (
    SELECT TOP (1) S.DATE_, S.PRICE, S.AMOUNT, S.LINENET
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=4 AND S.TRCODE IN(7,8)
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
    ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
) AS LSL

-- SON ALIŞ (Aralık İçi)
OUTER APPLY (
    SELECT TOP (1) S.DATE_, S.PRICE
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.STOCKREF=@ItemRef 
      AND S.CLIENTREF=@ClientRef 
      AND S.LINETYPE=0 
      AND S.IOCODE=1 
      AND S.TRCODE=1
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
      AND S.DATE_>=@DateFrom AND S.DATE_<@DateToPlus1
    ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
) AS RBL

-- ALIŞ TOPLAMI (Aralık İçi)
OUTER APPLY (
    SELECT SUM(S.AMOUNT) AS BuyTotal
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.LINETYPE = 0
      AND S.CLIENTREF=@ClientRef
      AND S.IOCODE   = 1
      AND S.TRCODE   = 1
      AND S.STOCKREF = @ItemRef
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
      AND S.DATE_   >= @DateFrom
      AND S.DATE_   <  @DateToPlus1
) AS RBT

-- DEVİR (Aralık İçi)
OUTER APPLY (
    SELECT SUM(S.AMOUNT) AS DevirTotal
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.LINETYPE = 0
      AND S.IOCODE   = 1
      AND S.TRCODE   = 14
      AND S.STOCKREF = @ItemRef
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
      AND S.DATE_   >= @DateFrom
      AND S.DATE_   <  @DateToPlus1
) AS Devir

-- AMBAR TRANSFER GİRİŞ (Aralık İçi)  >>> IOCODE=3 ve DESTINDEX ile
OUTER APPLY (
    SELECT SUM(S.AMOUNT) AS TransferTotal
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.LINETYPE = 0
      AND S.IOCODE   = 3
      AND S.TRCODE   = 25
      AND S.STOCKREF = @ItemRef
      AND ' + @WhExpr_STLINE_Dest + N' = WD.WhNr
      AND S.DATE_   >= @DateFrom
      AND S.DATE_   <  @DateToPlus1
) AS Transfer

-- SON SATIŞ (Aralık İçi)
OUTER APPLY (
    SELECT TOP (1) S.DATE_, S.PRICE
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=4 AND S.TRCODE IN(7,8)
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
      AND S.DATE_>=@DateFrom AND S.DATE_<@DateToPlus1
    ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
) AS RSL

-- SATIŞ TOPLAMI (Aralık İçi)
OUTER APPLY (
    SELECT SUM(S.AMOUNT) AS SaleTotal
    FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
    WHERE S.LINETYPE = 0
      AND S.IOCODE   = 4
      AND S.TRCODE   IN (7,8)
      AND S.STOCKREF = @ItemRef
      AND ' + @WhExpr_STLINE + N' = WD.WhNr
      AND S.DATE_   >= @DateFrom
      AND S.DATE_   <  @DateToPlus1
) AS RST

' + @priceApply + N'
ORDER BY WD.DivNr, WD.WhNr
OPTION (OPTIMIZE FOR UNKNOWN, RECOMPILE);';

    EXEC sp_executesql 
        @sql,
        N'@Firm INT, @ItemRef INT, @DateFrom DATE, @DateTo DATE, @WarehouseList dbo.IdList READONLY, @ClientRef INT',
        @Firm=@Firm, @ItemRef=@ItemRef, @DateFrom=@DateFrom, @DateTo=@DateTo, @WarehouseList=@WarehouseList, @ClientRef=@ClientRef;
END

        `;

                         console.log('🔧 CREATE PROCEDURE başlıyor:');
         console.log('='.repeat(80));
         console.log(createSpQuery);
         console.log('='.repeat(80));

        const createResponse = await sendSecureProxyRequest(
          companyRef,
          'first_db_key',
          { query: createSpQuery },
          'https://api.btrapor.com/proxy',
          600000 // 10 dakika timeout
        );

                 if (!createResponse.ok) {
           const errorText = await createResponse.text();
           console.error('❌ CREATE PROCEDURE hatası:', {
             status: createResponse.status,
             statusText: createResponse.statusText,
             error: errorText,
             responseHeaders: Object.fromEntries(createResponse.headers.entries())
           });
           
           // Hata detayını daha açık göster
           let errorMessage = 'Stored procedure oluşturulamadı';
           try {
             const errorJson = JSON.parse(errorText);
             if (errorJson.error) {
               errorMessage = `Stored procedure hatası: ${errorJson.error}`;
             } else if (errorJson.message) {
               errorMessage = `Stored procedure hatası: ${errorJson.message}`;
             }
           } catch (e) {
             if (errorText) {
               errorMessage = `Stored procedure hatası: ${errorText}`;
             }
           }
           
           throw new Error(errorMessage);
         }

        const createResult = await createResponse.json();
        console.log('✅ CREATE PROCEDURE başarılı:', createResult);
        
        // Procedure'ın gerçekten oluşturulup oluşturulmadığını kontrol et
        const checkSpQuery = `
          SELECT COUNT(*) as ProcedureExists
          FROM sys.procedures 
          WHERE name = 'sp_MalzemeDetayByItem2' AND schema_id = SCHEMA_ID('dbo')
        `;
        
        console.log('🔍 Procedure varlık kontrolü yapılıyor...');
        const checkResponse = await sendSecureProxyRequest(
          companyRef,
          'first_db_key',
          { query: checkSpQuery },
          'https://api.btrapor.com/proxy',
          30000
        );
        
        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();
          console.log('✅ Procedure varlık kontrolü:', checkResult);
          if (checkResult.data && checkResult.data[0] && checkResult.data[0].ProcedureExists === 0) {
            throw new Error('Procedure oluşturuldu ama veritabanında bulunamadı');
          }
        } else {
          console.log('⚠️ Procedure varlık kontrolü başarısız, devam ediliyor...');
        }
        
                 // Üçüncü sorgu: Stored procedure'ü parametrelerle çağır
         // Connection info'dan market_module kontrol et
         const testConnectionInfo = JSON.parse(sessionStorage.getItem('connectionInfo') || '{}');
         const testConnectionMarketModule = testConnectionInfo.market_module;
         const testHasMarketModule = testConnectionMarketModule === 1 ? 1 : 0;
         console.log('🔍 createStoredProcedure - connectionInfo.market_module:', testConnectionMarketModule);
         console.log('🔍 createStoredProcedure - connectionInfo.market_module tipi:', typeof testConnectionMarketModule);
         console.log('🔍 createStoredProcedure - testHasMarketModule sonucu:', testHasMarketModule);
         
         // Connection bilgilerinden GO database bilgilerini al
         const connectionInfo = JSON.parse(sessionStorage.getItem('connectionInfo') || '{}');
         const testGoDb = connectionInfo.logo_kurulum_db_name || connectionInfo.logoKurulumDbName || 'GOWINGS';
         const testGoSchema = connectionInfo.go_schema || connectionInfo.goSchema || 'dbo';
         // Test için varsayılan bir cari ref kullan (gerçek kullanımda prop'tan gelecek)
         const testClientRef = '1';
         
         console.log('🔍 Test GO Database bilgileri:', { testGoDb, testGoSchema, testClientRef });
         console.log('⚠️ Test ClientRef sabit değer kullanıyor, gerçek kullanımda prop\'tan gelecek');
         
         const executeSpQuery = `
           DECLARE @Wh dbo.IdList; 
           -- Tüm ambarlar için boş bırakıyoruz

           EXEC dbo.sp_MalzemeDetayByItem2
             @Firm=9,
             @Period=1,
             @ItemRef=31742,
             @DateFrom='2025-01-01',
             @DateTo='2025-09-01',
             @WarehouseList=@Wh,
             @HasMarketModule=${testHasMarketModule},
             @GoDb='${testGoDb}',
             @GoSchema='${testGoSchema}',
             @ClientRef=${testClientRef};
         `;

                 console.log('🔧 Test EXEC PROCEDURE başlıyor:');
         console.log('='.repeat(80));
         console.log(executeSpQuery);
         console.log('='.repeat(80));

        const executeResponse = await sendSecureProxyRequest(
          companyRef,
          'first_db_key',
          { query: executeSpQuery },
          'https://api.btrapor.com/proxy',
          600000 // 10 dakika timeout
        );

                 if (!executeResponse.ok) {
           const errorText = await executeResponse.text();
           console.error('❌ EXEC PROCEDURE hatası:', {
             status: executeResponse.status,
             statusText: executeResponse.statusText,
             error: errorText,
             responseHeaders: Object.fromEntries(executeResponse.headers.entries())
           });
           
           // Hata detayını daha açık göster
           let errorMessage = 'Stored procedure çalıştırılamadı';
           try {
             const errorJson = JSON.parse(errorText);
             if (errorJson.error) {
               errorMessage = `EXEC hatası: ${errorJson.error}`;
             } else if (errorJson.message) {
               errorMessage = `EXEC hatası: ${errorJson.message}`;
             }
           } catch (e) {
             if (errorText) {
               errorMessage = `EXEC hatası: ${errorText}`;
             }
           }
           
           // Eğer procedure bulunamadı hatası alıyorsak, cache'i temizle ve tekrar dene
           if (errorText.includes('Could not find stored procedure') || 
               errorText.includes('sp_MalzemeDetayByItem')) {
             console.log('🔄 Procedure bulunamadı, cache temizleniyor ve tekrar deneniyor...');
             const spCacheKey = `sp_MalzemeDetayByItem2_${sessionStorage.getItem('companyRef')}`;
             sessionStorage.removeItem(spCacheKey);
             setSpCreated(false);
             // Tekrar procedure oluşturmayı dene
             await checkAndCreateStoredProcedure();
             return;
           }
           
           throw new Error(errorMessage);
         }

        const executeResult = await executeResponse.json();
        console.log('✅ EXEC PROCEDURE başarılı:', executeResult);
        
        setSpCreated(true);
        
        // Cache'i güncelle
        const spCacheKey = `sp_MalzemeDetayByItem2_${sessionStorage.getItem('companyRef')}`;
        sessionStorage.setItem(spCacheKey, 'true');
        
        // Stored procedure oluşturulduktan sonra detayları getir
        await fetchMalzemeDetay();
     } catch (err) {
       console.error('Stored procedure oluşturma hatası:', err);
       setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
       setLoading(false);
     }
   };

         const fetchMalzemeDetay = async () => {
     setLoading(true);
     setError(null);

     try {
       // Bağlantı bilgilerini al
       const connectionInfo = JSON.parse(sessionStorage.getItem('connectionInfo') || '{}');
       const firmaNo = connectionInfo.firmaNo || connectionInfo.first_firma_no || '9';
       const donemNo = connectionInfo.donemNo || connectionInfo.first_donem_no || '1';
       const companyRef = sessionStorage.getItem('companyRef') || 'btRapor_2024';
       
       // Market module parametresini connectionInfo'dan al (localStorage'da yok)
       const connectionMarketModule = connectionInfo.market_module;
       const hasMarketModule = connectionMarketModule === 1 ? 1 : 0;
      console.log('🔍 fetchMalzemeDetay - connectionInfo.market_module:', connectionMarketModule);
      console.log('🔍 fetchMalzemeDetay - connectionInfo.market_module tipi:', typeof connectionMarketModule);
      console.log('🔍 fetchMalzemeDetay - hasMarketModule sonucu:', hasMarketModule);
       
       // GO veritabanı bilgilerini connection bilgilerinden al
       const goDb = connectionInfo.logo_kurulum_db_name || connectionInfo.logoKurulumDbName || 'GO3';
       const goSchema = connectionInfo.go_schema || connectionInfo.goSchema || 'dbo';
       // ClientRef prop'tan gelen seçili cari ref'ini kullan
       const selectedClientRef = clientRef || '3';
       
       console.log('🔍 GO Database bilgileri:', { goDb, goSchema, selectedClientRef });
       console.log('🔍 Connection Info:', connectionInfo);
       console.log('🔍 Seçili Cari Ref (prop):', clientRef);

       // SQL sorgusu - Stored procedure çağrısı (gerçek parametrelerle)
       const sqlQuery = `
         DECLARE @Wh dbo.IdList; 
         -- Tüm ambarlar için boş bırakıyoruz

         EXEC dbo.sp_MalzemeDetayByItem2
           @Firm=${firmaNo},
           @Period=${donemNo},
           @ItemRef=${itemRef},
           @DateFrom='${startDate}',
           @DateTo='${endDate}',
           @WarehouseList=@Wh,
           @HasMarketModule=${hasMarketModule},
           @GoDb='${goDb}',
           @GoSchema='${goSchema}',
           @ClientRef=${selectedClientRef};
       `;

      console.log('🔍 Malzeme Detay SQL Sorgusu:');
      console.log('='.repeat(80));
      console.log(sqlQuery);
      console.log('='.repeat(80));
      console.log('📊 Sorgu Parametreleri:', { 
        firmaNo, 
        donemNo, 
        itemRef, 
        startDate, 
        endDate,
        hasMarketModule,
        goDb,
        goSchema,
        clientRef,
        companyRef 
      });
      console.log('🔗 Proxy URL:', 'https://api.btrapor.com/proxy');
      console.log('⏱️ Timeout:', '120000ms (2 dakika)');

      // Proxy üzerinden SQL sorgusunu çalıştır
      console.log('🚀 SQL sorgusu gönderiliyor...');
      const startTime = Date.now();
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        120000 // 2 dakika timeout
      );
      const endTime = Date.now();
      console.log(`⏱️ SQL sorgusu tamamlandı: ${endTime - startTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Malzeme detay response hatası:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error('Malzeme detayları getirilemedi');
      }

      const result = await response.json();
      console.log('✅ Malzeme detay response başarılı:', {
        status: response.status,
        dataLength: result.results?.length || result.data?.length || 0,
        hasResults: !!result.results,
        hasData: !!result.data,
        fullResult: result // Tüm response'u görelim
      });
      
      // Farklı data formatlarını kontrol et
      const data = result.results || result.data || result.recordset || result.rows || [];
      console.log('📊 Bulunan data:', data);
      setData(data);
    } catch (err) {
      console.error('Malzeme detay hatası:', err);
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR');
  };

  const formatNumber = (num: number) => {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatCurrency = (num: number) => {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Excel export fonksiyonu
  const exportToExcel = () => {
    if (data.length === 0) return;
    
    // Excel için veri hazırlama
    const excelData = data.map((item, index) => ({
      'Sıra': index + 1,
      'Şube No': item['İşyeri No'],
      'Şube Adı': item['İşyeri Adı'],
      'Ambar No': item['Ambar No'],
      'Ambar Adı': item['Ambar Adı'],
      'Fiyat Kaynağı': item['Fiyat Kaynağı'],
      'Aktif Satış Fiyatı': item['Aktif Satış Fiyatı'],
      'Son Fiyat Değişim Tarihi': item['Son Fiyat Değişim Tarihi'],
      'Stok Miktarı': item['Stok Miktarı'],
      'Devir Miktarı': item['Devir Miktarı'],
      'Ambar Giriş Miktarı': item['Ambar Transfer Giriş Miktarı'],
      'Son Alış Tarihi': item['Son Alış Tarihi'],
      'Son Alış Birim Fiyatı': item['Son Alış Birim Fiyatı'],
      'Son Alış Miktarı': item['Son Alış Miktarı'],
      'Son Satış Tarihi': item['Son Satış Tarihi'],
      'Son Satış Birim Fiyatı': item['Son Satış Birim Fiyatı'],
      'Dönem İçi Son Alım Tarihi': item['Dönem İçi Son Alım Tarihi'],
      'Dönem İçi Son Alım Fiyatı': item['Dönem İçi Son Alım Fiyatı'],
      'Dönem İçi Son Alım Miktarı': item['Dönem İçi Son Alım Miktarı'],
      'Son Satış Tarihi (Tarih Aralığı)': item['Son Satış Tarihi (Tarih Aralığı)'],
      'Dönem İçi Son Satış Fiyatı': item['Dönem İçi Son Satış Fiyatı'],
      'Dönem İçi Satış Toplamı': item['Dönem İçi Satış Toplamı']
    }));

    // CSV formatına çevirme
    const headers = Object.keys(excelData[0]);
    const csvContent = [
      headers.join(','),
      ...excelData.map(row => 
        headers.map(header => {
          const value = (row as any)[header];
          // Virgül içeren değerleri tırnak içine alma
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Dosya indirme
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `malzeme_detay_${malzemeKodu}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF export fonksiyonu
  const exportToPDF = () => {
    if (data.length === 0) return;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Malzeme Detay Raporu - PDF</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 15px; font-size: 12px; }
            .header { margin-bottom: 25px; background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%); color: white; padding: 20px; border-radius: 10px; box-shadow: 0 3px 10px rgba(0,0,0,0.15); }
            .header-top { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
            .logo { width: 100px; height: auto; flex-shrink: 0; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
            .header-content { flex: 1; }
            .header h1 { color: white; margin: 0 0 8px 0; font-size: 24px; text-align: left; font-weight: bold; letter-spacing: 0.5px; }
            .header p { margin: 3px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-align: left; }
            
            /* İstatistik Kutuları */
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .stat-box { border: 2px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #f9fafb; }
            .stat-box.primary { border-color: #991b1b; background-color: #fef2f2; }
            .stat-box.success { border-color: #059669; background-color: #ecfdf5; }
            .stat-box.warning { border-color: #d97706; background-color: #fffbeb; }
            .stat-box.info { border-color: #0284c7; background-color: #f0f9ff; }
            .stat-title { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
            .stat-value { font-size: 16px; font-weight: bold; color: #1f2937; }
            .stat-subtitle { font-size: 9px; color: #9ca3af; margin-top: 2px; }
            
            /* Malzeme Bilgileri */
            .malzeme-info { background-color: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; margin-bottom: 20px; border-radius: 6px; }
            .malzeme-info h3 { margin: 0 0 10px 0; color: #0c4a6e; font-size: 16px; }
            .malzeme-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .malzeme-item { text-align: center; }
            .malzeme-value { font-size: 18px; font-weight: bold; color: #0c4a6e; }
            .malzeme-label { color: #0369a1; margin-top: 5px; font-size: 11px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; table-layout: auto; }
            th, td { border: 1px solid #ddd; padding: 4px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            th { background-color: #991b1b; color: white; font-weight: bold; font-size: 11px; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .number { text-align: right; }
            .currency { font-weight: bold; }
            .center { text-align: center; }
            .section-title { color: #991b1b; margin: 20px 0 10px 0; font-size: 16px; border-bottom: 2px solid #991b1b; padding-bottom: 5px; }
            
            /* Kolon genişlikleri - optimize edilmiş */
            th:nth-child(1), td:nth-child(1) { min-width: 30px; max-width: 30px; } /* Şube No */
            th:nth-child(2), td:nth-child(2) { min-width: 45px; max-width: 45px; } /* Şube Adı */
            th:nth-child(3), td:nth-child(3) { min-width: 30px; max-width: 30px; } /* Ambar No */
            th:nth-child(4), td:nth-child(4) { min-width: 45px; max-width: 45px; } /* Ambar Adı */
            th:nth-child(5), td:nth-child(5) { min-width: 40px; max-width: 40px; } /* Fiyat Kaynağı */
            th:nth-child(6), td:nth-child(6) { min-width: 40px; max-width: 40px; } /* Aktif Satış Fiyatı */
            th:nth-child(7), td:nth-child(7) { min-width: 30px; max-width: 30px; } /* Stok Miktarı */
            th:nth-child(8), td:nth-child(8) { min-width: 30px; max-width: 30px; } /* Devir Miktarı */
            th:nth-child(9), td:nth-child(9) { min-width: 40px; max-width: 40px; } /* Ambar Giriş Miktarı */
            th:nth-child(10), td:nth-child(10) { min-width: 40px; max-width: 40px; } /* Son Alış Tarihi */
            th:nth-child(11), td:nth-child(11) { min-width: 40px; max-width: 40px; } /* Son Alış Fiyatı */
            th:nth-child(12), td:nth-child(12) { min-width: 30px; max-width: 30px; } /* Son Alış Miktarı */
            th:nth-child(13), td:nth-child(13) { min-width: 40px; max-width: 40px; } /* Son Satış Tarihi */
            th:nth-child(14), td:nth-child(14) { min-width: 40px; max-width: 40px; } /* Son Satış Fiyatı */
            th:nth-child(15), td:nth-child(15) { min-width: 30px; max-width: 30px; } /* Son Satış Miktarı */
            th:nth-child(16), td:nth-child(16) { min-width: 40px; max-width: 40px; } /* Son Alış Tarihi */
            th:nth-child(17), td:nth-child(17) { min-width: 40px; max-width: 40px; } /* Son Alış Fiyatı */
            th:nth-child(18), td:nth-child(18) { min-width: 40px; max-width: 40px; } /* Son Satış Tarihi */
            th:nth-child(19), td:nth-child(19) { min-width: 40px; max-width: 40px; } /* Son Satış Fiyatı */
            th:nth-child(20), td:nth-child(20) { min-width: 40px; max-width: 40px; } /* Son Alış Toplamı */
            th:nth-child(21), td:nth-child(21) { min-width: 40px; max-width: 40px; } /* Son Satış Toplamı */
            
            @media print {
              body { margin: 0; font-size: 12px; }
              .stats-grid { grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
              .malzeme-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
              .stat-box, .malzeme-info { padding: 10px; }
              table { font-size: 11px; }
              th, td { padding: 3px; }
              .header { margin-bottom: 25px; padding: 18px; }
              .header-top { gap: 18px; margin-bottom: 12px; }
              .logo { width: 90px; }
              .header h1 { font-size: 22px; margin: 0 0 4px 0; }
              .header p { font-size: 14px; margin: 2px 0; }
              .stat-title { font-size: 11px; }
              .stat-value { font-size: 16px; }
              .stat-subtitle { font-size: 9px; }
              .malzeme-value { font-size: 18px; }
              .malzeme-label { font-size: 11px; }
              .section-title { font-size: 16px; margin: 18px 0 10px 0; }
              
              /* Print için kolon genişlikleri - daha kompakt */
              th:nth-child(1), td:nth-child(1) { min-width: 25px; max-width: 25px; } /* Şube No */
              th:nth-child(2), td:nth-child(2) { min-width: 40px; max-width: 40px; } /* Şube Adı */
              th:nth-child(3), td:nth-child(3) { min-width: 25px; max-width: 25px; } /* Ambar No */
              th:nth-child(4), td:nth-child(4) { min-width: 40px; max-width: 40px; } /* Ambar Adı */
              th:nth-child(5), td:nth-child(5) { min-width: 35px; max-width: 35px; } /* Fiyat Kaynağı */
              th:nth-child(6), td:nth-child(6) { min-width: 35px; max-width: 35px; } /* Aktif Satış Fiyatı */
              th:nth-child(7), td:nth-child(7) { min-width: 25px; max-width: 25px; } /* Stok Miktarı */
              th:nth-child(8), td:nth-child(8) { min-width: 25px; max-width: 25px; } /* Devir Miktarı */
              th:nth-child(9), td:nth-child(9) { min-width: 35px; max-width: 35px; } /* Ambar Giriş Miktarı */
              th:nth-child(10), td:nth-child(10) { min-width: 35px; max-width: 35px; } /* Son Alış Tarihi */
              th:nth-child(11), td:nth-child(11) { min-width: 35px; max-width: 35px; } /* Son Alış Fiyatı */
              th:nth-child(12), td:nth-child(12) { min-width: 25px; max-width: 25px; } /* Son Alış Miktarı */
              th:nth-child(13), td:nth-child(13) { min-width: 35px; max-width: 35px; } /* Son Satış Tarihi */
              th:nth-child(14), td:nth-child(14) { min-width: 35px; max-width: 35px; } /* Son Satış Fiyatı */
              th:nth-child(15), td:nth-child(15) { min-width: 25px; max-width: 25px; } /* Son Satış Miktarı */
              th:nth-child(16), td:nth-child(16) { min-width: 35px; max-width: 35px; } /* Son Alış Tarihi */
              th:nth-child(17), td:nth-child(17) { min-width: 35px; max-width: 35px; } /* Son Alış Fiyatı */
              th:nth-child(18), td:nth-child(18) { min-width: 35px; max-width: 35px; } /* Son Satış Tarihi */
              th:nth-child(19), td:nth-child(19) { min-width: 35px; max-width: 35px; } /* Son Satış Fiyatı */
              th:nth-child(20), td:nth-child(20) { min-width: 35px; max-width: 35px; } /* Son Alış Toplamı */
              th:nth-child(21), td:nth-child(21) { min-width: 35px; max-width: 35px; } /* Son Satış Toplamı */
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <img src="/img/btRapor.png" alt="btRapor Logo" class="logo" />
              <div class="header-content">
                <h1>MALZEME DETAY RAPORU</h1>
                <p><strong>Rapor Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR')}</p>
                <p><strong>Malzeme Kodu:</strong> ${malzemeKodu}</p>
                <p><strong>Malzeme Adı:</strong> ${malzemeAdi}</p>
                <p><strong>Tarih Aralığı:</strong> ${startDate} - ${endDate}</p>
              </div>
            </div>
          </div>

          <!-- İstatistikler -->
          <div class="stats-grid">
            <div class="stat-box primary">
              <div class="stat-title">TOPLAM ŞUBE</div>
              <div class="stat-value">${new Set(data.map(item => item['İşyeri No'])).size}</div>
              <div class="stat-subtitle">Farklı şube sayısı</div>
            </div>
            <div class="stat-box success">
              <div class="stat-title">TOPLAM AMBAR</div>
              <div class="stat-value">${new Set(data.map(item => item['Ambar No'])).size}</div>
              <div class="stat-subtitle">Farklı ambar sayısı</div>
            </div>
            <div class="stat-box warning">
              <div class="stat-title">TOPLAM STOK</div>
              <div class="stat-value">${formatNumber(data.reduce((sum, item) => sum + (item['Stok Miktarı'] || 0), 0))}</div>
              <div class="stat-subtitle">Miktar toplamı</div>
            </div>
            <div class="stat-box info">
              <div class="stat-title">ORTALAMA FİYAT</div>
              <div class="stat-value">${formatCurrency(data.reduce((sum, item) => sum + (item['Aktif Satış Fiyatı'] || 0), 0) / Math.max(data.length, 1))}</div>
              <div class="stat-subtitle">Birim fiyat ortalaması</div>
            </div>
          </div>

          <!-- Malzeme Bilgileri -->
          <div class="malzeme-info">
            <h3>Malzeme Özet Bilgileri</h3>
            <div class="malzeme-grid">
              <div class="malzeme-item">
                <div class="malzeme-value">${malzemeKodu}</div>
                <div class="malzeme-label">Malzeme Kodu</div>
              </div>
              <div class="malzeme-item">
                <div class="malzeme-value">${malzemeAdi}</div>
                <div class="malzeme-label">Malzeme Adı</div>
              </div>
              <div class="malzeme-item">
                <div class="malzeme-value">${data.length}</div>
                <div class="malzeme-label">Toplam Kayıt</div>
              </div>
              <div class="malzeme-item">
                <div class="malzeme-value">${startDate} - ${endDate}</div>
                <div class="malzeme-label">Tarih Aralığı</div>
              </div>
            </div>
          </div>

          <!-- Detay Tablosu -->
          <div class="section-title">Şube ve Ambar Detayları</div>
          <table>
            <thead>
              <tr>
                <th rowspan="2">Şube No</th>
                <th rowspan="2">Şube Adı</th>
                <th rowspan="2">Ambar No</th>
                <th rowspan="2">Ambar Adı</th>
                <th rowspan="2">Fiyat Kaynağı</th>
                <th colspan="11" class="center">Genel Bilgiler</th>
                <th colspan="6" class="center">Dönem İçi Veriler</th>
              </tr>
              <tr>
                <th>Aktif Satış Fiyatı</th>
                <th>Son Fiyat Değişim Tarihi</th>
                <th>Stok Miktarı</th>
                <th>Devir Miktarı</th>
                <th>Ambar Giriş Miktarı</th>
                <th>Son Alış Tarihi</th>
                <th>Son Alış Fiyatı</th>
                <th>Son Alış Miktarı</th>
                <th>Son Satış Tarihi</th>
                <th>Son Satış Fiyatı</th>
                <th>Dönem İçi Son Alım Tarihi</th>
                <th>Dönem İçi Son Alım Fiyatı</th>
                <th>Dönem İçi Son Alım Miktarı</th>
                <th>Son Satış Tarihi (Aralık)</th>
                <th>Dönem İçi Son Satış Fiyatı</th>
                <th>Dönem İçi Satış Toplamı</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td>${item['İşyeri No'] || '-'}</td>
                  <td>${item['İşyeri Adı'] || '-'}</td>
                  <td>${item['Ambar No'] || '-'}</td>
                  <td>${item['Ambar Adı'] || '-'}</td>
                  <td>${item['Fiyat Kaynağı'] || '-'}</td>
                  <td class="currency">${item['Aktif Satış Fiyatı'] ? formatCurrency(item['Aktif Satış Fiyatı']) : '-'}</td>
                  <td>${item['Son Fiyat Değişim Tarihi'] ? formatDate(item['Son Fiyat Değişim Tarihi']) : '-'}</td>
                  <td class="number">${item['Stok Miktarı'] ? formatNumber(item['Stok Miktarı']) : '-'}</td>
                  <td class="number">${item['Devir Miktarı'] ? formatNumber(item['Devir Miktarı']) : '-'}</td>
                  <td class="number">${item['Ambar Transfer Giriş Miktarı'] ? formatNumber(item['Ambar Transfer Giriş Miktarı']) : '-'}</td>
                  <td>${item['Son Alış Tarihi'] ? formatDate(item['Son Alış Tarihi']) : '-'}</td>
                  <td class="currency">${item['Son Alış Birim Fiyatı'] ? formatCurrency(item['Son Alış Birim Fiyatı']) : '-'}</td>
                  <td class="number">${item['Son Alış Miktarı'] ? formatNumber(item['Son Alış Miktarı']) : '-'}</td>
                  <td>${item['Son Satış Tarihi'] ? formatDate(item['Son Satış Tarihi']) : '-'}</td>
                  <td class="currency">${item['Son Satış Birim Fiyatı'] ? formatCurrency(item['Son Satış Birim Fiyatı']) : '-'}</td>
                  <td>${item['Dönem İçi Son Alım Tarihi'] ? formatDate(item['Dönem İçi Son Alım Tarihi']) : '-'}</td>
                  <td class="currency">${item['Dönem İçi Son Alım Fiyatı'] ? formatCurrency(item['Dönem İçi Son Alım Fiyatı']) : '-'}</td>
                  <td class="number">${item['Dönem İçi Son Alım Miktarı'] ? formatNumber(item['Dönem İçi Son Alım Miktarı']) : '-'}</td>
                  <td>${item['Son Satış Tarihi (Tarih Aralığı)'] ? formatDate(item['Son Satış Tarihi (Tarih Aralığı)']) : '-'}</td>
                  <td class="currency">${item['Dönem İçi Son Satış Fiyatı'] ? formatCurrency(item['Dönem İçi Son Satış Fiyatı']) : '-'}</td>
                  <td class="number">${item['Dönem İçi Satış Toplamı'] ? formatNumber(item['Dönem İçi Satış Toplamı']) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Direkt yazdırma penceresi aç
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Sayfa yüklendikten sonra otomatik yazdırma penceresi aç
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-start sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full h-full sm:h-auto sm:max-w-[98vw] lg:max-w-[95vw] xl:max-w-[92vw] sm:max-h-[95vh] bg-white sm:rounded-lg shadow-xl sm:my-4 flex flex-col">
          {/* Modal Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-red-800 to-red-900 text-white p-4 sm:p-6 sm:rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold">📊 Malzeme Detayları</h3>
                <p className="text-red-100 text-xs sm:text-sm mt-2 break-words">
                  Malzeme Kodu: {malzemeKodu} • Malzeme Adı: {malzemeAdi}
                  {data.length > 0 && ` • ${data.length} şube/ambar bulundu`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
                {/* Yeniden Yükle Butonu */}
                <button
                  onClick={clearCacheAndReload}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-800 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cache'i temizle ve yeni veri getir"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Yükleniyor...' : 'Yeniden Yükle'}
                </button>
                
                {/* Export Butonları */}
                {data.length > 0 && (
                  <>
                    <button
                      onClick={() => exportToExcel()}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-800 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 hover:border-green-400 transition-all duration-200"
                      title="Excel olarak dışa aktar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel
                    </button>
                    <button
                      onClick={() => exportToPDF()}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 hover:border-red-400 transition-all duration-200"
                      title="PDF olarak dışa aktar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="text-white hover:text-red-200 transition-colors p-2 lg:p-3 rounded-lg hover:bg-red-700"
                  title="Detayları kapat"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-7 lg:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

                           {/* Modal Body */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
           {loading ? (
             <div className="flex flex-col items-center justify-center py-12">
               {animationData && (
                 <div className="w-24 h-24 mb-4">
                   <Lottie animationData={animationData} loop={true} />
                 </div>
               )}
               <p className="text-gray-600 font-medium">
                 {spCreated ? 'Malzeme detayları yükleniyor...' : 'Stored procedure oluşturuluyor...'}
               </p>
             </div>
           ) : error ? (
             <div className="bg-red-50 border border-red-200 rounded-lg p-4">
               <div className="flex items-center gap-2 text-red-800">
                 <span>❌</span>
                 <span className="font-medium">{error}</span>
               </div>
             </div>
                       ) : !spCreated ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔧</div>
                                 <p className="text-gray-600 mb-6">Malzeme detayları için stored procedure oluşturuluyor...</p>
              </div>
           ) : data.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📭</div>
              <p className="text-gray-600">Bu malzeme için detay bulunamadı</p>
            </div>
                      ) : (
              <div className="space-y-6">
                                 {/* Şube Detayları Tablosu */}
                 <div className="space-y-4">
                   <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                     <span className="text-red-600">🏢</span>
                     Şube Detayları
                   </h3>
                   
                   <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                       <div className="bg-gray-50 p-4 border-b border-gray-200">
                         <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                               <span className="text-gray-600 text-sm">📊</span>
                             </div>
                             <div>
                               <h4 className="text-lg font-semibold text-gray-800">Malzeme Detay Listesi</h4>
                               <p className="text-gray-500 text-sm mt-1">
                                 {data.length} kayıt bulundu
                               </p>
                             </div>
                           </div>
                           <div className="text-sm text-gray-500">
                             Şube ve ambar bazında detaylı analiz
                           </div>
                         </div>
                       </div>
                       
                       <div className="overflow-x-auto overflow-y-auto max-h-[40vh] relative">
                         <table className="min-w-full divide-y divide-gray-200 table-fixed w-max">
                           <thead className="sticky top-0 z-20">
                             {/* Ana Grup Başlıkları */}
                             <tr className="bg-gray-100 border-b border-gray-300">
                               <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky left-0 z-30 bg-gray-100">
                                 <div>
                                   <div>Şube No</div>
                                   <div className="text-xs font-normal text-gray-500">Kod</div>
                                 </div>
                               </th>
                               <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky left-[100px] z-30 bg-gray-100">
                                 <div>
                                   <div>Şube Adı</div>
                                   <div className="text-xs font-normal text-gray-500">Açıklama</div>
                                 </div>
                               </th>
                               <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">
                                 <div>
                                   <div>Ambar No</div>
                                   <div className="text-xs font-normal text-gray-500">Kod</div>
                                 </div>
                               </th>
                               <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky top-0 z-20 bg-gray-100">
                                 <div>
                                   <div>Ambar Adı</div>
                                   <div className="text-xs font-normal text-gray-500">Açıklama</div>
                                 </div>
                               </th>
                               <th rowSpan={2} className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 sticky top-0 z-20 bg-gray-100">
                                 <div>
                                   <div>Fiyat Kaynağı</div>
                                   <div className="text-xs font-normal text-gray-500">Bilgi</div>
                                 </div>
                               </th>
                               <th colSpan={10} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 bg-blue-50 sticky top-0 z-20">
                                 <div>
                                   <div>Genel Bilgiler</div>
                                   <div className="text-xs font-normal text-blue-600">Stok, fiyat ve hareket bilgileri</div>
                                 </div>
                               </th>
                               <th colSpan={6} className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider bg-orange-50 sticky top-0 z-20">
                                 <div>
                                   <div>Dönem İçi Veriler</div>
                                   <div className="text-xs font-normal text-orange-600">Belirtilen tarih aralığındaki veriler</div>
                                 </div>
                               </th>
                             </tr>
                             {/* Alt Başlıklar - Genel Bilgiler */}
                             <tr className="bg-blue-100 border-b border-blue-200">
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Aktif Satış Fiyatı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Son Fiyat Değişim Tarihi
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Stok Miktarı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Devir Miktarı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Ambar Giriş Miktarı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Son Alış Tarihi
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Son Alış Fiyatı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Son Alış Miktarı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 sticky top-12 z-15 bg-blue-100">
                                 Son Satış Tarihi
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-r border-blue-200 sticky top-12 z-15 bg-blue-100">
                                 Son Satış Fiyatı
                               </th>
                               {/* Alt Başlıklar - Dönem İçi Veriler */}
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Dönem İçi Son Alım Tarihi
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Dönem İçi Son Alım Fiyatı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Dönem İçi Son Alım Miktarı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Son Satış Tarihi (Tarih Aralığı)
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Dönem İçi Son Satış Fiyatı
                               </th>
                               <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 bg-orange-100">
                                 Dönem İçi Satış Toplamı
                               </th>
                             </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-gray-200">
                             {data.map((item, index) => (
                               <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors duration-150`}>
                                 <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[100px] border-r border-gray-200 sticky left-0 z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                                   {item['İşyeri No']}
                                 </td>
                                 <td className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 min-w-[200px] border-r border-gray-200 sticky left-[100px] z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}>
                                   {item['İşyeri Adı']}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[100px] border-r border-gray-200">
                                   {item['Ambar No']}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 min-w-[150px] border-r border-gray-200">
                                   {item['Ambar Adı']}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 min-w-[120px] border-r border-gray-200">
                                   <span className="font-medium">{item['Fiyat Kaynağı']}</span>
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 min-w-[150px] bg-blue-50">
                                   {formatCurrency(item['Aktif Satış Fiyatı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 min-w-[180px] bg-blue-50">
                                   {formatDate(item['Son Fiyat Değişim Tarihi'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-700 min-w-[120px] bg-blue-50">
                                   {formatNumber(item['Stok Miktarı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-purple-700 min-w-[120px] bg-blue-50">
                                   {formatNumber(item['Devir Miktarı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-indigo-700 min-w-[150px] bg-blue-50">
                                   {formatNumber(item['Ambar Transfer Giriş Miktarı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 min-w-[130px] bg-blue-50">
                                   {formatDate(item['Son Alış Tarihi'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 min-w-[130px] bg-blue-50">
                                   {formatCurrency(item['Son Alış Birim Fiyatı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-700 min-w-[120px] bg-blue-50">
                                   {formatNumber(item['Son Alış Miktarı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 min-w-[130px] bg-blue-50">
                                   {formatDate(item['Son Satış Tarihi'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-700 min-w-[130px] bg-blue-50">
                                   {formatCurrency(item['Son Satış Birim Fiyatı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 min-w-[180px] bg-orange-50">
                                   {formatDate(item['Dönem İçi Son Alım Tarihi'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 min-w-[180px] bg-orange-50">
                                   {formatCurrency(item['Dönem İçi Son Alım Fiyatı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-700 min-w-[180px] bg-orange-50">
                                   {formatNumber(item['Dönem İçi Son Alım Miktarı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 min-w-[180px] bg-orange-50">
                                   {formatDate(item['Son Satış Tarihi (Tarih Aralığı)'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-700 min-w-[180px] bg-orange-50">
                                   {formatCurrency(item['Dönem İçi Son Satış Fiyatı'])}
                                 </td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-red-700 min-w-[180px] bg-orange-50">
                                   {formatNumber(item['Dönem İçi Satış Toplamı'])}
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   
                   {/* Özet Bilgiler - Tablo Altında */}
                   <div className="mt-6">
                     <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                       <span className="text-green-600">📊</span>
                       Özet Bilgiler
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="bg-blue-50 rounded-lg p-4">
                         <div className="text-sm text-blue-600 font-medium">Toplam İşyeri</div>
                         <div className="text-2xl font-bold text-blue-900">
                           {new Set(data.map(item => item['İşyeri No'])).size}
                         </div>
                       </div>
                       <div className="bg-green-50 rounded-lg p-4">
                         <div className="text-sm text-green-600 font-medium">Toplam Ambar</div>
                         <div className="text-2xl font-bold text-green-900">
                           {new Set(data.map(item => item['Ambar No'])).size}
                         </div>
                       </div>
                       <div className="bg-purple-50 rounded-lg p-4">
                         <div className="text-sm text-purple-600 font-medium">Toplam Stok</div>
                         <div className="text-2xl font-bold text-purple-900">
                           {formatNumber(data.reduce((sum, item) => sum + (item['Stok Miktarı'] || 0), 0))}
                         </div>
                       </div>
                       <div className="bg-orange-50 rounded-lg p-4">
                         <div className="text-sm text-orange-600 font-medium">Ortalama Fiyat</div>
                         <div className="text-2xl font-bold text-orange-900">
                           {formatCurrency(data.reduce((sum, item) => sum + (item['Aktif Satış Fiyatı'] || 0), 0) / Math.max(data.length, 1))}
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
                             </div>
           )}
          </div>

          {/* Modal Footer */}
          <div className="flex-shrink-0 bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 sm:rounded-b-lg border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="text-xs sm:text-sm text-gray-600">
                {data.length > 0 && (
                  <span>Toplam {data.length} şube/ambar<span className="hidden sm:inline"> • İşyeri ve ambar bazında detaylı bilgi</span></span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 sm:px-6 sm:py-2 lg:px-8 lg:py-3 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors font-medium text-sm lg:text-base"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
