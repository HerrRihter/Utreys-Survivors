// Optional diagnostic: requires Playwright and Edge, as profile-combat.cjs does.
const fs=require('node:fs');
const {chromium}=require('playwright');
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.click('#start');await page.click('#runHeroStart');
  const cdp=await page.context().newCDPSession(page),events=[];
  cdp.on('Tracing.dataCollected',({value})=>events.push(...value));
  await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,blink,cc,gpu',transferMode:'ReportEvents'});
  await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');s.selectMap('camp');s.start();s.state.need=1e9;s.state.p.inv=100;for(let i=0;i<120;i++)s.spawn('roman');});
  await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n<180)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}));
  const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;
  const report=events.filter(e=>e.ph==='X'&&e.dur>8000).sort((a,b)=>b.dur-a.dur).slice(0,60).map(e=>({name:e.name,ms:e.dur/1000,ts:e.ts,pid:e.pid,tid:e.tid,args:e.args}));
  fs.writeFileSync(process.argv[2]||'docs/MICROFREEZE-trace.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.slice(0,18)));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
