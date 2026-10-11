const sequence=document.querySelector('.landing-sequence');
const reveal=document.querySelector('.beyond-sticky');
const hero=sequence.querySelector('.hero');
const stage=sequence.querySelector('.landing-stage');
const tag=document.querySelector('#studio-tag');
stage.append(tag);
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t)};
let tagWasTransitioning=false;
let logoController=null;
const heroCopy=hero.querySelector('.hero-copy');
const scrollCue=hero.querySelector('.hero-scroll');
const navigation=document.querySelector('.site-header .index-nav');
const compactNavigation=document.querySelector('.compact-menu');
const landingMetadata=[...document.querySelectorAll('.site-header .identity,.site-header .meta')];
const aboutIntroduction=document.querySelector('.landing-about .about-introduction');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let heroViewportHeight=innerHeight;
let appliedHeroViewportHeight=0;
function syncHeroViewport(){
  const viewport=visualViewport;
  // Browser chrome can overlay the layout viewport. Do not resize for pinch zoom.
  if(viewport&&Math.abs(viewport.scale-1)>.01)return;
  const height=Math.round(Math.min(innerHeight,viewport?.height||innerHeight));
  if(height<=0||height===appliedHeroViewportHeight)return;
  appliedHeroViewportHeight=height;
  heroViewportHeight=height;
  document.documentElement.style.setProperty('--hero-viewport-height',`${height}px`);
}
syncHeroViewport();
// Center the actual letter outlines, including the script's long d flourish,
// rather than its advance-width box. Give SVG paint bounds generous breathing room.
const word=reveal.querySelector(':scope > span');
const svgNS='http://www.w3.org/2000/svg';
const lettering=document.createElementNS(svgNS,'svg');
const letteringText=document.createElementNS(svgNS,'text');
letteringText.textContent='Beyond';
letteringText.setAttribute('style',"font:700 100px 'The Nautigal';fill:currentColor");
letteringText.style.letterSpacing='2.5px';
lettering.append(letteringText);
function fitBeyond(){
  const context=document.createElement('canvas').getContext('2d');
  context.font="700 100px 'The Nautigal'";
  const ink=context.measureText('Beyond');
  const w=ink.actualBoundingBoxLeft+ink.actualBoundingBoxRight;
  const h=ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent;
  const pad=30;
  const tracking=2.5*('Beyond'.length-1);
  lettering.setAttribute('viewBox',`${-ink.actualBoundingBoxLeft-pad-tracking/2} ${-ink.actualBoundingBoxAscent-pad} ${w+pad*2+tracking} ${h+pad*2}`);
  const scale=Math.min(378,innerWidth*.216)/100;
  lettering.style.width=`${(w+pad*2+tracking)*scale}px`;
  lettering.style.height=`${(h+pad*2)*scale}px`;
  // Lift the script slightly: its descender makes geometric centering feel low.
  // Base the optical correction on the lettering, so it scales across viewports.
  word.style.marginTop=`${-h*scale*.07}px`;
}
document.fonts.load("700 100px 'The Nautigal'").then(()=>{
  word.replaceChildren(lettering);
  word.style.padding='0';
  fitBeyond();
  addEventListener('resize',fitBeyond);
});
let progress=0, queued=0;

