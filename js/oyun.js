'use strict';
// ── Kaos Kent · ana oyun: durum, döngü, çarpışmalar, aranma sistemi, çizim ──
//
// Oyun.oyuncu: şu an kontrol ettiğin şey. Arabadaysan bir Araba (tur 'oyuncu'),
// yürüyorsan bir Yaya. F ile ikisi arasında geçiş yapılır.

const tuval = document.getElementById('oyun');
const g = tuval.getContext('2d');
const isikTuval = document.createElement('canvas');
const ig = isikTuval.getContext('2d');

const YILDIZ_ESIK = [0, 20, 70, 140, 230, 330];
const GUN_SURESI = 300;
const SIVIL_SAYISI = 70;
const YAYA_SAYISI = 130;
const DEVRIYE_SAYISI = 3;
const KAYIT_ANAHTARI = 'kaosKent.kayit.v1';
const SIVIL_RENKLER = ['#4361ee', '#f1faee', '#2a9d8f', '#e9c46a', '#f4a261', '#8d99ae', '#6d597a',
  '#90be6d', '#577590', '#e5e5e5', '#1d3557', '#bc4749'];
const OYUNCU_RENKLER = ['#e63946', '#ff9f1c', '#06d6a0', '#4cc9f0', '#9b5de5', '#f15bb5', '#222831'];
const VARSAYILAN_KAYIT = { para: 200, motor: 0, zirh: 0, nitro: 0, renk: 0, gorev: 0, kaos: 0, enYildiz: 0, yakalanma: 0, pert: 0, bayilma: 0 };

const Oyun = {
  durum: 'giris',      // 'giris' | 'oyun' | 'duraklat' | 'magaza'
  zaman: 0, gunZamani: 0.3, dpr: 1, karanlik: 0,
  oyuncu: null, arabalar: [], yayalar: [], izlenen: null, izlemeBitis: 0,
  yayaCan: 100,        // arabadayken yürüyen hâlinin canı burada saklanır
  kayit: { ...VARSAYILAN_KAYIT },
  isi: 0, yildiz: 0, gizliSure: 0, polisGoruyor: false, gorusSayac: 0, yakalanma: 0,
  olay: null, kornaZamani: -9,
  nitroKapasite: 3,
  kamera: { x: 0, y: 0, zoom: 1, sarsinti: 0 },
  gorus: { x0: 0, y0: 0, x1: 1, y1: 1 },
  anlikIsiklar: [], cizilenBinalar: [],
  istasyon: { ambulans: null, itfaiye: null }, istasyonSayac: 0,
  polisSayac: 0, sivilSayac: 0, kayitSayac: 0,

  kaydet() { try { localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify(this.kayit)); } catch (e) { /* gizli sekme vb. */ } },
  yukle() {
    try {
      const k = JSON.parse(localStorage.getItem(KAYIT_ANAHTARI));
      if (k && typeof k === 'object') this.kayit = { ...VARSAYILAN_KAYIT, ...k };
    } catch (e) { /* kayıt yoksa varsayılan */ }
  },
  // Yükseltmeleri o an sürülen arabaya uygula
  oyuncuOzellik() {
    this.nitroKapasite = 3 + this.kayit.nitro * 1.2;
    if (this.oyuncu instanceof Araba) this.oyuncu.oyuncuOzelligi(this.kayit.motor);
  },
  aracta() { return this.oyuncu instanceof Araba; },
  paraEkle(m) { this.kayit.para = Math.max(0, this.kayit.para + m); },
  tamirhanede() {
    const o = this.oyuncu;
    if (this.durum !== 'oyun' || !(o instanceof Araba)) return false;
    return Harita.tamirhaneler.some(t => o.x > t.x && o.x < t.x + t.w && o.y > t.y && o.y < t.y + t.h);
  },
  gorusteMi(x, y, pay = 80) {
    const v = this.gorus;
    return x > v.x0 - pay && x < v.x1 + pay && y > v.y0 - pay && y < v.y1 + pay;
  },
  isiEkle(m) {
    if (this.durum !== 'oyun' || this.olay) return;
    this.isi = Math.min(420, this.isi + m * (this.polisGoruyor ? 1.5 : 1));
    if (this.yildiz > 0) this.gizliSure = Math.min(this.gizliSure, 2);
  },
  kaosEkle(m, x, y) {
    if (this.durum !== 'oyun') return;
    this.kayit.kaos += m;
    Gorevler.kaosEkle(m);
    Efekt.yazi(x, y - 22, `+${m} kaos`, '#ff7ad9');
  },
};

// ── Kurulum ──
function kur() {
  Harita.olustur();
  Oyun.yukle();
  Hud.kur();

  Oyun.oyuncu = oyuncuArabasiOlustur(Harita.tamirhaneler[0]);
  Oyun.oyuncuOzellik();

  for (const p of Harita.parkYerleri) {
    if (Math.random() < 0.55)
      Oyun.arabalar.push(new Araba(p.x, p.y, p.aci, { tur: 'park', model: sec(['sedan', 'hatch', 'hatch', 'van', 'sedan', 'spor']), renk: sec(SIVIL_RENKLER) }));
  }
  for (let i = 0; i < SIVIL_SAYISI; i++) sivilEkle(false);
  const kk = Harita.karakol;
  for (let i = 0; i < DEVRIYE_SAYISI; i++) rotayaBagla(polisOlustur(kk.x - 90 + i * 90, kk.y, Math.PI / 2));
  for (let i = 0; i < YAYA_SAYISI; i++) {
    const h = sec(Harita.halkalar), t = Math.random() * 2 * (h.w + h.h), p = halkaNokta(h, t);
    const y = new Yaya(0, 0, { halka: h, t });
    y.x = p.x + p.nx * y.kayma; y.y = p.y + p.ny * y.kayma;
    Oyun.yayalar.push(y);
  }
  istasyonAraci('ambulans');
  istasyonAraci('itfaiye');

  Gorevler.baslat();
  boyutla();
  addEventListener('resize', boyutla);
  dugmeleriBagla();
  requestAnimationFrame(dongu);
}

function boyutla() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  Oyun.dpr = dpr;
  tuval.width = isikTuval.width = Math.floor(innerWidth * dpr);
  tuval.height = isikTuval.height = Math.floor(innerHeight * dpr);
}

function oyuncuArabasiOlustur(t) {
  const o = new Araba(t.x + t.w / 2, t.y + t.h / 2, Math.PI / 2,
    { tur: 'oyuncu', model: 'spor', renk: OYUNCU_RENKLER[Oyun.kayit.renk % OYUNCU_RENKLER.length] });
  o.oyuncuOzelligi(Oyun.kayit.motor);
  Oyun.arabalar.push(o);
  return o;
}

function enYakinTamirhane(x, y) {
  let en = Harita.tamirhaneler[0], enD = Infinity;
  for (const t of Harita.tamirhaneler) { const d = mesafe(x, y, t.x + t.w / 2, t.y + t.h / 2); if (d < enD) { enD = d; en = t; } }
  return en;
}

function sivilEkle(gorusDisi) {
  const o = Oyun.oyuncu;
  for (let d = 0; d < 30; d++) {
    const s = Harita.rastgeleSerit();
    if (gorusDisi && (Oyun.gorusteMi(s.x, s.y, 150) || mesafe(s.x, s.y, o.x, o.y) < 700)) continue;
    if (Oyun.arabalar.some(a => Math.abs(a.x - s.x) < 50 && Math.abs(a.y - s.y) < 50)) continue;
    const a = new Araba(s.x, s.y, s.aci, { tur: 'sivil', model: sec(['sedan', 'sedan', 'hatch', 'hatch', 'van', 'spor']),
      renk: sec(SIVIL_RENKLER), maxHiz: 320, ivme: 300 });
    a.yon = s.yon; a.kavsak = { i: s.i, j: s.j }; a.hedef = Harita.seritNoktasi(s.i, s.j, s.yon);
    a.seyirHizi = aralik(140, 220);
    a.vx = Math.cos(s.aci) * a.seyirHizi * 0.7; a.vy = Math.sin(s.aci) * a.seyirHizi * 0.7;
    Oyun.arabalar.push(a);
    return a;
  }
  return null;
}

