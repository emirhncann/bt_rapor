import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı adı ve şifre boş olamaz!"
        },
        { status: 400 }
      );
    }

    // PHP backend'e proxy request gönder
    const phpResponse = await fetch('https://api.btrapor.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    const phpData = await phpResponse.json();

    // PHP response'unu frontend'e aktar
    return NextResponse.json(phpData, { status: phpResponse.status });

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Sunucu hatası oluştu."
      },
      { status: 500 }
    );
  }
} 