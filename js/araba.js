'use strict';
// ── Kaos Kent · araba: fizik ve çizim ──
//
// Arabanın hızı iki parçaya ayrılır: ileri hız (vf) ve yan hız (vr).
// Lastikler yan hızı hızla yok eder; el freninde bu tutuş azalır ve araba kayar (drift).

const MODELLER = {
  sedan: { uzun: 36, gen: 18, cam: [-0.33, 0.56], tavan: [-0.22, 0.30] },
  hatch: { uzun: 31, gen: 17, cam: [-0.40, 0.66], tavan: [-0.30, 0.40] },
  van:   { uzun: 42, gen: 20, cam: [-0.44, 0.72], tavan: [-0.40, 0.56] },
  spor:  { uzun: 38, gen: 19, cam: [-0.22, 0.42], tavan: [-0.12, 0.20] },
};

class Araba {
  constructor(x, y, aci, o) {
    this.x = x; this.y = y; this.aci = aci;
    this.vx = 0; this.vy = 0; this.donusHizi = 0;
    this.tur = o.tur;                // 'oyuncu' | 'sivil' | 'polis' | 'park'
    this.model = o.model || 'sedan';
    this.m = MODELLER[this.model];
    this.uzun = this.m.uzun; this.gen = this.m.gen;
    this.r = this.model === 'van' ? 17 : 15;      // çarpışma yarıçapı
    this.kutle = this.model === 'van' ? 1.5 : 1;
    this.renkAyarla(o.renk || '#cccccc');
    this.can = 100; this.yikik = false; this.yikilmaZamani = 0;
    this.maxHiz = o.maxHiz || 300; this.ivme = o.ivme || 380; this.tutus = o.tutus || 9;
    this.girdi = { gaz: 0, fren: 0, dir: 0, elFreni: false, nitro: false, tutma: false };
    this.kayma = 0; this.sonIz = null;
    // yapay zekâ durumu
    this.seyirHizi = 190; this.kavsak = null; this.yon = 0; this.hedef = null;
    this.sersem = 0; this.takilma = 0; this.takilmaSayisi = 0; this.geriSure = 0; this.geriYon = 1;
    this.bekleme = 0; this.sabirsiz = 0; this.sil = false;
    this.siren = false; this.kovalama = false; this.gorusKontrol = 0; this.gorur = false; this.rota = null;
    this.sesBekle = 0; this.sonOyuncuDarbe = -99;
    this.taksi = false; this.nitroDepo = 1;
  }

  renkAyarla(renk) { this.renk = renk; this.tavanRenk = tonla(renk, 1.1); }

  get hiz() { return Math.hypot(this.vx, this.vy); }
  ileriHiz() { return this.vx * Math.cos(this.aci) + this.vy * Math.sin(this.aci); }

  fizik(dt) {
    const gi = this.girdi;
    const c = Math.cos(this.aci), s = Math.sin(this.aci);
    let vf = this.vx * c + this.vy * s;   // ileri hız
    let vr = -this.vx * s + this.vy * c;  // yana kayma hızı
    const zemin = Harita.noktaTipi(this.x, this.y);
    const nitro = gi.nitro && !this.yikik;
    const maxHiz = this.maxHiz * (nitro ? 1.4 : 1) * (zemin === Z.CIM ? 0.6 : 1);

    if (!this.yikik) {
      if (gi.gaz > 0 && vf < maxHiz) vf += this.ivme * (nitro ? 1.7 : 1) * gi.gaz * dt;
      if (gi.fren > 0) {
        if (vf > 15) vf -= 950 * gi.fren * dt;                                  // fren
        else if (vf > -this.maxHiz * 0.35) vf -= this.ivme * 0.55 * gi.fren * dt; // geri vites
      }
    }
    if (vf > maxHiz) vf -= (vf - maxHiz) * 1.5 * dt;   // nitro bitince yavaşça normale dön
    vf -= vf * 0.35 * dt;                              // hava direnci
    if (gi.gaz <= 0 && gi.fren <= 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 90 * dt); // yuvarlanma
    if (gi.tutma || this.yikik) vf -= vf * Math.min(1, 4 * dt);
    if (zemin === Z.CIM) vf -= vf * 0.8 * dt;

    const tutus = gi.elFreni ? 1.4 : this.tutus;
    vr -= vr * Math.min(1, tutus * dt);
    if (gi.elFreni) vf -= vf * 0.7 * dt;

    this.vx = c * vf - s * vr;
    this.vy = s * vf + c * vr;

    // Direksiyon: dönüş hıza bağlı, geri giderken ters döner, çok hızlıyken biraz azalır
    const hizOrani = sinirla(vf / 110, -1, 1);
    const kisma = 1 - 0.4 * Math.min(1, Math.abs(vf) / 650);
    const hedefDonus = (this.yikik ? 0 : gi.dir) * 2.7 * hizOrani * kisma * (gi.elFreni ? 1.4 : 1);
    this.donusHizi += (hedefDonus - this.donusHizi) * Math.min(1, 8 * dt);
    this.aci += this.donusHizi * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.kayma = Math.abs(vr);
  }

