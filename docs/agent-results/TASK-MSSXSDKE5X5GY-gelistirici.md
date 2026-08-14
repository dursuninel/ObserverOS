# TASK-MSSXSDKE5X5GY — Faz 6/3: Draft/Apply akışı + Kontrol Et validation entegrasyonu

**Ajan:** Geliştirici · **Tarih:** 2026-08-15 · **Branch:** `main` · **Sprint:** SPRINT-FAZ-6

---

## 1. Ne yapıldı

Editör Faz 5 çekirdeğine bağlandı: `Kontrol Et` gerçek doğrulamayı çalıştırıyor, `Uygula`
protokolü koşan simülasyona alıyor. Faz 5'in validator/compiler/runtime'ı **yeniden yazılmadı**,
çağrıldı.

**a) Capability köprüsü** — `src/game/simulation/protocol/protocolCapabilityBridge.ts` (yeni)
- `buildProtocolCapabilities()` yetkili durumdan `ProtocolCapabilities` üretir: tesis listesi
  `SimulationConfig`'ten, eylem listesi `FACILITY_ACTUATORS`'tan, "şu anki değer" tablosu
  (§53.3 `action-value-unchanged`) anlık snapshot'tan, `activeActionClaims` (§53.3
  `potential-conflict`) yalnız `active` protokollerden.
- `createProtocolSensorReader()` runtime'ın tick içinde çağırdığı ölçüm okuyucusudur.
- **GEÇİCİ OLDUĞU AÇIKÇA YAZILI:** kanonik ölçüm kataloğu Faz 8 (HELIOS içeriği) işidir.
  Köprü **yeni ölçüm kimliği uydurmaz** — yalnız Faz 5'te zaten kullanılan iki kimliği taşır
  (`facility-condition`, `energy-level`). Bunu bir test kilitliyor.
- `set-setpoint` bilinçli olarak dışarıda: değeri `{key,value}` nesnesi, protokol literal'i değil;
  kanonik setpoint anahtar kataloğu yok → uydurulmuş anahtar yerine eylem hiç sunulmuyor.
- Mod eylemi yalnız tanımında `modes` olan tesiste görünür (Batarya/depo mod değiştirmez).

**b) Motor ucu** — `SimulationEngine.setProtocolPrograms()` (+ `getProtocolPrograms`, `canRunProtocols`)
- Koşan program kümesi artık kurulum sabiti değil, oyun sırasında değiştirilebilir.
- Yalnız program listesi değişir; **saat/hız/tesis durumu ellenmez → `Uygula` duraklatmaz** (satır 1060).
- Ölçüm okuyucusu olmayan motorda sessizce yutulmaz, hata fırlatır.
- `SimulationProvider` motoru ölçüm okuyucusuyla kurar ve kitaplık değiştikçe `active`
  protokolleri derleyip motora verir. Faz 6/1-6/2'de protokoller **hiç koşmuyordu**; artık koşuyor.

**c) Draft/Apply durum makinesi** — `src/game/ui/protocols/protocolDraftModel.ts` (yeni, saf)
- `Kontrol Et` = `validateProtocol` + kapabilite; **gelecek sonucu çözmez**, simülasyonu ilerletmez (satır 1059).
- Her düzenleme raporu bayatlatır → `Uygula` `unchecked` gerekçesiyle kapanır.
- Hata varsa `invalid`; **yalnız uyarı varsa `Uygula` AÇIK kalır** (§53.3).
- `Uygula` → `lifecycle: active`, sürüm +1. `Taslağı Kaydet` yayına almaz, yayındakini de düşürmez.
- `compileActiveProtocols()` derlenemeyen protokolü koşan kümeye almaz, kimliğini raporlar.

**d) Düğüm Ayarları paneli düzenlenebilir oldu** — `protocolNodeFields.ts` + `ProtocolNodeSettings.tsx` (yeni)
- Alanlar tasarım §12.4 tablolarından, **yalnız `Protocol.ts`'teki gerçek alanlardan** türetiliyor.
  Seçenek listeleri capability'den geliyor; tesis/ölçüm/eylem adı uydurulmuyor.
