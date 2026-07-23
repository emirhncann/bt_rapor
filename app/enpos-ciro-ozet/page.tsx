'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import EnposCiroTable from '../components/tables/CiroTable';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';

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
  return displayDate;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function EnposCiroOzet() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [animationData, setAnimationData] = useState(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showBelgeDetay, setShowBelgeDetay] = useState(false);
  const [belgeDetayLoading, setBelgeDetayLoading] = useState(false);
  const [belgeDetayRows, setBelgeDetayRows] = useState<any[]>([]);
  const [belgeDetayMeta, setBelgeDetayMeta] = useState<{
    tarih: string;
    subeNo: number;
    total: number;
  } | null>(null);

  const router = useRouter();

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

  const parseRows = (result: any): any[] => {
    if (result.results && Array.isArray(result.results)) return result.results;
    if (result.data && Array.isArray(result.data)) return result.data;
    if (Array.isArray(result)) return result;
    if (result.recordset && Array.isArray(result.recordset)) return result.recordset;
    return [];
  };

  const toSqlDateOnly = (val: string): string => {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const converted = convertDisplayToSQL(val);
    if (converted) return converted;
    try {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {
      /* ignore */
    }
    return val;
  };

  const formatDisplayDate = (val: string): string => {
    const sql = toSqlDateOnly(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sql)) {
      const [y, m, d] = sql.split('-');
      return `${d}.${m}.${y}`;
    }
    return val;
  };

  const fetchBelgeTipiDetay = async (payload: {
    belgetarih: string;
    subeNo: number;
    belgeSayisi: number;
  }) => {
    setShowBelgeDetay(true);
    setBelgeDetayLoading(true);
    setBelgeDetayRows([]);
    setBelgeDetayMeta({
      tarih: formatDisplayDate(payload.belgetarih),
      subeNo: payload.subeNo,
      total: payload.belgeSayisi,
    });

    try {
      const companyRef = sessionStorage.getItem('companyRef');
      const cached = sessionStorage.getItem('connectionInfo');
      if (!companyRef || !cached) {
        showErrorMessage('Bağlantı bilgileri bulunamadı.');
        return;
      }

      const connectionInfo = JSON.parse(cached);
      const enposDatabaseName = connectionInfo.enpos_database_name || 'INTER_BOS';
      const enposDb = `[${enposDatabaseName}]`;
      const daySQL = toSqlDateOnly(payload.belgetarih);

      const sqlQuery = `
        SELECT
          CASE WHEN B.Belge_Tipi = 'GPS' THEN N'İade' ELSE B.Belge_Tipi END AS Belge_Tipi,
          COUNT(*) AS Adet
        FROM ${enposDb}..BELGE B
        WHERE B.Iptal = 0
          AND B.Sube_No = ${Number(payload.subeNo)}
          AND CAST(B.BELGETARIH AS DATE) = '${daySQL}'
          AND B.Belge_Tipi NOT IN ('XRP','ZRP')
        GROUP BY CASE WHEN B.Belge_Tipi = 'GPS' THEN N'İade' ELSE B.Belge_Tipi END
        ORDER BY Adet DESC, Belge_Tipi
      `;

      const response = await sendSecureProxyRequest(
        companyRef,
        'enpos_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        120000
      );

      if (!response.ok) {
        showErrorMessage('Belge tipi detayı alınamadı.');
        return;
      }

      const result = await response.json();
      const rows = parseRows(result);
      setBelgeDetayRows(rows);
      const totalFromRows = rows.reduce((s, r) => s + (Number(r.Adet) || 0), 0);
      setBelgeDetayMeta((prev) =>
        prev ? { ...prev, total: totalFromRows || prev.total } : prev
      );
    } catch (error: any) {
      console.error('Belge tipi detay hatası:', error);
      showErrorMessage(error?.message || 'Belge tipi detayı alınamadı.');
    } finally {
      setBelgeDetayLoading(false);
    }
  };

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
        const ozetReport = allReports.find(
          (r: any) =>
            r.route === 'enpos-ciro-ozet' ||
            r.route_path === '/enpos-ciro-ozet' ||
            (r.report_name?.toLocaleLowerCase('tr-TR').includes('enpos') &&
              r.report_name?.toLocaleLowerCase('tr-TR').includes('ciro') &&
              (r.report_name?.toLocaleLowerCase('tr-TR').includes('özet') ||
                r.report_name?.toLocaleLowerCase('tr-TR').includes('ozet')))
        );

        if (!ozetReport) {
          setHasAccess(true);
        } else {
          setHasAccess(ozetReport.has_access);
        }

        if (ozetReport && !ozetReport.has_access) {
          router.push('/?error=access_denied&report=enpos-ciro-ozet');
          return;
        }
      } catch (error) {
        console.error('Enpos Ciro Özet - erişim hatası:', error);
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
      const enposDatabaseName = connectionInfo.enpos_database_name || 'INTER_BOS';
      const enposDb = `[${enposDatabaseName}]`;

      const startSQL = convertDisplayToSQL(startDate) || startDate;
      const endSQL = convertDisplayToSQL(endDate) || endDate;

      // Enpos Ciro metrikleri, gün + şube bazlı; LK/Logo join yok
      const sqlQuery = `
        SELECT
          CAST(B.BELGETARIH AS DATE) AS BELGETARIH,
          B.Sube_No,
          COUNT(*) AS [Belge Sayısı],
          SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT', 'EFA') THEN CASHTOTAL ELSE 0 END) AS 'NAKİT SATIŞ',
          SUM(CASE WHEN B.Belge_Tipi IN ('EAR', 'FIS','FAT', 'EFA') THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İLE SATIŞ',
          SUM(CASE WHEN B.Belge_Tipi='YMK' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS 'YEMEK KARTI',
          SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL ELSE 0 END) AS 'NAKİT İADE',
          SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CREDITTOTAL ELSE 0 END) AS 'KREDİ KARTI İADE',
          SUM(CASE WHEN B.Belge_Tipi NOT IN ('GPS','XRP','ZRP') THEN CREDITTOTAL+CASHTOTAL ELSE 0 END)
            + SUM(CASE WHEN B.Belge_Tipi='GPS' THEN CASHTOTAL+CREDITTOTAL ELSE 0 END) AS TOPLAM
        FROM ${enposDb}..BELGE B
        WHERE B.Iptal = 0
          AND B.BELGETARIH BETWEEN '${startSQL} 00:00:00.000' AND '${endSQL} 23:59:59.000'
          AND B.Belge_Tipi NOT IN ('XRP','ZRP')
        GROUP BY CAST(B.BELGETARIH AS DATE), B.Sube_No
        ORDER BY CAST(B.BELGETARIH AS DATE), B.Sube_No
      `;

      console.log('Enpos Ciro Özet SQL:', sqlQuery);

      const response = await sendSecureProxyRequest(
        companyRef,
        'enpos_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        120000
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error('Enpos Ciro Özet API hatası:', errText);
        showErrorMessage('Veri alınırken hata oluştu.');
        setData([]);
        return;
      }

      const result = await response.json();
      const rows = parseRows(result);

      setData(rows);
      console.log('Enpos Ciro Özet verisi yüklendi:', rows.length, 'kayıt');
    } catch (error: any) {
      console.error('Enpos Ciro Özet veri hatası:', error);
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
          <p className="text-slate-600 mb-4">Enpos Ciro Özet Raporu&apos;na erişim yetkiniz bulunmamaktadır.</p>
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
    <DashboardLayout title="Enpos Ciro Özet">
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
              presets: ['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth'],
            },
          ]}
          values={filterValues}
          onChange={handleFilterChange}
          onApply={fetchData}
          onReset={handleFilterReset}
          applyLabel="Raporu Getir"
          loading={loading}
        />

        {data.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <EnposCiroTable
              data={data}
              startDate={startDate}
              endDate={endDate}
              storageKey="enpos-ciro-ozet"
              defaultSortColumn="BELGETARIH"
              onBelgeSayisiClick={fetchBelgeTipiDetay}
            />
          </div>
        ) : (
          !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <h3 className="text-base font-bold text-gray-700 mb-1">Henüz Veri Yok</h3>
              <p className="text-gray-400 text-sm">
                Tarih aralığı seçip <strong className="text-emerald-600">Raporu Getir</strong> butonuna tıklayın
              </p>
            </div>
          )
        )}
      </div>

      {showBelgeDetay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Belge Tipi Dağılımı</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {belgeDetayMeta
                    ? `${belgeDetayMeta.tarih} · Şube ${belgeDetayMeta.subeNo}`
                    : 'Detay'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBelgeDetay(false);
                  setBelgeDetayRows([]);
                  setBelgeDetayMeta(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              {belgeDetayLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-10 h-10 border-4 border-slate-200 rounded-full animate-spin border-t-emerald-500" />
                  <p className="text-sm text-slate-600">Belge tipleri yükleniyor...</p>
                </div>
              ) : belgeDetayRows.length === 0 ? (
                <p className="text-sm text-center text-slate-500 py-8">Belge tipi kaydı bulunamadı.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider">
                          Belge Tipi
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wider">
                          Adet
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {belgeDetayRows.map((row, idx) => (
                        <tr key={`${row.Belge_Tipi}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                          <td className="px-3 py-2.5 text-sm font-medium text-slate-800">
                            {row.Belge_Tipi || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-right tabular-nums text-slate-900">
                            {Number(row.Adet || 0).toLocaleString('tr-TR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td className="px-3 py-2.5 text-sm font-bold text-slate-800">Toplam Belge Sayısı</td>
                        <td className="px-3 py-2.5 text-sm font-bold text-right tabular-nums text-slate-900">
                          {(belgeDetayMeta?.total ??
                            belgeDetayRows.reduce((s, r) => s + (Number(r.Adet) || 0), 0)
                          ).toLocaleString('tr-TR')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
