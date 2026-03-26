// Dosya ekleri route'ları — multer ile upload, download, listeleme, silme
const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const pool   = require('../db');
const auth   = require('../middleware/authMiddleware');

// Yüklemelerin kaydedileceği dizin
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// İzin verilen MIME tipleri
const IZINLI_TIPLER = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

// Multer depolama ayarları — dosya adını benzersiz yapıyoruz
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const benzersiz = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const uzanti    = path.extname(file.originalname);
    cb(null, benzersiz + uzanti);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (IZINLI_TIPLER.has(file.mimetype)) cb(null, true);
    else cb(new Error('Desteklenmeyen dosya türü'));
  },
});

// --- Tüm dosyaları listele (isteğe bağlı task_id filtresi) ---
router.get('/', auth, async (req, res) => {
  try {
    const { task_id } = req.query;
    let sql = `SELECT a.*, u.ad AS yukleyen_ad, t.baslik AS gorev_baslik
               FROM attachments a
               JOIN users u ON u.id = a.kullanici_id
               LEFT JOIN tasks t ON t.id = a.task_id
               WHERE 1=1`;
    const params = [];
    if (task_id) { sql += ' AND a.task_id = ?'; params.push(task_id); }
    sql += ' ORDER BY a.created_at DESC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Dosya yükle ---
router.post('/', auth, upload.single('dosya'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });

    const { task_id } = req.body;

    // task_id varsa gerçekten var mı kontrol et
    if (task_id) {
      const [t] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [task_id]);
      if (t.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Bağlanılacak görev bulunamadı' });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO attachments (task_id, kullanici_id, orijinal_ad, dosya_ad, mime_turu, boyut)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        task_id || null,
        req.user.id,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
      ]
    );
    res.status(201).json({ id: result.insertId, orijinal_ad: req.file.originalname });
  } catch (err) {
    // Multer hataları (dosya türü, boyut)
    if (err.message === 'Desteklenmeyen dosya türü')
      return res.status(400).json({ error: err.message });
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ error: 'Dosya boyutu 10 MB sınırını aşıyor' });
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Dosya indir ---
router.get('/:id/download', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM attachments WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dosya bulunamadı' });

    const dosya     = rows[0];
    const dosyaYolu = path.join(UPLOAD_DIR, dosya.dosya_ad);

    if (!fs.existsSync(dosyaYolu))
      return res.status(404).json({ error: 'Fiziksel dosya bulunamadı' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dosya.orijinal_ad)}"`);
    res.setHeader('Content-Type', dosya.mime_turu);
    res.sendFile(dosyaYolu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Göreve bağla / bağlantıyı kaldır ---
router.patch('/:id/gorev', auth, async (req, res) => {
  try {
    const { task_id } = req.body; // null gönderilirse bağlantı kaldırılır

    if (task_id) {
      const [t] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [task_id]);
      if (t.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    }

    const [result] = await pool.execute(
      'UPDATE attachments SET task_id = ? WHERE id = ?',
      [task_id || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Dosya bulunamadı' });
    res.json({ mesaj: 'Güncellendi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Dosya sil (yükleyen veya admin) ---
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM attachments WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dosya bulunamadı' });

    const dosya = rows[0];
    if (req.user.rol !== 'admin' && dosya.kullanici_id !== req.user.id)
      return res.status(403).json({ error: 'Bu dosyayı silme yetkiniz yok' });

    // DB kaydını sil
    await pool.execute('DELETE FROM attachments WHERE id = ?', [req.params.id]);

    // Fiziksel dosyayı sil
    const dosyaYolu = path.join(UPLOAD_DIR, dosya.dosya_ad);
    if (fs.existsSync(dosyaYolu)) fs.unlinkSync(dosyaYolu);

    res.json({ mesaj: 'Dosya silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
