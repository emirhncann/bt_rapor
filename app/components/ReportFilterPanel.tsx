'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import DatePicker from './DatePicker';

// ── Tipler ────────────────────────────────────────────────────────────────────
export type DatePreset =
  | 'today' | 'yesterday' | 'thisWeek' | 'thisMonth'
  | 'lastMonth' | 'last3Months' | 'thisYear'
  | 'nextMonth' | 'next3Months';

export interface DateRangeValue { start: string; end: string; }
export type FilterValue = string | number | boolean | string[] | DateRangeValue | null | undefined;
export type FilterValues = Record<string, FilterValue>;

export type SelectOption = { value: string; label: string };

export type FilterDef =
  | { type: 'dateRange'; id: string; label?: string; presets?: DatePreset[] }
  | { type: 'select';      id: string; label: string; options: SelectOption[]; placeholder?: string; searchable?: boolean; clearable?: boolean }
  | { type: 'multiSelect'; id: string; label: string; options: SelectOption[]; placeholder?: string; searchable?: boolean }
  | { type: 'text';        id: string; label: string; placeholder?: string }
  | { type: 'number';      id: string; label: string; min?: number; max?: number; placeholder?: string }
  | { type: 'toggle';      id: string; label: string; description?: string };

interface ReportFilterPanelProps {
  filters: FilterDef[];
  values: FilterValues;
  onChange: (key: string, value: FilterValue) => void;
  onApply: () => void;
  onReset?: () => void;
  applyLabel?: string;
  loading?: boolean;
  /** Sayfa yüklenirken panel açık başlar, data gelince kapanır */
  defaultOpen?: boolean;
  /** onApply çağrıldıktan sonra panel otomatik kapanır */
  autoCollapse?: boolean;
}

// ── Tarih preset yardımcıları ─────────────────────────────────────────────────
function toIso(d: Date) { return d.toISOString().split('T')[0]; }

function getPresetDates(preset: DatePreset): DateRangeValue {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (preset) {
    case 'today':      { const s = toIso(now); return { start: s, end: s }; }
    case 'yesterday':  { const d = new Date(now); d.setDate(d.getDate() - 1); const s = toIso(d); return { start: s, end: s }; }
    case 'thisWeek':   { const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); return { start: toIso(mon), end: toIso(now) }; }
    case 'thisMonth':  return { start: toIso(new Date(y, m, 1)),     end: toIso(now) };
    case 'lastMonth':  return { start: toIso(new Date(y, m - 1, 1)), end: toIso(new Date(y, m, 0)) };
    case 'last3Months':{ const s = new Date(now); s.setMonth(s.getMonth() - 3); return { start: toIso(s), end: toIso(now) }; }
    case 'thisYear':    return { start: toIso(new Date(y, 0, 1)), end: toIso(now) };
    case 'nextMonth':   return { start: toIso(new Date(y, m + 1, 1)), end: toIso(new Date(y, m + 2, 0)) };
    case 'next3Months': return { start: toIso(new Date(y, m, 1)),     end: toIso(new Date(y, m + 3, 0)) };
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugün', yesterday: 'Dün', thisWeek: 'Bu Hafta',
  thisMonth: 'Bu Ay', lastMonth: 'Geçen Ay',
  last3Months: 'Son 3 Ay', thisYear: 'Bu Yıl',
  nextMonth: 'Gelecek Ay', next3Months: 'Sonraki 3 Ay',
};

// ── Aktif filtre sayısı ───────────────────────────────────────────────────────
function countActive(values: FilterValues, filters: FilterDef[]): number {
  let n = 0;
  for (const f of filters) {
    const v = values[f.id];
    if (f.type === 'dateRange')    { const dr = v as DateRangeValue | undefined; if (dr?.start || dr?.end) n++; }
    else if (f.type === 'multiSelect') { if (Array.isArray(v) && v.length > 0) n++; }
    else if (f.type === 'toggle')  { if (v === true) n++; }
    else                           { if (v !== null && v !== undefined && v !== '') n++; }
  }
  return n;
}

