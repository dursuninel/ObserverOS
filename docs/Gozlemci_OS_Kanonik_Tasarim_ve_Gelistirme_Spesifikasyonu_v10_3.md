# GÖZLEMCİ İŞLETİM SİSTEMİ
## Kanonik Oyun Tasarımı, Teknik Mimari ve Geliştirme Spesifikasyonu

**Sürüm:** v10.3  
**Tarih:** 09 Ağustos 2026  
**Statü:** KANONİK / TEK KAYNAK  
**Hedef platform:** Web-first, baştan mobil uyumlu  
**Görsel yön:** Stilize düşük-poly 2.5D COLONY + temiz 2D UI  
**Geliştirme yaklaşımı:** Solo geliştirici odaklı, data-driven, deterministic simulation  
**Ana teknoloji yönü:** React + TypeScript + React Three Fiber / Three.js + @xyflow/react + Zustand + Zod

> **Çekirdek:** Oyuncu kolonistleri mikro-yönetmez. Koloniyi gözlemler, sistemik problemleri teşhis eder, görsel protokoller kurar, sonuçlarını simülasyonda izler ve Hata Ayıklama sistemiyle nedenselliği anlayarak otomasyonunu optimize eder.

---

# 0. Belge Sözleşmesi, Kaynak Önceliği ve Okuma Kuralları

Bu dosya Gözlemci İşletim Sistemi projesinin **tek kanonik ürün ve geliştirme spesifikasyonudur**. v1-v10.2 raporlarının, ilk görsel kaynak raporun ve daha sonraki tasarım konuşmalarının kesinleşmiş kararlarını birleştirir; eski tekrarları ve artık geçerli olmayan örnekleri temizler. Codex, Claude Code veya başka bir kodlama aracı implementasyon kararı verirken öncelikle bu dosyayı esas almalıdır.

## 0.1 Öncelik sırası

1. Bu v10.3 belgesindeki **KESİN / MUST** ifadeleri.
2. Aynı bölümdeki daha ayrıntılı alt kurallar.
3. Data/config dosyalarında gezegene özel override'lar.
4. **TUNABLE** olarak işaretlenen başlangıç değerleri.
5. Eski raporlar yalnız tarihsel kayıttır; v10.3 ile çelişirse kullanılmaz.

## 0.2 Terimlerin bağlayıcılığı

| Etiket | Anlam |
|---|---|
| **MUST / KESİN** | Ürün kimliğinin veya deterministic davranışın parçasıdır. Kodlama aracı kendiliğinden değiştiremez. |
| **SHOULD / VARSAYILAN** | İlk implementasyon yönüdür. Ölçülmüş teknik gerekçeyle aynı semantiği koruyarak uyarlanabilir. |
| **TUNABLE** | JSON/config üzerinden değişebilir. Sayı değişebilir; arkasındaki sistem ilişkisi değişmez. |
| **DEFERRED** | Bilinçli olarak sonraki faza bırakılmıştır. MVP implementasyonu için soru sorulması gerekmez; ilgili özellik eklenmez veya extension point bırakılır. |
| **DEV-ONLY** | Oyuncu build'ine çıkmayan tasarım/test bilgisidir. |

## 0.3 Kodlama araçlarının soru sormaması gereken durumlar

Bu belgede varsayılanı tanımlanmış bir davranış için tekrar ürün kararı sorulmamalıdır. Bir sayı **TUNABLE** ise başlangıç değerini kullanıp config'e koymak gerekir. Bir özellik **DEFERRED** ise MVP'de uydurulmamalı, TODO/extension point ile sınırlandırılmalıdır. İnsan kararı istemeden önce ilgili terimler, bölüm başlıkları, sözlük ve uygulama ekleri bu kanonik dosya içinde aranmalıdır. Yalnızca aşağıdaki üç durumda, bu arama yapıldığı halde cevap bulunamıyor veya gerçek bir ürün kararı gerekiyorsa insan kararı istenir:

- İki ayrı **KESİN** kuralın teknik olarak çeliştiği ispatlanabiliyorsa.
- Gereken gerçek asset dosyası veya lisanslı dış kaynak fiziksel olarak mevcut değilse ve fallback seçimi ürün görünümünü değiştiriyorsa.
- Kullanıcıya dönük yeni bir oyun mekaniği, kaynak, node, ana ekran veya progression kuralı eklemek zorunlu hale geliyorsa.

## 0.4 AI / Kodlama Aracı Çalışma Protokolü - Halüsinasyon ve Kapsam Kontrolü

> **AI NON-HALLUCINATION RULE - MUST / KESİN:** Kodlama aracı ürün davranışını tahmin ederek tamamlamaz. Bir isim, sayı, state, facility ilişkisi, UX davranışı, dosya/klasör mimarisi, protocol semantiği, progression, asset veya herhangi bir ürün kuralında belirsizlik oluşursa ilk aksiyon kullanıcıya soru sormak değil bu kanonik spesifikasyonda ilgili bilgiyi aramaktır. Belgede cevap varsa aynen uygulanır. Cevap yoksa yalnız oyuncuya görünmeyen, geri döndürülebilir ve ürün semantiğini etkilemeyen teknik ayrıntıda makul implementasyon kararı verilebilir; ürün tasarımını etkileyen hiçbir bilgi uydurulamaz.

1. **Önce verilen komutu uygula.** Kullanıcının mevcut görevi kanonik belgeyle çelişmediği sürece kapsamdır. İstenmeyen refactor, yeni feature, redesign, cleanup kampanyası veya "daha iyi olur" değişikliği yapılmaz.
2. **Tahmin etmeden önce belgeyi ara.** Bir davranıştan emin olunmadığında önce bu dosyada ilgili terim, eş anlamlısı, facility adı, sistem adı, bölüm başlığı ve gerekirse sözlük/uygulama ekleri aranır. "Muhtemelen böyledir" yaklaşımı ürün davranışında yasaktır.
3. **Belgede cevap varsa soru sorma.** Cevap doğrudan yazılmışsa veya KESİN kurallardan tek anlamlı biçimde türetilebiliyorsa kullanıcıya aynı ürün kararı tekrar sorulmaz; belge uygulanır.
4. **Belgede olmayan ürün kararını uydurma.** Yeni mechanic, resource, facility state/mode, node, ana ekran, progression, mission kuralı, gezegen davranışı, lore, kullanıcıya görünür varsayım veya ekonomik sistem icat edilmez.
5. **Teknik uygulama detayı ile ürün kararını ayır.** Private helper adı, dosya içi fonksiyon ayrımı, eşdeğer veri yapısı veya oyuncuya görünmeyen ve geri döndürülebilir performans tekniği seçilebilir. Görünür davranışı veya deterministic semantiği değiştiren seçim ürün kararıdır ve serbestçe yapılamaz.
6. **Çelişkiyi sessizce uzlaştırma.** Önce Bölüm 0.1 kaynak önceliği uygulanır. Hâlâ iki KESİN/MUST kuralın birlikte uygulanamayacağı gösterilebiliyorsa ancak o zaman insana net çelişkiyle soru yöneltilir.
7. **Mevcut kodu kanonik gerçek kabul etme.** Implementation bu belgeyle çelişiyorsa aksi açıkça kararlaştırılmadıkça belge ürünü tarif eder; eski, eksik veya hatalı kod spesifikasyonu geçersiz kılmaz.
8. **Görev kapsamı dışına çıkma.** Örneğin "Faz 2'yi uygula" denmişse sonraki fazın kullanıcıya dönük özellikleri önceden eklenmez. Yalnız mevcut fazın gelecekteki genişlemeyi engellememesi için temiz extension point bırakılabilir.
9. **Eksik bilgi bahanesiyle işi gereksiz durdurma.** TUNABLE değerde baseline kullanılır; SHOULD/VARSAYILAN uygulanır; DEFERRED özellik implement edilmez. Bunlar için ürün sahibinden yeni karar beklenmez.
10. **Varsayımı yalnız güvenli teknik alanda yap.** Varsayım zorunluysa oyuncuya görünmeyen, geri döndürülebilir, test edilebilir ve ürün semantiğini etkilemeyen teknik ayrıntıyla sınırlı kalır. Varsayım ürün davranışına taşınamaz.
11. **Görev sonunda kapsam denetimi yap.** Araç "Benden ne istendi, neyi değiştirdim, istemeden başka sistemi değiştirdim mi, yeni ürün semantiği ekledim mi, ilgili testleri çalıştırdım mı?" kontrolünü tamamlamadan görevi bitmiş saymaz.
12. **Belgeyi hafızadan değil kaynak olarak kullan.** Bu uzun spesifikasyon bir kez okunup hatırlandığı varsayılmaz. Bir ayrıntı uygulama sırasında yeniden önemli hale gelirse ilgili bölüm tekrar açılır/aranır; model hafızası veya genel oyun geliştirme alışkanlığı kaynak yerine kullanılmaz.

### 0.4.1 Zorunlu arama ve karar akışı

**KESİN akış:** Görevi oku -> ilgili terimleri bu dosyada ara -> MUST/SHOULD/TUNABLE/DEFERRED etiketlerini çöz -> mevcut kodu spesifikasyonla karşılaştır -> yalnız istenen kapsamı uygula -> test et -> kapsam/halüsinasyon denetimi yap.

Arama sonucunda birden fazla ilgili bölüm bulunursa daha özel ve daha ayrıntılı KESİN kural genel ifadeden üstündür; gezegene özel data override yalnız izin verilen alanlarda genel baseline'ı geçersiz kılabilir.

### 0.4.2 Yasak davranış örnekleri

- "Bu facility'de muhtemelen yakıt olmalı." -> **YASAK.** Core resource modeli ve facility spec aranır; yeni fuel resource icat edilmez.
- "Bu tür oyunlarda Food/Water olur." -> **YASAK.** Genel tür alışkanlığı kanonik ürüne taşınmaz.
- "React Flow ile kolay olsun diye Action komutunu geçici yapayım." -> **YASAK.** Action persistence ürün semantiğidir.
- "Battery reserve davranışını hatırlamıyorum; kullanıcıya sorayım." -> **YANLIŞ İLK ADIM.** Önce Battery/Storage/Reserve bölümleri bu dosyada aranır.
- "calculateAvailablePower mı getAvailablePower mı?" -> **TEKNİK KARAR.** Oyuncuya görünmeyen ve semantiği değiştirmeyen isimlendirme için soru sorulmaz.
- "Kodda eski bir Security resource buldum; onu koruyayım." -> **YASAK.** Kod belgeyle çelişiyorsa kanonik belge uygulanır veya migration planı çıkarılır.

## 0.5 v10.1 ile özellikle iptal edilen eski yönler

Aşağıdakiler eski raporlarda veya erken örneklerde görülebilir; **kanonik değildir**:

- Security ayrı fiziksel kaynak değildir. Güvenlik, Colony Health boyutudur.
- Pixel-art / PixiJS tabanlı COLONY ana renderer yönü yoktur. Ana yön Three.js + React Three Fiber'dır.
- ARES ve EDEN gibi erken örnek gezegen adları Sector 1 kanonik listesinde değildir.
- Serbest bina yerleştirme, kablo/boru bağlama, bireysel kolonist emri, RimWorld tarzı envanter/kişilik/skill micromanagement yoktur.
- Food, Water, Fuel, Electronics, Spare Parts, Medicine gibi yeni evrensel kaynaklar MVP/core sisteme eklenmez.
- Skill tree, XP, research point veya node satın alma yoktur.
- Rastgele teknik arıza oyunun ana zorluk aracı değildir.
- “Tek doğru protokol” veya node dizilimi üzerinden puzzle doğrulaması yapılmaz.
- Konuşan ayrı bir Observer AI karakteri yoktur; oyuncu zaten Gözlemci'dir.

---

# 1. Ürün Vizyonu ve Tasarım Sınırları

## 1.1 Oyuncu fantezisi

Oyuncu farklı gezegenlerdeki kolonilere uzaktan bağlanan merkezi yapay zekâ **Gözlemci**dir. Kolonistler fiziksel olarak yaşar, yürür, çalışır, dinlenir ve bakım yapar; ancak oyuncu onlara tek tek emir vermez. Oyuncunun gücü, koloninin koşullar karşısında nasıl davranacağını tanımlayan protokoller tasarlamaktır.

> **Kimlik:** Oyuncu komutan değil, sistem mimarıdır.

Oyuncunun temel sorusu “Kime ne emir vereyim?” değil, “Bu sistem şu koşul gerçekleştiğinde kendi kendine nasıl davranmalı?” olmalıdır.

## 1.2 Tasarım hedefleri

- Derinlik çok sayıda kaynaktan değil, az sayıda sistemin birbirini etkilemesinden doğar.
- Bir problem yüzeyde bir tesiste görünürken gerçek neden başka sistemde olabilir.
- Başarısızlık çoğunlukla yanlış bir butona basmaktan değil, iyi niyetli otomasyonun yan etkisinden doğar.
- Oyuncu bir çözüm kurduktan sonra birkaç doğal operasyon döngüsü boyunca gerçekten çalışıp çalışmadığını görür.
- Debugger oyuncuya sebebi gösterecek kadar şeffaf, çözümü söylemeyecek kadar tarafsızdır.
- Dünya yalnız dekor değildir; simülasyon state'lerinin görsel sonucudur.

## 1.3 Bilinçli non-goals

- Colony-builder ölçüsünde bina spam'i ve şehir planlama.
- Tower defense veya doğrudan savaş odağı.
- Kolonistlerin bireysel skill/trait/inventory/relationship yönetimi.
- Gerçek mühendislik simülasyonu, detaylı termodinamik veya elektrik şebekesi.
- Programlama dili öğretme veya oyuncudan kod yazmasını isteme.
- “En güçlü build” için skill tree / research economy.
- Yüksek RNG ile oyuncunun açıklayamadığı kayıplar.

---

# 2. Çekirdek Oyun Döngüsü

Kanonik loop:

**Gözlemle → Analiz et → Protokol kur → Çalıştır → Sonuçları izle → Hata bul → Optimize et**

| Aşama | Oyuncu davranışı | Sistem karşılığı |
|---|---|---|
| Gözlemle | COLONY dünyasında kaynakları, tesisleri, kolonistleri, olayları ve trendleri fark eder. | World Renderer + HUD + facility context. |
| Analiz et | Semptomun gerçek nedenini araştırır. | Resource details + Debugger timeline/causal links. |
| Protokol kur | Trigger/Condition/Flow/Action zinciri tasarlar. | Protocol Manager + Graph Editor. |
| Çalıştır | Simülasyonu devam ettirir; protokol gerçek koşullarda davranır. | Deterministic Simulation Engine. |
| Sonuçları izle | State değişimini dünyadan ve HUD'dan okur. | World state, alerts, trends. |
| Hata bul | Yanlış tetiklenme, bloklanma, conflict veya downstream sonucu inceler. | Debugger execution trace. |
| Optimize et | Protokolü sadeleştirir, verimli ve dayanıklı hale getirir. | Draft → Validate → Apply → yeni aktif sürüm. |

**KESİN:** Oyun refleks temelli değildir. Pause her zaman kullanılabilir. Protocol veya Debug ekranına geçmek simülasyonu otomatik pause etmez; oyuncu isterse pause eder.

---

# 3. Campaign, Sektörler ve Gözlemci Ağı

## 3.1 Campaign yapısı

Campaign sektörlerden oluşur. Sektörler kontrollü sırayla açılır; **sektör içinde özgür gezegen seçimi** vardır. Her gezegen, mevcut fakat sistemik olarak kusurlu bir kolonidir. Oyuncu boş haritadan şehir kurmaz.

> **Kampanya ilkesi:** Harita oyuncuya hangi problemi çözmek istediğini seçtirir; nasıl çözeceğini asla söylemez.

## 3.2 Sektör içi ve sektörler arası ilerleme

- İlk Sector 1 gezegeni HELIOS-4 zorunludur.
- HELIOS-4 stabilizasyonundan sonra Sector 1 içindeki NIVALIS-3, MOROS-2, AURELIA-6 ve KEPLER-17B serbest seçilir.
- Toplam **3 stabilize koloni** elde edildiğinde ORPHEUS STATION sektör sınaması açılır. Bu sayı HELIOS + herhangi iki opsiyonel gezegen olabilir.
- ORPHEUS tamamlandığında Sector 2 açılır.
- Oynanmamış Sector 1 gezegenleri açık kalır; yüzde tamamlama ayrı ilerler.
- Sector Completion = stabilize edilen gezegen sayısı / toplam gezegen sayısı. Health ile ağırlıklandırılmaz.
- %100 completion yalnız lore, kozmetik, rozet, achievement gibi prestij ödülleri verebilir; temel gameplay gücü vermez.

## 3.3 Gezegenler arası kayıt davranışı

Birden fazla gezegen save'i bulunabilir. Yalnızca açık olan aktif koloni simüle edilir; diğer koloniler donar. Offline progression yoktur. Gezegen değiştirmenin yakıt, campaign zamanı veya meta-resource maliyeti yoktur; Gözlemci uzaktan bağlanır.

## 3.4 Gözlemci Ağı ekranı

Gözlemci Ağı gerçekçi uzay gemisi navigasyonu değil, temiz ve okunabilir bir koloni/star network haritasıdır.

- Önce sektör seçilir, sonra sektörde gezegen seçilir.
- Sektör kartı: ad, stabilize sayısı, completion %, locked/open.
- Gezegen kartı: bilinen semptomlar, operasyon koşulları, stabilize durumu, isteğe bağlı Devir Health / Best Health.
- Gezegen bağlantı çizgileri ağırlıkla görsel/network ilişkidir; açıkça tanımlanmadıkça prerequisite değildir.
- Gezegen kartı root cause veya solution spoiler'ı vermez.
- Bağlantı geçişi kısa “Bağlantı kuruluyor / Koloni ağına bağlandı” sunumudur; tekrar girişte kısa veya atlanabilir.

---

# 4. Aktif Koloninin Bilgi Mimarisi ve Navigasyonu

Aktif kolonide yalnız **üç ana çalışma alanı** vardır:

1. **KOLONİ** — Ne oluyor?
2. **PROTOKOLLER** — Sistem ne yapmalı?
3. **HATA AYIKLAMA** — Neden oldu?

Bunlar aynı `GameSession` ve aynı `SimulationEngine` state'ine bakan üç farklı lens'tir. Route değişimi simülasyonu yeniden oluşturmaz.

## 4.1 Global ekran hiyerarşisi

```text
AÇILIŞ
  ↓
ANA MENÜ
  ↓
GÖZLEMCİ AĞI
  ├─ Sektör → Gezegen → Aktif Koloni
  │                  ├─ KOLONİ
  │                  ├─ PROTOKOLLER
  │                  └─ HATA AYIKLAMA
  ├─ COLONY NETWORK
  ├─ GÖZLEMCİ EL KİTABI
  └─ AYARLAR
```

MVP'de full Colony Network UI ertelenebilir; Devir Snapshot verisi yine saklanır.

## 4.2 Contextual paneller

Aşağıdakiler yeni ana sekme değildir:

- Facility detail.
- Mission/Arrival Report/Help.
- Colony Health breakdown.
- Active Alerts.
- Environment detail.
- Colonist observation detail.

Facility panelinden “Protokolleri Gör” ve “Hata Ayıklamada İncele” geçişleri bulunur. Debugger event'inden “Protokolü Aç” ve “Tesisi Göster” geçişleri bulunur.

## 4.3 Önerilen route yapısı

```text
/network
/sector/:sectorId
/planet/:planetId
/colony/:planetId
/colony/:planetId/protocols
/colony/:planetId/protocols/:protocolId
/colony/:planetId/debug
/network/colonies
/handbook
/settings
```

`/colony/:planetId/*` alt route'ları aynı session'ı kullanır.

---

# 5. Simülasyon Zamanı

## 5.1 Tek saat kaynağı

Tüm gameplay zamanlamaları `SimulationClock` üzerinden yürür. `Date.now()` veya render delta'sı gameplay sonucu belirlemez.

**Balance Baseline v0.1:**

- 1 yerel gün = 24 simülasyon saati.
- ×1 hızda yaklaşık 10 gerçek dakika / gün.
- 1 simülasyon saati ≈ 25 gerçek saniye.
- Temel simulation step = 1 simülasyon dakikası.
- Oyuncu hızları: Pause / ×1 / ×2 / ×4.

Bu değerler **TUNABLE**dır; fakat hız değişimi sonucu değiştiremez.

## 5.2 Pause ve hız semantiği

- Pause bütün simulation progression'ı dondurur: resources, facility wear, Delay, Timer, Cooldown, event phase, workforce travel, maintenance, construction ve environment gameplay effects ilerlemez.
- UI interaction ve menüler çalışmaya devam eder.
- ×1/×2/×4 yalnız simulation clock'un ilerleme hızını değiştirir.
- Render FPS ile simulation timestep ayrıdır.
- Kontrollü randomness simulation-time + seed kullanır.

## 5.3 Operasyon döngüsü

Operasyon döngüsü gerçek dakika değil, gezegene özgü doğal bir periyottur. Çoğu gezegende yerel gün olabilir; AURELIA'da orbital gölgelenme çevrimi gibi başka bir döngü olabilir. Sustainability verification bu döngüleri sayar.

---

# 6. Kaynak Modeli

Yalnız üç fiziksel core resource vardır:

1. **Energy**
2. **Oxygen**
3. **Material**

> **İlke:** Az kaynak, çok sistemik etkileşim.

## 6.1 Resource olmayan şeyler

Aşağıdakiler yeni kaynak değildir:

- Thermal Load: facility physical state.
- Thermal Service / Thermal Capacity: hizmet/kapasite.
- Population Capacity / Rest Capacity: kapasite.
- Treatment Capacity: hizmet.
- Shelter Capacity: kapasite.
- Workforce: dinamik operasyon kapasitesi.
- Safety: Colony Health boyutu.

Food, Water, Fuel, Medicine, Spare Parts vb. gelecekte yalnız özel senaryoda yerel mechanic olabilir; global core resource yapılmaz.

## 6.2 Global pool ve fiziksel tesis ilişkisi

MVP/core'da enerji kablosu, oksijen borusu veya material taşıma ağı oyuncu tarafından kurulmaz. Aktif tesisler koloninin ortak altyapı pool'una bağlı kabul edilir. Görsel kablo/boru yalnız art direction unsurudur.

Engine fiziksel storage facility'lerini ayrı bilir; HUD global aggregate gösterir. Örneğin iki Battery toplam kapasiteye katkı verir. Bir Battery Failed olursa kullanılabilir kapasite düşebilir.

## 6.3 Energy davranışı

Energy bir **akış + storage** problemidir. Her simulation step'te üretim, tüketim, storage charge/discharge ve gerekirse deterministic load shedding hesaplanır.

**v10.1 deterministic allocation clarification:** Enerji arzı talebi karşılamıyorsa `EnergyPriority` sırası Critical → High → Normal → Low uygulanır. Eşit öncelikte stable facility instance ID sırası kullanılır. Rastgele veya render order'a bağlı dağıtım yoktur. Facility local Safety Interlock daha üst otoritedir.

## 6.4 Oxygen davranışı

Oxygen bir **üretim + population consumption + reserve + trend** problemidir. Population global Oxygen demand yaratır; Habitat “oksijen tüketen fabrika” olarak iki kez sayılmaz. Baseline: 1 kolonist = 1 Oxygen / sim saat.

## 6.5 Material davranışı

Material stoktur. Mine üretir; maintenance ve sınırlı construction tüketir. Oyuncu elle drag/spend etmez. Depolama kapasitesi dolduğunda üretim sihirli şekilde yok olmaz; üretici kısılır/standby'a geçer ve Debugger sebebi açıklar.

## 6.6 Resource UI

Ana HUD'da abstract birimler ve trend gösterilir; gerçek mühendislik birimi zorunlu değildir.

Örnek:

```text
Energy   240 / 360  ↓
Oxygen   172 / 240  ↑
Material 318 / 500  →
```

Detay panelinde Production, Consumption, Net Trend ve Capacity açıklanabilir. kW/m³/kg gibi gerçek dünya birimleri kullanılmaması varsayılandır.

---

# 7. Tesis Sistemi - Ortak Fiziksel ve Kontrol Modeli

## 7.1 Tesis mimarisi

Her tesis üç katmanlı düşünülür:

```text
Fiziksel Tesis
   ↓ sensörler / state
Yerel Kontrolcü + Safety Interlock
   ↓ izin verilen komutlar
Gözlemci Protokolleri
```

Oyuncu fizik kurallarını bypass etmez. Action bir “sonucu zorla” talebi değil, yerel kontrolcüye gönderilen **command request**tir.

Action sonucu:

- `Applied`
- `Blocked`
- `Failed`
- `Delayed`

## 7.2 Standart facility veri modeli

Her facility type mümkün olduğunca şu şablonu kullanır:

- Role
- Inputs
- Outputs
- Sensors
- Actions
- Modes
- Operating States
- Constraints
- Safety Interlocks
- Workforce
- Condition / Wear
- Placement Profile
- Visual Profile
- Audio Profile
- Debugger Events

Her başlığın bulunması her tesiste karmaşık davranış olmak zorunda değildir. Basit tesisin mode'u olmayabilir.

## 7.3 Ortak operating states

Tesis tipine göre subset kullanılır:

- Offline
- Starting
- Online
- Standby
- Maintenance
- Interlocked
- Failed

`Online` içinde Eco/Normal/Boost gibi mode bulunabilir.

## 7.4 Ortak priority tipleri

- `EnergyPriority`: sınırlı enerji dağıtımında anlamlı tesislerde.
- `WorkPriority`: Workforce talebinde.
- `MaintenancePriority`: maintenance queue'da.

Priority değerleri: Low / Normal / High / Critical.

**Tie-break:** eşit priority'de deterministic `facilityInstanceId` ascending. Son kullanıcıya stable ID gösterilmek zorunda değildir; Debugger “eşit öncelikte sistem sırası” şeklinde açıklayabilir.

## 7.5 Facility failure ortak kuralı

Normal facility failure anlık olarak stored resource'u yok etmez. Storage tesisi Failed olursa içeriği onarıma kadar erişilemez veya capacity contribution devre dışı kalır; resource fiziksel olarak “silinmez”. Gerçek stok kaybı yalnız açıkça tanımlı özel event ise olur.

## 7.6 Expansion ilkesi

Koloni mevcut tesislerle başlar; yalnız bazı gezegenlerde 0-2 fiziksel Expansion Slot vardır. Serbest placement yoktur. Standart güvenli Expansion havuzu ağırlıkla tampon kapasitesi sağlar:

- Battery Bank
- Oxygen Reserve Tank
- Material Storage

Solar, Thermal, Shelter, Habitat veya Mine senaryoya özel seçenek olabilir. İkinci Fusion Reactor standart Expansion seçeneği değildir.

---

# 8. Tesis Kataloğu - 11 Kanonik Facility Type

## 8.1 Füzyon Reaktörü

**Rol:** Yüksek kapasiteli, kontrol edilebilir ana Energy üreticisi. Ana trade-off: daha fazla Energy ↔ daha fazla Thermal Load ↔ daha hızlı wear ↔ daha fazla maintenance ↔ daha yüksek sistem riski.

**Inputs:** Workforce; maintenance/repair sırasında Material. Normal üretimde fuel resource yoktur. Normal işletme için dış Energy input'u kullanılmaz.

**Output:** Energy.

**Modes:**

- Eco: düşük output, düşük Thermal Load, düşük wear.
- Normal: standart sürdürülebilir output.
- Boost: yüksek output, yüksek Thermal Load/wear ve daha fazla Workforce gereksinimi.

**Operating States:** Offline, Starting, Online, Standby, Maintenance, Interlocked, Failed.

**Ramp:** OFF/Standby/Eco/Normal/Boost geçişleri anlık değildir. Output simulation time boyunca hedefe ramp eder. Geç tetiklenen protokolün krizi kurtaramaması mümkündür. Exact ramp süreleri balance config'dedir.

**Sensors:** Status, Mode, EnergyOutput, OutputCapacity, ThermalLoad, Condition, AssignedWorkforce, RequiredWorkforce, MaintenanceNeed, InterlockStatus, RampState (`raising|lowering|stable`). Trend UI genel sistemden türetilir.

**Actions:** Enable/Start, Standby, Offline, SetMode(Eco|Normal|Boost), SetMaintenancePriority, SetWorkPriority, gerektiğinde SetEnergyPriority.

**Workforce:** Minimum < Nominal < Boost. Baseline 2 / 3 / 4. Minimumun altında start veya Boost block olabilir; minimum ile nominal arasında output/ramp kısıtlanır.

**Condition/Wear:** Eco yavaş, Normal standart, Boost hızlı. High Thermal Load wear'i artırabilir. Worn kapasite/thermal management'i hafif düşürür; Critical Boost'u kısıtlar; Failed output 0'dır.

**Safety Interlocks:**

- Thermal Load güvenli sınırın üzerindeyse Boost block.
- Condition kritik alt sınırdaysa Boost block.
- Safe minimum Workforce yoksa start/Boost block.
- Safety shutdown sonrası Thermal Load yeterince düşmeden restart block.

Interlock fiziksel olarak tehlikeli komutu engeller; kötü uzun dönem politikasını otomatik düzeltmez.

**Failure:** Normalde nükleer patlama veya tek seferlik kalıcı yıkım yoktur. Failed → EnergyOutput 0 → Material + Workforce repair → yeniden kullanılabilir. Kriz downstream enerji kaybından doğar.

**Maintenance:** Major maintenance MVP'de Offline kabul edilir. Oyuncu “Repair” düğmesine basmaz; maintenance priority belirler.

**Placement Profile:** Energy zone; large footprint; Battery'ye yakın tercih; Habitat/Medical/dense residential'dan uzak; road access, service clearance ve safety separation hard/soft constraint'leri; entrance road'a bakar; standard Expansion değildir; screen-space overlap validation zorunlu.

**Visual Profile:** Offline core/emissive kapalı; Starting kademeli ışık/mekanik; Eco düşük; Normal stabil; Boost daha güçlü core ve cooling activity; high Thermal Load mode'dan bağımsız cooling artışı; Worn/Critical sınırlı spark/irregular audio; Maintenance görünür crew; Interlocked güvenli shutdown ve safety indicator; Failed core kapalı ve kontrollü hata efekti.

**Audio:** Düşük frekanslı hum; mode'a göre layer yoğunluğu; distinctive interlock one-shot; Failed durumda sesin kaybolması anlamlı feedback'tir.

**Meaningful Debugger Events:** start requested/applied/blocked, mode command, ramp start/end, Thermal Load band crossing, interlock, maintenance start/end, failure/recovery. Her Energy tick loglanmaz.

---

## 8.2 Güneş Dizisi

**Rol:** İşletme maliyeti düşük fakat çevre ve ışınıma bağlı, oyuncunun doğrudan output yükseltemediği Energy üreticisi. Reaktörün zıttı: ucuz ama kontrol edilebilirliği düşük.