function polisOlustur(x, y, aci) {
  const p = new Araba(x, y, aci, { tur: 'polis', model: 'sedan', renk: '#f1f3f5', maxHiz: 400, ivme: 520, tutus: 8 });
  p.kutle = 1.35; p.seyirHizi = 200;
  Oyun.arabalar.push(p);
  return p;
}

// Hastane ve itfaiye otoparkındaki görev aracı
const ISTASYON = { ambulans: 'hastane', itfaiye: 'itfaiye' };
function istasyonAraci(tur) {
  const yer = Harita[ISTASYON[tur]].arac;
  const a = new Araba(yer.x, yer.y, yer.aci, { tur: 'park', model: tur, renk: tur === 'ambulans' ? '#f8f9fa' : '#d00000' });
  Oyun.arabalar.push(a);
  Oyun.istasyon[tur] = a;
}

// Görev aracı yerinden ayrıldıysa (ve kimse bakmıyorsa) yenisini koy
function istasyonKontrol(dt) {
  Oyun.istasyonSayac -= dt;
  if (Oyun.istasyonSayac > 0) return;
  Oyun.istasyonSayac = 3;
  for (const tur of ['ambulans', 'itfaiye']) {
    const a = Oyun.istasyon[tur], yer = Harita[ISTASYON[tur]].arac;
    if (a === Oyun.oyuncu || Oyun.gorusteMi(yer.x, yer.y, 120)) continue;
    if (!a || a.yikik || !Oyun.arabalar.includes(a) || mesafe(a.x, a.y, yer.x, yer.y) > 300) istasyonAraci(tur);
  }
}

function uzakSerit(min, max, gorusDisi) {
  const o = Oyun.oyuncu;
  for (let d = 0; d < 40; d++) {
    const s = Harita.rastgeleSerit(), m = mesafe(s.x, s.y, o.x, o.y);
    if (m < min || m > max) continue;
    if (gorusDisi && Oyun.gorusteMi(s.x, s.y, 120)) continue;
    return s;
  }
  return null;
}

// ── Arabadan inme / arabaya binme ──
function yakinAraba(y) {
  let en = null, enD = 30;
  for (const a of Oyun.arabalar) {
    if (a.yikik || a.hiz > 150) continue;
    const d = mesafe(a.x, a.y, y.x, y.y) - a.r;
    if (d < enD) { enD = d; en = a; }
  }
  return en;
}

// Arabanın solunda (yoksa sağında) boş bir yer
function arabaYani(a, pay = 12) {
  const c = Math.cos(a.aci), s = Math.sin(a.aci), u = a.gen / 2 + pay;
  for (const yan of [1, -1]) {
    const x = a.x + s * yan * u, y = a.y - c * yan * u;
    if (!Harita.katiNokta(x, y)) return { x, y };
  }
  return { x: a.x, y: a.y };
}

function binInDegistir() {
  const O = Oyun, ben = O.oyuncu;
  if (O.olay) return;
  if (ben instanceof Yaya) {
    if (ben.durum === 'yerde') return;
    const a = yakinAraba(ben);
    if (a) arabayaBin(a); else Hud.bildirim('Yakında binilecek araba yok');
  } else arabadanIn();
}

function arabadanIn() {
  const O = Oyun, a = O.oyuncu;
  if (a.hiz > 90) { Hud.bildirim('Önce yavaşla!'); return; }
  const yer = arabaYani(a);
  const y = new Yaya(yer.x, yer.y, { oyuncu: true, gomlek: '#ffd60a' });
  y.can = O.yayaCan; y.aci = a.aci;
  a.tur = 'park'; a.siren = false; a.taksi = false; a.sonIz = null;
  const gi = a.girdi; gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.nitro = false; gi.elFreni = false; gi.tutma = true;
  O.oyuncu = y;
  Ses.ton(240, 0.08, 'square', 0.05);
}

function arabayaBin(a) {
  const O = Oyun, y = O.oyuncu;
  if (a.tur === 'sivil') { surucuIndir(a); O.isiEkle(8); O.kaosEkle(3, a.x, a.y); }
  else if (a.tur === 'polis') { O.isiEkle(45); O.kaosEkle(10, a.x, a.y); Hud.bildirim('🚓 Polis arabası çaldın!'); }
  a.tur = 'oyuncu'; a.siren = false; a.kovalama = false; a.sersem = 0; a.geriSure = 0; a.takilma = 0; a.sil = false; a.rota = null;
  O.yayaCan = y.can;
  O.oyuncu = a;
  O.oyuncuOzellik();
  Ses.ton(300, 0.08, 'square', 0.05); Ses.ton(420, 0.1, 'square', 0.05, 0.06);
  if ((a.model === 'ambulans' || a.model === 'itfaiye') && !Gorevler.aktif) Gorevler.gorevBaslat({ tur: a.model });
  else Hud.bildirim(`🚗 ${a.ad}`);
}

// Çalınan arabanın sürücüsü dışarı fırlar ve kaçar
function surucuIndir(a) {
  const yer = arabaYani(a, 10), O = Oyun;
  const s = new Yaya(yer.x, yer.y);
  s.kac(O.oyuncu.x, O.oyuncu.y, 0, 0);
  O.yayalar.push(s);
  Efekt.yazi(s.x, s.y - 16, sec(['Arabam!', 'Hırsız var!', 'Polis!']), '#ffffff');
}

// ── Düğmeler ve ekranlar ──
function dugmeleriBagla() {
  document.getElementById('basla').onclick = e => { e.currentTarget.blur(); oyunuBaslat(); };
  document.getElementById('devam').onclick = e => { e.currentTarget.blur(); devam(); };
  document.getElementById('magaza-kapat').onclick = () => Magaza.kapat();
  document.getElementById('sifirla').onclick = () => {
    if (!confirm('Para, yükseltmeler ve istatistikler sıfırlansın mı?')) return;
    Oyun.kayit = { ...VARSAYILAN_KAYIT };
    if (Oyun.aracta() && Oyun.oyuncu.model === 'spor') Oyun.oyuncu.renkAyarla(OYUNCU_RENKLER[0]);
    Oyun.oyuncuOzellik();
    Oyun.kaydet();
    duraklat();
  };
  addEventListener('blur', () => { if (Oyun.durum === 'oyun') duraklat(); });
}

function oyunuBaslat() {
  if (Oyun.durum !== 'giris') return;
  Ses.baslat();
  Oyun.durum = 'oyun';
  document.getElementById('giris').classList.add('gizli');
  Hud.goster(true);
  const o = Oyun.oyuncu, t = Harita.tamirhaneler[0];
  o.x = t.x + t.w / 2; o.y = t.y + t.h / 2; o.vx = o.vy = 0; o.aci = Math.PI / 2;
  o.can = 100; o.yikik = false;
  Oyun.kamera.x = o.x; Oyun.kamera.y = o.y;
  Hud.duyuru('KAOS KENT', 'Renkli simgelere sür, görev başlasın!', '#ffd60a');
}

function duraklat() {
  Oyun.durum = 'duraklat';
  const k = Oyun.kayit;
  const satirlar = [['Para', paraYaz(k.para)], ['Tamamlanan görev', k.gorev], ['Toplam kaos', k.kaos],
    ['En yüksek aranma', '★'.repeat(k.enYildiz) || '—'], ['Yakalanma', k.yakalanma], ['Pert / bayılma', `${k.pert} / ${k.bayilma}`]];
  const el = document.getElementById('istatistik');
  el.textContent = '';
  for (const [ad, deger] of satirlar) {
    const x = document.createElement('div'); x.className = 'ist';
    const b = document.createElement('b'); b.textContent = deger;
    const s = document.createElement('span'); s.textContent = ad;
    x.append(b, s); el.appendChild(x);
  }
  document.getElementById('duraklat').classList.remove('gizli');
  if (Ses.ctx) Ses.ctx.suspend();
}

