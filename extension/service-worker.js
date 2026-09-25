const SUPABASE_URL="https://krulxfcxalaxosebmiyh.supabase.co";
const SUPABASE_KEY="sb_publishable_KkerragH2NsX8fdXWZhBAQ_FMHi-A6u";
const SITE_ORIGIN="https://id-preview--51db2a87-81ef-4c64-b932-a535dca4541d.lovable.app";
const DEFAULTS={sessionQueue:[],activeSession:null,edital:[],mappingOverrides:{},siteUrl:SITE_ORIGIN,captureEnabled:true,lastExport:null,authAccessToken:null,authExpiresAt:0};
const getState=()=>chrome.storage.local.get(DEFAULTS);
const setState=p=>chrome.storage.local.set(p);
const nowISO=()=>new Date().toISOString();
const normalize=v=>(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();

chrome.runtime.onInstalled.addListener(async()=>{await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});const current=await getState(),missing={};for(const[k,v]of Object.entries(DEFAULTS))if(current[k]===undefined)missing[k]=v;if(Object.keys(missing).length)await setState(missing)});
chrome.runtime.onStartup.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{}));
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{try{
    if(message.type==="OPEN_PANEL"&&sender.tab?.windowId!=null){await chrome.sidePanel.open({windowId:sender.tab.windowId});sendResponse({ok:true});return}
    if(message.type==="PAGE_STATE"){await ingestPageState(message.state);sendResponse({ok:true});return}
    if(message.type==="GET_STATE"){sendResponse(await getState());return}
    if(message.type==="SET_STATE"){await setState(message.patch||{});sendResponse({ok:true});return}
    if(message.type==="CLEAR_QUEUE"){await setState({sessionQueue:[]});sendResponse({ok:true});return}
    if(message.type==="REQUEST_SITE_SESSION"){await requestSiteSession();sendResponse({ok:true});return}
    if(message.type==="SITE_SESSION"){await storeAccessToken(message.session);sendResponse({ok:true});return}
    if(message.type==="EXPORT"){sendResponse(await exportQueue());return}
    sendResponse({ok:false,error:"Mensagem desconhecida"});
  }catch(e){sendResponse({ok:false,error:e instanceof Error?e.message:String(e)})}})();
  return true;
});

async function ingestPageState(state){
  if(!state?.questions?.length)return;
  const current=await getState();if(current.captureEnabled===false)return;
  const existing=new Map((current.sessionQueue||[]).map(q=>[String(q.source||"qconcursos")+":"+String(q.questionId),q]));
  for(const q of state.questions){if(!q.questionId)continue;const key="qconcursos:"+q.questionId,previous=existing.get(key);existing.set(key,{...(previous||{}),...q,source:"qconcursos",capturedAt:previous?.capturedAt||nowISO(),lastSeenAt:nowISO()})}
  const queue=[...existing.values()].slice(-5000),sessionId=current.activeSession?.id||crypto.randomUUID();
  await setState({sessionQueue:queue,activeSession:{id:sessionId,discipline:state.filters?.discipline||"",subjects:state.filters?.subjects||[],updatedAt:nowISO(),url:state.url||""}});
}
async function requestSiteSession(){
  const tabs=await chrome.tabs.query({url:[SITE_ORIGIN+"/*","https://*.lovable.app/*"]});
  const target=tabs.find(t=>t.active)||tabs[0];
  if(target?.id){try{await chrome.tabs.sendMessage(target.id,{type:"REQUEST_SESSION"});return}catch{}}
  const tab=await chrome.tabs.create({url:SITE_ORIGIN,active:false});
  setTimeout(()=>chrome.tabs.sendMessage(tab.id,{type:"REQUEST_SESSION"}).catch(()=>{}),1500);
}
async function storeAccessToken(session){
  if(!session?.access_token)return;
  const expiresAt=Number(session.expires_at||0)*1000||Date.now()+50*60*1000;
  await setState({authAccessToken:session.access_token,authExpiresAt:expiresAt});
}
async function api(path,options={}){
  const{authAccessToken}=await getState();if(!authAccessToken)throw new Error("Conecte o Digital Evidence Vault pelo botão Conectar antes de exportar.");
  const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+authAccessToken,"Content-Type":"application/json",...(options.headers||{})};
  const response=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers}),text=await response.text();
  if(!response.ok)throw new Error("Supabase "+response.status+": "+text.slice(0,500));
  return text?JSON.parse(text):null;
}
async function findOrCreate(table,name,extra={}){
  const rows=await api(table+"?select=id,name&name=eq."+encodeURIComponent(name)+"&limit=1",{method:"GET"});
  if(rows?.[0])return rows[0];
  const created=await api(table,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify([{name,...extra}])});
  return created?.[0];
}
async function exportQueue(){
  const state=await getState(),queue=(state.sessionQueue||[]).filter(q=>q.questionId);
  if(!queue.length)throw new Error("Nenhuma questão capturada ainda. Resolva questões no QConcursos e tente novamente.");
  const disciplines=await api("study_disciplines?select=id,name",{method:"GET"});
  const subjects=await api("study_subjects?select=id,name,discipline_id",{method:"GET"});
  const source=await findOrCreate("study_sources","QConcursos");
  const disciplineMap=new Map(disciplines.map(d=>[normalize(d.name),d]));
  const subjectMap=new Map(subjects.map(s=>[s.discipline_id+":"+normalize(s.name),s]));
  let createdDisc=0,createdSub=0,skipped=0,ready=0;const payload=[];
  for(const q of queue){
    const dName=q.filterDiscipline||q.discipline||state.activeSession?.discipline;
    const originalSubject=q.filterSubject||q.studySubject||state.activeSession?.subjects?.[0]||"";
    const mappingKey=dName+"\u0000"+originalSubject,override=state.mappingOverrides?.[mappingKey],sName=override||originalSubject;
    if(!dName||!sName){skipped++;continue}
    if(state.edital?.length){
      const disciplineNode=state.edital.find(d=>normalize(d.name)===normalize(dName));
      const valid=disciplineNode?.subjects?.some(s=>normalize(s)===normalize(sName));
      if(!valid){skipped++;continue}
    }
    let d=disciplineMap.get(normalize(dName));
    if(!d){d=await findOrCreate("study_disciplines",dName);if(!d){skipped++;continue}disciplineMap.set(normalize(dName),d);createdDisc++}
    let s=subjectMap.get(d.id+":"+normalize(sName));
    if(!s){s=await findOrCreate("study_subjects",sName,{discipline_id:d.id});if(!s){skipped++;continue}subjectMap.set(d.id+":"+normalize(sName),s);createdSub++}
    payload.push({study_date:q.studyDate||new Date().toISOString().slice(0,10),discipline_id:d.id,subject_id:s.id,source_id:source.id,questions:1,correct:q.correct?1:0,external_question_id:String(q.questionId),external_source:"qconcursos",filter_discipline:q.filterDiscipline||dName,filter_subject:sName,external_session_id:q.sessionId||state.activeSession?.id||null,source_topic_path:q.topicPath||null,captured_at:q.capturedAt||nowISO(),notes:q.notes||null});
    ready++;
  }
  if(payload.length)await api("study_entries?on_conflict=user_id,external_source,external_question_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(payload)});
  await setState({lastExport:{at:nowISO(),total:queue.length,ready,skipped,createdDisc,createdSub},sessionQueue:[]});
  return{ok:true,total:queue.length,ready,skipped,createdDisc,createdSub};
}