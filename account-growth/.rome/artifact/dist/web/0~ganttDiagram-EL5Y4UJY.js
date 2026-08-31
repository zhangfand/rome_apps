import{__webpack_require__ as t,common_default as e,clear as i,getDiagramTitle as s,timeSaturday as n,setAccTitle as r,log as a,setAccDescription as o,timeFormat as c,timeMinute as l,timeTuesday as d,configureSvgSize as u,timeThursday as h,linear_linear as f,setDiagramTitle as m,min_min as y,getAccTitle as k,timeWednesday as p,timeDay as g,timeMonday as v,timeHour as T,second_second as x,getConfig2 as b,timeMonth as $,timeFriday as w,axisTop as _,max_max as D,src_select as S,src_hcl as C,millisecond as M,getAccDescription as E,chunk_Y2CYZVJY_name as Y,utils_default as O,timeSunday as L,time_time as I,axisBottom as A}from"./1307.js";t.add({"./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/advancedFormat.js"(t){t.exports=function(t,e){var i=e.prototype,s=i.format;i.format=function(t){var e=this,i=this.$locale();if(!this.isValid())return s.bind(this)(t);var n=this.$utils(),r=(t||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(t){switch(t){case"Q":return Math.ceil((e.$M+1)/3);case"Do":return i.ordinal(e.$D);case"gggg":return e.weekYear();case"GGGG":return e.isoWeekYear();case"wo":return i.ordinal(e.week(),"W");case"w":case"ww":return n.s(e.week(),"w"===t?1:2,"0");case"W":case"WW":return n.s(e.isoWeek(),"W"===t?1:2,"0");case"k":case"kk":return n.s(String(0===e.$H?24:e.$H),"k"===t?1:2,"0");case"X":return Math.floor(e.$d.getTime()/1e3);case"x":return e.$d.getTime();case"z":return"["+e.offsetName()+"]";case"zzz":return"["+e.offsetName("long")+"]";default:return t}});return s.bind(this)(r)}}},"./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/customParseFormat.js"(t){t.exports=function(){"use strict";var t={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},e=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,i=/\d/,s=/\d\d/,n=/\d\d?/,r=/\d*[^-_:/,()\s\d]+/,a={},o=function(t){return(t*=1)+(t>68?1900:2e3)},c=function(t){return function(e){this[t]=+e}},l=[/[+-]\d\d:?(\d\d)?|Z/,function(t){(this.zone||(this.zone={})).offset=function(t){if(!t||"Z"===t)return 0;var e=t.match(/([+-]|\d\d)/g),i=60*e[1]+(+e[2]||0);return 0===i?0:"+"===e[0]?-i:i}(t)}],d=function(t){var e=a[t];return e&&(e.indexOf?e:e.s.concat(e.f))},u=function(t,e){var i,s=a.meridiem;if(s){for(var n=1;n<=24;n+=1)if(t.indexOf(s(n,0,e))>-1){i=n>12;break}}else i=t===(e?"pm":"PM");return i},h={A:[r,function(t){this.afternoon=u(t,!1)}],a:[r,function(t){this.afternoon=u(t,!0)}],Q:[i,function(t){this.month=3*(t-1)+1}],S:[i,function(t){this.milliseconds=100*t}],SS:[s,function(t){this.milliseconds=10*t}],SSS:[/\d{3}/,function(t){this.milliseconds=+t}],s:[n,c("seconds")],ss:[n,c("seconds")],m:[n,c("minutes")],mm:[n,c("minutes")],H:[n,c("hours")],h:[n,c("hours")],HH:[n,c("hours")],hh:[n,c("hours")],D:[n,c("day")],DD:[s,c("day")],Do:[r,function(t){var e=a.ordinal,i=t.match(/\d+/);if(this.day=i[0],e)for(var s=1;s<=31;s+=1)e(s).replace(/\[|\]/g,"")===t&&(this.day=s)}],w:[n,c("week")],ww:[s,c("week")],M:[n,c("month")],MM:[s,c("month")],MMM:[r,function(t){var e=d("months"),i=(d("monthsShort")||e.map(function(t){return t.slice(0,3)})).indexOf(t)+1;if(i<1)throw Error();this.month=i%12||i}],MMMM:[r,function(t){var e=d("months").indexOf(t)+1;if(e<1)throw Error();this.month=e%12||e}],Y:[/[+-]?\d+/,c("year")],YY:[s,function(t){this.year=o(t)}],YYYY:[/\d{4}/,c("year")],Z:l,ZZ:l};return function(i,s,n){n.p.customParseFormat=!0,i&&i.parseTwoDigitYear&&(o=i.parseTwoDigitYear);var r=s.prototype,c=r.parse;r.parse=function(i){var s=i.date,r=i.utc,o=i.args;this.$u=r;var l=o[1];if("string"==typeof l){var d=!0===o[2],u=!0===o[3],f=o[2];u&&(f=o[2]),a=this.$locale(),!d&&f&&(a=n.Ls[f]),this.$d=function(i,s,n,r){try{if(["x","X"].indexOf(s)>-1)return new Date(("X"===s?1e3:1)*i);var o=(function(i){var s,n;s=i,n=a&&a.formats;for(var r=(i=s.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(e,i,s){var r=s&&s.toUpperCase();return i||n[s]||t[s]||n[r].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(t,e,i){return e||i.slice(1)})})).match(e),o=r.length,c=0;c<o;c+=1){var l=r[c],d=h[l],u=d&&d[0],f=d&&d[1];r[c]=f?{regex:u,parser:f}:l.replace(/^\[|\]$/g,"")}return function(t){for(var e={},i=0,s=0;i<o;i+=1){var n=r[i];if("string"==typeof n)s+=n.length;else{var a=n.regex,c=n.parser,l=t.slice(s),d=a.exec(l)[0];c.call(e,d),t=t.replace(d,"")}}return function(t){var e=t.afternoon;if(void 0!==e){var i=t.hours;e?i<12&&(t.hours+=12):12===i&&(t.hours=0),delete t.afternoon}}(e),e}})(s)(i),c=o.year,l=o.month,d=o.day,u=o.hours,f=o.minutes,m=o.seconds,y=o.milliseconds,k=o.zone,p=o.week,g=new Date,v=d||(c||l?1:g.getDate()),T=c||g.getFullYear(),x=0;c&&!l||(x=l>0?l-1:g.getMonth());var b,$=u||0,w=f||0,_=m||0,D=y||0;return k?new Date(Date.UTC(T,x,v,$,w,_,D+60*k.offset*1e3)):n?new Date(Date.UTC(T,x,v,$,w,_,D)):(b=new Date(T,x,v,$,w,_,D),p&&(b=r(b).week(p).toDate()),b)}catch(t){return new Date("")}}(s,l,r,n),this.init(),f&&!0!==f&&(this.$L=this.locale(f).$L),(d||u)&&s!=this.format(l)&&(this.$d=new Date("")),a={}}else if(l instanceof Array)for(var m=l.length,y=1;y<=m;y+=1){o[1]=l[y-1];var k=n.apply(this,o);if(k.isValid()){this.$d=k.$d,this.$L=k.$L,this.init();break}y===m&&(this.$d=new Date(""))}else c.call(this,i)}}}()},"./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/duration.js"(t){t.exports=function(){"use strict";var t,e,i=/^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/,s=/\[([^\]]+)]|YYYY|YY|Y|M{1,2}|D{1,2}|H{1,2}|m{1,2}|s{1,2}|SSS/g,n={years:31536e6,months:2628e6,days:864e5,hours:36e5,minutes:6e4,seconds:1e3,milliseconds:1,weeks:6048e5},r=function(t){return t instanceof u},a=function(t,e,i){return new u(t,i,e.$l)},o=function(t){return e.p(t)+"s"},c=function(t){return t<0},l=function(t){return c(t)?Math.ceil(t):Math.floor(t)},d=function(t,e){return t?c(t)?{negative:!0,format:""+Math.abs(t)+e}:{negative:!1,format:""+t+e}:{negative:!1,format:""}},u=function(){function c(t,e,s){var r=this;if(this.$d={},this.$l=s,void 0===t&&(this.$ms=0,this.parseFromMilliseconds()),e)return a(t*n[o(e)],this);if("number"==typeof t)return this.$ms=t,this.parseFromMilliseconds(),this;if("object"==typeof t)return Object.keys(t).forEach(function(e){r.$d[o(e)]=t[e]}),this.calMilliseconds(),this;if("string"==typeof t){var c=t.match(i);if(c){var l=c.slice(2).map(function(t){return null!=t?Number(t):0});return this.$d.years=l[0],this.$d.months=l[1],this.$d.weeks=l[2],this.$d.days=l[3],this.$d.hours=l[4],this.$d.minutes=l[5],this.$d.seconds=l[6],this.calMilliseconds(),this}}return this}var u=c.prototype;return u.calMilliseconds=function(){var t=this;this.$ms=Object.keys(this.$d).reduce(function(e,i){return e+(t.$d[i]||0)*n[i]},0)},u.parseFromMilliseconds=function(){var t=this.$ms;this.$d.years=l(t/31536e6),t%=31536e6,this.$d.months=l(t/2628e6),t%=2628e6,this.$d.days=l(t/864e5),t%=864e5,this.$d.hours=l(t/36e5),t%=36e5,this.$d.minutes=l(t/6e4),t%=6e4,this.$d.seconds=l(t/1e3),t%=1e3,this.$d.milliseconds=t},u.toISOString=function(){var t=d(this.$d.years,"Y"),e=d(this.$d.months,"M"),i=+this.$d.days||0;this.$d.weeks&&(i+=7*this.$d.weeks);var s=d(i,"D"),n=d(this.$d.hours,"H"),r=d(this.$d.minutes,"M"),a=this.$d.seconds||0;this.$d.milliseconds&&(a+=this.$d.milliseconds/1e3,a=Math.round(1e3*a)/1e3);var o=d(a,"S"),c=t.negative||e.negative||s.negative||n.negative||r.negative||o.negative,l=n.format||r.format||o.format?"T":"",u=(c?"-":"")+"P"+t.format+e.format+s.format+l+n.format+r.format+o.format;return"P"===u||"-P"===u?"P0D":u},u.toJSON=function(){return this.toISOString()},u.format=function(t){var i={Y:this.$d.years,YY:e.s(this.$d.years,2,"0"),YYYY:e.s(this.$d.years,4,"0"),M:this.$d.months,MM:e.s(this.$d.months,2,"0"),D:this.$d.days,DD:e.s(this.$d.days,2,"0"),H:this.$d.hours,HH:e.s(this.$d.hours,2,"0"),m:this.$d.minutes,mm:e.s(this.$d.minutes,2,"0"),s:this.$d.seconds,ss:e.s(this.$d.seconds,2,"0"),SSS:e.s(this.$d.milliseconds,3,"0")};return(t||"YYYY-MM-DDTHH:mm:ss").replace(s,function(t,e){return e||String(i[t])})},u.as=function(t){return this.$ms/n[o(t)]},u.get=function(t){var e=this.$ms,i=o(t);return"milliseconds"===i?e%=1e3:e="weeks"===i?l(e/n[i]):this.$d[i],e||0},u.add=function(t,e,i){var s;return s=e?t*n[o(e)]:r(t)?t.$ms:a(t,this).$ms,a(this.$ms+s*(i?-1:1),this)},u.subtract=function(t,e){return this.add(t,e,!0)},u.locale=function(t){var e=this.clone();return e.$l=t,e},u.clone=function(){return a(this.$ms,this)},u.humanize=function(e){return t().add(this.$ms,"ms").locale(this.$l).fromNow(!e)},u.valueOf=function(){return this.asMilliseconds()},u.milliseconds=function(){return this.get("milliseconds")},u.asMilliseconds=function(){return this.as("milliseconds")},u.seconds=function(){return this.get("seconds")},u.asSeconds=function(){return this.as("seconds")},u.minutes=function(){return this.get("minutes")},u.asMinutes=function(){return this.as("minutes")},u.hours=function(){return this.get("hours")},u.asHours=function(){return this.as("hours")},u.days=function(){return this.get("days")},u.asDays=function(){return this.as("days")},u.weeks=function(){return this.get("weeks")},u.asWeeks=function(){return this.as("weeks")},u.months=function(){return this.get("months")},u.asMonths=function(){return this.as("months")},u.years=function(){return this.get("years")},u.asYears=function(){return this.as("years")},c}(),h=function(t,e,i){return t.add(e.years()*i,"y").add(e.months()*i,"M").add(e.days()*i,"d").add(e.hours()*i,"h").add(e.minutes()*i,"m").add(e.seconds()*i,"s").add(e.milliseconds()*i,"ms")};return function(i,s,n){t=n,e=n().$utils(),n.duration=function(t,e){return a(t,{$l:n.locale()},e)},n.isDuration=r;var o=s.prototype.add,c=s.prototype.subtract;s.prototype.add=function(t,e){return r(t)?h(this,t,1):o.bind(this)(t,e)},s.prototype.subtract=function(t,e){return r(t)?h(this,t,-1):c.bind(this)(t,e)}}}()},"./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/isoWeek.js"(t){t.exports=function(t,e,i){var s=function(t){return t.add(4-t.isoWeekday(),"day")},n=e.prototype;n.isoWeekYear=function(){return s(this).year()},n.isoWeek=function(t){if(!this.$utils().u(t))return this.add(7*(t-this.isoWeek()),"day");var e,n,r,a=s(this),o=(e=this.isoWeekYear(),r=4-(n=(this.$u?i.utc:i)().year(e).startOf("year")).isoWeekday(),n.isoWeekday()>4&&(r+=7),n.add(r,"day"));return a.diff(o,"week")+1},n.isoWeekday=function(t){return this.$utils().u(t)?this.day()||7:this.day(this.day()%7?t:t-7)};var r=n.startOf;n.startOf=function(t,e){var i=this.$utils(),s=!!i.u(e)||e;return"isoweek"===i.p(t)?s?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):r.bind(this)(t,e)}}}});let F=t("./node_modules/.pnpm/@braintree+sanitize-url@7.1.2/node_modules/@braintree/sanitize-url/dist/index.js"),W=t("./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/dayjs.min.js"),j=t("./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/isoWeek.js"),P=t("./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/customParseFormat.js"),z=t("./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/advancedFormat.js"),N=t("./node_modules/.pnpm/dayjs@1.11.23/node_modules/dayjs/plugin/duration.js");var H,B,R,G=function(){var t=Y(function(t,e,i,s){for(i=i||{},s=t.length;s--;i[t[s]]=e);return i},"o"),e=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],i=[1,26],s=[1,27],n=[1,28],r=[1,29],a=[1,30],o=[1,31],c=[1,32],l=[1,33],d=[1,34],u=[1,9],h=[1,10],f=[1,11],m=[1,12],y=[1,13],k=[1,14],p=[1,15],g=[1,16],v=[1,19],T=[1,20],x=[1,21],b=[1,22],$=[1,23],w=[1,25],_=[1,35],D={trace:Y(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:Y(function(t,e,i,s,n,r,a){var o=r.length-1;switch(n){case 1:return r[o-1];case 2:case 6:case 7:this.$=[];break;case 3:r[o-1].push(r[o]),this.$=r[o-1];break;case 4:case 5:this.$=r[o];break;case 8:s.setWeekday("monday");break;case 9:s.setWeekday("tuesday");break;case 10:s.setWeekday("wednesday");break;case 11:s.setWeekday("thursday");break;case 12:s.setWeekday("friday");break;case 13:s.setWeekday("saturday");break;case 14:s.setWeekday("sunday");break;case 15:s.setWeekend("friday");break;case 16:s.setWeekend("saturday");break;case 17:s.setDateFormat(r[o].substr(11)),this.$=r[o].substr(11);break;case 18:s.enableInclusiveEndDates(),this.$=r[o].substr(18);break;case 19:s.TopAxis(),this.$=r[o].substr(8);break;case 20:s.setAxisFormat(r[o].substr(11)),this.$=r[o].substr(11);break;case 21:s.setTickInterval(r[o].substr(13)),this.$=r[o].substr(13);break;case 22:s.setExcludes(r[o].substr(9)),this.$=r[o].substr(9);break;case 23:s.setIncludes(r[o].substr(9)),this.$=r[o].substr(9);break;case 24:s.setTodayMarker(r[o].substr(12)),this.$=r[o].substr(12);break;case 27:s.setDiagramTitle(r[o].substr(6)),this.$=r[o].substr(6);break;case 28:this.$=r[o].trim(),s.setAccTitle(this.$);break;case 29:case 30:this.$=r[o].trim(),s.setAccDescription(this.$);break;case 31:s.addSection(r[o].substr(8)),this.$=r[o].substr(8);break;case 33:s.addTask(r[o-1],r[o]),this.$="task";break;case 34:this.$=r[o-1],s.setClickEvent(r[o-1],r[o],null);break;case 35:this.$=r[o-2],s.setClickEvent(r[o-2],r[o-1],r[o]);break;case 36:this.$=r[o-2],s.setClickEvent(r[o-2],r[o-1],null),s.setLink(r[o-2],r[o]);break;case 37:this.$=r[o-3],s.setClickEvent(r[o-3],r[o-2],r[o-1]),s.setLink(r[o-3],r[o]);break;case 38:this.$=r[o-2],s.setClickEvent(r[o-2],r[o],null),s.setLink(r[o-2],r[o-1]);break;case 39:this.$=r[o-3],s.setClickEvent(r[o-3],r[o-1],r[o]),s.setLink(r[o-3],r[o-2]);break;case 40:this.$=r[o-1],s.setLink(r[o-1],r[o]);break;case 41:case 47:this.$=r[o-1]+" "+r[o];break;case 42:case 43:case 45:this.$=r[o-2]+" "+r[o-1]+" "+r[o];break;case 44:case 46:this.$=r[o-3]+" "+r[o-2]+" "+r[o-1]+" "+r[o]}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:i,13:s,14:n,15:r,16:a,17:o,18:c,19:18,20:l,21:d,22:u,23:h,24:f,25:m,26:y,27:k,28:p,29:g,30:v,31:T,33:x,35:b,36:$,37:24,38:w,40:_},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:36,11:17,12:i,13:s,14:n,15:r,16:a,17:o,18:c,19:18,20:l,21:d,22:u,23:h,24:f,25:m,26:y,27:k,28:p,29:g,30:v,31:T,33:x,35:b,36:$,37:24,38:w,40:_},t(e,[2,5]),t(e,[2,6]),t(e,[2,17]),t(e,[2,18]),t(e,[2,19]),t(e,[2,20]),t(e,[2,21]),t(e,[2,22]),t(e,[2,23]),t(e,[2,24]),t(e,[2,25]),t(e,[2,26]),t(e,[2,27]),{32:[1,37]},{34:[1,38]},t(e,[2,30]),t(e,[2,31]),t(e,[2,32]),{39:[1,39]},t(e,[2,8]),t(e,[2,9]),t(e,[2,10]),t(e,[2,11]),t(e,[2,12]),t(e,[2,13]),t(e,[2,14]),t(e,[2,15]),t(e,[2,16]),{41:[1,40],43:[1,41]},t(e,[2,4]),t(e,[2,28]),t(e,[2,29]),t(e,[2,33]),t(e,[2,34],{42:[1,42],43:[1,43]}),t(e,[2,40],{41:[1,44]}),t(e,[2,35],{43:[1,45]}),t(e,[2,36]),t(e,[2,38],{42:[1,46]}),t(e,[2,37]),t(e,[2,39])],defaultActions:{},parseError:Y(function(t,e){if(e.recoverable)this.trace(t);else{var i=Error(t);throw i.hash=e,i}},"parseError"),parse:Y(function(t){var e=this,i=[0],s=[],n=[null],r=[],a=this.table,o="",c=0,l=0,d=0,u=r.slice.call(arguments,1),h=Object.create(this.lexer),f={};for(var m in this.yy)Object.prototype.hasOwnProperty.call(this.yy,m)&&(f[m]=this.yy[m]);h.setInput(t,f),f.lexer=h,f.parser=this,void 0===h.yylloc&&(h.yylloc={});var y=h.yylloc;r.push(y);var k=h.options&&h.options.ranges;function p(){var t;return"number"!=typeof(t=s.pop()||h.lex()||1)&&(t instanceof Array&&(t=(s=t).pop()),t=e.symbols_[t]||t),t}"function"==typeof f.parseError?this.parseError=f.parseError:this.parseError=Object.getPrototypeOf(this).parseError,Y(function(t){i.length=i.length-2*t,n.length=n.length-t,r.length=r.length-t},"popStack"),Y(p,"lex");for(var g,v,T,x,b,$,w,_,D,S={};;){if(T=i[i.length-1],this.defaultActions[T]?x=this.defaultActions[T]:(null==g&&(g=p()),x=a[T]&&a[T][g]),void 0===x||!x.length||!x[0]){var C="";for($ in D=[],a[T])this.terminals_[$]&&$>2&&D.push("'"+this.terminals_[$]+"'");C=h.showPosition?"Parse error on line "+(c+1)+":\n"+h.showPosition()+"\nExpecting "+D.join(", ")+", got '"+(this.terminals_[g]||g)+"'":"Parse error on line "+(c+1)+": Unexpected "+(1==g?"end of input":"'"+(this.terminals_[g]||g)+"'"),this.parseError(C,{text:h.match,token:this.terminals_[g]||g,line:h.yylineno,loc:y,expected:D})}if(x[0]instanceof Array&&x.length>1)throw Error("Parse Error: multiple actions possible at state: "+T+", token: "+g);switch(x[0]){case 1:i.push(g),n.push(h.yytext),r.push(h.yylloc),i.push(x[1]),g=null,v?(g=v,v=null):(l=h.yyleng,o=h.yytext,c=h.yylineno,y=h.yylloc,d>0&&d--);break;case 2:if(w=this.productions_[x[1]][1],S.$=n[n.length-w],S._$={first_line:r[r.length-(w||1)].first_line,last_line:r[r.length-1].last_line,first_column:r[r.length-(w||1)].first_column,last_column:r[r.length-1].last_column},k&&(S._$.range=[r[r.length-(w||1)].range[0],r[r.length-1].range[1]]),void 0!==(b=this.performAction.apply(S,[o,l,c,f,x[1],n,r].concat(u))))return b;w&&(i=i.slice(0,-1*w*2),n=n.slice(0,-1*w),r=r.slice(0,-1*w)),i.push(this.productions_[x[1]][0]),n.push(S.$),r.push(S._$),_=a[i[i.length-2]][i[i.length-1]],i.push(_);break;case 3:return!0}}return!0},"parse")};function S(){this.yy={}}return D.lexer={EOF:1,parseError:Y(function(t,e){if(this.yy.parser)this.yy.parser.parseError(t,e);else throw Error(t)},"parseError"),setInput:Y(function(t,e){return this.yy=e||this.yy||{},this._input=t,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:Y(function(){var t=this._input[0];return this.yytext+=t,this.yyleng++,this.offset++,this.match+=t,this.matched+=t,t.match(/(?:\r\n?|\n).*/g)?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),t},"input"),unput:Y(function(t){var e=t.length,i=t.split(/(?:\r\n?|\n)/g);this._input=t+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-e),this.offset-=e;var s=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),i.length-1&&(this.yylineno-=i.length-1);var n=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:i?(i.length===s.length?this.yylloc.first_column:0)+s[s.length-i.length].length-i[0].length:this.yylloc.first_column-e},this.options.ranges&&(this.yylloc.range=[n[0],n[0]+this.yyleng-e]),this.yyleng=this.yytext.length,this},"unput"),more:Y(function(){return this._more=!0,this},"more"),reject:Y(function(){return this.options.backtrack_lexer?(this._backtrack=!0,this):this.parseError("Lexical error on line "+(this.yylineno+1)+". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"reject"),less:Y(function(t){this.unput(this.match.slice(t))},"less"),pastInput:Y(function(){var t=this.matched.substr(0,this.matched.length-this.match.length);return(t.length>20?"...":"")+t.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:Y(function(){var t=this.match;return t.length<20&&(t+=this._input.substr(0,20-t.length)),(t.substr(0,20)+(t.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:Y(function(){var t=this.pastInput(),e=Array(t.length+1).join("-");return t+this.upcomingInput()+"\n"+e+"^"},"showPosition"),test_match:Y(function(t,e){var i,s,n;if(this.options.backtrack_lexer&&(n={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(n.yylloc.range=this.yylloc.range.slice(0))),(s=t[0].match(/(?:\r\n?|\n).*/g))&&(this.yylineno+=s.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:s?s[s.length-1].length-s[s.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+t[0].length},this.yytext+=t[0],this.match+=t[0],this.matches=t,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(t[0].length),this.matched+=t[0],i=this.performAction.call(this,this.yy,this,e,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),i)return i;if(this._backtrack)for(var r in n)this[r]=n[r];return!1},"test_match"),next:Y(function(){if(this.done)return this.EOF;this._input||(this.done=!0),this._more||(this.yytext="",this.match="");for(var t,e,i,s,n=this._currentRules(),r=0;r<n.length;r++)if((i=this._input.match(this.rules[n[r]]))&&(!e||i[0].length>e[0].length)){if(e=i,s=r,this.options.backtrack_lexer){if(!1!==(t=this.test_match(i,n[r])))return t;if(!this._backtrack)return!1;e=!1;continue}if(!this.options.flex)break}return e?!1!==(t=this.test_match(e,n[s]))&&t:""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:Y(function(){var t=this.next();return t||this.lex()},"lex"),begin:Y(function(t){this.conditionStack.push(t)},"begin"),popState:Y(function(){return this.conditionStack.length-1>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:Y(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:Y(function(t){return(t=this.conditionStack.length-1-Math.abs(t||0))>=0?this.conditionStack[t]:"INITIAL"},"topState"),pushState:Y(function(t){this.begin(t)},"pushState"),stateStackSize:Y(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:Y(function(t,e,i,s){switch(i){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:case 15:case 18:case 21:case 24:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:case 9:case 10:case 12:case 13:break;case 11:return 10;case 14:this.begin("href");break;case 16:return 43;case 17:this.begin("callbackname");break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 22:return 42;case 23:this.begin("click");break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}},Y(S,"Parser"),S.prototype=D,D.Parser=S,new S}();G.parser=G,W.extend(j),W.extend(P),W.extend(z);var V={friday:5,saturday:6},Z="",U="",q=void 0,X="",Q=[],J=[],K=new Map,tt=[],te=[],ti="",ts="",tn=["active","done","crit","milestone","vert"],tr=[],ta="",to=!1,tc=!1,tl="sunday",td="saturday",tu=0,th=Y(function(){tt=[],te=[],ti="",tr=[],tV=0,H=void 0,B=void 0,tX=[],Z="",U="",ts="",q=void 0,X="",Q=[],J=[],to=!1,tc=!1,tu=0,K=new Map,ta="",i(),tl="sunday",td="saturday"},"clear"),tf=Y(function(t){ta=t},"setDiagramId"),tm=Y(function(t){U=t},"setAxisFormat"),ty=Y(function(){return U},"getAxisFormat"),tk=Y(function(t){q=t},"setTickInterval"),tp=Y(function(){return q},"getTickInterval"),tg=Y(function(t){X=t},"setTodayMarker"),tv=Y(function(){return X},"getTodayMarker"),tT=Y(function(t){Z=t},"setDateFormat"),tx=Y(function(){to=!0},"enableInclusiveEndDates"),tb=Y(function(){return to},"endDatesAreInclusive"),t$=Y(function(){tc=!0},"enableTopAxis"),tw=Y(function(){return tc},"topAxisEnabled"),t_=Y(function(t){ts=t},"setDisplayMode"),tD=Y(function(){return ts},"getDisplayMode"),tS=Y(function(){return Z},"getDateFormat"),tC=Y((t,e)=>[...new Set([...t,...e.toLowerCase().split(/[\s,]+/).filter(t=>""!==t)])],"mergeTokens"),tM=Y(function(t){Q=tC(Q,t)},"setIncludes"),tE=Y(function(){return Q},"getIncludes"),tY=Y(function(t){J=tC(J,t)},"setExcludes"),tO=Y(function(){return J},"getExcludes"),tL=Y(function(){return K},"getLinks"),tI=Y(function(t){ti=t,tt.push(t)},"addSection"),tA=Y(function(){return tt},"getSections"),tF=Y(function(){let t=t0(),e=0;for(;!t&&e<10;)t=t0(),e++;return te=tX},"getTasks"),tW=Y(function(t,e,i,s){let n=t.format(e.trim()),r=t.format("YYYY-MM-DD");return!(s.includes(n)||s.includes(r))&&(!!(i.includes("weekends")&&(t.isoWeekday()===V[td]||t.isoWeekday()===V[td]+1)||i.includes(t.format("dddd").toLowerCase()))||i.includes(n)||i.includes(r))},"isInvalidDate"),tj=Y(function(t){tl=t},"setWeekday"),tP=Y(function(){return tl},"getWeekday"),tz=Y(function(t){td=t},"setWeekend"),tN=Y(function(t,e,i,s){let n;if(!i.length||t.manualEndTime)return;let[r,a]=tH(n=(n=t.startTime instanceof Date?W(t.startTime):W(t.startTime,e,!0)).add(1,"d"),t.endTime instanceof Date?W(t.endTime):W(t.endTime,e,!0),e,i,s);t.endTime=r.toDate(),t.renderEndTime=a},"checkTaskDates"),tH=Y(function(t,e,i,s,n){let r=!1,a=null,o=e.add(1e4,"d");for(;t<=e;){if(r||(a=e.toDate()),(r=tW(t,i,s,n))&&(e=e.add(1,"d"))>o)throw Error("Failed to find a valid date that was not excluded by `excludes` after 10,000 iterations.");t=t.add(1,"d")}return[e,a]},"fixTaskDates"),tB=Y(function(t,e,i){if(i=i.trim(),Y(t=>{let e=t.trim();return"x"===e||"X"===e},"isTimestampFormat")(e)&&/^\d+$/.test(i))return new Date(Number(i));let s=/^after\s+(?<ids>[\d\w- ]+)/.exec(i);if(null!==s){let t=null;for(let e of s.groups.ids.split(" ")){let i=tK(e);void 0!==i&&(!t||i.endTime>t.endTime)&&(t=i)}if(t)return t.endTime;let e=new Date;return e.setHours(0,0,0,0),e}let n=W(i,e.trim(),!0);if(n.isValid())return n.toDate();{a.debug("Invalid date:"+i),a.debug("With date format:"+e.trim());let t=new Date(i);if(void 0===t||isNaN(t.getTime())||-1e4>t.getFullYear()||t.getFullYear()>1e4)throw Error("Invalid date:"+i);return t}},"getStartDate"),tR=Y(function(t){let e=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(t.trim());return null!==e?[Number.parseFloat(e[1]),e[2]]:[NaN,"ms"]},"parseDuration"),tG=Y(function(t,e,i,s=!1){i=i.trim();let n=/^until\s+(?<ids>[\d\w- ]+)/.exec(i);if(null!==n){let t=null;for(let e of n.groups.ids.split(" ")){let i=tK(e);void 0!==i&&(!t||i.startTime<t.startTime)&&(t=i)}if(t)return t.startTime;let e=new Date;return e.setHours(0,0,0,0),e}let r=W(i,e.trim(),!0);if(r.isValid())return s&&(r=r.add(1,"d")),r.toDate();let a=W(t),[o,c]=tR(i);if(!Number.isNaN(o)){let t=a.add(o,c);t.isValid()&&(a=t)}return a.toDate()},"getEndDate"),tV=0,tZ=Y(function(t){return void 0===t?"task"+(tV+=1):t},"parseId"),tU=Y(function(t,e){let i=(":"===e.substr(0,1)?e.substr(1,e.length):e).split(","),s={};t7(i,s,tn);for(let t=0;t<i.length;t++)i[t]=i[t].trim();let n="";switch(i.length){case 1:s.id=tZ(),s.startTime=t.endTime,n=i[0];break;case 2:s.id=tZ(),s.startTime=tB(void 0,Z,i[0]),n=i[1];break;case 3:s.id=tZ(i[0]),s.startTime=tB(void 0,Z,i[1]),n=i[2]}return n&&(s.endTime=tG(s.startTime,Z,n,to),s.manualEndTime=W(n,"YYYY-MM-DD",!0).isValid(),tN(s,Z,J,Q)),s},"compileData"),tq=Y(function(t,e){let i=(":"===e.substr(0,1)?e.substr(1,e.length):e).split(","),s={};t7(i,s,tn);for(let t=0;t<i.length;t++)i[t]=i[t].trim();switch(i.length){case 1:s.id=tZ(),s.startTime={type:"prevTaskEnd",id:t},s.endTime={data:i[0]};break;case 2:s.id=tZ(),s.startTime={type:"getStartDate",startData:i[0]},s.endTime={data:i[1]};break;case 3:s.id=tZ(i[0]),s.startTime={type:"getStartDate",startData:i[1]},s.endTime={data:i[2]}}return s},"parseData"),tX=[],tQ={},tJ=Y(function(t,e){let i={section:ti,type:ti,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:e},task:t,classes:[]},s=tq(B,e);i.raw.startTime=s.startTime,i.raw.endTime=s.endTime,i.id=s.id,i.prevTaskId=B,i.active=s.active,i.done=s.done,i.crit=s.crit,i.milestone=s.milestone,i.vert=s.vert,i.vert?i.order=-1:(i.order=tu,tu++);let n=tX.push(i);B=i.id,tQ[i.id]=n-1},"addTask"),tK=Y(function(t){return tX[tQ[t]]},"findTaskById"),t1=Y(function(t,e){let i={section:ti,type:ti,description:t,task:t,classes:[]},s=tU(H,e);i.startTime=s.startTime,i.endTime=s.endTime,i.id=s.id,i.active=s.active,i.done=s.done,i.crit=s.crit,i.milestone=s.milestone,i.vert=s.vert,H=i,te.push(i)},"addTaskOrg"),t0=Y(function(){let t=Y(function(t){let e=tX[t],i="";switch(tX[t].raw.startTime.type){case"prevTaskEnd":{let t=tK(e.prevTaskId);e.startTime=t.endTime;break}case"getStartDate":(i=tB(void 0,Z,tX[t].raw.startTime.startData))&&(tX[t].startTime=i)}return tX[t].startTime&&(tX[t].endTime=tG(tX[t].startTime,Z,tX[t].raw.endTime.data,to),tX[t].endTime&&(tX[t].processed=!0,tX[t].manualEndTime=W(tX[t].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),tN(tX[t],Z,J,Q))),tX[t].processed},"compileTask"),e=!0;for(let[i,s]of tX.entries())t(i),e=e&&s.processed;return e},"compileTasks"),t2=Y(function(t,e){let i=e;"loose"!==b().securityLevel&&(i=(0,F.J)(e)),t.split(",").forEach(function(t){void 0!==tK(t)&&(t5(t,()=>{window.open(i,"_self")}),K.set(t,i))}),t3(t,"clickable")},"setLink"),t3=Y(function(t,e){t.split(",").forEach(function(t){let i=tK(t);void 0!==i&&i.classes.push(e)})},"setClass"),t4=Y(function(t,e,i){if("loose"!==b().securityLevel||void 0===e)return;let s=[];if("string"==typeof i){s=i.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let t=0;t<s.length;t++){let e=s[t].trim();e.startsWith('"')&&e.endsWith('"')&&(e=e.substr(1,e.length-2)),s[t]=e}}0===s.length&&s.push(t),void 0!==tK(t)&&t5(t,()=>{O.runFunc(e,...s)})},"setClickFun"),t5=Y(function(t,e){tr.push(function(){let i=ta?`${ta}-${t}`:t,s=document.querySelector(`[id="${i}"]`);null!==s&&s.addEventListener("click",function(){e()})},function(){let i=ta?`${ta}-${t}`:t,s=document.querySelector(`[id="${i}-text"]`);null!==s&&s.addEventListener("click",function(){e()})})},"pushFun"),t6=Y(function(t,e,i){t.split(",").forEach(function(t){t4(t,e,i)}),t3(t,"clickable")},"setClickEvent"),t9=Y(function(t){tr.forEach(function(e){e(t)})},"bindFunctions"),t8={getConfig:Y(()=>b().gantt,"getConfig"),clear:th,setDateFormat:tT,getDateFormat:tS,enableInclusiveEndDates:tx,endDatesAreInclusive:tb,enableTopAxis:t$,topAxisEnabled:tw,setAxisFormat:tm,getAxisFormat:ty,setTickInterval:tk,getTickInterval:tp,setTodayMarker:tg,getTodayMarker:tv,setAccTitle:r,getAccTitle:k,setDiagramTitle:m,getDiagramTitle:s,setDiagramId:tf,setDisplayMode:t_,getDisplayMode:tD,setAccDescription:o,getAccDescription:E,addSection:tI,getSections:tA,getTasks:tF,addTask:tJ,findTaskById:tK,addTaskOrg:t1,setIncludes:tM,getIncludes:tE,setExcludes:tY,getExcludes:tO,setClickEvent:t6,setLink:t2,getLinks:tL,bindFunctions:t9,parseDuration:tR,isInvalidDate:tW,setWeekday:tj,getWeekday:tP,setWeekend:tz};function t7(t,e,i){let s=!0;for(;s;)s=!1,i.forEach(function(i){let n=RegExp("^\\s*"+i+"\\s*$");t[0].match(n)&&(e[i]=!0,t.shift(1),s=!0)})}Y(t7,"getTaskTags"),W.extend(N);var et=Y(function(){a.debug("Something is calling, setConf, remove the call")},"setConf"),ee={monday:v,tuesday:d,wednesday:p,thursday:h,friday:w,saturday:n,sunday:L},ei=Y((t,e)=>{let i=[...t].map(()=>-1/0),s=[...t].sort((t,e)=>t.startTime-e.startTime||t.order-e.order),n=0;for(let t of s)for(let s=0;s<i.length;s++)if(t.startTime>=i[s]){i[s]=t.endTime,t.order=s+e,s>n&&(n=s);break}return n},"getMaxIntersections"),es={parser:G,db:t8,renderer:{setConf:et,draw:Y(function(t,i,s,n){let r,o=b().gantt;n.db.setDiagramId(i);let d=b().securityLevel;"sandbox"===d&&(r=S("#i"+i));let h="sandbox"===d?S(r.nodes()[0].contentDocument.body):S("body"),m="sandbox"===d?r.nodes()[0].contentDocument:document,k=m.getElementById(i);void 0===(R=k.parentElement.offsetWidth)&&(R=1200),void 0!==o.useWidth&&(R=o.useWidth);let p=n.db.getTasks(),v=p.filter(t=>!t.vert),w=[];for(let t of v)w.push(t.type);w=Z(w);let E={},O=2*o.topPadding;if("compact"===n.db.getDisplayMode()||"compact"===o.displayMode){let t={};for(let e of v)void 0===t[e.section]?t[e.section]=[e]:t[e.section].push(e);let e=0;for(let i of Object.keys(t)){let s=ei(t[i],e)+1;e+=s,O+=s*(o.barHeight+o.barGap),E[i]=s}}else for(let t of(O+=v.length*(o.barHeight+o.barGap),w))E[t]=v.filter(e=>e.type===t).length;k.setAttribute("viewBox","0 0 "+R+" "+O);let L=h.select(`[id="${i}"]`),F=I().domain([y(p,function(t){return t.startTime}),D(p,function(t){return t.endTime})]).rangeRound([0,R-o.leftPadding-o.rightPadding]);function j(t,e){let i=t.startTime,s=e.startTime,n=0;return i>s?n=1:i<s&&(n=-1),n}function P(t,e,i){let s=o.barHeight,r=s+o.barGap,a=o.topPadding,c=o.leftPadding,l=f().domain([0,w.length]).range(["#00B9FA","#F95002"]).interpolate(C);N(r,a,c,e,i,t,n.db.getExcludes(),n.db.getIncludes()),B(c,a,e,i),z(t,r,a,c,s,l,e),G(r,a),V(c,a,e,i)}function z(t,e,s,r,a,c,l){t.sort((t,e)=>t.vert===e.vert?0:t.vert?1:-1);let d=t.filter(t=>!t.vert),u=[...new Set(d.map(t=>t.order))].map(t=>d.find(e=>e.order===t));L.append("g").selectAll("rect").data(u).enter().append("rect").attr("x",0).attr("y",function(t,i){return t.order*e+s-2}).attr("width",function(){return l-o.rightPadding/2}).attr("height",e).attr("class",function(t){for(let[e,i]of w.entries())if(t.type===i)return"section section"+e%o.numberSectionStyles;return"section section0"}).enter();let h=L.append("g").selectAll("rect").data(t).enter(),f=n.db.getLinks();if(h.append("rect").attr("id",function(t){return i+"-"+t.id}).attr("rx",3).attr("ry",3).attr("x",function(t){return t.milestone?F(t.startTime)+r+.5*(F(t.endTime)-F(t.startTime))-.5*a:F(t.startTime)+r}).attr("y",function(t,i){return(i=t.order,t.vert)?o.gridLineStartPadding:i*e+s}).attr("width",function(t){return t.milestone?a:t.vert?.08*a:F(t.renderEndTime||t.endTime)-F(t.startTime)}).attr("height",function(t){return t.vert?d.length*(o.barHeight+o.barGap)+2*o.barHeight:a}).attr("transform-origin",function(t,i){return i=t.order,(F(t.startTime)+r+.5*(F(t.endTime)-F(t.startTime))).toString()+"px "+(i*e+s+.5*a).toString()+"px"}).attr("class",function(t){let e="";t.classes.length>0&&(e=t.classes.join(" "));let i=0;for(let[e,s]of w.entries())t.type===s&&(i=e%o.numberSectionStyles);let s="";return t.active?t.crit?s+=" activeCrit":s=" active":t.done?s=t.crit?" doneCrit":" done":t.crit&&(s+=" crit"),0===s.length&&(s=" task"),t.milestone&&(s=" milestone "+s),t.vert&&(s=" vert "+s),s+=i,"task"+(s+=" "+e)}),h.append("text").attr("id",function(t){return i+"-"+t.id+"-text"}).text(function(t){return t.task}).attr("font-size",o.fontSize).attr("x",function(t){let e=F(t.startTime),i=F(t.renderEndTime||t.endTime);if(t.milestone&&(e+=.5*(F(t.endTime)-F(t.startTime))-.5*a,i=e+a),t.vert)return F(t.startTime)+r;let s=this.getBBox().width;return s>i-e?i+s+1.5*o.leftPadding>l?e+r-5:i+r+5:(i-e)/2+e+r}).attr("y",function(t,i){return t.vert?o.gridLineStartPadding+d.length*(o.barHeight+o.barGap)+60:t.order*e+o.barHeight/2+(o.fontSize/2-2)+s}).attr("text-height",a).attr("class",function(t){let e=F(t.startTime),i=F(t.endTime);t.milestone&&(i=e+a);let s=this.getBBox().width,n="";t.classes.length>0&&(n=t.classes.join(" "));let r=0;for(let[e,i]of w.entries())t.type===i&&(r=e%o.numberSectionStyles);let c="";return(t.active&&(c=t.crit?"activeCritText"+r:"activeText"+r),t.done?c=t.crit?c+" doneCritText"+r:c+" doneText"+r:t.crit&&(c=c+" critText"+r),t.milestone&&(c+=" milestoneText"),t.vert&&(c+=" vertText"),s>i-e)?i+s+1.5*o.leftPadding>l?n+" taskTextOutsideLeft taskTextOutside"+r+" "+c:n+" taskTextOutsideRight taskTextOutside"+r+" "+c+" width-"+s:n+" taskText taskText"+r+" "+c+" width-"+s}),"sandbox"===b().securityLevel){let t=S("#i"+i).nodes()[0].contentDocument;h.filter(function(t){return f.has(t.id)}).each(function(e){var s=t.querySelector("#"+CSS.escape(i+"-"+e.id)),n=t.querySelector("#"+CSS.escape(i+"-"+e.id+"-text"));let r=s.parentNode;var a=t.createElement("a");a.setAttribute("xlink:href",f.get(e.id)),a.setAttribute("target","_top"),r.appendChild(a),a.appendChild(s),a.appendChild(n)})}}function N(t,e,s,r,c,l,d,u){let h,f;if(0===d.length&&0===u.length)return;for(let{startTime:t,endTime:e}of l)(void 0===h||t<h)&&(h=t),(void 0===f||e>f)&&(f=e);if(!h||!f)return;if(W(f).diff(W(h),"year")>5)return void a.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");let m=n.db.getDateFormat(),y=[],k=null,p=W(h);for(;p.valueOf()<=f;)n.db.isInvalidDate(p,m,d,u)?k?k.end=p:k={start:p,end:p}:k&&(y.push(k),k=null),p=p.add(1,"d");L.append("g").selectAll("rect").data(y).enter().append("rect").attr("id",t=>i+"-exclude-"+t.start.format("YYYY-MM-DD")).attr("x",t=>F(t.start.startOf("day"))+s).attr("y",o.gridLineStartPadding).attr("width",t=>F(t.end.endOf("day"))-F(t.start.startOf("day"))).attr("height",c-e-o.gridLineStartPadding).attr("transform-origin",function(e,i){return(F(e.start)+s+.5*(F(e.end)-F(e.start))).toString()+"px "+(i*t+.5*c).toString()+"px"}).attr("class","exclude-range")}function H(t,e,i,s){if(i<=0||t>e)return 1/0;let n=W.duration({[s??"day"]:i}).asMilliseconds();return n<=0?1/0:Math.ceil((e-t)/n)}function B(t,e,i,s){let r,d=n.db.getDateFormat(),u=n.db.getAxisFormat();r=u||("D"===d?"%d":o.axisFormat??"%Y-%m-%d");let h=A(F).tickSize(-s+e+o.gridLineStartPadding).tickFormat(c(r)),f=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(n.db.getTickInterval()||o.tickInterval);if(null!==f){let t=parseInt(f[1],10);if(isNaN(t)||t<=0)a.warn(`Invalid tick interval value: "${f[1]}". Skipping custom tick interval.`);else{let e=f[2],i=n.db.getWeekday()||o.weekday,s=F.domain(),r=H(s[0],s[1],t,e);if(r>1e4)a.warn(`The tick interval "${t}${e}" would generate ${r} ticks, which exceeds the maximum allowed (10000). This may indicate an invalid date or time range. Skipping custom tick interval.`);else switch(e){case"millisecond":h.ticks(M.every(t));break;case"second":h.ticks(x.every(t));break;case"minute":h.ticks(l.every(t));break;case"hour":h.ticks(T.every(t));break;case"day":h.ticks(g.every(t));break;case"week":h.ticks(ee[i].every(t));break;case"month":h.ticks($.every(t))}}}if(L.append("g").attr("class","grid").attr("transform","translate("+t+", "+(s-50)+")").call(h).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),n.db.topAxisEnabled()||o.topAxis){let i=_(F).tickSize(-s+e+o.gridLineStartPadding).tickFormat(c(r));if(null!==f){let t=parseInt(f[1],10);if(isNaN(t)||t<=0)a.warn(`Invalid tick interval value: "${f[1]}". Skipping custom tick interval.`);else{let e=f[2],s=n.db.getWeekday()||o.weekday,r=F.domain();if(1e4>=H(r[0],r[1],t,e))switch(e){case"millisecond":i.ticks(M.every(t));break;case"second":i.ticks(x.every(t));break;case"minute":i.ticks(l.every(t));break;case"hour":i.ticks(T.every(t));break;case"day":i.ticks(g.every(t));break;case"week":i.ticks(ee[s].every(t));break;case"month":i.ticks($.every(t))}}}L.append("g").attr("class","grid").attr("transform","translate("+t+", "+e+")").call(i).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}function G(t,i){let s=0,n=Object.keys(E).map(t=>[t,E[t]]);L.append("g").selectAll("text").data(n).enter().append(function(t){let i=t[0].split(e.lineBreakRegex),s=-(i.length-1)/2,n=m.createElementNS("http://www.w3.org/2000/svg","text");for(let[t,e]of(n.setAttribute("dy",s+"em"),i.entries())){let i=m.createElementNS("http://www.w3.org/2000/svg","tspan");i.setAttribute("alignment-baseline","central"),i.setAttribute("x","10"),t>0&&i.setAttribute("dy","1em"),i.textContent=e,n.appendChild(i)}return n}).attr("x",10).attr("y",function(e,r){if(!(r>0))return e[1]*t/2+i;for(let a=0;a<r;a++)return s+=n[r-1][1],e[1]*t/2+s*t+i}).attr("font-size",o.sectionFontSize).attr("class",function(t){for(let[e,i]of w.entries())if(t[0]===i)return"sectionTitle sectionTitle"+e%o.numberSectionStyles;return"sectionTitle"})}function V(t,e,i,s){let r=n.db.getTodayMarker();if("off"===r)return;let a=L.append("g").attr("class","today"),c=new Date,l=a.append("line");l.attr("x1",F(c)+t).attr("x2",F(c)+t).attr("y1",o.titleTopMargin).attr("y2",s-o.titleTopMargin).attr("class","today"),""!==r&&l.attr("style",r.replace(/,/g,";"))}function Z(t){let e={},i=[];for(let s=0,n=t.length;s<n;++s)Object.prototype.hasOwnProperty.call(e,t[s])||(e[t[s]]=!0,i.push(t[s]));return i}Y(j,"taskCompare"),p.sort(j),P(p,R,O),u(L,O,R,o.useMaxWidth),L.append("text").text(n.db.getDiagramTitle()).attr("x",R/2).attr("y",o.titleTopMargin).attr("class","titleText"),Y(P,"makeGantt"),Y(z,"drawRects"),Y(N,"drawExcludeDays"),Y(H,"getEstimatedTickCount"),Y(B,"makeGrid"),Y(G,"vertLabels"),Y(V,"drawToday"),Y(Z,"checkUnique")},"draw")},styles:Y(t=>`
  .mermaid-main-font {
        font-family: ${t.fontFamily};
  }

  .exclude-range {
    fill: ${t.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${t.sectionBkgColor};
  }

  .section2 {
    fill: ${t.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${t.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${t.titleColor};
  }

  .sectionTitle1 {
    fill: ${t.titleColor};
  }

  .sectionTitle2 {
    fill: ${t.titleColor};
  }

  .sectionTitle3 {
    fill: ${t.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${t.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${t.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${t.fontFamily};
    fill: ${t.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${t.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${t.taskTextDarkColor};
    text-anchor: start;
    font-family: ${t.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${t.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${t.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${t.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${t.taskBkgColor};
    stroke: ${t.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${t.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${t.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${t.activeTaskBkgColor};
    stroke: ${t.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${t.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${t.doneTaskBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done task text displayed outside the bar sits against the diagram background,
     not against the done-task bar, so it must use the outside/contrast color. */
  .doneText0.taskTextOutsideLeft,
  .doneText0.taskTextOutsideRight,
  .doneText1.taskTextOutsideLeft,
  .doneText1.taskTextOutsideRight,
  .doneText2.taskTextOutsideLeft,
  .doneText2.taskTextOutsideRight,
  .doneText3.taskTextOutsideLeft,
  .doneText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${t.critBorderColor};
    fill: ${t.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  /* Done-crit task text outside the bar \u2014 same reasoning as doneText above. */
  .doneCritText0.taskTextOutsideLeft,
  .doneCritText0.taskTextOutsideRight,
  .doneCritText1.taskTextOutsideLeft,
  .doneCritText1.taskTextOutsideRight,
  .doneCritText2.taskTextOutsideLeft,
  .doneCritText2.taskTextOutsideRight,
  .doneCritText3.taskTextOutsideLeft,
  .doneCritText3.taskTextOutsideRight {
    fill: ${t.taskTextOutsideColor} !important;
  }

  .vert {
    stroke: ${t.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${t.vertLineColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${t.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${t.titleColor||t.textColor};
    font-family: ${t.fontFamily};
  }
`,"getStyles")};export{es as diagram};
//# sourceMappingURL=0~ganttDiagram-EL5Y4UJY.js.map