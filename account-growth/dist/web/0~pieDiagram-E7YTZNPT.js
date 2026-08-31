import{populateCommonDb as e}from"./0~chunk-JWPE2WC7.js";import{parseFontSize as t,clear as a,getDiagramTitle as i,getConfig2 as r,defaultConfig_default as l,setAccTitle as o,log as n,src_arc as s,selectSvgElement as d,configureSvgSize as c,setDiagramTitle as p,src_pie as h,cleanAndMerge as g,getAccTitle as u,ordinal as f,getAccDescription as m,chunk_Y2CYZVJY_name as S,setAccDescription as x}from"./1307.js";import{parse as w}from"./0~mermaid-parser.core.js";var $=l.pie,C={sections:new Map,showData:!1,config:$},y=C.sections,v=C.showData,b=structuredClone($),T={getConfig:S(()=>structuredClone(b),"getConfig"),clear:S(()=>{y=new Map,v=C.showData,a()},"clear"),setDiagramTitle:p,getDiagramTitle:i,setAccTitle:o,getAccTitle:u,setAccDescription:x,getAccDescription:m,addSection:S(({label:e,value:t})=>{if(t<0)throw Error(`"${e}" has invalid value: ${t}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);y.has(e)||(y.set(e,t),n.debug(`added new section: ${e}, with value: ${t}`))},"addSection"),getSections:S(()=>y,"getSections"),setShowData:S(e=>{v=e},"setShowData"),getShowData:S(()=>v,"getShowData")},D=S((t,a)=>{e(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),k={parse:S(async e=>{let t=await w("pie",e);n.debug(t),D(t,T)},"parse")},_=S(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),A=S(e=>{let t=[...e.values()].reduce((e,t)=>e+t,0),a=[...e.entries()].map(([e,t])=>({label:e,value:t})).filter(e=>e.value/t*100>=1);return h().value(e=>e.value).sort(null)(a)},"createPieArcs"),M={parser:k,db:T,renderer:{draw:S((e,a,i,l)=>{n.debug("rendering pie chart\n"+e);let o=l.db,p=r(),h=g(o.getConfig(),p.pie),u=d(a),m=u.append("g");m.attr("transform","translate(225,225)");let{themeVariables:S}=p,[x]=t(S.pieOuterStrokeWidth);x??=2;let w=h.legendPosition,$=h.textPosition,C=h.donutHole>0&&h.donutHole<=.9?h.donutHole:0,y=s().innerRadius(185*C).outerRadius(185),v=s().innerRadius(185*$).outerRadius(185*$),b=m.append("g");b.append("circle").attr("cx",0).attr("cy",0).attr("r",185+x/2).attr("class","pieOuterCircle");let T=o.getSections(),D=A(T),k=[S.pie1,S.pie2,S.pie3,S.pie4,S.pie5,S.pie6,S.pie7,S.pie8,S.pie9,S.pie10,S.pie11,S.pie12],_=0;T.forEach(e=>{_+=e});let M=D.filter(e=>"0"!==(e.data.value/_*100).toFixed(0)),R=f(k).domain([...T.keys()]);b.selectAll("mySlices").data(M).enter().append("path").attr("d",y).attr("fill",e=>R(e.data.label)).attr("class",e=>{let t="pieCircle";return"hover"===h.highlightSlice?t+=" highlightedOnHover":h.highlightSlice===e.data.label&&(t+=" highlighted"),t}),b.selectAll("mySlices").data(M).enter().append("text").text(e=>(e.data.value/_*100).toFixed(0)+"%").attr("transform",e=>"translate("+v.centroid(e)+")").style("text-anchor","middle").attr("class","slice");let H=m.append("text").text(o.getDiagramTitle()).attr("x",0).attr("y",-200).attr("class","pieTitleText"),O=[...T.entries()].map(([e,t])=>({label:e,value:t})),z=m.selectAll(".legend").data(O).enter().append("g").attr("class","legend");z.append("rect").attr("width",18).attr("height",18).style("fill",e=>R(e.label)).style("stroke",e=>R(e.label)),z.append("text").attr("x",22).attr("y",14).text(e=>o.getShowData()?`${e.label} [${e.value}]`:e.label);let K=Math.max(...z.selectAll("text").nodes().map(e=>e?.getBoundingClientRect().width??0)),P=450,E=490,F=22*O.length;switch(w){case"center":z.attr("transform",(e,t)=>"translate("+(-K/2-22)+","+(22*t-22*O.length/2)+")");break;case"top":P+=F,z.attr("transform",(e,t)=>`translate(${-K/2-22}, ${22*t-185})`),b.attr("transform",()=>`translate(0, ${F+22})`);break;case"bottom":P+=F,z.attr("transform",(e,t)=>"translate("+(-K/2-22)+","+(22*t- -207)+")");break;case"left":E+=22+K,z.attr("transform",(e,t)=>"translate(-207,"+(22*t-22*O.length/2)+")"),b.attr("transform",()=>`translate(${K+18+4}, 0)`);break;default:E+=22+K,z.attr("transform",(e,t)=>"translate(216,"+(22*t-22*O.length/2)+")")}let N=H.node()?.getBoundingClientRect().width??0,W=Math.min(0,225-N/2),B=Math.max(E,225+N/2)-W;u.attr("viewBox",`${W} 0 ${B} ${P}`),c(u,P,B,h.useMaxWidth)},"draw")},styles:_};export{M as diagram};
//# sourceMappingURL=0~pieDiagram-E7YTZNPT.js.map