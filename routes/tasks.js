// Görev CRUD route'ları + dashboard istatistikleri
const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/authMiddleware');

// --- Dashboard istatistikleri ---
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Durum dağılımı
    const [durum] = await pool.execute(
      `SELECT durum, COUNT(*) AS sayi FROM tasks GROUP BY durum`
    );

    // Bana atanmış açık görevler
    const [benim] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad, u.ad AS atanan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       WHERE t.atanan_id = ? AND t.durum != 'tamamlandi'
       ORDER BY t.deadline ASC
       LIMIT 10`,
      [req.user.id]
    );

    // Bugün deadline olanlar
    const [bugun] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad, u.ad AS atanan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       WHERE DATE(t.deadline) = CURDATE() AND t.durum != 'tamamlandi'`
    );

    // Gecikmiş görevler
    const [gecikis] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad, u.ad AS atanan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       WHERE t.deadline < CURDATE() AND t.durum != 'tamamlandi'
       ORDER BY t.deadline ASC`
    );

    // Bu hafta deadline olanlar
    const [hafta] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad, u.ad AS atanan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       WHERE t.deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND t.durum != 'tamamlandi'
       ORDER BY t.deadline ASC`
    );

    // Son eklenen 5 görev
    const [son] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad, u.ad AS atanan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       ORDER BY t.created_at DESC
       LIMIT 5`
    );

    // Toplam görev sayısı
    const [[{ toplam }]] = await pool.execute('SELECT COUNT(*) AS toplam FROM tasks');

    res.json({ toplam, durum, benim, bugun, gecikis, hafta, son });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Görev listesi (filtre + sıralama + arama) ---
router.get('/', auth, async (req, res) => {
  try {
    const { proje_id, durum, atanan_id, oncelik, arama, siralama = 'created_at', yon = 'DESC' } = req.query;

    // Sadece izin verilen sütunlarda sıralama yapılabilir (SQL injection koruması)
    const izinliSirala = ['created_at', 'deadline', 'baslik', 'oncelik', 'durum'];
    const siralaSutun = izinliSirala.includes(siralama) ? siralama : 'created_at';
    const siralYon = yon === 'ASC' ? 'ASC' : 'DESC';

    let sql = `SELECT t.*, p.ad AS proje_ad,
                      u.ad AS atanan_ad, uc.ad AS olusturan_ad
               FROM tasks t
               LEFT JOIN projects p ON p.id = t.proje_id
               LEFT JOIN users u ON u.id = t.atanan_id
               LEFT JOIN users uc ON uc.id = t.olusturan_id
               WHERE 1=1`;
    const params = [];

    if (proje_id)  { sql += ' AND t.proje_id = ?';  params.push(proje_id); }
    if (durum)     { sql += ' AND t.durum = ?';      params.push(durum); }
    if (atanan_id) { sql += ' AND t.atanan_id = ?';  params.push(atanan_id); }
    if (oncelik)   { sql += ' AND t.oncelik = ?';    params.push(oncelik); }
    if (arama)     { sql += ' AND t.baslik LIKE ?';  params.push(`%${arama}%`); }

    sql += ` ORDER BY t.${siralaSutun} ${siralYon}`;

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Tek görev getir ---
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, p.ad AS proje_ad,
              u.ad AS atanan_ad, uc.ad AS olusturan_ad
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.proje_id
       LEFT JOIN users u ON u.id = t.atanan_id
       LEFT JOIN users uc ON uc.id = t.olusturan_id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Görev oluştur ---
router.post('/', auth, async (req, res) => {
  try {
    const { baslik, aciklama, proje_id, atanan_id, durum = 'bekliyor', oncelik = 'orta', deadline } = req.body;
    if (!baslik || !proje_id)
      return res.status(400).json({ error: 'Başlık ve proje zorunludur' });

    const [result] = await pool.execute(
      `INSERT INTO tasks (baslik, aciklama, proje_id, atanan_id, olusturan_id, durum, oncelik, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [baslik, aciklama || null, proje_id, atanan_id || null, req.user.id, durum, oncelik, deadline || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Görev güncelle ---
router.put('/:id', auth, async (req, res) => {
  try {
    const { baslik, aciklama, proje_id, atanan_id, durum, oncelik, deadline } = req.body;
    if (!baslik || !proje_id)
      return res.status(400).json({ error: 'Başlık ve proje zorunludur' });

    const [result] = await pool.execute(
      `UPDATE tasks SET baslik=?, aciklama=?, proje_id=?, atanan_id=?, durum=?, oncelik=?, deadline=?
       WHERE id=?`,
      [baslik, aciklama || null, proje_id, atanan_id || null, durum, oncelik, deadline || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Görev bulunamadı' });
    res.json({ mesaj: 'Görev güncellendi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- Görev sil ---
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT olusturan_id FROM tasks WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });

    if (req.user.rol !== 'admin' && rows[0].olusturan_id !== req.user.id)
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });

    await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    res.json({ mesaj: 'Görev silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
