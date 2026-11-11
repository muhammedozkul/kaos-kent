'use strict';
// ── Kaos Kent · şehir haritası: yollar, binalar, parklar, eşyalar ──
//
// Harita 102×102 karodan oluşur. Her 10 karoda bir 2 karo genişliğinde yol var,
// aradaki 10×10 tane 8×8'lik blok: kenarı kaldırım, içi bina / park / otopark / özel yapı.
// Zemin çok büyük olduğu için tek tuval yerine 24×24 karoluk parçalara çizilir.

const HN = 102;   // haritanın bir kenarındaki karo sayısı
const KN = 11;    // bir eksendeki kavşak sayısı (yollar 0, 10, 20 ... 100. karolarda)
const BN = 10;    // bir eksendeki blok sayısı
const PARCA = 24; // zemin parçasının karo boyu
const Z = { YOL: 0, KALDIRIM: 1, BINA: 2, CIM: 3, OTOPARK: 4, SU: 5 };
// Yön sırası: 0 doğu, 1 güney, 2 batı, 3 kuzey
const YONLER = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }];

const CATI_RENKLERI = ['#c9d1d9', '#b8a99a', '#9fb4c7', '#d4b483', '#a3b18a', '#c08497',
  '#8d99ae', '#e9c46a', '#b5838d', '#84a59d', '#cdb4db', '#a8dadc'];
const AGAC_RENKLERI = ['#2d6a4f', '#40916c', '#52b788', '#386641', '#4f772d'];

// Kırılabilir eşyalar: r = çarpışma yarıçapı, kaos = kırınca kazanılan kaos puanı
const ESYA_TURLERI = {
  koni:    { r: 6,  kaos: 1 },
  cop:     { r: 8,  kaos: 2 },
  hidrant: { r: 6,  kaos: 4 },
  bank:    { r: 10, kaos: 3 },
  direk:   { r: 5,  kaos: 4 }, // sokak lambası
};

