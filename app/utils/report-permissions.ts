// Basit Rapor Yetkilendirme Sistemi

export interface CompanyReport {
  id: number;
  report_name: string;
  report_description: string;
}

export interface UserReportPermission {
  user_id: number;
  report_id: number;
  granted_by: number;
  granted_at: string;
  is_active: boolean;
}

export interface ReportWithAccess extends CompanyReport {
  route_path: string;
  icon: string;
  category: string;
  has_access: boolean;
}

// Rapor kategorileri (basit gruplandırma için)
const REPORT_CATEGORIES: {[key: string]: {name: string, icon: string, route: string}} = {
  'Enpos Ciro Raporu': {
    name: 'Satış Raporları',
    icon: 'credit-card',
    route: '/enpos-ciro'
  },
  'Cari Bakiye Raporu': {
    name: 'Finansal Raporlar', 
    icon: 'calculator',
    route: '/c-bakiye'
  },
  'Stok Raporu': {
    name: 'Stok Raporları',
    icon: 'package',
    route: '/stok-raporu'
  },
  'Müşteri Analizi': {
    name: 'Müşteri Raporları',
    icon: 'users',
    route: '/musteri-analizi'
  },
  'Satış Analizi': {
    name: 'Analiz Raporları',
    icon: 'bar-chart',
    route: '/satis-analizi'
  },
  'Gelir Gider Raporu': {
    name: 'Finansal Raporlar',
    icon: 'chart-line', 
    route: '/gelir-gider'
  }
};

// Şirket raporlarını çek ve kategorilendir
export async function fetchCompanyReportsWithPermissions(companyRef: string, userId?: number): Promise<ReportWithAccess[]> {
  try {
    // Şirket raporlarını çek
    const response = await fetch(`https://api.btrapor.com/reports-by-company/${companyRef}`);
    const data = await response.json();
    
    if (data.status !== 'success' || !data.data) {
      return [];
    }

    // Kullanıcının yetkili olduğu raporları çek (backend'den gelecek)
    let userPermissions: number[] = [];
    if (userId) {
      try {
        const permResponse = await fetch(`https://api.btrapor.com/user-report-permissions/${userId}`);
        const permData = await permResponse.json();
        if (permData.status === 'success') {
          userPermissions = permData.data.map((p: any) => p.report_id);
        }
      } catch (error) {
        console.log('Kullanıcı yetkileri alınamadı, varsayılan izinler kullanılıyor');
        // Geçici: Admin değilse sadece ilk rapora izin ver
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'admin') {
          userPermissions = data.data.map((r: CompanyReport) => r.id);
        } else {
          userPermissions = data.data.slice(0, 1).map((r: CompanyReport) => r.id);
        }
      }
    }

    // Raporları kategorilendir ve yetki bilgisi ekle
    return data.data.map((report: CompanyReport) => {
      const category = REPORT_CATEGORIES[report.report_name] || {
        name: 'Diğer Raporlar',
        icon: 'folder',
        route: `/${report.report_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`
      };

      return {
        ...report,
        route_path: category.route,
        icon: category.icon,
        category: category.name,
        has_access: userPermissions.includes(report.id)
      };
    });

  } catch (error) {
    console.error('Şirket raporları yüklenirken hata:', error);
    return [];
  }
}

// Kullanıcının erişebileceği raporları filtrele
export function filterAuthorizedReports(reports: ReportWithAccess[]): ReportWithAccess[] {
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

// Admin için tüm raporları göster, normal kullanıcı için yetkili olanları
export function getAccessibleReports(reports: ReportWithAccess[], isAdmin: boolean): ReportWithAccess[] {
  if (isAdmin) {
    return reports; // Admin tüm raporları görebilir
  }
  return filterAuthorizedReports(reports); // Normal kullanıcı sadece yetkili olanları
}

// Kullanıcı cache sistemi
export function cacheUserReports(userId: number, reports: ReportWithAccess[]) {
  if (typeof window === 'undefined') return;
  
  const cacheKey = `user_reports_${userId}`;
  const cacheData = {
    reports,
    timestamp: Date.now(),
    expires: Date.now() + (5 * 60 * 1000) // 5 dakika cache
  };
  
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));
}

export function getCachedUserReports(userId: number): ReportWithAccess[] | null {
  if (typeof window === 'undefined') return null;
  
  const cacheKey = `user_reports_${userId}`;
  const cacheData = localStorage.getItem(cacheKey);
  
  if (!cacheData) return null;
  
  try {
    const parsed = JSON.parse(cacheData);
    
    // Cache süresi dolmuş mu?
    if (Date.now() > parsed.expires) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return parsed.reports;
  } catch (error) {
    localStorage.removeItem(cacheKey);
    return null;
  }
} 