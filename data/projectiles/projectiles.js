export const projectileDefinitions={
  fish:{name:'Рыба',source:'atlas',texture:'projectiles/projectiles-v2.png',box:[426,185,680,300],width:34,yOffset:48},
  pilum:{name:'Пилум',source:'atlas',texture:'projectiles/projectiles-v2.png',box:[110,748,1334,76],width:72,yOffset:16},
  net:{name:'Сеть',source:'frame',unit:'netter',action:'attack',progress:.5,box:[183,172,64,44],yOffset:44},
  arrow:{name:'Стрела',source:'frame',unit:'tower',action:'attack',progress:.5,box:[185,109,33,10],arcStart:122,arcEnd:40},
  menhir:{name:'Менгир',source:'atlas',texture:'projectiles/menhir-flight-v2.png',box:[59,151,1567,706],targetSize:[124,72]}
};

export const projectiles=projectileDefinitions;
