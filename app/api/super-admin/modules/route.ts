import { NextRequest, NextResponse } from 'next/server';

// Tüm modülleri getir
export async function GET(request: NextRequest) {
  try {
    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/modules', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Modules API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modüller yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Yeni modül oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { module_name, module_description, category, icon, route_path, is_active } = body;

    // Validation
    if (!module_name || !module_description) {
      return NextResponse.json(
        {
          status: "error",
          message: "Modül adı ve açıklaması gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/create-module', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module_name,
        module_description,
        category,
        icon,
        route_path,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Create module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül oluşturulurken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Modül bilgilerini güncelle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { module_id, module_name, module_description, category, icon, route_path, is_active } = body;

    // Validation
    if (!module_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Modül ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch('https://api.btrapor.com/super-admin/update-module', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module_id,
        module_name,
        module_description,
        category,
        icon,
        route_path,
        is_active
      })
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Update module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül güncellenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}

// Modülü sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    if (!moduleId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Modül ID'si gereklidir!"
        },
        { status: 400 }
      );
    }

    // External API'ye istek gönder
    const response = await fetch(`https://api.btrapor.com/super-admin/delete-module/${moduleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Delete module API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "Modül silinirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
