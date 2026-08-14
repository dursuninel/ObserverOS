# TASK-MSSXTSZQH1CB6 — Faz 6/T: Protokol Düzenleyici görsel tasarım sistemi (§72.6)

**Ajan:** Tasarımcı (tasar-mc-eed2c5) · **Sprint:** SPRINT-FAZ-6 · **Tip:** design spec
**Tarih:** 2026-08-14 · **Repo:** `C:\Users\Reawakened\Desktop\ObserverOS` · **Branch:** `phase-4-deterministic-layout`
**Çıktı:** `docs/design/faz6-protokol-duzenleyici.md`

---

## 1. Ne yapıldı

Spec §72.6'nın (satır 5415–5456, 42 satır) verdiği sanat yönü, Faz 6/2'nin doğrudan uygulayabileceği **token + ölçü + durum tablosuna** çevrildi. Kod yazılmadı, bileşen üretilmedi, `src/` altında hiçbir dosyaya dokunulmadı.

Üretilen doküman 19 bölüm / ~570 satır:

| Bölüm | İçerik |
|---|---|
| §1 | **Karar defteri** — 23 kayıt; her tasarım kararı bir spec satır numarasına bağlı |
| §3 | 17 yeni `protocol.*` renk token'ı + 6 node kimlik rengi; §71.3.1 tabanını ezmeden genişletir |
| §4 | 9 satırlık tipografi ölçeği + 8 px ızgara / yarıçap kararları |
| §5 | Yerleşim: 320 / canvas / 360 px; **4 kırılım için hesaplanmış canvas genişlikleri**; mobil yığılmış düzen |
| §6–§8 | Üst bar (64 px), sol panel (320 px), graph canvas (dot ızgara, zoom, düğüm paleti) |
| §9 | Node kartı: 192 px sabit genişlik, **tür başına hesaplanmış yükseklik**, 8 durumlu durum tablosu |
| §10 | Portlar — `protocolValidator.ts:42–76`'dan birebir; teknik ad → Türkçe etiket sözlüğü; hitbox ölçüleri |
| §11 | 4 kenar sınıfı; Evet/Hayır ayrımı 3 kanalla (renk + çizgi stili + etiket) |
| §12 | Sağ panel: iskelet + jargon sözlüğü + operatör sözlüğü + **6 node için alan tablosu** (`Protocol.ts` alanlarından türetilmiş) |
| §14 | **Kontrast ölçümleri** — hesaplanmış gerçek sayılar, eşiği geçmeyen 3 durum ad ve gerekçesiyle işaretli |
| §15 | Yasak listesi → 12 denetlenebilir madde |
| §17 | 12 hata + 5 uyarı kodunun görsel karşılığı; metinler mevcut `tr.ts`'e bağlandı, yeniden yazılmadı |

**Kanonik disipline uyum:** yalnız 6 node kimliği (Tetikleyici / Sensör / Karşılaştır / VE / Geciktir / Eylem). VEYA / DEĞİL / Sayaç / Splitter dokümanda **yalnız yasak listesinde** geçer. Klasör-grup yüzeyi yok, node arkasında yıldız/uzay katmanı yok, teknik jargon etiketi yok.

### Doküman üretirken alınan üç önemli karar

1. **Geciktir node'u nötr (`#9DB7C8`), amber değil.** §72.6 satır 5439 "amber **veya** nötr" diyerek seçim bırakıyor. Amber seçilseydi ekranda üç amber aile olurdu (Geciktir + Eylem kimliği 5440 + `state.warning`). Ölçüm: Eylem amber'i `#F0A94C` ile uyarı amber'i `#E6B24A` arasındaki kontrast **1.03:1** — parlaklıkla ayrılamıyorlar. Üçüncü bir amber uyarı semantiğini (§25.2) okunamaz hale getirirdi.
2. **Node sınırı taşıyıcı yapıldı.** Ölçüm: node gövdesi (`#10212F`) ile canvas (`#081521`) arasındaki kontrast yalnız **1.12:1**. §71.3.1'deki `color.border.soft` (canvas'a karşı 1.35:1) bu ekranda kartı görünür kılamaz. Yerine `#467190` (3.53:1 / 3.14:1) tanımlandı — aynı ton ailesi, yükseltilmiş yoğunluk; §71.3.1 satır 4690'ın izin verdiği çerçevede.
3. **`color.text.muted` node kartı içinde yasaklandı.** Node yüzeyinde 4.41:1 veriyor, 4.5:1 eşiğinin altında. Node içi üçüncül metin için `protocol.text.faint #8199A8` (5.51:1) tanımlandı.

