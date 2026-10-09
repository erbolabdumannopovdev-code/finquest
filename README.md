# FinQuest — moliyaviy savodxonlik ilovasi

FinQuest daromad-xarajat hisoblash, jamg'arma maqsadlari, moliyaviy darslar va testlarni bitta veb-ilovada jamlaydi. Interfeys o'zbek, rus, ingliz va qozoq tillarida ishlaydi; telefon va planshet ekranlariga mos, yorug' va qorong'i rejimlari bor.

## GitHub'ga yuklash

1. GitHub'da bo'sh repository yarating.
2. Ushbu loyiha papkasida Git Bash terminalini oching va quyidagilarni bajaring:

   ```bash
   git init
   git add .
   git status
   ```

3. `git status` natijasida `.env`, `data.json`, `node_modules` ro'yxatda yo'qligini tekshiring. Ular ko'rinsa, push qilmang; `.gitignore` faylini tekshiring.
4. Keyin commit yarating va GitHub repository manzilini ulang:

   ```bash
   git commit -m "Prepare FinQuest for deployment"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

`USERNAME/REPOSITORY` qismini GitHub foydalanuvchi nomingiz va repository nomiga almashtiring. Maxfiy kalitlar, haqiqiy foydalanuvchi ma'lumotlari va `.env` faylini GitHub'ga hech qachon yubormang.

## Render'ga joylash (tavsiya)

Loyiha ildizidagi `render.yaml` Blueprint sozlamasidan foydalanadi. Joylashdan oldin doimiy MongoDB bazasini tayyorlang:

1. MongoDB Atlas'da cluster va ilova uchun database user yarating. Network Access'da Render'dan ulanishga ruxsat bering; URI ichidagi parolni URL encoding qiling.
2. GitHub'dagi repository'ni Render dashboard orqali **New → Blueprint** bo'limidan ulang.
3. Blueprint o'rnatish formasida `MONGO_URL` so'ralganda MongoDB ulanish manzilini kiriting. U maxfiy environment variable sifatida saqlanadi; GitHub'ga kiritmang.
4. Blueprint'ni yarating. Render `npm ci` bilan paketlarni o'rnatadi, `npm start` bilan serverni ishga tushiradi va `/api/health` manzilini tekshiradi.
5. Deploy tugagach, `https://SIZNING-SERVICE.onrender.com/api/health` manzilini oching. `{"ok":true,...}` javobi chiqishi kerak.
6. Email kodi yuborilishi uchun Render service'dagi **Environment** bo'limiga `GMAIL_USER` va `GMAIL_APP_PASSWORD` qo'shib, qayta deploy qiling. Administrator kerak bo'lsa, `ADMIN_EMAIL` ni ham kiriting.
7. Telegram va Gemini kerak bo'lsa, `TELEGRAM_BOT_TOKEN` va `GEMINI_API_KEY` ni **Environment** bo'limida sozlang. `GEMINI_MODEL` berilmasa `gemini-2.5-flash` ishlatiladi.

Render'ning bepul web service'iga uzoq vaqt so'rov kelmasa, u vaqtincha uxlaydi. Shu sababli keyingi birinchi so'rov sekin javob berishi, polling qiladigan Telegram bot esa vaqtincha to'xtashi mumkin. Bot doim ishlashi kerak bo'lsa, Render'da doim yoqilgan pullik instance yoki alohida worker kerak. Pullik tarif avtomatik tanlanmadi; narx va tarifni Render'da o'zingiz tekshiring.

MongoDB ishlatilsa ham, hozirgi saqlash qatlami ma'lumotlarni jarayon xotirasiga yuklaydi. Bitta Render instance ishlating; bu versiya bir nechta instance'da ishlashga mo'ljallanmagan.

## Vercel'ga joylash