**Inputs:** Sunlight/environment exposure. Normal operasyonda Workforce yok; bakımda Workforce + Material.

**Output:** Energy.

**Production model:** `nominalOutput × irradianceFactor × environmentFactor × conditionFactor`. Irradiance 0 ise output 0. Oyuncu “Boost” ile gece üretim yaratamaz.

**Modes:** Eco/Normal/Boost yok. Full game'de `Production` ve `Protection` operational posture bulunabilir. Protection güçlü çevresel olaylarda output'u azaltır/sıfırlar fakat wear/damage riskini düşürür. MVP'nin ilk üç gezegeninde Protection'a ihtiyaç yoktur ve UI'da saklanabilir.

**Sensors:** Status, Irradiance, CurrentOutput, AvailableCapacity, Condition, EnvironmentModifier, ProtectionState.

**Actions:** SetOperationalPosture(Production|Protection) yalnız senaryo izin veriyorsa; MaintenancePriority. Güneş yokken output action yoktur.

**Workforce:** 0 normal, maintenance sırasında gerekir.

**Condition/Wear:** Normal wear düşüktür; açık durumda ağır environmental event wear'i artırabilir. Teknik arıza deterministic state ve event parametrelerinden doğar.

**Safety:** Çok ağır event local controller zorunlu koruma uygulayabilir; bu davranış event/facility config'de açık olmalıdır ve Debugger loglar.

**Placement:** Open sky; blocked/cliff/large occluder yakınında değil; solar exposure scoring; uygun senaryolarda Expansion seçeneği.

**Visual:** Gündüz açık panel silueti, gece aynı fiziksel model fakat production activity/emissive yok; Protection varsa panel posture/lighting ile ayırt edilir. Sahte güneş üretim animasyonu yoktur.

**Audio:** Çok hafif mekanik/servo; normalde sessizce çalışan tesis. Environment sesleri baskındır.

**Debugger:** irradiance değişimi, production unavailable nedeni, protection command/state, capacity limitation, maintenance.

---

## 8.3 Batarya Bankası

**Rol:** Energy üretmez; fazla Energy'yi zamanda taşır ve üretim-tüketim zaman uyuşmazlığını tamponlar.

**Inputs/Outputs:** Surplus Energy ile charge; arz talebi karşılamadığında discharge.

**Yerel varsayılan controller:** Charge/discharge otomatik. Oyuncu saniye saniye “Charge” komutu vermez.

**Ana player control:** `MinimumReserve` setpoint (%0-100). Reserve floor normal tüketim için korunur; protokol daha yüksek rezervi olay öncesi koruyabilir veya acil durumda 0'a indirebilir. Scenario-critical load authorization gelecekte gerekirse ayrı policy olabilir; MVP'de global EnergyPriority ve MinimumReserve yeterlidir.

**Sensors:** ChargePercent, StoredEnergy, Capacity, ChargeRate, DischargeRate, NetFlow, Condition, Temperature/SafetyState, MinimumReserve.

**Actions:** SetMinimumReserve(percent), MaintenancePriority. Enable/Isolate yalnız özel scenario ekler; default MVP action değildir.

**Modes:** Eco/Normal/Boost yok.

**Workforce:** 0 normal, maintenance sırasında gerekir.

**Wear:** Zaman yerine eşdeğer full-cycle throughput ile ağırlıklı. Baseline bir full equivalent cycle ≈ 1-1.5 Condition kaybı **TUNABLE**. Çok agresif charge/discharge wear'i artırabilir.

**Interlock:** Overcharge/unsafe deep discharge/thermal condition local controller tarafından engellenir. Oyuncu bataryayı tek komutla patlatamaz; chronic aggressive usage yine wear yaratabilir.

**Failure:** Stored Energy silinmez. Failed bankın capacity/energy'si onarıma kadar unavailable sayılır; repair sonrası tekrar erişilebilir. Aggregate capacity hesapları bunu yansıtır.

**Placement:** Energy zone; Reactor/Solar yakınlığı soft preference; dense residential'dan bir miktar ayrık; standard Expansion option.

**Visual:** charge/discharge için küçük directional indicator/emissive; giant animated battery gerekmez; Failed/maintenance/interlock diğer facility language ile tutarlı.

**Audio:** hafif electrical hum, charge/discharge yoğunluğu küçük fark; alert spam yok.

---

## 8.4 Oksijen İşleme Tesisi

**Rol:** Energy + Workforce kullanarak Oxygen üretir; Energy sistemi ile Population/Safety arasında ana köprüdür.

**Inputs:** Energy, Workforce. Maintenance için Material.

**Output:** Oxygen.

**Modes:** Eco / Normal / Boost.

- Eco: düşük production, düşük Energy ve wear.
- Normal: sustainable baseline.
- Boost: yüksek Oxygen, daha yüksek Energy, wear ve Workforce ihtiyacı.

**Sensors:** Status, Mode, OxygenOutput, AvailableOutputCapacity, EnergyConsumption, Assigned/RequiredWorkforce, Condition, MaintenanceNeed; global OxygenReserve ve StorageCapacity protokollerde okunabilir.

**Actions:** Enable, Standby, SetMode, WorkPriority, MaintenancePriority, EnergyPriority.

**Storage-full behavior:** Aggregate Oxygen capacity dolduğunda üretim boşa gitmez; local controller output'u kısar ve `StorageCapacityLimited` event üretir. Efficiency analysis gereksiz çalışma attempt'ini yorumlayabilir.

**Interlocks:** Critical Condition veya safe minimum Workforce eksikliği Boost/start'ı block edebilir.

**Workforce baseline:** minimum 1, nominal 2, Boost 3.

**Condition/Wear:** Eco düşük, Normal standart, Boost hızlı. Ayrı “processor heat resource” eklenmez.

**Placement:** Life Support zone; Oxygen Tank ve Habitat cluster'a yakın soft preference; mesafe oxygen transmission penalty üretmez.

**Visual:** fan/vent/controlled vapor; Boost'ta daha yoğun mekanik; Workforce shortage varsa hareket kısıtlı; storage-full için aşırı FX yok.

**Audio:** fan/air processing layer, mode yoğunluğu; oxygen warning sound facility loop'tan ayrı alert sistemindedir.

---

## 8.5 Oksijen Rezerv Tankı

**Rol:** Oxygen üretimi kesildiğinde koloniye zaman kazandıran fiziksel reserve capacity.

**Input/Output:** Oxygen store/release; aggregate Oxygen pool'a capacity sağlar.

**Ana control:** `MinimumReserve` setpoint Battery ile aynı zihinsel modelde kullanılabilir.

**Sensors:** StoredOxygen, Capacity, FillPercent, NetFlow, Condition, MinimumReserve, Availability.

**Actions:** SetMinimumReserve, MaintenancePriority. `Isolate/Connect` base MVP'de yoktur; leak odaklı özel scenario için extension'dır.

**Modes:** Yok.

**Workforce:** 0 normal, maintenance sırasında gerekir.

**Condition:** Random leak spam yok. Critical Condition usable capacity veya max flow'u azaltabilir. Failed durumda içerik silinmez; unavailable olur.

**Placement:** Life Support/Residential erişimine uygun, obvious hazard zone'dan uzak; standard Expansion option.

**Visual:** tank/silo silhouette, fill state UI panelde kesin; dünyada sadece qualitative indicator. Runtime composite geometry kullanılabilir.

**Audio:** çoğunlukla pasif; valve/pressure one-shot yalnız meaningful transition.

---

## 8.6 Maden / Çıkarım Tesisi

**Rol:** Energy + Workforce → Material. Yüksek tüketimli üretim motoru; kapatılması kısa vadede güvenli, uzun vadede maintenance debt yaratabilir.

**Inputs:** Energy, Workforce.

**Output:** Material.

**Modes:** Eco / Normal / Boost.

**Sensors:** MaterialOutput, AvailableOutputCapacity, EnergyConsumption, Assigned/RequiredWorkforce, Mode, Condition, MaintenanceNeed, Status. `DepositQuality` scenario-local static modifier olabilir; global yeni resource değildir.

**Actions:** Enable/Standby, SetMode, WorkPriority, MaintenancePriority, EnergyPriority.

**Workforce baseline:** minimum 1, nominal 3, Boost 3.

**Condition/Wear:** Base wear relatively high; Boost hızlı aşınır. Critical Condition Boost'u block edebilir.

**Storage-full:** Material capacity dolduğunda output kısılır/durur; resource çöpe atılmaz. Debugger “Materyal depolama kapasitesi dolu” nedenini gösterir.

**Placement:** Hard constraint `resourceDeposit` veya mining terrain anchor; Material Storage yakınlığı soft score; road/work access zorunlu.

**Visual:** drill/mechanical motion Working durumunu açıkça gösterir; Offline tamamen durur; maintenance worker dış work point'te görünür.

**Audio:** mechanical drill layers, mode yoğunluğu; overview'da culling.

**Systemic chain örneği:** Energy crisis → Mine Eco/Off → Material production düşer → maintenance bekler → Reactor Condition kötüleşir → sonraki enerji krizi büyür.

---

## 8.7 Materyal Deposu

**Rol:** Global Material storage capacity sağlar. Bilinçli olarak düşük kontrol derinliğine sahiptir.

**Inputs/Outputs:** Resource üretmez/tüketmez; physical capacity contribution.

**Sensors:** StoredMaterial aggregate/context contribution, CapacityContribution, Utilization, Condition, Availability.

**Actions:** MaintenancePriority. Normal gameplay'de ekstra mode/action gerekmez.

**Modes:** Yok.

**Workforce:** 0 normal, maintenance sırasında gerekir.

**Failure semantics:** İçerik silinmez. Capacity contribution geçici unavailable olabilir. Eğer stored Material etkin capacity'nin üzerindeyse mevcut stok korunur; yeni Material kabul edilmez; producer capacity-limited olur.

**Placement:** Industrial/Mine zone yakınlığı; standard Expansion option.

**Visual:** cargo depot + visible stored containers qualitative density; numeric exact stock panelde.

**Audio:** minimal passive ambience; loading activity simulation state varsa kısa one-shot.

---

## 8.8 Habitat Modülü

**Rol:** Population Capacity + Rest Capacity + yaşanabilir iç ortam. Oyunu RimWorld'a çevirmeden insanların fiziksel varlığını ve thermal/energy ilişkisini temsil eder.

**Inputs/Dependencies:** Energy; Thermal Service. Oxygen tüketimi Habitat tarafından ayrı sabit tüketim olarak değil, içindeki Population global demand'i üzerinden hesaplanır.

**Outputs:** PopulationCapacity, RestCapacity. Resource değildir.

**Workforce:** Facility operation için sürekli worker yok.

**Actions:** `TemperatureTarget`; `ConservationMode` (Normal/Tasarruf) full design'da bulunabilir. Tasarruf Energy/Thermal Demand'i düşürür fakat uzun kullanım Rest recovery / Efficiency/Stability üzerinde gerçek bedel üretir. MVP'de gerekmediği gezegenlerde action gizlenebilir.

**Sensors:** Occupancy, Capacity, InteriorTemperature, EnergyUse, ThermalDemand, RestingColonists, Condition, ConservationState.

**Condition:** Düşük Condition enerji/thermal efficiency'yi bozabilir; Critical usable capacity'yi azaltabilir. Failed olduğunda kolonistler otomatik olarak diğer habitatlara yönelir; boş capacity yoksa overcrowding/state pressure oluşur. Tek failure anında ölüm üretmez.

**Placement:** Residential cluster; Medical ve Shelter'a yakın; Reactor/Mine'dan uzak; habitatlar soft cluster preference.

**Visual:** sakin bina; windows, door traffic ve occupancy ile canlılık. Her mode'da aşırı FX yok.

**Audio:** düşük habitat ambience; yakın zoom'da door/airlock activity.

---

## 8.9 Termal Kontrol Tesisi

**Rol:** Energy + Workforce kullanarak koloniye `ThermalCapacity` hizmeti sağlar. Heat yeni resource değildir.

**Model:** Koloni/korunan alanlar `ThermalDemand` üretir. Dış sıcaklık, Habitat target'ları, event ve facility needs demand'i etkiler. Thermal Control capacity sağlar. Capacity < Demand olduğunda korunan sıcaklıklar zamanla hedeflerinden drift eder; anında zarar olmaz.

**Modes:** Eco / Normal / Boost.

**Sensors:** ThermalDemand, ThermalOutput/Capacity, EnergyUse, Assigned/RequiredWorkforce, Condition, OutsideTemperature, protected-average temperatures, Status.

**Actions:** Enable/Standby, SetMode, WorkPriority, MaintenancePriority, EnergyPriority. Habitat target bu tesisten değil Habitat üzerinden set edilir.

**Workforce baseline:** minimum 1, nominal 2, Boost 3.

**Interlocks:** Critical Condition + Boost block; minimum Workforce. Dışarısı aşırı soğuk diye sistem kendiliğinden kapanmaz.

**Failure:** Protected temperatures yavaş drift eder. Oyuncuya tepki süresi verir.

**Placement:** Life Support/Residential yakınlığı; Reactor yakınlığı şart değil; road access.

**Visual:** fan/cooling/heating machinery; mode ve demand'e göre hareket; outdoor conditions ile birlikte okunur.

**Audio:** airflow/cooling machinery, mode intensity.

---

## 8.10 Acil Durum Sığınağı

**Rol:** Passive “+Safety” bonusu değil, gerçek fiziksel tahliye hedefi ve Protection Capacity.

**Normal state:** Standby, düşük Energy, sürekli Workforce yok.

**Output:** ShelterCapacity/ProtectionCapacity; resource değildir.

**Actions:** `StartEvacuation(targetShelter)` ve `EndEvacuation/ReturnToNormal`. Oyuncu bireysel kolonist seçmez; simulation uygun unsheltered population'ı yönlendirir.

**Sensors:** Capacity, Occupancy, EvacuationProgress, EnRouteCount, UnshelteredCount, EstimatedTravelTime, Condition, Status.

**Inputs:** Active evacuation sırasında Energy. İçindeki insanların Oxygen consumption'ı devam eder; shelter sınırsız Oxygen üretmez.

**Condition:** Düşük Condition usable capacity/protection effectiveness'i azaltabilir; random occupant death üretmez.

**Placement:** Habitat ve Workforce bölgelerine erişilebilir; hazard kaynağının dibinde değil. Generator average/max evacuation route time'ı gameplay tolerance altında tutmalıdır.

**Expansion:** Standard her gezegende yok; scenario-specific.

**Visual:** fortified low silhouette, clear entrance; evacuation sırasında yoğun ama path-readable colonist flow.

**Audio:** evacuation onset güçlü one-shot, sonra düşük süreklilik; critical visual eşlik eder.

**MVP:** Facility type tasarımı kanoniktir fakat ilk MVP'de bulunmaz.

---

## 8.11 Tıbbi Modül

**Rol:** Injured colonist'leri tekrar kullanılabilir Workforce'a döndüren Treatment Capacity. Yeni Medicine resource yoktur.

**Inputs:** Energy, treatment sırasında Workforce ve time. Material yalnız facility maintenance/repair için.

**Output:** Treatment Capacity / recovery throughput.

**Workforce:** Kullanım sırasında genel Workforce havuzundan ayrılır; özel Doctor skill sınıfı açılmaz.

**Modes:** Base design'da ayrı Eco/Normal/Boost yok. Ana kontrol WorkPriority + MaintenancePriority'dir. Emergency Mode ilk MVP için gereksizdir; gelecekte ancak ölçülmüş gameplay ihtiyacı varsa eklenir.

**Sensors:** OccupiedTreatmentCapacity, WaitingInjured, AssignedWorkforce, EstimatedRecoveryLoad, Condition, Status.

**Actions:** WorkPriority, MaintenancePriority.

**Medical yoksa:** Habitat/basic care ile çok yavaş doğal recovery bulunur. Medical Module recovery'yi ciddi hızlandırır ve concurrency sağlar; her gezegende zorunlu dependency değildir.

**Placement:** Residential; Habitat/Shelter yakın; Industrial/Reactor'dan uzak.

**Visual:** base module + medical identification; treatment iç mekânı render edilmek zorunda değil.

**Audio:** sakin equipment ambience; emergency alert gameplay event sisteminden.

**MVP/progression:** Facility catalog'da kalır ancak ilk MVP'de ve Sector 1 ana öğretiminde kullanılmaz; güvenlik ağırlıklı ileri sector'da tanıtılması önerilir.

---

# 9. Workforce ve Kolonist Simülasyonu

## 9.1 Workforce resource değildir

Workforce, Population'dan türeyen dinamik operasyon kapasitesidir. Oyuncu insanları tek tek atamaz. System gerekli facility/work/maintenance taleplerini priority'ye göre deterministic dağıtır.

## 9.2 Kolonist state'leri

Full design:

- Available
- Working
- Resting
- Injured
- Evacuating

MVP subset:

- Available
- Working
- Resting
- Maintenance (Working'in görev türü olarak; UI'da ayrı gösterilebilir)

Injured/Evacuating Shelter/Medical ile birlikte MVP dışıdır.

## 9.3 Facility workforce alanları

- RequiredMinimumWorkforce
- RequiredNominalWorkforce
- RequiredBoostWorkforce (varsa)
- AssignedWorkforce
- WorkPriority

Minimum altı facility çalışamaz veya riskli command block olur. Minimum-Nominal arası output/ramp yaklaşık lineer düşebilir. Nominal üstü işçi ekstra output vermez, Boost özel requirement ayrı tanımlıdır.

**Baseline:** Reactor 2/3/4; Mine 1/3/3; Oxygen Processor 1/2/3; Thermal Control 1/2/3.

## 9.4 Deterministic assignment algoritması

1. Çalışabilir aktif Workforce havuzu hesaplanır.
2. Talepler priority Critical → High → Normal → Low sırasına alınır.
3. Eşit priority talepleri stable facility ID + task type sırasıyla çözülür.
4. Minimum güvenli crew mümkünse önce karşılanır; kalan kapasite nominal hedefe yükseltilir.
5. Maintenance task'ları `MaintenancePriority` ile aynı deterministic queue prensibini kullanır; oyuncu priority conflict'ini Debugger'da görebilir.
6. Reassignment event loglanır; kolonist fiziksel olarak yeni hedefe yürür.

## 9.5 Vardiya ve dinlenme

Kolonistler basit otomatik shift/rest sistemine sahiptir. Oyuncu vardiya çizelgesi kurmaz. Resting population active workforce dışına çıkabilir; shift turnover öngörülebilir olmalı ve büyük rastgele workforce spike yaratmamalıdır.

`Emergency Shift` full design'da geçici aktif Workforce artışı sağlayabilir; uzun dönem Efficiency/Safety bedeli vardır. Exact formül **DEFERRED/TUNABLE** ve MVP'nin ilk üç gezegeninde zorunlu değildir.

## 9.6 Fiziksel temsil

- Düşük/orta population'da mümkünse 1:1 kolonist visual representation.
- Assignment değişince gerçek facility entrance'a yürür.
- İç mekân render edilmez: door'a ulaşınca hidden/interior-working state, shift sonunda çıkar.
- Outside maintenance/work için work point animasyonu kullanılır.
- Click yalnız observation panel açar; individual order yok.
- İsim + state + current assignment gösterilebilir; skill/trait/inventory yok.

> **Kural:** Kolonist hareketi dekor değil, simülasyonun okunabilir görsel sonucudur.

## 9.7 Pathfinding

Basit road/navigation graph + A*. Full navmesh/crowd sim yok. Küçük lane/offset ile üst üste binme azaltılabilir. Physical travel delay özellikle maintenance ve evacuation'da gerçek simulation time'dır; placement-distance temel balance lever'ı değildir çünkü oyuncu serbest placement yapmaz.

---

# 10. Condition, Wear, Maintenance ve Failure

> **İlke:** Gerçekçi davranış, sade simülasyon.

## 10.1 Condition bands - Balance Baseline v0.1

| Condition | Oyuncu durumu |
|---:|---|
| 70-100 | Sağlıklı |
| 40-69 | Yıpranmış |
| 1-39 | Kritik |
| 0 | Arızalı |

- Maintenance request başlangıç eşiği: `<60`.
- Uygun facility'lerde Boost safety block başlangıç eşiği: `<30`.
- Değerler config'tir fakat band modelinin kendisi kanoniktir.

## 10.2 Wear formülü

Genel başlangıç modeli:

`wearPerHour = baseWear × modeMultiplier × condition/environment/load modifiers`

Mode multiplier baseline:

- Eco ×0.5
- Normal ×1.0
- Boost ×2.5

Base wear / sim saat baseline:

- Reactor 0.20
- Mine 0.25
- Oxygen Processor 0.15
- Thermal Control 0.18

Pasif tesisler daha yavaş aşınır; Battery throughput/cycle bazlıdır.

## 10.3 Condition performans etkisi

- 70-100: %100 nominal capacity.
- 40-69: yaklaşık %85-100 arasında degradation.
- 1-39: yaklaşık %60-85; riskli mode kısıtları.
- 0: %0, Failed.

Ara değerler deterministic lineer/curve config ile hesaplanabilir. Tesis-specific override mümkündür.

## 10.4 Maintenance execution

Oyuncu “Repair now” butonu ile teknisyen seçmez. Facility maintenance request üretir; Gözlemci maintenance priority ayarlar. İş için Material + Workforce + sim time gerekir. Task başladığında tesis type'a göre Offline veya Reduced Capacity olur.

Baseline örnekleri:

| Tesis | Workforce | Material | Süre |
|---|---:|---:|---:|
| Mine | 2 | 6 | 2 sim saat |
| Reactor | 2 | 10 | 3 sim saat |
| Oxygen Processor | 1 | 4 | 1.5 sim saat |
| Thermal Control | 1 | 5 | 2 sim saat |

Successful maintenance facility'yi yüksek Healthy bandına (varsayılan ~90-100) döndürür. Exact restore amount config'dir.

## 10.5 Failure fairness

Teknik failure ağır RNG ile gelmez. Condition, load, Thermal Load, workforce, event exposure gibi gözlenebilir nedenleri vardır. Debugger causal chain'i açıklamalıdır. Normal failure onarılabilir; permanent destruction yalnız özel scenario'da açıkça tanımlanır.

---

# 11. Protokol Sistemi - Kavramsal Model

Bir Protocol aşağıdaki akışı kullanır:

**Trigger → Evaluation/Logic → Timing/Flow → Action**

Yalnız Trigger protocol execution başlatır. Sensor/Data node yalnız veri okur; kendi başına execution pulse yaratmaz.

## 11.1 ProtocolDefinition ve runtime ayrımı

```text
React Flow Graph UI
      ↓
ProtocolDefinition JSON
      ↓
Validator / Compiler
      ↓
ExecutableProtocol
      ↓
Simulation Engine / Protocol Runtime
```

React Flow **execution engine değildir**. Graph render state ile runtime state ayrıdır.

## 11.2 Protocol lifecycle

- Draft
- Validated draft
- Applied/Active Version
- Disabled
- Archived

Düzenleme aktif protocol'ü anında mutate etmez. Akış:

**Taslak → Kontrol Et → Uygula → Aktif Sürüm**

Basit version history/revert tutulur.

## 11.3 Protocol priority

Low / Normal / High / Critical. Priority command conflict çözümünde kullanılır; Safety Interlock'ın üstüne çıkamaz.

---

# 12. Genel Node Kataloğu ve Unlock Sırası

Kanonik kalıcı Gözlemci logic node'ları dokuz adettir:

1. Karşılaştır / Compare
2. VE / AND
3. VEYA / OR
4. DEĞİL / NOT
5. Geciktir / Delay
6. Zamanlayıcı / Timer
7. Tekrar Bekleme / Cooldown
8. Sayaç / Counter
9. Dallandır / Splitter

Compare operatörleri: `<`, `>`, `≤`, `≥`, `=`, `≠`.

Trigger, Sensor ve Action general logic node değildir; gezegen/facility capability'sidir.

## 12.1 Unlock order

- **S1:** Karşılaştır + VE + Geciktir
- **S2:** Zamanlayıcı + Tekrar Bekleme
- **S3:** VEYA + DEĞİL
- **S4:** Sayaç + Dallandır
- **S5:** yeni node yok; mastery

Free-choice sector yapısı nedeniyle node unlock belirli opsiyonel gezegene bağlanmaz. İlk zorunlu training planet istisna olabilir.

## 12.2 Bilinçli olarak olmayan node'lar

MVP/core'da Gate, variables, arbitrary math nodes, custom function, general memory/latch, random, script, while/for loop yoktur. Repeat/state memory Timer/Counter/Cooldown/Delay ile kontrollü sunulur.

---

# 13. Protokol Runtime - Kesin Semantik

Bu bölüm implementasyon açısından **MUST**tır.

## 13.1 Trigger crossing

Threshold Trigger her tick çalışmaz. Eşik crossing olduğunda pulse üretir ve karşı tarafa yeniden geçilene kadar re-arm olmaz. Örneğin `Energy < 30` sadece `>=30 → <30` crossing'inde tetikler.

## 13.2 Snapshot evaluation

Bir execution'ın normal başlangıç değerlendirmesindeki sensor/condition node'ları tutarlı world snapshot okur. Aynı execution içinde iki condition farklı tick'ten veri okumaz.

Delay sonrası downstream condition varsa **daha sonraki mevcut state** okunur; eski snapshot taşınmaz.

## 13.3 Logic node'ları

AND/OR/NOT instantaneous boolean evaluation'dır; gizli memory taşımaz. Condition TRUE/FALSE path'leri olabilir.

## 13.4 Action persistence

Action sonucu tesis state/setpoint'ini kalıcı değiştirir. Başka command gelene kadar eski değere otomatik dönmez. HELIOS'un ilk önemli dersi budur.

## 13.5 Delay

Delay simulation time kullanır. Execution context scheduled olarak bekler. Save sırasında remaining delay kaydedilir.

## 13.6 Cooldown

İlk valid pulse geçer ve cooldown başlar. Cooldown sırasında gelen pulse block/log edilir; gizlice queue yapılmaz. Süre bitince re-arm.

## 13.7 Counter

Her valid pulse increment eder. MVP/full baseline'da target'a ulaştığında output pulse üretir ve Counter 0'a resetlenir. Save runtime state içerir.

## 13.8 Splitter

Tek pulse aynı logical execution moment'ında birden fazla branch'e kopyalanır. Branch'ler deterministic order'da evaluate edilir; simultaneous action conflict çözümü aşağıdaki kurala tabidir.

## 13.9 Graph cycle yasağı

Arbitrary graph cycle compile/validation aşamasında reddedilir. Loop ihtiyacı explicit time/state node'larıyla çözülür.

## 13.10 Command conflict sırası

Aynı simulation moment'ında aynı actuator/setpoint için uyumsuz command'lar varsa:

1. Safety Interlock bütün command'lardan üstündür.
2. En yüksek Protocol Priority kazanır.
3. Eşit priority ve incompatible command → **hiçbiri uygulanmaz**, current state değişmez, `CONFLICT / ÇAKIŞMA` event'i oluşur.
4. Random, “son yazan kazanır”, React render order veya creation order kullanılmaz.

Simultaneous olmayan daha sonraki command persistent state'i değiştirebilir.

## 13.11 Action outcome

Her Action bir `CommandResult` üretir:

```ts
status: 'applied' | 'blocked' | 'failed' | 'delayed'
reasonCode?: string
requestedValue?: unknown
appliedValue?: unknown
facilityId: string
protocolExecutionId: string
simTime: number
```

Natural-language Debugger metni `reasonCode` + localization üzerinden oluşturulur.

---

# 14. Protokol Yöneticisi ve Graph Editor UX

## 14.1 Protocol Manager

PROTOKOLLER ana ekranı doğrudan graph değil, manager'dır. Card:

- Ad
- Active/Disabled/Draft
- Priority
- Otomatik kısa özet
- Etkilenen sistemler/facility'ler
- Son execution status/time

Search + useful filters. MVP'de folder yok. Protocol count/node count için yapay maksimum yok; performance warning olabilir.

## 14.2 Graph Editor

Desktop: node palette + graph + settings/detail. Mobile: `+ Node` bottom sheet ve touch-friendly ports/hitboxes.

- Valid connection highlight.
- Invalid connection kurulamadan block + doğal Türkçe açıklama.
- Structural error ile warning ayrılır.
- `Kontrol Et` gelecek sonucu çözmez; yalnız graph/type/connection/required field validation yapar.
- Apply simulation'ı auto-pause etmez.
- Debugger belirli node/execution'a jump edebilir.

## 14.3 Teknoloji

- React
- `@xyflow/react`
- Zustand
- Zod
- ELK.js optional auto-layout
- dnd-kit optional palette interactions
- Custom TypeScript Simulation/Protocol Engine

Rete.js ana yön değildir.

---

# 15. Hata Ayıklama / Automation Debugger

Debugger yardımcı log ekranı değil, core mechanic'tir.

## 15.1 Ana hedef

Oyuncuya “Ne oldu?”, “Buna ne yol açtı?”, “Bu neye yol açtı?” sorularını açıklamak. “Şu protokolü kur” şeklinde çözüm önermemek.

## 15.2 UI yapısı

Desktop: Event Timeline/List + selected detail. Mobile: list → detail navigation. Filters/search bulunur. Critical events auto-marked olabilir.

Event source categories:

- External
- System
- Protocol

## 15.3 Meaningful event kuralı

Her resource tick loglanmaz. Loglanacak örnekler:

- threshold/band crossing
- facility mode/state transition
- protocol trigger/evaluation/action
- command block/failure/conflict
- Safety Interlock
- maintenance start/end
- event phase transition
- objective/sustainability transition
- collapse-critical chain

## 15.4 Causal model

Her `SimulationEvent` gerekirse `causedByEventIds[]`, `sourceEntityId`, `protocolExecutionId`, `facilityId`, `category`, `severity`, `reasonCode` taşır. Causal link'ler UI'da iki yönlü gezilebilir.

## 15.5 Natural-language standard

İç jargon oyuncuya gösterilmez.

Örnek:

```text
Koşul sağlanmadı.
Enerji %30'un altında mı?
Ölçülen değer: %42.
```

```text
Komut uygulanamadı.
Reaktör yüksek güç moduna geçirilemedi.
Neden: Çekirdek sıcaklığı güvenli sınırın üzerinde.
```

## 15.6 Debug history

Save'de sonsuz ham telemetry tutulmaz. Son birkaç operasyon döngüsünün meaningful events'i + milestone/critical events kalıcı tutulur. Collapse Analysis aynı altyapıyı kullanır.

---

# 16. Olay ve Kriz Sistemi

> **Event ≠ Crisis.** Event dış/yerel baskıdır; crisis çoğunlukla koloninin event veya sistem değişimine iyi cevap verememesinden doğar.

## 16.1 Event kaynakları

- Environmental
- Colony/system-derived
- Population/human
- External threat

Threat yalnız bir kategoridir; oyun tower defense değildir.