---

## 2. Kanıt

### 2.1 Kontrast hesabı — kullanılan betik

WCAG 2.1 bağıl parlaklık + alfa kompozitleme. Ürün koduna eklenmedi, tek seferlik çalıştırıldı (scratchpad).

```js
function hex(h){const s=h.replace('#','');return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)];}
function comp(fg,a,bg){return fg.map((c,i)=>Math.round(c*a+bg[i]*(1-a)));}          // alfa kompozit
function toHex(r){return '#'+r.map(c=>c.toString(16).padStart(2,'0').toUpperCase()).join('');}
function lum([r,g,b]){const f=v=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);};
                      return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
function ratio(a,b){const l1=lum(a),l2=lum(b);const[hi,lo]=l1>l2?[l1,l2]:[l2,l1];return (hi+0.05)/(lo+0.05);}
const canvas      = hex('#081521');
const nodeSurface = comp(hex('#102230'),0.94,canvas);   // -> #10212F
const nodeHeader  = comp(hex('#17303F'),0.96,canvas);   // -> #162F3E
const panel       = comp(hex('#07131C'),0.82,canvas);   // -> #07131D
```

### 2.2 Ham çıktı — kompozit yüzeyler ve metin kontrastları

```
SURFACES (composited)
  canvas           #081521  L=0.00698
  node.surface     #10212F  L=0.01403
  node.header      #162F3E  L=0.02551
  panel            #07131D  L=0.006
  panel.elevated   #0A1B27  L=0.00995

  on node.surface (#10212F)
    text.primary   #EAF4FF   14.74:1  AA-text
    text.secondary #9DB7C8    7.84:1  AA-text
    text.muted     #6E8899    4.41:1  AA-large/UI      <-- 4.5 ALTI, node icinde yasaklandi
    node.trigger   #39BFFF    7.86:1  AA-text
    node.sensor    #3FB6AE    6.65:1  AA-text
    node.logic     #6AA9F0    6.67:1  AA-text
    node.delay     #9DB7C8    7.84:1  AA-text
    node.action    #F0A94C    8.19:1  AA-text
    state.danger   #E45D5D    4.70:1  AA-text
  on panel (#07131D)
    text.primary   #EAF4FF   16.86:1  AA-text
    text.secondary #9DB7C8    8.97:1  AA-text
    text.muted     #6E8899    5.04:1  AA-text
```

### 2.3 Ham çıktı — arayüz bileşeni sınırları (eşik 3:1, WCAG 1.4.11)

