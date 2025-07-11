import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const companyRef = request.nextUrl.searchParams.get('companyRef');
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!companyRef || !userId) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'CompanyRef ve UserId gerekli' 
      }, { status: 400 });
    }

    console.log('🔄 GET /api/user-preferences çağrıldı:', { companyRef, userId });

    // Önce localStorage'dan yükle (fallback)
    console.log('📌 LocalStorage\'dan favori raporlar yükleniyor...');
    
    // Şimdilik sadece localStorage kullan, API endpoint'i hazır değil
    return NextResponse.json({
      status: 'success',
      data: {
        pinnedReports: [] // Boş array döndür
      }
    });

    /* 
    // api.btrapor.com/get-favorite-reports endpoint'i hazır olduğunda kullanılacak
    const response = await fetch('https://api.btrapor.com/get-favorite-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ref: userId
      })
    });

    if (!response.ok) {
      console.error('❌ API yanıt vermedi:', response.status, response.statusText);
      return NextResponse.json({ 
        status: 'error', 
        message: 'Tercihler yüklenemedi' 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('📡 API Response:', data);
    
    if (data.status === 'error') {
      return NextResponse.json({ 
        status: 'error', 
        message: data.message || 'Bilinmeyen hata' 
      }, { status: 500 });
    }

    // API'den gelen fav_reports string'ini array'e çevir
    const pinnedReports = data.data?.fav_reports 
      ? data.data.fav_reports.split('-').filter((id: string) => id.trim() !== '')
      : [];

    return NextResponse.json({
      status: 'success',
      data: {
        pinnedReports: pinnedReports
      }
    });
    */

  } catch (error) {
    console.error('❌ Kullanıcı tercihleri yüklenirken hata:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Sunucu hatası: ' + (error as Error).message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyRef, userId, pinnedReports } = await request.json();
    
    if (!companyRef || !userId) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'CompanyRef ve UserId gerekli' 
      }, { status: 400 });
    }

    console.log('🔄 POST /api/user-preferences çağrıldı:', { companyRef, userId, pinnedReports });

    // Şimdilik sadece başarılı yanıt döndür, API endpoint'i hazır değil
    return NextResponse.json({
      status: 'success',
      message: 'Tercihler başarıyla kaydedildi'
    });

    /*
    // api.btrapor.com/save-favorite-report endpoint'i hazır olduğunda kullanılacak
    const response = await fetch('https://api.btrapor.com/save-favorite-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ref: userId,
        report_id: pinnedReports.join('-') // 1-3-5 formatında
      })
    });

    if (!response.ok) {
      console.error('❌ API yanıt vermedi:', response.status, response.statusText);
      return NextResponse.json({ 
        status: 'error', 
        message: 'Tercihler kaydedilemedi' 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('📡 API Response:', data);
    
    if (data.status === 'error') {
      return NextResponse.json({ 
        status: 'error', 
        message: data.message || 'Bilinmeyen hata' 
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Tercihler başarıyla kaydedildi'
    });
    */

  } catch (error) {
    console.error('❌ Kullanıcı tercihleri kaydedilirken hata:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Sunucu hatası: ' + (error as Error).message
    }, { status: 500 });
  }
} 