'use strict';
// ── Kaos Kent · gösterge paneli, mini harita ve tamirhane ──

const Hud = {
  e: {},
  onceki: {},
  yildizlar: [],
  miniOlcek: 1,

  kur() {
    for (const id of ['hud', 'para', 'saat', 'saat-ikon', 'kaos', 'yildizlar', 'gorev-panel', 'gorev-baslik',
      'gorev-detay', 'gorev-sure', 'bildirimler', 'duyuru', 'ipucu', 'yakalanma', 'yakalanma-dolu',
      'hiz', 'can-dolu', 'nitro-dolu', 'mini'])
      this.e[id] = document.getElementById(id);
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      this.e.yildizlar.appendChild(s);
      this.yildizlar.push(s);
    }
    this.miniOlcek = Math.min(2, window.devicePixelRatio || 1);
    this.e.mini.width = this.e.mini.height = Math.round(180 * this.miniOlcek);
  },

  goster(v) { this.e.hud.classList.toggle('gizli', !v); },

  // Değer değişmediyse DOM'a dokunma (her karede yazmak yavaş olur)
  yaz(id, deger, ozellik = 'textContent') {
    const k = id + '|' + ozellik;
    if (this.onceki[k] === deger) return;
    this.onceki[k] = deger;
    this.e[id][ozellik] = deger;
  },
  genislik(id, yuzde) {
    const deger = Math.round(sinirla(yuzde, 0, 100)) + '%';
    const k = id + '|w';
    if (this.onceki[k] === deger) return;
    this.onceki[k] = deger;
    this.e[id].style.width = deger;
  },

  guncelle() {
    const O = Oyun, o = O.oyuncu;
    this.yaz('para', paraYaz(O.kayit.para));
    const saat = (O.gunZamani * 24 + 6) % 24, ss = Math.floor(saat), dk = Math.floor((saat - ss) * 6) * 10;
    this.yaz('saat', String(ss).padStart(2, '0') + ':' + String(dk).padStart(2, '0'));
    this.yaz('saat-ikon', saat >= 6.5 && saat < 19.5 ? '☀️' : '🌙');
    this.yaz('kaos', String(O.kayit.kaos));
    this.yaz('hiz', String(Math.round(o.hiz * 0.32)));
    this.genislik('can-dolu', o.can);
    this.genislik('nitro-dolu', o.nitroDepo * 100);
    for (let i = 0; i < 5; i++) this.yildizlar[i].classList.toggle('dolu', i < O.yildiz);
    this.e.yildizlar.classList.toggle('ariyor', O.yildiz > 0 && O.gizliSure > 0.5);

    this.e.yakalanma.classList.toggle('gizli', O.yakalanma <= 0.05);
    this.genislik('yakalanma-dolu', O.yakalanma / 2.3 * 100);

    const tamirde = O.tamirhanede() && !O.olay;
    this.e.ipucu.classList.toggle('gizli', !tamirde);
    if (tamirde) this.yaz('ipucu', O.yildiz > 0 ? '🚓 Polis peşindeyken tamirhane kapalı' : '<kbd>E</kbd> Tamirhaneye gir', 'innerHTML');

    Gorevler.panelGuncelle(this);
    this.miniCiz();
  },

  duyuru(baslik, alt, renk = '#ffd60a') {
    const d = this.e.duyuru;
    d.textContent = '';
    const h2 = document.createElement('h2'); h2.textContent = baslik;
    const p = document.createElement('p'); p.textContent = alt || '';
    d.append(h2, p);
    d.style.setProperty('--duyuru-renk', renk);
    d.classList.remove('goster');
    void d.offsetWidth; // animasyonu yeniden başlat
    d.classList.add('goster');
  },

  bildirim(metin) {
    const b = document.createElement('div');
    b.className = 'bildirim';
    b.textContent = metin;
    this.e.bildirimler.appendChild(b);
    while (this.e.bildirimler.children.length > 4) this.e.bildirimler.firstChild.remove();
    setTimeout(() => b.remove(), 3100);
  },

  miniCiz() {
    const c = this.e.mini.getContext('2d'), W = this.e.mini.width, s = W / Harita.boyut, k = this.miniOlcek;
    const O = Oyun, o = O.oyuncu, z = O.zaman;
    c.imageSmoothingEnabled = false;
    c.drawImage(Harita.mini, 0, 0, W, W);

    const v = O.gorus;
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = k;
    c.strokeRect(v.x0 * s, v.y0 * s, (v.x1 - v.x0) * s, (v.y1 - v.y0) * s);

    const nokta = (x, y, r, renk) => { c.fillStyle = renk; c.beginPath(); c.arc(x * s, y * s, r * k, 0, Math.PI * 2); c.fill(); };
    const t = Harita.tamirhane;
    nokta(t.x + t.w / 2, t.y + t.h / 2, 5, '#111'); nokta(t.x + t.w / 2, t.y + t.h / 2, 4, '#ff9f1c');
    if (!Gorevler.aktif) {
      for (const n of Gorevler.noktalar) { nokta(n.x, n.y, 5, '#111'); nokta(n.x, n.y, 4, GOREV_TURLERI[n.tur].renk); }
    }
    const h = Gorevler.hedef();
    if (h) { const p = 4.5 + Math.sin(z * 6) * 1.5; nokta(h.x, h.y, p + 1.5, '#111'); nokta(h.x, h.y, p, h.renk); }
    for (const a of O.arabalar)
      if (a.tur === 'polis' && !a.yikik) nokta(a.x, a.y, 3, a.siren && Math.floor(z * 6) % 2 ? '#3b82ff' : '#ff3b3b');

    c.save();
    c.translate(o.x * s, o.y * s); c.rotate(o.aci); c.scale(k, k);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-2, 0); c.lineTo(-5, 5); c.closePath();
    c.stroke(); c.fill();
    c.restore();
  },
};

