# TASK-MSSA1DSD68VFO — Faz 5/4: Execution trace + Faz 5 çıkış kapısı

**Ajan:** Geliştirici (Backend Engineer) · **Sprint:** SPRINT-FAZ-5 · **Branch:** `phase-4-deterministic-layout`
**Tarih:** 2026-08-14 · **Önceki faz:** [TASK-MSSA0GOCM2PQY](TASK-MSSA0GOCM2PQY-gelistirici.md) (Faz 5/3)

---

## 1. Ne yapıldı

### (a) Execution trace veri katmanı (§53.5) — önceki turda eklendi

`ProtocolExecutionTrace` / `ProtocolExecutionStep` türleri, `ProtocolRuntime` içinde trace
toplama, `SimulationEngine.getProtocolExecutionTraces()` ve save/load taşınması commit
`dd1e590` ile geldi. Bu turda o katman **testle kilitlendi** ve testlerin ortaya çıkardığı
üç gerçek boşluk kapatıldı.

### (b) Testin ortaya çıkardığı üç boşluk (runtime düzeltmesi)

`tests/` altında `ExecutionTrace` geçen tek bir satır yoktu; iz yazılmıştı ama hiç
doğrulanmamıştı. İlk testler yazılınca üç şey görüldü:

| Bulgu | Ölçüm | Düzeltme |
|---|---|---|
| **Trigger izde yok** | `tick()` root trigger'a `propagate` ediyor, `enter` çağrılmıyor → `case 'trigger'` ÖLÜ KOD. İzde crossing'i doğuran ölçüm hiç yoktu. | `tick()` execution'ı açarken `recordStep(execution, 'trigger', …, observed)` — ölçülen değer izin ilk adımı. |
| **Sensor değeri izde yok** | Validator'da `inputPorts(sensor) = {}` (`protocolValidator.ts:42-46`) → sensor node'a flow kenarı çekmek `edge-port-incompatible` hatası. `enter`'ın `case 'sensor'` dalı da ÖLÜ KOD; sensörler yalnız `readValue` ile pull ediliyor. İzde tek bir `sensorValue` yoktu. | Sensör adımı pull anında (`readValueOfSensor`) yazılıyor. Pull ile ulaşılan `compare`/`and` de artık `evaluateBoolean` içinde kaydediliyor (`port: 'result'`). |
| **Ölü execution iz bırakmıyor** | `finalizeTrace` yalnız Action/Delay'de çağrılıyordu. Sensör okunamayınca karşılaştırma belirsiz kalır, akış eyleme varmaz → **iz hiç oluşmazdı**; yani Debugger'ın (§48.3) cevaplaması gereken tam senaryo izsizdi. | `finalizeTrace` terminüse değil **segment sonuna** bağlandı (`tick()` içinde, propagate döndükten sonra). Adımsız segment iz üretmez. |

Ek kural: **bir node bir execution segmentinde tek adım üretir** (`recordStep` nodeId ile
tekilleştirir). Aynı sensörü iki koşul okuduğunda §13.2 snapshot semantiği gereği değer
zaten aynıdır; iz onu iki kez yazmaz.

İz artık nedensel sırayı taşır — operandlar kendi sonuçlarından önce gelir:

```
trigger t1 (out, sensorValue) → sensor s1 (value) → compare c1 (result)
  → sensor s2 (value) → compare c2 (result) → and and1 (result) → action a1 (in)
```

### (c) `delayed` sorusu ÖLÇÜMLE kapatıldı — mevcut `blocked` DOĞRU

Soru: ramp isteyen tesiste (`requiresRampedModeChange`) komut kabul edilip tesis rampa mı
giriyor (→ §53.7 `delayed`), yoksa reddedilip state değişmeden mi kalıyor (→ `blocked`)?

**Ölçüm:** `defaultSafetyInterlock.evaluate` (`facilityCommands.ts:53-55`) komutu
`allowed:false` + `facility.ramp-config-required` ile eler; `applyFacilityCommand`
`status:'blocked'` döner ve **state'in tek bir alanı değişmez** (test tüm state'i
JSON olarak önce/sonra karşılaştırıyor). Kontrol ölçümü: aynı komut ramp kuralı
olmayan tanımda `applied` + `mode='eco'` üretiyor → engel gerçekten ramp kuralı.

**Karar: `blocked` doğrudur, dokunulmadı.** §53.7 `delayed`'ı "command **kabul edildi**
ancak hedef state hemen oluşmadı" diye tanımlar (spec satır 4033); burada komut kabul
EDİLMİYOR ve rampa da başlamıyor. Bu §53.7'nin `blocked` tanımıdır (satır 4031: "Safety
Interlock … nedeniyle uygulamadı"). Ramp süresi + hedef-state alanı ürün tarafından
tanımlanana kadar `delayed` üretmek izi yalan söyletirdi. Karar üç testle kilitlendi
(`protocolArbitration.test.ts:260-329`).

