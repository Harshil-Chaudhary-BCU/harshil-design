/* Magnetic cards, shared by Selected Work and Key Principles.
   Each card is attracted to the cursor inside a field around it: the pull grows as the
   cursor gets closer, the card leans toward it, and a damped spring lets it settle back
   with a small wobble. The cards respond to where the cursor was DELAY ms ago. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const DELAY=200,STIFFNESS=170,DAMPING=15;
  const groups=[
    {selector:'.magnetic-work .work-card',prefix:'--work-spring',pull:26,tilt:3.2,reach:260,
     blocked:()=>document.querySelector('.work-carousel-stage.is-dragging')},
    {selector:'.landing-about .principle-card',prefix:'--magnet',pull:14,tilt:1.1,reach:150,blocked:()=>false}
  ];
  const cards=[];
  groups.forEach(group=>document.querySelectorAll(group.selector).forEach(el=>cards.push({el,group,pos:[0,0,0],vel:[0,0,0],target:[0,0,0],visible:false})));
  if(!cards.length)return;
  let samples=[],frame=0,previous=0;
  const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
  const active=()=>!reduced.matches&&fine.matches;
  // The cursor position as it was DELAY ms ago (null once it has left or been released).
  function delayedPointer(now){
    let point=undefined;
    while(samples.length&&samples[0].t<=now-DELAY)point=samples.shift();
    if(point!==undefined)delayedPointer.last=point;
    return delayedPointer.last||null;
  }
  function aim(pointer){
    cards.forEach(card=>{
      card.target.fill(0);
      if(!pointer||!pointer.x&&pointer.x!==0||!card.visible||!active()||card.group.blocked())return;
      const r=card.el.getBoundingClientRect();
      // Centre without the card's own magnetic offset, so the field does not chase itself.
      const cx=r.left+r.width/2-card.pos[0],cy=r.top+r.height/2-card.pos[1];
      const w=card.el.offsetWidth,h=card.el.offsetHeight;
      const dx=pointer.x-cx,dy=pointer.y-cy;
      // Distance from the card's edge: full strength over the card, fading out across the field.
      const gap=Math.hypot(Math.max(0,Math.abs(dx)-w/2),Math.max(0,Math.abs(dy)-h/2));
      const field=1-smooth(gap/card.group.reach);
      if(field<=0)return;
      let nx=dx/(w/2),ny=dy/(h/2);
      const m=Math.hypot(nx,ny);if(m>1){nx/=m;ny/=m;}
      card.target[0]=nx*card.group.pull*field;
      card.target[1]=ny*card.group.pull*field;
      card.target[2]=Math.max(-1,Math.min(1,nx))*card.group.tilt*field;
    });
  }
  function paint(card){
    const s=card.el.style,p=card.group.prefix;
    s.setProperty(`${p}-x`,`${card.pos[0].toFixed(2)}px`);
    s.setProperty(`${p}-y`,`${card.pos[1].toFixed(2)}px`);
    s.setProperty(`${p}-angle`,`${card.pos[2].toFixed(3)}deg`);
  }
  function tick(now){
    const dt=Math.min(.032,Math.max(.001,(now-previous)/1000));previous=now;
    const pointer=delayedPointer(now);
    // Re-aim every frame so scrolling and the turning carousel keep the field accurate.
    aim(pointer);
    let moving=samples.length>0;
    cards.forEach(card=>{
      let motion=0;
      for(let i=0;i<3;i++){
        card.vel[i]+=((card.target[i]-card.pos[i])*STIFFNESS-card.vel[i]*DAMPING)*dt;
        card.pos[i]+=card.vel[i]*dt;
        motion+=Math.abs(card.target[i]-card.pos[i])+Math.abs(card.vel[i])*.05;
      }
      if(motion<.02){card.pos.splice(0,3,...card.target);card.vel.fill(0);}else moving=true;
      paint(card);
    });
    // Keep running while the cursor rests over a field, so scrolling stays tracked.
    if(pointer&&cards.some(c=>c.target.some(v=>v)))moving=true;
    frame=moving?requestAnimationFrame(tick):0;
  }
  function wake(){if(frame)return;previous=performance.now();frame=requestAnimationFrame(tick);}
  function record(point){samples.push({...point,t:performance.now()});if(samples.length>120)samples.shift();wake();}
  function release(){samples=[];delayedPointer.last=null;wake();}
  addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||event.buttons){release();return;}
    record({x:event.clientX,y:event.clientY});
  },{passive:true});
  addEventListener('scroll',()=>{if(delayedPointer.last)wake();},{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>record({x:null,y:null}));
  document.querySelector('.work-carousel-stage')?.addEventListener('pointerdown',release);
  addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  reduced.addEventListener('change',release);fine.addEventListener('change',release);
  const io=new IntersectionObserver(records=>records.forEach(record=>{
    const card=cards.find(c=>c.el===record.target);
    if(card){card.visible=record.isIntersecting;if(!card.visible)wake();}
  }));
  cards.forEach(card=>io.observe(card.el));
})();
