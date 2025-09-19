import { NextRequest, NextResponse } from 'next/server';

// Tüm şirketleri getir
export async function GET(_request: NextRequest) {
  try {
    console.log('🔄 Şirketler API çağrısı başlatılıyor: https://api.btrapor.com/companies');
    
    // Geçici olarak mock data döndür (API test için)
    const mockData = {
      status: "success",
      data: [
        {
          id: 1,
          company_name: "Test Şirketi",
          company_email: "test@test.com",
          tax_no: "1234567890",
          tax_office: "Test Vergi Dairesi",
          adress: "Test Adres",
          contact_person: "Test Kişi",
          contact_person_tel: "05551234567",
          user_count: 5,
          last_licence_end: "2024-12-31",
          first_licence_start: "2024-01-01",
          module_refs: "module1,module2"
        }
      ]
    };
    
    console.log('📊 Mock data döndürülüyor:', mockData);
    return NextResponse.json(mockData, { status: 200 });
    
    /* Gerçek API çağrısı (şimdilik kapalı)
    const response = await fetch('https://api.btrapor.com/companies', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('📡 API Response Status:', response.status);
    const data = await response.json();
    console.log('📊 API Response Data:', data);
    
    return NextResponse.json(data, { status: response.status });
    */

  } catch (error) {
    console.error('❌ Companies API error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      {
        status: "error",
        message: "Şirketler yüklenirken hata oluştu.",
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Yeni şirket oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔄 Şirket oluşturma isteği alındı:', body);
    
    const {
      company_name,
      company_email,
      tax_no,
      tax_office,
      address,
      adress,
      contact_person,
      contact_person_tel,
    } = body;

    if (!company_name || !company_email || !tax_no || !tax_office || !(address || adress)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'company_name, company_email, tax_no, tax_office ve adress zorunludur!'
        },
        { status: 400 }
      );
    }

    // PHP API'nin beklediği alan isimleri
    const payload = {
      company_name,
      company_email,
      tax_no,
      tax_office,
      adress: adress ?? address ?? '',
      contact_person: contact_person ?? null,
      contact_person_tel: contact_person_tel ?? null,
    };

    // Upsert insert: PUT /update/companies/{id} -> id önemsenmiyor (AUTO_INCREMENT)
    console.log('📤 API\'ye gönderilen payload:', payload);
    console.log('🌐 API URL: https://api.btrapor.com/update/companies/0');
    
    const response = await fetch('https://api.btrapor.com/update/companies/0', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('📡 API Response Status:', response.status);
    const data = await response.json();
    console.log('📊 API Response Data:', data);
    
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Create company API error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Şirket oluşturulurken hata oluştu.'
      },
      { status: 500 }
    );
  }
}

// Şirket bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      company_id,
      company_name,
      company_email,
      tax_no,
      tax_office,
      address,
      adress,
      contact_person,
      contact_person_tel,
    } = body;

    const targetId = id ?? company_id;
    if (!targetId) {
      return NextResponse.json(
        { status: 'error', message: 'Şirket ID gerekli' },
        { status: 400 }
      );
    }

    const payload = {
      company_name: company_name ?? null,
      company_email: company_email ?? null,
      tax_no: tax_no ?? null,
      tax_office: tax_office ?? null,
      adress: adress ?? address ?? null,
      contact_person: contact_person ?? null,
      contact_person_tel: contact_person_tel ?? null,
    };

    // Upsert update
    const response = await fetch(`https://api.btrapor.com/update/companies/${encodeURIComponent(targetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update company API error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Şirket güncellenirken hata oluştu.'
      },
      { status: 500 }
    );
  }
}

// Şirketi sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { status: 'error', message: 'Şirket ID gerekli' },
        { status: 400 }
      );
    }

    const response = await fetch(`https://api.btrapor.com/companies/${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete company API error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Şirket silinirken hata oluştu.'
      },
      { status: 500 }
    );
  }
}
