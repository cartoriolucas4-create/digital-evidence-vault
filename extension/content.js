(() => {
  const state={lastUrl:location.href};
  const send=(type,payload={})=>chrome.runtime.sendMessage({type,...payload}).catch(()=>{});
  function visible(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0}
  function clean(t){return(t||"").replace(/\s+/g," ").trim()}
  function findFilterContainer(){
    const nodes=[...document.querySelectorAll("body *")].filter(visible);
    const label=nodes.find(el=>clean(el.textContent)==="Filtrar por:");
    return label?.parentElement?.parentElement||null;
  }
  function extractFilters(){
    const root=findFilterContainer();
    if(!root)return{discipline:"",subjects:[]};
    const result={discipline:"",subjects:[]};
    const candidates=[...root.querySelectorAll("*")].filter(visible).map(el=>clean(el.textContent)).filter(Boolean);
    for(const value of candidates){const dm=value.match(/^Disciplina\s+(.+)$/i);if(dm&&dm[1].length<180){result.discipline=dm[1].trim();break}}
    const am=[...root.querySelectorAll("*")].filter(visible).map(el=>clean(el.textContent)).filter(v=>/^Assunto\s+/i.test(v)&&v.length<800);
    if(am.length){const raw=am.sort((a,b)=>a.length-b.length)[0].replace(/^Assunto\s+/i,"");result.subjects=raw.split(/\s+\|\s+|\s*›\s*|\s*•\s*/).map(clean).filter(Boolean)}
    return result;
  }
  function extractQuestions(){
    const filters=extractFilters(),text=clean(document.body.innerText),ids=new Set();
    for(const m of text.matchAll(/(?:^|\s)(?:Q)?(\d{6,10})(?=\s|$|\n)/g))ids.add(m[1]);
    const questions=[];
    for(const id of ids){
      const marker=[...document.querySelectorAll("body *")].find(el=>visible(el)&&new RegExp("(?:Q)?"+id+"(?!\\d)").test(clean(el.textContent||"")));
      const card=marker?.closest('article,li,[data-testid*="question"],[class*="question"],div')||marker?.parentElement;
      const cardText=clean(card?.innerText||"");
      const correct=/Parabéns! Você acertou|Você acertou|\bAcertou\b/i.test(cardText);
      const wrong=/Incorreta\.|Você errou|\bErrado\b/i.test(cardText);
      const answered=correct||wrong;
      if(!answered)continue;
      const topicLine=cardText.split("\n").find(x=>/Direito|Constitucional|Penal|Processual|Administrativo|Teoria|Direitos/i.test(x)&&x.length<400)||"";
      const parts=topicLine.split("›").map(clean).filter(Boolean);
      const lowerTopic=topicLine.toLowerCase();
      const matched=filters.subjects.filter(s=>lowerTopic.includes(s.toLowerCase()));
      const selectedSubject=matched[0]||filters.subjects[0]||"";
      questions.push({questionId:id,correct,answered,discipline:parts[0]||filters.discipline,filterDiscipline:filters.discipline,filterSubject:selectedSubject,filterSubjects:filters.subjects,matchedFilterSubjects:matched,topicPath:parts.slice(1),studyDate:new Date().toISOString().slice(0,10),url:location.href});
    }
    return{filters,questions,url:location.href};
  }
  function emit(){const data=extractQuestions();if(data.questions.length)send("PAGE_STATE",{state:data})}
  function installFloating(){
    if(document.getElementById("msk-qc-floating"))return;
    const b=document.createElement("button");b.id="msk-qc-floating";b.textContent="MSK";
    Object.assign(b.style,{position:"fixed",right:"18px",bottom:"18px",zIndex:"2147483647",border:"1px solid rgba(255,255,255,.14)",borderRadius:"999px",background:"#15181d",color:"#f2c46d",padding:"9px 13px",font:"700 12px system-ui",boxShadow:"0 8px 28px rgba(0,0,0,.35)",cursor:"pointer"});
    b.title="Abrir painel MSK";b.onclick=()=>send("OPEN_PANEL");document.documentElement.appendChild(b);
  }
  function observe(){
    let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(emit,500)};
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});
    window.addEventListener("popstate",schedule);window.addEventListener("hashchange",schedule);
    setInterval(()=>{if(location.href!==state.lastUrl){state.lastUrl=location.href;schedule()}},1000);
  }
  chrome.runtime.onMessage.addListener(message=>{
    if(message.type!=="REQUEST_SESSION")return;
    try{const key=Object.keys(localStorage).find(k=>k.startsWith("sb-")&&k.endsWith("-auth-token"));const raw=key?localStorage.getItem(key):null;if(raw)chrome.runtime.sendMessage({type:"SITE_SESSION",session:JSON.parse(raw)}).catch(()=>{})}catch{}
  });
  installFloating();emit();observe();
})();