const Harita = {
  boyut: HN * TILE,
  zemin: new Uint8Array(HN * HN),
  katiIndeks: new Int16Array(HN * HN).fill(-1), // karo → içindeki katı cismin numarası
  katilar: [],   // çarpılabilen dikdörtgenler (binalar, göller)
  binalar: [], goller: [], agaclar: [], esyalar: [], lambalar: [], parkYerleri: [], otoparklar: [],
  tamirhaneler: [], karakol: null, hastane: null, itfaiye: null,
  halkalar: [],       // her bloğun kaldırım halkası (yayalar bunun üstünde yürür)
  birikintiler: [],   // yağmurda görünen su birikintileri
  esyaIzgara: null,   // karo → o karodaki eşyalar (hızlı çarpışma için)
  parcalar: [], mini: null,

  olustur() {
    const r = tohumluRastgele(2026);
    for (let y = 0; y < HN; y++)
      for (let x = 0; x < HN; x++)
        this.zemin[y * HN + x] = (x % 10 < 2 || y % 10 < 2) ? Z.YOL : Z.KALDIRIM;

    const turler = { '5,5': 'tamirhane', '1,8': 'tamirhane', '7,2': 'karakol', '2,2': 'hastane', '8,7': 'itfaiye' };
    const kalan = [];
    for (let by = 0; by < BN; by++)
      for (let bx = 0; bx < BN; bx++)
        if (!turler[bx + ',' + by]) kalan.push(bx + ',' + by);
    for (let i = kalan.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kalan[i], kalan[j]] = [kalan[j], kalan[i]];
    }
    kalan.forEach((k, i) => { turler[k] = i < 2 ? 'gol' : i < 8 ? 'park' : i < 13 ? 'otopark' : 'bina'; });

    for (let by = 0; by < BN; by++) {
      for (let bx = 0; bx < BN; bx++) {
        const x0 = bx * 10 + 2, y0 = by * 10 + 2;
        const tur = turler[bx + ',' + by];
        const uzaklik = Math.max(Math.abs(bx - 4.5), Math.abs(by - 4.5));
        this.halkalar.push({ x: (x0 + 0.5) * TILE, y: (y0 + 0.5) * TILE, w: 7 * TILE, h: 7 * TILE });
        this.kaldirimEsyalari(r, x0, y0);
        if (tur === 'bina') this.binaBlogu(r, x0 + 1, y0 + 1, uzaklik);
        else if (tur === 'park' || tur === 'gol') this.park(r, x0 + 1, y0 + 1, tur === 'gol');
        else if (tur === 'otopark') this.otopark(x0 + 1, y0 + 1);
        else if (tur === 'tamirhane') this.tamirhaneYap(x0 + 1, y0 + 1);
        else if (tur === 'karakol') this.karakolYap(x0 + 1, y0 + 1);
        else if (tur === 'hastane') this.hastaneYap(x0 + 1, y0 + 1);
        else if (tur === 'itfaiye') this.itfaiyeYap(x0 + 1, y0 + 1);
      }
    }
    this.birikintiOlustur(r);
    this.esyaIzgarasi();
    this.zeminCiz();
    this.miniCiz();
  },

  // ── Blok içerikleri ──
  kaldirimEsyalari(r, x0, y0) {
    const T = TILE;
    for (const [cx, cy, ox, oy] of [[x0, y0, -1, -1], [x0 + 7, y0, 1, -1], [x0, y0 + 7, -1, 1], [x0 + 7, y0 + 7, 1, 1]])
      this.esyaEkle('direk', (cx + 0.5) * T + ox * 14, (cy + 0.5) * T + oy * 14);
    for (let i = 1; i < 7; i++) {
      for (const [tx, ty, ox, oy] of [[x0 + i, y0, 0, -1], [x0 + i, y0 + 7, 0, 1], [x0, y0 + i, -1, 0], [x0 + 7, y0 + i, 1, 0]]) {
        if (r() > 0.16) continue;
        const z = r();
        const tur = z < 0.3 ? 'cop' : z < 0.5 ? 'hidrant' : z < 0.75 ? 'bank' : 'koni';
        const x = (tx + 0.5) * T + ox * 13 + (oy ? (r() - 0.5) * 20 : 0);
        const y = (ty + 0.5) * T + oy * 13 + (ox ? (r() - 0.5) * 20 : 0);
        this.esyaEkle(tur, x, y, oy ? 0 : Math.PI / 2);
      }
    }
  },

  esyaEkle(tur, x, y, aci = 0) {
    const t = ESYA_TURLERI[tur];
    const e = { tur, x, y, ox: x, oy: y, aci, oAci: aci, r: t.r, kaos: t.kaos,
      kirik: false, kirikZaman: 0, vx: 0, vy: 0, don: 0, su: 0 };
    this.esyalar.push(e);
    if (tur === 'direk') this.lambalar.push(e);
    return e;
  },

  binaBlogu(r, ix, iy, uzaklik) {
    const desenler = [
      [[0, 0, 6, 6]],
      [[0, 0, 3, 6], [3, 0, 3, 6]],
      [[0, 0, 6, 3], [0, 3, 6, 3]],
      [[0, 0, 3, 3], [3, 0, 3, 3], [0, 3, 3, 3], [3, 3, 3, 3]],
      [[0, 0, 4, 6], [4, 0, 2, 3], [4, 3, 2, 3]],
      [[0, 0, 6, 2], [0, 2, 3, 4], [3, 2, 3, 4]],
      [[0, 0, 2, 6], [2, 0, 4, 4], [2, 4, 4, 2]],
    ];
    const d = desenler[Math.floor(r() * desenler.length)];
    for (const [x, y, w, h] of d) {
      const enCok = Math.max(3, Math.round(16 - uzaklik * 3)); // merkeze yakın binalar daha yüksek
      const kat = 2 + Math.floor(r() * (enCok - 1));
      this.binaEkle(r, ix + x, iy + y, w, h, kat, CATI_RENKLERI[Math.floor(r() * CATI_RENKLERI.length)]);
    }
  },

  binaEkle(r, tx, ty, tw, th, kat, renk, etiket, etiketRenk = '#ffffff') {
    const T = TILE, bosluk = 5;
    const b = {
      x: tx * T + bosluk, y: ty * T + bosluk, w: tw * T - bosluk * 2, h: th * T - bosluk * 2,
      kat, renk, etiket, etiketRenk,
      duvar1: tonla(renk, 0.66), duvar2: tonla(renk, 0.5), kenar: tonla(renk, 0.82), parlak: tonla(renk, 1.12),
      kutular: [],
      pencere: [3 + Math.floor(r() * 6), 2 + Math.floor(r() * 7)],
      isikOran: 0.35 + r() * 0.55,
      ox: 0, oy: 0, yangin: 0,
    };
    if (!etiket) {
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const w = 10 + r() * 16, h = 10 + r() * 12;
        b.kutular.push({ x: 6 + r() * (b.w - w - 12), y: 6 + r() * (b.h - h - 12), w, h });
      }
    }
    this.katiEkle(b, tx, ty, tw, th, Z.BINA);
    this.binalar.push(b);
    return b;
  },

  katiEkle(k, tx, ty, tw, th, zemin) {
    const id = this.katilar.length;
    this.katilar.push(k);
    for (let y = ty; y < ty + th; y++)
      for (let x = tx; x < tx + tw; x++) {
        this.zemin[y * HN + x] = zemin;
        this.katiIndeks[y * HN + x] = id;
      }
  },

  alanDoldur(ix, iy, w, h, tur) {
    for (let y = iy; y < iy + h; y++) for (let x = ix; x < ix + w; x++) this.zemin[y * HN + x] = tur;
  },

  park(r, ix, iy, golVar) {
    const T = TILE;
    this.alanDoldur(ix, iy, 6, 6, Z.CIM);
    let gol = null;
    if (golVar) {
      gol = { x: (ix + 1) * T + 10, y: (iy + 1) * T + 10, w: 4 * T - 20, h: 4 * T - 20, su: true };
      this.katiEkle(gol, ix + 1, iy + 1, 4, 4, Z.SU);
      this.goller.push(gol);
    }
    let deneme = 0, adet = 0;
    while (deneme++ < 60 && adet < (golVar ? 9 : 11)) {
      const x = (ix + 0.4) * T + r() * 5.2 * T, y = (iy + 0.4) * T + r() * 5.2 * T;
      if (gol && x > gol.x - 24 && x < gol.x + gol.w + 24 && y > gol.y - 24 && y < gol.y + gol.h + 24) continue;
      if (this.agaclar.some(a => Math.abs(a.x - x) < 46 && Math.abs(a.y - y) < 46 && Math.hypot(a.x - x, a.y - y) < 46)) continue;
      this.agaclar.push({ x, y, r: 17 + r() * 9, renk: AGAC_RENKLERI[Math.floor(r() * AGAC_RENKLERI.length)] });
      adet++;
    }
    for (let i = 0; i < 2; i++) this.esyaEkle('bank', (ix + 1 + r() * 4) * T, (iy + 0.45 + i * 5.1) * T, 0);
  },

  otopark(ix, iy) {
    const T = TILE;
    this.alanDoldur(ix, iy, 6, 6, Z.OTOPARK);
    for (let i = 0; i < 6; i++) {
      this.parkYerleri.push({ x: (ix + i + 0.5) * T, y: (iy + 1) * T, aci: Math.PI / 2 });
      this.parkYerleri.push({ x: (ix + i + 0.5) * T, y: (iy + 5) * T, aci: -Math.PI / 2 });
    }
    this.otoparklar.push({ ix, iy });
  },

  tamirhaneYap(ix, iy) {
    const T = TILE;
    this.binaEkle(() => 0.5, ix, iy, 6, 2, 2, '#e07a2f', '🔧 TAMİRHANE');
    this.alanDoldur(ix, iy + 2, 6, 4, Z.OTOPARK);
    this.tamirhaneler.push({ x: ix * T + 10, y: (iy + 2) * T + 10, w: 6 * T - 20, h: 4 * T - 20 });
  },

  karakolYap(ix, iy) {
    const T = TILE;
    this.binaEkle(() => 0.5, ix, iy, 6, 3, 4, '#3b5ba9', '🚓 POLİS');
    this.alanDoldur(ix, iy + 3, 6, 3, Z.OTOPARK);
    this.karakol = { x: (ix + 3) * T, y: (iy + 4.5) * T };
  },

  hastaneYap(ix, iy) {
    const T = TILE;
    this.binaEkle(() => 0.5, ix, iy, 6, 3, 6, '#e9ecef', '🏥 HASTANE', '#d00000');
    this.alanDoldur(ix, iy + 3, 6, 3, Z.OTOPARK);
    this.hastane = { x: (ix + 3.5) * T, y: (iy + 4.5) * T, arac: { x: (ix + 1) * T, y: (iy + 4.5) * T, aci: Math.PI / 2 } };
  },

  itfaiyeYap(ix, iy) {
    const T = TILE;
    this.binaEkle(() => 0.5, ix, iy, 6, 3, 3, '#c1121f', '🚒 İTFAİYE');
    this.alanDoldur(ix, iy + 3, 6, 3, Z.OTOPARK);
    this.itfaiye = { x: (ix + 3.5) * T, y: (iy + 4.5) * T, arac: { x: (ix + 1.2) * T, y: (iy + 4.5) * T, aci: Math.PI / 2 } };
  },

  birikintiOlustur(r) {
    let n = 0;
    while (n < 170) {
      const tx = Math.floor(r() * HN), ty = Math.floor(r() * HN);
      const ox = r(), oy = r(), b = r(), a = r();
      if (this.zemin[ty * HN + tx] !== Z.YOL) continue;
      const rx = 14 + b * 22;
      this.birikintiler.push({ x: (tx + 0.2 + ox * 0.6) * TILE, y: (ty + 0.2 + oy * 0.6) * TILE, rx, ry: rx * (0.45 + a * 0.35), aci: a * Math.PI });
      n++;
    }
  },

  esyaIzgarasi() {
    this.esyaIzgara = new Array(HN * HN);
    for (const p of this.esyalar) {
      const i = Math.floor(p.oy / TILE) * HN + Math.floor(p.ox / TILE);
      (this.esyaIzgara[i] || (this.esyaIzgara[i] = [])).push(p);
    }
  },

  // ── Zemin parçaları (bir kez çizilir, lastik izleri sonradan eklenir) ──
  zeminCiz() {
    const P = PARCA * TILE, n = Math.ceil(this.boyut / P);
    for (let py = 0; py < n; py++) {
      for (let px = 0; px < n; px++) {
        const x0 = px * P, y0 = py * P;
        const c = document.createElement('canvas');
        c.width = Math.min(P, this.boyut - x0);
        c.height = Math.min(P, this.boyut - y0);
        const g = c.getContext('2d');
        g.translate(-x0, -y0);
        this.parcaCiz(g, x0, y0, x0 + c.width, y0 + c.height);
        this.parcalar.push({ x: x0, y: y0, w: c.width, h: c.height, c, g });
      }
    }
  },

  parcaCiz(g, X0, Y0, X1, Y1) {
    const T = TILE, B = this.boyut;
    const r = tohumluRastgele(7); // her parçada aynı sıra → parça sınırında dikiş olmaz
    const tx0 = Math.max(0, Math.floor(X0 / T) - 1), ty0 = Math.max(0, Math.floor(Y0 / T) - 1);
    const tx1 = Math.min(HN - 1, Math.ceil(X1 / T) + 1), ty1 = Math.min(HN - 1, Math.ceil(Y1 / T) + 1);

    const RENK = { [Z.YOL]: '#3a3f47', [Z.KALDIRIM]: '#a2a8ae', [Z.BINA]: '#8a9097', [Z.CIM]: '#5c9a4a', [Z.OTOPARK]: '#4a4f57', [Z.SU]: '#5c9a4a' };
    for (let y = ty0; y <= ty1; y++)
      for (let x = tx0; x <= tx1; x++) { g.fillStyle = RENK[this.zemin[y * HN + x]]; g.fillRect(x * T, y * T, T, T); }

    // doku
    for (let i = 0; i < 52000; i++) {
      const x = r() * B, y = r() * B, a = r(), w = 2 + r() * 2, h = 2 + r() * 2;
      if (x < X0 - 4 || x > X1 || y < Y0 - 4 || y > Y1) continue;
      const t = this.tip(Math.floor(x / T), Math.floor(y / T));
      g.fillStyle = t === Z.CIM
        ? (a < 0.5 ? 'rgba(20,60,20,0.18)' : 'rgba(180,230,140,0.12)')
        : (a < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)');
      g.fillRect(x, y, w, h);
    }

    // kaldırım taşları ve bordürler
    g.lineWidth = 1;
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        if (this.tip(x, y) !== Z.KALDIRIM) continue;
        g.strokeStyle = 'rgba(0,0,0,0.09)';
        g.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
        g.beginPath();
        g.moveTo(x * T + T / 2, y * T); g.lineTo(x * T + T / 2, y * T + T);
        g.moveTo(x * T, y * T + T / 2); g.lineTo(x * T + T, y * T + T / 2);
        g.stroke();
        g.fillStyle = '#d9dde1';
        if (this.tip(x, y - 1) === Z.YOL) g.fillRect(x * T, y * T, T, 4);
        if (this.tip(x, y + 1) === Z.YOL) g.fillRect(x * T, y * T + T - 4, T, 4);
        if (this.tip(x - 1, y) === Z.YOL) g.fillRect(x * T, y * T, 4, T);
        if (this.tip(x + 1, y) === Z.YOL) g.fillRect(x * T + T - 4, y * T, 4, T);
      }
    }

    // kesik sarı çizgiler
    g.fillStyle = '#f2c94c';
    for (let j = 0; j < KN; j++) {
      const yc = (j * 10 + 1) * T;
      if (yc < Y0 - T || yc > Y1 + T) continue;
      for (let x = tx0; x <= tx1; x++) { const m = x % 10; if (m < 3 || m === 9) continue; g.fillRect(x * T + 8, yc - 1.5, 26, 3); }
    }
    for (let i = 0; i < KN; i++) {
      const xc = (i * 10 + 1) * T;
      if (xc < X0 - T || xc > X1 + T) continue;
      for (let y = ty0; y <= ty1; y++) { const m = y % 10; if (m < 3 || m === 9) continue; g.fillRect(xc - 1.5, y * T + 8, 3, 26); }
    }

    // yaya geçitleri
    g.fillStyle = 'rgba(240,240,240,0.85)';
    for (let i = 0; i < KN; i++) {
      for (let j = 0; j < KN; j++) {
        const cx = i * 10, cy = j * 10;
        if ((cx + 3) * T < X0 || (cx - 1) * T > X1 || (cy + 3) * T < Y0 || (cy - 1) * T > Y1) continue;
        for (const tx of [cx + 2, cx - 1])
          if (tx >= 0 && tx < HN) for (let k = 0; k < 7; k++) g.fillRect(tx * T + 9, cy * T + 5 + k * 13, 30, 7);
        for (const ty of [cy + 2, cy - 1])
          if (ty >= 0 && ty < HN) for (let k = 0; k < 7; k++) g.fillRect(cx * T + 5 + k * 13, ty * T + 9, 7, 30);
      }
    }

    // otopark çizgileri
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    for (const o of this.otoparklar) {
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const x = (o.ix + i) * T;
        g.moveTo(x, o.iy * T + 4); g.lineTo(x, (o.iy + 2) * T - 6);
        g.moveTo(x, (o.iy + 4) * T + 6); g.lineTo(x, (o.iy + 6) * T - 4);
      }
      g.stroke();
    }

    // özel alanların yer yazıları
    g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.tamirhaneler) {
      g.setLineDash([14, 10]); g.strokeStyle = '#ffd60a'; g.lineWidth = 4;
      g.strokeRect(t.x, t.y, t.w, t.h); g.setLineDash([]);
      g.fillStyle = 'rgba(255,214,10,0.35)'; g.fillText('TAMİR', t.x + t.w / 2, t.y + t.h / 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillText('POLİS', this.karakol.x, this.karakol.y);
    g.fillStyle = 'rgba(255,90,90,0.4)';
    g.fillText('ACİL', this.hastane.x + 30, this.hastane.y);
    g.fillStyle = 'rgba(255,140,90,0.4)';
    g.fillText('112', this.itfaiye.x + 30, this.itfaiye.y);

    // göller
    this.goller.forEach((p, k) => {
      const pr = tohumluRastgele(100 + k);
      g.fillStyle = '#d8c99b'; yuvarlakKutu(g, p.x - 6, p.y - 6, p.w + 12, p.h + 12, 36); g.fill();
      g.fillStyle = '#2f7fb3'; yuvarlakKutu(g, p.x, p.y, p.w, p.h, 30); g.fill();
      g.fillStyle = '#4aa3d8'; yuvarlakKutu(g, p.x + 10, p.y + 10, p.w - 20, p.h - 20, 24); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = p.x + 30 + pr() * (p.w - 60), y = p.y + 30 + pr() * (p.h - 60);
        g.beginPath(); g.arc(x, y, 6 + pr() * 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }
    });

    // gölgeler
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (const b of this.binalar) {
      const o = 4 + b.kat * 1.5;
      if (b.x + b.w + o < X0 || b.x > X1 || b.y + b.h + o < Y0 || b.y > Y1) continue;
      g.fillRect(b.x + o, b.y + o, b.w, b.h);
    }
    for (const a of this.agaclar) {
      if (a.x + 40 < X0 || a.x - 40 > X1 || a.y + 40 < Y0 || a.y - 40 > Y1) continue;
      g.beginPath(); g.arc(a.x + 6, a.y + 7, a.r, 0, Math.PI * 2); g.fill();
    }
  },

  // Kayan lastik izini zemin parçalarına çiz
  izCiz(ax, ay, bx, by, cx, cy, dx, dy) {
    const x0 = Math.min(ax, bx, cx, dx) - 4, x1 = Math.max(ax, bx, cx, dx) + 4;
    const y0 = Math.min(ay, by, cy, dy) - 4, y1 = Math.max(ay, by, cy, dy) + 4;
    for (const p of this.parcalar) {
      if (x1 < p.x || x0 > p.x + p.w || y1 < p.y || y0 > p.y + p.h) continue;
      const z = p.g;
      z.strokeStyle = 'rgba(18,18,22,0.22)'; z.lineWidth = 4; z.lineCap = 'round';
      z.beginPath(); z.moveTo(ax, ay); z.lineTo(bx, by); z.moveTo(cx, cy); z.lineTo(dx, dy); z.stroke();
    }
  },

  // Görünen bölgedeki zemin parçalarını çiz
  zeminiCiz(c, v) {
    for (const p of this.parcalar) {
      const x0 = Math.max(p.x, Math.floor(v.x0)), y0 = Math.max(p.y, Math.floor(v.y0));
      const x1 = Math.min(p.x + p.w, Math.ceil(v.x1)), y1 = Math.min(p.y + p.h, Math.ceil(v.y1));
      if (x1 <= x0 || y1 <= y0) continue;
      c.drawImage(p.c, x0 - p.x, y0 - p.y, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
  },

  miniCiz() {
    const c = document.createElement('canvas');
    c.width = c.height = HN;
    const g = c.getContext('2d');
    const img = g.createImageData(HN, HN);
    const R = { [Z.YOL]: [205, 210, 218], [Z.KALDIRIM]: [120, 128, 138], [Z.BINA]: [52, 60, 74],
      [Z.CIM]: [76, 138, 64], [Z.OTOPARK]: [92, 98, 108], [Z.SU]: [61, 143, 196] };
    for (let i = 0; i < HN * HN; i++) { const k = R[this.zemin[i]]; img.data.set([k[0], k[1], k[2], 255], i * 4); }
    g.putImageData(img, 0, 0);
    this.mini = c;
  },

  // ── Sorgular ──
  tip(tx, ty) { return (tx < 0 || ty < 0 || tx >= HN || ty >= HN) ? -1 : this.zemin[ty * HN + tx]; },
  noktaTipi(x, y) { return this.tip(Math.floor(x / TILE), Math.floor(y / TILE)); },

  katiNokta(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= HN || ty >= HN) return true;
    const id = this.katiIndeks[ty * HN + tx];
    if (id < 0) return false;
    const k = this.katilar[id];
    return x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h;
  },

  gorusVar(ax, ay, bx, by) {
    const n = Math.ceil(mesafe(ax, ay, bx, by) / 18);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.katiNokta(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  },

  kavsakMerkez(i, j) { return { x: (i * 10 + 1) * TILE, y: (j * 10 + 1) * TILE }; },
  gecerliKavsak(i, j) { return i >= 0 && j >= 0 && i < KN && j < KN; },

  seritNoktasi(i, j, d) {
    const m = this.kavsakMerkez(i, j), y = YONLER[d];
    return { x: m.x - y.dy * TILE / 2, y: m.y + y.dx * TILE / 2 };
  },

  enYakinKavsak(x, y) {
    return {
      i: sinirla(Math.round((x / TILE - 1) / 10), 0, KN - 1),
      j: sinirla(Math.round((y / TILE - 1) / 10), 0, KN - 1),
    };
  },

  enYakinHalka(x, y) {
    const bx = sinirla(Math.round((x / TILE - 6) / 10), 0, BN - 1);
    const by = sinirla(Math.round((y / TILE - 6) / 10), 0, BN - 1);
    return this.halkalar[by * BN + bx];
  },

  rastgeleSerit() {
    for (;;) {
      const i = Math.floor(Math.random() * KN), j = Math.floor(Math.random() * KN), d = Math.floor(Math.random() * 4);
      const y = YONLER[d], ni = i + y.dx, nj = j + y.dy;
      if (!this.gecerliKavsak(ni, nj)) continue;
      const a = this.kavsakMerkez(i, j), b = this.kavsakMerkez(ni, nj), t = aralik(0.22, 0.78);
      return {
        x: a.x + (b.x - a.x) * t - y.dy * TILE / 2,
        y: a.y + (b.y - a.y) * t + y.dx * TILE / 2,
        aci: Math.atan2(y.dy, y.dx), yon: d, i: ni, j: nj,
      };
    }
  },
};
