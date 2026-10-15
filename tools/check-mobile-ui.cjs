const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {createServer} = require('./server.cjs');
(async () => {
 const server = createServer();
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const browser = await chromium.launch({channel:'msedge', headless:true});
 try {
  for (const [width,height] of [[320,568],[390,844],[844,390],[932,430],[1440,900]]) {
   const mobile = width !== 1440;
   const page = await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.click('#start');await page.click('#runHeroStart');
   await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');s.state.spawn=1e9;s.state.p.hp=1e6;});
   const boxes=async()=>page.evaluate(()=>Object.fromEntries(['ability0','ability1','pause','sound'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
   const before=await boxes();
   await page.click('#ability0');await page.click('#sound');
   assert.deepEqual(await boxes(),before,'Cooldown and sound must not move controls');
   if(mobile){
    const stick=await page.locator('#stick').boundingBox();
    assert(stick.x>width/2,'Idle movement stick is on the right');
    assert(before.ability1.x+before.ability1.width<stick.x,'Abilities do not overlap stick');
    for(const r of Object.values(before)){assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,'Controls fit viewport');}
    const client=await page.context().newCDPSession(page);
    const x=width-60,y=height-64;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30,y:y-10}]});
    assert(await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');return document.querySelector('#knob').style.transform.includes('translate(-')&&document.querySelector('#stick').classList.contains('engaged');}),'Touch moves the player');
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert(await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');return document.querySelector('#knob').style.transform===''&&!document.querySelector('#stick').classList.contains('engaged');}),'Release clears movement');
    assert.deepEqual(await page.locator('#stick').boundingBox(),stick,'Stick returns to right after release');
   }
   await page.click('#pause');await page.click('#resume');
   assert.deepEqual(await boxes(),before,'Pause/resume must not move controls');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
   if(width===390||width===844)await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`gaul-mobile-ui-${width}.png`)});
   assert.deepEqual(errors,[]);console.log(`${width}x${height}: stable controls, input and viewport passed`);
   await page.close();
  }
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});


