import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.334A7.97 7.97 0 0012 5c-2.34 0-4.29 1.009-5.824 2.562M12 15c-2.34 0-4.29-1.009-5.824-2.562M12 5c-2.34 0-4.29 1.009-5.824 2.562" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sayfa Bulunamadı
          </h2>
          
          <p className="text-gray-600 mb-6">
            Aradığınız Fatura Kontrol sayfası bulunamadı. 
            Lütfen doğru URL'yi kullandığınızdan emin olun.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/fatura-kontrol"
              className="block w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-center"
            >
              Fatura Kontrol Sayfasına Git
            </Link>
            
            <Link
              href="/"
              className="block w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-center"
            >
              Anasayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 