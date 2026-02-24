'use client';

import React, { useMemo, useState, useEffect } from 'react';

interface CekSenetTimelineProps {
  data: any[];
}

type TimelineType = 'cek' | 'senet';
type TimelineOwner = 'musteri' | 'kendi';

interface TimelineItem {
  id: string | number;
  type: TimelineType;
  owner: TimelineOwner;
  amount: number;
  date: string; // YYYY-MM-DD
  payee: string;
  raw: any;
}

interface DateGroup {
  date: string; // YYYY-MM-DD
  items: TimelineItem[];
  totalAmount: number;
}

function normalizeDate(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();

  // ISO 'YYYY-MM-DDTHH:MM:SS' → sadece tarih kısmını al
  if (v.includes('T')) {
    const [datePart] = v.split('T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return v;
  }

  // DD.MM.YYYY
  if (v.includes('.')) {
    const [dd, mm, yyyy] = v.split('.');
    if (!dd || !mm || !yyyy) return null;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Son çare: Date parse edip YYYY-MM-DD üret
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function mapRowToTimelineItem(row: any): TimelineItem | null {
  const turRaw: string = row['Tür'] ?? row.Tur ?? '';
  let type: TimelineType = 'cek';
  let owner: TimelineOwner = 'musteri';

  switch (turRaw) {
    case 'Müşteri Çeki':
      type = 'cek';
      owner = 'musteri';
      break;
    case 'Kendi Çekimiz':
      type = 'cek';
      owner = 'kendi';
      break;
    case 'Müşteri Senedi':
      type = 'senet';
      owner = 'musteri';
      break;
    case 'Borç Senedimiz':
      type = 'senet';
      owner = 'kendi';
      break;
    default:
      return null;
  }

  const dateNorm = normalizeDate(row['Vade Tarihi'] ?? row.VadeTarihi);
  if (!dateNorm) return null;

  const amount = Number(row.Tutar ?? row['Tutar'] ?? row['Dövizli Tutar'] ?? 0) || 0;

  const payee: string =
    row['Çek/Senet Sahibi'] ||
    row['İlgili Hesap'] ||
    row['İlgili Hesap Adı'] ||
    '';

  const id =
    row.Referans ??
    `${row['Portföy No'] ?? ''}-${row['Seri No'] ?? ''}-${dateNorm}-${turRaw}`;

  return {
    id,
    type,
    owner,
    amount,
    date: dateNorm,
    payee,
    raw: row,
  };
}

export default function CekSenetTimeline({ data }: CekSenetTimelineProps) {
  const items = useMemo(() => {
    return (data || [])
      .map(mapRowToTimelineItem)
      .filter((x): x is TimelineItem => !!x)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const [category, setCategory] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Üstte seçilen tarih aralığındaki veri zaten data ile geliyor; sadece kategori filtresi uygula
  const filtered = useMemo(() => {
    if (!items.length) return [];

    return items.filter((item) => {
      let categoryMatch = true;
      if (category !== 'all') {
        const [type, owner] = category.split('-') as [TimelineType, TimelineOwner];
        categoryMatch = item.type === type && item.owner === owner;
      }
      return categoryMatch;
    });
  }, [items, category]);

  // Tarihe göre grupla (bubble mantığı)
  const dateGroups: DateGroup[] = useMemo(() => {
    const map = new Map<string, DateGroup>();
    for (const it of filtered) {
      const key = it.date;
      if (!map.has(key)) {
        map.set(key, { date: key, items: [], totalAmount: 0 });
      }
      const g = map.get(key)!;
      g.items.push(it);
      g.totalAmount += it.amount;
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // Seçili tarih senkronize
  useEffect(() => {
    if (!dateGroups.length) {
      setSelectedDate(null);
      setIsModalOpen(false);
      return;
    }
    if (!selectedDate || !dateGroups.some((g) => g.date === selectedDate)) {
      setSelectedDate(dateGroups[0].date);
    }
  }, [dateGroups, selectedDate]);

  const selectedGroup = useMemo(
    () => (selectedDate ? dateGroups.find((g) => g.date === selectedDate) ?? null : null),
    [dateGroups, selectedDate]
  );

  // Özet
  const summary = useMemo(() => {
    const cekCount = filtered.filter((i) => i.type === 'cek').length;
    const senetCount = filtered.filter((i) => i.type === 'senet').length;
    const totalAmount = filtered.reduce((sum, i) => sum + i.amount, 0);
    return { cekCount, senetCount, totalAmount };
  }, [filtered]);

  // Bubble pozisyonları (tarihe göre)
  const bubblePositions = useMemo(() => {
    if (!dateGroups.length) return [];
    const times = dateGroups.map((g) => toLocalDate(g.date).getTime());
    const min = times[0];
    const max = times[times.length - 1];
    const range = max - min || 1;

    return dateGroups.map((g, idx) => {
      const t = times[idx];
      const raw = ((t - min) / range) * 100;
      const left = Math.min(Math.max(raw, 5), 95);
      return { date: g.date, left };
    });
  }, [dateGroups]);

  const formatDateTR = (dateStr: string) => {
    const d = toLocalDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR');
  };

  const categoryLabel = (item: TimelineItem) => {
    const typeLabel = item.type === 'cek' ? '📝 Çek' : '📋 Senet';
    const ownerLabel = item.owner === 'kendi' ? 'Kendi' : 'Müşteri';
    return `${typeLabel} · ${ownerLabel}`;
  };

  if (!items.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-slate-500">
        Bu tarih aralığında çek/senet verisi bulunamadı.
      </div>
    );
  }

  const handleExportSelectedToExcel = () => {
    if (!selectedGroup || typeof window === 'undefined') return;

    const header = [
      'Tarih',
      'Tür',
      'Portföy/Seri',
      'Çek/Senet Sahibi',
      'İlgili Hesap',
      'Tutar',
      'Güncel Durum',
    ];

    const rows = selectedGroup.items.map((it) => {
      const tarih = formatDateTR(selectedGroup.date);
      const tur = categoryLabel(it);
      const portfoySeri = `${it.raw['Portföy No'] ?? ''}${
        it.raw['Seri No'] ? ` / ${it.raw['Seri No']}` : ''
      }`.trim() || '-';
      const sahip = it.raw['Çek/Senet Sahibi'] || it.payee || '';
      const hesap = it.raw['İlgili Hesap'] || '';
      const tutar = it.amount.toString().replace('.', ',');
      const durum = it.raw['Güncel Durumu'] || '';

      return [tarih, tur, portfoySeri, sahip, hesap, tutar, durum];
    });

    const csvContent =
      '\uFEFF' +
      [header, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              const value = String(cell ?? '');
              // noktalı virgüllü CSV
              if (value.includes(';') || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            })
            .join(';')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cek_senet_${selectedGroup.date.replace(/-/g, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintSelected = () => {
    if (!selectedGroup || typeof window === 'undefined') return;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;

    const title = `${formatDateTR(selectedGroup.date)} Çek/Senet Hareketleri`;

    const rowsHtml = selectedGroup.items
      .map((it) => {
        const portfoySeri = `${it.raw['Portföy No'] ?? ''}${
          it.raw['Seri No'] ? ` / ${it.raw['Seri No']}` : ''
        }`.trim() || '-';
        return `
          <tr>
            <td>${categoryLabel(it)}</td>
            <td>${portfoySeri}</td>
            <td>${it.raw['Çek/Senet Sahibi'] || it.payee || ''}</td>
            <td>${it.raw['İlgili Hesap'] || ''}</td>
            <td style="text-align:right;">₺${it.amount.toLocaleString('tr-TR')}</td>
            <td>${it.raw['Güncel Durumu'] || ''}</td>
          </tr>
        `;
      })
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 16px; font-size: 12px; color: #0f172a; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #111827; }
          p { margin: 0 0 6px 0; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
          th { background-color: #f3f4f6; font-size: 11px; text-transform: uppercase; text-align: left; color: #6b7280; }
          tr:nth-child(even) td { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Toplam ${selectedGroup.items.length} adet · ₺${selectedGroup.totalAmount.toLocaleString('tr-TR')}</p>
        <table>
          <thead>
            <tr>
              <th>Tür</th>
              <th>Portföy / Seri</th>
              <th>Çek/Senet Sahibi</th>
              <th>İlgili Hesap</th>
              <th style="text-align:right;">Tutar</th>
              <th>Güncel Durum</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow p-6 space-y-5">
      {/* Üst özet */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Vade Takvimi
          </p>
          <p className="text-sm text-slate-500">
            Vade tarihine göre çek ve senetleri görsel olarak takip edin. Bubble içinde her
            günün adetini görebilirsiniz.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">
              Toplam Çek
            </p>
            <p className="text-xl font-bold text-blue-700">
              {summary.cekCount.toLocaleString('tr-TR')}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">
              Toplam Senet
            </p>
            <p className="text-xl font-bold text-emerald-700">
              {summary.senetCount.toLocaleString('tr-TR')}
            </p>
          </div>
          <div className="bg-violet-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">
              Toplam Tutar
            </p>
            <p className="text-xl font-bold text-violet-700">
              ₺{summary.totalAmount.toLocaleString('tr-TR')}
            </p>
          </div>
        </div>
      </div>

      {/* Filtreler: sadece kategori (vade aralığı üstte seçildi) */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          Kategori
        </label>
        <select
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Tümü</option>
          <option value="cek-musteri">Müşteri Çeki</option>
          <option value="cek-kendi">Kendi Çekimiz</option>
          <option value="senet-musteri">Müşteri Senedi</option>
          <option value="senet-kendi">Borç Senedimiz</option>
        </select>
        {category !== 'all' && (
          <button
            type="button"
            onClick={() => setCategory('all')}
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Filtreleri Sıfırla
          </button>
        )}
      </div>

      {/* Timeline alanı */}
      {dateGroups.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Seçili kriterlere uygun vadesi olan çek/senet bulunamadı.
        </div>
      ) : (
        <>
          {/* Masaüstü: bubble timeline */}
          <div className="hidden md:block">
            <div className="relative h-40 mt-4 mx-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              {/* Orta çizgi */}
              <div className="absolute left-0 right-0 top-1/2 h-[3px] bg-slate-200 rounded-full" />

              {dateGroups.map((g) => {
                const pos = bubblePositions.find((p) => p.date === g.date)?.left ?? 50;
                const isSelected = selectedDate === g.date;
                const count = g.items.length;
                return (
                  <div
                    key={g.date}
                    className="absolute top-0 h-full flex flex-col items-center justify-center"
                    style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  >
                    {/* Tarih etiketi */}
                    <div className="mb-2 text-[11px] font-semibold text-slate-600">
                      {formatDateTR(g.date)}
                    </div>
                    {/* Bubble */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(g.date);
                        setIsModalOpen(true);
                      }}
                      className={`flex items-center justify-center rounded-full border-2 text-sm font-extrabold w-11 h-11 transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-700 text-white shadow-lg scale-105'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-400'
                      }`}
                    >
                      {count}
                    </button>
                    {/* Toplam tutar */}
                    <div className="mt-2 text-[11px] text-slate-500 font-medium">
                      ₺{g.totalAmount.toLocaleString('tr-TR')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobil: dikey bubble listesi */}
          <div className="md:hidden border-t border-slate-200 mt-4 pt-4">
            <div className="space-y-2">
              {dateGroups.map((g) => {
                const isSelected = selectedDate === g.date;
                return (
                    <button
                        key={g.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(g.date);
                      setIsModalOpen(true);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center rounded-full w-9 h-9 border-2 text-sm font-extrabold ${
                          isSelected
                            ? 'bg-blue-600 border-blue-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        {g.items.length}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-700">
                          {formatDateTR(g.date)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ₺{g.totalAmount.toLocaleString('tr-TR')}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Gün
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[11px] font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 border-[2px] border-white shadow-sm" />
              <span>Çek · Müşteri</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 border-[2px] border-white shadow-sm" />
              <span>Çek · Kendi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600 border-[2px] border-white shadow-sm" />
              <span>Senet · Müşteri</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-violet-600 border-[2px] border-white shadow-sm" />
              <span>Senet · Kendi</span>
            </div>
          </div>

          {/* Detay modalı: seçili tarihteki tüm hareketler */}
          {isModalOpen && selectedGroup && (
            <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-slate-900/60 backdrop-blur-sm pt-10 md:pt-0">
              <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl max-w-6xl w-full mx-2 md:mx-4 max-h-[92vh] flex flex-col border border-slate-200">
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 rounded-t-xl md:rounded-t-2xl">
                  <div>
                    <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wide">
                      {formatDateTR(selectedGroup.date)} tarihindeki hareketler
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {selectedGroup.items.length} adet · ₺{selectedGroup.totalAmount.toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportSelectedToExcel}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-400/90 text-emerald-950 hover:bg-emerald-300 border border-emerald-300"
                    >
                      📊 Excel
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintSelected}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/15 text-white hover:bg-white/25 border border-white/30"
                    >
                      🖨 Yazdır
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white/80 hover:bg-white/10 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="px-3 md:px-6 py-3 md:py-4 overflow-y-auto text-xs sm:text-sm text-slate-800 bg-slate-50/60">
                  {/* Masaüstü: tablo */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Tür
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Portföy / Seri
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Çek/Senet Sahibi
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              İlgili Hesap
                            </th>
                            <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Tutar
                            </th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                              Güncel Durum
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedGroup.items.map((it) => (
                            <tr
                              key={it.id}
                              className="odd:bg-slate-100 even:bg-slate-200 hover:bg-slate-300 transition-colors"
                            >
                              <td className="px-3 py-2 whitespace-nowrap text-[11px] sm:text-xs font-semibold text-slate-700">
                                {categoryLabel(it)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-[11px] sm:text-xs text-slate-600">
                                {it.raw['Portföy No'] ?? '-'}
                                {it.raw['Seri No'] ? ` / ${it.raw['Seri No']}` : ''}
                              </td>
                              <td className="px-3 py-2 text-[11px] sm:text-xs text-slate-700 max-w-xs truncate">
                                {it.raw['Çek/Senet Sahibi'] || it.payee || '-'}
                              </td>
                              <td className="px-3 py-2 text-[11px] sm:text-xs text-slate-600 max-w-sm whitespace-normal break-words">
                                {it.raw['İlgili Hesap'] || ''}
                              </td>
                              <td className="px-3 py-2 text-right text-[11px] sm:text-xs font-bold text-slate-900 whitespace-nowrap">
                                ₺{it.amount.toLocaleString('tr-TR')}
                              </td>
                              <td className="px-3 py-2 text-[11px] sm:text-xs text-slate-600 whitespace-nowrap">
                                {it.raw['Güncel Durumu'] || ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobil: kartlar */}
                  <div className="md:hidden space-y-2">
                    {selectedGroup.items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-700">
                            {categoryLabel(it)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-900">
                            ₺{it.amount.toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          <span className="font-medium">Portföy / Seri: </span>
                          {it.raw['Portföy No'] ?? '-'}
                          {it.raw['Seri No'] ? ` / ${it.raw['Seri No']}` : ''}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-700">
                          <span className="font-medium">Sahibi: </span>
                          {it.raw['Çek/Senet Sahibi'] || it.payee || '-'}
                        </div>
                        {it.raw['İlgili Hesap'] && (
                          <div className="mt-0.5 text-[11px] text-slate-600 break-words">
                            <span className="font-medium">İlgili Hesap: </span>
                            {it.raw['İlgili Hesap']}
                          </div>
                        )}
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          <span className="font-medium">Durum: </span>
                          {it.raw['Güncel Durumu'] || ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

