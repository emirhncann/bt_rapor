// Yandex Metrica helper fonksiyonları

declare global {
  interface Window {
    ym: any;
  }
}

const YANDEX_METRICA_ID = 103952085;

export const trackEvent = (eventName: string, params?: any) => {
  if (typeof window !== 'undefined' && window.ym) {
    window.ym(YANDEX_METRICA_ID, 'reachGoal', eventName, params);
    console.log('🎯 Yandex Metrica Event:', eventName, params);
  }
};

export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.ym) {
    window.ym(YANDEX_METRICA_ID, 'hit', url);
    console.log('📄 Yandex Metrica Page View:', url);
  }
};

// Özel event'ler için fonksiyonlar
export const trackReportView = (reportType: string) => {
  trackEvent('report_view', { report_type: reportType });
};

export const trackReportExport = (reportType: string, exportType: 'pdf' | 'excel' | 'print') => {
  trackEvent('report_export', { 
    report_type: reportType, 
    export_type: exportType 
  });
};

export const trackFilterUsage = (filterType: string, filterValue: string) => {
  trackEvent('filter_usage', { 
    filter_type: filterType, 
    filter_value: filterValue 
  });
};

export const trackErrorAnalysis = (errorCount: number, totalAmount: number) => {
  trackEvent('error_analysis', { 
    error_count: errorCount, 
    total_amount: totalAmount 
  });
};

export const trackUserLogin = (userId: string | number, userRole?: string) => {
  trackEvent('user_login', { 
    user_id: userId,
    user_role: userRole
  });
};

export const trackBranchSelection = (branchCount: number, branchNames: string[]) => {
  trackEvent('branch_selection', { 
    branch_count: branchCount,
    branch_names: branchNames.join(',')
  });
};

export const trackDateFilter = (datePreset: string, startDate?: string, endDate?: string) => {
  trackEvent('date_filter', { 
    date_preset: datePreset,
    start_date: startDate,
    end_date: endDate
  });
};

export const trackReportGeneration = (reportType: string, dataCount: number, totalAmount?: number) => {
  trackEvent('report_generation', {
    report_type: reportType,
    data_count: dataCount,
    total_amount: totalAmount
  });
};

export const trackAccordionToggle = (sectionName: string, isOpen: boolean) => {
  trackEvent('accordion_toggle', {
    section_name: sectionName,
    is_open: isOpen
  });
};

export const trackSearchUsage = (searchTerm: string, resultCount: number) => {
  trackEvent('search_usage', {
    search_term: searchTerm,
    result_count: resultCount
  });
};

export const trackPaginationUsage = (currentPage: number, totalPages: number, itemsPerPage: number) => {
  trackEvent('pagination_usage', {
    current_page: currentPage,
    total_pages: totalPages,
    items_per_page: itemsPerPage
  });
};

export const trackCurrencySelection = (currencyNumbers: number[]) => {
  trackEvent('currency_selection', {
    currency_count: currencyNumbers.length,
    currency_numbers: currencyNumbers.join(',')
  });
};

export const trackLoginAttempt = (email: string) => {
  trackEvent('login_attempt', {
    email: email
  });
};

export const trackFileUpload = (fileType: string, fileName?: string) => {
  trackEvent('file_upload', {
    file_type: fileType,
    file_name: fileName
  });
};
