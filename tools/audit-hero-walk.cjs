// Browser audit of the actual decoded PNGs and runtime animation frames.
const path=require('node:path');
const assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}).catch(error=>{server.close();throw error;});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:1180}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/previews/animation-preview.html`);
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Герои готовы к бою');
 await page.waitForFunction(()=>performance.getEntriesByType('resource').filter(e=>/\/heroes\/(asterix|obelix|cacofonix|antisanitarix|automatix|panoramix)\/animations\/walk\//.test(e.name)).length===24);
  const audit=await page.evaluate(async()=>{
   const {VillagerArt}=await import('/src/rendering/art/villager-art.js');
   const {AnimationArt}=await import('/src/rendering/art/animation-art.js');
   await Promise.all([...document.images].map(i=>i.decode()));
   const names=['asterix','obelix','cacofonix','antisanitarix','automatix','panoramix'];
   document.body.replaceChildren();document.body.style='background:#26392e;color:#eee;font:16px sans-serif;padding:20px';
   const results=[];
   for(const name of names){
    const title=document.createElement('h3');title.textContent=name;document.body.append(title);
    const row=document.createElement('div');row.style='display:flex;gap:12px';document.body.append(row);
    const bounds=[];
    for(let i=0;i<4;i++){
     const frame=VillagerArt.get(name,'walk',i/4)||AnimationArt.get(name,0,'walk',i/4);
     const audit=document.createElement('canvas');audit.width=frame.width;audit.height=frame.height;const ctx=audit.getContext('2d');ctx.drawImage(frame,0,0);const data=ctx.getImageData(0,0,frame.width,frame.height).data;
     let top=frame.height,bottom=-1,left=frame.width,right=-1;
     for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)if(data[(y*frame.width+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
     bounds.push({top,bottom,left,right,width:frame.width,height:frame.height});
     const c=document.createElement('canvas');c.width=240;c.height=140;
     const g=c.getContext('2d');g.strokeStyle='#8a9';g.beginPath();g.moveTo(0,124);g.lineTo(240,124);g.stroke();
     if(frame.width===256)g.drawImage(frame,-8,-112);else g.drawImage(frame,56,9);
     row.append(c);
    }
    results.push({name,bounds});
   }
   return results;
  });
  for(const {name,bounds} of audit){
   assert(Math.max(...bounds.map(b=>b.top))-Math.min(...bounds.map(b=>b.top))<=2,`${name}: varying walk height`);
   assert(Math.max(...bounds.map(b=>b.bottom))-Math.min(...bounds.map(b=>b.bottom))<=1,`${name}: varying floor`);
   for(const b of bounds)assert(b.left>0&&b.right<b.width-1&&b.top>0&&b.bottom<b.height-1,`${name}: clipped frame`);
  }
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.resolve('assets/source/references/audits/hero-walk-audit.png'),fullPage:true});
  console.log('PASS: six heroes, 24 decoded walk frames, consistent heights/floors, no clipping or browser errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
