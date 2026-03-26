import { apiFetch } from './api.js';
import { initAuth, getKullanici, logout } from './auth.js';

let projeler  = [];
let kullanicilar = [];
let siralama  = 'created_at';
let siralYon  = 'DESC';

async function main() {
  const ok = await initAuth();
  if (!ok) { window.location.href = '/login.html'; return; }

  const kullanici = getKullanici();
  const isimEl = document.getElementById('kullaniciAdi');
  if (isimEl && kullanici) isimEl.textContent = kullanici.ad;

  await Promise.all([yukleFiltreler(), yukleGorevler()]);

  document.getElementById('filtreleBtn')?.addEventListener('click', yukleGorevler);
  document.getElementById('araInput')?.addEventListener('input', yukleGorevler);
  document.getElementById('yeniGorevBtn')?.addEventListener('click', () => modalAc());
  document.getElementById('modalKapat')?.addEventListener('click', modalKapat);
  document.getElementById('gorevForm')?.addEventListener('submit', gorevKaydet);

  // Sütun sıralama
  document.querySelectorAll('th[data-siralama]').forEach(th => {
    th.addEventListener('click', () => {
      const s = th.dataset.siralama;
      if (siralama === s) siralYon = siralYon === 'ASC' ? 'DESC' : 'ASC';
      else { siralama = s; siralYon = 'ASC'; }
      yukleGorevler();
    });
  });
}

async function yukleFiltreler() {
  const [pRes, uRes] = await Promise.all([
    apiFetch('/api/projects'),
    apiFetch('/api/tasks?siralama=created_at&yon=DESC'),
  ]);
  projeler = await pRes.json();

  // Kullanıcı listesini görevlerden çekiyoruz (ayrı endpoint yok)
  // Gerçek projede /api/users eklenebilir
  const projeSelect = document.getElementById('filtreProje');
  const atananSelect = document.getElementById('filtreAtanan');
  const projeFormSel = document.getElementById('formProje');

  projeler.forEach(p => {
    projeSelect?.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.ad}</option>`);
    projeFormSel?.insertAdjacentHTML('beforeend', `<option value="${p.id}">${p.ad}</option>`);
  });

  // Kullanıcılar için tasks'tan çek
  const tRes = await apiFetch('/api/tasks');
  const tasks = await tRes.json();
  const uniq = {};
  tasks.forEach(t => {
    if (t.atanan_id && !uniq[t.atanan_id]) {
      uniq[t.atanan_id] = t.atanan_ad;
      kullanicilar.push({ id: t.atanan_id, ad: t.atanan_ad });
    }
  });
  kullanicilar.forEach(u => {
    atananSelect?.insertAdjacentHTML('beforeend', `<option value="${u.id}">${u.ad}</option>`);
    document.getElementById('formAtanan')?.insertAdjacentHTML('beforeend', `<option value="${u.id}">${u.ad}</option>`);
  });
}

async function yukleGorevler() {
  const params = new URLSearchParams();
  const projeId  = document.getElementById('filtreProje')?.value;
  const durum    = document.getElementById('filtreDurum')?.value;
  const atananId = document.getElementById('filtreAtanan')?.value;
  const oncelik  = document.getElementById('filtreOncelik')?.value;
  const arama    = document.getElementById('araInput')?.value.trim();

  if (projeId)  params.set('proje_id',  projeId);
  if (durum)    params.set('durum',     durum);
  if (atananId) params.set('atanan_id', atananId);
  if (oncelik)  params.set('oncelik',   oncelik);
  if (arama)    params.set('arama',     arama);
  params.set('siralama', siralama);
  params.set('yon',      siralYon);

  const res   = await apiFetch('/api/tasks?' + params.toString());
  const tasks = await res.json();
  renderTablo(tasks);
}

function renderTablo(tasks) {
  const tbody = document.getElementById('gorevTablo');
  if (!tbody) return;
  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="bos">Görev bulunamadı</td></tr>';
    return;
  }
  tbody.innerHTML = tasks.map(g => {
    const dlClass = deadlineCss(g.deadline);
    const dlText  = g.deadline ? new Date(g.deadline).toLocaleDateString('tr-TR') : '—';
    return `<tr>
      <td><a href="/task-detail.html?id=${g.id}">${g.baslik}</a></td>
      <td>${g.proje_ad || '—'}</td>
      <td>${g.atanan_ad || '—'}</td>
      <td><span class="badge badge-${g.durum}">${durumEtiket(g.durum)}</span></td>
      <td><span class="badge badge-oncelik-${g.oncelik}">${oncelikEtiket(g.oncelik)}</span></td>
      <td class="${dlClass}">${dlText}</td>
      <td>
        <button class="btn-icon" onclick="duzenle(${g.id})">✏️</button>
        <button class="btn-icon" onclick="sil(${g.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function modalAc(gorev = null) {
  document.getElementById('modalBaslik').textContent = gorev ? 'Görevi Düzenle' : 'Yeni Görev';
  document.getElementById('gorevId').value      = gorev?.id || '';
  document.getElementById('formBaslik').value   = gorev?.baslik || '';
  document.getElementById('formAciklama').value = gorev?.aciklama || '';
  document.getElementById('formProje').value    = gorev?.proje_id || '';
  document.getElementById('formAtanan').value   = gorev?.atanan_id || '';
  document.getElementById('formDurum').value    = gorev?.durum || 'bekliyor';
  document.getElementById('formOncelik').value  = gorev?.oncelik || 'orta';
  document.getElementById('formDeadline').value = gorev?.deadline ? gorev.deadline.split('T')[0] : '';
  document.getElementById('gorevModal').classList.remove('gizli');
}

function modalKapat() {
  document.getElementById('gorevModal').classList.add('gizli');
}

async function gorevKaydet(e) {
  e.preventDefault();
  const id = document.getElementById('gorevId').value;
  const body = {
    baslik:    document.getElementById('formBaslik').value.trim(),
    aciklama:  document.getElementById('formAciklama').value.trim(),
    proje_id:  document.getElementById('formProje').value,
    atanan_id: document.getElementById('formAtanan').value || null,
    durum:     document.getElementById('formDurum').value,
    oncelik:   document.getElementById('formOncelik').value,
    deadline:  document.getElementById('formDeadline').value || null,
  };

  const res = await apiFetch(id ? `/api/tasks/${id}` : '/api/tasks', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) { alert('Kayıt başarısız'); return; }
  modalKapat();
  yukleGorevler();
}

window.duzenle = async (id) => {
  const res   = await apiFetch(`/api/tasks/${id}`);
  const gorev = await res.json();
  modalAc(gorev);
};

window.sil = async (id) => {
  if (!confirm('Görevi silmek istediğinize emin misiniz?')) return;
  await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  yukleGorevler();
};

function deadlineCss(dl) {
  if (!dl) return '';
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const d     = new Date(dl); d.setHours(0,0,0,0);
  const fark  = (d - bugun) / 86400000;
  if (fark < 0)  return 'deadline-gecmis';
  if (fark <= 1) return 'deadline-yakin';
  return '';
}

function durumEtiket(d) {
  return { bekliyor: 'Bekliyor', devam_ediyor: 'Devam', tamamlandi: 'Tamamlandı' }[d] || d;
}
function oncelikEtiket(o) {
  return { dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek' }[o] || o;
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);

main();
