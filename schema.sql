-- İş Takip Uygulaması Veritabanı Şeması
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS istakip
  CHARACTER SET utf8mb4 COLLATE utf8mb4_turkish_ci;

USE istakip;

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ad          VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  sifre_hash  VARCHAR(255)  NOT NULL,
  rol         ENUM('admin','uye') NOT NULL DEFAULT 'uye',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Refresh token'ları (JWT refresh stratejisi)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kullanici_id  INT UNSIGNED NOT NULL,
  token         TEXT NOT NULL,
  expires_at    DATETIME NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (kullanici_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Projeler / Kategoriler
CREATE TABLE IF NOT EXISTS projects (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ad           VARCHAR(200) NOT NULL,
  aciklama     TEXT,
  olusturan_id INT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proj_user FOREIGN KEY (olusturan_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Görevler
CREATE TABLE IF NOT EXISTS tasks (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  baslik       VARCHAR(300) NOT NULL,
  aciklama     TEXT,
  proje_id     INT UNSIGNED NOT NULL,
  atanan_id    INT UNSIGNED,
  olusturan_id INT UNSIGNED NOT NULL,
  durum        ENUM('bekliyor','devam_ediyor','tamamlandi') NOT NULL DEFAULT 'bekliyor',
  oncelik      ENUM('dusuk','orta','yuksek') NOT NULL DEFAULT 'orta',
  deadline     DATE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_proj   FOREIGN KEY (proje_id)     REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_atanan FOREIGN KEY (atanan_id)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_task_olusturan FOREIGN KEY (olusturan_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Dosya Ekleri
CREATE TABLE IF NOT EXISTS attachments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id      INT UNSIGNED,                          -- NULL olabilir (göreve bağlı olmayabilir)
  kullanici_id INT UNSIGNED NOT NULL,
  orijinal_ad  VARCHAR(255) NOT NULL,                 -- Kullanıcının yüklediği dosya adı
  dosya_ad     VARCHAR(255) NOT NULL,                 -- Sunucuda saklanan benzersiz ad
  mime_turu    VARCHAR(100),
  boyut        INT UNSIGNED,                          -- Bayt cinsinden
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_task FOREIGN KEY (task_id)      REFERENCES tasks(id) ON DELETE SET NULL,
  CONSTRAINT fk_att_user FOREIGN KEY (kullanici_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Görev Kontrol Listesi (Checklist)
CREATE TABLE IF NOT EXISTS checklist_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id         INT UNSIGNED NOT NULL,
  metin           VARCHAR(500) NOT NULL,
  tamamlandi      TINYINT(1) NOT NULL DEFAULT 0,
  sira            INT UNSIGNED NOT NULL DEFAULT 0,
  tahmini_bitis   DATE,                              -- Tahmini bitiş tarihi (opsiyonel)
  olusturan_id    INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ci_task FOREIGN KEY (task_id)      REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_user FOREIGN KEY (olusturan_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Mevcut tabloya sütun eklemek için (tablo zaten varsa çalıştırın):
-- ALTER TABLE checklist_items ADD COLUMN tahmini_bitis DATE AFTER sira;

-- Yorumlar
CREATE TABLE IF NOT EXISTS comments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id      INT UNSIGNED NOT NULL,
  kullanici_id INT UNSIGNED NOT NULL,
  yorum        TEXT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comm_task FOREIGN KEY (task_id)      REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_comm_user FOREIGN KEY (kullanici_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