function devam() {
  Oyun.durum = 'oyun';
  document.getElementById('duraklat').classList.add('gizli');
  if (Ses.ctx) Ses.ctx.resume();
}

// ── Ana döngü ──
let sonZaman = performance.now();
let sonDt = 0;
function dongu(simdi) {
  const dt = Math.min(0.05, (simdi - sonZaman) / 1000);
  sonZaman = simdi;
  girdiIsle();
  const calisiyor = Oyun.durum === 'oyun' || Oyun.durum === 'giris';
  if (calisiyor) guncelle(dt);
  else Ses.durgun();
  sonDt = calisiyor ? dt : 0;
  ciz();
  Tus.yeni.clear();
  requestAnimationFrame(dongu);
}

function girdiIsle() {
  const d = Oyun.durum;
  if (d === 'giris') { if (Tus.yeniBasildi('Enter')) oyunuBaslat(); return; }
  if (Tus.yeniBasildi('KeyM')) Hud.bildirim(Ses.degistir() ? '🔊 Ses açık' : '🔇 Ses kapalı');
  if (d === 'oyun') {
    if (Tus.yeniBasildi('KeyP', 'Escape')) { duraklat(); return; }
    if (Tus.yeniBasildi('KeyF')) binInDegistir();
    if (Tus.yeniBasildi('KeyE') && Oyun.tamirhanede() && !Oyun.olay) {
      if (Oyun.yildiz > 0) Hud.bildirim('🚓 Polis peşindeyken tamirhane kapalı!');
      else Magaza.ac();
    }
    if (Tus.yeniBasildi('KeyG') && Gorevler.aktif) Gorevler.bitir(false, 0, 'Görevi bıraktın.');
    if (Tus.yeniBasildi('KeyH') && Oyun.aracta()) { Ses.korna(); Oyun.kornaZamani = Oyun.zaman; }
  } else if (d === 'duraklat') {
    if (Tus.yeniBasildi('KeyP', 'Escape', 'Enter')) devam();
  } else if (d === 'magaza') {
    for (let i = 0; i < 5; i++) if (Tus.yeniBasildi('Digit' + (i + 1), 'Numpad' + (i + 1))) Magaza.al(i);
    if (Tus.yeniBasildi('KeyE', 'Escape')) Magaza.kapat();
  }
}

function aracKontrol(o, dt, aktif) {
  const gi = o.girdi;
  if (!aktif) {
    gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.elFreni = false; gi.nitro = false; gi.tutma = true;
    return;
  }
  gi.tutma = false;
  gi.gaz = Tus.bas('KeyW', 'ArrowUp') ? 1 : 0;
  gi.fren = Tus.bas('KeyS', 'ArrowDown') ? 1 : 0;
  gi.dir = (Tus.bas('KeyD', 'ArrowRight') ? 1 : 0) - (Tus.bas('KeyA', 'ArrowLeft') ? 1 : 0);
  gi.elFreni = Tus.bas('Space');
  if (Tus.bas('ShiftLeft', 'ShiftRight') && gi.gaz > 0 && o.nitroDepo > 0.01) {
    gi.nitro = true;
    o.nitroDepo = Math.max(0, o.nitroDepo - dt / Oyun.nitroKapasite);
  } else {
    gi.nitro = false;
    o.nitroDepo = Math.min(1, o.nitroDepo + dt * 0.06);
  }
}

function guncelle(dt) {
  const O = Oyun, oyunda = O.durum === 'oyun';
  O.zaman += dt;
  O.gunZamani = (O.gunZamani + dt / GUN_SURESI) % 1;
  Hava.guncelle(dt, oyunda);

  const ben = O.oyuncu, yuruyor = ben instanceof Yaya, aktif = oyunda && !O.olay;
  if (yuruyor) { if (aktif) yayaKontrol(ben, dt); else { ben.vx = ben.vy = 0; } }
  else { aracKontrol(ben, dt, aktif); O.yayaCan = Math.min(100, O.yayaCan + dt * 2); }

  for (const a of O.arabalar) {
    if (a.tur === 'sivil') sivilYZ(a, dt, O);
    else if (a.tur === 'polis') polisYZ(a, dt, O);
    else if (a.tur === 'park') { const gi = a.girdi; gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.tutma = true; gi.nitro = false; gi.elFreni = false; }
  }
  for (const y of O.yayalar) yayaYZ(y, dt, O);
  for (const a of O.arabalar) { a.fizik(dt); binaCarpisma(a); }
  arabaCarpismalari();
  yayaCarpismalari();
  esyaCarpismalari();
  esyaGuncelle(dt);
  yanginGuncelle(dt);

  for (const a of O.arabalar) {
    izBirak(a);
    if (!O.gorusteMi(a.x, a.y)) continue;
    const c = Math.cos(a.aci), s = Math.sin(a.aci);
    if (a.yikik) { if (Math.random() < dt * 6) Efekt.duman(a.x, a.y, true); }
    else if (a.can < 35 && Math.random() < dt * 10) Efekt.duman(a.x + c * a.uzun * 0.35, a.y + s * a.uzun * 0.35, a.can < 20);
    if (a.girdi.nitro) { Efekt.nitro(a); Efekt.nitro(a); }
    if (a.kayma > 220 && Math.random() < dt * 20) Efekt.duman(a.x - c * a.uzun * 0.4, a.y - s * a.uzun * 0.4, false);
    if (Hava.guc > 0.15 && a.hiz > 150) birikintiSicrat(a);
  }
  Efekt.guncelle(dt);
  for (let i = O.anlikIsiklar.length - 1; i >= 0; i--) {
    const l = O.anlikIsiklar[i];
    l.yas += dt;
    if (l.yas > l.omur) O.anlikIsiklar.splice(i, 1);
  }

  if (oyunda) {
    isiGuncelle(dt);
    yakalanmaKontrol(dt);
    Gorevler.guncelle(dt);
    olayGuncelle(dt);
    O.kayitSayac += dt;
    if (O.kayitSayac > 10) { O.kayitSayac = 0; O.kaydet(); }
  }
  polisYonet(dt);
  sivilYonet(dt);
  istasyonKontrol(dt);
  temizle();
  kameraGuncelle(dt);

  if (oyunda) {
    const o = O.oyuncu, aracta = o instanceof Araba;
    let enYakin = aracta && o.siren ? 300 : Infinity;
    for (const p of O.arabalar) if (p.siren && p !== o) enYakin = Math.min(enYakin, mesafe(p.x, p.y, o.x, o.y));
    Ses.guncelle(aracta ? o.hiz : 0, aracta ? o.girdi.gaz : 0, sinirla(1 - enYakin / 1100, 0, 1), O.zaman, aracta);
  }
}

// ── Çarpışmalar ──
function binaCarpisma(a) {
  const r = a.r, T = TILE;
  const tx0 = Math.floor((a.x - r) / T), tx1 = Math.floor((a.x + r) / T);
  const ty0 = Math.floor((a.y - r) / T), ty1 = Math.floor((a.y + r) / T);
  const bakilan = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= HN || ty >= HN) continue;
      const id = Harita.katiIndeks[ty * HN + tx];
      if (id < 0 || bakilan.includes(id)) continue;
      bakilan.push(id);
      daireKutuCarpisma(a, Harita.katilar[id]);
    }
  }
  for (const t of Harita.agaclar) {
    const dx = a.x - t.x, dy = a.y - t.y;
    if (dx > 40 || dx < -40 || dy > 40 || dy < -40) continue;
    const d = Math.hypot(dx, dy), min = a.r + 7;
    if (d < min && d > 0.01) {
      const nx = dx / d, ny = dy / d;
      a.x = t.x + nx * min; a.y = t.y + ny * min;
      carpismaTepki(a, nx, ny, t.x + nx * 7, t.y + ny * 7);
    }
  }
  const B = Harita.boyut;
  if (a.x < r) { a.x = r; if (a.vx < 0) a.vx *= -0.4; }
  if (a.x > B - r) { a.x = B - r; if (a.vx > 0) a.vx *= -0.4; }
  if (a.y < r) { a.y = r; if (a.vy < 0) a.vy *= -0.4; }
  if (a.y > B - r) { a.y = B - r; if (a.vy > 0) a.vy *= -0.4; }
}

