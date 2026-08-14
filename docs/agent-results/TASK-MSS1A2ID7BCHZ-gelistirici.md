# TASK-MSS1A2ID7BCHZ — Koloni zemini sabit kareye alındı, taşmalar doğrulamayla kapatıldı

**Repo:** `C:\Users\Reawakened\Desktop\ObserverOS` · **Branch:** `phase-4-deterministic-layout`
**Tarih:** 2026-08-14 · **Durum:** tamamlandı, uçtan uca doğrulandı (typecheck + build + lint + 273/273 test + gerçek tarayıcı)

---

## 1. Kök neden (görevde tarif edilen iki maddenin doğrulanması)

**(1) `layoutGenerator.ts` — zemin içerikten türetiliyordu.**
`derivePlateauVertices()` `PLATEAU_SHAPES` siluetini alıp `deriveCameraBounds(allPoints, 3.4)`
kutusuna ölçekliyor, sonra her tepe noktasına per-vertex radyal/açısal jitter + global rotation/scale
uyguluyordu. `plan.radialJitter[i] < 1` düşen köşelerde poligon içeri çöküyor, `deriveCameraBounds`'un
3.4 birimlik payını yiyip bitiriyordu → içerik (bina/yol/kaya) zeminin dışında havada kalıyordu.
Ek olarak zemin her seed'de farklı bir poligondu, yani "aynı koloni zemini" diye bir şey yoktu.

**(2) `layoutValidation.ts` — taşma hiç yakalanmıyordu.**
`validateGeneratedLayout` tesisleri yalnız `buildable-plateau` **dikdörtgenine** (`rectContains`)
karşı kontrol ediyordu (`outside-buildable:*`). Ekranda render edilen gerçek zemin ise
`layout.plateauVertices` **poligonu**; ona karşı tek bir kontrol yoktu. Yol noktası, navigasyon
düğümü, sokak lambası, expansion pad ve prop için ise hiçbir sınır kontrolü yoktu.

---

## 2. Yapılan değişiklikler

| Dosya | Değişiklik |
|---|---|
| `src/game/world/layout/colonyGround.ts` **(yeni)** | Tek gerçek kaynak: `COLONY_GROUND_HALF_EXTENT = 22`, `COLONY_GROUND_VERTICES` (4 köşe, kare, merkezi origin), `isInsideColonyGround`, `rectCorners`, `colonyGroundOccupancyPoints`, `colonyGroundViolations`, `colonyGroundPropZones` (kenar kaya kuşağı) |
| `src/game/world/layout/layoutGenerator.ts` | `derivePlateauVertices()` **kaldırıldı**; `plateauVertices: COLONY_GROUND_VERTICES`. `derivePropZones` artık kaya kuşağını içerikten türetilen bounds'a değil **karenin dört kenarına** yerleştiriyor |
| `src/game/world/layout/layoutValidation.ts` | `ground-shape-mismatch` + `outside-ground:<kategori>:<id>` gerekçeleri. Tesis footprint köşeleri, görsel modüller, yol noktaları, nav düğümleri, lambalar, expansion pad/kapasitesi ve prop bölgeleri **render edilen zemine** karşı kontrol ediliyor |
| `src/game/world/layout/generatedLayoutSchema.ts` | `plateauVertices` `.min(6)` → `.min(4)` (kare 4 köşe; min(6) jitterli poligondan kalmaydı) |
| `src/game/world/layout/layoutQueries.ts` | Prop render'ı tek yardımcıya (`propZoneRocks`) indirildi; Default (Faz 3) modu da aynı kenar kaya kuşağını alıyor |
| `src/game/world/prototype/prototypeLayout.ts` | `PROTOTYPE_LAYOUT.plateauVertices = COLONY_GROUND_VERTICES` (Default da aynı kare). `getPrototypeWorldBounds()` Faz 3 kamera çerçevesini **dondurulmuş** sabitle koruyor (eski türetilen değerlerin birebir aynısı: `{minX:-11.7, maxX:13.3, minZ:-8.1, maxZ:8}`), böylece kare kamerayı uzaklaştırmıyor |
| `tests/world/colonyGround.test.ts` **(yeni)** | Görev maddesi 5'in (a)/(b)/(c) şartları — 10 test |
| `tests/world/structuralLayoutGenerator.test.ts` | `plateauVertices.length >= 7` iddiası (jitterli poligon varsayımı) `toEqual(COLONY_GROUND_VERTICES)` ile değiştirildi |

