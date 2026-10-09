require('dotenv').config();
const express=require('express'),fs=require('fs'),path=require('path'),jwt=require('jsonwebtoken'),nodemailer=require('nodemailer'),crypto=require('crypto');
const app=express();app.use(express.json());app.use((q,s,n)=>{s.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});n()});
const hits=new Map();
app.use('/api/auth',(q,s,n)=>{const now=Date.now(),h=(hits.get(q.ip)||[]).filter(t=>now-t<6e4);h.push(now);hits.set(q.ip,h);
  h.length>12?s.status(429).json({error:"Juda ko'p urinish, 1 daqiqa kuting"}):n()});
const store=require('./store'),db=store.db,save=store.save;let SECRET;
let initPromise;
function initialize(){
  if(process.env.VERCEL&&!process.env.MONGO_URL)throw new Error('Vercel uchun doimiy ma’lumotlar bazasi kerak: MONGO_URL ni sozlang.');
  initPromise=initPromise||store.init().then(()=>{SECRET=process.env.JWT_SECRET||db.meta.secret;if(process.env.RENDER&&!process.env.MONGO_URL)console.warn("OGOHLANTIRISH: MongoDB ulanmagan. Ma’lumotlar vaqtinchalik faylda saqlanadi va Render qayta ishga tushganda yo‘qolishi mumkin.")});
  return initPromise;
}
app.use('/api',(q,s,n)=>{Promise.resolve().then(initialize).then(()=>n()).catch(e=>{console.error('Ma’lumotlar bazasini ishga tayyorlash xatosi:',e.message);s.status(503).json({error:'Xizmat vaqtincha tayyor emas. Server sozlamalarini tekshiring.'})})});
app.use(express.static(path.join(__dirname,'public')));
const uid=()=>crypto.randomBytes(8).toString('hex');
const codes=new Map();
const mail=process.env.GMAIL_USER?nodemailer.createTransport({service:'gmail',auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}}):null;
async function sendCode(email,purpose,pending){
  const key=`${purpose}:${email}`,active=codes.get(key);
  if(active&&Date.now()<=active.exp){if(purpose==='register')active.pending=pending;return {sent:false}}
  const code=String(crypto.randomInt(100000,1000000));
  const record={code,exp:Date.now()+5*60e3,tries:0,purpose,pending};
  codes.set(key,record);
  try{
    if(!mail)console.log(`[DEV] ${email} kodi: ${code}`);
    else await mail.sendMail({from:`FinQuest <${process.env.GMAIL_USER}>`,to:email,subject:'FinQuest tasdiqlash kodi',
      html:`<h2>Kodingiz: <b>${code}</b></h2><p>5 daqiqa amal qiladi.</p>`});
    return {sent:true};
  }catch(e){if(codes.get(key)===record)codes.delete(key);throw e}
}
function check(email,code,purpose){
  const key=`${purpose}:${email}`,c=codes.get(key);
  if(!c)return {error:"Tasdiqlash kodi yuborilmagan yoki muddati tugagan. Yangi kod so'rang.",status:'expired'};
  if(Date.now()>c.exp){codes.delete(key);return {error:"Kod muddati tugadi. Yangi kod so'rang.",status:'expired'}}
  if(c.tries>=5){codes.delete(key);return {error:"Urinishlar tugadi. Yangi kod so'rang.",status:'locked'}}
  if(c.code!==String(code||'').trim()){c.tries++;if(c.tries>=5){codes.delete(key);return {error:"Urinishlar tugadi. Yangi kod so'rang.",status:'locked'}}return {error:"Kod noto'g'ri. Emailga kelgan oxirgi kodni tekshiring.",status:'invalid'}}
  codes.delete(key);return {record:c};
}
const emailOk=e=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const tok=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'30d'});
const pub=u=>({id:u.id,name:u.name,age:u.age,email:u.email,locale:['uz','ru','en','kk'].includes(u.locale)?u.locale:'uz',points:u.points,lessons:u.lessons||[],level:Math.floor(u.points/50)+1,streak:u.streak||0,telegramLinked:!!u.telegramChatId,admin:!!process.env.ADMIN_EMAIL&&u.email===process.env.ADMIN_EMAIL.trim().toLowerCase()});
const wrap=f=>(q,s)=>Promise.resolve(f(q,s)).catch(e=>{console.error(e);s.status(500).json({error:'Server xatosi'})});
function auth(q,s,n){
  try{const {id}=jwt.verify((q.headers.authorization||'').slice(7),SECRET);q.user=db.users.find(u=>u.id===id);if(!q.user)throw 0;n()}
  catch{s.status(401).json({error:'Kirish talab qilinadi'})}
}
// ---- AUTH ----
app.post('/api/auth/register',wrap(async(q,s)=>{
  const name=String(q.body.name||'').trim().slice(0,50),age=+q.body.age,email=String(q.body.email||'').trim().toLowerCase();
  const locale=String(q.body.locale||'uz');
  if(name.length<2||!(age>=6&&age<=100)||!emailOk(email))return s.status(400).json({error:"Ma'lumotlar noto'g'ri"});
  if(!['uz','ru','en','kk'].includes(locale))return s.status(400).json({error:'Tanlangan til qo‘llab-quvvatlanmaydi.'});
  if(db.users.some(u=>u.email===email))return s.status(409).json({error:"Bu email ro'yxatdan o'tgan"});
  const result=await sendCode(email,'register',{name,age,locale});s.json({ok:true,reused:!result.sent});
}));
app.post('/api/auth/register/verify',(q,s)=>{
  const email=String(q.body.email||'').trim().toLowerCase(),result=check(email,q.body.code,'register');
  if(result.error)return s.status(400).json(result);
  if(db.users.some(u=>u.email===email))return s.status(409).json({error:"Bu email ro'yxatdan o'tgan"});
  const u={id:uid(),email,...result.record.pending,locale:result.record.pending.locale||'uz',points:0,best:0,created:Date.now()};db.users.push(u);save();
  s.json({token:tok(u),user:pub(u)});
});
app.post('/api/auth/login',wrap(async(q,s)=>{
  const email=String(q.body.email||'').trim().toLowerCase();if(!emailOk(email))return s.status(400).json({error:'Email manzilini to‘g‘ri kiriting.'});
  if(!db.users.some(u=>u.email===email))return s.status(404).json({error:"Bu email topilmadi, avval ro'yxatdan o'ting"});
  const result=await sendCode(email,'login');s.json({ok:true,reused:!result.sent});
}));
app.post('/api/auth/login/verify',(q,s)=>{
  const email=String(q.body.email||'').trim().toLowerCase(),result=check(email,q.body.code,'login');
  if(result.error)return s.status(400).json(result);
  const u=db.users.find(x=>x.email===email);s.json({token:tok(u),user:pub(u)});
});
app.get('/api/me',auth,(q,s)=>s.json(pub(q.user)));
// ---- TRANSACTIONS ----
app.get('/api/tx',auth,(q,s)=>s.json(db.tx.filter(t=>t.uid===q.user.id).sort((a,b)=>b.date-a.date)));
app.post('/api/tx',auth,(q,s)=>{
  const {type,amount,category}=q.body;
  if(!['income','expense'].includes(type)||!(+amount>0))return s.status(400).json({error:"Noto'g'ri ma'lumot"});
  const t={id:uid(),uid:q.user.id,type,amount:+amount,category:String(category||'Boshqa').slice(0,30),date:Date.now()};
  db.tx.push(t);save();s.json(t);
});
app.put('/api/tx/:id',auth,(q,s)=>{
  const t=db.tx.find(x=>x.id===q.params.id&&x.uid===q.user.id);
  if(!t)return s.status(404).json({error:"Tranzaksiya topilmadi"});
  const {type,amount,category}=q.body;
  if(!['income','expense'].includes(type)||!Number.isFinite(+amount)||!(+amount>0))return s.status(400).json({error:"Noto'g'ri ma'lumot"});
  t.type=type;t.amount=+amount;t.category=String(category||'Boshqa').trim().slice(0,30)||'Boshqa';save();s.json(t);
});
app.delete('/api/tx/:id',auth,(q,s)=>{db.tx=db.tx.filter(t=>!(t.id===q.params.id&&t.uid===q.user.id));save();s.json({ok:true})});
// ---- GOALS ----
app.get('/api/goals',auth,(q,s)=>s.json(db.goals.filter(g=>g.uid===q.user.id)));
app.post('/api/goals',auth,(q,s)=>{
  if(!q.body.title||!(+q.body.target>0))return s.status(400).json({error:"Noto'g'ri ma'lumot"});
  const g={id:uid(),uid:q.user.id,title:String(q.body.title).slice(0,60),target:+q.body.target,saved:0};db.goals.push(g);save();s.json(g);
});
app.post('/api/goals/:id/add',auth,(q,s)=>{
  const g=db.goals.find(x=>x.id===q.params.id&&x.uid===q.user.id);if(!g||!(+q.body.amount>0))return s.status(400).json({error:'Xato'});
  g.saved+=+q.body.amount;save();s.json(g);
});
app.delete('/api/goals/:id',auth,(q,s)=>{db.goals=db.goals.filter(g=>!(g.id===q.params.id&&g.uid===q.user.id));save();s.json({ok:true})});
// ---- CALCULATOR ----
app.post('/api/calc',auth,(q,s)=>{
  const {mode,amount,rate,months}=q.body,P=+amount,r=+rate/100/12,n=+months|0;
  if(!(P>0)||!(n>0)||!(r>=0))return s.status(400).json({error:"Noto'g'ri ma'lumot"});
  if(mode==='loan'){ // annuitet
    const pay=r?P*r/(1-Math.pow(1+r,-n)):P/n;return s.json({monthly:pay,total:pay*n,overpay:pay*n-P});
  }
  const total=P*Math.pow(1+r,n);s.json({total,profit:total-P}); // foizli omonat
});
// ---- QUIZ ----
const Q=[
 {q:"Byudjet nima?",o:["Daromad va xarajatlar rejasi","Bank kartasi","Soliq turi"],a:0},
 {q:"'Avval o'zingga to'la' qoidasi nimani anglatadi?",o:["Hammasini xarajat qilish","Daromadning bir qismini darrov jamg'arish","Qarz olish"],a:1},
 {q:"Murakkab foiz nima?",o:["Faqat asosiy summaga foiz","Foiz ustiga foiz hisoblanishi","Bank komissiyasi"],a:1},
 {q:"Favqulodda zaxira odatda necha oylik xarajatga teng bo'lishi tavsiya etiladi?",o:["1 hafta","3–6 oy","10 yil"],a:1},
 {q:"Kredit olishdan oldin eng muhim narsa?",o:["Faqat oylik to'lov","Umumiy to'lanadigan summa va foiz","Bank rangi"],a:1},
 {q:"Inflyatsiya nimaga olib keladi?",o:["Pul sotib olish qobiliyati pasayadi","Narxlar tushadi","Maosh oshadi"],a:0},
 {q:"Diversifikatsiya nima?",o:["Hamma pulni bitta joyga solish","Mablag'ni turli aktivlarga taqsimlash","Pulni yashirish"],a:1},
 {q:"Qaysi biri firibgarlik belgisi?",o:["Kafolatlangan juda yuqori daromad va'dasi","Rasmiy litsenziya","Shartnoma"],a:0}];
