# 🚀 Yayınlama Kontrol Listesi (FocusLens Pro)

Projenizi GitHub'da paylaştıktan sonra Chrome Web Store'da yayınlamak için bu adımları takip edin.

## 1. GitHub'a Yükleme Adımları

Eğer bilgisayarınızda Git yüklü ise:

1. Proje klasöründe terminali açın.
2. `git init` - Git'i başlatın.
3. `git add .` - Tüm dosyaları ekleyin.
4. `git commit -m "İlk sürüm: FocusLens Pro v2.3"` - İlk kaydı yapın.
5. GitHub'da yeni bir repository oluşturun (boş).
6. GitHub'ın verdiği `git remote add origin ...` komutunu yapıştırın.
7. `git push -u origin main` - Dosyaları gönderin.

## 2. İkon Hazırlığı (ZORUNLU)

Chrome Web Store için şu boyutlarda ikonlar hazırlamanız gerekir:
- **16x16 px**: Tarayıcı sekmesi için.
- **48x48 px**: Eklenti yönetimi sayfası için.
- **128x128 px**: Web Store mağaza sayfası için.

> [!TIP]
> İkonları `manifest.json` içindeki `"icons"` bölümüne eklemeyi unutmayın. Şu an eklentinizde ikon dosyaları eksik görünüyor olabilir.

## 3. Web Store İçin Paketleme

1. Proje klasöründeki her şeyi seçin (README ve .gitignore dahil edilebilir ama şart değil).
2. **Sağ Tık > Sıkıştır (Zip yap)**.
3. Zip dosyasının ismini `focuslens_pro_v2.3.zip` gibi bir şey yapın.

## 4. Chrome Developer Dashboard

1. [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/) adresine gidin.
2. 5$ (bir kerelik) kayıt ücretini ödeyin (eğer ilk defa yapıyorsanız).
3. **"Yeni Öğe"** (New Item) butonuna tıklayın ve oluşturduğunuz `.zip` dosyasını yükleyin.
4. Mağaza açıklamasını, gizlilik politikasını ve ekran görüntülerini ekleyin.
5. **"İncelemeye Gönder"** (Submit for review) butonuna tıklayın.

---

### Önemli Notlar:
- `manifest.json` içindeki `version` numarasını her güncellemede artırmayı unutmayın.
- Mağaza için en az 2 adet 1280x800 veya 640x400 boyutunda ekran görüntüsü hazırlayın.
- Gizlilik politikasında eklentinin sadece çeviri için `mymemory` API'sini kullandığını ve kişisel veri toplamadığını belirtin.
