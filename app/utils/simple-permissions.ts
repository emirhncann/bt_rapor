// Basit Rapor Yetkilendirme Sistemi - Plan yok, sadece rapor erişimi

export interface CompanyReport {
  id: number;
  report_name: string;
  report_description: string;
  has_access: boolean;
  category?: string;
  icon?: string;
  route?: string;
  route_path?: string;
}

export interface CompanyReportsResponse {
  status: string;
  licence_end: string;
  plan_name: string;
  all_reports: CompanyReport[];
}

export interface ReportWithAccess extends CompanyReport {
  route_path: string;
  icon: string;
  category: string;
  has_access: boolean;
}

// Varsayılan kategoriler (API'de kategori yoksa fallback için)
const DEFAULT_CATEGORY_INFO = {
  name: 'Diğer Raporlar',
  icon: 'folder'
};

// Şirket raporlarını çek ve yetki bilgisi ekle
export async function fetchUserReports(companyRef: string, userId?: number): Promise<{reports: ReportWithAccess[], planInfo: {planName: string, licenceEnd: string}}> {
  try {
    // Şirket raporlarını çek
    const response = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
    const data: CompanyReportsResponse = await response.json();
    
    if (data.status !== 'success' || !data.all_reports) {
      return {reports: [], planInfo: {planName: '', licenceEnd: ''}};
    }

    // Kullanıcı rolünü kontrol et
    const userRole = localStorage.getItem('userRole');
    let userPermissions: number[] = [];
    let reportsToShow: CompanyReport[] = [];

    if (userRole === 'admin') {
      // Admin kullanıcılar sadece company'nin sahip olduğu raporları görebilir
      console.log('🔑 Admin kullanıcı - company raporları gösteriliyor');
      // Company'nin sahip olduğu raporları filtrele (has_access: true olanlar)
      reportsToShow = data.all_reports.filter((report: CompanyReport) => report.has_access);
      userPermissions = reportsToShow.map((r: CompanyReport) => r.id);
    } else if (userRole === 'super_admin') {
      // Super admin kullanıcılar rapor göremez, sadece yönetim yapar
      console.log('🔧 Super admin kullanıcı - rapor erişimi yok');
      reportsToShow = [];
      userPermissions = [];
    } else {
      // User kullanıcılar sadece kendilerine atanmış raporları görebilir
      console.log('👤 User kullanıcı - sadece yetkili raporlar gösteriliyor');
      if (userId) {
        try {
          const permResponse = await fetch(`https://api.btrapor.com/user-report-permissions/${userId}`);
          const permData = await permResponse.json();
          if (permData.status === 'success' && permData.report_ids) {
            userPermissions = permData.report_ids;
            // Sadece yetkili olduğu raporları göster
            reportsToShow = data.all_reports.filter(report => 
              userPermissions.includes(report.id)
            );
          } else {
            // Yetki yoksa hiç rapor gösterme
            reportsToShow = [];
          }
        } catch (error) {
          console.log('❌ Kullanıcı yetkileri alınamadı, hiç rapor gösterilmiyor');
          reportsToShow = [];
        }
      } else {
        reportsToShow = [];
      }
    }

    // Raporları işle ve yetki bilgisi ekle
    const reports = reportsToShow.map((report: CompanyReport) => {
      return {
        ...report,
        // API'den gelen bilgileri kullan, yoksa varsayılan değerler ata
        route_path: report.route_path || `/${(report.route || report.report_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}`,
        icon: report.icon || DEFAULT_CATEGORY_INFO.icon,
        category: report.category || DEFAULT_CATEGORY_INFO.name,
        // Admin ise tüm raporlara erişim, user ise sadece yetkili raporlara, super admin rapor göremez
        has_access: userRole === 'admin' ? true : userPermissions.includes(report.id)
      };
    });

    return {
      reports,
      planInfo: {
        planName: data.plan_name || '',
        licenceEnd: data.licence_end || ''
      }
    };

  } catch (error) {
    console.error('Kullanıcı raporları yüklenirken hata:', error);
    return {reports: [], planInfo: {planName: '', licenceEnd: ''}};
  }
}

// Sadece yetkili raporları filtrele
export function getAuthorizedReports(reports: ReportWithAccess[]): ReportWithAccess[] {
  return reports.filter(report => report.has_access);
}

// Raporları kategoriye göre grupla
export function groupReportsByCategory(reports: ReportWithAccess[]): {[category: string]: ReportWithAccess[]} {
  return reports.reduce((groups, report) => {
    if (!groups[report.category]) {
      groups[report.category] = [];
    }
    groups[report.category].push(report);
    return groups;
  }, {} as {[category: string]: ReportWithAccess[]});
}

// Belirli bir rapora erişim var mı kontrol et
export function hasReportAccess(reports: ReportWithAccess[], reportId: number): boolean {
  const report = reports.find(r => r.id === reportId);
  return report ? report.has_access : false;
}

// LocalStorage'dan kullanıcı bilgilerini al
export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');
  
  if (!userId) return null;
  
  return {
    id: parseInt(userId),
    role: userRole,
    name: userName
  };
}

// Admin kullanıcı mı kontrol et
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// Super admin kullanıcı mı kontrol et
export function isSuperAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'super_admin';
}

// Sistem admini (super_admin veya admin) mı kontrol et
export function isSystemAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'super_admin' || user?.role === 'admin';
} 