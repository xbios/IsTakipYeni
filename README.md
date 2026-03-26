# İş Takip Uygulaması

Node.js + Vanilla JS + MySQL ile küçük ekipler için görev yönetimi.

## Kurulum

### 1. Paketleri yükle
```bash
npm install
```
Yüklenen paketler:
| Paket | Amaç |
|---|---|
| express | HTTP sunucusu |
| mysql2 | MySQL bağlantı havuzu (promise desteği) |
| bcrypt | Şifre hashleme |
| jsonwebtoken | JWT access/refresh token |
| cookie-parser | HttpOnly cookie okuma |
| cors | CORS başlıkları |
| dotenv | .env dosyasından ortam değişkenleri |
| nodemon *(dev)* | Geliştirmede otomatik restart |

### 2. Veritabanı oluştur
```sql
mysql -u root -p < schema.sql
mysql -u root -p istakip < seed.sql
```

### 3. .env dosyasını düzenle
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=sifreniz
DB_NAME=istakip
JWT_ACCESS_SECRET=guclu_bir_rastgele_string
JWT_REFRESH_SECRET=baska_bir_guclu_string
PORT=3000
```

### 4. Uygulamayı başlat
```bash
# Geliştirme (otomatik restart)
npm run dev

# Production
npm start
```

Uygulama: http://localhost:3000

---

## Test Kullanıcıları (seed.sql)
| E-posta | Şifre | Rol |
|---|---|---|
| admin@example.com | Test1234 | admin |
| ahmet@example.com | Test1234 | üye |
| fatma@example.com | Test1234 | üye |
| mehmet@example.com | Test1234 | üye |

> ⚠️ seed.sql'deki hash'ler "Test1234" için üretilmiştir.
> Farklı bir şifre kullanmak isterseniz:
> `node -e "require('bcrypt').hash('YeniSifre',12).then(console.log)"`

---

## API Referansı

### Auth
| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | /api/auth/register | Kayıt |
| POST | /api/auth/login | Giriş |
| POST | /api/auth/refresh | Access token yenile |
| POST | /api/auth/logout | Çıkış (refresh token iptal) |

### Projeler (korumalı)
| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | /api/projects | Tüm projeler |
| GET | /api/projects/:id | Tek proje |
| POST | /api/projects | Yeni proje |
| PUT | /api/projects/:id | Güncelle |
| DELETE | /api/projects/:id | Sil |

### Görevler (korumalı)
| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | /api/tasks/dashboard | Dashboard istatistikleri |
| GET | /api/tasks | Liste (filtre: proje_id, durum, atanan_id, oncelik, arama) |
| GET | /api/tasks/:id | Tek görev |
| POST | /api/tasks | Yeni görev |
| PUT | /api/tasks/:id | Güncelle |
| DELETE | /api/tasks/:id | Sil |

### Yorumlar (korumalı)
| Metot | Endpoint | Açıklama |
|---|---|---|
| GET | /api/comments/task/:taskId | Göreve ait yorumlar |
| POST | /api/comments | Yorum ekle |
| PUT | /api/comments/:id | Güncelle (sadece sahibi) |
| DELETE | /api/comments/:id | Sil (sahibi veya admin) |

---

## Güvenlik Notları
- Access token **yalnızca memory'de** (JS değişkeni) tutulur — localStorage/sessionStorage yok
- Refresh token **HttpOnly cookie** olarak taşınır
- Tüm SQL sorguları **parametreli** (`?` placeholder) — SQL injection yok
- Şifreler **bcrypt** (cost=12) ile hash'lenir
- `.env` dosyası `.gitignore`'a eklenmiştir