// ── Aktif filtreler için chip metinleri üret ─────────────────────────────────
function buildChips(values: FilterValues, filters: FilterDef[]): string[] {
  const chips: string[] = [];

  for (const f of filters) {
    const v = values[f.id];

    // toggle için ayrı kontrol (false değeri falsy olduğundan !v atlar)
    if (f.type === 'toggle') {
      if (v === true) chips.push(f.label);
      continue;
    }

    if (!v) continue;

    if (f.type === 'dateRange') {
      const dr = v as DateRangeValue;
      if (!dr?.start && !dr?.end) continue;
      // Preset kontrolü
      if (f.presets) {
        for (const p of f.presets) {
          const pd = getPresetDates(p);
          if (dr.start === pd.start && dr.end === pd.end) {
            chips.push(`📅 ${PRESET_LABELS[p]}`); break;
          }
        }
      }
      if (!chips.find(c => c.startsWith('📅'))) {
        // Manuel tarih aralığı — kısalt
        const fmt = (iso: string) => iso ? iso.slice(5).replace('-', '/') : '?';
        chips.push(`📅 ${fmt(dr.start)} – ${fmt(dr.end)}`);
      }
    } else if (f.type === 'select') {
      if (!v) continue;
      const opt = f.options.find(o => o.value === v);
      chips.push(opt ? opt.label : String(v));
    } else if (f.type === 'multiSelect') {
      if (!Array.isArray(v) || v.length === 0) continue;
      chips.push(v.length === 1
        ? (f.options.find(o => o.value === v[0])?.label ?? v[0])
        : `${f.label}: ${v.length} seçili`
      );
    } else if (f.type === 'text' || f.type === 'number') {
      if (v !== '' && v !== null && v !== undefined) chips.push(String(v));
    }
  }
  return chips;
}

