'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isSuperAdmin } from '../utils/simple-permissions';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Authentication kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        setIsAuthenticated(true);
        
        // Super admin kontrolü
        const superAdmin = isSuperAdmin();
        setIsSuperAdminUser(superAdmin);
        
        if (!superAdmin) {
          router.push('/');
          return;
        }

        // Kullanıcı bilgilerini al
        const name = localStorage.getItem('userName');
        const email = localStorage.getItem('userEmail');
        if (name) setUserName(name);
        if (email) setUserEmail(email);
      } else {
        router.push('/login');
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yetki kontrolü yapılıyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdminUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Top Navigation Bar */}
      <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-2xl border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center group">
                <div className="relative">
                  <img src="/img/btRapor.png" alt="btRapor" className="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </div>
                <div className="ml-4">
                  <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                    Sistem Yönetimi
                  </span>
                  <div className="h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mt-1 opacity-60"></div>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {[
                { href: "/super-admin", icon: "📊", label: "Dashboard", color: "from-blue-500 to-cyan-500" },
                { href: "/super-admin?tab=companies", icon: "🏢", label: "Şirketler", color: "from-emerald-500 to-teal-500" },
                { href: "/super-admin?tab=modules", icon: "📦", label: "Modüller", color: "from-purple-500 to-violet-500" },
                { href: "/super-admin?tab=users", icon: "👥", label: "Kullanıcılar", color: "from-orange-500 to-amber-500" },
                { href: "/super-admin?tab=plans", icon: "💳", label: "Planlar", color: "from-indigo-500 to-blue-500" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group relative flex items-center px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg transition-all duration-300 hover:bg-slate-700/50 hover:shadow-lg hover:shadow-slate-900/25"
                >
                  <span className="mr-2 text-lg transition-transform duration-300 group-hover:scale-110">
                    {item.icon}
                  </span>
                  <span className="relative z-10">{item.label}</span>
                  <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-10 rounded-lg transition-opacity duration-300`}></div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 group-hover:w-3/4 transition-all duration-300 rounded-full"></div>
                </a>
              ))}
            </div>

            {/* User Info and Actions */}
            <div className="flex items-center space-x-3">
              {/* Notifications */}
              <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all duration-300 group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4.5 19.5L9 15H4l5 5-4.5-4.5z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-3 pl-3 border-l border-slate-700">
                <div className="relative group">
                  <div className="flex-shrink-0 h-9 w-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg ring-2 ring-slate-700/50 group-hover:ring-blue-400/50 transition-all duration-300">
                    <span className="text-white font-semibold text-sm">
                      {(userName || 'S').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full border-2 border-slate-900"></div>
                </div>
                
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-white">{userName}</p>
                  <p className="text-xs text-slate-400 font-medium">Super Admin</p>
                </div>
              </div>
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="group flex items-center px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-lg transition-all duration-300 shadow-lg hover:shadow-red-500/25"
              >
                <svg className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden md:inline">Çıkış</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
