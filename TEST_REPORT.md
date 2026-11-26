# Deneme Günlüğü v4 — Kontrol raporu

## Yapılan iyileştirmeler
- TYT ve AYT deneme arşivleri ayrı.
- Deneme > ders > o derse ait fotoğraflar akışı korunuyor.
- Ders ekranında konu bilgisini sonradan düzenleme.
- Tek bir yanlış soru fotoğrafını silme.
- Denemeyi ve ona bağlı bütün soruları onayla silme.
- Kayıt/yedek işlemlerinde hata olursa bellekteki önceki verileri geri yükleme.
- Yedek dosyasında deneme-soru ilişkisi, fotoğraf tipi ve yinelenen kimlik doğrulaması.
- Kamera önizlemesi açık kalırken art arda çekim; ön/arka kamera değiştirme.
- GitHub Actions içinde derlemeden önce otomatik kaynak doğrulaması.

## Gerçekleştirilen kontroller
- `node --check main.js`: başarılı.
- `npm run validate`: başarılı.
- 65 HTML kimliği ve JavaScript'te kullanılan 56 statik element referansı eşleşiyor.
- JSON yapılandırmaları: başarılı.
- Workflow YAML ayrıştırması: başarılı.
- İkon dosyaları PNG olarak açılıyor ve 192x192 / 512x512 boyutlarında.
- Vite giriş dosyası ve Capacitor `webDir=dist` yolları eşleşiyor.
- ZIP arşiv bütünlüğü ayrıca doğrulandı.

## Henüz yapılamayan kontroller
Bu çalışma ortamında npm paket indirme isteği zaman aşımına uğradı. Bu nedenle Vite production build, Android Gradle APK build ve fiziksel Samsung cihazında kamera testi burada çalıştırılamadı. GitHub Actions ilk çalıştırması Vite/Android build için gerçek doğrulama olacaktır. APK kurulduktan sonra kamera izni, arka arkaya çekim, ön/arka kamera ve cihazda kayıt/yedek geri yükleme test edilmelidir.

## Önemli
Uygulama fotoğrafları cihazdaki IndexedDB içinde tutulur. Uygulama kaldırılırsa veya uygulama verileri temizlenirse kayıtlar kaybolabilir. Düzenli olarak JSON yedeği al.
