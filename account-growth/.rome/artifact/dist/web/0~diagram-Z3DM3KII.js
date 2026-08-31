import{populateCommonDb as t}from"./0~chunk-JWPE2WC7.js";import{clear as e,cleanAndMerge as r,getDiagramTitle as a,defaultConfig_default as o,setAccTitle as i,getAccTitle as l,getAccDescription as s,getConfig as n,log as c,selectSvgElement as d,configureSvgSize as p,chunk_Y2CYZVJY_name as h,setDiagramTitle as k,setAccDescription as b}from"./1307.js";import{parse as f}from"./0~mermaid-parser.core.js";var g=o.packet,u=class{constructor(){this.packet=[],this.setAccTitle=i,this.getAccTitle=l,this.setDiagramTitle=k,this.getDiagramTitle=a,this.getAccDescription=s,this.setAccDescription=b}static{h(this,"PacketDB")}getConfig(){let t=r({...g,...n().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){e(),this.packet=[]}},m=h((e,r)=>{t(e,r);let a=-1,o=[],i=1,{bitsPerRow:l}=r.getConfig();for(let{start:t,end:s,bits:n,label:d}of e.blocks){if(void 0!==t&&void 0!==s&&s<t)throw Error(`Packet block ${t} - ${s} is invalid. End must be greater than start.`);if((t??=a+1)!==a+1)throw Error(`Packet block ${t} - ${s??t} is not contiguous. It should start from ${a+1}.`);if(0===n)throw Error(`Packet block ${t} is invalid. Cannot have a zero bit field.`);for(s??=t+(n??1)-1,n??=s-t+1,a=s,c.debug(`Packet block ${t} - ${a} with label ${d}`);o.length<=l+1&&r.getPacket().length<1e4;){let[e,a]=y({start:t,end:s,bits:n,label:d},i,l);if(o.push(e),e.end+1===i*l&&(r.pushWord(o),o=[],i++),!a)break;({start:t,end:s,bits:n,label:d}=a)}}r.pushWord(o)},"populate"),y=h((t,e,r)=>{if(void 0===t.start)throw Error("start should have been set during first phase");if(void 0===t.end)throw Error("end should have been set during first phase");if(t.start>t.end)throw Error(`Block start ${t.start} is greater than block end ${t.end}.`);if(t.end+1<=e*r)return[t,void 0];let a=e*r-1,o=e*r;return[{start:t.start,end:a,label:t.label,bits:a-t.start},{start:o,end:t.end,label:t.label,bits:t.end-o}]},"getNextFittingBlock"),x={parser:{yy:void 0},parse:h(async t=>{let e=await f("packet",t),r=x.parser?.yy;if(!(r instanceof u))throw Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");c.debug(e),m(e,r)},"parse")},$=h((t,e,r,a)=>{let o=a.db,i=o.getConfig(),{rowHeight:l,paddingY:s,bitWidth:n,bitsPerRow:c}=i,h=o.getPacket(),k=o.getDiagramTitle(),b=l+s,f=b*(h.length+1)-(k?0:l),g=n*c+2,u=d(e);for(let[t,e]of(u.attr("viewBox",`0 0 ${g} ${f}`),p(u,f,g,i.useMaxWidth),h.entries()))C(u,e,t,i);u.append("text").text(k).attr("x",g/2).attr("y",f-b/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),C=h((t,e,r,{rowHeight:a,paddingX:o,paddingY:i,bitWidth:l,bitsPerRow:s,showBits:n})=>{let c=t.append("g"),d=r*(a+i)+i;for(let t of e){let e=t.start%s*l+1,r=(t.end-t.start+1)*l-o;if(c.append("rect").attr("x",e).attr("y",d).attr("width",r).attr("height",a).attr("class","packetBlock"),c.append("text").attr("x",e+r/2).attr("y",d+a/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(t.label),!n)continue;let i=t.end===t.start,p=d-2;c.append("text").attr("x",e+(i?r/2:0)).attr("y",p).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",i?"middle":"start").text(t.start),i||c.append("text").attr("x",e+r).attr("y",p).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(t.end)}},"drawWord"),w={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},B={parser:x,get db(){return new u},renderer:{draw:$},styles:h(({packet:t}={})=>{let e=r(w,t);return`
	.packetByte {
		font-size: ${e.byteFontSize};
	}
	.packetByte.start {
		fill: ${e.startByteColor};
	}
	.packetByte.end {
		fill: ${e.endByteColor};
	}
	.packetLabel {
		fill: ${e.labelColor};
		font-size: ${e.labelFontSize};
	}
	.packetTitle {
		fill: ${e.titleColor};
		font-size: ${e.titleFontSize};
	}
	.packetBlock {
		stroke: ${e.blockStrokeColor};
		stroke-width: ${e.blockStrokeWidth};
		fill: ${e.blockFillColor};
	}
	`},"styles")};export{B as diagram};
//# sourceMappingURL=0~diagram-Z3DM3KII.js.map