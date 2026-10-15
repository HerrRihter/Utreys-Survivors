'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}).catch(e=>{server.close();throw e;});
 try{
  const page=await browser.newPage({viewport:{width:1380,height:780}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(async()=>{const {AnimationArt}=await import('/src/rendering/art/animation-art.js');return AnimationArt.status.obelix==='ready';});
  await page.click('#start');await page.click('[data-hero="obelix"]');await page.click('#runHeroStart');
  await page.keyboard.down('d');await page.waitForTimeout(1200);await page.keyboard.up('d');
  const bounds=await page.evaluate(async()=>{
   const {gameSession}=await import('/src/main.js');gameSession.stop();
   const {AnimationArt}=await import('/src/rendering/art/animation-art.js');
   document.body.replaceChildren();document.body.style='margin:16px;background:#26392e;color:#eee;font:18px sans-serif;overflow:auto';
   const results=[];
   for(const action of ['walk','attack']){
    const title=document.createElement('h2');title.textContent=action;document.body.append(title);
    const row=document.createElement('div');row.style='display:flex;gap:12px';document.body.append(row);
    for(let i=0;i<4;i++){
     const frame=AnimationArt.get('obelix',0,action,i/4),a=document.createElement('canvas');a.width=a.height=256;
     const ag=a.getContext('2d');ag.drawImage(frame,0,0);const pixels=ag.getImageData(0,0,256,256).data;
     let top=256,bottom=-1,left=256,right=-1;
     for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
     results.push({action,index:i,top,bottom,left,right,height:bottom-top+1,width:right-left+1});
     const c=document.createElement('canvas');c.width=320;c.height=280;const g=c.getContext('2d');
     g.fillStyle='#324b3c';g.fillRect(0,0,320,280);g.imageSmoothingEnabled=false;g.drawImage(frame,48,108,160,128,0,0,320,256);
     g.strokeStyle='#9bb';g.beginPath();g.moveTo(0,256);g.lineTo(320,256);g.stroke();g.fillStyle='#fff';g.fillText(`${i}: ${right-left+1} × ${bottom-top+1}`,8,273);row.append(c);
    }
   }
   return results;
  });
  if(process.argv.includes('--check')){
   const walking=bounds.filter(b=>b.action==='walk'),standing=bounds.find(b=>b.action==='attack'&&b.index===3);
   for(const pose of walking)assert(Math.abs(pose.height-standing.height)<=1,'Standing and walking Obelix must keep the same size');
   for(const pose of bounds){assert.equal(pose.bottom,235,'All poses retain the common foot anchor');assert(pose.left>0&&pose.right<255&&pose.top>0,'Pose must fit the frame');}
   assert.deepEqual(errors,[]);
  }
  const name=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||'obelix-audit';
  const output=path.resolve('assets/source/references/audits');fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
  fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify({bounds,errors},null,2)+'\n');
  console.log(JSON.stringify({bounds,errors},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