const QR=[
 {q:"Что такое бюджет?",o:["План доходов и расходов","Банковская карта","Вид налога"]},
 {q:"Что означает правило «Сначала заплати себе»?",o:["Потратить всё","Сразу откладывать часть дохода","Взять в долг"]},
 {q:"Что такое сложный процент?",o:["Процент только на основную сумму","Начисление процентов на проценты","Банковская комиссия"]},
 {q:"Какой резерв обычно рекомендуют иметь на случай непредвиденных расходов?",o:["На 1 неделю","На 3–6 месяцев расходов","На 10 лет"]},
 {q:"На что важнее всего смотреть перед оформлением кредита?",o:["Только на ежемесячный платёж","На общую сумму выплат и проценты","На цвет банка"]},
 {q:"К чему приводит инфляция?",o:["Снижается покупательная способность денег","Цены падают","Зарплата растёт"]},
 {q:"Что такое диверсификация?",o:["Вложить все деньги в одно место","Распределить средства между разными активами","Спрятать деньги"]},
 {q:"Что может быть признаком мошенничества?",o:["Обещание гарантированно высокой доходности","Официальная лицензия","Договор"]}];
const QE=[
 {q:"What is a budget?",o:["A plan for income and expenses","A bank card","A type of tax"]},
 {q:"What does “pay yourself first” mean?",o:["Spend everything","Save part of your income right away","Borrow money"]},
 {q:"What is compound interest?",o:["Interest only on the principal","Interest earned on interest","A bank fee"]},
 {q:"How much emergency savings is commonly recommended?",o:["One week of expenses","3–6 months of expenses","Ten years of expenses"]},
 {q:"What matters most before taking a loan?",o:["Only the monthly payment","Total repayment and interest","The bank's color"]},
 {q:"What does inflation do?",o:["Reduces money's purchasing power","Makes prices fall","Always raises wages"]},
 {q:"What is diversification?",o:["Putting all money in one place","Spreading money across different assets","Hiding money"]},
 {q:"Which may be a sign of fraud?",o:["A promise of guaranteed high returns","An official license","A contract"]}];
