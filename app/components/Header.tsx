'use client';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  title: string;
}

export default function Header({ sidebarOpen, setSidebarOpen, title }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
      {/* Left side - Menu button, logo and title */}
      <div className="flex items-center">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Logo */}
        <div className="ml-4 flex items-center">
          <img 
            src="/img/btRapor.png" 
            alt="btRapor Logo" 
            className="h-8 w-auto mr-3"
          />
          <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
        </div>
      </div>

      {/* Right side - User actions */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-3.5-7h-1.44l-.03-.12A5 5 0 1010.5 15H15zm-2.5 4a2 2 0 11-4 0m4 0a2 2 0 01-4 0m4 0h-4m4 0v-2a2 2 0 00-2-2h-2a2 2 0 00-2 2v2" />
          </svg>
          <span className="sr-only">Bildirimler</span>
        </button>

        {/* Search */}
        <div className="hidden md:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Ara..."
              className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* User profile dropdown */}
        <div className="relative">
          <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <div className="w-8 h-8 bg-gradient-to-r from-red-800 to-red-900 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">U</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-700">Kullanıcı</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
} 