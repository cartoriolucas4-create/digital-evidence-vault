import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CheckCircle2, FileDown, LogOut, Plus, Settings, Target, Trash2, XCircle } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart } from "recharts";
import { supabase } from "./lib/supabase";
import type { Discipline, Entry, Filters, QuestionType, Source, Subject } from "./types";

const today=()=>new Date().toISOString().slice(0,10);
const firstDay=()=>{const d=new Date();d.setDate(d.getDate()-29);return d.toISOString().slice(0,10)};
const pct=(c:number,q:number)=>q?c/q*100:0;
const fmt=(n:number)=>new Intl.NumberFormat("pt-BR").format(n);
const emptyFilters=():Filters=>({disciplineId:"",subjectId:"",sourceId:"",from:firstDay(),to:today()});
const STORE={disciplines:"cd_disciplines",subjects:"cd_subjects",sources:"cd_sources",types:"cd_types",entries:"cd_entries",settings:"cd_settings"};
const readStore=<T,>(key:string,fallback:T):T=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const writeStore=(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value));
const uid=()=>crypto.randomUUID();

function App(){
  const [session,setSession]=useState<any>({user:{email:"Acesso direto"}}); const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState<"dashboard"|"entries"|"catalog"|"settings">("dashboard");
  const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [disciplines,setDisciplines]=useState<Discipline[]>([]); const [subjects,setSubjects]=useState<Subject[]>([]);
  const [sources,setSources]=useState<Source[]>([]); const [types,setTypes]=useState<QuestionType[]>([]);
  const [entries,setEntries]=useState<Entry[]>([]); const [filters,setFilters]=useState<Filters>(emptyFilters()); const [applied,setApplied]=useState<Filters>(emptyFilters());
  const [dailyGoal,setDailyGoal]=useState(100); const [targetAccuracy,setTargetAccuracy]=useState(80);

  const flash=(s:string)=>{setMessage(s);setTimeout(()=>setMessage(""),2600)}; const fail=(e:any)=>setError(e?.message||"Ocorreu um erro.");

  useEffect(()=>{ setLoading(false); },[]);
  useEffect(()=>{ loadCatalog(); },[]);
  useEffect(()=>{ loadEntries(); },[applied]);

  function loadCatalog(){
    setDisciplines(readStore<Discipline[]>(STORE.disciplines,[]));
    setSubjects(readStore<Subject[]>(STORE.subjects,[]));
    setSources(readStore<Source[]>(STORE.sources,[]));
    setTypes(readStore<QuestionType[]>(STORE.types,[]));
    const settings=readStore<{daily_goal:number;target_accuracy:number}|null>(STORE.settings,null);
    if(settings){setDailyGoal(settings.daily_goal);setTargetAccuracy(settings.target_accuracy);}
  }
  function loadEntries(){
    const all=readStore<Entry[]>(STORE.entries,[]);
    const filtered=all.filter(e=>
      e.study_date>=applied.from&&e.study_date<=applied.to&&
      (!applied.disciplineId||e.discipline_id===applied.disciplineId)&&
      (!applied.subjectId||e.subject_id===applied.subjectId)&&
      (!applied.sourceId||e.source_id===applied.sourceId)
    ).sort((a,b)=>b.study_date.localeCompare(a.study_date));
    setEntries(filtered);
  }
  if(loading)return <div className="auth"><div className="auth-card"><h1>Central de Desempenho</h1><p>Carregando…</p></div></div>;

  if(!session)return <div className="auth"><div className="auth-card"><h1>Central de Desempenho</h1><p>Inicializando acesso direto…</p>{error&&<div className="error">{error}</div>}</div></div>;

  const filteredSubjects=filters.disciplineId?subjects.filter(s=>s.discipline_id===filters.disciplineId):subjects;
  const appliedSubjects=applied.disciplineId?subjects.filter(s=>s.discipline_id===applied.disciplineId):subjects;
  const totalQ=entries.reduce((a,e)=>a+e.questions,0), totalC=entries.reduce((a,e)=>a+e.correct,0), totalE=totalQ-totalC, accuracy=pct(totalC,totalQ);
  const days=new Set(entries.map(e=>e.study_date)).size; const avg=days?totalQ/days:0;
  const todayEntries=entries.filter(e=>e.study_date===today()); const todayQ=todayEntries.reduce((a,e)=>a+e.questions,0); const todayC=todayEntries.reduce((a,e)=>a+e.correct,0);
  const byDisc=useMemo(()=>disciplines.map(d=>{const xs=entries.filter(e=>e.discipline_id===d.id);const q=xs.reduce((a,e)=>a+e.questions,0),c=xs.reduce((a,e)=>a+e.correct,0);return {id:d.id,name:d.name,questions:q,correct:c,errors:q-c,accuracy:pct(c,q)}}).filter(x=>x.questions>0),[entries,disciplines]);
  const bySubject=useMemo(()=>subjects.map(s=>{const xs=entries.filter(e=>e.subject_id===s.id);const q=xs.reduce((a,e)=>a+e.questions,0),c=xs.reduce((a,e)=>a+e.correct,0);return {id:s.id,name:s.name,discipline:disciplines.find(d=>d.id===s.discipline_id)?.name||"",questions:q,correct:c,errors:q-c,accuracy:pct(c,q)}}).filter(x=>x.questions>0).sort((a,b)=>a.accuracy-b.accuracy),[entries,subjects,disciplines]);
  const daily=useMemo(()=>{const m=new Map<string,{questions:number,correct:number}>();entries.forEach(e=>{const v=m.get(e.study_date)||{questions:0,correct:0};v.questions+=e.questions;v.correct+=e.correct;m.set(e.study_date,v)});return [...m.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date:date.slice(5).split("-").reverse().join("/"),questions:v.questions,correct:v.correct,errors:v.questions-v.correct,accuracy:Number(pct(v.correct,v.questions).toFixed(1))}))},[entries]);
  const attention=bySubject.filter(x=>x.questions>0&&x.accuracy<targetAccuracy).slice(0,12);
  const setFilter=(k:keyof Filters,v:string)=>setFilters(f=>({...f,[k]:v,...(k==="disciplineId"?{subjectId:""}:{})}));
  const apply=()=>{setApplied(filters);flash("Filtros aplicados.");}; const clear=()=>{const f=emptyFilters();setFilters(f);setApplied(f);};
  async function signout(){ setSession({user:{email:"Acesso direto"}}); }

  return <div className="app"><header className="topbar"><div className="brand"><div className="brand-mark">C</div><span>CENTRAL DE DESEMPENHO — CONCURSOS</span></div><div className="top-actions"><span className="user">{session.user.email}</span><button className="btn small" onClick={signout}><LogOut size={14}/> Sair</button></div></header><div className="layout"><aside className="sidebar"><nav className="nav">
    <button className={tab==="dashboard"?"active":""} onClick={()=>setTab("dashboard")}><BarChart3 size={16}/> Dashboard</button>
    <button className={tab==="entries"?"active":""} onClick={()=>setTab("entries")}><CheckCircle2 size={16}/> Lançamentos</button>
    <button className={tab==="catalog"?"active":""} onClick={()=>setTab("catalog")}><BookOpen size={16}/> Cadastro</button>
    <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings size={16}/> Configurações</button>
  </nav></aside><main className="content">
    {error&&<div className="error"><button className="btn small" style={{float:"right"}} onClick={()=>setError("")}><XCircle size={14}/></button>{error}</div>}
    {tab==="dashboard"&&<Dashboard entries={entries} filters={filters} setFilter={setFilter} disciplines={disciplines} subjects={filteredSubjects} sources={sources} apply={apply} clear={clear} totalQ={totalQ} totalC={totalC} totalE={totalE} accuracy={accuracy} days={days} avg={avg} todayQ={todayQ} todayC={todayC} dailyGoal={dailyGoal} byDisc={byDisc} daily={daily} attention={attention} targetAccuracy={targetAccuracy}/>}
    {tab==="entries"&&<Entries disciplines={disciplines} subjects={subjects} sources={sources} types={types} entries={entries} refresh={loadEntries} flash={flash} fail={fail}/>}
    {tab==="catalog"&&<Catalog disciplines={disciplines} subjects={subjects} sources={sources} types={types} refresh={loadCatalog} flash={flash} fail={fail}/>}
    {tab==="settings"&&<SettingsPage dailyGoal={dailyGoal} targetAccuracy={targetAccuracy} setDailyGoal={setDailyGoal} setTargetAccuracy={setTargetAccuracy} flash={flash} fail={fail}/>}
  </main></div>{message&&<div className="toast">{message}</div>}</div>
}

