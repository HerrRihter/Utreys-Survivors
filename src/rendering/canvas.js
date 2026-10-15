export let CanvasSystem;
'use strict';
CanvasSystem={create(sessionContext){
function resizeCanvas(){
      const zoom=sessionContext.window.innerWidth<sessionContext.window.innerHeight?0.9:1,ratio=sessionContext.Math.min(sessionContext.window.devicePixelRatio||1,2)*zoom;
      sessionContext.W=sessionContext.Math.max(1,(sessionContext.window.innerWidth||960)/zoom);
      sessionContext.H=sessionContext.Math.max(1,(sessionContext.window.innerHeight||540)/zoom);
      sessionContext.canvas.width=sessionContext.Math.round(sessionContext.W*ratio);
      sessionContext.canvas.height=sessionContext.Math.round(sessionContext.H*ratio);
      sessionContext.ctx.setTransform(ratio,0,0,ratio,0,0);
      sessionContext.ctx.imageSmoothingEnabled=false;
    }
return {resizeCanvas};
}};
