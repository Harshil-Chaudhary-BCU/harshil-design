/* The intro tag's four soft springs, applied to the middle numeral. */
(() => {
  const zero=document.querySelector('.error-zero');
  if(!zero)return;
  const face=zero.querySelector('.error-zero-face');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const position=[0,0,0,0],velocity=[0,0,0,0],target=[0,0,0,0],following=[0,0,0,0];
  const stiffness=[38,42,30,24],damping=[4.7,4.8,3.6,3.9];
  let hovered=false,frame=0,previous=0;
  const paint=()=>{
    ['x','y','angle','flex'].forEach((key,i)=>face.style.setProperty(`--zero-${key}`,`${position[i]}${i<2?'px':'deg'}`));
    face.style.setProperty('--zero-stretch',String(1+position[1]*.004));
  };
  const tick=now=>{
    const dt=Math.min(.032,Math.max(.001,(now-previous)/1000));previous=now;
    const follow=1-Math.exp(-dt/(hovered?.09:.24));
    let motion=0;
    for(let i=0;i<4;i++){
      following[i]+=(target[i]-following[i])*follow;
      velocity[i]+=((following[i]-position[i])*stiffness[i]-velocity[i]*damping[i])*dt;
      position[i]+=velocity[i]*dt;
      motion+=Math.abs(target[i]-position[i])+Math.abs(target[i]-following[i])+Math.abs(velocity[i]);
    }
    if(motion<.025){position.splice(0,4,...target);following.splice(0,4,...target);velocity.fill(0);frame=0;}
    else frame=requestAnimationFrame(tick);
    paint();
  };
  const wake=()=>{if(frame)return;previous=performance.now();frame=requestAnimationFrame(tick);};
  const reset=()=>{cancelAnimationFrame(frame);frame=0;hovered=false;[position,velocity,target,following].forEach(v=>v.fill(0));paint();};
  const hover=event=>{
    if(reduced.matches||!fine.matches||event.pointerType!=='mouse')return;
    hovered=true;
    // Measure the stationary wrapper so moving ink cannot perturb the spring.
    const bounds=zero.getBoundingClientRect();
    const x=Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1));
    const y=Math.max(-1,Math.min(1,(event.clientY-bounds.top)/bounds.height*2-1));
    target[0]=x*10;target[1]=3+y*3;target[2]=x*6;target[3]=x*1.6;
    if(event.type==='pointerenter'){velocity[2]+=(x||.4)*10;velocity[1]+=5.2;}
    wake();
  };
  zero.addEventListener('pointerenter',hover);zero.addEventListener('pointermove',hover);
  zero.addEventListener('pointerleave',()=>{if(!hovered)return;hovered=false;target.fill(0);wake();});
  addEventListener('blur',reset);addEventListener('resize',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
})();