function daireKutuCarpisma(a, k) {
  const cx = sinirla(a.x, k.x, k.x + k.w), cy = sinirla(a.y, k.y, k.y + k.h);
  const dx = a.x - cx, dy = a.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= a.r * a.r) return;
  let nx, ny;
  if (d2 < 0.0001) {
    const sol = a.x - k.x, sag = k.x + k.w - a.x, ust = a.y - k.y, alt = k.y + k.h - a.y;
    const m = Math.min(sol, sag, ust, alt);
    if (m === sol) { nx = -1; ny = 0; a.x = k.x - a.r; }
    else if (m === sag) { nx = 1; ny = 0; a.x = k.x + k.w + a.r; }
    else if (m === ust) { nx = 0; ny = -1; a.y = k.y - a.r; }
    else { nx = 0; ny = 1; a.y = k.y + k.h + a.r; }
  } else {
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d;
    a.x = cx + nx * a.r; a.y = cy + ny * a.r;
  }
  carpismaTepki(a, nx, ny, cx, cy);
}

function carpismaTepki(a, nx, ny, x, y) {
  const vn = a.vx * nx + a.vy * ny;
  if (vn >= 0) return;
  a.vx -= 1.35 * vn * nx; a.vy -= 1.35 * vn * ny;
  a.vx *= 0.85; a.vy *= 0.85;
  a.donusHizi += (Math.random() - 0.5) * Math.min(3, -vn / 120);
  darbe(a, -vn, x, y);
}

function arabaCarpismalari() {
  const A = Oyun.arabalar;
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    for (let j = i + 1; j < A.length; j++) {
      const b = A[j];
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      if (dx > min || dx < -min || dy > min || dy < -min) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 0.0001) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, girme = min - d;
      const ma = a.kutle, mb = b.kutle, top = ma + mb;
      a.x -= nx * girme * mb / top; a.y -= ny * girme * mb / top;
      b.x += nx * girme * ma / top; b.y += ny * girme * ma / top;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      const yaklasA = a.vx * nx + a.vy * ny, yaklasB = -(b.vx * nx + b.vy * ny); // kim kime daldı?
      const itki = -(1 + 0.3) * vn / (1 / ma + 1 / mb);
      a.vx -= itki * nx / ma; a.vy -= itki * ny / ma;
      b.vx += itki * nx / mb; b.vy += itki * ny / mb;
      const guc = -vn;
      a.donusHizi += (Math.random() - 0.5) * Math.min(4, guc / 100);
      b.donusHizi += (Math.random() - 0.5) * Math.min(4, guc / 100);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      darbe(a, guc, cx, cy);
      darbe(b, guc, cx, cy);
      if (guc > 80) {
        if (a.tur === 'sivil') a.sersem = Math.max(a.sersem, 0.8);
        if (b.tur === 'sivil') b.sersem = Math.max(b.sersem, 0.8);
      }
      oyuncuCarpismaOlayi(a, b, guc, yaklasA, yaklasB);
    }
  }
}

function oyuncuCarpismaOlayi(a, b, guc, yaklasA, yaklasB) {
  const O = Oyun, o = O.oyuncu;
  if (O.durum !== 'oyun' || guc < 90) return;
  const diger = a === o ? b : b === o ? a : null;
  if (!diger) return;
  if ((a === o ? yaklasA : yaklasB) < 70) return; // sana çarptılarsa suç senin değil
  diger.sonOyuncuDarbe = O.zaman;
  if (diger.tur === 'polis') { O.isiEkle(28); O.kaosEkle(8, o.x, o.y); }
  else if (diger.tur === 'sivil') { O.isiEkle(6); O.kaosEkle(5, o.x, o.y); }
  else { O.isiEkle(3); O.kaosEkle(3, o.x, o.y); }
}

// Arabalar ve yayalar
function yayaCarpismalari() {
  const O = Oyun, ben = O.oyuncu;
  const liste = ben instanceof Yaya ? O.yayalar.concat(ben) : O.yayalar;
  for (const a of O.arabalar) {
    const h = a.hiz;
    for (const y of liste) {
      const dx = y.x - a.x, dy = y.y - a.y, min = a.r + y.r - 2;
      if (dx > min || dx < -min || dy > min || dy < -min) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      y.x = a.x + nx * min; y.y = a.y + ny * min; // yayayı kenara it
      if (h < 70 || y.durum === 'yerde') continue;
      yayaCarpildi(y, a, nx, ny);
    }
  }
}

function yayaCarpildi(y, a, nx, ny) {
  const O = Oyun, ben = O.oyuncu, guc = a.hiz;
  y.dusur(a.vx * 0.6 + nx * 120, a.vy * 0.6 + ny * 120, y === ben ? 1.6 : aralik(2.5, 4));
  a.vx *= 0.95; a.vy *= 0.95;
  if (O.gorusteMi(y.x, y.y)) Efekt.yazi(y.x, y.y - 16, '💫', '#ffffff');
  const uz = mesafe(y.x, y.y, ben.x, ben.y);
  if (uz < 600) Ses.tok(1 - uz / 600);
  if (y === ben) {
    y.can -= (guc - 60) * 0.12;
    O.kamera.sarsinti = Math.max(O.kamera.sarsinti, 8);
    if (y.can <= 0) oyuncuBayildi();
    return;
  }
  if (a === ben && O.durum === 'oyun') { O.kaosEkle(5, ben.x, ben.y); O.isiEkle(12); }
}

function darbe(a, guc, x, y) {
  if (guc < 60) return;
  const O = Oyun, o = O.oyuncu;
  let hasar = (guc - 60) * 0.068;
  if (a === o) {
    hasar *= (1 - 0.15 * O.kayit.zirh) * a.zirhCarpani;
    O.kamera.sarsinti = Math.max(O.kamera.sarsinti, Math.min(14, guc / 35));
    Gorevler.oyuncuCarpti(guc);
  }
  if (a.tur === 'park') hasar *= 1.3;
  a.can -= hasar;
  Efekt.kivilcim(x, y, Math.min(14, 2 + Math.floor(guc / 40)));
  const uz = mesafe(x, y, o.x, o.y);
  if (uz < 700 && a.sesBekle <= O.zaman) { Ses.carpma(Math.min(1, guc / 400) * (1 - uz / 700)); a.sesBekle = O.zaman + 0.15; }
  if (a.can <= 0 && !a.yikik) arabaYikildi(a);
}

