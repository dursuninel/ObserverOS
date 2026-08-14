# TASK-MSQTJFYDAW71N — Faz 4 layout üreticisine GERÇEK prosedürel çeşitlilik

**Ajan:** geli-tirici-eed2c5
**Tarih:** 2026-08-13
**Kapsam kısıtı:** yalnız `src/game/world/layout/**` (+ testler). Commit atılmadı. Dev server kapatılmadı.

---

## 1. Ne yapıldı

Önceki görev (TASK-MSQRS3JCRXXB6) yanlış hedefi kovalamıştı: "hangi arketip hangi UI slotunda
görünüyor". Asıl sorun oydu ki sistemde **5 SABİT tasarım şablonu** vardı — `STRUCTURAL_ARCHETYPES`
içindeki `attachmentTargets` (iskelet koordinatları) ve `routeCorners` (yol kırılmaları) her seed için
birebir aynıydı. Aynı arketip iki farklı seedde **aynı somut yerleşimi** üretiyordu; slot rotasyonu bunu
gizlemekten başka bir işe yaramıyordu.

Yapılan: arketip artık **yalnızca tasarım niyetini** taşıyor (hangi tesis hangisine bağlanır, genişleme
nereye asılır, hangi siluet ailesi). Somut geometri — iskelet koordinatları, her yolun kırılması, kavşak
düğümü sayısı, bina örnekleme penceresi, bina rotasyonları, sokak lambası ritmi, plato silueti, prop
bölgeleri — **her seed için yeniden malzemeleştiriliyor**.

### Yeni modül

`src/game/world/layout/archetypeVariation.ts` (yeni, ~300 satır)
`materializeArchetype(base, rng, plateauVertexCount) → MaterializedArchetype`

Ürettiği per-seed planlar:

| Plan | İçerik |
|---|---|
| `anchors` | Global deformasyon (döndürme ±0.16 rad, ölçek X 0.88–1.14 / Z 0.82–1.20, shear ±0.12, kayma) + her düğüme ayrı jitter; sonuç `base ± maxDrift` ve global kutuya clamp'lenir |
| `segments` | Her ana bağlantı için `CornerMode` ∈ {direct, elbow-x, elbow-z, dogleg-x, dogleg-z, bowed}; arketip başına `minCorners` tabanı (yalnız elbow/dogleg sayılır, çünkü `bowed` `simplifyPath` ile düzleşebilir) |
| `junctions` | 1–4 adet `spine-link-N` düğümü mevcut bir bacağı t∈[0.32,0.68] noktasından ikiye böler → **spine düğüm sayısı seed'e göre değişir** |
| `facilityPlans` | Tesis başına: `side` (±1 flip), `approachDistance`, `ringCount/ringStartAngle/ringRadiusScale`, `gridColumns/gridRows/gridJitter`, `sampleWindowCenter/Scale`, `explorationNoise`, `rotationOffset` + `rotationQuantum` |
| `streetLightPlan` | `spacing`, `spacingJitter`, `lateralOffset`, `startOffset`, `nodeOffsetRadius/Angle`, `minimumSeparation`, rastgele `approachEntities` alt kümesi |
| `plateauPlan` | Global döndürme/ölçek + köşe başına radyal & açısal jitter + 0–3 ek köşe |
| `propZonePlans` | 2–4 bölge, değişken genişlik/derinlik/kayma/seedOffset |
| `variationKey` | anchors + yol waypointleri + kavşak sayısının FNV hash'i — `structure.signature`'a katılır |

---

## 2. Hangi boyutlar SABİTTİ, nasıl rastgeleleştirildi

