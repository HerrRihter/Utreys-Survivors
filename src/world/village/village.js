import {VillageData} from './village-data.js';
import {VillageCollision} from './collision.js';
import {VillageNavigation} from './navigation.js';
import {VillageRenderer} from './village-renderer.js';
import {VillageArt} from '../../rendering/art/village-art.js';
export let Village;
'use strict';
Village=(()=>{
const data=VillageData.create();
const collision=VillageCollision.create(data.objects,data.size);
const navigation=VillageNavigation.create({...data,...collision});
const renderer=VillageRenderer.create({...data,document:typeof document==='undefined'?null:document,VillageArt:typeof VillageArt==='undefined'?null:VillageArt});
return {...data,residents:[],...navigation,...renderer,collision,blocked:collision.blocked,clear:collision.clear};
})();
