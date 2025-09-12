import { NextRequest, NextResponse } from 'next/server';

// Tüm planları getir
export async function GET(request: NextRequest) {
  try {
    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/plans', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Plans API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Planlar yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Yeni plan oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan_name, plan_description, max_users, max_reports, price, duration_months, features } = body;

    // Validation
    if (!plan_name || !plan_description) {
      return NextResponse.json(
        {
          status: "error",
          message: "Plan adı ve açıklaması gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/create-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_name,
        plan_description,
        max_users,
        max_reports,
        price,
        duration_months,
        features
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Create plan API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Plan oluşturulurken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Plan bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan_id, plan_name, plan_description, max_users, max_reports, price, duration_months, features, is_active } = body;

    // Validation
    if (!plan_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Plan ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/update-plan', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id,
        plan_name,
        plan_description,
        max_users,
        max_reports,
        price,
        duration_months,
        features,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update plan API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Plan güncellenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Planı sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    if (!planId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Plan ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/super-admin/delete-plan/${planId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete plan API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Plan silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
