import { NextRequest, NextResponse } from 'next/server';

// Şirketin kullanıcılarını getir
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyRef = searchParams.get('companyRef');

    if (!companyRef) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket referansı gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/company-users/${companyRef}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Company users API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Şirket kullanıcıları yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Şirkete yeni kullanıcı ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyRef, name, email, role, password } = body;

    // Validation
    if (!companyRef || !name || !email || !role) {
      return NextResponse.json(
        {
          status: "error",
          message: "Şirket referansı, isim, email ve rol bilgileri gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/create-company-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_ref: companyRef,
        name,
        email,
        role,
        password
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Create company user API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı oluşturulurken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcı bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, email, role, is_active } = body;

    // Validation
    if (!user_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/update-company-user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        name,
        email,
        role,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update company user API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı güncellenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcıyı sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/delete-company-user/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete company user API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