const QK=[
 {q:"Бюджет дегеніміз не?",o:["Кіріс пен шығыс жоспары","Банк картасы","Салық түрі"]},
 {q:"«Алдымен өзіңе төле» қағидасы нені білдіреді?",o:["Бар ақшаны жұмсау","Кірістің бір бөлігін бірден жинаққа салу","Қарыз алу"]},
 {q:"Күрделі пайыз дегеніміз не?",o:["Тек негізгі сомаға есептелетін пайыз","Пайызға есептелетін пайыз","Банк комиссиясы"]},
 {q:"Төтенше жағдайға қанша қаражат жинау ұсынылады?",o:["Бір апталық шығын","3–6 айлық шығын","Он жылдық шығын"]},
 {q:"Несие аларда ең маңыздысы не?",o:["Тек ай сайынғы төлем","Жалпы қайтарылатын сома мен пайыз","Банктің түсі"]},
 {q:"Инфляцияның әсері қандай?",o:["Ақшаның сатып алу қабілеті төмендейді","Бағалар арзандайды","Жалақы міндетті түрде өседі"]},
 {q:"Әртараптандыру дегеніміз не?",o:["Бар ақшаны бір жерге салу","Қаражатты әртүрлі активтерге бөлу","Ақшаны жасыру"]},
 {q:"Қайсысы алаяқтықтың белгісі болуы мүмкін?",o:["Жоғары табысқа кепілдік беру","Ресми лицензия","Келісімшарт"]}];
