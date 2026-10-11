import * as THREE from './vendor/three.module.js';
import { createGlass } from './glass.js?v=true-black-polish-7';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createParticleLife, updateLiquid, updateInnerLight } from './particle-life.js?v=wake1';

/** Full-viewport, transparent HC sculpture with movement-driven particle physics. */
export async function mountHCLogo(container, {
  modelURL = new URL('./assets/HC-Particles-Animated.glb?v=slow1', import.meta.url).href,
  rotationSeconds = 30,
  rotationMode = 'turn',
  glassEffect = true,
  interactionRadius = 1.05,
  repulsionStrength = 165,
  wakeDuration = .075,
  springStrength = 15,
  damping = 5.1,
  boundaryRestitution = .5,
  liquidAmplitude = .085,
  liquidSpeed = 1,
  glowStrength = .18,
  glowDecay = 2.4,
  pixelRatio = Math.min(matchMedia('(pointer:coarse)').matches?1:1.25, globalThis.devicePixelRatio || 1),
  pointerTarget = document,
  zIndex = 0,
  fitContainer = false,
  contentMaxWidth = null,
  responsiveLogoScale = false,
  interactive = true,
  particleStride = 1,
  maxFPS = 60
} = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('An HTML mount element is required.');
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:interactive,powerPreference:interactive?'high-performance':'low-power'});
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;
  const canvas=renderer.domElement;
  // A body-level viewport layer escapes clipping/overflow on the mount element.
  canvas.style.cssText=`position:fixed;left:0;top:0;display:block;background:transparent;pointer-events:none;z-index:${zIndex};`;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`${rotationMode === 'sway' ? 'Gently swaying' : 'Automatically rotating'} HC logo with gently flowing particles and soft light.${interactive?' Hold the left mouse button and drag through the letters to distort them. Release to let the particles return.':''}`);
  container.appendChild(canvas);
  canvas.style.position='absolute';
  const glass=glassEffect?createGlass(renderer):null;
  const camera=new THREE.OrthographicCamera(-6,6,3,-3,.1,80);
  camera.position.set(0,0,20);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xffffff,.82));
  for(const [position,intensity] of [[[-4,7,8],2.6],[[5,-1,7],.55],[[2,5,-7],1.8]]){
    const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(...position);scene.add(light);
  }
  let gltf;
  try{gltf=await new GLTFLoader().loadAsync(modelURL);}
  catch(error){renderer.dispose();canvas.remove();throw error;}
  scene.add(gltf.scene);
  const pivot=gltf.scene.getObjectByName('HC_Y_Rotation');
  if(!pivot||!gltf.animations.length){renderer.dispose();canvas.remove();throw new Error('HC rotation animation is missing.');}
  const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(gltf.animations[0]);
  action.setLoop(THREE.LoopRepeat,Infinity).play();action.timeScale=gltf.animations[0].duration/rotationSeconds;
  mixer.update(0);
  const frontFacing = pivot.quaternion.clone();
  const swayQuaternion = new THREE.Quaternion();
  const rotationAxis = new THREE.Vector3(0, 1, 0);
  const parts=[];
  gltf.scene.traverse(mesh=>{
    if(!mesh.isInstancedMesh)return;
    // Touch keeps the original letter shape/motion with half the rendered beads.
    const stride=Math.max(1,Math.floor(particleStride));
    if(stride>1){
      const matrix=mesh.instanceMatrix.array,count=Math.ceil(mesh.count/stride);
      for(let i=0;i<count;i++)matrix.copyWithin(i*16,i*stride*16,i*stride*16+16);
      mesh.count=count;
    }
    // Keep every bead, but do not subdivide its subpixel silhouette behind glass.
    mesh.geometry.computeBoundingSphere();
    const beadBounds=mesh.geometry.boundingSphere;
    mesh.geometry=new THREE.IcosahedronGeometry(beadBounds.radius,0);
    mesh.geometry.translate(beadBounds.center.x,beadBounds.center.y,beadBounds.center.z);
    mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.material=mesh.material.clone();
    mesh.material.color.set(mesh.name.startsWith('H_')?'#ff6b35':'#f4f2ed');
    mesh.material.roughness=.58;mesh.material.metalness=0;
    const matrix=mesh.instanceMatrix.array,rest=new Float32Array(mesh.count*3),radii=new Float32Array(mesh.count);
    const radiusShape=new Float32Array(mesh.count*3),screenRadii=new Float32Array(mesh.count*2);
    for(let i=0;i<mesh.count;i++){
      const a=i*16,b=i*3;
      rest[b]=matrix[a+12];rest[b+1]=matrix[a+13];rest[b+2]=matrix[a+14];
      radii[i]=Math.max(Math.hypot(matrix[a],matrix[a+1],matrix[a+2]),Math.hypot(matrix[a+4],matrix[a+5],matrix[a+6]),Math.hypot(matrix[a+8],matrix[a+9],matrix[a+10]));
      // Cache the ellipsoid's X/Z covariance and its vertical radius. The visible
      // horizontal radius changes as the logo rotates around its Y axis.
      radiusShape[b]=matrix[a]**2+matrix[a+4]**2+matrix[a+8]**2;
      radiusShape[b+1]=matrix[a]*matrix[a+2]+matrix[a+4]*matrix[a+6]+matrix[a+8]*matrix[a+10];
      radiusShape[b+2]=matrix[a+2]**2+matrix[a+6]**2+matrix[a+10]**2;
      screenRadii[i*2]=Math.sqrt(radiusShape[b]);
      screenRadii[i*2+1]=Math.hypot(matrix[a+1],matrix[a+5],matrix[a+9]);
    }
    const life=createParticleLife(mesh,rest,radii,glowStrength);
    const wake={remaining:new Float32Array(mesh.count),cooldown:new Float32Array(mesh.count),direction:new Float32Array(mesh.count*2),burst:new Float32Array(rest.length)};
    parts.push({mesh,rest,radii,radiusShape,screenRadii,life,wake,offset:new Float32Array(rest.length),velocity:new Float32Array(rest.length),random:new Float32Array(mesh.count*6),generation:new Uint32Array(mesh.count)});
  });
  canvas.dataset.particles=String(parts.reduce((count,part)=>count+part.mesh.count,0));
  const beadGeometry=parts[0].mesh.geometry;
  const trianglesPerParticle=(beadGeometry.index?.count||beadGeometry.attributes.position.count)/3;
  canvas.dataset.trianglesPerParticle=String(trianglesPerParticle);
  canvas.dataset.interactive=String(interactive);
  let halfWidth=6.1,halfHeight=3,width=1,height=1;
  let sceneScale=1,deviceScale=1;
  let disposed=false,raf=0,lastTime=0,frames=0,simulationTime=0;
  let displaced=0,maxDisplacement=0,boundaryHits=0,strokeId=0,lastInput=-Infinity,lastHit=null;
  let pointerSpeed=0,motionStrength=0,activeMotions=0;
  let releasedParticles=0;
  let maxLiquidDisplacement=0,glowing=0,maxGlow=0,lastLightWave=-Infinity;
  const lightWaves=[];
  const edgeContacts={left:0,right:0,top:0,bottom:0};
  const motions=[];
  const pointer={active:false,clientX:0,clientY:0,time:0};
  const coarse=matchMedia('(pointer:coarse)');
  let physicsActive=false,lightActive=false,transitionActive=false,lastRendered=0;
  const swirlAxis=new THREE.Vector3(0,1,0);
  function resize(){
    const view=window.visualViewport;
    const nextWidth=Math.max(1,fitContainer?container.clientWidth:view?.width||window.innerWidth);
    const nextHeight=Math.max(1,fitContainer?container.clientHeight:view?.height||window.innerHeight);
    canvas.style.left=(fitContainer?0:view?.offsetLeft||0)+'px';canvas.style.top=(fitContainer?0:view?.offsetTop||0)+'px';
    if(nextWidth===width&&nextHeight===height)return;
    width=nextWidth;height=nextHeight;
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    // The optical pass fills the viewport; only the sculpture follows the cap.
    const contentWidth=contentMaxWidth?Math.min(contentMaxWidth,width-Math.max(32,Math.min(width*.06,104))):width;
    halfWidth=Math.max(6.1,2.85*contentWidth/height)/.7919856*(width/contentWidth);halfHeight=halfWidth*height/width;
    // Browser-width sizing affects the model camera, never the glass quad.
    // Air-sized windows: 14% smaller. Large laptops: original size.
    // Wide desktops: up to 8% larger, still framed by the content cap.
    const ramp=(from,to)=>THREE.MathUtils.clamp((width-from)/(to-from),0,1);
    deviceScale=responsiveLogoScale?1-.14*ramp(1024,1200)+.14*ramp(1512,1728)+.08*ramp(1920,2560):1;
    camera.zoom=sceneScale*deviceScale;
    camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(pixelRatio,coarse.matches||width<=1100?1:1.25,Math.sqrt(2000000/(width*height))));renderer.setSize(width,height,false);
    // Resizing is never treated as a mouse stroke.
    motions.length=0;pointer.active=false;pointerSpeed=motionStrength=0;
  }
  window.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('scroll',resize);
  resize();
  function resetPointer(){pointer.active=false;motions.length=0;pointerSpeed=motionStrength=0;}
  function initializePointer(event){pointer.active=true;pointer.clientX=event.clientX;pointer.clientY=event.clientY;pointer.time=event.timeStamp;}
  function beginDrag(event){
    if(event.pointerType!=='mouse'||event.button!==0||document.documentElement.classList.contains('preloader-active')||container.closest('[inert]')||event.target.closest('a,button,input,textarea,select'))return;
    initializePointer(event);
  }
  function recordMove(event){
    if(!pointer.active){initializePointer(event);return;}
    const pixelX=event.clientX-pointer.clientX,pixelY=event.clientY-pointer.clientY;
    if(Math.hypot(pixelX,pixelY)<.15)return;
    const rect=canvas.getBoundingClientRect();
    // Orthographic zoom changes the visible world, not the canvas dimensions.
    const viewHalfWidth=halfWidth/camera.zoom,viewHalfHeight=halfHeight/camera.zoom;
    const ax=((pointer.clientX-rect.left)/rect.width*2-1)*viewHalfWidth,ay=(1-(pointer.clientY-rect.top)/rect.height*2)*viewHalfHeight;
    const bx=((event.clientX-rect.left)/rect.width*2-1)*viewHalfWidth,by=(1-(event.clientY-rect.top)/rect.height*2)*viewHalfHeight;
    const dt=THREE.MathUtils.clamp((event.timeStamp-pointer.time)/1000,.004,.08);
    const distance=Math.hypot(bx-ax,by-ay),speed=distance/dt;
    const strength=Math.pow(THREE.MathUtils.clamp((speed-.12)/22,0,3),1.1);
    if(event.timeStamp-lastInput>180){strokeId++;swirlAxis.set(Math.random()*2-1,Math.random()*2-1,Math.random()*2-1).normalize();}
    lastInput=event.timeStamp;
    // Impulse uses real pointer distance and event time, not rendering frame rate.
    if(strength>0)motions.push({ax,ay,bx,by,distance,speed,strength,strokeId,impulse:Math.min(55,repulsionStrength*distance*strength*.12)});
    if(motions.length>64)motions.shift();
    initializePointer(event);
  }
  function movePointer(event){
    if(event.pointerType!=='mouse'||!(event.buttons&1)){resetPointer();return;}
    if(!pointer.active)return;
    if(container.closest('[inert]')){resetPointer();return;}
    // Swept segments already cover the path between events; processing every
    // hardware coalesced sample repeats a full-particle scan unnecessarily.
    recordMove(event);
  }
  function leaveDocument(event){if(event.relatedTarget==null)resetPointer();}
  if(interactive){
    pointerTarget.addEventListener('pointermove',movePointer,true);
    pointerTarget.addEventListener('pointerdown',beginDrag,true);
    pointerTarget.addEventListener('pointerup',resetPointer,true);
    pointerTarget.addEventListener('pointercancel',resetPointer,true);
    document.documentElement.addEventListener('pointerleave',leaveDocument);
    window.addEventListener('blur',resetPointer);
  }
  let visible=true;
  const visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});
  visibilityObserver.observe(container);
  function segmentPoint(x,y,motion){
    const dx=motion.bx-motion.ax,dy=motion.by-motion.ay;
    return THREE.MathUtils.clamp(((x-motion.ax)*dx+(y-motion.ay)*dy)/(dx*dx+dy*dy||1),0,1);
  }
  function applyMotion(motion,c,s){
    let touched=false,lightOrigin=null;
    // Exact swept picking: a fast stroke must actually cross visible particle geometry.
    outer:for(const part of parts){
      const a=part.rest,o=part.offset,f=part.life.flow;
      for(let i=0;i<part.mesh.count;i++){
        const j=i*3,x=c*(a[j]+o[j]+f[j])+s*(a[j+2]+o[j+2]+f[j+2]),y=a[j+1]+o[j+1]+f[j+1];
        const t=segmentPoint(x,y,motion),dx=x-(motion.ax+(motion.bx-motion.ax)*t),dy=y-(motion.ay+(motion.by-motion.ay)*t);
        if(dx*dx+dy*dy<(part.radii[i]+.035)**2){touched=true;lastHit={x,y};lightOrigin={x:a[j],y:a[j+1],z:a[j+2]};break outer;}
      }
    }
    if(!touched)return;
    physicsActive=true;lightActive=true;
    activeMotions++;
    // Light ripples travel inside the letter while the struck beads carry a glow.
    if(simulationTime-lastLightWave>.12){
      lightWaves.push({...lightOrigin,time:simulationTime,power:Math.min(1.05,.3+motion.strength*.3)});
      if(lightWaves.length>6)lightWaves.shift();
      lastLightWave=simulationTime;
    }
    const lightImpulse=Math.min(1.5,.12+Math.sqrt(motion.strength)*.4+motion.impulse*.06);
    const r=interactionRadius,r2=r*r,flowX=(motion.bx-motion.ax)/motion.distance,flowY=(motion.by-motion.ay)/motion.distance;
    for(const part of parts){
      const a=part.rest,o=part.offset,v=part.velocity,random=part.random,f=part.life.flow,wake=part.wake;
      for(let i=0;i<part.mesh.count;i++){
        const j=i*3,n=i*6,x=c*(a[j]+o[j]+f[j])+s*(a[j+2]+o[j+2]+f[j+2]),y=a[j+1]+o[j+1]+f[j+1];
        const t=segmentPoint(x,y,motion),dx=x-(motion.ax+(motion.bx-motion.ax)*t),dy=y-(motion.ay+(motion.by-motion.ay)*t),d2=dx*dx+dy*dy;
        if(d2>=r2)continue;
        if(part.generation[i]!==motion.strokeId){
          part.generation[i]=motion.strokeId;
          const angle=Math.random()*Math.PI*2,z=Math.random()*2-1,radial=Math.sqrt(1-z*z);
          random[n]=Math.cos(angle)*radial;random[n+1]=z;random[n+2]=Math.sin(angle)*radial;
          random[n+3]=.6+Math.random()*1.05;random[n+4]=Math.random()*Math.PI*2;random[n+5]=.8+Math.random()*.45;
        }
        const distance=Math.max(.035,Math.sqrt(d2)),falloff=(1-distance/r)**2;
        part.life.heat[i]=Math.min(1.6,part.life.heat[i]+lightImpulse*falloff);
        const rx=dx/distance,ry=dy/distance,gain=motion.impulse*falloff*random[n+3];
        if(gain<.00001||wake.cooldown[i]>0)continue;
        const core=Math.max(0,1-distance/(r*.5));
        if(wake.remaining[i]<=0){
          // Capture once, then release on schedule. Repeated pointer samples must
          // not keep a bead attached indefinitely or postpone its outward burst.
          wake.remaining[i]=Math.max(.025,wakeDuration)*(.85+.3*(random[n+3]-.6)/1.05)+(1-core)*.012;
          wake.burst[j]=wake.burst[j+1]=wake.burst[j+2]=0;
          const retain=.2+.3*(1-core);
          v[j]*=retain;v[j+1]*=retain;v[j+2]*=retain;
        }
        wake.direction[i*2]=flowX;wake.direction[i*2+1]=flowY;
        // Entry: carry the struck beads along the swept mouse path, with a small
        // inward squeeze. Random sideways/depth motion is reserved for release.
        const forward=gain*(1.1+core*.25),pinch=gain*.12;
        const entryX=flowX*forward-rx*pinch,entryY=flowY*forward-ry*pinch;
        v[j]+=c*entryX;v[j+1]+=entryY;v[j+2]+=s*entryX;
        const entrySpeed=Math.hypot(v[j],v[j+1],v[j+2]);
        if(entrySpeed>105){const scale=105/entrySpeed;v[j]*=scale;v[j+1]*=scale;v[j+2]*=scale;}
        const flutter=Math.sin(simulationTime*(2.2+random[n+3])+random[n+4]);
        const wx=gain*(rx*.7+random[n]*.8-swirlAxis.z*ry*.25*flutter+flowX*.12);
        const wy=gain*(ry*.7+random[n+1]*.8+swirlAxis.z*rx*.25*flutter+flowY*.12);
        const wz=gain*(random[n+2]*.65+(swirlAxis.x*ry-swirlAxis.y*rx)*.25*flutter);
        // Store release momentum in screen/world space so the trail stays aligned
        // with the mouse even while the logo continues its automatic rotation.
        wake.burst[j]+=wx;wake.burst[j+1]+=wy;wake.burst[j+2]+=wz;
        const burstSpeed=Math.hypot(wake.burst[j],wake.burst[j+1],wake.burst[j+2]);
        if(burstSpeed>120){const scale=120/burstSpeed;wake.burst[j]*=scale;wake.burst[j+1]*=scale;wake.burst[j+2]*=scale;}
      }
    }
  }
  function physics(dt,c,s){
    displaced=0;maxDisplacement=0;
    for(const part of parts){
      const a=part.rest,o=part.offset,v=part.velocity,f=part.life.flow,wake=part.wake;
      for(let i=0;i<part.mesh.count;i++){
        const j=i*3,n=i*6;
        let ox=o[j],oy=o[j+1],oz=o[j+2],vx=v[j],vy=v[j+1],vz=v[j+2];
        if(wake.remaining[i]>0){
          wake.remaining[i]=Math.max(0,wake.remaining[i]-dt);
          if(wake.remaining[i]===0){
            const bx=wake.burst[j],by=wake.burst[j+1],bz=wake.burst[j+2];
            vx+=c*bx-s*bz;vy+=by;vz+=s*bx+c*bz;
            wake.burst[j]=wake.burst[j+1]=wake.burst[j+2]=0;
            wake.cooldown[i]=.12;releasedParticles++;
          }
        }else if(wake.cooldown[i]>0){wake.cooldown[i]=Math.max(0,wake.cooldown[i]-dt);}
        if(Math.abs(ox)+Math.abs(oy)+Math.abs(oz)+Math.abs(vx)+Math.abs(vy)+Math.abs(vz)<.000001)continue;
        const following=wake.remaining[i]>0;
        const variation=part.random[n+5]||1,retention=Math.exp(-damping*variation*dt*(following?.4:1)),spring=springStrength*variation*(following?.2:1);
        vx=(vx-spring*ox*dt)*retention;vy=(vy-spring*oy*dt)*retention;vz=(vz-spring*oz*dt)*retention;
        if(following){
          const dx=c*wake.direction[i*2],dy=wake.direction[i*2+1],dz=s*wake.direction[i*2],along=vx*dx+vy*dy+vz*dz,sideRetention=Math.exp(-45*dt);
          vx=dx*along+(vx-dx*along)*sideRetention;
          vy=dy*along+(vy-dy*along)*sideRetention;
          vz=dz*along+(vz-dz*along)*sideRetention;
        }
        ox+=vx*dt;oy+=vy*dt;oz+=vz*dt;
        let wx=c*(a[j]+ox+f[j])+s*(a[j+2]+oz+f[j+2]),wy=a[j+1]+oy+f[j+1],wz=-s*(a[j]+ox+f[j])+c*(a[j+2]+oz+f[j+2]);
        let wvx=c*vx+s*vz,wvz=-s*vx+c*vz;
        // No viewport inset: the bead's outer surface can touch the actual edge.
        const limitX=halfWidth/camera.zoom-part.screenRadii[i*2],limitY=halfHeight/camera.zoom-part.screenRadii[i*2+1];
        let collided=false;
        if(wx>limitX){wx=limitX;wvx=-Math.abs(wvx)*boundaryRestitution;collided=true;edgeContacts.right++;}
        else if(wx<-limitX){wx=-limitX;wvx=Math.abs(wvx)*boundaryRestitution;collided=true;edgeContacts.left++;}
        if(wy>limitY){wy=limitY;vy=-Math.abs(vy)*boundaryRestitution;collided=true;edgeContacts.top++;}
        else if(wy<-limitY){wy=-limitY;vy=Math.abs(vy)*boundaryRestitution;collided=true;edgeContacts.bottom++;}
        if(wz>8){wz=8;wvz=-Math.abs(wvz)*boundaryRestitution;collided=true;}
        else if(wz<-8){wz=-8;wvz=Math.abs(wvz)*boundaryRestitution;collided=true;}
        if(collided){
          // A bead that reaches the window during its entry phase bounces freely;
          // its delayed burst still releases, but steering cannot pin it to an edge.
          if(following)wake.remaining[i]=Math.min(wake.remaining[i],dt);
          boundaryHits++;ox=c*wx-s*wz-a[j]-f[j];oy=wy-a[j+1]-f[j+1];oz=s*wx+c*wz-a[j+2]-f[j+2];vx=c*wvx-s*wvz;vz=s*wvx+c*wvz;
        }
        let magnitude=Math.hypot(ox,oy,oz);
        if(magnitude<.0005&&Math.hypot(vx,vy,vz)<.001){ox=oy=oz=vx=vy=vz=0;magnitude=0;}
        o[j]=ox;o[j+1]=oy;o[j+2]=oz;v[j]=vx;v[j+1]=vy;v[j+2]=vz;
        if(magnitude>.015)displaced++;maxDisplacement=Math.max(maxDisplacement,magnitude);
      }
    }
  }
  function syncParticles(){
    for(const part of parts){
      const a=part.rest,o=part.offset,f=part.life.flow,matrix=part.mesh.instanceMatrix.array,p=part.life.positionAttribute.array;
      for(let i=0;i<part.mesh.count;i++){
        const j=i*3,k=i*16,x=a[j]+o[j]+f[j],y=a[j+1]+o[j+1]+f[j+1],z=a[j+2]+o[j+2]+f[j+2];
        matrix[k+12]=p[j]=x;matrix[k+13]=p[j+1]=y;matrix[k+14]=p[j+2]=z;
      }
      part.mesh.instanceMatrix.needsUpdate=true;
      if(part.life.halo.visible)part.life.positionAttribute.needsUpdate=true;
    }
  }
  function updateScreenRadii(c,s){
    for(const part of parts){
      const shape=part.radiusShape,r=part.screenRadii;
      for(let i=0;i<part.mesh.count;i++){
        const j=i*3;
        r[i*2]=Math.sqrt(Math.max(0,c*c*shape[j]+2*c*s*shape[j+1]+s*s*shape[j+2]));
      }
    }
  }
  function frame(now){
    if(disposed)return;raf=requestAnimationFrame(frame);
    if(document.hidden||!visible||container.closest('[inert]')){lastTime=now;resetPointer();return;}
    // Leave headroom for native scroll and the portal's DOM animation.
    const interval=1000/Math.min(maxFPS,coarse.matches||width<=1100||transitionActive?30:60);
    if(now-lastRendered<interval-1)return;
    lastRendered=now;
    const dt=Math.min(.033,Math.max(0,(now-(lastTime||now))/1000));lastTime=now;
    const revealing = document.documentElement.classList.contains('preloader-active');
    if(revealing&&frames>0){resetPointer();return;}
    if (rotationMode === 'sway') {
      // Start face-on; a restrained ±5° sway never turns the lettering edge-on.
      if (!revealing) simulationTime += dt;
      const settle = Math.min(1, simulationTime / 1.5);
      const yaw = Math.sin(simulationTime * Math.PI * 2 / rotationSeconds) * .087 * settle * settle * (3 - 2 * settle);
      pivot.quaternion.copy(frontFacing).multiply(swayQuaternion.setFromAxisAngle(rotationAxis, yaw));
    } else {
      mixer.update(dt);
      simulationTime += dt;
    }
    if (revealing) resetPointer();
    gltf.scene.updateMatrixWorld(true);
    const m=pivot.matrixWorld.elements,c=m[0],s=m[8];
    maxLiquidDisplacement=updateLiquid(parts,simulationTime,liquidAmplitude,liquidSpeed);
    activeMotions=0;lastHit=null;pointerSpeed=motionStrength=0;
    for(const motion of motions){pointerSpeed=Math.max(pointerSpeed,motion.speed);motionStrength=Math.max(motionStrength,motion.strength);applyMotion(motion,c,s);}
    motions.length=0;
    if(physicsActive){
      updateScreenRadii(c,s);
      const steps=Math.max(1,Math.ceil(dt/.012));for(let i=0;i<steps;i++)physics(dt/steps,c,s);
      physicsActive=parts.some(part=>part.offset.some(value=>value!==0)||part.velocity.some(value=>value!==0)||part.wake.remaining.some(value=>value>0)||part.wake.cooldown.some(value=>value>0));
    }
    if(lightActive){
      ({glowing,maxGlow}=updateInnerLight(parts,lightWaves,simulationTime,dt,glowDecay,renderer.getPixelRatio()*height*camera.zoom/(halfHeight*2)));
      lightActive=lightWaves.length>0||maxGlow>=.001;
    }
    syncParticles();
    if(glass)glass.render(scene,camera);
    else renderer.render(scene,camera);
    frames++;
  }
  raf=requestAnimationFrame(frame);
  return {
    canvas,
    setTransitionActive(active){transitionActive=Boolean(active);},
    // Zoom the model before the optical pass; the full-screen glass stays fixed.
    setSceneScale(scale){
      sceneScale=Math.max(.1,Math.min(1,scale));
      const zoom=sceneScale*deviceScale;
      if(camera.zoom===zoom)return;
      camera.zoom=zoom;
      camera.updateProjectionMatrix();
    },
    getState(){
      const m=pivot.matrixWorld.elements;let outsideViewport=0;
      let wakeParticles=0,wakeAlignment=0,wakeForwardSpeed=0,wakeLateralSpeed=0,releasedLateralSpeed=0,releasing=0;
      const viewHalfWidth=halfWidth/camera.zoom,viewHalfHeight=halfHeight/camera.zoom;
      const edgeGapPixels={left:Infinity,right:Infinity,top:Infinity,bottom:Infinity},pixelsX=width/(2*viewHalfWidth),pixelsY=height/(2*viewHalfHeight);
      for(const part of parts){
        const a=part.rest,o=part.offset,f=part.life.flow,r=part.screenRadii;
        for(let i=0;i<part.mesh.count;i++){
          const j=i*3,x=m[0]*(a[j]+o[j]+f[j])+m[8]*(a[j+2]+o[j+2]+f[j+2]),y=a[j+1]+o[j+1]+f[j+1],rx=r[i*2],ry=r[i*2+1];
          if(Math.abs(x)>viewHalfWidth-rx+.001||Math.abs(y)>viewHalfHeight-ry+.001)outsideViewport++;
          edgeGapPixels.left=Math.min(edgeGapPixels.left,(viewHalfWidth+x-rx)*pixelsX);
          edgeGapPixels.right=Math.min(edgeGapPixels.right,(viewHalfWidth-x-rx)*pixelsX);
          edgeGapPixels.top=Math.min(edgeGapPixels.top,(viewHalfHeight-y-ry)*pixelsY);
          edgeGapPixels.bottom=Math.min(edgeGapPixels.bottom,(viewHalfHeight+y-ry)*pixelsY);
          if(part.wake.remaining[i]>0||part.wake.cooldown[i]>0){
            const v=part.velocity,wx=m[0]*v[j]+m[8]*v[j+2],wy=v[j+1],wz=-m[8]*v[j]+m[0]*v[j+2];
            const forward=wx*part.wake.direction[i*2]+wy*part.wake.direction[i*2+1],speed2=wx*wx+wy*wy+wz*wz,lateral=Math.sqrt(Math.max(0,speed2-forward*forward));
            if(part.wake.remaining[i]>0){wakeParticles++;wakeAlignment+=forward/Math.max(.000001,Math.sqrt(speed2));wakeForwardSpeed+=forward;wakeLateralSpeed+=lateral;}
            else{releasing++;releasedLateralSpeed+=lateral;}
          }
        }
      }
      const liquidSamples=parts.map(part=>Array.from(part.life.flow.subarray(0,9)));
      return {quality:'HD',interaction:'movement-only',motionStyle:'directional-wake',wakeDurationMs:wakeDuration*1000,wakeParticles,wakeAlignment:wakeAlignment/Math.max(1,wakeParticles),wakeForwardSpeed:wakeForwardSpeed/Math.max(1,wakeParticles),wakeLateralSpeed:wakeLateralSpeed/Math.max(1,wakeParticles),releasedParticles,releasedLateralSpeed:releasedLateralSpeed/Math.max(1,releasing),idleMotion:'liquid',innerLight:true,glowStrength,liquidAmplitude,maxLiquidDisplacement,liquidSamples,glowing,maxGlow,lightWaves:lightWaves.length,fullViewport:true,edgePaddingPixels:0,edgeGapPixels,edgeContacts:{...edgeContacts},viewport:[width,height],bounds:[halfWidth,halfHeight],pixelRatio:renderer.getPixelRatio(),renderSize:[canvas.width,canvas.height],trianglesPerParticle:parts[0].mesh.geometry.index.count/3,strokeId,particles:parts.reduce((n,p)=>n+p.mesh.count,0),displaced,maxDisplacement,boundaryHits,outsideViewport,pointerSpeed,motionStrength,activeMotions,hit:lastHit,rotation:pivot.quaternion.toArray(),clipTime:action.time,frames,transparent:renderer.getClearAlpha()===0,drawCalls:renderer.info.render.calls,colors:parts.map(p=>({name:p.mesh.name,hex:'#'+p.mesh.material.color.getHexString()}))};
    },
    dispose(){
      visibilityObserver.disconnect();
      if(disposed)return;disposed=true;cancelAnimationFrame(raf);
      window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);window.removeEventListener('blur',resetPointer);
      pointerTarget.removeEventListener('pointermove',movePointer,true);pointerTarget.removeEventListener('pointerdown',beginDrag,true);pointerTarget.removeEventListener('pointerup',resetPointer,true);pointerTarget.removeEventListener('pointercancel',resetPointer,true);document.documentElement.removeEventListener('pointerleave',leaveDocument);
      mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
      const geometries=new Set(),materials=new Set();gltf.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
      glass?.dispose();renderer.dispose();canvas.remove();
    }
  };
}
