## btRapor — Süper Admin Paneli Kılavuzu

Bu doküman, Süper Admin panelinin özelliklerini ve api.btrapor.com ile entegrasyonunu özetler.

Genel Yapı
- Ana sayfa: app/super-admin/page.tsx
- Şirket modalı: app/components/modals/CompanyModal.tsx
- Şirket tablosu: app/components/tables/CompaniesTable.tsx
- Şirket API proxy: app/api/super-admin/companies/route.ts
- Production API base URL: https://api.btrapor.com

Başlıca Özellikler
- Şirket listeleme, arama, sıralama
- Yeni şirket ekleme / düzenleme (upsert destekli)
- Şirket silme

Form Doğrulamaları (Önemli Değişiklikler)
- Yönetici şifresi min. 6 karakter şartı kaldırıldı (sadece boş olamaz)
- Lisans anahtarı alanı opsiyonel (nullable)
- Plan referansı seçenekleri: temel, standart, premium

API Akışları
- Listeleme: GET /api/super-admin/companies → GET https://api.btrapor.com/companies
- Oluşturma: POST /api/super-admin/companies → PUT https://api.btrapor.com/update/companies/0
- Güncelleme: PUT /api/super-admin/companies → PUT https://api.btrapor.com/update/companies/{id}
- Silme: DELETE /api/super-admin/companies?companyId={id} → DELETE https://api.btrapor.com/companies/{id}

Notlar
- adress alanı zorunludur. UI address gönderirse proxy bunu adress alanına map eder.
- Geliştirmede istemci /api/... çağırır; Next API proxy dış API'ye yönlendirir.

Gelecek Geliştirmeler
- Şirket oluşturma sonrası otomatik yönetici kullanıcı upsert
- Lisans ve modül upsert entegrasyonları


