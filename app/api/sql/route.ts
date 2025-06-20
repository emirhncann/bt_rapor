import { NextResponse } from 'next/server';


export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('Gönderilen request body:', body);
    
    // localhost:45678 adresine SQL isteği gönder
    const response = await fetch('http://localhost:45678/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    console.log('localhost:45678 response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('localhost:45678 error response:', errorText);
      return NextResponse.json(
        { status: 'error', message: `Server hatası: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('localhost:45678 response data:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('SQL Hatası:', error);
    return NextResponse.json(
      { error: 'Veritabanı hatası' },
      { status: 500 }
    );
  }
} 