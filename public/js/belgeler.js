import { apiFetch, getAccessToken } from './api.js';
import { initAuth, getKullanici, logout } from './auth.js';

let tumDosyalar = [];
let tumGorevler = [];

async function main() {
  const ok = await initAuth();
  if (!ok) { window.location.href = '/login.html'; return; }

  const kullanici = getKullanici();
  document.getElementById('kullaniciAdi').textContent = kullanici?.ad ?? '';

  await Promise.all([yukleGorevler(), yukleDosyalar()]);

  document.getElementById('yukleBtn').addEventListener('click', () =>
    document.getElementById('yukleModal').classList.remove('gizli')
  );
  document.getElementById('filtreleBtn').addEventListener('click', renderDosyalar);
  document.getElementById('araInput').addEventListener('input', renderDosyalar);
  document.getElementById('filtreGorev').addEventListener('change', renderDosyalar);
  document.getElementById('filtreTur').addEventListener('change', renderDosyalar);
  document.getElementById('yukleForm').addEventListener('submit', dosyaYukle);
  document.getElementById('baglaKaydet').addEventListener('click', goreveBagla);

  // Drag & Drop
  const dropZone  = document.getElementById('dropZone');
  const dosyaInput = document.getElementById('dosyaInput');

  dropZone.addEventListener('click', () => dosyaInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-ustu'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-ustu'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-ustu');
    if (e.dataTransfer.files[0]) dosyaSec(e.dataTransfer.files[0]);
  });
  dosyaInput.addEventListener('change', () => {
    if (dosyaInput.files[0]) dosyaSec(dosyaInput.files[0]);
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function yukleGorevler() {
  const res = await apiFetch('/api/tasks');
  tumGorevler = await res.json();

  const opts = tumGorevler.map(g => `<option value="${g.id}">${g.baslik}</option>`).join('');
  document.getElementById('filtreGorev').insertAdjacentHTML('beforeend', opts);
  document.getElementById('formGorev').insertAdjacentHTML('beforeend', opts);
  document.getElementById('baglaGorevSec').insertAdjacentHTML('beforeend', opts);
}

async function yukleDosyalar() {
  const res    = await apiFetch('/api/attachments');
  tumDosyalar  = await res.json();
  renderDosyalar();
}

function renderDosyalar() {
  const gorevId = document.getElementById('filtreGorev').value;
  const tur     = document.getElementById('filtreTur').value;
  const arama   = document.getElementById('araInput').value.trim().toLowerCase();

  let liste = tumDosyalar;

  if (gorevId) liste = liste.filter(d => String(d.task_id) === gorevId);
  if (tur)     liste = liste.filter(d => turKontrol(d.mime_turu, tur));
  if (arama)   liste = liste.filter(d => d.orijinal_ad.toLowerCase().includes(arama));

  const grid = document.getElementById('dosyaGrid');

  if (liste.length === 0) {
    grid.innerHTML = '<p class="bos-alan">Dosya bulunamadı.</p>';
    return;
  }

  grid.innerHTML = liste.map(d => `
    <div class="dosya-kart" data-id="${d.id}">
      <div class="dosya-ikon">${turIkon(d.mime_turu)}</div>
      <div class="dosya-bilgi">
        <div class="dosya-ad" title="${d.orijinal_ad}">${d.orijinal_ad}</div>
        <div class="dosya-meta">
          ${formatBoyut(d.boyut)} &bull; ${new Date(d.created_at).toLocaleDateString('tr-TR')}
        </div>
        <div class="dosya-yukleyen">${d.yukleyen_ad}</div>
        ${d.gorev_baslik
          ? `<div class="dosya-gorev-link">🔗 <a href="/task-detail.html?id=${d.task_id}">${d.gorev_baslik}</a></div>`
          : '<div class="dosya-gorev-link dosya-baglantisiz">Göreve bağlı değil</div>'}
      </div>
      <div class="dosya-aksiyonlar">
        ${onizlenebilir(d.mime_turu)
          ? `<button class="btn btn-kucuk btn-onizle" onclick="onizle(${d.id},'${escAttr(d.mime_turu)}','${escAttr(d.orijinal_ad)}')">👁 Önizle</button>`
          : ''}
        <button class="btn btn-kucuk btn-ikincil" onclick="dosyaIndir(${d.id}, '${encodeURIComponent(d.orijinal_ad)}')">⬇ İndir</button>
        <button class="btn btn-kucuk btn-ikincil" onclick="baglaModalAc(${d.id})">🔗 Bağla</button>
        <button class="btn btn-kucuk btn-tehlike" onclick="dosyaSil(${d.id})">🗑</button>
      </div>
    </div>
  `).join('');
}

function dosyaSec(file) {
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) { alert('Dosya 10 MB sınırını aşıyor'); return; }

  const el = document.getElementById('secilenDosya');
  el.textContent = `${file.name} (${formatBoyut(file.size)})`;
  el.classList.remove('gizli');
  document.getElementById('yukleSubmit').disabled = false;

  // DataTransfer ile file input'u güncelle (drag&drop durumunda)
  if (!document.getElementById('dosyaInput').files.length) {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('dosyaInput').files = dt.files;
  }
}

async function dosyaYukle(e) {
  e.preventDefault();
  const dosyaInput = document.getElementById('dosyaInput');
  if (!dosyaInput.files[0]) return;

  const formData = new FormData();
  formData.append('dosya', dosyaInput.files[0]);

  const gorevId = document.getElementById('formGorev').value;
  if (gorevId) formData.append('task_id', gorevId);

  // İlerleme çubuğunu göster
  const ilerleme = document.getElementById('yukleIlerleme');
  const dolgu    = document.getElementById('yukleIlerlemeDolgu');
  ilerleme.classList.remove('gizli');

  // XHR ile yükleme (fetch progress desteklemiyor)
  const token = getAccessToken();
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable)
        dolgu.style.width = `${Math.round((ev.loaded / ev.total) * 100)}%`;
    };
    xhr.onload = () => {
      if (xhr.status === 201) resolve();
      else reject(new Error(JSON.parse(xhr.responseText).error || 'Yükleme hatası'));
    };
    xhr.onerror = () => reject(new Error('Ağ hatası'));
    xhr.send(formData);
  }).then(() => {
    document.getElementById('yukleModal').classList.add('gizli');
    resetYukleForm();
    yukleDosyalar();
  }).catch(err => {
    alert(err.message);
    ilerleme.classList.add('gizli');
    dolgu.style.width = '0';
  });
}

