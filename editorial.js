(() => {
  const time=document.querySelector('.local-time');
  const date=document.querySelector('.local-date');
  function clock(){
    const now=new Date();
    time.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:true}).format(now).toUpperCase();
    date.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'long',year:'numeric'}).format(now);
  }
  clock();setInterval(clock,30000);
  const links=[...document.querySelectorAll('.index-nav a[href^="#"], .compact-menu-panel a[href^="#"]')];
  const sections=[document.querySelector('.landing-sequence'),...document.querySelectorAll('.landing-about,.work-sequence,.resume-journey,footer')];
  const names=['Info','About','Work','Resume','Contact'];
  const header=document.querySelector('.site-header');
  const contrastItems=[...links.filter(link=>link.closest('.index-nav')),document.querySelector('.identity'),document.querySelector('.meta')].filter(Boolean);
  let frame=0;
  function update(){
    frame=0;
    const marker=scrollY+innerHeight*.25;
    let index=0;
    sections.forEach((section,i)=>{if(section.getBoundingClientRect().top+scrollY<=marker)index=i});
    const start=sections[index].getBoundingClientRect().top+scrollY;
    const end=sections[index+1]?sections[index+1].getBoundingClientRect().top+scrollY:document.documentElement.scrollHeight;
    const finish=index===sections.length-1?Math.max(start+1,end-innerHeight*.75):end;
    let progress=Math.max(0,Math.min(1,(marker-start)/(finish-start)));
    if(innerWidth<=1100){
      const resume=sections[3],contact=sections[4];
      const resumeStart=resume.getBoundingClientRect().top+scrollY;
      const stage=resume.querySelector('.resume-stage');
      const resumeFinish=resumeStart+resume.offsetHeight-(resume.classList.contains('is-animated')?stage.offsetHeight:0);
      const maxScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);
      const contactContent=contact.querySelector('.connect-links')||contact;
      // A short footer may never cross the old quarter-screen marker. Activate
      // it when its content reaches the middle, or at the reachable page end.
      const contactStart=Math.min(maxScroll,Math.max(resumeFinish,contactContent.getBoundingClientRect().top+scrollY-innerHeight*.5));
      if(scrollY>=contactStart-1){
        index=4;
        progress=maxScroll-contactStart<=1?1:Math.max(0,Math.min(1,(scrollY-contactStart)/(maxScroll-contactStart)));
      }else if(scrollY>=resumeStart){
        index=3;
        // Match the same start and travel distance used by the pinned timeline.
        progress=Math.max(0,Math.min(1,(scrollY-resumeStart)/Math.max(1,resumeFinish-resumeStart)));
      }else if(index>=3){
        index=2;
        const workStart=sections[2].getBoundingClientRect().top+scrollY;
        progress=Math.max(0,Math.min(1,(marker-workStart)/Math.max(1,resumeStart-workStart)));
      }
    }
    links.forEach(link=>{
      const active=link.textContent.trim().endsWith(names[index]);
      const tracked=active && link.getAttribute('href')!=='#info';
      link.classList.toggle('active',tracked);
      // Retain the outgoing fill width so it can fade away instead of snapping shut.
      if(tracked){
        link.style.setProperty('--section-progress',String(progress));
        const star=link.querySelector('.nav-star');
        if(star){
          const covered=Math.max(0,Math.min(1,(link.clientWidth*progress-star.offsetLeft)/Math.max(1,star.offsetWidth)));
          star.style.setProperty('--star-fill',`${covered*100}%`);
        }
      }
      if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
    });
    contrastItems.forEach(item=>{
      const r=item.getBoundingClientRect();
      const layers=document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2).filter(el=>!header.contains(el));
      let dark=false;
      for(const el of layers){
        if(el.closest('.project')){dark=true;break}
        const rgba=getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
        if(!rgba||rgba.length<3||(rgba[3]??1)<.6)continue;
        dark=(rgba[0]*.2126+rgba[1]*.7152+rgba[2]*.0722)<140;break;
      }
      item.dataset.surface=dark?'dark':'light';
    });
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update)}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  new ResizeObserver(schedule).observe(document.body);update();
})();
