export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Yükleniyor...
          </h2>
          
          <p className="text-gray-600">
            Fatura Kontrol sayfası yükleniyor, lütfen bekleyin.
          </p>
        </div>
      </div>
    </div>
  );
} 