| Boyut | ÖNCE (sabit) | SONRA (seed'e bağlı) |
|---|---|---|
| Ana omurga düğüm **konumları** | `archetype.attachmentTargets` literal koordinatlar | `deriveAnchors()`: döndürme+ölçek+shear+kayma+jitter, drift bütçesine clamp |
| Yol **kırılmaları** | `archetype.routeCorners` literal köşe listesi | `deriveWaypoints()`: 6 `CornerMode`, bend oranı `rng.range(0.3,0.72)`, bowed için normal ofset |
| Yol **düğüm sayısı** | Her zaman 7 (`ROUTE_ORDER`) | 7 + 1–4 `spine-link-N` → ölçülen aralık **8–12** |
| Kavşak sayısı | `archetype.junctionCount` sabiti (1/2/3) | Gerçek graftan hesaplanıyor (main-spine derece ≥3 olan düğümler + eklenen link düğümleri) → ölçülen **0–5** |
| Bina **örneklem alanı** | Sabit 8 halka açısı `k·π/4`, sabit yarıçap, ±0.3 jitter; sabit 5×4 zone grid, ±0.38 jitter | `ringCount` 6–12, `ringStartAngle` 0–2π, `ringRadiusScale` 0.85–1.85, ±0.4 jitter; grid 4–7 sütun × 3–6 satır, jitter 0.28–0.92, kaydırılabilir/ölçeklenebilir alt-pencere (`sampleWindowCenter/Scale`) |
| Bina yerleşim yönü (`side`) | `id === 'reactor'\|'habitat'\|'mine' ? -1 : 1` — hard-coded | Tesis başına `rng.next() < 0.5 ? -1 : 1` |
| Yola yaklaşma mesafesi | Sabit `depth/2 + 2.1` | `depth/2 + rng.range(1.6, 4.2)` |
| Bina **rotasyonu** | Saf `atan2(roadTarget − position)` | `atan2(...) + quantize(rotationOffset, rotationQuantum)`; kuantum havuzu `[0,0,0,π/16,π/12,π/8]` (≈%50 saf yola-bakış kalır) |
| Aday sıralama gürültüsü | `rng.range(0, 0.35)` | `explorationNoise` 0.6–4.6 |
| Sokak lambası **sayısı/konumu** | `deriveStreetLights` RNG **almıyordu**; literal `+0.65/+0.65`, `+0.6/0`, `+0.55/+0.55` ofsetler; kural `degree>=3 \|\| index%2===0`; approach lambaları hard-coded `['habitat','mine','reactor']` | Yol poligonu boyunca `startOffset` (0.9–4.2) + `spacing` (5.5–13.5) + `spacingJitter` ile yürüme, dönüşümlü yanal ofset; düğüm lambaları `nodeOffsetRadius/Angle` polar ofsetle; approach tesisleri rastgele 2–6'lık alt küme; `minimumSeparation` (1.7–3.4) ile greedy dedupe |
| Plato silueti | `TerrainVisualVariantId` başına sabit köşe tablosu | Aynı tablo + global döndürme/ölçek + köşe başına radyal (0.86–1.16) ve açısal (±0.07) jitter + 0–3 ek köşe; sonunda polar açıya göre sıralanarak basit poligon garanti ediliyor → ölçülen köşe sayısı **7–12** |
| Prop bölgeleri | 2 sabit bölge, sabit formül | 2–4 bölge, değişken genişlik/derinlik/yanal kayma/seedOffset |
| Genişleme yuvası | Mesafeye göre sıralı ilk uygun anchor | Mesafe + `rng.range(0, 1.4)` gürültüsü |

### Geçerlilik kısıtları KORUNDU (hiçbiri gevşetilmedi)
`layoutValidation.ts` dokunulmadı. Bağlantılılık, buildable içinde kalma, hazard/blocked çakışmaması,
`mine` için `resourceZone` zorunluluğu, entrance düğümü ↔ facility.entrance eşleşmesi, ikili
`minimumSeparation`, ana omurga yollarının bina siluetlerini kesmemesi, genişleme kapasitesi ve
ekran-uzayı okunabilirlik eşiği (0.82) aynen yürürlükte.

### Ek olarak GÜÇLENDİRİLEN kısıt
`chooseFacilityAnchor` artık `NIVALIS_PLACEMENT_PROFILES[id].avoidedNeighbours[].minDistance`
kuralını yerleşim anında uyguluyor (önce yalnız skorlamada dolaylı etkisi vardı). Habitat↔Mine > 7 ve
Habitat↔Reactor > 6 artık **tesadüf değil, garanti**.

### Diğer değişiklikler
- `layoutGenerator.ts`: tüm boru hattı `MaterializedArchetype` üzerinden geçiyor; `junctionCount`
  gerçek graftan; `signature`'a `variationKey` eklendi (UI'daki `data-structural-signature` bu).