function Dashboard(p:any){
 return <><h1 className="page-title">Dashboard</h1><p className="subtitle">Visão consolidada dos lançamentos reais do período filtrado.</p>
 <section className="section"><div className="section-head">FILTROS DE ANÁLISE</div><div className="section-body"><div className="filters">
  <div className="field"><label>Disciplina</label><select value={p.filters.disciplineId} onChange={e=>p.setFilter("disciplineId",e.target.value)}><option value="">Todas</option>{p.disciplines.map((d:Discipline)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
  <div className="field"><label>Assunto</label><select value={p.filters.subjectId} onChange={e=>p.setFilter("subjectId",e.target.value)}><option value="">Todos</option>{p.subjects.map((s:Subject)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
  <div className="field"><label>Banca/Origem</label><select value={p.filters.sourceId} onChange={e=>p.setFilter("sourceId",e.target.value)}><option value="">Todas</option>{p.sources.map((s:Source)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
  <div className="field"><label>Data inicial</label><input type="date" value={p.filters.from} onChange={e=>p.setFilter("from",e.target.value)}/></div>
  <div className="field"><label>Data final</label><input type="date" value={p.filters.to} onChange={e=>p.setFilter("to",e.target.value)}/></div>
  <button className="btn primary" onClick={p.apply}>🔎 Filtrar</button><button className="btn" onClick={p.clear}>↻ Limpar</button>
 </div></div></section>
 <div className="metrics"><Metric label="Questões" value={fmt(p.totalQ)}/><Metric label="Acertos" value={fmt(p.totalC)} tone="good"/><Metric label="Erros" value={fmt(p.totalE)} tone="bad"/><Metric label="Aproveitamento" value={p.accuracy.toFixed(1)+"%"} tone={p.accuracy>=p.targetAccuracy?"good":p.accuracy>=60?"warn":"bad"}/><Metric label="Dias estudados" value={fmt(p.days)}/><Metric label="Média/dia" value={p.avg.toFixed(1)}/></div>
 <section className="section" style={{marginTop:16}}><div className="section-head">HOJE</div><div className="section-body"><div className="grid2"><div><b>{fmt(p.todayQ)}</b> questões · <b>{fmt(p.todayC)}</b> acertos · <b>{fmt(p.todayQ-p.todayC)}</b> erros</div><div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span>Meta diária: {fmt(p.dailyGoal)}</span><b>{Math.min(100,p.todayQ/p.dailyGoal*100).toFixed(0)}%</b></div><div className="progress"><span style={{width:Math.min(100,p.todayQ/p.dailyGoal*100)+"%"}}/></div></div></div></div></section>
 <div className="grid2"><section className="section"><div className="section-head">DESEMPENHO POR DISCIPLINA</div><div className="table-wrap"><table className="table"><thead><tr><th>Disciplina</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>%</th><th>Status</th></tr></thead><tbody>{p.byDisc.length?p.byDisc.map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{fmt(x.questions)}</td><td>{fmt(x.correct)}</td><td>{fmt(x.errors)}</td><td>{x.accuracy.toFixed(1)}%</td><td><Status value={x.accuracy} target={p.targetAccuracy}/></td></tr>):<tr><td colSpan={6}><div className="empty">Nenhum dado no período.</div></td></tr>}</tbody></table></div></section>
 <section className="section"><div className="section-head">PONTOS QUE PRECISAM DE ATENÇÃO</div><div className="table-wrap"><table className="table"><thead><tr><th>Assunto</th><th>Disciplina</th><th>Questões</th><th>%</th><th>Prioridade</th></tr></thead><tbody>{p.attention.length?p.attention.map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{x.discipline}</td><td>{x.questions}</td><td>{x.accuracy.toFixed(1)}%</td><td><Status value={x.accuracy} target={p.targetAccuracy}/></td></tr>):<tr><td colSpan={5}><div className="empty">Nenhum assunto abaixo da meta no período.</div></td></tr>}</tbody></table></div></section></div>
 <div className="grid2"><section className="section"><div className="section-head">EVOLUÇÃO DO DESEMPENHO</div><div className="section-body chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={p.daily}><CartesianGrid strokeDasharray="3 3" stroke="#eee"/><XAxis dataKey="date"/><YAxis domain={[0,100]}/><Tooltip/><Line type="monotone" dataKey="accuracy" name="% acerto" stroke="#d63384" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></section>
 <section className="section"><div className="section-head">QUESTÕES POR DIA</div><div className="section-body chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={p.daily}><CartesianGrid strokeDasharray="3 3" stroke="#eee"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Bar dataKey="questions" name="Questões" fill="#d63384"/></BarChart></ResponsiveContainer></div></section></div>
 </>}
function Metric({label,value,tone}:{label:string,value:string,tone?:string}){return <div className={"metric "+(tone||"")}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>}
function Status({value,target}:{value:number,target:number}){return <span className={"status "+(value>=target?"good":value>=60?"warn":"bad")}>{value>=target?"OK":value>=60?"REVISAR":"FOCO"}</span>}

function Entries({disciplines,subjects,sources,types,entries,refresh,flash,fail}:any){
 const [open,setOpen]=useState(false);const [edit,setEdit]=useState<Entry|null>(null);
 const save=async(v:any)=>{try{const all=readStore<Entry[]>(STORE.entries,[]);const payload:any={id:edit?.id||uid(),study_date:v.study_date,discipline_id:v.discipline_id,subject_id:v.subject_id,source_id:v.source_id||null,question_type_id:v.question_type_id||null,questions:Number(v.questions),correct:Number(v.correct),notes:v.notes||null,discipline:{name:disciplines.find((x:Discipline)=>x.id===v.discipline_id)?.name},subject:{name:subjects.find((x:Subject)=>x.id===v.subject_id)?.name},source:{name:sources.find((x:Source)=>x.id===v.source_id)?.name},question_type:{name:types.find((x:QuestionType)=>x.id===v.question_type_id)?.name}};const next=edit?all.map(x=>x.id===edit.id?payload:x):[payload,...all];writeStore(STORE.entries,next);flash(edit?"Lançamento atualizado.":"Lançamento criado.");setOpen(false);setEdit(null);refresh();}catch(e){fail(e)}};
 const remove=async(id:string)=>{if(!confirm("Excluir este lançamento?"))return;try{writeStore(STORE.entries,readStore<Entry[]>(STORE.entries,[]).filter(x=>x.id!==id));flash("Lançamento excluído.");refresh();}catch(e){fail(e)}};
 return <><div className="toolbar"><div><h1 className="page-title">Lançamentos</h1><p className="subtitle">Tabela rápida para registrar sessões de questões.</p></div><button className="btn primary" onClick={()=>{setEdit(null);setOpen(true)}}><Plus size={15}/> Novo lançamento</button></div>
 <section className="section"><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Disciplina</th><th>Assunto</th><th>Banca/Origem</th><th>Tipo</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>%</th><th>Observações</th><th></th></tr></thead><tbody>{entries.length?entries.map((e:Entry)=><tr key={e.id}><td>{new Date(e.study_date+"T00:00:00").toLocaleDateString("pt-BR")}</td><td>{e.discipline?.name}</td><td>{e.subject?.name}</td><td>{e.source?.name||"—"}</td><td>{e.question_type?.name||"—"}</td><td>{e.questions}</td><td>{e.correct}</td><td>{e.questions-e.correct}</td><td>{pct(e.correct,e.questions).toFixed(1)}%</td><td>{e.notes||"—"}</td><td><button className="btn small" onClick={()=>{setEdit(e);setOpen(true)}}>Editar</button> <button className="btn small danger" onClick={()=>remove(e.id)}><Trash2 size={13}/></button></td></tr>):<tr><td colSpan={11}><div className="empty">Nenhum lançamento no período atual.</div></td></tr>}</tbody></table></div></section>
 {open&&<LaunchModal initial={edit} disciplines={disciplines} subjects={subjects} sources={sources} types={types} onClose={()=>{setOpen(false);setEdit(null)}} onSave={save}/>}</>
}

function LaunchModal({initial,disciplines,subjects,sources,types,onClose,onSave}:any){
 const [v,setV]=useState<any>({study_date:initial?.study_date||today(),discipline_id:initial?.discipline_id||"",subject_id:initial?.subject_id||"",source_id:initial?.source_id||"",question_type_id:initial?.question_type_id||"",questions:initial?.questions||"",correct:initial?.correct||"",notes:initial?.notes||""});
 const sub=subjects.filter((s:Subject)=>s.discipline_id===v.discipline_id); const errors=Number(v.questions||0)-Number(v.correct||0);
 const submit=(e:React.FormEvent)=>{e.preventDefault();if(Number(v.questions)<=0||Number(v.correct)<0||Number(v.correct)>Number(v.questions))return alert("Informe questões > 0 e acertos entre 0 e o total.");if(!v.discipline_id||!v.subject_id)return alert("Selecione disciplina e assunto.");onSave(v)};
 return <div className="auth" style={{position:"fixed",inset:0,zIndex:40,background:"rgba(23,32,42,.45)"}}><div className="auth-card" style={{width:"min(760px,96vw)"}}><div className="toolbar"><h2 style={{margin:0}}>{initial?"Editar lançamento":"Novo lançamento"}</h2><button className="btn small" onClick={onClose}>×</button></div><form onSubmit={submit}><div className="form-grid"><div className="field"><label>Data</label><input type="date" value={v.study_date} onChange={e=>setV({...v,study_date:e.target.value})}/></div><div className="field"><label>Disciplina</label><select value={v.discipline_id} onChange={e=>setV({...v,discipline_id:e.target.value,subject_id:""})} required><option value="">Selecione</option>{disciplines.map((d:Discipline)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div className="field"><label>Assunto</label><select value={v.subject_id} onChange={e=>setV({...v,subject_id:e.target.value})} required><option value="">Selecione</option>{sub.map((s:Subject)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Banca/Origem</label><select value={v.source_id} onChange={e=>setV({...v,source_id:e.target.value})}><option value="">Selecione</option>{sources.map((s:Source)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label>Tipo</label><select value={v.question_type_id} onChange={e=>setV({...v,question_type_id:e.target.value})}><option value="">Selecione</option>{types.map((t:QuestionType)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="field"><label>Questões</label><input type="number" min="1" value={v.questions} onChange={e=>setV({...v,questions:e.target.value})} required/></div><div className="field"><label>Acertos</label><input type="number" min="0" value={v.correct} onChange={e=>setV({...v,correct:e.target.value})} required/></div><div className="field"><label>Erros calculados</label><input value={errors>=0?errors:"—"} readOnly/></div><div className="field"><label>Aproveitamento</label><input value={v.questions?pct(Number(v.correct),Number(v.questions)).toFixed(1)+"%":"—"} readOnly/></div><div className="field wide"><label>Observações</label><textarea rows={4} value={v.notes} onChange={e=>setV({...v,notes:e.target.value})}/></div></div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar</button></div></form></div></div>
}

function Catalog({disciplines,subjects,sources,types,refresh,flash,fail}:any){
 const [kind,setKind]=useState<"discipline"|"subject"|"source"|"type">("discipline");const [name,setName]=useState("");const [disciplineId,setDisciplineId]=useState("");const [search,setSearch]=useState("");
 const list=kind==="discipline"?disciplines:kind==="subject"?subjects.filter((s:Subject)=>!disciplineId||s.discipline_id===disciplineId):kind==="source"?sources:types;
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!name.trim())return;try{if(kind==="subject"&&!disciplineId)throw new Error("Selecione a disciplina do assunto.");const item:any={id:uid(),name:name.trim()};if(kind==="subject")item.discipline_id=disciplineId;const key=kind==="discipline"?STORE.disciplines:kind==="subject"?STORE.subjects:kind==="source"?STORE.sources:STORE.types;const list=readStore<any[]>(key,[]);writeStore(key,[...list,item]);setName("");flash("Cadastro salvo.");refresh();}catch(e){fail(e)}};
 const remove=async(id:string)=>{if(!confirm("Excluir este item?"))return;try{const key=kind==="discipline"?STORE.disciplines:kind==="subject"?STORE.subjects:kind==="source"?STORE.sources:STORE.types;writeStore(key,readStore<any[]>(key,[]).filter(x=>x.id!==id));flash("Item excluído.");refresh();}catch(e){fail(e)}};
 const shown=list.filter((x:any)=>x.name.toLowerCase().includes(search.toLowerCase()));
 return <><h1 className="page-title">Cadastro</h1><p className="subtitle">Estrutura ilimitada de disciplinas, assuntos, bancas e tipos.</p><div className="section"><div className="section-body"><div className="toolbar"><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{[["discipline","Disciplinas"],["subject","Assuntos"],["source","Bancas / Origens"],["type","Tipos"]].map(([k,l])=><button key={k} className={"btn "+(kind===k?"primary":"")} onClick={()=>{setKind(k as any);setSearch("");}}>{l}</button>)}</div></div>{kind==="subject"&&<div className="field" style={{maxWidth:420,marginBottom:10}}><label>Filtrar por disciplina</label><select value={disciplineId} onChange={e=>setDisciplineId(e.target.value)}><option value="">Todas</option>{disciplines.map((d:Discipline)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}<form onSubmit={submit} style={{display:"flex",gap:8,marginBottom:12}}>{kind==="subject"&&<select className="field" style={{width:240,padding:9,border:"1px solid var(--border)",borderRadius:6}} value={disciplineId} onChange={e=>setDisciplineId(e.target.value)} required><option value="">Disciplina</option>{disciplines.map((d:Discipline)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>}<input style={{flex:1,border:"1px solid var(--border)",borderRadius:6,padding:9}} placeholder={"Novo "+(kind==="discipline"?"nome da disciplina":kind==="subject"?"nome do assunto":kind==="source"?"banca/origem":"tipo")} value={name} onChange={e=>setName(e.target.value)}/><button className="btn primary"><Plus size={15}/> Adicionar</button></form><input style={{width:"100%",border:"1px solid var(--border)",borderRadius:6,padding:9,marginBottom:10}} placeholder="Pesquisar…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="table-wrap"><table className="table"><thead><tr><th>Nome</th>{kind==="subject"&&<th>Disciplina</th>}<th className="right">Ações</th></tr></thead><tbody>{shown.map((x:any)=><tr key={x.id}><td>{x.name}</td>{kind==="subject"&&<td>{disciplines.find((d:Discipline)=>d.id===x.discipline_id)?.name}</td>}<td className="right"><button className="btn small danger" onClick={()=>remove(x.id)}><Trash2 size={13}/> Excluir</button></td></tr>)}{!shown.length&&<tr><td colSpan={3}><div className="empty">Nenhum cadastro encontrado.</div></td></tr>}</tbody></table></div></div></div></>
}

function SettingsPage({dailyGoal,targetAccuracy,setDailyGoal,setTargetAccuracy,flash,fail}:any){
 const save=async()=>{try{writeStore(STORE.settings,{daily_goal:Math.max(1,Number(dailyGoal)),target_accuracy:Math.min(100,Math.max(0,Number(targetAccuracy)))});flash("Configurações salvas.");}catch(e){fail(e)}};
 return <><h1 className="page-title">Configurações</h1><p className="subtitle">Metas usadas pelo Dashboard.</p><section className="section"><div className="section-body"><div className="form-grid"><div className="field"><label>Meta diária de questões</label><input type="number" min="1" value={dailyGoal} onChange={e=>setDailyGoal(Number(e.target.value))}/></div><div className="field"><label>Meta de aproveitamento (%)</label><input type="number" min="0" max="100" value={targetAccuracy} onChange={e=>setTargetAccuracy(Number(e.target.value))}/></div></div><button className="btn primary" style={{marginTop:14}} onClick={save}><Target size={15}/> Salvar metas</button></div></section><section className="section"><div className="section-head">EXPORTAÇÃO</div><div className="section-body"><p style={{color:"var(--muted)",fontSize:13}}>A exportação respeita os dados carregados no período filtrado. Use a área de lançamentos para conferência antes de exportar.</p><button className="btn" disabled><FileDown size={15}/> Exportar CSV — próxima etapa</button></div></section></>
}

export default App;
