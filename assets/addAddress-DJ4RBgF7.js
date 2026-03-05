import{j as t}from"./vendor-mui-x-CFAYxywk.js";import{b as n}from"./vendor-emotion-CzXs6gIp.js";import{u as fe}from"./index-BIDCb7B1.js";import"./vendor-mui-core-B4ZZsQDR.js";const C={lat:7.4474,lng:125.8077},ue=g=>{if(!g)return{line1:"Pinned location",line2:"Move the map to adjust",fullAddress:"Pinned location",cityProvince:""};const r=g.address||{},o=r.city||r.town||r.municipality||r.county||"",p=r.state||r.province||"",b=r.country||"",y=r.house_number||"",E=r.road||r.pedestrian||r.footway||"",S=r.suburb||r.village||r.neighbourhood||"",c=[y,E].filter(Boolean).join(" ")||r.amenity||r.building||S||o||"Pinned location",v=[o,p,b].filter(Boolean).join(", ")||"Move the map to adjust",M=[o,p].filter(Boolean).join(", ");return{line1:c,line2:v,fullAddress:g.display_name||[c,v].filter(Boolean).join(", "),cityProvince:M}},ge=()=>{const g=fe(),r=n.useRef(null),o=n.useRef(null),p=n.useRef(null),b=n.useRef(null),y=n.useRef(!1),E=n.useRef(null),S=n.useRef(!1),c=n.useRef({active:!1,startX:0,startY:0,startOffsetX:0,startOffsetY:0}),v=n.useRef({x:0,y:0}),[M,H]=n.useState(""),[X,$]=n.useState(C),[J,_]=n.useState(!1),[K,z]=n.useState(!1),[D,L]=n.useState(!1),[d,O]=n.useState(!1),[w,A]=n.useState(0),[R,I]=n.useState(!1),[j,Z]=n.useState(!1),[k,B]=n.useState({x:0,y:0}),[F,Q]=n.useState(0),[f,U]=n.useState({line1:"Pinned location",line2:"Move the map to adjust",fullAddress:"Pinned location",cityProvince:""}),[N,W]=n.useState(""),[T,u]=n.useState("");n.useEffect(()=>{v.current=k},[k]);const V=n.useCallback(async()=>typeof window>"u"?null:(window.L||(await new Promise((e,a)=>{const s=document.createElement("link");s.rel="stylesheet",s.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",s.onload=e,s.onerror=a,document.head.appendChild(s)}),await new Promise((e,a)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",s.onload=e,s.onerror=a,document.body.appendChild(s)})),window.L),[]),m=n.useCallback(async(e,a)=>{_(!0);try{const s=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e}&lon=${a}`);if(!s.ok)throw new Error("Failed reverse geocoding");const l=await s.json();U(ue(l)),u("")}catch{U({line1:"Pinned location",line2:`${e.toFixed(5)}, ${a.toFixed(5)}`,fullAddress:`${e.toFixed(5)}, ${a.toFixed(5)}`,cityProvince:""}),u("Unable to resolve address. You can still confirm this pinned location.")}finally{_(!1)}},[]);n.useEffect(()=>{let e=!0;return(async()=>{try{const s=await V();if(!e||!r.current||!s)return;const l=s.map(r.current,{center:[C.lat,C.lng],zoom:16,zoomControl:!1,attributionControl:!1});s.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(l),l.on("moveend",()=>{const i=l.getCenter(),x={lat:i.lat,lng:i.lng};$(x),p.current&&window.clearTimeout(p.current),p.current=window.setTimeout(()=>{m(x.lat,x.lng)},250)}),o.current=l,m(C.lat,C.lng)}catch{u("Failed to load map. Please refresh and try again.")}})(),()=>{e=!1,p.current&&window.clearTimeout(p.current),o.current&&(o.current.remove(),o.current=null)}},[V,m]);const ee=async()=>{const e=M.trim();if(e){z(!0),u("");try{const a=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(e)}`);if(!a.ok)throw new Error("Search failed");const s=await a.json();if(!Array.isArray(s)||s.length===0){u("Address not found. Try a more specific keyword.");return}const l=s[0],i={lat:Number(l.lat),lng:Number(l.lon)};$(i),o.current?.setView([i.lat,i.lng],17),m(i.lat,i.lng)}catch{u("Search failed. Please try again.")}finally{z(!1)}}},te=()=>{if(!navigator.geolocation){u("Geolocation is not supported by your browser.");return}L(!0),u(""),navigator.geolocation.getCurrentPosition(e=>{const a={lat:e.coords.latitude,lng:e.coords.longitude};$(a),o.current?.setView([a.lat,a.lng],18),m(a.lat,a.lng),L(!1)},()=>{u("Unable to access your current location."),L(!1)},{enableHighAccuracy:!0,timeout:12e3,maximumAge:0})},ne=()=>{o.current&&o.current.setZoom(Math.min(o.current.getZoom()+1,19))},ae=()=>{o.current&&o.current.setZoom(Math.max(o.current.getZoom()-1,3))},se=e=>{const a=v.current;S.current=!0,c.current={active:!0,startX:e.clientX,startY:e.clientY,startOffsetX:a.x,startOffsetY:a.y},I(!0),Z(!0),o.current&&o.current.dragging.disable(),e.currentTarget?.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId)},re=n.useCallback(e=>{if(!c.current.active)return;const a=r.current;if(!a)return;const s=a.getBoundingClientRect(),l=Math.max(48,s.width*.36),i=Math.max(72,s.height*.28),x=e.clientX-c.current.startX,Y=e.clientY-c.current.startY,h=Math.max(-l,Math.min(l,c.current.startOffsetX+x)),de=Math.max(-i,Math.min(i,c.current.startOffsetY+Y));B({x:h,y:de})},[]),q=n.useCallback(()=>{if(!c.current.active)return;c.current.active=!1,S.current=!1,I(!1),Z(!1),Q(l=>l+1);const e=o.current,a=r.current,s=v.current;if(e){if(a){const l=a.getBoundingClientRect(),i=l.width/2+s.x,x=l.height/2+s.y,Y=e.containerPointToLatLng([i,x]),h={lat:Y.lat,lng:Y.lng};$(h),e.setView([h.lat,h.lng],e.getZoom(),{animate:!0}),m(h.lat,h.lng)}o.current.dragging.enable()}B({x:0,y:0})},[m]),oe=()=>{const e=window.prompt("Add building / floor / apartment details",N||"");e!==null&&W(e.trim())},le=e=>{y.current=!0,b.current=e.clientY,A(0),e.currentTarget?.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId)},ie=n.useCallback(e=>{if(!y.current||b.current==null)return;const a=e.clientY-b.current;A(d?Math.max(0,a):Math.min(0,a))},[d]),G=n.useCallback(()=>{if(!y.current)return;y.current=!1;const e=50;!d&&w<-e?O(!0):d&&w>e&&O(!1),A(0),b.current=null},[d,w]),P=n.useMemo(()=>{const e=[f.line1,f.line2].filter(Boolean).join(", ");return N?`${e||f.fullAddress} (${N})`:e||f.fullAddress},[f,N]),ce=()=>{if(!P)return;const e=JSON.parse(localStorage.getItem("savedAddresses")||"[]"),a=P.toLowerCase(),s=[P,...e.filter(i=>(i||"").toLowerCase()!==a)].slice(0,20);localStorage.setItem("savedAddresses",JSON.stringify(s)),localStorage.setItem("selectedDeliveryAddress",P);const l=f.cityProvince||[f.line2].filter(Boolean).join(", ").split(",").map(i=>i.trim()).filter(Boolean).slice(0,2).join(", ");l&&localStorage.setItem("selectedDeliveryAddressCityProvince",l),g(-1)};return t.jsxs("div",{className:"bg-background-light dark:bg-background-dark font-display overflow-hidden",children:[t.jsxs("div",{className:"relative h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-900",children:[t.jsx("div",{ref:r,className:"absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800"}),t.jsxs("div",{ref:E,className:`pin-overlay absolute top-1/2 left-1/2 pointer-events-auto z-20 flex flex-col items-center cursor-grab active:cursor-grabbing select-none ${R?"":"fp-pin-idle"}`,style:{transform:`translate(calc(-50% + ${k.x}px), calc(-100% + ${k.y+(j?-14:0)}px)) rotate(${R?Math.max(-8,Math.min(8,k.x/8)):0}deg) scale(${j?1.08:1})`,transition:R?"none":"transform 220ms cubic-bezier(0.2, 0.7, 0, 1)"},onPointerDown:se,onPointerMove:re,onPointerUp:q,onPointerCancel:q,children:[t.jsx("div",{className:`fp-pin-halo ${j?"fp-pin-halo-lift":""}`},`halo-${F}`),t.jsx("div",{className:`fp-pin-core ${R?"fp-pin-core-drag":"fp-pin-drop"}`,children:t.jsx("div",{className:"fp-pin-dot"})},`core-${F}`),t.jsx("div",{className:`fp-pin-stem ${j?"fp-pin-stem-lift":""}`}),t.jsx("div",{className:`fp-pin-shadow ${j?"fp-pin-shadow-lift":""}`})]}),t.jsxs("div",{className:"absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-0 space-y-2.5",children:[t.jsxs("div",{className:"flex items-center gap-2",children:[t.jsx("button",{type:"button",onClick:()=>g(-1),className:"bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-md text-slate-900 dark:text-slate-100 flex items-center justify-center flex-shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",children:t.jsx("span",{className:"material-symbols-outlined text-xl",children:"arrow_back_ios_new"})}),t.jsx("div",{className:"flex-1 min-w-0",children:t.jsxs("label",{className:"flex items-center bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-full shadow-md border border-slate-100 dark:border-slate-800",children:[t.jsx("span",{className:"material-symbols-outlined text-[#2b8cee] mr-2 flex-shrink-0 text-[20px]",children:"search"}),t.jsx("input",{className:"bg-transparent border-none focus:ring-0 w-full text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",placeholder:"Search for address",type:"text",value:M,onChange:e=>H(e.target.value),onKeyDown:e=>{e.key==="Enter"&&(e.preventDefault(),ee())}})]})})]}),K&&t.jsx("p",{className:"text-xs text-white/90 font-medium px-1",children:"Searching address..."})]}),t.jsxs("div",{className:"absolute right-4 bottom-[calc(55vh+40px)] z-20 flex flex-col items-end gap-2.5",children:[t.jsx("button",{type:"button",onClick:te,className:"bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-lg text-slate-900 dark:text-slate-100 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",title:"Use my location",disabled:D,children:t.jsx("span",{className:`material-symbols-outlined text-xl ${D?"animate-spin":""}`,children:D?"progress_activity":"my_location"})}),t.jsxs("div",{className:"flex flex-col rounded-full bg-white dark:bg-slate-900 shadow-lg overflow-hidden border border-slate-100 dark:border-slate-800",children:[t.jsx("button",{type:"button",onClick:ne,className:"p-2.5 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors text-xl",title:"Zoom in",children:t.jsx("span",{className:"material-symbols-outlined",children:"add"})}),t.jsx("button",{type:"button",onClick:ae,className:"p-2.5 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xl",title:"Zoom out",children:t.jsx("span",{className:"material-symbols-outlined",children:"remove"})})]})]}),t.jsxs("div",{className:"absolute left-0 right-0 bottom-0 z-30 w-full bg-white dark:bg-slate-900 rounded-t-2xl shadow-[0_-10px_40px_rgb(0,0,0,0.15)] px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-hidden transition-all duration-200 ease-out",style:{maxHeight:d?"70vh":"55vh",transform:`translateY(${w}px)`},children:[t.jsx("div",{className:"flex justify-center mb-4 cursor-grab active:cursor-grabbing select-none",onPointerDown:le,onPointerMove:ie,onPointerUp:G,onPointerCancel:G,onClick:()=>{Math.abs(w)<5&&O(e=>!e)},children:t.jsx("div",{className:"w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"})}),t.jsxs("div",{className:`flex flex-col ${d?"overflow-y-auto":"overflow-hidden"} ${d?"max-h-[calc(70vh-36px)]":""} pr-1`,children:[t.jsxs("div",{className:"flex items-start gap-3 mb-4 flex-shrink-0",children:[t.jsx("div",{className:"bg-[#2b8cee]/10 p-2.5 rounded-full text-[#2b8cee] flex-shrink-0 mt-0.5",children:t.jsx("span",{className:"material-symbols-outlined text-[20px]",children:"location_on"})}),t.jsxs("div",{className:"flex-1 min-w-0",children:[t.jsx("h3",{className:"text-slate-900 dark:text-slate-100 font-bold text-base leading-snug truncate",children:f.line1||"Pinned location"}),t.jsx("p",{className:`text-slate-500 dark:text-slate-400 text-sm ${d?"line-clamp-3":"line-clamp-1"}`,children:f.line2||`${X.lat.toFixed(5)}, ${X.lng.toFixed(5)}`}),(J||T)&&t.jsx("p",{className:`text-xs mt-1 font-medium ${T?"text-red-500":"text-amber-600"}`,children:T||"Resolving address..."})]})]}),t.jsxs("div",{className:"space-y-2.5 flex-shrink-0",children:[d&&t.jsxs("button",{type:"button",onClick:oe,className:"w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-lg font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",children:[t.jsx("span",{className:"material-symbols-outlined text-[18px]",children:"domain"}),N?"Edit (building / floor / apt)":"Add building / floor / apt"]}),t.jsx("button",{type:"button",onClick:ce,disabled:!P,className:"w-full bg-[#2b8cee] text-white py-3.5 rounded-lg font-bold text-base shadow-lg shadow-[#2b8cee]/30 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed",children:"Confirm Location"})]})]})]})]}),t.jsx("style",{children:`
        .fp-pin-idle {
          animation: fp-pin-float 1.9s ease-in-out infinite;
        }

        .fp-pin-halo {
          position: absolute;
          top: 10px;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(43, 140, 238, 0.22) 0%, rgba(43, 140, 238, 0.08) 55%, rgba(43, 140, 238, 0) 75%);
          animation: fp-pin-halo 1.8s ease-in-out infinite;
          pointer-events: none;
        }

        .fp-pin-halo-lift {
          transform: scale(1.08);
          opacity: 0.9;
        }

        .fp-pin-core {
          width: 38px;
          height: 38px;
          border-radius: 50% 50% 50% 0;
          background: linear-gradient(165deg, #4da4f5 0%, #2b8cee 60%, #1677db 100%);
          border: 3px solid #ffffff;
          box-shadow: 0 10px 22px rgba(22, 119, 219, 0.34);
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fp-pin-core-drag {
          box-shadow: 0 16px 28px rgba(22, 119, 219, 0.42);
        }

        .fp-pin-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22);
          transform: rotate(45deg);
        }

        .fp-pin-stem {
          width: 3px;
          height: 18px;
          margin-top: -4px;
          border-radius: 999px;
          background: linear-gradient(180deg, #2b8cee 0%, #1f7ed8 100%);
          transition: all 150ms ease;
        }

        .fp-pin-stem-lift {
          height: 23px;
        }

        .fp-pin-shadow {
          width: 18px;
          height: 7px;
          margin-top: 2px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.22);
          filter: blur(3px);
          transition: all 150ms ease;
        }

        .fp-pin-shadow-lift {
          width: 26px;
          opacity: 0.5;
        }

        .fp-pin-drop {
          animation: fp-pin-drop 300ms cubic-bezier(0.2, 0.75, 0.25, 1.2);
        }

        @keyframes fp-pin-halo {
          0%, 100% { transform: scale(0.94); opacity: 0.7; }
          50% { transform: scale(1.03); opacity: 1; }
        }

        @keyframes fp-pin-float {
          0%, 100% { transform: translate(-50%, -100%) translateY(0); }
          50% { transform: translate(-50%, -100%) translateY(-4px); }
        }

        @keyframes fp-pin-drop {
          0% { transform: translateY(-12px) scale(1.06); }
          65% { transform: translateY(2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); }
        }
      `})]})};export{ge as default};