- **Malzemeleştirme yeniden denemesi:** geniş varyasyon alanı tek tek denemelerin yerleşim/doğrulama
  aşamasında düşmesine yol açıyor. Her aday slotu, arketipin henüz 2 geçerli adayı yoksa 4 deterministik
  re-roll alıyor (`${seed}:${version}:${style}:${index}:${attempt}`). Bu olmadan bazı seedler (örn. 47)
  bir arketibi tamamen kaybediyordu.
- **Temsilci seçimi:** artık arketip başına katı maksimum skor seçilmiyor (bu her seedi aynı "optimal"
  düzene geri çekerdi). Skor toleransı (2.5) içindeki havuzdan, önce görülmemiş silüet/habitat ailesini
  tercih eden, sonra seed'e göre dönen bir seçim yapılıyor.
- `nivalisLayoutIntent.ts`: `GENERATOR_VERSION` `4.2.0` → `5.0.0` (tüm çıktılar değişti, kasıtlı).
- `layoutScoring.ts`: `roadQuality` yeniden kalibre edildi (bkz. Riskler).

---

## 3. Kanıt

### 3.1 `npm test` — TAMAMI GEÇİYOR

```
 ✓ tests/world/prototypeNavigation.test.ts (10 tests) 45ms
 ✓ tests/simulation/simulationShell.test.ts (2 tests) 15ms
 ✓ tests/simulation/colonistLifecycle.test.ts (9 tests) 53ms
 ✓ tests/simulation/simulationDiagnostic.test.ts (4 tests) 38ms
 ✓ tests/simulation/runtimeDriver.test.ts (8 tests) 79ms
 ✓ tests/simulation/workforceMaintenance.test.ts (26 tests) 125ms
 ✓ tests/world/continuousMotion.test.ts (11 tests) 45ms
 ✓ tests/simulation/simulationEngine.test.ts (17 tests) 424ms
 ✓ tests/world/prototypeLayout.test.ts (10 tests) 13ms
 ✓ tests/world/prototypeCamera.test.ts (9 tests) 7ms
 ✓ tests/world/presentationTime.test.ts (13 tests) 8ms
 ✓ tests/world/runtimeAssetNormalization.test.ts (3 tests) 8ms
 ✓ tests/localization/diagnosticLocalization.test.ts (3 tests) 7ms
 ✓ tests/architecture/moduleBoundaries.test.ts (6 tests) 484ms
 ✓ tests/world/seed-regeneration-diversity.test.ts (1 test) 539ms
 ✓ tests/world/runtimeObjectInspector.test.ts (4 tests) 6ms
 ✓ tests/content/contentValidation.test.ts (4 tests) 9ms
 ✓ tests/world/prototypeAssets.test.ts (14 tests) 812ms
 ✓ tests/world/seed-score-analysis.test.ts (1 test) 646ms
 ✓ tests/world/authoritativeColonistPresentation.test.ts (4 tests) 5ms
 ✓ tests/world/prototypeEnvironment.test.ts (2 tests) 4ms
 ✓ tests/localization/layoutLocalization.test.ts (3 tests) 4ms
 ✓ tests/simulation/simulationClock.test.ts (7 tests) 4ms
 ✓ tests/world/assetRegistry.test.ts (2 tests) 3ms
 ✓ tests/world/prototypeVisualState.test.ts (4 tests) 3ms
 ✓ tests/world/presentationShells.test.ts (2 tests) 2ms
 ✓ tests/world/procedural-parametrization.test.ts (11 tests) 201ms
 ✓ tests/world/layoutGenerator.test.ts (45 tests) 6240ms
 ✓ tests/world/structuralLayoutGenerator.test.ts (28 tests) 8225ms

 Test Files  29 passed (29)
      Tests  263 passed (263)
   Duration  9.11s
```

