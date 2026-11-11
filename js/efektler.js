'use strict';
// ── Kaos Kent · parçacık efektleri: duman, kıvılcım, patlama, su, nitro, uçan yazılar ──

const Efekt = {
  p: [],
  yazilar: [],

  ekle(o) { if (this.p.length < 1400) this.p.push(o); },

  duman(x, y, koyu) {
    this.ekle({ x, y, vx: aralik(-14, 14), vy: aralik(-14, 14), yas: 0, omur: aralik(0.9, 1.7),
      r: aralik(5, 9), buyu: 16, renk: koyu ? '35,35,38' : '215,215,220', alfa: koyu ? 0.45 : 0.3, surt: 1 });
  },

  kivilcim(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, h = aralik(80, 300);
      this.ekle({ x, y, vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: aralik(0.15, 0.45),
        r: 1.6, buyu: 0, renk: '255,210,90', alfa: 1, surt: 5, cizgi: true });
    }
  },

  patlama(x, y) {
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2, h = aralik(40, 260);
      this.ekle({ x, y, vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: aralik(0.3, 0.8),
        r: aralik(6, 14), buyu: 30, renk: sec(['255,200,60', '255,140,40', '255,90,30']), alfa: 0.9, surt: 3, parlak: true });
    }
    for (let i = 0; i < 18; i++) this.duman(x + aralik(-20, 20), y + aralik(-20, 20), true);
    this.kivilcim(x, y, 20);
  },

  su(x, y) {
    const a = Math.random() * Math.PI * 2, h = aralik(20, 90);
    this.ekle({ x, y, vx: Math.cos(a) * h, vy: Math.sin(a) * h, yas: 0, omur: aralik(0.4, 0.9),
      r: aralik(2, 4), buyu: 6, renk: '150,210,255', alfa: 0.7, surt: 1.5 });
  },

  nitro(a) {
    const c = Math.cos(a.aci), s = Math.sin(a.aci);
    const x = a.x - c * a.uzun / 2, y = a.y - s * a.uzun / 2;
    this.ekle({ x, y, vx: a.vx * 0.5 - c * aralik(120, 220) + aralik(-20, 20), vy: a.vy * 0.5 - s * aralik(120, 220) + aralik(-20, 20),
      yas: 0, omur: aralik(0.12, 0.25), r: aralik(3, 6), buyu: -8,
      renk: sec(['120,200,255', '180,120,255', '255,255,255']), alfa: 0.9, surt: 2, parlak: true });
  },

  yazi(x, y, metin, renk = '#fff') {
    this.yazilar.push({ x, y, metin, renk, yas: 0, omur: 1.4 });
    if (this.yazilar.length > 20) this.yazilar.shift();
  },

  guncelle(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.yas += dt;
      if (q.yas >= q.omur) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      const k = Math.max(0, 1 - q.surt * dt);
      q.vx *= k; q.vy *= k;
      q.r = Math.max(0.5, q.r + q.buyu * dt);
    }
    for (let i = this.yazilar.length - 1; i >= 0; i--) {
      const y = this.yazilar[i];
      y.yas += dt;
      if (y.yas >= y.omur) this.yazilar.splice(i, 1);
    }
  },

  ciz(c) {
    for (const q of this.p) {
      const a = q.alfa * (1 - q.yas / q.omur);
      if (q.parlak) c.globalCompositeOperation = 'lighter';
      if (q.cizgi) {
        c.strokeStyle = `rgba(${q.renk},${a})`; c.lineWidth = q.r;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); c.stroke();
      } else {
        c.fillStyle = `rgba(${q.renk},${a})`;
        c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill();
      }
      if (q.parlak) c.globalCompositeOperation = 'source-over';
    }
  },

  yaziCiz(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 16px Rubik, sans-serif'; c.lineWidth = 4; c.lineJoin = 'round';
    for (const y of this.yazilar) {
      const a = 1 - y.yas / y.omur;
      c.globalAlpha = Math.min(1, a * 2);
      const yy = y.y - y.yas * 45;
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(y.metin, y.x, yy);
      c.fillStyle = y.renk; c.fillText(y.metin, y.x, yy);
    }
    c.globalAlpha = 1;
  },
};
