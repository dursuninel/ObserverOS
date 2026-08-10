# Son Çalışmalar

Bu dosya, Gözlemci İşletim Sistemi geliştirme fazlarının sonunda yapılan çalışmaların genel kaydını tutar. Her faz tamamlandığında aşağıdaki başlıklar kullanılarak yeni bir kayıt eklenir:

- kapsam ve amaç
- oluşturulan veya değiştirilen ana yapılar
- mimari kararlar ve sınırlar
- doğrulama sonuçları
- açık teknik borçlar
- bilinçli olarak sonraki fazlara bırakılan alanlar

Kanonik ürün davranışı için kaynak bu dosya değil, `docs/Gozlemci_OS_Kanonik_Tasarim_ve_Gelistirme_Spesifikasyonu_v10_3.md` dosyasıdır.

---

## Faz 0 — Proje Temeli ve Teknik İskelet

**Durum:** Tamamlandı  
**Tarih:** 10 Ağustos 2026

### Kapsam ve amaç

Domain sınırlarını erken kurmak amacıyla React ve TypeScript tabanlı web uygulama kabuğu hazırlandı. Bu fazda gerçek gameplay, Simulation Core, facility davranışları veya gezegen içeriği uygulanmadı.

### Ana çalışmalar

- React, TypeScript ve Vite geliştirme/build altyapısı kuruldu.
- Strict TypeScript, ESLint ve Vitest kalite kapıları eklendi.
- Üç kanonik çalışma alanı için routing shell oluşturuldu: KOLONİ, PROTOKOLLER ve HATA AYIKLAMA.
- Uygulama provider composition sınırı oluşturuldu.
- React'tan ve browser altyapısından bağımsız `SimulationEngine` shell'i eklendi.
- `GameSession`, simulation ile save portunu birleştiren minimal composition sınırı olarak tanımlandı.
- Zustand store yalnız UI/view state tutacak şekilde sınırlandırıldı.
- React Three Fiber dünya renderer shell'i oluşturuldu; gameplay kararı verilmedi.
- React Flow yalnız editor integration boundary olarak eklendi; compiler/runtime uygulanmadı.
- Declarative Zod content manifest şeması ve startup fail-fast doğrulaması eklendi.
- Geçerli, geçersiz ve eksik localization key senaryoları test edildi.
- Türkçe-first i18n altyapısı ve başlangıç localization kaynağı eklendi.
- Domain portu olarak `SaveRepository`, IndexedDB adapter stub'ı ve migration extension point oluşturuldu.
- Kanonik metadata alanlarını taşıyan `AssetRegistry` contract/shell eklendi.
- Circular dependency ve yasak simulation importlarını denetleyen mimari testler eklendi.

### State ownership ve dependency sınırları

- Simulation Engine authoritative gameplay state kaynağıdır.
- Zustand authoritative simulation state'in kopyasını tutmaz.
- R3F renderer ve React Flow presentation/integration katmanlarıdır.
- Browser storage bağımlılığı yalnız IndexedDB adapter tarafındadır.
- Player-facing örnek metinler localization key üzerinden gelir.

### Doğrulama

- Lint: PASS
- Typecheck: PASS
- Test: PASS — 5 test dosyası, 13 test
- Production build: PASS
- Development server HTTP smoke testi: PASS
- npm dependency audit: 0 vulnerability

### Açık teknik borçlar

- R3F ve React Flow eager-loaded olduğu için production bundle boyut uyarısı bulunuyor.
- IndexedDB adapter gerçek persistence, backup ve atomic write davranışlarını henüz uygulamıyor.
- Somut save migration yok; yalnız extension point bulunuyor.
- Otomatik browser/E2E test altyapısı henüz bulunmuyor.

### Bağımsız Faz 0 doğrulaması

- Simulation import denetimi TypeScript AST tabanlı hale getirildi.
- `react-dom`, paket alt yolları ve browser/storage global kullanımları mimari test kapsamına alındı.
- Simulation kaynakları için DOM kütüphanesi içermeyen ayrı strict typecheck eklendi.
- Save domain portu ile browser adapter sınırı otomatik testle güvence altına alındı.
- R3F ve React Flow integration shell modülleri doğrudan yükleme testiyle doğrulandı.
- React Flow'un localization dışı varsayılan attribution metni shell'den kaldırıldı.

