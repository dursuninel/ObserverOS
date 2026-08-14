# TASK-MSS9Z9P0EANO6 — Faz 5/2: Protocol Runtime yürütme çekirdeği + SimulationEngine entegrasyonu

Ajan: Geliştirici (Backend Engineer) · Repo: `C:\Users\Reawakened\Desktop\ObserverOS` · Branch: `phase-4-deterministic-layout`

## 1. Ne yapıldı

Faz 5/1'in ürettiği `ExecutableProtocol` üzerinde **yürütme çekirdeği** kuruldu ve
`SimulationEngine`'e tick başına çağrı olarak bağlandı. Engine yeniden yazılmadı; fixed step
döngüsüne tek bir çağrı eklendi. Katman headless kaldı (React/renderer/browser yok, saat ve
rastgelelik kaynağı yok — `tests/architecture/moduleBoundaries.test.ts` dosyası gevşetilmedi).

### (a) `src/game/simulation/protocol/protocolRuntime.ts` (yeni)

`ProtocolRuntime` sınıfı: `tick(input): readonly ProtocolActionRequest[]`, `exportState()`,
`restoreState()`.

- **Trigger crossing (§13.1, MUST).** Trigger her tick çalışmaz. Runtime state'te
  `protocolId::nodeId` başına `armed` bayrağı tutulur:
  - koşul **yanlış** → `armed = true` (re-arm; pulse yok),
  - koşul **doğru** ve `armed` → pulse üretilir, `armed = false`,
  - koşul **doğru** ama `armed` değil → hiçbir şey olmaz (eşik altında kalmak yeniden tetiklemez).
  - Başlangıçta `armed = false`: koşul zaten doğruyken kurulan bir protokol, karşı tarafa
    geçilip geri dönülmeden tetiklenmez.
  - Sensor okunamıyorsa (`undefined`) arm durumu **değiştirilmez**.
- **Snapshot evaluation (§13.2, MUST).** Bir execution'ın başlangıç değerlendirmesindeki tüm
  sensor okumaları tek bir `Map` snapshot'ından gelir; aynı sensör iki kez okunsa da dünyaya
  yalnız **bir kez** gidilir. Trigger'ın kendi okuması da bu snapshot'ın ilk parçasıdır.
  Delay sonrası devam eden execution için **yeni** snapshot açılır — eski snapshot taşınmaz.
- **Logic (§13.3).** Yalnız `and` + `compare`. Instantaneous boolean evaluation; execution
  dışına taşan gizli memory yok (boolean memo yalnız tek değerlendirme içinde yaşar, §13.2'nin
  tutarlılık kuralı için). OR/NOT/Timer/Cooldown/Counter/Splitter **implement edilmedi**.
  Port tablosu korundu: `result: boolean` pull ile okunur, `whenTrue`/`whenFalse` flow'u dallandırır.
- **Delay (§13.5, MUST).** Wall clock yok. Bekleyen execution
  `{ protocolId, protocolExecutionId, delayNodeId, remainingMinutes }` olarak tutulur; her tick
  `stepMinutes` kadar azalır ve `<= 0` olduğunda `out` portundan devam eder. **Kalan süre**
  serialize edilir. Pause'ta (speed 0) engine tick atmadığı için delay ilerlemez.
- **Execution identity (§53.5).** Her pulse yeni id: `protocol-execution-000001…`, monoton
  sayaçtan; rastgelelik/saat yok, sayaç serialize edilir. Delay beklerken gelen yeni trigger
  ikinci bir execution başlatır; ikisi aynı anda yaşar ve ayrı id taşır.
- **Action (§13.11, §53.6).** Action node tesisi **değiştirmez**; yalnız request üretir.
  Tick sonunda `readonly ProtocolActionRequest[]` döner.
- Değer portları (`left`/`right`/`a`/`b`) **pull** ile çözülür; graph acyclic olduğu için
  özyineleme sonlanır (§13.9). Çözülemeyen bir değer varsa o dal sessizce durur — request üretilmez.
- Determinizm: protokoller id'ye, bekleyen execution'lar `protocolExecutionId`'ye göre
  sıralı işlenir; kenar sırası derleyicinin sıralı `outgoing` listesinden gelir.

