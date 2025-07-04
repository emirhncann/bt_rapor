# 🔐 btRapor Şifreleme Dokümantasyonu

## Genel Bakış

btRapor sistemi, frontend'den backend'e gönderilen verileri **AES-256-GCM** algoritması ile şifreler. Bu dokümantasyon, PHP backend'inin şifrelenmiş verileri nasıl çözeceğini açıklar.

## Şifreleme Algoritması

- **Algoritma**: AES-256-GCM
- **Anahtar Uzunluğu**: 256 bit (32 byte)
- **IV Uzunluğu**: 96 bit (12 byte)
- **Mod**: Galois/Counter Mode (GCM)

## Anahtar Oluşturma

### Frontend'de Anahtar Oluşturma (JavaScript)

```javascript
// Company ref'den anahtar oluştur
const generateKeyFromCompanyRef = async (companyRef: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(companyRef + 'companyref');
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

### Backend'de Anahtar Oluşturma (PHP)

```php
function generateKeyFromCompanyRef($companyRef) {
    // Company ref'i hash'le
    $data = $companyRef . 'companyref';
    $hash = hash('sha256', $data, true); // true = raw binary output
    
    return $hash;
}
```

## Şifreleme Süreci

### Frontend'de Şifreleme (JavaScript)

```javascript
const encryptWithKey = async (text: string, key: CryptoKey): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Rastgele IV oluştur (12 byte)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // AES-GCM ile şifrele
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // IV + Şifrelenmiş veriyi birleştir
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Base64'e çevir
  let binaryString = '';
  for (let i = 0; i < combined.length; i++) {
    binaryString += String.fromCharCode(combined[i]);
  }
  
  return btoa(binaryString);
};
```

### Backend'de Çözme (PHP)

```php
function decryptPayloadSecure($encryptedData, $companyRef) {
    try {
        // Company ref'den anahtar oluştur
        $key = generateKeyFromCompanyRef($companyRef);
        
        // Base64'ten çöz
        $combined = base64_decode($encryptedData);
        if ($combined === false) {
            return null;
        }
        
        // IV'yi ayır (ilk 12 byte)
        $iv = substr($combined, 0, 12);
        $encrypted = substr($combined, 12);
        
        // AES-GCM ile şifreyi çöz
        $decrypted = openssl_decrypt(
            $encrypted,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv
        );
        
        if ($decrypted === false) {
            return null;
        }
        
        // JSON'a çevir
        $payload = json_decode($decrypted, true);
        return $payload;
        
    } catch (Exception $e) {
        error_log("Payload decryption error: " . $e->getMessage());
        return null;
    }
}
```

## Request Formatı

### Frontend'den Gönderilen Request

```json
{
  "companyRef": "ABC123",
  "encryptedConnectionType": "eyJ0eXBlIjoiZmlyc3RfZGJfa2V5In0=",
  "encryptedPayload": "eyJxdWVyeSI6IlNFTEVDVCAqIEZST00gTEdfMDA5XzAxX0NMQ0FSRCBXSEVSRSBBQ1RJVkUgPSAwIn0=",
  "timestamp": 1703123456789,
  "nonce": "xyz789abc123"
}
```

### HTTP Headers

```http
Content-Type: application/json
```

## Backend İşleme Süreci

### 1. Request'i Al

```php
$parsedBody = json_decode((string)$request->getBody(), true);

