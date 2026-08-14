# TASK-MSS9Y98ZJTWWB — Faz 5/1: Protokol veri modeli, Validator ve Compiler (headless)

Ajan: Geliştirici (Backend Engineer) · Repo: `C:\Users\Reawakened\Desktop\ObserverOS` · Branch: `phase-4-deterministic-layout`

## 1. Ne yapıldı

Faz 5 Protocol Runtime'ın **veri modeli + derleme** katmanı sıfırdan kuruldu. Katman tamamen
headless'tır: hiçbir React / @xyflow / renderer dosyasına dokunulmadı, `SimulationEngine`
entegrasyonu (Faz 5/2 işi) yapılmadı.

### (a) `src/game/domain/protocol/Protocol.ts` (yeni)
- `ProtocolDefinition { id, name, priority, lifecycle, version, nodes, edges }`.
- `Priority` **import edilir** (`../facilities/Facility`), yeniden tanımlanmaz.
- Lifecycle: `draft | validated | active | disabled | archived` (§11.2).
- Node union `kind` discriminated union olarak **yalnız 6 node**: `trigger`, `sensor`,
  `compare`, `and`, `delay`, `action`. §12'deki OR/NOT/Timer/Cooldown/Counter/Splitter
  tanımlanmadı, tip listesine eklenmedi (union yeni `kind` eklemeye açık bırakıldı).
- Port tipleri §53.1: `flow | boolean | number | enum:<domain> | entityRef:<type>`
  (`ProtocolPortType` / `ProtocolValueType` template literal tipleriyle). Implicit dönüşüm yok.
- Compare operatörleri kodda ASCII: `'<' | '>' | '<=' | '>=' | '=' | '!='`.
- Editör alanı (position/selection/color) tipte **yok** (§53.4).
- Capability sözleşmesi data-driven: `ProtocolCapabilities { sensors, actions, facilities,
  activeActionClaims?, limits }`. Facility listesi hard-code **edilmedi**; sayısal sınırlar
  (`delayMinimumMinutes`, `delayMaximumMinutes`, `longDelayMinutes`,
  `thresholdOscillationMargin`) TUNABLE olarak çağırandan gelir, engine içine gömülmedi.
- Bulgu kodları sabit listeler halinde: `PROTOCOL_ERROR_CODES` (11), `PROTOCOL_WARNING_CODES` (5).

Port şeması (validator içinde tablo halinde):

| Node | Girişler | Çıkışlar |
|---|---|---|
| trigger | — | `out: flow` |
| sensor | — | `value: <capability valueType>` |
| compare | `in: flow`, `left: value`, `right: value` (yalnız sabit operand yoksa) | `whenTrue: flow`, `whenFalse: flow`, `result: boolean` |
| and | `in: flow`, `a: boolean`, `b: boolean` | `whenTrue: flow`, `whenFalse: flow`, `result: boolean` |
| delay | `in: flow` | `out: flow` |
| action | `in: flow` | — |

### (b) `src/game/simulation/protocol/protocolValidator.ts` (yeni)
`validateProtocol(definition, capabilities?): ProtocolValidationReport`.
§53.2'deki **10 blocking error'ın hepsi** + §53.1'den türeyen 1 tip hatası:

| # | Kod | Kaynak |
|---|---|---|
| 1 | `protocol.error.trigger-missing` | §53.2 Trigger yok |
| 2 | `protocol.error.multiple-root-triggers` | §53.2 birden fazla bağımsız root Trigger |
| 3 | `protocol.error.action-required-field-missing` | §53.2 Action required target/value eksik |
| 4 | `protocol.error.action-value-type` | §53.1 implicit dönüşüm yasağı (aşağıda "Riskler") |
| 5 | `protocol.error.compare-operand-type` | §53.2 Compare operand type incompatible |
| 6 | `protocol.error.and-input-missing` | §53.2 AND input eksik |
| 7 | `protocol.error.graph-cycle` | §53.2 + §13.9 |
| 8 | `protocol.error.delay-duration-out-of-range` | §53.2 Delay ≤0 veya schema range dışı |
| 9 | `protocol.error.edge-port-incompatible` | §53.2 edge incompatible port'a bağlı |
| 10 | `protocol.error.capability-unavailable` | §53.2 sensor/action capability'de yok |
| 11 | `protocol.error.deleted-facility-reference` | §53.2 silinmiş facility instance'a hard ref |

