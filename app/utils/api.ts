// API base URL'ini environment'a göre ayarla
export const getApiUrl = (endpoint: string): string => {
  if (process.env.NODE_ENV === 'development') {
    return `/api${endpoint}`;
  }
  return `https://api.btrapor.com${endpoint}`;
};

// Şifreleme için utility fonksiyonlar
export const encryptPayload = async (payload: any, companyRef: string): Promise<string> => {
  try {
    // Company ref'den türetilmiş bir salt oluştur (güvenlik için)
    const salt = await generateSaltFromCompanyRef(companyRef);
    
    // Payload'u JSON string'e çevir
    const payloadString = JSON.stringify(payload);
    
    // SHA-256 ile şifrele
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Hash'i base64'e çevir
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Şifreleme hatası:', error);
    throw new Error('Payload şifrelenemedi');
  }
};

// Company ref'den salt oluştur (güvenlik için)
const generateSaltFromCompanyRef = async (companyRef: string): Promise<string> => {
  // Company ref'i ters çevir ve ek karakterler ekle
  const reversed = companyRef.split('').reverse().join('');
  const salt = `btRapor_${reversed}_${companyRef.length}_${Date.now()}`;
  
  // Salt'ı da hash'le
  const encoder = new TextEncoder();
  const data = encoder.encode(salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
};

// Şifrelenmiş payload'u doğrula
export const verifyEncryptedPayload = async (encryptedPayload: string, originalPayload: any, companyRef: string): Promise<boolean> => {
  try {
    const expectedHash = await encryptPayload(originalPayload, companyRef);
    return encryptedPayload === expectedHash;
  } catch (error) {
    console.error('Doğrulama hatası:', error);
    return false;
  }
};

// Güvenli proxy request gönder - Retry mekanizması ile
export const sendSecureProxyRequest = async (
  companyRef: string, 
  connectionType: string, 
  payload: any,
  endpoint: string = 'https://api.btrapor.com/proxy',
  timeoutMs: number = 120000, // 2 dakika timeout (büyük raporlar için)
  maxRetries: number = 3 // Maksimum retry sayısı
): Promise<Response> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Proxy request denemesi ${attempt}/${maxRetries}...`);
      
      // Payload'u gerçekten şifrele (AES-GCM ile)
      const encryptedPayload = await encryptPayloadSecure(payload, companyRef);
      
      // Connection type'ı da şifrele
      const encryptedConnectionType = await encryptPayloadSecure({ type: connectionType }, companyRef);
      
      // Güvenli request body'si oluştur
      const secureBody = {
        companyRef: companyRef, // Bu açık kalabilir çünkü backend'de gerekli
        encryptedConnectionType: encryptedConnectionType, // Şifrelenmiş connection type
        encryptedPayload: encryptedPayload, // Şifrelenmiş payload
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15), // Güvenlik için rastgele değer
        maxResponseSize: 100 * 1024 * 1024, // 100MB maksimum response boyutu
        timeoutMs: timeoutMs // Timeout ayarı
      };
      
      console.log('🔐 Güvenli proxy request gönderiliyor:', {
        companyRef,
        connectionType: 'ŞİFRELİ',
        payloadSize: JSON.stringify(payload).length,
        encryptedSize: encryptedPayload.length,
        timestamp: secureBody.timestamp,
        timeoutMs: timeoutMs,
        maxResponseSize: '100MB',
        attempt: `${attempt}/${maxRetries}`
      });
      
      // AbortController ile timeout kontrolü
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Company-Ref': companyRef // Proxy API için gerekli header
          },
          body: JSON.stringify(secureBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Eğer response başarılı ise direkt döndür
        if (response.ok) {
          console.log(`✅ Proxy request başarılı (deneme ${attempt}/${maxRetries})`);
          return response;
        }
        
        // 502, 503, 504 gibi geçici hatalar için retry yap
        if (response.status >= 500 && response.status < 600) {
          console.warn(`⚠️ Proxy sunucu hatası (${response.status}), retry yapılıyor...`);
          lastError = new Error(`Proxy sunucu hatası: ${response.status}`);
          
          // Son deneme değilse bekle ve tekrar dene
          if (attempt < maxRetries) {
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
            console.log(`⏳ ${delay}ms bekleniyor...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Diğer hatalar için direkt döndür
        return response;
        
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        
        console.warn(`⚠️ Proxy bağlantı hatası (deneme ${attempt}/${maxRetries}):`, error);
        
        // Son deneme değilse bekle ve tekrar dene
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.log(`⏳ ${delay}ms bekleniyor...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    } catch (error) {
      lastError = error;
      
      // Son deneme değilse devam et
      if (attempt < maxRetries) {
        console.warn(`⚠️ Proxy request hatası (deneme ${attempt}/${maxRetries}):`, error);
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
        console.log(`⏳ ${delay}ms bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Son deneme başarısız oldu
      console.error(`❌ Proxy request başarısız (${maxRetries} deneme sonrası):`, error);
      throw lastError;
    }
  }
  
  // Bu noktaya gelmemeli ama güvenlik için
  throw lastError || new Error('Proxy request başarısız');
};

// Daha güvenli şifreleme - payload'u gerçekten şifrele
export const encryptPayloadSecure = async (payload: any, companyRef: string): Promise<string> => {
  try {
    // Payload'u JSON string'e çevir
    const payloadString = JSON.stringify(payload);
    
    // Company ref'den türetilmiş bir anahtar oluştur
    const key = await generateKeyFromCompanyRef(companyRef);
    
    // Payload'u şifrele
    const encrypted = await encryptWithKey(payloadString, key);
    
    return encrypted;
  } catch (error) {
    console.error('Güvenli şifreleme hatası:', error);
    throw new Error('Payload güvenli şekilde şifrelenemedi');
  }
};

// Company ref'den anahtar oluştur
const generateKeyFromCompanyRef = async (companyRef: string): Promise<CryptoKey> => {
  // Company ref'i hash'le
  const encoder = new TextEncoder();
  const data = encoder.encode(companyRef + 'companyref');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Hash'i 32 byte'lık anahtar olarak kullan
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

// AES-GCM ile şifrele
const encryptWithKey = async (text: string, key: CryptoKey): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Rastgele IV oluştur
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Şifrele
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // IV ve şifrelenmiş veriyi birleştir ve base64'e çevir
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Uint8Array'i string'e çevir
  let binaryString = '';
  for (let i = 0; i < combined.length; i++) {
    binaryString += String.fromCharCode(combined[i]);
  }
  
  return btoa(binaryString);
};

// Şifrelenmiş veriyi çöz
export const decryptPayloadSecure = async (encryptedData: string, companyRef: string): Promise<any> => {
  try {
    // Company ref'den anahtar oluştur
    const key = await generateKeyFromCompanyRef(companyRef);
    
      // Base64'ten çöz
  const binaryString = atob(encryptedData);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }
    
    // IV'yi ayır
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Şifreyi çöz
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    // JSON'a çevir
    const decoder = new TextDecoder();
    const text = decoder.decode(decrypted);
    
    return JSON.parse(text);
  } catch (error) {
    console.error('Şifre çözme hatası:', error);
    return null;
  }
};

// API fetch wrapper
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const url = getApiUrl(endpoint);
  return fetch(url, options);
}; 