`tsc -b --pretty false` → exit 0. `eslint .` → exit 0.

Başlangıç: 252 test / 28 dosya. Şimdi: 263 test / 29 dosya (+11 yeni ölçüm testi).

### 3.2 Tekrar oranı ölçümü — 200 seed, 1000 layout

Ölçüm anahtarı: **facility pozisyon kümesi + rotasyon kümesi + spine yol düğümü kümesi + sokak lambası
kümesi** birleşik FNV hash'i, arketip bazında gruplanmış (seed 80000–80199, her seed 5 aday).

```
=== 200-SEED (80000..80199) REPEAT MEASUREMENT ===
seeds generated OK: 200/200, total layouts: 1000
central-spine  n= 203 uniq= 203 combined-repeat= 0.00% pos= 0.00% rot= 0.00% roadnodes= 0.00% lights= 0.00% spine-node-counts=3 light-counts=15 junctions=1/2/3
l-shaped       n= 200 uniq= 200 combined-repeat= 0.00% pos= 0.00% rot= 0.00% roadnodes= 0.00% lights= 0.00% spine-node-counts=4 light-counts=14 junctions=0/1/2/3
offset-hub     n= 200 uniq= 200 combined-repeat= 0.00% pos= 0.00% rot= 0.00% roadnodes= 0.00% lights= 0.00% spine-node-counts=5 light-counts=15 junctions=1/2/3/4/5
split-core     n= 198 uniq= 198 combined-repeat= 0.00% pos= 0.00% rot= 0.00% roadnodes= 0.00% lights= 0.00% spine-node-counts=4 light-counts=16 junctions=1/2/3/4
t-junction     n= 199 uniq= 199 combined-repeat= 0.00% pos= 0.00% rot= 0.00% roadnodes= 0.00% lights= 0.00% spine-node-counts=4 light-counts=12 junctions=2/3/4/5
GLOBAL combined-hash repeat rate: 0.000% (1000/1000 unique)
```

**Tekrar oranı: %0.000** — 1000 layoutun 1000'i benzersiz. Her boyut ayrı ayrı da %0.00
(pozisyon, rotasyon, yol düğümleri, lambalar).
Ayrıca sabit-olmama kanıtı: aynı arketip içinde spine düğüm sayısı 3–5 farklı değer, lamba sayısı 12–16
farklı değer, kavşak sayısı 3–5 farklı değer alıyor.

### 3.3 Kalıcı ölçüm testi: `tests/world/procedural-parametrization.test.ts` (11 test, 40 seed)

Suite'e eklendi, her koşuda çalışıyor. Konsol çıktısı:

```
[layout fingerprint repeat rate, seeds 70000..70039]
central-spine: n=40 unique=40 repeat=0.00%
l-shaped: n=40 unique=40 repeat=0.00%
offset-hub: n=40 unique=40 repeat=0.00%
split-core: n=40 unique=40 repeat=0.00%
t-junction: n=40 unique=40 repeat=0.00%

[within-archetype habitat spread]
central-spine: habitat mean-offset=6.91
l-shaped: habitat mean-offset=7.30
offset-hub: habitat mean-offset=3.47
split-core: habitat mean-offset=4.13
t-junction: habitat mean-offset=4.67
```

Testler: (1) 40/40 seed üretiyor & 5 arketip, (2) birleşik parmak izi tekrarsız, (3) pozisyon+rotasyon
tekrarsız, (4) yol düğümü kümesi tekrarsız, (5) lamba kümesi tekrarsız, (6) main-spine geometrisi
tekrarsız, (7) spine düğüm sayısı sabit değil, (8) lamba sayısı sabit değil, (9) rotasyonlar saf
yola-bakış değil (>200 farklı değer), (10) **determinizm korunuyor** (aynı seed → birebir aynı JSON),
(11) arketip içi habitat yayılımı > 1.5 birim.

