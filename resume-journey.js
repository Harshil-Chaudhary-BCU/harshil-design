(() => {
  const section=document.querySelector('.resume-journey');
  if(!section)return;
  const stage=section.querySelector('.resume-stage'),plane=section.querySelector('.resume-plane');
  const experience=[...section.querySelectorAll('.resume-experience .resume-entry')];
  const education=[...section.querySelectorAll('.resume-education .resume-entry')];
  const all=[...experience,...education],svg=section.querySelector('.resume-thread');
  const draw=svg.querySelector('.resume-thread-draw'),track=svg.querySelector('.resume-thread-track'),tip=svg.querySelector('circle');
  const educationDraw=document.createElementNS(svg.namespaceURI,'path');
  educationDraw.classList.add('resume-thread-draw','resume-education-draw');
  svg.insertBefore(educationDraw,tip);
  const title=section.querySelector('h2');
  const guide=section.querySelector('.resume-guide'),contact=document.querySelector('#contact');
  const media=matchMedia('(prefers-reduced-motion:no-preference)');
  const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n)};
  let frame=0,width=0,rowHeight=0,maxX=0,endX=0,length=0,topLength=0,turnLength=0;
  let vertical=false,animated=false,maxY=0,educationStart=0;
  let verticalBreakStart=0,verticalBreakEnd=0;
  let educationLength=0;
  function update(){
    frame=0;if(!animated)return;
    if(guide&&contact){
      // Finish fading before the next section crosses the viewport's bottom edge.
      const opacity=clamp((contact.getBoundingClientRect().top-innerHeight)/64);
      guide.style.opacity=String(opacity);
      guide.setAttribute('aria-hidden',String(opacity===0));
    }
    const start=section.getBoundingClientRect().top+scrollY;
    const p=clamp((scrollY-start)/(section.offsetHeight-stage.offsetHeight));
    // Activate vertical entries at the visual middle, below the fixed controls.
    const entryTop=parseFloat(section.style.getPropertyValue('--resume-entry-top'))||0;
    const clipTop=parseFloat(section.style.getPropertyValue('--resume-clip-top'))||210;
    const activationY=Math.max(stage.offsetHeight*.5,clipTop+64);
    const activationTravel=maxY*p+activationY-entryTop;
    const across=clamp(p/.55),turn=ease((p-.55)/.14),back=clamp((p-.69)/.31);
    const x=p<.55?maxX*across:maxX-(maxX-endX)*back;
    plane.style.transform=vertical?`translate3d(0,${-maxY*p}px,0)`:`translate3d(${-x}px,${-rowHeight*turn}px,0)`;
    // Finish the line while the final entry is fully illuminated at the centre.
    const terminalDraw=vertical?Math.max(0,verticalBreakEnd+educationLength-(maxY+activationY+8))*ease((p-.85)/.15):0;
    const markerY=entryTop+8+activationTravel+terminalDraw;
    tip.style.opacity=vertical&&markerY>verticalBreakStart&&markerY<verticalBreakEnd?'0':'1';
    let point;
    if(vertical){
      const experienceDistance=Math.max(0,Math.min(length,markerY-(entryTop+8)));
      const educationDistance=Math.max(0,Math.min(educationLength,markerY-verticalBreakEnd));
      draw.style.strokeDashoffset=String(length-experienceDistance);
      educationDraw.style.strokeDashoffset=String(educationLength-educationDistance);
      point=markerY>=verticalBreakEnd?educationDraw.getPointAtLength(educationDistance):draw.getPointAtLength(experienceDistance);
    }else{
      const distance=p<.55?topLength*across:p<.69?topLength+turnLength*turn:topLength+turnLength+(length-topLength-turnLength)*back;
      draw.style.strokeDashoffset=String(length-distance);
      point=draw.getPointAtLength(distance);
    }
    tip.setAttribute('cx',point.x);tip.setAttribute('cy',point.y);
    const stageRect=stage.getBoundingClientRect();
    let closestEntry=null,closestDistance=Infinity;
    all.forEach(entry=>{
      const r=entry.getBoundingClientRect();
      const ahead=education.includes(entry)?point.x<=parseFloat(entry.style.getPropertyValue('--entry-x'))+width:point.x>=parseFloat(entry.style.getPropertyValue('--entry-x'));
      const centerDistance=Math.abs(r.top+r.height/2-(stageRect.top+activationY));
      if(centerDistance<closestDistance){closestDistance=centerDistance;closestEntry=entry;}
      // Illuminate the whole entry around the middle, not its title at the top.
      const fadeDistance=Math.max(120,(stage.offsetHeight-clipTop-65)*.55);
      const visibility=vertical?ease((fadeDistance-centerDistance)/(fadeDistance-48)):ahead?1:0;
      entry.style.setProperty('--entry-opacity',String(.06+.94*visibility));
      // Keyboard focus remains available only for milestones currently in frame.
      entry.inert=r.right<0||r.left>innerWidth||r.bottom<stageRect.top+190||r.top>stageRect.bottom;
    });
    const educational=vertical?education.includes(closestEntry):turn>.5;
    title.textContent=educational?'Education':'Experience';
  }
  function measure(){
    vertical=innerWidth<=1100;
    // A pinned header cannot leave enough reading space in short landscape
    // windows. Use the accessible normal-flow layout there, as for reduced motion.
    animated=media.matches&&innerHeight>=560;
    section.classList.toggle('is-animated',animated);
    section.classList.toggle('is-vertical',animated&&vertical);
    educationDraw.style.display=animated&&vertical?'':'none';
    if(!animated){plane.style.transform='';plane.style.width='';plane.style.height='';title.textContent='My journey';all.forEach(e=>{e.inert=false;e.style.removeProperty('--entry-opacity')});return;}
    const contentWidth=section.querySelector('.resume-window').clientWidth;
    // Start beyond the feathered left edge, with room for the bullet markers.
    const edgeFade=Math.min(48,Math.max(24,innerWidth*.03));
    const pad=edgeFade+20;
    if(vertical){
      const heading=section.querySelector('.resume-heading');
      const clipTop=Math.max(210,heading.offsetTop+heading.offsetHeight+20);
      const entryTop=clipTop+48;
      width=Math.min(600,Math.max(160,contentWidth-pad-edgeFade-36));
      section.style.setProperty('--resume-card-width',`${width}px`);
      section.style.setProperty('--resume-clip-top',`${clipTop}px`);
      section.style.setProperty('--resume-entry-top',`${entryTop}px`);
      const chapterGap=120;
      let cursor=0;
      all.forEach(entry=>{
        // A short black pause separates the two straight, left-aligned journeys.
        if(entry===education[0])cursor+=chapterGap-72;
        const entryX=pad+24;
        entry.style.setProperty('--entry-x',`${entryX}px`);
        entry.style.setProperty('--entry-y',`${cursor}px`);
        cursor+=entry.offsetHeight+72;
      });
      educationStart=parseFloat(education[0].style.getPropertyValue('--entry-y'));
      const last=all[all.length-1];
      const lastTop=parseFloat(last.style.getPropertyValue('--entry-y'));
      const totalHeight=entryTop+cursor;
      // Let the final milestone reach the active centre before releasing the
      // pinned section; merely fitting it above the bottom mask leaves it dim.
      const activationY=Math.max(stage.offsetHeight*.5,clipTop+64);
      maxY=Math.max(0,entryTop+cursor-72-(stage.offsetHeight-89),entryTop+lastTop+last.offsetHeight/2-activationY);
      plane.style.width=`${contentWidth}px`;plane.style.height=`${totalHeight}px`;
      section.style.setProperty('--resume-row-height',`${totalHeight}px`);
      const left=pad+5;
      const lastExperience=experience[experience.length-1];
      verticalBreakStart=entryTop+parseFloat(lastExperience.style.getPropertyValue('--entry-y'))+lastExperience.offsetHeight+8;
      verticalBreakEnd=entryTop+educationStart+8;
      const educationEnd=entryTop+lastTop+last.offsetHeight+8;
      const d=`M${left} ${entryTop+8} V${verticalBreakStart} M${left} ${verticalBreakEnd} V${educationEnd}`;
      svg.setAttribute('viewBox',`0 0 ${contentWidth} ${totalHeight}`);
      // Each chapter needs its own dash length; SVG restarts dashes on subpaths.
      track.setAttribute('d',d);
      draw.setAttribute('d',`M${left} ${entryTop+8} V${verticalBreakStart}`);
      educationDraw.setAttribute('d',`M${left} ${verticalBreakEnd} V${educationEnd}`);
      length=draw.getTotalLength();draw.style.strokeDasharray=String(length);
      educationLength=educationDraw.getTotalLength();educationDraw.style.strokeDasharray=String(educationLength);
      section.style.setProperty('--resume-travel',`${stage.offsetHeight+Math.max(1400,maxY*1.35)}px`);
      update();
      return;
    }
    const compact=innerWidth<=700;
    width=compact?Math.max(160,contentWidth-pad-edgeFade-12):Math.min(470,Math.max(310,contentWidth*.36));
    const gap=Math.max(65,contentWidth*.09),step=width+gap;
    section.style.setProperty('--resume-card-width',`${width}px`);
    const clipTop=compact?Math.max(210,section.querySelector('.resume-heading').offsetTop+section.querySelector('.resume-heading').offsetHeight+20):210;
    section.style.setProperty('--resume-clip-top',`${clipTop}px`);
    const entryTop=compact?clipTop+48:Math.max(220,innerHeight*.32);
    let headHeight=Math.max(135,Math.min(180,innerHeight*.22));
    if(compact){
      headHeight=Math.max(110,...all.map(entry=>[...entry.querySelector('.resume-entry-head').children].reduce((height,child)=>height+child.offsetHeight+parseFloat(getComputedStyle(child).marginBottom||0),24)));
    }
    const baseline=entryTop+headHeight+5,totalWidth=pad+experience.length*step;
    section.style.setProperty('--resume-entry-top',`${entryTop}px`);
    section.style.setProperty('--resume-head-height',`${headHeight}px`);
    // Keep the chapters close while leaving room for the longest entry's points.
    rowHeight=Math.max(innerHeight*.68,...all.map(entry=>entry.offsetHeight+64));
    plane.style.width=`${totalWidth}px`;plane.style.height=`${rowHeight*2}px`;
    section.style.setProperty('--resume-row-height',`${rowHeight}px`);
    experience.forEach((e,i)=>e.style.setProperty('--entry-x',`${pad+i*step}px`));
    education.forEach((e,i)=>e.style.setProperty('--entry-x',`${pad+(experience.length-1-i)*step}px`));
    const right=totalWidth-30,radius=65,bottom=baseline+rowHeight,last=pad+(experience.length-education.length)*step;
    const d=`M${pad+5} ${baseline} H${right-radius} Q${right} ${baseline} ${right} ${baseline+radius} V${bottom-radius} Q${right} ${bottom} ${right-radius} ${bottom} H${last+5}`;
    svg.setAttribute('viewBox',`0 0 ${totalWidth} ${rowHeight*2}`);track.setAttribute('d',d);draw.setAttribute('d',d);
    length=draw.getTotalLength();draw.style.strokeDasharray=String(length);
    // Locate chapter boundaries on the actual curve, not an approximate dash ratio.
    topLength=0;turnLength=0;
    for(let at=0;at<=length;at+=2){const p=draw.getPointAtLength(at);if(!topLength&&p.y>baseline+.5)topLength=at;if(topLength&&p.y>=bottom-.5){turnLength=at-topLength;break;}}
    maxX=Math.max(0,totalWidth-contentWidth);endX=Math.max(0,last-pad);
    section.style.setProperty('--resume-travel',`${stage.offsetHeight+Math.max(3200,maxX+rowHeight+(maxX-endX))*1.35}px`);
    update();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);media.addEventListener('change',measure);
  document.fonts.ready.then(measure);measure();
})();