**Yarı-kenar neden 22?** 80 seed × 5 aday ölçümünde içeriğin ulaştığı en uzak nokta |x| = 20.034,
|z| = 14.530. 22 hem bunun üstünde kalıyor hem de 20.4–21.6 bandındaki kaya kuşağına yer bırakıyor.
`NIVALIS_TERRAIN.bounds.width` (44) ile aynı. Faz 4 jeneratörünün yerleşim mantığına, `NIVALIS_ANCHOR_SPREAD`'e
veya skorlamaya **dokunulmadı**; `cameraBounds` bilerek içerikten türetilmeye devam ediyor çünkü
`layoutScoring.compactness` (ağırlık 3, en yüksek) ondan besleniyor — sabitlenseydi derli-toplu olma
baskısı komple kaybolurdu.

---

## 3. `npm run typecheck` + `npm run build` + `npm test` (ham çıktı)

```
$ npm run typecheck

> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false

EXIT=0
```

```
$ npm run build

> gozlemci-isletim-sistemi@0.0.0 build
> tsc -b && vite build

vite v7.3.6 building client environment for production...
transforming...
✓ 382 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-DImsiLv5.css     24.60 kB │ gzip:   4.88 kB
dist/assets/index-DjDN9Y6r.js   1,542.98 kB │ gzip: 444.93 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 4.00s
EXIT=0
```
(Chunk-size uyarısı bu görevden önce de vardı, davranışsal değil.)

```
$ npm test

 ✓ tests/world/colonyGround.test.ts (10 tests) 1095ms
 ✓ tests/world/layoutGenerator.test.ts (45 tests) 7031ms
 ✓ tests/world/structuralLayoutGenerator.test.ts (28 tests) 8881ms

 Test Files  30 passed (30)
      Tests  273 passed (273)
   Duration  9.94s (transform 1.45s, collect 12.09s, tests 20.60s, prepare 3.89s)
EXIT=0
```

**273/273 PASS** — önceki 263 test + bu görevde eklenen 10 test.

```
$ npm run lint

> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .

EXIT=0
```

---

## 4. Seed sweep — `structural-generation-failed = 0` ve `outside-ground:* = 0` (ham çıktı)

```
$ runLayoutSeedSweep(60, 41001)
{
  "testedSeeds": 60,
  "valid": 60,
  "failed": 0,
  "failures": [],
  "averageCandidateCount": 3,
  "averageGenerationMs": 34.51,
  "averageStructuralSignatures": 3,
  "minimumStructuralSignatures": 3,
  "highestScore": 88.77,
  "lowestScore": 60.2
}
```

`failures: []` ⇒ sweep çıktısında hem `structural-generation-failed` hem `outside-ground:*` sıfır.

Bu yeterli değil: sweep yalnız **komple başarısız olan seed'lerin** gerekçelerini raporlar. Reddedilen
**iç adayların** gerekçelerini de saymak için 60 seed'in her biri `visualCandidateCount: 10` ile
bilerek "failure" yaptırılıp 50 iç adayın tüm reddedilme gerekçeleri toplandı:

```
$ 60 seed x 50 ic aday — reddetme gerekce aileleri
{
  "insufficient-diversity": 42,
  "road-compound-overlap": 11,
  "service-clearance": 5,
  "structural-generation-failed": 210
}
```