$companyRef = $parsedBody['companyRef'] ?? null;
$encryptedConnectionType = $parsedBody['encryptedConnectionType'] ?? null;
$encryptedPayload = $parsedBody['encryptedPayload'] ?? null;
$timestamp = $parsedBody['timestamp'] ?? null; // Request body'den alınır
$nonce = $parsedBody['nonce'] ?? null; // Request body'den alınır
```

### 2. Zaman Kontrolü

```php
// 5 dakika geçerlilik süresi
if ($timestamp && (time() * 1000 - $timestamp) > 300000) {
    return proxyJsonResponse($response, [
        'error' => 'İstek zaman aşımına uğradı.'
    ], 401);
}
```

### 3. Connection Type'ı Çöz

```php
$connectionTypeData = decryptPayloadSecure($encryptedConnectionType, $companyRef);
if (!$connectionTypeData || !isset($connectionTypeData['type'])) {
    return proxyJsonResponse($response, [
        'error' => 'Connection type çözülemedi.'
    ], 400);
}
$connectionType = $connectionTypeData['type'];
```

### 4. Payload'ı Çöz

```php
$payload = decryptPayloadSecure($encryptedPayload, $companyRef);
if (!$payload) {
    return proxyJsonResponse($response, [
        'error' => 'Payload çözülemedi.'
    ], 400);
}
```

### 5. Veritabanından Bağlantı Bilgilerini Al

```php
$stmt = $pdo->prepare("
    SELECT public_ip, `$connectionType` AS connection_string
    FROM connection_info
    WHERE company_ref = :companyRef
    LIMIT 1
");
$stmt->execute(['companyRef' => $companyRef]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
```

### 6. Hedef Sunucuya İlet

```php
$forwardData = [
    'target_url' => 'http://' . $row['public_ip'] . '/sql',
    'payload' => [
        'connectionString' => $row['connection_string'],
        'query' => $payload['query'] ?? ''
    ]
];

$jsonData = json_encode($forwardData);
```

## Güvenlik Özellikleri

✅ **AES-256-GCM**: Güçlü şifreleme algoritması  
✅ **Authenticated Encryption**: Veri bütünlüğü korunur  
✅ **Company Ref Bazlı Key**: Her şirket farklı anahtar  
✅ **Rastgele IV**: Her şifreleme için farklı IV  
✅ **Zaman Kontrolü**: 5 dakika geçerlilik süresi  
✅ **Nonce**: Her istek benzersiz  

## Hata Kodları

| HTTP Kodu | Açıklama |
|-----------|----------|
| 400 | Geçersiz JSON formatı veya eksik veri |
| 401 | Zaman aşımı veya doğrulama hatası |
| 404 | Bağlantı bilgisi bulunamadı |
| 500 | Sunucu hatası |

## Örnek Kullanım

### C-Bakiye Raporu

**Frontend'den gönderilen:**
```json
{
  "companyRef": "ABC123",
  "encryptedConnectionType": "eyJ0eXBlIjoiZmlyc3RfZGJfa2V5In0=",
  "encryptedPayload": "eyJxdWVyeSI6IlNFTEVDVCAqIEZST00gTEdfMDA5XzAxX0NMQ0FSRCBXSEVSRSBBQ1RJVkUgPSAwIn0="
}
```

**Backend'de çözülen:**
```php
$connectionType = "first_db_key";
$payload = [
    "query" => "SELECT * FROM LG_009_01_CLCARD WHERE ACTIVE = 0"
];
```

### ENPOS Ciro Raporu

**Frontend'den gönderilen:**
```json
{
  "companyRef": "ABC123",
  "encryptedConnectionType": "eyJ0eXBlIjoiZW5wb3NfZGJfa2V5In0=",
  "encryptedPayload": "eyJxdWVyeSI6IlNFTEVDVCAqIEZST00gQkVMR0UgV0hFUkUgSXB0YWw9MCJ9"
}
```

**Backend'de çözülen:**
```php
$connectionType = "enpos_db_key";
$payload = [
    "query" => "SELECT * FROM BELGE WHERE Iptal=0"
];
```

## Test Fonksiyonları

### Test Şifreleme

```php
function testEncryption() {
    $companyRef = "ABC123";
    $testData = ["query" => "SELECT * FROM test"];
    
    // JavaScript'te şifrelenmiş veri
    $encrypted = "eyJxdWVyeSI6IlNFTEVDVCAqIEZST00gdGVzdCJ9";
    
    $decrypted = decryptPayloadSecure($encrypted, $companyRef);
    
    if ($decrypted === $testData) {
        echo "✅ Şifreleme testi başarılı\n";
    } else {
        echo "❌ Şifreleme testi başarısız\n";
    }
}
```

Bu dokümantasyon ile PHP backend'iniz şifrelenmiş verileri güvenli şekilde çözebilir! 🔐 