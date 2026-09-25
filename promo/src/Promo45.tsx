import React from 'react';
import {AbsoluteFill,Audio,OffthreadVideo,Sequence,interpolate,staticFile,useCurrentFrame} from 'remotion';
const C={paper:'#f4f2eb',ink:'#143b37',orange:'#ed8c58',white:'#fffef9'};
const font='IBM Plex Sans, sans-serif';
const ease=(f:number,n=14)=>interpolate(f,[0,n],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:x=>1-(1-x)**3});
const Video=({name,start=0,style={}}:{name:string;start?:number;style?:React.CSSProperties})=><OffthreadVideo muted src={staticFile(`footage/${name}.mp4`)} trimBefore={start} style={{width:'100%',height:'100%',objectFit:'cover',...style}}/>;
const Label=({children,dark=false}:{children:React.ReactNode;dark?:boolean})=><div style={{fontSize:22,fontWeight:500,letterSpacing:4,textTransform:'uppercase',color:dark?C.ink:C.white,display:'flex',alignItems:'center',gap:16}}><span style={{width:32,height:4,background:C.orange}}/>{children}</div>;
const Phrase=({children,kicker,dark=false,top=false}:{children:React.ReactNode;kicker?:string;dark?:boolean;top?:boolean})=>{const f=useCurrentFrame(),p=ease(f);return <div style={{position:'absolute',left:80,...(top?{top:66}:{bottom:76}),opacity:p,transform:`translateY(${(1-p)*12}px)`,color:dark?C.ink:C.white}}>{kicker&&<Label dark={dark}>{kicker}</Label>}<div style={{fontWeight:600,fontSize:56,lineHeight:1.15,letterSpacing:-1.5,marginTop:kicker?18:0}}>{children}</div></div>};
const Shade=({top=false,strong=false}:{top?:boolean;strong?:boolean})=><AbsoluteFill style={{background:top?'linear-gradient(180deg,rgba(8,29,26,.7),transparent 45%)':`linear-gradient(0deg,rgba(8,29,26,${strong?.85:.7}),transparent 48%)`}}/>;
const Opening=()=>{const f=useCurrentFrame(),p=ease(f,22);return <AbsoluteFill><Video name="m1-hero"/><AbsoluteFill style={{background:'linear-gradient(90deg,rgba(8,26,25,.96) 0%,rgba(8,26,25,.88) 25%,rgba(8,26,25,.15) 72%)'}}/><div style={{position:'absolute',left:80,top:102,opacity:p}}><Label>STEM LEARNING / 3D MISSIONS</Label></div><div style={{position:'absolute',left:80,top:330,color:C.white,transform:`translateY(${(1-p)*18}px)`,opacity:p}}><div style={{fontSize:116,lineHeight:.98,fontWeight:700,letterSpacing:-5}}>DRONE<br/>SIMULATOR<span style={{color:C.orange}}>.</span></div><div style={{fontSize:30,fontWeight:400,marginTop:42,color:'#d3dfd8'}}>Code. Fly. Complete the mission.</div></div><div style={{position:'absolute',left:80,bottom:86,height:3,width:interpolate(f,[0,119],[0,530]),background:C.orange}}/></AbsoluteFill>};
const Home=()=> <AbsoluteFill style={{background:C.paper}}><div style={{position:'absolute',left:115,top:0,width:783,height:1080}}><Video name="home" style={{objectFit:'contain'}}/></div><div style={{position:'absolute',right:135,top:300,width:730}}><Label dark>01 / CHOOSE</Label><div style={{color:C.ink,fontSize:100,fontWeight:600,letterSpacing:-4,lineHeight:1.06,marginTop:35}}>Choose<br/>your mission<span style={{color:'#bf461e'}}>.</span></div><div style={{marginTop:40,height:3,width:90,background:'#bf461e'}}/></div></AbsoluteFill>;
const MissionSelect=()=> <AbsoluteFill style={{background:C.paper}}><Video name="mission-select"/><Phrase dark>Choose your mission</Phrase></AbsoluteFill>;
const Blocks=()=> <AbsoluteFill><Video name="blockly"/><div style={{position:'absolute',left:804,bottom:165,padding:'20px 28px',background:C.ink,color:C.white,fontSize:40,fontWeight:600,borderLeft:`5px solid ${C.orange}`}}>Build with blocks</div></AbsoluteFill>;
const Run=()=>{const f=useCurrentFrame();return <AbsoluteFill><Video name="run"/>{f>20&&<div style={{position:'absolute',right:82,bottom:170,fontSize:80,fontWeight:700,letterSpacing:-3,color:C.white,background:C.ink,padding:'4px 28px',opacity:ease(f-20,5)}}>RUN<span style={{color:C.orange}}> →</span></div>}</AbsoluteFill>};
const Flight=({name,caption,kicker,start=0}:{name:string;caption?:string;kicker?:string;start?:number})=><AbsoluteFill><Video name={name} start={start}/>{caption&&<><Shade/><Phrase kicker={kicker}>{caption}</Phrase></>}{!caption&&kicker&&<><Shade top/><div style={{position:'absolute',left:80,top:68}}><Label>{kicker}</Label></div></>}</AbsoluteFill>;
const Result=()=> <AbsoluteFill style={{background:C.ink}}><Video name="m1-result"/><div style={{position:'absolute',left:70,top:120,color:C.white,width:400}}><Label>04 / COMPLETE</Label><div style={{fontSize:65,fontWeight:600,lineHeight:1.05,letterSpacing:-2,marginTop:28}}>MISSION<br/>COMPLETE<span style={{color:C.orange}}>.</span></div></div></AbsoluteFill>;
const End=()=>{const f=useCurrentFrame(),p=ease(f,10);return <AbsoluteFill style={{background:C.ink,color:C.white,padding:'80px 100px',opacity:p}}><Label>DRONE SIMULATOR</Label><div style={{fontSize:108,lineHeight:1.04,fontWeight:700,letterSpacing:-4,marginTop:94}}>CODE IT.<br/>FLY IT.<br/><span style={{color:C.orange}}>COMPLETE THE MISSION.</span></div><div style={{position:'absolute',left:100,right:100,bottom:115,display:'flex',justifyContent:'space-between',alignItems:'flex-end',borderTop:'1px solid #ffffff35',paddingTop:30}}><div style={{fontSize:34,fontWeight:500}}>Drone Simulator</div><div style={{fontSize:31,color:'#d6e2d8'}}>alanchan246.github.io/drone-simulator/</div></div></AbsoluteFill>};
export const Promo45=()=> <AbsoluteFill style={{fontFamily:font,background:C.ink}}>
 <Audio src={staticFile('audio/promo-mix.wav')}/>
 <Sequence from={0} durationInFrames={120}><Opening/></Sequence>
 <Sequence from={120} durationInFrames={60}><Home/></Sequence>
 <Sequence from={180} durationInFrames={60}><MissionSelect/></Sequence>
 <Sequence from={240} durationInFrames={174}><Blocks/></Sequence>
 <Sequence from={414} durationInFrames={36}><Run/></Sequence>
 <Sequence from={450} durationInFrames={90}><Flight name="m1-takeoff" start={14} caption="Watch your code take flight" kicker="02 / RUN → 03 / FLY"/></Sequence>
 <Sequence from={540} durationInFrames={90}><Flight name="m1-flight" kicker="MISSION 01 / URBAN RESCUE"/></Sequence>
 <Sequence from={630} durationInFrames={120}><Flight name="m1-landing" start={10} kicker="DELIVER. LAND. COMPLETE."/></Sequence>
 <Sequence from={750} durationInFrames={150}><Result/></Sequence>
 <Sequence from={900} durationInFrames={90}><Flight name="m2-wide" caption="Different missions. New challenges." kicker="MISSION 02 / WILDFIRE RESPONSE"/></Sequence>
 <Sequence from={990} durationInFrames={90}><Flight name="m2-track" kicker="MISSION 02 / WILDFIRE RESPONSE"/></Sequence>
 <Sequence from={1080} durationInFrames={90}><Flight name="m2-fire" start={15} kicker="PUT YOUR PROGRAM TO WORK"/></Sequence>
 <Sequence from={1170} durationInFrames={15}><Video name="run" start={30}/></Sequence>
 <Sequence from={1185} durationInFrames={15}><Video name="m1-flight" start={45}/></Sequence>
 <Sequence from={1200} durationInFrames={15}><Video name="m2-fire" start={75}/></Sequence>
 <Sequence from={1215} durationInFrames={15}><Video name="m1-result" start={60}/></Sequence>
 <Sequence from={1230} durationInFrames={120}><End/></Sequence>
</AbsoluteFill>;
export const Poster=()=> <AbsoluteFill style={{fontFamily:font}}><Video name="m2-track" start={45}/><Shade strong/><div style={{position:'absolute',left:80,bottom:88,color:C.white}}><Label>CODE IT. FLY IT. COMPLETE THE MISSION.</Label><div style={{fontSize:108,fontWeight:700,letterSpacing:-4,marginTop:22}}>Drone Simulator<span style={{color:C.orange}}>.</span></div></div></AbsoluteFill>;
