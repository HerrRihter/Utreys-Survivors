'use strict';
const fs=require('node:fs'),path=require('node:path');
const definitions=require('./layout-generation.json');
function generateLayouts({root=path.resolve(__dirname,'..'),check=false}={}){
 for(const {json,module,name}of definitions){
  const value=JSON.parse(fs.readFileSync(path.join(root,json),'utf8').replace(/^\uFEFF/,''));
  const output=`// Generated from ${json}; edit the JSON and run node tools/generate-layouts.cjs.\nexport const ${name}=${JSON.stringify(value)};\n`;
  const target=path.join(root,module);
  if(check){
   if(fs.readFileSync(target,'utf8')!==output)throw new Error('Outdated generated layout: '+module);
  }else fs.writeFileSync(target,output);
 }
 require('./generate-character-bounds.cjs').generateCharacterBounds({root,check});
}
if(require.main===module){
 try{generateLayouts({check:process.argv.includes('--check')});console.log('PASS: animation definitions match their primary JSON sources.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={generateLayouts};
