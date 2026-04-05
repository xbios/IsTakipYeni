// Login, register ve logout işlemleri
import { setAccessToken, clearAccessToken } from './api.js';

// Kullanıcı bilgisini sessionStorage'da tutuyoruz (ad, email, rol)
// Access token ASLA localStorage'a yazılmaz
export function getKullanici() {
  try {
    return JSON.parse(sessionStorage.getItem('kullanici') || 'null');
  } catch { return null; }
}

function setKullanici(k) {
  sessionStorage.setItem('kullanici', JSON.stringify(k));
}

export function clearKullanici() {
  sessionStorage.removeItem('kullanici');
}

// Sayfa yüklendiğinde silent refresh ile oturumu geri yükle
export async function initAuth() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn('initAuth başarısız:', res.status);
      return false;
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    if (data.kullanici) setKullanici(data.kullanici);
    return true;
  } catch (err) {
    console.error('initAuth hata:', err);
    return false;
  }
}

// ----- Login formu -----
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const sifre = document.getElementById('sifre').value;
    const hata  = document.getElementById('hata');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, sifre }),
      });
      const data = await res.json();
      if (!res.ok) { hata.textContent = data.error || 'Giriş başarısız'; return; }

      setAccessToken(data.accessToken);
      setKullanici(data.kullanici);
      window.location.href = '/index.html';
    } catch {
      hata.textContent = 'Bağlantı hatası';
    }
  });
}

// ----- Register formu -----
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ad    = document.getElementById('ad').value.trim();
    const email = document.getElementById('email').value.trim();
    const sifre = document.getElementById('sifre').value;
    const hata  = document.getElementById('hata');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ad, email, sifre }),
      });
      const data = await res.json();
      if (!res.ok) { hata.textContent = data.error || 'Kayıt başarısız'; return; }

      setAccessToken(data.accessToken);
      setKullanici(data.kullanici);
      window.location.href = '/index.html';
    } catch {
      hata.textContent = 'Bağlantı hatası';
    }
  });
}

// ----- Logout -----
export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    clearAccessToken();
    clearKullanici();
    window.location.href = '/login.html';
  }
}

// Logout butonuna tıklama
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-logout]')) {
    e.preventDefault();
    logout();
  }
});
