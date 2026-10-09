// FinQuest Telegram bot (qo'shimcha kutubxonasiz, long polling). Token: TELEGRAM_BOT_TOKEN
const call=(m,b)=>fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const escapeHtml=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const chats=new Map(),aiHits=new Map();
async function askGemini(chatId,prompt){
  if(!process.env.GEMINI_API_KEY)return 'AI yordamchi hali sozlanmagan. Administrator GEMINI_API_KEY ni server .env fayliga qo‘shishi kerak.';
  const now=Date.now(),recent=(aiHits.get(chatId)||[]).filter(t=>now-t<60e3);
  if(recent.length>=8)return 'AI yordamchiga juda ko‘p so‘rov yuborildi. Bir daqiqadan keyin qayta urinib ko‘ring.';
  recent.push(now);aiHits.set(chatId,recent);
  if(aiHits.size>1000)aiHits.delete(aiHits.keys().next().value);
  const history=chats.get(chatId)||[];
  const contents=[...history,{role:'user',parts:[{text:prompt.slice(0,3000)}]}];
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  let response,data;
  try{
    response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),
      body:JSON.stringify({system_instruction:{parts:[{text:"You are FinQuest, a friendly financial-literacy tutor. Answer in the user's language (Uzbek, Russian, Kazakh, or English), clearly and briefly. Explain budgeting, saving, interest, credit, and fraud prevention for beginners. Do not request sensitive personal or banking data, promise returns, or present personalized investment/tax/legal advice as certain. Encourage consulting a qualified professional for decisions with significant financial consequences."}]},contents,generationConfig:{temperature:0.6,maxOutputTokens:700}})
    });
    data=await response.json();
  }catch(e){console.error('Gemini tarmoq xatosi:',e.name);return 'AI xizmatiga ulanish vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.'}
  if(!response.ok){console.error('Gemini API xatosi:',response.status,data.error&&data.error.status);return 'AI vaqtincha javob bera olmayapti. Birozdan so‘ng qayta urinib ko‘ring.'}
  const text=(data.candidates||[]).flatMap(c=>c.content&&c.content.parts||[]).map(p=>p.text||'').join('').trim();
  if(!text)return 'AI javob tayyorlay olmadi. Savolni boshqacha yozib ko‘ring.';
  chats.set(chatId,[...contents,{role:'model',parts:[{text}]}].slice(-12));
  if(chats.size>1000)chats.delete(chats.keys().next().value);
  return text;
}
const TIPS=["50/30/20: daromadning 50% zarurat, 30% xohish, 20% jamg'arma.","Favqulodda zaxira — 3–6 oylik xarajatga teng pulni alohida saqlang.","Kredit olishdan oldin oylik to'lovga emas, jami to'lanadigan summaga qarang.","Murakkab foizda vaqt — eng kuchli ittifoqchi: erta boshlang.","SMS kod, karta raqami va CVV ni hech kimga aytmang — bank xodimi ham so'ramaydi.","Kafolatlangan yuqori daromad va'dasi — firibgarlik belgisi."];
const SC=[["Karta bloklandi! Qulfdan chiqarish uchun SMS kodni yuboring.",1,"Bank hech qachon SMS kodni so'ramaydi."],["Ilova orqali 50 000 so'm to'lov amalga oshirildi.",0,"Bu oddiy xabarnoma, kod yoki havola so'ralmagan."],["Tabriklaymiz! 5 000 000 yutdingiz. Havolani bosib karta ma'lumotini kiriting.",1,"Yutuq va'dasi + karta ma'lumoti = firibgarlik."],["Men bank xodimiman, pulingizni saqlash uchun kodni ayting.",1,"Kodni hech kimga bermang."]];
module.exports=function start(Q,site={}){
  if(!process.env.TELEGRAM_BOT_TOKEN)return console.log("Telegram bot o'chiq (TELEGRAM_BOT_TOKEN yo'q)");
  let off=0;const st={},fmt=n=>Math.round(n).toLocaleString('ru-RU')+" so'm";
  const send=(id,text,kb)=>call('sendMessage',{chat_id:id,text,parse_mode:'HTML',reply_markup:kb&&{inline_keyboard:kb}});
  const ask=id=>{const s=st[id],q=Q[s.i];return send(id,`<b>${s.i+1}/${Q.length}</b> ${q.q}`,q.o.map((o,j)=>[{text:o,callback_data:'q'+j}]))};
  async function onMsg(m){
    const id=m.chat.id,[cmd,...a]=(m.text||'').split(' ');
    switch(cmd.split('@')[0]){
      case '/start':case '/help':return send(id,"💰 <b>FinQuest bot</b>\n/link KOD — sayt akkauntini ulash\n/account — ulangan akkaunt ma'lumoti\n/ai savol — Gemini moliyaviy yordamchi\n/forget — AI suhbat tarixini o'chirish\n/tip — kunlik maslahat\n/quiz — bilim testi\n/scam — firibgarlikni toping\n/kredit 10000000 24 12 — summa, yillik %, oy\n/omonat 5000000 18 12 — omonat natijasi\n/invest 1000000 500000 18 10 — boshlang'ich, oylik, yillik %, yil");
      case '/link':{
        if(!a[0])return send(id,'Sayt bergan kodni kiriting: <code>/link 12345678</code>');
        if(!site.link)return send(id,'Akkaunt ulash funksiyasi hozircha ishlamayapti.');
        const result=site.link(a[0],id);
        return send(id,result.error?'❌ '+result.error:`✅ FinQuest akkaunti ulandi: <b>${String(result.name).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</b>\nBall: ${result.points}`);
      }
      case '/account':{
        const account=site.account&&site.account(id);
        return send(id,account?`👤 <b>${String(account.name).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</b>\n⭐ ${account.points} ball · 🎖 ${account.level}-daraja`:'Sayt akkaunti ulanmagan. Saytda Telegram ulash kodini oling va <code>/link KOD</code> yuboring.');
      }
      case '/ai':case '/ask':{
        const prompt=a.join(' ').trim();
        if(!prompt)return send(id,'Savolingizni yozing: <code>/ai Byudjetni qanday tuzaman?</code>');
        return send(id,escapeHtml(await askGemini(id,prompt)));
      }
      case '/forget':chats.delete(id);return send(id,'AI suhbat xotirasi tozalandi.');
      case '/invest':{const [P,M,y,yr]=a.map(Number);if(!(P>=0&&M>=0&&y>=0&&yr>0))return send(id,"Format: /invest boshlang'ich oylik yillik% yil");
        let b=P;for(let m=0;m<yr*12;m++)b=b*(1+y/1200)+M;const put=P+M*yr*12;return send(id,`📈 Oxirida: <b>${fmt(b)}</b>\nSiz qo'ygan: ${fmt(put)}\nFoyda: ${fmt(b-put)}`)}
      case '/tip':return send(id,'💡 '+TIPS[Math.floor(Math.random()*TIPS.length)]);
      case '/quiz':st[id]={i:0,s:0};return ask(id);
      case '/scam':{const k=Math.floor(Math.random()*SC.length);return send(id,'📱 '+SC[k][0],[[{text:'🚨 Firibgarlik',callback_data:`s${k}_1`},{text:'✅ Xavfsiz',callback_data:`s${k}_0`}]])}
      case '/kredit':case '/omonat':{
        const [P,y,n]=a.map(Number);if(!(P>0&&y>=0&&n>0))return send(id,'Format: '+cmd+' summa yillik% oy');const r=y/1200;
        if(cmd=='/kredit'){const p=r?P*r/(1-Math.pow(1+r,-n)):P/n;return send(id,`Oylik: <b>${fmt(p)}</b>\nJami: ${fmt(p*n)}\nOrtiqcha: ${fmt(p*n-P)}`)}
        const T=P*Math.pow(1+r,n);return send(id,`Oxirida: <b>${fmt(T)}</b>\nFoyda: ${fmt(T-P)}`)}
    }
    if(m.chat.type==='private'&&m.text&&!m.text.startsWith('/'))return send(id,escapeHtml(await askGemini(id,m.text)));
  }
  async function onCb(c){
    const id=c.message.chat.id,d=c.data;call('answerCallbackQuery',{callback_query_id:c.id});
    if(d[0]=='s'){const [k,a]=d.slice(1).split('_');return send(id,(+a==SC[k][1]?"✅ To'g'ri! ":"❌ Noto'g'ri. ")+SC[k][2])}
    const s=st[id];if(d[0]!='q'||!s)return;if(+d.slice(1)==Q[s.i].a)s.s++;s.i++;
    if(s.i<Q.length)return ask(id);
    send(id,`🏁 Natija: <b>${s.s*10}/${Q.length*10}</b>`);delete st[id];
  }
  (async()=>{for(;;){try{const r=await call('getUpdates',{offset:off,timeout:30});
    if(!r.ok){console.error('Telegram:',r.description);await sleep(10000);continue}
    for(const u of r.result){off=u.update_id+1;if(u.message)try{await onMsg(u.message)}catch(e){console.error('Bot xabari xatosi:',e.message);await send(u.message.chat.id,'Xabarni qayta ishlashda xatolik yuz berdi. Keyinroq urinib ko‘ring.')}if(u.callback_query)try{await onCb(u.callback_query)}catch(e){console.error('Bot callback xatosi:',e.message)}}}catch(e){console.error('Telegram so‘rovi xatosi:',e.message);await sleep(3000)}}})();
  console.log('Telegram bot ishga tushdi');
};
