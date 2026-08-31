import{getIconStyles as t}from"./0~chunk-5VM5RSS4.js";import{drawRect as e,getNoteRect as i,drawText as n,drawBackgroundRect as s}from"./0~chunk-F27PBJKO.js";import{src_select as r,clear as a,getConfig2 as o,getDiagramTitle as l,setAccTitle as c,getAccTitle as h,src_arc as u,getAccDescription as p,chunk_Y2CYZVJY_name as y,configureSvgSize as d,setDiagramTitle as f,setAccDescription as g}from"./1307.js";var m=function(){var t=y(function(t,e,i,n){for(i=i||{},n=t.length;n--;i[t[n]]=e);return i},"o"),e=[6,8,10,11,12,14,16,17,18],i=[1,9],n=[1,10],s=[1,11],r=[1,12],a=[1,13],o=[1,14],l={trace:y(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:y(function(t,e,i,n,s,r,a){var o=r.length-1;switch(s){case 1:return r[o-1];case 2:case 6:case 7:this.$=[];break;case 3:r[o-1].push(r[o]),this.$=r[o-1];break;case 4:case 5:this.$=r[o];break;case 8:n.setDiagramTitle(r[o].substr(6)),this.$=r[o].substr(6);break;case 9:this.$=r[o].trim(),n.setAccTitle(this.$);break;case 10:case 11:this.$=r[o].trim(),n.setAccDescription(this.$);break;case 12:n.addSection(r[o].substr(8)),this.$=r[o].substr(8);break;case 13:n.addTask(r[o-1],r[o]),this.$="task"}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:i,12:n,14:s,16:r,17:a,18:o},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:15,11:i,12:n,14:s,16:r,17:a,18:o},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,16]},{15:[1,17]},t(e,[2,11]),t(e,[2,12]),{19:[1,18]},t(e,[2,4]),t(e,[2,9]),t(e,[2,10]),t(e,[2,13])],defaultActions:{},parseError:y(function(t,e){if(e.recoverable)this.trace(t);else{var i=Error(t);throw i.hash=e,i}},"parseError"),parse:y(function(t){var e=this,i=[0],n=[],s=[null],r=[],a=this.table,o="",l=0,c=0,h=0,u=r.slice.call(arguments,1),p=Object.create(this.lexer),d={};for(var f in this.yy)Object.prototype.hasOwnProperty.call(this.yy,f)&&(d[f]=this.yy[f]);p.setInput(t,d),d.lexer=p,d.parser=this,void 0===p.yylloc&&(p.yylloc={});var g=p.yylloc;r.push(g);var m=p.options&&p.options.ranges;function x(){var t;return"number"!=typeof(t=n.pop()||p.lex()||1)&&(t instanceof Array&&(t=(n=t).pop()),t=e.symbols_[t]||t),t}"function"==typeof d.parseError?this.parseError=d.parseError:this.parseError=Object.getPrototypeOf(this).parseError,y(function(t){i.length=i.length-2*t,s.length=s.length-t,r.length=r.length-t},"popStack"),y(x,"lex");for(var k,_,b,v,$,w,M,S,T,C={};;){if(b=i[i.length-1],this.defaultActions[b]?v=this.defaultActions[b]:(null==k&&(k=x()),v=a[b]&&a[b][k]),void 0===v||!v.length||!v[0]){var E="";for(w in T=[],a[b])this.terminals_[w]&&w>2&&T.push("'"+this.terminals_[w]+"'");E=p.showPosition?"Parse error on line "+(l+1)+":\n"+p.showPosition()+"\nExpecting "+T.join(", ")+", got '"+(this.terminals_[k]||k)+"'":"Parse error on line "+(l+1)+": Unexpected "+(1==k?"end of input":"'"+(this.terminals_[k]||k)+"'"),this.parseError(E,{text:p.match,token:this.terminals_[k]||k,line:p.yylineno,loc:g,expected:T})}if(v[0]instanceof Array&&v.length>1)throw Error("Parse Error: multiple actions possible at state: "+b+", token: "+k);switch(v[0]){case 1:i.push(k),s.push(p.yytext),r.push(p.yylloc),i.push(v[1]),k=null,_?(k=_,_=null):(c=p.yyleng,o=p.yytext,l=p.yylineno,g=p.yylloc,h>0&&h--);break;case 2:if(M=this.productions_[v[1]][1],C.$=s[s.length-M],C._$={first_line:r[r.length-(M||1)].first_line,last_line:r[r.length-1].last_line,first_column:r[r.length-(M||1)].first_column,last_column:r[r.length-1].last_column},m&&(C._$.range=[r[r.length-(M||1)].range[0],r[r.length-1].range[1]]),void 0!==($=this.performAction.apply(C,[o,c,l,d,v[1],s,r].concat(u))))return $;M&&(i=i.slice(0,-1*M*2),s=s.slice(0,-1*M),r=r.slice(0,-1*M)),i.push(this.productions_[v[1]][0]),s.push(C.$),r.push(C._$),S=a[i[i.length-2]][i[i.length-1]],i.push(S);break;case 3:return!0}}return!0},"parse")};function c(){this.yy={}}return l.lexer={EOF:1,parseError:y(function(t,e){if(this.yy.parser)this.yy.parser.parseError(t,e);else throw Error(t)},"parseError"),setInput:y(function(t,e){return this.yy=e||this.yy||{},this._input=t,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:y(function(){var t=this._input[0];return this.yytext+=t,this.yyleng++,this.offset++,this.match+=t,this.matched+=t,t.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),t},"input"),unput:y(function(t){var e=t.length,i=t.split(/(?:\r\n?|\n)/g);this._input=t+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-e),this.offset-=e;var n=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),i.length-1&&(this.yylineno-=i.length-1);var s=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:i?(i.length===n.length?this.yylloc.first_column:0)+n[n.length-i.length].length-i[0].length:this.yylloc.first_column-e},this.options.ranges&&(this.yylloc.range=[s[0],s[0]+this.yyleng-e]),this.yyleng=this.yytext.length,this},"unput"),more:y(function(){return this._more=!0,this},"more"),reject:y(function(){return this.options.backtrack_lexer?(this._backtrack=!0,this):this.parseError("Lexical error on line "+(this.yylineno+1)+". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"reject"),less:y(function(t){this.unput(this.match.slice(t))},"less"),pastInput:y(function(){var t=this.matched.substr(0,this.matched.length-this.match.length);return(t.length>20?"...":"")+t.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:y(function(){var t=this.match;return t.length<20&&(t+=this._input.substr(0,20-t.length)),(t.substr(0,20)+(t.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:y(function(){var t=this.pastInput(),e=Array(t.length+1).join("-");return t+this.upcomingInput()+"\n"+e+"^"},"showPosition"),test_match:y(function(t,e){var i,n,s;if(this.options.backtrack_lexer&&(s={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(s.yylloc.range=this.yylloc.range.slice(0))),(n=t[0].match(/(?:\r\n?|\n).*/g))&&(this.yylineno+=n.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:n?n[n.length-1].length-n[n.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+t[0].length},this.yytext+=t[0],this.match+=t[0],this.matches=t,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(t[0].length),this.matched+=t[0],i=this.performAction.call(this,this.yy,this,e,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),i)return i;if(this._backtrack)for(var r in s)this[r]=s[r];return!1},"test_match"),next:y(function(){if(this.done)return this.EOF;this._input||(this.done=!0),this._more||(this.yytext="",this.match="");for(var t,e,i,n,s=this._currentRules(),r=0;r<s.length;r++)if((i=this._input.match(this.rules[s[r]]))&&(!e||i[0].length>e[0].length)){if(e=i,n=r,this.options.backtrack_lexer){if(!1!==(t=this.test_match(i,s[r])))return t;if(!this._backtrack)return!1;e=!1;continue}if(!this.options.flex)break}return e?!1!==(t=this.test_match(e,s[n]))&&t:""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:y(function(){var t=this.next();return t||this.lex()},"lex"),begin:y(function(t){this.conditionStack.push(t)},"begin"),popState:y(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:y(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:y(function(t){return(t=this.conditionStack.length-1-Math.abs(t||0))>=0?this.conditionStack[t]:"INITIAL"},"topState"),pushState:y(function(t){this.begin(t)},"pushState"),stateStackSize:y(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:y(function(t,e,i,n){switch(i){case 0:case 1:case 3:case 4:break;case 2:return 10;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}},y(c,"Parser"),c.prototype=l,l.Parser=c,new c}();m.parser=m;var x="",k=[],_=[],b=[],v=y(function(){k.length=0,_.length=0,x="",b.length=0,a()},"clear"),$=y(function(t){x=t,k.push(t)},"addSection"),w=y(function(){return k},"getSections"),M=y(function(){let t=E(),e=0;for(;!t&&e<100;)t=E(),e++;return _.push(...b),_},"getTasks"),S=y(function(){let t=[];return _.forEach(e=>{e.people&&t.push(...e.people)}),[...new Set(t)].sort()},"updateActors"),T=y(function(t,e){let i=e.substr(1).split(":"),n=0,s=[];1===i.length?(n=Number(i[0]),s=[]):(n=Number(i[0]),s=i[1].split(","));let r=s.map(t=>t.trim()),a={section:x,type:x,people:r,task:t,score:n};b.push(a)},"addTask"),C=y(function(t){let e={section:x,type:x,description:t,task:t,classes:[]};_.push(e)},"addTaskOrg"),E=y(function(){let t=y(function(t){return b[t].processed},"compileTask"),e=!0;for(let[i,n]of b.entries())t(i),e=e&&n.processed;return e},"compileTasks"),A=y(function(){return S()},"getActors"),P={getConfig:y(()=>o().journey,"getConfig"),clear:v,setDiagramTitle:f,getDiagramTitle:l,setAccTitle:c,getAccTitle:h,setAccDescription:g,getAccDescription:p,addSection:$,getSections:w,getTasks:M,addTask:T,addTaskOrg:C,getActors:A},I=y(e=>`.label {
    font-family: ${e.fontFamily};
    color: ${e.textColor};
  }
  .mouth {
    stroke: #666;
  }

  line {
    stroke: ${e.textColor}
  }

  .legend {
    fill: ${e.textColor};
    font-family: ${e.fontFamily};
  }

  .label text {
    fill: #333;
  }
  .label {
    color: ${e.textColor}
  }

  .face {
    ${e.faceColor?`fill: ${e.faceColor}`:"fill: #FFF8DC"};
    stroke: #999;
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${e.mainBkg};
    stroke: ${e.nodeBorder};
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${e.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${e.lineColor};
    stroke-width: 1.5px;
  }

  .flowchart-link {
    stroke: ${e.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${e.edgeLabelBackground};
    rect {
      opacity: 0.5;
    }
    text-align: center;
  }

  .cluster rect {
  }

  .cluster text {
    fill: ${e.titleColor};
  }

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${e.fontFamily};
    font-size: 12px;
    background: ${e.tertiaryColor};
    border: 1px solid ${e.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .task-type-0, .section-type-0  {
    ${e.fillType0?`fill: ${e.fillType0}`:""};
  }
  .task-type-1, .section-type-1  {
    ${e.fillType0?`fill: ${e.fillType1}`:""};
  }
  .task-type-2, .section-type-2  {
    ${e.fillType0?`fill: ${e.fillType2}`:""};
  }
  .task-type-3, .section-type-3  {
    ${e.fillType0?`fill: ${e.fillType3}`:""};
  }
  .task-type-4, .section-type-4  {
    ${e.fillType0?`fill: ${e.fillType4}`:""};
  }
  .task-type-5, .section-type-5  {
    ${e.fillType0?`fill: ${e.fillType5}`:""};
  }
  .task-type-6, .section-type-6  {
    ${e.fillType0?`fill: ${e.fillType6}`:""};
  }
  .task-type-7, .section-type-7  {
    ${e.fillType0?`fill: ${e.fillType7}`:""};
  }

  .actor-0 {
    ${e.actor0?`fill: ${e.actor0}`:""};
  }
  .actor-1 {
    ${e.actor1?`fill: ${e.actor1}`:""};
  }
  .actor-2 {
    ${e.actor2?`fill: ${e.actor2}`:""};
  }
  .actor-3 {
    ${e.actor3?`fill: ${e.actor3}`:""};
  }
  .actor-4 {
    ${e.actor4?`fill: ${e.actor4}`:""};
  }
  .actor-5 {
    ${e.actor5?`fill: ${e.actor5}`:""};
  }
  ${t()}
`,"getStyles"),j=y(function(t,i){return e(t,i)},"drawRect"),V=y(function(t,e){let i=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),n=t.append("g");function s(t){let i=u().startAngle(Math.PI/2).endAngle(Math.PI/2*3).innerRadius(7.5).outerRadius(15/2.2);t.append("path").attr("class","mouth").attr("d",i).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}function r(t){let i=u().startAngle(3*Math.PI/2).endAngle(Math.PI/2*5).innerRadius(7.5).outerRadius(15/2.2);t.append("path").attr("class","mouth").attr("d",i).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}function a(t){t.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return n.append("circle").attr("cx",e.cx-5).attr("cy",e.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),n.append("circle").attr("cx",e.cx+5).attr("cy",e.cy-5).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),y(s,"smile"),y(r,"sad"),y(a,"ambivalent"),e.score>3?s(n):e.score<3?r(n):a(n),i},"drawFace"),F=y(function(t,e){let i=t.append("circle");return i.attr("cx",e.cx),i.attr("cy",e.cy),i.attr("class","actor-"+e.pos),i.attr("fill",e.fill),i.attr("stroke",e.stroke),i.attr("r",e.r),void 0!==i.class&&i.attr("class",i.class),void 0!==e.title&&i.append("title").text(e.title),i},"drawCircle"),R=y(function(t,e){return n(t,e)},"drawText"),B=y(function(t,e,n){let s=t.append("g"),r=i();r.x=e.x,r.y=e.y,r.fill=e.fill,r.width=n.width*e.taskCount+n.diagramMarginX*(e.taskCount-1),r.height=n.height,r.class="journey-section section-type-"+e.num,r.rx=3,r.ry=3,j(s,r),L(n)(e.text,s,r.x,r.y,r.width,r.height,{class:"journey-section section-type-"+e.num},n,e.colour)},"drawSection"),N=-1,O=y(function(t,e,n,s){let r=e.x+n.width/2,a=t.append("g");N++,a.append("line").attr("id",s+"-task"+N).attr("x1",r).attr("y1",e.y).attr("x2",r).attr("y2",450).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),V(a,{cx:r,cy:300+(5-e.score)*30,score:e.score});let o=i();o.x=e.x,o.y=e.y,o.fill=e.fill,o.width=n.width,o.height=n.height,o.class="task task-type-"+e.num,o.rx=3,o.ry=3,j(a,o);let l=e.x+14;e.people.forEach(t=>{let i=e.actors[t].color;F(a,{cx:l,cy:e.y,r:7,fill:i,stroke:"#000",title:t,pos:e.actors[t].position}),l+=10}),L(n)(e.task,a,o.x,o.y,o.width,o.height,{class:"task"},n,e.colour)},"drawTask"),L=function(){function t(t,e,i,s,r,a,o,l){n(e.append("text").attr("x",i+r/2).attr("y",s+a/2+5).style("font-color",l).style("text-anchor","middle").text(t),o)}function e(t,e,i,s,r,a,o,l,c){let{taskFontSize:h,taskFontFamily:u}=l,p=t.split(/<br\s*\/?>/gi);for(let t=0;t<p.length;t++){let l=t*h-h*(p.length-1)/2,y=e.append("text").attr("x",i+r/2).attr("y",s).attr("fill",c).style("text-anchor","middle").style("font-size",h).style("font-family",u);y.append("tspan").attr("x",i+r/2).attr("dy",l).text(p[t]),y.attr("y",s+a/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),n(y,o)}}function i(t,i,s,r,a,o,l,c){let h=i.append("switch"),u=h.append("foreignObject").attr("x",s).attr("y",r).attr("width",a).attr("height",o).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");u.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(t),e(t,h,s,r,a,o,l,c),n(u,l)}function n(t,e){for(let i in e)i in e&&t.attr(i,e[i])}return y(t,"byText"),y(e,"byTspan"),y(i,"byFo"),y(n,"_setTextAttrs"),function(n){return"fo"===n.textPlacement?i:"old"===n.textPlacement?t:e}}(),D=y(function(t,e){N=-1,t.append("defs").append("marker").attr("id",e+"-arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),z=y(function(t){Object.keys(t).forEach(function(e){W[e]=t[e]})},"setConf"),K={},Y=0;function U(t){let e=o().journey,i=e.maxLabelWidth;Y=0;let n=60;Object.keys(K).forEach(s=>{let r=K[s].color;F(t,{cx:20,cy:n,r:7,fill:r,stroke:"#000",pos:K[s].position});let a=t.append("text").attr("visibility","hidden").text(s),o=a.node().getBoundingClientRect().width;a.remove();let l=[];if(o<=i)l=[s];else{let e=s.split(" "),n="";a=t.append("text").attr("visibility","hidden"),e.forEach(t=>{let e=n?`${n} ${t}`:t;if(a.text(e),a.node().getBoundingClientRect().width>i){if(n&&l.push(n),n=t,a.text(t),a.node().getBoundingClientRect().width>i){let e="";for(let n of t)e+=n,a.text(e+"-"),a.node().getBoundingClientRect().width>i&&(l.push(e.slice(0,-1)+"-"),e=n);n=e}}else n=e}),n&&l.push(n),a.remove()}l.forEach((i,s)=>{let r=R(t,{x:40,y:n+7+20*s,fill:"#666",text:i,textMargin:e.boxTextMargin??5}).node().getBoundingClientRect().width;r>Y&&r>e.leftMargin-r&&(Y=r)}),n+=Math.max(20,20*l.length)})}y(U,"drawActorLegend");var W=o().journey,q=0,H=y(function(t,e,i,n){let s,a=o(),l=a.journey.titleColor,c=a.journey.titleFontSize,h=a.journey.titleFontFamily,u=a.securityLevel;"sandbox"===u&&(s=r("#i"+e));let p="sandbox"===u?r(s.nodes()[0].contentDocument.body):r("body");X.init();let y=p.select("#"+e);D(y,e);let f=n.db.getTasks(),g=n.db.getDiagramTitle(),m=n.db.getActors();for(let t in K)delete K[t];let x=0;m.forEach(t=>{K[t]={color:W.actorColours[x%W.actorColours.length],position:x},x++}),U(y),q=W.leftMargin+Y,X.insert(0,0,q,50*Object.keys(K).length),J(y,f,0,e);let k=X.getBounds();g&&y.append("text").text(g).attr("x",q).attr("font-size",c).attr("font-weight","bold").attr("y",25).attr("fill",l).attr("font-family",h);let _=k.stopy-k.starty+2*W.diagramMarginY,b=q+k.stopx+2*W.diagramMarginX;d(y,_,b,W.useMaxWidth),y.append("line").attr("x1",q).attr("y1",4*W.height).attr("x2",b-q-4).attr("y2",4*W.height).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#"+e+"-arrowhead)");let v=70*!!g;y.attr("viewBox",`${k.startx} -25 ${b} ${_+v}`),y.attr("preserveAspectRatio","xMinYMin meet"),y.attr("height",_+v+25)},"draw"),X={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:y(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:y(function(t,e,i,n){void 0===t[e]?t[e]=i:t[e]=n(i,t[e])},"updateVal"),updateBounds:y(function(t,e,i,n){let s=o().journey,r=this,a=0;function l(o){return y(function(l){a++;let c=r.sequenceItems.length-a+1;r.updateVal(l,"starty",e-c*s.boxMargin,Math.min),r.updateVal(l,"stopy",n+c*s.boxMargin,Math.max),r.updateVal(X.data,"startx",t-c*s.boxMargin,Math.min),r.updateVal(X.data,"stopx",i+c*s.boxMargin,Math.max),"activation"!==o&&(r.updateVal(l,"startx",t-c*s.boxMargin,Math.min),r.updateVal(l,"stopx",i+c*s.boxMargin,Math.max),r.updateVal(X.data,"starty",e-c*s.boxMargin,Math.min),r.updateVal(X.data,"stopy",n+c*s.boxMargin,Math.max))},"updateItemBounds")}y(l,"updateFn"),this.sequenceItems.forEach(l())},"updateBounds"),insert:y(function(t,e,i,n){let s=Math.min(t,i),r=Math.max(t,i),a=Math.min(e,n),o=Math.max(e,n);this.updateVal(X.data,"startx",s,Math.min),this.updateVal(X.data,"starty",a,Math.min),this.updateVal(X.data,"stopx",r,Math.max),this.updateVal(X.data,"stopy",o,Math.max),this.updateBounds(s,a,r,o)},"insert"),bumpVerticalPos:y(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:y(function(){return this.verticalPos},"getVerticalPos"),getBounds:y(function(){return this.data},"getBounds")},G=W.sectionFills,Z=W.sectionColours,J=y(function(t,e,i,n){let s=o().journey,r="",a=i+(2*s.height+s.diagramMarginY),l=0,c="#CCC",h="black",u=0;for(let[i,o]of e.entries()){if(r!==o.section){c=G[l%G.length],u=l%G.length,h=Z[l%Z.length];let n=0,a=o.section;for(let t=i;t<e.length;t++)if(e[t].section==a)n+=1;else break;B(t,{x:i*s.taskMargin+i*s.width+q,y:50,text:o.section,fill:c,num:u,colour:h,taskCount:n},s),r=o.section,l++}let p=o.people.reduce((t,e)=>(K[e]&&(t[e]=K[e]),t),{});o.x=i*s.taskMargin+i*s.width+q,o.y=a,o.width=s.diagramMarginX,o.height=s.diagramMarginY,o.colour=h,o.fill=c,o.num=u,o.actors=p,O(t,o,s,n),X.insert(o.x,o.y,o.x+o.width+s.taskMargin,450)}},"drawTasks"),Q={setConf:z,draw:H},tt={parser:m,db:P,renderer:Q,styles:I,init:y(t=>{Q.setConf(t.journey),P.clear()},"init")};export{tt as diagram};
//# sourceMappingURL=0~journeyDiagram-EYS64GPL.js.map