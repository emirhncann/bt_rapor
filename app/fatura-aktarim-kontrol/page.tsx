'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Lottie from 'lottie-react';
import DashboardLayout from '../components/DashboardLayout';
import { sendSecureProxyRequest } from '../utils/api';

interface CheckRow {
  'Cari Hesap Kodu'?: string;
  'Cari Hesap Unvanı'?: string;
  'Tarih'?: string;
  'Kayıt No'?: number;
  'Faturalama Durumu'?: string;
  'Fatura No'?: string;
}

function sanitizeDocode(val: string | number): string {
  const str = String(val).trim();
  if (/^[\d\w\-\.]+$/.test(str)) return str;
  return str.replace(/'/g, "''");
}

export default function FaturaAktarimKontrolPage() {
  const [docode, setDocode] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingKayitNo, setUpdatingKayitNo] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<CheckRow[] | null>(null);
  const [error, setError] = useState<string>('');
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [animationData, setAnimationData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/animations/loading.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('connectionInfo');
    if (stored) {
      try {
        setConnectionInfo(JSON.parse(stored));
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
      router.push('/login');
    }
  }, [router]);

  const handleCheck = async () => {
    if (!docode.trim()) {
      setError('Lütfen Fatura No girin.');
      return;
    }
    if (!connectionInfo) {
      setError('Bağlantı bilgileri bulunamadı. Lütfen önce giriş yapın ve ayarları kontrol edin.');
      return;
    }

    const companyRef = sessionStorage.getItem('companyRef');
    if (!companyRef) {
      setError('Şirket bilgisi bulunamadı.');
      return;
    }

    setLoading(true);
    setError('');
    setCheckResult(null);
    setUpdateSuccess(null);

    try {
      const safeDocode = sanitizeDocode(docode);
      const firmaNo = String(connectionInfo.first_firma_no || '010').padStart(3, '0');
      const donemNo = String(connectionInfo.first_donem_no || '01').padStart(2, '0');

      const sqlQuery = `
        
        SELECT C.CODE [Cari Hesap Kodu],
          C.DEFINITION_ [Cari Hesap Unvanı],
          S.DATE_ [Tarih],
          S.LOGICALREF [Kayıt No],
          CASE S.BILLED WHEN 0 THEN 'Faturalanmamış' WHEN 1 THEN 'Faturalanmış' END [Faturalama Durumu],
          S.INVNO [Fatura No]
        FROM LG_${firmaNo}_${donemNo}_STFICHE S
        LEFT JOIN LG_${firmaNo}_CLCARD C ON S.CLIENTREF = C.LOGICALREF
        WHERE S.DOCODE = '${safeDocode}'
      `;

      const res = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        60000
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Kontrol işlemi başarısız');
      }

      const data = await res.json();
      const rows = data.results || data.data || [];
      setCheckResult(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kontrol sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (kayitNo: number) => {
    if (!connectionInfo) {
      setError('Bağlantı bilgileri bulunamadı.');
      return;
    }

    const companyRef = sessionStorage.getItem('companyRef');
    if (!companyRef) {
      setError('Şirket bilgisi bulunamadı.');
      return;
    }

    if (!confirm(`Kayıt No: ${kayitNo} için faturayı askıdan almak istediğinize emin misiniz?`)) {
      return;
    }

    setUpdatingKayitNo(kayitNo);
    setError('');
    setUpdateSuccess(null);

    try {
      const firmaNo = String(connectionInfo.first_firma_no || '010').padStart(3, '0');
      const donemNo = String(connectionInfo.first_donem_no || '01').padStart(2, '0');

      const sqlQuery = `
        /* EMIR */ UPDATE LG_${firmaNo}_${donemNo}_STFICHE SET BILLED = 0 WHERE LOGICALREF = ${kayitNo}
      `;

      const res = await sendSecureProxyRequest(
        companyRef,
        'first_db_key',
        { query: sqlQuery },
        'https://api.btrapor.com/proxy',
        60000
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Güncelleme işlemi başarısız');
      }

      setUpdateSuccess('Fatura askıdan alındı.');
      setCheckResult(prev => prev ? prev.filter(r => r['Kayıt No'] !== kayitNo) : null);
      setTimeout(() => setUpdateSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncelleme sırasında hata oluştu');
    } finally {
      setUpdatingKayitNo(null);
    }
  };

  const canRowAskiyaAl = (row: CheckRow) =>
    row['Fatura No'] === null ||
    row['Fatura No'] === undefined ||
    String(row['Fatura No'] ?? '').trim() === '';

  const formatDate = (val: any) => {
    if (!val) return '-';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      const [d, t] = val.split('T');
      const [y, m, day] = d.split('-');
      return t ? `${day}.${m}.${y} ${t.substring(0, 8)}` : `${day}.${m}.${y}`;
    }
    return String(val);
  };

  return (
    <DashboardLayout title="Fatura Aktarım Kontrol">
      <div className="w-full px-2">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fatura Aktarım Kontrol</h1>
                <p className="text-gray-600 mt-1">Fatura askıda mı kontrol edin, gerekirse askıdan alın</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
            Fatura No durumunu kontrol edin. Fatura No boş ise &quot;Faturayı Askıdan Al&quot; butonu aktif olur, dolu ise pasif kalır.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fatura No</label>
              <input
                type="text"
                value={docode}
                onChange={e => setDocode(e.target.value)}
                placeholder="Örn: ABC00000001"
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                onKeyDown={e => e.key === 'Enter' && handleCheck()}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCheck}
                disabled={loading || !docode.trim()}
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading || !docode.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {loading ? (
                  <>
                    {animationData && <div className="w-5 h-5 mr-2"><Lottie animationData={animationData} loop /></div>}
                    Kontrol Ediliyor...
                  </>
                ) : (
                  'Kontrol Et'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {updateSuccess && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{updateSuccess}</p>
            </div>
          )}
        </div>

        {checkResult !== null && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Kontrol Sonucu {checkResult.length > 0 ? `(${checkResult.length} kayıt)` : ''}
            </h2>
            {checkResult.length === 0 ? (
              <p className="text-gray-500">Bu DOCODE için kayıt bulunamadı.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Cari Hesap Kodu</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Cari Hesap Unvanı</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Tarih</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Kayıt No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Faturalama Durumu</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Fatura No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {checkResult.map((row, idx) => {
                      const kayitNo = row['Kayıt No'];
                      const canUpdate = kayitNo != null && canRowAskiyaAl(row);
                      const isUpdating = updatingKayitNo === kayitNo;
                      return (
                        <tr key={idx} className="hover:bg-amber-50/50">
                          <td className="px-4 py-2 text-sm text-gray-900">{row['Cari Hesap Kodu'] ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row['Cari Hesap Unvanı'] ?? '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{formatDate(row['Tarih'])}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{kayitNo ?? '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              row['Faturalama Durumu'] === 'Faturalanmış' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {row['Faturalama Durumu'] ?? '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row['Fatura No'] ?? '-'}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => kayitNo != null && handleUpdate(kayitNo)}
                              disabled={!canUpdate || isUpdating}
                              title={!canUpdate ? 'Fatura No dolu olduğu için askıdan alınamaz' : undefined}
                              className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                                !canUpdate || isUpdating
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-red-600 hover:bg-red-700 text-white'
                              }`}
                            >
                              {isUpdating ? (
                                <>
                                  {animationData && <div className="w-4 h-4 mr-1.5"><Lottie animationData={animationData} loop /></div>}
                                  Alınıyor...
                                </>
                              ) : (
                                'Askıdan Al'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