### Sonraki fazlara bırakılanlar

- ColonyVisualPrototype ve gerçek asset pipeline
- SimulationClock ve deterministic Simulation Core
- Resource ledger ve facility state machine
- Workforce ve Maintenance
- Protocol compiler/runtime ve gerçek graph editor
- Gerçek planet gameplay content'i
- Gerçek save/load, autosave, backup ve migration davranışları

---

## Faz 1 — ColonyVisualPrototype

**Durum:** İlk kullanıcı görsel incelemesinde reddedildi; aşağıdaki kalite kapısı düzeltmesi bu kaydın yerini alır
**Tarih:** 10 Ağustos 2026

### Kapsam ve amaç

Gerçek gameplay ve Simulation Core uygulanmadan, kanonik NIVALIS kolonisi için yaşayan low-poly dünya görünümü, kamera davranışı, görsel tesis durumları ve performans gözlem yüzeyi oluşturuldu. Bütün durumlar açıkça prototype `DebugState` tarafından sağlanır; renderer gameplay kararı vermez.

### Ana çalışmalar

- Dört kaynak asset paketi fiziksel olarak tarandı; model, texture, animasyon ve lisans envanteri çıkarıldı.
- KayKit ana görsel kimlik, Quaternius paketleri ise sınırlı büyük kaya, animasyonlu astronot, platform/vent ve crate rolleriyle kullanıldı.
- `assets-source/` değiştirilmeden yalnız seçili 18 model ve bağımlılıkları `public/assets/runtime/` altına alındı.
- Seçili 2K/4K texture’lar 1024 px runtime varyantlarına dönüştürüldü.
- Kaynak başlıklarını ve lisans dosyalarını koruyan runtime lisans manifesti eklendi.
- `AssetRegistry`; source/runtime path, transform, bounds, footprint, visual center, entrance/work point, material ve visual hook metadata alanlarıyla genişletildi.
- Reaktör, solar array, battery storage, mine, habitat ve oxygen facility görselleri ile road network, expansion pad, 12 büyük çevre prop'u, 31 küçük dekor ve sokak ışıkları yerleştirildi.
- Gece/gündüz, sis, kar, sıcak gece sokak ışıkları ve tesis durum sinyalleri eklendi.
- Orthographic sabit 3/4 kamera; kontrollü zoom, drag pan, overview ve güvenli viewport odak presetleri eklendi.
- Saf ve deterministic A* sunum navigasyonu ile 5/10/15/25/50 seçilebilir prototype astronotların Resting/Assigned/WalkingToFacility/Working/WalkingToHabitat döngüsü eklendi.
- Reactor Normal/Boost/Interlocked/Maintenance ve Mine Working/Offline/Maintenance görsel durumları; maintenance outdoor work-point servis astronotu ile birlikte eklendi.
- Low/Medium/High quality profilleri ve FPS, frame time, draw call, geometry, texture, light ve particle metrikleri eklendi.
- Desktop sağ paneli ve mobil bottom-sheet olarak çalışan prototype kontrol yüzeyi eklendi.

### State ownership ve dependency sınırları

- Prototype `DebugState`, React local state içinde yalnız görsel demo girdisi olarak bulunur; authoritative simulation state değildir.
- R3F renderer yalnız bu view model ve asset registry metadata’sını render eder.
- A* rotaları koloni görsel sunumu içindir; workforce veya gameplay sonucu üretmez.
- Zustand’a simulation truth veya prototype world state kopyası eklenmedi.
- Simulation, save, protocol ve content gameplay katmanları değiştirilmedi.

### Doğrulama