```
SEPARATION (fill vs fill)
  node.surface vs canvas         1.12:1        <-- dolgu tek basina yetmiyor => sinir tasiyici
  node.header vs node.surface    1.18:1
  panel vs canvas                1.02:1

DEFAULT NODE BORDER — opaque candidates (need >=3:1 vs canvas AND vs node.surface)
  #33556B  vs canvas 2.33:1   vs node 2.07:1
  #3A5F78  vs canvas 2.71:1   vs node 2.41:1
  #406884  vs canvas 3.10:1   vs node 2.76:1
  #467190  vs canvas 3.53:1   vs node 3.14:1     <-- SECILDI
  #4C7A9C  vs canvas 4.01:1   vs node 3.57:1

#467190  canvas=3.53  node=3.14  L=0.15126
#5A8AAB  canvas=4.97  node=4.42  L=0.23291        <-- hover SECILDI (algilanabilir ama olculu adim)
#6094B7  canvas=5.63  node=5.01  L=0.27086
panel.border #406884 vs panel=3.15 vs canvas=3.10  <-- SECILDI

FINAL SET CHECK
  node.border.default #467190  canvas=3.53:1  node.surface=3.14:1
  node.border.hover   #5A8AAB  canvas=4.97:1  node.surface=4.42:1
  node.border.selected#4ABEFF  canvas=8.86:1  node.surface=7.89:1
  node.border.invalid #E45D5D  canvas=5.29:1  node.surface=4.70:1
  text.faint   #8199A8         node.surface=5.51:1  node.header=4.67:1  panel=6.30:1

EDGE FINALS vs canvas
  edge.flow            rgba(57,191,255,0.70)  => #2A8CBC  4.89:1
  edge.value           rgba(63,182,174,0.70)  => #2E8684  4.26:1
  edge.false           rgba(157,183,200,0.62) => #647989  4.07:1
  edge.dim(inactive)   rgba(157,183,200,0.40) => #445664  2.42:1   <-- gecici sonumleme, kalici degil

CANVAS DOT GRID (decorative, target 1.2-1.4:1)
  rgba(120,170,205,0.12) => #152736  1.21:1     <-- SECILDI ("cok hafif", 5430)

DISABLED / PASSIVE NODE (opacity 0.60)
  surface #0D1C29  text #929EA9 6.32:1  border #264155 1.73:1   <-- devre disi: 1.4.11 kapsam disi
```

### 2.4 Ham çıktı — renk körlüğü riski ve rozet kontrastları

```
uyari #E6B24A: pill@node #323833 text=6.19  pill@panel #2B2C24 text=7.28
hata  #E45D5D: pill@node #322B36 text=3.92  pill@panel #2A1F27 text=4.55
                     ^-- 4.5 ALTI => node uzerindeki hata rozeti metni #EAF4FF ile yazilir
aktif #4FC98E: pill@node #1A3C3E text=5.73  pill@panel #13302F text=6.76
bilgi #61CFFF: pill@node #1D3D50 text=6.47  pill@panel #153141 text=7.68

id.action #F0A94C vs warning #E6B24A delta-ratio=1.03   <-- ayrilamaz => form/konum/metin ile ayrildi
id.sensor #3FB6AE vs id.logic  #6AA9F0 delta=1.00        <-- ayrilamaz => ikon + ad zorunlu
id.trigger#39BFFF vs id.logic  #6AA9F0 delta=1.18        <-- ayni kural
```

Bu üç ölçüm dokümandaki "kimlik rengi tek başına bilgi taşımaz" kuralının (§9.2, §3.4) sayısal gerekçesidir — §25.1 (satır 1861) gereği.

### 2.5 Yasak listesi taraması (üretilen doküman üzerinde)

```
> Select-String -Pattern 'Splitter|Sayaç|Cooldown|Protokol Grupları|nebula' -CaseSensitive

L32:  | K-16 | 5446 | yalnız Karşılaştır + VE + Geciktir; VEYA/DEĞİL/Sayaç/Splitter yok | Palet **tam olarak 6** node taşır ...
L33:  | K-17 | 5447 | folder / "Protokol Grupları" yok | Sol panel düz liste; hiçbir hiyerarşi yüzeyi yok ...
L272: > §72.6 satır 5446: ... **VEYA / DEĞİL / Sayaç / Splitter / Zamanlayıcı / Cooldown bu fazda yoktur ve palette görünmez.**
L569: | Y-01 | Node'ların arkasında **yıldız / uzay / nebula** görseli | 5430 | Canvas düz #081521 + dot; başka katman yok
L570: | Y-02 | **Folder / "Protokol Grupları"** | 5447 | Sol panelde yalnız iki sabit durum bölümü ...
L571: | Y-03 | **VEYA / DEĞİL / Sayaç / Splitter** node'u | 5446 | Palet 6 satır, kapalı liste
```

Yasaklı kavramların **tamamı** yalnız olumsuzlama/denetim bağlamında geçiyor; hiçbiri tasarıma dahil edilmemiş.

### 2.6 Kanonik node listesinin kodla eşleşmesi

```
src/game/domain/protocol/Protocol.ts:14
  export const PROTOCOL_NODE_KINDS = ['trigger','sensor','compare','and','delay','action'] as const;
```