## 16.2 Event lifecycle

Major event:

**Forecast/Warning → Onset → Active → Recovery**

Önleyici ve reaktif protokoller farklı aşamalarda çalışabilir.

## 16.3 Predictability sınıfları

- Fully predictable: day/night, düzenli cycle.
- Forecastable: dust storm/cold wave approximate arrival/severity.
- State-predictable: technical risk from Condition/Thermal Load; exact countdown gerekmez.
- Short-warning: meteor/sudden threat; yine yeterli sensör uyarısı olmalı.

Hazırlanılabilir serious failure sıfır-warning unfair drop olmamalıdır.

## 16.4 Randomness

Environmental timing/intensity bounded seeded randomness kullanabilir. Technical failures heavy RNG kullanmaz. Aynı event farklı system/protocol durumlarında farklı sonuç üretir.

## 16.5 Fairness ilkesi

> **Her ciddi başarısızlığın geriye dönük açıklanabilir bir nedeni olmalıdır.**

Debugger event'in kendisini değil, failure chain'i gösterir. External event gelmesi Safety/Stability puanını otomatik düşürmez; başarısız yanıt düşürür.

---

# 17. Başarısızlık, Kritik Durum, Çöküş ve Kurtarma

## 17.1 Üç seviye

1. **Local failure:** tesis/goal anlık sorun yaşar; oyun devam eder.
2. **Critical State:** ciddi ama recoverable. Uyarı verir; oyuncu Pause/Debug/Protocol düzenleyebilir.
3. **Colony Collapse:** yalnız irreversible/unsustainable condition. Önceden bilinen/okunabilir koşullarla gerçekleşir.

> **İlke:** Failure ceza değil, analiz ve yeniden tasarım fırsatıdır.

## 17.2 Collapse öncesi şeffaflık

Bir gezegenin collapse conditions'ı design data'da ve oyuncu tarafında doğal biçimde bilinir. Örneğin “Oxygen bu seviyede bu kadar süre kalırsa koloni sürdürülemez” gibi. Gizli instant fail yok.

## 17.3 Safe Checkpoint

Autosave'den ayrıdır. Sistem otomatik Safe Checkpoint üretir:

- ciddi active crisis yok,
- temel life support kabul edilebilir,
- koloni critical state'te değil,
- anlamlı operasyon döngüsü tamamlanmış.

Oyuncu manuel checkpoint spam yapmaz. Teknik olarak son 2-3 tutulabilir; normal UI son güvenli duruma dönmeyi sunar.

## 17.4 Collapse sonrası

Collapse Analysis → seçenekler:

- Son Güvenli Duruma Dön
- Gezegeni Yeniden Başlat
- Sektöre Dön

Campaign meta cezası yok. Daha önce stabilize edilmiş/devir edilmiş gezegen collapse ile progression kilidini geri getirmez.

---

# 18. Colony Health ve Assessment

Dört boyut:

1. Nüfus
2. Kararlılık
3. Verimlilik
4. Güvenlik

Mission completion ayrı; Health çözüm kalitesidir.

## 18.1 Nüfus

Raw headcount değil, gezegenin beklenen insan varlığını sürdürebilme başarısı. Fazla nüfus otomatik >100 avantaj vermez; kapasite baskısı başka sistemlerde sonuç üretir.

**TUNABLE başlangıç yaklaşımı:** target adequacy ağırlıklı + yakın dönem continuity. Eski baseline yaklaşık %80 target adequacy + %20 continuity olabilir; exact coefficients final playtest'e açıktır.

## 18.2 Kararlılık

Başlangıç ağırlıkları:

- %40 System Continuity
- %25 System Fluctuation
- %20 Recovery Ability
- %15 Control Consistency

Event'in varlığı ceza değildir; repeated interruption, oscillation, crisis cycling ve kötü recovery ceza yaratır.

## 18.3 Verimlilik

- %35 Resource Use Efficiency
- %25 Workforce Use
- %25 Facility Use
- %15 Operational Waste

Gerekli preparedness reserve veya gerçekten ihtiyaç duyulan Boost “waste” sayılmaz; context-aware analyzer kullanılır.

## 18.4 Güvenlik

- %40 Colonist Safety
- %25 Hazard Management
- %20 Critical Infrastructure Safety
- %15 Safety System Reliability

Near miss küçük, injury ciddi, death çok ciddi etki. Interlock activation tek başına ağır ceza değildir; sürekli interlock hit unsafe policy sinyalidir.

## 18.5 Genel Health

**KESİN formül:**

`Health = (Population × Stability × Efficiency × Safety)^(1/4)`

Dört boyut eşittir. 0 olan boyut genel Health'i 0 yapar.

| Puan | Etiket |
|---:|---|
| 0-24 | Kritik |
| 25-49 | Kırılgan |
| 50-69 | İşlevsel |
| 70-84 | Kararlı |
| 85-94 | Sağlıklı |
| 95-100 | Üstün |

## 18.6 Rolling window

Varsayılan Health penceresi son **3 operasyon döngüsü**. Eski olaylar zamanla etkisini kaybeder; ölüm gibi gelecekteki ağır sonuçlar daha uzun sürebilir.

## 18.7 Objective tolerans tipleri

- `HardSafety`: tolerans yok veya explicit kısa grace.
- `Continuous`: çok kısa transition/sensor sapmasına grace verilebilir.
- `CycleAggregate`: döngü toplam/ortalaması değerlendirilir.

## 18.8 Assessment

Stabilizasyon anında simülasyon varsayılan olarak pause edilebilir. İlk vurgu “Stabilize Edildi”; Health ikincildir.

Gösterilecekler:

- Mission Conditions sonucu.
- Sustainability cycles.
- Genel Health + dört boyut.
- Her boyutta simulation-derived kısa açıklama.
- 5-6 meaningful operational metric.
- İsteğe bağlı “En Kritik An” → Debugger jump.
- İlk Stabilizasyon/Devir Health, Current Health, Best Health.

Analyzer deterministic/template tabanlıdır; generative AI yorumuna bağlı değildir. “Doğru/yaratıcı protocol” puanlanmaz, yalnız observed outcome.

Assessment sonrası:

- Kolonide Kal
- Koloniyi Devret
- Hata Ayıklama Özeti

---

# 19. Kayıt Sistemi, Devir Snapshot ve Colony Network

## 19.1 Save türleri

- **Current Live Save:** aktif/revisit state.
- **Safe Checkpoint:** otomatik güvenli recovery noktası.
- **Devir Snapshot:** official immutable success snapshot.

Bunlar ayrı kavramlardır.

## 19.2 Stabilizasyon ve devir

Stabilizasyon → Assessment → oyuncu Kolonide Kal veya Koloniyi Devret seçer. Devir immutable official snapshot yaratır. Sonraki deneyler/değişiklikler official campaign başarısını geri almaz.

Revisit current state Devir snapshot kopyasından/son current state'ten gelişir. Oyuncu gerektiğinde Devir state'ine dönebilir.

## 19.3 Save içeriği

En az:

- saveVersion / gameVersion
- planetId, layoutId/seed
- simulation clock
- resources + capacities
- facilities: state/mode/condition/setpoints/priorities/ramp/thermal/etc.
- workforce + colonist states/assignments/travel progress
- maintenance/construction tasks
- active protocol definitions + version refs
- protocol runtime memory: delays, cooldowns, counters, timers
- event phases/scheduler + RNG seed/state
- mission/sustainability progress
- rolling Health data
- meaningful Debug events + milestones
- current safe checkpoint metadata

UI preferences ayrı settings storage'da tutulabilir.

## 19.4 Web storage

`SaveRepository` domain abstraction. Web first implementation IndexedDB. Write atomic-ish temp/replace + hidden previous backup. Autosave simülasyonda görünür stutter yaratmamalı.

## 19.5 Colony Network

Full product'ta tamamlanan kolonilerin history/archive ekranıdır. Campaign Map “Nereye giderim?”, Colony Network “Ne yaptım?” sorusunu cevaplar. MVP'de full UI ertelenebilir; data modeli baştan destekler.

---

# 20. COLONY Dünya Renderer'ı ve Görsel Yön

## 20.1 Görsel hedef

COLONY, text/data-only dashboard değildir. Yaşayan kompakt bir bilimkurgu kolonisi olarak görünür. Hedef:

> **Stilize, temiz, düşük-poly, atmosferik ve yaşayan 2.5D bilimkurgu dioraması.**

Kalite aşırı polygon sayısından değil; güçlü siluet, tutarlı material/palette, iyi ışık, kontrollü çevre FX'i, kolonist hareketi ve facility state readability'den gelir.

## 20.2 Teknik stack

- React UI
- React Three Fiber
- Three.js
- `@react-three/drei`
- Zustand derived view state
- Ready GLTF/GLB assets

PixiJS ana COLONY renderer değildir.

## 20.3 Simulation authority

```text
Simulation Engine
     ↓ state/events
World View Model
     ↓
React Three Fiber Renderer
```

Renderer şu kararları **veremez**:

- facility arızalandı mı,
- colonist nereye atandı,
- event hasarı oldu mu,
- resource değişti mi,
- protocol command uygulandı mı.

Renderer yalnız authoritative state'i sunar.

## 20.4 Kamera

- Fixed 3/4 / isometric-like angle.
- Orthographic varsayılan.
- Rotate/orbit/FPS camera yok.
- Pan + controlled zoom.
- Yaklaşık üç okunabilir zoom bandı: Overview / Region / Facility.
- Maksimum zoom-out tüm kompakt koloniyi ve sınırlı terrain boundary'yi gösterir.
- Camera bounds planet layout data'dan gelir.
- `Koloniyi Göster` reset/focus action bulunur.
- Alert otomatik camera steal yapmaz; kullanıcı `Göster` derse focus olur.

## 20.5 Selection

Selectable:

- facilities
- expansion slots
- colonists (observation only)
- event zones/special scenario entities

Decor selectable değildir. Facility select → highlight + safe focus + context panel. Desktop double click focus optional; mobile tap select.

## 20.6 Facility visual state language

Kanonik dünya state'leri:

- Normal
- Eco
- Boost
- Beklemede
- Enerjisiz
- Yıpranmış
- Kritik
- Bakımda
- Arızalı
- Güvenlik Kilidinde

Her state yalnız ikonla gösterilmez. Kullanılabilecek kanallar:

- animation speed
- emissive intensity
- mechanical movement
- controlled particle/vapor
- colonist activity
- audio
- small state indicator

Dünyada aynı facility üzerinde en fazla bir ana status icon. Exact sayısal bilgi panelde.

> **Bilgi katmanları:** Dünya = fark et; Panel = kesin durum/sayı; Debugger = neden.

---

# 21. COLONY HUD - Desktop ve Mobile Kanonik Yerleşim

> **COLONY ekranının yıldızı HUD değil, yaşayan koloni dünyasıdır.**

HUD yalnız sürekli gerekli bilgiyi gösterir; detay talep üzerine açılır.

## 21.1 Desktop top HUD

Sürekli görünenler:

1. Planet adı + local time / operational cycle.
2. Compact environment summary.
3. Energy / Oxygen / Material.
4. Workforce compact.
5. Genel Colony Health.
6. Active alert count.
7. Pause / ×1 / ×2 / ×4.
8. Küçük global/pause menu entry.

Resource item'ı current/capacity veya appropriate value + trend (`↑ → ↓`) gösterir; production breakdown sürekli HUD'da değildir.

Workforce compact örneği `27/32`; total Population ile Active Workforce karıştırılmaz. Click panelinde Population, Active, Assigned, Available, Resting, Injured, Evacuating breakdown gösterilir.

Mission küçük collapsed card/pill: örneğin `Stabilizasyon 2/3`. Expanded Mission panel: Objectives, Sustainability, Arrival Report, Help.

Health compact: `Sağlık 82`; click → dört alt skor ve açıklama.

Alerts count click → ongoing alert panel; her alert `Göster` ile world focus/Debugger'a bağlanabilir.

## 21.2 Desktop facility context

Sağ overlay yaklaşık 320-380 CSS px. World zorunlu resize olmaz; kamera safe viewport içinde selected entity'yi görünür tutar. Panel: status, mode, Condition, workforce, maintenance, relevant input/output, influencing protocols, Debugger link. Empty click/ESC/X kapatır.

Facility name label her zaman world üstünde değildir; hover/selection/alert/appropriate zoom'da görünür.

## 21.3 Bottom navigation

Yalnız:

- KOLONİ
- PROTOKOLLER
- HATA AYIKLAMA

Network, Settings, Handbook bottom main nav'a eklenmez.

## 21.4 Mobile

- Compact top line: planet/time/alerts/menu.
- İkinci compact line: environment + Health.
- Sabit dört hücre resource strip: Energy / Oxygen / Material / Workforce. Horizontal scroll yok.
- Central world.
- Facility/resource/mission details bottom sheet. Initial facility sheet yaklaşık %35-40 viewport height, drag-expand.
- Simulation controls thumb-accessible, bottom nav'ın hemen üstünde.
- Üç ana tab persistent; full-screen editor/detail gerektiğinde hide edilebilir.
- Mission compact floating pill.
- One-finger pan, pinch zoom, tap select, empty tap deselect; rotate gesture yok.
- Landscape yeterince genişse desktop-like right panel; breakpoint viewport width ile, UA/device type ile değil.
- Minimum interactive touch target yaklaşık 44-48 CSS px.

## 21.5 UI Safe Viewport

Camera focus geometric screen center'i kullanmaz. HUD, right panel, bottom sheet ve `env(safe-area-inset-*)` ile kapalı bölgeler çıkarılarak görünür safe rectangle hesaplanır. Focus target bu alanın visual center'ına yerleştirilir.

HUD desktop/mobile aynı simulation-derived `HUDViewModel` kullanır; ayrı business logic kopyalanmaz.

## 21.6 HUD'da sürekli gösterilmeyecekler

- 4 Health subscore'un hepsi
- her facility production
- individual colonist detail
- protocol count/list
- debug log
- ayrıntılı hava istatistikleri
- bütün objectives
- bütün Condition değerleri

---

# 22. Deterministic Constraint-Based Colony Layout Generator

> **Koloni düzeni rastgele değildir; kod tarafından tasarlanır. Generator, insan level designer'ın uygulayacağı fiziksel, güvenlik, erişim ve görsel kompozisyon kurallarını veri olarak uygular.**

Player campaign'de aynı planet'e her girişte farklı map görmez. Procedural generation development/build aşamasında seed ile üretilebilir ve `planet.layout.json` olarak sabitlenir. Revisit spatial memory korunur.

## 22.1 “Tam koordinat değil, tasarım niyeti”

PlanetDefinition şu bilgileri verir:

- required facility composition
- terrain traits/semantic areas
- layoutProfile
- optional semantic anchors
- hazard/resource zones
- expansion intent

Ham x/z coordinate ancak generated output'ta bulunur.

## 22.2 Pipeline

```text
PlanetDefinition
  ↓
TerrainDefinition
  ↓
LayoutGenerator
  ↓
LayoutCandidate[]
  ↓
LayoutValidator
  ↓
LayoutScorer
  ↓
GeneratedPlanetLayout
  ↓
RoadGenerator
  ↓
NavigationGraph
  ↓
PropDecorator
```

## 22.3 Terrain semantic areas

Örnek tags:

- buildable
- blocked
- resourceZone
- hazardZone
- preferredExpansionArea

Operational semantic zones:

- Energy
- Industrial
- Residential
- LifeSupport
- Emergency

Bu zonelar oyuncuya UI bölgesi olarak gösterilmek zorunda değildir.

## 22.4 Facility PlacementProfile

Her facility type:

```ts
interface PlacementProfile {
  footprint: { width: number; depth: number };
  preferredZones?: string[];
  requiredTerrainTags?: string[];
  forbiddenTerrainTags?: string[];
  preferredNeighbours?: Array<{ type: string; maxDistance?: number; weight: number }>;
  avoidedNeighbours?: Array<{ type: string; minDistance: number; weight: number }>;
  minimumSeparation?: number;
  accessPoints: AccessPointDefinition[];
  requiresRoad: boolean;
  orientationBehavior: 'road-facing' | 'free-90' | 'anchor-facing' | 'fixed';
  expansionCompatibility?: string[];
  serviceClearance?: ClearanceDefinition;
}
```

Field adları referanstır; semantik kanoniktir.

## 22.5 Hard constraints

Candidate reject edilir:

- facility overlap
- footprint outside buildable area
- required terrain tag yok
- forbidden/hazard terrain ihlali
- required resource deposit yok
- road/access imkânsız
- entrance/service clearance unusable
- expansion slot desteklediği module footprint'lerini alamıyor
- camera/screen-space nedeniyle mandatory entity tamamen okunamaz durumda
- shelter varsa kabul edilmiş max evacuation tolerance aşılmış

## 22.6 Soft scoring

- logical adjacency
- safety separation
- road quality
- compactness/spread
- visual composition
- expansion access
- camera readability
- screen-space overlap
- evacuation path quality
- terrain usage

Birden fazla candidate generate edilir; valid candidate'lar score edilir; en yüksek seçilir.

## 22.7 Screen-space validation

3D bounding box overlap yeterli değildir. Sabit 2.5D camera altında iki yüksek tesis ayrı world coordinate'de olsa bile ekranda üst üste gelebilir. Validator selected camera projection ile silhouette/footprint overlap score hesaplayabilmelidir.

## 22.8 Asset metadata

Model metadata:

- source bounds
- target footprint
- rotation offset
- entrance/access points
- work points
- visual center
- optional roof/FX hooks

Road facility center'a değil access point'e bağlanır.

## 22.9 Roads ve navigation

Facility placement bittikten sonra:

1. required entrances graph node olur.
2. minimum connection graph / MST-benzeri connection planı çıkar.
3. terrain A* ile road path üretilir.
4. readability/natural look için sınırlı secondary connection eklenebilir.
5. aynı graph colonist navigation'ın temelini oluşturur.

## 22.10 Props son aşamada

Gameplay geometry valid olduktan sonra zone-aware props yerleştirilir. Prop collision gameplay path'ini bozmaz. Controlled imperfection (küçük rotation/offset) steril grid hissini azaltabilir.

## 22.11 Layout styles

İlk üç genel profile yeterli:

- Compact
- Linear
- Distributed

Planet data density, separation, road style, terrain usage gibi parametrelerle profile'ı özelleştirir.

## 22.12 Output

```ts
interface GeneratedPlanetLayout {
  seed: number;
  facilities: GeneratedFacilityPlacement[];
  expansionSlots: GeneratedExpansionSlot[];
  roads: GeneratedRoad[];
  navigationNodes: NavigationNode[];
  zones: GeneratedZone[];
  propZones: PropZone[];
  cameraBounds: CameraBounds;
}
```

Renderer placement kararı vermez; bu output'u render eder.

---

# 23. Çevre, Biyom ve Event Görselleştirmesi

## 23.1 Day/night

World lighting local simulation time ile senkron. Sun direction/intensity, sky/fog, facility windows/emissive gibi presentation parametreleri time-of-day'den türetilir. Renderer kendi gizli clock'unu çalıştırmaz.

## 23.2 Event phase görsel dili

Forecast → küçük/readable ön sinyal. Onset → artan çevre etkisi. Active → severity'ye uygun peak. Recovery → yavaş normalleşme. Görsel yoğunluk event severity ile qualitative eşleşir; gameplay'i örtecek FX yasaktır.

## 23.3 Biome kimlikleri

Frozen, dust, volcanic, lunar vb. planet identity ortak art direction içinde varyasyon üretir. Terrain/palette/fog/props ve environment FX değişir; facility core visual language korunur.

## 23.4 Environment HUD

Sürekli HUD yalnız compact durum: dış sıcaklık, event warning, irradiance gibi o gezegende önemli 1-2 bilgi. Detay panelinde daha fazlası. Her sensor HUD'a basılmaz.

---

# 24. Audio Tasarımı ve Pipeline

Ses ikinci bilgi kanalıdır. **Kritik hiçbir bilgi yalnız sesle verilmez.** Ses tamamen kapalıyken oyun oynanabilir.

## 24.1 Dört katman

1. World / Environment
2. Facility / Simulation
3. UI / Alerts
4. Music

Ayrı volume bus'ları:

- Master
- Music
- World
- Facilities
- Alerts
- UI

## 24.2 World ambience

HELIOS: kuru rüzgâr/açık alan + uzak colony machinery.  
NIVALIS: soğuk rüzgâr/kar, boğuk ambience.  
MOROS: endüstriyel düşük frekans/rocky environment.

Camera/focus konuma göre facility sesleri spatial attenuation ile öne çıkar; overview'da colony ambience baskın.

## 24.3 Facility audio layer modeli

Tek `reactor_boost.mp3` yerine reusable layers:

```text
baseHum
+ mechanicalLoop
+ coolingLayer
+ transitionOneShot
```

Mode layer intensity değiştirir. Interlock kısa tanınabilir shutdown cue. Failed facility'de sesin kaybolması bilinçli feedback olabilir.

## 24.4 Semantic alert families

Az ve öğrenilebilir aile:

- Info
- Warning
- Critical
- Interlock
- Conflict
- Success

Her trigger/execution bip üretmez. Protocol normal runtime çoğunlukla sessizdir; yalnız attention-worthy outcome alert üretir.

## 24.5 Music

Minimal, uzun süre dinlenebilir ambient/electronic. MVP başlangıç state modeli:

- Calm
- Pressure
- Critical

Mümkünse aynı müzik yatağına layer eklenir; abrupt track switching zorunlu değildir. Büyük soundtrack prodüksiyonu MVP outside olabilir.

## 24.6 Debugger ve Pause

Debugger açıldığında world/facility bus hafif duck edilebilir. Simulation pause olduğunda mekanik simulation loops kısa fade ile durur; UI audio çalışır.

## 24.7 Observer voice

Ayrı konuşan Observer AI yok. Voice acting temel ihtiyaç değildir.

## 24.8 Teknik mimari

```text
SimulationEvent / FacilityState
       ↓
AudioDirector
  ├─ MusicStateController
  ├─ SpatialAudioController
  ├─ AudioPool
  └─ AudioRegistry
       ↓
Audio Buses
```

Logical ID örnekleri:

- `reactor.normal.loop`
- `reactor.interlock`
- `alert.critical`
- `ui.protocol.applied`

Facility code raw file path bilmez.

## 24.9 Web AudioContext

Browser autoplay kısıtı nedeniyle AudioContext ilk kullanıcı interaction'ında unlock edilir. Main Menu → “Gözlemci Ağına Gir” gibi interaction yeterli. AudioDirector locked/unlocked state yönetir.

## 24.10 Audio culling

Aynı anda her distant facility loop'u render edilmez. En yakın/önemli source'lar aktif, uzaklar virtualized/suspended. Colonist footsteps yalnız yakın zoom'da.

## 24.11 Audio asset manifest

Her asset:

- logical id
- source pack/site
- license
- original filename
- edited runtime filename
- loop/one-shot
- usage
- attribution optional/required

Pipeline trim/normalize/compress edilmiş runtime copy üretir; source dosya gameplay bundle'a körlemesine alınmaz.

---

# 25. Erişilebilirlik Standardı

## 25.1 Çok kanallı bilgi

Gameplay-critical state hiçbir zaman yalnız:

- renk,
- ses,
- hareket,
- küçük ikon

ile anlatılmaz. En az iki kanal: renk + ikon/metin; audio + visual alert vb.

## 25.2 Semantic color system

UI raw color değerlerine değil token'lara dayanır:

- success
- warning
- critical
- info
- selection
- disabled

TRUE/FALSE graph path yalnız yeşil/kırmızı değildir; label/line style da farklıdır. Color-blind preset eklenebilir fakat mekanik baştan color-independent olmalıdır.

## 25.3 UI scaling ve typography

Desktop başlangıç scale seçenekleri: 90 / 100 / 110 / 125 / 150% gibi. Exact liste ayarlanabilir. Ana body text genellikle 14-16 CSS px altına itilmez; mobile ~15-16 px readability hedefi. Layout larger text ile kırılmamalıdır.

## 25.4 Touch

Interactive target yaklaşık 44-48 CSS px minimum. Graph port görsel olarak küçük olsa bile hitbox büyütülür.

## 25.5 Reduced Motion

Ayar:

- camera transition daha kısa/sade
- screen shake off
- büyük UI slide/parallax azalır
- pulse/flash sadeleşir

Gameplay animation tamamen kapanmaz; facility working state okunabilir kalır.

## 25.6 Flash ve shake

Yüksek frekanslı kırmızı-beyaz flash yok. Screen Shake: Off / Low / Normal. Kamera player control'ünü event için zorla ele geçirmez.

## 25.7 Critical auto-pause

Accessibility/gameplay setting olarak `Kritik olayda otomatik duraklat`; default kapalı. User açarsa defined Critical severity event'te simulation pause.

## 25.8 Keyboard

Core desktop UI Tab/Shift+Tab/Enter/Escape/Arrow ile kullanılabilir. Suggested shortcuts: Space Pause, 1 ×1, 2 ×2, 4 ×4. Full rebind MVP şartı değildir.

## 25.9 Protocol graph accessibility

MVP'de full screen-reader graph authoring iddiası yok. Ancak selected node properties gerçek HTML form controls'da olmalı; architecture gelecekte `Linear Protocol View` gibi:

```text
1. Gece başladı
2. Energy < %40?
3. Evet → Maden Eco
```

temsiline izin vermelidir. Full accessible graph editing post-MVP enhancement'tır.

---

# 26. Performans ve Kalite Bütçeleri

## 26.1 Frame hedefi

- Desktop modern orta seviye: 60 FPS hedef (~16.7 ms frame).
- Orta segment modern mobile: stabil ≥30 FPS hedef (~33 ms).
- High-end mobile 60 FPS hedeflenebilir fakat şart değildir.

Simulation sonucu FPS'ye bağlı değildir. FPS düşerse simulation tick atlanmaz.

## 26.2 Simulation budget

Warning target:

- Desktop normal tick çoğunlukla <4 ms.
- Mobile normal tick çoğunlukla <8 ms.

×4 hızda uzun backlog oluşmamalı. Dev profiler ölçer; sayılar **TUNABLE warning budget**.

## 26.3 DPR limits

WebGL renderer cihaz DPR'ını kör kullanmaz. Başlangıç quality profile örneği:

- Low ~1.0
- Medium ~1.25-1.5
- High ~1.5-2.0

UI CSS resolution ayrı.

## 26.4 Quality profiles

| Özellik | Low | Medium | High |
|---|---|---|---|
| Shadow | düşük | orta | yüksek |
| Particle | düşük | normal | yoğun |
| Prop visibility | kısa | normal | uzun |
| DPR | düşük | orta | yüksek |
| Post FX | minimum | sınırlı | seçilmiş polish |
| Facility state readability | TAM | TAM | TAM |

Low profile gameplay bilgisini silemez.

## 26.5 Prototype warning budgets

Normal camera view:

- Visible triangles tercihen <250k.
- Draw calls tercihen <150.
- Prototype visible colonists 12-15.
- Büyük realtime light 1 ana directional.
- Büyük particle system 1-2.
- Mobile runtime texture memory prototype hedefi ~100-120 MB; full active planet total asset/GPU warning budget mümkünse ~250-300 MB altında.
- Optimize edilmiş ilk planet required asset download hedefi ~15-20 MB veya altında.

Bunlar hard platform limits değil, regression alarmıdır.

## 26.6 Rendering optimizations

- Frustum culling.
- Repeated props için instancing.
- Distant colonist animation update throttling.
- Small props için shadow casting kapatma.
- Planet manifest based lazy/preload.
- 4K source texture runtime'da downscale/compress.

## 26.7 Browser target

MVP: current Chrome/Edge Chromium, Firefox, Safari; mobile current Chrome Android + Safari iOS. Legacy browser hedeflenmez.

---

# 27. Hazır Asset Pipeline ve Gerçek Paket Eşlemesi

İncelenen dört paket:

1. KayKit Space Base Bits
2. Quaternius Ultimate Space Kit
3. Quaternius Modular SciFi MegaKit (Standard)
4. Quaternius Sci-Fi Essentials Kit (Standard)

Arşivlerdeki license dosyaları CC0 1.0 belirtmektedir. Release öncesi manifest tekrar doğrulanır.

## 27.1 Görsel hiyerarşi

- **KayKit Space Base Bits:** ana COLONY building/terrain dili.
- **Ultimate Space Kit:** büyük silhouette, özel yapı ve biome varyasyonu.
- **Modular SciFi MegaKit:** küçük teknik detay/vent/fan/platform/decals; ana exterior gövde olarak sınırlı.
- **Sci-Fi Essentials:** seçilmiş prop/medical detail; yüksek çözünürlük texture nedeniyle runtime'a kontrollü.

> Bir facility gövdesinin yaklaşık %80-90'ı tek visual family'den gelmeli; paketler “asset showcase” gibi karıştırılmamalıdır.

## 27.2 Gerçek model mapping

| Logical use | Primary asset direction |
|---|---|
| Fusion Reactor | KayKit `basemodule_E` + `structure_tall` + runtime emissive core/FX composite |
| Solar Array | KayKit `solarpanel.gltf`; large variant Ultimate `SolarPanel_Structure.gltf` |
| Battery Bank | KayKit `basemodule_C` + containers/roof cargo composite |
| Oxygen Processor | KayKit base module + vent/fan details; gerektiğinde Modular `Prop_Vent_*`, `Prop_Fan_Small` |
| Oxygen Tank | Simple runtime cylinder/tank geometry + KayKit platform/accessory; zayıf hazır modeli zorla kullanma yok |
| Mine | KayKit `drill_structure.gltf` |
| Material Storage | KayKit `cargodepot_A/B/C` + `cargo_*_stacked` |
| Habitat | KayKit `basemodule_A/B/D` + `tunnel_*` variation |
| Thermal Control | KayKit base module + vent/fan group; selected Modular technical props |
| Shelter | KayKit `basemodule_garage` veya low/fortified base variant |
| Medical | KayKit base module + medical signage/detail; selected Sci-Fi Essentials `Prop_HealthPack*`, furniture/detail only |
| Expansion Slot | KayKit `landingpad_small/large` visual basis uygun |
| Industrial props | KayKit cargo/containers/spacetruck; selected Modular props |
| Terrain | KayKit `terrain_*`, rocks; Ultimate rocks/alien vegetation biome variation |
| Special dome/base | Ultimate `GeodesicDome`, `Base_Large`, `Building_L`, `House_*` |

## 27.3 Asset scale normalization

Paket native scale'ları farklıdır. Runtime `scale=1` varsayılmaz. Registry source bounding box ölçer ve canonical logical footprint'e göre initial scale hesaplar; per-asset correction metadata ile yapılır.

## 27.4 AssetRegistry metadata

