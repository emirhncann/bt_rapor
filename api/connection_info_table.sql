-- Connection Info tablosu
CREATE TABLE IF NOT EXISTS connection_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_ref INT NOT NULL,
    
    -- BT Service ayarları
    public_ip VARCHAR(255),
    endpoint VARCHAR(255),
    
    -- İlk database (güncel yıl)
    first_db_key TEXT,
    first_firma_no VARCHAR(10),
    first_donem_no VARCHAR(10),
    first_server_name VARCHAR(255),
    first_db_name VARCHAR(255),
    first_username VARCHAR(255),
    first_password VARCHAR(255),
    
    -- İkinci database (bir önceki yıl)
    second_db_key TEXT,
    second_firma_no VARCHAR(10),
    second_donem_no VARCHAR(10),
    second_server_name VARCHAR(255),
    second_db_name VARCHAR(255),
    second_username VARCHAR(255),
    second_password VARCHAR(255),
    
    -- Üçüncü database (iki önceki yıl)
    third_db_key TEXT,
    third_firma_no VARCHAR(10),
    third_donem_no VARCHAR(10),
    third_server_name VARCHAR(255),
    third_db_name VARCHAR(255),
    third_username VARCHAR(255),
    third_password VARCHAR(255),
    
    -- ENPOS database
    enpos_db_key TEXT,
    enpos_firma_no VARCHAR(10),
    enpos_donem_no VARCHAR(10),
    enpos_server_name VARCHAR(255),
    enpos_database_name VARCHAR(255),
    enpos_username VARCHAR(255),
    enpos_password VARCHAR(255),
    
    -- Logo Kurulum Database
    logoKurulumDbName VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_company_ref (company_ref)
); 