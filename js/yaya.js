'use strict';
// ── Kaos Kent · yayalar ve yürüyen oyuncu ──
//
// Yayalar bloğun kaldırım halkası üstünde yürür. Hızla gelen araba ya da korna
// duyunca kaçışırlar, çarpılırsa yere düşüp birkaç saniye sonra kalkarlar
// (çizgi film usulü: kimse yaralanmaz, sadece başında yıldızlar döner).

const GOMLEK = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#6d597a', '#90be6d',
  '#577590', '#f15bb5', '#ffffff', '#264653', '#bc6c25'];
const TEN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SAC = ['#2b2118', '#4a3728', '#a0522d', '#111111', '#d6b370', '#7f7f7f'];
const SEMSIYE = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#7209b7', '#222222'];
const CIGLIK = ['Aaa!', 'İmdaat!', 'Dikkat!', 'Deli misin?!', 'Kaçııın!', 'Ayy!'];
const KIZGIN = ['Hey!', 'Bak sen!', 'Ehliyetini al!', 'Hıh!', 'Yavaş be!'];

// Halka (dikdörtgen) çevresinde t uzunluğundaki nokta ve dışa bakan yön
function halkaNokta(h, t) {
  const P = 2 * (h.w + h.h);
  t = ((t % P) + P) % P;
  if (t < h.w) return { x: h.x + t, y: h.y, nx: 0, ny: -1 };
  t -= h.w;
  if (t < h.h) return { x: h.x + h.w, y: h.y + t, nx: 1, ny: 0 };
  t -= h.h;
  if (t < h.w) return { x: h.x + h.w - t, y: h.y + h.h, nx: 0, ny: 1 };
  t -= h.w;
  return { x: h.x, y: h.y + h.h - t, nx: -1, ny: 0 };
}

// Halkada (x, y)'ye en yakın noktanın t değeri
function halkaEnYakinT(h, x, y) {
  const cx = sinirla(x, h.x, h.x + h.w), cy = sinirla(y, h.y, h.y + h.h);
  const ust = Math.abs(cy - h.y), alt = Math.abs(cy - (h.y + h.h));
  const sol = Math.abs(cx - h.x), sag = Math.abs(cx - (h.x + h.w));
  const m = Math.min(ust, alt, sol, sag);
  if (m === ust) return cx - h.x;
  if (m === sag) return h.w + (cy - h.y);
  if (m === alt) return h.w + h.h + (h.x + h.w - cx);
  return 2 * h.w + h.h + (h.y + h.h - cy);
}

// Bir cismi binalardan, ağaçlardan ve harita kenarından dışarı it (hasar yok)
function cismiItele(o) {
  const r = o.r, T = TILE;
  const tx0 = Math.floor((o.x - r) / T), tx1 = Math.floor((o.x + r) / T);
  const ty0 = Math.floor((o.y - r) / T), ty1 = Math.floor((o.y + r) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= HN || ty >= HN) continue;
      const id = Harita.katiIndeks[ty * HN + tx];
      if (id < 0) continue;
      const k = Harita.katilar[id];
      const cx = sinirla(o.x, k.x, k.x + k.w), cy = sinirla(o.y, k.y, k.y + k.h);
      const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 < 0.0001) {
        const sol = o.x - k.x, sag = k.x + k.w - o.x, ust = o.y - k.y, alt = k.y + k.h - o.y;
        const m = Math.min(sol, sag, ust, alt);
        if (m === sol) o.x = k.x - r; else if (m === sag) o.x = k.x + k.w + r;
        else if (m === ust) o.y = k.y - r; else o.y = k.y + k.h + r;
      } else {
        const d = Math.sqrt(d2);
        o.x = cx + dx / d * r; o.y = cy + dy / d * r;
      }
    }
  }
  for (const t of Harita.agaclar) {
    const dx = o.x - t.x, dy = o.y - t.y;
    if (dx > 30 || dx < -30 || dy > 30 || dy < -30) continue;
    const d = Math.hypot(dx, dy), min = r + 7;
    if (d < min && d > 0.01) { o.x = t.x + dx / d * min; o.y = t.y + dy / d * min; }
  }
  o.x = sinirla(o.x, r, Harita.boyut - r);
  o.y = sinirla(o.y, r, Harita.boyut - r);
}

