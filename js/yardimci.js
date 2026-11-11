'use strict';
// ── Kaos Kent · yardımcılar: matematik, klavye ve ses ──

const TILE = 48; // bir karonun (harita hücresinin) piksel boyu

// Aynı tohumla hep aynı sayıları üreten rastgele sayı üreteci.
// Harita her açılışta aynı çıksın diye kullanıyoruz.
function tohumluRastgele(tohum) {
  let a = tohum >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const aralik = (a, b) => a + Math.random() * (b - a);
const sec = dizi => dizi[Math.floor(Math.random() * dizi.length)];
const sinirla = (v, a, b) => (v < a ? a : v > b ? b : v);
const mesafe = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// İki açı arasındaki en kısa fark (-π ile π arası)
function aciFarki(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Bir rengi koyulaştırır (k < 1) ya da açar (k > 1)
function tonla(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gr = (n >> 8) & 255, b = n & 255;
  if (k <= 1) { r *= k; gr *= k; b *= k; }
  else { const t = k - 1; r += (255 - r) * t; gr += (255 - gr) * t; b += (255 - b) * t; }
  return `rgb(${r | 0},${gr | 0},${b | 0})`;
}

const paraYaz = n => '₺' + Math.round(n).toLocaleString('tr-TR');

function yuvarlakKutu(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}

// ── Klavye ──
// basili: şu an basılı tuşlar, yeni: bu karede ilk kez basılanlar
const Tus = {
  basili: new Set(),
  yeni: new Set(),
  bas(...kodlar) { return kodlar.some(k => this.basili.has(k)); },
  yeniBasildi(...kodlar) { return kodlar.some(k => this.yeni.has(k)); },
};
const SAYFAYI_KAYDIRAN = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
addEventListener('keydown', e => {
  if (SAYFAYI_KAYDIRAN.has(e.code)) e.preventDefault();
  if (!Tus.basili.has(e.code)) Tus.yeni.add(e.code);
  Tus.basili.add(e.code);
});
addEventListener('keyup', e => Tus.basili.delete(e.code));
addEventListener('blur', () => Tus.basili.clear());

// ── Ses (Web Audio ile üretilir, ses dosyası yok) ──
const Ses = {
  ctx: null,
  acik: true,

  baslat() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try { this.ctx = new C(); } catch (e) { return; }
    const c = this.ctx;
    this.ana = c.createGain();
    this.ana.gain.value = this.acik ? 0.5 : 0;
    this.ana.connect(c.destination);

    // Motor uğultusu: testere dişi dalga + alçak geçiren süzgeç
    this.motor = c.createOscillator(); this.motor.type = 'sawtooth'; this.motor.frequency.value = 40;
    const ms = c.createBiquadFilter(); ms.type = 'lowpass'; ms.frequency.value = 420;
    this.motorSes = c.createGain(); this.motorSes.gain.value = 0;
    this.motor.connect(ms); ms.connect(this.motorSes); this.motorSes.connect(this.ana);
    this.motor.start();

    // Siren: iki tonlu kare dalga
    this.siren = c.createOscillator(); this.siren.type = 'square'; this.siren.frequency.value = 720;
    const ss = c.createBiquadFilter(); ss.type = 'lowpass'; ss.frequency.value = 1600;
    this.sirenSes = c.createGain(); this.sirenSes.gain.value = 0;
    this.siren.connect(ss); ss.connect(this.sirenSes); this.sirenSes.connect(this.ana);
    this.siren.start();

    // Çarpma sesleri için hazır gürültü
    const n = Math.floor(c.sampleRate * 0.8);
    this.gurultu = c.createBuffer(1, n, c.sampleRate);
    const v = this.gurultu.getChannelData(0);
    for (let i = 0; i < n; i++) v[i] = (Math.random() * 2 - 1) * (1 - i / n);
  },

  guncelle(hiz, gaz, siren, t, motorAcik = true) {
    if (!this.ctx) return;
    const z = this.ctx.currentTime;
    this.motor.frequency.setTargetAtTime(38 + hiz * 0.15 + gaz * 14, z, 0.06);
    this.motorSes.gain.setTargetAtTime(motorAcik ? 0.035 + Math.min(1, hiz / 600) * 0.05 + gaz * 0.015 : 0, z, 0.1);
    this.siren.frequency.setTargetAtTime(Math.floor(t * 1.6) % 2 ? 960 : 720, z, 0.02);
    this.sirenSes.gain.setTargetAtTime(siren * 0.035, z, 0.2);
  },

  durgun() {
    if (!this.ctx) return;
    const z = this.ctx.currentTime;
    this.motorSes.gain.setTargetAtTime(0, z, 0.1);
    this.sirenSes.gain.setTargetAtTime(0, z, 0.1);
    if (this.yagmurSes) this.yagmurSes.gain.setTargetAtTime(0, z, 0.1);
  },

  // Sürekli çalan yağmur hışırtısı (sesi yağmurun gücüne göre)
  yagmur(guc) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.yagmurSes) {
      const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), v = buf.getChannelData(0);
      for (let i = 0; i < n; i++) v[i] = Math.random() * 2 - 1;
      const k = c.createBufferSource(); k.buffer = buf; k.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.6;
      this.yagmurSes = c.createGain(); this.yagmurSes.gain.value = 0;
      k.connect(f); f.connect(this.yagmurSes); this.yagmurSes.connect(this.ana);
      k.start();
    }
    this.yagmurSes.gain.setTargetAtTime(guc * 0.09, c.currentTime, 0.5);
  },

  // Gök gürültüsü
  gok() {
    if (!this.ctx) return;
    const c = this.ctx, z = c.currentTime + aralik(0.2, 0.8);
    const k = c.createBufferSource(); k.buffer = this.gurultu; k.playbackRate.value = 0.35;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, z); g.gain.exponentialRampToValueAtTime(0.7, z + 0.08); g.gain.exponentialRampToValueAtTime(0.001, z + 2.2);
    k.connect(f); f.connect(g); g.connect(this.ana);
    k.start(z); k.stop(z + 2.3);
  },

  tok(v) { this.ton(120, 0.12, 'sine', 0.25 * v); this.carpma(0.12 * v); },

  carpma(guc) {
    if (!this.ctx || guc <= 0.01) return;
    const c = this.ctx, z = c.currentTime;
    const k = c.createBufferSource(); k.buffer = this.gurultu; k.playbackRate.value = 0.6 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400 + guc * 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.min(0.6, guc * 0.6), z);
    g.gain.exponentialRampToValueAtTime(0.001, z + 0.3 + guc * 0.3);
    k.connect(f); f.connect(g); g.connect(this.ana);
    k.start(z); k.stop(z + 0.7);
  },

  ton(frekans, sure, tip = 'sine', ses = 0.12, gecikme = 0) {
    if (!this.ctx || ses < 0.0005) return;
    const c = this.ctx, z = c.currentTime + gecikme;
    const o = c.createOscillator(); o.type = tip; o.frequency.value = frekans;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, z);
    g.gain.exponentialRampToValueAtTime(ses, z + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, z + sure);
    o.connect(g); g.connect(this.ana);
    o.start(z); o.stop(z + sure + 0.05);
  },

  korna() { this.ton(370, 0.35, 'square', 0.07); this.ton(466, 0.35, 'square', 0.07); },
  basari() { [523, 659, 784, 1047].forEach((f, i) => this.ton(f, 0.22, 'triangle', 0.13, i * 0.09)); },
  basarisiz() { [392, 330, 247].forEach((f, i) => this.ton(f, 0.28, 'sawtooth', 0.06, i * 0.14)); },
  para() { this.ton(1318, 0.08, 'square', 0.06); this.ton(1760, 0.14, 'square', 0.06, 0.07); },
  patlama(v) { this.carpma(1.2 * v); this.ton(55, 0.6, 'sine', 0.3 * v); },

  degistir() {
    this.acik = !this.acik;
    if (this.ana) this.ana.gain.value = this.acik ? 0.5 : 0;
    return this.acik;
  },
};
