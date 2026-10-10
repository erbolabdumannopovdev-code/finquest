// Doimiy saqlash qatlami: MongoDB (MONGO_URL bo'lsa) yoki atomik fayl (data.json + .bak)
// Serverless (Vercel) uchun: refresh() har so'rovda bazadan yangilaydi, flush() ketma-ket yoziladi, codes — OTP kodlari bazada.
const fs=require('fs'),crypto=require('crypto');
const F=process.env.DATA_FILE||'data.json',COLS=['users','tx','goals'];
const db={users:[],tx:[],goals:[],meta:{}};
let mongo=null,timer=null,chain=Promise.resolve(),metaSnap='';
const snap={users:new Map(),tx:new Map(),goals:new Map()};
const strip=({_id,...r})=>r;
function remember(){COLS.forEach(k=>{snap[k].clear();db[k].forEach(d=>snap[k].set(d.id,JSON.stringify(d)))});metaSnap=JSON.stringify(db.meta)}
async function load(){
  const rs=await Promise.all(COLS.map(k=>mongo.collection(k).find().toArray()));
  COLS.forEach((k,i)=>{db[k]=rs[i].map(strip)});
  const m=await mongo.collection('meta').findOne({_id:'meta'});if(m)db.meta=strip(m);
  remember();
}
async function init(){
  if(process.env.MONGO_URL){
    const {MongoClient}=require('mongodb'),c=await MongoClient.connect(process.env.MONGO_URL);
    mongo=c.db(process.env.MONGO_DB||'finquest');
    await load();
    try{await mongo.collection('codes').createIndex({expAt:1},{expireAfterSeconds:0})}catch{} // eski OTP kodlari o'zi o'chadi
    console.log('MongoDB ulandi:',COLS.map(k=>k+'='+db[k].length).join(' '));
  }else{
    for(const f of [F,F+'.bak']){try{Object.assign(db,JSON.parse(fs.readFileSync(f)));console.log('Fayldan yuklandi:',f);break}catch{}}
    for(const k of COLS)db[k]=db[k]||[];db.meta=db.meta||{};
  }
  if(!db.meta.secret)db.meta.secret=crypto.randomBytes(32).toString('hex'); // JWT kaliti restartda o'zgarmaydi
  remember();metaSnap='';
  await flush();
}
async function doFlush(){
  try{
    if(mongo){
      for(const k of COLS){const ops=[],seen=new Set();
        for(const d of db[k]){seen.add(d.id);const j=JSON.stringify(d);if(snap[k].get(d.id)!==j){ops.push({replaceOne:{filter:{_id:d.id},replacement:d,upsert:true}});snap[k].set(d.id,j)}}
        for(const id of [...snap[k].keys()])if(!seen.has(id)){ops.push({deleteOne:{filter:{_id:id}}});snap[k].delete(id)}
        if(ops.length)await mongo.collection(k).bulkWrite(ops);
      }
      const mj=JSON.stringify(db.meta);
      if(mj!==metaSnap){await mongo.collection('meta').replaceOne({_id:'meta'},db.meta,{upsert:true});metaSnap=mj}
    }else{
      fs.writeFileSync(F+'.tmp',JSON.stringify(db));
      if(fs.existsSync(F))fs.copyFileSync(F,F+'.bak');
      fs.renameSync(F+'.tmp',F);
    }
  }catch(e){console.error('Saqlash xatosi:',e.message)}
}
// Barcha yozish/yangilash amallari bitta ketma-ketlikda (zanjirda) bajariladi
const flush=()=>{const p=chain.then(doFlush);chain=p.catch(()=>{});return p};
const refresh=()=>{if(!mongo)return Promise.resolve();const p=chain.then(load);chain=p.catch(()=>{});return p};
const save=()=>{clearTimeout(timer);timer=setTimeout(flush,250)};
async function close(){clearTimeout(timer);await flush()}
// OTP kodlari: MongoDB bo'lsa bazada (serverless nusxalar orasida umumiy), aks holda xotirada
const mem=new Map();
const codes={
  async get(k){if(!mongo)return mem.get(k)||null;const d=await mongo.collection('codes').findOne({_id:k});return d?strip(d):null},
  async set(k,r){if(mongo)await mongo.collection('codes').replaceOne({_id:k},r,{upsert:true});else mem.set(k,r)},
  async del(k){if(mongo)await mongo.collection('codes').deleteOne({_id:k});else mem.delete(k)}
};
module.exports={db,init,save,flush,refresh,close,codes};
