'use client';

import { useState } from 'react';
import { Currency, POPULAR_CURRENCIES, CURRENCIES } from '../../types/currency';

interface CurrencySelectorProps {
  selectedCurrencies: number[];
  onCurrencyChange: (currencies: number[]) => void;
  className?: string;
}

export default function CurrencySelector({ selectedCurrencies, onCurrencyChange, className = '' }: CurrencySelectorProps) {
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtreleme için arama terimi
  const filteredCurrencies = CURRENCIES.filter(currency => 
    currency.Adı.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
    currency.Kodu.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
  );

  const handleCurrencyToggle = (currencyNo: number) => {
    if (selectedCurrencies.includes(currencyNo)) {
      // Kaldır
      onCurrencyChange(selectedCurrencies.filter(no => no !== currencyNo));
    } else {
      // Ekle
      onCurrencyChange([...selectedCurrencies, currencyNo]);
    }
  };

  const handleSelectAll = () => {
    const allCurrencyNos = CURRENCIES.map(currency => currency.No);
    onCurrencyChange(allCurrencyNos);
  };

  const handleClearAll = () => {
    onCurrencyChange([]);
  };

  const handlePopularCurrencies = () => {
    const popularNos = POPULAR_CURRENCIES.map(currency => currency.No);
    onCurrencyChange(popularNos);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          💱 Kur Seçimi
        </h3>
        <p className="text-sm text-gray-600">
          Raporda görmek istediğiniz para birimlerini seçin. Seçilen kurlar için ayrı ayrı borç, alacak ve bakiye sütunları oluşturulacaktır.
        </p>
      </div>

      {/* Hızlı Seçim Butonları */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePopularCurrencies}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
          >
            ⭐ Popüler Kurlar
          </button>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
          >
            ✅ Tümünü Seç
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
          >
            ❌ Temizle
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Seçili Kur Sayısı: <span className="font-semibold text-blue-600">{selectedCurrencies.length}</span>
        </div>
      </div>

      {/* Arama Kutusu */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Kur kodu veya adıyla ara... (ör: USD, Dolar)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg 
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Popüler Kurlar Bölümü */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">🌟 Popüler Para Birimleri</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {POPULAR_CURRENCIES.map(currency => (
            <label key={currency.No} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCurrencies.includes(currency.No)}
                onChange={() => handleCurrencyToggle(currency.No)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {currency.Kodu}
                  </span>
                  <span className="text-xs text-gray-600 truncate">
                    {currency.Adı}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Tüm Kurlar Göster/Gizle */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAllCurrencies(!showAllCurrencies)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>📋 Tüm Para Birimleri ({CURRENCIES.length} adet)</span>
          <svg 
            className={`h-5 w-5 transform transition-transform ${showAllCurrencies ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAllCurrencies && (
          <div className="mt-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <div className="p-2 space-y-1">
              {filteredCurrencies.map(currency => (
                <label key={currency.No} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCurrencies.includes(currency.No)}
                    onChange={() => handleCurrencyToggle(currency.No)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {currency.Kodu}
                        </span>
                        <span className="text-xs text-gray-600 truncate">
                          {currency.Adı}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        No: {currency.No}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seçili Kurlar Özeti */}
      {selectedCurrencies.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h5 className="text-sm font-medium text-blue-900 mb-2">✅ Seçili Para Birimleri:</h5>
          <div className="flex flex-wrap gap-1">
            {selectedCurrencies.map(currencyNo => {
              const currency = CURRENCIES.find(c => c.No === currencyNo);
              return currency ? (
                <span
                  key={currencyNo}
                  className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                >
                  {currency.Kodu}
                  <button
                    onClick={() => handleCurrencyToggle(currencyNo)}
                    className="ml-1 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
} 