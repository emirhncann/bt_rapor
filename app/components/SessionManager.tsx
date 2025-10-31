'use client';

import { useEffect } from 'react';

/**
 * Oturum yönetimi için client component
 * Tarayıcı kapanınca sessionStorage otomatik silinir
 * Bu component sadece ek güvenlik için beforeunload event'i dinler
 */
export default function SessionManager() {
  useEffect(() => {
    // Tarayıcı kapanma/yenileme durumunu tespit et
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // SessionStorage zaten tarayıcı kapanınca silinir
      // Bu sadece ek güvenlik için - gerekirse özel temizlik yapılabilir
      console.log('🔒 Tarayıcı kapatılıyor - sessionStorage otomatik silinecek');
    };

    // Sayfa yüklendiğinde oturum durumunu kontrol et
    const checkSessionOnLoad = () => {
      const isLoggedIn = sessionStorage.getItem('isLoggedIn');
      if (isLoggedIn === 'true') {
        console.log('✅ Oturum aktif - sessionStorage kullanılıyor (tarayıcı kapanınca silinir)');
      }
    };

    // Event listener'ları ekle
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Sayfa yüklendiğinde kontrol et
    checkSessionOnLoad();

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Bu component görsel bir şey render etmez
  return null;
}
