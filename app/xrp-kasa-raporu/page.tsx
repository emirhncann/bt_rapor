'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import XrpKasaTable from '../components/tables/XrpKasaTable';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';

// DD/MM/YYYY formatını YYYY-MM-DD'ye çevir (SQL için)
function convertDisplayToSQL(displayDate: string): string {
  if (!displayDate) return '';
  if (displayDate.includes('/')) {
    const parts = displayDate.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (dd && mm && yyyy && yyyy.length === 4) {
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }
  }
  // Zaten YYYY-MM-DD formatındaysa
  return displayDate;
}

// ISO (YYYY-MM-DD) formatını display için kullan
function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function XrpKasaRaporu() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [animationData, setAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const router = useRouter();

  // Tarih filtreleri - varsayılan bu ay
  const getDefaultDates = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: toIsoDate(firstDay),
      end: toIsoDate(today),
    };
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const [filterValues, setFilterValues] = useState<FilterValues>(() => ({
    tarih: { start: defaults.start, end: defaults.end },
  }));

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'tarih') {
      const dr = value as DateRangeValue;
      if (dr?.start) setStartDate(dr.start);
      if (dr?.end) setEndDate(dr.end);
    }
  };

  const handleFilterReset = () => {
    const d = getDefaultDates();
    setStartDate(d.start);
    setEndDate(d.end);
    setFilterValues({ tarih: { start: d.start, end: d.end } });
  };

  const showErrorMessage = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 5000);
  };

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  // Rapor erişim kontrolü
  useEffect(() => {
    const checkReportAccess = async () => {
      try {
        setIsCheckingAccess(true);
        const currentUser = getCurrentUser();
        if (!currentUser) {
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const companyRef = sessionStorage.getItem('companyRef');
        if (!companyRef) {
          setHasAccess(false);
          setIsCheckingAccess(false);
          return;
        }

        const { reports: allReports } = await fetchUserReports(companyRef, currentUser.id);
        const xrpReport = allReports.find(
          (r: any) =>
            r.route === 'xrp-kasa-raporu' ||
            r.route_path === '/xrp-kasa-raporu' ||
            r.report_name?.toLocaleLowerCase('tr-TR').includes('xrp') ||
            r.report_name?.toLocaleLowerCase('tr-TR').includes('kasa')
        );

        if (!xrpReport) {
          setHasAccess(true);
        } else {
          setHasAccess(xrpReport.has_access);
        }

        if (xrpReport && !xrpReport.has_access) {
          router.push('/?error=access_denied&report=xrp-kasa-raporu');
          return;
        }
      } catch (error) {
        console.error('XRP Kasa Raporu - erişim hatası:', error);
        setHasAccess(true);
      } finally {
        setIsCheckingAccess(false);
      }
    };
    checkReportAccess();
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/animations/rapor.json')
        .then((res) => res.json())
        .then((data) => setAnimationData(data))
        .catch(() => null);
    }
  }, [isAuthenticated]);

  // Connection bilgilerini önceden yükle
  useEffect(() => {
    const preload = async () => {
      if (!isAuthenticated) return;
      const cached = sessionStorage.getItem('connectionInfo');
      if (cached) {
        try {
          JSON.parse(cached);
          return;
        } catch {
          /* invalid */
        }
      }

      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) return;

      try {
        const url =
          process.env.NODE_ENV === 'development'
            ? `/api/btrapor/connection-info/${companyRef}`
            : `https://api.btrapor.com/connection-info/${companyRef}`;
        const res = await fetch(url);
        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data) {
          sessionStorage.setItem('connectionInfo', JSON.stringify(json.data));
        }
      } catch {
        /* ignore */
      }
    };
    preload();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    setShowError(false);

    try {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        showErrorMessage('Şirket bilgisi bulunamadı.');
        return;
      }

      const cached = sessionStorage.getItem('connectionInfo');
      if (!cached) {
        showErrorMessage('Bağlantı bilgileri bulunamadı.');
        return;
      }

      const connectionInfo = JSON.parse(cached);
      const enposDbName = connectionInfo.enpos_database_name || 'INTER_BOS';
      const logoKurulumDbName = connectionInfo.logoKurulumDbName || 'GO3';
      const birngidaDbName = connectionInfo.first_db_name || 'BIRNGIDA';
      const firmaNoRaw = connectionInfo.first_firma_no ?? connectionInfo.firmaNo ?? '102';
      const firmaNoPadded = String(firmaNoRaw).padStart(3, '0');
      const firmaNrInt = parseInt(String(firmaNoRaw), 10);
      const firmaNr = isNaN(firmaNrInt) ? 102 : firmaNrInt;

      const startSQL = convertDisplayToSQL(startDate) || startDate;
      const endSQL = convertDisplayToSQL(endDate) || endDate;

      // Veritabanı adları rakam/özel karakter ile başlayabildiği için köşeli parantez kullanıyoruz (örn. 1N_INTER_BOS)
      const enposDb = `[${enposDbName}]`;
      const birngidaDb = `[${birngidaDbName}]`;
      const logoDb = `[${logoKurulumDbName}]`;

      const sqlQuery = `
        SELECT
          B.BELGETARIH,
          D.NR AS [Şube No],
          CASE
            WHEN CHARINDEX('-', D.NAME) > 0
            THEN LTRIM(RTRIM(
              SUBSTRING(D.NAME, CHARINDEX('-', D.NAME) + 1, LEN(D.NAME))
            ))
            ELSE D.NAME
          END AS [Şube Adı],
          B.Kasa_No,
          COUNT(*) AS Adet
        FROM ${enposDb}..BELGE B
        LEFT JOIN ${birngidaDb}..LK_${firmaNoPadded}_POSKS K ON K.KSCODE = B.Kasa_No
        LEFT JOIN ${logoDb}..L_CAPIDIV D ON K.DIVREF = D.NR AND D.FIRMNR = ${firmaNr}
        WHERE B.Belge_Tipi = 'XRP'
          AND CAST(B.BELGETARIH AS DATE) >= '${startSQL}'
          AND CAST(B.BELGETARIH AS DATE) <= '${endSQL}'
        GROUP BY B.Kasa_No, B.BELGETARIH, D.NR, D.NAME
        ORDER BY D.NR, B.BELGETARIH
      `;

      console.log('XRP Kasa SQL:', sqlQuery);

      const response = await sendSecureProxyRequest(
        companyRef,
        'enpos_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        120000
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('XRP Kasa API hatası:', errText);
        showErrorMessage('Veri alınırken hata oluştu.');
        setData([]);
        return;
      }

      const result = await response.json();
      let rows: any[] = [];
      if (result.results && Array.isArray(result.results)) {
        rows = result.results;
      } else if (result.data && Array.isArray(result.data)) {
        rows = result.data;
      } else if (Array.isArray(result)) {
        rows = result;
      } else if (result.recordset && Array.isArray(result.recordset)) {
        rows = result.recordset;
      }

      setData(rows);
      console.log('XRP Kasa verisi yüklendi:', rows.length, 'kayıt');
    } catch (error: any) {
      console.error('XRP Kasa veri hatası:', error);
      showErrorMessage(error?.message || 'Veriler alınırken bir hata oluştu.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 border border-slate-200">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-slate-200 rounded-full animate-spin border-t-emerald-500" />
            <p className="text-slate-700 font-medium text-lg mt-6">
              {isCheckingAuth ? 'Giriş kontrolü yapılıyor...' : 'Rapor yetkileri kontrol ediliyor...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Erişim Reddedildi</h2>
          <p className="text-slate-600 mb-4">XRP Kasa Raporu&apos;na erişim yetkiniz bulunmamaktadır.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 font-medium transition-colors"
          >
            Anasayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout title="XRP Kasa Raporu">
      {showError && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700">
          {errorMessage}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 border border-slate-200">
            {animationData ? (
              <Lottie animationData={animationData} style={{ height: 120, width: 120 }} loop />
            ) : (
              <div className="w-12 h-12 border-4 border-slate-200 rounded-full animate-spin border-t-emerald-500" />
            )}
            <p className="text-slate-700 font-medium">Veriler yükleniyor...</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <ReportFilterPanel
          filters={[
            {
              type: 'dateRange',
              id: 'tarih',
              label: 'Tarih Aralığı',
              presets: ['thisMonth', 'lastMonth', 'thisYear'],
            },
          ]}
          values={filterValues}
          onChange={handleFilterChange}
          onApply={fetchData}
          onReset={handleFilterReset}
          applyLabel="Raporu Getir"
          loading={loading}
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <XrpKasaTable data={data} />
        </div>
      </div>
    </DashboardLayout>
  );
}