### 3.4 8 seed karşılaştırması (LayoutCandidatePanel alanları)

Panel alanları: `YOL TOPOLOJİSİ` (`orientation` + corner sayısı), `KAVŞAK` (`junctionCount`),
`YAPISAL FARK` (`differenceScore`), `ÇEŞİTLİLİK İMZASI` (`data-structural-signature`).
Aşağıdaki tablo `generateLayoutCandidates({ seed })` çıktısından — panelin okuduğu aynı kod yolundan —
alınmıştır.

**Aynı arketip (central-spine) 6 farklı seedde:**

| Seed | Slot | Yol topolojisi | Kavşak | Spine düğüm | Lamba | Plato köşe | Puan | İmza (variationKey) |
|---|---|---|---|---|---|---|---|---|
| 41001 | ADAY D | horizontal / 4 dönüş | 3 | 10 | 15 | 9 | 77.00 | `0ryoz3o` |
| 41002 | ADAY A | horizontal / 3 dönüş | 2 | 9 | 19 | 8 | 78.56 | `1xd71oy` |
| 41003 | ADAY B | horizontal / 3 dönüş | 2 | 9 | 10 | 8 | 79.75 | `1gvb418` |
| 41006 | ADAY B | horizontal / 2 dönüş | 2 | 9 | 10 | 7 | 75.68 | `0icwhal` |
| 41007 | ADAY C | horizontal / 4 dönüş | 1 | 8 | 9 | 9 | 72.92 | `1qiy6an` |
| 41008 | ADAY A | horizontal / 1 dönüş | 2 | 9 | 14 | 8 | 81.16 | `0fewzp3` |

Aynı arketip: dönüş sayısı 1–4, kavşak 1–3, spine düğüm 8–10, lamba 9–19, plato köşe 7–9 arasında
değişiyor ve her seedde `variationKey` farklı. Eskiden bu satırların **hepsi birebir aynı** olurdu.

**Tam 8 seed × 5 aday tablosu (özet):**

