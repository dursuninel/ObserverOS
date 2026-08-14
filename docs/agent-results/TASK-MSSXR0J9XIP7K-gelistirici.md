# TASK-MSSXR0J9XIP7K — Faz 6/1: Protocol Manager ekranı (kart listesi, arama, filtre)

**Ajan:** Geliştirici · **Sprint:** SPRINT-FAZ-6 · **Repo:** `C:\Users\Reawakened\Desktop\ObserverOS`
**Branch:** `phase-4-deterministic-layout` (bu hedefte `dev` branch'i yok)
**Tarih:** 2026-08-14

---

## 1) Ne yapıldı

`/protocols` rotası artık **graph değil, Protocol Manager** gösteriyor (spec §14.1, satır 1041).

| Yapılan | Nerede |
| --- | --- |
| `/protocols` yüzeyi Manager'a çevrildi; `ProtocolFlowBoundary` (React Flow) bu rotadan kaldırıldı | `src/game/ui/protocols/ProtocolsWorkspace.tsx` |
| Kart listesi + arama + üç filtre (durum · öncelik · tesis) + "Filtreleri temizle" | `src/game/ui/protocols/ProtocolManager.tsx` |
| Kart modeli, arama/filtre mantığı, son-çalışma ve sim-zaman biçimlendirme (saf, test edilebilir) | `src/game/ui/protocols/protocolManagerModel.ts` |
| Otomatik özetin **graph'tan türetilmesi** (tetikleyici → koşullar → gecikme → eylemler) | `src/game/ui/protocols/protocolSummary.ts` |
| Protokol listesi + son çalışma kayıtları için UI state store'u | `src/game/state/protocolStore.ts` |
| Trace + command outcome → protokol başına tek "son çalışma" kaydı (saf reducer) | `src/game/state/protocolExecutionLog.ts` |
| Başlangıç protokolleri (5 adet, 4 farklı durum, 4 farklı öncelik, 3 tesis) | `src/game/content/protocols/starterProtocols.ts` |
| Türkçe metinlerin tamamı localization'a | `src/localization/tr.ts` (`protocolManager.*`) |
| Manager görsel katmanı + 720px altı düzen | `src/styles.css` |

**Kartın altı alanı (§14.1) eksiksiz:** Ad · Durum (Aktif/Doğrulanmış/Taslak/Devre dışı/Arşivlenmiş) ·
Öncelik · Otomatik kısa özet · Etkilenen sistemler · Son çalışma durumu/zamanı.

**Faz 5 çekirdeği yeniden YAZILMADI, çağrıldı:**
- `compileProtocol` yalnız testte doğrulama için çağrıldı (başlangıç protokolleri gerçekten derleniyor mu).
- Son çalışma alanı `SimulationEngine.getProtocolExecutionTraces()` / `getProtocolCommandOutcomes()`
  çıktısından beslenir; runtime'ın içine dokunulmadı.
- `src/game/simulation/**` altında **tek satır değişiklik yok** (git status aşağıda).
- `tests/architecture/moduleBoundaries.test.ts` **değiştirilmedi**; zustand/@xyflow yalnız
  `src/game/state` ve `src/game/ui` altında.

**Spec kuralları:** folder/Protokol Grupları **YOK** · protokol/node sayısına **yapay limit YOK**
(240 protokollük test listenin tamamı gösteriliyor) · özet doğal Türkçe, Boolean/pulse jargonu yok.

---

## 2) Kanıt

### 2.1 typecheck · lint · build — hepsi temiz

```
> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false


> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .

> gozlemci-isletim-sistemi@0.0.0 build
> tsc -b && vite build
vite v7.3.6 building client environment for production...
✓ 242 modules transformed.
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-BeHyc32E.css     12.83 kB │ gzip:   3.29 kB
dist/assets/index-Qm_-HyQb.js   1,397.19 kB │ gzip: 395.31 kB
✓ built in 3.24s
```

### 2.2 Test paketi — 400/400 PASS (Faz 5 kapanışı 364'tü, +36 yeni test)

```
 Test Files  37 passed (37)
      Tests  400 passed (400)
   Start at  19:00:33
   Duration  10.20s
```

Hiç test silinmedi/gevşetilmedi; `moduleBoundaries.test.ts` dosyasına dokunulmadı.
Yeni dosyalar: `tests/ui/protocolManager.test.ts`, `tests/localization/protocolManagerLocalization.test.ts`.

### 2.3 GERÇEK interaktif doğrulama (Chrome + playwright-core, gerçek tıklama/klavye)

Dev server: `npm run dev -- --port 5251 --strictPort` → `http://localhost:5251/`
Sürücü betiği gerçek `page.click` / `page.keyboard.type` kullanır (sentetik `dispatchEvent` değil).
**Çıkış kodu: 0 — tüm kontroller geçti.**

```
--- 1) /protocols manager gösteriyor mu, graph mı? ---
PASS  URL                     beklenen="/protocols"          gerçek="/protocols"
PASS  manager var             beklenen=1                     gerçek=1
PASS  react-flow canvas YOK   beklenen=0                     gerçek=0
PASS  protocol-flow-shell YOK beklenen=0                     gerçek=0
PASS  başlangıç kart sayısı   beklenen=5                     gerçek=5
PASS  başlangıç sayacı        beklenen="5 / 5 protokol"      gerçek="5 / 5 protokol"
        kartlar = ["Maden Kritik Kapatma","Reaktör Kondisyon Koruması","Maden Bakım Yükseltmesi","Oksijen Enerji Tasarrufu","Reaktör Gece Takviyesi"]

--- 2) kartın altı alanı dolu mu? ---
{
  "ad": "Maden Kritik Kapatma",
  "durum": "Aktif",
  "oncelik": "ÖNCELİK · Kritik",
  "alanlar": [
    ["NE YAPAR", "Maden kondisyonu 25 değerinin altına düştüğünde 30 dakika sonra Maden tesisini Devre dışı durumuna getirir."],
    ["ETKİLENEN SİSTEMLER", "Maden"],
    ["SON ÇALIŞMA", "Henüz çalışmadı"]
  ]
}
PASS  kart alan sayısı (özet/etkilenen/son çalışma)   beklenen=3   gerçek=3
PASS  her kartta son-çalışma satırı var               beklenen=5   gerçek=5
        son çalışma = ["Henüz çalışmadı"] (protokoller henüz simülasyona UYGULANMADI — Uygula akışı Faz 6/3)

--- otomatik özetler (graph'tan türetilmiş) ---
   • Maden kondisyonu 25 değerinin altına düştüğünde 30 dakika sonra Maden tesisini Devre dışı durumuna getirir.
   • Reaktör kondisyonu 45 değerinin altına düştüğünde Reaktör tesisini Eco moduna alır.
   • Maden kondisyonu 70 değerinin altına düştüğünde Maden tesisinin bakım önceliğini Yüksek yapar.
   • Koloni enerji seviyesi 60 değerinin altına düştüğünde ve Oksijen İşleyici kondisyonu en az 50 ise ve Reaktör kondisyonu en az 40 ise Oksijen İşleyici tesisini Eco moduna alır.
   • Koloni enerji seviyesi 40 değerinin altına düştüğünde Reaktör tesisini Boost moduna alır.

--- 3) GERÇEK KLAVYE ile arama: "maden" ---
PASS  arama sonucu kartları  beklenen=["Maden Kritik Kapatma","Maden Bakım Yükseltmesi"]  gerçek=aynı
PASS  arama sayacı           beklenen="2 / 5 protokol"                                    gerçek="2 / 5 protokol"

--- 3b) özet metni üzerinden arama: "boost moduna" ---
PASS  özet araması           beklenen=["Reaktör Gece Takviyesi"]                          gerçek=aynı

--- 3c) Türkçe büyük harf araması: "MADEN" ---
PASS  büyük harf araması     beklenen=2                                                    gerçek=2

--- 4) GERÇEK TIKLAMA ile durum filtresi: Taslak ---
PASS  taslak filtresi        beklenen=["Oksijen Enerji Tasarrufu"]                        gerçek=aynı
PASS  chip aria-pressed      beklenen="true"                                               gerçek="true"
PASS  filtre sayacı          beklenen="1 / 5 protokol"                                     gerçek="1 / 5 protokol"

--- 5) öncelik filtresi: Kritik ---
PASS  kritik filtresi        beklenen=["Maden Kritik Kapatma"]                            gerçek=aynı

--- 6) tesis filtresi: Oksijen İşleyici ---
PASS  tesis filtresi         beklenen=["Oksijen Enerji Tasarrufu"]                        gerçek=aynı

--- 7) arama + filtre birlikte (tesis=Oksijen İşleyici + arama="maden") ---
PASS  kesişim boş sonuç      beklenen=[]                                                   gerçek=[]
PASS  boş durum metni        beklenen=1                                                    gerçek=1
        boş metin = Bu arama ve filtrelerle eşleşen protokol yok.

--- 8) "Filtreleri temizle" ile geri dönüş ---
PASS  temizleme sonrası          beklenen=5      gerçek=5
PASS  temizle düğmesi devre dışı beklenen=true   gerçek=true

--- 9) mobil genişlik (400px) ---
PASS  mobilde de 5 kart      beklenen=5      gerçek=5
PASS  yatay taşma yok        beklenen=true   gerçek=true

--- JS hataları / konsol ---            YOK
--- uygulamaya ait 4xx/5xx istekler --- YOK

SONUC: TUM KONTROLLER GECTI   (exit code 0)
```

### 2.4 Ekran görüntüleri

`docs/agent-results/TASK-MSSXR0J9XIP7K-screenshots/`

| Dosya | Ne gösteriyor |
| --- | --- |
| `01-manager-liste.png` | Beş kart, altı alan, arama+filtre çubuğu, `5 / 5 protokol` |
| `02-arama-maden.png` | "maden" araması → 2 kart |
| `03-arama-ozet-metni.png` | Yalnız ÖZET metninde geçen "boost moduna" araması → 1 kart |
| `04-filtre-taslak.png` | Durum=Taslak chip'i basılı, `1 / 5 protokol` |
| `05-filtre-kritik.png` | Öncelik=Kritik |
| `06-filtre-tesis.png` | Tesis=Oksijen İşleyici |
| `07-bos-sonuc.png` | Arama+filtre kesişimi boş → açıklayıcı boş durum |
| `08-mobil.png` | 400px genişlik, tek sütun, yatay taşma yok |

### 2.5 Araştırma sırasında ölçülüp çürütülen bir bulgu

İlk e2e koşusunda konsolda **"Invalid hook call / Cannot read properties of null (reading 'useCallback')"**
göründü. Koda değil, dev server soğuk açılışına aitmiş — vite log'u:

```
6:57:01 PM [vite] (client) ✨ new dependencies optimized: zustand
6:57:01 PM [vite] (client) ✨ optimized dependencies changed. reloading
```

zustand ilk istekte pre-bundle edilmemişti; vite ortada yeniden optimize edip sayfayı yeniledi ve
o anlık ikinci React kopyası hatayı üretti. Bağımlılık optimize edildikten sonraki koşularda hata
**yok** (yukarıdaki temiz çıktı). Kalan tek 404, `index.html`'de favicon tanımlı olmadığı için
tarayıcının kendi `GET /favicon.ico` isteği — ölçüldü (`GET /favicon.ico -> 404`), bu görevden
önce de vardı, `/colony` dahil her rotada aynı.

---

## 3) Değişen dosyalar

**Yeni**
```
src/game/content/protocols/starterProtocols.ts
src/game/state/protocolExecutionLog.ts
src/game/state/protocolStore.ts
src/game/ui/protocols/ProtocolManager.tsx
src/game/ui/protocols/protocolManagerModel.ts
src/game/ui/protocols/protocolSummary.ts
tests/ui/protocolManager.test.ts
tests/localization/protocolManagerLocalization.test.ts
docs/agent-results/TASK-MSSXR0J9XIP7K-screenshots/ (8 png)
```

**Değişen**
```
src/game/ui/protocols/ProtocolsWorkspace.tsx   (graph yerine Manager)
src/localization/tr.ts                          (protocolManager.* sözlüğü)
src/styles.css                                  (Manager görselleri + mobil)
```

**Dokunulmayan (bilerek):** `src/game/simulation/**`, `tests/architecture/moduleBoundaries.test.ts`,
`src/game/ui/protocols/ProtocolFlowBoundary.tsx` (dosya duruyor; Faz 6/2 Graph Editor'ün giriş noktası).

---

## 4) Riskler

1. **Son çalışma alanı canlı uygulamada henüz "Henüz çalışmadı" gösteriyor.** Alan gerçek kaynağa
   (`getProtocolExecutionTraces` / `getProtocolCommandOutcomes`) bağlı ve dolu hâli birim testiyle
   kilitli (`Uygulandı · 2. gün 01:30`, `Engellendi · 1. gün 00:45`), fakat uygulamadaki
   `SimulationEngine` henüz `protocols` seçeneğiyle kurulmuyor — bu **Uygula akışı = Faz 6/3**.
   Bilerek kapsam dışı bırakıldı; 6/3'te gerçek son-çalışma ekran görüntüsü alınmalı.
2. **Başlangıç protokolleri geçici içeriktir.** Yalnız kanonik tesis id'leri, `FACILITY_ACTUATORS`
   eylemleri ve Faz 5'te zaten kullanılan iki ölçüm (`facility-condition`, `energy-level`) ile
   kuruldu; yeni sensör kataloğu UYDURULMADI. Kanonik sensör listesi Faz 8 (HELIOS içerik) işi;
   o geldiğinde bu beş protokol gözden geçirilmeli.
3. **Protokol adları veri katmanında Türkçe.** Bunlar UI metni değil oyuncu içeriğidir (düzenleyicide
   değiştirilir), bu yüzden localization sözlüğüne konmadı. Kural ihlali değil ama bilinçli bir karar.
4. **Tesis filtresi tek seçimli** (select), durum/öncelik çok seçimli (chip). Tutarsız görünebilir;
   tesis sayısı arttığında çok seçimli hâle getirmek gerekebilir.

---

## 5) Açık sorular

1. Karttan Graph Editor'e geçiş nasıl olacak — kartın kendisi mi tıklanabilir olacak, ayrı bir
   "Düzenle" düğmesi mi? (Faz 6/2'nin kararı; şu an kart salt görüntü.)
2. `archived` durumu varsayılan listede görünmeli mi, yoksa yalnız filtreyle mi açılmalı?
   Şu an görünüyor (MVP'de arşivlenmiş protokol yok).
3. "Yeni Protokol" düğmesi 6/1'e mi 6/2'ye mi ait? Bu görevin tanımında yoktu, eklenmedi.
4. Performance warning (§14.1 "protocol count için performance warning olabilir") hangi eşikte
   gösterilecek? Yapay limit koymamak için hiç eklenmedi.

---

## 6) Sonraki adım

- **TASK-MSSXROKE7L7JB (Faz 6/2 Graph Editor):** `ProtocolFlowBoundary` üzerine node palette + canvas.
  Manager'dan editöre geçiş yolu ve `useProtocolStore.upsertProtocol` bu görevde kullanılacak.
- **TASK-MSSXSDKE5X5GY (Faz 6/3 Draft/Apply + Kontrol Et):** `SimulationEngine`'e `protocols`
  seçeneğini bağlayacak; ancak o zaman "Son çalışma" alanı canlı veri gösterir.
- Tasarımcının 6/T çıktısı (`docs/design/`) hazır olduğunda Manager'ın renk/tipografi katmanı
  o sisteme hizalanmalı (şu an mevcut `styles.css` tokenlarını kullanıyor).

**Dev server açık bırakıldı:** http://localhost:5251/protocols — sonucu kendi gözünle görebilirsin.
