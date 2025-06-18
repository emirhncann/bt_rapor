import { NextResponse } from 'next/server';
import * as sql from 'mssql';


export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const config = {
      user: 'sa',
      password: 'Ozt129103',
      server: '192.168.2.100',
      database: 'GOWINGS',
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };

    await sql.connect(config);
    const result = await sql.query(body.query);
    
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('SQL Hatası:', error);
    return NextResponse.json(
      { error: 'Veritabanı hatası' },
      { status: 500 }
    );
  }
} 