function arabaYikildi(a) {
  const O = Oyun, o = O.oyuncu;
  a.yikik = true; a.can = 0; a.yikilmaZamani = O.zaman; a.siren = false;
  a.vx *= 0.3; a.vy *= 0.3;
  Efekt.patlama(a.x, a.y);
  O.anlikIsiklar.push({ x: a.x, y: a.y, r: 280, omur: 0.7, yas: 0 });
  const uz = mesafe(a.x, a.y, o.x, o.y);
  if (uz < 900) {
    Ses.patlama(1 - uz / 900);
    if (O.durum === 'oyun') O.kamera.sarsinti = Math.max(O.kamera.sarsinti, 16 * (1 - uz / 900));
  }
  for (const b of O.arabalar) {
    if (b === a) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 130 && d > 1) {
      const k = 1 - d / 130;
      b.vx += dx / d * 320 * k; b.vy += dy / d * 320 * k;
      b.donusHizi += aralik(-4, 4) * k;
      darbe(b, 220 * k, b.x, b.y);
    }
  }
  const yayalar = o instanceof Yaya ? O.yayalar.concat(o) : O.yayalar;
  for (const y of yayalar) {
    const dx = y.x - a.x, dy = y.y - a.y, d = Math.hypot(dx, dy) || 1;
    if (d < 120 && y.durum !== 'yerde') {
      y.dusur(dx / d * 260, dy / d * 260, 2.5);
      if (y === o) { y.can -= 35 * (1 - d / 120); if (y.can <= 0) oyuncuBayildi(); }
    }
  }
  for (const p of Harita.esyalar) {
    if (p.kirik) continue;
    const dx = p.x - a.x, dy = p.y - a.y;
    if (dx > 110 || dx < -110 || dy > 110 || dy < -110) continue;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) {
      p.kirik = true; p.kirikZaman = O.zaman;
      p.vx = dx / d * 260; p.vy = dy / d * 260; p.don = aralik(-15, 15);
      if (p.tur === 'hidrant') p.su = 8;
    }
  }
  if (a === o) { oyuncuPert(); return; }
  if (O.durum === 'oyun' && O.zaman - a.sonOyuncuDarbe < 4) {
    if (a.tur === 'polis') { O.isiEkle(60); O.kaosEkle(25, o.x, o.y); }
    else { O.isiEkle(20); O.kaosEkle(15, o.x, o.y); }
    Hud.bildirim(a.tur === 'polis' ? '💥 Polis arabası havaya uçtu!' : '💥 Bir araba havaya uçtu!');
  }
}

// ── Kaldırım eşyaları ──
function esyaCarpismalari() {
  const T = TILE, I = Harita.esyaIzgara;
  for (const a of Oyun.arabalar) {
    if (a.hiz < 25) continue;
    const tx0 = Math.max(0, Math.floor((a.x - 30) / T)), tx1 = Math.min(HN - 1, Math.floor((a.x + 30) / T));
    const ty0 = Math.max(0, Math.floor((a.y - 30) / T)), ty1 = Math.min(HN - 1, Math.floor((a.y + 30) / T));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const liste = I[ty * HN + tx];
        if (!liste) continue;
        for (const p of liste) {
          if (p.kirik) continue;
          const dx = p.x - a.x, dy = p.y - a.y, min = a.r + p.r;
          if (dx > min || dx < -min || dy > min || dy < -min || dx * dx + dy * dy > min * min) continue;
          esyaKir(p, a);
        }
      }
    }
  }
}

function esyaKir(p, a) {
  const O = Oyun, o = O.oyuncu;
  p.kirik = true; p.kirikZaman = O.zaman;
  p.vx = a.vx * 0.9 + aralik(-60, 60); p.vy = a.vy * 0.9 + aralik(-60, 60); p.don = aralik(-10, 10);
  a.vx *= 0.92; a.vy *= 0.92;
  Efekt.kivilcim(p.x, p.y, 5);
  if (p.tur === 'hidrant') p.su = 8;
  const uz = mesafe(p.x, p.y, o.x, o.y);
  if (uz < 600) Ses.carpma(0.2 * (1 - uz / 600) + 0.05);
  if (a === o) { O.kaosEkle(p.kaos, o.x, o.y); O.isiEkle(p.kaos * 0.8); }
}

function esyaGuncelle(dt) {
  const O = Oyun;
  for (const p of Harita.esyalar) {
    if (!p.kirik) continue;
    if (p.vx || p.vy) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = Math.max(0, 1 - 3 * dt);
      p.vx *= k; p.vy *= k; p.aci += p.don * dt; p.don *= k;
      if (Math.abs(p.vx) + Math.abs(p.vy) < 2) { p.vx = 0; p.vy = 0; }
    }
    if (p.su > 0) {
      p.su -= dt;
      if (O.gorusteMi(p.ox, p.oy)) for (let i = 0; i < 3; i++) Efekt.su(p.ox, p.oy);
    }
    if (O.zaman - p.kirikZaman > 90 && !O.gorusteMi(p.ox, p.oy, 100) && !O.gorusteMi(p.x, p.y, 100)) {
      p.kirik = false; p.x = p.ox; p.y = p.oy; p.aci = p.oAci; p.vx = p.vy = p.don = 0; p.su = 0;
    }
  }
}

// Yanan binalardan alev ve duman
function yanginGuncelle(dt) {
  for (const b of Gorevler.yananlar()) {
    if (!Oyun.gorusteMi(b.x + b.w / 2, b.y + b.h / 2, 250)) continue;
    const n = dt * 75 * b.yangin;
    for (let i = 0; i < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i++)
      Efekt.alev(b.x + b.ox + Math.random() * b.w, b.y + b.oy + Math.random() * b.h);
    if (Math.random() < dt * 8) Efekt.duman(b.x + b.ox + Math.random() * b.w, b.y + b.oy + Math.random() * b.h, true, true);
  }
}

// Hızla su birikintisinden geçince su sıçrar
function birikintiSicrat(a) {
  for (const b of Harita.birikintiler) {
    const dx = a.x - b.x, dy = a.y - b.y;
    if (dx > b.rx || dx < -b.rx || dy > b.rx || dy < -b.rx) continue;
    for (let i = 0; i < 3; i++) Efekt.su(a.x, a.y);
    return;
  }
}

function izBirak(a) {
  const iz = !a.yikik && (a.kayma > 120 || (a.girdi.elFreni && a.hiz > 90) || (a.girdi.fren > 0 && a.ileriHiz() > 250));
  if (!iz) { a.sonIz = null; return; }
  const c = Math.cos(a.aci), s = Math.sin(a.aci), arka = a.uzun / 2 - 7, yan = a.gen / 2 - 3;
  const bx = a.x - c * arka, by = a.y - s * arka;
  const p1x = bx - s * yan, p1y = by + c * yan, p2x = bx + s * yan, p2y = by - c * yan;
  if (a.sonIz) Harita.izCiz(a.sonIz[0], a.sonIz[1], p1x, p1y, a.sonIz[2], a.sonIz[3], p2x, p2y);
  a.sonIz = [p1x, p1y, p2x, p2y];
}

// ── Aranma (yıldız) sistemi ──
function isiGuncelle(dt) {
  const O = Oyun, o = O.oyuncu;
  O.gorusSayac -= dt;
  if (O.gorusSayac <= 0) {
    O.gorusSayac = 0.25;
    O.polisGoruyor = O.arabalar.some(p => p.tur === 'polis' && !p.yikik &&
      mesafe(p.x, p.y, o.x, o.y) < 650 && Harita.gorusVar(p.x, p.y, o.x, o.y));
  }
  if (O.yildiz > 0) {
    if (O.polisGoruyor) O.gizliSure = 0; else O.gizliSure += dt;
    if (O.gizliSure > 4) O.isi -= 16 * dt;
  } else {
    O.gizliSure = 0;
    O.isi -= 4 * dt;
  }
  O.isi = sinirla(O.isi, 0, 420);
  let y = 0;
  for (let i = 1; i <= 5; i++) if (O.isi >= YILDIZ_ESIK[i]) y = i;
  if (y > O.yildiz) {
    Hud.bildirim(y === 1 ? '🚓 Polis seni fark etti!' : `🚨 Aranma seviyesi: ${'★'.repeat(y)}`);
    O.kayit.enYildiz = Math.max(O.kayit.enYildiz, y);
  } else if (y === 0 && O.yildiz > 0) {
    Hud.bildirim('😎 Polisi ektin!');
    Ses.ton(660, 0.12, 'triangle', 0.1); Ses.ton(880, 0.15, 'triangle', 0.1, 0.1);
  }
  O.yildiz = y;
}

