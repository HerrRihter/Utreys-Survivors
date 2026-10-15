const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const [width,height] of [[1440,900],[800,900],[390,844],[844,390]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.click('#start');await page.click('#runHeroStart');
  await page.evaluate(async()=>{const {gameSession:s}=await import('/src/main.js');s.state.xp=s.state.need;});
  await page.waitForSelector('#levelup:not(.hidden)');assert.equal(await page.locator('#cards button').count(),4);
  const geometry=await page.evaluate(()=>{const r=document.querySelector('#cards').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,columns:getComputedStyle(document.querySelector('#cards')).gridTemplateColumns};});
  assert(geometry.left>=0&&geometry.right<=geometry.width,'Cards fit horizontally');
  if(width===390)await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'gaul-levelup-mobile.png')});
  await page.locator('#cards button').nth(3).click();await page.waitForSelector('#levelup.hidden',{state:'attached'});
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({width,height,...geometry,fourthChoice:'passed'}));await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
