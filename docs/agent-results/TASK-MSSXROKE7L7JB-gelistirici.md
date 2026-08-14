# TASK-MSSXROKE7L7JB — Faz 6/2: Graph Editor (canvas, düğüm paleti, bağlantı kuralları)

**Ajan:** Geliştirici · **Sprint:** SPRINT-FAZ-6 · **Repo:** `C:\Users\Reawakened\Desktop\ObserverOS`
**Branch:** `main` (remote `faz_0`) · **Tarih:** 2026-08-14
**Girdi dokümanlar:** spec §14.2 (satır 1052–1061), §14.3 (1063–1073), §72.6 (5415–5456) ·
`docs/design/faz6-protokol-duzenleyici.md` (Faz 6/T çıktısı)

> **Kapsam notu (önemli):** Görev metninin misyon/adım bölümü bana ulaşmadı; kapsamı board
> başlığından (**canvas · düğüm paleti · bağlantı kuralları**) + §14.2 + tasarım dokümanı §18'den
> aldım. Bilinçli olarak KAPSAM DIŞI bıraktıklarım ve gerekçeleri §5'te.

---

## 1) Ne yapıldı

`/protocols/:protocolId` rotasında çalışan Graph Editor yüzeyi. Manager (Faz 6/1) ana ekran
olarak kaldı; düzenleyici kart üzerindeki **Düzenle** bağlantısıyla açılıyor (§14.1 satır 1041).