- Lint: PASS
- Typecheck: PASS
- Test: PASS — 9 test dosyası, 26 test
- Production build: PASS
- Runtime asset dependency ve 1024 px texture sınırı testleri: PASS
- Desktop görsel doğrulama: PASS
- Mobil 390×844 breakpoint doğrulaması: PASS
- Kamera overview/focus/pan/zoom doğrulaması: PASS
- High profil tarayıcı gözlemi: yaklaşık 144 FPS, 6.9 ms frame time; 34 geometry, 44 texture, 13 ışık ve 480 particle. Runtime panel ayrıca draw call ve triangle sayılarını gösterir.

### Açık teknik borçlar

- R3F/Three ve mevcut uygulama modülleri eager-loaded olduğu için production bundle yaklaşık 1.46 MB ve Vite chunk-size uyarısı veriyor.
- Asset ingestion scripti texture dönüştürme için Windows `System.Drawing` kullanıyor; platformlar arası asset build aracı henüz yok.
- Prototype astronot Quaternius assetidir ve kanonik final karakter sanatı değildir.
- Tarayıcı doğrulaması manueldir; otomatik screenshot regression altyapısı yoktur.

### Sonraki fazlara bırakılanlar

- SimulationClock ve deterministic Simulation Core
- Resource ledger ve gerçek facility state machine
- Workforce, Maintenance ve gameplay pathfinding
- Protocol compiler/runtime ve gerçek graph editor
- Save/load entegrasyonu ve campaign/progression
- Final karakter sanatı ve gezegen gameplay içeriği

---

## Faz 1 — Kullanıcı görsel kalite kapısı düzeltmesi

**Durum:** Kullanıcı incelemesi için yeniden hazır
**Tarih:** 10 Ağustos 2026

### Genel özet

- Önceki kopuk facility koordinatları, görünür yollardan bağımsız navigation graph ve geniş boş zemin kompozisyonu kaldırıldı.
- Altı facility ile expansion pad; kompakt bir ana operasyon omurgası ve kısa service/entrance bağlantıları çevresinde yeniden yerleştirildi.
- `PrototypeLayout`, facility placement, footprint, entrance/work point, road node/edge, decor zone ve street-light yerleşimlerinin tek kanonik Faz 1 kaynağı oldu.
- Görünür yol tile'ları ve deterministic A* komşulukları aynı road edge'lerinden türetilir; colonist rotaları habitat girişinden hedef facility girişine kadar yalnız bu graph üzerinde ilerler.
- AssetRegistry `targetFootprint`, `entrancePoint` ve `workPoint` metadata'sı yerleşim ile geometrik doğrulamada gerçek girdi olarak kullanıldı. `segmentIntersectsFootprint` ile hiçbir road/path segmentinin yasak facility alanını kesmediği test edildi.
- Indoor `Working` sunumunda kolonist facility girişine ulaştığında gizlenir; çalışma sonunda aynı girişten yol ağına döner. Maintenance work-point sunumları dışarıda kalır.
- Overview kamera panel açıkken 40, kapalıyken 46 orthographic zoom kullanır; sabit 3/4 açı korunurken koloni world viewport'un yaklaşık %60–75 hedef aralığına taşındı.
- Ground, üç yoğunluk bölgesi, road-derived street lights, daha okunur astronot ölçeği ve azaltılmış debug-benzeri facility beacon efektleriyle yaşayan kompakt diorama kompozisyonu güçlendirildi.
- Prototype kontrol paneli açılıp kapanabilir hale getirildi; açık durum Safe Viewport doğrulamasını korur.

### Doğrulama

- Lint: PASS
- Typecheck: PASS
- Test: PASS — 10 test dosyası, 32 test
- Production build: PASS — yalnız mevcut büyük bundle/chunk uyarısı sürüyor
- Desktop 15 kolonist: PASS — iki tam 16 saniyelik çevrim izlendi
- Desktop 50 kolonist: PASS — görünür rota ve performans stres gözlemi yapıldı
- Gündüz/gece, kar/sis açık-kapalı, panel açık-kapalı, overview/reactor/mine/habitat odakları: PASS
- High/15 gece gözlemi: yaklaşık 144 FPS, 6.9 ms, 125 draw, 141718 triangle, 33 geometry, 46 texture, 12 light, 480 particle
- High/50 gece gözlemi: yaklaşık 126–131 FPS, 7.6–7.9 ms, 183–187 draw, 391292–408504 triangle, 33 geometry, 78–82 texture, 12 light, 480 particle

