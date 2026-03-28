// Görev kontrol listesi (checklist) route'ları
const router = require('express').Router();
const pool   = require('../db');
const auth   = require('../middleware/authMiddleware');

// Göreve ait tüm maddeleri getir
router.get('/task/:taskId', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ci.*, u.ad AS olusturan_ad
       FROM checklist_items ci
       JOIN users u ON u.id = ci.olusturan_id
       WHERE ci.task_id = ?
       ORDER BY ci.sira ASC, ci.created_at ASC`,
      [req.params.taskId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yeni madde ekle
router.post('/', auth, async (req, res) => {
  try {
    const { task_id, metin, tahmini_bitis } = req.body;
    if (!task_id || !metin?.trim())
      return res.status(400).json({ error: 'Görev ve madde metni zorunludur' });

    // Görevi kontrol et
    const [tasks] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [task_id]);
    if (tasks.length === 0) return res.status(404).json({ error: 'Görev bulunamadı' });

    // En son sıra numarasını al
    const [[{ maxSira }]] = await pool.execute(
      'SELECT COALESCE(MAX(sira), 0) AS maxSira FROM checklist_items WHERE task_id = ?',
      [task_id]
    );

    const [result] = await pool.execute(
      `INSERT INTO checklist_items (task_id, metin, sira, tahmini_bitis, olusturan_id)
       VALUES (?, ?, ?, ?, ?)`,
      [task_id, metin.trim(), maxSira + 1, tahmini_bitis || null, req.user.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Tamamlandı durumunu tersine çevir
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM checklist_items WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Madde bulunamadı' });

    const yeniDurum = rows[0].tamamlandi ? 0 : 1;
    await pool.execute(
      'UPDATE checklist_items SET tamamlandi = ? WHERE id = ?',
      [yeniDurum, req.params.id]
    );
    res.json({ tamamlandi: yeniDurum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Madde güncelle — metin ve/veya tahmini_bitis (sadece oluşturan veya admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const { metin, tahmini_bitis } = req.body;
    if (!metin?.trim()) return res.status(400).json({ error: 'Madde metni zorunludur' });

    const [rows] = await pool.execute(
      'SELECT olusturan_id FROM checklist_items WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Madde bulunamadı' });
    if (rows[0].olusturan_id !== req.user.id && req.user.rol !== 'admin')
      return res.status(403).json({ error: 'Yetkiniz yok' });

    await pool.execute(
      'UPDATE checklist_items SET metin = ?, tahmini_bitis = ? WHERE id = ?',
      [metin.trim(), tahmini_bitis || null, req.params.id]
    );
    res.json({ mesaj: 'Güncellendi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Madde sil (oluşturan veya admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT olusturan_id FROM checklist_items WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Madde bulunamadı' });
    if (rows[0].olusturan_id !== req.user.id && req.user.rol !== 'admin')
      return res.status(403).json({ error: 'Yetkiniz yok' });

    await pool.execute('DELETE FROM checklist_items WHERE id = ?', [req.params.id]);
    res.json({ mesaj: 'Silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
