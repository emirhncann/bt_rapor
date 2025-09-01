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
  startDate: string;
  endDate: string;
}

export default function MalzemeDetayModal({
  isOpen,
  onClose,
  malzemeKodu,
  malzemeAdi,
  itemRef,
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

               // İlk sorgu: DROP PROCEDURE
        const dropSpQuery = `
          IF OBJECT_ID('dbo.sp_MalzemeDetayByItem','P') IS NOT NULL
            DROP PROCEDURE dbo.sp_MalzemeDetayByItem;
        `;

        console.log('🔧 İlk Sorgu - DROP PROCEDURE:');
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

        if (!dropResponse.ok) {
          const errorText = await dropResponse.text();
          console.error('❌ DROP PROCEDURE hatası:', {
            status: dropResponse.status,
            statusText: dropResponse.statusText,
            error: errorText
          });
          throw new Error('Stored procedure silinemedi');
        }

        const dropResult = await dropResponse.json();
        console.log('✅ DROP PROCEDURE başarılı:', dropResult);

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
            @GoSchema          SYSNAME = N'dbo'      -- GO tabloları şema
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
            DECLARE @WhCol_STLINE SYSNAME, @WhCol_STINVTOT SYSNAME;
            DECLARE @WhExpr_STLINE NVARCHAR(100), @WhExpr_STINVTOT NVARCHAR(120);

            -- STLINE: SOURCEINDEX / SOURCEINDEX2
            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STLINE_FQN) AND name = 'SOURCEINDEX')
              SET @WhCol_STLINE = N'SOURCEINDEX';
            ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STLINE_FQN) AND name = 'SOURCEINDEX2')
              SET @WhCol_STLINE = N'SOURCEINDEX2';
            ELSE
              SET @WhCol_STLINE = N'SOURCEINDEX';

            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STLINE_FQN) AND name = 'SOURCEINDEX')
               AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STLINE_FQN) AND name = 'SOURCEINDEX2')
              SET @WhExpr_STLINE = N'COALESCE(S.SOURCEINDEX, S.SOURCEINDEX2)';
            ELSE
              SET @WhExpr_STLINE = N'S.' + QUOTENAME(@WhCol_STLINE);

            -- STINVTOT (LV/LG): INVENNO / SOURCEINDEX
            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STINVTOT_FQN) AND name = 'INVENNO')
              SET @WhCol_STINVTOT = N'INVENNO';
            ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STINVTOT_FQN) AND name = 'SOURCEINDEX')
              SET @WhCol_STINVTOT = N'SOURCEINDEX';
            ELSE
              SET @WhCol_STINVTOT = N'INVENNO';

            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STINVTOT_FQN) AND name = 'INVENNO')
               AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(@T_STINVTOT_FQN) AND name = 'SOURCEINDEX')
              SET @WhExpr_STINVTOT = N'COALESCE(T.INVENNO, T.SOURCEINDEX)';
            ELSE
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
            WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=1 AND S.TRCODE=1 AND ' + @WhExpr_STLINE + N' = WD.WhNr
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
            WHERE S.STOCKREF=@ItemRef AND S.LINETYPE=0 AND S.IOCODE=1 AND S.TRCODE=1 AND ' + @WhExpr_STLINE + N' = WD.WhNr
              AND S.DATE_>=@DateFrom AND S.DATE_<@DateToPlus1
            ORDER BY S.DATE_ DESC, S.LOGICALREF DESC
          ) AS RBL

          OUTER APPLY (
            SELECT SUM(S.AMOUNT) AS BuyTotal
            FROM ' + @T_STLINE_FQN + N' S WITH (NOLOCK)
            WHERE S.LINETYPE = 0
              AND S.IOCODE   = 1
          AND S.TRCODE   = 1
              AND S.STOCKREF = @ItemRef
              AND ' + @WhExpr_STLINE + N' = WD.WhNr           -- COALESCE(S.SOURCEINDEX, S.SOURCEINDEX2) veya S.SOURCEINDEX
              AND S.DATE_   >= @DateFrom
              AND S.DATE_   <  @DateToPlus1
          ) AS RBT

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
              N'@Firm INT, @ItemRef INT, @DateFrom DATE, @DateTo DATE, @WarehouseList dbo.IdList READONLY',
              @Firm=@Firm, @ItemRef=@ItemRef, @DateFrom=@DateFrom, @DateTo=@DateTo, @WarehouseList=@WarehouseList;
          END
        `;

                console.log('🔧 İkinci Sorgu - CREATE PROCEDURE:');
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
            error: errorText
          });
          throw new Error('Stored procedure oluşturulamadı');
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
            @ItemRef=2,
            @DateFrom='2025-01-01',
            @DateTo='2025-09-01',
            @WarehouseList=@Wh,
            @HasMarketModule=1,
            @GoDb='GO3',
            @GoSchema='dbo';
        `;

        console.log('🔧 Üçüncü Sorgu - EXEC PROCEDURE:');
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
            error: errorText
          });
          throw new Error('Stored procedure çalıştırılamadı');
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
           @GoSchema='dbo';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-lg">📊</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Malzeme Detayları</h2>
              <p className="text-sm text-gray-600">
                {malzemeKodu} - {malzemeAdi}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

                 {/* Content */}
         <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                {/* Özet Bilgiler */}
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

                {/* Şube Kartları */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="text-blue-600">🏢</span>
                    Şube Detayları
                  </h3>
                  
                  {Array.from(new Set(data.map(item => item['İşyeri No']))).map(divNr => {
                    const subeData = data.filter(item => item['İşyeri No'] === divNr);
                    const subeAdi = subeData[0]?.['İşyeri Adı'] || 'Bilinmeyen Şube';
                    const toplamStok = subeData.reduce((sum, item) => sum + (item['Stok Miktarı'] || 0), 0);
                    const ortalamaFiyat = subeData.reduce((sum, item) => sum + (item['Aktif Satış Fiyatı'] || 0), 0) / Math.max(subeData.length, 1);
                    
                    return (
                      <div key={divNr} className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        {/* Şube Başlığı */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-bold text-lg">{divNr}</span>
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900">{subeAdi}</h4>
                                <p className="text-sm text-gray-600">{subeData.length} ambar</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-sm text-gray-600">Toplam Stok</div>
                                <div className="text-lg font-bold text-blue-600">{formatNumber(toplamStok)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600">Ort. Fiyat</div>
                                <div className="text-lg font-bold text-green-600">{formatCurrency(ortalamaFiyat)}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ambar Detayları */}
                        <div className="p-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {subeData.map((item, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                      <span className="text-green-600 text-xs font-bold">{item['Ambar No']}</span>
                                    </div>
                                    <span className="font-medium text-gray-900">{item['Ambar Adı']}</span>
                                  </div>
                                  <span className="text-xs text-gray-500">{item['Fiyat Kaynağı']}</span>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Stok:</span>
                                    <span className="font-bold text-blue-600">{formatNumber(item['Stok Miktarı'])}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Fiyat:</span>
                                    <span className="font-bold text-green-600">{formatCurrency(item['Aktif Satış Fiyatı'])}</span>
                                  </div>
                                  
                                  {/* Son İşlemler */}
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <div className="text-gray-500">Son Alış:</div>
                                        <div className="font-medium">{formatDate(item['Son Alış Tarihi'])}</div>
                                        <div className="text-green-600">{formatCurrency(item['Son Alış Birim Fiyatı'])}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Son Satış:</div>
                                        <div className="font-medium">{formatDate(item['Son Satış Tarihi'])}</div>
                                        <div className="text-red-600">{formatCurrency(item['Son Satış Birim Fiyatı'])}</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Aralık Toplamları */}
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <div className="text-gray-500">Alış Toplamı:</div>
                                        <div className="font-bold text-green-600">{formatCurrency(item['Son Alış Toplamı (Aralık İçi)'])}</div>
                                      </div>
                                      <div>
                                        <div className="text-gray-500">Satış Toplamı:</div>
                                        <div className="font-bold text-red-600">{formatCurrency(item['Son Satış Toplamı (Aralık İçi)'])}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
