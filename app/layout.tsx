import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'D&D Map Projector & Fog of War',
  description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
  openGraph: {
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D&D Map Projector & Fog of War',
    description: 'Ultra-lightweight live tabletop RPG map & video projector with Photoshop-like dynamic map drawing tools (fire, water, fog/gas, laser pointer, attention beacons), real-time Fog of War, and dual-window sync.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  if(typeof window==='undefined')return;
  if(!window.crypto)window.crypto={};
  if(!window.crypto.randomUUID){
    window.crypto.randomUUID=function(){
      if(typeof window.crypto.getRandomValues==='function'){
        var buf=new Uint8Array(16);
        window.crypto.getRandomValues(buf);
        buf[6]=(buf[6]&0x0f)|0x40;
        buf[8]=(buf[8]&0x3f)|0x80;
        var h=Array.from(buf,function(b){return b.toString(16).padStart(2,'0');}).join('');
        return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
      }
      return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
        var r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);
      });
    };
  }
  if(typeof window.structuredClone!=='function'){
    window.structuredClone=function(o){
      return o===undefined?undefined:JSON.parse(JSON.stringify(o));
    };
  }
  if(!Array.prototype.at){
    Object.defineProperty(Array.prototype,'at',{
      value:function(n){
        n=Math.trunc(n)||0;if(n<0)n+=this.length;
        return(n<0||n>=this.length)?undefined:this[n];
      },writable:true,configurable:true
    });
  }
  if(!String.prototype.replaceAll){
    Object.defineProperty(String.prototype,'replaceAll',{
      value:function(s,r){
        if(s instanceof RegExp){if(!s.global)throw new TypeError('replaceAll called with non-global RegExp');return this.replace(s,r);}
        return this.split(s).join(r);
      },writable:true,configurable:true
    });
  }
  if(!Object.hasOwn){
    Object.defineProperty(Object,'hasOwn',{
      value:function(o,p){return Object.prototype.hasOwnProperty.call(o,p);},
      writable:true,configurable:true
    });
  }
  if(!window.AudioContext&&window.webkitAudioContext){
    window.AudioContext=window.webkitAudioContext;
  }
  try{
    var f=document.createElement('div');
    f.style.display='flex';f.style.flexDirection='column';f.style.rowGap='1px';
    f.appendChild(document.createElement('div'));f.appendChild(document.createElement('div'));
    document.documentElement.appendChild(f);
    if(f.scrollHeight!==1){document.documentElement.classList.add('no-flex-gap');}
    document.documentElement.removeChild(f);
  }catch(e){}
})();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
