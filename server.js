require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const authRoutes        = require('./routes/auth');
const projectRoutes     = require('./routes/projects');
const taskRoutes        = require('./routes/tasks');
const commentRoutes     = require('./routes/comments');
const attachmentRoutes  = require('./routes/attachments');
const checklistRoutes   = require('./routes/checklists');

const app = express();

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Statik dosyalar (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- API Route'ları ---
app.use('/api/auth',        authRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/tasks',      taskRoutes);
app.use('/api/comments',   commentRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/checklists',  checklistRoutes);

// Tüm diğer GET isteklerini SPA olarak index.html'e yönlendir
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Global Hata Handler ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`));
