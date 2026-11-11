# Kaos Kent

Kuşbakışı bir şehirde araba sürdüğün, görev yapıp kaos çıkardığın bir tarayıcı oyunu.
Düz HTML + CSS + JavaScript (canvas). Kurulum, kütüphane ya da derleme yok.

## Çalıştırma

```bash
python3 -m http.server 8770 --directory ~/Projeler/kaos-kent
```

Sonra tarayıcıda http://localhost:8770 adresini aç. (`index.html`'e çift tıklamak da çalışır.)

## Kontroller

| Tuş | İş |
| --- | --- |
| W A S D / oklar | sür |
| Boşluk | el freni (drift) |
| Shift | nitro |
| E | tamirhane (turuncu alanın içindeyken) |
| H | korna |
| G | görevi bırak |
| P / Esc | duraklat |
| M | ses aç/kapat |

## Oyunda neler var

- **Şehir:** 72×72 karoluk harita; yollar, kaldırımlar, sahte 3B binalar (çatı kameraya göre kayar), parklar, göl, otoparklar, tamirhane ve karakol.
- **Trafik:** 42 sivil araba kendi şeridinde kavşaktan kavşağa gider, öndekine çarpmamak için yavaşlar.
- **Polis ve yıldızlar:** Kaos çıkardıkça "ısı" birikir, 1–5 yıldız olur. Polis seni görüyorsa üstüne sürer, görmüyorsa kavşak kavşak arar. 4 saniye gözden kaybolursan yıldızlar düşer. Dururken polis yanına gelirse yakalanırsın.
- **Görevler:** 🍕 kurye, 🚕 taksi, 🏁 sokak yarışı, 🚨 büyük kaçış, 💥 kaos saati.
- **Tamirhane:** tamir, motor / zırh / nitro yükseltmesi, boya.
- **Gece-gündüz:** bir gün 5 dakika; gece farlar, sokak lambaları, pencere ışıkları ve siren ışıkları yanar.
- **Efektler:** lastik izi (kalıcı), kıvılcım, duman, patlama, hidrant suyu, nitro alevi. Sesler Web Audio ile üretilir.
- **Kayıt:** para, yükseltmeler ve istatistikler tarayıcıda (`localStorage`) saklanır.

## Dosyalar

| Dosya | Ne yapar |
| --- | --- |
| `index.html` | Sayfa iskeleti, HUD, giriş/duraklatma/tamirhane ekranları |
| `style.css` | Arayüz görünümü |
| `js/yardimci.js` | Matematik yardımcıları, klavye, sesler |
| `js/harita.js` | Şehrin üretimi ve zemin çizimi, yol/kavşak sorguları |
| `js/araba.js` | Araba fiziği (ileri/yan hız, drift) ve çizimi |
| `js/efektler.js` | Parçacıklar ve uçan yazılar |
| `js/trafik.js` | Sivil ve polis yapay zekâsı |
| `js/gorevler.js` | Görev türleri ve görev paneli |
| `js/hud.js` | Gösterge paneli, mini harita, tamirhane |
| `js/oyun.js` | Ana döngü, çarpışmalar, aranma sistemi, kamera, ışıklandırma |