### Kapsam sınırı

- Simulation Core, gameplay pathfinding, Workforce, gerçek facility state machine, resource ledger, Protocol runtime/editor ve Faz 2 HUD uygulanmadı.
- Commit veya push yapılmadı; kullanıcı talimatı bekleniyor.

---

## Faz 1 — Test 4 / Camera & Habitat Presentation düzeltmesi

**Durum:** Faz 1 — Kullanıcı incelemesine hazır
**Tarih:** 10 Ağustos 2026

Test 3 kısmi kullanıcı başarısının ardından yalnız kalan kritik Faz 1 world-presentation sorunları düzeltildi:

- Kamera sürüklemesindeki `horizontalGesture` / `verticalGesture` ve 1.35 oranlı eksen kilidi tamamen kaldırıldı. Pointer hareketi artık kesintisiz iki boyutlu screen-space vektör olarak gerçek kamera-ground basis'ine yansıtılır.
- Pan hedefi world X/Z kutusunda değil, güvenli overview hedefine göre camera-right ve camera-up scalar'larıyla bağımsız ve simetrik clamp edilir. Limitler viewport, açık panelin güvenli alanı, layout bounds ve orthographic zoom'dan türetilir; bir eksenin sınırı diğer eksene hareket aktarmaz.
- Habitat rest, staging ve departure noktaları absolute world koordinatlarından çıkarıldı. Noktalar Habitat compound local uzayında tanımlanıp placement + rotation ile world uzayına çevrilir; taşınmış/döndürülmüş Habitat fixture'ı test edildi.
- Resting görünürlüğü deterministic seeded profile ile outdoor/invisible olarak ayrıldı. Rest noktaları Habitat binası, annex, plaza ve road entrance çevresine yayıldı; tekrar eden cohort'lara deterministic küçük offset verildi.
- Visible-road A* graph, mesafe/hız tabanlı yürüyüş süresi, astronot varyantları ve maintenance route/activity korundu. Fazların deterministic dağılımı ile presentation çalışma/dinlenme süreleri, 15 ve 50 kolonistte intersection yoğunluğunu azaltacak şekilde ayarlandı.
- Kullanıcının eski toplanma noktasında fark ettiği obje kesin olarak `floor-light` idi: kaynak `assets-source/quaternius-modular/Models/Props/Prop_Light_Floor.gltf`, runtime asset `/assets/runtime/modular/Prop_Light_Floor.gltf`. Obje Habitat plaza/road aydınlatması olarak doğru yerdeydi; sorun eski absolute rest noktalarının kolonistleri çevresine toplamasıydı.
- Falling snow, local frozen haze, irregular plateau, ortak `PrototypeLayout`, Habitat compound ve kamera reset / “Koloniyi göster” davranışları korunmuştur.

### Manuel doğrulama

- Kamera: yukarı, aşağı, sol, sağ, iki 45° çapraz, dört maksimum sınır ve sınırda ikinci eksenin devamı PASS. Yön değiştirme, diagonal snap veya eksenler arası enerji aktarımı gözlenmedi.
- 15 kolonist: son ayardan sonra 30+ saniye izlendi. Tek merkezli büyük gathering blob, tek koordinat üst üste binmesi veya ana intersection'ın sürekli tıkanması gözlenmedi; outdoor resting karakterleri Habitat compound çevresinde kaldı.
- 50 kolonist: son ayardan sonra 30+ saniye stress turu izlendi. Yoğunluk beklenen şekilde arttı; hareketli gruplar zaman içinde dağıldı ve tek rest noktası/tek road tile üzerinde kalıcı büyük üst üste binme gözlenmedi.
- Kar ve sis kamera sürüklemeleri boyunca açık tutularak okunabilirlik ve davranış birlikte doğrulandı.
- Sahne inceleme sonunda 15 kolonist ve genel görünüm presetine döndürüldü.