function resetYukleForm() {
  document.getElementById('yukleForm').reset();
  document.getElementById('secilenDosya').classList.add('gizli');
  document.getElementById('yukleSubmit').disabled = true;
  document.getElementById('yukleIlerleme').classList.add('gizli');
  document.getElementById('yukleIlerlemeDolgu').style.width = '0';
}

window.dosyaIndir = (id, _ad) => {
  // Token'ı URL param olarak gönderme yerine ayrı fetch + blob ile indir
  apiFetch(`/api/attachments/${id}/download`)
    .then(res => {
      if (!res.ok) { alert('İndirme başarısız'); return; }
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const dosyaAd = match ? decodeURIComponent(match[1]) : 'dosya';
      return res.blob().then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = dosyaAd; a.click();
        URL.revokeObjectURL(url);
      });
    });
};

window.baglaModalAc = (id) => {
  document.getElementById('baglaEkId').value = id;
  const mevcut = tumDosyalar.find(d => d.id === id);
  document.getElementById('baglaGorevSec').value = mevcut?.task_id ?? '';
  document.getElementById('baglaModal').classList.remove('gizli');
};

async function goreveBagla() {
  const id      = document.getElementById('baglaEkId').value;
  const gorevId = document.getElementById('baglaGorevSec').value;

  const res = await apiFetch(`/api/attachments/${id}/gorev`, {
    method: 'PATCH',
    body: JSON.stringify({ task_id: gorevId || null }),
  });
  if (!res.ok) { alert('Güncelleme başarısız'); return; }
  document.getElementById('baglaModal').classList.add('gizli');
  yukleDosyalar();
}

