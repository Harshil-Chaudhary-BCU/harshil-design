import * as THREE from './vendor/three.module.js';

// Small, coherent currents move the bead centres without changing the lettering.
// Spatial phases are cached so 61,114 particles only need six trig calls per frame.
export function createParticleLife(mesh, rest, radii, glowStrength) {
  const count=mesh.count, phases=new Float32Array(count*6);
  for(let i=0;i<count;i++){
    const j=i*3,n=i*6,x=rest[j],y=rest[j+1],z=rest[j+2];
    const angles=[x*.55+y*1.35+z*.9,-x*1.1+y*.55+z*1.4,x*1.65-y*.85+z*.4];
    for(let k=0;k<3;k++){phases[n+k*2]=Math.sin(angles[k]);phases[n+k*2+1]=Math.cos(angles[k]);}
  }
  const flow=new Float32Array(rest.length),heat=new Float32Array(count),energy=new Float32Array(count);
  const lightAttribute=new THREE.InstancedBufferAttribute(energy,1).setUsage(THREE.DynamicDrawUsage);
  // The two letters share source geometry, but need independent per-bead light.
  mesh.geometry=mesh.geometry.clone();mesh.geometry.setAttribute('hcEnergy',lightAttribute);
  const glowColor=new THREE.Color(mesh.name.startsWith('H_')?'#ff9c52':'#ffdfb2');
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.hcGlowColor={value:glowColor};
    shader.uniforms.hcGlowStrength={value:glowStrength};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nattribute float hcEnergy;\nvarying float vHCEnergy;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvHCEnergy = hcEnergy;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform vec3 hcGlowColor;\nuniform float hcGlowStrength;\nvarying float vHCEnergy;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float hcCore = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
      totalEmissiveRadiance += hcGlowColor * vHCEnergy * hcGlowStrength * (0.3 + 0.7 * hcCore);`);
  };
  mesh.material.customProgramCacheKey=()=> 'hc-inner-light-v1';
  mesh.material.needsUpdate=true;

  // Depth-tested halos leak through openings between lit beads. They preserve
  // the transparent background and leave the solid particles sharp.
  const positions=new Float32Array(rest),haloGeometry=new THREE.BufferGeometry();
  const positionAttribute=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
  const haloEnergyAttribute=new THREE.BufferAttribute(energy,1).setUsage(THREE.DynamicDrawUsage);
  haloGeometry.setAttribute('position',positionAttribute);
  haloGeometry.setAttribute('hcEnergy',haloEnergyAttribute);
  haloGeometry.setAttribute('hcRadius',new THREE.BufferAttribute(radii,1));
  const haloMaterial=new THREE.ShaderMaterial({
    uniforms:{hcGlowColor:{value:glowColor},hcGlowStrength:{value:glowStrength},hcPixelScale:{value:1}},
    transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
    vertexShader:`
      attribute float hcEnergy;
      attribute float hcRadius;
      uniform float hcPixelScale;
      varying float vHCEnergy;
      void main(){
        vHCEnergy = hcEnergy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = hcEnergy < 0.004 ? 1.0 : clamp(hcRadius * hcPixelScale * 8.0, 1.0, 96.0);
      }`,
    fragmentShader:`
      uniform vec3 hcGlowColor;
      uniform float hcGlowStrength;
      varying float vHCEnergy;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(p,p);
        if(r2 > 1.0 || vHCEnergy < 0.004) discard;
        float halo = exp(-4.8*r2) * (1.0-smoothstep(0.6,1.0,r2));
        gl_FragColor = vec4(hcGlowColor, halo * min(vHCEnergy,1.5) * hcGlowStrength * 0.14);
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }`
  });
  const halo=new THREE.Points(haloGeometry,haloMaterial);
  halo.name=mesh.name+'_Inner_Light';halo.frustumCulled=false;halo.renderOrder=2;halo.visible=false;
  mesh.add(halo);
  return {flow,phases,heat,energy,lightAttribute,halo,positionAttribute,haloEnergyAttribute};
}

export function updateLiquid(parts,time,amplitude,speed){
  const t=time*speed;
  const s1=Math.sin(t*.82),c1=Math.cos(t*.82),s2=Math.sin(t*1.13),c2=Math.cos(t*1.13),s3=Math.sin(-t*.67),c3=Math.cos(-t*.67);
  let max=0;
  for(const part of parts){
    const {flow,phases}=part.life;
    for(let i=0;i<part.mesh.count;i++){
      const j=i*3,n=i*6;
      const a=phases[n]*c1+phases[n+1]*s1,b=phases[n+2]*c2+phases[n+3]*s2,c=phases[n+4]*c3+phases[n+5]*s3;
      // Transverse waves form gently circulating currents, rather than jitter.
      const x=amplitude*(.52*a+.37*b),y=amplitude*(-.21*a+.32*c),z=amplitude*(.29*b+.58*c);
      flow[j]=x;flow[j+1]=y;flow[j+2]=z;
      max=Math.max(max,x*x+y*y+z*z);
    }
  }
  return Math.sqrt(max);
}

export function updateInnerLight(parts,waves,time,dt,decay,pixelScale){
  const retention=Math.exp(-decay*dt),shimmerCos=Math.cos(time*4.1),shimmerSin=Math.sin(time*4.1),active=[];
  for(let i=waves.length-1;i>=0;i--){
    const wave=waves[i],age=time-wave.time;
    if(age>=1.05){waves.splice(i,1);continue;}
    const radius=age*2.15,width=.28;
    active.push({...wave,radius,width,inner2:Math.max(0,radius-width)**2,outer2:(radius+width)**2,power:wave.power*(1-age/1.05)**2});
  }
  let glowing=0,maxGlow=0;
  for(const part of parts){
    const {heat,energy,phases}=part.life,a=part.rest;
    let visible=false;
    for(let i=0;i<part.mesh.count;i++){
      const j=i*3,n=i*6;
      let value=heat[i]*retention;
      for(const wave of active){
        const dx=a[j]-wave.x,dy=a[j+1]-wave.y,dz=a[j+2]-wave.z,d2=dx*dx+dy*dy+dz*dz;
        if(d2<wave.inner2||d2>wave.outer2)continue;
        const ring=1-Math.abs(Math.sqrt(d2)-wave.radius)/wave.width;
        value=Math.max(value,wave.power*ring*ring);
      }
      heat[i]=value<.001?0:value;
      // A moving modulation gives the illuminated interior a slow shimmer.
      energy[i]=heat[i]*(.84+.16*(phases[n+2]*shimmerCos+phases[n+3]*shimmerSin));
      if(energy[i]>.015){glowing++;visible=true;}
      maxGlow=Math.max(maxGlow,energy[i]);
    }
    part.life.lightAttribute.needsUpdate=true;
    part.life.haloEnergyAttribute.needsUpdate=true;
    part.life.halo.material.uniforms.hcPixelScale.value=pixelScale;
    part.life.halo.visible=visible;
  }
  return {glowing,maxGlow};
}
