import { apiFetch } from './api.js';
import { initAuth, getKullanici, logout } from './auth.js';
import { donutGrafik, cubukGrafik } from './chart.js';

// Sabit renkler
const DURUM_RENK = {
  bekliyor:     '#f59e0b',
  devam_ediyor: '#3b82f6',
  tamamlandi:   '#22c55e',
};
const ONCELIK_RENK = {
  yuksek: '#ef4444',
  orta:   '#f59e0b',
  dusuk:  '#22c55e',
};
const PROJE_RENKLER = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'
];

async function main() {
  const ok = await initAuth();
  if (!ok) { window.location.href = '/login.html'; return; }

  const kullanici = getKullanici();
  const isimEl = document.getElementById('kullaniciAdi');
  if (isimEl && kullanici) isimEl.textContent = kullanici.ad;

  const res  = await apiFetch('/api/tasks/dashboard');
  const data = await res.json();

  // Özet kartlar
  document.getElementById('toplamGorev').textContent    = data.toplam ?? 0;
  document.getElementById('bekleyenSayi').textContent   = durumSayi(data.durum, 'bekliyor');
  document.getElementById('devamSayi').textContent      = durumSayi(data.durum, 'devam_ediyor');
  document.getElementById('tamamSayi').textContent      = durumSayi(data.durum, 'tamamlandi');
  document.getElementById('gecikmisSayi').textContent   = data.gecikis.length;

  // ── Durum dağılımı — halka grafiği ──
  donutGrafik(document.getElementById('durumGrafik'), [
    { etiket: 'Bekliyor',     sayi: durumSayi(data.durum, 'bekliyor'),     renk: DURUM_RENK.bekliyor },
    { etiket: 'Devam Ediyor', sayi: durumSayi(data.durum, 'devam_ediyor'), renk: DURUM_RENK.devam_ediyor },
    { etiket: 'Tamamlandı',   sayi: durumSayi(data.durum, 'tamamlandi'),   renk: DURUM_RENK.tamamlandi },
  ]);

  // ── Öncelik dağılımı — çubuk grafiği ──
  cubukGrafik(document.getElementById('oncelikGrafik'), [
    { etiket: 'Yüksek', sayi: oncelikSayi(data.oncelik, 'yuksek'), renk: ONCELIK_RENK.yuksek },
    { etiket: 'Orta',   sayi: oncelikSayi(data.oncelik, 'orta'),   renk: ONCELIK_RENK.orta },
    { etiket: 'Düşük',  sayi: oncelikSayi(data.oncelik, 'dusuk'),  renk: ONCELIK_RENK.dusuk },
  ]);

  // ── Projelere göre görev sayısı — çubuk grafiği ──
  cubukGrafik(
    document.getElementById('projeGrafik'),
    (data.projeData || []).map((p, i) => ({
      etiket: p.ad,
      sayi:   p.sayi,
      renk:   PROJE_RENKLER[i % PROJE_RENKLER.length],
    }))
  );

  renderListe('benimGorevler',   data.benim,   satirOlustur);
  renderListe('bugunDeadline',   data.bugun,   satirOlustur);
  renderListe('gecikmisList',    data.gecikis, satirOlustur);
  renderListe('haftaDeadline',   data.hafta,   satirOlustur);
  renderListe('sonEklenenler',   data.son,     satirOlustur);
}

function durumSayi(durumlar, durum) {
  const b = (durumlar || []).find(d => d.durum === durum);
  return b ? Number(b.sayi) : 0;
}

function oncelikSayi(liste, oncelik) {
  const b = (liste || []).find(d => d.oncelik === oncelik);
  return b ? Number(b.sayi) : 0;
}

function renderListe(id, liste, satirFn) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  if (!liste || liste.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="bos">Kayıt yok</td></tr>';
    return;
  }
  tbody.innerHTML = liste.map(satirFn).join('');
}

function satirOlustur(g) {
  const deadlineClass = deadlineCss(g.deadline);
  const deadlineText  = g.deadline ? formatTarih(g.deadline) : '—';
  return `<tr>
    <td><a href="/task-detail.html?id=${g.id}">${g.baslik}</a></td>
    <td>${g.proje_ad || '—'}</td>
    <td><span class="badge badge-${g.durum}">${durumEtiket(g.durum)}</span></td>
    <td><span class="badge badge-${g.oncelik}">${g.oncelik}</span></td>
    <td class="${deadlineClass}">${deadlineText}</td>
  </tr>`;
}

function deadlineCss(deadline) {
  if (!deadline) return '';
  const bugun = new Date(); bugun.setHours(0,0,0,0);
  const dl    = new Date(deadline); dl.setHours(0,0,0,0);
  const fark  = (dl - bugun) / 86400000;
  if (fark < 0)  return 'deadline-gecmis';
  if (fark <= 1) return 'deadline-yakin';
  return '';
}

function durumEtiket(d) {
  return { bekliyor: 'Bekliyor', devam_ediyor: 'Devam Ediyor', tamamlandi: 'Tamamlandı' }[d] || d;
}

function formatTarih(t) {
  return new Date(t).toLocaleDateString('tr-TR');
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);

main();
