import{populateCommonDb as t}from"./0~chunk-JWPE2WC7.js";import{clear as e,getDiagramTitle as a,defaultConfig_default as r,setAccTitle as i,log as n,getConfig as l,selectSvgElement as s,configureSvgSize as o,setDiagramTitle as c,cleanAndMerge as d,getThemeVariables3 as g,getAccTitle as x,getAccDescription as p,chunk_Y2CYZVJY_name as u,setAccDescription as h}from"./1307.js";import{parse as m}from"./0~mermaid-parser.core.js";var $={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},f={axes:[],curves:[],options:$},y=structuredClone(f),v=r.radar,C=u(()=>d({...v,...l().radar}),"getConfig"),w=u(()=>y.axes,"getAxes"),M=u(()=>y.curves,"getCurves"),b=u(()=>y.options,"getOptions"),L=u(t=>{y.axes=t.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),k=u(t=>{y.curves=t.map(t=>({name:t.name,label:t.label??t.name,entries:A(t.entries)}))},"setCurves"),A=u(t=>{if(void 0==t[0].axis)return t.map(t=>t.value);let e=w();if(0===e.length)throw Error("Axes must be populated before curves for reference entries");return e.map(e=>{let a=t.find(t=>t.axis?.$refText===e.name);if(void 0===a)throw Error("Missing entry for axis "+e.label);return a.value})},"computeCurveEntries"),S={getAxes:w,getCurves:M,getOptions:b,setAxes:L,setCurves:k,setOptions:u(t=>{let e=t.reduce((t,e)=>(t[e.name]=e,t),{});y.options={showLegend:e.showLegend?.value??$.showLegend,ticks:e.ticks?.value??$.ticks,max:e.max?.value??$.max,min:e.min?.value??$.min,graticule:e.graticule?.value??$.graticule},y.options.ticks>32&&(n.warn(`Radar diagram ticks (${y.options.ticks}) exceeds maximum allowed (32). Using 32 instead.`),y.options.ticks=32)},"setOptions"),getConfig:C,clear:u(()=>{e(),y=structuredClone(f)},"clear"),setAccTitle:i,getAccTitle:x,setDiagramTitle:c,getDiagramTitle:a,getAccDescription:p,setAccDescription:h},T=u(e=>{t(e,S);let{axes:a,curves:r,options:i}=e;S.setAxes(a),S.setCurves(r),S.setOptions(i)},"populate"),_={parse:u(async t=>{let e=await m("radar",t);n.debug(e),T(e)},"parse")},O=u((t,e,a,r)=>{let i=r.db,n=i.getAxes(),l=i.getCurves(),o=i.getOptions(),c=i.getConfig(),d=i.getDiagramTitle(),g=E(s(e),c),x=o.max??Math.max(...l.map(t=>Math.max(...t.entries))),p=o.min,u=Math.min(c.width,c.height)/2;R(g,n,u,o.ticks,o.graticule),I(g,n,u,c),P(g,n,l,p,x,o.graticule,c),K(g,l,o.showLegend,c),g.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),E=u((t,e)=>{let a=e.width+e.marginLeft+e.marginRight,r=e.height+e.marginTop+e.marginBottom,i={x:e.marginLeft+e.width/2,y:e.marginTop+e.height/2};return o(t,r,a,e.useMaxWidth??!0),t.attr("viewBox",`0 0 ${a} ${r}`).attr("overflow","visible"),t.append("g").attr("transform",`translate(${i.x}, ${i.y})`)},"drawFrame"),R=u((t,e,a,r,i)=>{if("circle"===i)for(let e=0;e<r;e++){let i=a*(e+1)/r;t.append("circle").attr("r",i).attr("class","radarGraticule")}else if("polygon"===i){let i=e.length;for(let n=0;n<r;n++){let l=a*(n+1)/r,s=e.map((t,e)=>{let a=2*e*Math.PI/i-Math.PI/2,r=l*Math.cos(a),n=l*Math.sin(a);return`${r},${n}`}).join(" ");t.append("polygon").attr("points",s).attr("class","radarGraticule")}}},"drawGraticule"),I=u((t,e,a,r)=>{let i=e.length;for(let n=0;n<i;n++){let l=e[n].label,s=2*n*Math.PI/i-Math.PI/2,o=Math.cos(s),c=Math.sin(s);t.append("line").attr("x1",0).attr("y1",0).attr("x2",a*r.axisScaleFactor*o).attr("y2",a*r.axisScaleFactor*c).attr("class","radarAxisLine");let d=o>.01?"start":o<-.01?"end":"middle",g=c>.01?"hanging":c<-.01?"auto":"central";t.append("text").text(l).attr("x",a*r.axisLabelFactor*o+4*o).attr("y",a*r.axisLabelFactor*c+4*c).attr("text-anchor",d).attr("dominant-baseline",g).attr("class","radarAxisLabel")}},"drawAxes");function P(t,e,a,r,i,n,l){let s=e.length,o=Math.min(l.width,l.height)/2;a.forEach((e,a)=>{if(e.entries.length!==s)return;let c=e.entries.map((t,e)=>{let a=2*Math.PI*e/s-Math.PI/2,n=F(t,r,i,o);return{x:n*Math.cos(a),y:n*Math.sin(a)}});"circle"===n?t.append("path").attr("d",z(c,l.curveTension)).attr("class",`radarCurve-${a}`):"polygon"===n&&t.append("polygon").attr("points",c.map(t=>`${t.x},${t.y}`).join(" ")).attr("class",`radarCurve-${a}`)})}function F(t,e,a,r){return r*(Math.min(Math.max(t,e),a)-e)/(a-e)}function z(t,e){let a=t.length,r=`M${t[0].x},${t[0].y}`;for(let i=0;i<a;i++){let n=t[(i-1+a)%a],l=t[i],s=t[(i+1)%a],o=t[(i+2)%a],c={x:l.x+(s.x-n.x)*e,y:l.y+(s.y-n.y)*e},d={x:s.x-(o.x-l.x)*e,y:s.y-(o.y-l.y)*e};r+=` C${c.x},${c.y} ${d.x},${d.y} ${s.x},${s.y}`}return`${r} Z`}function K(t,e,a,r){if(!a)return;let i=(r.width/2+r.marginRight)*3/4,n=-(3*(r.height/2+r.marginTop))/4;e.forEach((e,a)=>{let r=t.append("g").attr("transform",`translate(${i}, ${n+20*a})`);r.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${a}`),r.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(e.label)})}u(P,"drawCurves"),u(F,"relativeRadius"),u(z,"closedRoundCurve"),u(K,"drawLegend");var D=u((t,e)=>{let a="";for(let r=0;r<t.THEME_COLOR_LIMIT;r++){let i=t[`cScale${r}`];a+=`
		.radarCurve-${r} {
			color: ${i};
			fill: ${i};
			fill-opacity: ${e.curveOpacity};
			stroke: ${i};
			stroke-width: ${e.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${i};
			fill-opacity: ${e.curveOpacity};
			stroke: ${i};
		}
		`}return a},"genIndexStyles"),B=u(t=>{let e=d(g(),l().themeVariables),a=d(e.radar,t);return{themeVariables:e,radarOptions:a}},"buildRadarStyleOptions"),G={parser:_,db:S,renderer:{draw:O},styles:u(({radar:t}={})=>{let{themeVariables:e,radarOptions:a}=B(t);return`
	.radarTitle {
		font-size: ${e.fontSize};
		color: ${e.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${a.axisColor};
		stroke-width: ${a.axisStrokeWidth};
	}
	.radarAxisLabel {
		font-size: ${a.axisLabelFontSize}px;
		color: ${a.axisColor};
	}
	.radarGraticule {
		fill: ${a.graticuleColor};
		fill-opacity: ${a.graticuleOpacity};
		stroke: ${a.graticuleColor};
		stroke-width: ${a.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${a.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${D(e,a)}
	`},"styles")};export{G as diagram};
//# sourceMappingURL=0~diagram-UQ7AKVKN.js.map