- VE düğümünde sahte alan yok. Değer gerektirmeyen eylemde "Değer" alanı hiç çizilmiyor.
- Karşılaştır "Başka bir ölçümle"ye geçince `İkinci değer` girişi doğuyor; "Sabit değer"e dönünce
  o uca bağlı kenar da düşüyor (`updateProtocolNode`) — yoksa editörde kurulamayan bir kenar
  doğrulamada `edge-port-incompatible` olarak geri gelirdi.
- Eylem değiştirilince eski değer taşınmıyor (yeni ayarın kabul ettiği küme farklı).

**e) Bulguların görsel karşılığı (tasarım §17)**
- Sonuç şeridi (§17.3): temiz / "n sorun bulundu" + ilk üç bulgu + "Düğüme git" / "n uyarı ·
  Yine de uygulanabilir."
- Hata düğüm sınırını kırmızıya çeker, uyarı yalnız alt şerit ekler — **error/warning görsel
  olarak ayrı** (satır 1058). Kenarlar da hata/uyarı sınıfı alıyor.
- Seçili düğümün bulguları sağ panelde de listeleniyor.

**f) `+ Yeni Protokol`** — Manager'a eklendi (`nextProtocolId`, `createProtocolDraftDefinition`).
Kapsam notu: Faz 6 çıkış kriteri (satır 3237) "protokol **oluşturup** apply edebilir" diyor;
oluşturma yüzeyi 6/1'de yoktu, bu düğme olmadan DoD'un "kod yazmadan uçtan uca oluştur→uygula"
maddesi kapanmıyordu. Boş taslak doğuyor, düğüm uydurulmuyor.

**g) Türkçe metin** — Faz 5'in `protocol.error.*` / `protocol.warning.*` anahtarları zaten vardı,
yeniden yazılmadı. Yeni UI metinleri `tr.ts`'e eklendi. Kod adı oyuncuya gösterilmiyor.

---

## 2. Kanıt

### 2.1 Kapılar (gerçek çıktı)

```
> npm run typecheck
> tsc -b --pretty false
(çıktı yok, exit 0)

> npm run lint
> eslint .
(çıktı yok, exit 0)

> npm test
 Test Files  42 passed (42)
      Tests  483 passed (483)
   Duration  10.88s

> npm run build
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-BQ29qAip.css     39.79 kB │ gzip:   7.66 kB
dist/assets/index-CUHGCTOg.js   1,619.99 kB │ gzip: 466.25 kB
✓ built in 4.17s
```

Baseline **443 → 483** (+40 test). Hiçbir test silinmedi/gevşetilmedi;
`tests/architecture/moduleBoundaries.test.ts` değişmedi.

Yeni test dosyaları:
- `tests/simulation/protocolCapabilityBridge.test.ts` (10) — katalog uydurma yapmıyor, yayındaki
  5 protokolün hepsi kapabilite hatasız doğruluyor, okuyucu yalnız yetkili snapshot'tan okuyor.
- `tests/ui/protocolDraftApply.test.ts` (19+2) — durum makinesi, alan modeli ve **kod yazmadan
  uçtan uca akışın başsız provası**.
- `tests/simulation/protocolApplyRuntime.test.ts` (6) — koşarken uygulanan protokol gerçekten
  çalışıyor, uygulama duraklatmıyor/başlatmıyor, kaldırılan protokol susuyor.
- `tests/localization/*` genişletildi: her bulgu kodunun Türkçe cümlesi var ve kod sızmıyor;
  her düğümün her alan/seçenek etiketi çözülüyor.

### 2.2 Gerçek etkileşim (gerçek tıklama + gerçek sürükleme, sentetik olay yok)

`node scripts/faz6-3-e2e.cjs` — playwright-core + sistemdeki Chrome, dev server 5173.
Tam çıktı: `docs/agent-results/TASK-MSSXSDKE5X5GY-screenshots/e2e-cikti.txt`