§53.3'teki 5 warning apply'i **engellemez** (`report.valid` yalnız error'lara bakar):
`action-value-unchanged`, `no-affected-facility`, `potential-conflict`,
`threshold-oscillation-risk` (yalnız risk söylenir, çözüm önerilmez), `long-delay`.

Her bulgu `{ code, severity, nodeId?, edgeId? }`. Türkçe metin **koda gömülmedi**;
`src/localization/tr.ts` içine `protocol.error.*` / `protocol.warning.*` anahtarları
eklendi (yalnız ekleme, mevcut anahtarlara dokunulmadı) ve kod → i18n key birebir aynıdır.

Determinizm: düğüm/kenar listeleri id'ye göre sıralanır, bulgular `code|nodeId|edgeId`
anahtarıyla tekilleştirilip sıralanır → giriş sırası değişse de rapor birebir aynıdır.

### (c) `src/game/simulation/protocol/protocolCompiler.ts` (yeni)
`compileProtocol(definition, capabilities?): CompileResult`.
- Yalnız `report.valid === true` (error yok) olan definition derlenir; aksi halde
  `{ status: 'rejected', report }`.
- `ExecutableProtocol { id, version, priority, rootTriggerId, nodes, compiledHash }` —
  topolojik sırada düz node listesi + her node'un `outgoing` adjacency'si.
- Topolojik sıralama Kahn; hazır düğümler arasından **her zaman en küçük id** seçilir
  (Map/Set iteration sırasına bağımlı değil).
- `sanitizeNode` yalnız bilinen alanları kopyalar → editör alanı (position/selected/color)
  runtime temsile **sızmaz** (§53.4).
- `compiledHash`: saf FNV-1a (32-bit, hex) — kanonik token string üzerinden. Hash yalnız
  semantiği taşır (id, version, priority, node alanları, kenarlar); `name` ve `lifecycle`
  hash'e girmez. Saat/rastgelelik kaynağı kullanılmaz.
- Runtime yürütme mantığı (pulse akışı, delay zamanlaması, snapshot) **yoktur** → Faz 5/2.

### (d) `tests/simulation/protocolCompiler.test.ts` (yeni, 29 test)
Her blocking error için ≥1 vaka + "11 kodun hepsi en az bir vakada üretiliyor" kapsam testi,
her warning için birer vaka, cycle reddi (validator + compiler), iki kez derlemede birebir
aynı hash, node/edge sırası ters çevrildiğinde birebir aynı `ExecutableProtocol`, semantik
değişince hash değişimi, editör alanı sızmadığı, ve tüm bulgu kodlarının Türkçe karşılığı
olduğu (i18n üzerinden).

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

`npm test` — **312/312 PASS** (Faz 4 sonu 283 idi; 29 yeni test eklendi, regresyon yok):

```
 ✓ tests/world/layoutGenerator.test.ts (45 tests) 8222ms
 ✓ tests/world/structuralLayoutGenerator.test.ts (28 tests) 9833ms

 Test Files  32 passed (32)
      Tests  312 passed (312)
   Start at  04:52:38
   Duration  10.72s (transform 1.61s, setup 0ms, collect 12.11s, tests 23.25s, environment 5ms, prepare 3.73s)
```

`tests/architecture/moduleBoundaries.test.ts` **gevşetilmedi** (dosya değişmedi) ve PASS.
İlk koşuda bu test kırmızıydı:

```
 FAIL  tests/architecture/moduleBoundaries.test.ts > module boundaries >
keeps simulation free of presentation and browser dependencies
AssertionError: game\simulation\protocol\protocolCompiler.ts uses
Date.now: expected true to be false
```

Kök neden: mimari test dosya metninde **düz string araması** yapıyor; benim yazdığım
Türkçe yorum satırı "Math.random/Date.now kullanılmaz" ifadesini içeriyordu — kodda böyle
bir çağrı yoktu. Testi gevşetmek yerine yorum metni yeniden yazıldı
("saat veya rastgelelik kaynağı yoktur"), test olduğu gibi geçti.

`npm run build` — temiz:

```
> gozlemci-isletim-sistemi@0.0.0 build
> tsc -b && vite build
vite v7.3.6 building client environment for production...
✓ 383 modules transformed.
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-CoRhWUz0.css     24.82 kB │ gzip:   4.94 kB
dist/assets/index-DDyrq_u2.js   1,544.83 kB │ gzip: 445.76 kB
✓ built in 3.95s
```

(500 kB chunk uyarısı Faz 4'ten beri var olan mevcut durumdur, bu görevde değişmedi.)

`npm run dev` + gerçek tarayıcı: **5173 portu başka bir uygulama tarafından tutuluyordu**,
Vite kendiliğinden `http://localhost:5174/` portuna geçti; doğrulama o adreste yapıldı.

```
Port 5173 is in use, trying another one...
  VITE v7.3.6  ready in 226 ms
  ➜  Local:   http://localhost:5174/
```

`/colony` gerçek tarayıcıda açıldı ve dünya render ediyor (FPS 140, çizim 179, üçgen 23282,
simülasyon 44 sim. dakika ilerlemiş):

`docs/agent-results/TASK-MSS9Y98ZJTWWB-screenshots/01-colony-dev-5174.png`

Not: sayfa açılır açılmaz alınan ilk karede canvas siyah ve FPS 0 görünüyordu; bu asset
yüklenmesi tamamlanmadan alınan kare olduğu için ikinci kare beklenip alındı. Bu görevde
hiçbir UI/world dosyasına dokunulmadı.

## 3. Değişen dosyalar

- `src/game/domain/protocol/Protocol.ts` — **yeni**: ProtocolDefinition, 6 node union,
  port/değer tipleri, capability sözleşmesi, bulgu kodu listeleri.
- `src/game/simulation/protocol/protocolValidator.ts` — **yeni**: `validateProtocol`,
  port şeması, 11 error + 5 warning kuralı, cycle taraması, deterministic bulgu sırası.
- `src/game/simulation/protocol/protocolCompiler.ts` — **yeni**: `compileProtocol`,
  FNV-1a `compiledHash`, Kahn topolojik sıralama, `sanitizeNode`.
- `src/localization/tr.ts` — **yalnız ekleme**: `protocol.error.*` (11) ve
  `protocol.warning.*` (5) doğal Türkçe metinleri.
- `tests/simulation/protocolCompiler.test.ts` — **yeni**: 29 test.
- `docs/agent-results/TASK-MSS9Y98ZJTWWB-gelistirici.md` + `-screenshots/` — bu rapor.

Dokunulmayanlar (kural gereği): `src/game/world/**`, `src/game/ui/**`,
`src/game/simulation/SimulationEngine.ts`, mevcut testler.

## 4. Riskler

1. **Port topolojisi spec'te satır satır yazılı değil.** §53.1 port *tiplerini*, §13.3
   "Condition TRUE/FALSE path'leri olabilir" ifadesini veriyor; hangi node'un hangi porta
   sahip olduğu kanonik metinde tablo halinde yok. Compare/AND'i hem `result: boolean`
   çıkışı hem `whenTrue`/`whenFalse` flow çıkışı olacak şekilde modelledim: böylece
   §53.1'in beş tipi de kullanılıyor, §12.2'nin "Gate node yok" kuralı ihlal edilmiyor ve
   yeni node uydurulmuyor. Faz 6 editörü farklı bir port düzeni isterse bu tablo tek
   yerde (validator'daki `inputPorts`/`outputPorts`) değişir.
2. **`protocol.error.action-value-type` §53.2 listesinde birebir yok.** §53.2 "Action
   required target/value eksik" der; ben *yanlış türde* değeri ayrı kodla raporluyorum,
   dayanağı §53.1'in "implicit string→number/boolean→number dönüşüm yapılmaz" kuralıdır.
   Ayrı kod istenmiyorsa `action-required-field-missing` altında birleştirilebilir.
3. **AND arity 2 kabul edildi** (`a`, `b`). Spec arity vermiyor. Üçlü koşul AND zinciriyle
   kurulur (AND'in `result` çıkışı başka bir AND'in girişine bağlanabilir).
4. **Compare'in bağlanmamış operandı hata sayılmıyor.** §53.2'de yalnız "AND input eksik"
   var; Compare için karşılığı yok, bu yüzden uydurmadım. Faz 5/2 runtime'ında böyle bir
   Compare değerlendirilemez — ürün kararı gerekiyorsa 12. bir error kodu eklenmeli.
5. **`compiledHash` 32-bit FNV-1a.** Çakışma olasılığı sıfır değildir; kimlik/eşitlik
   kararı için `ExecutableProtocol` karşılaştırması esas, hash hızlı ayırt edici olarak
   kullanılmalı. Daha geniş hash gerekirse fonksiyon tek yerde değişir.
6. **`npm run results:index` bu repoda yok** (package.json'da böyle bir script,
   `docs/agent-results/INDEX.md` de yok). Komut koşulamadı; indeks tazelenmedi.
7. **`dev` branch'i bu repoda yok.** Commit, görevde belirtilen `phase-4-deterministic-layout`
   branch'ine atıldı; push yapılmadı (prod/remote'a itme yalnız onayla).

## 5. Açık sorular

1. Faz 6 editörü Compare/AND için hangi portları çizecek — `whenTrue`/`whenFalse` flow
   çıkışları onaylanıyor mu, yoksa koşullar yalnız `boolean` üretip akışı Action mı
   kesecek? (Bu, port tablosunun tek gerçek kaynağını belirler.)
2. Delay için kanonik schema aralığı kaç dakikadır (min/max) ve "mission cycle" uzunluğu
   nedir? Şu an bunlar TUNABLE olarak çağırandan alınıyor; spec'te sayı bulamadım,
   uydurmadım. Faz 5/2 config'inde sabitlenmeli.
3. `thresholdOscillationMargin` (warning eşiği) hangi birimde ve kaç olmalı? Sensor
   birimine göre değişmesi gerekiyor mu?
4. Trigger yalnız threshold tipi mi olacak (§13.1) yoksa event-tabanlı trigger da gelecek mi?
   Şu an model yalnız threshold trigger'ı taşıyor.
5. Action değerinin bir kenardan (sensor/compare çıktısından) beslenmesi kanonik mi?
   Şu an değer node üstünde sabit literal; §13.4 buna aykırı değil ama Faz 6'da
   dinamik değer istenirse `value` portu açılmalı.

## 6. Sonraki adım

- **TASK-MSS9Z9P0EANO6 (Faz 5/2):** `ExecutableProtocol` üzerinde yürütme çekirdeği —
  trigger crossing re-arm (§13.1), snapshot evaluation (§13.2), Delay simulation time +
  save (§13.5), `protocolExecutionId` (§53.5) ve SimulationEngine entegrasyonu.
- Faz 5/2 başlarken bu görevdeki açık sorular 1-2 karara bağlanmalı (port tablosu ve
  Delay aralığı), aksi halde runtime testleri iki farklı varsayım üzerine kurulur.
