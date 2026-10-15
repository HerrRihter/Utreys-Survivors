// Equal depths retain the former stable sort rule: scenery before actors,
// actors in their original update order. Only moving actors need sorting.
export function orderActors(staticObjects, enemies, player, selected) {
  const dynamic=[...enemies,{...player,type:selected,player:true}].sort((a,b)=>a.y-b.y);
  const result=[];
  let i=0,j=0;
  while(i<staticObjects.length&&j<dynamic.length){
    if(staticObjects[i].y<=dynamic[j].y)result.push(staticObjects[i++]);
    else result.push(dynamic[j++]);
  }
  while(i<staticObjects.length)result.push(staticObjects[i++]);
  while(j<dynamic.length)result.push(dynamic[j++]);
  return result;
}
