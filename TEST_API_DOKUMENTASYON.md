# 🔐 Test API Sayfası - Şifreleme ve SQL Injection Dokümantasyonu

## 📋 Genel Bakış

**Test API sayfası** (`app/test-api/page.tsx`) iki katmanlı güvenlik sistemi kullanıyor:

1. **Parola Koruması**: `Ozt129103` parolası ile erişim kontrolü
2. **AES-256-GCM Şifreleme**: Tüm SQL sorguları şifrelenerek gönderiliyor

## 🔒 Güvenlik Katmanları

### 1. Parola Koruması

```typescript
// Parola doğrulama
if (password === 'Ozt129103') {
  setIsAuthenticated(true);
  localStorage.setItem('apiTestAuth', 'true');
}
```

**Özellikler:**
- **Sabit parola**: `Ozt129103`
- **localStorage cache**: Bir kez doğrulandıktan sonra oturum boyunca hatırlanır
- **Çıkış**: "Çıkış Yap" butonu ile cache temizlenir

### 2. AES-256-GCM Şifreleme Sistemi

#### Anahtar Oluşturma

```typescript
const generateKeyFromCompanyRef = async (companyRef: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(companyRef + 'companyref'); // Company ref + salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};
```

#### Şifreleme Süreci

```typescript
const encryptWithKey = async (text: string, key: CryptoKey): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // 12 byte rastgele IV oluştur
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // AES-GCM ile şifrele
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // IV + şifrelenmiş veriyi birleştir ve base64'e çevir
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(binaryString);
};
```

## 🚀 SQL Injection Test Süreci

### 1. Request Hazırlama

```typescript
const handleSendRequest = async () => {
  // SQL sorgusu alınır
  const payload = { query };
  
  // Şifreleme işlemi
  const encryptedPayload = await encryptPayloadSecure(payload, companyRef);
  const encryptedConnectionType = await encryptPayloadSecure({ type: connectionType }, companyRef);
  
  // Güvenli request body
  const secureBody = {
    companyRef: companyRef,
    encryptedConnectionType: encryptedConnectionType,
    encryptedPayload: encryptedPayload,
    timestamp: Date.now(),
    nonce: Math.random().toString(36).substring(2, 15)
  };
};
```

### 2. Gönderilen Request Formatı

```json
{
  "companyRef": "ABC123",
  "encryptedConnectionType": "eyJ0eXBlIjoiZmlyc3RfZGJfa2V5In0=",
  "encryptedPayload": "eyJxdWVyeSI6IlNFTEVDVCBUT1AgMTAgKiBGUk9NIFlPVVJfVEFCTEUifQ==",
  "timestamp": 1703123456789,
  "nonce": "xyz789abc123"
}
```

### 3. Backend'de Çözme Süreci (PHP)

```php
// 1. Company ref'den anahtar oluştur
$key = generateKeyFromCompanyRef($companyRef);

// 2. Connection type'ı çöz
$connectionTypeData = decryptPayloadSecure($encryptedConnectionType, $companyRef);
$connectionType = $connectionTypeData['type'];

// 3. SQL sorgusunu çöz
$payload = decryptPayloadSecure($encryptedPayload, $companyRef);
$query = $payload['query'];

// 4. Veritabanı bağlantısı al
$stmt = $pdo->prepare("
    SELECT public_ip, `$connectionType` AS connection_string
    FROM connection_info
    WHERE company_ref = :companyRef
");
$stmt->execute(['companyRef' => $companyRef]);

// 5. Hedef sunucuya SQL sorgusunu ilet
$forwardData = [
    'target_url' => 'http://' . $row['public_ip'] . '/sql',
    'payload' => [
        'connectionString' => $row['connection_string'],
        'query' => $query // Şifrelenmiş SQL sorgusu
    ]
];
```

## 🛡️ Güvenlik Özellikleri

### ✅ Şifreleme Güvenliği

- **AES-256-GCM**: Endüstri standardı güçlü şifreleme
- **Authenticated Encryption**: Veri bütünlüğü korunur
- **Company Ref Bazlı Key**: Her şirket farklı anahtar
- **Rastgele IV**: Her şifreleme için farklı IV (12 byte)
- **Salt**: Company ref + 'companyref' salt'ı

### ✅ Zaman Güvenliği

- **Timestamp**: 5 dakika geçerlilik süresi
- **Nonce**: Her istek benzersiz rastgele değer
- **Timeout**: 3 dakika request timeout

### ✅ Retry Mekanizması

```typescript
// 3 deneme hakkı
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  // Exponential backoff: 100ms, 200ms, 400ms
  const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
}
```

## 🧪 SQL Injection Test Senaryoları

### Test Edilebilir SQL Komutları

