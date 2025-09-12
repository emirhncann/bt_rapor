import { NextRequest, NextResponse } from 'next/server';

// Sistem istatistiklerini getir
export async function GET(request: NextRequest) {
  try {
    // Mock data - gerçek API hazır olana kadar
    const mockStats = {
      total_companies: 12,
      total_users: 45,
      total_modules: 8,
      active_plans: 3,
      recent_activity: [
        {
          id: 1,
          action: 'Yeni şirket eklendi',
          user_name: 'Bolu Teknoloji',
          company_name: 'ABC Şirketi',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          action: 'Kullanıcı yetkisi güncellendi',
          user_name: 'Bolu Teknoloji',
          company_name: 'XYZ Ltd.',
          created_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 3,
          action: 'Modül aktifleştirildi',
          user_name: 'Bolu Teknoloji',
          company_name: 'DEF A.Ş.',
          created_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 4,
          action: 'Plan güncellendi',
          user_name: 'Bolu Teknoloji',
          company_name: 'GHI Ltd.',
          created_at: new Date(Date.now() - 10800000).toISOString()
        },
        {
          id: 5,
          action: 'Kullanıcı eklendi',
          user_name: 'Bolu Teknoloji',
          company_name: 'JKL A.Ş.',
          created_at: new Date(Date.now() - 14400000).toISOString()
        }
      ]
    };

    // Gerçek API'yi dene (opsiyonel)
    try {
      const response = await fetch('https://api.btrapor.com/super-admin/statistics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          return NextResponse.json({
            status: "success",
            data: data.data
          });
        }
      }
    } catch (apiError) {
      console.warn('External API erişilemedi, mock data kullanılıyor:', apiError);
    }

    // Mock data döndür
    return NextResponse.json({
      status: "success",
      data: mockStats
    });

  } catch (error) {
    console.error('Statistics API error:', error);
    return NextResponse.json(
      {
        status: "error",
        message: "İstatistikler yüklenirken hata oluştu."
      },
      { status: 500 }
    );
  }
}
