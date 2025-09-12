import { NextRequest, NextResponse } from 'next/server';

// Tüm kullanıcıları getir (sadece super admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';
    const companyId = searchParams.get('companyId');

    // External API'ye istek gönder
    const url = companyId 
      ? `https://api.btrapor.com/super-admin/all-users?page=${page}&limit=${limit}&companyId=${companyId}`
      : `https://api.btrapor.com/super-admin/all-users?page=${page}&limit=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('All users API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcılar yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcı bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, email, role, is_active, company_id } = body;

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
    const response = await fetch('https://api.btrapor.com/super-admin/update-user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        name,
        email,
        role,
        is_active,
        company_id
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update user API error:', error);
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
    const response = await fetch(`https://api.btrapor.com/super-admin/delete-user/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
