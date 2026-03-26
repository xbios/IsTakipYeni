/**
 * chart.js — Harici kütüphane kullanmadan SVG/CSS grafik bileşenleri
 *
 * donutGrafik(el, dilimler)   — Halka grafiği (durum/öncelik dağılımı)
 * cubukGrafik(el, dilimler)   — Yatay çubuk grafiği (proje bazlı, öncelik vb.)
 *
 * dilimler dizisi formatı: [{ etiket: string, sayi: number, renk: string }]
 */

// ─── Halka (Donut) Grafiği ────────────────────────────────────────────────────
export function donutGrafik(konteyner, dilimler) {
  const toplam = dilimler.reduce((t, d) => t + (d.sayi || 0), 0);

  if (!toplam) {
    konteyner.innerHTML = '<p class="grafik-bos">Henüz veri yok</p>';
    return;
  }

  const cx = 100, cy = 100, r = 64, sw = 24;
  const C   = 2 * Math.PI * r;  // çevre ≈ 402
  const GAP = toplam > 1 ? 3 : 0; // tek dilimse boşluk gerekmez

  // Her dilim için başlangıç offset'i ve görünür uzunluğu hesapla
  let cumulative = 0;
  const segmentler = dilimler.map(d => {
    const arc     = (d.sayi / toplam) * C;
    const visible = Math.max(0, arc - GAP);
    const seg     = { ...d, visible, offset: cumulative };
    cumulative += arc;
    return seg;
  });

  // SVG yayları
  const arcs = segmentler
    .filter(s => s.sayi > 0)
    .map(s => `
      <circle cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${s.renk}"
        stroke-width="${sw}"
        stroke-dasharray="${s.visible.toFixed(2)} ${C.toFixed(2)}"
        stroke-dashoffset="${(-s.offset).toFixed(2)}"
        stroke-linecap="butt"
        transform="rotate(-90 ${cx} ${cy})"
        class="donut-arc">
        <title>${s.etiket}: ${s.sayi}</title>
      </circle>`)
    .join('');

  // Orta yazı
  const ortaYazi = `
    <text x="${cx}" y="${cy - 9}" text-anchor="middle" class="donut-merkez-sayi">${toplam}</text>
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" class="donut-merkez-etiket">Toplam</text>
  `;

  // Açıklama satırları
  const legend = dilimler.map(d => {
    const pct = toplam ? Math.round((d.sayi / toplam) * 100) : 0;
    return `
      <div class="donut-legend-satir">
        <span class="donut-legend-renk" style="background:${d.renk}"></span>
        <span class="donut-legend-etiket">${d.etiket}</span>
        <span class="donut-legend-deger">${d.sayi}</span>
        <span class="donut-legend-pct">%${pct}</span>
      </div>`;
  }).join('');

  konteyner.innerHTML = `
    <div class="donut-ic">
      <svg class="donut-svg" viewBox="0 0 200 200" aria-label="Durum dağılımı grafiği">
        <!-- arka plan halkası -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${sw}"/>
        ${arcs}
        ${ortaYazi}
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
}


// ─── Yatay Çubuk Grafiği ─────────────────────────────────────────────────────
export function cubukGrafik(konteyner, dilimler) {
  const max = Math.max(...dilimler.map(d => d.sayi), 1);

  const satirlar = dilimler.map(d => {
    const pct  = (d.sayi / max) * 100;
    // Çubuk genişliği CSS transition ile animasyon alır
    return `
      <div class="cubuk-satir">
        <div class="cubuk-etiket" title="${d.etiket}">${d.etiket}</div>
        <div class="cubuk-iz">
          <div class="cubuk-dolgu" data-pct="${pct.toFixed(1)}" style="background:${d.renk}; width:0%">
          </div>
        </div>
        <div class="cubuk-deger">${d.sayi}</div>
      </div>`;
  }).join('');

  konteyner.innerHTML = `<div class="cubuk-grafik">${satirlar}</div>`;

  // Tarayıcının render etmesi için bir tick bekle, sonra animasyon başlat
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      konteyner.querySelectorAll('.cubuk-dolgu').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    });
  });
}