```ts
interface AssetDefinition {
  id: string;
  sourcePack: string;
  sourceFile: string;
  sourceBounds: { width: number; height: number; depth: number };
  targetFootprint?: { width: number; depth: number };
  transform?: { scale?: number; rotationY?: number; offset?: Vec3 };
  accessPoints?: AccessPoint[];
  workPoints?: WorkPoint[];
  visualCenter?: Vec3;
  materialProfile?: string;
  shadowProfile?: string;
  visualHooks?: string[];
}
```

Yalnız runtime'da kullanılan assetlere detailed metadata yazılır; yüzlerce unused modele manuel metadata gerekmez.

## 27.5 Art Direction Normalization Layer

Runtime layer gerekirse:

- scale
- roughness
- metalness
- palette/tint
- emissive multiplier
- shadow behavior
- material profile

normalizes. Modelin texture karakteri tamamen silinmez.

Suggested profiles: `colonyWhite`, `industrialDark`, `energy`, `lifeSupport`, `residential`, `hazard`.

## 27.6 Source vs runtime klasörü

```text
/assets-source/
  kaykit-space/
  quaternius-ultimate/
  quaternius-modular/
  quaternius-essentials/

/public/assets/runtime/
  ... yalnız registry/planet manifest'in kullandıkları
```

`assets:build` script'i selected assetleri kopyalar/optimize eder. Bütün ZIP public bundle'a konmaz.

## 27.7 Texture stratejisi

İncelemede KayKit atlası 1024², Ultimate ana atlasları 512²; Modular çoğunlukla 2048², Essentials bazı crate texture'ları 4096² bulundu. 2K/4K source texture'lar web/mobile runtime'a direkt alınmaz; desktop/mobile runtime variant üretilir. Exact 1024/512 gibi downscale playtest'e bağlıdır.

## 27.8 GLTF/GLB

Paketlerde GLTF + BIN + texture doğrudan Three.js ile kullanılabilir. Faz 1'de zorunlu GLB conversion yok. Sonraki optimization pipeline mesh compression / GLB pack yapabilir.

## 27.9 License manifest

Her kullanılan asset için source pack, original file, license, attribution, modification/runtime transform bilgisi kaydedilir. CC0 olsa bile credits'te Kay Lousberg/KayKit ve Quaternius'a teşekkür edilebilir.

## 27.10 Kolonist asset açığı

Ultimate Space Kit animasyonlu Astronaut modelleri prototype pathfinding/animation için uygundur fakat antropomorfik hayvan tasarımları final ciddi koloni tonuna tam uymaz. Faz 1'de `prototype_astronaut` placeholder olarak kullanılabilir. Final için stil uyumlu low-poly insan/kapalı kasklı kolonist seti **DEFERRED açık asset ihtiyacı**dır; gameplay architecture modelden bağımsız olmalıdır.

---

# 28. ColonyVisualPrototype - Faz 1 Kalite Kapısı

Amaç tam oyun yapmak değil, şu soruyu cevaplamaktır: hazır asset + R3F + fixed 2.5D camera ile yayınlanabilir, canlı ve okunabilir dünya yapılabiliyor mu?

## 28.1 Prototype sahnesi

NIVALIS-benzeri frozen test map tercih edilir; görsel olarak zorlu contrast/fog/snow/night durumlarını test eder.

Hedef:

- 6 facility: Reactor, Solar, Battery, Mine, Habitat, Oxygen Processor.
- 12-15 colonist.
- 3-5 road connection.
- 1 Expansion platform.
- 10-20 large environment props.
- 30-60 small decor.
- Snow effect.
- Day/night debug slider.
- Fixed orthographic camera, pan/zoom/focus.
- Real assetler; greybox yalnız ilk layout saatlerinde.

## 28.2 Prototype simulation

Full Simulation Engine yok. Dev Debug State renderer'a authoritative mock state verir. Production renderer API daha sonra gerçek engine state'iyle aynı olmalıdır.

```text
PROTOTYPE: DebugState → WorldRenderer
FINAL:     SimulationEngine → WorldRenderer
```

## 28.3 Facility state tests

Reactor Normal/Boost/Interlocked/Maintenance; Mine Working/Offline/Maintenance; Solar day/night; Battery charge/discharge indicator; Oxygen processing activity; Habitat sakin occupied state.

## 28.4 Camera/UI safe mask test

Full HUD yapılmasa da fake right panel ~360px, bottom nav ve mobile bottom sheet safe areas test edilir. Focus algorithm ilk günden safe viewport kullanır.

## 28.5 Character prototype

Navigation graph + A*. State flow:

`Resting → Assigned → WalkingToFacility → Working → WalkingToHabitat → Resting`

Maintenance worker outdoor work point'e gider. Random decor wandering core behavior değildir.

## 28.6 Developer debug panel

Prototype-only:

- time slider
- snow/fog
- Reactor states
- Mine states
- colonist count 5/10/15/25/50
- camera presets
- quality Low/Medium/High
- FPS/frame/draw calls/triangles/textures/geometries/particles

## 28.7 Görsel acceptance criteria

Faz 1 geçmezse Faz 2'ye sırf roadmap için geçilmez. Geçiş için:

1. KayKit + selected Quaternius tek oyuna ait görünür.
2. Facility ve colonist movement fixed camera'da okunur.
3. Statik asset diorama değil çalışan colony hissi verir.
4. Normal/Boost/Offline/Maintenance/Interlocked qualitative olarak dünyadan ayrılır.
5. Desktop/touch pan-zoom-focus doğal çalışır.
6. Desktop ~60 FPS, hedef mobile ≥30 FPS civarında stabil prototype.
7. Yeni GLTF registry'ye hack'siz eklenir.

Ek kalite testleri: day/night screenshots, snow, mobile portrait/landscape ve 5-second readability test.

---

# 29. Veri Odaklı İçerik Mimarisi

## 29.1 Motor ile içerik sınırı

Oyun motoru genel fizik ve sistem kurallarını bilir; gezegen dosyası başlangıç state'i, hangi facility'lerin bulunduğu, event profile, objectives, unlock/capability ve presentation parametrelerini tanımlar. Planet JSON bir “magic root problem” flag'iyle özel davranış yaratmaz. Kök problem mevcut state ve sayılardan **emergent** olarak doğar.

## 29.2 Dosya katmanları

Önerilen ayrım:

```text
content/
  facilities/
    fusion_reactor.json
    solar_array.json
    ...
  events/
    ...
  planets/
    helios-4/
      planet.json
      planet.layout.json
      planet.design.json       # DEV-ONLY, public build'e girmez
      referenceProtocols/      # DEV-ONLY regression
  sectors/
    sector-1.json
  localization/
    tr.json
```

## 29.3 `planet.json`

Oyunda kullanılabilecek declarative data:

- identity/localization keys
- environment profile
- facilities and instance overrides
- resources/capacities
- population/workforce
- event profile
- sensors/actions availability
- expansion options
- mission objectives
- sustainability cycle
- collapse conditions
- layout seed/profile/ref
- tutorial flags

Arbitrary JS/function/formula string çalıştırılmaz. Declared formula types ve catalog references kullanılır.

## 29.4 `planet.design.json` DEV-ONLY

- root problem explanation
- teaching purpose
- expected solution families
- likely partial/wrong solutions
- design difficulty axes
- reference protocol IDs
- acceptance assertions
- design notes

Player build'e girmez; spoiler sızıntısı önlenir.

## 29.5 Central catalogs

Facility davranış logic'i planet dosyasına kopyalanmaz. Planet `type: fusionReactor` referansı verir ve instance override kullanır. Event için aynı principle.

## 29.6 Localization

Player-facing ilk release Türkçedir. Bütün stringler localization key üzerinden gelir. Dev/internal English property names kullanılabilir. `Worldrive` gibi özel şirket adı bu projede ilgili değil; Gözlemci terminolojisi Türkçe UI standardına göre yazılır.

## 29.7 Validation

TypeScript + Zod önerilir. Build/dev startup'ta schema validation fail-fast. Unknown facility/event/sensor/action references, missing localization key, invalid objective range, incompatible expansion footprint vb. Developer Tools Planet Validator ile ayrıca gameplay validation görür.

---

# 30. Standart Gezegen Tasarım Şablonu - 17 Zorunlu Alan

Her gerçek planet aşağıdaki alanlarla tasarlanır:

1. Gezegen kimliği
2. Başlangıç / Varış Durum Raporu
3. Gerçek kök problem (DEV-ONLY)
4. Başlangıç tesisleri
5. Başlangıç sistem durumu
6. Population / Workforce
7. Event Profile
8. Predictability
9. Kullanılabilir Trigger/Data
10. Kullanılabilir Commands
11. Expansion Slots
12. Beklenen geçerli çözüm aileleri
13. Mantıklı fakat eksik/yanlış çözümler
14. Mission Success Conditions
15. Sustainability Verification
16. Collapse Conditions
17. Tasarım / Öğretim Amacı

Ek kalite kontrolleri:

- Problem available data ile teşhis edilebilir mi?
- Oyuncuya root cause text olarak verilmiş mi? Verilmemeli.
- Normal planet mümkünse ≥2 meaningful solution family destekliyor mu?
- Expansion tek zorunlu answer mı? Olmamalı.
- Event ciddi failure yaratabiliyorsa hazırlık/uyarı yeterli mi?
- Mission koşulları tüm üretimi kapatma gibi trivial exploit'i engelliyor mu?
- Node unlock/free sector order nedeniyle prerequisite bilgi varsayılıyor mu?
- Reference solutions seed/stress test'te hâlâ çalışıyor mu?

---

# 31. Zorluk Eğrisi ve Beş Sektörlük Bilişsel İlerleme

Zorluk sayıları yalnız büyüterek artmaz. Altı eksen:

- Cause depth
- Simultaneity
- Ambiguity
- Time pressure
- Capacity margin
- System interaction

Dev-only 1-5 difficulty budget kullanılabilir; tüm eksenleri aynı anda max yapmak gerekmez.

Sektör temaları:

- **S1 - Sistemi Anlamak:** “Ne oluyor?”
- **S2 - Zamanı ve Hazırlığı Yönetmek:** “Ne olacak ve nasıl hazırlanırım?”
- **S3 - Sistemler Birbirini Etkiliyor:** “Gerçek neden nerede?”
- **S4 - Güvenlik ve Çatışan Öncelikler**
- **S5 - Gözlemci Ustalığı**

İlerleyen sector'larda information saklanarak zorluk yaratılmaz; causal reasoning karmaşıklaşır. New node sektördeki tek solution key değildir.

---

# 32. Sector 1 - Kanonik Yapı

Sector 1 toplam 6 içerik:

| Gezegen | Statü / Ana ders |
|---|---|
| HELIOS-4 | Zorunlu ilk gezegen; basic protocol, gece enerji açığı, Action persistence |
| NIVALIS-3 | Energy ↔ Thermal ↔ Habitat; semptom/kök neden ayrımı |
| MOROS-2 | Workforce + Maintenance + Material; priority ve bakım borcu |
| AURELIA-6 | Solar + Battery Reserve + forecast hazırlığı + ilk Expansion Slot |
| KEPLER-17B | Oxygen reserve + trend sürdürülebilirliği |
| ORPHEUS STATION | Sector sınaması; local olarak mantıklı protocol'lerin birlikte kötü sistem üretmesi |

HELIOS sonrası dört normal gezegen birbirinin bilgisini prerequisite kabul etmez. ORPHEUS HELIOS + herhangi iki gezegen sonrası açılabildiği için AURELIA/MOROS/NIVALIS/KEPLER'ın özel mekaniğini zorunlu solution olarak varsayamaz.

Medical Module ve Shelter Sector 1 ana öğretim içeriğinde kullanılmaz; ileri security sector'ına bırakılır.

---

# 33. HELIOS-4 - Tam Gezegen Spesifikasyonu

## 33.1 Kimlik

**Type:** küçük güneş enerjili madencilik kolonisi.  
**Sector:** 1.  
**Campaign role:** zorunlu onboarding.  
**Ana soru:** “Sistem neden her gece aynı sorunu yaşıyor?”  
**Layout:** Compact, açık ve okunabilir; karmaşık topoğrafya yok.

## 33.2 Varış Durum Raporu

Player-facing metin semptomu anlatır:

> Son beş gece döngüsünde koloni Energy rezervi kritik seviyelere düştü. Kesintiler sırasında endüstriyel faaliyetler durdu ve yaşam destek kapasitesi geçici olarak azaldı. Güneş doğduktan sonra sistemler normal çalışma durumuna geri dönüyor. Kalıcı altyapı veya nüfus kaybı kaydedilmedi. Görev: tekrar eden gece kesintilerini ortadan kaldır ve sürdürülebilir operasyonu yeniden sağla.

“Maden geceleri fazla Energy tüketiyor” denmez.

## 33.3 Gerçek kök problem - DEV-ONLY

Toplam günlük Solar üretimi yeterli, fakat production/consumption zaman eşleşmesi yanlış. Gündüz Solar surplus Battery'yi doldurur; gece Solar=0 iken Habitat + Oxygen Processor + Mine Normal yükü Battery'nin tüm gece sürdürülebilir capacity'sinden fazladır.

Causal chain:

```text
Night → Solar 0 → Battery discharge → Reserve critical
→ local protection / load loss → Mine stops → O2 production pressure
→ sunrise → recovery → next night repeats
```

## 33.4 Başlangıç tesisleri

- 2 Solar Array
- 1 Battery Bank
- 1 Oxygen Processor
- 1 Oxygen Reserve Tank
- 1 Mine
- 1 Material Storage
- 1 Habitat

Fusion Reactor yok; ilk planet enerji problemine Reactor Thermal/Ramp complexity eklemez.

## 33.5 Başlangıç sistem durumu

Invariant:

- Gündüz Solar instantaneous output consumption'dan yüksek.
- Battery doğru koşulda dolabilir.
- Full normal night load Battery capacity'den büyük.
- Critical systems + reduced industrial load ile night güvenli tamamlanır.

Amaç “daha fazla enerji üret” değil, mevcut enerjiyi zaman içinde daha akıllı yönetmektir.

## 33.6 Population / Workforce

Baseline Population 20. Workforce yeterlidir; başlangıç problemi Workforce değildir. Yaralı yok, ciddi maintenance debt yok. Workforce görünür fakat tutorial root cause'ı bozmaz.

## 33.7 Event Profile

Yalnız düzenli Day/Night. Meteor/fırtına/technical RNG yok.

## 33.8 Predictability

Sunrise/sunset ve local time tam görünür. Başarısızlık tamamen açıklanabilir.

## 33.9 Trigger/Data

- NightStarted
- DayStarted
- EnergyReserve threshold crossing
- OxygenReserve threshold crossing
- EnergyReserve/Production/Consumption/NetTrend
- SolarOutput
- OxygenReserve/Trend
- MineMode/EnergyConsumption
- OxygenProcessorMode/Output

S1 logic: Compare, AND, Delay mevcut; hepsi solution için zorunlu değildir.

## 33.10 Commands

Mine Eco/Normal/Boost/Standby; Oxygen Processor Eco/Normal/Boost/Standby; Battery local auto behavior. Advanced MinimumReserve AURELIA'nın ana dersi olduğu için HELIOS tutorial bunu öne çıkarmaz. Solar auto produces.

## 33.11 Expansion

0 slot. Oyuncu ikinci Battery ile teşhisi bypass etmez.

## 33.12 Geçerli çözüm aileleri

**A - Time-based:** Night → Mine Eco; Day → Mine Normal.  
**B - State-based:** Energy < X → Mine Eco; Energy > Y → Mine Normal.  
**C - Mixed load management:** Mine reduction + yeterli Oxygen reserve varken Oxygen Processor Eco, gündüz recovery.

## 33.13 Eksik/yanlış fakat mantıklı çözümler

- Mine sürekli Eco: Energy çözülür, Material objective düşer; persistent Action dersi.
- Mine sürekli Standby: güvenli fakat koloni işlevsiz.
- Yalnız Oxygen Processor kısma: kısa süre taşır, reserve trend yeni crisis yaratabilir.
- Solar gece daha fazla üret komutu: fiziksel olarak mümkün değil; Debugger irradiance 0 açıklar.

## 33.14 Mission Success

- Critical Energy interruption yok.
- Minimum Material production korunur.
- Oxygen reserve critical region'e düşmez.

Universal Health threshold yok.

## 33.15 Sustainability

1 operational cycle = full local day/night. **2 consecutive successful cycles**.

## 33.16 Collapse

Battery empty veya Mine stop tek başına collapse değildir. Long duration unsustainable Oxygen/life support ancak collapse yaratabilir; başlangıç buffer'ları oyuncuya recovery zamanı verir.

## 33.17 Teaching purpose

- COLONY'den symptom fark et.
- Trend/panel oku.
- Debugger causal chain incele.
- Trigger → Condition → Action kur.
- Action persistent olduğunu sonuçtan öğren.
- Üretimi sonsuza kadar kapatmanın başarı olmadığını gör.
- Tek solution olmadığını fark et.
- Sustainability cycles bekle.

HELIOS sonunda hedef duygu: “Tutorial yaptım” değil, “Gece neden çöktüğünü buldum ve artık kendi kendine çalışıyor.”

---

# 34. NIVALIS-3 - Tam Gezegen Spesifikasyonu

## 34.1 Kimlik

Frozen mining colony. Ana sistem Energy ↔ Thermal Control ↔ Habitat. Ana soru: **“Sorun görüldüğü yerde mi başlıyor?”**

## 34.2 Varış Raporu

> Son operasyon döngülerinde gece saatlerinde Habitat sıcaklıkları güvenli çalışma aralığının altına düştü. Termal Kontrol sistemi düşük sıcaklıklarda kapasitesini artırıyor ancak bazı döngülerde hedef sıcaklık korunamıyor. Kısa süreli endüstriyel duruşlar ve çalışan veriminde düşüş kaydedildi. Kalıcı nüfus kaybı bulunmuyor.

“Energy yetmiyor” denmez.

## 34.3 Root problem - DEV-ONLY

Night cold → Thermal Demand artar → Thermal Control daha fazla Energy ister → total load Reactor Normal capacity'yi aşar → reserve erir / thermal capacity kısıtlanır → Habitat temperature düşer. Semptom Habitat'ta, neden capacity competition'dadır.

## 34.4 Facilities

- 1 Fusion Reactor
- 1 Battery
- 1 Thermal Control
- 1 Oxygen Processor
- 1 Oxygen Tank
- 1 Mine
- 1 Material Storage
- 2 Habitat

Reactor sağlıklı başlar; problem arızalı Reactor değildir.

## 34.5 Initial state

Normal temperature'da Energy margin yeterli. En soğuk gece bölümünde tüm systems Normal ise margin yetersiz. Thermal + life support korunup Mine azaltılırsa yeterli. Reactor Boost alternatif ama wear/Thermal Load bedelli.

## 34.6 Population / Workforce

Yeterli. Workforce ana puzzle değil.

## 34.7 Event Profile

Regular Night Cold / temperature curve. RNG storm yok.

## 34.8 Predictability

Outside temperature curve ve trend gözlenebilir; oyuncuya threshold solution verilmez.

## 34.9 Trigger/Data

OutsideTemperature, HabitatTemperature, ThermalDemand, ThermalCapacity, EnergyReserve/Trend, MineMode, ReactorMode, ReactorThermalLoad.

## 34.10 Commands

Mine modes, Thermal modes, Reactor modes, Habitat TemperatureTarget, Work/Maintenance/Energy priorities.

## 34.11 Expansion

0.

## 34.12 Valid solution families

- Cold threshold → Thermal Boost; Energy low + cold → Mine Eco.
- Habitat temperature feedback → Thermal Boost + energy-aware load reduction.
- Controlled Reactor Boost during cold, then Normal recovery.

## 34.13 Partial/wrong

- Habitat target'ı gereksiz yükseltmek demand'i büyütür.
- Thermal sürekli Boost: Energy/Condition debt.
- Mine sürekli off: Material objective fail.
- Reactor sürekli Boost: mission geçebilir fakat poor efficiency/wear ve interlock risk.

## 34.14 Success

Habitat critical temperature'a düşmez; critical Energy interruption yok; minimum Material output korunur; 2 cycles sustainable.

## 34.15 Sustainability

Full thermal day/night cycle; 2 consecutive.

## 34.16 Collapse

Short cold exposure collapse değil. Habitat uzun süre uninhabitable + life support unrecoverable ise collapse.

## 34.17 Teaching

Semptom/kök neden ayrımı; bir sistemin demand artışının başka sistemde semptom yaratması.

---

# 35. MOROS-2 - Tam Gezegen Spesifikasyonu

## 35.1 Kimlik

Intensive mining colony. Ana: Workforce + Maintenance + Material. Soru: **“Kaynak varken neden bakım yapılamıyor?”**

## 35.2 Varış Raporu

> Son operasyon döngülerinde üretim tesislerinde bakım gecikmeleri ve kısa hizmet kesintileri arttı. Koloninin Material rezervi kritik seviyede değil. Bazı bakım talepleri uzun süre bekliyor. Üretim hedefleri halen karşılanıyor ancak sistem güvenilirliği düşüyor.

## 35.3 Root problem - DEV-ONLY

İki Mine yüksek WorkPriority ile tüm active workforce'u tüketir. Maintenance queue Material olduğu halde crew bulamaz. Condition düşer → capacity düşer → daha uzun çalışma → daha fazla wear/maintenance pressure. Sorun Material shortage değil, Workforce allocation.

## 35.4 Facilities

- 1 Reactor
- 1 Battery
- 2 Mine
- 1 Material Storage
- 1 Oxygen Processor
- 1 Oxygen Tank
- 1 Habitat

Energy rahat margin.

## 35.5 Initial state

Material repair için yeterli. Mine-1/2 ve Oxygen farklı Condition seviyelerinde. Workforce full utilized.

## 35.6 Population / Workforce

Ana puzzle. Baseline Active Workforce 11:

- Reactor 3
- Oxygen 2
- Mine-1 3
- Mine-2 3

Free = 0. Mine maintenance 2 worker ister. Player üretim/work priority'yi değiştirerek capacity açmalıdır.

## 35.7 Event Profile

External event yok; deterministic usage wear/shift.

## 35.8 Predictability

Condition/MaintenanceNeed açık; random failure yok.

## 35.9 Trigger/Data

FacilityCondition, MaintenanceNeed, AvailableWorkforce, AssignedWorkforce, MaterialReserve, MineOutput, FacilityStatus.

## 35.10 Commands

WorkPriority, MaintenancePriority, Mine modes; standard Reactor/Oxygen actions.

## 35.11 Expansion

0.

## 35.12 Valid solution families

- Condition < X → MaintenancePriority High + ilgili Mine WorkPriority azalt.
- AvailableWorkforce < X AND MaintenanceNeed → Mine-2 Eco.
- Mines alternating operation/maintenance.

## 35.13 Partial/wrong

- MaintenancePriority sürekli Critical: production crew'yu aşırı çeker.
- Tüm Mine off: maintenance çözülür, mission production fail.
- Boost ile production telafisi: wear loop büyür.

## 35.14 Success

Critical maintenance queue kalmamalı; critical facility Failed olmamalı; minimum Material output; Workforce chronic unsustainable emergency pressure'da olmamalı.

## 35.15 Sustainability

2 full operational cycles; yalnız instant repair yetmez, queue yeniden oluşmamalı.

## 35.16 Collapse

Mine failure collapse değil. Life support / main power uzun maintenance neglect ile unrecoverable olursa mümkün.

## 35.17 Teaching

Workforce dördüncü resource değildir; priority ile dağıtılan capacity. Maintenance yalnız Material değil, doğru zamanda Workforce + downtime gerektirir.

---

# 36. AURELIA-6 - Tam Gezegen Spesifikasyonu

## 36.1 Kimlik

Solar-heavy colony. Ana: Battery reserve + forecastable production loss. Soru: **“Rezerv yalnız kriz başladığında mı önemlidir?”**

## 36.2 Varış Raporu

> Koloni gündüz saatlerinde ihtiyacından fazla Energy üretiyor. Buna rağmen düzenli orbital gölgelenme dönemlerinde Energy rezervi kritik seviyeye düşüyor. Gölgelenme zamanları önceden hesaplanabiliyor. Son üç olayın ikisinde endüstriyel sistemler geçici olarak devre dışı kaldı.

## 36.3 Root problem - DEV-ONLY

Normal solar surplus yeterli; düşük MinimumReserve/yoğun gündüz tüketimi Battery'yi forecasted shadow öncesi yeterli seviyede tutmuyor. Orbital Shadow başlayınca Solar düşer ve buffer yetersiz kalır.

## 36.4 Facilities

- 3 Solar Array
- 2 Battery
- 1 Oxygen Processor
- 1 Oxygen Tank
- 1 Mine
- 1 Habitat
- 1 Material Storage

Reactor yok.

## 36.5 Initial state

Solar capacity fazla; Battery total capacity doğru yönetilirse event'i karşılar. Problem capacity shortage değil reserve policy.

## 36.6 Workforce

Yeterli ve secondary.

## 36.7 Event Profile

Orbital Shadow: Forecast → Approaching → Active → Ended.

## 36.8 Predictability

Tam forecast; ör. “2 sim saat 15 dk sonra”. Solution threshold söylenmez.

## 36.9 Trigger/Data

ShadowWarning/Started/Ended, BatteryReserve, SolarOutput, EnergyNetTrend, MineEnergyUse.

## 36.10 Commands

Battery MinimumReserve ana yeni control; Mine modes; normal life support actions.

## 36.11 Expansion

1 slot. Options:

- Battery Bank
- Solar Array
- Oxygen Tank

Hiçbiri mandatory değildir. Battery daha fazla buffer, Solar faster recovery, Oxygen Tank Energy shortage sırasında O2 production azaltma alternate resilience sağlar.

## 36.12 Valid solutions

- Warning → MinimumReserve yükselt; event sonrası normale getir.
- Shadow Started → Mine Eco.
- Reserve + light load shedding mix.

## 36.13 Partial/wrong

- Yeni Battery build + policy yok: problemi yalnız geciktirebilir.
- Solar build: shadow bütün soları etkiliyorsa active event'te tek başına çözmez.
- Reserve'i sürekli aşırı yüksek tutmak normal operasyon efficiency'yi düşürebilir.

## 36.14 Success

Shadow sırasında critical Energy interruption yok; event sonrası reserve sustainable seviyeye recover; min industrial output; Oxygen safe.

## 36.15 Sustainability

1 operational cycle = Orbital Shadow çevrimi. 2 successful cycles.

## 36.16 Collapse

Bir shadow'da Energy empty collapse değil; prolonged life support loss gerekir.

## 36.17 Teaching

Storage capacity ile reserve policy ayrımı; forecast başlamadan hazırlık; Expansion çözüm düğmesi değildir.

---

# 37. KEPLER-17B - Tam Gezegen Spesifikasyonu

## 37.1 Kimlik

Life-support margin colony. Ana: Oxygen reserve + net trend. Soru: **“Rezerv yüksekse sistem gerçekten güvenli midir?”**

## 37.2 Varış Raporu

> Oxygen rezervi halen güvenli seviyede görünmektedir. Ancak son operasyon döngülerinde rezerv her döngü sonunda öncekinden daha düşük kapanmıştır. Mevcut üretim sistemi çalışır durumdadır ve kayıtlı büyük arıza bulunmamaktadır.

## 37.3 Root problem - DEV-ONLY

Population yakın zamanda capacity'ye yaklaşmıştır. Oxygen Processor Normal output ortalama consumption'ın biraz altında; yüksek stok yavaş negatif trend'i maskeler.

## 37.4 Facilities

- 1 Reactor
- 1 Battery
- 1 Oxygen Processor
- 2 Oxygen Tank
- 2 Habitat
- 1 Mine
- 1 Material Storage

## 37.5 Initial state

Oxygen high reserve + negative trend. Energy adequate but not infinite.

## 37.6 Workforce

Yeterli. Boost daha fazla Workforce isteyebilir ancak root cause değildir.

## 37.7 Event Profile

Büyük dış event yok. Constant Population Oxygen demand baskıdır.

## 37.8 Predictability

Deterministic trend. HUD/detail `Oxygen 74% ↓` gibi açık.

## 37.9 Trigger/Data

OxygenReserve, OxygenTrend, ProcessorOutput, PopulationConsumption, EnergyReserve, ProcessorCondition.

## 37.10 Commands

Oxygen Processor Eco/Normal/Boost, priorities.

## 37.11 Expansion

0. Daha büyük tank ile negative trend'i maskeləmə çözümünü teşvik etmez.

## 37.12 Valid solutions

- Reserve < X → Boost; Reserve > Y → Normal.
- Continuous Boost mission açısından çalışabilir ancak wear/Efficiency daha kötü olabilir.
- Energy-aware Oxygen Boost koşulu.

## 37.13 Partial/wrong

- High tank level'e güvenmek: yalnız geciktirir.
- Continuous Eco: trend kötüleşir.
- Boost/Normal eşikleri çok yakın: mode thrashing, Stability/Control Consistency düşer.

## 37.14 Success

Oxygen critical değil; cycle-end trend sustainable/non-negative; Processor Critical Condition'a itilmez; diğer minimum operations korunur.

## 37.15 Sustainability

3 operational cycles; yavaş trend probleminde 2 cycle yanıltıcı olabilir.

## 37.16 Collapse

Short critical state recoverable; prolonged unsustainable Population oxygen support collapse.

## 37.17 Teaching

Stock snapshot ile sustainability farkı; trend okuma; threshold band'larını iyi seçme.

---

# 38. ORPHEUS STATION - Sector 1 Sınaması

## 38.1 Kimlik

Eski inter-colony logistics/transfer station. Yeni node veya temel mechanic öğretmez. Ana soru: **“Tek tek mantıklı sistemler birlikte baskı altında hâlâ dengeli mi?”**

## 38.2 Varış Raporu

> Temel sistemler çalışır durumda ancak operasyon güvenilirliği düşüktür. Son döngülerde gece Energy rezerv kaybı, Oxygen üretim dalgalanmaları ve kargo üretim kesintileri birlikte kaydedildi. Tekil sistemler kritik arızalı görünmemektedir. Koloni kendi kendine sürdürülebilir çalışma düzenini koruyamıyor.

## 38.3 Root problem - DEV-ONLY

Tek gizli broken facility yok. Birden fazla makul local policy aynı anda oscillation yaratır. Örnek: night Solar↓; Mines normal; Oxygen reserve düşükken Processor Boost; Energy spike; Battery↓; Mine Eco protocol tetiklenir; reserve recover; Mine Normal; O2 hâlâ Boost; Energy tekrar↓. Sistem salınır.

## 38.4 Facilities

- 2 Solar Array
- 1 Reactor
- 2 Battery
- 1 Oxygen Processor
- 1 Oxygen Tank
- 2 Mine
- 1 Material Storage
- 2 Habitat

Thermal/Medical/Shelter gibi opsiyonel planet dersleri zorunlu değildir.

## 38.5 Initial state

Hiçbir facility Failed değil; kaynaklar critical başlamaz; margins dar, inspection zamanı var.

## 38.6 Workforce