### (d) Fixture tekrarının kaldırılması

`tests/fixtures/protocolFixtures.ts` eklendi; `protocolRuntime.test.ts` ile
`protocolTrace.test.ts` aynı capability kataloğunu, aynı grafikleri (`directProtocol`,
`delayedProtocol`, `andProtocol`) ve aynı tick harness'ını paylaşıyor. `protocolRuntime.test.ts`
128 satır küçüldü, davranış testleri aynen duruyor.

---

## 2. Kanıt (gerçek komut çıktısı)

### `npm test` — 364 test, 0 failed (öncesi 350)

```
$ npm test
 ✓ tests/simulation/protocolRuntime.test.ts (15 tests) 64ms
 ✓ tests/simulation/protocolArbitration.test.ts (25 tests) 69ms
 ✓ tests/simulation/protocolTrace.test.ts (11 tests) 40ms
 Test Files  35 passed (35)
      Tests  364 passed (364)
   Start at  15:18:50
   Duration  10.20s (transform 1.60s, setup 0ms, collect 11.55s, tests 22.04s, environment 5ms, prepare 3.62s)
```

Artış: **+14 test** (11 yeni trace testi + 3 `delayed` ölçüm testi).

### `npm run typecheck` — exit 0

```
$ npm run typecheck; echo "TYPECHECK_EXIT=$?"

> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false

TYPECHECK_EXIT=0
```

### `npm run lint` — exit 0

```
$ npm run lint; echo "LINT_EXIT=$?"

> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .

LINT_EXIT=0
```

### `npm run build` — exit 0

```
$ npm run build; echo "BUILD_EXIT=$?"
✓ 385 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-CoRhWUz0.css     24.82 kB │ gzip:   4.94 kB
dist/assets/index-Br0mnyiq.js   1,559.84 kB │ gzip: 449.94 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
...
✓ built in 3.63s
BUILD_EXIT=0
```

### Trace testleri gerçekten iz okuyor

```
$ grep -rn "ExecutionTrace" tests/ | wc -l
16
$ grep -rln "ExecutionTrace" tests/
tests/simulation/protocolTrace.test.ts
```
(Önce: 0 eşleşme.)

### Mimari test dokunulmadı

```
$ git diff --stat -- tests/architecture/moduleBoundaries.test.ts
(çıktı boş)
```

### Değişim özeti

```
$ git diff --numstat
60	31	src/game/simulation/protocol/protocolRuntime.ts
72	1	tests/simulation/protocolArbitration.test.ts
13	115	tests/simulation/protocolRuntime.test.ts

$ wc -l tests/simulation/protocolTrace.test.ts tests/fixtures/protocolFixtures.ts
  329 tests/simulation/protocolTrace.test.ts
  128 tests/fixtures/protocolFixtures.ts
```

---

## 3. §48.2 "Protocol Runtime DONE" — madde ↔ test eşlemesi

