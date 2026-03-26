// Proje CRUD route'ları
const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/authMiddleware');

// Tüm projeleri listele
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.ad AS olusturan_ad
       FROM projects p
       JOIN users u ON u.id = p.olusturan_id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tek proje getir
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.ad AS olusturan_ad
       FROM projects p
       JOIN users u ON u.id = p.olusturan_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Proje bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Proje oluştur
router.post('/', auth, async (req, res) => {
  try {
    const { ad, aciklama } = req.body;
    if (!ad) return res.status(400).json({ error: 'Proje adı zorunludur' });

    const [result] = await pool.execute(
      'INSERT INTO projects (ad, aciklama, olusturan_id) VALUES (?, ?, ?)',
      [ad, aciklama || null, req.user.id]
    );
    res.status(201).json({ id: result.insertId, ad, aciklama });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Proje güncelle
router.put('/:id', auth, async (req, res) => {
  try {
    const { ad, aciklama } = req.body;
    if (!ad) return res.status(400).json({ error: 'Proje adı zorunludur' });

    const [result] = await pool.execute(
      'UPDATE projects SET ad = ?, aciklama = ? WHERE id = ?',
      [ad, aciklama || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Proje bulunamadı' });
    res.json({ mesaj: 'Proje güncellendi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Proje sil (sadece admin veya projeyi oluşturan)
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT olusturan_id FROM projects WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proje bulunamadı' });

    if (req.user.rol !== 'admin' && rows[0].olusturan_id !== req.user.id)
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });

    await pool.execute('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ mesaj: 'Proje silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