Available ve meaningful ama main puzzle değil; çözüm WorkPriority bilgisine bağımlı olmamalı.

## 38.7 Event Profile

Day/night + optional fully predictable low irradiance period. Surprise RNG yok.

## 38.8 Predictability

Information açık; zorluk hidden info'dan değil interaction'dan.

## 38.9 Trigger/Data

S1 common set: Day/Night, EnergyReserve, OxygenReserve, trends, facility modes, Compare, AND, Delay.

## 38.10 Commands

Reactor/Mine/Oxygen modes, Battery reserve, standard priorities. Hepsini kullanmak zorunlu değil.

## 38.11 Expansion

0. Sector exam elindeki sistemi düzeltmeyi sınar.

## 38.12 Valid solution families

- Time-based coordinated load policy.
- Resource-state based multi-condition policy.
- Reactor capacity ile industrial production yüksek tutan aggressive fakat wear-aware policy.

Muhafazakâr/dengeli/agresif çözüm olabilir.

## 38.13 Partial/wrong

- Energy threshold'ları çok yakın → Mine Eco/Normal oscillation.
- O2 low → Processor Boost, Energy state gözetilmez → energy crisis büyür.
- Her protocol tek başına doğru görünür ancak birlikte conflict/oscillation üretir.

## 38.14 Success

Critical Energy interruption yok; Oxygen safe; minimum Material; chronic mode oscillation/conflict yok; birkaç cycle sustainable.

## 38.15 Sustainability

3 consecutive full operational cycles.

## 38.16 Collapse

Normal Sector 1 recovery philosophy. Wrong protocol instant game-over yapmaz.

## 38.17 Teaching/exam

Yeni bilgi değil: “Artık yalnız tek problemi değil, birlikte çalışan sistemi okuyabiliyor musun?” ORPHEUS tamamlanınca Sector 2 açılır.

---

# 39. Balance Baseline v0.1

Bu bölüm başlangıç tuning değerlerini tanımlar. **Rakamlar TUNABLE**, ancak ürettikleri ilişkiler/invariant'lar kanoniktir. Engine sayı hard-code etmez; config/catalog verisinden okur.

## 39.1 Facility nominal rate baseline

Birimler abstract `/ sim saat`.

| Tesis / değer | Eco | Normal | Boost |
|---|---:|---:|---:|
| Fusion Reactor Energy output | 55 | 80 | 110 |
| Mine Material output | 6 | 12 | 18 |
| Mine Energy consumption | 8 | 18 | 30 |
| Oxygen Processor output | 15 | 25 | 35 |
| Oxygen Processor Energy consumption | 6 | 10 | 16 |
| Thermal Control capacity | 25 | 45 | 70 |
| Thermal Control Energy consumption | 8 | 18 | 32 |

Solar Array HELIOS baseline nominal = 45 Energy/sim saat tam irradiance.

## 39.2 Storage/capacity baseline

- Battery Bank: 360 Energy.
- Oxygen Tank: 240 Oxygen.
- Material Storage: 500 Material.
- Habitat: 24 Population capacity.

Planet/facility instance `capacityMultiplier` veya explicit rated override kullanabilir.

## 39.3 Population Oxygen

1 colonist = 1 Oxygen / sim saat. Örn. 20 population = 20/h.

## 39.4 Workforce

| Facility | Min | Nominal | Boost |
|---|---:|---:|---:|
| Reactor | 2 | 3 | 4 |
| Mine | 1 | 3 | 3 |
| Oxygen Processor | 1 | 2 | 3 |
| Thermal Control | 1 | 2 | 3 |

Minimum crew yaklaşık %60 capacity başlangıç target; minimum→nominal arası lineer yaklaşım uygun. Nominal üstü rastgele bonus yok.

## 39.5 Resource HUD warning baseline

| Resource | Low | Critical |
|---|---:|---:|
| Energy | <30% | <15% |
| Oxygen | <35% | <20% |
| Material | <20% capacity | <8% capacity |

Planet mission threshold bunlardan bağımsız override olabilir.

## 39.6 HELIOS numeric baseline

Day = 14 sim saat, night = 10.

Solar: 2 × 45 = 90/h day.

Normal load example:

- Habitat 10
- Oxygen Processor Normal 10
- Mine Normal 18
- Total 38/h

Day surplus = 52/h. Night full load = 38 × 10 = 380; Battery 360 → yetmez.

Mine Eco night:

- Habitat 10
- Oxygen 10
- Mine Eco 8
- Total 28/h
- Night use = 280 → Battery'de 80 kalır.

Material production ideal time policy:

- 14h Normal ×12 = 168
- 10h Eco ×6 = 60
- Total 228/day

Continuous Eco = 144/day. Mission baseline Material target ≈190/cycle; böylece day Normal + night Eco success, continuous Eco fail.

Oxygen with Population 20:

- Processor Normal 25 → net +5/h.
- Eco 15 → net -5/h.
- 10h night Eco = -50; 14h day Normal = +70. Mixed O2 load management long-term possible.

**HELIOS invariant:** full night normal load > battery capacity; optimized night load < capacity.

## 39.7 NIVALIS numeric baseline

Planet Reactor rated Normal ≈72 (global 80'in instance rating/override'ı). Example normal loads:

- 2 Habitat 20
- O2 Processor 10
- Mine 18
- Thermal Normal 18
- Total 66 → +6 margin.

Cold Thermal Boost 18→32 → total 80; Reactor Normal 72 → -8/h. Battery instance capacity ≈120.

Mine Eco 18→8 → total 70; Reactor 72 → +2. Alternate solution Reactor Boost.

Thermal: Normal 45; Boost 70. Day demand ~35-40; cold night peak ~55-60. Heavy capacity deficit temperature drift başlangıç ~1-2°C/sim hour.

**NIVALIS invariant:** normal conditions sustainable; cold creates capacity conflict; either industrial load reduction or controlled extra generation resolves.

## 39.8 MOROS numeric baseline

Active Workforce = 11. Demands: Reactor3 + O2 2 + Mine1 3 + Mine2 3 = 11; available 0. Mine maintenance requires 2 workers. Material available.

Starting Condition example:

- Reactor 82
- Oxygen 68
- Mine-1 58
- Mine-2 46

Root cause workforce allocation, not Material/Energy.

## 39.9 Event difficulty guideline

Typical prepared-colony buffer pressure guideline:

- Light <25%
- Medium ~25-50%
- Heavy ~50-80%

Not universal formula; prevents artificial impossible numeric wall.

## 39.10 Config rule

No magic numbers inside simulation branches. Example:

```ts
const mineBalance = {
  energyUse: { eco: 8, normal: 18, boost: 30 },
  materialOutput: { eco: 6, normal: 12, boost: 18 }
};
```

Value changes require scenario regression tests.

---

# 40. MVP Kapsamı - İlk Gerçek Oynanabilir Sürüm

MVP “küçültülmüş bütün oyun” değil, core fantasy'yi kanıtlayan vertical slice'tır.

## 40.1 Gezegenler

Yalnız:

1. HELIOS-4
2. NIVALIS-3
3. MOROS-2

AURELIA, KEPLER, ORPHEUS ve Sector 2+ MVP sonrası.

## 40.2 MVP facility seti

9 type:

- Solar Array
- Battery Bank
- Fusion Reactor
- Oxygen Processor
- Oxygen Tank
- Mine
- Material Storage
- Habitat
- Thermal Control

Shelter ve Medical tasarlanmıştır fakat MVP dışı. Böylece injury/evacuation/treatment systems da MVP dışı.

## 40.3 MVP resources

Energy, Oxygen, Material - tam core set.

## 40.4 MVP Workforce

Available, Working, Resting ve maintenance task representation. Injury/Evacuation yok.

## 40.5 MVP Maintenance

Condition, wear, Healthy/Worn/Critical/Failed, MaintenanceNeed/Priority, Material + Workforce + time. Farklı overhaul/repair subtype yok.

## 40.6 MVP facility modes

- Reactor Eco/Normal/Boost.
- Mine Eco/Normal/Boost.
- Oxygen Processor Eco/Normal/Boost.
- Thermal Control Eco/Normal/Boost.
- Solar basic Production; Protection mode UI gerekmez.
- Battery auto charge/discharge + gerekli planet'te reserve control extension mevcut olsa da AURELIA dersi MVP sonrası.
- Storage passive.
- Habitat basic state; advanced conservation gerekmez.

## 40.7 MVP node subset

General:

- Compare
- AND
- Delay

Plus content capabilities: Trigger, Sensor/Data, Action.

OR/NOT/Timer/Cooldown/Counter/Splitter runtime architecture'ı geleceğe açık olmalı ancak MVP UI/content'e girmek zorunda değil.

## 40.8 MVP Protocol özellikleri

Mutlaka:

- Manager
- Draft/Active/Disabled
- Priority
- React Flow editor
- connection/type validation
- draft→validate→apply
- persistent actions
- threshold crossing
- safety interlock result
- Applied/Blocked/Failed/Delayed
- conflict semantics
- execution trace

## 40.9 MVP Debugger

Meaningful timeline, selected event detail, causal chain, condition values, action outcome, protocol/facility jump. Advanced analytics/filter extravaganza gerekmez.

## 40.10 MVP Health/Assessment

Dört Health boyutu + geometric mean + Mission/Sustainability ayrı. Injury yokken Safety critical infrastructure, interlock, life-support risk gibi mevcut data ile hesaplanır.

## 40.11 MVP world

Real 2.5D colony, colonist walking/working/rest/maintenance, day-night, biome variation, fixed camera, responsive HUD, layout generator.

## 40.12 MVP campaign shell

Simple Gözlemci Ağı with 3 planet cards and completed/open state. Full Colony Network UI ertelenir; history data saklanır.

## 40.13 MVP audio

Basic ambience, facility loops/state transitions, warnings, UI, minimal music. Full adaptive soundtrack production yok.

## 40.14 MVP localization/mobile

Player-facing Türkçe; bütün strings localization keys. Responsive/touch architecture baştan; low-end device extreme optimization final polish aşamasında.

## 40.15 MVP'de özellikle olmayanlar

- Sector 2-5
- ORPHEUS/AURELIA/KEPLER
- Shelter/Medical
- Injury/Evacuation
- Meteor/combat/turrets
- randomized scenario generation for players
- GUI Planet Designer
- full Colony Network
- cloud save/account/multiplayer
- research/skill tree
- achievements/cosmetics
- store packaging
- bütün node seti

## 40.16 MVP başarı kriteri

1. Player COLONY'den symptom fark ediyor mu?
2. Debugger ile gerçek causal chain'i anlayabiliyor mu?
3. Kendi Protocol'ünü kurmak tatmin edici mi?
4. Yan etki “haksız” değil “bunu düşünmemiştim” hissi yaratıyor mu?
5. Stabilizasyon “koloniyi ben düzelttim” hissi veriyor mu?

Cevap hayırsa yeni içerik değil core sistem düzeltilir.

---

# 41. Geliştirme Yol Haritası - Faz 0-23

Bu bölüm yalnız high-level roadmap değil, **uygulanabilir sıralama ve exit criteria**dır. Bir fazın kalite kapısı sağlanmadan sırf roadmap ilerlesin diye sonraki faza geçilmez.

## Faz 0 - Proje Temeli ve Teknik İskelet

**Amaç:** Domain sınırlarını erkenden doğru kurmak.

**İşler:** React+TS app shell; routing; Zustand store boundaries; Simulation Engine package shell; R3F/Three scene shell; React Flow placeholder; Zod; i18n; SaveRepository interface; IndexedDB adapter stub; AssetRegistry; content schemas; dev/test setup.

**Çıkış:** World/UI/protocol/save birbirine circular bağımlı değil; simulation React olmadan instantiate edilebilir; sample schema parse olur.

## Faz 1 - ColonyVisualPrototype

Bölüm 28 kapsamı. Real asset, 6 facility, 12-15 colonist, day/night/snow, fixed camera, visual states, performance instrumentation.

**Kalite kapısı:** Görsel kimlik + readability + camera/touch + performance + asset pipeline kriterleri sağlanır.

## Faz 2 - Simulation Core

**İşler:** SimulationClock; fixed deterministic step; resource ledger; facility instance/state machine; storage; modes; command request/result; basic priorities; SafetyInterlock contract; day/night state.

**Test:** same inputs same outputs; pause/speed invariant; resource conservation/limits; no renderer dependency.

**Çıkış:** Dev console ile Mine Eco/Normal vb. command gerçek state ve resource etkisi üretir.

## Faz 3 - Workforce ve Maintenance Core

Population/active workforce, assignment priorities, rest, travel task, Condition/wear, maintenance queue/material/time, failure/recovery. Colonist visuals gerçek assignments'a bağlanır.

**Çıkış:** Workforce shortage deterministic; maintenance için worker facility'den çekilir; saveable task state.

## Faz 4 - Deterministic Layout Generator

Terrain zones, PlacementProfile, hard/soft constraints, candidate generation/scoring, screen-space validation, road/navigation graph, expansion slots, serialization.

**Çıkış:** Dev seed sweep invalid/disconnected layout üretmemeli; campaign layout bir kere generate edilip sabitlenebilir.

## Faz 5 - Protocol Runtime

Graph-independent compiler/runtime, Trigger/Sensor/Compare/AND/Delay/Action, persistent action, threshold crossing, snapshot evaluation, priority/conflict, execution trace.

**Çıkış:** Headless unit/integration tests; cycles rejected; same state/seed deterministic.

## Faz 6 - Protocol Editor ve Manager

React Flow UI, palette, settings, Draft/Apply, validation, mobile interaction, summaries/versioning.

**Çıkış:** Player dev build'de code yazmadan protocol oluşturup apply edebilir; invalid graph explanation natural Turkish.

## Faz 7 - Automation Debugger

Structured SimulationEvent store, timeline/detail, causal links, protocol trace, command outcomes, facility/protocol jump.

**Çıkış:** “Neden çalışmadı?” sorusu event data ile cevaplanır; raw tick spam yok.

## Faz 8 - HELIOS-4 Vertical Slice

Gerçek planet content, generated layout, day/night, mission/sustainability, tutorial/arrival/help basic, first gameplay loop.

**GO/NO-GO:** HELIOS eğlenceli ve anlaşılır değilse yeni planet yapılmaz.

## Faz 9 - Colony Health ve Assessment

4 dimensions, rolling window, geometric mean, objective analyzer, Assessment screen, first/current/best data.

**Çıkış:** Mission pass ile Health farklı sonuç üretir; explanation actual simulation data'dan.

## Faz 10 - Save / Recovery

Autosave, IndexedDB, backup, version/migration scaffold, full runtime state persistence, Safe Checkpoint, Collapse Analysis/options.

**Çıkış:** Save-load deterministic continuity; Delay/Counter/Event scheduler reset olmuyor.

## Faz 11 - NIVALIS Systems Slice

Reactor ramp/Thermal Load, Thermal Control, temperature/demand/drift, outside temperature, NIVALIS content.

**Architecture gate:** HELIOS code hack'lenmeden generic systems genişliyor mu?

## Faz 12 - MOROS Workforce/Maintenance Slice

Competing workforce demands, maintenance queues, Condition degradation, visual reassignment, MOROS content.

**Design gate:** Sistem stratejik derinlik mi yaratıyor, mikro-yönetim mi? Mikro hissi varsa simplify.

## Faz 13 - Campaign Shell

Sector 1 simple network, 3 planet, lock/open/completed, planet selection, assessment history basic.

## Faz 14 - Nihai COLONY HUD ve Responsive UI

Accepted desktop/mobile HUD, bottom sheets, safe viewport, context navigation, alerts, resource panels.

## Faz 15 - Audio ve Feedback Pass

AudioDirector, buses, facility/world/alert/UI, minimal music, browser unlock, culling.

## Faz 16 - Tutorial / Handbook / UX Polish

HELIOS contextual tutorial, staged Help, encountered concepts Handbook, Turkish terminology consistency, empty/error/validation states. Solution spoiler yok.

## Faz 17 - Performance ve Accessibility

Quality profiles, DPR, shadow/particle budgets, mobile device test, UI scale, reduced motion, shake, keyboard, color-independent states.

## Faz 18 - MVP Playtest

Feature freeze. Ölç: symptom recognition, Debugger use, Protocol usability, fairness, world-vs-dashboard attention, NIVALIS causal clarity, MOROS micromanagement, mobile usability. Balance/config tuning.

**Kural:** Bu fazda yeni planet/feature eklenmez.

## Faz 19 - MVP Release Candidate

Critical bug, save migration, deterministic regression, responsive/performance regression, localization audit, edge cases, browser compatibility, asset license manifest.

## Faz 20 - AURELIA-6

Battery reserve policy + forecast + first Expansion Slot.

## Faz 21 - KEPLER-17B

Oxygen trend/sustainability.

## Faz 22 - ORPHEUS STATION

Sector 1 integrated exam.

## Faz 23 - Full Sector 1 Polish

All 6 planet consistency, sector progression, assessment/history, art/audio variation. Sonra Sector 2 production.

## 41.1 Milestone grupları

- **Milestone A - “Dünya Var”**: Faz 0-4.
- **Milestone B - “Oyun Var”**: Faz 5-10.
- **Milestone C - “MVP Var”**: Faz 11-19.

Ana kalite kapıları: ColonyVisualPrototype, HELIOS Vertical Slice, MVP Playtest.

---

# 42. Developer Tools ve Otomatik Test Sistemi

Developer Tools lüks değil, sistemik oyunun üretim altyapısıdır. Production build'de compile-time/dev flag ile çıkarılabilir.

## 42.1 Developer Mode / Overlay

Central dev panel, örn. dev build + F1. Tabs:

- Simulation
- Resources
- Facilities
- Workforce
- Protocols
- Events
- Layout
- Performance
- Save
- Planet

## 42.2 Fast/Headless Simulation

Player max ×4; dev ×20/×100 gibi hızlar ve renderer-off headless run olabilir.

```ts
runScenario({ planet, protocolSet, seed, cycles: 100 })
```

Simulation React/Three olmadan çalışmalıdır.

## 42.3 State Inspector + Override

Entity raw state görüntülenir; Condition/Resource/Workforce override edilebilir. Override sonrasında normal engine rules çalışır; örn. Reactor Condition=29 ise gerçek interlock check uygulanır.

## 42.4 Event Injector

Event type/severity/phase/start time dev'den spawn/advance; Forecast/Onset/Active/Recovery tek tek test edilir.

## 42.5 Protocol Inspector / Trace Tester

Last trigger/evaluation/action, Delay/Counter/Cooldown runtime memory; `Trigger Now` dev-only. Input fixture → expected command testleri.

## 42.6 Deterministic Replay

Bug reproduction package:

- Planet ID
- initial save/snapshot
- seed/RNG state
- player commands
- protocol changes/apply times

aynı sonucu yeniden üretebilmelidir. Belirli tests state hash kullanabilir; global balance golden hash'e aşırı bağımlı olunmaz.

## 42.7 Planet Validator

Zod schema + gameplay validations:

- missing facility/event reference
- unsupported sensor/action
- missing localization
- impossible objective range
- invalid expansion footprint
- missing asset/placement profile
- invalid layout/camera accessibility

CI fail edebilir.

## 42.8 Layout Visualizer ve Seed Sweep

Candidate score breakdown: hard fail, road, evacuation, overlap, adjacency, camera. 10k seed sweep invalid/disconnected/overlap statistics.

## 42.9 Asset Inspector

Model preview + bounds/triangles/materials/textures/animations; entrance/workpoint/visual center editor; metadata export. Full DCC replacement değil, gameplay metadata tool'u.

## 42.10 Balance Runner

Reference protocol ile planet 100 cycle headless run; report:

- min Energy/Oxygen
- Material/cycle
- wear/maintenance hours
- critical events
- objective success
- Health

## 42.11 Solvability yaklaşımı

Brute-force tüm protocol space çözme yok. Üç katman:

1. Static Validation
2. Reference Solution Tests
3. Stress/Seed Tests

`referenceProtocols` player'a gösterilmez. Örn. `helios.timeBased.reference.json`, `helios.energyThreshold.reference.json`.

## 42.12 Scenario regression

Balance değişince test matrix hangi planet/solution family'nin bozulduğunu gösterir.

## 42.13 Save Inspector

saveVersion/gameVersion/state summary, export/import/migrate dev tools. User-facing save editing yok.

## 42.14 Debug Package

Playtest bug export: gameVersion, planet, save snapshot, recent meaningful events, protocols, performance metrics, browser/device. Kişisel veri zorunlu değildir.

## 42.15 GUI Planet Designer

Full visual Planet Designer MVP öncesi yapılmaz. Önce JSON/TS + Zod + live reload + validation + preview. Schema stabil olunca GUI editor post-MVP.

---

# 43. Teknik Mimari ve Modül Sınırları

## 43.1 Ana prensip

Domain/Simulation herhangi bir React component, Three.js scene veya browser storage API'sine bağımlı olmamalıdır.

Önerilen dependency direction:

```text
content/schema
    ↓
domain/simulation ← protocol-runtime
    ↓ events/state
application/game-session
    ↓
view-models
  ├─ colony-world
  ├─ hud/ui
  ├─ protocols-editor
  ├─ debugger-ui
  └─ audio

infrastructure
  ├─ save-indexeddb
  ├─ asset-loader
  └─ telemetry/devtools
```

## 43.2 Önerilen klasör yapısı

```text
src/
  app/
    routes/
    providers/
  game/
    domain/
      resources/
      facilities/
      workforce/
      maintenance/
      events/
      objectives/
      health/
    simulation/
      SimulationEngine.ts
      SimulationClock.ts
      SimulationEvent.ts
      systems/
    protocols/
      schema/
      compiler/
      runtime/
      nodes/
    content/
      catalogs/
      planets/
      sectors/
      loaders/
      validation/
    session/
      GameSession.ts
    save/
      SaveRepository.ts
      serializers/
      migrations/
    world/
      renderer/
      camera/
      assets/
      characters/
      fx/
    ui/
      colony/
      protocols/
      debugger/
      assessment/
      network/
      handbook/
      settings/
    audio/
    devtools/
  localization/
```

Folder names implementation suggestion; module boundaries semantically önemlidir.

## 43.3 State ownership

- Simulation Engine: authoritative gameplay state.
- Content catalogs: definitions/config.
- GameSession: active planet engine + save/event orchestration.
- Zustand: UI/view state and derived caches; core truth duplicate edilmez.
- React Flow: graph editing representation.
- Three.js: render state derived from engine/view model.

## 43.4 Numeric determinism

JS `number` kullanılabilir; simulation step fixed. Aynı computation order korunmalı. Time integer simulation minutes olarak tutulması tavsiye edilir. Resource values floating olabilir; UI rounding gameplay threshold comparison'ını değiştirmez. Threshold engine raw value ile hesaplanır.

## 43.5 Stable IDs

Facility, colonist, protocol, protocolExecution, event, task için stable string IDs. Eşit-priority tie-break ve save refs render order'a bağlı değildir.

## 43.6 Simulation system update order - v10.1 clarification

Aynı tick'te belirsizlik olmaması için başlangıç varsayılan sıra:

1. Clock advances to tick boundary.
2. Scheduled event/protocol timers due items activate.
3. External/environment state updates.
4. Protocol triggers from previous→current crossings collect.
5. Protocol executions evaluate snapshots and create command requests.
6. Command arbitration + Safety Interlocks resolve.
7. Facility operational state/ramp/workforce requirement updates.
8. Workforce assignment/travel/task progress.
9. Resource production/consumption/storage allocation.
10. Thermal/Oxygen/condition/wear/maintenance consequences.
11. Objectives, Health rolling metrics and collapse checks.
12. Meaningful SimulationEvents emitted/causal links finalized.

Bazı physical model feedback aynı tick içinde iki-pass gerektirirse implementation bunu internal substep ile yapabilir; public semantics deterministic kalır. Kodlama aracı bu order'ı değiştirecekse regression tests ile equivalent outcome göstermelidir.

## 43.7 UI update

Simulation tick sonrası immutable/read model snapshot UI'ya yayınlanır. Renderer her frame interpolate edebilir ama authoritative state geçmiş/gelecek tahmini ile değiştirilmez.

---

# 44. Referans TypeScript Domain Sözleşmeleri

Bu interface isimleri birebir zorunlu değildir; taşıdıkları semantik zorunludur.

## 44.1 Facility

```ts
type FacilityMode = 'eco' | 'normal' | 'boost';
type FacilityOperatingState =
  | 'offline'
  | 'starting'
  | 'online'
  | 'standby'
  | 'maintenance'
  | 'interlocked'
  | 'failed';

type Priority = 'low' | 'normal' | 'high' | 'critical';

interface FacilityInstanceState {
  id: string;
  typeId: string;
  state: FacilityOperatingState;
  mode?: FacilityMode | string;
  condition?: number;
  assignedWorkforce: number;
  workPriority: Priority;
  maintenancePriority: Priority;
  energyPriority?: Priority;
  maintenanceNeed?: boolean;
  setpoints: Record<string, number | string | boolean>;
  runtime: Record<string, unknown>;
}
```

## 44.2 Resource

```ts
interface ResourcePoolState {
  energy: { stored: number; capacity: number; productionRate: number; consumptionRate: number };
  oxygen: { stored: number; capacity: number; productionRate: number; consumptionRate: number };
  material: { stored: number; capacity: number; productionRate: number };
}
```

## 44.3 Protocol

```ts
interface ProtocolDefinition {
  id: string;
  nameKey?: string;
  name: string;
  priority: Priority;
  status: 'draft' | 'active' | 'disabled' | 'archived';
  version: number;
  nodes: ProtocolNodeDefinition[];
  edges: ProtocolEdgeDefinition[];
}
```

Runtime memory definition'dan ayrıdır.

## 44.4 SimulationEvent

```ts
interface SimulationEvent {
  id: string;
  simTime: number;
  category: 'external' | 'system' | 'protocol';
  severity: 'info' | 'warning' | 'critical';
  eventType: string;
  reasonCode?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  facilityId?: string;
  protocolId?: string;
  protocolExecutionId?: string;
  causedByEventIds?: string[];
  payload?: Record<string, unknown>;
}
```

UI/audio/debugger aynı semantic event'i tüketir.

## 44.5 Command request/result

```ts
interface FacilityCommandRequest {
  id: string;
  simTime: number;
  facilityId: string;
  actuator: string;
  value: unknown;
  sourceProtocolId?: string;
  sourceExecutionId?: string;
  priority: Priority;
}

interface FacilityCommandResult {
  requestId: string;
  status: 'applied' | 'blocked' | 'failed' | 'delayed';
  reasonCode?: string;
  appliedValue?: unknown;
}
```

---

# 45. Tutorial, Varış Raporu, Help ve Handbook

## 45.1 İlk bağlantı akışı

Planet select → kısa connection sequence → Varış Durum Raporu → COLONY.

Varış Raporu yalnız gerçekten bilinen semptom, süre ve etkiyi verir. Kayıt yoksa “kayıt bulunamadı” diyebilir; root cause uydurmaz. Mission panelden tekrar erişilebilir.

## 45.2 Tutorial sınırı

> **Oyuncuya düğmelerin nasıl kullanılacağını öğretebiliriz. Hangi çözümü kurması gerektiğini öğretmeyiz.**

Tutorial:

- UI interaction
- Trigger/Condition/Action genel kuralı
- Action persistence gibi evrensel sistem semantiği
- Debugger nasıl açılır

öğretebilir.

Aktif planet için “Night → Mine Eco protokolü yap” demez.

## 45.3 First planet guidance

HELIOS en yüksek guidance. Sonra hızla azalır. Failure olduğunda “Hata Ayıklama'da nedeni inceleyebilirsin” gibi meta hint olur, solution olmaz.

## 45.4 Yardım

Optional `Yardım` staged diagnostic hints. Hint daha spesifik olabilir ancak mümkünse exact command/node prescription'a dönüşmez.

## 45.5 Gözlemci El Kitabı

Context-sensitive kısa reference; yalnız encountered/unlocked concepts. Neutral örnekler kullanır, active planet solution değil.

## 45.6 First planet completion

“Tutorial Complete” arcade etiketi yerine thematic: “Gözlemci bağlantısı doğrulandı...” ve Sector 1 free choice açılır. Normal Assessment flow korunur.

---

# 46. Audio, UI, Debugger ve Accessibility İçin Ortak Semantic Event İlkesi

Simulation bir değişimi bir kez tanımlar; presentation katmanları ayrı ayrı benzer event üretmez.

Örnek Reactor Interlock:

```text
SimulationEngine → REACTOR_INTERLOCK event
  ├─ WorldRenderer: safety light / stopped machinery
  ├─ HUD: alert count + icon/text
  ├─ AudioDirector: interlock cue
  ├─ Debugger: blocked command + causal chain
  ├─ Accessibility: color-independent label
  └─ DevTools: raw reason/state
```

Bu prensip UI/audio/debug drift'ini önler. Presentation katmanı gameplay event “icat” edemez.

---

# 47. Kodlama Araçları İçin Kanonik Geliştirme Sözleşmesi

Codex/Claude Code bu belgeyi implementasyon kontratı olarak okumalıdır.

## 47.1 Değiştirilmemesi gereken ürün kimliği

- Player = Gözlemci, direct colonist control yok.
- Active colony ana üç ekranı KOLONİ / PROTOKOLLER / HATA AYIKLAMA.
- Core resources yalnız Energy/Oxygen/Material.
- Simulation deterministic ve renderer'dan bağımsız.
- Protocol system Trigger-started, actions persistent, conflicts deterministic.
- Safety Interlock protocol priority'den üstündür.
- Free building placement/cable-pipe micromanagement yok.
- Facility/colonist world visuals simulation state'e bağlı.
- Mission completion ile Health ayrı.
- Failure recoverable analysis loop, campaign punishment değil.
- Offline progression yok.
- Player-facing ilk release Türkçe; strings localization'dan.

## 47.2 Yeni sistem ekleme yasağı

Bir bug/teknik kolaylık için yeni resource, node, screen, facility mode, meta currency, skill tree, random failure rule eklenmez. Gerekirse existing abstraction genişletilir veya explicit product decision istenir.

## 47.3 Tuning davranışı

Baseline value varsa onu config'e koy ve implement et. “Bu sayı kaç olsun?” sorusu sorma. Playtest değiştirebilir. Invariant test yaz.

Örnek: HELIOS Battery 360 başlangıçtır. Config'e koy. Daha sonra 340 yapılabilir; ama `fullNightLoad > capacity > optimizedNightLoad` invariant'ı korunur.

## 47.4 Deferred davranış

DEFERRED özelliği MVP'de implement etmeye çalışma:

- Shelter/Medical/injury/evacuation
- full Sector 2+
- GUI Planet Designer
- full screen-reader graph authoring
- final colonist asset
- advanced adaptive music

Ama architecture obvious extension point bırakabilir.

## 47.5 Hata mesajları

Internal exceptions English olabilir; player-facing natural Turkish localization key. “Boolean false”, “execution pulse lost” gibi jargon gösterilmez.

