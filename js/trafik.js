'use strict';
// ── Kaos Kent · yapay zekâ: sivil trafik ve polis ──
//
// Siviller kavşaktan kavşağa kendi şeritlerinde gider, kavşakta rastgele yön seçer.
// Polis seni görüyorsa doğrudan üstüne sürer, görmüyorsa kavşak kavşak sana yaklaşır.

// Arabayı en yakın kavşağa giden şeride bağla
function rotayaBagla(a) {
  const k = Harita.enYakinKavsak(a.x, a.y), m = Harita.kavsakMerkez(k.i, k.j);
  const aci = Math.atan2(m.y - a.y, m.x - a.x);
  const d = ((Math.round(aci / (Math.PI / 2)) % 4) + 4) % 4;
  a.kavsak = k; a.yon = d; a.hedef = Harita.seritNoktasi(k.i, k.j, d);
}

// Bir noktaya doğru direksiyon kır, istenen hıza göre gaz/fren ver
function hedefeSur(a, hx, hy, hedefHiz) {
  const gi = a.girdi;
  const fark = aciFarki(a.aci, Math.atan2(hy - a.y, hx - a.x));
  gi.dir = sinirla(fark * 2.2, -1, 1);
  const hiz = hedefHiz * (1 - Math.min(0.65, Math.abs(fark) * 0.6)); // virajda yavaşla
  const vf = a.ileriHiz();
  gi.tutma = false;
  if (hiz < 8) { gi.gaz = 0; gi.fren = vf > 12 ? 0.8 : 0; gi.tutma = true; }
  else if (vf < hiz - 8) { gi.gaz = vf < hiz * 0.6 ? 1 : 0.6; gi.fren = 0; }
  else if (vf > hiz + 30) { gi.gaz = 0; gi.fren = 0.6; }
  else { gi.gaz = 0.3; gi.fren = 0; }
  return fark;
}

// Bir yere sıkıştıysa kısa süre geri vites
function takilmaKontrol(a, dt) {
  const gi = a.girdi;
  if (a.geriSure > 0) {
    a.geriSure -= dt;
    gi.gaz = 0; gi.fren = 1; gi.dir = a.geriYon; gi.tutma = false;
    return true;
  }
  if (gi.gaz > 0.5 && a.hiz < 20) a.takilma += dt;
  else a.takilma = Math.max(0, a.takilma - dt);
  if (a.takilma > 1.2) {
    a.takilma = 0; a.geriSure = 0.9; a.geriYon = Math.random() < 0.5 ? -1 : 1; a.takilmaSayisi++;
    return true;
  }
  return false;
}

// Önümde (aynı şeritte) en yakın araba ne kadar uzakta?
function ondekiEngel(a, arabalar) {
  const c = Math.cos(a.aci), s = Math.sin(a.aci);
  const menzil = 60 + Math.max(0, a.ileriHiz()) * 0.35;
  let enYakin = Infinity;
  for (const b of arabalar) {
    if (b === a) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx > menzil + 20 || dx < -menzil - 20 || dy > menzil + 20 || dy < -menzil - 20) continue;
    const ileri = dx * c + dy * s;
    if (ileri <= 0 || ileri > menzil) continue;
    const yan = -dx * s + dy * c;
    if (Math.abs(yan) > 22) continue;
    if (ileri < enYakin) enYakin = ileri;
  }
  return enYakin;
}

// Hedef kavşağa vardıysa yeni yön seç
function seritIlerle(a) {
  const dx = a.hedef.x - a.x, dy = a.hedef.y - a.y;
  const d = Math.hypot(dx, dy);
  const ileri = dx * Math.cos(a.aci) + dy * Math.sin(a.aci);
  if (d < 36 || (d < 90 && ileri < 0)) {
    const k = a.kavsak, secenek = [];
    for (let y = 0; y < 4; y++) {
      if (y === (a.yon + 2) % 4) continue; // geri dönüş yok
      if (Harita.gecerliKavsak(k.i + YONLER[y].dx, k.j + YONLER[y].dy)) secenek.push(y);
    }
    let yeni = secenek.includes(a.yon) && Math.random() < 0.5 ? a.yon : sec(secenek);
    if (yeni === undefined) yeni = (a.yon + 2) % 4;
    a.yon = yeni;
    a.kavsak = { i: k.i + YONLER[yeni].dx, j: k.j + YONLER[yeni].dy };
    a.hedef = Harita.seritNoktasi(a.kavsak.i, a.kavsak.j, yeni);
    a.takilmaSayisi = 0;
  }
}