```
41001 A split-core    yol=mixed/5      kavşak=4 düğüm=10 lamba=13 plato=9  puan=64.38 imza=...|0rq9kcb
41001 B l-shaped      yol=mixed/3      kavşak=2 düğüm=9  lamba=11 plato=9  puan=63.98 imza=...|1ame0za
41001 C offset-hub    yol=diagonal/4   kavşak=4 düğüm=10 lamba=17 plato=9  puan=63.03 imza=...|102vd1y
41001 D central-spine yol=horizontal/4 kavşak=3 düğüm=10 lamba=15 plato=9  puan=77.00 imza=...|0ryoz3o
41001 E t-junction    yol=mixed/5      kavşak=5 düğüm=10 lamba=11 plato=11 puan=73.70 imza=...|0eu6mnd

41002 A central-spine yol=horizontal/3 kavşak=2 düğüm=9  lamba=19 plato=8  puan=78.56 imza=...|1xd71oy
41002 B offset-hub    yol=diagonal/2   kavşak=3 düğüm=9  lamba=15 plato=11 puan=69.75 imza=...|01fh56w
41002 C t-junction    yol=mixed/6      kavşak=3 düğüm=8  lamba=14 plato=11 puan=68.74 imza=...|1pexfge
41002 D l-shaped      yol=mixed/5      kavşak=2 düğüm=9  lamba=9  plato=9  puan=67.95 imza=...|0686w2z
41002 E split-core    yol=mixed/4      kavşak=4 düğüm=10 lamba=11 plato=10 puan=67.35 imza=...|1kakzsd

41003 A offset-hub    yol=diagonal/4   kavşak=5 düğüm=11 lamba=11 plato=11 puan=68.88 imza=...|1cv258d
41003 B central-spine yol=horizontal/3 kavşak=2 düğüm=9  lamba=10 plato=8  puan=79.75 imza=...|1gvb418
41003 C t-junction    yol=mixed/5      kavşak=5 düğüm=10 lamba=14 plato=11 puan=73.42 imza=...|0y6pkc1
41003 D l-shaped      yol=mixed/6      kavşak=1 düğüm=8  lamba=13 plato=11 puan=69.48 imza=...|03fs8o3
41003 E split-core    yol=mixed/3      kavşak=4 düğüm=10 lamba=14 plato=11 puan=69.01 imza=...|0xckmhu

41004 A split-core    yol=mixed/3      kavşak=2 düğüm=8  lamba=13 plato=7  puan=67.01 imza=...|04x07qn
41004 B offset-hub    yol=diagonal/5   kavşak=2 düğüm=8  lamba=13 plato=11 puan=65.40 imza=...
41005 D split-core    yol=mixed/6      kavşak=2 düğüm=8  lamba=15 plato=10 puan=62.44 imza=...|119vmqk
41005 E t-junction    yol=mixed/2      kavşak=4 düğüm=9  lamba=12 plato=8  puan=76.59 imza=...|1qibr3u

41006 A split-core    yol=mixed/5      kavşak=3 düğüm=9  lamba=19 plato=10 puan=59.99 imza=...|0cdkpqb
41006 B central-spine yol=horizontal/2 kavşak=2 düğüm=9  lamba=10 plato=7  puan=75.68 imza=...|0icwhal
41006 C t-junction    yol=mixed/4      kavşak=4 düğüm=9  lamba=11 plato=9  puan=72.82 imza=...|1e0d5h7
41006 D offset-hub    yol=diagonal/3   kavşak=4 düğüm=10 lamba=18 plato=9  puan=68.93 imza=...|1l1jwdw
41006 E l-shaped      yol=mixed/5      kavşak=3 düğüm=10 lamba=15 plato=8  puan=64.57 imza=...|1ff1bya

41007 A offset-hub    yol=diagonal/3   kavşak=4 düğüm=10 lamba=13 plato=10 puan=67.44 imza=...|0whcio5
41007 B l-shaped      yol=mixed/4      kavşak=1 düğüm=8  lamba=10 plato=11 puan=63.41 imza=...|1cnlxz1
41007 C central-spine yol=horizontal/4 kavşak=1 düğüm=8  lamba=9  plato=9  puan=72.92 imza=...|1qiy6an
41007 D split-core    yol=mixed/5      kavşak=4 düğüm=10 lamba=12 plato=7  puan=71.33 imza=...|1lda0uu
41007 E t-junction    yol=mixed/4      kavşak=3 düğüm=8  lamba=10 plato=9  puan=70.81 imza=...|18908pn

41008 A central-spine yol=horizontal/1 kavşak=2 düğüm=9  lamba=14 plato=8  puan=81.16 imza=...|0fewzp3
41008 B t-junction    yol=mixed/1      kavşak=5 düğüm=10 lamba=16 plato=9  puan=70.62 imza=...|0z1q1n9
41008 C l-shaped      yol=mixed/4      kavşak=2 düğüm=9  lamba=13 plato=9  puan=68.40 imza=...|17lfojw
41008 D split-core    yol=mixed/5      kavşak=4 düğüm=10 lamba=15 plato=12 puan=67.08 imza=...|1y5uoiv
41008 E offset-hub    yol=diagonal/6   kavşak=3 düğüm=9  lamba=12 plato=11 puan=64.82 imza=...|1wiragc
```

40 adayın 40'ı farklı `variationKey`. Her seedde 5 arketip de temsil ediliyor.

### 3.5 Tarayıcı doğrulaması — kısmi

