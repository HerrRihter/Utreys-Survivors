import {actionTiming} from '../../data/animations/action-timing.js';

export function clampedFrame(progress){
  return Math.min(actionTiming.frameCount-1,Math.floor(Math.max(0,progress)*actionTiming.frameCount));
}
export function loopFrame(progress){
  return Math.floor(((progress%1)+1)%1*actionTiming.frameCount);
}
