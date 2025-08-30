'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  title: string;
}

export default function Header({ sidebarOpen, setSidebarOpen, title }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [name, setname] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userPlan, setUserPlan] = useState('');
  const router = useRouter();

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const fullName = localStorage.getItem('userName');
    const role = localStorage.getItem('userRole');
    
    if (email) {
      setUserEmail(email);
    }
    if (fullName) {
      setname(fullName);
    }
    if (role) {
      setUserRole(role);
    }
    
    // Plan bilgisini yükle (geçici - normalde API'den gelecek)
    if (role === 'admin') {
      setUserPlan('Yönetici Erişimi');
    } else {
      setUserPlan('Standart Plan'); // Geçici değer
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('companyRef');
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
      {/* Left side - Menu button, logo and title */}
      <div className="flex items-center min-w-0 flex-1">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
        >
          {sidebarOpen ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        
        {/* Logo - Mobilde kompakt */}
        <div className="ml-2 lg:ml-4 flex items-center min-w-0 flex-1">
          <button
            onClick={() => router.push('/')}
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <img 
              src="/img/btRapor.png" 
              alt="btRapor Logo" 
              className="h-6 lg:h-8 w-auto flex-shrink-0 cursor-pointer"
            />
          </button>
        </div>
      </div>

      {/* Right side - User actions */}
      <div className="flex items-center space-x-2 lg:space-x-4 flex-shrink-0">
        {/* Notifications - sadece desktop'ta göster */}
        <button className="hidden lg:block p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-3.5-7h-1.44l-.03-.12A5 5 0 1010.5 15H15zm-2.5 4a2 2 0 11-4 0m4 0a2 2 0 01-4 0m4 0h-4m4 0v-2a2 2 0 00-2-2h-2a2 2 0 00-2 2v2" />
          </svg>
          <span className="sr-only">Bildirimler</span>
        </button>

        {/* Search - sadece desktop'ta göster */}
        <div className="hidden md:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Ara..."
              className="w-48 lg:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 lg:space-x-3 p-1 lg:p-2 rounded-lg hover:bg-gray-100"
          >
            <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-r from-red-800 to-red-900 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {name ? (name || 'U').charAt(0).toUpperCase() : (userEmail ? (userEmail || 'U').charAt(0).toUpperCase() : 'U')}
              </span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium text-gray-700">
                {name || (userEmail ? userEmail.split('@')[0] : 'Kullanıcı')}
              </p>
              <p className="text-xs text-gray-500">
                {userPlan}
              </p>
            </div>
            <svg className="h-4 w-4 text-gray-400 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                {/* Mobilde kullanıcı bilgilerini göster */}
                <div className="lg:hidden px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">
                    {name || (userEmail ? userEmail.split('@')[0] : 'Kullanıcı')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {userPlan}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {userRole === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    router.push('/ayarlar');
                    setDropdownOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </button>
                <button
                  onClick={() => {
                    router.push('/ayarlar');
                    setDropdownOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Ayarlar
                </button>
                <div className="border-t border-gray-100"></div>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-900"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dropdown kapatmak için dışarı tıklama */}
      {dropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setDropdownOpen(false)}
        ></div>
      )}
    </header>
  );
} 