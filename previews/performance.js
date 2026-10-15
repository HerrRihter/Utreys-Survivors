import {gameSession} from '../src/main.js';

const button=document.getElementById('benchmark');
const report=document.getElementById('profileReport');
button.onclick=async()=>{
  button.disabled=true;
  gameSession.stop();gameSession.select('asterix');gameSession.start();
  const state=gameSession.state;
  // No rewards or record writes: avoid changing the player's stored progress.
  state.t=290;state.spawn=1e9;state.nextTurtle=state.nextRam=1e9;
  for(const unit of Object.keys(state.waveNext))state.waveNext[unit]=1e9;
  state.resultRecorded=true;
  state.bossSpawned=true;state.stats.damage=0;
  for(let i=0;i<120;i++)gameSession.spawn('roman');
  const samples=[],intervals=[];let previous=null;
  for(let i=0;i<140;i++){
    const now=await new Promise(resolve=>requestAnimationFrame(resolve));
    state.p.inv=1;
    const start=performance.now();gameSession.update(1/60);gameSession.draw();
    const elapsed=performance.now()-start;
    if(i>=20){samples.push(elapsed);if(previous!==null)intervals.push(now-previous);}
    previous=now;
  }
  const quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
  const resources=performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin));
  report.textContent=JSON.stringify({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
    enemies:state.enemies.length,frames:samples.length,
    updateAndDrawMs:{p50:quantile(samples,.5),p95:quantile(samples,.95)},
    frameIntervalMs:{p50:quantile(intervals,.5),p95:quantile(intervals,.95)},
    fetchedBytes:resources.reduce((sum,r)=>sum+r.encodedBodySize,0),
    jsHeapBytes:performance.memory?.usedJSHeapSize??null,
    note:'120 ordinary enemies, last-run time, 20 warmup frames; viewport emulation is not a physical phone; no rewards or record writes'
  },null,2);
  gameSession.pause();button.disabled=false;
};
