// Randomness is injected so simulations and tests can own their random source.
export function createMath(math){
  return {
    rand:(a,b)=>a+math.random()*(b-a),
    clamp:(value,low,high)=>math.max(low,math.min(high,value)),
    dist:(a,b)=>math.hypot(a.x-b.x,a.y-b.y),
    clock:time=>`${math.floor(time/60).toString().padStart(2,'0')}:${math.floor(time%60).toString().padStart(2,'0')}`,
  };
}
