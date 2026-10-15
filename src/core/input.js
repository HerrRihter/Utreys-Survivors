export let InputSystem;
InputSystem={create(sessionContext){
function resetInput(){
      sessionContext.keys.clear();
      sessionContext.pointer=null;
      sessionContext.stick={x:0,y:0};
      sessionContext.$('knob').style.transform='';
      sessionContext.$('stick').style.left='';
      sessionContext.$('stick').style.top='';
      sessionContext.$('stick').style.bottom='';
      sessionContext.$('stick').style.right='';
      sessionContext.$('stick').classList.toggle('engaged',false);
    }
function bind(){
[0,1].forEach(i=>{const b=sessionContext.$('ability'+i);b.onclick=()=>sessionContext.abilities.activate(i);b.addEventListener('pointerdown',e=>e.stopPropagation());});
sessionContext.window.addEventListener('keydown',e=>{
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
      if(e.repeat)return;
      if(e.code==='KeyQ'||e.code==='KeyE'){e.preventDefault();sessionContext.abilities.activate(e.code==='KeyQ'?0:1);return;}
      if(e.code==='Escape'&&!sessionContext.$('settings').classList.contains('hidden')){
        sessionContext.closeSettings();
        return;
      }
      if(e.code==='Escape'&&sessionContext.mode==='menu'&&!sessionContext.$('shop').classList.contains('hidden')){
        sessionContext.closeShop();
        return;
      }
      if(e.code==='Escape'&&sessionContext.mode==='menu'&&!sessionContext.$('achievements').classList.contains('hidden')){
        sessionContext.closeAchievements();
        return;
      }
      if(e.code==='Escape'&&sessionContext.mode==='menu'&&!sessionContext.$('runHeroSelect').classList.contains('hidden')){
        sessionContext.show('runHeroSelect',false);
        sessionContext.show('menu',true);
        return;
      }
      if(e.code==='Escape'||e.code==='KeyP')sessionContext.pause();
      if(sessionContext.mode==='level'&&['Digit1','Digit2','Digit3','Digit4'].includes(e.code))sessionContext.pickUpgrade(+e.code.slice(-1)-1);
      sessionContext.keys.add(e.code);
    });
sessionContext.window.addEventListener('keyup',e=>sessionContext.keys.delete(e.code));
sessionContext.window.addEventListener('blur',()=>{
      sessionContext.resetInput();
      if(sessionContext.mode==='play')sessionContext.pause();
    });
sessionContext.document.addEventListener('visibilitychange',()=>{
      if(sessionContext.document.hidden&&sessionContext.mode==='play')sessionContext.pause();
    });
sessionContext.canvas.style.touchAction='none';
sessionContext.canvas.addEventListener('pointerdown',e=>{
      if(sessionContext.mode!=='play'||e.pointerType==='mouse'||sessionContext.pointer)return;
      sessionContext.pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
      const control=sessionContext.$('stick'),size=control.offsetWidth||88;
      control.style.left=`${e.clientX-size/2}px`;
      control.style.top=`${e.clientY-size/2}px`;
      control.style.bottom='auto';
      control.style.right='auto';
      control.classList.toggle('engaged',true);
      sessionContext.canvas.setPointerCapture(e.pointerId);
    });
sessionContext.canvas.addEventListener('pointermove',e=>{
      if(!sessionContext.pointer||sessionContext.pointer.id!==e.pointerId)return;
      let dx=e.clientX-sessionContext.pointer.x,dy=e.clientY-sessionContext.pointer.y,l=sessionContext.Math.hypot(dx,dy);
      sessionContext.stick={x:dx/sessionContext.Math.max(35,l),y:dy/sessionContext.Math.max(35,l)};
      sessionContext.$('knob').style.transform=`translate(${sessionContext.stick.x*24}px,${sessionContext.stick.y*24}px)`;
    });
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>sessionContext.canvas.addEventListener(ev,e=>{if(!e||sessionContext.pointer?.id===e.pointerId)sessionContext.resetInput();}));
}
return {resetInput,bind};
}};
