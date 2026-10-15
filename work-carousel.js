(() => {
  const section=document.querySelector('.magnetic-work');
  if(!section)return;
  const stage=section.querySelector('.work-carousel-stage');
  const cards=[...stage.querySelectorAll('.work-card')];
  const status=section.querySelector('.work-carousel-status');
  const selectors=[...section.querySelectorAll('[data-work-project]')];
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const arc=document.createElementNS('http://www.w3.org/2000/svg','svg');
  arc.setAttribute('preserveAspectRatio','xMidYMid meet');
  arc.setAttribute('aria-hidden','true');
  arc.classList.add('work-carousel-arc');
  stage.prepend(arc);
  let position=0,target=0,frame=0,animationStart=0,animationFrom=0,step=1,radius=1;
  const slotAngle=20*Math.PI/180;
  let pointer=null,startX=0,startY=0,startPosition=0,moved=false,dragging=false,suppressClick=false;
  const mod=(value,size)=>((value%size)+size)%size;
  function render(){
    cards.forEach((card,index)=>{
      const slot=mod(index-position+1.5,3)-1.5;
      const edge=Math.abs(slot);
      const angle=slot*slotAngle;
      card.style.setProperty('--card-x',`${radius*Math.sin(angle)}px`);
      card.style.setProperty('--card-y',`${radius*(1-Math.cos(angle))}px`);
      card.style.setProperty('--card-rotation',`${angle*180/Math.PI}deg`);
      card.style.zIndex=String(10-Math.round(edge*4));
      card.style.opacity=String(edge<=1?1:Math.max(0,1-(edge-1)*2));
      const link=card.querySelector('a');
      if(link)link.tabIndex=Math.abs(slot)<.1?0:-1;
    });
  }
  function announce(){
    const index=mod(Math.round(target),cards.length);
    status.textContent=`0${index+1} / 03 · ${cards[index].querySelector('h3').textContent}`;
    selectors.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.workProject)===index)));
  }
  function tick(time){
    frame=0;
    const progress=Math.min(1,(time-animationStart)/450);
    const ease=progress*progress*(3-2*progress);
    position=animationFrom+(target-animationFrom)*ease;
    if(progress===1){position=target;render();return;}
    render();frame=requestAnimationFrame(tick);
  }
  function settle(next){
    target=Math.round(next);announce();
    cancelAnimationFrame(frame);frame=0;
    if(reduced.matches){position=target;render();return;}
    animationFrom=position;animationStart=performance.now();frame=requestAnimationFrame(tick);
  }
  function measure(){
    const compact=innerWidth<=1100;
    const previousWidth=compact?Math.min(330,stage.clientWidth*.72):Math.min(400,stage.clientWidth*.25);
    const width=compact?Math.min(340,stage.clientWidth*.74):previousWidth*1.3;
    const height=compact?Math.min(540,Math.max(400,innerHeight*.56)):Math.min(520,Math.max(420,innerHeight*.52))*1.35;
    stage.style.setProperty('--work-card-width',`${width}px`);
    stage.style.setProperty('--work-card-height',`${height}px`);
    // Triple the original clear gap, independently of the enlarged card width.
    step=width+previousWidth*(compact?.12:.2)*3;
    radius=step/Math.sin(slotAngle);
    const drop=radius*(1-Math.cos(slotAngle));
    stage.style.height=`${height+Math.max(170,drop*2+80)}px`;
    // The tick marks share the exact same radius and centre as the cards.
    arc.setAttribute('viewBox',`0 0 ${stage.clientWidth} ${stage.clientHeight}`);
    arc.replaceChildren();
    for(let i=-60;i<=60;i++){
      const angle=i*slotAngle/40;
      const line=document.createElementNS(arc.namespaceURI,'line');
      const x=stage.clientWidth/2+Math.sin(angle)*radius;
      const y=stage.clientHeight/2+(1-Math.cos(angle))*radius;
      line.setAttribute('x1',x);line.setAttribute('y1',y);
      line.setAttribute('x2',x-Math.sin(angle)*12);line.setAttribute('y2',y+Math.cos(angle)*12);
      arc.append(line);
    }
    render();
  }
  stage.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0||pointer!==null)return;
    cancelAnimationFrame(frame);frame=0;
    // Continue from the visible position, including an interrupted button animation.
    target=position;
    pointer=event.pointerId;startX=event.clientX;startY=event.clientY;startPosition=position;moved=false;dragging=false;
    stage.setPointerCapture(pointer);
  });
  stage.addEventListener('pointermove',event=>{
    if(event.pointerId!==pointer)return;
    const dx=event.clientX-startX,dy=event.clientY-startY;
    if(!dragging){
      if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8){
        const id=pointer;pointer=null;
        if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);
        return;
      }
      if(Math.abs(dx)<6)return;
      dragging=true;moved=true;stage.classList.add('is-dragging');
    }
    position=startPosition-Math.max(-1,Math.min(1,dx/step));target=position;render();
  });
  function release(event){
    if(event.pointerId!==pointer)return;
    const id=pointer;pointer=null;stage.classList.remove('is-dragging');
    if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);
    if(dragging){
      suppressClick=event.type==='pointerup'&&moved;dragging=false;
      // A swipe selects exactly one adjacent position. No nearest-slot magnet,
      // velocity threshold, resistance, or spring competes with the pointer.
      const distance=(startPosition-position)*step;
      const completed=event.type==='pointerup'&&Math.abs(distance)>=24;
      settle(Math.round(startPosition)+(completed?(distance<0?1:-1):0));
    }
  }
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  stage.addEventListener('lostpointercapture',release);
  stage.addEventListener('dragstart',event=>event.preventDefault());
  stage.addEventListener('click',event=>{
    if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;return;}
    // Let actionable controls on the active card keep their native behaviour.
    // The drag guard above still suppresses the click generated after a swipe.
    if(event.target.closest('a,button'))return;
    const card=event.target.closest('.work-card');
    if(!card)return;
    const index=cards.indexOf(card),slot=mod(index-position+1.5,3)-1.5;
    if(Math.abs(slot)>.1)event.preventDefault();
  },true);
  selectors.forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.workProject);
    const delta=mod(index-Math.round(target)+1.5,3)-1.5;
    settle(Math.round(target)+delta);
  }));
  stage.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();settle(target+(event.key==='ArrowRight'?1:-1));}
    if(event.key==='Home'){event.preventDefault();settle(0);}
  });
  addEventListener('resize',measure);
  reduced.addEventListener('change',()=>settle(target));
  measure();announce();
})();