1. GitHub repository'ni Vercel'ga import qiling.
2. Framework'ni `Other` yoki avtomatik aniqlangan Node.js sozlamasida qoldiring. Root Directory repository ildizi bo'lsin; alohida Build Command kerak emas. API yo'llari `vercel.json` orqali `api/index.js` funksiyasiga yo'naltiriladi.
3. Vercel'dagi Project → Settings → Environment Variables bo'limida quyidagilarni sozlang:
   - `MONGO_URL` — MongoDB Atlas ulanish manzili; Vercel fayllarni doimiy saqlamagani uchun majburiy.
   - `MONGO_DB` — ixtiyoriy; bo'sh bo'lsa `finquest` ishlatiladi.
   - `JWT_SECRET` — uzun, tasodifiy va maxfiy kalit.
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` — kirish kodini emailga yuborish uchun.
   - `ADMIN_EMAIL` — zarur bo'lsa administrator akkaunti emaili.
4. O'zgaruvchilarni Preview va Production muhitlariga qo'shib, qayta deploy qiling. Har bir yangi GitHub push Production deploy'ni avtomatik boshlashi kerak.
5. `https://SIZNING-DOMENINGIZ/api/health` manzilini ochib API'ni tekshiring. `MONGO_URL` yo'q bo'lsa, API 503 xato qaytaradi; avval MongoDB'ni sozlang.

Three.js CDN'dan yuklanadi, shu sababli 3D fon uchun internet kerak. CDN yuklanmasa ham asosiy interfeys ochilishi kerak.

## Vercel'dagi muhim cheklovlar

Vercel serverless muhitida ma'lumotni funksiya RAM'ida saqlab, keyingi so'rovda ham mavjudligiga kafolat berib bo'lmaydi. Tasdiqlash kodi `server.js` ichidagi RAM `Map`'da saqlanadi; kod so'rash va tasdiqlash so'rovlari boshqa serverless nusxalarga tushsa, OTP ishlamay qolishi mumkin. Hozirgi saqlash qatlami ham ma'lumotlarni jarayon xotirasiga yuklab, keyin MongoDB'ga yozadi va bir nechta serverless nusxalar uchun mo'ljallanmagan.

Telegram bot doimiy ishlaydigan long-polling jarayoni. Bu Vercel serverless sozlamasida bot o'z-o'zidan ishga tushmaydi. Gemini Telegram bot ichiga ulangan va alohida, doimiy ishlaydigan bot xizmatini talab qiladi.

Shu sabab Vercel sozlamasi web/API preview uchun; **OTP, ma'lumot yozish va Telegram'ni foydalanuvchilar uchun ishonchli production xizmati deb bo'lmaydi**. To'liq production qilishdan avval OTP'ni umumiy va doimiy xotiraga ko'chirish, MongoDB amallarini har bir serverless so'rovda bevosita hamda atomik bajarish, Telegram botni alohida doimiy worker qilish kerak. Bu ishlar alohida amalga oshirilib tekshirilmaguncha haqiqiy foydalanuvchilar ma'lumotlari bilan ishlatmang.

## Kompyuterda ishga tushirish

```bash
npm install
cp .env.example .env
npm start
```

Windows PowerShell'da `.env.example` faylini `.env` qilib nusxalang:

```powershell
Copy-Item .env.example .env
npm start
```

`http://localhost:3000` manzilini oching. Gmail sozlanmagan bo'lsa, kirish kodi terminalga chiqariladi (faqat ishlab chiqish vaqtida). `3000` port band bo'lsa, ishlayotgan FinQuest'ni oching yoki boshqa `PORT` tanlang.

## Ilova imkoniyatlari

- Email orqali bir martalik kod bilan kirish; kod 5 daqiqa amal qiladi, 5 marta xato kiritilsa bekor bo'ladi.
- Profil, til sozlamasi, ball va 30 kunlik JWT sessiyasi.
- Daromad/xarajat qo'shish, tahrirlash, o'chirish, turi bo'yicha saralash va qidirish; oy hamda so'nggi 7 kun hisoboti.
- Jamg'arma maqsadlari, kredit/omonat kalkulyatori, kategoriya xarajat limiti va CSV eksporti.
- Moliyaviy salomatlik bahosi, 5 ta dars, 8 savolli test, reyting va kunlik bonus.
- Firibgarlikni aniqlash demo o'yini. Ball brauzerdan serverga yuboriladi va soxtalashtirilishi mumkin; musobaqa yoki mukofot uchun ishonchli emas.
- Telegram ulash va Gemini yordamchisi kodi. `TELEGRAM_BOT_TOKEN` hamda `GEMINI_API_KEY` kerak; Telegram bot Vercel'da ishlamaydi.
