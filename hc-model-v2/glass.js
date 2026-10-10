import * as THREE from './vendor/three.module.js';

// Stationary diagonal optical glass. Model motion and particle physics are separate.
export function createGlass(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  const uniforms = {
    image: { value: target.texture },
    resolution: { value: new THREE.Vector2(1, 1) },
    paper: { value: new THREE.Color('#090909') }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      uniform sampler2D image;
      uniform vec2 resolution;
      uniform vec3 paper;
      varying vec2 vUv;
      vec3 sampleGlass(vec2 uv){
        vec4 c=texture2D(image,clamp(uv,vec2(.001),vec2(.999)));
        return c.rgb + paper*(1.-c.a);
      }
      void main(){
        vec2 pixel=vUv*resolution;
        vec2 normal=normalize(vec2(-.57,.82));
        float phase=dot(pixel,normal)/19.*6.2831853;
        vec2 uv=vUv+normal*(sin(phase)*6.5)/resolution;
        vec2 blur=vec2(.65)/resolution;
        vec3 color=sampleGlass(uv)*.64;
        color+=sampleGlass(uv+blur)*.09;
        color+=sampleGlass(uv-blur)*.09;
        color+=sampleGlass(uv+vec2(blur.x,-blur.y))*.09;
        color+=sampleGlass(uv+vec2(-blur.x,blur.y))*.09;
        float ridge=pow(max(0.,cos(phase)),18.);
        float shade=sin(phase-.65)*.045;
        color=mix(color,paper,.008);
        color*=1.+min(shade,0.);
        color=mix(color,paper,ridge*.025);
        // Narrow static reflections polish the original ribs without new glow.
        float reflection=pow(max(0.,cos(phase-.4)),30.);
        color+=vec3(.0045)*reflection;
        color+=sampleGlass(uv+normal*2./resolution)*ridge*.015;
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2,2);
  scene.add(new THREE.Mesh(geometry,material));
  const camera = new THREE.Camera();
  const size = new THREE.Vector2();
  return {
    render(modelScene, modelCamera){
      renderer.getSize(size);
      const ratio=renderer.getPixelRatio();
      const w=Math.round(size.x*ratio),h=Math.round(size.y*ratio);
      if(target.width!==w||target.height!==h)target.setSize(w,h);
      uniforms.resolution.value.copy(size);
      renderer.setRenderTarget(target);
      renderer.render(modelScene,modelCamera);
      renderer.setRenderTarget(null);
      renderer.render(scene,camera);
    },
    dispose(){target.dispose();material.dispose();geometry.dispose();}
  };
}
