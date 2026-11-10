const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'work/native-robot-qa');
execFileSync(process.execPath,[path.join(__dirname,'test-gd-auto.cjs'),path.join(root,'work/fixtures/dash-options.txt'),out],{
  cwd:root,stdio:'inherit',env:{...process.env,GD_PRE:path.join(__dirname,'fixtures/gd-dash-robot-probe.js')}});
const result=JSON.parse(fs.readFileSync(path.join(out,'result.json'),'utf8'));
const native=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/gd-native-dash-robot.json'),'utf8'));
const errors=native.samples.map(n=>{const w=result.diagnostic.samples.find(w=>w.frame===n.frame);assert.ok(w,'Missing camera frame '+n.frame);return Math.abs(w.angle-n.angle);});
assert.ok(Math.max(...errors)<.001,JSON.stringify(errors));assert.deepEqual(result.diagnostic.turns,native.turns);
console.log('PASS native Dash robot turns on identical ticks; maximum camera error '+Math.max(...errors)+' degrees');
