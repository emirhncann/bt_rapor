'use client';

import React, { useMemo, useState, useEffect } from 'react';

interface CekSenetTimelineProps {
  data: any[];
  /** Parent'tan kontrol edilen seçili tarih (opsiyonel). Verilirse controlled mod. */
  selectedDate?: string | null;
  /**
   * Seçilen vade tarihi değiştiğinde parent'a haber vermek için isteğe bağlı callback.
   * date: 'YYYY-MM-DD', items: orijinal satırlar (raw)
   */
  onDateChange?: (info: { date: string; items: any[] } | null) => void;
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

export default function CekSenetTimeline({ data, selectedDate: controlledDate, onDateChange }: CekSenetTimelineProps) {
  const items = useMemo(() => {
    return (data || [])
      .map(mapRowToTimelineItem)
      .filter((x): x is TimelineItem => !!x)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const [internalDate, setInternalDate] = useState<string | null>(null);
  const isControlled = controlledDate !== undefined;
  const selectedDate = isControlled ? controlledDate : internalDate;

  // Tarihe göre grupla (bubble mantığı)
  const dateGroups: DateGroup[] = useMemo(() => {
    const map = new Map<string, DateGroup>();
    for (const it of items) {
      const key = it.date;
      if (!map.has(key)) {
        map.set(key, { date: key, items: [], totalAmount: 0 });
      }
      const g = map.get(key)!;
      g.items.push(it);
      g.totalAmount += it.amount;
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  const selectedGroup = useMemo(
    () => (selectedDate ? dateGroups.find((g) => g.date === selectedDate) ?? null : null),
    [dateGroups, selectedDate]
  );

  const handleDateSelect = React.useCallback((dateStr: string | null) => {
    if (dateStr === null) {
      if (!isControlled) setInternalDate(null);
      onDateChange?.(null);
    } else {
      const g = dateGroups.find((x) => x.date === dateStr);
      if (g) {
        if (!isControlled) setInternalDate(dateStr);
        onDateChange?.({ date: g.date, items: g.items.map((it) => it.raw) });
      }
    }
  }, [isControlled, dateGroups, onDateChange]);

  // Veri değişince geçersiz seçimi temizle
  useEffect(() => {
    if (!dateGroups.length) return;
    if (selectedDate && !dateGroups.some((g) => g.date === selectedDate)) {
      handleDateSelect(null);
    }
  }, [dateGroups, selectedDate, handleDateSelect]);

  // Seçili tarih değiştiğinde üst bileşene bildir (sadece uncontrolled modda - controlled'da handleDateSelect kullanılır)
  useEffect(() => {
    if (isControlled || !onDateChange) return;
    if (selectedGroup) {
      onDateChange({
        date: selectedGroup.date,
        items: selectedGroup.items.map((it) => it.raw),
      });
    } else {
      onDateChange(null);
    }
  }, [selectedGroup, isControlled, onDateChange]);

  // Özet
  const summary = useMemo(() => {
    const totalCount = items.length;
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
    return { totalCount, totalAmount };
  }, [items]);

  const formatDateTR = (dateStr: string) => {
    const d = toLocalDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR');
  };

  if (!items.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-sm text-slate-500">
        Bu tarih aralığında çek/senet verisi bulunamadı.
      </div>
    );
  }

  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow overflow-hidden">
      {/* Akordiyon başlığı */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 text-left hover:bg-slate-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Vade Takvimi
            </p>
            <p className="text-sm text-slate-600">
              Vade tarihine göre çek ve senetleri takip edin
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-8 md:pl-0">
          {selectedDate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDateSelect(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Filtre Temizle
            </button>
          )}
          <div className="flex gap-3">
            <div className="bg-blue-50 rounded-xl px-4 py-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Kayıt</p>
              <p className="text-lg font-bold text-blue-700">{summary.totalCount.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-violet-50 rounded-xl px-4 py-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Tutar</p>
              <p className="text-lg font-bold text-violet-700">₺{summary.totalAmount.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        </div>
      </button>

      {/* Akordiyon içeriği */}
      {isOpen && (
        <div className="px-6 pb-6 pt-4 space-y-5 border-t border-slate-200">
      {/* Timeline alanı */}
      {dateGroups.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Seçili kriterlere uygun vadesi olan çek/senet bulunamadı.
        </div>
      ) : (
        <>
          {/* Masaüstü: mobil ile aynı kart düzeni, yatay scroll */}
          <div className="hidden md:block">
            <div className="flex flex-nowrap gap-3 overflow-x-auto py-2 px-1 rounded-2xl bg-white border border-slate-200 shadow-sm">
              {dateGroups.map((g) => {
                const isSelected = selectedDate === g.date;
                return (
                  <button
                    key={g.date}
                    type="button"
                    onClick={() => handleDateSelect(g.date)}
                    className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border text-left min-w-[140px] transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center rounded-full w-10 h-10 border-2 text-sm font-extrabold flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-700 text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      {g.items.length}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-700 truncate">
                        {formatDateTR(g.date)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ₺{g.totalAmount.toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">Gün</span>
                  </button>
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
                    onClick={() => handleDateSelect(g.date)}
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

        </>
      )}
        </div>
      )}
    </div>
  );
}