`agentspace_browser` ile `http://localhost:5173/colony` açıldı, panel okundu ve **ekran görüntüsü
alındı**. Sahne doğru render ediyor: kırıklı/dallanan yol ağı, dağınık ve farklı yönlere dönmüş binalar,
yol boyunca dizilmiş sokak lambaları, düzensiz plato silueti. Panel alanları:
`YOL TOPOLOJİSİ = Kırıklı omurga · 5 dönüş`, `KAVŞAK = 4`, `YAPISAL FARK = 0.950`, `YOL KALİTESİ = 5.3`,
`GEÇERLİ = Evet`, FPS 140.

**Yapılamayan:** 8 farklı seed'i tarayıcıdan gezmek. Seed yalnız `ColonyWorkspace.tsx` içindeki React
state'inden (`Yeni Tohum Üret` butonu) değişiyor, URL parametresi yok; `ColonyWorkspace.tsx` izinli
katmanın (`src/game/world/layout/**`) dışında olduğu için ona dokunulmadı. Butona tıklama denemeleri
`Input.dispatchMouseEvent 3000ms içinde dönmedi — guest kare üretmiyor` hatasıyla başarısız oldu
(WebGL canvas kompozisyonu engelliyor). Bu yüzden 8-seed karşılaştırması, panelin okuduğu **aynı kod
yolundan** (§3.4) üretildi; tarayıcıdan yalnız tek seed (41001) görsel olarak doğrulandı.

---

## 4. Riskler

1. **`layoutScoring.roadQuality` yeniden kalibre edildi.** Eski formül (`10 − max(0,total−58)·0.1 −
   turns·0.2`) sabit şablonların kısa/düz yollarına göre ayarlanmıştı. Prosedürel yollarda gerçek dağılım
   toplam uzunluk p10–p90 ≈ 82–112, dönüş p10–p90 ≈ 17–27; eski formül **her adayı 0'a kırpıyordu**, yani
   metrik ayırt etmeyi tamamen bırakmıştı. Yeni formül: `10 − max(0,total−82)·0.09 − max(0,turns−14)·0.22`.
   Bu bir "testi geçirme" hamlesi değil, metriği yeniden çalışır hale getirme; ama **skorlama semantiği
   değişti**, eski seed'lerin puanları yeni puanlarla kıyaslanamaz.
2. **Yollar gerçekten uzadı** (~58 → ~96 birim medyan). Kırılmalı yol istenen özellik, ama bu
   `compactness` skorunu da aşağı çekiyor ve sahnede daha fazla yol yüzeyi demek. Görsel olarak
   kabul edilebilir görünüyor (ekran görüntüsü), fakat sanat yönü isterse `cornerModes` havuzlarındaki
   `dogleg-*` ağırlığı azaltılarak kolayca geri alınabilir.
3. **Üretim maliyeti ~2× arttı** (seed başına ~18 ms → ~35 ms; 100-seed sweep 1.9 s → ~3.3 s).
   Sebebi malzemeleştirme yeniden denemeleri. Dev panelindeki `runLayoutSeedSweep(100)` her seed
   değişiminde koştuğu için UI'da hissedilir bir gecikme olabilir.
4. **Sokak lambası sayısı arttı (9–19), ama renderer yalnız ilk N'ini çiziyor**
   (`WorldScene.tsx`: `quality.streetLights` → low 3 / medium 5 / high 7). Yani lamba çeşitliliğinin
   büyük kısmı 3B sahnede **görünmüyor**. Renderer izinli katmanın dışında olduğu için dokunulmadı.