### Otomatik doğrulama

- Lint: PASS
- Typecheck: PASS
- Test: PASS — 12 test dosyası, 52 test
- Production build: PASS — yalnız mevcut 1.48 MB bundle/chunk-size uyarısı sürüyor
- Camera pure-math: 8 test PASS
- Prototype layout/local-to-world: 9 test PASS
- Navigation/deterministic 15–50 distribution: 10 test PASS

### Kapsam sınırı

- Faz 2, final HUD, facility hover/click/selection, gerçek gameplay, Simulation Core, Workforce/Maintenance gameplay veya yeni interaction sistemi uygulanmadı.
- Faz 1 tamamlandı ya da onaylandı olarak işaretlenmedi; kullanıcı görsel incelemesi bekleniyor.
- Commit veya push yapılmadı.

---

## Faz 1 — Test 3 / World Presentation & Life Pass

**Durum:** Faz 1 — Kullanıcı incelemesine hazır
**Tarih:** 10 Ağustos 2026

Test 2 kullanıcı görsel incelemesinden geçmedi. Test 2 ile kurulan ortak `PrototypeLayout` ve görünür yol–navigasyon birliği korunarak aşağıdaki sunum iyileştirmeleri yapıldı:

- Kamera pan hareketi camera-space/screen-space basis üzerinden düzeltildi; layout-derived pan sınırları, güvenli zoom aralıkları ve pan/zoom'u birlikte sıfırlayan overview davranışı eklendi.
- Ağır global sis yerine çok hafif depth cue ve world-space, zemine yakın lokal donuk haze kullanıldı.
- Dönen particle cloud kaldırıldı; deterministik hız ve rüzgâr varyasyonu olan, düşen ve wrap eden buffer-level kar alanı eklendi.
- Perfect polygon zemin yerine deterministik, düzensiz kenarlı donmuş plato kompozisyonu oluşturuldu.
- Tek kanonik Habitat facility'si annex, bağlantı modülü ve plaza ile görsel compound haline getirildi; rest, staging ve departure noktaları `PrototypeLayout` içinde tanımlandı.
- Kolonici sunum çevrimleri deterministik fakat farklı süre, hedef, lane, hız ve faz profilleriyle çeşitlendirildi; hareket süresi yol uzunluğu / yürüme hızı üzerinden hesaplanır.
- Uyumlu mevcut astronot varyantları ve doğrulanmış `Idle`/`Walk` klip kataloğu kullanıldı.
- Bakım işçisi habitat–yol–tesis–iş noktası–yol–habitat sunum çevrimine geçirildi; silah animasyonu kullanılmadan kısıtlı servis ışığı/kıvılcım etkinliği eklendi.
- Kamera, sis, kar, habitat, 15/50 kolonici ve reaktör/maden bakım çevrimleri manuel olarak birlikte doğrulandı.

### Doğrulama

- Lint: PASS
- Typecheck: PASS
- Test: PASS — 12 test dosyası, 44 test
- Production build: PASS — mevcut büyük bundle/chunk uyarısı sürüyor
- High/15, gece + sis + kar: yaklaşık 144 FPS, 6.9 ms, 140 draw, 140558 triangle, 46 geometry, 86 texture, 12 light, 480 particle
- High/50, gece + sis + kar: yaklaşık 130 FPS, 7.7 ms, 188 draw, 341672 triangle, 46 geometry, 86 texture, 12 light, 480 particle
- High/bakım aktif: yaklaşık 144 FPS, 6.9 ms; reaktör ve maden için tam gidiş–etkinlik–dönüş çevrimi gözlendi

### Kapsam sınırı

- Bu çalışma yalnız Faz 1 presentation prototype kapsamındadır. Simulation Core, gerçek Workforce/Maintenance, gameplay state, final HUD ve Faz 2 uygulanmadı.
- Faz 1 tamamlandı veya onaylandı olarak işaretlenmedi; kullanıcı görsel incelemesi bekleniyor.
- Commit veya push yapılmadı; kullanıcı talimatı bekleniyor.
