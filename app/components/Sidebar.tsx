'use client';

import { useState, useEffect } from 'react';
import { fetchUserReports, getAuthorizedReports, groupReportsByCategory, getCurrentUser, isAdmin } from '../utils/simple-permissions';
import type { ReportWithAccess } from '../utils/simple-permissions';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userReports, setUserReports] = useState<ReportWithAccess[]>([]);
  const [reportsByCategory, setReportsByCategory] = useState<{[category: string]: ReportWithAccess[]}>({});
  const [openCategories, setOpenCategories] = useState<{[key: string]: boolean}>({});
  const [loading, setLoading] = useState(true);

  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    const name = localStorage.getItem('userName');
    const email = localStorage.getItem('userEmail');
    if (name) setUserName(name);
    if (email) setUserEmail(email);
  }, []);

  // Kullanıcı raporlarını yükle
  useEffect(() => {
    loadUserReports();
  }, []);

  const loadUserReports = async () => {
    try {
      setLoading(true);
      const currentUser = getCurrentUser();
      const companyRef = localStorage.getItem('companyRef');
      
      if (!companyRef) {
        console.warn('Company ref bulunamadı');
        setLoading(false);
        return;
      }

      console.log('🔄 Kullanıcı raporları yükleniyor...');
      
      // API'den kullanıcının raporlarını çek
      const allReports = await fetchUserReports(companyRef, currentUser?.id);
      console.log('📊 Çekilen raporlar:', allReports);
      
      // Sadece yetkili raporları al
      const authorizedReports = getAuthorizedReports(allReports);
      console.log('✅ Yetkili raporlar:', authorizedReports);
      
      // Kategorilere göre grupla
      const grouped = groupReportsByCategory(authorizedReports);
      console.log('📁 Kategorileştirilmiş raporlar:', grouped);
      
      setUserReports(authorizedReports);
      setReportsByCategory(grouped);
      
    } catch (error) {
      console.error('❌ Raporlar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  // Kategori açma/kapama
  const toggleCategory = (categoryName: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  // Icon'ları render et
  const renderIcon = (iconName: string, className: string = "h-5 w-5") => {
    const iconComponents: {[key: string]: JSX.Element} = {
      'home': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      ),
      'calculator': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      'credit-card': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      'package': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      'users': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      'bar-chart': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      'chart-line': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      'folder': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      'settings': (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    };

    return iconComponents[iconName] || iconComponents['folder'];
  };

  // Kategori için ikon belirle
  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'Finansal Raporlar': return 'calculator';
      case 'Satış Raporları': return 'credit-card';
      case 'Stok Raporları': return 'package';
      case 'Müşteri Raporları': return 'users';
      case 'Analiz Raporları': return 'bar-chart';
      default: return 'folder';
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64 flex flex-col
      `}>
        {/* Logo Area */}
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
          <div className="flex items-center">
            <img 
              src="/img/btRapor.png" 
              alt="btRapor Logo" 
              className="h-8 lg:h-10 w-auto"
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-4 lg:py-6 space-y-2 overflow-y-auto">
          {/* Anasayfa */}
          <div>
            <a
              href="/"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg group"
            >
              {renderIcon('home')}
              <span className="ml-3">Anasayfa</span>
            </a>
          </div>

          {/* Raporlar */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-gray-500">Raporlar yükleniyor...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {Object.keys(reportsByCategory).length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                  <p>Erişilebilir rapor bulunamadı</p>
                  <p className="text-xs mt-1">Yöneticinizle iletişime geçin</p>
                </div>
              ) : (
                Object.entries(reportsByCategory).map(([categoryName, reports]) => {
                  const isOpen = openCategories[categoryName];
                  const categoryIcon = getCategoryIcon(categoryName);

                  return (
                    <div key={categoryName}>
                      <button
                        onClick={() => toggleCategory(categoryName)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg group"
                      >
                        <div className="flex items-center">
                          {renderIcon(categoryIcon)}
                          <span className="ml-3">{categoryName}</span>
                          <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {reports.length}
                          </span>
                        </div>
                        <svg
                          className={`h-4 w-4 transform transition-transform duration-200 ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Kategori altındaki raporlar */}
                      {isOpen && (
                        <div className="ml-6 mt-1 space-y-1">
                          {reports.map((report) => (
                            <a
                              key={report.id}
                              href={report.route_path}
                              className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title={report.report_description}
                            >
                              {renderIcon(report.icon, "h-4 w-4")}
                              <span className="ml-2 truncate">{report.report_name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Ayarlar ve Test */}
          <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
            {/* Test API - Sadece development'ta göster */}
            {process.env.NODE_ENV === 'development' && (
              <a
                href="/test-api"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg group"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="ml-3">API Test</span>
              </a>
            )}
            
            <a
              href="/ayarlar"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg group"
            >
              {renderIcon('settings')}
              <span className="ml-3">Ayarlar</span>
            </a>
          </div>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-medium text-sm">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              <p className="text-xs text-gray-400 truncate">
                {userReports.length} rapor erişimi
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 