import { NextResponse } from 'next/server';
// @ts-expect-error - nodemailer tip tanımları local install sonrası çözülecek
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import { sendSecureProxyRequest } from '@/app/utils/api';
import { buildInventoryFilters } from '@/app/utils/buildFilter';

// Bu route Node.js ortamında çalışmalı (Edge değil)
export const runtime = 'nodejs';

interface ExportRequest {
  companyRef: string;
  firmaNo: string; // ör: "009"
  donemNo: string; // ör: "01"
  email: string; // gönderilecek adres
  filters: {
    grpcod?: string[];
    specode?: string[];
    specode2?: string[];
    specode3?: string[];
    specode4?: string[];
    specode5?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const body: ExportRequest = await request.json();
    const { companyRef, firmaNo, donemNo, email, filters } = body;

    if (!companyRef || !email) {
      return NextResponse.json({ error: 'companyRef ve email zorunludur' }, { status: 400 });
    }

    // 1) SQL filtrelerini hazırla
    const rawFilters = buildInventoryFilters({
      grpcod: filters.grpcod || [],
      specode: filters.specode || [],
      specode2: filters.specode2 || [],
      specode3: filters.specode3 || [],
      specode4: filters.specode4 || [],
      specode5: filters.specode5 || []
    });
    const whereFilters = rawFilters.replace(/'/g, "''");

    // 2) Dinamik SQL (pivot) – front-end ile aynı sorgu
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

      -- 3. Dinamik SQL sorgusu
      SET @sql = '
      SELECT 
        [Malzeme Ref],
        [Malzeme Kodu],
        [Malzeme Adı],
        [Grup Kodu],
        [Grup Kodu Açıklaması],
        [Özel Kod],
        [Özel Kod Açıklaması],
        [Özel Kod2],
        [Özel Kod2 Açıklaması],
        [Özel Kod3],
        [Özel Kod3 Açıklaması],
        [Özel Kod4],
        [Özel Kod4 Açıklaması],
        [Özel Kod5],
        [Özel Kod5 Açıklaması],
        ' + @kolonlarNullsuz + '
      FROM (
        SELECT 
          I.LOGICALREF AS [Malzeme Ref],
          I.CODE AS [Malzeme Kodu],
          I.NAME AS [Malzeme Adı],
          I.STGRPCODE AS [Grup Kodu],
          S7.DEFINITION_ AS [Grup Kodu Açıklaması],
          I.SPECODE AS [Özel Kod],
          S1.DEFINITION_ AS [Özel Kod Açıklaması],
          I.SPECODE2 AS [Özel Kod2],
          S2.DEFINITION_ AS [Özel Kod2 Açıklaması],
          I.SPECODE3 AS [Özel Kod3],
          S3.DEFINITION_ AS [Özel Kod3 Açıklaması],
          I.SPECODE4 AS [Özel Kod4],
          S4.DEFINITION_ AS [Özel Kod4 Açıklaması],
          I.SPECODE5 AS [Özel Kod5],
          S5.DEFINITION_ AS [Özel Kod5 Açıklaması],
          WH.NAME AS [Ambar Adı],
          S.ONHAND
        FROM LV_${firmaNo.padStart(3, '0')}_${donemNo}_STINVTOT S WITH(NOLOCK)
        LEFT JOIN LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK) ON I.LOGICALREF = S.STOCKREF
        LEFT JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK) ON WH.FIRMNR = ${firmaNo} AND WH.NR = S.INVENNO

        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S7 WHERE I.STGRPCODE = S7.SPECODE AND S7.CODETYPE = 4 AND S7.SPECODETYPE = 0) S7
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S1 WHERE I.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1) S1
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S2 WHERE I.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1) S2
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S3 WHERE I.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1) S3
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S4 WHERE I.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1) S4
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S5 WHERE I.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1) S5
        WHERE S.INVENNO <> -1 ${whereFilters}

        UNION ALL

        SELECT 
          I.LOGICALREF,
          I.CODE,
          I.NAME,
          I.STGRPCODE,
          S7.DEFINITION_,
          I.SPECODE,
          S1.DEFINITION_,
          I.SPECODE2,
          S2.DEFINITION_,
          I.SPECODE3,
          S3.DEFINITION_,
          I.SPECODE4,
          S4.DEFINITION_,
          I.SPECODE5,
          S5.DEFINITION_,
          WH.NAME,
          0
        FROM LG_${firmaNo.padStart(3, '0')}_ITEMS I WITH(NOLOCK)
        CROSS JOIN GO3..L_CAPIWHOUSE WH WITH(NOLOCK)
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S7 WHERE I.STGRPCODE = S7.SPECODE AND S7.CODETYPE = 4 AND S7.SPECODETYPE = 0) S7
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S1 WHERE I.SPECODE = S1.SPECODE AND S1.CODETYPE = 1 AND S1.SPECODETYPE = 1) S1
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S2 WHERE I.SPECODE2 = S2.SPECODE AND S2.CODETYPE = 1 AND S2.SPECODETYPE = 1) S2
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S3 WHERE I.SPECODE3 = S3.SPECODE AND S3.CODETYPE = 1 AND S3.SPECODETYPE = 1) S3
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S4 WHERE I.SPECODE4 = S4.SPECODE AND S4.CODETYPE = 1 AND S4.SPECODETYPE = 1) S4
        OUTER APPLY (SELECT DEFINITION_ FROM LG_${firmaNo.padStart(3, '0')}_SPECODES S5 WHERE I.SPECODE5 = S5.SPECODE AND S5.CODETYPE = 1 AND S5.SPECODETYPE = 1) S5
        WHERE WH.FIRMNR = ${firmaNo} ${whereFilters}
          AND NOT EXISTS (
              SELECT 1 FROM LV_${firmaNo.padStart(3, '0')}_${donemNo}_STINVTOT S WHERE S.STOCKREF = I.LOGICALREF AND S.INVENNO = WH.NR
          )

      ) AS Kaynak
      PIVOT (
        SUM(ONHAND) FOR [Ambar Adı] IN (' + @kolonlar + ')
      ) AS PivotTablo
      ORDER BY [Malzeme Kodu];';

      -- 4. Çalıştır
      EXEC sp_executesql @sql;
    `;

    // 3) Proxy isteği gönder
    const response = await sendSecureProxyRequest(companyRef, 'first_db_key', { query: sqlQuery }, 'https://api.btrapor.com/proxy', 300000);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: 'SQL sorgusu başarısız', details: errText }, { status: 500 });
    }

    const result = await response.json();
    const rows: any[] = result.results || result.data || [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    }

    // 4) Excel dosyası oluştur (memory buffer)
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Envanter');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 5) E-posta gönder (nodemailer)
    const transporter = nodemailer.createTransport({
      host: 'smtp.yandex.com',
      port: 587,
      secure: false,
      auth: {
        user: 'destek@boluteknoloji.com',
        pass: 'emyvsmxykdlvipot'
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    await transporter.sendMail({
      from: 'Bolu Teknoloji | Destek <destek@boluteknoloji.com>',
      to: email,
      subject: 'Envanter Raporu',
      text: 'Ek’te talep ettiğiniz envanter raporu bulunmaktadır.',
      attachments: [
        {
          filename: `envanter_${Date.now()}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    });

    return NextResponse.json({ status: 'success', rows: rows.length });
  } catch (error) {
    console.error('Export API hatası:', error);
    return NextResponse.json({ error: 'İşlem sırasında hata oluştu' }, { status: 500 });
  }
} 