class Yaya {
  constructor(x, y, o = {}) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.aci = Math.random() * Math.PI * 2; this.r = 7; this.can = 100;
    this.oyuncu = !!o.oyuncu;
    this.gomlek = o.gomlek || sec(GOMLEK); this.ten = sec(TEN); this.sac = sec(SAC);
    this.semsiye = Math.random() < 0.75 ? sec(SEMSIYE) : null;
    this.durum = 'yuru';   // yuru | kac | don | yerde
    this.sure = 0; this.kontrol = Math.random() * 0.2; this.donus = 0;
    this.halka = o.halka || null; this.t = o.t || 0;
    this.yon = Math.random() < 0.5 ? 1 : -1; this.kayma = aralik(-12, 12);
    this.yuruHizi = aralik(26, 46); this.faz = Math.random() * 10;
    this.kacX = 0; this.kacY = 0;
  }

  get hiz() { return Math.hypot(this.vx, this.vy); }

  dusur(vx, vy, sure) {
    this.durum = 'yerde'; this.sure = sure;
    this.vx = vx; this.vy = vy; this.donus = aralik(-8, 8);
  }

  kac(kaynakX, kaynakY, kvx, kvy) {
    let kx = this.x - kaynakX, ky = this.y - kaynakY;
    const d = Math.hypot(kx, ky) || 1;
    kx /= d; ky /= d;
    const vh = Math.hypot(kvx, kvy);
    if (vh > 1) {
      // aracın yolundan yana doğru kaç
      const yx = -kvy / vh, yy = kvx / vh, s = (kx * yx + ky * yy) >= 0 ? 1 : -1;
      kx = kx * 0.4 + yx * s * 0.9; ky = ky * 0.4 + yy * s * 0.9;
      const n = Math.hypot(kx, ky) || 1; kx /= n; ky /= n;
    }
    this.durum = 'kac'; this.sure = aralik(1.4, 2.4); this.kacX = kx; this.kacY = ky;
  }

  yerdeGuncelle(dt) {
    this.sure -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const k = Math.max(0, 1 - 4 * dt);
    this.vx *= k; this.vy *= k; this.aci += this.donus * dt; this.donus *= k;
    cismiItele(this);
  }

  ciz(c, zaman, yagmur) {
    c.save();
    c.translate(this.x, this.y);
    if (this.oyuncu) {
      c.strokeStyle = 'rgba(255,214,10,0.9)'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.stroke();
    }
    c.rotate(this.aci);
    if (this.durum === 'yerde') {
      c.fillStyle = 'rgba(0,0,0,0.25)'; elips(c, 2, 3, 12, 6);
      c.fillStyle = '#343a40'; yuvarlakKutu(c, -16, -4, 8, 3.5, 1.5); c.fill(); yuvarlakKutu(c, -16, 0.5, 8, 3.5, 1.5); c.fill();
      c.fillStyle = this.gomlek; yuvarlakKutu(c, -9, -5, 14, 10, 4); c.fill();
      c.fillStyle = this.ten; daireDoldur(c, -2, -7, 2.2); daireDoldur(c, -2, 7, 2.2);
      c.fillStyle = this.sac; daireDoldur(c, 8, 0, 4.5);
      c.restore();
      if (this.sure < 60) {
        c.fillStyle = '#ffd60a';
        for (let k = 0; k < 3; k++) {
          const a = zaman * 5 + k * 2.09;
          daireDoldur(c, this.x + Math.cos(a) * 9, this.y - 4 + Math.sin(a) * 4, 1.8);
        }
      }
      return;
    }
    const sal = Math.sin(this.faz) * Math.min(1, this.hiz / 40) * 4;
    c.fillStyle = 'rgba(0,0,0,0.25)'; elips(c, 2, 3, 7, 8);
    c.fillStyle = '#343a40'; daireDoldur(c, sal, -3, 2.5); daireDoldur(c, -sal, 3, 2.5);
    c.fillStyle = this.ten; daireDoldur(c, -sal, -7, 2.2); daireDoldur(c, sal, 7, 2.2);
    c.fillStyle = this.gomlek; elips(c, 0, 0, 4.5, 7);
    c.fillStyle = this.sac; daireDoldur(c, 0.5, 0, 4.2);
    c.fillStyle = this.ten; c.beginPath(); c.arc(1, 0, 4.2, -0.9, 0.9); c.closePath(); c.fill();
    c.restore();
    if (yagmur > 0.25 && this.semsiye && !this.oyuncu) {
      c.save(); c.translate(this.x, this.y);
      c.globalAlpha = 0.93; c.fillStyle = this.semsiye; daireDoldur(c, 0, 0, 11);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; c.moveTo(-Math.cos(a) * 11, -Math.sin(a) * 11); c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); }
      c.stroke();
      c.restore();
    }
  }
}

