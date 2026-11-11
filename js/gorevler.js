'use strict';
// ── Kaos Kent · görevler ──
// Haritada her görev türünden bir simge durur, üstünden arabayla geçince görev başlar.
// Ambulans ve itfaiye görevleri ise o araçlara binince başlar (hastane / itfaiye otoparkı).

const GOREV_TURLERI = {
  kurye:    { ikon: '🍕', ad: 'Pizza Kuryesi', renk: '#ff9f1c' },
  taksi:    { ikon: '🚕', ad: 'Taksi', renk: '#ffd60a' },
  yaris:    { ikon: '🏁', ad: 'Sokak Yarışı', renk: '#4cc9f0' },
  kacis:    { ikon: '🚨', ad: 'Büyük Kaçış', renk: '#ef476f' },
  kaos:     { ikon: '💥', ad: 'Kaos Saati', renk: '#d062ff' },
  zincir:   { ikon: '📦', ad: 'Kurye Zinciri', renk: '#f4a261' },
  ambulans: { ikon: '🚑', ad: 'Ambulans', renk: '#ff4d6d' },
  itfaiye:  { ikon: '🚒', ad: 'İtfaiye', renk: '#ff6b35' },
};
const ISARET_GOREVLERI = ['kurye', 'taksi', 'yaris', 'kacis', 'kaos', 'zincir'];
const ARACLI_GOREVLER = new Set(['kurye', 'taksi', 'yaris', 'zincir', 'ambulans', 'itfaiye']);

const TAKSI_SOZLERI = ['Ah, boynum!', 'Yavaş ol be kardeşim!', 'Bu taksi mi lunapark mı?',
  'Annemi aramam lazım...', 'Bahşiş gidiyor ha!', 'Ehliyeti nereden aldın?'];

