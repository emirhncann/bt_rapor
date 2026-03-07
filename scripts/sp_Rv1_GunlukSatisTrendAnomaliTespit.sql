/* EMIR - Satış Trendi ve Anomali Analiz Raporu */
/* Belge türü seçimi: @TrcodeList = '2,3,7,8' (virgülle ayrılmış TRCODE değerleri) */
/* 2: Satış İadesi, 3: Alış İadesi, 7: Perakende Satış, 8: Toptan Satış */

IF OBJECT_ID('dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit;
GO

CREATE PROCEDURE dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit
(
      @FirmNo INT
    , @PeriodNo INT
    , @DateFrom DATE
    , @DateTo DATE
    , @TrcodeList NVARCHAR(100) = '2,3,7,8'
)
AS
BEGIN
    SET NOCOUNT ON;
    SET ARITHABORT ON;
    SET ANSI_WARNINGS ON;

    DECLARE @sql NVARCHAR(MAX);
    DECLARE @F3 VARCHAR(3) = RIGHT('000' + CAST(@FirmNo AS VARCHAR(3)), 3);
    DECLARE @P2 VARCHAR(2) = RIGHT('00' + CAST(@PeriodNo AS VARCHAR(2)), 2);
    DECLARE @STLINE_FQN NVARCHAR(200) = QUOTENAME('LG_' + @F3 + '_' + @P2 + '_STLINE');

    SET @sql = '
    WITH GunlukSatis AS
    (
        SELECT
            CAST(SL.DATE_ AS DATE) AS Tarih,
            SUM(CASE WHEN SL.TRCODE IN (7,8) THEN SL.LINENET ELSE 0 END) AS Satis,
            SUM(CASE WHEN SL.TRCODE IN (2,3) THEN SL.LINENET ELSE 0 END) AS Iade
        FROM [dbo].' + @STLINE_FQN + ' SL WITH(NOLOCK)
        WHERE
            SL.LINETYPE = 0
            AND SL.DATE_ >= @DateFrom
            AND SL.DATE_ < DATEADD(DAY,1,@DateTo)
            AND (LEN(@TrcodeList) = 0 OR SL.TRCODE IN (SELECT CAST(LTRIM(RTRIM(n.value('.', 'NVARCHAR(MAX)'))) AS INT) FROM (SELECT CAST('<x>' + REPLACE(@TrcodeList, ',', '</x><x>') + '</x>' AS XML) AS X) AS A CROSS APPLY A.X.nodes('x') AS T(n)))
        GROUP BY CAST(SL.DATE_ AS DATE)
    ),
    Netler AS
    (
        SELECT
            Tarih,
            Satis,
            Iade,
            Satis - Iade AS NetSatis,
            Iade * 100.0 / NULLIF(Satis,0) AS IadeOrani
        FROM GunlukSatis
    ),
    Stats AS
    (
        SELECT
            *,
            AVG(NetSatis) OVER() AS OrtalamaNet,
            STDEV(NetSatis) OVER() AS StdNet,
            AVG(IadeOrani) OVER() AS OrtalamaIadeOrani,
            STDEV(IadeOrani) OVER() AS StdIadeOrani
        FROM Netler
    ),
    ZHesap AS
    (
        SELECT
            *,
            (NetSatis - OrtalamaNet) / NULLIF(StdNet,0) AS ZScoreNet,
            (IadeOrani - OrtalamaIadeOrani) / NULLIF(StdIadeOrani,0) AS ZScoreIade
        FROM Stats
    )
    SELECT
        Tarih,
        Satis,
        Iade,
        NetSatis,
        NetSatis - LAG(NetSatis) OVER (ORDER BY Tarih) AS GunlukDegisim,
        SUM(Satis) OVER (ORDER BY Tarih ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS KumulatifSatis,
        SUM(NetSatis) OVER (ORDER BY Tarih ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS KumulatifNetSatis,
        IadeOrani,
        ZScoreNet,
        ZScoreIade,
        CASE
            WHEN ABS(ZScoreNet) >= 3 THEN ''Güçlü Anomali''
            WHEN ABS(ZScoreNet) >= 2 THEN ''Anomali''
            ELSE ''Normal''
        END AS NetSatisDurum,
        CASE
            WHEN ABS(ZScoreIade) >= 3 THEN ''Güçlü Anomali''
            WHEN ABS(ZScoreIade) >= 2 THEN ''Anomali''
            ELSE ''Normal''
        END AS IadeDurum
    FROM ZHesap
    ORDER BY Tarih;';

    EXEC sp_executesql @sql, N'@DateFrom DATE, @DateTo DATE, @TrcodeList NVARCHAR(100)', @DateFrom, @DateTo, @TrcodeList;
END
GO
