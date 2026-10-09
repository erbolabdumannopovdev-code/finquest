# FinQuest — Moliyaviy savodxonlik platformasi
Ishga tushirish: `npm install` → `.env.example` ni `.env` ga nusxalab to'ldiring → `npm start` → http://localhost:3000
If startup reports that port 3000 is already in use, the app may already be running—open http://localhost:3000 instead of starting a second copy. To run another copy, use `PORT=3001 npm start` in Git Bash, or `$env:PORT=3001; npm start` in PowerShell, then open http://localhost:3001.
Gmail kodi: Google akkaunt → Xavfsizlik → 2 bosqichli tasdiq → App passwords. `.env` bo'sh bo'lsa kodlar terminalda chiqadi.
Deploy (Render): Build `npm install`, Start `npm start`, Environment ga `.env` qiymatlarini kiriting.

## Ma'lumotlar xotirasi
- Hammasi saqlanadi: foydalanuvchilar, byudjet yozuvlari, maqsadlar, ball, daraja, streak, darslar, yutuqlar va Telegram akkaunt bog'lanishi. JWT kaliti ham saqlanadi — server qayta ishga tushsa ham hamma tizimda qoladi.
- `MONGO_URL` bo'lsa MongoDB Atlas (users/tx/goals/meta kolleksiyalari, faqat o'zgargan hujjatlar yoziladi). Bo'lmasa `data.json` (atomik yozish + `.bak` zaxira).
- Render bepul tarifida fayl tizimi doimiy emas — deployda `MONGO_URL` albatta kiriting.
- Qo'shimcha API: `GET /api/health`, `PUT /api/me` (ism/yosh), `DELETE /api/me` (akkaunt va ma'lumotlarni o'chirish), `GET /api/admin/stats` (ADMIN_EMAIL uchun).
- Byudjet yozuvlarini saytda tahrirlash mumkin; API: `PUT /api/tx/:id`.
- Bosh sahifada joriy oy daromad/xarajat/balansi, 7 kunlik pul oqimi grafigi va eng katta xarajat kategoriyalari ko'rsatiladi. Tranzaksiyalarni matn va turi bo'yicha qidirish/filtrlash mumkin.
- O'zbekcha, ruscha, inglizcha va qozoqcha interfeys, darslar va test savollari mavjud. Tanlov profil bilan saqlanadi.
- Telefon va planshetga mos responsive ko'rinish, kichik ekranda ochiladigan menyu va brauzerda saqlanadigan yorug'/qorong'i rang rejimi mavjud. Three.js animatsiyasi kichik ekranlarda yengillashtiriladi.
- Profil sahifasida ism, yosh va til sozlamalari tahrirlanadi. Kirish tokeni brauzerda saqlanadi va 30 kun amal qiladi.
- Tasdiqlash kodini ketma-ket so'rash amaldagi kodni qayta ishlatadi; bir xil email va amal uchun yangi kodlar yuborilmaydi. Kod 5 daqiqa amal qiladi va 5 ta xato urinishdan keyin bekor qilinadi.

## Telegram bot
@BotFather orqali bot yarating, tokenni `.env` dagi `TELEGRAM_BOT_TOKEN` ga yozing. Server bilan birga ishga tushadi. Saytdagi Telegram kartasidan ulash kodini olib, botga `/link KOD` yuboring; `/account` ulangan profil va ballni ko'rsatadi. `/ai savol` yuboring yoki botga shaxsiy chatda oddiy xabar yozing — Gemini moliyaviy savodxonlik bo'yicha javob beradi. `/forget` shu chatdagi vaqtinchalik AI suhbat xotirasini tozalaydi. Buning uchun Google AI Studio kalitini `.env` dagi `GEMINI_API_KEY` ga kiriting; modelni `GEMINI_MODEL` orqali sozlash mumkin. AI kalitini hech qachon brauzerga yubormang yoki ommaviy repozitoriyga qo'shmang. Boshqa buyruqlar: /tip, /quiz, /scam, /kredit, /omonat.

Firibgarlik o'yinidagi ball demo uchun brauzerda hisoblanadi; uni ishlab chiqarishdagi ishonchli natija sifatida ishlatmang.