function dikdortgenMesafe(b, x, y) {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

const Gorevler = {
  noktalar: [],
  aktif: null,
  sozZaman: -9,

  baslat() {
    this.noktalar = [];
    for (const tur of ISARET_GOREVLERI) this.noktalar.push(this.yerBul(tur));
  },

  yerBul(tur) {
    const o = Oyun.oyuncu;
    let s = null;
    for (let d = 0; d < 80; d++) {
      s = Harita.rastgeleSerit();
      if (o && mesafe(s.x, s.y, o.x, o.y) < 500) continue;
      if (this.noktalar.some(n => n.tur !== tur && mesafe(n.x, n.y, s.x, s.y) < 500)) continue;
      break;
    }
    return { tur, x: s.x, y: s.y };
  },

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

  yolMesafesi(h) { const o = Oyun.oyuncu; return Math.abs(h.x - o.x) + Math.abs(h.y - o.y); },

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

  // Yangın çıkacak sıradan bir bina (özel yapılar değil, uzak olmayan)
  binaSec(haric) {
    const o = Oyun.oyuncu;
    let b = null;
    for (let d = 0; d < 200; d++) {
      b = sec(Harita.binalar);
      if (b.etiket || b === haric) continue;
      const m = mesafe(b.x + b.w / 2, b.y + b.h / 2, o.x, o.y);
      if (m > 600 && m < 2000) break;
    }
    return b;
  },

  zincirSonraki(g) {
    g.hedef = this.uzakNokta(900, 1700);
    g.sure = this.yolMesafesi(g.hedef) / (260 + g.adim * 30) + 9;
    g.toplam = g.sure;
  },

  gorevBaslat(n) {
    const o = Oyun.oyuncu, t = GOREV_TURLERI[n.tur];
    const g = { tur: n.tur, nokta: ISARET_GOREVLERI.includes(n.tur) ? n : null, sure: 60, toplam: 60, hedef: null, aciklama: '',
      arac: ARACLI_GOREVLER.has(n.tur) ? o : null };

    if (n.tur === 'kurye') {
      g.hedef = this.uzakNokta(1000, 2200);
      g.sure = this.yolMesafesi(g.hedef) / 250 + 10;
      g.aciklama = 'Pizzayı soğumadan teslim et!';
    } else if (n.tur === 'taksi') {
      g.hedef = this.uzakNokta(900, 2400);
      g.sure = this.yolMesafesi(g.hedef) / 210 + 18;
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
    } else if (n.tur === 'zincir') {
      g.adim = 0;
      this.zincirSonraki(g);
      g.aciklama = 'Üç teslimat arka arkaya, her biri daha hızlı!';
    } else if (n.tur === 'ambulans') {
      g.asama = 'hasta';
      g.hedef = this.uzakNokta(800, 1800);
      g.hastaYaya = new Yaya(g.hedef.x, g.hedef.y);
      g.hastaYaya.dusur(0, 0, 999);
      g.hastaCan = 100;
      g.sure = this.yolMesafesi(g.hedef) / 230 + 14;
      g.aciklama = 'Hastayı al, hastaneye yetiştir!';
      o.siren = true;
    } else if (n.tur === 'itfaiye') {
      const b1 = this.binaSec(null), b2 = this.binaSec(b1);
      g.yanginlar = [b1, b2]; g.sira = 0;
      b1.yangin = 1;
      g.hedef = { x: b1.x + b1.w / 2, y: b1.y + b1.h / 2 };
      g.sure = 120;
      g.aciklama = 'İki yangını söndür! Binanın yanına gelip dur.';
      o.siren = true;
    }
    g.toplam = g.sure;
    this.aktif = g;
    Hud.duyuru(t.ikon + ' ' + t.ad.toLocaleUpperCase('tr-TR'), g.aciklama, t.renk);
    Ses.ton(523, 0.12, 'triangle', 0.12); Ses.ton(784, 0.18, 'triangle', 0.12, 0.1);
  },

  guncelle(dt) {
    const o = Oyun.oyuncu, aracta = o instanceof Araba;
    if (!this.aktif) {
      if (!aracta || o.yikik || Oyun.olay) return;
      for (const n of this.noktalar)
        if (mesafe(n.x, n.y, o.x, o.y) < 42) { this.gorevBaslat(n); break; }
      return;
    }
    const g = this.aktif;
    if (g.arac && o !== g.arac) return this.bitir(false, 0, 'Görev aracını terk ettin.');
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
      case 'zincir':
        if (d < 48) {
          const odul = Math.round((120 + Math.max(0, g.sure) * 6) * (g.adim + 1));
          Oyun.paraEkle(odul);
          Efekt.yazi(o.x, o.y - 30, '+' + paraYaz(odul), '#7CFC9A');
          Ses.para();
          g.adim++;
          if (g.adim >= 3) return this.bitir(true, 300, 'Üç teslimat da tamam! Zincir bonusu');
          this.zincirSonraki(g);
          Hud.bildirim(`📦 Teslimat ${g.adim}/3 tamam! Sıradaki daha hızlı.`);
        }
        break;
      case 'ambulans':
        if (g.asama === 'hasta') {
          if (d < 60 && o.hiz < 70) {
            g.asama = 'hastane'; g.hastaYaya = null;
            g.hedef = { x: Harita.hastane.x, y: Harita.hastane.y };
            g.sure = this.yolMesafesi(g.hedef) / 230 + 14; g.toplam = g.sure;
            Hud.bildirim('🚑 Hasta alındı! Hastaneye!');
            Ses.ton(660, 0.1, 'triangle', 0.1); Ses.ton(990, 0.15, 'triangle', 0.1, 0.08);
          }
        } else {
          g.hastaCan -= dt * 0.6;
          if (g.hastaCan <= 0) return this.bitir(false, 0, 'Hastanın durumu kötüleşti, başka ekip devraldı.');
          if (d < 75 && o.hiz < 80) return this.bitir(true, 250 + Math.round(g.hastaCan * 3), `Hasta zamanında yetişti! Durumu %${Math.round(g.hastaCan)}`);
        }
        break;
      case 'itfaiye': {
        const b = g.yanginlar[g.sira];
        g.sondur = dikdortgenMesafe(b, o.x, o.y) < 130 && o.hiz < 70;
        if (g.sondur) {
          b.yangin -= dt * 0.2;
          const c = Math.cos(o.aci), s = Math.sin(o.aci);
          for (let i = 0; i < 2; i++) Efekt.fiskirt(o.x + c * o.uzun * 0.3, o.y + s * o.uzun * 0.3, b.x + b.ox + Math.random() * b.w, b.y + b.oy + Math.random() * b.h);
        }
        if (b.yangin <= 0) {
          b.yangin = 0; g.sira++;
          Ses.ton(784, 0.15, 'triangle', 0.1);
          if (g.sira >= g.yanginlar.length) return this.bitir(true, 550 + Math.round(g.sure) * 4, 'Yangınlar söndü, şehir sana minnettar!');
          const nb = g.yanginlar[g.sira];
          nb.yangin = 1;
          g.hedef = { x: nb.x + nb.w / 2, y: nb.y + nb.h / 2 };
          Hud.bildirim('🔥 Bir yangın daha var!');
        }
        break;
      }
    }
    if (g.sure <= 0) this.bitir(false, 0, g.tur === 'kacis' ? 'Süre doldu, polis hâlâ peşinde.' : 'Süre doldu!');
  },

  // Görev bitince geride iz bırakmasın (siren, taksi tabelası, yangınlar)
  toparla(g) {
    if (g.arac) { g.arac.siren = false; g.arac.taksi = false; }
    if (g.yanginlar) for (const b of g.yanginlar) b.yangin = 0;
  },

  bitir(basarili, odul, mesaj) {
    const g = this.aktif;
    if (!g) return;
    this.aktif = null;
    this.toparla(g);
    const o = Oyun.oyuncu;
    if (basarili) {
      Oyun.paraEkle(odul);
      Oyun.kayit.gorev++;
      Hud.duyuru('GÖREV TAMAM!', `${mesaj}  +${paraYaz(odul)}`, '#06d6a0');
      Efekt.yazi(o.x, o.y - 30, '+' + paraYaz(odul), '#7CFC9A');
      Ses.basari();
    } else {
      Hud.duyuru('GÖREV BAŞARISIZ', mesaj, '#ef476f');
      Ses.basarisiz();
    }
    this.yenile(g);
    Oyun.kaydet();
  },

  iptal() {
    const g = this.aktif;
    if (!g) return;
    this.aktif = null;
    this.toparla(g);
    this.yenile(g);
  },

  yenile(g) {
    if (!g.nokta) return;
    const i = this.noktalar.indexOf(g.nokta);
    if (i >= 0) this.noktalar[i] = this.yerBul(g.tur);
  },

  oyuncuCarpti(guc) {
    const g = this.aktif;
    if (!g || guc < 80) return;
    if (g.tur === 'ambulans' && g.asama === 'hastane') {
      g.hastaCan = Math.max(0, g.hastaCan - guc * 0.04);
      return;
    }
    if (g.tur !== 'taksi') return;
    g.memnuniyet = Math.max(0, g.memnuniyet - guc * 0.08);
    if (Oyun.zaman - this.sozZaman > 2.5) {
      this.sozZaman = Oyun.zaman;
      Efekt.yazi(Oyun.oyuncu.x, Oyun.oyuncu.y - 30, '🗯️ ' + sec(TAKSI_SOZLERI), '#ffd60a');
    }
    if (g.memnuniyet <= 0) this.bitir(false, 0, 'Yolcu indi: "Yürüyerek giderim!"');
  },

  kaosEkle(m) { if (this.aktif && this.aktif.tur === 'kaos') this.aktif.kaos += m; },

  yananlar() {
    const g = this.aktif;
    return g && g.yanginlar ? g.yanginlar.filter(b => b.yangin > 0) : [];
  },

  hedef() {
    const g = this.aktif;
    if (!g || !g.hedef) return null;
    const t = GOREV_TURLERI[g.tur];
    let ikon = '📍', etiket = '';
    switch (g.tur) {
      case 'kurye': ikon = '🏠'; etiket = 'Teslimat'; break;
      case 'taksi': etiket = 'Varış'; break;
      case 'yaris': ikon = String(g.sira + 1); etiket = `Kontrol ${g.sira + 1}/${g.noktalar.length}`; break;
      case 'zincir': ikon = '📦'; etiket = `Teslimat ${g.adim + 1}/3`; break;
      case 'ambulans': ikon = g.asama === 'hasta' ? '🤕' : '🏥'; etiket = g.asama === 'hasta' ? 'Hasta' : 'Hastane'; break;
      case 'itfaiye': ikon = '🔥'; etiket = `Yangın ${g.sira + 1}/2`; break;
    }
    return { x: g.hedef.x, y: g.hedef.y, renk: t.renk, ikon, etiket };
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
    switch (g.tur) {
      case 'kurye': detay = `Teslimata ${m} m`; break;
      case 'taksi': detay = `Varışa ${m} m · Memnuniyet %${Math.round(g.memnuniyet)}`; break;
      case 'yaris': detay = `Kontrol ${g.sira + 1}/${g.noktalar.length} · ${m} m`; break;
      case 'kacis': detay = Oyun.yildiz > 0 ? `Yıldızları sıfırla! Şu an ${'★'.repeat(Oyun.yildiz)}` : 'Polis yükleniyor...'; break;
      case 'kaos': detay = `Kaos ${g.kaos} / ${g.hedefKaos}`; break;
      case 'zincir': detay = `Teslimat ${g.adim + 1}/3 · ${m} m`; break;
      case 'ambulans': detay = g.asama === 'hasta' ? `Hastaya ${m} m` : `Hastaneye ${m} m · Hasta %${Math.round(g.hastaCan)}`; break;
      case 'itfaiye': {
        const b = g.yanginlar[g.sira];
        detay = `Yangın ${g.sira + 1}/2 · ` + (g.sondur ? `Söndürülüyor %${Math.round((1 - b.yangin) * 100)}` : `${m} m`);
        break;
      }
    }
    h.yaz('gorev-detay', detay);
    const s = Math.max(0, Math.ceil(g.sure));
    h.yaz('gorev-sure', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    h.e['gorev-sure'].classList.toggle('az', g.sure < 10);
  },
};
