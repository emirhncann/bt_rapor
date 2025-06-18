<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// CSV dosyasının yolu
$csvFile = 'data/report.csv';

// CSV dosyasını oku
$data = [];
if (($handle = fopen($csvFile, "r")) !== FALSE) {
    // Başlık satırını oku
    $headers = fgetcsv($handle);
    
    // Verileri oku
    while (($row = fgetcsv($handle)) !== FALSE) {
        $data[] = array_combine($headers, $row);
    }
    fclose($handle);
}

// JSON olarak döndür
echo json_encode($data);
?> 