```sql
-- Temel sorgu
SELECT TOP 10 * FROM YOUR_TABLE

-- JOIN sorguları
SELECT * FROM LG_009_01_CLCARD c 
JOIN LG_009_01_CLFLINE f ON c.LOGICALREF = f.CLIENTREF

-- Stored procedure çağrıları
EXEC sp_GetInventoryData

-- Parametreli sorgular
SELECT * FROM ITEMS WHERE ACTIVE = 1 AND CODE LIKE '%TEST%'

-- Karmaşık sorgular
SELECT 
    c.CODE,
    c.DEFINITION_,
    SUM(f.DEBIT) as TOTAL_DEBIT,
    SUM(f.CREDIT) as TOTAL_CREDIT
FROM LG_009_01_CLCARD c
LEFT JOIN LG_009_01_CLFLINE f ON c.LOGICALREF = f.CLIENTREF
WHERE c.ACTIVE = 0
GROUP BY c.CODE, c.DEFINITION_
HAVING SUM(f.DEBIT) > 1000
ORDER BY TOTAL_DEBIT DESC
```

### Connection Type Seçenekleri

- `first_db_key`: Ana veritabanı
- `second_db_key`: İkinci veritabanı  
- `enpos_db_key`: ENPOS veritabanı

## 📊 Debug ve Monitoring

### Console Logları

```typescript
console.log('🔐 Güvenli proxy request gönderiliyor:', {
  companyRef,
  connectionType: 'ŞİFRELİ',
  payloadSize: JSON.stringify(payload).length,
  encryptedSize: encryptedPayload.length,
  timestamp: secureBody.timestamp,
  attempt: `${attempt}/${maxRetries}`
});
```

### Response Handling

```typescript
if (!response.ok) {
  const errText = await response.text();
  setResult(`HTTP ${response.status} - ${errText}`);
  return;
}

const json = await response.json();
setResult(JSON.stringify(json, null, 2));
```

## 🎯 Kullanım Senaryoları

1. **SQL Sorgu Testi**: Farklı SQL komutlarını test etme
2. **Performance Test**: Büyük sorguların performansını ölçme
3. **Connection Test**: Farklı veritabanı bağlantılarını test etme
4. **Security Test**: Şifreleme sisteminin çalışmasını doğrulama

## 🔧 Teknik Detaylar

### Frontend Şifreleme Akışı

1. **Company Ref**: localStorage'dan alınır
2. **Key Generation**: Company ref + 'companyref' salt'ı ile SHA-256 hash
3. **Payload Encryption**: AES-256-GCM ile şifreleme
4. **IV Generation**: 12 byte rastgele IV
5. **Base64 Encoding**: Şifrelenmiş veri base64'e çevrilir

### Backend Çözme Akışı

1. **Key Recreation**: Aynı company ref ile anahtar yeniden oluşturulur
2. **IV Extraction**: Base64'ten çözülen veriden ilk 12 byte IV
3. **Decryption**: AES-256-GCM ile şifre çözme
4. **JSON Parsing**: Çözülen veri JSON olarak parse edilir
5. **SQL Execution**: Çözülen SQL sorgusu hedef sunucuda çalıştırılır

## ⚠️ Güvenlik Uyarıları

### Dikkat Edilmesi Gerekenler

- **Parola Güvenliği**: Sabit parola kullanımı güvenlik riski oluşturabilir
- **SQL Injection**: Test sayfası SQL injection testleri için tasarlanmıştır
- **Log Güvenliği**: Console loglarında hassas veriler görüntülenebilir
- **Timeout**: 3 dakika timeout büyük sorgular için yetersiz olabilir

### Öneriler

- Parola sistemini dinamik hale getirin
- Log seviyelerini production'da azaltın
- SQL sorgu validasyonu ekleyin
- Rate limiting uygulayın

## 📝 Örnek Kullanım

### 1. Sayfaya Erişim

```
URL: /test-api
Parola: Ozt129103
```

### 2. SQL Sorgu Gönderme

```sql
-- Örnek sorgu
SELECT TOP 100 * FROM LG_009_01_CLCARD WHERE ACTIVE = 0
```

### 3. Sonuç Görüntüleme

```json
{
  "success": true,
  "data": [
    {
      "LOGICALREF": 1,
      "CODE": "CARI001",
      "DEFINITION_": "Test Müşteri",
      "ACTIVE": 0
    }
  ],
  "rowCount": 100
}
```

## 🔄 Güncelleme Geçmişi

- **v1.0**: İlk sürüm - Temel şifreleme sistemi
- **v1.1**: Retry mekanizması eklendi
- **v1.2**: Timeout kontrolü geliştirildi
- **v1.3**: Debug logları eklendi

---

*Bu dokümantasyon Test API sayfasının güvenlik özelliklerini ve SQL injection test süreçlerini detaylandırır. Güvenlik testleri sırasında dikkatli olunması önerilir.*

