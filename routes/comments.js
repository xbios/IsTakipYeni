// Görev yorumları route'ları
const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/authMiddleware');

// Bir göreve ait tüm yorumları getir
router.get('/task/:taskId', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, u.ad AS kullanici_ad
       FROM comments c
       JOIN users u ON u.id = c.kullanici_id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`,
      [req.params.taskId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yorum ekle
router.post('/', auth, async (req, res) => {
  try {
    const { task_id, yorum } = req.body;
    if (!task_id || !yorum)
      return res.status(400).json({ error: 'Görev ve yorum metni zorunludur' });

    // Görev var mı kontrol et
    const [tasks] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [task_id]);
    if (tasks.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });

    const [result] = await pool.execute(
      'INSERT INTO comments (task_id, kullanici_id, yorum) VALUES (?, ?, ?)',
      [task_id, req.user.id, yorum]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yorum güncelle (sadece yorumun sahibi)
router.put('/:id', auth, async (req, res) => {
  try {
    const { yorum } = req.body;
    if (!yorum) return res.status(400).json({ error: 'Yorum metni zorunludur' });

    const [rows] = await pool.execute('SELECT kullanici_id FROM comments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Yorum bulunamadı' });
    if (rows[0].kullanici_id !== req.user.id)
      return res.status(403).json({ error: 'Bu yorumu düzenleme yetkiniz yok' });

    await pool.execute('UPDATE comments SET yorum = ? WHERE id = ?', [yorum, req.params.id]);
    res.json({ mesaj: 'Yorum güncellendi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yorum sil (sahibi veya admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT kullanici_id FROM comments WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Yorum bulunamadı' });

    if (req.user.rol !== 'admin' && rows[0].kullanici_id !== req.user.id)
      return res.status(403).json({ error: 'Bu yorumu silme yetkiniz yok' });

    await pool.execute('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ mesaj: 'Yorum silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