  ciz(c, zaman) {
    const L = this.uzun, W = this.gen, m = this.m;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.aci);

    // gölge
    c.fillStyle = 'rgba(0,0,0,0.32)';
    yuvarlakKutu(c, -L / 2 + 3, -W / 2 + 4, L, W, 6); c.fill();

    // tekerlekler (öndekiler direksiyonla döner)
    c.fillStyle = '#111';
    const tx = L / 2 - 8, ty = W / 2 - 1;
    c.fillRect(-tx - 4.5, -ty - 2, 9, 4);
    c.fillRect(-tx - 4.5, ty - 2, 9, 4);
    for (const yy of [-ty, ty]) {
      c.save(); c.translate(tx, yy); c.rotate(this.girdi.dir * 0.35); c.fillRect(-4.5, -2, 9, 4); c.restore();
    }

    // gövde
    c.fillStyle = this.yikik ? '#2b2b2b' : this.renk;
    yuvarlakKutu(c, -L / 2, -W / 2, L, W, 5); c.fill();
    if (!this.yikik) {
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke();
      if (this.tur === 'polis') { c.fillStyle = '#1d3557'; c.fillRect(-L * 0.2, -W / 2, L * 0.4, W); }
      c.fillStyle = 'rgba(255,255,255,0.16)';
      yuvarlakKutu(c, -L / 2 + 3, -W / 2 + 2, L - 6, W * 0.3, 3); c.fill();
    }

    // camlar ve tavan
    c.fillStyle = this.yikik ? '#111' : '#1f2b38';
    yuvarlakKutu(c, L * m.cam[0], -W / 2 + 2.5, L * m.cam[1], W - 5, 3); c.fill();
    c.fillStyle = this.yikik ? '#1a1a1a' : (this.tur === 'polis' ? '#f1f3f5' : this.tavanRenk);
    yuvarlakKutu(c, L * m.tavan[0], -W / 2 + 3.5, L * m.tavan[1], W - 7, 2); c.fill();

    if (!this.yikik) {
      // farlar ve stop lambaları
      c.fillStyle = '#fff6c7';
      c.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4); c.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
      c.fillStyle = this.girdi.fren > 0 && this.ileriHiz() > 5 ? '#ff2b2b' : '#8f1d1d';
      c.fillRect(-L / 2, -W / 2 + 2, 2.5, 4); c.fillRect(-L / 2, W / 2 - 6, 2.5, 4);

      if (this.tur === 'polis') {
        const yan = Math.floor(zaman * 8) % 2 === 0;
        c.fillStyle = this.siren && yan ? '#ff3b3b' : '#7a1010';
        c.fillRect(-2, -W / 2 + 3, 5, W / 2 - 3);
        c.fillStyle = this.siren && !yan ? '#3b82ff' : '#10307a';
        c.fillRect(-2, 0, 5, W / 2 - 3);
      }
      if (this.taksi) {
        c.fillStyle = '#ffd60a'; c.fillRect(-4, -5, 8, 10);
        c.fillStyle = '#111'; c.fillRect(-2, -3, 4, 6);
      }
    }
    c.restore();
  }
}