// ── Select bileşeni ───────────────────────────────────────────────────────────
function SelectFilter({ def, value, onChange }: {
  def: Extract<FilterDef, { type: 'select' }>;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = def.searchable
    ? def.options.filter(o => o.label.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))
    : def.options;
  const selected = def.options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors">
        <span className={selected ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selected ? selected.label : (def.placeholder ?? `${def.label} seçin`)}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          {def.searchable && (
            <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Ara..." className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          )}
          {def.clearable && value && (
            <button onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 italic border-b border-gray-100">
              — Seçimi temizle
            </button>
          )}
          {filtered.length === 0
            ? <p className="px-3 py-4 text-sm text-gray-400 text-center">Sonuç bulunamadı</p>
            : filtered.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${o.value === value ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}>
                {o.label}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── MultiSelect bileşeni ──────────────────────────────────────────────────────
function MultiSelectFilter({ def, value, onChange }: {
  def: Extract<FilterDef, { type: 'multiSelect' }>;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = def.options.filter(o => o.label.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors">
        <span className={value.length > 0 ? 'text-gray-900' : 'text-gray-400'}>
          {value.length > 0 ? `${value.length} seçildi` : (def.placeholder ?? `${def.label} seçin`)}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {value.length > 0 && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{value.length}</span>}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ara..." className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          {value.length > 0 && (
            <button onClick={() => onChange([])} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100">
              Tümünü temizle ({value.length} seçili)
            </button>
          )}
          {filtered.length === 0
            ? <p className="px-3 py-4 text-sm text-gray-400 text-center">Sonuç bulunamadı</p>
            : filtered.map(o => (
              <label key={o.value} className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-50 cursor-pointer transition-colors">
                <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600" />
                <span className="text-sm text-gray-700">{o.label}</span>
              </label>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Tek filtre alanı ──────────────────────────────────────────────────────────
function FilterField({ def, value, onChange }: {
  def: FilterDef;
  value: FilterValue;
  onChange: (key: string, value: FilterValue) => void;
}) {
  if (def.type === 'dateRange') {
    const dr = (value as DateRangeValue | undefined) ?? { start: '', end: '' };
    return (
      <div>
        {def.presets && def.presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {def.presets.map(preset => {
              const dates = getPresetDates(preset);
              const isActive = dr.start === dates.start && dr.end === dates.end;
              return (
                <button key={preset} type="button" onClick={() => onChange(def.id, dates)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <DatePicker label="Başlangıç tarihi" value={dr.start}
            onChange={v => onChange(def.id, { ...dr, start: v })} placeholder="DD/MM/YYYY" />
          <DatePicker label="Bitiş tarihi" value={dr.end}
            onChange={v => onChange(def.id, { ...dr, end: v })} placeholder="DD/MM/YYYY" />
        </div>
      </div>
    );
  }
  if (def.type === 'select') return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{def.label}</label>
      <SelectFilter def={def} value={(value as string | null) ?? null} onChange={v => onChange(def.id, v)} />
    </div>
  );
  if (def.type === 'multiSelect') return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{def.label}</label>
      <MultiSelectFilter def={def} value={(value as string[]) ?? []} onChange={v => onChange(def.id, v)} />
    </div>
  );
  if (def.type === 'text') return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{def.label}</label>
      <input type="text" value={(value as string) ?? ''} onChange={e => onChange(def.id, e.target.value)}
        placeholder={def.placeholder}
        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-colors" />
    </div>
  );
  if (def.type === 'number') return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{def.label}</label>
      <input type="number" value={(value as number | '') ?? ''} min={def.min} max={def.max}
        onChange={e => onChange(def.id, e.target.value === '' ? '' : Number(e.target.value))}
        placeholder={def.placeholder}
        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-colors" />
    </div>
  );
  if (def.type === 'toggle') {
    const checked = (value as boolean) ?? false;
    return (
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium text-gray-700">{def.label}</p>
          {def.description && <p className="text-xs text-gray-400 mt-0.5">{def.description}</p>}
        </div>
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(def.id, !checked)}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    );
  }
  return null;
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function ReportFilterPanel({
  filters,
  values,
  onChange,
  onApply,
  onReset,
  applyLabel = 'Raporu Getir',
  loading = false,
  defaultOpen = true,
  autoCollapse = true,
}: ReportFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const activeCount = countActive(values, filters);
  const chips = buildChips(values, filters);

  const dateRangeFilters = filters.filter(f => f.type === 'dateRange');
  const otherFilters     = filters.filter(f => f.type !== 'dateRange');

  const handleReset = useCallback(() => {
    if (onReset) { onReset(); return; }
    for (const f of filters) {
      if (f.type === 'dateRange')        onChange(f.id, { start: '', end: '' });
      else if (f.type === 'multiSelect') onChange(f.id, []);
      else if (f.type === 'toggle')      onChange(f.id, false);
      else                               onChange(f.id, '');
    }
  }, [onReset, filters, onChange]);

  const handleApply = useCallback(() => {
    onApply();
    if (autoCollapse) setIsOpen(false);
  }, [onApply, autoCollapse]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      {/* ── Trigger satırı ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors rounded-t-2xl"
      >
        {/* Sol: ikon + başlık */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">Filtreler</span>
        </div>

        {/* Orta: aktif filtre chip'leri (kapalıyken) */}
        {!isOpen && chips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-1 overflow-hidden min-w-0">
            {chips.slice(0, 3).map((chip, i) => (
              <span key={i}
                className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium rounded-lg whitespace-nowrap flex-shrink-0">
                {chip}
              </span>
            ))}
            {chips.length > 3 && (
              <span className="text-xs text-gray-400 flex-shrink-0">+{chips.length - 3} daha</span>
            )}
          </div>
        )}

        {/* Kapalı & filtre yok */}
        {!isOpen && chips.length === 0 && (
          <span className="text-xs text-gray-400 flex-1">Filtre seçilmedi</span>
        )}

        {/* Sağ: aktif sayısı + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {activeCount > 0 && (
            <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
              {activeCount}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Açık panel ── */}
      {isOpen && (
        <div className="border-t border-gray-100 px-4 pt-4 pb-4 space-y-4 rounded-b-2xl">
          {/* Tarih aralığı filtreleri — tam genişlik */}
          {dateRangeFilters.map(f => (
            <div key={f.id}>
              {f.label && (
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{f.label}</label>
              )}
              <FilterField def={f} value={values[f.id]} onChange={onChange} />
            </div>
          ))}

          {/* Diğer filtreler — responsive grid */}
          {otherFilters.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherFilters.map(f => (
                <FilterField key={f.id} def={f} value={values[f.id]} onChange={onChange} />
              ))}
            </div>
          )}

          {/* Aksiyon butonları */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sıfırla
            </button>
            <button onClick={handleApply} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  {applyLabel}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
