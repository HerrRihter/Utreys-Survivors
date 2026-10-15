const fs=require('node:fs');
const path=require('node:path');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  const results=[];
  for(const map of (process.env.PERFORMANCE_MAPS||'village,forest,camp,lutetia').split(',')){
   const page=await browser.newPage({viewport:{width:1280,height:720}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(()=>{let seed=12345;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.waitForLoadState('networkidle');
   const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
   results.push(await page.evaluate(async map=>{
    const {gameSession:g}=await import('/src/main.js');g.stop();g.selectMap(map);
    const start=performance.now();g.start();const startMs=performance.now()-start;
    const s=g.state;s.t=250;s.spawn=1e9;s.stats.damage=0;s.attack=1e9;
    for(const key of Object.keys(s.waveNext))s.waveNext[key]=1e9;
    s.bossSpawned=true;for(let i=0;i<180;i++)g.spawn('roman');
    const update=[],draw=[],interval=[];let last;
    for(let i=0;i<360;i++){
     const now=await new Promise(requestAnimationFrame);s.p.inv=10;
     g.keys.clear();g.keys.add(i%240<120?'KeyD':'KeyA');
     const a=performance.now();g.update(1/60);const b=performance.now();g.draw();const c=performance.now();
     if(i>=60){update.push(b-a);draw.push(c-b);interval.push(now-last);}last=now;
    }
    const stats=a=>{a.sort((x,y)=>x-y);return {p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
    return {map,startMs,enemies:s.enemies.length,update:stats(update),draw:stats(draw),interval:stats(interval)};
   },map));
   const {profile}=await cdp.send('Profiler.stop');
   if(errors.length)throw new Error(errors.join('\n'));
   if(process.env.PERFORMANCE_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PERFORMANCE_SCREENSHOTS,map+'.png')});
   const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
   results.at(-1).hot=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url.split('/').slice(-2).join('/'),samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,12);
   console.log(JSON.stringify(results.at(-1)));await page.close();
  }
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({browser:browser.version(),viewport:[1280,720],results},null,2)+'\n');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
