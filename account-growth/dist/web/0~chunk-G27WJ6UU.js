import{getDiagramElement as t}from"./0~chunk-XXDRQBXY.js";import{setupViewPortForSVG as e}from"./0~chunk-POPQ4Y6H.js";import{common_default as s,getConfig2 as i,getDiagramTitle as r,clear as n,setAccTitle as a,log as o,purify as l,chunk_CKBBP62Z_render as c,setDiagramTitle as h,src_select as d,getAccTitle as u,getAccDescription as p,generateId as y,utils_default as g,chunk_Y2CYZVJY_name as f,setAccDescription as m}from"./1307.js";import{createTooltip as S}from"./0~chunk-F27PBJKO.js";var _=function(){var t=f(function(t,e,s,i){for(s=s||{},i=t.length;i--;s[t[i]]=e);return s},"o"),e=[1,2],s=[1,3],i=[1,4],r=[2,4],n=[1,9],a=[1,11],o=[1,16],l=[1,17],c=[1,18],h=[1,19],d=[1,33],u=[1,20],p=[1,21],y=[1,22],g=[1,23],m=[1,24],S=[1,26],_=[1,27],b=[1,28],k=[1,29],T=[1,30],E=[1,31],C=[1,32],x=[1,35],$=[1,36],D=[1,37],v=[1,38],I=[1,34],A=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],L=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,39,40,41,45,48,51,52,53,54,57],w=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],N={trace:f(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"--\x3e":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,CLICK:38,STRING:39,HREF:40,classDef:41,CLASSDEF_ID:42,CLASSDEF_STYLEOPTS:43,DEFAULT:44,style:45,STYLE_IDS:46,STYLEDEF_STYLEOPTS:47,class:48,CLASSENTITY_IDS:49,STYLECLASS:50,direction_tb:51,direction_bt:52,direction_rl:53,direction_lr:54,eol:55,";":56,EDGE_STATE:57,STYLE_SEPARATOR:58,left_of:59,right_of:60,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"--\x3e",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"CLICK",39:"STRING",40:"HREF",41:"classDef",42:"CLASSDEF_ID",43:"CLASSDEF_STYLEOPTS",44:"DEFAULT",45:"style",46:"STYLE_IDS",47:"STYLEDEF_STYLEOPTS",48:"class",49:"CLASSENTITY_IDS",50:"STYLECLASS",51:"direction_tb",52:"direction_bt",53:"direction_rl",54:"direction_lr",56:";",57:"EDGE_STATE",58:"STYLE_SEPARATOR",59:"left_of",60:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[9,5],[9,5],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[55,1],[55,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:f(function(t,e,s,i,r,n,a){var o=n.length-1;switch(r){case 3:return i.setRootDoc(n[o]),n[o];case 4:this.$=[];break;case 5:"nl"!=n[o]&&(n[o-1].push(n[o]),this.$=n[o-1]);break;case 6:case 7:case 12:this.$=n[o];break;case 8:this.$="nl";break;case 13:let l=n[o-1];l.description=i.trimColon(n[o]),this.$=l;break;case 14:this.$={stmt:"relation",state1:n[o-2],state2:n[o]};break;case 15:let c=i.trimColon(n[o]);this.$={stmt:"relation",state1:n[o-3],state2:n[o-1],description:c};break;case 19:this.$={stmt:"state",id:n[o-3],type:"default",description:"",doc:n[o-1]};break;case 20:var h=n[o],d=n[o-2].trim();if(n[o].match(":")){var u=n[o].split(":");h=u[0],d=[d,u[1]]}this.$={stmt:"state",id:h,type:"default",description:d};break;case 21:this.$={stmt:"state",id:n[o-3],type:"default",description:n[o-5],doc:n[o-1]};break;case 22:this.$={stmt:"state",id:n[o],type:"fork"};break;case 23:this.$={stmt:"state",id:n[o],type:"join"};break;case 24:this.$={stmt:"state",id:n[o],type:"choice"};break;case 25:this.$={stmt:"state",id:i.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:n[o-1].trim(),note:{position:n[o-2].trim(),text:n[o].trim()}};break;case 29:this.$=n[o].trim(),i.setAccTitle(this.$);break;case 30:case 31:this.$=n[o].trim(),i.setAccDescription(this.$);break;case 32:this.$={stmt:"click",id:n[o-3],url:n[o-2],tooltip:n[o-1]};break;case 33:this.$={stmt:"click",id:n[o-3],url:n[o-1],tooltip:""};break;case 34:case 35:this.$={stmt:"classDef",id:n[o-1].trim(),classes:n[o].trim()};break;case 36:this.$={stmt:"style",id:n[o-1].trim(),styleClass:n[o].trim()};break;case 37:this.$={stmt:"applyClass",id:n[o-1].trim(),styleClass:n[o].trim()};break;case 38:i.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 39:i.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 40:i.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 41:i.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 44:case 45:this.$={stmt:"state",id:n[o].trim(),type:"default",description:""};break;case 46:case 47:this.$={stmt:"state",id:n[o-2].trim(),classes:[n[o].trim()],type:"default",description:""}}},"anonymous"),table:[{3:1,4:e,5:s,6:i},{1:[3]},{3:5,4:e,5:s,6:i},{3:6,4:e,5:s,6:i},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,41,45,48,51,52,53,54,57],r,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:n,5:a,8:8,9:10,10:12,11:13,12:14,13:15,16:o,17:l,19:c,22:h,24:d,25:u,26:p,27:y,28:g,29:m,32:25,33:S,35:_,37:b,38:k,41:T,45:E,48:C,51:x,52:$,53:D,54:v,57:I},t(A,[2,5]),{9:39,10:12,11:13,12:14,13:15,16:o,17:l,19:c,22:h,24:d,25:u,26:p,27:y,28:g,29:m,32:25,33:S,35:_,37:b,38:k,41:T,45:E,48:C,51:x,52:$,53:D,54:v,57:I},t(A,[2,7]),t(A,[2,8]),t(A,[2,9]),t(A,[2,10]),t(A,[2,11]),t(A,[2,12],{14:[1,40],15:[1,41]}),t(A,[2,16]),{18:[1,42]},t(A,[2,18],{20:[1,43]}),{23:[1,44]},t(A,[2,22]),t(A,[2,23]),t(A,[2,24]),t(A,[2,25]),{30:45,31:[1,46],59:[1,47],60:[1,48]},t(A,[2,28]),{34:[1,49]},{36:[1,50]},t(A,[2,31]),{13:51,24:d,57:I},{42:[1,52],44:[1,53]},{46:[1,54]},{49:[1,55]},t(L,[2,44],{58:[1,56]}),t(L,[2,45],{58:[1,57]}),t(A,[2,38]),t(A,[2,39]),t(A,[2,40]),t(A,[2,41]),t(A,[2,6]),t(A,[2,13]),{13:58,24:d,57:I},t(A,[2,17]),t(w,r,{7:59}),{24:[1,60]},{24:[1,61]},{23:[1,62]},{24:[2,48]},{24:[2,49]},t(A,[2,29]),t(A,[2,30]),{39:[1,63],40:[1,64]},{43:[1,65]},{43:[1,66]},{47:[1,67]},{50:[1,68]},{24:[1,69]},{24:[1,70]},t(A,[2,14],{14:[1,71]}),{4:n,5:a,8:8,9:10,10:12,11:13,12:14,13:15,16:o,17:l,19:c,21:[1,72],22:h,24:d,25:u,26:p,27:y,28:g,29:m,32:25,33:S,35:_,37:b,38:k,41:T,45:E,48:C,51:x,52:$,53:D,54:v,57:I},t(A,[2,20],{20:[1,73]}),{31:[1,74]},{24:[1,75]},{39:[1,76]},{39:[1,77]},t(A,[2,34]),t(A,[2,35]),t(A,[2,36]),t(A,[2,37]),t(L,[2,46]),t(L,[2,47]),t(A,[2,15]),t(A,[2,19]),t(w,r,{7:78}),t(A,[2,26]),t(A,[2,27]),{5:[1,79]},{5:[1,80]},{4:n,5:a,8:8,9:10,10:12,11:13,12:14,13:15,16:o,17:l,19:c,21:[1,81],22:h,24:d,25:u,26:p,27:y,28:g,29:m,32:25,33:S,35:_,37:b,38:k,41:T,45:E,48:C,51:x,52:$,53:D,54:v,57:I},t(A,[2,32]),t(A,[2,33]),t(A,[2,21])],defaultActions:{5:[2,1],6:[2,2],47:[2,48],48:[2,49]},parseError:f(function(t,e){if(e.recoverable)this.trace(t);else{var s=Error(t);throw s.hash=e,s}},"parseError"),parse:f(function(t){var e=this,s=[0],i=[],r=[null],n=[],a=this.table,o="",l=0,c=0,h=0,d=n.slice.call(arguments,1),u=Object.create(this.lexer),p={};for(var y in this.yy)Object.prototype.hasOwnProperty.call(this.yy,y)&&(p[y]=this.yy[y]);u.setInput(t,p),p.lexer=u,p.parser=this,void 0===u.yylloc&&(u.yylloc={});var g=u.yylloc;n.push(g);var m=u.options&&u.options.ranges;function S(){var t;return"number"!=typeof(t=i.pop()||u.lex()||1)&&(t instanceof Array&&(t=(i=t).pop()),t=e.symbols_[t]||t),t}"function"==typeof p.parseError?this.parseError=p.parseError:this.parseError=Object.getPrototypeOf(this).parseError,f(function(t){s.length=s.length-2*t,r.length=r.length-t,n.length=n.length-t},"popStack"),f(S,"lex");for(var _,b,k,T,E,C,x,$,D,v={};;){if(k=s[s.length-1],this.defaultActions[k]?T=this.defaultActions[k]:(null==_&&(_=S()),T=a[k]&&a[k][_]),void 0===T||!T.length||!T[0]){var I="";for(C in D=[],a[k])this.terminals_[C]&&C>2&&D.push("'"+this.terminals_[C]+"'");I=u.showPosition?"Parse error on line "+(l+1)+":\n"+u.showPosition()+"\nExpecting "+D.join(", ")+", got '"+(this.terminals_[_]||_)+"'":"Parse error on line "+(l+1)+": Unexpected "+(1==_?"end of input":"'"+(this.terminals_[_]||_)+"'"),this.parseError(I,{text:u.match,token:this.terminals_[_]||_,line:u.yylineno,loc:g,expected:D})}if(T[0]instanceof Array&&T.length>1)throw Error("Parse Error: multiple actions possible at state: "+k+", token: "+_);switch(T[0]){case 1:s.push(_),r.push(u.yytext),n.push(u.yylloc),s.push(T[1]),_=null,b?(_=b,b=null):(c=u.yyleng,o=u.yytext,l=u.yylineno,g=u.yylloc,h>0&&h--);break;case 2:if(x=this.productions_[T[1]][1],v.$=r[r.length-x],v._$={first_line:n[n.length-(x||1)].first_line,last_line:n[n.length-1].last_line,first_column:n[n.length-(x||1)].first_column,last_column:n[n.length-1].last_column},m&&(v._$.range=[n[n.length-(x||1)].range[0],n[n.length-1].range[1]]),void 0!==(E=this.performAction.apply(v,[o,c,l,p,T[1],r,n].concat(d))))return E;x&&(s=s.slice(0,-1*x*2),r=r.slice(0,-1*x),n=n.slice(0,-1*x)),s.push(this.productions_[T[1]][0]),r.push(v.$),n.push(v._$),$=a[s[s.length-2]][s[s.length-1]],s.push($);break;case 3:return!0}}return!0},"parse")};function R(){this.yy={}}return N.lexer={EOF:1,parseError:f(function(t,e){if(this.yy.parser)this.yy.parser.parseError(t,e);else throw Error(t)},"parseError"),setInput:f(function(t,e){return this.yy=e||this.yy||{},this._input=t,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:f(function(){var t=this._input[0];return this.yytext+=t,this.yyleng++,this.offset++,this.match+=t,this.matched+=t,t.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),t},"input"),unput:f(function(t){var e=t.length,s=t.split(/(?:\r\n?|\n)/g);this._input=t+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-e),this.offset-=e;var i=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),s.length-1&&(this.yylineno-=s.length-1);var r=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:s?(s.length===i.length?this.yylloc.first_column:0)+i[i.length-s.length].length-s[0].length:this.yylloc.first_column-e},this.options.ranges&&(this.yylloc.range=[r[0],r[0]+this.yyleng-e]),this.yyleng=this.yytext.length,this},"unput"),more:f(function(){return this._more=!0,this},"more"),reject:f(function(){return this.options.backtrack_lexer?(this._backtrack=!0,this):this.parseError("Lexical error on line "+(this.yylineno+1)+". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"reject"),less:f(function(t){this.unput(this.match.slice(t))},"less"),pastInput:f(function(){var t=this.matched.substr(0,this.matched.length-this.match.length);return(t.length>20?"...":"")+t.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:f(function(){var t=this.match;return t.length<20&&(t+=this._input.substr(0,20-t.length)),(t.substr(0,20)+(t.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:f(function(){var t=this.pastInput(),e=Array(t.length+1).join("-");return t+this.upcomingInput()+"\n"+e+"^"},"showPosition"),test_match:f(function(t,e){var s,i,r;if(this.options.backtrack_lexer&&(r={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(r.yylloc.range=this.yylloc.range.slice(0))),(i=t[0].match(/(?:\r\n?|\n).*/g))&&(this.yylineno+=i.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:i?i[i.length-1].length-i[i.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+t[0].length},this.yytext+=t[0],this.match+=t[0],this.matches=t,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(t[0].length),this.matched+=t[0],s=this.performAction.call(this,this.yy,this,e,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),s)return s;if(this._backtrack)for(var n in r)this[n]=r[n];return!1},"test_match"),next:f(function(){if(this.done)return this.EOF;this._input||(this.done=!0),this._more||(this.yytext="",this.match="");for(var t,e,s,i,r=this._currentRules(),n=0;n<r.length;n++)if((s=this._input.match(this.rules[r[n]]))&&(!e||s[0].length>e[0].length)){if(e=s,i=n,this.options.backtrack_lexer){if(!1!==(t=this.test_match(s,r[n])))return t;if(!this._backtrack)return!1;e=!1;continue}if(!this.options.flex)break}return e?!1!==(t=this.test_match(e,r[i]))&&t:""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:f(function(){var t=this.next();return t||this.lex()},"lex"),begin:f(function(t){this.conditionStack.push(t)},"begin"),popState:f(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:f(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:f(function(t){return(t=this.conditionStack.length-1-Math.abs(t||0))>=0?this.conditionStack[t]:"INITIAL"},"topState"),pushState:f(function(t){this.begin(t)},"pushState"),stateStackSize:f(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:f(function(t,e,s,i){function r(){let s=e.yytext.indexOf("%%");if(0===s)return!1;if(s>0){let i=e.yytext.slice(0,s),r=e.yytext.slice(s);r&&t.lexer.unput(r),e.yytext=i}return!0}switch(f(r,"processId"),s){case 0:return 38;case 1:return 40;case 2:return 39;case 3:return 44;case 4:case 43:return 51;case 5:case 44:return 52;case 6:case 45:return 53;case 7:case 46:return 54;case 8:case 78:return 5;case 9:case 10:case 11:case 12:case 57:case 63:break;case 13:case 33:return this.pushState("SCALE"),17;case 14:case 34:return 18;case 15:case 21:case 35:case 50:case 54:this.popState();break;case 16:return this.begin("acc_title"),33;case 17:return this.popState(),"acc_title_value";case 18:return this.begin("acc_descr"),35;case 19:return this.popState(),"acc_descr_value";case 20:this.begin("acc_descr_multiline");break;case 22:return"acc_descr_multiline_value";case 23:return this.pushState("CLASSDEF"),41;case 24:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 25:return this.popState(),this.pushState("CLASSDEFID"),42;case 26:return this.popState(),43;case 27:return this.pushState("CLASS"),48;case 28:return this.popState(),this.pushState("CLASS_STYLE"),49;case 29:return this.popState(),50;case 30:return this.pushState("STYLE"),45;case 31:return this.popState(),this.pushState("STYLEDEF_STYLES"),46;case 32:return this.popState(),47;case 36:this.pushState("STATE");break;case 37:case 40:return this.popState(),e.yytext=e.yytext.slice(0,-8).trim(),25;case 38:case 41:return this.popState(),e.yytext=e.yytext.slice(0,-8).trim(),26;case 39:case 42:return this.popState(),e.yytext=e.yytext.slice(0,-10).trim(),27;case 47:this.pushState("STATE_STRING");break;case 48:return this.pushState("STATE_ID"),"AS";case 49:case 65:if(!r())return;return this.popState(),"ID";case 51:return"STATE_DESCR";case 52:throw Error('Error: State name must be a single word. Found: "'+e.yytext.trim()+'"');case 53:return 19;case 55:return this.popState(),this.pushState("struct"),20;case 56:return this.popState(),21;case 58:return this.begin("NOTE"),29;case 59:return this.popState(),this.pushState("NOTE_ID"),59;case 60:return this.popState(),this.pushState("NOTE_ID"),60;case 61:this.popState(),this.pushState("FLOATING_NOTE");break;case 62:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 64:return"NOTE_TEXT";case 66:if(!r())return;return this.popState(),this.pushState("NOTE_TEXT"),24;case 67:return this.popState(),e.yytext=e.yytext.substr(2).trim(),31;case 68:return this.popState(),e.yytext=e.yytext.slice(0,-8).trim(),31;case 69:case 70:return 6;case 71:return 16;case 72:return 57;case 73:if(!r())return;return 24;case 74:return e.yytext=e.yytext.trim(),14;case 75:return 15;case 76:return 28;case 77:return 58;case 79:return"INVALID"}},"anonymous"),rules:[/^(?:click\b)/i,/^(?:href\b)/i,/^(?:"[^"]*")/i,/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:\w+\s+\w+.*?\{)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?\n\s*end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:(?:[^:\n;]|:[^:\n;])+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[10,11,12],inclusive:!1},struct:{rules:[10,11,12,23,27,30,36,43,44,45,46,56,57,58,72,73,74,75,76,77],inclusive:!1},FLOATING_NOTE_ID:{rules:[65],inclusive:!1},FLOATING_NOTE:{rules:[62,63,64],inclusive:!1},NOTE_TEXT:{rules:[67,68],inclusive:!1},NOTE_ID:{rules:[66],inclusive:!1},NOTE:{rules:[59,60,61],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[32],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[31],inclusive:!1},CLASS_STYLE:{rules:[29],inclusive:!1},CLASS:{rules:[28],inclusive:!1},CLASSDEFID:{rules:[26],inclusive:!1},CLASSDEF:{rules:[24,25],inclusive:!1},acc_descr_multiline:{rules:[21,22],inclusive:!1},acc_descr:{rules:[19],inclusive:!1},acc_title:{rules:[17],inclusive:!1},SCALE:{rules:[14,15,34,35],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[49],inclusive:!1},STATE_STRING:{rules:[50,51],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[10,11,12,37,38,39,40,41,42,47,48,52,53,54,55],inclusive:!1},ID:{rules:[10,11,12],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,9,11,12,13,16,18,20,23,27,30,33,36,55,58,69,70,71,72,73,74,75,77,78,79],inclusive:!0}}},f(R,"Parser"),R.prototype=N,N.Parser=R,new R}();_.parser=_;var b=_,k="TB",T="state",E="root",C="relation",x="default",$="divider",D="fill:none",v="fill: #333",I="markdown",A="normal",L="rect",w="rectWithTitle",N="divider",R="roundedWithTitle",O="statediagram",B=`${O}-state`,F="transition",P=`${F} note-edge`,Y=`${O}-note`,G=`${O}-cluster`,j=`${O}-cluster-alt`,M="parent",U="note",z="----",W=`${z}${U}`,K=`${z}${M}`,H=f((t,e=k)=>{if(!t.doc)return e;let s=e;for(let e of t.doc)"dir"===e.stmt&&(s=e.value);return s},"getDir"),X={getClasses:f(function(t,e){return e.db.getClasses()},"getClasses"),draw:f(async function(s,r,n,a){o.info("REF0:"),o.info("Drawing state diagram (v2)",r);let{securityLevel:l,state:h,layout:d}=i();a.db.extract(a.db.getRootDocV2());let u=a.db.getData(),p=t(r,l);u.type=a.type,u.layoutAlgorithm=d,u.nodeSpacing=h?.nodeSpacing||50,u.rankSpacing=h?.rankSpacing||50,"neo"===i().look?u.markers=["barbNeo"]:u.markers=["barb"],u.diagramId=r,await c(u,p);try{("function"==typeof a.db.getLinks?a.db.getLinks():new Map).forEach((t,e)=>{let s,i="string"==typeof e?e:"string"==typeof e?.id?e.id:"",r=u.nodes.find(t=>t.id===i);if(!i)return void o.warn("⚠️ Invalid or missing stateId from key:",JSON.stringify(e));let n=p.node()?.querySelectorAll("g.node, g.rough-node");if(n?.forEach(t=>{let e=t.textContent?.trim();(t.id===r?.domId||e===i)&&(s=t)}),!s)return void o.warn("⚠️ Could not find node matching text:",i);let a=s.parentNode;if(!a)return void o.warn("⚠️ Node has no parent, cannot wrap:",i);let l=document.createElementNS("http://www.w3.org/2000/svg","a"),c=t.url.replace(/^"+|"+$/g,"");if(l.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",c),l.setAttribute("target","_blank"),t.tooltip){let e=t.tooltip.replace(/^"+|"+$/g,"");l.setAttribute("title",e),s.setAttribute("title",e)}a.replaceChild(l,s),l.appendChild(s),o.info("🔗 Wrapped node in <a> tag for:",i,t.url)})}catch(t){o.error("❌ Error injecting clickable links:",t)}g.insertTitle(p,"statediagramTitleText",h?.titleTopMargin??25,a.db.getDiagramTitle()),e(p,8,O,h?.useMaxWidth??!0)},"draw"),getDir:H},V=new Map,J=0;function q(t="",e=0,s="",i=z){let r=null!==s&&s.length>0?`${i}${s}`:"";return`state-${t}${r}-${e}`}f(q,"stateDomId");var Q=f((t,e,r,n,a,l,c,h)=>{o.trace("items",e),e.forEach(e=>{switch(e.stmt){case T:case x:ti(t,e,r,n,a,l,c,h);break;case C:{ti(t,e.state1,r,n,a,l,c,h),ti(t,e.state2,r,n,a,l,c,h);let o="neo"===c,d={id:"edge"+J,start:e.state1.id,end:e.state2.id,arrowhead:"normal",arrowTypeEnd:o?"arrow_barb_neo":"arrow_barb",style:D,labelStyle:"",label:s.sanitizeText(e.description??"",i()),arrowheadStyle:v,labelpos:"c",labelType:I,thickness:A,classes:F,look:c};a.push(d),J++}}})},"setupDoc"),Z=f((t,e=k)=>{let s=e;if(t.doc)for(let e of t.doc)"dir"===e.stmt&&(s=e.value);return s},"getDir");function tt(t,e,s){if(!e.id||"</join></fork>"===e.id||"</choice>"===e.id)return;e.cssClasses&&(Array.isArray(e.cssCompiledStyles)||(e.cssCompiledStyles=[]),e.cssClasses.split(" ").forEach(t=>{let i=s.get(t);i&&(e.cssCompiledStyles=[...e.cssCompiledStyles??[],...i.styles])}));let i=t.find(t=>t.id===e.id);i?Object.assign(i,e):t.push(e)}function te(t){return t?.classes?.join(" ")??""}function ts(t){return t?.styles??[]}f(tt,"insertOrUpdateNode"),f(te,"getClassesFromDbInfo"),f(ts,"getStylesFromDbInfo");var ti=f((t,e,r,n,a,l,c,h)=>{let d=e.id,u=r.get(d),p=te(u),y=ts(u),g=i();if(o.info("dataFetcher parsedItem",e,u,y),"root"!==d){let i=L;!0===e.start?i="stateStart":!1===e.start&&(i="stateEnd"),e.type!==x&&(i=e.type),V.get(d)||V.set(d,{id:d,shape:i,description:s.sanitizeText(d,g),cssClasses:`${p} ${B}`,cssStyles:y});let r=V.get(d);e.description&&(Array.isArray(r.description)?(r.shape=w,r.description.push(e.description)):r.description?.length&&r.description.length>0?(r.shape=w,r.description===d?r.description=[e.description]:r.description=[r.description,e.description]):(r.shape=L,r.description=e.description),r.description=s.sanitizeTextOrArray(r.description,g)),r.description?.length===1&&r.shape===w&&("group"===r.type?r.shape=R:r.shape=L),!r.type&&e.doc&&(o.info("Setting cluster for XCX",d,Z(e)),r.type="group",r.isGroup=!0,r.dir=Z(e),r.shape=e.type===$?N:R,r.cssClasses=`${r.cssClasses} ${G} ${l?j:""}`);let u={labelStyle:"",shape:r.shape,label:r.description,cssClasses:r.cssClasses,cssCompiledStyles:[],cssStyles:r.cssStyles,id:d,dir:r.dir,domId:q(d,J),type:r.type,isGroup:"group"===r.type,padding:8,rx:10,ry:10,look:c,labelType:"markdown"};if(u.shape===N&&(u.label=""),t&&"root"!==t.id&&(o.trace("Setting node ",d," to be child of its parent ",t.id),u.parentId=t.id),u.centerLabel=!0,e.note){let t={labelStyle:"",shape:"note",label:e.note.text,labelType:"markdown",cssClasses:Y,cssStyles:[],cssCompiledStyles:[],id:d+W+"-"+J,domId:q(d,J,U),type:r.type,isGroup:"group"===r.type,padding:g.flowchart?.padding,look:c,position:e.note.position},s=d+K,i={labelStyle:"",shape:"noteGroup",label:e.note.text,cssClasses:r.cssClasses,cssStyles:[],id:d+K,domId:q(d,J,M),type:"group",isGroup:!0,padding:16,look:c,position:e.note.position};J++,i.id=s,t.parentId=s,tt(n,i,h),tt(n,t,h),tt(n,u,h);let o=d,l=t.id;"left of"===e.note.position&&(o=t.id,l=d),a.push({id:o+"-"+l,start:o,end:l,arrowhead:"none",arrowTypeEnd:"",style:D,labelStyle:"",classes:P,arrowheadStyle:v,labelpos:"c",labelType:I,thickness:A,look:c})}else tt(n,u,h)}e.doc&&(o.trace("Adding nodes children "),Q(e,e.doc,r,n,a,!l,c,h))},"dataFetcher"),tr=f(()=>{V.clear(),J=0},"reset"),tn="start",ta="color",to="fill",tl=f(()=>new Map,"newClassesList"),tc=f(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),th=f(t=>JSON.parse(JSON.stringify(t)),"clone"),td=class{constructor(t){this.version=t,this.nodes=[],this.edges=[],this.rootDoc=[],this.classes=tl(),this.documents={root:tc()},this.currentDocument=this.documents.root,this.startEndCount=0,this.dividerCnt=0,this.links=new Map,this.funs=[],this.getAccTitle=u,this.setAccTitle=a,this.getAccDescription=p,this.setAccDescription=m,this.setDiagramTitle=h,this.getDiagramTitle=r,this.clear(),this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this),this.bindFunctions=this.bindFunctions.bind(this)}static{f(this,"StateDB")}static{this.relationType={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3}}extract(t){for(let e of(this.clear(!0),Array.isArray(t)?t:t.doc))switch(e.stmt){case T:this.addState(e.id.trim(),e.type,e.doc,e.description,e.note);break;case C:this.addRelation(e.state1,e.state2,e.description);break;case"classDef":this.addStyleClass(e.id.trim(),e.classes);break;case"style":this.handleStyleDef(e);break;case"applyClass":this.setCssClass(e.id.trim(),e.styleClass);break;case"click":this.addLink(e.id,e.url,e.tooltip)}let e=this.getStates(),s=i();for(let t of(tr(),ti(void 0,this.getRootDocV2(),e,this.nodes,this.edges,!0,s.look,this.classes),this.nodes))if(Array.isArray(t.label)){if(t.description=t.label.slice(1),t.isGroup&&t.description.length>0)throw Error(`Group nodes can only have label. Remove the additional description for node [${t.id}]`);t.label=t.label[0]}}handleStyleDef(t){let e=t.id.trim().split(","),s=t.styleClass.split(",");for(let t of e){let e=this.getState(t);if(!e){let s=t.trim();this.addState(s),e=this.getState(s)}e&&(e.styles=s.map(t=>t.replace(/;/g,"")?.trim()))}}setRootDoc(t){o.info("Setting root doc",t),this.rootDoc=t,1===this.version?this.extract(t):this.extract(this.getRootDocV2())}docTranslator(t,e,s){if(e.stmt===C){this.docTranslator(t,e.state1,!0),this.docTranslator(t,e.state2,!1);return}if(e.stmt===T&&("[*]"===e.id?(e.id=t.id+(s?"_start":"_end"),e.start=s):e.id=e.id.trim()),e.stmt!==E&&e.stmt!==T||!e.doc)return;let i=[],r=[];for(let t of e.doc)if(t.type===$){let e=th(t);e.doc=th(r),i.push(e),r=[]}else r.push(t);if(i.length>0&&r.length>0){let t={stmt:T,id:y(),type:"divider",doc:th(r)};i.push(th(t)),e.doc=i}e.doc.forEach(t=>this.docTranslator(e,t,!0))}getRootDocV2(){return this.docTranslator({id:E,stmt:E},{id:E,stmt:E,doc:this.rootDoc},!0),{id:E,doc:this.rootDoc}}addState(t,e=x,r,n,a,l,c,h){let d=t?.trim();if(this.currentDocument.states.has(d)){let t=this.currentDocument.states.get(d);if(!t)throw Error(`State not found: ${d}`);t.doc||(t.doc=r),t.type||(t.type=e)}else o.info("Adding state ",d,n),this.currentDocument.states.set(d,{stmt:T,id:d,descriptions:[],type:e,doc:r,note:a,classes:[],styles:[],textStyles:[]});if(n&&(o.info("Setting state description",d,n),(Array.isArray(n)?n:[n]).forEach(t=>this.addDescription(d,t.trim()))),a){let t=this.currentDocument.states.get(d);if(!t)throw Error(`State not found: ${d}`);t.note=a,t.note.text=s.sanitizeText(t.note.text,i())}l&&(o.info("Setting state classes",d,l),(Array.isArray(l)?l:[l]).forEach(t=>this.setCssClass(d,t.trim()))),c&&(o.info("Setting state styles",d,c),(Array.isArray(c)?c:[c]).forEach(t=>this.setStyle(d,t.trim()))),h&&(o.info("Setting state styles",d,c),(Array.isArray(h)?h:[h]).forEach(t=>this.setTextStyle(d,t.trim())))}clear(t){this.nodes=[],this.edges=[],this.funs=[this.setupToolTips.bind(this)],this.documents={root:tc()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=tl(),t||(this.links=new Map,n())}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){o.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}addLink(t,e,s){this.links.set(t,{url:e,tooltip:s}),o.warn("Adding link",t,e,s)}getLinks(){return this.links}startIdIfNeeded(t=""){return"[*]"===t?(this.startEndCount++,`${tn}${this.startEndCount}`):t}startTypeIfNeeded(t="",e=x){return"[*]"===t?tn:e}endIdIfNeeded(t=""){return"[*]"===t?(this.startEndCount++,`end${this.startEndCount}`):t}endTypeIfNeeded(t="",e=x){return"[*]"===t?"end":e}addRelationObjs(t,e,r=""){let n=this.startIdIfNeeded(t.id.trim()),a=this.startTypeIfNeeded(t.id.trim(),t.type),o=this.startIdIfNeeded(e.id.trim()),l=this.startTypeIfNeeded(e.id.trim(),e.type);this.addState(n,a,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(o,l,e.doc,e.description,e.note,e.classes,e.styles,e.textStyles),this.currentDocument.relations.push({id1:n,id2:o,relationTitle:s.sanitizeText(r,i())})}addRelation(t,e,r){if("object"==typeof t&&"object"==typeof e)this.addRelationObjs(t,e,r);else if("string"==typeof t&&"string"==typeof e){let n=this.startIdIfNeeded(t.trim()),a=this.startTypeIfNeeded(t),o=this.endIdIfNeeded(e.trim()),l=this.endTypeIfNeeded(e);this.addState(n,a),this.addState(o,l),this.currentDocument.relations.push({id1:n,id2:o,relationTitle:r?s.sanitizeText(r,i()):void 0})}}addDescription(t,e){let r=this.currentDocument.states.get(t),n=e.startsWith(":")?e.replace(":","").trim():e;r?.descriptions?.push(s.sanitizeText(n,i()))}cleanupLabel(t){return t.startsWith(":")?t.slice(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,`divider-id-${this.dividerCnt}`}addStyleClass(t,e=""){this.classes.has(t)||this.classes.set(t,{id:t,styles:[],textStyles:[]});let s=this.classes.get(t);e&&s&&e.split(",").forEach(t=>{let e=t.replace(/([^;]*);/,"$1").trim();if(RegExp(ta).exec(t)){let t=e.replace(to,"bgFill").replace(ta,to);s.textStyles.push(t)}s.styles.push(e)})}getClasses(){return this.classes}setupToolTips(t){let e=S();d(t).select("svg").selectAll("g.node, g.rough-node").on("mouseover",t=>{let s=d(t.currentTarget),i=s.attr("title");if(null===i)return;let r=t.currentTarget?.getBoundingClientRect();e.transition().duration(200).style("opacity",".9"),e.style("left",window.scrollX+r.left+(r.right-r.left)/2+"px").style("top",window.scrollY+r.bottom+"px"),e.html(l.sanitize(i)),s.classed("hover",!0)}).on("mouseout",t=>{e.transition().duration(500).style("opacity",0),d(t.currentTarget).classed("hover",!1)})}setCssClass(t,e){t.split(",").forEach(t=>{let s=this.getState(t);if(!s){let e=t.trim();this.addState(e),s=this.getState(e)}s?.classes?.push(e)})}setStyle(t,e){this.getState(t)?.styles?.push(e)}setTextStyle(t,e){this.getState(t)?.textStyles?.push(e)}bindFunctions(t){this.funs.forEach(e=>{e(t)})}getDirectionStatement(){return this.rootDoc.find(t=>"dir"===t.stmt)}getDirection(){return this.getDirectionStatement()?.value??"TB"}setDirection(t){let e=this.getDirectionStatement();e?e.value=t:this.rootDoc.unshift({stmt:"dir",value:t})}trimColon(t){return t.startsWith(":")?t.slice(1).trim():t.trim()}getData(){let t=i();return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:H(this.getRootDocV2())}}getConfig(){return i().state}},tu=f(t=>`
defs [id$="-barbEnd"] {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: ${t.strokeWidth||1};
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${t.edgeLabelBackground};
  p {
    background-color: ${t.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${t.edgeLabelBackground};
    fill: ${t.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: ${t.strokeWidth||1}px;
}
[id$="-barbEnd"] {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth||1}px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

[id$="-dependencyStart"], [id$="-dependencyEnd"] {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: ${t.strokeWidth||1};
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}

[data-look="neo"].statediagram-cluster rect {
  fill: ${t.mainBkg};
  stroke: ${t.useGradient?"url("+t.svgId+"-gradient)":t.stateBorder||t.nodeBorder};
  stroke-width: ${t.strokeWidth??1};
}
[data-look="neo"].statediagram-cluster rect.outer {
  rx: ${t.radius}px;
  ry: ${t.radius}px;
  filter: ${t.dropShadow?t.dropShadow.replace("url(#drop-shadow)",`url(${t.svgId}-drop-shadow)`):"none"}
}
`,"getStyles");export{td as StateDB,b as stateDiagram_default,X as stateRenderer_v3_unified_default,tu as styles_default};
//# sourceMappingURL=0~chunk-G27WJ6UU.js.map