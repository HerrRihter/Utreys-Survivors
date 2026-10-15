const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [width,height] of [[1280,800],[390,844]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width===390,isMobile:width===390}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+': '+r.status());});
   await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.click('#start');await page.selectOption('#runMap','lutetia');await page.click('#runHeroStart');
   await page.waitForFunction(async()=>{const {UnitArt}=await import('/src/rendering/art/unit-art.js');return ['auxiliary','merchant','courtesan','citizen-0','citizen-1','citizen-2'].every(id=>UnitArt.get(id,'walk',0));});
   await page.waitForFunction(async()=>{const {LutetiaArt}=await import('/src/rendering/art/lutetia-art.js');return Object.values(LutetiaArt.status).every(s=>s==='ready');});
   const count=await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');s.stop();s.state.p.inv=999;s.state.spawn=999;s.state.waveNext={courtesan:999};const n=s.state.enemies.filter(e=>e.unit==='merchant').length;s.spawn('auxiliary',false,{x:1200,y:1130});s.spawn('courtesan',false,{x:990,y:1180});s.state.gems.push({x:1010,y:1170,v:3});s.state.pickups.push({x:1040,y:1210,type:'food'});s.draw();return n;});
   assert.equal(count,6);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(os.tmpdir(),`lutetia-${width}.png`)});
   await page.click('#pause');await page.click('#resume');assert.deepEqual(errors,[]);
   if(width===1280){
    await page.goto(`http://127.0.0.1:${server.address().port}/legion-preview.html#lutetia`);await page.waitForFunction(()=>document.querySelector('#artStatus').textContent==='Легион готов к бою');assert.equal(await page.locator('#cards canvas').count(),10);assert.equal(await page.locator('[data-unit=citizen]').count(),1);assert(!await page.locator('#cards').textContent().then(s=>s.includes('Матрона')));
    await page.screenshot({path:path.join(os.tmpdir(),'lutetia-roster.png'),fullPage:true});
    await page.goto(`http://127.0.0.1:${server.address().port}/village-preview.html`);await page.selectOption('#arena','lutetia');await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(os.tmpdir(),'lutetia-map.png'),fullPage:true});
    await page.check('#bounds');await page.screenshot({path:path.join(os.tmpdir(),'lutetia-bounds.png'),fullPage:true});assert.deepEqual(errors,[]);
   }
   console.log(`${width}x${height}: city selection, 6 merchants, 48 loaded animation frames, play/pause and previews passed`);await page.close();
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
