(() => {
  const media=matchMedia('(hover:hover) and (pointer:fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const cursor=document.createElement('div');
  cursor.className='hc-pointer';
  cursor.setAttribute('aria-hidden','true');
  cursor.innerHTML=`<svg class="hc-pointer-shape" viewBox="220 90 410 540" xmlns="http://www.w3.org/2000/svg">
    <g class="hc-pointer-rays" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round">
      <path class="hc-pointer-ray" style="--dx:-540px;--dy:0px" d="M269.5 198H304"/>
      <path class="hc-pointer-ray" style="--dx:-390px;--dy:-390px" d="m297.5 128.5 25.5 25.5"/>
      <path class="hc-pointer-ray" style="--dx:390px;--dy:-390px" d="m438.5 128.5-25.5 25.5"/>
      <path class="hc-pointer-ray" style="--dx:540px;--dy:0px" d="M432 198h34.5"/>
    </g>
    <g class="hc-pointer-hand">
      <path fill="#f0effc" d="M332 425V199c0-46 68-46 68 0v166-44c0-46 68-46 68 7v52-35c0-54 68-54 68 6v47-35c0-55 68-55 68 0v86c0 88-71 159-159 159-49 0-94-22-125-64l-76-103c-29-39 15-77 47-49z"/>
      <path fill="#d9d8e5" d="M572 322c5 132-91 241-233 240 28 29 66 46 106 46 88 0 159-71 159-159v-86c0-24-15-40-32-41z"/>
      <path fill="none" stroke="#111218" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" d="M332 425V199c0-46 68-46 68 0v166-44c0-46 68-46 68 7v52-35c0-54 68-54 68 6v47-35c0-55 68-55 68 0v86c0 88-71 159-159 159-49 0-94-22-125-64l-76-103c-29-39 15-77 47-49z"/>
    </g>
  </svg><div class="hc-drag-cursor"><span>Drag</span></div>`;
  document.body.append(cursor);
  let x=0,y=0,targetX=0,targetY=0,frame=0,last=0,visible=false;
  let rayTimer=0;
  function burst(event){
    const touch=event.pointerType==='touch';
    const mouse=media.matches&&event.pointerType==='mouse'&&event.button===0;
    if((!touch&&!mouse)||document.documentElement.classList.contains('preloader-active'))return;
    if(mouse&&event.target.closest('.magnetic-work'))return;
    if(touch){
      // Touch feedback uses only the rays; never activate the floating hand.
      hide();
    }else{
      update(event);
      x=targetX;y=targetY;draw();
      cursor.dataset.pressed='true';
      cursor.dataset.burst='true';
      clearTimeout(rayTimer);
      rayTimer=setTimeout(()=>{delete cursor.dataset.burst},1000);
    }
    if(reduced.matches)return;
    const mark=document.createElement('div');
    mark.className='hc-pointer-burst';
    mark.setAttribute('aria-hidden','true');
    const rays=cursor.firstElementChild.cloneNode(true);
    rays.querySelector('.hc-pointer-hand').remove();
    mark.append(rays);
    mark.style.transform=`translate3d(${event.clientX}px,${event.clientY}px,0)`;
    document.body.append(mark);
    setTimeout(()=>mark.remove(),1050);
  }
  function draw(){cursor.style.transform=`translate3d(${x}px,${y}px,0)`}
  function tick(now){
    const dt=Math.min(40,now-last);last=now;
    const ease=reduced.matches?1:1-Math.exp(-dt/22);
    x+=(targetX-x)*ease;y+=(targetY-y)*ease;
    if(Math.hypot(targetX-x,targetY-y)<.1){x=targetX;y=targetY;frame=0}else frame=requestAnimationFrame(tick);
    draw();
  }
  function hide(){document.documentElement.classList.remove('hc-pointer-active');cancelAnimationFrame(frame);frame=0;visible=false}
  function update(event){
    if(!media.matches||event.pointerType!=='mouse'){hide();return}
    cursor.dataset.mode=event.target.closest('.magnetic-work')&&!event.target.closest('a,button')?'drag':event.target.closest('a,button,input,textarea,select,[role="button"],[tabindex]:not([tabindex="-1"])')?'interactive':'default';
    targetX=event.clientX;targetY=event.clientY;
    if(!visible||reduced.matches){x=targetX;y=targetY;draw()}
    visible=true;
    if(!frame){last=performance.now();frame=requestAnimationFrame(tick)}
    document.documentElement.classList.add('hc-pointer-active');
  }
  document.addEventListener('pointermove',update,{passive:true});
  document.addEventListener('pointerover',update,{passive:true});
  document.addEventListener('pointerdown',burst,{passive:true});
  document.addEventListener('pointerup',()=>{delete cursor.dataset.pressed},{passive:true});
  document.addEventListener('pointercancel',()=>{delete cursor.dataset.pressed;hide()},{passive:true});
  document.documentElement.addEventListener('pointerleave',hide);
  window.addEventListener('blur',hide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()});
  document.addEventListener('keydown',hide);
  media.addEventListener('change',hide);
})();