function sivilYZ(a, dt, O) {
  const gi = a.girdi;
  gi.nitro = false; gi.elFreni = false;
  if (a.yikik) { gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.tutma = true; return; }
  if (a.sersem > 0) { a.sersem -= dt; gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.tutma = true; return; }
  if (!a.hedef) rotayaBagla(a);
  if (takilmaKontrol(a, dt)) {
    if (a.tur === 'sivil' && a.takilmaSayisi > 4 && !O.gorusteMi(a.x, a.y, 150)) a.sil = true;
    return;
  }
  seritIlerle(a);
  let hedefHiz = a.seyirHizi;
  if (a.sabirsiz > 0) a.sabirsiz -= dt; // sabrı tükendi: öndekini umursamadan geç
  else {
    const engel = ondekiEngel(a, O.arabalar);
    if (engel < Infinity) hedefHiz = Math.min(hedefHiz, Math.max(0, (engel - 42) * 2.2));
    if (hedefHiz < 10) { a.bekleme += dt; if (a.bekleme > 4) { a.bekleme = 0; a.sabirsiz = 2; } }
    else a.bekleme = 0;
  }
  hedefeSur(a, a.hedef.x, a.hedef.y, hedefHiz);
}

function polisYZ(p, dt, O) {
  const gi = p.girdi;
  // Aranmıyorsan polis normal devriye gezer
  if (O.yildiz === 0 || O.durum !== 'oyun' || O.olay) {
    if (p.kovalama) { p.kovalama = false; p.siren = false; p.rota = null; rotayaBagla(p); }
    sivilYZ(p, dt, O);
    return;
  }
  gi.nitro = false; gi.elFreni = false; gi.tutma = false;
  if (p.yikik) { gi.gaz = 0; gi.fren = 0; gi.dir = 0; gi.tutma = true; p.siren = false; return; }
  p.kovalama = true; p.siren = true;
  if (takilmaKontrol(p, dt)) return;

  const o = O.oyuncu, d = mesafe(p.x, p.y, o.x, o.y);
  p.maxHiz = 390 + O.yildiz * 38;
  p.gorusKontrol -= dt;
  if (p.gorusKontrol <= 0) { p.gorusKontrol = 0.2; p.gorur = d < 750 && Harita.gorusVar(p.x, p.y, o.x, o.y); }

  let hx, hy;
  if (p.gorur) {
    // seni görüyor: gideceğin yeri tahmin edip üstüne sür
    const on = Math.min(0.6, d / 600);
    hx = o.x + o.vx * on; hy = o.y + o.vy * on;
    p.rota = null;
  } else {
    // görmüyor: kavşak kavşak sana en çok yaklaştıran yolu seç
    if (!p.rota || mesafe(p.x, p.y, p.rota.x, p.rota.y) < 55) {
      let k = p.rota ? p.rota.k : Harita.enYakinKavsak(p.x, p.y);
      if (p.rota) {
        let en = null, enD = Infinity;
        for (let y = 0; y < 4; y++) {
          const ni = k.i + YONLER[y].dx, nj = k.j + YONLER[y].dy;
          if (!Harita.gecerliKavsak(ni, nj)) continue;
          const m = Harita.kavsakMerkez(ni, nj);
          const dd = mesafe(m.x, m.y, o.x, o.y) + Math.random() * 60;
          if (dd < enD) { enD = dd; en = { i: ni, j: nj }; }
        }
        k = en;
      }
      const m = Harita.kavsakMerkez(k.i, k.j);
      p.rota = { x: m.x, y: m.y, k };
    }
    hx = p.rota.x; hy = p.rota.y;
  }
  // Yavaşladıysan yanına gelip seni sıkıştırır, kaçıyorsan üstüne dalar
  const kistir = p.gorur && d < 120 && o.hiz < 90;
  hedefeSur(p, hx, hy, kistir ? 0 : p.maxHiz);
  if (p.gorur && d < 260 && !kistir) { gi.gaz = 1; gi.fren = 0; gi.tutma = false; }
}