```
$ 60 seed x tum adaylar — zemin uyumu
{
  "candidates": 300,
  "halfExtent": 22,
  "groundMismatch": 0,
  "outsideGroundPoints": 0,
  "worstAbsoluteCoordinate": 21.6
}
```

- **`outside-ground` ailesi hiç görünmüyor (0)** — 60 seed × 50 iç adayın hiçbiri kareyi aşmadığı için
  yeni doğrulama tek bir adayı bile reddetmedi. 300 seçili adayda taşan nokta sayısı da 0;
  en dıştaki koordinat 21.6, o da kaya kuşağının dış kenarı (tasarım gereği < 22).
- **`structural-generation-failed: 210` bu göreve ait DEĞİL.** Aynı ölçüm bu görevden önceki kod
  (`HEAD` = `fac149b`) üzerinde de birebir aynı sayıları veriyor (210 / 42 / 11 / 5) — bunlar
  `chooseFacilityAnchor` yerleşim denemelerinin deterministik yeniden-denemeleri; her seed yine de
  5 geçerli aday üretiyor (`valid: 60, failed: 0`). Yani zemin değişikliği tek bir yeni reddetme
  bile eklemedi. Görev metnindeki "= 0" beklentisi `runLayoutSeedSweep` çıktısı için karşılanıyor;
  iç-aday sayımında sıfır olmayan bu değerin önceden beri var olduğunu şeffaflık için raporluyorum.

---

## 5. `tests/world/colonyGround.test.ts` (10 test, hepsi PASS)

| Test | Karşıladığı madde |
|---|---|
| kare gerçekten karedir ve merkezi origin | 5(c) — 4 köşe, genişlik = derinlik = 44, koordinat toplamları 0, her köşe \|22\| |
| 60 seed'in her adayında zemin aynı karedir (300 aday) | 5(a) — `plateauVertices` **deep-equal** `COLONY_GROUND_VERTICES` |
| Default (Faz 3) modu da aynı kareyi kullanır | 5(a) — `getGeneratedPlateauVertices(null)` |
| hiçbir tesis footprint köşesi kareyi aşmaz | 5(b) — `footprint` + `visualFootprint` 4 köşesi + görsel modüller |
| hiçbir yol noktası ve yol karosu kareyi aşmaz | 5(b) — `roads[].points` + render edilen yol karoları |
| hiçbir navigasyon düğümü kareyi aşmaz | 5(b) |
| hiçbir sokak lambası kareyi aşmaz | 5(b) |
| hiçbir genişleme padi kareyi aşmaz | 5(b) — pad konumu + footprint kapasitesi köşeleri |
| render edilen her kaya kareyi aşmaz ve dört kenarı da süsler | 5(b) + 6(3) — ≥24 kaya/aday, dört kenarın her birinde ≥1 bölge |
| kaya kuşağı tesislerin ulaştığı en dış noktanın dışında kalır | kayaların binalarla çakışmaması |

Testler `layoutQueries` üzerinden **render edilen** konumları kontrol ediyor (renderer'ın gerçekten
çizdiği veri), yalnız ham layout alanlarını değil.

---

## 6. Gerçek tarayıcı kanıtı — `npm run dev` → `/colony`

Ekran görüntüleri: [`TASK-MSS1A2ID7BCHZ-screenshots/`](./TASK-MSS1A2ID7BCHZ-screenshots/)