// The portal owns its timed journey; after it, the content scroll uses a
// frame-rate-independent catch-up curve without transforming sticky elements.
let openingScrollComplete=scrollY>0;
let openingScrollTarget=scrollY;
let openingScrollFrame=0;
const openingScrollScale=.6;
let magneticFrame=0, magneticIdle=0;
let magneticArmed=true, magneticInteracted=false, touchActive=false;
let magneticDestination=0;
let returnLocked=false;
let descentLocked=false;
const magneticThreshold=.35;
let contentScrollFrame=0,contentScrollTarget=scrollY,contentScrollPrevious=0;
function stopContentScroll(){
  if(contentScrollFrame)cancelAnimationFrame(contentScrollFrame);
  contentScrollFrame=0;
  contentScrollTarget=scrollY;
}
function contentBoundary(){
  return scrollY+sequence.getBoundingClientRect().top+Math.max(1,sequence.offsetHeight-heroViewportHeight);
}
function animateContentScroll(now){
  const dt=Math.min(64,Math.max(1,now-contentScrollPrevious));
  contentScrollPrevious=now;
  const boundary=contentBoundary();
  const maximum=Math.max(boundary,document.documentElement.scrollHeight-heroViewportHeight);
  contentScrollTarget=Math.max(boundary,Math.min(maximum,contentScrollTarget));
  const distance=contentScrollTarget-scrollY;
  // About a second of soft settling, with the same response at 60/120Hz.
  // Safari rounds native scroll positions. A minimum final pixel avoids
  // stalling a few pixels above the portal handoff during the settling tail.
  const step=Math.min(Math.abs(distance),Math.max(1,Math.abs(distance)*(1-Math.exp(-dt/210))));
  const next=Math.abs(distance)<.6?contentScrollTarget:scrollY+Math.sign(distance)*step;
  scrollTo({top:next,behavior:'instant'});
  if(contentScrollTarget<=boundary+.5&&next<=boundary+.6&&distance<0){
    contentScrollFrame=0;
    scrollTo({top:boundary,behavior:'instant'});
    snapOpening(boundary-Math.max(1,sequence.offsetHeight-heroViewportHeight),true);
    return;
  }
  if(Math.abs(contentScrollTarget-next)>.5)contentScrollFrame=requestAnimationFrame(animateContentScroll);
  else contentScrollFrame=0;
}
function smoothContentWheel(event){
  // Keep controls and independently scrollable panels native.
  const nested=event.composedPath().some(node=>{
    if(!(node instanceof HTMLElement)||node===document.body||node===document.documentElement)return false;
    if(node.matches('input,textarea,select,[contenteditable="true"]'))return true;
    const overflow=getComputedStyle(node).overflowY;
    return /auto|scroll/.test(overflow)&&node.scrollHeight>node.clientHeight+1&&
      (event.deltaY<0?node.scrollTop>0:node.scrollTop+node.clientHeight<node.scrollHeight-1);
  });
  if(nested)return;
  event.preventDefault();
  const unit=event.deltaMode===1?16:event.deltaMode===2?heroViewportHeight:1;
  if(!contentScrollFrame){contentScrollTarget=scrollY;contentScrollPrevious=performance.now()}
  const boundary=contentBoundary();
  const maximum=Math.max(boundary,document.documentElement.scrollHeight-heroViewportHeight);
  // Keep normal scroll distance. Smooth the motion, not the amount of travel.
  contentScrollTarget=Math.max(boundary,Math.min(maximum,contentScrollTarget+event.deltaY*unit));
  if(!contentScrollFrame)contentScrollFrame=requestAnimationFrame(animateContentScroll);
}
function cancelMagnet(){
  stopContentScroll();
  if(magneticFrame)cancelAnimationFrame(magneticFrame);
  magneticFrame=0;
  returnLocked=false;
  descentLocked=false;
  clearTimeout(magneticIdle);
  openingScrollTarget=scrollY;
}
function snapOpening(destination,lockReturn=false){
  if(reduced.matches||magneticFrame)return;
  stopContentScroll();
  clearTimeout(magneticIdle);
  if(openingScrollFrame)cancelAnimationFrame(openingScrollFrame);
  openingScrollFrame=0;
  magneticDestination=destination;
  returnLocked=lockReturn;
  magneticArmed=false;
  const start=scrollY, distance=destination-start;
  const travel=Math.max(1,sequence.offsetHeight-heroViewportHeight);
  const returnStop=destination+travel*magneticThreshold;
  const sequenceStart=scrollY+sequence.getBoundingClientRect().top;
  const lowerStop=sequenceStart+travel*magneticThreshold;
  const descentDuration=destination>start&&start<lowerStop?1000:0;
  descentLocked=descentDuration>0;
  const revealDuration=lockReturn&&start>returnStop?1750:0;
  const duration=lockReturn?revealDuration+1000:destination>start?descentDuration+1750:1750;
  const began=performance.now();
  const tick=now=>{
    const t=clamp((now-began)/duration);
    // Continuous velocity and acceleration at both ends. Unlike the previous
    // steep quintic ease-in/out, this has no concentrated mid-animation rush.
    const smooth=value=>{const p=clamp(value);return p*p*p*(10+p*(-15+6*p))};
    let position=start+distance*smooth(t);
    if(descentDuration){
      const elapsed=now-began;
      position=elapsed<descentDuration
        ? start+(lowerStop-start)*smooth(elapsed/descentDuration)
        : lowerStop+(destination-lowerStop)*smooth((elapsed-descentDuration)/1750);
      descentLocked=elapsed<descentDuration;
    }
    if(lockReturn){
      const elapsed=now-began;
      // First close the portal over 1.75s. Then lift the lowered tag to
      // its hanging position over a separate 1s, with no scroll override.
      const lower=Math.min(start,returnStop);
      position=elapsed<revealDuration
        ? start+(lower-start)*smooth(elapsed/revealDuration)
        : lower+(destination-lower)*smooth((elapsed-revealDuration)/1000);
    }
    scrollTo({top:position,behavior:'instant'});
    if(t<1)magneticFrame=requestAnimationFrame(tick);
    else{
      magneticFrame=0;
      returnLocked=false;
      descentLocked=false;
      openingScrollTarget=destination;
      if(destination>start)finishOpeningScroll();
      else magneticArmed=true;
    }
  };
  magneticFrame=requestAnimationFrame(tick);
}
function settleOpening(){
  clearTimeout(magneticIdle);
  if(reduced.matches||magneticFrame||touchActive||!magneticInteracted)return;
  magneticIdle=setTimeout(()=>{
    const start=scrollY+sequence.getBoundingClientRect().top;
    const travel=Math.max(1,sequence.offsetHeight-heroViewportHeight);
    const p=(scrollY-start)/travel;
    if(p>.002&&p<.998)snapOpening(start+(magneticArmed&&p>=magneticThreshold?travel:0));
  },420);
}
function finishOpeningScroll(){
  openingScrollComplete=true;
  if(openingScrollFrame)cancelAnimationFrame(openingScrollFrame);
  openingScrollFrame=0;
}
function animateOpeningScroll(){
  const distance=openingScrollTarget-scrollY;
  if(Math.abs(distance)<.5){
    scrollTo(0,openingScrollTarget);
    openingScrollFrame=0;
    return;
  }
  scrollTo(0,scrollY+distance*.16);
  openingScrollFrame=requestAnimationFrame(animateOpeningScroll);
}
function smoothOpeningWheel(event){
  if(event.ctrlKey)return;
  // Once the return starts, wheel velocity and momentum cannot shorten or
  // interrupt its 1.85-second timeline (including opposite-direction input).
  if(returnLocked||descentLocked){event.preventDefault();return}
  magneticInteracted=true;
  if(!reduced.matches&&!magneticFrame&&event.deltaY>0){
    const start=scrollY+sequence.getBoundingClientRect().top;
    const travel=Math.max(1,sequence.offsetHeight-heroViewportHeight);
    if(scrollY>=start&&scrollY<start+travel*magneticThreshold){
      event.preventDefault();
      cancelMagnet();
      snapOpening(start+travel);
      return;
    }
  }
  if(openingScrollComplete&&!reduced.matches&&event.deltaY<0){
    const start=scrollY+sequence.getBoundingClientRect().top;
    const end=start+Math.max(1,sequence.offsetHeight-heroViewportHeight);
    if(scrollY>start&&scrollY<=end+1){
      event.preventDefault();
      cancelMagnet();
      // Preserve ordinary About scrolling, but never skip the portal boundary.
      if(scrollY>end)scrollTo({top:end,behavior:'instant'});
      snapOpening(start,true);
      return;
    }
  }
  if(magneticFrame){
    const reversing=magneticDestination>scrollY?event.deltaY<0:event.deltaY>0;
    if(!reversing){event.preventDefault();return}
    if(magneticDestination<scrollY)magneticArmed=true;
    cancelMagnet();
  }
  if(reduced.matches||event.ctrlKey)return;
  if(openingScrollComplete&&scrollY>=contentBoundary()-1){smoothContentWheel(event);return}
  const travel=Math.max(1,sequence.offsetHeight-heroViewportHeight);
  if(scrollY>=travel-1){finishOpeningScroll();return}
  event.preventDefault();
  const unit=event.deltaMode===1?16:event.deltaMode===2?heroViewportHeight:1;
  openingScrollTarget=Math.max(0,Math.min(travel,openingScrollTarget+event.deltaY*unit*openingScrollScale));
  if(!openingScrollFrame)openingScrollFrame=requestAnimationFrame(animateOpeningScroll);
  if(openingScrollTarget>=travel&&scrollY>=travel-2)finishOpeningScroll();
}
addEventListener('wheel',smoothOpeningWheel,{passive:false});
addEventListener('touchstart',()=>{touchActive=true;magneticInteracted=true;if(!returnLocked&&!descentLocked)cancelMagnet()},{passive:true});
let openingTouchY=0;
addEventListener('touchstart',event=>{openingTouchY=event.touches[0]?.clientY||0},{passive:true});
addEventListener('touchmove',event=>{
  if(returnLocked||descentLocked){event.preventDefault();return}
  const y=event.touches[0]?.clientY;
  const start=scrollY+sequence.getBoundingClientRect().top;
  const travel=Math.max(1,sequence.offsetHeight-heroViewportHeight);
  if(!reduced.matches&&!magneticFrame&&y<openingTouchY-4&&scrollY>=start&&scrollY<start+travel*magneticThreshold){
    event.preventDefault();cancelMagnet();snapOpening(start+travel);
  }
},{passive:false});
addEventListener('touchend',()=>{touchActive=false;settleOpening()},{passive:true});
addEventListener('touchcancel',()=>{touchActive=false;settleOpening()},{passive:true});
addEventListener('keydown',event=>{
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)){
    if(returnLocked||descentLocked){event.preventDefault();return}
    magneticInteracted=true;cancelMagnet();
  }
});
addEventListener('scroll',settleOpening,{passive:true});
// Touch/native scrolling can cross the boundary without producing a wheel
// event. Catch that crossing before painting a skipped return frame.
let lastOpeningScrollY=scrollY;
addEventListener('scroll',()=>{
  const current=scrollY;
  const start=current+sequence.getBoundingClientRect().top;
  const end=start+Math.max(1,sequence.offsetHeight-heroViewportHeight);
  if(!returnLocked&&!magneticFrame&&openingScrollComplete&&!reduced.matches&&
     magneticInteracted&&current<lastOpeningScrollY&&lastOpeningScrollY>=end-1&&current<end){
    cancelMagnet();
    scrollTo({top:end,behavior:'instant'});
    snapOpening(start,true);
  }
  lastOpeningScrollY=scrollY;
},{passive:true});
addEventListener('resize',cancelMagnet);
reduced.addEventListener('change',cancelMagnet);
addEventListener('pointerdown',stopContentScroll,{passive:true});
addEventListener('blur',stopContentScroll);
addEventListener('visibilitychange',()=>{if(document.hidden)stopContentScroll()});
addEventListener('scroll',()=>{
  // Scrollbar drags, anchor journeys and browser restoration remain native.
  if(!contentScrollFrame)contentScrollTarget=scrollY;
},{passive:true});
function update(){
  queued=0;
  syncHeroViewport();
  // Read layout once, before changing the portal/header styles. Interleaving
  // offset reads with those writes forced multiple layouts in one scroll frame.
  const sequenceRect=sequence.getBoundingClientRect();
  const aboutTop=aboutIntroduction.getBoundingClientRect().top;
  const exitBounds=new Map([...landingMetadata,navigation,heroCopy,...(scrollCue?[scrollCue]:[])].map(element=>[element,{left:element.offsetLeft,top:element.offsetTop,width:element.offsetWidth,height:element.offsetHeight}]));
  const travel=sequence.offsetHeight-heroViewportHeight;
  progress=reduced.matches?0:Math.max(0,Math.min(1,-sequenceRect.top/Math.max(1,travel)));
  if(!openingScrollComplete&&progress>=.999)finishOpeningScroll();
  if(progress<.002&&!magneticFrame)magneticArmed=true;
  if(magneticInteracted&&magneticArmed&&!magneticFrame&&!touchActive&&progress>=magneticThreshold&&progress<.998){
    snapOpening(scrollY+sequenceRect.top+travel);
  }
  // The magnetic scroll already eases time. A second ease on the lens size
  // concentrated the expansion into a rush; map geometry evenly instead.
  const growth=clamp((progress-.38)/.62);
  const detailsOpacity=1-ease((progress-.42)/.38);
  const exitTransform=(element,horizontal,vertical)=>{
    const amount=reduced.matches?0:ease(growth*1.35);
    const bounds=exitBounds.get(element);
    const x=horizontal<0?-(bounds.left+bounds.width+32):innerWidth-bounds.left+32;
    const y=vertical<0?-(bounds.top+bounds.height+32):heroViewportHeight-bounds.top+32;
    return `translate3d(${x*amount}px,${y*amount}px,0)`;
  };
  landingMetadata.forEach(element=>{element.style.transform=exitTransform(element,1,-1)});
  document.documentElement.style.setProperty('--landing-details-opacity',String(detailsOpacity));
  // The landing navigation exits completely before the next scene's entrance.
  // Reuse its links so focus, anchors and the progress tracker stay consistent.
  const arriving=reduced.matches
    ? (sequenceRect.bottom<=0?1:0)
    : Math.max(0,Math.min(1,(progress-.8)/.2));
  const entrance=arriving*arriving*(3-2*arriving);
  const departing=progress<.8 && !arriving;
  const navOpacity=departing?detailsOpacity:entrance;
  navigation.style.opacity=String(navOpacity);
  navigation.parentElement.style.setProperty('--nav-blur-opacity',String(departing?0:entrance));
  navigation.style.transform=reduced.matches?'none':departing
    ? exitTransform(navigation,-1,-1)
    : `translate3d(0,${(1-entrance)*22}px,0)`;
  navigation.dataset.scene=departing?'landing':'interior';
  navigation.inert=navOpacity<.05;
  navigation.style.visibility=navOpacity<.001?'hidden':'visible';
  // Compact controls belong to the content scene, not the opening hero.
  if(compactNavigation){
    const ready=reduced.matches?sequenceRect.bottom<=0:progress>=.999;
    compactNavigation.classList.toggle('is-ready',ready);
    compactNavigation.inert=!ready;
  }
  hero.style.pointerEvents=detailsOpacity<.03?'none':'';
  // Descend first, then let the pill become a viewport-sized portal. The same
  // geometry cuts the landing away, exposing the actual Beyond scene behind it.
  const small=innerWidth<=1100;
  const contentWidth=Math.min(1600,innerWidth-Math.max(32,Math.min(innerWidth*.06,104)));
  const baseWidth=Math.min(480,contentWidth);
  const baseTop=small?40:28;
  const descent=ease(progress/.35);
  const startCenter=baseTop+19;
  // Match the reference: finish the drop around 18% of the viewport, not 1/3.
  const destination=Math.max(startCenter,heroViewportHeight*.178);
  const center=startCenter+(destination-startCenter)*descent+(heroViewportHeight/2-destination)*growth;
  const initialWidth=baseWidth*(1+.05*descent);
  const width=initialWidth+(innerWidth*1.12-initialWidth)*growth;
  const height=38+2*descent+(heroViewportHeight*1.16-40)*growth;
  const radius=Math.min(height/2,23+(Math.min(innerWidth,heroViewportHeight)*.18-23)*Math.sin(Math.PI*growth));
  const top=center-height/2;
  const left=(innerWidth-width)/2;
  const transitioning=progress>.005&&!reduced.matches;
  if(transitioning!==tagWasTransitioning){
    tag.dataset.transitioning=String(transitioning);
    tag.dispatchEvent(new Event('tag-transition-reset'));
    tagWasTransitioning=transitioning;
  }
  tag.style.width=`${reduced.matches?baseWidth:width}px`;
  tag.style.top=`${reduced.matches?baseTop:top}px`;
  tag.style.setProperty('--tag-height',`${reduced.matches?38:height}px`);
  tag.style.setProperty('--tag-radius',`${radius}px`);
  tag.style.setProperty('--tag-drop',`${Math.max(0,top)}px`);
  tag.style.setProperty('--tag-label-opacity',String(1-ease((progress-.38)/.14)));
  tag.style.setProperty('--tag-background',progress>.38?'transparent':'var(--portfolio-charcoal,#131516)');
  tag.querySelector('.studio-tag-cords').style.opacity=String(1-ease((progress-.38)/.14));
  tag.style.opacity=String(1-ease((progress-.85)/.15));
  tag.style.pointerEvents=transitioning?'none':'';
  if(progress>.38&&!reduced.matches){
    const right=left+width,bottom=top+height,r=radius;
    const hole=`M ${left+r} ${top} H ${right-r} Q ${right} ${top} ${right} ${top+r} V ${bottom-r} Q ${right} ${bottom} ${right-r} ${bottom} H ${left+r} Q ${left} ${bottom} ${left} ${bottom-r} V ${top+r} Q ${left} ${top} ${left+r} ${top} Z`;
    hero.style.clipPath=`path(evenodd, "M 0 0 H ${innerWidth} V ${heroViewportHeight} H 0 Z ${hole}")`;
  }else hero.style.clipPath='none';
  hero.style.transform='none';
  hero.style.filter='none';
  hero.style.opacity=String(reduced.matches?1:1-ease((progress-.85)/.15));
  const depth=reduced.matches?0:growth;
  hero.style.setProperty('--hc-depth-x','0px');
  hero.style.setProperty('--hc-depth-y','0px');
  hero.style.setProperty('--hc-depth-scale',String(1-depth*.35));
  logoController?.setSceneScale(1-depth*.35);
  logoController?.setTransitionActive(progress>.005&&progress<1);
  heroCopy.style.transform=exitTransform(heroCopy,-1,1);
  if(scrollCue)scrollCue.style.transform=exitTransform(scrollCue,1,1);
  const transitionOpacity=ease((progress-.44)/.46);
  hero.inert=progress>=1;
  // Keep the word anchored behind About, then soften it as the About heading
  // enters the viewport. The incoming Work sequence covers it as it arrives.
  const aboutProgress=Math.max(0,Math.min(1,(heroViewportHeight-aboutTop)/(heroViewportHeight*.8)));
  const aboutFade=aboutProgress*aboutProgress*(3-2*aboutProgress);
  // Fade only glyph paint, never the sticky scene or its charcoal canvas.
  word.style.opacity='1';
  word.style.setProperty('--beyond-letter-opacity',String(transitionOpacity*(1-aboutFade*.92)));
}
function schedule(){if(!queued)queued=requestAnimationFrame(update)}
visualViewport?.addEventListener('resize',schedule,{passive:true});
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);addEventListener('pageshow',schedule);addEventListener('hashchange',()=>setTimeout(update,250));reduced.addEventListener('change',schedule);update();setTimeout(update,250);

