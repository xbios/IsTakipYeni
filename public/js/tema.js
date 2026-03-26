// Tema yönetimi — aydınlık / karanlık mod
// localStorage'da saklanır (hassas veri değil, UI tercihi)

const ANAHTAR = 'tema';

function temaUygula(tema) {
  document.documentElement.dataset.tema = tema;
  const btn = document.getElementById('temaBtn');
  if (!btn) return;
  if (tema === 'karanlik') {
    btn.innerHTML = _ikonGunes();
    btn.title     = 'Aydınlık moda geç';
    btn.setAttribute('aria-label', 'Aydınlık moda geç');
  } else {
    btn.innerHTML = _ikonAy();
    btn.title     = 'Karanlık moda geç';
    btn.setAttribute('aria-label', 'Karanlık moda geç');
  }
}

export function temaToggle() {
  const mevcut = document.documentElement.dataset.tema || 'aydinlik';
  const yeni   = mevcut === 'aydinlik' ? 'karanlik' : 'aydinlik';
  temaUygula(yeni);
  localStorage.setItem(ANAHTAR, yeni);
}

// window'a ekle — onclick="temaToggle()" HTML attribute'larından çağrılabilsin
window.temaToggle = temaToggle;

// Sayfa yüklendiğinde kaydedilmiş temayı uygula
temaUygula(localStorage.getItem(ANAHTAR) || 'aydinlik');

// ── İkon SVG'leri (inline, bağımlılık yok) ──────────────────────────────────
function _ikonGunes() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;
}

function _ikonAy() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;
}
