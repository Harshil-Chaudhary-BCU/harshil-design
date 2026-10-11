// One-shot 2D refraction: no WebGL, model download, or continuous render loop.
export async function renderTouchGlass(host, assetURL){
  const image=new Image();
  image.src=assetURL;
  await image.decode();
  const canvas=document.createElement('canvas');
  canvas.className='hc-static-art';
  canvas.setAttribute('aria-hidden','true');
  const context=canvas.getContext('2d');
  const source=document.createElement('canvas');
  const sourceContext=source.getContext('2d',{willReadFrequently:true});
  let previousSize='',timer;
  function paint(){
    if(host.hidden)return;
    const viewport=host.getBoundingClientRect();
    const logoWidth=Math.min(viewport.width*.64,1000),logoHeight=logoWidth*717/1700;
    const ratio=Math.min(devicePixelRatio||1,1.5),padding=18;
    const width=Math.ceil((logoWidth+padding*2)*ratio),height=Math.ceil((logoHeight+padding*2)*ratio);
    const size=`${width}:${height}:${viewport.height}`;
    if(size===previousSize)return;
    previousSize=size;
    canvas.width=source.width=width;canvas.height=source.height=height;
    canvas.style.width=`${logoWidth+padding*2}px`;
    sourceContext.drawImage(image,padding*ratio,padding*ratio,logoWidth*ratio,logoHeight*ratio);
    const input=sourceContext.getImageData(0,0,width,height).data;
    const output=context.createImageData(width,height),pixels=output.data;
    // Match the desktop glass shader: 19px ribs, 6.5px refraction, .65px blur.
    const length=Math.hypot(-.57,.82),nx=-.57/length,ny=.82/length;
    const left=(viewport.width-logoWidth-padding*2)/2,top=(viewport.height-logoHeight-padding*2)/2;
    const samples=[[0,0,.64],[.65,.65,.09],[-.65,-.65,.09],[.65,-.65,.09],[-.65,.65,.09]];
    function sample(x,y,channel){
      x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));
      const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
      return input[(y0*width+x0)*4+channel]*(1-fx)*(1-fy)+input[(y0*width+x1)*4+channel]*fx*(1-fy)+input[(y1*width+x0)*4+channel]*(1-fx)*fy+input[(y1*width+x1)*4+channel]*fx*fy;
    }
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const phase=((left+x/ratio)*nx+(viewport.height-top-y/ratio)*ny)/19*Math.PI*2;
      const displacement=Math.sin(phase)*6.5*ratio;
      const sx=x+nx*displacement,sy=y-ny*displacement,index=(y*width+x)*4;
      let alpha=0;
      for(const [dx,dy,weight] of samples)alpha+=sample(sx+dx*ratio,sy+dy*ratio,3)*weight;
      if(alpha<.5)continue;
      // Static fine grain keeps the lettering closer to the desktop bead surface.
      const noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%100/100;
      const ridge=Math.pow(Math.max(0,Math.cos(phase)),18);
      const shade=1+Math.min(Math.sin(phase-.65)*.045,0);
      for(let channel=0;channel<3;channel++){
        let color=0;
        for(const [dx,dy,weight] of samples)color+=sample(sx+dx*ratio,sy+dy*ratio,channel)*weight;
        pixels[index+channel]=color*shade*(1-ridge*.025)*( .84+noise*.16);
      }
      pixels[index+3]=alpha*(noise<.06?.72:1);
    }
    context.putImageData(output,0,0);
    host.querySelector('svg')?.remove();
    if(!canvas.isConnected)host.prepend(canvas);
  }
  paint();
  addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(paint,160)},{passive:true});
}
