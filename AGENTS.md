# Gözlemci İşletim Sistemi — Codex Çalışma Kuralları

## 1. Tek kanonik ürün kaynağı

Bu projenin ürün davranışı ve tasarım kararları için tek kanonik kaynak:

`docs/Gozlemci_OS_Kanonik_Tasarim_ve_Gelistirme_Spesifikasyonu_v10_3.md`

Bu dosya MUST/KESİN ürün sözleşmesidir.

Bir davranış, sistem, UI, facility, protocol, gezegen, kaynak,
denge, görsel tasarım veya mimari konusunda tereddüt oluştuğunda:

1. Tahmin etme.
2. Kullanıcıya hemen soru sorma.
3. Önce kanonik spesifikasyonda ilgili bölümü ara ve oku.
4. Cevap varsa spesifikasyonu uygula.

Spesifikasyon ile mevcut kod çelişirse mevcut kod ürün gerçeği kabul edilmez.
Kanonik spesifikasyon üstündür.

---

## 2. Halüsinasyon yasağı

Yeni ürün davranışı uydurma.

Özellikle kendiliğinden ekleme:

- yeni resource
- yeni facility
- yeni facility mode
- yeni protocol node
- yeni screen/tab
- yeni progression sistemi
- yeni meta currency
- yeni gameplay mechanic
- yeni event davranışı
- yeni save davranışı
- yeni root-cause kuralı
- yeni UI metriği

YASAKTIR.

"Bu tip oyunlarda genelde böyle olur" gerekçe değildir.

---

## 3. Kullanıcı komutuna tam uyum

Yalnızca verilen görevi yap.

Kullanıcı "Faz 0" dediyse:
- Faz 0 kapsamını yap.
- Faz 1 özelliği implement etme.
- İleri faz için yalnız zorunlu ve açık extension point bırakılabilir.

İstenmeyen:
- refactor
- feature
- redesign
- dependency değişimi
- mimari yeniden yazım

yapma.

Gerçekten gerekiyorsa önce gerekçeyi raporla.

---

## 4. MUST / TUNABLE / DEFERRED

### MUST / KESİN
Değiştirilemez.

### TUNABLE
Spesifikasyondaki başlangıç değerini kullan.
Config/data katmanına koy.
"Bu sayı kaç olsun?" diye sorma.

### DEFERRED
Şu anda implement etme.
Hayali davranışla boşluğu doldurma.
Gerekirse extension point veya TODO bırak.

---

## 5. Teknik karar ile ürün kararını ayır

Oyuncuya görünmeyen ve ürün semantiğini değiştirmeyen
geri döndürülebilir teknik ayrıntılarda karar verebilirsin.

Örnek:
- private helper adı
- dosya içi fonksiyon ayrımı
- eşdeğer veri yapısı
- test helper organizasyonu

Bunlar için soru sorma.

Ancak oyuncu davranışını veya oyun sonucunu etkileyen karar ürün kararıdır.
Spesifikasyonda bulunmuyorsa uydurma.

---

## 6. Mimari temel kuralları

- Simulation Engine authoritative gameplay state kaynağıdır.
- Simulation React'tan bağımsız çalışabilmelidir.
- Renderer gameplay kararı vermez.
- React Three Fiber yalnız authoritative world state'i render eder.
- React Flow execution engine değildir.
- Zustand core simulation truth'un ikinci kopyasını tutmaz.
- Oyun deterministic olmalıdır.
- FPS simulation sonucunu değiştiremez.
- Player-facing string'ler localization üzerinden gelmelidir.
- Sayısal balance değerleri engine içine hard-code edilmemelidir.
- Facility ve planet davranışları data-driven olmalıdır.

---

## 7. Görsel uygulama kuralları

UI veya world implementasyonunda karar sırası:

1. Kanonik bilgi mimarisi
2. Kanonik görsel tasarım sözleşmesi
3. Konsept görsellerin estetik yönü

Konsept görselde bulunan ama spesifikasyonda bulunmayan:
- tab
- button
- metric
- node
- resource
- gameplay behavior

uygulanmaz.

Görsel olarak ekleme yapma.

---

## 8. Çalışma biçimi

Her görevde:

1. Önce görevle ilgili spesifikasyon bölümlerini ara ve oku.
2. Mevcut kodu incele.
3. Kısa implementasyon planı çıkar.
4. Yalnız istenen kapsamı uygula.
5. Test/lint/typecheck çalıştır.
6. Acceptance criteria'yı tek tek kontrol et.
7. Değişiklikleri özetle.
8. Açık sorun varsa belirt.
9. Sonraki faza kendiliğinden geçme.

---

## 9. Test zorunluluğu

Core semantic değişikliklerinde uygun olduğunda:

- unit tests
- integration tests
- determinism tests
- scenario regression tests

eklenmelidir.

Bir test başarısızsa yalnız test geçsin diye ürün davranışını değiştirme.
Önce spesifikasyonu kontrol et.

---

## 10. Soru sorma eşiği

Yalnız şu durumlarda insan kararı iste:

1. İki MUST/KESİN kural gerçekten birbiriyle çelişiyorsa.
2. Gerekli gerçek asset/dış kaynak mevcut değilse ve fallback ürün görünümünü değiştiriyorsa.
3. İlerlemek için yeni kullanıcıya dönük mekanik veya ürün kararı eklemek zorunluysa.

Bunun dışında önce dosyada ara ve mevcut varsayılanı uygula.

---

## 11. Görev sonu kontrolü

Bitirmeden önce kendine sor:

- Kullanıcının istemediği bir şey ekledim mi?
- Spesifikasyonda olmayan gameplay semantiği uydurdum mu?
- Bir MUST kuralını değiştirdim mi?
- İleri faz özelliğine girdim mi?
- Hard-coded tuning değeri bıraktım mı?
- Renderer veya UI'ya simulation truth koydum mu?
- Testleri gerçekten çalıştırdım mı?

Bir tanesine bile "evet" cevabı varsa görevi tamamlanmış sayma.