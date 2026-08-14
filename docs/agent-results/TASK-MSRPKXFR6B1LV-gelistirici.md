# TASK-MSRPKXFR6B1LV — `/colony` açılış hatası: tespit ve düzeltme

**Branch:** `phase-4-deterministic-layout`
**Kırılmayı getiren commit:** `3a0f869` — "Faz 4 - Test 3: Default seçeneği ekle (Faz 3 sabit yerleşim)"
**Durum:** Düzeltildi, gerçek tarayıcıda uçtan uca doğrulandı.

---

## 1. Şikâyet

"Oyun doğru açılmıyor."

## 2. Kök neden

`3a0f869` commit'i `layoutMode: 'generated' | 'prototype'` state'ini ekledi ve **başlangıç
değerini `'prototype'` (Default)** yaptı. Ancak Default yolunu tamamlamadı. İki ayrı arıza
üst üste bindi:

### 2a. Çalışma anında çökme (bomboş ekran)

| Dosya | Sorun |
|---|---|
| `LayoutCandidatePanel.tsx:21-24` | Guard yalnız `'generated'` modunu kapsıyordu; açılış modu `'prototype'` olduğu için `candidate` `null` iken `candidate.scoreBreakdown` deref ediliyordu → `TypeError` |
| `CameraRig.tsx:10` | `layout` prop tipi non-null idi, `WorldScene` `null` geçiyordu; `layout.cameraBounds` üç noktada deref ediliyordu |

Ayrıca `tsc -b` **20+ hata** verdiği için `npm run build` de tamamen kırıktı.
(`vite dev` typecheck yapmadığı için "çalışıyor" görünüp build'in kırık olduğu fark edilmemişti.)

### 2b. Asıl arıza: Default modu hiçbir şey çizmiyordu

Çökme giderildikten sonra bile `/colony` **bomboş bir siyah sahne** açıyordu. Sebep:
`3a0f869`'un `usePrototypeLayout` dalı yalnızca arka plan rengi, sis, ışık ve kar içeriyordu —
zemin, yol, tesis, sokak lambası, kolonist **yoktu**.

Commit'in kendi mesajı bunu itiraf ediyor:

> `WorldScene.tsx: usePrototypeLayout prop, true ise Faz 3 fallback (kamera+ortam, **layout yok**)`

Bu, commit'in başlığıyla çelişiyor: "Default = Faz 3'ün sabit PROTOTYPE_LAYOUT". Yani Default'un
Faz 3 sabit kolonisini göstermesi amaçlanmış, ama boş sahne implement edilmiş — ve bu boş sahne
oyunun **açılış** ekranı yapılmış.

Arka plan: Faz 4 Test 1/Test 2 (`eebd645`, `85e6f2b`) renderer'ı `PROTOTYPE_LAYOUT`'tan
`getGeneratedFacility` / `getGeneratedRoadTilePlacements` sorgularına taşımıştı. Faz 3'ün çizim
yolu böylece renderer'dan kalkmıştı; `3a0f869` onu geri bağlamadı.

## 3. Düzeltme

Yön: Default gerçekten Faz 3 sabit yerleşimini çizsin. Fakat mimari test
`41. renderer generated layout placement tüketir` renderer'ın yerleşim seçimi yapmasını
yasaklıyor (`WorldScene.tsx` içinde `getFacilityPlacement(id)` bulunması testi kırar).
**Test gevşetilmedi.** Bunun yerine "generated layout yoksa Faz 3 sabit verisi" kararı
sorgu katmanına (`layoutQueries.ts`) taşındı. Renderer hâlâ yalnız sorguların döndürdüğünü
tüketiyor.

`layoutQueries.ts` artık `GeneratedPlanetLayout | null` kabul ediyor; `null` ⇒ `PROTOTYPE_LAYOUT`.

## 4. Doğrulama (hepsi gerçekten koşturuldu)

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | ✅ 0 hata (önce: exit 2, 20+ hata) |
| `npm run lint` | ✅ 0 uyarı |
| `npm test` | ✅ **263/263 PASS**, 29/29 dosya |
| `npm run build` | ✅ `built in 3.88s` |
| Gerçek tarayıcı `/colony` | ✅ aşağıdaki 3 adım |

Mimari test 41 ve 42 dahil tüm Faz 4 testleri değiştirilmeden geçiyor.

### Tarayıcı E2E (localhost:5173, konsolda yakalanmamış hata yok)

1. **Açılış — Default modu** → `04-FIX-default-faz3-koloni-render.png`
   Faz 3 kolonisi tam çiziliyor. Metrikler: FPS 142 · Çizim 82 · Üçgen 58340 · Işık 12
   (düzeltme öncesi: Çizim 0-1 · Üçgen 0 · Işık 0 — bkz. `01-default-mode-no-crash.png`)
2. **ADAY A** → `05-FIX-aday-a-generated.png`
   Üretilmiş yerleşim çiziliyor, skor tablosu doluyor (Tohum 41001, Toplam Puan 64.38).
3. **Default'a dönüş** → `06-FIX-default-donus.png`
   Çökme yok, Faz 3 kolonisi geri geliyor, kolonistler yollarda yürümeye devam ediyor.

`01`–`03` numaralı ekran görüntüleri **düzeltme öncesi** durumu belgeliyor; `04`–`06` sonrası.

## 5. Değişen dosyalar

- `src/game/world/layout/layoutQueries.ts` — nullable-layout sorgu katmanı; `RenderFacilityPlacement`
  / `RenderPropPlacement` sözleşmeleri, `getGeneratedFacility` overload'u, `getGeneratedStreetLights`,
  `getGeneratedPlateauVertices`, `getGeneratedHazeAnchors`, `getGeneratedExpansionPads`,
  `getGeneratedPropPlacements` eklendi; `getGeneratedRoadTilePlacements` null kabul ediyor
- `src/game/world/renderer/WorldScene.tsx` — boş `usePrototypeLayout` dalı kaldırıldı, tek render
  yolu; alt bileşenler nullable layout alıyor; `layout!` non-null assertion kaldırıldı
- `src/game/world/renderer/CameraRig.tsx` — `layout` prop `| null`; `cameraBounds` türetmeleri
  opsiyonel fallback'e bağlandı
- `src/game/ui/colony/LayoutCandidatePanel.tsx` — null candidate deref'i giderildi, skor tablosu
  `CandidateScoreGrid` alt bileşenine ayrıldı; **buton satırı her iki modda da görünür kalıyor**
- `src/game/ui/colony/ColonyWorkspace.tsx` — `selectedLayout`'tan sızan `undefined` normalize edildi
- `src/game/ui/colony/PrototypeDebugPanel.tsx` — `layoutMode` / `onLayoutModeChange` zorunlu yapıldı
- `src/game/world/prototype/cameraMath.ts` — `getLayoutOverviewZoom` `bounds` parametresi opsiyonel

## 6. Kapsam dışı bırakılanlar (kasıtlı)

- Faz 4 jeneratörü (`layoutGenerator.ts`, `materializeArchetype`, arketip/skorlama) — dokunulmadı
- `SimulationConfig`, `tr.ts` — dokunulmadı
- "Default" özelliği — kaldırılmadı, aksine çalışır hâle getirildi
- Hiçbir test gevşetilmedi, hiçbir yeni gameplay/tesis/kaynak uydurulmadı

## 7. Açık kalan

**Faz 4 blocker hâlâ açık:** ADAY A–E arasından hangisinin kampanya yerleşimi olacağı
kullanıcı kararıdır (AGENTS.md faz-atlama yasağı). Faz 5'e geçilmedi.
