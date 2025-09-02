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
  'Devir Miktarı': number;
  'Ambar Transfer Giriş Miktarı': number;
  'Son Alış Tarihi': string;
  'Son Alış Birim Fiyatı': number;
  'Son Alış Miktarı': number;
  'Son Satış Tarihi': string;
  'Son Satış Birim Fiyatı': number;
  'Son Satış Miktarı': number;
  'Son Alış Tarihi (Aralık İçi)': string;
  'Son Alış Fiyatı (Aralık İçi)': number;
  'Son Alış Toplamı (Aralık İçi)': number;
  'Son Satış Tarihi (Aralık İçi)': string;
  'Son Satış Fiyatı (Aralık İçi)': number;
  'Son Satış Toplamı (Aralık İçi)': number;
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

  // Modal açıldığında veriyi getir
  useEffect(() => {
    if (isOpen && itemRef) {
      // Stored procedure oluşturulmuşsa detayları getir
      if (spCreated) {
        fetchMalzemeDetay();
      }
    }
  }, [isOpen, itemRef, spCreated]);

                   const createStoredProcedure = async () => {
      setLoading(true);
      setError(null);

      try {
        const companyRef = localStorage.getItem('companyRef') || 'btRapor_2024';

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
             300000
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
             IF OBJECT_ID('dbo.sp_MalzemeDetayByItem','P') IS NOT NULL
               DROP PROCEDURE dbo.sp_MalzemeDetayByItem;
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
            300000
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

        // İkinci sorgu: CREATE PROCEDURE
        const createSpQuery = `
          CREATE PROCEDURE dbo.sp_MalzemeDetayByItem
            @Firm              INT,
            @Period            INT,
            @ItemRef           INT,
            @DateFrom          DATE,
            @DateTo            DATE,
            @WarehouseList     dbo.IdList READONLY,  -- NR listesi (boş=tümü)
            @HasMarketModule   BIT,                  -- 1: LK>LG>0, 0: LG>0
            @GoDb              SYSNAME = NULL,       -- GO tabloları DB (örn. GO3); NULL/'' = current DB
            @GoSchema          SYSNAME = N'dbo',     -- GO tabloları şema
            @ClientRef         INT
          AS
          BEGIN
            SET NOCOUNT ON;

            ------------------------------------------------------------
            -- 0) Firma/Dönem ve tablo adları
            ------------------------------------------------------------
            DECLARE @F3 VARCHAR(3) = RIGHT('000' + CAST(@Firm AS VARCHAR(3)), 3);
            DECLARE @P2 VARCHAR(2) = RIGHT('00' + CAST(@Period AS VARCHAR(2)), 2);

            DECLARE @T_STLINE_NAME   NVARCHAR(300) = N'LG_' + @F3 + N'_' + @P2 + N'_STLINE';
            DECLARE @T_LKPLC_NAME    NVARCHAR(300) = N'LK_' + @F3 + N'_PRCLIST';
            DECLARE @T_LGPLC_NAME    NVARCHAR(300) = N'LG_' + @F3 + N'_PRCLIST';
            DECLARE @T_STINVTOT_LV   NVARCHAR(300) = N'LV_' + @F3 + N'_' + @P2 + N'_STINVTOT';
            DECLARE @T_STINVTOT_TBL  NVARCHAR(300) = N'LG_' + @F3 + N'_' + @P2 + N'_STINVTOT';

            -- Firma tabloları (aynı DB, dbo varsayıldı)
            DECLARE @T_STLINE_FQN   NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_STLINE_NAME);
            DECLARE @T_LKPLC_FQN    NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_LKPLC_NAME);
            DECLARE @T_LGPLC_FQN    NVARCHAR(400) = N'[dbo].' + QUOTENAME(@T_LGPLC_NAME);

            DECLARE @T_STINVTOT_FQN NVARCHAR(400);
            IF OBJECT_ID(N'[dbo].' + QUOTENAME(@T_STINVTOT_LV)) IS NOT NULL
              SET @T_STINVTOT_FQN = N'[dbo].' + QUOTENAME(@T_STINVTOT_LV);
            ELSE
              SET @T_STINVTOT_FQN = N'[dbo].' + QUOTENAME(@T_STINVTOT_TBL);

            ------------------------------------------------------------
            -- 1) GO tabloları (başka DB'de olabilir) - fully qualified
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
            -- 2) Ambar kolon tespiti + COALESCE ifadeleri
            ------------------------------------------------------------
            DECLARE @WhCol_STLINE SYSNAME, @WhCol_STINVTOT SYSNAME,@WhCol_STLINE_Dest SYSNAME;
            DECLARE @WhExpr_STLINE NVARCHAR(100), @WhExpr_STINVTOT NVARCHAR(120), @WhExpr_STLINE_Dest NVARCHAR(100);

            SET @WhCol_STLINE = N'SOURCEINDEX';
            SET @WhExpr_STLINE = N'S.' + QUOTENAME(@WhCol_STLINE);
                
            SET @WhCol_STLINE_Dest = N'DESTINDEX';
            SET @WhExpr_STLINE_Dest = N'S.' + QUOTENAME(@WhCol_STLINE_Dest);
            
            SET @WhCol_STINVTOT = N'INVENNO';
            SET @WhExpr_STINVTOT = N'T.' + QUOTENAME(@WhCol_STINVTOT);

            ------------------------------------------------------------
            -- 3) Fiyat kaynak blokları (LG/LK)
            ------------------------------------------------------------
            DECLARE @lgApply NVARCHAR(MAX);
            IF OBJECT_ID(@T_LGPLC_FQN) IS NOT NULL
              SET @lgApply = N'
          OUTER APPLY (
            SELECT TOP (1) CAST(P.PRICE AS NUMERIC(19,4)) AS PRICE
            FROM ' + @T_LGPLC_FQN + N' P WITH (NOLOCK)
            WHERE P.CARDREF = @ItemRef AND P.ACTIVE = 0
            ORDER BY P.LOGICALREF DESC
          ) AS LGP';
            ELSE
              SET @lgApply = N'
          OUTER APPLY (SELECT CAST(NULL AS NUMERIC(19,4)) AS PRICE) AS LGP';

            DECLARE @lkJoin NVARCHAR(MAX), @aktifFiyatExpr NVARCHAR(MAX), @kaynakExpr NVARCHAR(MAX);
            IF @HasMarketModule = 1
            BEGIN
              IF OBJECT_ID(@T_LKPLC_FQN) IS NOT NULL
                SET @lkJoin = N'
          LEFT JOIN ' + @T_LKPLC_FQN + N' LKP WITH (NOLOCK)
                 ON LKP.STREF = @ItemRef AND LKP.OFFICECODE = WD.DivNr';
              ELSE
                SET @lkJoin = N'
          OUTER APPLY (SELECT CAST(NULL AS NUMERIC(19,4)) AS BUYPRICE) AS LKP';

              SET @aktifFiyatExpr = N'
          CASE 
            WHEN LKP.BUYPRICE IS NOT NULL THEN LKP.BUYPRICE
            WHEN LGP.PRICE    IS NOT NULL THEN LGP.PRICE
            ELSE 0
          END AS [Aktif Satış Fiyatı]';

              SET @kaynakExpr = N'
          CASE 
            WHEN LKP.BUYPRICE IS NOT NULL THEN ''Market(Kalem)''
            WHEN LGP.PRICE    IS NOT NULL THEN ''Logo''
            ELSE ''tanımlı fiyat yok''
          END AS [Fiyat Kaynağı]';
            END
            ELSE
            BEGIN
              SET @lkJoin = N'
          OUTER APPLY (SELECT CAST(NULL AS NUMERIC(19,4)) AS BUYPRICE) AS LKP';

              SET @aktifFiyatExpr = N'
          CASE 
            WHEN LGP.PRICE IS NOT NULL THEN LGP.PRICE
            ELSE 0
          END AS [Aktif Satış Fiyatı]';

              SET @kaynakExpr = N'
          CASE 
            WHEN LGP.PRICE IS NOT NULL THEN ''Logo''
            ELSE ''tanımlı fiyat yok''
          END AS [Fiyat Kaynağı]';
            END

            ------------------------------------------------------------
            -- 4) WhFilter JOIN kararı (tırnaksız, direkt SQL parçası!)
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

            SET @sql =
          N'DECLARE @DateToPlus1 DATE = DATEADD(DAY,1,@DateTo);
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
            LEFT JOIN Divs D ON D.NR = W.DIVISNR   -- WH.DIVISNR = DIV.NR
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
            ' + @aktifFiyatExpr + N',
            ' + @kaynakExpr + N',
            Devir.DevirTotal					 AS [Devir Miktarı],
            Transfer.TransferTotal				 AS [Ambar Transfer Giriş Miktarı],
            LBL.DATE_                            AS [Son Alış Tarihi],
            LBL.PRICE                            AS [Son Alış Birim Fiyatı],
            LBL.AMOUNT                           AS [Son Alış Miktarı],

            LSL.DATE_                            AS [Son Satış Tarihi],
            LSL.PRICE                            AS [Son Satış Birim Fiyatı],
            LSL.AMOUNT                           AS [Son Satış Miktarı],

            RBL.DATE_                            AS [Son Alış Tarihi (Aralık İçi)],
            RBL.PRICE                            AS [Son Alış Fiyatı (Aralık İçi)],
            RBT.BuyTotal                         AS [Son Alış Toplamı (Aralık İçi)],

            RSL.DATE_                            AS [Son Satış Tarihi (Aralık İçi)],
            RSL.PRICE                            AS [Son Satış Fiyatı (Aralık İçi)],
            RST.SaleTotal                        AS [Son Satış Toplamı (Aralık İçi)]


          FROM WhDiv WD
          LEFT JOIN OnHand O ON O.WhNr = WD.WhNr

          OUTER APPLY (
            SELECT TOP (1) S.DATE_, S.PRICE, S.AMOUNT, S.LINENET
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.STOCKREF=@ItemRef AND S.CLIENTREF=@ClientRef AND S.LINETYPE=0 AND S.IOCODE=1 AND S.TRCODE=1 AND ' + @WhExpr_STLINE + N' = WD.WhNr
            ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
          ) AS LBL

          OUTER APPLY (
            SELECT TOP (1) S.DATE_, S.PRICE, S.AMOUNT, S.LINENET
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=4 AND S.TRCODE IN(7,8) AND ' + @WhExpr_STLINE + N' = WD.WhNr
            ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
          ) AS LSL

          OUTER APPLY (
            SELECT TOP (1) S.DATE_, S.PRICE
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.STOCKREF=@ItemRef AND S.CLIENTREF=@ClientRef AND S.LINETYPE=0 AND S.IOCODE=1 AND S.TRCODE=1 AND ' + @WhExpr_STLINE + N' = WD.WhNr
              AND S.DATE_>=@DateFrom AND S.DATE_<@DateToPlus1
            ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
          ) AS RBL

          OUTER APPLY (
            SELECT SUM(S.AMOUNT) AS BuyTotal
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.LINETYPE = 0
              AND S.CLIENTREF=@ClientRef
              AND S.IOCODE   = 1
              AND S.TRCODE   = 1
              AND S.STOCKREF = @ItemRef
              AND ' + @WhExpr_STLINE + N' = WD.WhNr           -- COALESCE(S.SOURCEINDEX, S.SOURCEINDEX2) veya S.SOURCEINDEX
              AND S.DATE_   >= @DateFrom
              AND S.DATE_   <  @DateToPlus1
          ) AS RBT

          OUTER APPLY (
            SELECT SUM(S.AMOUNT) AS DevirTotal
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.LINETYPE = 0
              AND S.IOCODE   = 1
              AND S.TRCODE   = 14
              AND S.STOCKREF = @ItemRef
              AND ' + @WhExpr_STLINE + N' = WD.WhNr           -- COALESCE(S.SOURCEINDEX, S.SOURCEINDEX2) veya S.SOURCEINDEX
              AND S.DATE_   >= @DateFrom
              AND S.DATE_   <  @DateToPlus1
          ) AS Devir

          OUTER APPLY (
            SELECT SUM(S.AMOUNT) AS TransferTotal
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.LINETYPE = 0
              AND S.IOCODE   = 2
              AND S.TRCODE   = 25
              AND S.STOCKREF = @ItemRef
              AND ' + @WhExpr_STLINE + N' = WD.WhNr           -- COALESCE(S.SOURCEINDEX, S.SOURCEINDEX2) veya S.SOURCEINDEX
              AND S.DATE_   >= @DateFrom
              AND S.DATE_   <  @DateToPlus1
          ) AS Transfer

          OUTER APPLY (
            SELECT TOP (1) S.DATE_, S.PRICE
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=4 AND S.TRCODE IN(7,8) AND ' + @WhExpr_STLINE + N' = WD.WhNr
              AND S.DATE_>=@DateFrom AND S.DATE_<@DateToPlus1
            ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
          ) AS RSL

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

          ' + @lkJoin + @lgApply + N'
          ORDER BY WD.DivNr, WD.WhNr;';

            EXEC sp_executesql 
              @sql,
              N'@Firm INT, @ItemRef INT, @DateFrom DATE, @DateTo DATE, @WarehouseList dbo.IdList READONLY, @ClientRef INT',
              @Firm=@Firm, @ItemRef=@ItemRef, @DateFrom=@DateFrom, @DateTo=@DateTo, @WarehouseList=@WarehouseList,@ClientRef=@ClientRef;
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
          300000
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
        
                 // Üçüncü sorgu: Stored procedure'ü parametrelerle çağır
         const executeSpQuery = `
           DECLARE @Wh dbo.IdList; 
           -- Tüm ambarlar için boş bırakıyoruz

           EXEC dbo.sp_MalzemeDetayByItem
             @Firm=9,
             @Period=1,
             @ItemRef=31742,
             @DateFrom='2025-01-01',
             @DateTo='2025-09-01',
             @WarehouseList=@Wh,
             @HasMarketModule=1,
             @GoDb='GO3',
             @GoSchema='dbo',
             @ClientRef=3;
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
          300000
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
           
           throw new Error(errorMessage);
         }

        const executeResult = await executeResponse.json();
        console.log('✅ EXEC PROCEDURE başarılı:', executeResult);
        
        setSpCreated(true);
     } catch (err) {
       console.error('Stored procedure oluşturma hatası:', err);
       setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
     } finally {
       setLoading(false);
     }
   };

         const fetchMalzemeDetay = async () => {
     setLoading(true);
     setError(null);

     try {
       // Bağlantı bilgilerini al
       const connectionInfo = JSON.parse(localStorage.getItem('connectionInfo') || '{}');
       const firmaNo = connectionInfo.firmaNo || connectionInfo.first_firma_no || '9';
       const donemNo = connectionInfo.donemNo || connectionInfo.first_donem_no || '1';
       const companyRef = localStorage.getItem('companyRef') || 'btRapor_2024';

       // SQL sorgusu - Stored procedure çağrısı (gerçek parametrelerle)
       const sqlQuery = `
         DECLARE @Wh dbo.IdList; 
         -- Tüm ambarlar için boş bırakıyoruz

         EXEC dbo.sp_MalzemeDetayByItem
           @Firm=${firmaNo},
           @Period=${donemNo},
           @ItemRef=${itemRef},
           @DateFrom='${startDate}',
           @DateTo='${endDate}',
           @WarehouseList=@Wh,
           @HasMarketModule=1,
           @GoDb='GO3',
           @GoSchema='dbo',
           @ClientRef=${clientRef};
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
        companyRef 
      });
      console.log('🔗 Proxy URL:', 'https://api.btrapor.com/proxy');
      console.log('⏱️ Timeout:', '300000ms (5 dakika)');

      // Proxy üzerinden SQL sorgusunu çalıştır
      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        300000 // 5 dakika timeout
      );

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
                                 <p className="text-gray-600 mb-6">Malzeme detayları için stored procedure oluşturulması gerekiyor</p>
                 <button
                   onClick={createStoredProcedure}
                   className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                 >
                   Stored Procedure Oluştur
                 </button>
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
                   
                   <div className="bg-white rounded-lg shadow overflow-hidden">
                     <div className="p-4 border-b border-gray-200">
                       <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                         <h4 className="text-lg font-semibold text-gray-800">Malzeme Detay Listesi</h4>
                         <div className="flex items-center gap-2 text-sm text-gray-500">
                           <span>{data.length} kayıt</span>
                         </div>
                       </div>
                     </div>
                     
                     <div className="overflow-x-auto overflow-y-auto max-h-[65vh] relative">
                       <table className="min-w-full divide-y divide-gray-200 table-fixed w-max">
                         <thead className="sticky top-0 z-10">
                           {/* Grup başlıkları */}
                           <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                             <th rowSpan={2} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-0 z-20">
                               Şube No
                             </th>
                             <th rowSpan={2} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-0 z-20">
                               Şube Adı
                             </th>
                             <th rowSpan={2} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-0 z-20">
                               Ambar No
                             </th>
                             <th rowSpan={2} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-0 z-20">
                               Ambar Adı
                             </th>
                             <th rowSpan={2} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-0 z-20">
                               Fiyat Kaynağı
                             </th>
                             <th colSpan={10} className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-500 bg-red-800 sticky top-0 z-20">
                               Genel
                             </th>
                                                           <th colSpan={6} className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider bg-red-800 sticky top-0 z-20">
                                Tarih Aralığı
                              </th>
                           </tr>
                           {/* Alt başlıklar */}
                           <tr className="bg-gradient-to-r from-red-900 to-red-800 text-white">
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Aktif Satış Fiyatı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Stok Miktarı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Devir Miktarı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Ambar Giriş Miktarı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Son Alış Tarihi
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Son Alış Fiyatı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Son Alış Miktarı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Son Satış Tarihi
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider sticky top-12 z-15">
                               Son Satış Fiyatı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-500 sticky top-12 z-15">
                               Son Satış Miktarı
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                               Son Alış Tarihi (Aralık İçi)
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                               Son Alış Fiyatı (Aralık İçi)
                             </th>
                             <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                               Son Satış Tarihi (Aralık İçi)
                             </th>
                                                           <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                                Son Satış Fiyatı (Aralık İçi)
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                                Son Alış Toplamı (Aralık İçi)
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider bg-red-900 sticky top-12 z-15">
                                Son Satış Toplamı (Aralık İçi)
                              </th>
                           </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                           {data.map((item, index) => (
                             <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-red-50 transition-colors duration-200`}>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 min-w-[120px]">
                                 {item['İşyeri No']}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[250px]">
                                 {item['İşyeri Adı']}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[120px]">
                                 {item['Ambar No']}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[200px]">
                                 {item['Ambar Adı']}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 min-w-[150px]">
                                 {item['Fiyat Kaynağı']}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 min-w-[180px]">
                                 {formatCurrency(item['Aktif Satış Fiyatı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 min-w-[150px]">
                                 {formatNumber(item['Stok Miktarı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600 min-w-[150px]">
                                 {formatNumber(item['Devir Miktarı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600 min-w-[180px]">
                                 {formatNumber(item['Ambar Transfer Giriş Miktarı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[160px]">
                                 {formatDate(item['Son Alış Tarihi'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 min-w-[160px]">
                                 {formatCurrency(item['Son Alış Birim Fiyatı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 min-w-[150px]">
                                 {formatNumber(item['Son Alış Miktarı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[160px]">
                                 {formatDate(item['Son Satış Tarihi'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 min-w-[160px]">
                                 {formatCurrency(item['Son Satış Birim Fiyatı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 min-w-[150px]">
                                 {formatNumber(item['Son Satış Miktarı'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[200px]">
                                 {formatDate(item['Son Alış Tarihi (Aralık İçi)'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 min-w-[200px]">
                                 {formatCurrency(item['Son Alış Fiyatı (Aralık İçi)'])}
                               </td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 min-w-[200px]">
                                 {formatDate(item['Son Satış Tarihi (Aralık İçi)'])}
                               </td>
                                                               <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 min-w-[200px]">
                                  {formatCurrency(item['Son Satış Fiyatı (Aralık İçi)'])}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 min-w-[200px]">
                                  {formatNumber(item['Son Alış Toplamı (Aralık İçi)'])}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 min-w-[200px]">
                                  {formatNumber(item['Son Satış Toplamı (Aralık İçi)'])}
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
