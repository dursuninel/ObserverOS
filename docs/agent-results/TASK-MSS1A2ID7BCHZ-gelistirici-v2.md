# TASK-MSS1A2ID7BCHZ · TUR 2 — Zemin 36×36'ya küçültüldü, koloni kareyi dolduruyor, /colony üretilen tasarımla açılıyor

**Repo:** `C:\Users\Reawakened\Desktop\ObserverOS` · **Branch:** `phase-4-deterministic-layout`
**Tarih:** 2026-08-14 · **Durum:** tamamlandı — typecheck + build + lint + 283/283 test + gerçek tarayıcı
**Tur 1 raporu:** [`TASK-MSS1A2ID7BCHZ-gelistirici.md`](./TASK-MSS1A2ID7BCHZ-gelistirici.md) (44×44 zemin; bu tur onu geçersiz kılar)

---

## 1. Ne yapıldı

| # | Görev maddesi | Sonuç |
|---|---|---|
| 1 | Zemini 36×36'ya küçült + içeriği sığdır | ✅ yarı-kenar 22 → **18**; içerik yayılımı `COLONY_BUILDABLE_HALF_EXTENT = 16.3` ile kırpıldı |
| 2 | Kamera 44 → 36 için yeniden kalibre | ✅ genel görünüm artık **sabit zemin karesinden** türetiliyor, adaylar arası kadraj zıplaması yok |
| 3 | `/colony` varsayılanı `generated` + güvenli geri düşüş | ✅ `throw` kaldırıldı, `resolveLayoutSelection` + 7 test |
| 4 | Faz 4 kapanış kontrolü | ✅ ayrı bölüm (§8) |
| 5 | typecheck + build + lint + test | ✅ 283/283 |
| 6 | 80 seed × 5 aday AABB ölçümü | ✅ max \|x\| **16.861**, max \|z\| **15.784** (< 18) |
| 7 | Sweep 60 seed + reddetme gerekçesi karşılaştırması | ✅ 60/60, karşılaştırma §5 |
| 8 | `colonyGround.test.ts` 36×36 | ✅ 11 test (10 → 11) |
| 9 | Gerçek tarayıcı ekran görüntüleri | ✅ 8 görüntü yeniden alındı (§7) |

---

## 2. ÜNİFORM CONFIG_SCALE denendi — ÇALIŞMIYOR (ölçüm)

Görev "NIVALIS_TERRAIN.bounds + tüm areas merkez/ölçüleri tek bir CONFIG_SCALE ile üniform ölçekle,
tahmin etme, ölç" dedi. Ölçtüm. **Üniform ölçekleme jeneratörü çökertiyor**, çünkü bina bileşkeleri
(`visualCompoundProfiles`) bu oranla küçülmüyor — daralan tek şey `chooseFacilityAnchor`'ın manevra alanı:

```
$ 80 seed x 5 aday · bounds + tüm area merkez/ölçüleri üniform ölçekli
{"scale":1,   "failedSeeds":0, "candidates":400,"maxAbsX":20.034,"maxAbsZ":14.53}
{"scale":0.9, "failedSeeds":50,"candidates":150,"maxAbsX":18.154,"maxAbsZ":13.263}
{"scale":0.85,"failedSeeds":77,"candidates":15, "maxAbsX":15.626,"maxAbsZ":12.114}
{"scale":0.8, "failedSeeds":80,"candidates":0}
{"scale":0.78,"failedSeeds":80,"candidates":0}
{"scale":0.75,"failedSeeds":80,"candidates":0}
{"scale":0.7, "failedSeeds":80,"candidates":0}
```