| # | §48.2 maddesi (spec satır 3818-3823) | Test (dosya:satır) |
|---|---|---|
| 1 | Trigger crossing doğru. | `tests/simulation/protocolRuntime.test.ts:19` (crossing + re-arm), `:40` (crossing olmadan tetiklenmez), `:53` (sensör okunamazken arm bozulmaz) · iz tarafı: `tests/simulation/protocolTrace.test.ts:41` (her pulse ayrı `protocolExecutionId` + ölçüm izde) |
| 2 | Snapshot semantics testli. | `tests/simulation/protocolRuntime.test.ts:89` (tek okuma, tek snapshot), `:106` (delay sonrası GÜNCEL state) · iz tarafı: `tests/simulation/protocolTrace.test.ts:171` (aynı sensörü iki koşul okur → tek okuma, tek adım) |
| 3 | Delay sim time kullanır / save olur. | `tests/simulation/protocolRuntime.test.ts:165` (sim. dakikası ile bekler), `:180` (kalan süre serialize + resume), `:284` (pause'da ilerlemez), `:302` (engine serialize/restore determinizmi) · iz tarafı: `tests/simulation/protocolTrace.test.ts:232` (delay bekleyen execution'ın izi restore'dan sağ çıkar), `:258` (JSON round-trip) |
| 4 | Action persistence testli. | `tests/simulation/protocolArbitration.test.ts:474` (uygulanan mod 100 tick sonra da duruyor, §13.4) · `tests/simulation/protocolRuntime.test.ts:270` (authoritative state'ten request → uygulama) |
| 5 | Priority / conflict / interlock ordering testli. | `tests/simulation/protocolArbitration.test.ts:122` (priority kazanır), `:140` (eşit priority → hiçbiri), `:174` (yalnız üst kademe yarışır), `:222` (interlock priority'den ÖNCE), `:237` (engellenen kritik komut güvenli düşüğü bloklamaz), `:260-329` (ramp → `blocked`, `delayed` DEĞİL), `:396` (sıra bağımsız karar) |
| 6 | Graph cycle reject. | `tests/simulation/protocolCompiler.test.ts:133` (`protocol.error.graph-cycle`) |

Determinizm ayağı (Faz 5 çıkış kriteri "same state/seed deterministic"):
`tests/simulation/protocolTrace.test.ts:221` (aynı girdi iki kez → birebir aynı iz),
`:232` / `:258` (restore sonrası aynı), `:316` (tüm simülasyonun serialize/restore'unda iz aynı).

---

## 4. Değişen dosyalar

| Dosya | Değişim |
|---|---|
| `src/game/simulation/protocol/protocolRuntime.ts` | Trigger adımı, sensor/boolean pull adımları, segment sonunda finalize, node başına tek adım (+60/-31) |
| `tests/simulation/protocolTrace.test.ts` | **YENİ**, 329 satır — 11 test: kimlik, eşzamanlılık, traversal sırası, okunamayan sensör, determinizm, save/load, engine entegrasyonu |
| `tests/fixtures/protocolFixtures.ts` | **YENİ**, 128 satır — runtime + trace testlerinin paylaştığı capability/grafik/harness fixture'ları |
| `tests/simulation/protocolArbitration.test.ts` | §53.7 ramp ölçümü: 3 test (+72/-1) |
| `tests/simulation/protocolRuntime.test.ts` | Fixture'lar ortak dosyaya taşındı (+13/-115), davranış testleri aynen duruyor |

Dokunulmayanlar: `SimulationEngine.ts`, `protocolArbitration.ts`, `protocolCompiler.ts`,
`protocolValidator.ts`, `tests/architecture/moduleBoundaries.test.ts`, tüm UI/React dosyaları.

---

## 5. Riskler

1. **İz sınırsız büyür.** `traces` hiç kırpılmıyor; uzun oturumda bellek doğrusal artar.
   Faz 7'de pencere/pagination (son N execution) gerekiyor. Faz 5 kapsamında bilinçli açık.
2. **`triggeredAt` delay sonrası segmentte "crossing" değil "resume" zamanıdır.** Alan adı
   yanıltıcı; Faz 7 timeline'ı segmentleri `protocolExecutionId` ile gruplarsa doğru okur.
   İsim değişikliği save formatını kırar, bu turda yapılmadı.
3. **Akış dalı (`whenTrue`/`whenFalse`) izde ayrı bir alan değil.** `evaluationResult`'tan
   ve graftan çıkarılabiliyor; Debugger'ın sunum katmanına bırakıldı.
4. **Adım zaman damgası segmentin tick'i.** Bir segment tek fixed step içinde baştan sona
   yürüdüğü için doğru; ileride tick içi yürütme bölünürse bu varsayım gözden geçirilmeli.

---

## 6. Açık sorular

1. **İz penceresi:** son kaç execution bellekte tutulacak, gerisi save'e mi düşecek? (Faz 7 tasarım kararı.)
2. **`delayed` ne zaman doğar?** Ramp süresi + hedef-state alanı ürün tarafından tanımlandığında
   §53.7'nin dördüncü durumu gerçek olur; o zamana kadar `blocked` doğru cevap (bu turda ölçüldü).
3. **Kapsam dışı bırakılanlar (lider kararı):** aynı tesiste farklı actuator'lere çelişkili
   komutlar (§13.10 kural vermiyor) ve `protocol.commandReason` ↔ `protocol.error` anahtar
   biçimlerinin birleştirilmesi.

---

## 7. Sonraki adım

- **Faz 5 kalite kapısı:** §48.2'nin altı maddesi de testle karşılanıyor (yukarıdaki tablo),
  build/lint/typecheck/test temiz. Faz 5 kullanıcı onayına hazır.
- **Faz 6 (Protocol Editor UI):** derleyici + validator + runtime + iz hazır; editör yalnız
  `ProtocolDefinition` üretip `compileProtocol`'ü çağıracak.
- **Faz 7 (Debugger UI):** `getProtocolExecutionTraces()` timeline'ın tek girdisidir; reason
  code'lar `src/localization/tr.ts` üzerinden doğal Türkçeye çevrilir.