```
1) PROTOKOLLER acildi · <title>="Gözlemci İşletim Sistemi"
2) Yeni protokol olusturuldu · url=http://localhost:5173/protocols/protokol-1
   durum rozeti="Taslak"
3) Kontrol Et oncesi Uygula kapali mi: true
   kapali olma gerekcesi="Önce Kontrol Et ile doğrulayın."
   sonuc="1 sorun bulunduProtokolde başlangıç tetikleyicisi yok; otomasyon kendiliğinden başlayamaz.Sonucu kapat"
   Uygula hala kapali mi: true
4) Tetikleyici alanlari secildi (Maden · kondisyon · altina duserse · 99)
5) Eylem alanlari secildi (Maden · calisma modu · Eco)
6) Gecersiz baglanti denendi · aciklama="Bu iki bağlantı noktası farklı türde bilgi taşıyor; birbirine bağlanamaz."
   kurulan baglanti sayisi=0
7) Gecerli baglanti kuruldu · baglanti sayisi=1
8) Kontrol Et="Protokol uygulanmaya hazır."
   Uygula acildi mi: true
9) Uygula sonucu="Protokol uygulandı; simülasyonda çalışmaya başladı."
   durum rozeti="Aktif"
10) Uygula sonrasi saat: 10 -> 33 sim. dk. · durum="ÇALIŞIYOR"
11) Maden modu="Eco (Tasarruf)" (sim. dk. 243) — protokol komutu yetkili duruma islendi
12) Kart "SON CALISMA"="Tetiklendi · 1. gün 04:01"
13) Konsol hatasi sayisi=1  (/favicon.ico 404 — Faz 6/2'den beri var, tarayıcının kendi isteği)
```

Ekran görüntüleri (`docs/agent-results/TASK-MSSXSDKE5X5GY-screenshots/`):
`01-manager` · `02-yeni-bos-protokol` · `03-kontrol-et-bos-graf` · `04-tetikleyici-alanlari` ·
`05-eylem-alanlari` · `06-gecersiz-baglanti-turkce` · `07-kontrol-et-temiz` · `08-uygulandi` ·
`09-simulasyon-duraklamadi` · `10-koloni-maden-eco` · `11-manager-son-calisma`

**En güçlü üç kanıt**
1. **Duraklatmıyor:** Uygula'dan sonra saat 10 → 33 sim. dk. ilerledi, "DÜNYA GÖRSEL DURUMU:
   ÇALIŞIYOR" (`09`).
2. **Gerçekten koşuyor:** oyuncunun arayüzden kurduğu protokol, 243. sim. dakikasında Maden'i
   Eco moduna aldı — bu değer UI state'i değil, `SimulationEngine`'in yetkili tesis durumu (`10`).
3. **Kod adı sızmıyor:** hem doğrulama şeridi hem bağlantı reddi doğal Türkçe (`03`, `06`).

Konsol hatası doğrulaması (ayrı ölçüm): tek hata `http://localhost:5173/favicon.ico` 404;
kaynak URL'siyle teyit edildi, bu değişikliğe ait değil.

---

## 3. Değişen dosyalar

**Yeni**
- `src/game/simulation/protocol/protocolCapabilityBridge.ts`
- `src/game/ui/protocols/protocolDraftModel.ts`
- `src/game/ui/protocols/graph/protocolNodeFields.ts`
- `src/game/ui/protocols/graph/ProtocolNodeSettings.tsx`
- `scripts/faz6-3-e2e.cjs`
- `tests/simulation/protocolCapabilityBridge.test.ts`
- `tests/simulation/protocolApplyRuntime.test.ts`
- `tests/ui/protocolDraftApply.test.ts`

