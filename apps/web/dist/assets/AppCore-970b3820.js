import{j as i,r as a,R as T}from"./react-vendor-97905e74.js";import{_ as b,S,a as R}from"./index-7b67ed30.js";const $=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.AuthModal})));function N(e){return i.jsx(a.Suspense,{fallback:null,children:i.jsx($,{...e})})}const B=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.PaymentModal})));function F({pkgId:e,...s}){return i.jsx(a.Suspense,{fallback:null,children:i.jsx(B,{...s,pkg:{id:e,name:e==="enterprise"?"Enterprise":e==="starter"?"Starter":"Professional",price:e==="starter"?2900:e==="enterprise"?19900:7900,priceAnnual:e==="starter"?2320:e==="enterprise"?15920:6320}})})}const q=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.Dashboard})));function V(e){return i.jsx(a.Suspense,{fallback:null,children:i.jsx(q,{...e})})}const J=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.WelcomePage})));function X(e){return i.jsx(a.Suspense,{fallback:null,children:i.jsx(J,{...e})})}const W=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.SuccessModal}))),C=a.lazy(()=>b(()=>import("./bcms-saas-platform-761b7ac2.js"),["assets/bcms-saas-platform-761b7ac2.js","assets/react-vendor-97905e74.js","assets/vendor-765c72db.js","assets/index-7b67ed30.js","assets/index-2d31dff2.css"]).then(e=>({default:e.RealtimeUpgradeModal})));function Y(e){return i.jsx(a.Suspense,{fallback:null,children:i.jsx(W,{...e})})}function K(e){return i.jsx(a.Suspense,{fallback:null,children:i.jsx(C,{...e})})}function Q(e){try{localStorage.setItem("sb_session",JSON.stringify(e))}catch{}}function O(){try{localStorage.removeItem("sb_session")}catch{}}class G{constructor(s,t,l,c){this._url=s,this._key=t,this._table=l,this._getToken=c,this._filters=[],this._select="*",this._single=!1}select(s){return this._select=s,this}eq(s,t){return this._filters.push(`${s}=eq.${encodeURIComponent(t)}`),this}single(){return this._single=!0,this._execute()}async _execute(){const s=[`select=${encodeURIComponent(this._select)}`,...this._filters].join("&"),t=await fetch(`${this._url}/rest/v1/${this._table}?${s}`,{headers:{"Content-Type":"application/json",apikey:this._key,Authorization:`Bearer ${this._getToken()??this._key}`,Prefer:this._single?"return=representation":""}}),l=await t.json();return t.ok?this._single?{data:Array.isArray(l)?l[0]??null:l,error:null}:{data:l,error:null}:{data:null,error:l}}}const p={url:S,key:R,_token:null,_headers(e={}){return{"Content-Type":"application/json",apikey:this.key,Authorization:`Bearer ${this._token??this.key}`,...e}},auth:{async signOut(){return await fetch(`${S}/auth/v1/logout`,{method:"POST",headers:p._headers()}),p._token=null,O(),{error:null}},async getSession(){try{const e=localStorage.getItem("sb_session");if(e){const s=JSON.parse(e);return p._token=s.access_token,{data:{session:s},error:null}}}catch{}return{data:{session:null},error:null}},async handleOAuthCallback(){const e=window.location.hash;if(!e.includes("access_token"))return null;const s=new URLSearchParams(e.replace("#","?")),t=s.get("access_token"),l=s.get("refresh_token");if(!t)return null;p._token=t;const c={access_token:t,refresh_token:l};return Q(c),window.history.replaceState({},"",window.location.pathname),{user:await(await fetch(`${S}/auth/v1/user`,{headers:p._headers()})).json(),session:c}}},from(e){return new G(this.url,this.key,e,()=>this._token)},_channels:{},channel(e){return{_filters:[],_handlers:{},on(t,l,c){return typeof l=="function"?this._handlers[t]=l:(this._filters.push({event:t,...l}),typeof c=="function"&&(this._handlers[t+JSON.stringify(l)]=c)),this},subscribe(t){const l=S.replace("https://","wss://").replace("http://","ws://")+`/realtime/v1/websocket?apikey=${R}`;try{const c=new WebSocket(l);c.onopen=()=>{t==null||t("SUBSCRIBED");for(const u of this._filters)c.send(JSON.stringify({topic:`realtime:${u.schema??"public"}:${u.table??"*"}:${u.filter??"*"}`,event:"phx_join",payload:{config:{broadcast:{self:!1},postgres_changes:[u]}},ref:"1"}))},c.onmessage=u=>{var g;try{const d=JSON.parse(u.data);if(d.event==="postgres_changes"&&((g=d.payload)!=null&&g.data)){const m=d.payload.data,o=this._handlers[m.type+JSON.stringify({schema:m.schema,table:m.table})]??this._handlers[m.type]??this._handlers["*"];o==null||o(m)}}catch{}},c.onerror=()=>t==null?void 0:t("CHANNEL_ERROR"),c.onclose=()=>t==null?void 0:t("CLOSED"),p._channels[e]=c}catch{t==null||t("CHANNEL_ERROR")}return this}}},removeChannel(e){const s=this._channels[e];if(s){try{s.close()}catch{}delete this._channels[e]}}};function H(){T.useEffect(()=>{const s=document.createElement("link");return s.rel="stylesheet",s.href="https://fonts.googleapis.com/css2?family=Kanit:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,600;1,700&family=DM+Mono:wght@400;500&display=swap",document.head.appendChild(s),()=>{try{document.head.removeChild(s)}catch{}}},[]);const e=`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; font-size: 16px; }
    body { background: #F0F6FF; -webkit-font-smoothing: antialiased; }

    :root {
      --sp1: 4px;  --sp2: 8px;   --sp3: 12px;  --sp4: 16px;
      --sp5: 20px; --sp6: 24px;  --sp8: 32px;  --sp10: 40px;
      --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px;
      --shadow-sm: 0 1px 3px rgba(21,101,192,0.08), 0 1px 2px rgba(21,101,192,0.06);
      --shadow-md: 0 4px 12px rgba(21,101,192,0.10), 0 2px 4px rgba(21,101,192,0.06);
      --shadow-lg: 0 12px 32px rgba(21,101,192,0.14), 0 4px 8px rgba(21,101,192,0.08);
      --shadow-xl: 0 24px 56px rgba(21,101,192,0.18), 0 8px 16px rgba(21,101,192,0.10);
      --transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #E8F0FE; }
    ::-webkit-scrollbar-thumb { background: #90B8E8; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #1565C0; }

    button, [role="button"], a, input, select, textarea { min-height: 44px; }
    button { cursor: pointer; font-family: 'Kanit', sans-serif; }
    input, textarea, select { outline: none; font-family: 'Kanit', sans-serif; min-height: 48px; }

    * { transition: color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s, opacity 0.15s; }

    .t-xs  { font-size: 11px; line-height: 1.5; }
    .t-sm  { font-size: 13px; line-height: 1.5; }
    .t-base{ font-size: 15px; line-height: 1.6; }
    .t-lg  { font-size: 18px; line-height: 1.4; }
    .t-xl  { font-size: 22px; line-height: 1.3; }
    .t-2xl { font-size: 28px; line-height: 1.2; }

    *:focus-visible { outline: 3px solid #1565C0; outline-offset: 2px; border-radius: 4px; }

    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
    @keyframes slideIn  { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
    @keyframes slideInRight { from{transform:translateX(100%);} to{transform:translateX(0);} }
    @keyframes pulse-ring { 0%,100%{transform:scale(0.95);opacity:0.7;} 50%{transform:scale(1.05);opacity:1;} }
    @keyframes float    { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
    @keyframes ticker   { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
    @keyframes spin     { to{transform:rotate(360deg);} }
    @keyframes gradient-shift { 0%,100%{background-position:0% 50%;} 50%{background-position:100% 50%;} }
    @keyframes progress-fill  { from{width:0;} to{width:var(--target-width,100%);} }

    .anim-up  { animation: fadeUp  0.5s cubic-bezier(0.4,0,0.2,1) both; }
    .anim-in  { animation: fadeIn  0.3s ease both; }
    .anim-slide { animation: slideIn 0.35s cubic-bezier(0.4,0,0.2,1) both; }

    .delay-1 { animation-delay: 0.05s; }
    .delay-2 { animation-delay: 0.10s; }
    .delay-3 { animation-delay: 0.15s; }
    .delay-4 { animation-delay: 0.20s; }
    .delay-5 { animation-delay: 0.25s; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;return i.jsx("style",{dangerouslySetInnerHTML:{__html:e}})}function Z({tenant:e}){const[s,t]=a.useState("welcome"),[l,c]=a.useState(null),[u,g]=a.useState(null),[d,m]=a.useState(null),[o,y]=a.useState(null),[_,x]=a.useState("professional"),[z,L]=a.useState("monthly"),[I,k]=a.useState(!1),[A,j]=a.useState(null);a.useEffect(()=>{e==null||e.type},[e]);const P=a.useCallback(async(r,h)=>{var w,v,E;const{data:n}=await p.from("profiles").select("full_name, org_id, organizations(name), subscriptions(plan,status)").eq("id",r).single();if(!n)return null;const f=((v=(w=n==null?void 0:n.subscriptions)==null?void 0:w[0])==null?void 0:v.plan)??"free";return{id:r,name:n.full_name??(h==null?void 0:h.split("@")[0])??"ผู้ใช้",email:h,org:((E=n.organizations)==null?void 0:E.name)??"—",plan:f,orgId:n.org_id}},[]);a.useEffect(()=>{(async()=>{if(window.location.hash.includes("access_token")){const n=await p.auth.handleOAuthCallback();if(n!=null&&n.user){await new Promise(w=>setTimeout(w,1200));const f=await P(n.user.id,n.user.email);f&&(y(f),x(f.plan!=="free"?f.plan:"professional"),t("dashboard"),k(!0));return}}const{data:{session:r}}=await p.auth.getSession();if(!(r!=null&&r.user))return;const h=await P(r.user.id,r.user.email);h&&(y(h),x(h.plan!=="free"?h.plan:"professional"),t("dashboard"))})()},[P]),a.useEffect(()=>{if(o!=null&&o.orgId)return p.channel("rt-orders-"+o.orgId).on("postgres_changes",{event:"UPDATE",schema:"public",table:"payment_orders",filter:`org_id=eq.${o.orgId}`},async r=>{if((r.new??r).status==="confirmed"){const{data:n}=await p.from("subscriptions").select("plan").eq("org_id",o.orgId).single();n!=null&&n.plan&&n.plan!=="free"&&(x(n.plan),y(f=>f&&{...f,plan:n.plan}),j(n.plan))}}).subscribe(),p.channel("rt-subs-"+o.orgId).on("postgres_changes",{event:"UPDATE",schema:"public",table:"subscriptions",filter:`org_id=eq.${o.orgId}`},r=>{const h=r.new??r;h.plan&&h.plan!==_&&(x(h.plan),y(n=>n&&{...n,plan:h.plan}))}).subscribe(),()=>{p.removeChannel("rt-orders-"+o.orgId),p.removeChannel("rt-subs-"+o.orgId)}},[_,o==null?void 0:o.orgId]);const M=(r,h)=>{x(r),L(h||"monthly"),o?g({pkg:r,billing:h||"monthly"}):c("register")},U=r=>{y(r),c(null),t("dashboard"),l==="register"&&k(!0),_&&_!=="free"&&l==="register"&&setTimeout(()=>g({pkg:_,billing:z}),400)},D=r=>{g(null),m({pkg:_,orderRef:r??null})};return i.jsxs(i.Fragment,{children:[i.jsx(H,{}),s==="welcome"&&i.jsx(X,{onOpenAuth:r=>{if(o){t("dashboard");return}c(r)},onSelectPkg:M}),s==="dashboard"&&o&&i.jsx(V,{user:o,pkg:_,onLogout:async()=>{await p.auth.signOut(),O(),y(null),t("welcome"),k(!1)},onUpgrade:()=>g({pkg:"professional",billing:"monthly"}),showOnboarding:I,onOnboardingDone:()=>k(!1)}),l&&i.jsx(N,{mode:l,selectedPkg:_,onClose:()=>c(null),onSuccess:U}),u&&o&&i.jsx(F,{pkgId:u.pkg,billing:u.billing||"monthly",user:o,onClose:()=>g(null),onSuccess:D}),d&&i.jsx(Y,{pkg:(d==null?void 0:d.pkg)??d,onContinue:()=>{m(null),t("dashboard")}}),A&&i.jsx(K,{newPlan:A,onDismiss:()=>{j(null),t("dashboard")}})]})}const se=Object.freeze(Object.defineProperty({__proto__:null,default:Z},Symbol.toStringTag,{value:"Module"}));export{N as A,V as D,H as F,F as P,K as R,Y as S,X as W,se as a};