const LESSONS={
 uz:[['💡 Byudjet tuzish','50/30/20 qoidasi: daromadning 50% zarurat, 30% xohish, 20% jamg‘arma.'],['🛟 Favqulodda zaxira','3–6 oylik xarajatga teng pulni alohida saqlang.'],['📈 Murakkab foiz','Erta boshlang: foiz ustiga foiz vaqt o‘tishi bilan kuchli o‘sadi.'],['💳 Kredit','Faqat oylik to‘lovga emas, jami to‘lanadigan summaga qarang.'],['🕵️ Firibgarlikdan saqlaning','Kafolatli yuqori daromad va’dasi va SMS kod so‘rash — firibgarlik belgisi. Kodni hech kimga aytmang!']],
 ru:[['💡 Составление бюджета','Правило 50/30/20: 50% дохода — на необходимое, 30% — на желания, 20% — в накопления.'],['🛟 Резервный фонд','Отложите отдельно сумму, равную расходам за 3–6 месяцев.'],['📈 Сложный процент','Начинайте копить раньше: проценты на проценты ускоряют рост накоплений.'],['💳 Кредит','Смотрите не только на ежемесячный платёж, но и на общую сумму выплат.'],['🕵️ Защита от мошенничества','Обещание гарантированного высокого дохода и просьба назвать SMS-код — признаки мошенничества.']],
 en:[['💡 Building a budget','Use the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.'],['🛟 Emergency fund','Keep a separate reserve equal to 3–6 months of expenses.'],['📈 Compound interest','Start early: earning interest on interest can grow savings over time.'],['💳 Credit','Look beyond the monthly payment and check the total amount you will repay.'],['🕵️ Avoiding scams','Guaranteed high returns and requests for SMS codes are warning signs. Never share your code.']],
 kk:[['💡 Бюджет құру','50/30/20 қағидасы: кірістің 50%-ы қажеттілікке, 30%-ы қалауға, 20%-ы жинаққа.'],['🛟 Төтенше жағдай қоры','3–6 айлық шығынға тең соманы бөлек жинаңыз.'],['📈 Күрделі пайыз','Ертерек бастаңыз: пайызға пайыз қосылуы жинақты уақыт өте өсіреді.'],['💳 Несие','Тек айлық төлемге емес, жалпы қайтарылатын сомаға қараңыз.'],['🕵️ Алаяқтардан қорғану','Кепілді жоғары табыс уәдесі мен SMS-код сұрау — алаяқтық белгілері. Кодты ешкімге айтпаңыз!']]
};
app.get('/api/lessons',auth,(req,s)=>s.json(LESSONS[req.query.lang]||LESSONS.uz));
app.get('/api/quiz',auth,(req,s)=>{const lang=String(req.query.lang||'uz'),translated={ru:QR,en:QE,kk:QK}[lang];s.json(Q.map(({q,o},i)=>({q:translated?translated[i].q:q,o:translated?translated[i].o:o})))});
app.post('/api/quiz/submit',auth,(q,s)=>{
  const ans=q.body.answers||[],score=Q.reduce((x,k,i)=>x+(ans[i]===k.a?1:0),0)*10;
  if(score>q.user.best){q.user.points+=score-q.user.best;q.user.best=score;save()}
  s.json({score,max:Q.length*10,correct:Q.map(k=>k.a),points:q.user.points});
});
app.get('/api/leaderboard',auth,(q,s)=>s.json([...db.users].sort((a,b)=>b.points-a.points).slice(0,10).map(u=>({name:u.name,points:u.points}))));
app.post('/api/daily',auth,(q,s)=>{
  const u=q.user,d=new Date().toISOString().slice(0,10),y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  if(u.last===d)return s.json({...pub(u),already:true});
  u.streak=u.last===y?(u.streak||0)+1:1;u.last=d;u.points+=Math.min(10,2+u.streak);save();s.json(pub(u));
});
app.post('/api/scam/complete',auth,(q,s)=>{const u=q.user;if(+q.body.score>=4&&!u.scam){u.scam=1;u.points+=10;save()}s.json(pub(u))});
app.get('/api/admin/stats',auth,(q,s)=>{
  if(!pub(q.user).admin)return s.status(403).json({error:'Ruxsat yo\'q'});
  s.json({users:db.users.length,tx:db.tx.length,goals:db.goals.length,recent:db.users.slice(-8).reverse().map(pub)});
});
app.get('/api/health',(q,s)=>s.json({ok:true,users:db.users.length,store:process.env.MONGO_URL?'mongodb':'file'}));
app.put('/api/me',auth,(q,s)=>{
  const n=String(q.body.name||'').trim(),a=Number(q.body.age),locale=String(q.body.locale||q.user.locale||'uz');
  if(n.length<2||n.length>50)return s.status(400).json({error:'Ism 2–50 ta belgidan iborat bo‘lsin.'});
  if(!Number.isInteger(a)||a<6||a>100)return s.status(400).json({error:'Yosh 6–100 oralig‘ida bo‘lishi kerak.'});
  if(!['uz','ru','en','kk'].includes(locale))return s.status(400).json({error:'Tanlangan til qo‘llab-quvvatlanmaydi.'});
  q.user.name=n;q.user.age=a;q.user.locale=locale;save();s.json(pub(q.user))
});
app.delete('/api/me',auth,(q,s)=>{const id=q.user.id;db.users=db.users.filter(u=>u.id!==id);db.tx=db.tx.filter(t=>t.uid!==id);db.goals=db.goals.filter(g=>g.uid!==id);save();s.json({ok:true})});
const linkCodes=new Map();
function linkTelegram(code,chatId){
  const item=linkCodes.get(String(code));
  if(!item||Date.now()>item.expires){linkCodes.delete(String(code));return {error:"Kod noto'g'ri yoki eskirgan"}}
  const user=db.users.find(u=>u.id===item.uid);linkCodes.delete(String(code));
  if(!user)return {error:"Sayt akkaunti topilmadi"};
  for(const u of db.users)if(u.telegramChatId===String(chatId))delete u.telegramChatId;
  user.telegramChatId=String(chatId);save();return {name:user.name,points:user.points};
}
function telegramAccount(chatId){
  const u=db.users.find(x=>x.telegramChatId===String(chatId));
  return u?{name:u.name,points:u.points,level:Math.floor(u.points/50)+1}:null;
}
app.post('/api/telegram/link',auth,(q,s)=>{
  if(!process.env.TELEGRAM_BOT_TOKEN)return s.status(503).json({error:'Telegram bot sozlanmagan. TELEGRAM_BOT_TOKEN ni .env ga kiriting.'});
  if(q.user.telegramChatId)return s.json({linked:true});
  for(const [code,item] of linkCodes)if(item.expires<Date.now())linkCodes.delete(code);
  let code;do{code=crypto.randomBytes(12).toString('hex')}while(linkCodes.has(code));
  linkCodes.set(code,{uid:q.user.id,expires:Date.now()+10*60e3});
  s.json({linked:false,code,expiresIn:600});
});
app.delete('/api/telegram/link',auth,(q,s)=>{delete q.user.telegramChatId;save();s.json({ok:true})});
app.get('/api/limits',auth,(q,s)=>s.json(q.user.limits||{}));
app.put('/api/limits',auth,(q,s)=>{
  const c=String(q.body.category||'').trim().slice(0,30),a=+q.body.amount;if(!c)return s.status(400).json({error:'Kategoriya kerak'});
  q.user.limits=q.user.limits||{};if(a>0)q.user.limits[c]=a;else delete q.user.limits[c];save();s.json(q.user.limits);
});
// ---- TAHLIL, YUTUQLAR, DARSLAR, EKSPORT ----
const BADGES=[['🚀','Birinchi qadam',u=>db.tx.some(t=>t.uid===u.id)],['📒','Tartibli (10 yozuv)',u=>db.tx.filter(t=>t.uid===u.id).length>=10],
 ['🎯','Maqsad egasi',u=>db.goals.some(g=>g.uid===u.id)],['🏁','Maqsadga erishdi',u=>db.goals.some(g=>g.uid===u.id&&g.saved>=g.target)],
 ['📚','Bilimdon (5 dars)',u=>(u.lessons||[]).length>=5],['🧠','Test ustasi (80+)',u=>u.best>=80]];
