// Independent SFX pitch processing, off the game/render thread.
import { SoundTouch } from '../libs/soundtouch-core.js';
self.onmessage=({data:{job,channels,sampleRate,semitones}})=>{
  try{
    const length=channels[0].length,processor=new SoundTouch({sampleRate});
    processor.pitchSemitones=semitones;
    const result=channels.map(()=>new Float32Array(length)),input=new Float32Array(8192),output=new Float32Array(32768);
    let fed=0,written=0;
    // Extra silence flushes the look-ahead and the final overlap. Output
    // stays exactly the source duration, so native trim/loop offsets hold.
    while(written<length&&fed<length+sampleRate*2){
      input.fill(0);
      for(let i=0;i<4096&&fed+i<length;i++){
        input[i*2]=channels[0][fed+i];input[i*2+1]=(channels[1]||channels[0])[fed+i];
      }
      fed+=4096;processor.inputBuffer.putSamples(input,0,4096);processor.process();
      while(processor.outputBuffer.frameCount&&written<length){
        const count=processor.outputBuffer.extract(output,0,Math.min(16384,processor.outputBuffer.frameCount,length-written),true);
        for(let i=0;i<count;i++)for(let ch=0;ch<result.length;ch++)result[ch][written+i]=output[i*2+Math.min(ch,1)];
        written+=count;
      }
    }
    self.postMessage({job,channels:result},result.map(a=>a.buffer));
  }catch(error){self.postMessage({job,error:String(error.stack||error)});}
};