function polisYonet(dt) {
  const O = Oyun, o = O.oyuncu;
  const polisler = O.arabalar.filter(a => a.tur === 'polis' && !a.yikik);
  const istenen = O.yildiz === 0 ? DEVRIYE_SAYISI : Math.min(9, DEVRIYE_SAYISI + Math.round(O.yildiz * 1.3));
  O.polisSayac -= dt;
  if (polisler.length < istenen && O.polisSayac <= 0) {
    O.polisSayac = O.yildiz > 0 ? Math.max(0.6, 2 - O.yildiz * 0.3) : 8;
    const s = uzakSerit(650, 1300, true);
    if (s) {
      const p = polisOlustur(s.x, s.y, s.aci);
      p.yon = s.yon; p.kavsak = { i: s.i, j: s.j }; p.hedef = Harita.seritNoktasi(s.i, s.j, s.yon);
      p.vx = Math.cos(s.aci) * 150; p.vy = Math.sin(s.aci) * 150;
    }
  }
  if (O.yildiz === 0 && polisler.length > DEVRIYE_SAYISI) {
    let en = null, enD = 0;
    for (const p of polisler) {
      const d = mesafe(p.x, p.y, o.x, o.y);
      if (d > enD && d > 1000 && !O.gorusteMi(p.x, p.y, 100)) { en = p; enD = d; }
    }
    if (en) en.sil = true;
  }
}

function sivilYonet(dt) {
  Oyun.sivilSayac -= dt;
  if (Oyun.sivilSayac > 0) return;
  Oyun.sivilSayac = 0.4;
  let n = 0;
  for (const a of Oyun.arabalar) if (a.tur === 'sivil' && !a.yikik) n++;
  if (n < SIVIL_SAYISI) sivilEkle(true);
}

function temizle() {
  const O = Oyun;
  O.arabalar = O.arabalar.filter(a => a === O.oyuncu || !(a.sil ||
    (a.yikik && O.zaman - a.yikilmaZamani > 12 && !O.gorusteMi(a.x, a.y, 100))));
  // çalınan arabaların sürücüleri kalabalığı şişirmesin
  if (O.yayalar.length > YAYA_SAYISI + 15) {
    const i = O.yayalar.findIndex(y => !O.gorusteMi(y.x, y.y, 200));
    if (i >= 0) O.yayalar.splice(i, 1);
  }
}

function yakalanmaKontrol(dt) {
  const O = Oyun, o = O.oyuncu;
  let yakin = false;
  if (O.yildiz > 0 && !O.olay && o.hiz < 50)
    yakin = O.arabalar.some(p => p.tur === 'polis' && !p.yikik && mesafe(p.x, p.y, o.x, o.y) < 85);
  O.yakalanma = yakin ? O.yakalanma + dt : Math.max(0, O.yakalanma - dt * 2);
  if (O.yakalanma > 2.3) oyuncuYakalandi();
}

function oyuncuYakalandi() {
  const O = Oyun;
  O.yakalanma = 0;
  const ceza = Math.min(O.kayit.para, Math.max(100, Math.round(O.kayit.para * 0.15)));
  O.olay = { tur: 'yakalandi', sure: 2.6, ceza };
  O.kayit.yakalanma++;
  Gorevler.iptal();
  Hud.duyuru('YAKALANDIN! 🚔', `Ceza: ${paraYaz(ceza)}`, '#4cc9f0');
  Ses.basarisiz();
}

function oyuncuPert() {
  const O = Oyun;
  if (O.durum !== 'oyun' || O.olay) return;
  const ceza = Math.min(O.kayit.para, 250);
  O.olay = { tur: 'pert', sure: 3, ceza };
  O.kayit.pert++;
  Gorevler.iptal();
  Hud.duyuru('PERT! 💥', `Araban çekiciyle tamirhaneye... -${paraYaz(ceza)}`, '#ef476f');
}

function oyuncuBayildi() {
  const O = Oyun;
  if (O.durum !== 'oyun' || O.olay) return;
  const ceza = Math.min(O.kayit.para, 150);
  O.olay = { tur: 'bayildi', sure: 3, ceza };
  O.kayit.bayilma++;
  Gorevler.iptal();
  Hud.duyuru('BAYILDIN! 😵', `Hastaneye kaldırılıyorsun... -${paraYaz(ceza)}`, '#ef476f');
  Ses.basarisiz();
}

function olayGuncelle(dt) {
  const O = Oyun;
  if (!O.olay) return;
  O.olay.sure -= dt;
  if (O.olay.sure > 0) return;
  const e = O.olay;
  O.olay = null;
  O.paraEkle(-e.ceza);
  let o = O.oyuncu;
  if (e.tur === 'pert') {
    // yanan araba geride kalır, tamirhanede yeni spor araba seni bekler
    if (o instanceof Araba) o.tur = 'park';
    o = O.oyuncu = oyuncuArabasiOlustur(enYakinTamirhane(o.x, o.y));
    O.oyuncuOzellik();
  } else if (e.tur === 'bayildi') {
    const h = Harita.hastane;
    o = O.oyuncu = new Yaya(h.x, h.y, { oyuncu: true, gomlek: '#ffd60a' });
    O.yayaCan = 100;
  } else {
    const k = Harita.karakol;
    o.x = k.x; o.y = k.y;
  }
  o.vx = o.vy = 0; o.aci = Math.PI / 2;
  if (o instanceof Araba) { o.donusHizi = 0; o.sonIz = null; o.nitroDepo = 1; }
  else { o.durum = 'yuru'; }
  O.isi = 0; O.yildiz = 0; O.gizliSure = 0;
  for (const a of O.arabalar) if (a !== o && mesafe(a.x, a.y, o.x, o.y) < 90 && a.tur !== 'park') a.sil = true;
  O.kamera.x = o.x; O.kamera.y = o.y;
  O.kaydet();
}

// ── Kamera ──
function kameraGuncelle(dt) {
  const O = Oyun, k = O.kamera;
  if (O.durum === 'giris' && (!O.izlenen || O.izlenen.yikik || !O.arabalar.includes(O.izlenen) || O.zaman > O.izlemeBitis)) {
    O.izlenen = sec(O.arabalar.filter(a => a.tur === 'sivil' && !a.yikik)) || O.oyuncu;
    O.izlemeBitis = O.zaman + 14;
    k.x = O.izlenen.x; k.y = O.izlenen.y;
  }
  const h = O.durum === 'giris' ? O.izlenen : O.oyuncu;
  const yuruyor = h instanceof Yaya;
  const on = yuruyor ? 0.2 : 0.35;
  const hx = h.x + h.vx * on, hy = h.y + h.vy * on, yum = 1 - Math.exp(-5 * dt);
  k.x += (hx - k.x) * yum;
  k.y += (hy - k.y) * yum;
  const temel = sinirla(Math.min(innerWidth, innerHeight) / 800, 0.6, 1.3);
  const hedefZoom = yuruyor ? temel * 1.35 : temel * (1 - 0.22 * Math.min(1, h.hiz / 650)) * (O.durum === 'giris' ? 1.15 : 1);
  k.zoom += (hedefZoom - k.zoom) * Math.min(1, 2 * dt);
  k.sarsinti *= Math.exp(-7 * dt);
  if (k.sarsinti < 0.05) k.sarsinti = 0;
}

