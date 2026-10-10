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

## Render'ga joylash — MongoDB'siz sinov

Render'dagi `render.yaml` sozlamasi MongoDB'siz bepul sinov uchun tayyorlangan:

1. GitHub'dagi repository'ni Render dashboard'da **New → Blueprint** orqali ulang va Blueprint'ni yarating.
2. Render `npm ci` bilan paketlarni o'rnatadi, `npm start` bilan serverni ishga tushiradi; `JWT_SECRET` o'zi yaratiladi.
3. Deploy tugagach, `https://SIZNING-SERVICE.onrender.com/api/health` manzilini oching. `{"ok":true,...,"store":"file"}` javobi ilova ishlayotganini bildiradi.

MongoDB'siz ilova ishlaydi, lekin ma'lumotlar `data.json` nomli vaqtinchalik faylga yoziladi. Render bepul xizmati qayta ishga tushganda yoki yangi kod joylanganda bu fayl yo'qolishi mumkin; shu sabab akkauntlar, tranzaksiyalar va boshqa yozuvlar saqlanishiga kafolat yo'q. Faqat sinov uchun ishlating, haqiqiy foydalanuvchi ma'lumotlarini kiritmang. Keyin MongoDB ulamoqchi bo'lsangiz, Render'dagi **Environment** bo'limiga `MONGO_URL` qo'shib, qayta joylang.

Email orqali tasdiqlash kodi yuborish uchun Render'dagi **Environment** bo'limiga `GMAIL_USER` va Google hisobidan yaratilgan `GMAIL_APP_PASSWORD` ni qo'shib, qayta joylang. Bu sozlamalarsiz kod server jurnaliga yoziladi, shuning uchun ochiq saytda ro'yxatdan o'tishga yaramaydi. Email yuborish 15–20 soniyada bajarilmasa, ekranda xato chiqadi va yangi kod so'rash mumkin bo'ladi; Render loglarida `EAUTH` ko'rinsa Gmail App Password noto'g'ri yoki bekor qilingan, `ETIMEDOUT` ko'rinsa SMTP ulanishi vaqtida tugagan bo'lishi mumkin. `ADMIN_EMAIL` administrator uchun, `TELEGRAM_BOT_TOKEN` va `GEMINI_API_KEY` esa bot hamda sun'iy intellekt uchun kerak.

Render'ning bepul xizmati bir muddat so'rov olmasa, uxlab qoladi. Shu sabab keyingi birinchi so'rov sekin ishlashi, Telegram bot esa uzilib qolishi mumkin. Botni doim ishlatish uchun doim yoqilgan xizmat yoki alohida ishchi jarayon kerak.

MongoDB ulangan taqdirda ham, hozirgi kod ma'lumotlarni jarayon xotirasiga yuklaydi. Bitta Render nusxasidan foydalaning; bir nechta nusxada ishlash bu versiyada qo'llab-quvvatlanmaydi.

## Emailga kod yuborish (Render bepul rejasida)

Render'ning bepul xizmati SMTP portlarini (25, 465, 587) yopgan, shu sabab Gmail SMTP u yerda ishlamaydi. HTTPS orqali ishlaydigan Brevo'dan foydalaning:

1. https://brevo.com da bepul akkaunt oching.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** orqali o'z emailingizni qo'shib, xatdagi havola bilan tasdiqlang.
3. **SMTP & API → API Keys** bo'limida kalit yarating (`xkeysib-...`).
4. Render → Environment: `BREVO_API_KEY` = kalit, `MAIL_FROM` = tasdiqlangan email.
5. Xat spam papkasiga tushishi mumkin; birinchi sinovda shu papkani ham tekshiring.

Oddiy sinov uchun `SIMPLE_AUTH=1` yoki SMTP sozlamalari yo'q bo'lganda tasdiqlash kodi avtomatik o‘tkazib yuboriladi va ro'yxatdan o'tish/login darhol ishlaydi. Bu usul SMS/email yuborishni talab qilmaydi.

## Render + MongoDB Atlas (ma'lumotlar yo'qolmasligi uchun)

1. MongoDB Atlas'da bepul klaster yarating va **Database Access** bo'limida login/parolli foydalanuvchi qo'shing.
2. **Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)**. Render'ning IP manzili o'zgarib turadi, shuning uchun bu kerak.
3. **Connect → Drivers** orqali ulanish satrini oling (`mongodb+srv://...`), ichidagi `<password>` ni haqiqiy parolga almashtiring. Parolda maxsus belgilar bo'lsa, ularni URL-kodlang.
4. Render → Environment bo'limida `MONGO_URL` ga shu satrni kiriting va **Save, rebuild and deploy** qiling.
5. `/api/health` javobida `\"store\":\"mongodb\"` ko'rinishi kerak.

## Vercel'ga joylash

1. GitHub repository'ni Vercel'ga import qiling (Framework: `Other`). Root Directory — repository ildizi; Build Command kerak emas. `vercel.json` `public/` papkasini sayt sifatida, `/api/*` yo'llarini esa `api/index.js` funksiyasiga yo'naltiradi.
2. **Settings → Environment Variables** bo'limida (Production va Preview uchun) quyidagilarni kiriting:
   - `MONGO_URL` — MongoDB Atlas ulanish satri (majburiy). Atlas → Network Access'da `0.0.0.0/0` ruxsati bo'lsin.
   - `JWT_SECRET` — uzun tasodifiy matn (majburiy; yo'q bo'lsa API 503 qaytaradi).
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` — kod yuborish uchun (Vercel 465/587 portlarini yopmaydi), yoki `BREVO_API_KEY` + `MAIL_FROM`.
   - `MONGO_DB` (ixtiyoriy), `ADMIN_EMAIL` (ixtiyoriy).
3. Deploy qiling va `https://SIZNING-DOMENINGIZ/api/health` manzilini oching; javobda `"store":"mongodb"` bo'lishi kerak.

Serverless uchun moslashtirilgan: tasdiqlash kodlari MongoDB'ning `codes` to'plamida saqlanadi (5 daqiqadan keyin o'zi o'chadi), ma'lumotlar har so'rovda bazadan yangilanadi va o'zgarish javob qaytarilishidan oldin yoziladi, shuning uchun bir nechta serverless nusxa bir-biriga xalaqit bermaydi.

Vercel'dagi cheklovlar:
- Telegram bot (doimiy long-polling) Vercel'da ishlamaydi; bot kerak bo'lsa Render'da ishlating.
- Har so'rovda ma'lumotlar bazadan qayta o'qiladi, shuning uchun foydalanuvchilar soni juda oshganda sekinlashadi.
- Bir xil yozuvni bir vaqtda ikki nusxadan o'zgartirsangiz, oxirgi yozuv saqlanadi.
- Urinishlar limiti (rate limit) har nusxada alohida hisoblanadi.
- Firibgarlikni aniqlash o'yini balli brauzerdan keladi va soxtalashtirilishi mumkin.

Three.js CDN'dan yuklanadi, shu sababli 3D fon uchun internet kerak. CDN yuklanmasa ham asosiy interfeys ochilishi kerak.

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
