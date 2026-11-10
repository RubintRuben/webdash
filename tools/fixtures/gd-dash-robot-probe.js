// Evaluated by test-gd-auto.cjs. Capture actual runtime camera/robot state.
(()=>{
const samples=new Set([16960,17064,17200,17568,17616,17720]),out=window.__diag={samples:[],turns:[]};
const step=GDCameraState.prototype.step;
GDCameraState.prototype.step=function(dt){const result=step.call(this,dt),s=this.level._scene;
if(samples.has(s._physicsFrame))out.samples.push({frame:s._physicsFrame,angle:this.values.rotation});return result;};
const turn=GDGameplayState.prototype.trigger;
GDGameplayState.prototype.trigger=function(trig){const result=turn.call(this,trig),s=this.level._scene;
if(s._state.isRobot&&s._playerWorldX>36000)out.turns.push({frame:s._physicsFrame,robotNodeRotation:this.visualAngle(s._player._rotation)*180/Math.PI});return result;};
})();
