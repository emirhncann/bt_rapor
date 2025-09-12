import { NextRequest, NextResponse } from 'next/server';

// Tüm şirketleri getir (sadece super admin)
export async function GET(request: NextRequest) {
  try {
    // Super admin kontrolü (burada token kontrolü yapılabilir)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        {
          status: "error",
          message: "Yetkilendirme gerekli!"
        },
        { status: 401 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/companies', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Companies API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirketler yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Yeni şirket oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_name, company_ref, contact_email, contact_phone, address, plan_id } = body;

    // Validation
    if (!company_name || !company_ref || !contact_email) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket adı, referansı ve email bilgileri gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/create-company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_name,
        company_ref,
        contact_email,
        contact_phone,
        address,
        plan_id
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Create company API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirket oluşturulurken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Şirket bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, company_name, contact_email, contact_phone, address, plan_id, is_active } = body;

    // Validation
    if (!company_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/update-company', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id,
        company_name,
        contact_email,
        contact_phone,
        address,
        plan_id,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update company API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirket güncellenirken hata oluştu."
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
        {
          status: "error",
          message: "Şirket ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/super-admin/delete-company/${companyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete company API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirket silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