// ── Tamirhane: tamir, yükseltmeler, boya ──
const FIYAT = { motor: [300, 600, 1000, 1600], zirh: [250, 500, 900, 1400], nitro: [200, 450, 800, 1300] };

const Magaza = {
  ac() {
    Oyun.durum = 'magaza';
    Ses.durgun();
    document.getElementById('magaza').classList.remove('gizli');
    this.ciz();
  },
  kapat() {
    Oyun.durum = 'oyun';
    document.getElementById('magaza').classList.add('gizli');
  },

  ogeler() {
    const k = Oyun.kayit, o = Oyun.oyuncu;
    const tamir = Math.ceil((100 - o.can) * 3);
    const yukselt = (id, ikon, ad, ac) => {
      const lv = k[id], bitti = lv >= 4;
      return { id, ikon, ad: `${ad} · ${lv}/4`, ac, fiyat: bitti ? null : FIYAT[id][lv], kapali: bitti || k.para < FIYAT[id][lv] };
    };
    return [
      { id: 'tamir', ikon: '🔧', ad: 'Tamir', ac: o.can >= 100 ? 'Araban turp gibi' : `Hasar: %${Math.round(100 - o.can)}`,
        fiyat: o.can >= 100 ? null : tamir, kapali: o.can >= 100 || k.para < tamir },
      yukselt('motor', '⚙️', 'Motor', 'Daha yüksek hız ve ivme'),
      yukselt('zirh', '🛡️', 'Zırh', 'Her seviye %15 daha az hasar'),
      yukselt('nitro', '🔥', 'Nitro', 'Daha büyük nitro deposu'),
      { id: 'renk', ikon: '🎨', ad: 'Boya', ac: 'Arabanın rengini değiştir', fiyat: 0, kapali: false },
    ];
  },

  ciz() {
    const liste = document.getElementById('magaza-liste');
    liste.textContent = '';
    document.getElementById('magaza-para').textContent = 'Bakiye: ' + paraYaz(Oyun.kayit.para);
    this.ogeler().forEach((x, i) => {
      const d = document.createElement('div');
      d.className = 'magaza-oge' + (x.kapali ? ' kapali' : '');
      d.innerHTML = `<kbd>${i + 1}</kbd><span class="ikon"></span><div class="bilgi"><div class="ad"></div><div class="ac"></div></div><div class="fiyat"></div>`;
      d.querySelector('.ikon').textContent = x.ikon;
      d.querySelector('.ad').textContent = x.ad;
      d.querySelector('.ac').textContent = x.ac;
      d.querySelector('.fiyat').textContent = x.fiyat === null ? '—' : x.fiyat === 0 ? 'Bedava' : paraYaz(x.fiyat);
      d.onclick = () => this.al(i);
      liste.appendChild(d);
    });
  },

  al(i) {
    const x = this.ogeler()[i];
    if (!x || x.kapali) { Ses.ton(180, 0.12, 'square', 0.06); return; }
    const k = Oyun.kayit, o = Oyun.oyuncu;
    if (x.id === 'renk') {
      k.renk = (k.renk + 1) % OYUNCU_RENKLER.length;
      o.renkAyarla(OYUNCU_RENKLER[k.renk]);
    } else {
      k.para -= x.fiyat;
      if (x.id === 'tamir') o.can = 100;
      else { k[x.id]++; Oyun.oyuncuOzellik(); }
    }
    Ses.para();
    Oyun.kaydet();
    this.ciz();
  },
};
