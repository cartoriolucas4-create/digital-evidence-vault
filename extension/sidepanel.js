import {parseBulkEdict,mapSubject} from "./core.js";
const BULK_PROMPT="Você é responsável por transformar um edital de concurso no padrão de importação do Digital Evidence Vault.\n\nREGRAS OBRIGATÓRIAS:\n1. Identifique todas as disciplinas/matérias do edital.\n2. Identifique todos os assuntos e subassuntos cobrados.\n3. Preserve fielmente o conteúdo do edital. NÃO invente assuntos.\n4. Agrupe cada assunto dentro da disciplina correta.\n5. Remova apenas numerações hierárquicas desnecessárias (1., 1.1, 1.1.1 etc.).\n6. Não inclua explicações, comentários, resumos ou observações.\n7. Retorne SOMENTE neste formato:\n\nDISCIPLINA: Nome da disciplina\nASSUNTO: Nome do assunto\nASSUNTO: Nome do assunto\n\nDISCIPLINA: Outra disciplina\nASSUNTO: Nome do assunto\nASSUNTO: Nome do assunto\n\nEDITAL:\n[COLE AQUI O EDITAL COMPLETO]";
const $=s=>document.querySelector(s);
const send=(type,payload={})=>chrome.runtime.sendMessage({type,...payload});
function parseBulk(text){return parseBulkEdict(text)}
function renderMapping(st){
  const catalog=st.edital||[],list=$("#mappingList");
  const groups=[...new Map((st.sessionQueue||[]).filter(q=>q.filterDiscipline&&q.filterSubject).map(q=>[q.filterDiscipline+"\u0000"+q.filterSubject,q])).values()];
  list.innerHTML="";
  if(!catalog.length){list.innerHTML='<div class="mapping-empty">Cadastre o edital em lote para ativar a conferência automática.</div>';return}
  if(!groups.length){list.innerHTML='<div class="mapping-empty">Os assuntos aparecerão aqui conforme as questões forem capturadas.</div>';return}
  for(const q of groups){
    const m=mapSubject(q.filterSubject,q.filterDiscipline,catalog),key=q.filterDiscipline+"\u0000"+q.filterSubject,override=st.mappingOverrides?.[key],discipline=m.discipline,options=discipline?.subjects||[],suggested=m.subject?.name||m.subject||"",selected=override||((m.status==="exact"||m.status==="suggested")?suggested:"");
    const row=document.createElement("div");row.className="mapping-row";
    const label=document.createElement("div");label.className="names";label.innerHTML="<b>"+q.filterDiscipline+"</b><br><span>"+q.filterSubject+"</span> <span class=\""+(selected?"mapping-ok":"mapping-warn")+"\">"+(selected?"→ mapeado":"→ confirmar")+"</span>";row.appendChild(label);
    const sel=document.createElement("select");
    sel.innerHTML='<option value="">Selecione o assunto do edital…</option>'+options.map(x=>{const n=x.name||x;return '<option value="'+n.replaceAll('"',"&quot;")+'" '+(n===selected?"selected":"")+'>'+n+"</option>"}).join("");
    sel.onchange=async()=>{const next={...(st.mappingOverrides||{})};if(sel.value)next[key]=sel.value;else delete next[key];await send("SET_STATE",{patch:{mappingOverrides:next}});render()};
    row.appendChild(sel);list.appendChild(row);
  }
}
let renderBusy=false;\nasync function render(){
  const st=await send("GET_STATE");if(!st)return;
  $("#total").textContent=st.sessionQueue?.length||0;\n  $("#answered").textContent=st.sessionQueue?.filter(q=>q.answered).length||0;$("#hits").textContent=st.sessionQueue?.filter(q=>q.correct).length||0;$("#sessionCount").textContent=st.sessionQueue?.length||0;
  const a=st.activeSession;$("#sessionTitle").textContent=a?.discipline||"Nenhuma sessão";$("#sessionMeta").textContent=a?.subjects?.length?"Filtro: "+a.subjects.join(" • "):"Abra o QConcursos e resolva questões.";$("#capture").checked=st.captureEnabled!==false;
  const exp=st.lastExport;if(exp)$("#exportResult").textContent="Última exportação: "+exp.ready+"/"+exp.total+" questões processadas"+(exp.skipped?" • "+exp.skipped+" pendentes":".");
  $("#authBadge").textContent=st.authAccessToken&&st.authExpiresAt>Date.now()+30000?"conectado":"desconectado";
  const editalText=(st.edital||[]).map(d=>"DISCIPLINA: "+d.name+"\n"+d.subjects.map(s=>"ASSUNTO: "+s).join("\n")).join("\n\n");
  if(document.activeElement!==$("#bulk"))$("#bulk").value=editalText;
  const parsed=parseBulk($("#bulk").value);$("#bulkCount").textContent=parsed.length?parsed.length+" disciplinas • "+parsed.reduce((n,d)=>n+d.subjects.length,0)+" assuntos":"Nenhum edital carregado";
  renderMapping(st);
}
$("#refresh").onclick=render;
$("#copyPrompt").onclick=async()=>{await navigator.clipboard.writeText(BULK_PROMPT);show("Prompt copiado. Cole no ChatGPT junto com seu edital.")};
$("#bulk").addEventListener("input",()=>{const p=parseBulk($("#bulk").value);$("#bulkCount").textContent=p.length?p.length+" disciplinas • "+p.reduce((n,d)=>n+d.subjects.length,0)+" assuntos":"Nenhum edital carregado"});
$("#saveBulk").onclick=async()=>{\n  const button=$("#saveBulk"),stateEl=$("#saveState"),raw=$("#bulk").value,parsed=parseBulk(raw);\n  if(!parsed.length){stateEl.textContent="✕ Não foi possível salvar: use o formato DISCIPLINA: / ASSUNTO:.";stateEl.className="save-state show";show("Edite o conteúdo antes de salvar.",true);return}\n  button.disabled=true;stateEl.textContent="Salvando edital…";stateEl.className="save-state show";\n  try{\n    const response=await send("SET_STATE",{patch:{edital:parsed,mappingOverrides:{},editalSavedAt:new Date().toISOString()}});\n    if(!response?.ok)throw new Error(response?.error||"A extensão não confirmou a gravação.");\n    const verify=await send("GET_STATE");\n    const savedCount=verify?.edital?.reduce((n,d)=>n+d.subjects.length,0)||0;\n    if(savedCount!==parsed.reduce((n,d)=>n+d.subjects.length,0))throw new Error("A verificação encontrou diferença na quantidade salva.");\n    stateEl.textContent="✓ Edital salvo com sucesso • "+verify.edital.length+" disciplinas • "+savedCount+" assuntos";\n    stateEl.className="save-state show";\n    show("✓ Edital salvo e confirmado.");\n    await render();\n  }catch(error){\n    stateEl.textContent="✕ Falha ao salvar: "+(error?.message||error);stateEl.className="save-state show";show(error?.message||"Falha ao salvar o edital.",true);\n  }finally{button.disabled=false}\n};
$("#capture").onchange=async e=>send("SET_STATE",{patch:{captureEnabled:e.target.checked}});
$("#connect").onclick=async()=>{show("Conectando ao Vault…");await send("REQUEST_SITE_SESSION");setTimeout(render,1200);setTimeout(render,2500)};
$("#export").onclick=async()=>{show("Exportando questões únicas…");const r=await send("EXPORT");if(r?.ok)show("Exportado: "+r.ready+" questões."+(r.skipped?" "+r.skipped+" ficaram pendentes para conferência.":""));else show(r?.error||"Falha na exportação.",true);render()};
function show(msg,error=false){const el=$("#status");el.textContent=msg;el.className="status show";el.style.borderColor=error?"#6b3b3b":"#3d4652";el.style.color=error?"#ff9d9d":"#bfc6d0";clearTimeout(show.t);show.t=setTimeout(()=>el.className="status",4500)}
$("#version").textContent="v1.1.0";render();setInterval(render,3000);chrome.storage.onChanged.addListener(render);