// Keep a lightweight fallback while the model loads or for reduced motion.
const staticLogo=document.createElement('div');
staticLogo.className='hc-static-logo';
staticLogo.setAttribute('role','img');
staticLogo.setAttribute('aria-label','HC logo with a wavy glass finish');
const staticAsset=new URL('./assets/hc-text-logo.svg',import.meta.url).href;
staticLogo.innerHTML=`<svg class="hc-static-art" viewBox="0 0 1700 717" aria-hidden="true">
  <defs><filter id="hc-static-ripple" x="-3%" y="-5%" width="106%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".008 .055" numOctaves="1" seed="8" result="ripple"/>
    <feDisplacementMap in="SourceGraphic" in2="ripple" scale="18" xChannelSelector="R" yChannelSelector="G"/>
  </filter></defs>
  <image width="1700" height="717" filter="url(#hc-static-ripple)"/>
</svg><div class="hc-static-glass" aria-hidden="true"></div>`;
staticLogo.querySelector('image').setAttribute('href',staticAsset);
hero.prepend(staticLogo);
hero.querySelector('.hero-mark').dataset.rendered='true';
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
async function setupHeroLogo(){
  const touch=!finePointer.matches||navigator.maxTouchPoints>0;
  if(reduced.matches){
    try{
      const {renderTouchGlass}=await import('./touch-hc-glass.js?v=diagonal-refraction-1');
      await renderTouchGlass(staticLogo,staticAsset);
    }catch(error){console.warn('Using vector HC fallback',error);}
    return;
  }
  let logoHost;
  try{
    const {mountHCLogo}=await import('./hc-model-v2/hc-logo.js?v=touch-idle-model-13');
    logoHost=document.createElement('div');
    logoHost.className='hc-monogram-canvas hc-model-canvas';
    logoHost.style.transform='none';
    hero.prepend(logoHost);
    logoController=await mountHCLogo(logoHost,{rotationMode:'sway',glassEffect:true,contentMaxWidth:1600,responsiveLogoScale:true,liquidAmplitude:.145,liquidSpeed:1.15,interactive:!touch,particleStride:touch?2:1,maxFPS:touch?30:60,...(touch?{pixelRatio:1}:{})});
    staticLogo.hidden=true;
    update();
  }catch(error){
    logoHost?.remove();
    console.warn('Using lightweight HC fallback',error);
  }
}
setupHeroLogo();
