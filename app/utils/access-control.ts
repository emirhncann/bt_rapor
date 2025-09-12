// Rapor Erişim Kontrolü Utility

import { getCurrentUser } from './simple-permissions';

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
  redirectTo?: string;
}

/**
 * Kullanıcının belirli bir rapora erişim yetkisi olup olmadığını kontrol eder
 * @param reportName - Rapor adı
 * @param reportId - Rapor ID'si (opsiyonel)
 * @returns AccessCheckResult
 */
export async function checkReportAccess(reportName: string, reportId?: number): Promise<AccessCheckResult> {
  try {
    const currentUser = getCurrentUser();
    const userRole = localStorage.getItem('userRole');
    const companyRef = localStorage.getItem('companyRef');

    // Temel kontroller
    if (!currentUser) {
      return {
        hasAccess: false,
        reason: 'Kullanıcı oturumu bulunamadı',
        redirectTo: '/login'
      };
    }

    if (!companyRef) {
      return {
        hasAccess: false,
        reason: 'Şirket bilgisi bulunamadı',
        redirectTo: '/login'
      };
    }

    // Admin kullanıcılar her zaman erişebilir, super admin rapor erişimi yok
    if (userRole === 'admin') {
      return { hasAccess: true };
    }

    // Super admin kullanıcılar rapor erişimi yok
    if (userRole === 'super_admin') {
      return {
        hasAccess: false,
        reason: 'Super admin kullanıcıları rapor erişimi yoktur',
        redirectTo: '/super-admin'
      };
    }

    // User kullanıcılar için yetki kontrolü
    if (userRole === 'user') {
      try {
        // Kullanıcının yetkili olduğu raporları çek
        const response = await fetch(`https://api.btrapor.com/user-report-permissions/${currentUser.id}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.report_ids) {
          const userReportIds = data.report_ids;
          
          // Report ID ile kontrol (daha güvenilir)
          if (reportId && userReportIds.includes(reportId)) {
            return { hasAccess: true };
          }
          
          // Report name ile kontrol (fallback)
          if (!reportId) {
            // Şirket raporlarını çek ve isim eşleştirmesi yap
            const companyResponse = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
            const companyData = await companyResponse.json();
            
            if (companyData.status === 'success' && companyData.all_reports) {
              const report = companyData.all_reports.find((r: any) => 
                r.report_name === reportName && userReportIds.includes(r.id)
              );
              
              if (report) {
                return { hasAccess: true };
              }
            }
          }
        }
        
        return {
          hasAccess: false,
          reason: `${reportName} raporuna erişim yetkiniz bulunmamaktadır`,
          redirectTo: '/'
        };
        
      } catch (error) {
        console.error('Yetki kontrolü sırasında hata:', error);
        return {
          hasAccess: false,
          reason: 'Yetki kontrolü yapılamadı',
          redirectTo: '/'
        };
      }
    }

    // Bilinmeyen rol
    return {
      hasAccess: false,
      reason: 'Geçersiz kullanıcı rolü',
      redirectTo: '/login'
    };

  } catch (error) {
    console.error('Erişim kontrolü sırasında hata:', error);
    return {
      hasAccess: false,
      reason: 'Erişim kontrolü yapılamadı',
      redirectTo: '/'
    };
  }
}

