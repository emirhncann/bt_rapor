import { NextRequest, NextResponse } from 'next/server';

// Kullanıcının rapor yetkilerini getir (report_id listesi)
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

    // External API'ye istek gönder - yeni endpoint
    const response = await fetch(`https://api.btrapor.com/user-report-permissions/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('User report permissions API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Kullanıcı rapor yetkileri yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcıya 1+ rapor izni ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, report_ids } = body;

    // Validation
    if (!user_id || !report_ids || !Array.isArray(report_ids) || report_ids.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı ID ve en az bir rapor ID gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder - yeni endpoint
    const response = await fetch('https://api.btrapor.com/user-report-permissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        report_ids
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Add report permissions API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Rapor yetkileri eklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Kullanıcıdan 1+ rapor iznini sil
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, report_ids } = body;

    // Validation
    if (!user_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Kullanıcı ID gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder - yeni endpoint
    const response = await fetch('https://api.btrapor.com/user-report-permissions', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id,
        report_ids: report_ids || null // null ise tüm izinleri sil
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete report permissions API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Rapor yetkileri silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
