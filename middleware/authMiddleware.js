// Her korumalı route'a eklenen JWT doğrulama middleware'i
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { id, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş' });
  }
}

module.exports = authMiddleware;
