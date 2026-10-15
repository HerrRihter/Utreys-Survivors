export let RomanArt;
/* Hand-authored pixel art. Integer scanlines keep all edges crisp and transparent.
 * 48 x 64, four walking frames, three legionary faces and a centurion.
 * Feet are the anchor; shields and spears are visual, not extra hitboxes. */
(() => {
  const ink='#303039', skin='#efbd91', light='#ffdbad', shade='#c58c6b';
  const silver='#b8c7ce', bright='#eff1df', steel='#7d8e9d';
  const frames=new Map();
  function make(variant=0,frame=0,boss=false){
    const c=document.createElement('canvas');c.width=48;c.height=64;
    const g=c.getContext('2d');
    const rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
    // Scan-converted polygons: no vector antialiasing on the sprite grid.
    function poly(points,color){
      const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));
      for(let y=min;y<max;y++){
        const cross=[];
        for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[j],b=points[i],scan=y+.5;
          if((a[1]<=scan&&b[1]>scan)||(b[1]<=scan&&a[1]>scan))cross.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cross.sort((a,b)=>a-b);
        for(let i=0;i+1<cross.length;i+=2)rect(Math.ceil(cross[i]),y,Math.ceil(cross[i+1])-Math.ceil(cross[i]),1,color);
      }
    }
    function oval(x,y,rx,ry,color){for(let row=-ry;row<=ry;row++){const half=Math.floor(rx*Math.sqrt(Math.max(0,1-row*row/(ry*ry))));rect(x-half,y+row,half*2+1,1,color);}}
    const stride=[0,2,0,-2][frame],green=boss?'#b8413d':variant===1?'#198453':'#238f55';
    // Back arm and green tunic, darker right-hand side.
    poly([[25,30],[36,30],[41,35],[41,43],[36,45],[34,39],[28,38]],ink);
    poly([[29,32],[35,32],[39,36],[39,41],[35,42],[33,36],[28,36]],skin);
    rect(37,35,2,5,light);
    poly([[17,30],[29,28],[36,33],[37,46],[33,52],[16,51],[13,44]],ink);
    poly([[18,32],[28,30],[34,34],[35,46],[31,49],[18,49],[15,44]],green);
    poly([[19,33],[23,31],[23,46],[19,48],[17,43]],boss?'#e66b50':'#4abe6e');
    rect(27,35,6,13,boss?'#7d3438':'#176a46');
    // Bare legs with strapped leather sandals. Four proper walking poses.
    for(const [x,step] of [[18,stride],[29,-stride]]){
      poly([[x,49],[x+6,49],[x+6,55+step],[x+4,59+step],[x-5,59+step],[x-5,56+step],[x,54+step]],ink);
      rect(x+1,50,4,6+step,skin);rect(x+1,50,2,4+step,light);
      rect(x-4,56+step,9,3,'#9c623f');rect(x-5,59+step,11,2,ink);
      rect(x-3,56+step,2,2,'#e5b88b');rect(x,56+step,2,2,'#e5b88b');
      rect(x+1,52+step,4,1,'#8a573b');rect(x+2,54+step,3,1,'#8a573b');
    }
    // Belt and segmented silver armour over the green tunic.
    rect(16,43,19,4,ink);rect(17,44,17,2,'#72513a');rect(23,43,5,4,'#d5ad59');rect(24,44,3,2,'#f7d582');
    poly([[17,31],[20,30],[22,38],[29,38],[30,30],[33,31],[33,41],[17,41]],ink);
    poly([[18,31],[20,32],[21,39],[30,39],[31,31],[32,32],[32,40],[18,40]],silver);
    rect(18,34,2,5,bright);rect(20,39,10,1,steel);
    for(let x=21;x<31;x+=3)rect(x,38,1,2,bright);
    // Short neck behind a full cheek and a rounded, continuous jaw silhouette.
    poly([[21,25],[32,24],[33,30],[29,34],[23,34],[20,30]],ink);
    poly([[23,26],[30,26],[31,30],[28,32],[24,32],[22,30]],shade);
    oval(24,21,boss?11:10,11,ink);
    oval(24,21,boss?10:9,10,skin);
    // Warm shadow follows the cheek; the light chin is broad rather than pointed.
    poly([[30,18],[33,19],[33,24],[31,28],[27,31],[22,31],[19,29],[26,29],[30,26]],shade);
    oval(25,23,boss?7:6,6,light);
    oval(23,28,boss?6:5,2,skin);
    // Ear sits within the side contour, not at the end of a thin jaw.
    oval(33,20,3,4,ink);oval(33,20,2,3,skin);rect(33,19,1,2,shade);
    // The nose has a raised bridge and a plump oval tip, shaded underneath.
    const nose=variant===1&&!boss?1:0;
    poly([[17,16],[20,16],[22,20],[20,24],[16,24],[14,20]],ink);
    poly([[18,17],[19,17],[21,20],[19,23],[16,22],[16,20]],skin);
    oval(13-nose,21,7+nose,4,ink);
    oval(13-nose,21,6+nose,3,skin);
    oval(12-nose,20,4+nose,1,light);
    rect(11-nose,24,6+nose,1,shade);rect(18,23,2,1,shade);
    // Smaller eyes grouped around the bridge keep the face in three-quarter view.
    oval(19,16,2,3,bright);rect(18,17,1,2,ink);
    oval(25,16,2,3,bright);rect(24,17,1,2,ink);
    rect(17,13,4,1,ink);rect(24,13,4,1,ink);
    // Curved mouth and cheek crease, with a wider moustached jaw on the officer.
    if(boss){
      oval(19,25,4,2,ink);oval(25,25,4,2,ink);
      rect(16,26,2,2,ink);rect(27,26,2,2,ink);
      rect(21,27,4,1,'#803f37');rect(22,29,4,1,shade);
      rect(17,14,4,1,ink);rect(24,14,4,1,ink);
    }else{
      rect(20,26,5,1,ink);rect(25,25,2,1,ink);rect(27,23,1,2,shade);
      rect(21,28,5,1,shade);
      if(variant===2){rect(18,15,3,1,steel);rect(24,15,3,1,steel);rect(20,25,6,1,'#786353');}
    }
    // Domed silver helmet with rim, side guard and top knob (no red crest on soldiers).
    poly([[12,13],[14,8],[18,5],[26,4],[32,7],[35,12],[36,16],[31,16],[29,13],[21,12],[17,15],[10,15]],ink);
    poly([[14,12],[16,8],[20,6],[26,6],[31,8],[33,12],[34,14],[31,14],[28,11],[20,10],[16,13]],silver);
    poly([[16,10],[19,7],[25,6],[28,7],[21,8],[18,11]],bright);
    poly([[27,7],[31,9],[33,13],[30,12],[29,9]],steel);
    rect(12,13,7,1,bright);rect(11,14,6,1,steel);
    poly([[29,13],[33,14],[34,17],[33,21],[30,22],[28,20]],ink);
    poly([[30,14],[32,15],[32,19],[30,20],[29,18]],silver);rect(30,15,1,3,bright);
    oval(27,3,3,3,ink);oval(27,3,2,2,silver);rect(26,2,2,1,bright);
    if(boss){poly([[15,7],[14,4],[18,1],[32,0],[38,3],[38,8],[32,6],[21,6]],ink);poly([[16,4],[20,2],[32,1],[36,3],[36,6],[31,4],[21,4],[16,6]],'#d65746');rect(21,2,10,1,'#ff9870');rect(16,12,17,2,'#e1b85f');}
    // Horizontal spear visible beside the blue shield.
    rect(1,38,45,3,ink);rect(7,39,39,1,'#b99a65');
    poly([[0,39],[8,35],[13,39],[8,42]],ink);poly([[1,39],[8,37],[11,39],[8,40]],silver);rect(5,38,4,1,bright);
    // Foreground hand gripping the shaft, with individual fingers.
    oval(17,39,4,5,ink);oval(17,39,3,4,skin);rect(15,36,2,4,light);
    rect(16,39,4,1,shade);rect(16,41,3,1,shade);
    // Rectangular curved shield: silver edging, blue panels, golden boss and rivets.
    poly([[27,30],[45,32],[46,58],[28,57],[25,53],[25,33]],ink);
    poly([[28,32],[43,34],[44,56],[29,55],[27,52],[27,34]],'#d4ddd4');
    poly([[29,34],[42,35],[42,54],[30,53],[29,51]],boss?'#698cba':'#77a9cf');
    poly([[29,34],[33,35],[33,53],[30,52]],'#a5c9e0');
    poly([[40,35],[42,35],[42,54],[39,53]],'#527da9');
    rect(28,33,1,19,bright);rect(43,35,1,19,steel);rect(30,55,13,1,steel);
    oval(35,44,5,7,'#84633d');oval(35,43,4,6,'#d5ac55');oval(34,42,3,4,'#f1cf76');rect(33,39,2,3,'#ffe39c');
    for(const [x,y] of [[29,34],[41,35],[30,53],[42,54]]){rect(x,y,2,2,'#977642');rect(x,y,1,1,'#f4d780');}
    return c;
  }
  for(let v=0;v<3;v++)for(let f=0;f<4;f++)frames.set(`${v}:${f}:false`,make(v,f,false));
  for(let f=0;f<4;f++)frames.set(`0:${f}:true`,make(0,f,true));
  RomanArt={get(variant=0,frame=0,boss=false){return frames.get(`${boss?0:variant%3}:${frame%4}:${boss}`);},width:48,height:64};
})();