Hedeflenen ≈0.80 katsayısında **80 seed'in 80'i** hiç aday üretemiyor. Bu, `nivalisLayoutIntent.ts`
içinde zaten yazılı olan tuzağın doğrulanması ("zone genişlikleri de daraltılınca tesisler kendi
operasyonel zone'larının dışında kalıyor").

Sonra bileşenleri ayırıp tek tek ölçtüm: yayılımı daraltan asıl kaldıraç **`bounds` değil, üretimin
sığmak zorunda olduğu `buildable-plateau`**. `bounds`'u (çapa yayılımının referans çerçevesi)
ölçeklemek pahalı ve faydasız:

```
$ plato kırpması 15.7 sabit, bounds ölçeği değişken (40 seed x 5 aday)
{"positionScale":1,   "failedSeeds":0, "reachP50":15.25}
{"positionScale":0.97,"failedSeeds":2, "reachP50":15.079}
{"positionScale":0.94,"failedSeeds":3, "reachP50":14.91}
{"positionScale":0.9, "failedSeeds":8, "reachP50":14.775}
{"positionScale":0.85,"failedSeeds":13,"reachP50":14.53}
```

0.90'da 40 seed'in 8'i ölüyor, karşılığında tipik erişim yalnız 15.25 → 14.78 daralıyor. **Bırakıldı.**

**Uygulanan çözüm:** `bounds` 44×30 olarak KALDI (çapa yayılımının referans çerçevesi, zemin değil);
`buildable-plateau` 43×29 dikdörtgenden **32.6×32.6 kareye** indirildi. Bu, eski "plato 0.85 kat →
60/60 çöktü" ölçümüyle çelişmiyor: o deneme platoyu dikdörtgen olarak küçültüp DERİNLİK yarı-kenarını
12.3'e indirmişti, oysa içerik z'de 14.5'e uzanıyor. Kare plato dikeyde 14.5 → 16.3 ile **genişletiyor**,
yalnız yatayda daraltıyor.

### Nihai katsayı nasıl seçildi (ölçüm tablosu)

`p` = `COLONY_BUILDABLE_HALF_EXTENT`. Ölçülen: içeriğin ulaştığı en dış nokta ≈ `p + 0.56`
(fark, platoya karşı kırpılmayan yol noktaları / sokak lambaları / genişleme padinden geliyor).

| p | maxReach | medyan erişim | sweep(100, seed 1) | sweep(60, seed 41001) | seed 41001'de `split-core` |
|---|---|---|---|---|---|
| 17.0 | 17.492 | 15.662 | 100/100 | 60/60 | var |
| 16.6 | 17.286 | 15.549 | 100/100 | 60/60 | var |
| **16.3** | **16.861** | **15.346** | **100/100** | **60/60** | **var** |
| 16.1 | 16.784 | 15.380 | 99/100 | 60/60 | var |
| 15.7 | 16.265 | 15.252 | 99/100 | 60/60 | **YOK** |
| 15.2 | 15.917 | 15.010 | 94/100 | 57/60 | YOK |

**Seçilen: `COLONY_BUILDABLE_HALF_EXTENT = 16.3`** — kaya kuşağının iç kenarının (17.0) altında kalan
en gevşek değer. Daha da daraltmak bedava değil: 15.7'de seed 41001 artık hiç `split-core` adayı
üretmiyor ve `runLayoutSeedSweep(100)` 99/100'e düşüyor.

**"Kabaca 0.80" tahmini tutmadı**; ölçülen nihai oran plato için **16.3 / 21.5 = 0.758**, zemin
karesi için **36 / 44 = 0.818**. İkisi tek bir üniform katsayı DEĞİL, çünkü bina boyutları sabit.

---

## 3. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/game/world/layout/colonyGround.ts` | `COLONY_GROUND_HALF_EXTENT` 22 → **18**; yeni `COLONY_BUILDABLE_HALF_EXTENT = 16.3`; yeni `COLONY_GROUND_CAMERA_BOUNDS`; kaya kuşağı merkez 21 → **17.45**, kalınlık 1.2 → 0.9, span 17.5 → 14.3; **`moduleWorldPoint` hata düzeltmesi** (aşağıda) |
| `src/game/world/layout/nivalisLayoutIntent.ts` | `buildable-plateau` → `COLONY_BUILDABLE_HALF_EXTENT`'ten türeyen kare; engel alanları (`northwest-ridge`, `southeast-crevasse`) ±20/±12.5 → ±16.6/±9.1 (eski konumları artık zeminin tamamen dışındaydı); `bounds`'un neden ölçeklenmediği ölçümlerle belgelendi |
| `src/game/world/prototype/cameraMath.ts` | `getLayoutOverviewZoom(bounds)` → **`getColonyGroundOverviewZoom()`** (aday parametresi YOK); `getCameraZoomRange` yeniden kalibre; `projectedHalfExtent` varsayılanı zemin karesi; `getCameraPresetTarget('overview', layout)` → zemin merkezi |
| `src/game/world/renderer/CameraRig.tsx` | Kadraj ve kaydırma sınırları artık `layout.cameraBounds` tüketmiyor; başlangıç zoom 40 → 30 |
| `src/game/world/prototype/prototypeLayout.ts` | Dondurulmuş `PROTOTYPE_WORLD_BOUNDS` kaldırıldı (kamera artık her iki modda ortak kareyi çerçeveliyor) |
| `src/game/ui/colony/layoutModeSelection.ts` **(yeni)** | `resolveLayoutSelection` — saf fonksiyon: üretim/geri düşüş kararı |
| `src/game/ui/colony/ColonyWorkspace.tsx` | Varsayılan mod `'prototype'` → **`'generated'`**; iki `throw` kaldırıldı; üretim boşsa Default'a düşüş + uyarı şeridi |
| `src/localization/tr.ts` | `layoutReview.generationFallback` |
| `src/styles.css` | `.layout-generation-fallback` |
| `tests/world/colonyGround.test.ts` | 36×36'ya güncellendi + yeni "koloni kareyi DOLDURUR" testi (10 → 11 test) |
| `tests/world/prototypeCamera.test.ts` | Kadraj testleri sabit kareye göre yeniden yazıldı + "kadraj aday değişiminde zıplamaz" (9 → 11 test) |
| `tests/world/colonyOpeningMode.test.ts` **(yeni)** | 7 test: açılış modu + güvenli geri düşüş (TASK-MSRPKXFR6B1LV regresyon koruması) |

### Yan bulgu: `moduleWorldPoint` hata düzeltmesi

Tur 1'in doğrulaması görsel modüllerin dünya konumunu `position + localPosition` diye hesaplıyordu.
Sahnede modüller tesisin **döndürülmüş** grubunun çocuğu (`WorldScene.tsx:91-93`:
`<group rotation={[0, rotationY, 0]}>` içinde `position={module.localPosition}`), yani doğru konum
döndürülerek bulunur. Yanlış nokta kontrol edildiği için hem hayalî taşmalar üretiliyor hem de gerçek
taşmalar kaçırılabiliyordu. Düzeltildi; `colonyGroundOccupancyPoints`, doğrulama ve testler artık
`three.js`'in Y dönüşüyle birebir aynı formülü kullanıyor.

---

## 4. Kamera kalibrasyonu — kadraj neden artık zıplamıyor

`layout.cameraBounds` **içerikten türetilmeye devam ediyor** (görev maddesi 2'nin istediği gibi):
`layoutScoring.compactness` (ağırlık 3, en yüksek) `boundsArea`'dan besleniyor, dokunulmadı.
Değişen tek şey **kameranın onu tüketmeyi bırakması**:

- Genel görünüm hedefi: adayın `cameraBounds.center`'ı yerine **zemin merkezi `[0, 0]`**.
- Genel görünüm yakınlaştırması: `getColonyGroundOverviewZoom(viewportWidth, viewportHeight, panelOpen)`
  — **aday parametresi yok**, dolayısıyla aday değişimi zoom'u matematiksel olarak oynatamaz.
- Kaydırma sınırları: sabit zemin karesinden.

Yakınlaştırma ölçütü: izometrik karenin **sağ/sol köşeleri boş üçgenlerdir**; onları kadraja sığdırmak
kareyi gereksizce küçültür. Bu yüzden dikeyde karenin tam izdüşümü sığdırılır, yatayda ölçüt **kenar
orta noktalarıdır** (köşelerin taşmasına izin verilir).

`getCameraZoomRange` yeniden kalibre edildi: masaüstü `min` 16 → **18**, `overview` 40/46 → **30/34**
(artık uydurma değil, ölçülen gerçek genel-görünüm yakınlaştırmasına yakın; `getCameraPanLimits`
kaydırma payını buna oranlıyor), mobil `min` 14 → **11** (küçülen kare mobilde artık kırpılmadan sığıyor).

---

## 5. Ham çıktılar

### 5.1 typecheck / lint / build

```
$ npm run typecheck
> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false
(çıktı yok — temiz)

$ npm run lint
> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .
(çıktı yok — temiz)

$ npm run build
> gozlemci-isletim-sistemi@0.0.0 build
> tsc -b && vite build
vite v7.3.6 building client environment for production...
✓ 383 modules transformed.
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-CoRhWUz0.css     24.82 kB │ gzip:   4.94 kB
dist/assets/index-CCx2PiA6.js   1,543.25 kB │ gzip: 445.03 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 3.85s
```
(Chunk-size uyarısı bu görevden önce de vardı, davranışsal değil.)

### 5.2 `npm test` — 283/283 PASS

```
$ npm test
 ✓ tests/world/colonyGround.test.ts (11 tests) 1052ms
 ✓ tests/world/colonyOpeningMode.test.ts (7 tests) 496ms
 ✓ tests/world/prototypeCamera.test.ts (11 tests) 255ms
 ✓ tests/world/layoutGenerator.test.ts (45 tests) 7797ms
 ✓ tests/world/structuralLayoutGenerator.test.ts (28 tests) 9973ms

 Test Files  31 passed (31)
      Tests  283 passed (283)
   Duration  10.94s (transform 1.61s, collect 13.32s, tests 23.57s, prepare 3.88s)
```

Tur 1: 273 test. Bu turda +10: `colonyOpeningMode` (7), `colonyGround` (+1), `prototypeCamera` (+2).

### 5.3 Seed sweep — 100/100 ve 60/60

```
$ runLayoutSeedSweep(100)            => {"valid":100,"failed":0,"failures":[]}
$ runLayoutSeedSweep(60, 41001)      => {"valid":60,"failed":0,"failures":[]}
```

### 5.4 İçerik AABB — 80 seed × 5 aday (görev maddesi 6)

```
$ 80 seed (41001..41080) x 5 aday, prop (kaya kuşağı) hariç tüm render edilen noktalar
{
  "seeds": 80, "candidates": 400,
  "maxAbsX": 16.861, "maxAbsZ": 15.784,
  "medianReach": 15.346,
  "bandInnerEdge": 17,
  "worstAt": "seed 41062 · l-shaped-23 · facility:solar"
}
```

- Zemin yarı-kenarı **18** → içerik 36×36 karenin içinde, **1.139 birim payla**.
- Kaya kuşağının iç kenarı **17.0** → içerik kayalara **0.139 birim payla** değmiyor.
- **Doluluk:** medyan erişim 15.346 / 18 = **%85.3**. Tur 1'de (44×44) bu oran 15.9 / 22 = **%72** idi
  — "koloni ortada küçük kalıyor" şikâyetinin sayısal karşılığı ve düzelmesi.

### 5.5 İç aday reddetme gerekçeleri (görev maddesi 7)

60 seed × `visualCandidateCount: 10` ile bilerek "failure" yaptırılıp tüm iç aday reddetme
gerekçeleri toplandı:

```
$ TUR 2 (plato 32.6 kare, engeller ±16.6, zemin 36x36)
{"insufficient-diversity":48,"road-compound-overlap":12,"service-clearance":8,"structural-generation-failed":240}

$ Tur 1 referansı (rapordan): 210 / 42 / 11 / 5
```

Sayı arttı (268 → 308). **Sebep plato kırpması DEĞİL, zeminin küçülmesi.** Aynı ölçümü
*eski arazi konfigürasyonuyla* (plato 43×29, engeller ±20) ama *yeni 36×36 zeminle* tekrarladım:

```
$ ESKI arazi + YENI zemin/doğrulama
{"insufficient-diversity":46,"outside-ground":51,"road-compound-overlap":13,"service-clearance":6,"structural-generation-failed":230}
```

- Plato kırpılmazsa **51 aday `outside-ground` ile reddediliyor** (içerik 36×36'ya taşıyor) ve
  `structural-generation-failed` yine 230'a çıkıyor. Toplam reddetme **346**.
- Plato kırpılınca `outside-ground` **0**, toplam reddetme **308** — yani kırpma reddetmeyi
  **azaltıyor**, artırmıyor.
- Kalan artış (268 → 308) küçülen zeminin kendisinden; ölçüt sonuçlar bozulmadı:
  `runLayoutSeedSweep(100)` = 100/100, `(60, 41001)` = 60/60, her seed 5 aday üretiyor.
- Görev "artıyorsa CONFIG_SCALE'i gevşet" dedi — gevşetmeyi ölçtüm (§2 tablosu): 16.6 ve 17.0'da
  sweep sonuçları aynı (100/100, 60/60) ama içerik 17.286 / 17.492'ye ulaşıp **kaya kuşağının içine
  giriyor**. 16.3, kuşağa değmeyen en gevşek değer.

---

## 6. `/colony` açılış modu ve güvenli geri düşüş (görev maddesi 3)

`ColonyWorkspace.tsx` iki yerde `throw` ediyordu (`generation.status === 'failure'` ve "hiç aday yok").
Varsayılan mod `'prototype'` olduğu sürece bu ikisi pratikte tetiklenmiyordu; varsayılanı `'generated'`
yapmak **TASK-MSRPKXFR6B1LV regresyonunu geri getirirdi**. Karar saf bir fonksiyona taşındı:

```ts
export function resolveLayoutSelection(result, requestedMode, selectedCandidateIndex): LayoutSelection
```

- `status === 'failure'` → `effectiveMode: 'prototype'`, `selectedLayout: null`, `generationFallback: true`
- `candidates: []` → aynı geri düşüş
- geçersiz aday indeksi → ilk adaya döner, hata yok
- geri düşüş olduğunda kullanıcıya uyarı şeridi (`layoutReview.generationFallback`)

`tests/world/colonyOpeningMode.test.ts` — 7 test, hepsi PASS. Ayrıca kaynak seviyesinde
`expect(source).not.toContain('throw new Error')` ve `useState<LayoutMode>('generated')` doğrulanıyor.

**Dürüst sınır:** geri düşüşün *render yolu* tarayıcıda kanıtlı (Default düğmesi tam olarak aynı
yolu kullanıyor — `selectedLayout: null` + `usePrototypeLayout`, bkz. ekran görüntüsü 01). Geri
düşüşün *tetiklenmesi* birim testle kanıtlı; tarayıcıda üretim hatasını yapay olarak tetiklemedim.

---

## 7. Gerçek tarayıcı kanıtı — `npm run dev` → `http://localhost:5174/colony`

Ekran görüntüleri: [`TASK-MSS1A2ID7BCHZ-screenshots/`](./TASK-MSS1A2ID7BCHZ-screenshots/)
(Tur 1'in 44×44 görüntülerinin **üzerine yazıldı**.)

| # | Görüntü | İçerik | Puan |
|---|---|---|---|
| 1 | [01-default-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/01-default-seed41001.png) | **Default** (Faz 3 sabit yerleşim) · FPS 144 | — |
| 2 | [02-adayA-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/02-adayA-seed41001.png) | **AÇILIŞ EKRANI** · 41001 · ADAY A · T kavşaklı koloni · FPS 140 | 75.14 |
| 3 | [03-adayB-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/03-adayB-seed41001.png) | 41001 · ADAY B · L biçimli koloni | 63.93 |
| 4 | [04-adayC-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/04-adayC-seed41001.png) | 41001 · ADAY C · İki çekirdekli koloni | 62.72 |
| 5 | [05-adayD-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/05-adayD-seed41001.png) | 41001 · ADAY D · Merkezi omurga | 81.58 |
| 6 | [06-adayE-seed41001.png](./TASK-MSS1A2ID7BCHZ-screenshots/06-adayE-seed41001.png) | 41001 · ADAY E · Ofset merkez | 78.21 |
| 7 | [07-adayA-seed41002.png](./TASK-MSS1A2ID7BCHZ-screenshots/07-adayA-seed41002.png) | **Tohum 41002** · ADAY A · Merkezi omurga | 84.17 |
| 8 | [08-adayC-seed41003.png](./TASK-MSS1A2ID7BCHZ-screenshots/08-adayC-seed41003.png) | **Tohum 41003** · ADAY C · Merkezi omurga | 79.46 |

Geçişlerin hepsi tarayıcıda **gerçekten tıklanarak** yapıldı (Default → ADAY A…E → Yeni Tohum ×2).
Hiçbirinde hata sınırı metni, donma veya boş sahne görülmedi; FPS 136–144, ms 6.9–7.4.

Görüntülerin gösterdiği beş şey (görev maddesi 9):

1. **Zemin hepsinde AYNI 36×36 kare** — 8 görüntünün tamamında zemin, izometrik kamerada aynı
   konumda ve aynı boyutta duran tek bir eşkenar dörtgen. Default dahil.
2. **Hiçbir bina/yol/kaya/lamba taşmıyor** — tüm tesisler, yol karoları, sokak lambaları, expansion
   pad'i ve kolonistler karenin içinde.
3. **Dört kenar kayalarla süslü** — kenar başına 6 bölge × 2 kaya = 48 kaya, dört kenarda da görünür.
4. **Koloni kareyi düzgün dolduruyor** — Tur 1'deki "ortada küçük kalma" gitti (§5.4: medyan doluluk
   %72 → %85.3). Yalnız **Default** hâlâ görece küçük duruyor; bu beklenen: Faz 3 sabit yerleşimi
   ~25×16 birim ve dondurulmuş (§9).
5. **Kadraj adaylar arası zıplamıyor** — 8 görüntünün hepsinde dörtgenin köşeleri aynı piksellerde.

---

## 8. FAZ 4 KAPANIŞ KONTROLÜ (görev maddesi 4)

### 8.1 Çeşitlilik (TASK-MSQRS3JCRXXB6) — seed 41001–41005, ADAY A

`tests/world/seed-regeneration-diversity.test.ts` çıktısı (bu turdaki `npm test` koşusundan):

```
Seed	Archetype		Habitat			Roads	Junctions	Orientation
41001	t-junction     	clustered-habitat   	7	3		mixed
41002	central-spine  	compact-pod         	8	2		horizontal
41003	t-junction     	clustered-habitat   	7	3		mixed
41004	central-spine  	service-yard        	7	1		horizontal
41005	offset-hub     	service-yard        	7	2		diagonal

Unique Archetypes: 3/5 · Unique Habitats: 3 · Unique Junctions: 3 · Unique Orientations: 3
Diversity Score: 75.0%
```

**Eski ölçüm: 1/5 unique archetype, %25. Şimdi: 3/5, %75.** Aynı seed'i tekrar üretmek aynı sonucu
veriyor (determinizm testi 23 PASS), farklı seed farklı tasarım veriyor.

Not: bu iyileşmeyi tek bir değişikliğe bağlamıyorum — TASK-MSQRS3JCRXXB6/MSQTJFYDAW71N'deki
`materializeArchetype` çalışması ve bu turdaki plato kırpması birlikte aday seçimini etkiliyor.
Raporladığım, **bugünkü ölçülen değer**.

Seed içi çeşitlilik de sağlıklı: seed 41001'in 5 adayı **5 farklı arketip** (t-junction, l-shaped,
split-core, central-spine, offset-hub — §7 tablosu).

### 8.2 `/colony` açılış sağlığı (TASK-MSRPKXFR6B1LV)

Açılışta üretilen tasarım geliyor, çökme yok (ekran görüntüsü 02), Default düğmesi çalışıyor
(görüntü 01), üretim hatasında `throw` yerine güvenli geri düşüş var (§6, 7 test).

### 8.3 Aday sayısı ve skorlama tutarlılığı

- Her seed **5 görsel aday** üretiyor: `runLayoutSeedSweep(60, 41001)` = 60/60, `(100, 1)` = 100/100.
- Skorlar 62.72–84.17 aralığında, `GEÇERLİ: Evet`, `YOL AĞI: Bağlı`, `NAVİGASYON: Bağlı` — 8 görüntünün
  hepsinde panelden okundu.
- `compactness` girdisi (`cameraBounds`) bilerek içerikten türetilmeye devam ediyor; zemin küçüldüğü
  için skorlar genel olarak yükseldi (ör. seed 41001 "Merkezi omurga" 78.21 → 81.58).

### 8.4 Verdict

> **Faz 4 kapanışa hazır mı: EVET.**

Gerekçe: (a) 283/283 test + typecheck + lint + build temiz; (b) `runLayoutSeedSweep` 100/100 ve 60/60,
her seed 5 geçerli aday; (c) çeşitlilik ölçülen %75 (eski %25) ve determinizm korunuyor; (d) `/colony`
açılışı üretilen tasarımla geliyor, üretim hatasında çökmüyor; (e) zemin/taşma sözleşmesi 80 seed ×
5 adayda sayısal olarak kanıtlı.

**Kapanışı ENGELLEMEYEN ama açık kalan maddeler** (§10 ile aynı liste):
1. Default (Faz 3) yerleşimi 36×36 karede hâlâ görece küçük — dondurulmuş olduğu için kasıtlı.
2. `seed-regeneration-diversity` %75; %100 (5/5 farklı arketip) hedefleniyorsa ayrı bir iş.
3. Nihai yerleşimin dondurulması (`layoutReview.productionPending`) hâlâ kullanıcı seçimine bağlı.

---

## 9. Riskler

1. **İçerik–kaya kuşağı payı 0.139 birim.** 80 seed × 5 adayda ölçülen en kötü durum 16.861, kuşağın
   iç kenarı 17.0. Üretim deterministik olduğu için bu sabit; ama jeneratör parametreleri değişirse
   pay kaybolabilir. **Sert güvence** kuşak değil, `colonyGroundViolations` (18) — taşma olursa aday
   reddedilir, zeminin dışına hiçbir şey çıkamaz. Kuşakla çakışma yalnız kozmetik olurdu.
2. **Plato kırpması arketip çeşitliliğine duyarlı.** 16.3 → 15.7'de seed 41001 `split-core` adayını
   kaybediyor. Bu değeri düşürmeden önce `runLayoutSeedSweep(100)` ve `structuralLayoutGenerator`
   test 10/25 koşulmalı; ikisi de bu sınırı koruyor.
3. **Faz 3 kamera çerçevesi artık dondurulmuş değil.** `PROTOTYPE_WORLD_BOUNDS` kaldırıldı; Default
   modu da ortak zemin karesini çerçeveliyor. Faz 3'ün tesis/yol/kaya **verisi** değişmedi, yalnız
   kameranın Default'a bakış mesafesi Tur 1'e göre biraz uzaklaştı.
4. **Engel alanları (`northwest-ridge` / `southeast-crevasse`) taşındı.** ±20'de zeminin dışında
   kalıyorlardı; ±16.6'ya alındılar. Ölçüldü: sweep sonuçlarını bozmuyor (100/100, 60/60).

---

## 10. Açık sorular

1. **Default (Faz 3) yerleşimi 36×36 karede hâlâ küçük duruyor.** Tur 2'de üretilen adaylar kareyi
   dolduruyor (%85), Default ~%50. Default'un da büyütülmesi = Faz 3 sabit yerleşimini yeniden
   ölçeklemek demek; "dondurulmuş" kararına aykırı olduğu için yapılmadı. İstenirse ayrı iş.
2. **Kadraj sabitlendi — kullanıcı yakınlaştırması hâlâ serbest.** Genel görünüm artık her adayda
   birebir aynı; tekerlekle yakınlaştırma/kaydırma çalışmaya devam ediyor. Adaya göre otomatik
   yakınlaştırma isteniyorsa (ör. küçük koloniye daha yakın) bu bilinçli olarak geri alındı.
3. **Mobil `min` zoom 14 → 11'e indi** ama mobil viewport'ta gerçek cihaz doğrulaması yapılmadı
   (bu görev masaüstü tarayıcı kapsamındaydı).

---

## 11. Sonraki adım

- Değişiklikleri `phase-4-deterministic-layout` dalına commit et (repoda `dev` dalı yok; `master`
  dışındaki aktif geliştirme dalı bu).
- Patron onayı sonrası TASK-MSS1A2ID7BCHZ → `done`, TASK-MSRPKXFR6B1LV → `done` (regresyon testi
  bu turda eklendi).
- İsteğe bağlı ayrı iş: Default (Faz 3) yerleşiminin 36×36 kareye göre yeniden ölçeklenmesi.
