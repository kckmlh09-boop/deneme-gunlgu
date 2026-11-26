# Deneme Günlüğü v4 — Android kaynak projesi

Bu proje, GitHub Actions ile Android debug APK üretmek için hazırlanmıştır. Android Studio veya bilgisayar gerekmez; GitHub deposuna dosyaları yükleyip Actions sonucundan APK alınır.

## Yeni, boş GitHub deposuna yükleme

1. GitHub'da yeni ve boş bir repo oluştur. Varsayılan dalın `main` olsun.
2. Bu ZIP dosyasını cihazına indirip aç.
3. ZIP'in **içindeki tüm dosyaları ve klasörleri** repo ana dizinine yükle. ZIP dosyasının kendisini tek dosya olarak yükleme.
4. `.github/workflows/build-apk.yml` yolunu aynen koru. `main.js`, `index.html`, `package.json` ve `capacitor.config.json` ana dizinde olmalı. `public` klasöründe ikonlar ve manifest bulunmalı.
5. Commit et. Actions sekmesinde `Build Yanlis Defterim APK` çalışır.
6. Yeşil tikli çalıştırmayı aç. En alttaki Artifacts bölümünden `deneme-gunlugu-debug-apk` dosyasını indir. ZIP'i açıp `app-debug.apk` dosyasını Android'e kur.

## Repo dosya yapısı

```text
.github/
  workflows/
    build-apk.yml
public/
  manifest.json
  icon-192.png
  icon-512.png
index.html
main.js
package.json
capacitor.config.json
.gitignore
README_GITHUB.md
```

## Özellikler

- AMOLED koyu tema ve yenilenmiş kart/başlık tasarımı.
- TYT sırası: Türkçe, Tarih, Coğrafya, Felsefe, Din Kültürü, Matematik, Fizik, Kimya, Biyoloji.
- AYT sırası: Matematik, Fizik, Kimya, Biyoloji.
- Capacitor Camera Preview ile uygulama içinde canlı kamera önizlemesi; deklanşöre tekrar tekrar basınca kamera kapanmadan fotoğraf çekme.
- Ön/arka kamera değiştirme; kamera açıkken çekim sayacı; bitirip ders akışına dönme.
- Son aşamada fotoğrafları derslerine göre inceleme ve her fotoğrafa isteğe bağlı konu yazma.
- Ana ekranda ayrı TYT ve AYT deneme bölümleri; her bölümde yalnızca ilgili sınav türünün denemeleri.
- Deneme seçilince yalnızca o denemede fotoğrafı bulunan derslerin listelenmesi; derse dokununca sadece o derse ait soru fotoğraflarının ve konu notlarının açılması.
- Deneme arama, ders dağılımı ve deneme ayrıntıları.
- Deneme ayrıntılarından onay sorarak denemeyi ve ona bağlı tüm yanlış soru fotoğraflarını topluca silme.
- Ders fotoğrafları ekranında her fotoğrafın konu bilgisini sonradan düzenleme ve tek tek fotoğraf silme.
- Fotoğraf veya deneme silme/kaydetme işlemlerinde veritabanı hatası olursa bellekteki önceki kayıtları geri yükleme.
- Yedek yüklerken dosya biçimi, deneme-soru ilişkileri, fotoğraf türleri ve yinelenen kimlikleri doğrulama; mevcut kayıtlarla kimlik bazlı birleştirme.
- Fotoğrafları cihazda IndexedDB ile yerel saklama; JSON yedek dışa aktarma ve yedekten birleştirerek geri yükleme.
- AI kullanılmaz.

## Teknik notlar

- Capacitor 7.4.3 ve `@capacitor-community/camera-preview` 7.0.5 birlikte kullanılır. Kamera eklentisinin resmi açıklaması Capacitor 7 için 7.0.5 sürümünü önerir.
- Vite çıktısı `dist` klasörüne alınır; `capacitor.config.json` içindeki `webDir` de `dist` olarak ayarlıdır.
- GitHub Actions, Vite derlemesinden önce `npm run validate` çalıştırır. Bu kontrol statik HTML kimliklerini, JavaScript'in kullandığı elementleri, JSON yapılandırmalarını ve dosya yollarını denetler.
- Workflow Android kamera iznini manifest'e ekler.
- Uygulama kayıtları cihazın yerel veritabanında tutulur. Uygulamayı kaldırmak veya uygulama verilerini temizlemek kayıtları silebilir; düzenli yedek al.

## Doğrulama sınırı

Kaynak dosyalarının yolları, JSON, JavaScript sözdizimi ve workflow YAML yapısı yerel kontrollerden geçirilmiştir. Bu çalışma ortamında npm paketleri indirilemediği ve Android SDK derlemesi çalıştırılamadığı için gerçek APK derlemesi ve fiziksel Samsung cihaz kamera testi yapılmış değildir. İlk GitHub Actions çalıştırması gerçek derleme kontrolüdür; telefondaki kamera davranışı da APK kurulduktan sonra test edilmelidir.

Ayrıntılı statik kontrol ve test sınırları için `TEST_REPORT.md` dosyasına bak.