Doküman tam olarak bu altı kimliği taşır; port şeması `protocolValidator.ts:42–76`'dan, alan listeleri `Protocol.ts:45–81`'den, hata/uyarı metinleri `src/localization/tr.ts:45–65`'ten alınmıştır — hiçbiri uydurulmamıştır.

### 2.7 Kapsam ihlali olmadığının kanıtı

Ham çıktı (commit öncesi). Çalışma ağacı **paylaşımlı**: aynı anda TASK-MSSXR0J9XIP7K de bu ağaçta çalışıyor.

```
> git status --short
 M src/game/ui/protocols/ProtocolsWorkspace.tsx      <-- TASK-MSSXR0J9XIP7K (Faz 6/1)
 M src/localization/tr.ts                            <-- TASK-MSSXR0J9XIP7K
 M src/styles.css                                    <-- TASK-MSSXR0J9XIP7K (+232 satir)
?? docs/agent-results/TASK-MSSXTSZQH1CB6-tasarimci.md   <-- BENIM
?? docs/design/                                         <-- BENIM
?? src/game/content/protocols/                       <-- TASK-MSSXR0J9XIP7K
?? src/game/state/protocolExecutionLog.ts            <-- TASK-MSSXR0J9XIP7K
?? src/game/state/protocolStore.ts                   <-- TASK-MSSXR0J9XIP7K
?? src/game/ui/protocols/ProtocolManager.tsx         <-- TASK-MSSXR0J9XIP7K
?? src/game/ui/protocols/protocolManagerModel.ts     <-- TASK-MSSXR0J9XIP7K
?? src/game/ui/protocols/protocolSummary.ts          <-- TASK-MSSXR0J9XIP7K
?? tests/localization/protocolManagerLocalization.test.ts  <-- TASK-MSSXR0J9XIP7K
?? tests/ui/                                         <-- TASK-MSSXR0J9XIP7K
```

`src/` altındaki 9 değişikliğin **hiçbiri bana ait değil** — Faz 6/1'in eşzamanlı çalışması. Benim dokunduğum tek şey `docs/` altındaki iki dosya. Bu yüzden commit **yol adı vererek** yapıldı (`git add docs/design/... docs/agent-results/...`); `git add .` kullanılsaydı diğer görevin yarım işi benim commit'ime karışırdı.

Doğrulama — diğer ajanın `styles.css` eklemesi §71 token katmanı **değil** (dokümanın §18.2 varsayımı hâlâ geçerli):

```
> Select-String -Path src\styles.css -Pattern '^\s*--'
L6: --panel: rgba(7, 18, 24, 0.92);
L7: --line: rgba(119, 169, 181, 0.28);
L8: --cyan: #71c7cf;
L9: --muted: #91a6ad;
```

### 2.8 `npm run results:index` — script bu repoda yok

```
> npm run results:index
npm error Missing script: "results:index"
exit: 1
> Test-Path docs\agent-results\INDEX.md
False
```

Bu repoda böyle bir script ve `docs/agent-results/INDEX.md` **yok** (Faz 4/5 raporları da indekssiz duruyor). Sonuç indeksi tazelenemedi; uydurma bir script eklemek yerine durum olduğu gibi raporlanıyor — bkz. §5 Açık sorular.

---

## 3. Değişen dosyalar

| Dosya | Durum | Satır |
|---|---|---:|
| `docs/design/faz6-protokol-duzenleyici.md` | **yeni** | ~571 |
| `docs/agent-results/TASK-MSSXTSZQH1CB6-tasarimci.md` | **yeni** | bu dosya |

`src/`, `tests/`, `package.json`, `styles.css` — **dokunulmadı** (§2.7 kanıtı). Commit yalnız bu iki yolu içerir:

```
> git diff --cached --name-only
docs/agent-results/TASK-MSSXTSZQH1CB6-tasarimci.md
docs/design/faz6-protokol-duzenleyici.md

> git commit …
[phase-4-deterministic-layout f6c2c1f] Faz 6/T: Protokol Duzenleyici gorsel tasarim sistemi (spec 72.6)
 2 files changed, 912 insertions(+)
```

