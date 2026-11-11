'use strict';
// ── Kaos Kent · hava durumu: açık, yağmur, fırtına ──
//
// guc: 0 (kuru) → 1 (sağanak). Yağmur lastik tutuşunu ve fren gücünü düşürür,
// gökyüzünü karartır, birikintiler belirir; fırtınada şimşek çakar.

const Hava = {
  durum: 'acik',
  guc: 0, hedef: 0,
  sayac: 70,          // bir sonraki hava değişimine kalan süre
  simsek: 0, simsekSayac: 8,
  damlalar: [],

  guncelle(dt, bildir) {
    this.sayac -= dt;
    if (this.sayac <= 0) {
      this.sayac = aralik(70, 150);
      const z = Math.random();
      this.degis(z < 0.5 ? 'acik' : z < 0.8 ? 'yagmur' : 'firtina', bildir);
    }
    this.guc += sinirla(this.hedef - this.guc, -0.07 * dt, 0.07 * dt);
    if (this.durum === 'firtina' && this.guc > 0.6) {
      this.simsekSayac -= dt;
      if (this.simsekSayac <= 0) { this.simsekSayac = aralik(5, 14); this.simsek = 1; Ses.gok(); }
    }
    this.simsek = Math.max(0, this.simsek - dt * 2.5);
    Ses.yagmur(this.guc);

    // yerdeki damla halkaları
    if (this.guc > 0.05) {
      const v = Oyun.gorus, n = this.guc * 70 * dt;
      for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++)
        Efekt.halka(aralik(v.x0, v.x1), aralik(v.y0, v.y1));
    }
  },

  degis(yeni, bildir) {
    if (yeni === this.durum) return;
    const eski = this.durum;
    this.durum = yeni;
    this.hedef = { acik: 0, yagmur: 0.65, firtina: 1 }[yeni];
    if (!bildir) return;
    if (yeni === 'yagmur') Hud.bildirim('🌧️ Yağmur başladı, yollar kaygan!');
    else if (yeni === 'firtina') Hud.bildirim('⛈️ Fırtına geliyor! Yollar çok kaygan.');
    else if (eski !== 'acik') Hud.bildirim('🌤️ Yağmur dindi.');
  },

  ikon(gece) {
    if (this.guc > 0.3) return this.durum === 'firtina' ? '⛈️' : '🌧️';
    return gece ? '🌙' : '☀️';
  },

  // Islak yoldaki su birikintileri (dünya koordinatında)
  birikintiCiz(c) {
    if (this.guc < 0.05) return;
    for (const b of Harita.birikintiler) {
      if (!Oyun.gorusteMi(b.x, b.y, 40)) continue;
      c.fillStyle = `rgba(120,150,190,${0.38 * this.guc})`;
      c.beginPath(); c.ellipse(b.x, b.y, b.rx, b.ry, b.aci, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(220,235,255,${0.22 * this.guc})`; c.lineWidth = 1.5; c.stroke();
    }
  },

  // Ekrana düşen yağmur çizgileri, gri ton ve şimşek (ekran koordinatında)
  ekranCiz(c, W, H, dpr, dt) {
    if (this.guc > 0.01) {
      c.fillStyle = `rgba(30,45,70,${0.22 * this.guc})`;
      c.fillRect(0, 0, W, H);
      const hedefSayi = Math.floor(this.guc * 260 * (W * H) / 1.6e6);
      while (this.damlalar.length < hedefSayi) this.damlalar.push({ x: Math.random() * W, y: Math.random() * H, h: aralik(10, 22) * dpr, v: aralik(900, 1300) * dpr });
      if (this.damlalar.length > hedefSayi) this.damlalar.length = hedefSayi;
      c.strokeStyle = 'rgba(190,210,255,0.35)'; c.lineWidth = dpr;
      c.beginPath();
      for (const d of this.damlalar) {
        d.y += d.v * dt; d.x += d.v * 0.25 * dt;
        if (d.y > H) { d.y = -d.h; d.x = Math.random() * W; }
        if (d.x > W) d.x -= W;
        c.moveTo(d.x, d.y); c.lineTo(d.x - 0.25 * d.h, d.y - d.h);
      }
      c.stroke();
    } else this.damlalar.length = 0;
    if (this.simsek > 0) { c.fillStyle = `rgba(235,240,255,${0.55 * this.simsek})`; c.fillRect(0, 0, W, H); }
  },
};
