import { apiFetch, getAccessToken } from './api.js';
import { initAuth, getKullanici, logout } from './auth.js';

const taskId = new URLSearchParams(location.search).get('id');

async function main() {
  const ok = await initAuth();
  if (!ok) { window.location.href = '/login.html'; return; }

  if (!taskId) { window.location.href = '/tasks.html'; return; }

  const kullanici = getKullanici();
  const isimEl = document.getElementById('kullaniciAdi');
  if (isimEl && kullanici) isimEl.textContent = kullanici.ad;

  await yukleGorev();
  await Promise.all([yukleYorumlar(), yukleEkler(), yukleChecklist()]);

  // Tarih inputuna varsayılan olarak 15 gün sonrasını set et
  _checklistVarsayilanTarih();

  // Dosya seçildiğinde otomatik yükle
  document.getElementById('ekDosyaInput')?.addEventListener('change', async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    await ekYukle(dosya);
    e.target.value = '';
  });

  document.getElementById('yorumForm')?.addEventListener('submit', yorumGonder);
  document.getElementById('checklistForm')?.addEventListener('submit', checklistEkle);
  document.getElementById('duzenleBtn')?.addEventListener('click', duzenleModalAc);
  document.getElementById('silBtn')?.addEventListener('click', gorevSil);
  document.getElementById('modalKapat')?.addEventListener('click', modalKapat);
  document.getElementById('gorevForm')?.addEventListener('submit', gorevGuncelle);
}

async function yukleGorev() {
  const res   = await apiFetch(`/api/tasks/${taskId}`);
  if (!res.ok) { window.location.href = '/tasks.html'; return; }
  const g = await res.json();

  document.getElementById('gorevBaslik').textContent   = g.baslik;
  document.getElementById('gorevAciklama').textContent = g.aciklama || 'Açıklama yok';
  document.getElementById('gorevProje').textContent    = g.proje_ad || '—';
  document.getElementById('gorevAtanan').textContent   = g.atanan_ad || 'Atanmamış';
  document.getElementById('gorevDurum').textContent    = durumEtiket(g.durum);
  document.getElementById('gorevDurum').className      = `badge badge-${g.durum}`;
  document.getElementById('gorevOncelik').textContent  = oncelikEtiket(g.oncelik);
  document.getElementById('gorevOncelik').className    = `badge badge-oncelik-${g.oncelik}`;

  const dlEl = document.getElementById('gorevDeadline');
  if (g.deadline) {
    dlEl.textContent  = new Date(g.deadline).toLocaleDateString('tr-TR');
    dlEl.className    = deadlineCss(g.deadline);
  } else {
    dlEl.textContent = 'Belirsiz';
  }

  document.getElementById('gorevOlusturan').textContent = g.olusturan_ad || '—';
  document.getElementById('gorevTarih').textContent     = new Date(g.created_at).toLocaleString('tr-TR');

  // Formu doldur (düzenleme için)
  document.getElementById('formBaslik').value   = g.baslik;
  document.getElementById('formAciklama').value = g.aciklama || '';
  document.getElementById('formDurum').value    = g.durum;
  document.getElementById('formOncelik').value  = g.oncelik;
  document.getElementById('formDeadline').value = g.deadline ? g.deadline.split('T')[0] : '';
}

// ── Checklist ──────────────────────────────────────────────────────────────

// 15 gün sonrasını YYYY-MM-DD formatında döndürür
function _onbesGunSonrasi() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

// Tarih inputuna varsayılan değer set et
function _checklistVarsayilanTarih() {
  const inp = document.getElementById('checklistTarih');
  if (inp) inp.value = _onbesGunSonrasi();
}

// Tarihin durumunu hesapla: 'gecmis' | 'bugun' | 'gelecek' | null
function _bitisDurumu(tarih) {
  if (!tarih) return null;
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const dl    = new Date(tarih); dl.setHours(0, 0, 0, 0);
  const fark  = (dl - bugun) / 86400000;
  if (fark < 0)  return 'gecmis';
  if (fark === 0) return 'bugun';
  return 'gelecek';
}

