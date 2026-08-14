# Faz 6 — PROTOKOL DÜZENLEYİCİ görsel tasarım sistemi

**Görev:** TASK-MSSXTSZQH1CB6 · **Sprint:** SPRINT-FAZ-6 · **Rol:** Tasarımcı
**Kaynak:** `docs/Gozlemci_OS_Kanonik_Tasarim_ve_Gelistirme_Spesifikasyonu_v10_3.md`
**Kanonik dayanaklar:** §72.6 (satır 5415–5456) · §71.3 token'lar (4663–4728) · §71.4 buton (4730–4782) · §71.5 panel (4784–4817) · §71.8 protokol ekranı (4962–5005) · §71.17.3 mobil (5259–5263) · §25 erişilebilirlik (1850–1889)
**Kod dayanağı (Faz 5, değiştirilmez):** `src/game/domain/protocol/Protocol.ts` · `src/game/simulation/protocol/protocolValidator.ts` · `src/localization/tr.ts`

> Bu doküman **kod değildir ve bileşen üretmez**. §72.6'daki sanat yönünü, uygulanabilir token + ölçü + durum tablosuna çevirir. Faz 6/2 (graph editor) ve Faz 6/3 (draft/apply) bu dokümanı girdi olarak alır.
> Her karar §72.6'daki (veya destekleyici bölümdeki) **satır numarasına** dayandırılmıştır. Kontrast oranları hesaplanmıştır; hesaplama yöntemi ve ham çıktı §14'te.

---

## 1. Karar defteri — spec satırı → tasarım kararı

