'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}).catch(error=>{server.close();throw error;});
 try{
  const page=await browser.newPage();
  const start=Date.now();await page.goto(`http://127.0.0.1:${server.address().port}/previews/animation-audit.html`);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('PASS'));
  const readyMs=Date.now()-start;
  const result=await page.evaluate(async()=>{
   const {AnimationArt}=await import('/src/rendering/art/animation-art.js');
   const {UnitArt}=await import('/src/rendering/art/unit-art.js');
   const {VillagerArt}=await import('/src/rendering/art/villager-art.js');
   const frames=['asterix','obelix','roman','boss','spear','pilum','veteran','turtle','ram','cacofonix','antisanitarix','automatix','panoramix'].flatMap(name=>Array.from({length:4},(_,i)=>VillagerArt.get(name,'walk',i/4)||UnitArt.get(name,'walk',i/4)||AnimationArt.get(name,0,'walk',i/4)));
   const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');
   const samples=[];
   for(let round=0;round<9;round++){
    const start=performance.now();
    for(let tick=0;tick<120;tick++){g.clearRect(0,0,c.width,c.height);for(let actor=0;actor<300;actor++){
     const f=frames[(actor+tick)%frames.length];
     if(f.width===128)g.drawImage(f,(actor%20)*64,Math.floor(actor/20)*40,112,112);
     else g.drawImage(f,(actor%20)*64-72,Math.floor(actor/20)*40-124);
    }g.getImageData(0,0,1,1);}
    if(round>1)samples.push((performance.now()-start)/120);
   }
   samples.sort((a,b)=>a-b);
   const resources=performance.getEntriesByType('resource');
   return {medianDrawMs:samples[Math.floor(samples.length/2)],samples,requests:resources.length,transferBytes:resources.reduce((n,r)=>n+r.transferSize,0)};
  });
  const output={...result,readyMs,actors:300,ticks:120,browser:browser.version()};
  console.log(JSON.stringify(output,null,2));
  if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(output,null,2)+'\n');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