app.get('/api/stats',auth,(q,s)=>{
  const u=q.user,tx=db.tx.filter(t=>t.uid===u.id),gl=db.goals.filter(g=>g.uid===u.id),sum=ty=>tx.filter(t=>t.type===ty).reduce((a,t)=>a+t.amount,0);
  const inc=sum('income'),exp=sum('expense'),cats={};
  tx.filter(t=>t.type==='expense').forEach(t=>cats[t.category]=(cats[t.category]||0)+t.amount);
  const rate=inc?(inc-exp)/inc:0,L=(u.lessons||[]).length;
  const score=Math.round(Math.min(50,Math.max(0,rate*250))+Math.min(20,gl.length*10)+Math.min(20,L*4)+Math.min(10,u.best/8));
  const adv=[];
  if(!inc)adv.push("Avval daromadingizni kiriting — tahlil shundan boshlanadi.");
  else{
    if(rate<.2)adv.push(`Jamg'arma darajangiz ${(rate*100).toFixed(0)}%. Maqsad — daromadning kamida 20% i.`);
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    if(top&&exp&&top[1]/exp>.4)adv.push(`"${top[0]}" xarajatlarning ${(top[1]/exp*100).toFixed(0)}% ini tashkil etadi — kamaytirish mumkinmi?`);
    if(inc-exp<exp*3)adv.push("Balans 3 oylik xarajatdan kam — favqulodda zaxira yarating.");
  }
  if(!gl.length)adv.push("Kamida bitta jamg'arma maqsadi qo'ying.");
  if(L<5)adv.push(`Darslarni tugating: ${L}/5.`);
  if(!adv.length)adv.push("Ajoyib! Moliyaviy holatingiz a'lo darajada 👏");
  s.json({income:inc,expense:exp,cats,score,advice:adv,badges:BADGES.map(([icon,name,f])=>({icon,name,got:!!f(u)}))});
});
app.post('/api/lessons/:i/complete',auth,(q,s)=>{
  const i=+q.params.i,u=q.user;if(!(i>=0&&i<5))return s.status(400).json({error:'Xato'});
  u.lessons=u.lessons||[];if(!u.lessons.includes(i)){u.lessons.push(i);u.points+=5;save()}s.json(pub(u));
});
app.get('/api/export',auth,(q,s)=>{
  const rows=db.tx.filter(t=>t.uid===q.user.id).map(t=>[new Date(t.date).toISOString().slice(0,10),t.type,t.category.replace(/[",\n]/g,' '),t.amount].join(','));
  s.type('text/csv').send('sana,tur,kategoriya,summa\n'+rows.join('\n'));
});
if(require.main===module){
  initialize().then(()=>{
    for(const sg of ['SIGINT','SIGTERM'])process.on(sg,async()=>{await store.close();process.exit(0)});
    const port=Number(process.env.PORT)||3000,server=app.listen(port,()=>{
      if(process.env.TELEGRAM_BOT_TOKEN)require('./bot')(Q,{link:linkTelegram,account:telegramAccount});
      else console.log("Telegram bot o'chiq (TELEGRAM_BOT_TOKEN yo'q)");
      console.log('FinQuest: http://localhost:'+port);
    });
    server.on('error',e=>{
      if(e.code==='EADDRINUSE')console.error(`PORT ${port} band байна. FinQuest аль хэдийн ажиллаж байгаа эсэхийг шалгах эсвэл PORT=3001 гэж өөр порт тохируулна уу.`);
      else console.error('Сервер эхлүүлэхэд алдаа гарлаа:',e.message);
      process.exit(1);
    });
  }).catch(e=>{console.error('Ishga tushmadi:',e);process.exit(1)});
}

module.exports=app;