### (b) Faz 5/3 ile sözleşme — `ProtocolActionRequest` (`src/game/domain/protocol/Protocol.ts`)

```ts
{ protocolId, protocolExecutionId, priority, facilityId?, actuator, value?, simTime }
```

`facilityId` ve `value`, hedef/değer istemeyen action capability'lerinde bulunmayabilir
(repo idiomu: `exactOptionalPropertyTypes` altında koşullu spread). `actuator` action
capability kimliğidir; facility actuator'üne çözme işi arbitration katmanına aittir.

### (c) `SimulationEngine` entegrasyonu (`src/game/simulation/SimulationEngine.ts`)

- `SimulationEngineOptions.protocols?: { protocols, readSensor }` — sensor kataloğu **data-driven**,
  engine içine gömülmedi (§12: Trigger/Sensor/Action facility capability'sidir; spec kanonik bir
  sensör id listesi vermiyor, uydurulmadı).
- `runFixedSteps` içinde, adımın tüm sistemleri işlendikten sonra tek çağrı:
  `protocolRuntime.tick({ protocols, readSensor, simTime, stepMinutes })`.
  Protokol bağlıyken snapshot adım sonunda tazelenir ki runtime **o tick'in** authoritative
  state'ini okusun; listener'lar hâlâ yalnız `publish()` ile uyarılır.
- `getProtocolActionRequests()` — son fixed step'in request'leri. **Uygulanmaz**; arbitration Faz 5/3.
- `serializeAuthoritativeState()` / `fromSerializedState()` runtime state'i (arm bayrakları,
  bekleyen delay'lerin kalan süresi, execution sayacı) taşır. Eski save'lerde alan yoksa tolere edilir.

### (d) TUNABLE sınırlar (`src/game/simulation/SimulationConfig.ts`)

Spec §13.5/§53.2 rakam vermiyor → AGENTS.md §4 gereği TUNABLE, data katmanında:

```ts
export const PHASE_FIVE_PROTOCOL_LIMITS: ProtocolValidationLimits = Object.freeze({
  delayMaximumMinutes: 24 * 60,   // bir yerel gün (clock.localDayMinutes)
  delayMinimumMinutes: 1,         // bir fixed step (fixedStepMinutes = 1)
  longDelayMinutes: 12 * 60,      // yerel günün yarısı
  thresholdOscillationMargin: 2,  // 0-100 kondisyon/yüzde ölçeğinde dar bant
});
```

Gerekçe: sayılar kanonik yapılardan türetildi, keyfi seçilmedi. Bir fixed step'ten kısa delay
deterministic olarak temsil edilemez (min = 1); üst sınır bir yerel gün, "uzun delay" uyarısı
ise yerel günün yarısıdır ("mission cycle'dan uzun olabilir", §53.3). `SimulationConfig`'e
`protocolLimits?` alanı olarak eklendi, `PHASE_THREE_BASELINE_CONFIG` bunu kullanıyor ve
`validateConfig` aralığın kullanılabilir olduğunu doğruluyor. Engine/runtime içinde delay ile
ilgili **hiçbir sayı hard-code edilmedi**.

### (e) Validator'a **tek** yeni error kodu

`protocol.error.compare-operand-missing`: Compare'in `left` operandı bağlı değilse veya sabit
`comparand` yokken `right` bağlı değilse apply engellenir — runtime böyle bir node'u
değerlendiremez (§53.2 "engelleyen örnekler" kapalı liste değildir). Türkçe karşılığı
`src/localization/tr.ts` içine eklendi. Validator'ın **başka hiçbir kuralına dokunulmadı**;
`protocol.error.action-value-type` ayrı kod olarak duruyor.

### (f) Testler

`tests/simulation/protocolRuntime.test.ts` (yeni, 15 test) + `protocolCompiler.test.ts`'e 1 yeni
validator testi ve kapsam listesine 1 yeni vaka.

## 2. Kanıt (gerçek komut çıktısı)

`npm run typecheck` — exit 0, çıktı yok:

```
> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false
```

`npm run lint` — exit 0, bulgu yok:

```
> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .
```

`npm test` — **328/328 PASS** (Faz 5/1 sonu 312 idi; 16 yeni test, regresyon yok):

```
 Test Files  33 passed (33)
      Tests  328 passed (328)
   Start at  05:18:23
   Duration  10.89s (transform 1.58s, setup 0ms, collect 11.96s, tests 23.66s, environment 5ms, prepare 3.74s)
```

Protokol testlerinin tek tek dökümü (`npx vitest run … --reporter=verbose`, 45/45):

```
 ✓ protocol runtime - trigger crossing (spec §13.1) > pulses only on the crossing and does not re-arm until the threshold is crossed back 3ms
 ✓ protocol runtime - trigger crossing (spec §13.1) > does not fire when the condition is already true without an observed crossing 0ms
 ✓ protocol runtime - trigger crossing (spec §13.1) > leaves the arm state untouched while the sensor cannot be read 0ms
 ✓ protocol runtime - snapshot evaluation (spec §13.2) > reads one consistent world snapshot for every condition inside a single execution 1ms
 ✓ protocol runtime - snapshot evaluation (spec §13.2) > evaluates a condition after a delay against the current state, not the old snapshot 0ms
 ✓ protocol runtime - logic nodes (spec §13.3) > routes the FALSE path when one AND input is false and carries no hidden memory 0ms
 ✓ protocol runtime - delay (spec §13.5) > waits on simulation time and fires exactly when the scheduled minutes elapse 0ms
 ✓ protocol runtime - delay (spec §13.5) > serializes the remaining delay and resumes it after a restore 1ms
 ✓ protocol runtime - execution identity (spec §53.5) > gives every pulse a new deterministic id and hosts concurrent executions 0ms
 ✓ protocol runtime - action requests (spec §13.11, §53.6) > emits the arbitration contract shape without applying anything 0ms
 ✓ protocol runtime - SimulationEngine integration > produces the request from authoritative state without changing the facility 12ms
 ✓ protocol runtime - SimulationEngine integration > does not advance a pending delay while the simulation is paused 2ms
 ✓ protocol runtime - SimulationEngine integration > keeps the pending delay across serialization and stays deterministic 4ms
 ✓ protocol runtime - SimulationEngine integration > runs no protocol when the engine is created without a protocol binding 1ms
 ✓ protocol runtime - SimulationEngine integration > rejects protocol limits that are not a usable range 0ms
 ✓ protocol validation - blocking errors (spec §53.2) > rejects a compare whose operand is left unconnected (runtime cannot evaluate it) 0ms
 ✓ protocol validation - blocking errors (spec §53.2) > covers every declared blocking error code with at least one case 1ms
 Test Files  2 passed (2)
      Tests  45 passed (45)
```

Testler ne kanıtlıyor (iddia değil, kırmızıya düşen gerçek koşullar):

- **Crossing**: `energy 50 → 3 tick: 0 request` · `25 → 1 request` · `20, 5 tick: 0 request`
  (eşik altında kalmak yeniden tetiklemiyor) · `40, 2 tick: 0 request` (yalnız re-arm) ·
  `10 → 1 request`. "Her tick koşulu kontrol et, doğruysa çalıştır" implementasyonu bu testte
  ikinci adımdan sonra 5 fazla request üretirdi.
- **Snapshot**: aynı sensörü iki ayrı Sensor node'undan okuyan bir Compare (`=`); reader her
  çağrıda artan bir sayaç döndürüyor. Sonuç: `energyReads === 1` ve TRUE dalı çalıştı — iki
  condition farklı tick/okuma görmedi.
- **Delay sonrası**: tetikleme anında `energy = 50` (koşul yanlış), delay dolmadan dünya `10`
  oldu; delay bitince TRUE dalı çalıştı → eski snapshot taşınmadı.
- **Engine**: maden kondisyonu aşınmayla 25. sim. dakikasında `99.9`un altına iner; request
  tam o tick'te doğar (`fired == [25]`) ve **tesisin modu `normal` kalır** (uygulanmıyor).