5. **Üç test güncellendi** (aşağıda gerekçeleriyle). Hiçbiri geçerlilik/determinizm iddiasını
   gevşetmiyor; ikisi eskiyen bir varsayımı düzeltiyor, biri kendi adıyla tutarsız olan bir iddiayı
   düzeltiyor:
   - `structuralLayoutGenerator` **9 & 10**: "A ile B arasında doğrudan main-spine kenarı var" →
     "A ile B, yalnız `spine-link-*` düğümlerinden geçerek main-spine üzerinde bağlı". Kavşak düğümü
     enjeksiyonu doğrudan kenarı zincire çevirdiği için; tasarım niyeti aynen doğrulanıyor.
   - `structuralLayoutGenerator` **20**: "roadNodeId'siz lamba tam olarak `köşe + (0.55,0.55)`" →
     "lamba, bir main-spine poligonuna en fazla 1.6 birim (jeneratörün maksimum yanal ofseti) uzakta".
     Sabit ofset tablosu kaldırıldığı için; "lamba yol grafiğinden türetilir" iddiası korunuyor.
   - `layoutGenerator` **26** ("service road **diğer** facility footprintlerine girmez"): hedef
     tesisin kendisi muaf tutuldu — testin kendi adının ve `layoutValidation`'ın zaten uyguladığı
     sözleşmenin söylediği şey bu. Hedefi de bloke etme denendi ve **8× yavaşlama** getirdi
     (A* ulaşılamaz hedefte 20.000 iterasyon yakıyor: 710 ms → 6167 ms / 20 seed), o yüzden geri alındı.
   - `layoutGenerator` **13** (reactor/habitat güvenlik skoru): `safetySeparation` habitat/mine ve
     habitat/reactor terimlerini karıştırıp 10'da kırpıyor; yeni geometride referans layoutta
     habitat–mine > 18 olduğu için her iki varyant da 10'a kırpılıyor ve test hiçbir şey ölçmüyordu.
     Artık iki varyantta da mine sabit mesafeye çekiliyor, yalnız reactor yakınlığı değişiyor —
     testin **iddia ettiği** şey artık gerçekten ölçülüyor.

---

## 5. Açık sorular

1. **Yol uzunluğu bütçesi ne olmalı?** Medyan 96 birim sanat yönü için kabul edilebilir mi, yoksa
   `dogleg-*` modları seyreltilip 75–85 aralığına mı çekilmeli?
2. **Renderer lamba kapağı** (high=7) prosedürel lamba çeşitliliğini büyük ölçüde görünmez kılıyor.
   `prototypeConfig.ts` / `WorldScene.tsx` ayrı bir görevde yükseltilmeli mi?
3. **Seed'i URL'den okumak** (`/colony?seed=41002`) tarayıcı tabanlı doğrulamayı çok kolaylaştırırdı;
   `ColonyWorkspace.tsx` izinli katman dışındaydı. Ayrı bir görev açılsın mı?
4. `GENERATOR_VERSION` 5.0.0'a çıktı — dondurulmuş/kaydedilmiş bir layout varsa geçersiz olur.
   Şu an böyle bir kalıcı veri görünmüyor, teyit gerekiyor.

---

## 6. Sonraki adım + durum

**Sonraki adım önerisi:** (a) sanat yönüyle yol uzunluğu/kırılma yoğunluğunu kalibre etmek,
(b) renderer'ın sokak lambası kapağını yükseltmek, (c) `/colony?seed=` desteği eklemek.

**git status** (commit ATILMADI, istendiği gibi):
```
 M src/game/world/layout/layoutGenerator.ts
 M src/game/world/layout/layoutScoring.ts
 M src/game/world/layout/nivalisLayoutIntent.ts
 M src/game/world/layout/structuralArchetypes.ts
 M tests/world/layoutGenerator.test.ts
 M tests/world/seed-regeneration-diversity.test.ts
 M tests/world/structuralLayoutGenerator.test.ts
?? docs/agent-results/
?? src/game/world/layout/archetypeVariation.ts
?? tests/world/procedural-parametrization.test.ts
```
Değişen üretim dosyalarının hepsi `src/game/world/layout/**` içinde. `layoutValidation.ts`,
`generatedLayoutSchema.ts`, `layoutTypes.ts`, renderer ve UI dosyalarına dokunulmadı.

**Dev server:** `http://localhost:5173` AÇIK bırakıldı (HTTP 200 ile doğrulandı), kapatılmadı ve
yeniden başlatılmadı.