## 47.6 Test zorunluluğu

Core semantic değişiklikte unit/integration/scenario/determinism testleri güncellenir. Balance değişikliğinde reference scenario regression çalıştırılır.

## 47.7 Belgeyi arama, komuta uyma ve varsayım disiplini

- Her implementasyon görevi başlamadan önce görevle ilişkili kanonik bölüm ve terimler aranır. Uzun belgeyi hafızadan uygulamak kabul edilmez.
- Kullanıcının mevcut komutu kapsamı belirler. Spesifikasyonda istenmeyen ek refactor, feature, ürün sadeleştirmesi veya redesign yapılmaz.
- Ürün davranışındaki belirsizlik tahminle kapatılmaz. Önce bu belge, sonra geçerli data/config ve ilgili mevcut kod okunur. Kod ile belge çelişirse aksi kararlaştırılmadıkça belge üstündür.
- TUNABLE için baseline kullanılır; SHOULD/VARSAYILAN uygulanır; DEFERRED implement edilmez. Bu durumlar soru sebebi değildir.
- İnsan kararı yalnız Bölüm 0.3 koşulları gerçekten oluştuğunda ve belge araması cevap vermediğinde istenir.
- Geri döndürülebilir, oyuncuya görünmeyen teknik detaylarda araç makul seçim yapabilir; bu seçim yeni gameplay semantiği, kullanıcıya görünür davranış veya deterministic kural yaratamaz.

> **Görev sonu zorunlu kontrol:** İstenen görev tamamlandı mı? Kapsam dışı dosya/sistem değişti mi? Belgeye aykırı davranış oluştu mu? Yeni ürün semantiği uyduruldu mu? Gerekli unit/integration/scenario/determinism testleri çalıştırıldı mı? Bu kontrol geçmeden görev tamamlandı olarak raporlanmaz.

---

# 48. Genel Kabul Kriterleri - Sistem Bazlı Definition of Done

## 48.1 Simulation Core DONE

- FPS/speed independent deterministic sonuç.
- Save/load sonrası aynı state devam eder.
- Resource cap/shortfall deterministic.
- Facility command result reason'ları structured.
- Renderer olmadan headless çalışır.

## 48.2 Protocol Runtime DONE

- Trigger crossing doğru.
- Snapshot semantics testli.
- Delay sim time kullanır/save olur.
- Action persistence testli.
- Priority/conflict/interlock ordering testli.
- Graph cycle reject.

## 48.3 Debugger DONE

- Player meaningful failure chain'i anlayabilir.
- Condition measured value görünür.
- Block/Conflict reason natural Turkish.
- Bidirectional causal navigation.
- Tick spam yok.

## 48.4 World Renderer DONE

- Simulation state olmadan kendi gameplay state'i yaratmaz.
- Fixed camera/safe viewport.
- Facility states qualitative readable.
- Colonist movement assignment'a bağlı.
- Low profile bilgi kaybetmez.

## 48.5 Planet DONE

- 17 field design complete.
- Zod/schema valid.
- Layout valid.
- At least one reference solution; normal planet mümkünse ≥2 family.
- Mission trivial all-off exploit'e dayanıklı.
- Sustainability and collapse deterministic.
- No root-cause spoiler.

## 48.6 Save DONE

- Core runtime memory dahil.
- migration scaffold.
- backup.
- autosave stutter yok.
- current/safe/devir semantics ayrı.

---

# 49. Tutarlılık Kontrolü ve v10.1 Audit Sonucu

Bu v10.1 hazırlanırken eski v9 içeriği ve sonraki bütün kabul edilmiş kararlar karşılaştırılarak aşağıdaki çelişkiler temizlendi:

| Kontrol | v10.1 sonucu |
|---|---|
| Resource sayısı | 3: Energy/Oxygen/Material. Security resource değil. |
| Sector 1 planet listesi | HELIOS, NIVALIS, MOROS, AURELIA, KEPLER, ORPHEUS. Eski ARES/EDEN örnekleri kaldırıldı. |
| Renderer | R3F + Three.js; PixiJS ana yön değil. |
| Building placement | Fixed/generated layout + limited Expansion Slot; free placement yok. |
| Layout generation | deterministic constraint-based, screen-space validation dahil. |
| Facility catalog | 11 type tam tanımlı; MVP 9 type. |
| Medical/Shelter | katalogda kanonik, MVP/S1 ana öğretimde yok. |
| Node progression | 9 general node + Sector unlock sırası tek biçimde tanımlı. |
| Protocol action | persistent; automatic return yok. |
| Conflict | Interlock > priority > equal conflict/no change. |
| Health | 4 dimensions + geometric mean; Mission ayrı. |
| Time | Pause/x1/x2/x4; sim-time authoritative; offline progression yok. |
| Save | Current / Safe Checkpoint / Devir Snapshot ayrıldı. |
| HUD | desktop/mobile accepted layout + safe viewport. |
| Audio | 4 layer + semantic alert + no talking Observer. |
| Accessibility | color-independent + reduced motion + touch/keyboard baseline. |
| Performance | desktop 60/mobile 30 target + quality profiles. |
| Asset packs | gerçek inspected mapping ve runtime pipeline. |
| MVP | HELIOS/NIVALIS/MOROS + 9 facility; kapsam dışı açık. |
| Roadmap | Faz 0-23 + milestone/quality gates. |
| Dev tools | headless sim, validator, layout/balance runner, replay, reference solutions. |

## 49.1 Bilinçli açık/deferred alanlar

Aşağıdakiler eksik tasarım hatası değil, bilinçli sonraki karar/tuning alanıdır:

1. **Final colonist art asset:** prototype astronaut kullanılabilir; final insan/kasklı low-poly set seçilecek.
2. **Playtest tuning:** exact balance numbers, Health Population coefficient, ramp times, event severity gibi TUNABLE değerler Faz 18'de kalibre edilir.
3. **Sector 2-5 gerçek planet content:** bilişsel tema/node progression bellidir; tek tek 17-field scenario'lar Sector 1 sonrası üretilecektir.
4. **Full GUI Planet Designer:** schema stabilize olduktan sonra.
5. **Advanced audio asset library/music production:** pipeline belli; exact sound files production sırasında seçilir ve license manifest'e eklenir.
6. **Emergency Shift exact formula:** full design extension; MVP için gerekli değildir.

Bu maddeler MVP geliştirirken blocker değildir. Kodlama aracı bunlar için sürekli soru sormamalı; ilgili feature henüz scope'ta değilse implement etmemelidir.

---

# 50. Hızlı Referans - Değişmez İnvaryantlar

1. Player Gözlemci'dir; colonist micro yok.
2. Core loop Observe → Analyze → Protocol → Execute → Debug → Optimize.
3. Aktif colony yalnız üç ana workspace.
4. Üç resource: Energy/Oxygen/Material.
5. Workforce resource değil; deterministic capacity.
6. Facility command request local controller/Safety Interlock'tan geçer.
7. Interlock kötü policy'yi düzeltmez, unsafe command'ı block eder.
8. Technical failures explainable/deterministic, heavy RNG değil.
9. Actions persistent.
10. Threshold Trigger crossing-based.
11. Arbitrary protocol cycles yasak.
12. Equal-priority incompatible simultaneous commands conflict ve no-change.
13. Mission completion ve Colony Health ayrı.
14. Health geometric mean.
15. Failure çoğunlukla recoverable; collapse analiz loop'una bağlı.
16. Offline progression yok.
17. World renderer authoritative simulation'ın görselidir.
18. Fixed 2.5D camera; no rotation.
19. Free building placement yok; generated fixed layout + limited slots.
20. Generator deterministic/constraint-based ve campaign layout sabit.
21. HUD dünya görünümünü domine etmez.
22. Player-facing Türkçe; jargon minimize.
23. Critical info tek visual/audio channel'a bağlı değil.
24. Save protocol runtime/event scheduler state'ini içerir.
25. MVP = HELIOS + NIVALIS + MOROS.
26. MVP'den önce full Planet Designer/medical/evacuation yapılmaz.
27. Data/config numbers hard-code edilmez.
28. Reference solutions test içindir, oyuncuya solution olarak sunulmaz.
29. SimulationEvent UI/audio/debug/accessibility/devtools için ortak semantic source'tur.
30. Yeni product mechanic bu belgeye aykırı şekilde kodlama aracı tarafından uydurulmaz.

---

# 51. Terimler Sözlüğü

| Terim | Tanım |
|---|---|
| Gözlemci | Oyuncunun merkezi AI rolü. |
| COLONY / KOLONİ | Yaşayan 2.5D dünya ve anlık gözlem workspace'i. |
| Protocol / Protokol | Trigger ile başlayan ve logic/flow/action içeren otomasyon tanımı. |
| Trigger / Tetikleyici | Protocol execution başlatan olay/crossing. |
| Sensor / Veri | State okur; protocol başlatmaz. |
| Action / Eylem | Facility local controller'a command request gönderir. |
| Safety Interlock | Fiziksel güvenlik sınırı nedeniyle unsafe command'ı block eden yerel kontrol. |
| Debugger / Hata Ayıklama | Nedensellik ve protocol execution inceleme sistemi. |
| Operational Cycle | Gezegenin sustainability için doğal anlamlı periyodu. |
| Condition | Facility genel fiziksel health 0-100. |
| Workforce | Population'dan türeyen, priority ile dağıtılan çalışma kapasitesi. |
| Colony Health | Nüfus/Kararlılık/Verimlilik/Güvenlik geometrik ortalaması. |
| Assessment | Stabilizasyon sonrası mission + system quality değerlendirmesi. |
| Safe Checkpoint | Sistem tarafından safe conditions'da alınan recovery snapshot. |
| Devir Snapshot | Official immutable stabilization/handover snapshot. |
| Gözlemci Ağı | Campaign sector/planet seçim ekranı. |
| Colony Network | Tamamlanan kolonilerin history/archive alanı. |
| PlacementProfile | Generator'ın facility placement kurallarını tanımlayan metadata. |
| GeneratedPlanetLayout | Generator'ın renderer'a verdiği sabit facility/road/zone/camera layout sonucu. |
| Reference Protocol | DEV-ONLY scenario regression için bilinen geçerli otomasyon örneği. |

---

# 52. Sonuç

Gözlemci İşletim Sistemi'nin ürün kimliği, core simulation, protocol semantiği, Debugger, 11 facility kataloğu, resources/workforce/maintenance, campaign/Sector 1, yaşayan 2.5D world, HUD, deterministic layout, time/save/recovery, Health/Assessment, audio/accessibility/performance, gerçek asset pipeline, MVP kapsamı, Faz 0-23 development roadmap ve developer testing altyapısı bu v10.1 ile tek çelişkisiz spesifikasyonda toplanmıştır.

Implementasyon için temel öncelik yeni özellik üretmek değil, bu sözleşmeyi küçük ve test edilebilir katmanlarla hayata geçirmektir. İlk büyük teknik/sanatsal kapı ColonyVisualPrototype, ilk gerçek oyun kapısı HELIOS-4 Vertical Slice, ürün doğrulama kapısı MVP Playtest'tir.

**v10.1 bundan sonraki geliştirme için ana referanstır.**

# 53. Protokol Doğrulama, Derleme ve Runtime Hata Kuralları

Bu bölüm kodlama araçlarının graph ile runtime arasında belirsizlik yaşamaması için detaylandırılmıştır.

## 53.1 Node port tipleri

Her node giriş/çıkışı typed olmalıdır. Önerilen semantic türler:

- `flow`: execution pulse.
- `boolean`: condition result.
- `number`: numeric sensor/setpoint.
- `enum:<domain>`: mode/state/priority gibi kontrollü değer.
- `entityRef:<type>`: facility/event target reference.

Implicit string→number veya boolean→number conversion yapılmaz. Invalid type edge UI'da kurulamadan reddedilir.

## 53.2 Structural validation error'ları

Apply'i engelleyen örnekler:

- Trigger yok.
- Bir Protocol'de birden fazla bağımsız root Trigger varsa; MVP default bir root Trigger/Protocol. İleride multi-trigger gerekirse ayrı product kararı.
- Action required target/value eksik.
- Compare operand type incompatible.
- AND input eksik.
- Graph cycle bulundu.
- Delay duration ≤0 veya schema range dışı.
- Edge incompatible port'a bağlı.
- Referans verilen sensor/action current planet/facility capability'de yok.
- Deleted facility instance'a hard instance ref.

## 53.3 Warning'ler

Apply'i engellemeyen örnekler:

- Action state'i muhtemelen zaten mevcut value'ya set ediyor.
- Protocol hiçbir current facility'yi etkileyemiyor ancak future state ile mümkün.
- Aynı actuator'u etkileyen başka active protocol var; bu yalnız **potential conflict** warning'dir.
- Çok yakın threshold'lar oscillation riski taşıyabilir; sistem solution önermeden “sık mod değişimi oluşabilir” diyebilir.
- Long Delay mission cycle'dan uzun olabilir.

Potential conflict ile runtime actual `CONFLICT` aynı şey değildir.

## 53.4 Compile output

Compiler graph'tan deterministic executable representation üretir. React Flow node position, selection, color gibi editor presentation fields runtime'a taşınmaz. Compile sonucu versioned ve hash'lenebilir.

## 53.5 Runtime execution identity

Her Trigger pulse yeni `protocolExecutionId` yaratır. Aynı protocol aynı anda birden çok execution barındırabilir (ör. Delay beklerken yeni trigger), ancak node semantiği ve Cooldown bunu sınırlayabilir. Debugger execution'ları ayırır.

## 53.6 Action request timing

Aynı tick içinde execution'lar action request üretir; command arbitration tüm request'leri topladıktan sonra yapılır. Böylece protocol evaluation sırası “ilk çalışan kazanır” sonucu yaratmaz.

## 53.7 Blocked vs Failed

- **Blocked:** Sistem command'ı geçerli olarak anladı fakat Safety Interlock, conflict, reserve floor veya policy constraint nedeniyle uygulamadı.
- **Failed:** Command target unavailable/Failed veya execution sırasında fiziksel/operational requirement yerine getirilemedi; error normal gameplay state'idir, uygulama exception'ı değildir.
- **Delayed:** Facility ramp/startup veya explicit local transition nedeniyle command kabul edildi ancak hedef state hemen oluşmadı.
- **Applied:** Command current setpoint/state request olarak kabul edildi. Ramp gereken tesiste “Applied” ile “target reached” ayrı event olabilir.

## 53.8 Reason code standardı

Önerilen stable reason codes:

- `SAFETY_THERMAL_LIMIT`
- `SAFETY_CONDITION_LIMIT`
- `SAFETY_WORKFORCE_MINIMUM`
- `SAFETY_RESTART_COOLDOWN`
- `COMMAND_CONFLICT_EQUAL_PRIORITY`
- `TARGET_FAILED`
- `TARGET_MAINTENANCE`
- `RESOURCE_STORAGE_FULL`
- `RESOURCE_RESERVE_FLOOR`
- `ENERGY_NOT_ALLOCATED`
- `WORKFORCE_NOT_ASSIGNED`
- `ENVIRONMENT_UNAVAILABLE`
- `CAPABILITY_NOT_AVAILABLE`

Player string reason code'dan localization ile türetilir; source code'da Turkish text comparison yapılmaz.

---

# 54. Resource Allocation ve Storage Detay Semantiği

## 54.1 Energy step

Bir simulation step için conceptual order:

1. Available producer output hesaplanır.
2. Required facility consumption requests oluşturulur.
3. Direct production önce current demand'i karşılar.
4. Surplus Battery'lere charge edilir; aggregate charge capacity/limits gözetilir.
5. Deficit varsa Battery discharge candidate'ları MinimumReserve floor'a kadar kullanılabilir.
6. Hâlâ deficit varsa EnergyPriority load shedding uygulanır.
7. Facility gerçekten allocate edilen Energy'ye göre output/state consequence üretir.

Multiple Battery bulunduğunda aggregate model oyuncuya tek reserve gibi görünebilir. Internal discharge deterministic: usable energy yüzdesine göre proportional veya stable-order uygulanabilir; **v10.1 varsayılanı proportional discharge**dır, böylece banklar benzer fill seviyesinde kalır. Floating remainder stable ID ile çözülür.

## 54.2 MinimumReserve semantics

Battery `MinimumReserve=40%` demek Battery'nin fiziksel olarak 40 altında asla discharge edememesi değildir; normal power allocation için kullanılabilir floor'dur. Protocol bunu 0'a düşürerek acil kullanım açabilir. Local deep-discharge safety hard limit (ör. 0-5%) ayrı Safety Interlock config'dir ve protocol bypass edemez.

Oxygen Tank MinimumReserve aynı concept: normal policy floor. Life-support critical consumption, planet rule açıkça tanımlanmışsa floor'u aşan emergency path isteyebilir; base design'da bunu oyuncu protocol/setpoint ile yönetir, gizli bypass yoktur.

## 54.3 Storage full

Storage full olduğunda producer output `capacityLimited` olur. Üretim kaybolmaz; output azaltılır. Eğer facility mode “Boost” talep edilmiş olsa bile actual output storage headroom ile clamp edilir. Mode yine Boost state'inde kalabilir ve gereksiz energy/wear oluşturuyorsa Efficiency bunu yakalayabilir; local controller fiziksel output'u boşa üretmez.

## 54.4 Failed storage over-capacity durumu

Bir storage facility failed olup aggregate usable capacity stored amount'ın altına düşerse:

- `stored` değer fiziksel toplam olarak korunur.
- `accessibleStored = min(stored, usableCapacity)` gibi bir availability layer kullanılabilir.
- New production kabul edilmez.
- Onarım sonrası inaccessible portion tekrar erişilir.

UI “Toplam stok 320; erişilebilir 220; neden: Depo-2 arızalı” gibi açıklayabilir. Exact data representation implementation'a bağlı, resource silme yasaktır.

## 54.5 Material consumption transaction

Maintenance/construction başlarken required Material yeterliyse deterministic reservation yapılması önerilir. Task başladıktan sonra başka task aynı stoğu iki kez kullanamaz. Task cancel/fail semantics material'ın hangi kısmının geri döneceği task type config'inde tanımlanır; MVP maintenance'da start anında consume etmek en sade varsayılandır.

---

# 55. Workforce Assignment ve Travel Detayları

## 55.1 Workforce request model

Facility operational request ve maintenance request ayrı task'lardır. Her task:

```ts
interface WorkforceRequest {
  id: string;
  taskType: 'operate' | 'maintenance' | 'construction' | 'treatment' | 'evacuation-support';
  targetEntityId: string;
  minimum: number;
  desired: number;
  priority: Priority;
  canPartialAssign: boolean;
}
```

MVP'de operate/maintenance yeterlidir.

## 55.2 Reassignment

Priority değiştiğinde çalışan instant teleport etmez. Assignment decision hemen değişebilir fakat `travelingToTask` state boyunca effective assigned workforce henüz target'a ulaşmamıştır. Böylece physical distance küçük gerçek delay yaratır.

Facility panel iki değeri ayırabilir:

- Assigned/Committed
- On Site / Effective

MVP UI bunu yalnız gerektiğinde gösterir; simulation field'ları ayrılmalıdır.

## 55.3 Rest

Rest need per-colonist numeric olabilir ancak player-facing yalnız Resting state gerekir. Simple shift scheduler predictable cadence kullanır. Aynı anda tüm colony'nin vardiyası bitip workforce 0'a düşmemeli; staggered groups/data-driven offset.

## 55.4 Tie-break

Critical requests eşitse:

1. safe-minimum unmet request öncelikli.
2. sonra request createdSimTime.
3. sonra stable target ID.

Bu rule Debugger'da gerektiğinde açıklanabilir. Render proximity random tie-break değildir.

---

# 56. Mission Objective ve Sustainability Veri Modeli

## 56.1 Objective types

Önerilen declarative types:

- `resourceNeverBelow`
- `resourceCycleMinimum`
- `resourceTrendAtCycleEnd`
- `facilityNeverFailed`
- `temperatureWithinRange`
- `productionCycleMinimum`
- `maintenanceQueueMax`
- `conflictRateMax`
- `systemContinuityMinimum`
- `customCatalogObjective` (önceden engine'de tanımlı type; arbitrary script değil)

## 56.2 Objective state

```ts
interface ObjectiveRuntimeState {
  objectiveId: string;
  status: 'pending' | 'passing' | 'violated' | 'completed';
  currentValue?: number;
  targetValue?: number;
  violationDuration?: number;
  cycleAggregate?: number;
}
```

## 56.3 Sustainability

Planet:

- `cycleType`
- `requiredConsecutiveCycles`
- objective tolerance policies

saklar. Cycle başarıyla tamamlandığında counter artar; hard requirement ihlali cycle'ı resetleyebilir. Planet design açıkça tolerance tanımlar; engine generic.

## 56.4 Mission completion moment

Final required cycle end tick'inde bütün mission conditions valid ise `COLONY_STABILIZED` event bir kere oluşur. Assessment açılır. Player Kolonide Kal dese bile mission state stabilized kalır; ileride current Health değişebilir.

---

# 57. Colony Health Analyzer İçin Uygulama Ayrıntıları

## 57.1 Event-derived metrics

Health doğrudan her frame dört gizli sayı decrement etmek yerine rolling metrics'ten türetilmelidir. Örnek metric families:

**Stability:** downtime minutes, resource threshold crossings, mode oscillation count, recovery duration, command conflicts.  
**Efficiency:** wasted requested production, unnecessary Boost duration, idle assigned Workforce, storage overflow limitation, facility overcapacity relative to mission demand.  
**Safety:** exposure duration, unsafe command attempts, repeated interlocks, critical infrastructure risk windows, injury/death (future).  
**Population:** current supported population / expected target, continuity and severe displacement.

## 57.2 Explanation selection

Assessment Analyzer en büyük positive/negative contributors'ı seçer ve template key üretir:

```text
stability.good.continuity
stability.bad.oscillation
safety.bad.repeated_interlocks
efficiency.bad.unnecessary_boost
```

LLM gerekmez. Aynı metric aynı explanation family üretir.

## 57.3 Score clamp/rounding

Internal score float 0-100 clamp. Geometric mean raw float ile; UI nearest integer gösterebilir. Mission threshold display ile raw value arasında ambiguity oluşmaması için objective kendi rounding policy'sini tanımlar; default raw compare + rounded display.

---

# 58. Alerts, Toast ve Persistent Problem Ayrımı

## 58.1 Toast

Kısa state transition bildirimidir; birkaç saniye sonra kaybolur. Örn. “Protokol uygulandı”, “Bakım başladı”. Toast'ın kaybolması event'in kendisini silmez.

## 58.2 Active Alert

Devam eden problem persistent alert listesinde kalır. Örn. Energy critical, facility Failed, Oxygen critical. Condition resolved olduğunda listeden kalkar ve resolved event oluşabilir.

## 58.3 Alert spam prevention

Aynı condition her tick yeni alert oluşturmaz. Alert key/entity combo open state taşır. Severity değişirse update event olabilir. Audio onset'ta çalar; ongoing her saniye alarm tekrarlamaz.

## 58.4 Focus behavior

Alert tıklanınca uygun facility/world region veya Debugger event focus. Kamera kendiliğinden sürekli zıplamaz.

---

# 59. Main Menu, Pause Menu ve Settings

## 59.1 Main Menu

İlk sürüm sade:

- Devam Et (save varsa)
- Gözlemci Ağına Gir / Yeni Başlangıç
- Ayarlar
- Gözlemci El Kitabı erişimi save/context uygunsa

İlk run thematic connection entry kullanabilir.

## 59.2 Pause Menu

- Devam Et
- Gözlemci Ağına Dön
- Gözlemci El Kitabı
- Ayarlar
- Ana Menü

Gözlemci Ağına dönüş autosave yapar; “Kaydetmek ister misin?” spam yok. İsteğe bağlı `Kaydet ve Çık` explicit UI varsa yalnız current live save günceller, Safe Checkpoint oluşturmaz.

## 59.3 Settings categories

- Görüntü
- Ses
- Oynanış
- Erişilebilirlik
- Dil

30 ayrı graphics toggle hedefi yok; Low/Medium/High + birkaç anlamlı override yeterli.

**Görüntü:** quality profile, UI scale, screen shake, optional FPS limit.  
**Ses:** Master/Music/World/Facility/Alerts/UI.  
**Oynanış:** optional Critical Auto-Pause, tutorial hint reset.  
**Erişilebilirlik:** Reduced Motion, color assistance presets future, text/UI scale link, audio event labels future.  
**Dil:** İlk release TR; architecture multi-language.

---

# 60. Localization ve Oyuncu Terminolojisi

## 60.1 Türkçe first

İlk release oyuncuya gösterilen bütün terminoloji Türkçedir. Dev schema/property English olabilir.

## 60.2 Tercih edilen terimler

| Internal | Player-facing |
|---|---|
| Trigger | Tetikleyici |
| Condition | Koşul |
| Compare | Karşılaştır |
| Action | Eylem / Komut bağlama göre |
| Execution | Çalıştırma / tetiklenme izi bağlama göre |
| Threshold | Eşik |
| Safety Interlock | Güvenlik Kilidi / Güvenlik Sistemi |
| Conflict | Çakışma |
| Workforce | İş Gücü |
| Condition (facility) | Fiziksel Durum / Durum; UI context'te `Condition` İngilizce gösterilmez |
| Cooldown | Tekrar Bekleme |
| Splitter | Dallandır |

“Boolean”, “execution pulse”, “actuator” gibi jargon player UI'da kullanılmaz.

## 60.3 Localization key convention önerisi

```text
facility.fusionReactor.name
facility.fusionReactor.mode.boost
alert.energy.critical.title
debug.command.blocked.safetyThermal
planet.helios.arrival.body
handbook.protocol.actionPersistence
```

String interpolation typed parameters kullanır; business logic localized string parse etmez.

---

# 61. Asset/World Visual Hook Sözleşmesi

Facility `visualProfile` generic state ile asset-specific hook'u birleştirir.

Örnek:

```ts
interface FacilityVisualProfile {
  hooks: {
    coreEmissive?: string;
    rotatingParts?: string[];
    fans?: string[];
    steamEmitters?: string[];
    warningLights?: string[];
    doorNodes?: string[];
  };
  stateMapping: Record<string, VisualStateConfig>;
}
```

Asset gerekli named mesh'e sahip değilse hook optional olur; renderer generic impossible effect uydurmaz. Örn. Storage facility'de “rotating turbine” generic state diye gösterilmez.

Selection highlight ve alert indicator facility mesh material'ını kalıcı mutate etmemeli; shared material clone/overlay strategy kullanılmalı.

---

# 62. Camera Controller Detay Sözleşmesi

## 62.1 State

- current center
- target center
- zoom
- target zoom
- planet bounds
- safe viewport rect
- optional focusedEntityId

## 62.2 Focus

`focusEntity(entityId, reason)` entity visual center + projected bounds kullanır. Right panel/bottom sheet açıkken target safe rect içinde fully/mostly visible tutulur. Tall reactor'ın visual center'i ground footprint center'ından farklı olabilir.

## 62.3 Input

Desktop: mouse drag pan, wheel zoom, optional keyboard pan. Mobile: one-finger pan, pinch zoom. Gesture rotation disabled. UI üzerinde gesture world'e passthrough yapmaz.

## 62.4 Bounds

Pan clamp map boundary + small visual margin. Max zoom-out terrain edge'in ötesinde büyük boş world göstermez.

---

# 63. Save Versioning ve Migration Sözleşmesi

## 63.1 Version fields

- `saveVersion`: serialization schema.
- `gameVersion`: build/content version.
- `contentRevision`: planet/facility balance/content revision gerekirse.

## 63.2 Migration

Load pipeline:

1. parse envelope.
2. detect saveVersion.
3. sequential migrations `v1→v2→v3`.
4. validate migrated schema.
5. content compatibility check.
6. instantiate GameSession.

Migration function pure ve testable olmalı. Unknown future version load edilmez; user-facing Türkçe güvenli hata mesajı.

## 63.3 Autosave triggers

- periodic simulation interval.
- protocol Apply sonrası.
- major mission/event transition.
- leaving active colony.
- app visibility/unload best-effort; browser unload tek güvence değildir.

Write coalescing ile spam azaltılır.

## 63.4 Safe backup

Yeni save yazılırken önce temp/next record; başarıdan sonra current pointer swap. Önceki başarılı current hidden backup olarak bir süre korunur.

---

# 64. Sector Progression ve Gözlemci Sistem Güncellemesi

Yeni permanent logic node'lar XP/skill tree ile satın alınmaz. Sektör progression milestone'ında thematic **Gözlemci Sistem Güncellemesi** olarak açılır.

- Unlock cinematic/overlay kısa.
- Yeni node açıklaması + neutral mini example.
- Active planet solution verilmez.
- Eski protocol'ler çalışmaya devam eder; yeni node eski node'un upgraded replacement'ı değildir.
- New node açıldığında önceki gezegenler revisit'te kullanabilir; campaign history bozulmaz.

Sektörler ilerledikçe zorluk “daha çok node kullanmak zorundasın” değil, daha karmaşık causal reasoning olur.

---

# 65. Sector 1 Reference Regression Assertions

Bu bölüm DEV-ONLY test hedefidir; oyuncuya çözüm olarak gösterilmez.

## 65.1 HELIOS

At least two reference protocol family:

- Time-based: Night→Mine Eco; Day→Mine Normal.
- Reserve-based: Energy below low threshold→Mine Eco; Energy above high threshold→Mine Normal.

Assertions:

- 2 cycles mission pass.
- min Energy > critical requirement.
- Material/cycle ≥ mission target.
- Oxygen safe.
- Continuous Mine Eco reference **mission fail** Material target.
- No-protocol baseline night interruption occurs.

## 65.2 NIVALIS

References:

- Cold+energy aware Mine Eco + Thermal Boost.
- Controlled Reactor Boost policy.

Assertions:

- baseline no policy Habitat temp drops below objective.
- both reference families pass 2 cycles.
- continuous Reactor Boost may pass mission but Health Efficiency/Condition worse than balanced policy.

## 65.3 MOROS

References:

- condition-driven maintenance priority + mine load reduction.
- alternating Mine operation/maintenance.

Assertions:

- baseline maintenance queue grows.
- Material is not limiting initial repair.
- reference clears critical backlog without failing Material objective.
- all-mines-off fails production objective.

## 65.4 Balance regression philosophy

Reference solution failure after tuning is not automatically a bug; designer intentionally changing solution space may update test. But CI makes change explicit, preventing accidental breakage.

---

# 66. Güvenlik ve Haksızlık Önleme Kontrolleri

Bu oyun gerçek-world safety simülasyonu değil; “Safety” gameplay boyutudur. Yine de fair simulation kuralları:

- Player'ın bilmediği hidden hard threshold serious failure üretmemeli; relevant sensor/handbook/arrival info ile discoverable.
- Event generator impossible response window üretmez.
- Layout generator evacuation/travel disadvantage'ı player control dışında unfair seviyeye çıkarmaz.
- Interlock reason açıklanır.
- Resource allocation hidden random tie-break kullanmaz.
- Facility failure significant state transition öncesi Condition/Warning verisiyle okunabilir.
- Critical alert kapatıldığında persistent issue listede görünür.

---

# 67. Content Production Checklist - Yeni Facility/Event/Planet Eklerken

## 67.1 Yeni facility type

Yeni facility yalnız “aynı sayıların daha büyüğü” değil anlamlı system behavior getiriyorsa eklenir. Checklist:

- unique role var mı?
- yeni core resource gerektiriyor mu? Gerektiriyorsa product decision zorunlu.
- existing facility'yi obsolete ediyor mu?
- inputs/outputs/sensors/actions/modes/states/interlocks tanımlı mı?
- workforce/condition/maintenance meaningful mi?
- placement/visual/audio/debug profile var mı?
- asset mapping veya composite strategy var mı?
- UI natural Turkish names var mı?
- headless tests var mı?

Mk1/Mk2/Mk3 variants ayrı facility type değil config variant olmalıdır.

## 67.2 Yeni event

- source category
- predictability class
- lifecycle phases
- severity bounds
- sensor/forecast data
- gameplay effects
- visual/audio profile
- causal events
- fairness/recovery
- seeded random parameters

## 67.3 Yeni planet

17 field template + layout + content schema + localization + ≥1 reference solution + design assertions + performance asset manifest.

---

# 68. Open-Ended Systems İçin “Çözüm Önerme” Sınırı

UI ve analyzers player'a facts verir, recommendations değil.

**Allowed:**

- “Energy rezervi son 2 saatte %38 azaldı.”
- “Maden Normal modunda toplam 18 Energy/saat tüketiyor.”
- “Komut uygulanmadı: Condition güvenli Boost sınırının altında.”
- “Son 3 döngüde 14 mod değişimi kaydedildi.”

**Not allowed as automatic helper:**

- “Maden için gece Eco protokolü oluştur.”
- “Threshold'u %35 yap.”
- “Reaktörü Boost'a al.”

Optional staged Help bile diagnostic hint sınırını mümkün olduğunca korur.

---

# 69. Üretim Sırasında Karar Kaydı ve Rapor Güncelleme Kuralı

Bu belge canlı kanonik source of truth'tur. Yeni kabul edilen product decision:

1. önce kısa karar kaydı olarak issue/changelog'a yazılır,
2. ilgili v10.1+ bölümüne işlenir,
3. eski çelişkili ifade temizlenir,
4. gerekiyorsa regression test/data schema güncellenir.

Aynı konuda iki ayrı “son karar” bırakılmaz. Raporun sonuna yalnız ek yapmak yerine eski bölüm revize edilir. Böylece Codex/Claude “hangisi doğru?” sorusu yaşamaz.


# 70. v10.1 Ek Netleştirmeler - Mikro-Yönetimi Engelleyen Uygulama Kuralları

## 70.1 Player-facing direct facility control

Facility bölümünde listelenen `Actions/Actuators`, esas olarak **Protocol Action node capability**'leridir. Normal player-facing facility detail paneli bir “manuel kontrol konsolu” gibi sürekli Eco/Boost/Off butonları sunup Protocol sistemini bypass etmez.

**Varsayılan kural:** Operational mode/state/setpoint değişiklikleri active Protocol üzerinden yapılır. Planet başlangıç state'i content data'dan gelir. Eğer gelecekte belirli senaryoda tek seferlik manual commissioning/setup gerekirse capability açıkça `manualSetupAllowed` olarak işaretlenir; bu istisna genel direct-control gameplay'e dönüşmez.

Developer Tools elbette direct command inject edebilir.

Bu kural özellikle Critical State'te “pause → tesise tıkla → 12 tesisi elle kapat” spam'ini engeller ve oyuncu kimliğini sistem mimarı olarak korur.

## 70.2 Expansion construction execution

Expansion Slot'ta oyuncu yalnız mevcut seçeneklerden module **yetkilendirir**. Ardından:

1. Required Material için transaction/reservation yapılır.
2. Construction Workforce request queue'ya girer.
3. Colonists fiziksel slot'a gider.
4. Construction sim time ilerler.
5. Facility instance `underConstruction → commissioning → operational` state'lerinden geçer.
6. Yeni facility asset/layout slot içinde önceden tanımlı footprint/anchor'a yerleşir; oyuncu sürükleyemez.

Construction priority gerekiyorsa generic WorkPriority sisteminin bir task priority'si olur; ayrı “builder unit” sınıfı yoktur. MVP ilk 3 planet'te Expansion olmadığı için full construction Faz 20 AURELIA öncesi complete olmak zorunda değildir; Layout Generator slot metadata'sı Faz 4'te vardır.

## 70.3 Protocol Control Sources görünümü

Bir facility detail veya Protocol Manager üzerinden **Kontrol Kaynakları** görünümü bulunabilir. Aynı actuator/setpoint'i etkileyebilecek active protocol'leri gösterir. Bu görünüm yalnız potential source mapping'dir; actual conflict yalnız runtime aynı moment'ta incompatible command oluşursa kaydedilir.

## 70.4 Bilgiye ulaşma mesafesi

Canlı simülasyondaki temel soru mümkün olduğunca iki anlamlı interaction içinde cevaplanmalıdır. Örnek:

- “Mine-2 neden durdu?” → Mine-2 seç → Hata Ayıklamada İncele.
- “Bu tesisi hangi protocol'ler etkiliyor?” → tesisi seç → Kontrol Kaynakları/Protokolleri Gör.
- “Energy neden düşüyor?” → Energy HUD → detay/trend → ilgili Debug event link.

## 70.5 İleri sektörlerde bilgi gizleme yok

S1'de Debugger tutorial copy daha açıklayıcı olabilir; S3-S5'te aynı underlying sensor/event bilgisi kasıtlı saklanmaz. Zorluk daha çok cause depth/interaction'dan gelir, UI'nın kötüleşmesinden değil.

## 70.6 Hidden powerful node path

“Gizli güçlü node”, secret scripting veya late-game cheat benzeri bir progression path şu anda **DEFERRED**dır ve core design'a dahil değildir. Kodlama aracı bunun için hidden unlock sistemi kurmaz.

## 70.7 Assessment presentation ayrıntıları

Assessment açıldığında arka planda paused yaşayan colony world görülebilir. İlk stabilizasyon sonrası tam Assessment bir kere sunulur; daha sonra aynı colony'de yeni Best Health oluşursa küçük toast/notification yeterlidir. Success ekranında prominent “Retry” primary action değildir; başarının devamı `Kolonide Kal` / `Koloniyi Devret` üzerinden yürür.

## 70.8 Sektör sınaması genel modeli

ORPHEUS Sector 1 için kanoniktir. İleri sector'larda “system exam” benzeri final her sector'da zorunlu değildir. Sector unlock rule gerektiğinde `N stabilize planet + optional/required exam` şeklinde data-driven tanımlanabilir. Exam yeni mechanic öğretmek yerine mevcut düşünme dilini birleştirmelidir.



# 71. v10.2 Genişletilmiş Görsel Tasarım Sözleşmesi ve Ekran Tasarım Rehberi

> **Amaç:** Bu bölüm, daha önce kabul edilmiş ColonyVisualPrototype, HUD, Asset Pipeline ve Görsel Tasarım Sözleşmesi kararlarını; doğrudan uygulanabilir UI/UX ve art-direction kurallarına dönüştürür. Bu bölümün görevi “oyun yaklaşık nasıl görünmeli?” sorusunu gri alanda bırakmamaktır.

> **Öncelik kuralı:** Konsept görseller bu bölümün estetik niyetini destekler; ancak bu bölümde tanımlanan bilgi mimarisi, ekran hiyerarşisi ve sistem semantiği yazılı kanonik kurallarla birlikte bağlayıcıdır.

## 71.1 Üst seviye görsel hedef

Oyun, aşağıdaki dört hissi aynı anda vermelidir:

1. **Yaşayan koloni:** Dünya yalnız dekor değil; çalışan tesisler, yollar, ışıklar ve kolonist hareketleriyle canlı görünür.
2. **Profesyonel gözlem arayüzü:** UI bir “oyuncak HUD” değil; koloninin üstüne oturan sakin ve yetkin bir operasyon arayüzüdür.
3. **Temiz bilimkurgu:** Görünüm futuristik ama okunabilir; gereksiz süs veya agresif cyberpunk kalabalığı yoktur.
4. **Karanlık ama berrak:** Özellikle gece sahnelerinde koyu atmosfer korunur; ancak hiçbir kritik gameplay öğesi görünmez hale gelmez.

## 71.2 Estetik referans ilkesi

Uygulama, kabul edilen konsept görsellerin aşağıdaki estetik özelliklerine yaklaşmalıdır:

- koyu yarı saydam paneller
- cyan / açık mavi teknoloji vurguları
- dünya içinde sıcak iç ışık + soğuk dış çevre kontrastı
- düşük-poly / stilize ama premium görünüm
- net kenarlı, sade, güven veren bilimkurgu UI
- yaşayan koloni hissi veren ışıklar, yollar, pencere aydınlatmaları ve küçük hareketler

### 71.2.1 Konsept görsellerden alınacaklar

- atmosfer
- panel görsel dili
- ışıklandırma hissi
- butonların genel teknolojik tonu
- colony world'ün yoğunluğu ve okunabilirliği
- sağ detay paneli ve üst HUD'ın görsel yaklaşımı

### 71.2.2 Konsept görsellerden **alınmayacak** şeyler

- yazılı spesifikasyonla çelişen sekme yapısı
- yanlış node unlock sıraları
- HUD'da kanonik olmayan sürekli metrikler
- root cause veya çözüm spoiler'ı veren metinler
- kanonik olmayan yeni ekran veya gameplay kavramları

## 71.3 Global tasarım token'ları

Bu değerler product-level design token olarak kullanılmalıdır.

### 71.3.1 Renk token'ları

| Token | Amaç | Önerilen başlangıç |
|---|---|---|
| `color.bg.deep` | ana koyu arka plan | `#07131C` |
| `color.bg.panel` | panel zemini | `rgba(7,19,28,0.82)` |
| `color.bg.panel.elevated` | yükselmiş panel | `rgba(10,28,40,0.9)` |
| `color.border.soft` | panel sınırı | `rgba(84,154,195,0.20)` |
| `color.border.active` | aktif sınır | `rgba(74,190,255,0.65)` |
| `color.accent.primary` | ana vurgu | `#39BFFF` |
| `color.accent.hover` | hover vurgu | `#67D0FF` |
| `color.accent.pressed` | basılı vurgu | `#1E97D8` |
| `color.text.primary` | ana yazı | `#EAF4FF` |
| `color.text.secondary` | ikincil yazı | `#9DB7C8` |
| `color.text.muted` | üçüncül yazı | `#6E8899` |
| `color.state.success` | olumlu/dengeli | `#4FC98E` |
| `color.state.warning` | uyarı | `#E6B24A` |
| `color.state.danger` | kritik | `#E45D5D` |
| `color.state.info` | bilgi | `#61CFFF` |
| `color.world.windowWarm` | sıcak pencere ışığı | `#F5C27A` |
| `color.world.reactorCore` | reaktör çekirdeği | `#FFB45E` |
| `color.world.streetLight` | yol lambası | `#FFD8A3` |

> Exact hex değerler final değildir; ama ton ailesi ve kontrast mantığı korunmalıdır.

### 71.3.2 Tipografi token'ları

| Token | Kullanım | Başlangıç |
|---|---|---|
| `font.family.ui` | tüm UI | temiz sans-serif |
| `font.size.h1` | büyük ekran başlığı | 32-40 px |
| `font.size.h2` | panel başlığı | 24-28 px |
| `font.size.h3` | section başlığı | 18-20 px |
| `font.size.body` | normal metin | 14-16 px |
| `font.size.small` | yardımcı metin | 12-13 px |
| `font.weight.strong` | vurgu | 600-700 |
| `font.weight.regular` | normal | 400-500 |

### 71.3.3 Form token'ları

| Token | Başlangıç |
|---|---:|
| `radius.panel` | 18 px |
| `radius.button` | 14 px |
| `radius.input` | 12 px |
| `radius.badge` | 999 px |
| `panel.blur` | 12-20 px |
| `panel.border.width` | 1 px |
| `glow.accent.soft` | 0 0 0 1px rgba(57,191,255,.35), 0 0 24px rgba(57,191,255,.08) |
| `shadow.panel` | 0 18px 60px rgba(0,0,0,.32) |

### 71.3.4 Motion token'ları

| Token | Kullanım | Başlangıç |
|---|---|---|
| `motion.fast` | hover / micro UI | 120 ms |
| `motion.normal` | panel / tab / small transitions | 180 ms |
| `motion.slow` | modal / pause / major camera-linked UI | 240-280 ms |
| `easing.standard` | varsayılan | ease-out benzeri |
| `easing.emphasis` | önemli focus | hafif overshoot'suz cubic |

Reduced Motion açıkken süreler kısalır ve glow/pulse sadeleşir.

## 71.4 Buton sistemi

UI'da serbest tasarım buton kullanılmaz. Tüm butonlar aşağıdaki ailelerden gelmelidir.

### 71.4.1 Button aileleri

1. `Primary` — ana aksiyonlar
2. `Secondary` — ikincil aksiyonlar
3. `Ghost` — düşük ağırlıklı aksiyonlar
4. `Danger` — yıkıcı aksiyonlar
5. `Tab` — ekran/navigasyon sekmeleri
6. `IconButton` — küçük araç butonları

### 71.4.2 Button ölçüleri

| Aile | Height | Horizontal padding | Min width |
|---|---:|---:|---:|
| Primary | 48 px | 18-22 px | 140 px |
| Secondary | 48 px | 18-22 px | 120 px |
| Ghost | 44 px | 16-20 px | 96 px |
| Tab | 68-76 px | 24-28 px | 180 px |
| IconButton small | 40 px | square | 40 px |
| IconButton normal | 48 px | square | 48 px |

### 71.4.3 Primary button state'leri

- **Default:** koyu panel zemini üzerinde accent border + hafif accent glow
- **Hover:** border ve iç çizgi daha parlak, arka planda hafif cyan yansıma, yazı rengi sabit veya biraz parlak
- **Pressed:** glow azalır, zemin daha yoğun accent karışımı alır, 1-2 px visual sink hissi verilebilir
- **Focus-visible:** hover benzeri + net dış odak halkası
- **Disabled:** kontrast düşer, opaklık azalır, hover/press tepkisi vermez

### 71.4.4 Secondary button state'leri

- Default: panel yüzeyi + soft border
- Hover: border ve label biraz aydınlanır
- Pressed: koyu yüzey biraz içe gömülür
- Active gerekiyorsa: border accent'e yaklaşır

### 71.4.5 Tab button tasarımı

Alt navigasyon ve bazı üst seviye section tab'larında kullanılır.

- Form: geniş, yatay, merkez hizalı, köşeleri yumuşak kapsül-vari dikdörtgen
- Solunda ikon, sağında label
- Aktif tab: accent border + glow + daha aydınlık label
- Pasif tab: koyu zemin + muted text
- Hover: aktifleşmeden hafif aydınlanma
- Tab yüksekliği büyük tutulur; parmak ve game-like okunabilirlik için sıkışık yapılmaz

### 71.4.6 Hover davranışı genel kuralı

Hover'da renk değişimi **ince** olur. Görsel dil “kurumsal teknoloji” çizgisindedir; parlak oyun butonu sıçramaları yoktur.

## 71.5 Panel sistemi

Bütün paneller aynı UI ailesine ait görünmelidir.

### 71.5.1 Ortak panel özellikleri

- yarı saydam koyu yüzey
- 1 px yumuşak sınır
- düşük-orta blur
- hafif iç parlama
- net iç boşluk (padding)
- grid/taban hizalama
- başlık / alt başlık / section blokları arasında düzenli ritim

### 71.5.2 Panel iç düzen standardı

Panel içinde şu yapı sırası tercih edilir:

1. başlık alanı
2. varsa küçük özet/kimlik satırı
3. ayrılmış section blokları
4. section başlığı
5. ana veri + yardımcı açıklama
6. en altta ilgili aksiyon butonları

### 71.5.3 Desktop panel ölçü rehberi

| Panel | Önerilen genişlik |
|---|---:|
| Sağ facility/context panel | 340-400 px |
| Sol görev paneli | 280-340 px |
| Küçük popup/tooltip kartı | 220-300 px |
| Modal içerik paneli | 520-860 px |
| Pause paneli | 560-760 px |

### 71.5.4 Sağ context panel

Context panel seçili tesis/öğe için kullanılır.

Yerleşim:
- desktop'ta sağ kenara hizalı
- üst HUD altından başlar
- alt bottom nav ile çakışmaz
- safe area boşluğu korunur

İçerik yapısı:
- başlık (`Reaktör`, `Maden`, `Habitat`)
- küçük facility preview görseli veya stylized render
- `Durum`
- `Mod`
- `Condition`
- `Workforce`
- gerekirse ek local metrics
- en altta tesisle ilgili aksiyonlar

### 71.5.5 Sol görev paneli

Görev paneli sürekli dev ekran gibi görünmez; kompakt ama görünürdür.

İçerik:
- küçük `Görev` label'ı
- senaryo adı / gezegen adı
- 1-3 satırlık kısa briefing
- ilerleme satırı
- bir sonraki yüksek seviyeli yönlendirme

Kural:
- çözümü söylemez
- kök nedeni açık etmez
- oyuncuyu incelemeye iter

## 71.6 COLONY ekranı - detaylı görünüm standardı

### 71.6.1 Dünya kompozisyonu

Dünya görünümü her zaman şu okunabilirliği sağlamalı:

- ana tesislerin her biri siluet olarak ayırt edilir
- yollar birbirine bağlanan organizasyon hissi verir
- kolonistler dekor nokta değil; hareket eden işçi/yaşam izleri olarak görülür
- görsel yoğunluk yüksek olsa da hangi şeyin oynanabilir tesis, hangisinin prop olduğu ayırt edilebilir

### 71.6.2 Dünya yoğunluğu

- Facility çevresi: orta yoğunluk
- Road kenarı: düşük-orta yoğunluk
- Harita dış çeperi: daha yüksek çevresel prop kabul edilebilir
- Tıklanabilir alanların çevresi bilerek daha temiz tutulur

### 71.6.3 Yol görünümü

Yollar oyunda işlevsel altyapı hissi vermelidir.

- koyu gri/metal zemin
- ince kenar ışıkları veya yol işaretleri olabilir
- facility entrance bölgelerinde görsel açıklık bırakılır
- lambalar, küçük ikaz noktaları veya zemin işaretleri kullanılabilir

### 71.6.4 Gece sokak lambaları - yeni kanonik kural

> **MUST:** Gece veya görünürlüğün düştüğü çevresel durumlarda worldbox içindeki sokak lambaları ve yol aydınlatmaları otomatik olarak yanar.

Ayrıntı:
- gün ışığı yeterliyken kapalı veya çok sönük olabilirler
- gece başlangıcında yumuşak bir geçişle aktif olurlar
- ışık rengi soğuk mavi değil; **sıcak yumuşak beyaz / amberimsi beyaz** olmalıdır
- yol üzerinde küçük ama net ışık havuzları üretirler
- bloom abartılmaz
- lamp post'lar world readability'yi güçlendirir, sahnenin ana yıldızı olmaz
- kar/buz biyomlarında zeminde hafif yansıma verebilir
- enerji krizi veya sistem failure senaryolarında bazı aydınlatmaların sönmesi özel event olarak kullanılabilir

### 71.6.5 Pencere ve tesis ışıkları

- Habitat ve yaşanabilir tesislerde iç mekân varmış hissi veren pencere ışıkları bulunur
- Endüstriyel tesislerde çalışma ışıkları daha lokal ve fonksiyoneldir
- Reaktör çekirdeği ve enerji tesisleri daha sıcak/enerjik ışık dili kullanabilir
- Oksijen/Thermal gibi altyapı tesisleri daha teknik ve serin ışık vurgusu taşıyabilir

### 71.6.6 Seçim görseli

Seçili tesis için:
- hafif zemin outline veya perimeter highlight
- tesis dış çizgisinde yumuşak vurgu
- küçük accent glow
- kamera focus ile birlikte seçildiği anlaşılır

Aşırı neon outline kullanılmaz.

## 71.7 COLONY ekranı - HUD detayları

### 71.7.1 Top HUD

Top HUD şu mantıkta görünmelidir:

- tek yatay üst şerit
- sol tarafta ürün/oyun kimliği
- ortada ana kaynaklar ve kritik aggregate bilgiler
- sağ tarafta gezegen adı + local time + time-of-day ikonu

Önerilen sürekli öğeler:
- Enerji
- Oksijen
- Materyal
- Workforce
- Koloni Sağlığı
- gezegen adı
- yerel saat / gece-gündüz göstergesi

### 71.7.2 Top HUD item stili

Her item:
- ikon
- başlık
- ana numeric değer
- gerekiyorsa kısa progress bar
- gerekiyorsa trend işareti

Progress bar'lar ince, yatay ve köşeleri yuvarlatılmış olmalı; aşırı kalın veya arcade görünümlü olmamalı.

### 71.7.3 Bottom navigation

Alt navigasyon desktop'ta ekranın alt orta kısmında oturur.

- 3 ana sekme: `KOLONİ`, `PROTOKOLLER`, `HATA AYIKLAMA`
- büyük tab butonları
- aralarında dengeli boşluk
- panel gibi tek bir grup olarak görünür
- ekranın en altına gömülmez; alttan rahat bir boşluk bırakır

> `AĞ`, `SEKTÖRLER` veya başka meta ekranlar canlı colony bottom navigation'ında yer almaz.

### 71.7.4 Sağ panel ve sol görev paneli ile alt nav ilişkisi

- Paneller alt navigasyonu örtmez
- Alt nav selected facility context ile yarışmaz
- HUD her zaman dünyayı çerçevelemeli, boğmamalıdır

## 71.8 PROTOKOLLER ekranı - detaylı görsel tanım

### 71.8.1 Ekran karakteri

Protokoller ekranı bir geliştirici IDE'si gibi değil; oyunun kendi operasyon arayüzü gibi görünmelidir.

### 71.8.2 Genel yerleşim

Desktop standart yerleşim:
- sol: Protocol list / manager alanı
- orta: React Flow graph canvas
- sağ: selected node / protocol settings paneli
- üstte: ekran başlığı + temel aksiyonlar
- altta veya üstte: `Taslağı Kontrol Et`, `Uygula`, `Devre Dışı Bırak` gibi aksiyonlar

### 71.8.3 Sol liste paneli

- genişlik yaklaşık 280-340 px
- her protokol kartı başlık, durum rozeti, kısa açıklama, priority özeti içerir
- aktif protokoller ile taslaklar görsel olarak ayrılır
- hover'da kart hafif aydınlanır

### 71.8.4 Graph canvas

- koyu grid veya çok hafif noktalı arka plan
- düğümler kart gibi görünür
- bağlantı çizgileri temiz, fazla parlak olmayan accent tonunda
- canvas karmaşık olsa da node'lar okunur kalmalıdır

### 71.8.5 Node kartları

- her node türü aynı kart ailesinden gelir
- başlık alanı
- ikon veya küçük tip göstergesi
- kısa özet değerler
- seçildiğinde sağ panelde ayrıntı açılır
- hatalı node kırmızıyla çığlık atmaz; tehlike rengi kontrollü kullanılır

### 71.8.6 Node interaction hali

- hover: hafif border/parlaklık artışı
- selected: accent border + yumuşak glow
- disabled: opaklık azalır
- invalid: danger border + açıklayıcı tooltip/metin

## 71.9 HATA AYIKLAMA ekranı - detaylı görsel tanım

### 71.9.1 Ekran hedefi

Bu ekran bir log çöplüğü değil; anlamlı neden-sonuç inceleme alanıdır.

### 71.9.2 Yerleşim

- sol: event timeline / filtreler
- orta: seçili event özeti veya causal chain
- sağ: detay / bağlı protocol / ilgili facility

Alternatif olarak mobile'da stacked sheets kullanılır.

### 71.9.3 Event satır dili

Her event satırı şunları içerebilir:
- zaman
- kategori ikonu
- kısa özet
- severity işareti
- Applied / Blocked / Failed gibi sonuç rozeti

Hover/selection:
- satır koyu arka plan üstünde accent veya info border ile belirginleşir
- timeline içinde seçili event kaybolmaz

### 71.9.4 Causal chain kartları

Neden-sonuç zinciri küçük kartlar veya bağlantılı bloklar halinde gösterilebilir.
Görsel hedef: teknik ama sakin.

## 71.10 Gözlemci Ağı / Sektörler ekranı - detaylı görsel tanım

### 71.10.1 Ekran rolü

Bu ekran meta-progression ekranıdır. Canlı colony ekranından ayrı bir dünya/harita düzeyinde çalışır.

### 71.10.2 Genel atmosfer

- koyu uzay arka planı
- ince network çizgileri
- parlayan node'lar/gezegen bağlantıları
- temiz, premium, düşük gürültülü görünüm

### 71.10.3 Yerleşim modeli

Desktop:
- sol veya üst bölgede sektör özeti
- merkezde sector/star network
- sağda seçili gezegen kartı veya sector detail paneli
- üstte başlık ve geri navigasyon

### 71.10.4 Gezegen node görselleri

Gezegen node'ları yalnız yazı etiketi değildir; küçük görsel kimlik taşımalıdır.

Her node:
- gezegen adı
- durum (`Kilitli`, `Açık`, `Stabilize Edildi`)
- küçük sembol/rozet
- seçiliyse daha güçlü vurgu

### 71.10.5 Gezegen kartı görünümü

Seçili gezegen kartı:
- geniş küçük preview render veya concept image alanı
- gezegen adı
- kısa briefing
- öğrenilecek ana operasyon teması (spoiler vermeden)
- durum / objective summary
- `Gezegene Git` veya `Devam Et`

### 71.10.6 Gezegen preview standardı

Gezegen görselleri için kanonik görünüm:
- aynı kamera ailesi
- aynı UI tonuyla uyumlu render
- gezegeni ayırt eden çevresel kimlik
- aşırı posterimsi konsept değil; oyun içi estetiğe yakın preview

Örnek:
- HELIOS: sıcak, kurak, solar yoğun
- NIVALIS: soğuk, karlı, mavi-gri
- MOROS: kayalık, endüstriyel, yoğun maden altyapısı
- AURELIA: parlak solar altyapı + orbital gölgelenme hissi
- KEPLER: yaşam desteği vurgulu, sakin ama gergin
- ORPHEUS: birleşik lojistik/istasyon estetiği

## 71.11 Ana Menü ekranı - detaylı tasarım

### 71.11.1 Ana atmosfer

Ana menü sade ama güçlü olmalıdır.

- arka planda hafif hareketli uzay / koloni / orbital görünüm olabilir
- oyun logosu ve başlığı güçlü şekilde görünür
- ana aksiyonlar temiz dikey veya yatay bloklar halinde sunulur
- ekran çok kalabalık olmaz

### 71.11.2 Ana menü öğeleri

Minimum:
- `Devam Et`
- `Yeni Operasyon`
- `Gözlemci Ağı` veya `Kayıt Seç`
- `Ayarlar`
- `Çıkış`

İsteğe bağlı küçük öğeler:
- versiyon numarası
- lisans/credits
- son kayıt bilgisi

### 71.11.3 Menü buton tasarımı

Ana menüdeki primary butonlar in-game buton ailesiyle aynı tasarım dilini paylaşır; ancak biraz daha büyük ve sinematik olabilir.

## 71.12 Pause paneli - detaylı tasarım

### 71.12.1 Panel karakteri

Pause paneli tam ekran opak menü gibi değil; dünyayı arkada hissettiren yarı saydam bir overlay panelidir.

### 71.12.2 Overlay davranışı

- dünya hafif kararır/blur olabilir
- simülasyon durur
- UI net şekilde öne çıkar
- dramatik animasyon yerine sakin açılış kullanılır

### 71.12.3 Pause paneli içerik yapısı

Başlık: `Duraklatıldı`

Önerilen butonlar:
- `Devam Et`
- `Son Güvenli Duruma Dön`
- `Gezegeni Yeniden Başlat`
- `Gözlemci Ağı'na Dön`
- `Ayarlar`
- `Ana Menüye Dön`

Destructive aksiyonlar görsel olarak ayrışır.

### 71.12.4 Panel ölçüleri

Desktop:
- 560-760 px genişlik
- tek kolonlu veya 2 bölmeli içerik

Mobile:
- ekranın büyük bölümünü kaplayan sheet/modal
- alt safe area korunur

## 71.13 Ayarlar ekranı - detaylı tasarım

### 71.13.1 Yapı

Ayarlar ekranı sekmeli veya sol menülü olabilir.

Önerilen kategoriler:
- Görüntü
- Ses
- Oynanış
- Arayüz
- Erişilebilirlik
- Kontroller

### 71.13.2 Form elemanları

- toggles
- segmented controls
- sliders
- dropdowns
- reset to default secondary action'ı

Tüm form elemanları aynı panel ailesi ve buton ailesiyle görsel tutarlılık taşımalıdır.

## 71.14 Modal, tooltip, toast ve küçük yüzeyler

### 71.14.1 Modal

- panel ailesini kullanır
- başlık + kısa açıklama + aksiyon satırı
- destructive confirm'ler için çift onaylı sade görünüm

### 71.14.2 Tooltip

- kısa içerik
- koyu opak/yarı opak zemin
- 220-280 px tipik max genişlik
- tooltips çözüm vermez; yalnız açıklama yapar

### 71.14.3 Toast

- üst veya üst-orta güvenli bölgede
- ince panel + küçük ikon + kısa mesaj
- bilgi / başarı / uyarı / hata semantic renkleri kontrollü kullanılır

## 71.15 Assessment / Görev Sonucu ekranı - detaylı tasarım

### 71.15.1 Görsel ton

Arcade yıldız/puan ekranı gibi görünmez. Profesyonel kolonisel değerlendirme ekranı gibi görünür.

### 71.15.2 Genel yerleşim

- üstte mission sonucu / durum
- ortada ana özet ve Colony Health
- altında dört Health breakdown'u
- önemli olaylar / sustainability summary
- alt bölümde `Tekrar İncele`, `Debugger'a Dön`, `Ağa Dön` gibi aksiyonlar

### 71.15.3 Görsel yaklaşım

- sakin başarı hissi
- gereksiz konfeti veya aşırı kutlama yok
- renk dili sistem semantiğiyle tutarlı

## 71.16 Gezegen görselleri ve planet thumbnails

### 71.16.1 Thumbnail standardı

Planet thumbnail'ları:
- aynı çerçeve/oran ailelerinden gelmeli
- oyunun gerçek renderer stilini yansıtmalı
- yüksek kontrastlı ama sade kompozisyon taşımalı

### 71.16.2 Thumbnail içerik kuralı

Her thumbnail gezegenin:
- çevresel kimliğini
- ana facility hissini
- ışık tonunu
- operasyonel ruh halini

yansıtmalı; fakat çözüm veya kök neden spoiler'ı vermez.

## 71.17 Mobile tasarım yönü

### 71.17.1 Genel ilke

Mobile, desktop UI'nın küçültülmüş kopyası değildir. Aynı görsel aileyi kullanır ama bilgi yoğunluğu daha kontrollüdür.

### 71.17.2 Mobile COLONY

- top HUD daha kompakt satırlara bölünebilir
- sağ context panel bottom sheet olur
- alt nav daha yüksek ve daha rahat dokunulabilir olur
- sol görev paneli kompakt kart veya expandable sheet olabilir

### 71.17.3 Mobile protocol/debugger

- split layout yerine stacked layout
- seçili node veya event alt sheet/detail sheet'te açılır
- aynı color and panel language korunur

## 71.18 Tasarım doğrulama kontrol listesi

Bir ekran tamamlandıktan sonra aşağıdaki sorularla doğrulanmalıdır:

1. Dünya/UI aynı oyuna ait görünüyor mu?
2. Accent color aşırı mı kullanıldı?
3. Paneller dünyayı boğuyor mu?
4. Seçili öge açıkça belli mi?
5. Hover/active/disabled farkları yeterince net mi?
6. Gece sahnesinde yollar ve lambalar okunuyor mu?
7. Sokak lambaları ve pencere ışıkları sahneye yaşam katıyor mu?
8. Tooltip/panel/başlık metinleri profesyonel ama sade mi?
9. Ekran, oyunun “gözlemci” kimliğini destekliyor mu?
10. Bu ekran Reduced Motion ve düşük grafik profilinde de okunur kalıyor mu?

## 71.19 Kodlama araçları için zorunlu uygulama notu

> **MUST:** Bir UI ekranı veya world görünümü implement edilirken, geliştirici araç aşağıdaki sırayla karar verir:
>
> 1. Önce kanonik ekran bilgi mimarisine uyar.
> 2. Sonra bu bölümdeki görsel tasarım kurallarını uygular.
> 3. Sonra mevcut konsept görsellerdeki estetik yönü referans alır.
>
> Kodlama aracı, “görsel daha güzel duruyor” gerekçesiyle bilgi mimarisini, sekme sayısını, sürekli görünen metrikleri veya ürün davranışını değiştiremez.

## 71.20 v10.2 sonucu

Bu bölümle birlikte oyunun yalnız sistem tasarımı değil, **ekran ekran nasıl görünmesi gerektiği** de kanonik hale getirilmiştir. Bundan sonra üretilecek UI/world implementasyonları veya yeni konsept görseller bu görsel sözleşme ile karşılaştırılarak değerlendirilmelidir.


# 72. v10.3 Kanonik Ekran Tasarım Komutları - AI Görsel Üretimi ve UI Implementasyonu

> **Amaç:** Bu bölüm, bir görsel üretim aracına, Codex/Claude Code'a veya insan UI geliştiricisine doğrudan verilebilecek **ekran bazlı tasarım komutlarını** tanımlar. Bölüm 71'in design token'ları ve bütün önceki ürün kuralları geçerlidir.

> **MUST - Uydurma yasağı:** Aşağıdaki komutlar uygulanırken araç, belirtilmeyen yeni sekme, resource, metric, node, buton, görev, facility, rozet, yıldız puanı, root-cause metni veya gameplay özelliği ekleyemez. Boş kalan alanı dekoratif gürültüyle dolduramaz. Bir alan tanımlı değilse sade bırakılır.

> **MUST - Estetik ve semantik ayrımı:** Konsept mockup'ın estetiği kullanılabilir; fakat yazılı spesifikasyonla çelişen içerik kopyalanmaz. Görsel üretim aracı **yalnız aşağıdaki komutta belirtilen öğeleri** üretir.

## 72.1 Ortak desktop ekran komutu

Aşağıdaki komut bütün desktop mockup'ların ortak tabanıdır:

```text
1920x1080 referans çözünürlükte, koyu ve temiz bilimkurgu strateji oyunu arayüzü.
Stil: premium, sakin, profesyonel, yarı saydam koyu paneller, ince cyan/turkuaz vurgular, düşük görsel gürültü.
Ana panel zemini yaklaşık rgba(7,19,28,.82); yükselmiş paneller biraz daha opak.
İnce 1 px soft blue-gray border; aktif öğede cyan border ve çok hafif glow.
Yuvarlak köşeler: panel yaklaşık 18 px, buton 14 px, input 12 px.
Metin: temiz sans-serif, beyaz/çok açık mavi ana metin, gri-mavi ikincil metin.
Semantic renkler: bilgi cyan, uyarı amber, kritik kırmızı, başarılı/sağlıklı yeşil.
Glow yalnız seçim ve aktif kontrol vurgusunda; cyberpunk neon duvarı gibi yoğun kullanma.
Hiçbir yeni oyun mekaniği veya bilgi uydurma.
Kullanıcının verdiği ekran yapısının dışına çıkma.
```

## 72.2 COLONY - gündüz ekranı tasarım komutu

```text
GÖZLEMCİ İŞLETİM SİSTEMİ için ana KOLONİ ekranını göster.
Sabit 3/4 izometrik benzeri orthographic kamera. Kamera döndürme yok.
World ekranın açık ara en büyük alanını kaplasın; HUD dünyayı çerçevelesin, domine etmesin.
Biome gündüz görünümü: gezegene göre kar/buz, kurak kaya veya endüstriyel arazi; dünya low-poly/stilize ama premium ve detaylı.
Tesisler güçlü siluetlerle birbirinden ayırt edilsin; yollar tesis girişlerine mantıklı biçimde bağlansın.
Kolonistler küçük fakat görünür olsun; tesise yürüyen, çalışan veya bakım yapan gerçek simülasyon temsilcileri gibi görünsün.
Dekor oynanabilir tesislerden daha düşük görsel öneme sahip olsun.

Üst HUD: yaklaşık 72-80 px yüksekliğinde tek koyu yarı saydam şerit.
Sol: Gözlemci ürün/oyun kimliği ve küçük ikon.
Orta: yalnız Energy, Oxygen, Material, Workforce ve genel Colony Health aggregate değerleri.
Her resource öğesinde küçük ikon, başlık, ana değer, ince progress/trend gösterimi.
Sağ: gezegen adı, local time, day/night ikonu, Pause/x1/x2/x4 kontrolleri.
Dört Health alt skoru sürekli HUD'da gösterme.

Sol alt/sol orta: 280-340 px genişliğinde kompakt Görev paneli. Yalnız bilinen semptom ve mission progress; root cause veya çözüm yok.
Sağ: yalnız bir tesis seçiliyse 340-400 px context panel. Başlık, facility preview, Durum, Mod, Condition, Workforce, ilgili input/output ve tesis aksiyonları.

Alt orta: yalnız üç büyük tab: KOLONİ, PROTOKOLLER, HATA AYIKLAMA.
AĞ veya başka dördüncü tab ekleme.
Aktif KOLONİ tabında cyan border + soft glow.

Seçili tesis: zeminde ince cyan perimeter ve hafif edge highlight. Büyük neon outline kullanma.
Gündüz sokak lambaları kapalı veya çok sönük; pencere ve facility function lights yalnız gerektiği kadar görünür.
```

## 72.3 COLONY - gece ekranı tasarım komutu

```text
KOLONİ ekranının aynı layout ve kamera kompozisyonunu gece göster.
UI yerleşimi gündüz sürümüyle birebir aynı kalmalı.
Dünya koyu mavi/soğuk gri gece tonlarında; gameplay okunabilirliği korunmalı.
Habitat pencereleri ve çalışan tesislerin fonksiyon ışıkları sıcak amber/beyaz kontrast versin.

MUST: Yol ve sokak lambaları gece otomatik yanmış olsun.
Lamp post ışıkları sıcak yumuşak beyaz/amber tonunda küçük, kontrollü ışık havuzları oluştursun.
Lambalar yolları ve facility entrance'ları okunabilir hale getirsin; bloom düşük olsun.
Kar/buz zeminde çok hafif ışık yansıması olabilir.
Lambalar sahnenin ana görsel öğesi olmasın.

Reaktör gibi aktif tesislerde state'e uygun emissive görülsün.
Offline tesisler daha karanlık ve mekanik olarak durgun görünsün.
Boost tesisi Normal'den daha aktif fakat tehlike alarmı gibi abartılı görünmesin.

HUD metinleri ve paneller gece sahnesinden net biçimde ayrışsın; panel opaklığını gereksiz yükseltme.
```

## 72.4 Facility context panel tasarım komutu

```text
Sağ kenarda 340-400 px genişliğinde, üst HUD ile alt navigation arasında kalan yarı saydam koyu facility paneli.
Başlık satırı: facility adı, küçük kategori ikonu, kapatma X.
Başlığın altında 16:9 veya yaklaşık 2:1 facility preview alanı.
Sonra section blokları:
- DURUM
- MOD (facility destekliyorsa)
- CONDITION
- WORKFORCE (gerekiyorsa)
- ilgili facility-specific 1-3 metric
- ilgili aksiyonlar
Her section ince separator ile ayrılmış olsun.
Exact sayılar panelde; dünya üzerinde sayı yığını kullanma.
Primary action cyan accent; destructive action yalnız gerçekten destructive ise kırmızı.
Hover'da buton border ve arka plan hafif aydınlansın, boyut sıçraması yapmasın.
```

## 72.5 PROTOKOLLER - Protocol Manager ekranı tasarım komutu

```text
PROTOKOLLER ana ekranı doğrudan graph editor olarak açılmasın; önce Protocol Manager görünümü olsun.
Koyu bilimkurgu UI, Bölüm 71 design token'ları.

Üst başlık alanı: PROTOKOLLER ve kısa açıklama; sağda Yeni Protokol aksiyonu.
Ana içerik: protokol kartlarının temiz liste/grid görünümü.
Her kartta yalnız:
- protokol adı
- Active / Disabled / Draft durumu
- Priority
- otomatik kısa özet
- etkilediği sistem/facility özeti
- son execution status/time
MVP'de folder/grup sistemi gösterme.

Aktif protokol kartı soft cyan border.
Draft kartında daha nötr amber/secondary vurgu kullanılabilir.
Disabled kart muted.
Hover'da kart arka planı ve border hafif aydınlansın; glow minimal.
Kart seçildiğinde Düzenle / Çoğalt / Devre Dışı Bırak gibi mevcut kanonik aksiyonlar görünür hale gelebilir.

Alt main navigation yalnız KOLONİ / PROTOKOLLER / HATA AYIKLAMA; PROTOKOLLER aktif.
```

## 72.6 PROTOKOLLER - Graph Editor ekranı tasarım komutu

Bu ekran için kullanıcı tarafından onaylanan son protokol mockup'ının görsel yönü temel alınır; ancak node içerikleri kanonik kurallara uyar.

```text
GÖZLEMCİ İŞLETİM SİSTEMİ için tam ekran PROTOKOL DÜZENLEYİCİ oluştur.
Koyu, profesyonel sci-fi workflow editor; cyan accent; az ve kontrollü glow.

Desktop yerleşimi:
- sol panel 300-340 px: Protocol list / hızlı geçiş + Yeni Protokol
- merkez kalan en büyük alan: graph canvas
- sağ panel 340-380 px: seçili Düğüm Ayarları
- üstte protokol adı, Active/Draft durumu, Kontrol Et ve Uygula aksiyonları, zoom/undo-redo
- altta ana üç-tab navigation

Graph canvas: çok koyu mavi-gri zemin, çok hafif dot/grid; düğümlerin arkasında dikkat dağıtıcı yıldız/uzay görseli kullanma.
Node kartları yaklaşık 170-220 px genişlikte, sade, modüler, aynı aileden.
Bağlantı portları küçük ama görünür cyan noktalar; dokunma hitbox'ı görünenden büyük olabilir.
Edges ince, temiz ve hafif cyan; kesişimlerde görsel karmaşa yaratma.

Node görsel türleri:
- Trigger: mavi/cyan kimlik
- Sensor/Data: teal/mavi-gri
- Compare/logic: cyan/blue
- Delay/flow: amber veya nötr vurgu
- Action: amber/cyan karışımı veya hedef facility identity, ancak çok renkli yapma

Selected node: accent border + soft glow.
Hover: border hafif aydınlanır.
Invalid node: kontrollü kırmızı border + doğal Türkçe hata açıklaması.

S1 mockup üretiliyorsa yalnız Karşılaştır + VE + Geciktir general logic node'ları göster; VEYA/DEĞİL/Sayaç/Splitter ekleme.
Folder veya "Protokol Grupları" ekleme.
Yeni resource, savunma sistemi veya kanonik olmayan node uydurma.

Sağ Düğüm Ayarları paneli:
- node ikon + adı + kısa açıklama
- yalnız o node'a ait gerçek editable alanlar
- natural Turkish labels
- en altta gerekiyorsa Düğümü Sil danger button
Oyuncuya teknik Boolean/execution pulse jargonu gösterme.
```

## 72.7 HATA AYIKLAMA ekranı tasarım komutu

```text
HATA AYIKLAMA ekranını bir developer console değil, profesyonel causal analysis workspace olarak tasarla.
Koyu panel dili ve cyan accent aynı kalmalı.

Desktop üç-bölge düzeni:
- sol 300-340 px: Event Timeline + kategori/filtreler
- orta en büyük alan: seçili olayın causal chain / olay özeti
- sağ 340-380 px: detay, ilgili facility/protocol, ölçülen değerler ve linkler

Event satırında: simTime, kategori ikonu, kısa natural Turkish özet, severity ve Applied/Blocked/Failed gibi sonuç.
Her resource tick'i gösterme.
Selected event cyan/soft info highlight; critical event kırmızı metin duvarı değil, küçük danger semantic vurgu.

Orta causal chain: kartlar veya bağlantılı bloklar halinde "Ne oldu?", "Buna ne yol açtı?", "Bu neye yol açtı?" ilişkisini okunabilir göster.
Debugger çözüm önerisi üretmesin.
"Şu protokolü kur" gibi metin kullanma.

Sağ panelden ilgili tesise veya protokol execution'ına Git/Göster linkleri olabilir.
Alt nav yalnız üç ana tab; HATA AYIKLAMA aktif.
```

## 72.8 Gözlemci Ağı - Sektörler ekranı tasarım komutu

```text
Canlı COLONY'den ayrı meta-progression ekranı: GÖZLEMCİ AĞI.
Koyu derin uzay arka planı; çok hafif yıldız alanı ve ince teknolojik grid/network çizgileri.
Bu ekran uzay gemisi navigasyon simülatörü gibi görünmesin; koloni bağlantı ağı gibi görünmeli.

Merkez: sektör içindeki gezegen node'ları ve görsel network bağlantıları.
Gezegenler gerçekçi küçük planetary sphere/render olabilir; her biri farklı biome kimliği taşısın.
Node altında: gezegen adı + durum (Kilitli / Açık / Stabilize Edildi).
Bağlantı çizgileri prerequisite anlamına gelmediği sürece yalnız görsel ağ ilişkisi olarak okunmalı.

Sol üst veya sol panel: Sektör adı, stabilize edilen / toplam koloni, completion % ve sector state.
Sağ panel 360-420 px: seçili gezegen preview kartı.
Preview kartında:
- 16:9 oyun estetiğine yakın planet/colony görüntüsü
- planet adı
- bilinen semptomlar / operasyon koşulları
- stabilize durumu
- varsa Devir Health / Best Health secondary bilgi
- Gezegenle Bağlantı Kur / Devam Et primary action
Root cause veya çözüm yazma.
Star rating kullanma.

Gözlemci Ağı canlı colony bottom navigation'ının dördüncü sekmesi değildir; kendi meta ekranıdır.
```

## 72.9 Sektör seçimi ekranı tasarım komutu

```text
GÖZLEMCİ AĞI içinde bir üst seviye SEKTÖRLER seçimi göster.
Arka plan aynı koyu uzay/network dili.
Sektörler büyük kart/node kümeleri olarak görünmeli; her sektörün kendine ait çok hafif çevresel renk tonu olabilir ama ana cyan UI dili bozulmaz.

Her sektör kartı:
- sektör adı
- kısa tema
- stabilize count / total
- completion %
- Locked / Open / Complete
- sonraki sektör için gereken koşul özeti

Kilitli sektörler tamamen gizlenmez; erişilemez olduğu net ama gelecekteki yapı hissi verir.
Skill tree veya satın alma düğümleri gibi görünme.
```

## 72.10 Gezegen preview / planet card tasarım komutu

```text
Tek bir gezegen seçildiğinde 360-420 px genişliğinde premium sci-fi preview card.
Üstte geniş 16:9 veya 3:2 planet/colony preview image.
Altında planet adı ve kısa location/sector label.
Sonra yalnız bilinen bilgiler:
- gözlenen semptom
- operasyon koşulları
- stabilized / active / locked state
- gerekiyorsa Devir Health / Best Health
Alt kısımda tek net primary action: Bağlan / Devam Et.

Görsel preview o gezegenin biome kimliğini açıkça vermeli:
HELIOS sıcak/kurak/solar; NIVALIS soğuk/karlı/mavi-gri; MOROS kayalık/endüstriyel; AURELIA parlak solar; KEPLER life-support odaklı; ORPHEUS istasyon/lojistik.
Root cause, çözüm, doğru tesis seçimi, spoiler objective yazma.
```

## 72.11 Ana Menü tasarım komutu

```text
GÖZLEMCİ İŞLETİM SİSTEMİ ana menüsü.
Sade ve premium; ekranı butonlarla doldurma.
Arka plan: düşük hareketli uzak koloni/orbital uzay sahnesi veya karanlık gezegen ufku. Metnin okunmasını engellemesin.
Sol/orta ana bölümde oyun adı/logo ve dikey ana aksiyonlar.

Menü seçenekleri ürün durumuna göre:
- Devam Et (save varsa)
- Gözlemci Ağına Gir / Yeni Başlangıç
- Ayarlar
- Gözlemci El Kitabı (uygunsa)
- Çıkış (platform uygunsa)

Primary CTA cyan accent; diğerleri secondary/ghost.
Arka planda büyük oyun fragmanı, karakter portresi veya kanonik olmayan lore karakteri ekleme.
Oyuncu zaten Gözlemci; ayrı konuşan AI maskotu göstermeme.
Alt köşede küçük versiyon bilgisi olabilir.
```

## 72.12 Bağlantı / Loading ekranı tasarım komutu

```text
Gezegene geçişte kısa "Bağlantı kuruluyor" ekranı.
Koyu uzay/network arka planı; merkezde seçili gezegenin küçük orbital silueti veya wire/network halkası.
Tek ana metin: "Bağlantı kuruluyor..." ve alt küçük progress/phase text.
Yükleme tamamlandığında "Koloni ağına bağlandı" kısa state'i.
Tekrar girişlerde uzun sinematik yapma; atlanabilir/kısa.
Loading sırasında gameplay tip veya çözüm ipucu gösterme.
```

## 72.13 Varış Durum Raporu tasarım komutu

```text
Gezegene ilk bağlantıda diegetic operasyon raporu ekranı.
Dünya veya gezegen görüntüsü arka planda düşük kontrastlı kalabilir.
Merkezde 700-900 px genişliğinde büyük rapor paneli.
Başlık: gezegen adı + DURUM RAPORU.
İçerik: gözlenen semptom, süre, etki, bilinen operasyon koşulları.
Kök neden veya çözüm yok.
Alt primary action: Koloniye Bağlan / İncelemeye Başla.
Optional small secondary: Gözlemci El Kitabı.
Rapor askeri brifing kadar ağır değil; profesyonel sistem raporu görünümü.
```

## 72.14 Pause paneli tasarım komutu

```text
Simulation pause edildiğinde canlı dünya arkada kalmaya devam etsin; koyu translucent overlay + hafif blur/dim uygula.
Merkezde 560-700 px genişliğinde yarı saydam elevated panel.
Başlık: DURAKLATILDI.
Panel simetrik, sakin ve hızlı okunur olsun.

Buton sırası:
- Devam Et (Primary)
- Gözlemci Ağına Dön
- Gözlemci El Kitabı
- Ayarlar
- Ana Menü

Collapse/recovery bağlamında açılmadıkça "Son Güvenli Duruma Dön" veya "Gezegeni Yeniden Başlat" normal pause paneline ekleme.
Kaydetme autosave sistemiyle çözülüyorsa "Kaydet" spam butonu ekleme.
Destructive/exit seçimleri neutral secondary; gerekiyorsa confirmation modal açar.
```

## 72.15 Ayarlar ekranı tasarım komutu

```text
Ayarlar ekranı koyu, sade, form yoğunluğu kontrollü bir sistem paneli.
Desktop iki sütun:
- sol 220-260 px category navigation
- sağ fluid settings content
Kategoriler: Görüntü, Ses, Oynanış, Erişilebilirlik, Dil; Kontroller yalnız gerçekten destekleniyorsa.

Her setting satırı: label + kısa helper text + sağda native/sade control.
Toggles cyan active, muted inactive.
Sliders ince ve temiz.
Dropdown/input'lar panel ailesiyle aynı radius/border.
Hover: satır çok hafif aydınlanır; tüm panel glow olmaz.
Alt bölümde Varsayılanlara Dön secondary action.
30 adet ileri grafik toggle ile ekranı doldurma; Low/Medium/High profile temel olmalı.
```

## 72.16 Bildirim / Alert paneli tasarım komutu

```text
Aktif Alert/Bildirim paneli koyu, kompakt ve taranabilir.
Panel yaklaşık 360-420 px genişlikte sağ üst veya top HUD alert count'tan açılır.
Her satır:
- semantic ikon
- kısa başlık
- zaman
- severity
- bir satır açıklama
- gerekiyorsa Göster linki

Info cyan, warning amber, critical red; renk yalnız destekleyici, label/ikon da bulunur.
Satır hover'da soft border/background highlight.
Bütün history log'unu burada gösterme; ongoing/relevant alerts.
Toast ile panel farklı kavramdır.
```

## 72.17 Toast tasarım komutu

```text
Kısa transient bildirimler üst-orta güvenli alanda veya HUD altındaki uygun boşlukta stack edilir.
300-420 px genişlik, 48-72 px tipik yükseklik.
Koyu yarı saydam panel, küçük semantic ikon, kısa tek/iki satır text.
Success/Info/Warning/Error semantic accent ince sol border veya ikonla verilir.
Ekranın ortasını kapatma.
Animasyon: kısa fade + küçük translate; Reduced Motion'da yalnız fade.
```

## 72.18 Assessment / Stabilizasyon sonucu ekranı tasarım komutu

```text
Başarı ekranı arcade game result screen gibi değil; profesyonel koloni değerlendirmesi gibi görünmeli.
Arka planda stabilize olmuş yaşayan koloni pause edilmiş veya çok yavaş hareketli biçimde görünür kalabilir.
Önde 760-1000 px genişliğinde büyük elevated panel.

En üst vurgu: STABİLİZE EDİLDİ.
Health ikincil önem.
Göster:
- Mission Conditions sonucu
- Sustainability cycles
- genel Colony Health
- dört Health boyutu
- 5-6 anlamlı operational metric
- isteğe bağlı En Kritik An / Debugger linki
- Devir / Current / Best Health gerekiyorsa

Yıldız rating, harf notu (A/B/C), XP veya loot ödülü ekleme.
Alt aksiyonlar: Kolonide Kal, Koloniyi Devret, Hata Ayıklama Özeti.
Başarı hissi sakin cyan/green vurgu ve temiz tipografiyle verilsin; konfeti yok.
```

## 72.19 Colony Health detail panel tasarım komutu

```text
Top HUD'daki Colony Health tıklandığında açılan detay paneli.
Genel Health büyük değer olarak en üstte.
Altında dört eşit section: Nüfus, Kararlılık, Verimlilik, Güvenlik.
Her section: score, qualitative label, kısa simulation-derived neden açıklaması.
Gerekirse küçük trend bar/mini history; büyük dashboard chart kullanma.
Çözüm önerme; yalnız neden/ölçüm açıkla.
```

## 72.20 Resource detail panel tasarım komutu

```text
Energy/Oxygen/Material HUD item'ına tıklanınca contextual detail panel.
Başlık + current/capacity + trend.
Altında üretim, tüketim, net değişim ve kapasiteye katkı veren temel kaynaklar.
İlgili facility listesi kompakt ve tıklanabilir olabilir.
Grafik gerekiyorsa küçük son-cycle trend graph; ekranı analitik dashboard'a dönüştürme.
Debugger'a ilgili olaylara geçiş linki bulunabilir.
```

## 72.21 Gözlemci El Kitabı tasarım komutu

```text
El Kitabı ekranı oyunun aynı panel dilinde temiz referans/yardım görünümü.
Desktop:
- sol 260-300 px topic navigation/search
- orta reading content
- sağ optional related concepts; gerekmezse boş bırak
Yalnız oyuncunun karşılaştığı/unlocked kavramlar gösterilebilir.
Kısa neutral örnekler kullan; aktif gezegenin çözümünü söyleme.
Grafik/diagram varsa cyan çizgi ve sade node kutuları kullan.
```

## 72.22 Colony Network - tamamlanan koloniler arşivi tasarım komutu

```text
Gözlemci Ağı'ndan erişilen tamamlanmış koloniler history/archive ekranı.
Koyu network/space dili korunur ancak campaign seçim ekranından daha arşivsel görünür.
Koloni kartları: planet thumbnail, Devir tarihi/sim zamanı, Devir Health, Best Health, stabilize state.
Kart seçilince sağ panelde Assessment özeti ve "Koloniyi Yeniden Aç" gibi kanonik revisit aksiyonu.
Campaign progression kararlarını burada tekrar üretme; bu ekran "Ne yaptım?" sorusunu cevaplar.
```

## 72.23 Collapse Analysis ekranı tasarım komutu

```text
Koloni Çöküşü sonrası ekran panik kırmızı game-over ekranı gibi görünmesin.
Başlık: KOLONİ ÇÖKÜŞÜ / ÇÖKÜŞ ANALİZİ.
Arka plan dünya karartılmış ve pause edilmiş.
Ana panelde:
- collapse condition
- ana causal chain summary
- en kritik olaylara debugger linki
- Son Güvenli Duruma Dön
- Gezegeni Yeniden Başlat
- Sektöre Dön
Kırmızı yalnız kritik semantic vurgu; tüm ekranı kırmızıya boyama.
Campaign cezası/XP kaybı ekranı ekleme.
```

## 72.24 Mobile ortak tasarım komutu

```text
Desktop ekranı küçültme; aynı bilgi hiyerarşisini mobile presentation'a dönüştür.
Portrait referans genişliği 390-430 CSS px.
Touch hedefleri minimum 44-48 px.
COLONY: iki compact top status line + 4-cell resource strip; world merkezde; detail'ler bottom sheet; simulation controls bottom nav üstünde; üç-tab nav en altta.
Protocol/Debugger: split columns yerine list -> detail veya graph -> bottom-sheet settings akışı.
Right panel kullanma; landscape genişliği yeterliyse responsive olarak right panel'e dönebilir.
Safe-area inset'leri koru.
Horizontal scroll'u normal UI'da kullanma.
```

## 72.25 Hover / focus / pressed durumlarının tüm ekranlarda zorunlu görünürlüğü

Her interaktif öğe şu state'leri ayırt etmelidir:

| State | Görsel davranış |
|---|---|
| Default | neutral dark surface + soft border |
| Hover | background %5-10 kadar daha aydınlık; border accent'e yaklaşır |
| Focus-visible | net dış focus ring; hover'dan daha belirgin |
| Pressed | background bir kademe koyulaşır/yoğunlaşır; glow azalır |
| Active/Selected | persistent accent border + soft cyan glow |
| Disabled | muted text/border, düşük opacity, interaction feedback yok |
| Warning | amber icon/border destekleyici |
| Critical | red icon/border destekleyici; tüm yüzey kırmızı değil |

> Hover'da öğe boyutu değiştirilmez; layout shift yaratılmaz.

## 72.26 Ekran üretiminde yasak görsel alışkanlıklar

- aşırı bloom / neon
- tam ekran sürekli vignette ile bilgi karartma
- her paneli farklı radius/stille çizme
- world üstünde her facility için sürekli label ve sayı
- dört Health alt skorunu sürekli top HUD'a doldurma
- canlı COLONY alt nav'ına AĞ/AYARLAR gibi dördüncü-beşinci tab ekleme
- sector kartında root cause veya çözüm gösterme
- Assessment'ta yıldız, A/B/C notu, loot veya XP ekleme
- Protocol ekranında unlock edilmemiş node gösterme
- sırf boşluk var diye yeni widget, chart veya metric ekleme
- dünya gece olduğunda bütün sahneyi okunamayacak kadar karartma
- street light glow'u gameplay'in önüne geçirme
- pause/menu ekranında kanonik olmayan save slot/mikro-management butonları ekleme

## 72.27 AI görsel üreticisine verilecek son kontrol cümlesi

Her ekran görsel komutunun sonuna aşağıdaki talimat eklenmelidir:

```text
STRICT COMPLIANCE: Sadece yukarıda listelenen ekran öğelerini üret. Yeni buton, sekme, kaynak, sayaç, node, karakter, görev, puanlama sistemi, root-cause metni veya dekoratif UI widget'ı ekleme. Boş alanları sade bırak. Yazılı yerleşim ve bilgi mimarisini değiştirme. Estetik kararları belirtilen design token'ları içinde tut.
```

## 72.28 Kodlama araçları için implementasyon kontrolü

Bir ekran tamamlandığında Codex/Claude Code şu checklist'i uygulamalıdır:

1. Ekrandaki bütün görünür control ve metric'ler kanonik mi?
2. Bölüm 71 token'ları uygulanmış mı?
3. Hover/focus/pressed/disabled state'leri mevcut mu?
4. Responsive/mobile presentation tanımlı mı?
5. World ekranlarında UI Safe Viewport hesaplanıyor mu?
6. Gece street light / window light davranışı simulation time'dan mı türetiliyor?
7. Yeni semantic/gameplay bilgisi UI katmanında icat edilmiş mi? Edilmişse kaldır.
8. Low graphics / Reduced Motion altında bilgi kaybı oluyor mu?
9. Player-facing metinler localization key'den mi geliyor?
10. Ekran kanonik navigation hiyerarşisini bozuyor mu?

## 72.29 v10.3 sonucu

Bu bölümle birlikte ana oyun ekranlarının yalnız genel estetik yönü değil, **AI'a veya geliştiriciye doğrudan verilecek ekran-bazlı tasarım komutları** da kanonik hale gelmiştir. Tasarım üretirken veya UI implement ederken araçların doğaçlama yapması yerine bu komutları kullanması gerekir.