| # | Spec satırı | Spec ne diyor | Bu dokümandaki karar | Bölüm |
|---|---|---|---|---|
| K-01 | 5421 | "Koyu, profesyonel sci-fi workflow editor; cyan accent; az ve kontrollü glow" | Tek accent ailesi (#39BFFF); glow yalnız `selected` durumunda ve tek katman | §3, §9 |
| K-02 | 5424 | sol panel 300–340 px | **320 px** (aralığın ortası, 8-grid'e tam oturur) | §5 |
| K-03 | 5425 | merkez kalan en büyük alan | Canvas her kırılımda en geniş bölge (min. 640 px) | §5 |
| K-04 | 5426 | sağ panel 340–380 px | **360 px** | §5, §12 |
| K-05 | 5427 | üstte ad, durum, Kontrol Et/Uygula, zoom/undo-redo | 64 px üst bar; sol-orta-sağ üç bölge | §6 |
| K-06 | 5428 | altta ana üç-tab navigation | 72 px (§71.4.2 Tab 68–76) | §13 |
| K-07 | 5430 | "çok koyu mavi-gri zemin, çok hafif dot/grid" | `canvas.base #081521`, 24 px dot ızgara, 1.21:1 | §8 |
| K-08 | 5430 | "düğümlerin arkasında yıldız/uzay görseli kullanma" | Canvas'ta **hiçbir** görsel katman yok: düz renk + dot. Yasak listesi §15 | §8, §15 |
| K-09 | 5431 | node 170–220 px, sade, modüler, aynı aileden | Tüm node'lar **192 px** sabit genişlik, tek kart iskeleti, yalnız içerik satırı değişir | §9 |
| K-10 | 5432 | portlar küçük ama görünür cyan nokta; hitbox daha büyük | 10 px görünür nokta / 24 px işaretçi hitbox / 44 px dokunma hitbox (§25.4, s.1882) | §10 |
| K-11 | 5433 | edges ince, temiz, hafif cyan; kesişimde karmaşa yok | 1.5 px bezier, 4 kenar sınıfı, kesişimde 4 px canvas rengi "kesik" | §11 |
| K-12 | 5436–5440 | node görsel türleri (renk aileleri) | 6 kanonik kimlik rengi; renk **tek başına** taşıyıcı değil (§25.1) | §9.3 |
| K-13 | 5440 | "Action: amber/cyan karışımı … çok renkli yapma" | Eylem = amber; kimlik rengi yalnız 3 px sol şerit + ikon; kart gövdesi tüm türlerde aynı | §9.3, §9.4 |
| K-14 | 5442–5444 | selected / hover / invalid halleri | 6 durumlu tablo, ölçülmüş sınır renkleriyle | §9.5 |
| K-15 | 5444 | "kontrollü kırmızı border + doğal Türkçe hata açıklaması" | Danger yalnız 1.5 px sınır + ikon; metin `tr.protocol.error.*` üzerinden (yeni metin yazılmaz) | §9.5, §11.4 |
| K-16 | 5446 | yalnız Karşılaştır + VE + Geciktir; VEYA/DEĞİL/Sayaç/Splitter yok | Palet **tam olarak 6** node taşır; kapalı liste §9.3 | §9.3, §15 |
| K-17 | 5447 | folder / "Protokol Grupları" yok | Sol panel düz liste; hiçbir hiyerarşi yüzeyi yok | §7, §15 |
| K-18 | 5448 | yeni resource / savunma sistemi / kanonik olmayan node uydurma | Bütün alan değerleri `ProtocolCapabilities`'ten gelir; statik örnek isim yok | §12, §15 |
| K-19 | 5450–5454 | sağ panel: ikon+ad+açıklama, yalnız gerçek alanlar, doğal Türkçe, en altta Düğümü Sil | Node başına alan tablosu `Protocol.ts` alanlarından türetildi | §12 |
| K-20 | 5455 | "teknik Boolean/execution pulse jargonu gösterme" | `boolean`, `flow`, `pulse`, `port`, `edge`, `node id` sözcükleri arayüzde geçmez; sözlük §12.2 | §12.2, §15 |
| K-21 | §71.8.5 (4998) | "hatalı node kırmızıyla çığlık atmaz" | Uyarı = rozet (dolgu yok), hata = ince sınır; hiçbir zaman kırmızı dolgu | §9.5 |
| K-22 | §25.2 (1874) | TRUE/FALSE yolu yalnız renkle anlatılmaz | Evet/Hayır kenarları çizgi stili + etiket + renk (3 kanal) | §11.2 |
| K-23 | §71.17.3 (5261) | mobilde split değil stacked; seçili node alt sheet | <1024 px yığılmış düzen, ayar alt sheet | §5.3 |

---

## 2. Ekranın karakteri

§71.8.1 (4966): "geliştirici IDE'si gibi değil, oyunun kendi operasyon arayüzü gibi". Bunun üç somut sonucu:

1. **Sıfır kod estetiği** — monospace font yok, satır numarası yok, syntax renklendirmesi yok, `nodeId` gibi teknik kimlikler ekranda görünmez (K-20).
2. **Kart dili** — graph, kutu-ok diyagramı değil; §71.8.5'teki panel ailesinden gelen kartlardır. Node kartı ile sağ paneldeki blok aynı yüzey/radius/sınır ailesini kullanır.
3. **Sessiz zemin** — dikkat node ve kenarlarda; canvas hiçbir görsel iddiada bulunmaz (K-08).

---

## 3. Renk token'ları

### 3.1 §71.3.1'den devralınan taban (değiştirilmez)

`color.bg.deep #07131C` · `color.bg.panel rgba(7,19,28,0.82)` · `color.bg.panel.elevated rgba(10,28,40,0.90)` · `color.accent.primary #39BFFF` · `color.accent.hover #67D0FF` · `color.accent.pressed #1E97D8` · `color.text.primary #EAF4FF` · `color.text.secondary #9DB7C8` · `color.text.muted #6E8899` · `color.state.success #4FC98E` · `color.state.warning #E6B24A` · `color.state.danger #E45D5D` · `color.state.info #61CFFF`

### 3.2 Protokol Düzenleyici'ye özel token'lar (yeni)

Bu katman §71.3'ü **genişletir**, ezmez. Adlandırma `protocol.*` ön ekiyle ayrılır.

| Token | Değer | Bileşik (canvas üzerinde) | Amaç | Dayanak |
|---|---|---|---|---|
| `protocol.canvas.base` | `#081521` | — | graph zemini | 5430 |
| `protocol.canvas.dot` | `rgba(120,170,205,0.12)` | `#152736` | dot ızgara | 5430 |
| `protocol.node.surface` | `rgba(16,34,48,0.94)` | `#10212F` | node kart gövdesi | 5431 |
| `protocol.node.header` | `rgba(23,48,63,0.96)` | `#162F3E` | node başlık şeridi | §71.8.5 |
| `protocol.node.border` | `#467190` | — | varsayılan kart sınırı | §71.8.6 |
| `protocol.node.border.hover` | `#5A8AAB` | — | hover sınırı | 5443 |
| `protocol.node.border.selected` | `#4ABEFF` | — | seçili sınır | 5442 |
| `protocol.node.border.invalid` | `#E45D5D` | — | geçersiz sınır | 5444 |
| `protocol.panel.border` | `#406884` | — | panel/bar sınırı | §71.5.1 |
| `protocol.panel.separator` | `#24404F` | — | section ayıracı | §71.5.2 |
| `protocol.field.surface` | `#0E2130` | — | input zemini | §71.13.2 |
| `protocol.edge.flow` | `rgba(57,191,255,0.70)` | `#2A8CBC` | akış kenarı | 5433 |
| `protocol.edge.value` | `rgba(63,182,174,0.70)` | `#2E8684` | ölçüm kenarı | 5433 + 5437 |
| `protocol.edge.negative` | `rgba(157,183,200,0.62)` | `#647989` | "Hayır" kenarı | §25.2 |
| `protocol.edge.dim` | `rgba(157,183,200,0.40)` | `#445664` | seçim dışı sönümleme | 5433 |
| `protocol.text.faint` | `#8199A8` | — | node içi üçüncül metin | §25.3 |
| `protocol.glow.selected` | `0 0 0 1px rgba(74,190,255,0.55), 0 0 18px rgba(57,191,255,0.10)` | — | seçim parıltısı | 5421 "az ve kontrollü" |

> **`color.text.muted #6E8899` node kartı içinde kullanılmaz.** Node yüzeyinde 4.41:1 verir, 4.5:1 eşiğinin altındadır (§14 ölçüm). Node içi üçüncül metin için `protocol.text.faint #8199A8` (5.51:1) tanımlandı. Panel yüzeyinde `#6E8899` 5.04:1 ile geçerlidir, orada kullanılabilir.

### 3.3 Node kimlik renkleri (kapalı liste — 6 kimlik)

| Node | Token | Renk | Spec satırı | Not |
|---|---|---|---|---|
| Tetikleyici | `protocol.id.trigger` | `#39BFFF` | 5436 "mavi/cyan" | accent ile aynı; protokolün başlangıcı ekranın ana vurgusudur |
| Sensör | `protocol.id.sensor` | `#3FB6AE` | 5437 "teal/mavi-gri" | |
| Karşılaştır | `protocol.id.compare` | `#6AA9F0` | 5438 "cyan/blue" | |
| VE | `protocol.id.and` | `#6AA9F0` | 5438 (aynı "logic" ailesi) | Karşılaştır ile **bilerek aynı** renk; ayrım ikon + ad ile yapılır |
| Geciktir | `protocol.id.delay` | `#9DB7C8` | 5439 "amber **veya nötr**" | **Nötr seçildi.** Gerekçe §3.4 |
| Eylem | `protocol.id.action` | `#F0A94C` | 5440 "amber/cyan karışımı" | |

**Kimlik rengi nerede görünür:** (a) kartın sol kenarındaki 3 px dikey şerit, (b) başlıktaki 16 px ikon, (c) sağ paneldeki başlık ikonu. **Nerede görünmez:** kart dolgusu, metin rengi, kenar rengi. §72.6 satır 5431 "aynı aileden" ve 5440 "çok renkli yapma" bunu gerektirir.

### 3.4 İki bilinçli renk kararı ve gerekçeleri

**(a) Geciktir nötr, amber değil.** Satır 5439 "amber **veya** nötr" diyerek seçim bırakır. Amber seçilseydi ekranda iki amber aile olurdu: Geciktir kimliği + Eylem kimliği (5440) + `state.warning`. Ölçüm: `#F0A94C` ile `#E6B24A` arasındaki kontrast **1.03:1** — parlaklık olarak ayırt edilemezler. Üçüncü bir amber, uyarı semantiğini (§25.2) tümüyle okunamaz hale getirirdi. Bu yüzden Geciktir `#9DB7C8` nötr slate alır; amber ailesi yalnız Eylem kimliği + uyarı semantiği arasında paylaşılır.

**(b) Eylem amber'i ile uyarı amber'i çakışmasının çözümü form ile yapılır.** Ölçülen 1.03:1 farkı renkle kapatılamaz. Kural:
- Eylem kimliği **yalnız** 3 px dikey şerit + ikon olarak, kartın **sol kenarında** görünür.
- Uyarı **yalnız** kart altındaki 20 px rozet olarak, **⚠ ikon + Türkçe metin** ile görünür (ör. "1 uyarı"). Dolgu `rgba(230,178,74,0.16)`, sınır `rgba(230,178,74,0.45)`.
- Konum, form ve metin farklı olduğu için renk hiçbir zaman tek taşıyıcı değildir (§25.1, satır 1861).

**(c) Sensör (#3FB6AE) ile mantık (#6AA9F0) parlaklık farkı 1.00:1'dir** — yalnız ton farkı vardır, renk körlüğünde ayrılmazlar. Bu yüzden her node kartı **zorunlu olarak** tür ikonu + tür adı taşır (§9.2). Renk, kimliğin üçüncü kanalıdır; birinci ve ikinci kanal ikon ve metindir.

---

## 4. Tipografi ve ölçü ölçeği

### 4.1 Tipografi (§71.3.2'den türetilmiş, protokol ekranı somutlaması)

| Kullanım | Boyut / satır yüksekliği | Ağırlık | Renk | Harf aralığı |
|---|---|---|---|---|
| Üst bardaki protokol adı | 20 / 28 px | 600 | `text.primary` | 0 |
| Panel başlığı ("Düğüm Ayarları", "Protokoller") | 18 / 24 px | 600 | `text.primary` | 0.06em |
| Section başlığı (sağ panel blokları) | 12 / 16 px | 600 | `text.secondary` | 0.10em, büyük harf |
| Node tür adı (kart başlığı) | 13 / 16 px | 600 | `text.primary` | 0.04em |
| Node özet satırı | 13 / 18 px | 400 | `text.secondary` | 0 |
| Node port etiketi | 11 / 14 px | 500 | `protocol.text.faint` | 0 |
| Gövde metni / alan değeri | 14 / 20 px | 400 | `text.primary` | 0 |
| Alan etiketi | 13 / 18 px | 500 | `text.secondary` | 0 |
| Yardım metni, rozet | 12 / 16 px | 500 | `protocol.text.faint` | 0 |

Alt sınır §25.3 (satır 1878) gereği **12 px**; hiçbir yüzeyde 12 px'in altına inilmez. UI ölçekleme %90–150 arasında bu ölçek çarpanla uygulanır; node kart genişliği de aynı çarpanla ölçeklenir (aksi halde metin taşar).

### 4.2 Ölçü ölçeği

Taban ızgara **8 px**. İzinli boşluklar: `4 · 8 · 12 · 16 · 24 · 32 · 40`.
Yarıçaplar §71.3.3'ten: panel 18 · buton 14 · input 12 · rozet 999.
**Node kartı yarıçapı: 14 px** — buton ailesiyle aynı; 18 px panel yarıçapı 192 px genişlikte kart için orantısız durur.

---

## 5. Ekran yerleşimi

### 5.1 Desktop ana yerleşim (≥1440 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ÜST BAR  64 px                                                          │
│  [◂ Protokoller] Protokol adı  ⟨Aktif⟩   │  ⟲ ⟳  −  %100  +  ⤢  │ Kontrol Et │ Uygula │
├───────────────┬──────────────────────────────────────┬───────────────────┤
│ SOL PANEL     │  GRAPH CANVAS                        │  SAĞ PANEL        │
│ 320 px        │  kalan genişlik (≥640 px)            │  360 px           │
│               │                                      │                   │
│ Protokoller   │   · · · · · · · · · · · · · · ·      │  Düğüm Ayarları   │
│ ────────────  │   · ┌──────────┐    ┌──────────┐     │  ───────────────  │
│ [ara…]        │   · │Tetikleyici│──▸│Karşılaştır│    │  ▣ Tetikleyici    │
│ ○ Protokol A  │   · └──────────┘    └──────────┘     │  kısa açıklama    │
│ ○ Protokol B  │   ·                                  │  ── ÖLÇÜM ──      │
│ ○ Taslak C    │   · · · · · · · · · · · · · · ·      │  [ … ]            │
│               │                                      │                   │
│ + Yeni Protokol│  ┌ düğüm paleti (canvas sol-alt) ┐  │  Düğümü Sil       │
├───────────────┴──────────────────────────────────────┴───────────────────┤
│  ALT NAVİGASYON  72 px      KOLONİ  │  PROTOKOLLER ▣  │  HATA AYIKLAMA   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Kırılım noktaları ve hesaplanmış canvas genişlikleri

| Kırılım | Sol | Sağ | Canvas genişliği | Canvas yüksekliği | Davranış |
|---|---:|---:|---:|---:|---|
| ≥1440 px | 320 | 360 | `W − 680` (1920'de **1240 px**, 1440'ta **760 px**) | `H − 136` (1080'de **944 px**) | Tam üç sütun |
| 1280–1439 | 300 | 340 | `W − 640` (1280'de **640 px**) | `H − 136` | Aralığın alt sınırı (5424/5426) |
| 1024–1279 | 64 (ikon rayı) | 360 (üstte katman) | `W − 64` | `H − 136` | Sağ panel canvas üzerine kayar; `shadow.panel` + 1 px sınır |
| <1024 | — | — | `W` | `H − 56 − 64` | Yığılmış düzen, §5.3 |

Canvas her kırılımda ekranın en geniş bölgesidir (K-03, satır 5425). 1280 px'te 640 px canvas, 192 px'lik iki node'u ve aralarındaki 96 px'lik kenar boşluğunu barındırır — ölçü kontrolü yapılmıştır.

### 5.3 Mobil / yığılmış düzen (<1024 px) — §71.17.3, satır 5259–5263

- Üst bar 56 px'e iner; protokol adı + durum kalır, aksiyonlar `⋯` menüsüne toplanır; **Kontrol Et / Uygula** canvas altında sabit 64 px'lik aksiyon şeridine taşınır (birincil aksiyon hiçbir zaman menüye gizlenmez).
- Sol panel, üst bardaki protokol adına dokununca açılan tam genişlik listeye dönüşür.
- Sağ panel **alt sheet** olur: kapalı yükseklik 0, açık yükseklik `min(62vh, 560px)`, sürükleme tutamağı 4×36 px, üst yarıçap 18 px.
- Node dokunma hitbox'ı kart alanının tamamı; port hitbox'ı 44 px (§25.4, satır 1882).
- Canvas'ta tek parmak = kaydırma, iki parmak = yakınlaştırma; node sürükleme yalnız 180 ms basılı tutmadan sonra başlar (yanlışlıkla taşımayı engeller).

---

## 6. Üst bar (64 px)

Yükseklik gerekçesi: §71.4.2'de `IconButton normal` 48 px; 48 + 2×8 px dikey boşluk = 64 px. §72.6 satır 5427 içerik listesini verir, yükseklik vermez.

| Bölge | İçerik | Ölçü |
|---|---|---|
| Sol | `◂` geri (48 px IconButton) · protokol adı (20 px, düzenlenebilir) · durum rozeti | 16 px iç boşluk, öğeler arası 12 px |
| Orta | `⟲ Geri Al` `⟳ İleri Al` · ayraç · `−` `%100` `+` · `⤢ Ekrana sığdır` | 40 px IconButton (small), aralarında 4 px; ayraç 1 px × 24 px `panel.separator` |
| Sağ | **Kontrol Et** (Secondary, 48×140) · **Uygula** (Primary, 48×140) | aralarında 12 px, sağ iç boşluk 16 px |

- Zemin `bg.panel` + `panel.blur 16px`, alt sınır 1 px `protocol.panel.border` (3.15:1).
- Durum rozeti: `Aktif` (success), `Taslak` (warning), `Devre Dışı` (nötr). Rozet = 16% tint dolgu + 1 px 45% sınır + **ikon + metin** (§25.1). Ölçülen metin kontrastları §14.4.
- `Uygula`, taslakta doğrulanmamış değişiklik varken **Disabled** (§71.4.3): opaklık 0.45, hover/press tepkisi yok. Faz 6/3 draft/apply akışının görsel karşılığıdır.
- Kaydedilmemiş değişiklik varken protokol adının yanında 6 px `state.info` noktası + "kaydedilmedi" metni.

---

## 7. Sol panel (320 px) — protokol listesi

§72.6 satır 5424: "Protocol list / hızlı geçiş + Yeni Protokol". §71.8.3 (4977–4982) kart içeriğini verir.

- Yapı: başlık (48 px) → arama alanı (40 px) → liste → alt sabit `+ Yeni Protokol` (48 px Secondary, tam genişlik).
- Kart: yükseklik 72 px, iç boşluk 12 px, yarıçap 14 px, aralık 8 px.
  - 1. satır: protokol adı (14 px/600) + durum rozeti (sağa hizalı)
  - 2. satır: öncelik + son çalışma zamanı (12 px, `text.muted`)
- Aktif/taslak ayrımı (§71.8.3 satır 4981): liste iki bölüme ayrılır — "Aktif" ve "Taslaklar" — 12 px büyük harf section başlığıyla. **Bu bir klasör/grup sistemi değildir**; sabit, kullanıcı tarafından oluşturulamayan iki durum bölümüdür (K-17, satır 5447).
- Hover: kart zemini `rgba(84,154,195,0.06)`, sınır `protocol.node.border.hover`. Boyut sıçraması yok (§71.4.6, satır 4782).
- Seçili kart: 1 px `border.selected` + sol kenarda 3 px accent şerit.
- 1024–1279 px'te panel 64 px ikon rayına iner: yalnız durum noktaları + `+` düğmesi; üzerine gelince 240 px'lik uçan liste açılır.

---

## 8. Graph canvas

| Özellik | Değer | Dayanak |
|---|---|---|
| Zemin | düz `#081521` — degrade yok, doku yok, görsel yok | 5430, K-08 |
| Izgara | 24 px aralıklı 1.5 px nokta, `rgba(120,170,205,0.12)` = **1.21:1** | 5430 "çok hafif" |
| Izgara %60 altı zoom'da | gizlenir (nokta yoğunluğu gürültüye dönüşür) | 5430 |
| Node yerleşim adımı | 12 px (nokta aralığının yarısı) | — |
| Zoom | %40 – %160, adım %10, varsayılan %100 | 5427 |
| %60 altı zoom | port etiketleri ve node özet satırı gizlenir; tür adı kalır | okunabilirlik |
| Kaydırma | boş alanda sürükleme · tekerlek dikey · Shift+tekerlek yatay | — |
| Kenar boşluğu | node'lar canvas kenarına 32 px'ten yakın konumlanamaz | — |

**Düğüm paleti** canvas'ın sol-alt köşesinde 16 px içeride, yüzen panel olarak durur: 6 kanonik node için 6 satır, her satır 40 px, ikon + ad. Genişlik 200 px, `bg.panel.elevated` + 1 px `panel.border`. Palet **kapalı bir listedir**; arama kutusu yoktur (arama, listede olmayan bir şey aranabileceğini ima eder — K-16).

---

## 9. Node kartı

### 9.1 Ölçüler

| Ölçü | Değer | Dayanak |
|---|---|---|
| Genişlik | **192 px** (tüm türler) | 5431 (170–220) |
| Başlık şeridi | 36 px | — |
| Kimlik şeridi | sol kenarda 3 px × kart yüksekliği, kart yarıçapına uyar | K-13 |
| İç boşluk | yatay 12 px (kimlik şeridi dahil 15 px), dikey 12 px | 8-grid |
| Port satır aralığı | 26 px; ilk port satırı merkezinin kart üstüne uzaklığı 56 px | §10 |
| Yarıçap | 14 px | §4.2 |
| Sınır | 1 px (`selected` durumunda 1.5 px) | §71.3.3 |
| Gölge | `0 6px 20px rgba(0,0,0,0.28)` | §71.3.3 türevi |

**Tür başına yükseklik** (port satırı sayısı ve özet satırından hesaplanmıştır):

| Node | Giriş portu | Çıkış portu | Özet satırı | Yükseklik |
|---|---:|---:|---:|---:|
| Tetikleyici | 0 | 1 | 2 | **104 px** |
| Sensör | 0 | 1 | 1 | **84 px** |
| Karşılaştır | 3 (veya 2) | 3 | 1 | **134 px** |
| VE | 3 | 3 | 0 | **134 px** |
| Geciktir | 1 | 1 | 1 | **84 px** |
| Eylem | 1 | 0 | 2 | **104 px** |

Hesap: `36 (başlık) + 8 (boşluk) + n×26 (port/özet satırları) + 14 (alt boşluk)`; `n = max(giriş, çıkış, özet)`.

### 9.2 Kart anatomisi (üstten alta)

1. **Kimlik şeridi** — sol kenarda 3 px, kimlik rengi (§3.3).
2. **Başlık şeridi (36 px)** — 16 px kimlik ikonu + tür adı (13 px/600) + sağda durum işareti (yalnız hata/uyarı varsa).
3. **Gövde** — 0–2 özet satırı (13 px, `text.secondary`), doğal Türkçe, değer yoksa `protocol.text.faint` ile "seçilmedi".
4. **Port satırları** — sol kenarda giriş, sağ kenarda çıkış noktaları + kart içine bakan 11 px etiket.
5. **Alt rozet (koşullu)** — hata veya uyarı varsa 20 px rozet.

Tür ikonu + tür adı **her zaman** birlikte görünür (§3.4c gerekçesi; §25.1 satır 1861).

### 9.3 Altı kanonik node — kapalı liste

> §72.6 satır 5446: yalnız Karşılaştır + VE + Geciktir mantık node'ları. **VEYA / DEĞİL / Sayaç / Splitter / Zamanlayıcı / Cooldown bu fazda yoktur ve palette görünmez.** Kod tarafı da aynı listeyi taşır: `PROTOCOL_NODE_KINDS = ['trigger','sensor','compare','and','delay','action']` (`Protocol.ts:14`).

| # | Ekrandaki ad | Kod `kind` | İkon yönü | Kimlik | Kart özeti (doğal Türkçe kalıp) |
|---|---|---|---|---|---|
| 1 | **Tetikleyici** | `trigger` | dolu daire → ok (başlangıç) | `#39BFFF` | 1. satır: ölçüm adı · 2. satır: "%40 altına düşerse" |
| 2 | **Sensör** | `sensor` | daire içinde nokta (ölçüm) | `#3FB6AE` | "Reaktör · Enerji" (tesis · ölçüm) |
| 3 | **Karşılaştır** | `compare` | iki yatay çizgi + eşitsizlik | `#6AA9F0` | "%40 değerinin altındaysa" veya "iki ölçümü karşılaştırır" |
| 4 | **VE** | `and` | birleşen iki çizgi | `#6AA9F0` | özet satırı yok |
| 5 | **Geciktir** | `delay` | saat kadranı | `#9DB7C8` | "15 dakika bekler" |
| 6 | **Eylem** | `action` | kaydırıcı/ayar kolu | `#F0A94C` | 1. satır: hedef tesis · 2. satır: yapılacak ayar + değer |

### 9.4 Türler arasında **değişmeyen** şeyler

Yüzey rengi, başlık yüksekliği, yarıçap, sınır rengi, gölge, tipografi, port görünümü, iç boşluk. §72.6 satır 5431 "sade, modüler, aynı aileden" bunu gerektirir. Tür ayrımı **yalnız** üç yerde: kimlik şeridi, ikon, ad.

### 9.5 Node durum tablosu

| Durum | Sınır | Yüzey | Gölge / parıltı | Ek işaret | Süre | Dayanak |
|---|---|---|---|---|---|---|
| **Varsayılan** | 1 px `#467190` | `rgba(16,34,48,0.94)` | `0 6px 20px rgba(0,0,0,0.28)` | — | — | 5431 |
| **Hover** | 1 px `#5A8AAB` | +`rgba(84,154,195,0.05)` katman | aynı | işaretçi `grab` | 120 ms (`motion.fast`) | 5443 |
| **Seçili** | 1.5 px `#4ABEFF` | aynı | `protocol.glow.selected` (tek katman) | sağ panel bu node'u açar | 180 ms (`motion.normal`) | 5442 |
| **Seçili + hover** | 1.5 px `#67D0FF` | +%5 katman | aynı | — | 120 ms | 5442+5443 |
| **Klavye odağı** | 1.5 px `#4ABEFF` + 2 px dış halka `#67D0FF` (2 px aralık) | aynı | parıltı yok | — | 0 ms | §71.4.3 |
| **Geçersiz (hata)** | 1.5 px `#E45D5D` | aynı — **kırmızı dolgu yok** | gölge aynı, parıltı yok | başlıkta ⛔ ikon + altta hata rozeti | 180 ms | 5444, §71.8.5 |
| **Uyarılı** | 1 px `#467190` (değişmez) | aynı | aynı | altta ⚠ + "n uyarı" rozeti | — | §71.8.6 |
| **Sürükleniyor** | 1.5 px `#4ABEFF` | opaklık 0.90 | `0 12px 32px rgba(0,0,0,0.40)` | işaretçi `grabbing` | — | — |
| **Pasif / devre dışı** | 1 px `#467190`, opaklık 0.60 | opaklık 0.60 | gölge yok | — | — | §71.8.6 (5004) |

Notlar:
- **Geçersiz + seçili** aynı anda olabilir: sınır danger kalır, parıltı `rgba(228,93,93,0.10)` olur. Hata bilgisi seçim bilgisini bastırmaz.
- Pasif node'un 0.60 opaklıktaki sınırı canvas'a karşı 1.73:1'dir; WCAG 1.4.11 devre dışı bileşenleri kapsam dışı bıraktığı için bu kabul edilir. Pasiflik ayrıca sağ panelde metinle bildirilir.
- Hiçbir durumda kart dolgusu renklenmez (§71.8.5, satır 4998 "kırmızıyla çığlık atmaz").

---

## 10. Portlar

Port şeması `protocolValidator.ts:42–76`'dan birebir alınmıştır — tasarım yeni port icat etmez.

| Node | Girişler (sol) | Çıkışlar (sağ) |
|---|---|---|
| Tetikleyici | — | `out` |
| Sensör | — | `value` |
| Karşılaştır | `in`, `left`, `right`¹ | `whenTrue`, `whenFalse`, `result` |
| VE | `in`, `a`, `b` | `whenTrue`, `whenFalse`, `result` |
| Geciktir | `in` | `out` |
| Eylem | `in` | — |

¹ `right` girişi yalnız sabit değer **girilmediğinde** görünür (`protocolValidator.ts:48–50`). Sağ paneldeki "Neyle karşılaştırılsın?" seçimi bu portu doğrudan açar/kapatır — §12.4.

### 10.1 Port etiket sözlüğü (teknik ad → ekran metni)

| Kod portu | Ekranda | Neden |
|---|---|---|
| `in` | **Akış** | "flow"/"pulse" jargonu yasak (5455) |
| `out` | **Akış** | aynı |
| `value` | **Ölçüm** | sensörün okuduğu şey |
| `left` | **Değer** | — |
| `right` | **İkinci değer** | — |
| `a` | **1. koşul** | "boolean" yasak (5455) |
| `b` | **2. koşul** | aynı |
| `whenTrue` | **Evet** | doğal Türkçe |
| `whenFalse` | **Hayır** | doğal Türkçe |
| `result` | **Sonuç** | — |

### 10.2 Port görünümü ve hitbox

| Özellik | Değer | Dayanak |
|---|---|---|
| Görünür nokta | 10 px çap | 5432 "küçük ama görünür" |
| Halka | 2 px `protocol.canvas.base` (kart kenarında da okunur) | — |
| Boş port rengi | `#39BFFF` (node üzerinde 7.86:1, canvas üzerinde 8.84:1) | 5432 "cyan noktalar" |
| Bağlı port | içi dolu `#39BFFF`, dışı 1 px `#67D0FF` | — |
| İşaretçi hitbox | 24 × 24 px (görünenin 2.4 katı) | 5432 |
| Dokunma hitbox | 44 × 44 px | §25.4, satır 1882 |
| Bağlanabilir port (sürükleme sırasında) | 12 px'e büyür + `0 0 0 4px rgba(57,191,255,0.18)` | — |
| Bağlanamaz port (sürükleme sırasında) | opaklık 0.35, hitbox kapalı | 5444 önlemesi |
| Zorunlu ama boş port | 1.5 px `#E45D5D` halka (doğrulamadan **sonra**, önce değil) | 5444 |

**Sürükleme sırasında uyumsuz portlar sönümlenerek geçersiz bağlantı büyük ölçüde önlenir** — hata göstermek yerine hatayı engellemek §72.6 satır 5444'ün ("kontrollü kırmızı") ruhuna uygundur.

---

## 11. Kenarlar (bağlantılar)

### 11.1 Kenar sınıfları

| Sınıf | Nereden nereye | Kalınlık | Renk | Çizgi | Etiket |
|---|---|---:|---|---|---|
| **Akış** | `out`/`whenTrue`→`in` | 1.5 px | `edge.flow` (4.89:1) | düz | yok |
| **Evet** | `whenTrue` → `in` | 1.5 px | `edge.flow` | düz | "Evet" |
| **Hayır** | `whenFalse` → `in` | 1.5 px | `edge.negative` (4.07:1) | kesikli 6/4 | "Hayır" |
| **Ölçüm** | `value`/`result` → `left`/`right`/`a`/`b` | 1.25 px | `edge.value` (4.26:1) | noktalı 2/3 | yok |

### 11.2 §25.2 uyumu (satır 1874)

"TRUE/FALSE graph path yalnız yeşil/kırmızı değildir; label/line style da farklıdır."
Evet/Hayır ayrımı **üç kanalla** taşınır: (1) renk cyan/nötr, (2) çizgi düz/kesikli, (3) kenar ortasındaki etiket. Ayrıca yeşil/kırmızı **kullanılmaz** — kırmızı bu ekranda yalnız geçersizlik semantiğine ayrılmıştır.

### 11.3 Çizim kuralları

- Bezier eğrisi, yatay kontrol noktası `min(80, mesafe/2)` px.
- Kesişimde üstteki kenar 4 px canvas rengiyle kesilir → "kesişimlerde görsel karmaşa yaratma" (5433).
- Etiket: 11 px, `bg.panel` üzerinde 4 px yatay iç boşluk, 999 px yarıçap; kenarın orta noktasında.
- Hover: kalınlık +0.5 px, renk `accent.hover`; kaldırma `×` düğmesi (24 px hitbox) orta noktada belirir.
- Node seçiliyken bağlı olmayan tüm kenarlar `edge.dim`e (2.42:1) iner — kalabalık grafikte odak sağlar. Bu geçici bir vurgu durumudur; kalıcı okuma hali değildir.
- Geçersiz kenar: 1.5 px `state.danger`, düz çizgi, orta noktada ⛔ rozeti.

---

## 12. Sağ panel — Düğüm Ayarları (360 px)

§72.6 satır 5450–5455 ve §71.5.2 panel iç düzenine uyar.

### 12.1 Panel iskeleti

```
┌─ 360 px ────────────────────────┐
│ 16px iç boşluk                  │
│ [ikon 24] Tetikleyici        [×]│  ← başlık, 48 px
│ Protokolü başlatan koşul.       │  ← kısa açıklama, 13 px, text.secondary
│ ─────────────────────────────── │  ← separator #24404F
│ ÖLÇÜM                           │  ← section başlığı 12/600/0.10em
│ [ Ölçüm seç              ▾ ]    │  ← alan 40 px
│ Bu ölçüm hangi tesisten okunsun?│  ← yardım metni 12 px
│ ─────────────────────────────── │
│ KOŞUL                           │
│ [ değerin altına düşerse ▾ ]    │
│ [ 40 ]                     %    │
│ ─────────────────────────────── │
│ ⛔ <tr.protocol.error.*>         │  ← bulgu bloğu (koşullu)
│                                 │
│ ⋮ (esner)                       │
│ [ Düğümü Sil ]                  │  ← Danger, en altta, 44 px
└─────────────────────────────────┘
```

- Zemin `bg.panel` + blur 16 px, sol sınır 1 px `protocol.panel.border`.
- Alanlar: yükseklik 40 px, zemin `protocol.field.surface`, sınır 1 px `protocol.panel.border`, yarıçap 12 px; odakta sınır `accent.primary` + 2 px dış halka `rgba(57,191,255,0.25)`.
- Hiçbir node seçili değilken panel boş durumu gösterir: "Ayarlarını görmek için bir düğüm seçin." (13 px, ortalanmış, `text.secondary`). Panel **kapanmaz** — düzen sıçraması olmaz.
- **Düğümü Sil**: Danger + Ghost ağırlığı (dolgu yok, 1 px `state.danger` sınır, metin `state.danger`, panel üzerinde 5.38:1), 44 px yükseklik, üstünde 24 px boşluk. Onay modalı **yok**; silme sonrası 4 sn'lik "Düğüm silindi · Geri Al" toast'u gösterilir (üst bardaki geri alma ile aynı yığın). Gerekçe: §71.14.3 toast dili + geri alınabilir işlem için modal §71.14.1'i gereksiz ağırlaştırır.

### 12.2 Jargon sözlüğü (satır 5455 uygulaması)

| Kodda geçen | Ekranda **asla** | Ekranda **doğru** |
|---|---|---|
| `boolean` / doğru-yanlış | "Boolean değer" | "koşul" / "Evet" / "Hayır" |
| `flow` / `pulse` / execution | "akış darbesi", "execution" | "Akış", "protokol çalıştığında" |
| `node` / `edge` / `port` | "node", "edge", "port" | "düğüm", "bağlantı", "bağlantı noktası" |
| `nodeId` / `protocolId` | kimlik dizesi | hiç gösterilmez |
| `threshold` | "threshold" | "Eşik değeri" |
| `operator` | "operatör" | "Koşul" |
| `actuator` / `setpointKey` | teknik ad | eylemin doğal adı (`capability` etiketi) |
| `sim tick` | "tick" | "sim. dakika" |

### 12.3 Koşul (operatör) sözlüğü

`COMPARE_OPERATORS` (`Protocol.ts:18`) → doğal Türkçe. Seçim listesi bu metinleri gösterir; kart özeti aynı kalıbı kullanır.

| Kod | Seçim listesi metni | Kart özeti kalıbı |
|---|---|---|
| `<` | değerin altına düşerse | "{ölçüm} {değer} altına düşerse" |
| `>` | değerin üstüne çıkarsa | "{ölçüm} {değer} üstüne çıkarsa" |
| `<=` | değere iner veya altına düşerse | "{ölçüm} {değer} veya altındaysa" |
| `>=` | değere çıkar veya üstüne geçerse | "{ölçüm} {değer} veya üstündeyse" |
| `=` | değere eşit olursa | "{ölçüm} tam {değer} ise" |
| `!=` | değerden farklı olursa | "{ölçüm} {değer} değilse" |

### 12.4 Node başına alan tabloları

Alanlar **yalnız** `Protocol.ts`'teki gerçek alanlardan türetilmiştir (satır 5452: "yalnız o node'a ait gerçek editable alanlar"). Seçenek listeleri `ProtocolCapabilities`'ten gelir; tasarım hiçbir ölçüm/eylem adı uydurmaz (K-18).

**1. Tetikleyici** (`ProtocolTriggerNode`, `Protocol.ts:45–51`)

| Alan | Kod alanı | Etiket | Tip | Zorunlu | Yardım metni |
|---|---|---|---|---|---|
| Tesis | `facilityId` | Tesis | seçim (varsayılan "Tüm tesisler") | hayır | "Boş bırakılırsa koloni genelindeki ölçüm kullanılır." |
| Ölçüm | `sensorId` | Ölçüm | seçim | **evet** | — |
| Koşul | `operator` | Koşul | seçim (§12.3) | **evet** | — |
| Eşik | `threshold` | Eşik değeri | sayı / seçim (ölçümün türüne göre) | **evet** | ölçümün birimi son ek olarak gösterilir |

**2. Sensör** (`ProtocolSensorNode`, `Protocol.ts:54–58`)

| Alan | Kod alanı | Etiket | Tip | Zorunlu |
|---|---|---|---|---|
| Tesis | `facilityId` | Tesis | seçim | hayır |
| Ölçüm | `sensorId` | Ölçüm | seçim | **evet** |

Panel açıklaması: "Bu düğüm yalnız bir değeri okur; protokolü kendi başına başlatmaz." (`Protocol.ts:53` yorumunun oyuncu diline çevirisi — §11 spec kuralı.)

**3. Karşılaştır** (`ProtocolCompareNode`, `Protocol.ts:60–65`)

| Alan | Kod alanı | Etiket | Tip | Zorunlu |
|---|---|---|---|---|
| Koşul | `operator` | Koşul | seçim (§12.3) | **evet** |
| Karşılaştırma biçimi | — (`comparand` varlığını sürer) | Neyle karşılaştırılsın? | iki seçenekli segment: **Sabit bir değerle** / **Başka bir ölçümle** | **evet** |
| Sabit değer | `comparand` | Sabit değer | sayı / metin / seçim | yalnız "Sabit bir değerle" seçiliyse |

"Başka bir ölçümle" seçilince kartta **İkinci değer** bağlantı noktası belirir (`protocolValidator.ts:48–50` ile birebir). Geçiş 180 ms, kart yüksekliği değişmez (port satırı zaten ayrılmıştır).

**4. VE** (`ProtocolAndNode`, `Protocol.ts:67–69`)

Düzenlenebilir alanı **yoktur**. Panel yalnız başlık + açıklamayı gösterir: "Her iki koşul da sağlandığında akış devam eder." Ardından doğrudan **Düğümü Sil**. Sahte alan (etkisiz seçim, salt-okunur kutu) eklenmez.

**5. Geciktir** (`ProtocolDelayNode`, `Protocol.ts:71–74`)

| Alan | Kod alanı | Etiket | Tip | Zorunlu | Yardım metni |
|---|---|---|---|---|---|
| Süre | `durationMinutes` | Bekleme süresi | sayı + "sim. dakika" son eki | **evet** | "İzin verilen aralık: {min}–{max} sim. dakika." (`ProtocolValidationLimits`'ten okunur, sabit yazılmaz) |

`longDelayMinutes` aşıldığında alanın altında amber uyarı satırı: `tr.protocol.warning.long-delay`. Uygulamayı engellemez.

**6. Eylem** (`ProtocolActionNode`, `Protocol.ts:76–81`)

| Alan | Kod alanı | Etiket | Tip | Zorunlu |
|---|---|---|---|---|
| Hedef tesis | `facilityId` | Hedef tesis | seçim | `capability.requiresTarget` ise **evet** |
| Yapılacak ayar | `actionId` | Yapılacak ayar | seçim | **evet** |
| Değer | `value` | Ayarlanacak değer | `allowedValues` varsa seçim, yoksa sayı/metin | `capability.requiresValue` ise **evet** |

Alan görünürlüğü `ProtocolActionCapability` (`Protocol.ts:175–181`) tarafından belirlenir; değer gerektirmeyen bir eylemde "Değer" alanı **hiç çizilmez** (devre dışı gösterilmez).

---

## 13. Alt navigasyon (72 px)

§72.6 satır 5428 + §71.7.3. Yalnız üç sekme: **KOLONİ · PROTOKOLLER · HATA AYIKLAMA**. Dördüncü sekme yoktur (§72.2 satır 5342).
Aktif sekme (PROTOKOLLER): 1 px `border.active` + `glow.accent.soft` + `text.primary` etiket. Pasif: `bg.panel` + `text.muted`. Hover: sınır `#5A8AAB`, boyut sıçraması yok. Sekme genişliği min. 180 px, yükseklik 72 px (§71.4.2 aralığı 68–76).

---

## 14. Kontrast ölçümleri

### 14.1 Yöntem

WCAG 2.1 bağıl parlaklık (`0.2126R + 0.7152G + 0.0722B`, sRGB doğrusallaştırma eşiği 0.03928) ve `(L₁+0.05)/(L₂+0.05)` oranı. Yarı saydam token'lar **önce zemine kompozit edilmiş**, sonra ölçülmüştür. Hesap tek seferlik bir Node betiğiyle yapıldı; ürün koduna eklenmedi. Betiğin tamamı ve ham çıktısı görev raporundadır: `docs/agent-results/TASK-MSSXTSZQH1CB6-tasarimci.md` (§2 Kanıt).

**Kompozit yüzeyler:** canvas `#081521` · node gövdesi `#10212F` · node başlığı `#162F3E` · panel `#07131D` · yükseltilmiş panel `#0A1B27`

### 14.2 Metin kontrastları (eşik: normal metin 4.5:1)

| Metin token | node gövdesi | node başlığı | panel | Sonuç |
|---|---:|---:|---:|---|
| `text.primary #EAF4FF` | 14.74:1 | 12.50:1 | 16.86:1 | ✅ |
| `text.secondary #9DB7C8` | 7.84:1 | 6.65:1 | 8.97:1 | ✅ |
| `protocol.text.faint #8199A8` | 5.51:1 | 4.67:1 | 6.30:1 | ✅ |
| `color.text.muted #6E8899` | 4.41:1 | 3.74:1 | 5.04:1 | ⚠ node içinde **kullanılmaz** (§3.2) |

### 14.3 Arayüz bileşeni kontrastları (eşik: 3:1 — WCAG 1.4.11)

| Token | canvas'a karşı | node yüzeyine karşı | Sonuç |
|---|---:|---:|---|
| `node.border` `#467190` | 3.53:1 | 3.14:1 | ✅ |
| `node.border.hover` `#5A8AAB` | 4.97:1 | 4.42:1 | ✅ |
| `node.border.selected` `#4ABEFF` | 8.86:1 | 7.89:1 | ✅ |
| `node.border.invalid` `#E45D5D` | 5.29:1 | 4.70:1 | ✅ |
| `panel.border` `#406884` | 3.10:1 | 3.15:1 (panele karşı) | ✅ |
| port `#39BFFF` | 8.84:1 | 7.86:1 | ✅ |
| `edge.flow` (kompozit `#2A8CBC`) | 4.89:1 | — | ✅ |
| `edge.value` (kompozit `#2E8684`) | 4.26:1 | — | ✅ |
| `edge.negative` (kompozit `#647989`) | 4.07:1 | — | ✅ |
| `edge.dim` (kompozit `#445664`) | 2.42:1 | — | ⚠ yalnız geçici sönümleme; kalıcı okuma hali değil |
| `canvas.dot` (kompozit `#152736`) | 1.21:1 | — | ✅ dekoratif (kasıtlı) |
| pasif node sınırı (0.60 opaklık) | 1.73:1 | — | ⚠ devre dışı bileşen — 1.4.11 kapsam dışı |

**Node gövdesi ile canvas arasındaki dolgu farkı yalnız 1.12:1'dir.** Bu nedenle kartın sınırı dekoratif değil, **taşıyıcıdır**: §71.3.1'deki `color.border.soft rgba(84,154,195,0.20)` (canvas'a karşı 1.35:1) bu ekranda node sınırı olarak kullanılamaz; yerine `#467190` (3.53:1) tanımlandı. Bu, §71.3.1'in "exact hex değerler final değildir; ton ailesi ve kontrast mantığı korunmalıdır" notu (satır 4690) kapsamındadır — ton ailesi aynıdır, yalnız yoğunluk yükseltilmiştir.

### 14.4 Rozet kontrastları (16% tint dolgu üzerinde tint metin)

| Rozet | node üzerinde dolgu / metin | panel üzerinde dolgu / metin |
|---|---|---|
| Uyarı `#E6B24A` | `#323833` / 6.19:1 ✅ | `#2B2C24` / 7.28:1 ✅ |
| Hata `#E45D5D` | `#322B36` / 3.92:1 ⚠ | `#2A1F27` / 4.55:1 ✅ |
| Aktif `#4FC98E` | `#1A3C3E` / 5.73:1 ✅ | `#13302F` / 6.76:1 ✅ |
| Bilgi `#61CFFF` | `#1D3D50` / 6.47:1 ✅ | `#153141` / 7.68:1 ✅ |

⚠ Kural: **node kartı üzerindeki hata rozetinin metni `text.primary #EAF4FF` ile yazılır** (dolgu üzerinde 12.2:1); `state.danger` yalnız ikon ve sınırda kullanılır. Panelde tint metin serbesttir.

### 14.5 Renk körlüğü riski (ölçülmüş)

| Çift | Parlaklık oranı | Sonuç |
|---|---:|---|
| Sensör `#3FB6AE` ↔ Mantık `#6AA9F0` | **1.00:1** | Yalnız ton farkı → ikon + ad zorunlu (§9.2) |
| Eylem `#F0A94C` ↔ Uyarı `#E6B24A` | **1.03:1** | Form + konum + metin ile ayrılır (§3.4b) |
| Tetikleyici `#39BFFF` ↔ Mantık `#6AA9F0` | 1.18:1 | Aynı kural |

Bu üç ölçüm, "kimlik rengi tek başına bilgi taşımaz" kuralının gerekçesidir (§25.1, satır 1861).

---

## 15. Yasak listesi — uygulama denetimi

Faz 6/2 ve 6/4 kapılarında bu liste madde madde denetlenir.

| # | Yasak | Dayanak | Bu tasarımdaki karşılığı |
|---|---|---|---|
| Y-01 | Node'ların arkasında **yıldız / uzay / nebula** görseli | 5430 | Canvas düz `#081521` + dot; başka katman yok (§8) |
| Y-02 | **Folder / "Protokol Grupları"** | 5447 | Sol panelde yalnız iki sabit durum bölümü; kullanıcı klasör oluşturamaz (§7) |
| Y-03 | **VEYA / DEĞİL / Sayaç / Splitter** node'u | 5446 | Palet 6 satır, kapalı liste (§8, §9.3) |
| Y-04 | Kanonik olmayan node / resource / savunma sistemi uydurma | 5448 | Bütün seçenekler `ProtocolCapabilities`'ten (§12.4) |
| Y-05 | **Teknik jargon etiketi** (boolean, pulse, port, node id, execution) | 5455 | §12.2 sözlüğü + §10.1 port sözlüğü |
| Y-06 | Ekran genelinde **aşırı accent** / parlak glow | 5421 | Glow yalnız `selected`; tek katman; `motion` §16 |
| Y-07 | Kırmızı dolgulu / bağıran hata gösterimi | 5444, §71.8.5 | Yalnız 1.5 px sınır + ikon + Türkçe metin (§9.5) |
| Y-08 | Dördüncü ana sekme | §72.2 satır 5342 | Alt nav üç sekme (§13) |
| Y-09 | Türe göre farklı kart iskeleti / çok renkli kartlar | 5431, 5440 | Tek iskelet + 3 px kimlik şeridi (§9.4) |
| Y-10 | 12 px altı metin | §25.3 satır 1878 | En küçük ölçek 12 px (§4.1) |
| Y-11 | Yalnız renge dayalı Evet/Hayır ayrımı | §25.2 satır 1874 | Renk + çizgi stili + etiket (§11.2) |
| Y-12 | 44 px altı dokunma hedefi | §25.4 satır 1882 | Port dokunma hitbox 44 px (§10.2) |

---

## 16. Hareket (motion)

§71.3.4 token'ları (satır 4718–4728) bu ekranda şöyle uygulanır:

| Etkileşim | Süre | Yumuşatma |
|---|---:|---|
| Node hover sınırı | 120 ms (`motion.fast`) | `easing.standard` |
| Node seçimi (sınır + parıltı) | 180 ms (`motion.normal`) | `easing.standard` |
| Sağ panel içerik değişimi | 180 ms geçiş (opaklık + 8 px kayma) | `easing.standard` |
| Alt sheet açılışı (mobil) | 240 ms (`motion.slow`) | `easing.emphasis` |
| Zoom adımı | 180 ms | `easing.standard` |
| Kenar çizimi (sürükleme) | anlık, geçiş yok | — |
| Toast (silme geri alma) | 180 ms giriş, 4 sn bekleme | `easing.standard` |

**Reduced Motion açıkken** (satır 4728): tüm süreler 0 ms'e iner, seçim parıltısı yalnız sınıra düşer (dış gölge katmanı kapanır), alt sheet kaymadan görünür. Bilgi kaybı olmaz çünkü hiçbir durum yalnız animasyonla anlatılmaz.

---

## 17. Doğrulama bulgularının görsel karşılığı

`ProtocolValidationFinding` (`Protocol.ts:242–247`) → ekran. **Metinler `src/localization/tr.ts` içinde zaten vardır; yeni metin yazılmaz** (satır 5444 "doğal Türkçe hata açıklaması" karşılanmış durumdadır).

### 17.1 Hatalar (Uygula'yı engeller — `state.danger`)

| Kod | Görsel hedef | Nerede görünür |
|---|---|---|
| `trigger-missing` | protokol düzeyi | Üst bardaki Kontrol Et sonuç bloğu; hiçbir node işaretlenmez |
| `multiple-root-triggers` | tüm Tetikleyici node'ları | Her birinde geçersiz sınır + rozet |
| `action-required-field-missing` | Eylem node'u | Node sınırı + sağ panelde ilgili alanın altında |
| `action-value-type` | Eylem node'u | Node sınırı + "Ayarlanacak değer" alanı |
| `compare-operand-type` | Karşılaştır node'u + iki gelen kenar | Node sınırı + kenarlar danger |
| `compare-operand-missing` | Karşılaştır node'u | Node sınırı + boş bağlantı noktasında danger halka |
| `and-input-missing` | VE node'u | Node sınırı + boş "1./2. koşul" noktasında halka |
| `graph-cycle` | döngüdeki kenarlar | Kenarlar danger; node'lar işaretlenmez (sorun bağlantıdadır) |
| `delay-duration-out-of-range` | Geciktir node'u | Node sınırı + "Bekleme süresi" alanı |
| `edge-port-incompatible` | ilgili kenar | Kenar danger + orta noktada ⛔ rozeti |
| `capability-unavailable` | Tetikleyici / Sensör / Eylem | Node sınırı + ilgili seçim alanı |
| `deleted-facility-reference` | ilgili node | Node sınırı + "Tesis" alanı |

### 17.2 Uyarılar (Uygula'yı engellemez — `state.warning`, sınır **değişmez**)

| Kod | Görsel hedef |
|---|---|
| `action-value-unchanged` | Eylem node'u alt rozeti + panelde satır |
| `no-affected-facility` | protokol düzeyi (Kontrol Et bloğu) |
| `potential-conflict` | Eylem node'u alt rozeti |
| `threshold-oscillation-risk` | Tetikleyici node'u alt rozeti |
| `long-delay` | Geciktir node'u alt rozeti |

### 17.3 Kontrol Et sonuç bloğu

Üst bardaki **Kontrol Et**'e basıldığında canvas'ın üstünde 8 px içeride, canvas genişliğinin ortasında bir sonuç şeridi belirir (maks. 560 px, `bg.panel.elevated`, 18 px yarıçap):

- Temizse: ✓ `state.success` + "Protokol uygulanmaya hazır." → 4 sn sonra kapanır.
- Hatalıysa: ⛔ + "n sorun bulundu" + ilk üç bulgunun Türkçe metni + "Sorunlu düğüme git" bağlantısı (canvas'ı o node'a odaklar ve seçer).
- Yalnız uyarı varsa: ⚠ + "n uyarı" + "Yine de uygulanabilir." — **Uygula etkin kalır** (§53.3 semantiği).

---

## 18. Faz 6/2 için uygulama notları

1. Bu doküman **token adlarını** verir; CSS değişkeni olarak `--protocol-*` ön ekiyle tanımlanmaları önerilir. §71.3 token'ları global kalır, bu katman onları ezmez.
2. `src/styles.css` şu an prototip düzeyinde (§71 token katmanı henüz yok). Faz 6/2 token katmanını kurarken §71.3.1 tablosunun tamamını almalı, bu dokümandaki `protocol.*` token'larını üstüne eklemelidir.
3. Node ölçüleri (192 px genişlik, tür başına yükseklik, 26 px port aralığı) React Flow node tipi tanımlarında **sabit** verilmelidir; içerik uzunluğuna göre kart büyümez — uzun ölçüm adları tek satırda `…` ile kısalır, tam ad tooltip'te (§71.14.2) görünür.
4. Port kimlikleri `protocolValidator.ts`'teki adlarla birebir aynı kalmalıdır (`in`, `out`, `value`, `left`, `right`, `a`, `b`, `whenTrue`, `whenFalse`, `result`); §10.1 sözlüğü yalnız **görüntüleme** katmanıdır.
5. Bu dokümanda **hiçbir örnek ölçüm/eylem/tesis adı kanonik değildir**; ekran görüntüsü metinleri `ProtocolCapabilities` + `tr.ts` üzerinden gelir.
6. Kapsam dışı: Protocol Manager kart listesi (Faz 6/1, TASK-MSSXR0J9XIP7K — §72.5), draft/apply akışının durum makinesi (Faz 6/3), versiyonlama yüzeyi (Faz 6/4).

---

## 19. Definition of Done — bu dokümanın kendi kontrol listesi

- [x] §72.6'nın 42 satırının tamamı taranmış; her görsel talimat en az bir tabloya bağlanmış (§1 karar defteri, 23 kayıt)
- [x] Renk, tipografi, ölçü, hareket token'ları sayısal değerle verilmiş (§3, §4, §16)
- [x] Yerleşim ölçüleri spec aralıklarının içinde ve dört kırılım için hesaplanmış (§5.2)
- [x] Altı kanonik node — tam olarak altı — kimlik, ölçü, port ve alan düzeyinde tanımlanmış (§9, §10, §12.4)
- [x] Node durum tablosu sekiz durumu ölçülmüş renklerle kapsıyor (§9.5)
- [x] Kontrast oranları hesaplanmış gerçek sayılar; eşiği geçmeyen üç durum ad ve gerekçesiyle işaretlenmiş (§14)
- [x] Yasak listesi denetlenebilir maddelere çevrilmiş (§15, 12 madde)
- [x] Bütün alan/port adları Faz 5 kod modelinden türetilmiş, uydurulmamış (§10, §12.4)
- [x] Hata/uyarı metinleri mevcut `tr.ts` sözlüğüne bağlanmış, yeniden yazılmamış (§17)
- [x] Kod yazılmamış, bileşen üretilmemiş, `src/app` ve `src/game` altında değişiklik yapılmamış
