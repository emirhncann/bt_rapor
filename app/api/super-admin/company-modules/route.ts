import { NextRequest, NextResponse } from 'next/server';

// Şirketin modüllerini getir
export async function GET(request: NextRequest) {
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
    const response = await fetch(`https://api.btrapor.com/super-admin/company-modules/${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Company modules API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirket modülleri yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Şirkete modül ata
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, module_id, is_active } = body;

    // Validation
    if (!company_id || !module_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket ID'si ve modül ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/assign-company-module', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id,
        module_id,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Assign company module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül atanırken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Şirket modül durumunu güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, module_id, is_active } = body;

    // Validation
    if (!company_id || !module_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket ID'si ve modül ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/update-company-module', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id,
        module_id,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update company module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül durumu güncellenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Şirketten modül kaldır
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const moduleId = searchParams.get('moduleId');

    if (!companyId || !moduleId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket ID'si ve modül ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/super-admin/remove-company-module/${companyId}/${moduleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Remove company module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül kaldırılırken hata oluştu."
      },
      { status: 500 }
    );
  }
}