| Yapılan | Nerede |
| --- | --- |
| Port şeması + tip uyum kuralının Faz 5 doğrulayıcısından **dışa açılması** (editör kendi kopyasını tutmuyor) | `src/game/simulation/protocol/protocolValidator.ts` |
| Bağlantı kuralları: yön · tip · dolu giriş · tekrar · kendine bağlantı · döngü (saf, React'siz) | `src/game/ui/protocols/graph/protocolConnectionRules.ts` |
| Graph düzenleme işlemleri (ekle/sil/bağla/bağlantı kaldır, kimlik üretimi) — hepsi saf | `src/game/ui/protocols/graph/protocolEditorModel.ts` |
| Deterministik yerleşim (§53.4: konum veri modelinde tutulmaz, graph'tan türetilir) | `src/game/ui/protocols/graph/protocolGraphLayout.ts` |
| Kart ölçüleri, port sırası, palet (kapalı liste, 6) | `src/game/ui/protocols/graph/protocolNodePresentation.ts` |
| Canvas görünüm modeli (React Flow'dan bağımsız düz veri; kenar sınıfları) | `src/game/ui/protocols/graph/protocolFlowView.ts` |
| Node kartı bileşeni (tek iskelet + kimlik şeridi + ikon + portlar) | `src/game/ui/protocols/graph/ProtocolNodeCard.tsx` |
| Editör yüzeyi: üst bar · canvas · palet · seçim detayı · gerekçe duyurusu | `src/game/ui/protocols/graph/ProtocolGraphEditor.tsx` |
| Rota + Manager'dan giriş | `src/game/ui/protocols/ProtocolEditorRoute.tsx`, `src/app/App.tsx`, `ProtocolManager.tsx` |
| Düğüm başına doğal Türkçe kart özeti (Manager özet sözlüğü yeniden kullanıldı) | `src/game/ui/protocols/protocolSummary.ts` (`describeProtocolNode`) |
| Türkçe metinlerin tamamı localization'a | `src/localization/tr.ts` (`protocolEditor.*`) |
| `--protocol-*` token katmanı + kart/port/kenar/palet görselleri + <1024 px yığılmış düzen | `src/styles.css` |

**Spec kuralları — uygulanan hâli:**
- Geçersiz bağlantı **kurulamadan** engelleniyor (`isValidConnection` → `false`) ve gerekçe doğal
  Türkçe olarak `aria-live` şeridinde duyuruluyor (satır 1057). Ekran görüntüsü 03–04.
- Palet **tam olarak 6** düğüm taşıyor; VEYA/DEĞİL/Sayaç/Splitter yok (5446, Y-03) — testle kilitli.
- Ekranda teknik jargon yok (5455): `port`/`node`/`edge`/`boolean`/`pulse` sözcükleri
  `protocolEditor.*` sözlüğünde geçmiyor — bunu ayrı bir test denetliyor.
- Node arkasında görsel katman yok: düz `#081521` + 24 px nokta ızgara (5430, Y-01).
- Evet/Hayır ayrımı üç kanalda: renk + çizgi stili (kesikli) + kenar etiketi (§25.2, Y-11).
- Kimlik rengi yalnız 3 px şerit + ikonda; kart gövdesi bütün türlerde aynı (5431/5440, Y-09).

**Faz 5 çekirdeği yeniden YAZILMADI, çağrıldı:** `protocolValidator.ts`'e eklenen tek şey
üç `export` (fonksiyon gövdeleri aynı) + inline tip-uyum bloğunun `arePortTypesCompatible`
fonksiyonuna çıkarılması. Davranış değişmedi: 400 testlik önceki paket olduğu gibi geçiyor.
`tests/architecture/moduleBoundaries.test.ts` **değiştirilmedi**; `@xyflow`/React yalnız
`src/game/ui` altında.

---

## 2) Kanıt

### 2.1 typecheck · lint · build — üçü de temiz

```
> gozlemci-isletim-sistemi@0.0.0 typecheck
> tsc -b --pretty false


> gozlemci-isletim-sistemi@0.0.0 lint
> eslint .

> gozlemci-isletim-sistemi@0.0.0 build
> tsc -b && vite build
✓ 402 modules transformed.
dist/index.html                     0.39 kB │ gzip:   0.26 kB
dist/assets/index-DuABdYPP.css     35.88 kB │ gzip:   7.03 kB
dist/assets/index-CojM30Yf.js   1,594.21 kB │ gzip: 459.26 kB
✓ built in 3.71s
```

### 2.2 Test paketi — 443/443 PASS (Faz 6/1 kapanışı 400'dü, +43 yeni test)

```
 Test Files  39 passed (39)
      Tests  443 passed (443)
   Start at  19:56:05
   Duration  10.75s (transform 2.09s, setup 0ms, collect 13.57s, tests 23.48s, environment 6ms, prepare 4.33s)
```

Hiç test silinmedi/gevşetilmedi. Yeni dosyalar: `tests/ui/protocolGraphEditor.test.ts` (35),
`tests/localization/protocolEditorLocalization.test.ts` (8).

Kilitlenen davranışlardan bazıları:
- **Kural paritesi:** yayındaki 5 protokolün BÜTÜN kenarları tek tek yeniden kurulduğunda
  editör kuralları hiçbirini reddetmiyor; sonuç `validateProtocol`'de `edge-port-incompatible`
  üretmiyor. ("Editörde kurulabilen ama doğrulamada hata veren bağlantı" imkânsız.)
- Yerleşim determinizmi, döngülü graph'ta sonlanma, aynı sütunda kart çakışmaması.
- Kart satırlarına ham localization anahtarı veya `{{...}}` sızmaması.

### 2.3 GERÇEK interaktif doğrulama (Chrome + playwright-core, gerçek tıklama ve fare sürükleme)

Dev server: `npm run dev -- --port 5261 --strictPort`. Sürücü betiği `page.click` ve
`mouse.down/move/up` kullanır (sentetik `dispatchEvent` değil). **Çıkış kodu: 0.**

```
--- 1) Manager -> Duzenle baglantisi editoru aciyor mu? ---
PASS  manager acildi                               beklenen=1  gercek=1
PASS  URL                                          beklenen="/protocols/mine-critical-shutdown"  gercek="/protocols/mine-critical-shutdown"
PASS  protokol adi                                 beklenen="Maden Kritik Kapatma"  gercek="Maden Kritik Kapatma"
PASS  canvasta dugum sayisi                        beklenen=3  gercek=3
PASS  canvasta baglanti sayisi                     beklenen=2  gercek=2
PASS  tetikleyici karti                            beklenen=1  gercek=1
PASS  geciktir karti                               beklenen=1  gercek=1
PASS  eylem karti                                  beklenen=1  gercek=1
--- 2) Dugum paleti kapali liste mi (tam 6)? ---
PASS  palet dugme sayisi                           beklenen=6  gercek=6
PASS  palet etiketleri                             beklenen=["Tetikleyici","Sensör","Karşılaştır","VE","Geciktir","Eylem"]  gercek=["Tetikleyici","Sensör","Karşılaştır","VE","Geciktir","Eylem"]
PASS  VEYA/DEGIL/Sayac yok                         beklenen=true  gercek=true
--- 3) Paletten gercek tikla ile dugum ekleme ---
PASS  dugum sayisi arttı                           beklenen=4  gercek=4
PASS  secilen dugum sag panelde                    beklenen="Eylem"  gercek="Eylem"
--- 4) GECERSIZ baglanti kurulamiyor + Turkce aciklama ---
PASS  kendine baglanti kurulmadi                   beklenen=2  gercek=2
PASS  gerekce metni                                beklenen="Bir düğüm kendisine bağlanamaz."  gercek="Bir düğüm kendisine bağlanamaz."
PASS  tekrar baglanti kurulmadi                    beklenen=2  gercek=2
PASS  tekrar gerekcesi                             beklenen="Bu bağlantı zaten kurulmuş."  gercek="Bu bağlantı zaten kurulmuş."
PASS  geciktir eklendi                             beklenen=5  gercek=5
PASS  dolu giris korundu                           beklenen=2  gercek=2
PASS  dolu giris gerekcesi                         beklenen="Bu giriş noktası zaten bağlı; önce mevcut bağlantıyı kaldırın."  gercek="Bu giriş noktası zaten bağlı; önce mevcut bağlantıyı kaldırın."
--- 5) GECERLI baglanti gercek surukleme ile kuruluyor ---
PASS  yeni baglanti kuruldu                        beklenen=3  gercek=3
PASS  gerekce temizlendi                           beklenen=""  gercek=""
--- 6) Dugum silinince bagli baglantilar da dusuyor ---
PASS  dugum silindi                                beklenen=4  gercek=4
PASS  bagli baglanti da dustu                      beklenen=2  gercek=2
PASS  sag panel bos duruma dondu                   beklenen=1  gercek=1
--- 7) Zoom kontrolleri ve geri donus ---
PASS  zoom degisti                                 beklenen=true  gercek=true
PASS  listeye donuldu                              beklenen="/protocols"  gercek="/protocols"
--- 8) Evet/Hayir ayrimi ve olcum kenari sinifi ---
PASS  olcum kenari sinifi                          beklenen=6  gercek=6
PASS  evet kenari etiketli                         beklenen=1  gercek=1
PASS  olcum kenarlari                              beklenen=4  gercek=4
PASS  Evet etiketi ekranda                         beklenen=true  gercek=true
--- 9) Konsol hatasi ---
PASS  konsol hatasi yok                            beklenen=[]  gercek=[]
        (kapsam disi, onceden var olan: ["... 404 ... http://localhost:5261/favicon.ico"])

SONUC: TUM KONTROLLER GECTI
```

Ekran görüntüleri (gerçek etkileşim anları): `docs/agent-results/TASK-MSSXROKE7L7JB-screenshots/`
`01-editor-acildi` · `02-paletten-eylem-eklendi` · `03-gecersiz-kendine-baglanti` ·
`04-gecersiz-dolu-giris` · `05-gecerli-baglanti-kuruldu` · `06-dugum-silindi` ·
`07-listeye-donus` · `08-evet-hayir-ve-olcum-kenarlari`

### 2.4 Ölçümle bulunup düzeltilen iki gerçek kusur

1. **Kart metni port etiketinin üstüne biniyordu.** Tasarım §9.1'in `n = max(giriş, çıkış, özet)`
   yükseklik formülü özet satırı ile port satırını AYNI banda koyuyor; ilk ekran görüntüsünde
   "Oksijen İşleyici kondisyonu" metni "Ölçüm"/"Evet" etiketlerinin üstüne biniyordu.
   §9.2'nin sıralaması (başlık → özet → portlar) korunarak yükseklik
   `44 + özet×20 + satır×26 + 14` olarak hesaplanıyor. **Tasarımdan sapma yalnız yükseklik
   tablosudur**; genişlik (192), renk, boşluk, port ölçüleri ve yarıçaplar tasarımdaki değerler.
2. **Paletten eklenen düğüm görünür alanın dışına düşebiliyordu.** Ekleme sonrası yakınlaştırma
   seviyesi korunarak yeni düğüm merkeze alınıyor (`setCenter`). Yerleşim modeli deterministik kaldı.

---

## 3) Değişen dosyalar

**Yeni**
- `src/game/ui/protocols/graph/protocolConnectionRules.ts`
- `src/game/ui/protocols/graph/protocolEditorModel.ts`
- `src/game/ui/protocols/graph/protocolGraphLayout.ts`
- `src/game/ui/protocols/graph/protocolNodePresentation.ts`
- `src/game/ui/protocols/graph/protocolFlowView.ts`
- `src/game/ui/protocols/graph/ProtocolNodeCard.tsx`
- `src/game/ui/protocols/graph/ProtocolGraphEditor.tsx`
- `src/game/ui/protocols/ProtocolEditorRoute.tsx`
- `tests/ui/protocolGraphEditor.test.ts`
- `tests/localization/protocolEditorLocalization.test.ts`
- `docs/agent-results/TASK-MSSXROKE7L7JB-screenshots/*` (8 PNG)

**Değişen**
- `src/game/simulation/protocol/protocolValidator.ts` (3 export + tip-uyum fonksiyonu; davranış aynı)
- `src/game/ui/protocols/protocolSummary.ts` (`describeProtocolNode` eklendi)
- `src/game/ui/protocols/ProtocolManager.tsx` (kartta "Düzenle" bağlantısı)
- `src/app/App.tsx` (yeni rota)
- `src/localization/tr.ts` (`protocolEditor.*`, `protocolManager.card.edit`)
- `src/styles.css` (`--protocol-*` token katmanı + editör görselleri)

---

## 4) Riskler

- **Tasarım yükseklik tablosundan sapma** (§2.4/1). Tasarımcı onayı alınmalı; alternatif, özet
  satırını gizleyip yalnız tooltip'te göstermekti — okunabilirlik açısından daha kötü bulundu.
- **Bağlantı kuralları `ProtocolCapabilities` OLMADAN çalışıyor.** Sensör çıkışının tipi
  capability'den çözülmediği için `value` (serbest) kabul ediliyor; bu, doğrulayıcının
  capability'siz davranışıyla birebir aynı. Capability'li tip daraltması (ör. `enum` ölçümün
  sıralama karşılaştırmasına bağlanamaması) Faz 6/3'te validation entegrasyonuyla gelmeli.
- **Düzenlemeler çalışma kopyasında kalıyor**, store'a/simülasyona yazılmıyor. Sayfadan çıkınca
  değişiklik kaybolur. Bu bilinçlidir (draft/apply = Faz 6/3), ama kullanıcı gözünde "kaydetmedi"
  gibi görünebilir; 6/3 kapanana kadar bu yüzey deneme amaçlıdır.
- **Bağlantı kurma yalnız fare/dokunma ile.** Klavyeyle bağlantı kurma yolu yok (React Flow'un
  varsayılanı). §25.4 dokunma hedefi karşılandı; tam klavye erişimi ayrı bir iş.

---

## 5) Açık sorular / bilinçli kapsam dışı

1. **`Kontrol Et` / `Uygula` düğmeleri eklenmedi** — 6/3'ün draft/apply durum makinesine ait
   (tasarım §18.6 bunları açıkça 6/3'e bırakıyor). Üst bar bu iki düğme için yer bırakıyor.
2. **Sağ panel salt-okunur.** §12.4'teki düzenlenebilir alanlar (Ölçüm/Koşul/Eşik seçimleri)
   `ProtocolCapabilities` listesi ve apply akışı olmadan protokolü doğrudan bozar; 6/3 ile gelmeli.
   Şu an panel: tür + açıklama + özet satırları + **Düğümü Sil**.
3. **Sol panel (320 px protokol listesi) eklenmedi** — hızlı geçiş yüzeyi; Manager zaten liste
   ekranı ve "◂ Protokoller" ile bir tık uzakta. Görev başlığındaki üç madde dışında.
4. **`ProtocolFlowBoundary.tsx` artık ölü kod** (Faz 6/1'de rotadan çıkarılmıştı, yerine bu editör
   geldi). Silmek istenirse ayrı bir temizlik adımı — istenmeyen kapsam genişletmesi olmasın diye
   dokunmadım.
5. Misyon metni gelmediği için kapsam board başlığından türetildi; farklı bir bölünme (st1/st2…)
   bekleniyorduysa fazlası zaten burada, eksiği yukarıdaki 1–3 maddelerdir.

---

## 6) Sonraki adım

- **TASK-MSSXSDKE5X5GY (6/3)**: `ProtocolCapabilities`'in simülasyondan üretilmesi → sağ panelin
  düzenlenebilir alanları + `Kontrol Et` (validateProtocol bulgularının node/kenar üzerine
  düşürülmesi, tasarım §17) + `Uygula` (store'a yazma, draft/apply durum makinesi).
- Bu görevde hazır bırakılan bağlantı noktaları: `buildProtocolFlowView(...)` capability
  parametresi alıyor; `evaluateProtocolConnection(...)` capability parametresi alıyor;
  bulgu → görsel eşlemesi için node kartı `data-*` alanlarıyla genişletilebilir.
