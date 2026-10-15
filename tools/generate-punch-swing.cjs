// Original, deterministic air/cloth swish: no metallic tone or impact.
// Rendered offline so combat only plays a small PCM file.
const fs=require('node:fs'),path=require('node:path');
const rate=44100,count=Math.round(rate*.16),samples=new Float64Array(count);
let seed=73419,low=0,bass=0,peak=0;
for(let i=0;i<count;i++){
  const t=i/count;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/2147483648-1;
  const cutoff=1000+1800*Math.sin(Math.PI*t);
  low+=(1-Math.exp(-2*Math.PI*cutoff/rate))*(noise-low);
  bass+=(1-Math.exp(-2*Math.PI*280/rate))*(low-bass);
  const envelope=Math.pow(Math.sin(Math.PI*t),1.8)*Math.exp(-1.4*t);
  samples[i]=(low-bass)*envelope;peak=Math.max(peak,Math.abs(samples[i]));
}
const wav=Buffer.alloc(44+count*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(count*2,40);
for(let i=0;i<count;i++)wav.writeInt16LE(Math.round(samples[i]/peak*.7*32767),44+i*2);
fs.writeFileSync(path.join(__dirname,'../assets/runtime/audio/sfx/punch-swing.wav'),wav);
