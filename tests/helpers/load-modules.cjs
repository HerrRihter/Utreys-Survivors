'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL,fileURLToPath}=require('node:url');
const realms=new WeakMap();
function realm(env){
 if(!realms.has(env)){
  env.URL??=URL;env.console??=console;
  if(!vm.isContext(env))vm.createContext(env);
  realms.set(env,{context:env,modules:new Map()});
 }
 return realms.get(env);
}
function getModule(env,file){
 const r=realm(env);file=path.resolve(file);
 if(!r.modules.has(file))r.modules.set(file,new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{
  context:r.context,identifier:file,initializeImportMeta(meta){meta.url=pathToFileURL(file).href;},
 }));
 return r.modules.get(file);
}
async function linkModule(env,file){
 const module=getModule(env,file);
 if(module.status==='unlinked')await module.link((specifier,parent)=>{
  if(!specifier.startsWith('.'))throw Error('Unexpected nonlocal import '+specifier);
  return getModule(env,path.resolve(path.dirname(parent.identifier),specifier));
 });
 return module;
}
async function loadModule(env,file,{fresh=false}={}){
 if(fresh)realm(env).modules.delete(path.resolve(file));
 const module=await linkModule(env,file);
 if(module.status==='linked')await module.evaluate();
 if(module.status==='errored')throw module.error;
 Object.assign(env,module.namespace);
 return module.namespace;
}
const moduleFiles=env=>[...realm(env).modules.keys()];
const resourcePath=value=>value.startsWith('file:')?fileURLToPath(value):path.resolve(__dirname,'../..',value);
module.exports={loadModule,linkModule,moduleFiles,resourcePath};