function _bitisBadge(tarih) {
  const durum = _bitisDurumu(tarih);
  if (!durum) return '';
  const etiket = {
    gecmis:  'Gecikmiş',
    bugun:   'Bugün',
    gelecek: 'Planlandı',
  }[durum];
  const tarihStr = new Date(tarih).toLocaleDateString('tr-TR');
  return `<span class="checklist-bitis checklist-bitis-${durum}">📅 ${tarihStr} · ${etiket}</span>`;
}

async function yukleChecklist() {
  const res      = await apiFetch(`/api/checklists/task/${taskId}`);
  const maddeler = await res.json();
  renderChecklist(maddeler);
}

function renderChecklist(maddeler) {
  const liste    = document.getElementById('checklistListe');
  const ilerleme = document.getElementById('checklistIlerleme');
  const dolgu    = document.getElementById('checklistProgressDolgu');
  if (!liste) return;

  const toplam     = maddeler.length;
  const tamamlanan = maddeler.filter(m => m.tamamlandi).length;
  const pct        = toplam ? Math.round((tamamlanan / toplam) * 100) : 0;

  ilerleme.textContent   = toplam ? `${tamamlanan}/${toplam}` : '';
  dolgu.style.width      = `${pct}%`;
  dolgu.style.background = pct === 100 ? 'var(--renk-basari)' : 'var(--renk-birincil)';

  if (toplam === 0) {
    liste.innerHTML = '<li class="checklist-bos">Henüz madde yok. Aşağıdan ekleyin.</li>';
    return;
  }

  const kullanici = getKullanici();
  liste.innerHTML = maddeler.map(m => `
    <li class="checklist-madde ${m.tamamlandi ? 'tamamlandi' : ''}">
      <label class="checklist-etiket">
        <input type="checkbox" class="checklist-cb"
               ${m.tamamlandi ? 'checked' : ''}
               onchange="checklistToggle(${m.id})">
        <div class="checklist-metin-grup">
          <span class="checklist-metin" id="cmi-${m.id}">${escHtml(m.metin)}</span>
          ${_bitisBadge(m.tahmini_bitis)}
        </div>
      </label>
      <div class="checklist-aksiyonlar">
        <button class="btn-icon checklist-duzenle-btn"
                onclick="checklistDuzenleBaslat(${m.id}, '${m.tahmini_bitis ? m.tahmini_bitis.split('T')[0] : ''}')"
                title="Düzenle">✏️</button>
        ${kullanici && (kullanici.rol === 'admin' || kullanici.id === m.olusturan_id)
          ? `<button class="btn-icon" onclick="checklistSil(${m.id})" title="Sil">🗑️</button>`
          : ''}
      </div>
    </li>
  `).join('');
}

async function checklistEkle(e) {
  e.preventDefault();
  const input  = document.getElementById('checklistInput');
  const tarihEl = document.getElementById('checklistTarih');
  const metin  = input.value.trim();
  if (!metin) return;

  const res = await apiFetch('/api/checklists', {
    method: 'POST',
    body: JSON.stringify({
      task_id:        taskId,
      metin,
      tahmini_bitis:  tarihEl?.value || null,
    }),
  });
  if (!res.ok) { alert('Eklenemedi'); return; }
  input.value = '';
  // Tarih inputunu tekrar 15 gün sonrasına sıfırla
  if (tarihEl) tarihEl.value = _onbesGunSonrasi();
  yukleChecklist();
}

window.checklistToggle = async (id) => {
  await apiFetch(`/api/checklists/${id}/toggle`, { method: 'PATCH' });
  yukleChecklist();
};

window.checklistSil = async (id) => {
  if (!confirm('Bu maddeyi silmek istiyor musunuz?')) return;
  await apiFetch(`/api/checklists/${id}`, { method: 'DELETE' });
  yukleChecklist();
};

