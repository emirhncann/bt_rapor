# BT Rapor - Kapsamlı Dokümantasyon

## 📋 İçindekiler

1. [Program Genel Bakış](#program-genel-bakış)
2. [Teknik Altyapı](#teknik-altyapı)
3. [Raporlar](#raporlar)
   - [Envanter Raporu](#envanter-raporu)
   - [Cari Bakiye Raporu](#cari-bakiye-raporu)
   - [Enpos Ciro Raporu](#enpos-ciro-raporu)
4. [Sistem Özellikleri](#sistem-özellikleri)
5. [Kullanıcı Yönetimi](#kullanıcı-yönetimi)
6. [API Entegrasyonları](#api-entegrasyonları)
7. [Güvenlik](#güvenlik)
8. [Kurulum ve Dağıtım](#kurulum-ve-dağıtım)

---

## 🏢 Program Genel Bakış

**BT Rapor**, Logo ERP sistemleri için geliştirilmiş modern bir raporlama platformudur. Program, şirketlerin finansal ve operasyonel verilerini analiz etmelerine, detaylı raporlar oluşturmalarına ve bu raporları çeşitli formatlarda dışa aktarmalarına olanak sağlar.

### 🎯 Ana Hedefler
- **Gerçek zamanlı veri analizi**: Logo veritabanlarından anlık veri çekimi
- **Kullanıcı dostu arayüz**: Modern ve responsive tasarım
- **Çoklu format desteği**: Excel, PDF export özellikleri
- **Güvenli erişim**: Rol tabanlı yetkilendirme sistemi
- **Performans optimizasyonu**: Hızlı veri işleme ve cache sistemi

### 🏗️ Mimari Yapı
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Animasyonlar**: Lottie React
- **Export**: jsPDF, xlsx
- **API**: RESTful API entegrasyonu

---

## ⚙️ Teknik Altyapı

### 🛠️ Teknolojiler

| Teknoloji | Versiyon | Amaç |
|------------|----------|------|
| Next.js | 14.1.0 | React framework |
| React | 18.2.0 | UI kütüphanesi |
| TypeScript | 5.3.3 | Tip güvenliği |
| Tailwind CSS | 3.4.1 | Styling |
| Lottie React | 2.4.1 | Animasyonlar |
| jsPDF | 3.0.1 | PDF export |
| xlsx | 0.18.5 | Excel export |

### 📁 Proje Yapısı

```
btRapor/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── components/        # React bileşenleri
│   ├── envanter-raporu/  # Envanter raporu sayfası
│   ├── c-bakiye/         # Cari bakiye raporu sayfası
│   ├── enpos-ciro/       # Enpos ciro raporu sayfası
│   ├── ayarlar/          # Sistem ayarları
│   └── utils/            # Yardımcı fonksiyonlar
├── public/               # Statik dosyalar
│   └── animations/       # Lottie animasyonları
├── types/               # TypeScript tip tanımları
└── data/               # Örnek veriler
```

### 🔧 Geliştirme Komutları

```bash
# Geliştirme sunucusu başlat
npm run dev

# Production build
npm run build

# Production sunucusu başlat
npm start

# Linting
npm run lint
```

---

## 📊 Raporlar

### 📦 Envanter Raporu

#### 🎯 Amaç
Şirketin stok durumunu detaylı olarak analiz etmek, malzeme bazında stok miktarlarını ve değerlerini görüntülemek.

#### ✨ Özellikler

**📋 Ana Özellikler:**
- **Çoklu şube desteği**: Tüm işyerlerinin stok bilgilerini tek tabloda görüntüleme
- **Dinamik kolonlar**: Şube sayısına göre otomatik kolon oluşturma
- **Filtreleme sistemi**: Malzeme kodu, grup kodu, özel kodlar ile filtreleme
- **Detaylı pop-up**: Malzeme bazında fiyat ve stok detayları
- **Market modülü entegrasyonu**: Market fiyatları (opsiyonel)

**🔍 Detay Pop-up Özellikleri:**
- **Fiyat bilgileri**: Son satış/alış fiyatları
- **Tanımlı fiyatlar**: Sistemde tanımlı satış/alış fiyatları
- **Market fiyatları**: Market modülü varsa market satış fiyatları
- **Stok değerleri**: Fiyat × stok miktarı hesaplamaları
- **İşyeri bazlı**: Her işyeri için ayrı fiyat ve stok bilgileri

**📊 Tablo Özellikleri:**
- **Sıralama**: Tüm kolonlarda sıralama
- **Arama**: Anlık arama filtreleme
- **Sayfalama**: Büyük veri setleri için sayfalama
- **Export**: Excel ve PDF export
- **Responsive**: Mobil ve tablet uyumlu

#### 🗂️ Veri Yapısı

**Ana Tablo Kolonları:**
- Malzeme Ref (LOGICALREF)
- Malzeme Kodu
- Malzeme Adı
- Grup Kodu ve Açıklaması
- Özel Kodlar (1-5) ve Açıklamaları
- Şube Kolonları (dinamik)
- Toplam Stok

**Detay Pop-up Kolonları:**
- İşyeri No ve Adı
- Stok Miktarı
- Son Satış/Alış Fiyatları (Net/Birim)
- Tanımlı Satış/Alış Fiyatları
- Market Satış Fiyatı (opsiyonel)
- Değer Hesaplamaları

#### 🔧 Teknik Detaylar

**SQL Sorguları:**
- Ana sorgu: `LG_FIRMA_ITEMS` tablosundan malzeme bilgileri
- Detay sorgusu: `LG_FIRMA_DONEM_STLINE` tablosundan fiyat bilgileri
- Market sorgusu: `LK_FIRMA_PRCLIST` tablosundan market fiyatları

**API Endpoints:**
- `/api/envanter-detay`: Malzeme detay bilgileri
- `/api/envanter-export`: Excel export
- `/api/envanter-whatsapp`: WhatsApp paylaşımı

**Cache Sistemi:**
- Connection bilgileri localStorage'da cache
- Market modülü bilgisi localStorage'da saklanır
- Filtre kodları cache sistemi

#### 📱 Kullanıcı Deneyimi

**Ana Sayfa:**
1. **Filtre Seçimi**: Malzeme kodu, grup kodu, özel kodlar
2. **Rapor Çalıştırma**: "Raporu Çalıştır" butonu
3. **Sonuç Görüntüleme**: Tablo formatında stok bilgileri
4. **Detay İnceleme**: Göz ikonu ile pop-up açma
5. **Export**: Excel/PDF export seçenekleri

**Detay Pop-up:**
- **Desktop**: Tam tablo görünümü
- **Mobil**: Kart formatında görünüm
- **Yenileme**: Cache bypass ile güncel veri
- **Kapatma**: X butonu veya backdrop tıklama

---

### 💰 Cari Bakiye Raporu

#### 🎯 Amaç
Müşteri ve tedarikçi cari hesaplarının bakiye durumlarını analiz etmek, çoklu para birimi desteği ile detaylı finansal raporlama.

#### ✨ Özellikler

**📋 Ana Özellikler:**
- **Çoklu para birimi**: TRY, USD, EUR, GBP desteği
- **Cari detayları**: Müşteri/tedarikçi bazında detaylı bilgiler
- **Bakiye hesaplamaları**: Borç/alacak bakiyeleri
- **Hareket detayları**: Cari hesap hareket geçmişi
- **Preload sistemi**: Performans için önceden yükleme

**🔍 Detay Pop-up Özellikleri:**
- **Hareket geçmişi**: Tarih bazlı hareket listesi
- **Borç/Alacak**: Her hareketin borç/alacak tutarı
- **Bakiye takibi**: Kümülatif bakiye hesaplaması
- **Çoklu para birimi**: Her hareketin para birimi
- **Filtreleme**: Tarih aralığı filtreleme

**📊 Tablo Özellikleri:**
- **Para birimi seçimi**: Çoklu para birimi desteği
- **Bakiye hesaplamaları**: Net bakiye, borç, alacak
- **Sıralama**: Tüm kolonlarda sıralama
- **Arama**: Cari kodu ve adı ile arama
- **Export**: Excel ve PDF export

#### 🗂️ Veri Yapısı

**Ana Tablo Kolonları:**
- Cari Ref (LOGICALREF)
- Cari Kodu
- Cari Adı
- Borç Tutarı
- Alacak Tutarı
- Net Bakiye
- Para Birimi

**Detay Pop-up Kolonları:**
- Tarih
- Belge No
- Açıklama
- Borç Tutarı
- Alacak Tutarı
- Bakiye
- Para Birimi

#### 🔧 Teknik Detaylar

**SQL Sorguları:**
- Ana sorgu: `LG_FIRMA_CLCARD` tablosundan cari bilgileri
- Hareket sorgusu: `LG_FIRMA_DONEM_CLFLINE` tablosundan hareketler
- Bakiye hesaplaması: Borç - Alacak

**Para Birimi Sistemi:**
- **TRY (53)**: Türk Lirası
- **USD (1)**: Amerikan Doları
- **EUR (2)**: Euro
- **GBP (3)**: İngiliz Sterlini

**Preload Sistemi:**
- Throttling ile performans optimizasyonu
- Cache sistemi ile hızlı erişim
- Background loading

#### 📱 Kullanıcı Deneyimi

**Ana Sayfa:**
1. **Para Birimi Seçimi**: Currency selector ile para birimi
2. **Rapor Çalıştırma**: "Raporu Çalıştır" butonu
3. **Sonuç Görüntüleme**: Tablo formatında bakiye bilgileri
4. **Detay İnceleme**: Göz ikonu ile hareket detayları
5. **Export**: Excel/PDF export seçenekleri

**Detay Pop-up:**
- **Hareket Listesi**: Tarih sıralı hareket geçmişi
- **Bakiye Takibi**: Kümülatif bakiye hesaplaması
- **Para Birimi**: Her hareketin para birimi gösterimi
- **Filtreleme**: Tarih aralığı filtreleme

---

### 📈 Enpos Ciro Raporu

#### 🎯 Amaç
Şirketin satış performansını analiz etmek, günlük/aylık ciro verilerini takip etmek, otomatik yenileme ile gerçek zamanlı izleme.

#### ✨ Özellikler

**📋 Ana Özellikler:**
- **Tarih aralığı seçimi**: Başlangıç-bitiş tarihi belirleme
- **Otomatik yenileme**: 30 saniyede bir otomatik güncelleme
- **Preset tarihler**: Bugün, dün, bu hafta, bu ay seçenekleri
- **Ciro hesaplamaları**: Net ciro, KDV'li ciro
- **Performans analizi**: Günlük/aylık karşılaştırmalar

**📊 Tablo Özellikleri:**
- **Tarih bazlı**: Günlük ciro verileri
- **Toplam hesaplamaları**: Seçili tarih aralığı toplamları
- **Karşılaştırma**: Önceki dönem ile karşılaştırma
- **Trend analizi**: Artış/azalış göstergeleri
- **Export**: Excel ve PDF export

**🔄 Otomatik Yenileme:**
- **30 saniye aralık**: Otomatik veri güncelleme
- **Toggle kontrolü**: Açma/kapama seçeneği
- **Background refresh**: Arka planda veri çekimi
- **Error handling**: Hata durumunda yenileme durdurma

#### 🗂️ Veri Yapısı

**Ana Tablo Kolonları:**
- Tarih
- Net Ciro
- KDV'li Ciro
- Fatura Sayısı
- Ortalama Fatura Tutarı
- Önceki Dönem Karşılaştırması

**Hesaplama Alanları:**
- **Net Ciro**: KDV hariç toplam satış
- **KDV'li Ciro**: KDV dahil toplam satış
- **Ortalama Fatura**: Toplam ciro / fatura sayısı
- **Trend**: Önceki dönem ile karşılaştırma

#### 🔧 Teknik Detaylar

**SQL Sorguları:**
- Ana sorgu: `LG_FIRMA_DONEM_INVOICE` tablosundan fatura bilgileri
- Tarih filtreleme: Başlangıç-bitiş tarihi aralığı
- Ciro hesaplaması: Satış tutarlarının toplamı

**Tarih Sistemi:**
- **Format**: YYMMDD formatında tarih işleme
- **Preset'ler**: Bugün, dün, bu hafta, bu ay
- **Custom range**: Manuel tarih seçimi
- **Validation**: Geçerli tarih kontrolü

**Otomatik Yenileme:**
- **setInterval**: 30 saniye aralık
- **useEffect cleanup**: Component unmount'ta temizleme
- **State management**: Loading durumu yönetimi
- **Error handling**: Network hatalarında durdurma

#### 📱 Kullanıcı Deneyimi

**Ana Sayfa:**
1. **Tarih Seçimi**: Date picker ile tarih aralığı
2. **Preset Seçimi**: Hızlı tarih seçenekleri
3. **Otomatik Yenileme**: Toggle ile açma/kapama
4. **Rapor Çalıştırma**: "Raporu Çalıştır" butonu
5. **Sonuç Görüntüleme**: Tablo formatında ciro verileri
6. **Export**: Excel/PDF export seçenekleri

**Özellikler:**
- **Real-time**: Otomatik yenileme ile güncel veriler
- **Responsive**: Mobil ve tablet uyumlu
- **Interactive**: Tarih seçimi ve filtreleme
- **Export**: Çoklu format desteği

---

## 🏗️ Sistem Özellikleri

### 🔐 Güvenlik Sistemi

**Authentication:**
- JWT token tabanlı kimlik doğrulama
- localStorage ile session yönetimi
- Otomatik logout (session timeout)

**Authorization:**
- Rol tabanlı erişim kontrolü (admin, user)
- Rapor bazında yetkilendirme
- API seviyesinde güvenlik kontrolleri

**Data Protection:**
- HTTPS zorunluluğu
- SQL injection koruması
- XSS koruması
- CSRF token kullanımı

### 📊 Veri Yönetimi

**Cache Sistemi:**
- Connection bilgileri cache
- Rapor verileri cache
- Filtre kodları cache
- Market modülü bilgisi cache

**Performance Optimizasyonu:**
- Lazy loading
- Preload sistemi
- Throttling
- Background processing

**Error Handling:**
- Try-catch blokları
- User-friendly error mesajları
- Fallback mekanizmaları
- Logging sistemi

### 🎨 Kullanıcı Arayüzü

**Design System:**
- Tailwind CSS framework
- Responsive tasarım
- Dark/Light mode desteği
- Accessibility (WCAG) uyumluluğu

**Animasyonlar:**
- Lottie animasyonları
- Loading states
- Success/Error animasyonları
- Smooth transitions

**Component Library:**
- Reusable components
- TypeScript tip güvenliği
- Props validation
- Event handling

---

## 👥 Kullanıcı Yönetimi

### 🔑 Kullanıcı Rolleri

**Admin:**
- Tüm raporlara erişim
- Sistem ayarları yönetimi
- Kullanıcı yönetimi
- Veritabanı konfigürasyonu

**User:**
- Yetkili raporlara erişim
- Kendi profil yönetimi
- Favori raporlar
- Export işlemleri

### 📋 Kullanıcı Özellikleri

**Profil Yönetimi:**
- Kullanıcı bilgileri
- Şifre değiştirme
- Tercihler
- Favori raporlar

**Favori Raporlar:**
- En fazla 3 rapor sabitleme
- Hızlı erişim
- Cloud sync
- localStorage backup

**Ayarlar:**
- Tema seçimi
- Dil seçimi
- Bildirim ayarları
- Export tercihleri

---

## 🔌 API Entegrasyonları

### 🌐 External APIs

**api.btrapor.com:**
- Kullanıcı authentication
- Rapor yetkileri
- Favori raporlar
- Connection bilgileri
- Sistem durumu

**Logo ERP:**
- Veritabanı bağlantısı
- SQL sorguları
- Real-time veri çekimi
- Transaction yönetimi

### 📡 API Endpoints

**Authentication:**
- `POST /login`: Kullanıcı girişi
- `GET /logout`: Kullanıcı çıkışı
- `GET /user-info`: Kullanıcı bilgileri

**Reports:**
- `GET /user-reports`: Kullanıcı raporları
- `POST /report-access`: Rapor erişim kontrolü
- `GET /favorite-reports`: Favori raporlar

**Data:**
- `POST /envanter-detay`: Envanter detayları
- `POST /c-bakiye`: Cari bakiye verileri
- `POST /enpos-ciro`: Ciro verileri

**Export:**
- `POST /export-excel`: Excel export
- `POST /export-pdf`: PDF export
- `POST /whatsapp-share`: WhatsApp paylaşımı

---

## 🛡️ Güvenlik

### 🔒 Veri Güvenliği

**Encryption:**
- HTTPS zorunluluğu
- Sensitive data encryption
- API key protection
- Database encryption

**Access Control:**
- Role-based access control (RBAC)
- Resource-level permissions
- API rate limiting
- Session management

**Audit Trail:**
- User activity logging
- Report access logs
- Export activity tracking
- Error logging

### 🚨 Güvenlik Önlemleri

**Input Validation:**
- SQL injection koruması
- XSS koruması
- CSRF token kullanımı
- Input sanitization

**Network Security:**
- HTTPS enforcement
- CORS policy
- API authentication
- Rate limiting

**Data Protection:**
- GDPR uyumluluğu
- Data retention policies
- Backup strategies
- Disaster recovery

---

## 🚀 Kurulum ve Dağıtım

### 📋 Gereksinimler

**System Requirements:**
- Node.js 18+
- npm v9+
- Modern web browser
- Internet connection

**Dependencies:**
- Next.js 14.1.0
- React 18.2.0
- TypeScript 5.3.3
- Tailwind CSS 3.4.1

### 🔧 Kurulum Adımları

```bash
# Repository'yi klonla
git clone https://github.com/username/btrapor.git
cd btrapor

# Dependencies'leri yükle
npm install

# Environment variables'ları ayarla
cp .env.example .env.local
# .env.local dosyasını düzenle

# Development sunucusunu başlat
npm run dev
```

### 🌍 Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.btrapor.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_NAME=logo_db
DB_USER=username
DB_PASSWORD=password

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

### 📦 Production Build

```bash
# Production build
npm run build

# Production sunucusunu başlat
npm start

# Docker ile dağıtım
docker build -t btrapor .
docker run -p 3000:3000 btrapor
```

### 🔄 Deployment

**Vercel:**
```bash
# Vercel CLI kurulumu
npm i -g vercel

# Deploy
vercel --prod
```

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📈 Performans Optimizasyonu

### ⚡ Frontend Optimizasyonu

**Code Splitting:**
- Dynamic imports
- Lazy loading
- Route-based splitting
- Component-level splitting

**Bundle Optimization:**
- Tree shaking
- Minification
- Compression
- CDN usage

**Caching:**
- Browser caching
- Service worker
- localStorage cache
- Memory cache

### 🗄️ Backend Optimizasyonu

**Database:**
- Query optimization
- Indexing
- Connection pooling
- Caching

**API:**
- Response compression
- Rate limiting
- Caching headers
- Error handling

---

## 🐛 Hata Ayıklama

### 🔍 Debug Araçları

**Frontend:**
- React Developer Tools
- Chrome DevTools
- Console logging
- Error boundaries

**Backend:**
- API logging
- Database logging
- Error tracking
- Performance monitoring

### 📝 Logging Sistemi

**Log Levels:**
- ERROR: Kritik hatalar
- WARN: Uyarılar
- INFO: Bilgi mesajları
- DEBUG: Debug bilgileri

**Log Format:**
```javascript
console.log('🔍 Debug:', { data, timestamp });
console.error('❌ Error:', error);
console.warn('⚠️ Warning:', message);
console.info('ℹ️ Info:', info);
```

---

## 🔄 Güncelleme ve Bakım

### 📦 Version Management

**Semantic Versioning:**
- MAJOR.MINOR.PATCH
- Breaking changes
- Feature additions
- Bug fixes

**Changelog:**
- Version history
- Feature updates
- Bug fixes
- Breaking changes

### 🛠️ Maintenance

**Regular Tasks:**
- Dependency updates
- Security patches
- Performance monitoring
- Backup verification

**Monitoring:**
- Error tracking
- Performance metrics
- User analytics
- System health

---

## 📞 Destek ve İletişim

### 🆘 Teknik Destek

**Support Channels:**
- Email: support@btrapor.com
- Phone: +90 xxx xxx xx xx
- Documentation: docs.btrapor.com
- GitHub Issues: github.com/btrapor/issues

**Response Times:**
- Critical: 2 saat
- High: 24 saat
- Medium: 48 saat
- Low: 1 hafta

### 📚 Kaynaklar

**Documentation:**
- User Guide
- API Documentation
- Developer Guide
- FAQ

**Training:**
- Video tutorials
- Webinars
- On-site training
- Online courses

---

## 📄 Lisans ve Yasal

### 📜 Lisans Bilgileri

**Software License:**
- Proprietary software
- Commercial license
- Annual subscription
- Enterprise options

**Third-party Licenses:**
- MIT License (React, Next.js)
- Apache 2.0 (TypeScript)
- BSD 3-Clause (Tailwind CSS)

### ⚖️ Yasal Uyumluluk

**GDPR:**
- Data protection
- User consent
- Right to be forgotten
- Data portability

**KVKK:**
- Turkish data protection
- Personal data processing
- Data controller obligations
- User rights

---

*Bu dokümantasyon BT Rapor v1.0 için hazırlanmıştır. Güncellemeler için lütfen resmi dokümantasyonu takip edin.* 