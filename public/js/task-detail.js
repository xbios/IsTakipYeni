import { apiFetch } from './api.js';
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
  await yukleYorumlar();

  document.getElementById('yorumForm')?.addEventListener('submit', yorumGonder);
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
        ${kullanici && kullanici.id === y.kullanici_id
          ? `<button class="btn-link" onclick="yorumSil(${y.id})">Sil</button>`
          : ''}
      </div>
      <p>${escHtml(y.yorum)}</p>
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