**Değişen**
- `src/game/simulation/SimulationEngine.ts` — `setProtocolPrograms` / `getProtocolPrograms` / `canRunProtocols`
- `src/game/simulation/systems/facilityCommands.ts` — `PLAYER_OPERATING_TARGETS` export edildi (tek kaynak)
- `src/app/providers/SimulationProvider.tsx` — ölçüm okuyucusu + kitaplık senkronu
- `src/game/ui/protocols/ProtocolEditorRoute.tsx` — capability + apply/save bağlantısı
- `src/game/ui/protocols/graph/ProtocolGraphEditor.tsx` — draft/apply, sonuç şeridi, bulgu işaretleri
- `src/game/ui/protocols/graph/ProtocolNodeCard.tsx` — `data-finding`
- `src/game/ui/protocols/graph/protocolEditorModel.ts` — `updateProtocolNode`
- `src/game/ui/protocols/protocolSummary.ts` — `measurementLabel` / `actionValueLabel` / `operatorChoiceKey` export
- `src/game/ui/protocols/protocolManagerModel.ts` + `ProtocolManager.tsx` — `+ Yeni Protokol`
- `src/localization/tr.ts` · `src/styles.css`
- `tests/localization/protocolEditorLocalization.test.ts` · `tests/localization/protocolManagerLocalization.test.ts`

---

## 4. Riskler

1. **Ölçüm kataloğu geçici.** İki ölçüm var (`facility-condition`, `energy-level`). Faz 8 kanonik
   kataloğu gelince `PROTOCOL_SENSOR_CATALOG` ve okuyucu oradan beslenmeli. Uydurma yapılmadı ama
   dar; oyuncu şu an bu ikisinin dışında bir şey ölçemez.
2. **`energy-level` yorumu benim kararım:** koloni enerji doluluğu **yüzde** olarak okunuyor
   (`stored/capacity*100`). Yayındaki protokoller (`< 60`, `< 40`) yüzde varsayımına uyuyor ama
   spec bunu yazmıyor. Ürün "ham stok" derse tek satır değişir.
3. **Kalıcılık yok.** Protokol kitaplığı zustand'da, bellekte. Sayfa yenilenince oluşturulan
   protokol kaybolur (e2e'de bunu bizzat yaşadım ve akışı client-side gezinmeye çevirdim).
   Save/load bu fazın kapsamı değil, ama "oluştur→uygula" ancak oturum içinde kalıcı.
4. **Uygulanan protokol değiştirilirken bekleyen Delay.** Faz 5 kapanışında zaten "Faz 6 lifecycle"
   diye kapsam dışı bırakılmıştı; hâlâ öyle. `setProtocolPrograms` eski programı listeden düşürür,
   ama runtime'ın o protokole ait bekleyen Delay kaydı bir sonraki tick'te sahibini bulamayınca
   sessizce düşer. Testle kilitledim (kaldırılan protokol susuyor) fakat oyuncuya bildirim yok.
5. **`set-condition` oyuncuya açık.** `FACILITY_ACTUATORS` üyesi ve `tr.ts`'te adı var, o yüzden
   katalogda; ama "kondisyonu 100 yap" oyun dengesi açısından hile sayılabilir. Ürün kararı.

---

## 5. Açık sorular

1. `energy-level` yüzde mi ham stok mu? (Risk 2)
2. `set-condition` protokol eylemi olarak kalsın mı, yoksa dev-only mı? (Risk 5)
3. Protokol adı düzenleme yüzeyi 6/4'e mi ait? Şu an yeni protokol "Adsız Protokol" adıyla doğuyor
   ve adı değiştirilemiyor.
4. Tasarım §9.1 kart yüksekliği sapması (6/2'den devreden) hâlâ tasarımcı onayı bekliyor.
5. Uygulanmış bir protokolü devre dışı bırakma/arşivleme yüzeyi yok — §11 lifecycle'ın kalan iki
   durumu (`disabled`, `archived`) yalnız veri katmanında. 6/4 mü?

---

## 6. Sonraki adım

- **TASK-MSSXSYDRH8X3A (6/4)**: mobil etkileşim, özet/versiyonlama, Faz 6 çıkış kapısı.
  Oradan önce yukarıdaki 1. ve 2. açık soru karara bağlanmalı (ikisi de tek satırlık değişiklik
  ama yayındaki protokol içeriğini etkiler).
- Dev server (5173) **çalışır bırakıldı** — patron akışı kendi gözüyle görmek isteyebilir:
  PROTOKOLLER → `+ Yeni Protokol` → Kontrol Et → Uygula.
