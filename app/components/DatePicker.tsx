'use client';

import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  label?: string;
}

export default function DatePicker({ value, onChange, placeholder, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  // YYYY-MM-DD formatını DD/MM/YYYY formatına çevir
  const formatToDisplay = (dateStr: string): string => {
    if (!dateStr || !dateStr.includes('-')) return '';
    const [yyyy, mm, dd] = dateStr.split('-');
    if (dd && mm && yyyy && yyyy.length === 4) {
      return `${dd}/${mm}/${yyyy}`;
    }
    return dateStr;
  };

  // DD/MM/YYYY formatını Date'e çevir
  const parseDisplayDate = (dateStr: string): Date | null => {
    if (!dateStr || !dateStr.includes('/')) return null;
    const [dd, mm, yyyy] = dateStr.split('/');
    if (dd && mm && yyyy && yyyy.length === 4) {
      return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    }
    return null;
  };

  // Date'i YYYY-MM-DD formatına çevir
  const formatToYMD = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Value değiştiğinde selectedDate'i güncelle
  useEffect(() => {
    const parsed = parseDisplayDate(formatToDisplay(value));
    setSelectedDate(parsed);
    if (parsed) {
      setCurrentMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value]);

  // Dışarıya tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Takvim açılırken pozisyonu hesapla
  const handleToggleCalendar = () => {
    if (!isOpen) {
      // Takvim açılırken pozisyonu hesapla
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const calendarHeight = 400; // Takvim yüksekliği (yaklaşık)
        
        if (spaceBelow >= calendarHeight || spaceBelow > spaceAbove) {
          setDropdownPosition('bottom');
        } else {
          setDropdownPosition('top');
        }
      }
    }
    setIsOpen(!isOpen);
  };

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Ayın ilk günü hangi gün (0=Pazar, 1=Pazartesi...)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Pazartesi başlangıcı için ayarlama (0=Pazartesi, 6=Pazar)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  // Ayın kaç günü var
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Önceki ayın son günleri
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const handleDateClick = (day: number, isCurrentMonth: boolean = true) => {
    let selectedYear = year;
    let selectedMonth = month;
    
    if (!isCurrentMonth) {
      if (day > 15) {
        // Önceki ay
        selectedMonth = month - 1;
        if (selectedMonth < 0) {
          selectedMonth = 11;
          selectedYear = year - 1;
        }
      } else {
        // Sonraki ay
        selectedMonth = month + 1;
        if (selectedMonth > 11) {
          selectedMonth = 0;
          selectedYear = year + 1;
        }
      }
    }

    const newDate = new Date(selectedYear, selectedMonth, day);
    setSelectedDate(newDate);
    onChange(formatToYMD(newDate)); // YYYY-MM-DD formatında gönder
    setIsOpen(false);
  };

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
    onChange(formatToYMD(today)); // YYYY-MM-DD formatında gönder
    setIsOpen(false);
  };

  const isToday = (day: number) => {
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    return selectedDate && 
           selectedDate.getDate() === day && 
           selectedDate.getMonth() === month && 
           selectedDate.getFullYear() === year;
  };

  // Takvim günlerini oluştur
  const calendarDays = [];
  
  // Önceki ayın son günleri
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    calendarDays.push(
      <button
        key={`prev-${day}`}
        onClick={() => handleDateClick(day, false)}
        className="w-10 h-10 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors text-sm"
      >
        {day}
      </button>
    );
  }

  // Bu ayın günleri
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(
      <button
        key={`current-${day}`}
        onClick={() => handleDateClick(day)}
        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
          isSelected(day)
            ? 'bg-red-600 text-white shadow-md'
            : isToday(day)
            ? 'bg-red-100 text-red-600 border-2 border-red-300'
            : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
        }`}
      >
        {day}
      </button>
    );
  }

  // Sonraki ayın ilk günleri (42 günlük grid tamamlamak için)
  const remainingCells = 42 - calendarDays.length;
  for (let day = 1; day <= remainingCells; day++) {
    calendarDays.push(
      <button
        key={`next-${day}`}
        onClick={() => handleDateClick(day, false)}
        className="w-10 h-10 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors text-sm"
      >
        {day}
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      
      {/* Input Field */}
      <div className="relative">
                 <input
           type="text"
           value={formatToDisplay(value)}
           onChange={(e) => onChange(e.target.value)}
           onClick={handleToggleCalendar}
           placeholder={placeholder}
           className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer"
         />
         <button
           type="button"
           onClick={handleToggleCalendar}
           className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors"
         >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className={`absolute ${dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 min-w-[320px]`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h3 className="text-lg font-semibold text-gray-800">
              {monthNames[month]} {year}
            </h3>
            
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {calendarDays}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-200">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              Bugün
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