// ── Çizim ──
function ciz() {
  const W = tuval.width, H = tuval.height, k = Oyun.kamera, s = k.zoom * Oyun.dpr;
  if (!W || !H) return; // pencere küçültülmüş / görünmüyor
  const kx = k.x + (Math.random() - 0.5) * k.sarsinti, ky = k.y + (Math.random() - 0.5) * k.sarsinti;
  const dunya = () => g.setTransform(s, 0, 0, s, W / 2 - kx * s, H / 2 - ky * s);

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#1b1f26';
  g.fillRect(0, 0, W, H);
  dunya();
  const gw = W / s, gh = H / s;
  Oyun.gorus = { x0: kx - gw / 2, y0: ky - gh / 2, x1: kx + gw / 2, y1: ky + gh / 2 };

  Harita.zeminiCiz(g, Oyun.gorus);
  Hava.birikintiCiz(g);
  gorevIsaretleriCiz(g);
  esyalariCiz(g);
  const z = Oyun.zaman, yagmur = Hava.guc;
  for (const y of Oyun.yayalar) if (Oyun.gorusteMi(y.x, y.y, 30)) y.ciz(g, z, yagmur);
  const hasta = Gorevler.aktif && Gorevler.aktif.hastaYaya;
  if (hasta && Oyun.gorusteMi(hasta.x, hasta.y, 30)) hasta.ciz(g, z, 0);
  for (const a of Oyun.arabalar) if (Oyun.gorusteMi(a.x, a.y, 60)) a.ciz(g, z);
  if (Oyun.oyuncu instanceof Yaya) Oyun.oyuncu.ciz(g, z, yagmur);
  Efekt.ciz(g, false);
  binalariCiz(g, kx, ky);
  agaclariCiz(g, kx, ky);
  Efekt.ciz(g, true);
  isiklandirma(W, H, s, kx, ky);
  g.setTransform(1, 0, 0, 1, 0, 0);
  Hava.ekranCiz(g, W, H, Oyun.dpr, sonDt);

  dunya();
  okCiz(g);
  Efekt.yaziCiz(g);
  g.setTransform(1, 0, 0, 1, 0, 0);

  if (Oyun.durum !== 'giris') Hud.guncelle();
}

function gorevIsaretleriCiz(c) {
  const z = Oyun.zaman;
  if (!Gorevler.aktif) {
    for (const n of Gorevler.noktalar) {
      if (!Oyun.gorusteMi(n.x, n.y, 60)) continue;
      const t = GOREV_TURLERI[n.tur];
      isaret(c, n.x, n.y, 26 + Math.sin(z * 4) * 3, t.renk, t.ikon, t.ad);
    }
    // istasyondaki görev araçları
    for (const tur of ['ambulans', 'itfaiye']) {
      const a = Oyun.istasyon[tur];
      if (!a || a === Oyun.oyuncu || a.yikik || !Oyun.gorusteMi(a.x, a.y, 60)) continue;
      const t = GOREV_TURLERI[tur];
      isaret(c, a.x, a.y, a.uzun / 2 + 10 + Math.sin(z * 4) * 3, t.renk, '', t.ad + ' görevi');
    }
    return;
  }
  const gv = Gorevler.aktif;
  if (gv.tur === 'yaris') {
    for (let i = gv.sira + 1; i < gv.noktalar.length; i++) {
      const p = gv.noktalar[i];
      if (!Oyun.gorusteMi(p.x, p.y, 60)) continue;
      c.globalAlpha = 0.35;
      isaret(c, p.x, p.y, 30, GOREV_TURLERI.yaris.renk, String(i + 1), null);
      c.globalAlpha = 1;
    }
  }
  const h = Gorevler.hedef();
  if (h && Oyun.gorusteMi(h.x, h.y, 80)) isaret(c, h.x, h.y, 38 + Math.sin(z * 5) * 4, h.renk, h.ikon, h.etiket);
}

function isaret(c, x, y, r, renk, ikon, etiket) {
  const a = c.globalAlpha;
  c.fillStyle = renk;
  c.globalAlpha = a * 0.22;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.globalAlpha = a;
  c.strokeStyle = renk; c.lineWidth = 4;
  c.setLineDash([10, 7]); c.lineDashOffset = -Oyun.zaman * 20;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.setLineDash([]);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (ikon) { c.font = '800 22px Rubik, sans-serif'; c.fillStyle = '#fff'; c.fillText(ikon, x, y + 1); }
  if (etiket) {
    c.font = '800 13px Rubik, sans-serif'; c.lineWidth = 4; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(etiket, x, y + r + 14);
    c.fillStyle = '#fff'; c.fillText(etiket, x, y + r + 14);
  }
}

function okCiz(c) {
  const h = Gorevler.hedef();
  if (!h || Oyun.durum !== 'oyun') return;
  const o = Oyun.oyuncu;
  if (mesafe(o.x, o.y, h.x, h.y) < 110) return;
  const a = Math.atan2(h.y - o.y, h.x - o.x);
  c.save();
  c.translate(o.x + Math.cos(a) * 52, o.y + Math.sin(a) * 52);
  c.rotate(a);
  c.fillStyle = h.renk; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2.5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-3, 0); c.lineTo(-8, 10); c.closePath();
  c.stroke(); c.fill();
  c.restore();
}

function daire(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

function esyalariCiz(c) {
  for (const p of Harita.esyalar) {
    if (!Oyun.gorusteMi(p.x, p.y, 40)) continue;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.aci);
    const golge = 'rgba(0,0,0,0.28)';
    switch (p.tur) {
      case 'koni':
        c.fillStyle = golge; daire(c, 2, 3, 6);
        c.fillStyle = '#ff7b00'; daire(c, 0, 0, 6);
        c.fillStyle = '#fff'; daire(c, 0, 0, 3.4);
        c.fillStyle = '#ff7b00'; daire(c, 0, 0, 1.8);
        break;
      case 'cop':
        c.fillStyle = golge; c.fillRect(-5, -5, 14, 14);
        c.fillStyle = '#2d6a4f'; yuvarlakKutu(c, -7, -7, 14, 14, 3); c.fill();
        c.fillStyle = '#52b788'; yuvarlakKutu(c, -5, -5, 10, 10, 2); c.fill();
        break;
      case 'hidrant':
        c.fillStyle = golge; daire(c, 2, 3, 6);
        c.fillStyle = '#d62828'; daire(c, 0, 0, 6);
        c.fillStyle = '#f77f00'; c.fillRect(-8, -2, 16, 4);
        c.fillStyle = '#9d0208'; daire(c, 0, 0, 3);
        break;
      case 'bank':
        c.fillStyle = golge; c.fillRect(-9, -2, 22, 8);
        c.fillStyle = '#7f5539'; c.fillRect(-11, -4, 22, 8);
        c.fillStyle = '#b08968'; c.fillRect(-11, -4, 22, 2); c.fillRect(-11, 0, 22, 2);
        break;
      case 'direk':
        if (p.kirik) {
          c.strokeStyle = '#495057'; c.lineWidth = 4; c.lineCap = 'round';
          c.beginPath(); c.moveTo(0, 0); c.lineTo(34, 0); c.stroke();
          c.fillStyle = '#ffe8a3'; daire(c, 36, 0, 4);
        } else {
          c.fillStyle = golge; daire(c, 3, 4, 5);
          c.fillStyle = '#495057'; daire(c, 0, 0, 4.5);
          c.fillStyle = '#ffe8a3'; daire(c, 0, 0, 2.2);
        }
        break;
    }
    c.restore();
  }
}

function binalariCiz(c, kx, ky) {
  const v = Oyun.gorus;
  Oyun.cizilenBinalar.length = 0;
  for (const b of Harita.binalar) {
    if (b.x > v.x1 + 120 || b.x + b.w < v.x0 - 120 || b.y > v.y1 + 120 || b.y + b.h < v.y0 - 120) continue;
    const k = b.kat * 0.0042;
    const ox = (b.x + b.w / 2 - kx) * k, oy = (b.y + b.h / 2 - ky) * k;
    b.ox = ox; b.oy = oy;
    Oyun.cizilenBinalar.push(b);
    const x = b.x, y = b.y, w = b.w, h = b.h, rx = x + ox, ry = y + oy;
    if (ox > 0) dortgen(c, x, y, x, y + h, rx, ry + h, rx, ry, b.duvar1);
    else if (ox < 0) dortgen(c, x + w, y, x + w, y + h, rx + w, ry + h, rx + w, ry, b.duvar1);
    if (oy > 0) dortgen(c, x, y, x + w, y, rx + w, ry, rx, ry, b.duvar2);
    else if (oy < 0) dortgen(c, x, y + h, x + w, y + h, rx + w, ry + h, rx, ry + h, b.duvar2);
    katCizgileri(c, b, 'rgba(0,0,0,0.13)', null);

    c.fillStyle = b.renk; c.fillRect(rx, ry, w, h);
    if (b.yangin > 0) { c.fillStyle = `rgba(40,20,10,${0.45 * b.yangin})`; c.fillRect(rx, ry, w, h); }
    c.strokeStyle = b.kenar; c.lineWidth = 3; c.strokeRect(rx + 1.5, ry + 1.5, w - 3, h - 3);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(rx + 3, ry + 3, w - 6, 5);
    for (const q of b.kutular) {
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(rx + q.x + 3, ry + q.y + 3, q.w, q.h);
      c.fillStyle = b.parlak; c.fillRect(rx + q.x, ry + q.y, q.w, q.h);
      c.strokeStyle = b.kenar; c.lineWidth = 1; c.strokeRect(rx + q.x + 0.5, ry + q.y + 0.5, q.w - 1, q.h - 1);
    }
    if (b.etiket) {
      c.font = '800 20px Rubik, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillText(b.etiket, rx + w / 2 + 2, ry + h / 2 + 2);
      c.fillStyle = b.etiketRenk; c.fillText(b.etiket, rx + w / 2, ry + h / 2);
    }
  }
}

