import { NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../utils/api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, params = [] } = body;
    
    console.log('🔍 SQL Sorgusu:', query);
    console.log('📊 Parametreler:', params);
    
    // Header'lardan connection bilgilerini al
    const companyRef = request.headers.get('company-ref');
    const firmaNo = request.headers.get('firma-no');
    const donemNo = request.headers.get('donem-no');
    const logoDb = request.headers.get('logo-db');
    
    console.log('🔗 Connection Bilgileri:', {
      companyRef,
      firmaNo,
      donemNo,
      logoDb
    });
    
    if (!companyRef || !firmaNo || !donemNo || !logoDb) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Connection bilgileri eksik. company-ref, firma-no, donem-no, logo-db header\'ları gerekli.' 
        },
        { status: 400 }
      );
    }
    
    // Proxy isteği gönder
    const response = await sendSecureProxyRequest(
      companyRef,
      'first_db_key',
      { query, params },
      'https://api.btrapor.com/proxy',
      120000
    );
    
    console.log('📊 Proxy response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Proxy error response:', errorText);
      return NextResponse.json(
        { status: 'error', message: `Proxy hatası: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Proxy response data:', data);
    
    return NextResponse.json({
      status: 'success',
      data: data.results || data.data || []
    });
    
  } catch (error) {
    console.error('❌ SQL Hatası:', error);
    return NextResponse.json(
      { status: 'error', message: 'Veritabanı hatası: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 