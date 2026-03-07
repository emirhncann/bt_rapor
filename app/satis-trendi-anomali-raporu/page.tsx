'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
  ComposedChart,
  Legend,
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { fetchUserReports, getCurrentUser } from '../utils/simple-permissions';
import { sendSecureProxyRequest } from '../utils/api';
import ReportFilterPanel, { FilterValues, DateRangeValue } from '../components/ReportFilterPanel';
import SatisTrendiAnomaliTable from '../components/tables/SatisTrendiAnomaliTable';

interface SatisTrendiRow {
  Tarih?: string;
  Satis?: number;
  Iade?: number;
  NetSatis?: number;
  GunlukDegisim?: number;
  KumulatifSatis?: number;
  KumulatifNetSatis?: number;
  IadeOrani?: number;
  ZScoreNet?: number;
  ZScoreIade?: number;
  NetSatisDurum?: string;
  IadeDurum?: string;
}

function formatDateToYMD(date: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function parseDateSafe(val: string | Date | object | null | undefined): Date | null {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let strVal: string | Date = val as string | Date;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    const v = (val as { value: unknown }).value;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    strVal = v as string;
  }
  const s = String(strVal).trim();
  if (!s || s === 'undefined' || s === 'null') return null;
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    d = new Date(s.includes('T') ? s : s + 'T12:00:00');
  } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [day, month, year] = s.split('.').map(Number);
    d = new Date(year, month - 1, day);
  } else if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) {
    d = new Date(s.replace(/\//g, '-'));
  } else {
    d = new Date(s);
  }
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTR(dateStr: string | undefined): string {
  const d = parseDateSafe(dateStr);
  if (!d) return '—';
  try {
    return d.toLocaleDateString('tr-TR');
  } catch {
    return '—';
  }
}

function formatShortDate(dateStr: string | undefined): string {
  const d = parseDateSafe(dateStr);
  if (!d) return '';
  try {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

function formatNumber(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function getDurumBadgeClass(durum: string | undefined): string {
  if (!durum) return 'bg-gray-100 text-gray-600';
  const d = durum.toLowerCase();
  if (d.includes('güçlü anomali')) return 'bg-red-100 text-red-700';
  if (d.includes('anomali')) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function formatCurrencyShort(val: number): string {
  if (val == null || isNaN(val)) return '—';
  if (Math.abs(val) >= 1_000_000) return `₺${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `₺${(val / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function isAnomali(durum: string | undefined): boolean {
  if (!durum) return false;
  const d = durum.toLowerCase();
  return d.includes('anomali');
}

// Stored procedure oluşturma scriptleri (sayfa açıldığında ilk gönderilecek)
const DROP_PROCEDURE_SQL = `/* EMIR */ IF OBJECT_ID('dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit`;

const TRCODE_OPTIONS = [
  { value: '2', label: 'Perakende Satış İadesi' },
  { value: '3', label: 'Toptan Satış İadesi' },
  { value: '7', label: 'Perakende Satış' },
  { value: '8', label: 'Toptan Satış' },
];

const CREATE_PROCEDURE_SQL = [
  "/* EMIR */",
  "CREATE PROCEDURE dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit",
  "(",
  "      @FirmNo INT",
  "    , @PeriodNo INT",
  "    , @DateFrom DATE",
  "    , @DateTo DATE",
  "    , @TrcodeList NVARCHAR(100) = '2,3,7,8'",
  ")",
  "AS",
  "BEGIN",
  "    SET NOCOUNT ON;",
  "    SET ARITHABORT ON;",
  "    SET ANSI_WARNINGS ON;",
  "    DECLARE @sql NVARCHAR(MAX);",
  "    DECLARE @F3 VARCHAR(3) = RIGHT('000' + CAST(@FirmNo AS VARCHAR(3)), 3);",
  "    DECLARE @P2 VARCHAR(2) = RIGHT('00' + CAST(@PeriodNo AS VARCHAR(2)), 2);",
  "    DECLARE @STLINE_FQN NVARCHAR(200) = QUOTENAME('LG_' + @F3 + '_' + @P2 + '_STLINE');",
  "    SET @sql = '",
  "    WITH GunlukSatis AS (",
  "        SELECT CAST(SL.DATE_ AS DATE) AS Tarih,",
  "            SUM(CASE WHEN SL.TRCODE IN (7,8) THEN SL.LINENET ELSE 0 END) AS Satis,",
  "            SUM(CASE WHEN SL.TRCODE IN (2,3) THEN SL.LINENET ELSE 0 END) AS Iade",
  "        FROM [dbo].' + @STLINE_FQN + ' SL WITH(NOLOCK)",
  "        WHERE SL.LINETYPE = 0 AND SL.DATE_ >= @DateFrom AND SL.DATE_ < DATEADD(DAY,1,@DateTo)",
  "            AND (LEN(@TrcodeList) = 0 OR SL.TRCODE IN (SELECT CAST(LTRIM(RTRIM(n.value(''.'',''NVARCHAR(MAX)''))) AS INT) FROM (SELECT CAST(''<x>'' + REPLACE(@TrcodeList, '','', ''</x><x>'') + ''</x>'' AS XML) AS X) AS A CROSS APPLY A.X.nodes(''x'') AS T(n)))",
  "        GROUP BY CAST(SL.DATE_ AS DATE)",
  "    ),",
  "    Netler AS (",
  "        SELECT Tarih, Satis, Iade, Satis - Iade AS NetSatis,",
  "            Iade * 100.0 / NULLIF(Satis,0) AS IadeOrani",
  "        FROM GunlukSatis",
  "    ),",
  "    Stats AS (",
  "        SELECT *, AVG(NetSatis) OVER() AS OrtalamaNet, STDEV(NetSatis) OVER() AS StdNet,",
  "            AVG(IadeOrani) OVER() AS OrtalamaIadeOrani, STDEV(IadeOrani) OVER() AS StdIadeOrani",
  "        FROM Netler",
  "    ),",
  "    ZHesap AS (",
  "        SELECT *, (NetSatis - OrtalamaNet) / NULLIF(StdNet,0) AS ZScoreNet,",
  "            (IadeOrani - OrtalamaIadeOrani) / NULLIF(StdIadeOrani,0) AS ZScoreIade",
  "        FROM Stats",
  "    )",
  "    SELECT Tarih, Satis, Iade, NetSatis,",
  "        NetSatis - LAG(NetSatis) OVER (ORDER BY Tarih) AS GunlukDegisim,",
  "        SUM(Satis) OVER (ORDER BY Tarih ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS KumulatifSatis,",
  "        SUM(NetSatis) OVER (ORDER BY Tarih ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS KumulatifNetSatis,",
  "        IadeOrani, ZScoreNet, ZScoreIade,",
  "        CASE WHEN ABS(ZScoreNet) >= 3 THEN ''Güçlü Anomali'' WHEN ABS(ZScoreNet) >= 2 THEN ''Anomali'' ELSE ''Normal'' END AS NetSatisDurum,",
  "        CASE WHEN ABS(ZScoreIade) >= 3 THEN ''Güçlü Anomali'' WHEN ABS(ZScoreIade) >= 2 THEN ''Anomali'' ELSE ''Normal'' END AS IadeDurum",
  "    FROM ZHesap ORDER BY Tarih;';",
  "    EXEC sp_executesql @sql, N'@DateFrom DATE, @DateTo DATE, @TrcodeList NVARCHAR(100)', @DateFrom, @DateTo, @TrcodeList;",
  "END",
].join("\n");

export default function SatisTrendiAnomaliRaporu() {
  const [data, setData] = useState<SatisTrendiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [procedureReady, setProcedureReady] = useState(false);
  const [procedureError, setProcedureError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [animationData, setAnimationData] = useState(null);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);
  const [selectedTrcodes, setSelectedTrcodes] = useState<string[]>(['2', '3', '7', '8']);

  const router = useRouter();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateToYMD(d);
  });
  const [endDate, setEndDate] = useState(formatDateToYMD(new Date()));

  const [filterValues, setFilterValues] = useState<FilterValues>({
    dateRange: { start: startDate, end: endDate },
    trcode: ['2', '3', '7', '8'],
  });

  const handleFilterChange = (key: string, value: import('../components/ReportFilterPanel').FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    if (key === 'dateRange') {
      const dr = value as DateRangeValue;
      if (dr?.start) setStartDate(dr.start);
      if (dr?.end) setEndDate(dr.end);
    } else if (key === 'trcode') {
      setSelectedTrcodes((value as string[]) ?? ['2', '3', '7', '8']);
    }
  };

  const handleFilterReset = () => {
    const d = new Date();
    const start = formatDateToYMD(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const end = formatDateToYMD(d);
    setStartDate(start);
    setEndDate(end);
    setSelectedTrcodes(['2', '3', '7', '8']);
    setFilterValues({ dateRange: { start, end }, trcode: ['2', '3', '7', '8'] });
  };

  const handleApplyFilters = async () => {
    await fetchReportData();
    setHasFetched(true);
  };

  // KPI ve grafik verileri
  const { kpiStats, chartData } = useMemo(() => {
    if (!data.length) return { kpiStats: null, chartData: [] };
    const last = data[data.length - 1] as Record<string, unknown>;
    const kumSatis = Number(last.KumulatifSatis ?? last.kumulatifSatis ?? 0);
    const kumNet = Number(last.KumulatifNetSatis ?? last.kumulatifNetSatis ?? 0);
    const toplamIade = data.reduce((sum, r) => sum + Number((r as Record<string, unknown>).Iade ?? (r as Record<string, unknown>).iade ?? 0), 0);
    const ortalamaIadeOrani = data.reduce((sum, r) => {
      const v = Number((r as Record<string, unknown>).IadeOrani ?? (r as Record<string, unknown>).iadeOrani ?? 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0) / data.length;
    const anomaliGunleri = data.filter(r => {
      const net = String((r as Record<string, unknown>).NetSatisDurum ?? (r as Record<string, unknown>).netSatisDurum ?? '');
      const iade = String((r as Record<string, unknown>).IadeDurum ?? (r as Record<string, unknown>).iadeDurum ?? '');
      return isAnomali(net) || isAnomali(iade);
    }).length;

    const chartData = data.map((r) => {
      const row = r as Record<string, unknown>;
      const tarih = String(row.Tarih ?? row.tarih ?? '').trim();
      const netSatis = Number(row.NetSatis ?? row.netSatis ?? 0);
      const iadeOrani = Number(row.IadeOrani ?? row.iadeOrani ?? 0);
      const netAnomali = isAnomali(String(row.NetSatisDurum ?? row.netSatisDurum ?? ''));
      const iadeAnomali = isAnomali(String(row.IadeDurum ?? row.iadeDurum ?? ''));
      const shortDate = formatShortDate(tarih || undefined);
      const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(tarih);
      const fallback = ymd ? `${ymd[3]}/${ymd[2]}` : '';
      return {
        name: tarih,
        shortDate: shortDate || fallback,
        netSatis,
        iadeOrani,
        netAnomali,
        iadeAnomali,
      };
    });

    return {
      kpiStats: {
        kumulatifSatis: kumSatis,
        kumulatifNetSatis: kumNet,
        toplamIade: toplamIade,
        ortalamaIadeOrani,
        anomaliGunleri,
        gunSayisi: data.length,
      },
      chartData,
    };
  }, [data]);

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
      setIsAuthenticated(true);
    } else {
      router.push('/login');
    }
    setIsCheckingAuth(false);
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
        const report = allReports.find(r =>
          r.report_name.toLocaleLowerCase('tr-TR').includes('satış trendi') ||
          r.report_name.toLocaleLowerCase('tr-TR').includes('anomali') ||
          (r.route_path && r.route_path.includes('satis-trendi-anomali'))
        );
        if (!report) {
          setHasAccess(true);
          setIsCheckingAccess(false);
          return;
        }
        setHasAccess(report.has_access);
        if (!report.has_access) {
          router.push('/?error=access_denied&report=satis-trendi-anomali-raporu');
        }
      } catch {
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
        .then(res => res.json())
        .then(d => setAnimationData(d))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Sayfa açıldığında ilk adım: stored procedure oluştur
  useEffect(() => {
    if (!isAuthenticated || !hasAccess || isCheckingAuth || isCheckingAccess) return;

    const ensureProcedure = async () => {
      const companyRef = sessionStorage.getItem('companyRef');
      if (!companyRef) {
        setProcedureReady(true); // Devam et, rapor getirirken hata alırsa gösteririz
        return;
      }

      try {
        setProcedureError(null);
        // 1. Önce DROP (varsa)
        await sendSecureProxyRequest(companyRef, 'first_db_key', { query: DROP_PROCEDURE_SQL }, 'https://api.btrapor.com/proxy', 30000);
        // 2. Sonra CREATE
        const res = await sendSecureProxyRequest(companyRef, 'first_db_key', { query: CREATE_PROCEDURE_SQL }, 'https://api.btrapor.com/proxy', 30000);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.message || 'Procedure oluşturulamadı');
        }
        setProcedureReady(true);
      } catch (err: any) {
        console.error('Procedure oluşturma hatası:', err);
        setProcedureError(err?.message || 'Stored procedure oluşturulamadı');
        setProcedureReady(true); // Yine de raporu getir butonunu göster, belki procedure zaten vardır
      }
    };

    ensureProcedure();
  }, [isAuthenticated, hasAccess, isCheckingAuth, isCheckingAccess]);

  const fetchReportData = async () => {
    const companyRef = sessionStorage.getItem('companyRef');
    if (!companyRef) {
      alert('Şirket bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      let connectionInfo: any = null;
      const cached = sessionStorage.getItem('connectionInfo');
      if (cached) {
        try {
          connectionInfo = JSON.parse(cached);
        } catch {}
      }
      if (!connectionInfo) {
        const res = await fetch(`https://api.btrapor.com/connection-info/${companyRef}`);
        const json = await res.json();
        if (!res.ok || json.status !== 'success' || !json.data) {
          alert('Veritabanı bağlantı bilgileri alınamadı.');
          setLoading(false);
          return;
        }
        connectionInfo = json.data;
        sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
      }

      const firmaNo = parseInt(String(connectionInfo.first_firma_no || '102'), 10) || 102;
      const donemNo = parseInt(String(connectionInfo.first_donem_no || '1'), 10) || 1;
      const trcodeList = (selectedTrcodes.length ? selectedTrcodes : ['2', '3', '7', '8']).join(',');

      const sqlQuery = `
EXEC dbo.sp_Rv1_GunlukSatisTrendAnomaliTespit 
     @FirmNo = ${firmaNo}, 
     @PeriodNo = ${donemNo}, 
     @DateFrom = '${startDate}', 
     @DateTo   = '${endDate}',
     @TrcodeList = '${trcodeList}'
`;

      const response = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        120000
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        alert(`Veri çekilirken hata: ${errData.error || response.statusText}`);
        setData([]);
        setLoading(false);
        return;
      }

      const jsonData = await response.json();
      let rows: SatisTrendiRow[] = [];
      if (Array.isArray(jsonData)) {
        rows = jsonData;
      } else if (jsonData?.data && Array.isArray(jsonData.data)) {
        rows = jsonData.data;
      } else if (jsonData?.results && Array.isArray(jsonData.results)) {
        rows = jsonData.results;
      } else if (jsonData?.recordset && Array.isArray(jsonData.recordset)) {
        rows = jsonData.recordset;
      }

      setData(rows);
    } catch (err: any) {
      console.error(err);
      alert('Veri yüklenirken hata oluştu. Lütfen tekrar deneyin.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (isCheckingAuth || isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border border-white/20">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white/30 rounded-full animate-spin border-l-white"></div>
            </div>
            <p className="text-white font-medium text-lg mt-6">
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
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600 mb-4">
            <strong>Satış Trendi ve Anomali Analiz Raporu</strong>'na erişim yetkiniz bulunmamaktadır.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Anasayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout title="Satış Trendi ve Anomali Analiz Raporu">
      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
            {animationData ? (
              <Lottie animationData={animationData} style={{ height: 120, width: 120 }} loop autoplay />
            ) : (
              <svg className="animate-spin w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <p className="text-gray-700 font-semibold">Rapor hazırlanıyor...</p>
          </div>
        </div>
      )}

      <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-emerald-700/10 rounded-full blur-2xl" />
          </div>
          <div className="relative px-4 lg:px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-11 h-11 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-white">Satış Trendi ve Anomali Analiz Raporu</h1>
                    <span className="hidden sm:inline text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full">Analiz</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">Günlük satış trendi ve Z-score anomali tespiti</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-6 py-5 bg-gray-50 min-h-screen space-y-5">
          {!procedureReady && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <svg className="animate-spin w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Stored procedure hazırlanıyor...</span>
            </div>
          )}
          {procedureError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <svg className="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{procedureError} — Procedure zaten mevcutsa &quot;Raporu Getir&quot; ile devam edebilirsiniz.</span>
            </div>
          )}
          <ReportFilterPanel
            filters={[
              {
                type: 'dateRange',
                id: 'dateRange',
                label: 'Tarih Aralığı',
                presets: ['thisMonth', 'lastMonth', 'last3Months', 'thisYear'],
              },
              {
                type: 'multiSelect',
                id: 'trcode',
                label: 'Belge Türleri',
                options: TRCODE_OPTIONS,
                placeholder: 'Tümü',
                searchable: false,
              },
            ]}
            values={filterValues}
            onChange={handleFilterChange}
            onApply={handleApplyFilters}
            onReset={handleFilterReset}
            loading={loading || !procedureReady}
          />

          {/* Grafik - Net Satış + İade Oranı (Yukarıda) */}
          {data.length > 0 && chartData.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700">
              <h3 className="text-white font-semibold mb-4">NET SATIŞ TRENDİ & İADE ORANI</h3>
              <div className="flex flex-wrap gap-4 mb-3">
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-3 h-0.5 bg-emerald-500" /> Net Satış
                </span>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-3 h-3 rounded-sm bg-blue-500/80" /> İade Oranı
                </span>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Anomali
                </span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="shortDate" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={v => `%${v.toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }}
                      labelFormatter={(label: unknown) => `Tarih: ${label != null && String(label) !== 'Invalid Date' ? label : '—'}`}
                      formatter={(value: number | undefined, name: string | undefined) => {
                        const n = name ?? '';
                        if (n === 'Net Satış') return [formatCurrencyShort(value ?? 0), n];
                        return [`%${Number(value ?? 0).toFixed(2)}`, n];
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} formatter={(value) => <span className="text-slate-400 text-sm">{value}</span>} />
                    <Bar yAxisId="right" dataKey="iadeOrani" fill="#3b82f6" fillOpacity={0.7} radius={[2, 2, 0, 0]} name="İade Oranı">
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.iadeAnomali ? '#f97316' : '#3b82f6'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="netSatis"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!payload?.netAnomali) return null;
                        return <circle cx={cx} cy={cy} r={6} fill="#f43f5e" stroke="#1e293b" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 4 }}
                      name="Net Satış"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* KPI + Detay Tablosu (Akordiyon) */}
          {data.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {kpiStats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-gray-200 bg-slate-50">
                  <div className="p-4 border-r border-b lg:border-b-0 border-gray-200">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Kümülatif Satış</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{formatCurrencyShort(kpiStats.kumulatifSatis)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{kpiStats.gunSayisi} gün</p>
                  </div>
                  <div className="p-4 border-r border-b lg:border-b-0 border-gray-200">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Kümülatif Net Satış</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{formatCurrencyShort(kpiStats.kumulatifNetSatis)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">İade sonrası</p>
                  </div>
                  <div className="p-4 border-r border-b lg:border-b-0 border-gray-200">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Toplam İade</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{formatCurrencyShort(kpiStats.toplamIade)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Ort. %{kpiStats.ortalamaIadeOrani.toFixed(2)} oran</p>
                  </div>
                  <div className="p-4 border-b lg:border-b-0 border-gray-200">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Anomali Günleri</p>
                    <p className="text-xl font-bold text-slate-800 mt-0.5">{kpiStats.anomaliGunleri}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{kpiStats.gunSayisi} günden</p>
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsTableOpen(prev => !prev)}
                    className="flex items-center justify-between w-full sm:w-auto text-left hover:bg-slate-50/80 transition-colors -mx-2 px-2 py-1 rounded-lg"
                  >
                    <span className="font-semibold text-slate-700">Detay Tablosu</span>
                    <svg
                      className={`w-5 h-5 text-slate-500 transition-transform ${isTableOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showOnlyAnomalies}
                      onChange={e => setShowOnlyAnomalies(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Sadece anomalileri göster</span>
                  </label>
                </div>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isTableOpen ? 'max-h-[85vh]' : 'max-h-0'}`}>
                  <div className="overflow-auto border-t border-gray-200 max-h-[85vh] p-4">
                    <SatisTrendiAnomaliTable data={data as Record<string, unknown>[]} showOnlyAnomalies={showOnlyAnomalies} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && hasFetched && data.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">Veri Bulunamadı</h3>
              <p className="text-gray-400 text-sm">Seçilen tarih aralığında kayıt yok</p>
            </div>
          )}

          {!hasFetched && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">Raporu Getir</h3>
              <p className="text-gray-400 text-sm">Tarih aralığı seçip <strong className="text-emerald-600">Raporu Getir</strong> butonuna tıklayın</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
