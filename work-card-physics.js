/* Hero-tag springs layered over the carousel's rigid circular track. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  document.querySelectorAll('.magnetic-work .work-card').forEach(card=>{
    const stage=card.closest('.work-carousel-stage');
    const position=[0,0,0],velocity=[0,0,0],target=[0,0,0],following=[0,0,0];
    const stiffness=[38,42,30],damping=[4.7,4.8,3.6];
    let hovered=false,frame=0,previous=0,bounds;
    const paint=()=>['x','y','angle'].forEach((key,i)=>card.style.setProperty(`--work-spring-${key}`,`${position[i]}${i<2?'px':'deg'}`));
    const tick=now=>{
      const dt=Math.min(.032,Math.max(.001,(now-previous)/1000));previous=now;
      const follow=1-Math.exp(-dt/(hovered?.09:.24));
      let motion=0;
      for(let i=0;i<3;i++){
        following[i]+=(target[i]-following[i])*follow;
        velocity[i]+=((following[i]-position[i])*stiffness[i]-velocity[i]*damping[i])*dt;
        position[i]+=velocity[i]*dt;
        motion+=Math.abs(target[i]-position[i])+Math.abs(target[i]-following[i])+Math.abs(velocity[i]);
      }
      if(motion<.025){position.splice(0,3,...target);following.splice(0,3,...target);velocity.fill(0);frame=0;}
      else frame=requestAnimationFrame(tick);
      paint();
    };
    const wake=()=>{if(frame)return;previous=performance.now();frame=requestAnimationFrame(tick);};
    const reset=()=>{cancelAnimationFrame(frame);frame=0;hovered=false;[position,velocity,target,following].forEach(v=>v.fill(0));paint();};
    const hover=event=>{
      if(reduced.matches||!fine.matches||event.pointerType!=='mouse'||event.buttons||stage.classList.contains('is-dragging'))return;
      if(!hovered)bounds=card.getBoundingClientRect();hovered=true;
      const x=Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1));
      const y=Math.max(-1,Math.min(1,(event.clientY-bounds.top)/bounds.height*2-1));
      target[0]=x*5;target[1]=1.5+y*1.5;target[2]=x*3;
      if(event.type==='pointerenter'){velocity[2]+=(x||.4)*5;velocity[1]+=2.6;}
      wake();
    };
    card.addEventListener('pointerenter',hover);card.addEventListener('pointermove',hover);
    card.addEventListener('pointerleave',()=>{if(!hovered)return;hovered=false;target.fill(0);wake();});
    stage.addEventListener('pointerdown',reset);
    addEventListener('blur',reset);addEventListener('resize',reset);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
    reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
    new IntersectionObserver(records=>{if(!records[0].isIntersecting)reset();}).observe(card);
  });
})();
