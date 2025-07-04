<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// POST verilerini al
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Geçersiz JSON formatı']);
    exit;
}

try {
    $companyRef = $data['companyRef'] ?? null;
    $encryptedConnectionType = $data['encryptedConnectionType'] ?? null;
    $encryptedPayload = $data['encryptedPayload'] ?? null;
    $timestamp = $data['timestamp'] ?? null;
    $nonce = $data['nonce'] ?? null;
    
    // Eski format desteği (geriye uyumluluk)
    $legacyConnectionType = $data['connectionType'] ?? null;
    $legacyPayload = $data['payload'] ?? null;

    if (!$companyRef || !is_string($companyRef)) {
        http_response_code(400);
        echo json_encode(['error' => 'companyRef zorunludur ve string olmalıdır.']);
        exit;
    }

    // Güvenlik kontrolleri
    if ($timestamp && (time() * 1000 - $timestamp) > 300000) { // 5 dakika
        http_response_code(401);
        echo json_encode(['error' => 'İstek zaman aşımına uğradı.']);
        exit;
    }

    // Şifrelenmiş verileri çöz
    if ($encryptedConnectionType && $encryptedPayload) {
        // Connection type'ı çöz
        $connectionTypeData = decryptPayloadSecure($encryptedConnectionType, $companyRef);
        if (!$connectionTypeData || !isset($connectionTypeData['type'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Connection type çözülemedi.']);
            exit;
        }
        $connectionType = $connectionTypeData['type'];
        
        // Payload'ı çöz
        $payload = decryptPayloadSecure($encryptedPayload, $companyRef);
        if (!$payload) {
            http_response_code(400);
            echo json_encode(['error' => 'Payload çözülemedi.']);
            exit;
        }
    } else if ($legacyConnectionType && $legacyPayload) {
        // Eski format - geriye uyumluluk
        $connectionType = $legacyConnectionType;
        $payload = $legacyPayload;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Şifrelenmiş veriler bulunamadı.']);
        exit;
    }

    // Sadece izinli sütunlardan bağlantı bilgisi al
    $allowedColumns = [
        'first_db_key',
        'second_db_key',
        'third_db_key',
        'enpos_db_key'
    ];

    if (!in_array($connectionType, $allowedColumns, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geçersiz connectionType değeri.']);
        exit;
    }

    // Veritabanı bağlantısı (örnek)
    $pdo = new PDO("mysql:host=localhost;dbname=btrapor", "username", "password");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // public_ip ve bağlantı stringini al
    $stmt = $pdo->prepare("
        SELECT public_ip, `$connectionType` AS connection_string
        FROM connection_info
        WHERE company_ref = :companyRef
        LIMIT 1
    ");
    $stmt->execute(['companyRef' => $companyRef]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || empty($row['public_ip']) || empty($row['connection_string'])) {
        http_response_code(404);
        echo json_encode(['error' => 'İlgili bağlantı bilgisi bulunamadı.']);
        exit;
    }

    // public_ip'den IP ve port'u ayır
    $publicIP = $row['public_ip'];
    $targetUrl = 'http://' . $publicIP . '/sql';

    // Hedef sunucunun beklediği format
    $forwardData = [
        'target_url' => $targetUrl,
        'payload' => [
            'connectionString' => $row['connection_string'],
            'query'            => $payload['query'] ?? ''
        ]
    ];

    $jsonData = json_encode($forwardData);

    // Debug log
    error_log("Proxy Request - Target: $targetUrl, Data: " . json_encode($forwardData));

    // Proxy ile POST isteği gönder
    $ch = curl_init($targetUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'POST',
        CURLOPT_POSTFIELDS     => $jsonData,
        CURLOPT_HTTPHEADER     => [
            "Content-Type: application/json",
            "Content-Length: " . strlen($jsonData)
        ],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_FORBID_REUSE   => true,
    ]);

    $result       = curl_exec($ch);
    $httpCode     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $responseType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $curlError    = curl_error($ch);
    curl_close($ch);

    if ($result === false) {
        http_response_code(502);
        echo json_encode([
            'error'      => 'Hedef sunucuya bağlantı başarısız.',
            'curl_error' => $curlError
        ]);
        exit;
    }

    // Debug log
    error_log("Proxy Response - HTTP Code: $httpCode, Response: $result");

    // Response'u döndür
    http_response_code($httpCode);
    if ($responseType) {
        header("Content-Type: $responseType");
    }
    echo $result;

} catch (Exception $e) {
    error_log("Proxy Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error'   => 'Sunucu tarafında bir hata oluştu.',
        'message' => $e->getMessage()
    ]);
}

// Şifrelenmiş payload'u çöz (AES-GCM ile)
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

// Company ref'den anahtar oluştur
function generateKeyFromCompanyRef($companyRef) {
    // Company ref'i hash'le
    $data = $companyRef . 'companyref';
    $hash = hash('sha256', $data, true); // true = raw binary output
    
    return $hash;
}

// Test fonksiyonu
function testEncryption() {
    $companyRef = "ABC123";
    $testData = ["query" => "SELECT * FROM test"];
    
    // JavaScript'te şifrelenmiş veri (örnek)
    $encrypted = "eyJxdWVyeSI6IlNFTEVDVCAqIEZST00gdGVzdCJ9";
    
    $decrypted = decryptPayloadSecure($encrypted, $companyRef);
    
    if ($decrypted === $testData) {
        echo "✅ Şifreleme testi başarılı\n";
    } else {
        echo "❌ Şifreleme testi başarısız\n";
    }
}

// Test çalıştır (sadece geliştirme ortamında)
if (isset($_GET['test']) && $_GET['test'] === 'encryption') {
    testEncryption();
    exit;
}
?> 