- **Pause**: `setSpeed(0)` sonrası `advanceFixedSteps(50)` ve `advanceWallTime(60_000)` → 0 adım,
  `elapsedMinutes` 26'da sabit, request yok; `setSpeed(1)` sonrası delay kaldığı yerden dolup
  35. dakikada ateşliyor.
- **Save/restore**: 30. dakikada serialize edilen engine geri yüklenip 5 adım ilerletildiğinde,
  hiç kesilmeden 35 adım koşan engine ile **birebir aynı** request'i ve aynı
  `serializeAuthoritativeState()` string'ini üretiyor.
- **Determinizm**: aynı senaryo iki kez koşulduğunda `protocol-execution-000001/000002` id
  dizisi ve request listesi birebir aynı.

Ara koşuda kırmızı olan iki test ve düzeltmesi (testi gevşetmedim, ürün davranışını düzelttim):

```
AssertionError: expected [ 26 ] to deeply equal [ 25 ]
```

Kök neden: `runFixedSteps` snapshot'ı yalnız döngü sonunda `publish()` ile tazeliyordu, bu
yüzden protokolün okuduğu authoritative state bir tick geride kalıyordu (§13.2'ye aykırı).
Çözüm: protokol bağlıyken tick'ten hemen önce snapshot tazelenir (listener'lar hâlâ yalnız
`publish()` ile uyarılır). Diğer iki kırmızı benim test aritmetiğimdi: delay'i tetikleyen
tick'in kendisi delay'i **azaltmaz**, bu yüzden 5 dakikalık delay tetiklemeden 5 tick sonra dolar.

`npm run build` — temiz:

```
✓ 384 modules transformed.
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-CoRhWUz0.css     24.82 kB │ gzip:   4.94 kB
dist/assets/index-BIrrXhLJ.js   1,550.35 kB │ gzip: 447.40 kB
✓ built in 3.83s
```

