// Doimiy saqlash qatlami: MongoDB (MONGO_URL bo'lsa) yoki atomik fayl (data.json + .bak)
const fs=require('fs'),crypto=require('crypto');
const F=process.env.DATA_FILE||'data.json',COLS=['users','tx','goals'];
const db={users:[],tx:[],goals:[],meta:{}};
let mongo=null,timer=null,busy=false,again=false;const snap={users:new Map(),tx:new Map(),goals:new Map()};
async function init(){
  if(process.env.MONGO_URL){
    const {MongoClient}=require('mongodb'),c=await MongoClient.connect(process.env.MONGO_URL);
    mongo=c.db(process.env.MONGO_DB||'finquest');
    for(const k of COLS)db[k]=(await mongo.collection(k).find().toArray()).map(({_id,...r})=>r);
    const m=await mongo.collection('meta').findOne({_id:'meta'});if(m){const {_id,...r}=m;db.meta=r}
    console.log('MongoDB ulandi:',COLS.map(k=>k+'='+db[k].length).join(' '));
  }else{
    for(const f of [F,F+'.bak']){try{Object.assign(db,JSON.parse(fs.readFileSync(f)));console.log('Fayldan yuklandi:',f);break}catch{}}
    for(const k of COLS)db[k]=db[k]||[];db.meta=db.meta||{};
  }
  if(!db.meta.secret)db.meta.secret=crypto.randomBytes(32).toString('hex'); // JWT kaliti restartda o'zgarmaydi
  COLS.forEach(k=>db[k].forEach(d=>snap[k].set(d.id,JSON.stringify(d))));
  await flush();
}
async function flush(){
  if(busy){again=true;return}busy=true;
  try{
    if(mongo){
      for(const k of COLS){const ops=[],seen=new Set();
        for(const d of db[k]){seen.add(d.id);const j=JSON.stringify(d);if(snap[k].get(d.id)!==j){ops.push({replaceOne:{filter:{_id:d.id},replacement:d,upsert:true}});snap[k].set(d.id,j)}}
        for(const id of [...snap[k].keys()])if(!seen.has(id)){ops.push({deleteOne:{filter:{_id:id}}});snap[k].delete(id)}
        if(ops.length)await mongo.collection(k).bulkWrite(ops);
      }
      await mongo.collection('meta').replaceOne({_id:'meta'},db.meta,{upsert:true});
    }else{
      fs.writeFileSync(F+'.tmp',JSON.stringify(db));
      if(fs.existsSync(F))fs.copyFileSync(F,F+'.bak');
      fs.renameSync(F+'.tmp',F);
    }
  }catch(e){console.error('Saqlash xatosi:',e.message)}
  busy=false;if(again){again=false;await flush()}
}
const save=()=>{clearTimeout(timer);timer=setTimeout(flush,250)};
async function close(){clearTimeout(timer);await flush();while(busy)await new Promise(r=>setTimeout(r,20))}
module.exports={db,init,save,flush,close};
