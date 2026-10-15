'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer({root:path.resolve(__dirname,'../_site'),prefix:'/gaul-survivors/'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}).catch(e=>{server.close();throw e;});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/gaul-survivors/legion-preview.html`);
  await page.waitForFunction(()=>document.querySelector('#artStatus').textContent==='Легион готов к бою');
  const poses=await page.evaluate(async()=>{
   const base='/gaul-survivors/';
   const {CharacterFrames:F}=await import(base+'src/rendering/character-frames.js');
   const {CharacterBounds:B}=await import(base+'data/animations/character-bounds.js');
   const {fitCharacterPreview:fit,drawCharacterPreview:draw}=await import(base+'src/ui/character-preview.js');
   const results=[];
   for(const id of ['roman-0','spear','pilum','veteran','turtle','ram','boss']){
    const placement=fit(B[id],F.manifest.anchor,280,210);
    for(const [action,sequence]of Object.entries(F.manifest.characters[id].actions))for(let i=0;i<sequence.length;i++)for(const reverse of [false,true]){
     const image=F.get(id,action,(i+.01)/sequence.length);
     // Render on a larger transparent surface to detect pixels outside the card,
     // rather than mistaking pixels already clipped by its canvas for a success.
     const c=document.createElement('canvas');c.width=400;c.height=330;const g=c.getContext('2d');g.translate(60,60);g.imageSmoothingEnabled=false;
     draw(g,image,F.manifest.anchor,placement,reverse);
     const pixels=g.getImageData(0,0,c.width,c.height).data;
     let left=400,top=330,right=0,bottom=0;
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){left=Math.min(left,x-60);right=Math.max(right,x-60);top=Math.min(top,y-60);bottom=Math.max(bottom,y-60);}
     results.push({id,action,index:i,reverse,left,right,top,bottom,scale:placement.scale});
    }
   }
   return results;
  });
  for(const p of poses){assert(p.left>=16&&p.right<264&&p.top>=16&&p.bottom<192,JSON.stringify(p));}
  for(const width of [1280,768,375,320]){
   await page.setViewportSize({width,height:900});
   for(const motion of ['walk','attack','hurt','idle']){
    await page.selectOption('#motion',motion);
    for(const reverse of [false,true]){
     await page.locator('#reverse').setChecked(reverse);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow at '+width);
     const boxes=await page.locator('.card canvas').evaluateAll(items=>items.map(c=>({canvas:c.getBoundingClientRect().toJSON(),card:c.closest('.card').getBoundingClientRect().toJSON()})));
     for(const {canvas,card}of boxes){assert(canvas.left>=card.left&&canvas.right<=card.right);assert(Math.abs(canvas.width/canvas.height-4/3)<.02,'Canvas keeps its aspect ratio');}
    }
   }
   if(width===1280||width===375){await page.selectOption('#motion','attack');await page.locator('#reverse').setChecked(false);await page.screenshot({path:path.resolve(__dirname,`../assets/source/references/audits/legion-ui-${width}-after.png`),fullPage:true});}
  }
  await page.goto(pathToFileURL(path.resolve(__dirname,'../legion-preview.html')).href);
  await page.waitForFunction(()=>document.querySelector('#artStatus').textContent==='Легион готов к бою');
  await page.selectOption('#motion','attack');await page.locator('#reverse').check();await page.click('#freeze');
  assert.equal(await page.locator('#freeze').textContent(),'Продолжить анимацию');
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${poses.length} real poses/directions fit the card; 4 viewport widths, all states, mirroring, pause and file launch without browser errors.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
