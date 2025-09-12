import { NextRequest, NextResponse } from 'next/server';
import { sendSecureProxyRequest } from '../../../utils/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, excelData, columnMapping } = body;

    // Gerekli alanları kontrol et
    if (!customerId || !excelData || !columnMapping) {
      return NextResponse.json(
        { message: 'Eksik parametreler' },
        { status: 400 }
      );
    }

    // Company ref'i al
    const companyRef = request.headers.get('x-company-ref') || 
                      request.headers.get('X-Company-Ref') ||
                      'default';

    console.log('🔄 Ekstre karşılaştırma başlatılıyor:', {
      customerId,
      companyRef,
      excelRows: excelData.rows?.length || 0,
      columnMapping
    });

    // Proxy request payload'u hazırla
    const proxyPayload = {
      action: 'compare_extrait',
      customerId: customerId,
      excelData: {
        headers: excelData.headers,
        rows: excelData.rows,
        summary: excelData.summary
      },
      columnMapping: columnMapping,
      timestamp: new Date().toISOString()
    };

    // Güvenli proxy request gönder
    const response = await sendSecureProxyRequest(
      companyRef,
      'extrait_comparison',
      proxyPayload,
      'https://api.btrapor.com/proxy',
      120000, // 2 dakika timeout
      3 // 3 retry
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Proxy response hatası:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          message: 'Ekstre karşılaştırma işlemi başarısız',
          error: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    // Response'u parse et
    const result = await response.json();
    
    console.log('✅ Ekstre karşılaştırma başarılı:', {
      matches: result.matches?.length || 0,
      differences: result.differences?.length || 0,
      summary: result.summary
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Ekstre karşılaştırma hatası:', error);
    
    return NextResponse.json(
      { 
        message: 'Ekstre karşılaştırma işlemi sırasında hata oluştu',
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    );
  }
}

// GET endpoint - Müşteri ekstre bilgilerini getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId) {
      return NextResponse.json(
        { message: 'Müşteri ID gerekli' },
        { status: 400 }
      );
    }

    // Company ref'i al
    const companyRef = request.headers.get('x-company-ref') || 
                      request.headers.get('X-Company-Ref') ||
                      'default';

    console.log('🔄 Müşteri ekstre bilgileri getiriliyor:', {
      customerId,
      startDate,
      endDate,
      companyRef
    });

    // Proxy request payload'u hazırla
    const proxyPayload = {
      action: 'get_customer_extrait',
      customerId: customerId,
      startDate: startDate,
      endDate: endDate,
      timestamp: new Date().toISOString()
    };

    // Güvenli proxy request gönder
    const response = await sendSecureProxyRequest(
      companyRef,
      'extrait_data',
      proxyPayload,
      'https://api.btrapor.com/proxy',
      60000, // 1 dakika timeout
      3 // 3 retry
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Proxy response hatası:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      return NextResponse.json(
        { 
          message: 'Müşteri ekstre bilgileri alınamadı',
          error: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    // Response'u parse et
    const result = await response.json();
    
    console.log('✅ Müşteri ekstre bilgileri başarılı:', {
      records: result.records?.length || 0,
      totalAmount: result.totalAmount
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Müşteri ekstre bilgileri hatası:', error);
    
    return NextResponse.json(
      { 
        message: 'Müşteri ekstre bilgileri alınırken hata oluştu',
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    );
  }
}
