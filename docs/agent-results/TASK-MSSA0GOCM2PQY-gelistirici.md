# TASK-MSSA0GOCM2PQY — Faz 5/3: Action persistence, command arbitration ve reason code katmanı

**Ajan:** Geliştirici (Backend Engineer) · **Sprint:** SPRINT-FAZ-5 · **Branch:** `phase-4-deterministic-layout`
**Tarih:** 2026-08-14 · **Önceki faz:** [TASK-MSS9Z9P0EANO6](TASK-MSS9Z9P0EANO6-gelistirici.md) (Faz 5/2)

---

## 1. Ne yapıldı

### (a) Bu oturumun asıl işi: 7 kırık testin kök nedeni

Oturum başında `npm test` **7 failed / 342 passed (349)** veriyordu; hepsi
`tests/simulation/protocolArbitration.test.ts` içindeydi ve hepsi aynı belirtiyi gösteriyordu:
`COMMAND_SUPERSEDED_BY_PRIORITY` / `COMMAND_CONFLICT_EQUAL_PRIORITY` beklenen yerde
**`SAFETY_WORKFORCE_MINIMUM`** dönüyordu.

**Teşhis: hata implementasyonda DEĞİL, test fixture'ında.** `protocolArbitration.ts:232-238`
§13.10(1)'i doğru uyguluyor — Safety Interlock priority yarışından ÖNCE eler. Fixture'ların kurduğu
tesis durumu ise `boost` komutunun güvenlik ön koşulunu karşılamıyordu, dolayısıyla `boost` isteyen
her komut priority yarışına **hiç girmeden** düşüyordu:

1. **Birim testleri (`arbitrate()` fixture'ı):** `createFacilityState()` ekibi sahada saymaz
   (`facilityCommands.ts:72` → `effectiveWorkforce: 0`). `defaultSafetyInterlock`
   (`facilityCommands.ts:59-60`) `boost` için `definition.workforce.boost` (maden = 3) kadar
   **sahadaki** kolonici ister → `facility.workforce-blocks-boost`.
2. **Engine entegrasyon testleri:** baseline kolonide maden ekibi habitat'tan **yürüyerek** gelir ve
   sahaya **34. sim. dakikasında** varır (`workforceSystem.ts:290`, `assignment.phase === 'on-site'`).
   Testler protokolü 25. dakikada tetikleyip `advanceFixedSteps(25)` diyordu → o anda
   `effectiveWorkforce = 0`.

**Uygulanan düzeltme (yalnız fixture, üretim kodu davranışı DEĞİŞMEDİ):**

- `stateOf()` varsayılanı ekibi sahada tutar (`assignedWorkforce: nominal`, `effectiveWorkforce: boost`).
  Interlock'u sınayan testler engeli kendi override'ıyla kurar (düşük kondisyon) — kondisyon kuralı
  workforce kuralından önce değerlendiği için o testler etkilenmedi.
- `modeProtocol()` artık tetik eşiğini parametre alır. `boost` içeren 4 engine senaryosu
  `CREW_ON_SITE_TRIGGER_CONDITION = 99.75` ile tetiklenir; bu eşik **61. dakikada** geçilir ve ekip
  34–75. dakikalar arasında sahadadır. Adım sayısı tam tetikleme tick'idir (`CREW_ON_SITE_STEPS = 61`),
  çünkü `getProtocolActionRequests()` / `getProtocolCommandOutcomes()` yalnız **son fixed step'in**
  verisini döner.
- Serialize/restore determinizm testi de aynı eşiğe taşındı: kesinti (55 adım) tetiklemeden ÖNCE olur,
  arbitration **restore edilmiş** engine'de çalışır — orijinal testin kurduğu senaryonun aynısı.

Bu düzeltmeden sonra 4 test artık gerçekten §13.10(2)/(3) yolunu yürüyor; önceden safety'e takıldıkları
için **iddia ettikleri şeyi test etmiyorlardı.**

### (b) Yan bulgu: 2 lint hatası

`requestOf()` içindeki `as Priority` / `as ProtocolLiteral` assertion'ları gereksizdi
(`@typescript-eslint/no-unnecessary-type-assertion`). Kaldırıldı; `ProtocolLiteral` import'u da
kullanılmaz hâle geldiği için import listesinden çıkarıldı.

### (c) §53.8 reason code'larının Türkçesi

`Protocol.ts:109-110` "metin değil kod taşınır; doğal dil localization üzerinden üretilir" diyor ve
Faz 5/1 aynı fazda `protocol.error.*` metinlerini eklemişti; ama 12 command reason code'unun Türkçesi
yoktu. `src/localization/tr.ts` içine `protocol.commandReason.*` bloğu eklendi ve
`protocolCompiler.test.ts`'teki finding-localization testiyle aynı desende bir kapsam testi yazıldı —
yeni bir kod eklenip Türkçesi unutulursa test kırmızıya düşer. **Faz 6/7 UI'ına dokunulmadı**, yalnız
data katmanı tamamlandı.

---

## 2. Kanıt (gerçek komut çıktısı)

### Başlangıç durumu — 7 kırık test

```
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > lets the highest protocol priority win and marks the loser superseded
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > applies NOTHING when equal priority protocols request incompatible values
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > treats two executions of the SAME protocol exactly like two protocols
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > resolves the conflict only among the top priority tier and supersedes the rest
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > produces the same decision whatever order the requests arrive in
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > applies nothing and records a CONFLICT event when two equal priority protocols disagree
 FAIL  tests/simulation/protocolArbitration.test.ts > ... > lets the higher priority protocol win over a lower one in the same tick

AssertionError: expected [ 'SAFETY_WORKFORCE_MINIMUM' ] to deeply equal [ 'COMMAND_SUPERSEDED_BY_PRIORITY' ]

 Test Files  1 failed | 33 passed (34)
      Tests  7 failed | 342 passed (349)
```

### Teşhisi doğrulayan ölçüm (geçici probe testi, sonra silindi)

Baseline kolonide `mine-01`'in sahadaki iş gücü ve kondisyonu:

```
10 eff=0 cond=99.958333
20 eff=0 cond=99.916667
30 eff=0 cond=99.875000
40 eff=3 cond=99.833333
50 eff=3 cond=99.791667
60 eff=3 cond=99.750000
70 eff=3 cond=99.708333
80 eff=1 cond=99.666667
first step with condition < 99.75: 61
```

→ Ekip 34. dakikada sahaya varıyor; eski testler 25. dakikada tetikliyordu (`eff=0`) ve `boost`
komutu safety'e takılıyordu. `< 99.75` eşiği 61. dakikada geçiliyor, ekip o an sahada (`eff=3`).

### Bitiş durumu

```
> gozlemci-isletim-sistemi@0.0.0 test
> vitest run

 Test Files  34 passed (34)
      Tests  350 passed (350)
   Start at  14:11:18
   Duration  10.31s (transform 1.35s, setup 0ms, collect 12.20s, tests 22.40s, environment 5ms, prepare 3.70s)

=== TYPECHECK ===
> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false

=== LINT ===
> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .
```

Typecheck ve lint **hiçbir çıktı üretmeden** (0 hata) bitti. 350 = görevdeki 349 + `protocol.commandReason`
kapsam testi.

### Build

```
dist/assets/index-CoRhWUz0.css     24.82 kB │ gzip:   4.94 kB
dist/assets/index-CbJ_apIt.js   1,558.19 kB │ gzip: 449.47 kB
✓ built in 3.69s
```

### `tests/architecture/moduleBoundaries.test.ts` değişmedi

```
$ git diff --stat -- tests/architecture/moduleBoundaries.test.ts
(çıktı boş — dosya değişmemiş)
```

---

## 3. Değişen dosyalar

Bu oturumda (Faz 5/3 test düzeltmesi + reason code i18n):

- `tests/simulation/protocolArbitration.test.ts` — `stateOf()` varsayılanına sahadaki iş gücü;
  `modeProtocol()`'a `threshold` parametresi + `CREW_ON_SITE_*` sabitleri; 4 engine senaryosunun
  tetik eşiği/adım sayısı; gereksiz type assertion'ların kaldırılması; `protocol.commandReason`
  kapsam testi.
- `src/localization/tr.ts` — `protocol.commandReason.*` (12 kod, yalnız EKLEME).

Faz 5/3 kapsamında bu oturumdan önce yazılmış ve bu commit'e giren dosyalar:

- `src/game/simulation/protocol/protocolArbitration.ts` (yeni, 272 satır) — §13.10 arbitration,
  §53.8 facility→protokol reason code tablosu, `identityActuatorResolver`.
- `tests/simulation/protocolArbitration.test.ts` (yeni, 22 test).
- `src/game/simulation/SimulationEngine.ts` — `applyProtocolActionRequests()`, komut uygulama,
  `protocol.command-conflict` / `protocol.command-result` event'leri, `getProtocolCommandOutcomes()`.
- `src/game/domain/protocol/Protocol.ts` — `PROTOCOL_COMMAND_REASON_CODES`, `ProtocolCommandOutcome`,
  `ProtocolCommandStatus`.
- `src/game/domain/facilities/Facility.ts` — `FACILITY_ACTUATORS` sabiti + `FacilityActuator` tipi
  (önceden inline union'dı; davranış değişmedi).
- `tests/simulation/protocolRuntime.test.ts` — §13.4 kalıcılık beklentisi (`normal` → `eco`).

---

## 4. Riskler

1. **Engine testlerindeki 61 sayısı aşınma hızına bağlı.** `PHASE_THREE_WEAR_BASELINES.mine`
   (0.25/sa.) veya kolonist yürüme hızı değişirse bu testler kırılır. Sabitler ve nedeni testin
   içinde yorumla yazılı; kırılırsa doğru düzeltme yeni tetik tick'ini ölçüp sabiti güncellemektir,
   testi gevşetmek değil.
2. **Ekibin sahada olduğu pencere sonsuz değil.** Dinlenme döngüsüyle `effectiveWorkforce` ~75.
   dakikadan sonra 1'e düşüyor. 61 bu pencerenin ortasında ama pencere daralırsa senaryo yine
   safety'e takılır — belirti aynı `SAFETY_WORKFORCE_MINIMUM` olur.
3. **`stateOf()` varsayılanı artık "ideal" bir tesis.** Yeni bir arbitration testi yazarken safety
   engeli isteniyorsa override ile açıkça kurulmalı; varsayılan artık engellemiyor.
4. **`protocol.commandReason` metinlerini henüz hiçbir UI okumuyor.** Faz 7 Debugger bağlayana kadar
   ölü veri; kapsam testi en azından kod↔metin eşleşmesini koruyor.

---

## 5. Açık sorular

1. **Faz 5/2'den devreden madde hâlâ açık:** sensör değeri çözülemediğinde request üretilmiyor ve
   **log da üretilmiyor**. §53.7 blocked/failed ayrımı için "değerlendirilemedi" reason code'u
   gerekiyor mu, yoksa bu Faz 5/4 trace'inin işi mi?
2. `delayed` statüsü `ProtocolCommandStatus`'ta tanımlı ama arbitration hiç üretmiyor. Ramp'lı mod
   değişimi (`requiresRampedModeChange`) şu an `blocked` + `SAFETY_RAMP_REQUIRED` dönüyor; spec
   bunun `delayed` olmasını mı bekliyor?
3. Aynı tick'te aynı tesise **farklı actuator**'lere gelen komutlar bağımsız uygulanıyor (ayrı grup).
   Birbiriyle çelişen actuator kombinasyonları (ör. `set-operating-state: offline` + `set-mode: boost`)
   için §13.10 bir kural vermiyor — ürün kararı gerekiyor.
4. `protocol.commandReason` anahtar biçimi büyük harfli kod (`COMMAND_VALUE_INVALID`); `protocol.error`
   ise kebab-case. Tutarsız ama kodlar zaten iki ayrı kaynaktan geliyor; birleştirilsin mi?

---

## 6. Sonraki adım

- **TASK-MSSA1DSD68VFO (Faz 5/4):** execution trace + Faz 5 çıkış kapısı (determinizm & regresyon
  paketi). Bu görevin bıraktığı `getProtocolCommandOutcomes()` çıktısı trace'in ana girdisidir.
- Faz 5 kalite kapısı **kullanıcı onayı** ister (AGENTS.md §3/§8.9); Faz 6 (Protocol Editor UI)
  onay gelmeden açılmaz.
