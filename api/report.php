<?php
require_once __DIR__ . '/../config/db.php';

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

return function ($app) {
    $app->post('/proxy', function (Request $request, Response $response) {
        try {
            $parsedBody = json_decode((string)$request->getBody(), true);

            if (!is_array($parsedBody)) {
                return proxyJsonResponse($response, [
                    'error' => 'Geçersiz JSON formatı.'
                ], 400);
            }

            $companyRef     = $parsedBody['companyRef'] ?? null;
            $connectionType = $parsedBody['connectionType'] ?? null;
            $payload        = $parsedBody['payload'] ?? [];

            if (!$companyRef || !$connectionType || !is_string($companyRef) || !is_string($connectionType)) {
                return proxyJsonResponse($response, [
                    'error' => 'companyRef ve connectionType zorunludur ve string olmalıdır.'
                ], 400);
            }

            // Sadece izinli sütunlardan bağlantı bilgisi al
            $allowedColumns = [
                'first_db_key',
                'second_db_key',
                'third_db_key',
                'enpos_db_key'
            ];

            if (!in_array($connectionType, $allowedColumns, true)) {
                return proxyJsonResponse($response, [
                    'error' => 'Geçersiz connectionType değeri.'
                ], 400);
            }

            $pdo = getDBConnection();

            // 1. public_ip ve bağlantı stringini birlikte al
            $stmt = $pdo->prepare("
                SELECT public_ip, `$connectionType` AS connection_string
                FROM connection_info
                WHERE company_ref = :companyRef
                LIMIT 1
            ");
            $stmt->execute(['companyRef' => $companyRef]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row || empty($row['public_ip']) || empty($row['connection_string'])) {
                return proxyJsonResponse($response, [
                    'error' => 'İlgili bağlantı bilgisi bulunamadı.'
                ], 404);
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

            // 2. Proxy ile POST isteği gönder
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
                return proxyJsonResponse($response, [
                    'error'      => 'Hedef sunucuya bağlantı başarısız.',
                    'curl_error' => $curlError
                ], 502);
            }

            // Debug log
            error_log("Proxy Response - HTTP Code: $httpCode, Response: $result");

            $response->getBody()->write($result);
            return $response
                ->withHeader('Content-Type', $responseType ?: 'application/json')
                ->withStatus($httpCode);

        } catch (\Throwable $e) {
            error_log("Proxy Error: " . $e->getMessage());
            return proxyJsonResponse($response, [
                'error'   => 'Sunucu tarafında bir hata oluştu.',
                'message' => $e->getMessage()
            ], 500);
        }
    });
};

function proxyJsonResponse(Response $response, array $data, int $statusCode): Response {
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
    return $response
        ->withHeader('Content-Type', 'application/json')
        ->withStatus($statusCode);
}
?> 