(500 kB chunk uyarısı Faz 4'ten beri var olan mevcut durumdur, bu görevde değişmedi.)

`tests/architecture/moduleBoundaries.test.ts` **değiştirilmedi** ve PASS: simulation altında
react/three/zustand/@xyflow importu, browser global'i, `Date.now` / `Math.random` /
`performance.now` metni yok.

## 3. Değişen dosyalar

- `src/game/simulation/protocol/protocolRuntime.ts` — **yeni**: `ProtocolRuntime`
  (`tick`/`exportState`/`restoreState`), trigger crossing arm state, per-execution sensor
  snapshot, pull tabanlı değer çözümü, delay scheduling, `ProtocolSensorReader` tipi.
- `src/game/domain/protocol/Protocol.ts` — `ProtocolActionRequest` sözleşmesi eklendi;
  `PROTOCOL_ERROR_CODES`'a `protocol.error.compare-operand-missing` eklendi.
- `src/game/simulation/protocol/protocolValidator.ts` — compare bloğuna **yalnız** bağlanmamış
  operand kuralı eklendi (`leftConnected` / `rightConnected`); başka kural değişmedi.
- `src/localization/tr.ts` — `protocol.error.compare-operand-missing` Türkçe metni (yalnız ekleme).
- `src/game/simulation/SimulationConfig.ts` — `PHASE_FIVE_PROTOCOL_LIMITS` sabiti,
  `SimulationConfig.protocolLimits?` alanı, `PHASE_THREE_BASELINE_CONFIG.protocolLimits` bağlandı.
- `src/game/simulation/SimulationEngine.ts` — `SimulationProtocolOptions`, `protocolRuntime`
  alanı, `runFixedSteps` içinde tick çağrısı + snapshot tazeleme, `getProtocolActionRequests()`,
  serialize/restore'a `protocolRuntime` state'i, `validateConfig`'e `protocolLimits` aralık kontrolü.
- `tests/simulation/protocolRuntime.test.ts` — **yeni**: 15 test.
- `tests/simulation/protocolCompiler.test.ts` — bağlanmamış operand testi + kapsam listesine vaka.
- `docs/agent-results/TASK-MSS9Z9P0EANO6-gelistirici.md` — bu rapor.

Dokunulmayanlar: `src/game/world/**`, `src/game/ui/**`, `src/game/simulation/systems/**`,
`protocolCompiler.ts`, `tests/architecture/moduleBoundaries.test.ts`.

## 4. Riskler

1. **Sensor kataloğu hâlâ yok.** Runtime dünyayı `readSensor(sensorId, facilityId)` üzerinden
   okur ve bu fonksiyon çağırandan gelir. Spec kanonik bir sensör id listesi vermediği için
   (§12: capability'dir) uydurmadım — sonuç: engine'e protokol bağlanmadıkça oyunda hiçbir
   protokol çalışmaz. Gerçek oyunda çalışması için sensör kataloğu (`energy-level`,
   `facility-condition`, …) bir ürün kararı olarak tanımlanmalı.
2. **Snapshot tazeleme maliyeti.** Protokol bağlıyken her fixed step'te bir `createSnapshot()`
   daha üretiliyor (sıralama + map). 60 adımlık ilerlemede ölçülebilir maliyet; protokol
   bağlı değilse hiç çalışmaz. Gerekirse protokol için hafif bir okuma görünümü türetilebilir.
3. **Çözülemeyen değer sessizce dalı durduruyor.** Sensor `undefined` dönerse veya tip
   eşleşmezse request üretilmez ve **log da üretilmez**. §53.7'nin blocked/failed ayrımı ve
   trace Faz 5/3–5/4 işi; oraya bir "değerlendirilemedi" reason code'u eklenmeli.
4. **Arm state protokol silinince temizlenmiyor.** `protocolId::nodeId` anahtarları runtime
   state'te kalır (küçük ama sınırsız büyüyebilir). Protocol lifecycle yönetimi (apply/disable)
   bu fazın kapsamında değildi; lifecycle geldiğinde temizleme kancası eklenmeli.
5. **Aynı protokolün yeni sürümü aynı arm state'i devralır.** `version` anahtara girmiyor;
   §11.2 apply akışı geldiğinde davranış (yeni sürüm re-arm mı olmalı?) ürün kararıdır.
6. **`npm run results:index` bu repoda yok** (package.json'da böyle bir script,
   `docs/agent-results/INDEX.md` de yok). Komut koşulamadı; indeks tazelenmedi — 5/1'deki durum.
7. **`dev` branch'i bu repoda yok.** Commit, 5/1 ile aynı `phase-4-deterministic-layout`
   branch'ine atıldı; push yapılmadı.

## 5. Açık sorular

1. Sensör kataloğu: hangi `sensorId`'ler kanonik, hangi facility hangi sensörü sunuyor ve
   değerleri authoritative state'in neresinden okunuyor? (Runtime'ın oyunda çalışması için
   tek eksik parça budur.)
2. Bir Action node'un aynı tick'te iki kez tetiklenmesi (ör. iki execution aynı actuator'ü
   istiyor) arbitration'da nasıl ayrıştırılacak — §13.10 sırası aynı protokolün iki
   execution'ı için de mi geçerli?
3. Delay'de bekleyen bir execution'ın protokolü disable edilirse bekleyen execution iptal mi
   edilmeli, yoksa tamamlanmalı mı? Şu an protokol listeden çıkarsa bekleyen execution
   sessizce düşer.
4. `thresholdOscillationMargin` sensör birimine göre değişmeli mi? Şu an tek bir global sayı
   (0-100 ölçeği varsayımıyla 2).

## 6. Sonraki adım

- **TASK-MSSA0GOCM2PQY (Faz 5/3):** `getProtocolActionRequests()` çıktısını tüketip
  `applyFacilityCommand` + `defaultSafetyInterlock` üzerinden uygula; §13.10 conflict sırası
  (Safety > priority > eşit priority = hiçbiri + `CONFLICT` event), §53.7 blocked/failed/delayed
  ve §53.8 reason code'ları. Sözleşme: `ProtocolActionRequest` şekli değiştirilmeden kullanılır.
- **TASK-MSSA1DSD68VFO (Faz 5/4):** execution trace + determinizm/regresyon çıkış kapısı.