| # | Görüntü | İçerik |
|---|---|---|
| 1 | [01-default-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/01-default-seed41001.png) | **Default** (Faz 3 sabit yerleşim) |
| 2 | [02-adayA-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/02-adayA-seed41001.png) | Tohum 41001 · ADAY A · Merkezi omurga · 70.04 |
| 3 | [03-adayB-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/03-adayB-seed41001.png) | Tohum 41001 · ADAY B · L biçimli koloni · 63.93 |
| 4 | [04-adayC-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/04-adayC-seed41001.png) | Tohum 41001 · ADAY C · İki çekirdekli koloni · 62.72 |
| 5 | [05-adayD-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/05-adayD-seed41001.png) | Tohum 41001 · ADAY D · Ofset merkez · 78.21 |
| 6 | [06-adayE-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/06-adayE-seed41001.png) | Tohum 41001 · ADAY E · T kavşaklı koloni · 75.14 |
| 7 | [07-adayA-seed41002.png](./TASK-MSS1A2ID7BCHZ-screenshots/07-adayA-seed41002.png) | **Tohum 41002** · ADAY A · 84.17 (yeni tohum) |
| 8 | [08-adayC-seed41003.png](./TASK-MSS1A2ID7BCHZ-screenshots/08-adayC-seed41003.png) | **Tohum 41003** · ADAY C · 73.04 (yeni tohum) |

Toplam: Default + 7 farklı seed/aday kombinasyonu (madde 6'nın "en az 5" şartının üstünde).

Görüntülerin gösterdiği üç şey:
1. **Zemin hepsinde AYNI kare** — 8 görüntünün tamamında zemin, izometrik kamerada eşkenar dörtgen
   olarak görünen aynı 44×44 kare; seed/aday değişince zeminin şekli, boyutu ve konumu değişmiyor.
   Default dahil.
2. **Hiçbir bina/yol/kaya/lamba kenarı aşmıyor** — tüm tesisler, yol karoları, sokak lambaları,
   expansion pad'i ve kolonistler karenin içinde; kenarla içerik arasında görünür bir boşluk bandı var.
3. **Kenarlar kayalarla süslü** — karenin dört kenarı boyunca kaya kuşağı (kenar başına 6 bölge ×
   2 kaya = 48 kaya) her adayda ve Default'ta görünüyor.

Sahne sağlığı (panelden okunan canlı metrikler, örn. ADAY A / 41001): **FPS 142 · ms 7 · Çizim 180 ·
Üçgen 32190 · Geometri 40 · Işık 12** — sahne gerçekten render ediliyor, boş/siyah ekran yok.
Default→ADAY A→…→ADAY E→yeni tohum geçişlerinin hepsi tarayıcıda **gerçekten tıklanarak** yapıldı;
hiçbirinde hata sınırı (error boundary) metni veya donma görülmedi.

---

## 7. Dokunulmayanlar (görevin yasakları)

- Faz 4 yerleşim jeneratörünün yerleşim/çeşitlilik mantığı: `NIVALIS_ANCHOR_SPREAD`, arketipler,
  `materializeArchetype`, skorlama ağırlıkları, `cameraBounds` türetimi — **değişmedi**.
- `Default` özelliği **kaldırılmadı**; Faz 3'ün tesis/yol/kaya/sandık yerleşimi ve kamera çerçevesi
  dondurulmuş hâliyle duruyor (kamera sınırları birebir eski sayılarla sabitlendi).
- `PLATEAU_SHAPES` ve `plateauVertexCountFor` duruyor — artık zemini çizmiyor, yalnız arazi
  varyantı başına varyasyon planı boyutunu besliyor (kaldırılsaydı üretilen yerleşimler kayardı).

## 8. Bilinçli bırakılan not (kullanıcı kararı)

Kare 44×44 olduğu için **Default (Faz 3) kolonisi karenin ortasında görece küçük duruyor** —
Faz 3 yerleşimi ~25×16 birim, üretilen Faz 4 adayları ise ~40×29 birim. Kareyi küçültmek Faz 4
adaylarının taşmasına yol açacağı (ölçülen maksimum |x| = 20.034) ve jeneratörün yayılımını
daraltmak bu görevin kapsamı dışında olduğu için kare üretilen adaylara göre boyutlandırıldı.
Default'un daha sıkı bir zemin çerçevesi istenirse mod başına farklı kare boyutu ayrı bir karar
konusudur; şu anki hâl "zemin hepsinde AYNI kare" şartını sağlıyor.