function elips(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function daireDoldur(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

// Yakında tehlike var mı? (hızla gelen araba, patlama, korna)
function tehlikeBul(y, O) {
  for (const a of O.arabalar) {
    const dx = y.x - a.x, dy = y.y - a.y;
    if (dx > 130 || dx < -130 || dy > 130 || dy < -130) continue;
    const h = a.hiz;
    if (h < 90) continue;
    const d = Math.hypot(dx, dy) || 1;
    if ((a.vx * dx + a.vy * dy) / (d * h) > 0.4) return a;
  }
  for (const l of O.anlikIsiklar) if (mesafe(l.x, l.y, y.x, y.y) < 220) return { x: l.x, y: l.y, vx: 0, vy: 0 };
  const ben = O.oyuncu;
  if (O.zaman - O.kornaZamani < 0.6 && mesafe(ben.x, ben.y, y.x, y.y) < 230) return ben;
  return null;
}

// Yapay zekâlı yaya
function yayaYZ(y, dt, O) {
  y.faz += dt * y.hiz * 0.28;
  if (y.durum === 'yerde') {
    y.yerdeGuncelle(dt);
    if (y.sure <= 0) {
      y.durum = 'don'; y.vx = y.vy = 0;
      if (Math.random() < 0.5 && O.gorusteMi(y.x, y.y)) Efekt.yazi(y.x, y.y - 14, sec(KIZGIN), '#ffd166');
    }
    return;
  }
  y.kontrol -= dt;
  if (y.kontrol <= 0) {
    y.kontrol = 0.2;
    const t = tehlikeBul(y, O);
    if (t) {
      if (y.durum !== 'kac' && Math.random() < 0.35 && O.gorusteMi(y.x, y.y)) Efekt.yazi(y.x, y.y - 14, sec(CIGLIK), '#ffffff');
      y.kac(t.x, t.y, t.vx || 0, t.vy || 0);
    }
  }
  if (y.durum === 'kac') {
    y.sure -= dt;
    y.vx = y.kacX * 150; y.vy = y.kacY * 150;
    y.x += y.vx * dt; y.y += y.vy * dt;
    cismiItele(y);
    y.aci = Math.atan2(y.vy, y.vx);
    if (y.sure <= 0) y.durum = 'don';
    return;
  }
  if (!y.halka) y.halka = Harita.enYakinHalka(y.x, y.y);
  if (y.durum === 'don') {
    // kaldırıma geri dön
    const t = halkaEnYakinT(y.halka, y.x, y.y), p = halkaNokta(y.halka, t);
    const dx = p.x + p.nx * y.kayma - y.x, dy = p.y + p.ny * y.kayma - y.y, d = Math.hypot(dx, dy);
    if (d < 4) { y.durum = 'yuru'; y.t = t; return; }
    y.vx = dx / d * 60; y.vy = dy / d * 60;
    y.x += y.vx * dt; y.y += y.vy * dt;
    cismiItele(y);
    y.aci = Math.atan2(dy, dx);
    return;
  }
  // kaldırımda yürü
  y.t += y.yon * y.yuruHizi * dt;
  const p = halkaNokta(y.halka, y.t);
  const dx = p.x + p.nx * y.kayma - y.x, dy = p.y + p.ny * y.kayma - y.y, d = Math.hypot(dx, dy);
  if (d > 0.01) {
    const adim = Math.min(d, y.yuruHizi * 2 * dt);
    y.x += dx / d * adim; y.y += dy / d * adim;
    y.vx = dx / d * adim / dt; y.vy = dy / d * adim / dt;
    y.aci = Math.atan2(dy, dx);
  }
  if (Math.random() < dt * 0.03) y.yon *= -1;
}

// Oyuncu yürürken: tuşlar ekrana göre (W yukarı, D sağa)
function yayaKontrol(y, dt) {
  if (y.durum === 'yerde') {
    y.yerdeGuncelle(dt);
    if (y.sure <= 0) { y.durum = 'yuru'; y.vx = y.vy = 0; }
    return;
  }
  let dx = (Tus.bas('KeyD', 'ArrowRight') ? 1 : 0) - (Tus.bas('KeyA', 'ArrowLeft') ? 1 : 0);
  let dy = (Tus.bas('KeyS', 'ArrowDown') ? 1 : 0) - (Tus.bas('KeyW', 'ArrowUp') ? 1 : 0);
  const v = Tus.bas('ShiftLeft', 'ShiftRight') ? 210 : 120;
  const n = Math.hypot(dx, dy);
  if (n > 0) { dx /= n; dy /= n; y.aci = Math.atan2(dy, dx); }
  const k = Math.min(1, 12 * dt);
  y.vx += (dx * v - y.vx) * k; y.vy += (dy * v - y.vy) * k;
  y.x += y.vx * dt; y.y += y.vy * dt;
  cismiItele(y);
  y.faz += dt * y.hiz * 0.28;
}
