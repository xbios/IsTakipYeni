// Kimlik doğrulama route'ları: register, login, refresh, logout
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const ACCESS_EXPIRES  = '15m';
const REFRESH_EXPIRES = '7d';
const REFRESH_MS      = 7 * 24 * 60 * 60 * 1000; // 7 gün (ms)

// Access token üret
function signAccess(user) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

// Refresh token üret ve DB'ye kaydet
async function createRefreshToken(userId) {
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
  const expiresAt = new Date(Date.now() + REFRESH_MS);
  await pool.execute(
    'INSERT INTO refresh_tokens (kullanici_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
  return token;
}

// Refresh token'ı HttpOnly cookie olarak set et
function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_MS,
    path: '/',
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { ad, email, sifre, rol = 'uye' } = req.body;
    if (!ad || !email || !sifre)
      return res.status(400).json({ error: 'Ad, e-posta ve şifre zorunludur' });

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0)
      return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });

    const hash = await bcrypt.hash(sifre, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (ad, email, sifre_hash, rol) VALUES (?, ?, ?, ?)',
      [ad, email, hash, rol === 'admin' ? 'admin' : 'uye']
    );

    const user = { id: result.insertId, email, rol: rol === 'admin' ? 'admin' : 'uye' };
    const accessToken  = signAccess(user);
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({ accessToken, kullanici: { id: user.id, ad, email, rol: user.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, sifre } = req.body;
    if (!email || !sifre)
      return res.status(400).json({ error: 'E-posta ve şifre zorunludur' });

    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

    const user = rows[0];
    const eslesme = await bcrypt.compare(sifre, user.sifre_hash);
    if (!eslesme)
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

    const accessToken  = signAccess(user);
    const refreshToken = await createRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      kullanici: { id: user.id, ad: user.ad, email: user.email, rol: user.rol },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/auth/refresh — HttpOnly cookie'den refresh token al, yeni access token döndür
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: 'Refresh token bulunamadı' });

    // DB'de var mı ve süresi geçmemiş mi?
    const [rows] = await pool.execute(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Refresh token geçersiz veya süresi dolmuş' });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (users.length === 0) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

    const user = users[0];
    const accessToken = signAccess(user);

    res.json({
      accessToken,
      kullanici: { id: user.id, ad: user.ad, email: user.email, rol: user.rol },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Refresh token doğrulanamadı' });
  }
});

// POST /api/auth/logout — refresh token DB'den silinir, cookie temizlenir
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }
    res.clearCookie('refreshToken');
    res.json({ mesaj: 'Çıkış yapıldı' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