---

## 4. Riskler

1. **Eylem kimliği amber'i ile uyarı amber'i 1.03:1.** Renkle ayrılamaz. Doküman bunu form + konum + metinle çözüyor (kimlik = sol kenarda 3 px şerit; uyarı = altta ⚠ ikonlu rozet). Faz 6/2 bu ayrımı gevşetirse (ör. kimlik rengini kart dolgusuna yayarsa) uyarı semantiği okunamaz hale gelir. **Denetim maddesi Y-09 bunu yakalar.**
2. **Node dolgusu ile canvas arasında yalnız 1.12:1 var.** Kart görünürlüğü tamamen sınır rengine bağlı. Faz 6/2 sınırı §71.3.1'in `border.soft` değerine düşürürse node'lar zeminde kaybolur. Token adı (`protocol.node.border`) bilerek ayrı tutuldu.
3. **`src/styles.css` §71 token katmanını henüz taşımıyor** (14 Ağustos itibarıyla prototip düzeyinde). Faz 6/1 (TASK-MSSXR0J9XIP7K) eşzamanlı çalışıyor ve token katmanını kurabilir; kurarsa bu doküman onun üstüne eklenir, çakışmaz — `protocol.*` ön eki bunun içindir.
4. **Ölçüler 1280 px'in altında sıkışır.** 1024–1279 aralığında sağ panel canvas üzerine katman olur; bu, spec'in "sağ panel 340–380 px" ölçüsünü koruyan ama üç sütun düzenini bozan bir ödün. §5.2'de açıkça yazıldı.
5. **Doküman görsel mockup içermiyor** (ASCII yerleşim şeması var, render yok). Görev "KOD YAZMA, BİLEŞEN ÜRETME" dediği için render üretilmedi; görsel doğrulama Faz 6/2'nin ekran görüntüsü kapısına devrediliyor.

---

## 5. Açık sorular

1. **`npm run results:index` bu repoda tanımlı değil.** Görev sözleşmesi bu komutu ve `docs/agent-results/INDEX.md`'yi varsayıyor, repo taşımıyor. Soru lidere: indeks script'i bir görev olarak açılsın mı, yoksa sözleşmeden mi düşsün? (Kendi başıma `package.json`'a script eklemedim — kapsam dışı ve eşzamanlı çalışan görevin dosyası.)
2. **`dev` branch yok.** Repo faz branch'leriyle ilerliyor; Faz 5 çıktıları da `phase-4-deterministic-layout` üzerine commit'lenmiş. Bu görev de aynı branch'e commit'lendi. Faz 6 için ayrı bir branch açılacak mı?
3. **Eylem kimliği için "hedef facility identity" seçeneği** (§72.6 satır 5440) uygulanmadı — tesise göre renk, "çok renkli yapma" kısıtıyla çelişiyor ve tesis paleti Faz 6 kapsamında tanımlı değil. Tek amber kimlik seçildi. Onay gerekiyorsa lider doğrulamalı.
4. **Zoom aralığı (%40–160) ve node yerleşim adımı (12 px)** spec'te yok, tasarım kararıdır. Faz 6/2 gerçek grafikte test edip daraltabilir.

---

## 6. Sonraki adım

- **TASK-MSSXROKE7L7JB (Faz 6/2 — Graph Editor)** bu dokümanı girdi alır: §3 token'ları CSS değişkenine, §9 ölçülerini React Flow node tiplerine, §9.5 durum tablosunu stil durumlarına çevirir.
- **TASK-MSSXSDKE5X5GY (Faz 6/3 — Draft/Apply)** §17'yi (bulgu → görsel hedef eşlemesi) ve §12'deki Kontrol Et / Uygula davranışını uygular.
- **TASK-MSSXSYDRH8X3A (Faz 6/4 — çıkış kapısı)** §15'teki 12 maddelik yasak listesini denetim listesi olarak kullanmalı.
- Faz 6/1 token katmanını kurduğunda `protocol.*` token'ları `src/styles.css`'e eklenir; bu dokümanın §18'i o adımın notlarını taşıyor.
