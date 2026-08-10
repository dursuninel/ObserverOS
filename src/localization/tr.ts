export const tr = {
  app: { title: 'Gözlemci İşletim Sistemi' },
  navigation: { primaryLabel: 'Ana çalışma alanları', colony: 'KOLONİ', protocols: 'PROTOKOLLER', debugger: 'HATA AYIKLAMA' },
  workspace: {
    colony: { title: 'KOLONİ / NIVALIS', foundationStatus: 'Dünya görünümü teknik iskeleti hazır.', prototypeStatus: 'Dondurulmuş koloni görsel prototipi · gerçek oyun durumu değildir' },
    protocols: { title: 'PROTOKOLLER', foundationStatus: 'Protokol düzenleyici entegrasyon sınırı hazır.' },
    debugger: { title: 'HATA AYIKLAMA', foundationStatus: 'Hata Ayıklama çalışma alanı teknik iskeleti hazır.' },
  },
  prototype: {
    worldStatus: 'GÖRSEL PROTOTİP ÇEVRİMİ',
    debug: { title: 'PROTOTİP KONTROLLERİ', hide: 'Paneli gizle', show: 'Kontrolleri göster', time: 'Günün zamanı', snow: 'Kar', fog: 'Sis', reactor: 'Reaktör durumu', mine: 'Maden durumu', colonists: 'Kolonici sayısı', camera: 'Kamera odağı', quality: 'Kalite profili', safeAreas: 'Güvenli alan maskeleri' },
    states: { normal: 'Normal', boost: 'Boost', interlocked: 'Güvenlik kilidinde', maintenance: 'Bakımda', working: 'Çalışıyor', offline: 'Çevrimdışı' },
    camera: { overview: 'Genel görünüm', reset: 'Koloniyi göster', reactor: 'Reaktör', mine: 'Maden', habitat: 'Habitat' },
    quality: { low: 'Düşük', medium: 'Orta', high: 'Yüksek' },
    safe: { right: 'SAĞ PANEL GÜVENLİ ALANI', bottom: 'ALT NAVİGASYON GÜVENLİ ALANI' },
    legend: { pan: 'Sürükle: kamerayı kaydır', zoom: 'Tekerlek: yakınlaştır' },
  },
} as const;