function dortgen(c, x1, y1, x2, y2, x3, y3, x4, y4, renk) {
  c.fillStyle = renk;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.closePath();
  c.fill();
}

function katCizgileri(c, b, renk, desen) {
  if (!b.ox && !b.oy) return;
  const adim = Math.max(1, Math.ceil(b.kat / 8));
  c.strokeStyle = renk; c.lineWidth = 1.5;
  if (desen) c.setLineDash(desen);
  c.beginPath();
  for (let f = adim; f < b.kat; f += adim) {
    const t = f / b.kat, dx = b.ox * t, dy = b.oy * t;
    if (b.ox > 0) { c.moveTo(b.x + dx, b.y + dy); c.lineTo(b.x + dx, b.y + b.h + dy); }
    else if (b.ox < 0) { c.moveTo(b.x + b.w + dx, b.y + dy); c.lineTo(b.x + b.w + dx, b.y + b.h + dy); }
    if (b.oy > 0) { c.moveTo(b.x + dx, b.y + dy); c.lineTo(b.x + b.w + dx, b.y + dy); }
    else if (b.oy < 0) { c.moveTo(b.x + dx, b.y + b.h + dy); c.lineTo(b.x + b.w + dx, b.y + b.h + dy); }
  }
  c.stroke();
  if (desen) c.setLineDash([]);
}

function agaclariCiz(c, kx, ky) {
  for (const t of Harita.agaclar) {
    if (!Oyun.gorusteMi(t.x, t.y, 60)) continue;
    const ox = (t.x - kx) * 0.025, oy = (t.y - ky) * 0.025;
    c.fillStyle = t.renk; daire(c, t.x + ox, t.y + oy, t.r);
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.12)'; daire(c, t.x + ox - t.r * 0.3, t.y + oy - t.r * 0.3, t.r * 0.55);
  }
}

// ── Gece/gündüz, yağmur karanlığı ve ışıklar ──
function isiklandirma(W, H, s, kx, ky) {
  const kk = Math.cos((Oyun.gunZamani - 0.75) * Math.PI * 2); // 1 = gece yarısı, -1 = öğlen
  const karanlik = Math.max(sinirla((kk - 0.3) * 1.6, 0, 1), Hava.guc * 0.45);
  const aksam = Math.max(0, 1 - Math.abs(kk - 0.15) / 0.35) * (1 - Hava.guc);
  Oyun.karanlik = karanlik;
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (aksam > 0) { g.fillStyle = `rgba(255,120,60,${0.12 * aksam})`; g.fillRect(0, 0, W, H); }
  if (karanlik <= 0.01) return;

  ig.globalCompositeOperation = 'source-over';
  ig.setTransform(1, 0, 0, 1, 0, 0);
  ig.clearRect(0, 0, W, H);
  ig.fillStyle = `rgba(5,8,28,${0.82 * karanlik})`;
  ig.fillRect(0, 0, W, H);
  ig.globalCompositeOperation = 'destination-out';
  ig.setTransform(s, 0, 0, s, W / 2 - kx * s, H / 2 - ky * s);
  for (const l of Harita.lambalar) if (!l.kirik && Oyun.gorusteMi(l.x, l.y, 140)) daireIsik(ig, l.x, l.y, 130, 0.85);
  for (const a of Oyun.arabalar) if (!a.yikik && a.tur !== 'park' && Oyun.gorusteMi(a.x, a.y, 220)) farIsigi(ig, a);
  const o = Oyun.oyuncu;
  daireIsik(ig, o.x, o.y, 70, 0.6);
  for (const l of Oyun.anlikIsiklar) daireIsik(ig, l.x, l.y, l.r, 1 - l.yas / l.omur);
  for (const b of Gorevler.yananlar()) daireIsik(ig, b.x + b.w / 2 + b.ox, b.y + b.h / 2 + b.oy, Math.max(b.w, b.h) * 0.9, 0.9 * b.yangin);
  const h = Gorevler.hedef();
  if (h) daireIsik(ig, h.x, h.y, 90, 0.75);
  if (!Gorevler.aktif) for (const n of Gorevler.noktalar) if (Oyun.gorusteMi(n.x, n.y, 100)) daireIsik(ig, n.x, n.y, 75, 0.75);
  ig.globalCompositeOperation = 'source-over';
  g.drawImage(isikTuval, 0, 0);

  g.setTransform(s, 0, 0, s, W / 2 - kx * s, H / 2 - ky * s);
  g.globalCompositeOperation = 'lighter';
  for (const l of Harita.lambalar) if (!l.kirik && Oyun.gorusteMi(l.x, l.y, 80)) renkliIsik(g, l.x, l.y, 46, '255,190,110', 0.22 * karanlik);
  for (const a of Oyun.arabalar) {
    if (a.yikik || !Oyun.gorusteMi(a.x, a.y, 100)) continue;
    const c = Math.cos(a.aci), sn = Math.sin(a.aci);
    if (a.tur !== 'park') renkliIsik(g, a.x - c * a.uzun / 2, a.y - sn * a.uzun / 2, 16, '255,40,40', (a.girdi.fren > 0 ? 0.55 : 0.25) * karanlik);
    if (a.siren) renkliIsik(g, a.x, a.y, 80, Math.floor(Oyun.zaman * 8) % 2 === 0 ? '255,50,50' : (a.polisAraci ? '60,120,255' : '255,255,255'), 0.45 * karanlik);
  }
  for (const b of Gorevler.yananlar()) renkliIsik(g, b.x + b.w / 2 + b.ox, b.y + b.h / 2 + b.oy, Math.max(b.w, b.h) * 0.8, '255,120,40', 0.35 * karanlik * b.yangin);
  for (const b of Oyun.cizilenBinalar) katCizgileri(g, b, `rgba(255,200,120,${0.6 * karanlik * b.isikOran})`, b.pencere);
  g.globalCompositeOperation = 'source-over';
}

function daireIsik(c, x, y, r, guc) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(0,0,0,${guc})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr;
  daire(c, x, y, r);
}

function renkliIsik(c, x, y, r, rgb, a) {
  const gr = c.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = gr;
  daire(c, x, y, r);
}

function farIsigi(c, a) {
  const cs = Math.cos(a.aci), sn = Math.sin(a.aci);
  const fx = a.x + cs * a.uzun / 2, fy = a.y + sn * a.uzun / 2;
  const R = a.tur === 'oyuncu' ? 230 : 170;
  const gr = c.createRadialGradient(fx, fy, 0, fx, fy, R);
  gr.addColorStop(0, 'rgba(0,0,0,0.9)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr;
  c.beginPath(); c.moveTo(fx, fy); c.arc(fx, fy, R, a.aci - 0.45, a.aci + 0.45); c.closePath(); c.fill();
}

(document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve()).then(kur);