window.dosyaSil = async (id) => {
  if (!confirm('Dosyayı kalıcı olarak silmek istiyor musunuz?')) return;
  const res = await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
  if (!res.ok) { alert('Silme başarısız'); return; }
  yukleDosyalar();
};

// --- Önizleme ---
let _onizleBlobUrl = null; // bellek sızıntısını önlemek için takip et
let _onizleIndirId = null;

window.onizle = async (id, mime, ad) => {
  _onizleIndirId = id;
  document.getElementById('onizleBaslik').textContent = ad;
  document.getElementById('onizleIcerik').innerHTML   = '<p class="bos-alan">Yükleniyor…</p>';
  document.getElementById('onizleModal').classList.remove('gizli');

  // Önceki blob URL'i temizle
  if (_onizleBlobUrl) { URL.revokeObjectURL(_onizleBlobUrl); _onizleBlobUrl = null; }

  try {
    const res = await apiFetch(`/api/attachments/${id}/download`);
    if (!res.ok) throw new Error('Dosya yüklenemedi');

    const icerik = document.getElementById('onizleIcerik');

    if (mime === 'text/plain') {
      const metin = await res.text();
      icerik.innerHTML = `<pre class="onizle-text">${escHtml(metin)}</pre>`;

    } else if (mime.startsWith('image/')) {
      const blob = await res.blob();
      _onizleBlobUrl = URL.createObjectURL(blob);
      icerik.innerHTML = `<div class="onizle-resim-sarici">
        <img src="${_onizleBlobUrl}" class="onizle-img" alt="${escHtml(ad)}">
      </div>`;

    } else if (mime === 'application/pdf') {
      const blob = await res.blob();
      _onizleBlobUrl = URL.createObjectURL(blob);
      icerik.innerHTML = `<iframe src="${_onizleBlobUrl}" class="onizle-pdf" title="${escHtml(ad)}"></iframe>`;
    }
  } catch (err) {
    document.getElementById('onizleIcerik').innerHTML = `<p class="bos-alan hata-metin">${err.message}</p>`;
  }

  // İndir butonu
  document.getElementById('onizleIndir').onclick = () => dosyaIndir(id, '');
};

window.onizleKapatBtn = () => {
  document.getElementById('onizleModal').classList.add('gizli');
  if (_onizleBlobUrl) { URL.revokeObjectURL(_onizleBlobUrl); _onizleBlobUrl = null; }
  document.getElementById('onizleIcerik').innerHTML = '';
};

// Overlay'e tıklanınca kapat (modalın kendisine değil)
window.onizleKapat = (e) => {
  if (e.target === document.getElementById('onizleModal')) onizleKapatBtn();
};

function onizlenebilir(mime) {
  return mime === 'text/plain' || mime?.startsWith('image/') || mime === 'application/pdf';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(s) {
  return String(s).replace(/'/g, "\\'");
}

// --- Yardımcı fonksiyonlar ---
function turKontrol(mime, tur) {
  if (tur === 'pdf')   return mime === 'application/pdf';
  if (tur === 'word')  return mime?.includes('word');
  if (tur === 'excel') return mime?.includes('excel') || mime?.includes('spreadsheet');
  if (tur === 'resim') return mime?.startsWith('image/');
  if (tur === 'diger') return !['application/pdf'].includes(mime) && !mime?.includes('word')
                              && !mime?.includes('excel') && !mime?.startsWith('image/');
  return true;
}

function turIkon(mime) {
  if (!mime) return '📄';
  if (mime === 'application/pdf')     return '📕';
  if (mime.includes('word'))          return '📘';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📗';
  if (mime.startsWith('image/'))      return '🖼️';
  if (mime.includes('zip'))           return '🗜️';
  if (mime === 'text/plain')          return '📝';
  return '📄';
}

function formatBoyut(bayt) {
  if (!bayt) return '—';
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${(bayt / 1024).toFixed(1)} KB`;
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
}

main();
