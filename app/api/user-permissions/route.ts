import { NextRequest, NextResponse } from 'next/server';

// Kullanıcının yetkilerini getir
export async function GET(request: NextRequest) {
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
    const response = await fetch(`https://api.btrapor.com/user-permissions/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('User permissions API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı yetkileri yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcıya plan ata
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, plan_id, assigned_by, expires_at } = body;

    // Validation
    if (!user_id || !plan_id || !assigned_by) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı, plan ve atayan bilgileri gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/assign-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        plan_id,
        assigned_by,
        expires_at
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Assign plan API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Plan atanırken hata oluştu."
      },
      { status: 500 }
    );
  }
} 