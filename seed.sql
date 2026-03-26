-- Test verisi
-- Şifreler: "Test1234" → bcrypt hash
-- Gerçek hash üretmek için: node -e "const b=require('bcrypt');b.hash('Test1234',12).then(console.log)"
-- Aşağıdaki hash'ler "Test1234" için üretilmiştir.

USE istakip;

INSERT INTO users (ad, email, sifre_hash, rol) VALUES
('Admin Kullanıcı', 'admin@example.com',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1K2K8M9O6e', 'admin'),
('Ahmet Yılmaz',    'ahmet@example.com',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1K2K8M9O6e', 'uye'),
('Fatma Kaya',      'fatma@example.com',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1K2K8M9O6e', 'uye'),
('Mehmet Demir',    'mehmet@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj1K2K8M9O6e', 'uye');

INSERT INTO projects (ad, aciklama, olusturan_id) VALUES
('Web Sitesi Yenileme', 'Kurumsal web sitesinin yeniden tasarımı', 1),
('Mobil Uygulama',      'iOS ve Android uygulaması geliştirme',    1),
('Altyapı İyileştirme', 'Sunucu ve CI/CD iyileştirmeleri',         2);

INSERT INTO tasks (baslik, aciklama, proje_id, atanan_id, olusturan_id, durum, oncelik, deadline) VALUES
('Ana sayfa tasarımı',       'Hero bölümü ve navigasyon yapımı',  1, 2, 1, 'devam_ediyor', 'yuksek',  CURDATE() + INTERVAL 2 DAY),
('İletişim formu',           'Validasyon ve backend entegrasyonu', 1, 3, 1, 'bekliyor',     'orta',    CURDATE() + INTERVAL 5 DAY),
('Login ekranı',             'JWT entegrasyonu ile giriş ekranı', 2, 2, 1, 'tamamlandi',   'yuksek',  CURDATE() - INTERVAL 1 DAY),
('Push notification',        'FCM entegrasyonu',                  2, 4, 1, 'bekliyor',     'orta',    CURDATE() + INTERVAL 10 DAY),
('Docker Compose kurulumu',  'Geliştirme ortamı containerization',3, 3, 2, 'devam_ediyor', 'yuksek',  CURDATE() - INTERVAL 3 DAY),
('CI/CD pipeline',           'GitHub Actions workflow',           3, 2, 2, 'bekliyor',     'dusuk',   CURDATE() + INTERVAL 7 DAY),
('SEO optimizasyonu',        'Meta taglar ve sitemap',            1, 4, 1, 'bekliyor',     'dusuk',   CURDATE()),
('API dökümantasyonu',       'Swagger ile API dokümantasyonu',    2, 3, 1, 'bekliyor',     'orta',    CURDATE() + INTERVAL 4 DAY);

INSERT INTO comments (task_id, kullanici_id, yorum) VALUES
(1, 2, 'Figma tasarımını inceledim, başlıyorum.'),
(1, 1, 'Renk paletini marka kitabından al.'),
(3, 2, 'Test edildi, merge edilebilir.'),
(5, 3, 'Docker Desktop kurulumu tamamlandı.'),
(5, 2, 'Production için ayrı bir compose dosyası lazım.');