// Madde metnini ve tarihini yerinde düzenle (inline edit)
window.checklistDuzenleBaslat = (id, mevcutTarih) => {
  const metinEl = document.getElementById(`cmi-${id}`);
  if (!metinEl) return;

  const maddeEl  = metinEl.closest('.checklist-madde');
  const grupEl   = metinEl.closest('.checklist-metin-grup'); // metin + badge
  const eskiMetin = metinEl.textContent;

  // Metin inputu
  const textInput = document.createElement('input');
  textInput.type      = 'text';
  textInput.value     = eskiMetin;
  textInput.className = 'checklist-inline-input';

  // Tarih inputu
  const tarihInput = document.createElement('input');
  tarihInput.type      = 'date';
  tarihInput.value     = mevcutTarih || '';
  tarihInput.className = 'checklist-inline-tarih';
  tarihInput.title     = 'Tahmini bitiş tarihi';

  // Butonlar
  const kaydetBtn = document.createElement('button');
  kaydetBtn.textContent = '✓';
  kaydetBtn.className   = 'btn btn-kucuk btn-primary';

  const iptalBtn = document.createElement('button');
  iptalBtn.textContent = '✗';
  iptalBtn.className   = 'btn btn-kucuk btn-ikincil';

  // Grup içeriğini inputlarla değiştir
  grupEl.innerHTML = '';
  grupEl.append(textInput, tarihInput);

  // Düzenle butonunu gizle
  const duzenleBtn = maddeEl.querySelector('.checklist-duzenle-btn');
  if (duzenleBtn) duzenleBtn.style.display = 'none';

  // Butonları aksiyonlar alanına ekle
  const aksiyonlar = maddeEl.querySelector('.checklist-aksiyonlar');
  aksiyonlar.prepend(iptalBtn);
  aksiyonlar.prepend(kaydetBtn);

  textInput.focus();

  async function kaydet() {
    const yeniMetin = textInput.value.trim();
    if (!yeniMetin) { iptal(); return; }
    const res = await apiFetch(`/api/checklists/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        metin:          yeniMetin,
        tahmini_bitis:  tarihInput.value || null,
      }),
    });
    if (!res.ok) { alert('Güncellenemedi'); return; }
    yukleChecklist();
  }

  function iptal() { yukleChecklist(); }

  kaydetBtn.onclick = kaydet;
  iptalBtn.onclick  = iptal;
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); kaydet(); }
    if (e.key === 'Escape') iptal();
  });
};

// ── Yorumlar ───────────────────────────────────────────────────────────────

async function yukleYorumlar() {
  const res      = await apiFetch(`/api/comments/task/${taskId}`);
  const yorumlar = await res.json();
  const liste    = document.getElementById('yorumListe');
  if (!liste) return;

  const kullanici = getKullanici();

  if (yorumlar.length === 0) {
    liste.innerHTML = '<p class="bos">Henüz yorum yok.</p>';
    return;
  }

  liste.innerHTML = yorumlar.map(y => `
    <div class="yorum-kart" data-id="${y.id}">
      <div class="yorum-meta">
        <strong>${y.kullanici_ad}</strong>
        <span>${new Date(y.created_at).toLocaleString('tr-TR')}</span>
        ${kullanici && kullanici.id === y.kullanici_id ? `
          <button class="btn-icon yorum-duzenle-btn" onclick="yorumDuzenleBaslat(${y.id})" title="Düzenle">✏️</button>
          <button class="btn-link" onclick="yorumSil(${y.id})">Sil</button>
        ` : (kullanici && kullanici.rol === 'admin'
          ? `<button class="btn-link" onclick="yorumSil(${y.id})">Sil</button>`
          : '')}
      </div>
      <p class="yorum-metin" id="ym-${y.id}">${escHtml(y.yorum)}</p>
    </div>
  `).join('');
}

async function yorumGonder(e) {
  e.preventDefault();
  const input = document.getElementById('yorumInput');
  const yorum = input.value.trim();
  if (!yorum) return;

  const res = await apiFetch('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId, yorum }),
  });
  if (!res.ok) { alert('Yorum gönderilemedi'); return; }
  input.value = '';
  yukleYorumlar();
}

window.yorumSil = async (id) => {
  if (!confirm('Yorumu silmek istiyor musunuz?')) return;
  await apiFetch(`/api/comments/${id}`, { method: 'DELETE' });
  yukleYorumlar();
};

window.yorumDuzenleBaslat = (id) => {
  const metinEl = document.getElementById(`ym-${id}`);
  if (!metinEl) return;
  const kartEl   = metinEl.closest('.yorum-kart');
  const eskiMetin = metinEl.textContent;

  // Textarea
  const ta = document.createElement('textarea');
  ta.value     = eskiMetin;
  ta.className = 'yorum-inline-textarea';
  ta.rows      = 3;
  metinEl.replaceWith(ta);

  // Butonlar
  const btnSatir = document.createElement('div');
  btnSatir.className = 'yorum-inline-aksiyonlar';

  const kaydetBtn = document.createElement('button');
  kaydetBtn.textContent = 'Kaydet';
  kaydetBtn.className   = 'btn btn-kucuk btn-primary';

  const iptalBtn = document.createElement('button');
  iptalBtn.textContent = 'İptal';
  iptalBtn.className   = 'btn btn-kucuk btn-ikincil';

  btnSatir.append(kaydetBtn, iptalBtn);
  ta.after(btnSatir);

  // Düzenle butonunu gizle
  const duzenleBtn = kartEl.querySelector('.yorum-duzenle-btn');
  if (duzenleBtn) duzenleBtn.style.display = 'none';

  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  async function kaydet() {
    const yeniMetin = ta.value.trim();
    if (!yeniMetin) { iptal(); return; }
    const res = await apiFetch(`/api/comments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ yorum: yeniMetin }),
    });
    if (!res.ok) { alert('Güncellenemedi'); return; }
    yukleYorumlar();
  }

  function iptal() { yukleYorumlar(); }

  kaydetBtn.onclick = kaydet;
  iptalBtn.onclick  = iptal;
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') iptal();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); kaydet(); }
  });
};

