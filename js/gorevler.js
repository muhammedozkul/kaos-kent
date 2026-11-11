'use strict';
// ── Kaos Kent · görevler ──
// Haritada her görev türünden bir simge durur. Üstünden geçince görev başlar.

const GOREV_TURLERI = {
  kurye: { ikon: '🍕', ad: 'Pizza Kuryesi', renk: '#ff9f1c' },
  taksi: { ikon: '🚕', ad: 'Taksi', renk: '#ffd60a' },
  yaris: { ikon: '🏁', ad: 'Sokak Yarışı', renk: '#4cc9f0' },
  kacis: { ikon: '🚨', ad: 'Büyük Kaçış', renk: '#ef476f' },
  kaos:  { ikon: '💥', ad: 'Kaos Saati', renk: '#d062ff' },
};

const TAKSI_SOZLERI = ['Ah, boynum!', 'Yavaş ol be kardeşim!', 'Bu taksi mi lunapark mı?',
  'Annemi aramam lazım...', 'Bahşiş gidiyor ha!', 'Ehliyeti nereden aldın?'];

const Gorevler = {
  noktalar: [],
  aktif: null,
  sozZaman: -9,

  baslat() {
    this.noktalar = [];
    for (const tur of Object.keys(GOREV_TURLERI)) this.noktalar.push(this.yerBul(tur));
  },

  // Oyuncudan ve diğer simgelerden uzak bir yol noktası
  yerBul(tur) {
    const o = Oyun.oyuncu;
    let s = null;
    for (let d = 0; d < 80; d++) {
      s = Harita.rastgeleSerit();
      if (o && mesafe(s.x, s.y, o.x, o.y) < 500) continue;
      if (this.noktalar.some(n => n.tur !== tur && mesafe(n.x, n.y, s.x, s.y) < 450)) continue;
      break;
    }
    return { tur, x: s.x, y: s.y };
  },

  // Oyuncuya "yol mesafesi" (|dx|+|dy|) belli aralıkta olan bir nokta
  uzakNokta(min, max) {
    const o = Oyun.oyuncu;
    let s = null;
    for (let d = 0; d < 120; d++) {
      s = Harita.rastgeleSerit();
      const m = Math.abs(s.x - o.x) + Math.abs(s.y - o.y);
      if (m >= min && m <= max) break;
    }
    return { x: s.x, y: s.y };
  },

  // Kavşaklar üzerinden 6 kontrol noktalı rastgele bir yarış rotası
  yarisRotasi() {
    const o = Oyun.oyuncu;
    let k = Harita.enYakinKavsak(o.x, o.y), onceki = -1;
    const noktalar = [];
    while (noktalar.length < 6) {
      const secenek = [];
      for (let y = 0; y < 4; y++) {
        if (onceki >= 0 && y === (onceki + 2) % 4) continue;
        if (Harita.gecerliKavsak(k.i + YONLER[y].dx, k.j + YONLER[y].dy)) secenek.push(y);
      }
      const y = sec(secenek), adim = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < adim && Harita.gecerliKavsak(k.i + YONLER[y].dx, k.j + YONLER[y].dy); s++)
        k = { i: k.i + YONLER[y].dx, j: k.j + YONLER[y].dy };
      onceki = y;
      noktalar.push(Harita.kavsakMerkez(k.i, k.j));
    }
    return noktalar;
  },

  gorevBaslat(n) {
    const o = Oyun.oyuncu, t = GOREV_TURLERI[n.tur];
    const g = { tur: n.tur, nokta: n, sure: 60, toplam: 60, hedef: null, aciklama: '' };
    const yolMesafesi = h => Math.abs(h.x - o.x) + Math.abs(h.y - o.y);

    if (n.tur === 'kurye') {
      g.hedef = this.uzakNokta(1000, 2000);
      g.sure = yolMesafesi(g.hedef) / 250 + 10;
      g.aciklama = 'Pizzayı soğumadan teslim et!';
    } else if (n.tur === 'taksi') {
      g.hedef = this.uzakNokta(900, 2200);
      g.sure = yolMesafesi(g.hedef) / 210 + 18;
      g.memnuniyet = 100;
      g.aciklama = 'Yolcuyu götür, hedefte yavaşla. Fazla çarpma!';
      o.taksi = true;
    } else if (n.tur === 'yaris') {
      g.noktalar = this.yarisRotasi();
      g.sira = 0;
      g.hedef = g.noktalar[0];
      let top = 0, p = o;
      for (const q of g.noktalar) { top += Math.abs(q.x - p.x) + Math.abs(q.y - p.y); p = q; }
      g.sure = top / 330 + 8;
      g.aciklama = '6 kontrol noktasından sırayla geç!';
    } else if (n.tur === 'kacis') {
      Oyun.isi = Math.max(Oyun.isi, 150);
      g.sure = 120;
      g.aciklama = '3 yıldızla başlıyorsun. Polisi ek!';
    } else if (n.tur === 'kaos') {
      g.kaos = 0; g.hedefKaos = 60; g.sure = 45;
      g.aciklama = '45 saniyede 60 kaos puanı topla!';
    }
    g.toplam = g.sure;
    this.aktif = g;
    Hud.duyuru(t.ikon + ' ' + t.ad.toLocaleUpperCase('tr-TR'), g.aciklama, t.renk);
    Ses.ton(523, 0.12, 'triangle', 0.12); Ses.ton(784, 0.18, 'triangle', 0.12, 0.1);
  },

  guncelle(dt) {
    const o = Oyun.oyuncu;
    if (!this.aktif) {
      if (o.yikik || Oyun.olay) return;
      for (const n of this.noktalar)
        if (mesafe(n.x, n.y, o.x, o.y) < 42) { this.gorevBaslat(n); break; }
      return;
    }
    const g = this.aktif;
    g.sure -= dt;
    const d = g.hedef ? mesafe(g.hedef.x, g.hedef.y, o.x, o.y) : 0;
    switch (g.tur) {
      case 'kurye':
        if (d < 48) return this.bitir(true, 150 + Math.round(g.sure) * 8, 'Pizza sıcacık teslim edildi! 🍕');
        break;
      case 'taksi':
        if (d < 60 && o.hiz < 80)
          return this.bitir(true, 100 + Math.round(g.memnuniyet * 3 + g.sure * 3), `Yolcu memnuniyeti: %${Math.round(g.memnuniyet)}`);
        break;
      case 'yaris':
        if (d < 60) {
          g.sira++;
          Ses.ton(880, 0.12, 'square', 0.07);
          if (g.sira >= g.noktalar.length) return this.bitir(true, 350 + Math.round(g.sure) * 10, 'Yarışı kazandın! 🏁');
          g.hedef = g.noktalar[g.sira];
        }
        break;
      case 'kacis':
        if (Oyun.yildiz === 0 && g.toplam - g.sure > 2) return this.bitir(true, 600, 'Polisi atlattın! 😎');
        break;
      case 'kaos':
        if (g.kaos >= g.hedefKaos) return this.bitir(true, 300 + Math.round(g.sure) * 5, 'Tam bir kaos! 💥');
        break;
    }
    if (g.sure <= 0) this.bitir(false, 0, g.tur === 'kacis' ? 'Süre doldu, polis hâlâ peşinde.' : 'Süre doldu!');
  },

  bitir(basarili, odul, mesaj) {
    const g = this.aktif;
    if (!g) return;
    this.aktif = null;
    Oyun.oyuncu.taksi = false;
    if (basarili) {
      Oyun.paraEkle(odul);
      Oyun.kayit.gorev++;
      Hud.duyuru('GÖREV TAMAM!', `${mesaj}  +${paraYaz(odul)}`, '#06d6a0');
      Efekt.yazi(Oyun.oyuncu.x, Oyun.oyuncu.y - 30, '+' + paraYaz(odul), '#7CFC9A');
      Ses.basari();
    } else {
      Hud.duyuru('GÖREV BAŞARISIZ', mesaj, '#ef476f');
      Ses.basarisiz();
    }
    this.yenile(g);
    Oyun.kaydet();
  },

  // Yakalanınca / pert olunca görevi sessizce iptal et
  iptal() {
    const g = this.aktif;
    if (!g) return;
    this.aktif = null;
    Oyun.oyuncu.taksi = false;
    this.yenile(g);
  },

  yenile(g) {
    const i = this.noktalar.indexOf(g.nokta);
    if (i >= 0) this.noktalar[i] = this.yerBul(g.tur);
  },

  oyuncuCarpti(guc) {
    const g = this.aktif;
    if (!g || g.tur !== 'taksi' || guc < 80) return;
    g.memnuniyet = Math.max(0, g.memnuniyet - guc * 0.08);
    if (Oyun.zaman - this.sozZaman > 2.5) {
      this.sozZaman = Oyun.zaman;
      Efekt.yazi(Oyun.oyuncu.x, Oyun.oyuncu.y - 30, '🗯️ ' + sec(TAKSI_SOZLERI), '#ffd60a');
    }
    if (g.memnuniyet <= 0) this.bitir(false, 0, 'Yolcu indi: "Yürüyerek giderim!"');
  },

  kaosEkle(m) { if (this.aktif && this.aktif.tur === 'kaos') this.aktif.kaos += m; },

  // Ok ve mini harita için şu anki hedef
  hedef() {
    const g = this.aktif;
    if (!g || !g.hedef) return null;
    const t = GOREV_TURLERI[g.tur];
    return {
      x: g.hedef.x, y: g.hedef.y, renk: t.renk,
      ikon: g.tur === 'yaris' ? String(g.sira + 1) : g.tur === 'kurye' ? '🏠' : '📍',
      etiket: g.tur === 'kurye' ? 'Teslimat' : g.tur === 'taksi' ? 'Varış' : `Kontrol ${g.sira + 1}/${g.noktalar.length}`,
    };
  },

  panelGuncelle(h) {
    const g = this.aktif;
    h.e['gorev-panel'].classList.toggle('gizli', !g);
    if (!g) return;
    const t = GOREV_TURLERI[g.tur], o = Oyun.oyuncu;
    h.yaz('gorev-baslik', t.ikon + ' ' + t.ad);
    h.e['gorev-panel'].style.setProperty('--gorev-renk', t.renk);
    const m = g.hedef ? Math.round(mesafe(o.x, o.y, g.hedef.x, g.hedef.y) / 10) : 0;
    let detay = '';
    if (g.tur === 'kurye') detay = `Teslimata ${m} m`;
    else if (g.tur === 'taksi') detay = `Varışa ${m} m · Memnuniyet %${Math.round(g.memnuniyet)}`;
    else if (g.tur === 'yaris') detay = `Kontrol ${g.sira + 1}/${g.noktalar.length} · ${m} m`;
    else if (g.tur === 'kacis') detay = Oyun.yildiz > 0 ? `Yıldızları sıfırla! Şu an ${'★'.repeat(Oyun.yildiz)}` : 'Polis yükleniyor...';
    else if (g.tur === 'kaos') detay = `Kaos ${g.kaos} / ${g.hedefKaos}`;
    h.yaz('gorev-detay', detay);
    const s = Math.max(0, Math.ceil(g.sure));
    h.yaz('gorev-sure', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    h.e['gorev-sure'].classList.toggle('az', g.sure < 10);
  },
};
