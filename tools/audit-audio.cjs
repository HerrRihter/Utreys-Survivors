const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createServer}=require('./server.cjs');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'}).catch(error=>{server.close();throw error});
 try{
  for(const launch of ['http','file']){
   const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.audioClips=[];const NativeAudio=window.Audio;window.Audio=function(src){const a=new NativeAudio(src);window.audioClips.push(a);return a;};});
   const url=launch==='http'?`http://127.0.0.1:${server.address().port}/index.html`:require('node:url').pathToFileURL(path.resolve('index.html')).href;
   await page.goto(url);await page.click('.audio-settings summary');
   await page.waitForFunction(()=>window.audioClips.some(a=>a.src.endsWith('tavern.mp3')&&a.readyState>=2&&!a.paused));
   await page.click('#start');await page.click('#runHeroStart');
   await page.waitForFunction(()=>window.audioClips.some(a=>a.src.endsWith('battle.mp3')&&a.readyState>=2&&!a.paused));
   await page.click('#pause');assert(await page.evaluate(()=>window.audioClips.every(a=>a.paused)));
   await page.click('#resume');await page.waitForFunction(()=>window.audioClips.some(a=>a.src.endsWith('battle.mp3')&&!a.paused));
   await page.click('#sound');assert(await page.evaluate(()=>window.audioClips.every(a=>a.paused)));
   await page.click('#sound');await page.waitForFunction(()=>window.audioClips.some(a=>a.src.endsWith('battle.mp3')&&!a.paused));
   const decoded=await page.evaluate(async()=>{
    const ctx=new AudioContext(),out=[];
    const root=new URL('assets/runtime/audio/',location.href);
    const files=['music/tavern.mp3','music/battle.mp3','music/victory.mp3','music/defeat.mp3',...['throw','stone','pickup','heal','level','ui','boss','magic','death-1','death-2','death-3'].map(x=>'sfx/'+x+'.ogg'),...['punch','hit-1','hit-2','hurt'].map(x=>'sfx/'+x+'.mp3')];
    if(location.protocol==='file:')return [];
    for(const file of files){const bytes=await(await fetch(new URL(file,root))).arrayBuffer();const a=await ctx.decodeAudioData(bytes);let peak=0;for(const value of a.getChannelData(0))peak=Math.max(peak,Math.abs(value));out.push({file,duration:a.duration,peak});}
    await ctx.close();return out;
   });
   if(launch==='http'){assert.equal(decoded.length,19);for(const audio of decoded)assert(audio.duration>0&&audio.peak>.001,JSON.stringify(audio));console.log(decoded);}
   assert.deepEqual(errors,[]);console.log('PASS: '+launch+' playback, battle switch, pause/resume, mute and no browser errors');await page.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
