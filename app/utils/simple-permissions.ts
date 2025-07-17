// Basit Rapor Yetkilendirme Sistemi - Plan yok, sadece rapor erişimi

export interface CompanyReport {
  id: number;
  report_name: string;
  report_description: string;
  has_access: boolean;
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

// Rapor kategorileri ve route'ları
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
  },
  'Fatura Kontrol': {
    name: 'Finansal Raporlar',
    icon: 'calculator',
    route: '/fatura-kontrol'
  }
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

    // Raporları kategorilendir (yetki bilgisi API'den geliyor)
    const reports = data.all_reports.map((report: CompanyReport) => {
      const category = REPORT_CATEGORIES[report.report_name] || {
        name: 'Diğer Raporlar',
        icon: 'folder',
        route: `/${report.report_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`
      };

      return {
        ...report,
        route_path: category.route,
        icon: category.icon,
        category: category.name
        // has_access zaten API'den geliyor, tekrar set etmeye gerek yok
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