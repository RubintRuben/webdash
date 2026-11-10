// Complete sprite-derived portal bounds missing from the emulated catalogue.
// Values are native getObjectRect measurements; never infer physics from art.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const measured=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-portal-bounds.json'),'utf8'));
const file=path.join(root,'assets/scripts/game/gd-objects.js');
let source=fs.readFileSync(file,'utf8'),changes=0;
for(const [id,bounds] of Object.entries(measured.objects)) {
  const line=new RegExp('"'+id+'":(\\{[^\\r\\n]+\\})(,?)');
  const match=source.match(line);if(!match)throw Error('Missing portal '+id);
  const object=JSON.parse(match[1]);
  for(const key of ['w','h']) {
    if(object[key]===undefined){object[key]=bounds[key];changes++;}
    else if(Math.abs(object[key]*(object[key==='w'?'ws':'hs']??1)-bounds[key])>.001)
      throw Error('Existing bound differs from native: '+id+'/'+key);
  }
  source=source.replace(line,'"'+id+'":'+JSON.stringify(object)+match[2]);
}
fs.writeFileSync(file,source);console.log('Completed '+changes+' missing native portal dimensions.');
