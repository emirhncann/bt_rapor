<?php
require_once __DIR__ . '/../config/db.php';

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

return function ($app) {
// ... önceki kodlar ...

$app->post('/save-connections', function (Request $request, Response $response) {
    try {
        $data = json_decode($request->getBody()->getContents(), true);
        $companyRef = intval($data['company_ref'] ?? 0);

        if ($companyRef === 0) {
            $response->getBody()->write(json_encode([
                "status" => "error",
                "message" => "Geçerli bir company_ref değeri zorunludur."
            ], JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        function buildConnectionString($server, $db, $user, $pass) {
            return "Server=$server;Database=$db;User Id=$user;Password=$pass;";
        }

        $first_db_key = buildConnectionString(
            $data['first_server_name'] ?? '',
            $data['first_db_name'] ?? '',
            $data['first_username'] ?? '',
            $data['first_password'] ?? ''
        );

        $second_db_key = buildConnectionString(
            $data['second_server_name'] ?? '',
            $data['second_db_name'] ?? '',
            $data['second_username'] ?? '',
            $data['second_password'] ?? ''
        );

        $third_db_key = buildConnectionString(
            $data['third_server_name'] ?? '',
            $data['third_db_name'] ?? '',
            $data['third_username'] ?? '',
            $data['third_password'] ?? ''
        );

        $enpos_db_key = buildConnectionString(
            $data['enpos_server_name'] ?? '',
            $data['enpos_database_name'] ?? '',
            $data['enpos_username'] ?? '',
            $data['enpos_password'] ?? ''
        );

        $db = getDBConnection();

        // Eski kayıtları sil
        $delete = $db->prepare("DELETE FROM connection_info WHERE company_ref = :company_ref");
        $delete->execute([':company_ref' => $companyRef]);

        // Yeni kayıt ekle
        $stmt = $db->prepare("
            INSERT INTO connection_info (
                company_ref,
                first_db_key, first_firma_no, first_donem_no, first_server_name, first_db_name, first_username, first_password,
                second_db_key, second_firma_no, second_donem_no, second_server_name, second_db_name, second_username, second_password,
                third_db_key, third_firma_no, third_donem_no, third_server_name, third_db_name, third_username, third_password,
                enpos_db_key, enpos_server_name, enpos_database_name, enpos_username, enpos_password,
                public_ip, endpoint, logoKurulumDbName
            ) VALUES (
                :company_ref,
                :first_db_key, :first_firma_no, :first_donem_no, :first_server_name, :first_db_name, :first_username, :first_password,
                :second_db_key, :second_firma_no, :second_donem_no, :second_server_name, :second_db_name, :second_username, :second_password,
                :third_db_key, :third_firma_no, :third_donem_no, :third_server_name, :third_db_name, :third_username, :third_password,
                :enpos_db_key, :enpos_server_name, :enpos_database_name, :enpos_username, :enpos_password,
                :public_ip, :endpoint, :logoKurulumDbName
            )
        ");

        $stmt->execute([
            ':company_ref' => $companyRef,
            ':first_db_key' => $first_db_key,
            ':first_firma_no' => $data['first_firma_no'] ?? null,
            ':first_donem_no' => $data['first_donem_no'] ?? null,
            ':first_server_name' => $data['first_server_name'] ?? null,
            ':first_db_name' => $data['first_db_name'] ?? null,
            ':first_username' => $data['first_username'] ?? null,
            ':first_password' => $data['first_password'] ?? null,
            ':second_db_key' => $second_db_key,
            ':second_firma_no' => $data['second_firma_no'] ?? null,
            ':second_donem_no' => $data['second_donem_no'] ?? null,
            ':second_server_name' => $data['second_server_name'] ?? null,
            ':second_db_name' => $data['second_db_name'] ?? null,
            ':second_username' => $data['second_username'] ?? null,
            ':second_password' => $data['second_password'] ?? null,
            ':third_db_key' => $third_db_key,
            ':third_firma_no' => $data['third_firma_no'] ?? null,
            ':third_donem_no' => $data['third_donem_no'] ?? null,
            ':third_server_name' => $data['third_server_name'] ?? null,
            ':third_db_name' => $data['third_db_name'] ?? null,
            ':third_username' => $data['third_username'] ?? null,
            ':third_password' => $data['third_password'] ?? null,
            ':enpos_db_key' => $enpos_db_key,
            ':enpos_server_name' => $data['enpos_server_name'] ?? null,
            ':enpos_database_name' => $data['enpos_database_name'] ?? null,
            ':enpos_username' => $data['enpos_username'] ?? null,
            ':enpos_password' => $data['enpos_password'] ?? null,
            ':public_ip' => $data['public_ip'] ?? null,
            ':endpoint' => null, // Artık public_ip içinde birleştirildi
            ':logoKurulumDbName' => $data['logoKurulumDbName'] ?? null
        ]);

        $response->getBody()->write(json_encode([
            "status" => "success",
            "message" => "Kayıt başarıyla güncellendi (veya yeniden eklendi)."
        ], JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);

    } catch (Exception $e) {
        $response->getBody()->write(json_encode([
            "status" => "error",
            "message" => "Hata: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(500);
    }
});

// VERİ GETİRME ENDPOINT (company_ref ile)
$app->get('/connection-info/{company_ref}', function (Request $request, Response $response, array $args) {
    try {
        $companyRef = intval($args['company_ref']);
        if ($companyRef <= 0) {
            $response->getBody()->write(json_encode([
                "status" => "error",
                "message" => "Geçerli bir company_ref girilmelidir."
            ], JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $db = getDBConnection();
        $stmt = $db->prepare("SELECT * FROM connection_info WHERE company_ref = :company_ref LIMIT 1");
        $stmt->execute([':company_ref' => $companyRef]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($record) {
            $response->getBody()->write(json_encode([
                "status" => "success",
                "data" => $record
            ], JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
        } else {
            $response->getBody()->write(json_encode([
                "status" => "error",
                "message" => "Kayıt bulunamadı."
            ], JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

    } catch (Exception $e) {
        $response->getBody()->write(json_encode([
            "status" => "error",
            "message" => "Hata: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(500);
    }
});

// ...


}; 