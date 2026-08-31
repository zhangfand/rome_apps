import{populateCommonDb as t}from"./0~chunk-JWPE2WC7.js";import{clear as e,getDiagramTitle as a,defaultConfig_default as n,setAccTitle as r,log as i,getConfig as o,selectSvgElement as l,configureSvgSize as c,setDiagramTitle as s,cleanAndMerge as d,getThemeVariables3 as f,getAccTitle as p,getAccDescription as m,chunk_Y2CYZVJY_name as y,setAccDescription as x}from"./1307.js";import{parse as h}from"./0~mermaid-parser.core.js";var $=y(()=>({domains:new Map,transitions:[]}),"createDefaultData"),g=$(),u={getDomains:y(()=>g.domains,"getDomains"),getTransitions:y(()=>g.transitions,"getTransitions"),setDomains:y(t=>{if(t)for(let e of t){let t=e.domain,a=(e.items??[]).map(t=>({label:t.label}));g.domains.set(t,{name:t,items:a})}},"setDomains"),setTransitions:y(t=>{t&&(g.transitions=t.filter(t=>t.from!==t.to||(i.warn(`Cynefin: self-loop transition on domain "${t.from}" is not meaningful and will be skipped.`),!1)).map(t=>({from:t.from,to:t.to,label:t.label||void 0})))},"setTransitions"),getConfig:y(()=>d({...n.cynefin,...o().cynefin}),"getConfig"),clear:y(()=>{e(),g=$()},"clear"),setAccTitle:r,getAccTitle:p,setDiagramTitle:s,getDiagramTitle:a,getAccDescription:m,setAccDescription:x},b=y(e=>{t(e,u),u.setDomains(e.domains),u.setTransitions(e.transitions)},"populate"),w={parse:y(async t=>{let e=await h("cynefin",t);i.debug(e),b(e)},"parse")};function C(t){let e=t+0x6d2b79f5|0;return e=Math.imul(e^e>>>15,1|e),(((e^=e+Math.imul(e^e>>>7,61|e))^e>>>14)>>>0)/0x100000000}function k(t){let e=0;for(let a=0;a<t.length;a++)e=(e<<5)-e+t.charCodeAt(a)|0;return e}function D(t,e){return"number"==typeof t&&Number.isFinite(t)&&0!==t?t:k(e)}function A(t,e,a,n){let r=t/2,i=n??.015*t,o=e/7,l=[];for(let t=0;t<=7;t++){let e=C(a+17*t)*i*2-i;l.push({x:r+e,y:t*o})}let c=`M${l[0].x},${l[0].y}`;for(let t=0;t<l.length-1;t++){let e=l[t],n=l[t+1],r=(e.y+n.y)/2,o=1.5*i*(t%2==0?1:-1)*C(a+31*t+7),s=e.x+o,d=n.x-o;c+=` C${s},${r} ${d},${r} ${n.x},${n.y}`}return c}function S(t,e,a,n){let r=e/2,i=n??.015*e,o=t/7,l=[];for(let t=0;t<=7;t++){let e=C(a+23*t)*i*2-i;l.push({x:t*o,y:r+e})}let c=`M${l[0].x},${l[0].y}`;for(let t=0;t<l.length-1;t++){let e=l[t],n=l[t+1],r=(e.x+n.x)/2,o=1.5*i*(t%2==0?1:-1)*C(a+37*t+11),s=e.y+o,d=n.y-o;c+=` C${r},${s} ${r},${d} ${n.x},${n.y}`}return c}function B(t,e){let a=t/2,n=.5*e,r=.03*t;return`M${a},${n} C${a+r},${n+(e-n)*.2} ${a-1.5*r},${n+(e-n)*.55} ${a+.5*r},${n+(e-n)*.75} C${a-r},${n+(e-n)*.85} ${a+.3*r},${n+(e-n)*.95} ${a},${e}`}function T(t,e,a,n){return`M${t-a},${e} A${a},${n} 0 1,1 ${t+a},${e} A${a},${n} 0 1,1 ${t-a},${e} Z`}y(C,"seededRandom"),y(k,"hashString"),y(D,"resolveSeed"),y(A,"generateFoldPath"),y(S,"generateHorizontalBoundary"),y(B,"generateCliffPath"),y(T,"generateConfusionPath");var _={complex:{model:"Probe → Sense → Respond",practice:"Emergent Practices"},complicated:{model:"Sense → Analyse → Respond",practice:"Good Practices"},clear:{model:"Sense → Categorise → Respond",practice:"Best Practices"},chaotic:{model:"Act → Sense → Respond",practice:"Novel Practices"},confusion:{model:"",practice:"Disorder"}},M=y((t,e)=>{let a=t/2,n=e/2;return{complex:{cx:a/2,cy:n/2,x:0,y:0,w:a,h:n},complicated:{cx:a+a/2,cy:n/2,x:a,y:0,w:a,h:n},chaotic:{cx:a/2,cy:n+n/2,x:0,y:n,w:a,h:n},clear:{cx:a+a/2,cy:n+n/2,x:a,y:n,w:a,h:n},confusion:{cx:a,cy:n,x:.7*a,y:.7*n,w:.6*a,h:.6*n}}},"getDomainLayouts"),z=y(()=>d(f(),o().themeVariables).cynefin,"getCynefinDomainColors"),v=y((t,e,a,n)=>{let r=n.db,o=r.getDomains(),s=r.getTransitions(),d=r.getDiagramTitle(),f=r.getAccTitle(),p=r.getAccDescription(),m=r.getConfig(),y=z();i.debug("Rendering Cynefin diagram");let x=m.width,h=m.height,$=m.padding,g=m.showDomainDescriptions,u=m.boundaryAmplitude,b=x+2*$,w=h+2*$,C={complex:y.complexBg,complicated:y.complicatedBg,clear:y.clearBg,chaotic:y.chaoticBg,confusion:y.confusionBg},k=l(e);c(k,w,b,m.useMaxWidth??!0),k.attr("viewBox",`0 0 ${b} ${w}`),f&&k.append("title").text(f),p&&k.append("desc").text(p);let v=k.append("g").attr("transform",`translate(${$}, ${$})`),P=M(x,h),L=D(m.seed,e),R=v.append("g").attr("class","cynefin-backgrounds"),F=["complex","complicated","chaotic","clear"];for(let t of F){let e=P[t];R.append("rect").attr("class","cynefinDomain").attr("x",e.x).attr("y",e.y).attr("width",e.w).attr("height",e.h).attr("fill",C[t]).attr("fill-opacity",.4).attr("stroke","none")}let H=v.append("g").attr("class","cynefin-boundaries");H.append("path").attr("class","cynefinBoundary").attr("d",A(x,h,L,u)).attr("fill","none"),H.append("path").attr("class","cynefinBoundary").attr("d",S(x,h,L+100,u)).attr("fill","none"),H.append("path").attr("class","cynefinCliff").attr("d",B(x,h)).attr("fill","none");let I=.15*x,E=.15*h;v.append("path").attr("class","cynefinConfusion").attr("d",T(x/2,h/2,I,E)).attr("fill",C.confusion).attr("fill-opacity",.5);let K=v.append("g").attr("class","cynefin-labels");for(let t of F){let e=P[t];K.append("text").attr("class","cynefinDomainLabel").attr("x",e.cx).attr("y",g?e.cy-30:e.cy).attr("text-anchor","middle").attr("dominant-baseline","middle").text(t.charAt(0).toUpperCase()+t.slice(1))}if(K.append("text").attr("class","cynefinDomainLabel").attr("x",x/2).attr("y",g?h/2-10:h/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text("Confusion"),g){let t=v.append("g").attr("class","cynefin-subtitles");for(let e of F){let a=P[e],n=_[e];t.append("text").attr("class","cynefinSubtitle").attr("x",a.cx).attr("y",a.cy-10).attr("text-anchor","middle").attr("dominant-baseline","middle").text(n.model),t.append("text").attr("class","cynefinSubtitle").attr("x",a.cx).attr("y",a.cy+5).attr("text-anchor","middle").attr("dominant-baseline","middle").text(n.practice)}t.append("text").attr("class","cynefinSubtitle").attr("x",x/2).attr("y",h/2+8).attr("text-anchor","middle").attr("dominant-baseline","middle").text(_.confusion.practice)}let N=v.append("g").attr("class","cynefin-items");for(let t of["complex","complicated","chaotic","clear","confusion"]){let e,a=o.get(t);if(!a||0===a.items.length)continue;let n=P[t],r="confusion"===t,i=a.items,l=0;if(r&&a.items.length>3&&(l=a.items.length-3,i=a.items.slice(0,3)),r){let t=g?22:14;e=n.cy+t}else e=n.cy+(g?25:15);if([...i].forEach((a,r)=>{let i=e+30*r,o=N.append("g"),l=o.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",13).attr("text-anchor","middle").attr("dominant-baseline","central").text(a.label),c=7*a.label.length,s=l.node();if(s&&"function"==typeof s.getBBox){let t=s.getBBox();t.width>0&&(c=t.width)}let d=c+20,f=n.cx-d/2;o.attr("transform",`translate(${f}, ${i})`),o.insert("rect","text").attr("class","cynefinItem").attr("x",0).attr("y",0).attr("width",d).attr("height",26).attr("rx",4).attr("ry",4).attr("fill",C[t]).attr("fill-opacity",.95),l.attr("x",d/2).attr("y",13)}),l>0){let a=e+30*i.length,r=`+${l} more`,o=N.append("g"),c=o.append("text").attr("class","cynefinItemText").attr("x",0).attr("y",13).attr("text-anchor","middle").attr("dominant-baseline","central").text(r),s=7*r.length,d=c.node();if(d&&"function"==typeof d.getBBox){let t=d.getBBox();t.width>0&&(s=t.width)}let f=s+20,p=n.cx-f/2;o.attr("transform",`translate(${p}, ${a})`),o.insert("rect","text").attr("class","cynefinItemOverflow").attr("x",0).attr("y",0).attr("width",f).attr("height",26).attr("rx",4).attr("ry",4).attr("fill",C[t]).attr("fill-opacity",.6),c.attr("x",f/2).attr("y",13)}}if(s.length>0){let t=k.select("defs").empty()?k.append("defs"):k.select("defs"),a=`cynefin-arrow-${e}`;t.append("marker").attr("id",a).attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto-start-reverse").append("path").attr("d","M 0 0 L 10 5 L 0 10 z").attr("class","cynefinArrowHead");let n=v.append("g").attr("class","cynefin-arrows");s.forEach(t=>{let e=P[t.from],r=P[t.to];if(!e||!r)return;if(t.from===t.to)return void i.warn(`Cynefin renderer: skipping self-loop on domain "${t.from}"`);let o=e.cx,l=e.cy,c=r.cx,s=r.cy,d=c-o,f=s-l,p=Math.sqrt(d*d+f*f),m=.15*p,y=(o+c)/2+-f/p*m,x=(l+s)/2+d/p*m;n.append("path").attr("class","cynefinArrowLine").attr("d",`M${o},${l} Q${y},${x} ${c},${s}`).attr("fill","none").attr("marker-end",`url(#${a})`),t.label&&n.append("text").attr("class","cynefinArrowLabel").attr("x",y).attr("y",x-6).attr("text-anchor","middle").attr("dominant-baseline","auto").text(t.label)})}d&&v.append("text").attr("class","cynefinTitle").attr("x",x/2).attr("y",-$/2).attr("text-anchor","middle").attr("dominant-baseline","middle").text(d)},"draw"),P=y(()=>d(f(),o().themeVariables).cynefin,"getCynefinTheme"),L={parser:w,db:u,renderer:{draw:v},styles:y(()=>{let t=P();return`
	.cynefinDomain {
		stroke: none;
	}
	.cynefinDomainLabel {
		font-size: ${t.domainFontSize}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	.cynefinSubtitle {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
		font-style: italic;
	}
	.cynefinItem {
		fill-opacity: 0.95;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
	}
	.cynefinItemText {
		font-size: ${t.itemFontSize}px;
		fill: ${t.textColor};
	}
	.cynefinItemOverflow {
		fill-opacity: 0.6;
		stroke: ${t.boundaryColor};
		stroke-width: 1;
		stroke-dasharray: 3 2;
	}
	.cynefinBoundary {
		stroke: ${t.boundaryColor};
		stroke-width: ${t.boundaryWidth};
		stroke-dasharray: 6 3;
	}
	.cynefinCliff {
		stroke: ${t.cliffColor};
		stroke-width: ${t.cliffWidth};
	}
	.cynefinConfusion {
		stroke: ${t.boundaryColor};
		stroke-width: 1.5;
		stroke-dasharray: 4 2;
	}
	.cynefinArrowLine {
		stroke: ${t.arrowColor};
		stroke-width: ${t.arrowWidth};
		fill: none;
	}
	.cynefinArrowHead {
		fill: ${t.arrowColor};
		stroke: none;
	}
	.cynefinArrowLabel {
		font-size: ${t.itemFontSize-1}px;
		fill: ${t.textColor};
	}
	.cynefinTitle {
		font-size: ${t.domainFontSize+2}px;
		font-weight: bold;
		fill: ${t.labelColor};
	}
	`},"styles")};export{L as diagram};
//# sourceMappingURL=0~cynefinDiagram-5FMLGOSQ.js.map