// --- Ekler ---
async function yukleEkler() {
  const res  = await apiFetch(`/api/attachments?task_id=${taskId}`);
  const ekler = await res.json();
  const liste = document.getElementById('ekListe');
  if (!liste) return;

  if (ekler.length === 0) {
    liste.innerHTML = '<p class="bos-alan">Henüz ek yok.</p>';
    return;
  }

  const kullanici = getKullanici();
  liste.innerHTML = ekler.map(d => `
    <div class="ek-satir">
      <span class="ek-ikon">${turIkon(d.mime_turu)}</span>
      <span class="ek-ad" title="${d.orijinal_ad}">${d.orijinal_ad}</span>
      <span class="ek-meta">${formatBoyut(d.boyut)} &bull; ${d.yukleyen_ad}</span>
      <div class="ek-aksiyonlar">
        ${onizlenebilir(d.mime_turu)
          ? `<button class="btn btn-kucuk btn-onizle" onclick="onizle(${d.id},'${escAttr(d.mime_turu)}','${escAttr(d.orijinal_ad)}')">👁 Önizle</button>`
          : ''}
        <button class="btn btn-kucuk btn-ikincil" onclick="ekIndir(${d.id})">⬇ İndir</button>
        ${kullanici && (kullanici.rol === 'admin' || kullanici.id === d.kullanici_id)
          ? `<button class="btn btn-kucuk btn-tehlike" onclick="ekSil(${d.id})">🗑</button>`
          : ''}
      </div>
    </div>
  `).join('');
}

