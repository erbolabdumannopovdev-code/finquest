const app=require('../server');

module.exports=(req,res)=>{
  const original=req.url||'/';
  const url=new URL(original,'http://localhost');
  const route=url.searchParams.get('__path');
  if(route!==null){
    if(!/^[a-zA-Z0-9/_-]+$/.test(route)||route.split('/').includes('..')){
      res.statusCode=400;
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.end(JSON.stringify({error:'API manzili noto‘g‘ri.'}));
    }
    url.searchParams.delete('__path');
    req.url='/api/'+route.replace(/^\/+/, '')+(url.searchParams.size?`?${url.searchParams}`:'');
  }
  return app(req,res);
};
