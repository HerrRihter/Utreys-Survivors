import {actionTiming} from '../../data/animations/action-timing.js';

export function advanceAction(actor,dt,impact){
  const action=actor.action;
  if(!action)return;
  action.elapsed+=dt;
  if(!action.hit&&action.elapsed>=action.duration*actionTiming.impactProgress){
    action.hit=true;
    impact(action);
  }
  if(action.elapsed>=action.duration)actor.action=null;
}