async function ekYukle(dosya) {
  const MAX = 10 * 1024 * 1024;
  if (dosya.size > MAX) { alert('Dosya 10 MB sınırını aşıyor'); return; }

  const formData = new FormData();
  formData.append('dosya', dosya);
  formData.append('task_id', taskId);

  const token = getAccessToken();
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/attachments');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;
    xhr.onload = () => xhr.status === 201 ? resolve() : reject(new Error(JSON.parse(xhr.responseText).error));
    xhr.onerror = () => reject(new Error('Ağ hatası'));
    xhr.send(formData);
  }).then(() => yukleEkler()).catch(err => alert(err.message));
}

window.ekIndir = (id) => {
  apiFetch(`/api/attachments/${id}/download`)
    .then(res => {
      if (!res.ok) { alert('İndirme başarısız'); return; }
      const cd    = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const ad    = match ? decodeURIComponent(match[1]) : 'dosya';
      return res.blob().then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = ad; a.click();
        URL.revokeObjectURL(url);
      });
    });
};

window.ekSil = async (id) => {
  if (!confirm('Bu eki silmek istiyor musunuz?')) return;
  const res = await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
  if (res.ok) yukleEkler();
  else alert('Silme başarısız');
};

function onizlenebilir(mime) {
  return mime === 'text/plain' || mime?.startsWith('image/') || mime === 'application/pdf';
}

function escAttr(s) {
  return String(s).replace(/'/g, "\\'");
}

// --- Önizleme ---
let _onizleBlobUrl = null;

window.onizle = async (id, mime, ad) => {
  document.getElementById('onizleBaslik').textContent = ad;
  document.getElementById('onizleIcerik').innerHTML   = '<p class="bos-alan">Yükleniyor…</p>';
  document.getElementById('onizleModal').classList.remove('gizli');

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
    document.getElementById('onizleIcerik').innerHTML =
      `<p class="bos-alan hata-metin">${err.message}</p>`;
  }

  document.getElementById('onizleIndir').onclick = () => ekIndir(id);
};

window.onizleKapatBtn = () => {
  document.getElementById('onizleModal').classList.add('gizli');
  if (_onizleBlobUrl) { URL.revokeObjectURL(_onizleBlobUrl); _onizleBlobUrl = null; }
  document.getElementById('onizleIcerik').innerHTML = '';
};

window.onizleKapat = (e) => {
  if (e.target === document.getElementById('onizleModal')) onizleKapatBtn();
};

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

async function gorevSil() {
  if (!confirm('Görevi silmek istediğinize emin misiniz?')) return;
  const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (res.ok) window.location.href = '/tasks.html';
  else alert('Silme başarısız');
}

function duzenleModalAc() {
  document.getElementById('gorevModal').classList.remove('gizli');
}

function modalKapat() {
  document.getElementById('gorevModal').classList.add('gizli');
}

async function gorevGuncelle(e) {
  e.preventDefault();
  // Proje ID'sini mevcut görevden alıyoruz (detail sayfasında proje değiştirilmiyor)
  const projeRes = await apiFetch(`/api/tasks/${taskId}`);
  const mevcut   = await projeRes.json();

  const body = {
    baslik:    document.getElementById('formBaslik').value.trim(),
    aciklama:  document.getElementById('formAciklama').value.trim(),
    proje_id:  mevcut.proje_id,
    atanan_id: mevcut.atanan_id,
    durum:     document.getElementById('formDurum').value,
    oncelik:   document.getElementById('formOncelik').value,
    deadline:  document.getElementById('formDeadline').value || null,
  };

  const res = await apiFetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) { alert('Güncelleme başarısız'); return; }
  modalKapat();
  yukleGorev();
}

function deadlineCss(dl) {
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const d     = new Date(dl); d.setHours(0,0,0,0);
  const fark  = (d - bugun) / 86400000;
  if (fark < 0)  return 'deadline-gecmis';
  if (fark <= 1) return 'deadline-yakin';
  return '';
}

function durumEtiket(d) {
  return { bekliyor: 'Bekliyor', devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlandı' }[d] || d;
}
function oncelikEtiket(o) {
  return { dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek' }[o] || o;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);

main();
