import { Component, type ErrorInfo, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CheckCircle2, LogOut, Plus, Settings, Target, Trash2 } from "lucide-react";
import type { Discipline, Entry, Filters, QuestionType, Source, Subject } from "./types";
import { supabase } from "./integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const STORE = {
  disciplines: "dev_disciplines",
  subjects: "dev_subjects",
  sources: "dev_sources",
  types: "dev_types",
  entries: "dev_entries",
  settings: "dev_settings",
} as const;

const localDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dateMinus = (days: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const percent = (correct: number, questions: number) => questions > 0 ? (correct / questions) * 100 : 0;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readStore<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const emptyFilters = (): Filters => ({
  disciplineId: "",
  subjectId: "",
  sourceId: "",
  from: dateMinus(29),
  to: localDate(),
});

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Digital Evidence Vault runtime error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <div className="fatal-card">
            <div className="brand-mark">D</div>
            <h1>Digital Evidence Vault</h1>
            <p>O aplicativo encontrou um erro inesperado ao carregar esta tela.</p>
            <button className="btn primary" onClick={() => window.location.reload()}>Recarregar aplicativo</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMode("login");
        setError("Conta criada. Faça login para entrar.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível autenticar.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="auth-page">
    <div className="auth-card">
      <div className="brand-mark">D</div>
      <h1>Digital Evidence Vault</h1>
      <p>{mode === "login" ? "Entre na sua conta para acessar seus estudos." : "Crie sua conta com e-mail e senha."}</p>
      <form onSubmit={submit} className="auth-form">
        <Field label="E-mail"><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></Field>
        <Field label="Senha"><input required minLength={6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        {error && <div className="auth-error">{error}</div>}
        <button className="btn primary auth-submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
      </form>
      <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
        {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
      </button>
    </div>
  </div>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<"dashboard" | "entries" | "catalog" | "settings">("dashboard");
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [dailyGoal, setDailyGoal] = useState(100);
  const [targetAccuracy, setTargetAccuracy] = useState(80);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    }).catch((error) => {
      if (!mounted) return;
      setAuthError(error instanceof Error ? error.message : "Erro ao carregar a sessão.");
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    setToast("");
    const { error } = await supabase.auth.signOut();
    if (error) setToast("Não foi possível sair. Tente novamente.");
  };

  if (authLoading) return <div className="fatal"><div className="fatal-card"><div className="brand-mark">D</div><h1>Digital Evidence Vault</h1><p>Carregando sua sessão…</p></div></div>;
  if (authError && !session) return <div className="fatal"><div className="fatal-card"><div className="brand-mark">D</div><h1>Digital Evidence Vault</h1><p>{authError}</p><button className="btn primary" onClick={() => window.location.reload()}>Tentar novamente</button></div></div>;
  if (!session) return <AuthScreen />;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const reloadCatalog = () => {
    setDisciplines(readStore<Discipline[]>(STORE.disciplines, []));
    setSubjects(readStore<Subject[]>(STORE.subjects, []));
    setSources(readStore<Source[]>(STORE.sources, []));
    setTypes(readStore<QuestionType[]>(STORE.types, []));
    const settings = readStore<{ daily_goal?: number; target_accuracy?: number }>(STORE.settings, {});
    if (typeof settings.daily_goal === "number") setDailyGoal(settings.daily_goal);
    if (typeof settings.target_accuracy === "number") setTargetAccuracy(settings.target_accuracy);
  };

  const reloadEntries = () => {
    const all = readStore<Entry[]>(STORE.entries, []);
    const filtered = all
      .filter((entry) =>
        entry.study_date >= applied.from &&
        entry.study_date <= applied.to &&
        (!applied.disciplineId || entry.discipline_id === applied.disciplineId) &&
        (!applied.subjectId || entry.subject_id === applied.subjectId) &&
        (!applied.sourceId || entry.source_id === applied.sourceId)
      )
      .sort((a, b) => b.study_date.localeCompare(a.study_date));
    setEntries(filtered);
  };

  useEffect(() => {
    reloadCatalog();
  }, []);

  useEffect(() => {
    reloadEntries();
  }, [applied]);

  const totalQuestions = entries.reduce((sum, entry) => sum + Number(entry.questions || 0), 0);
  const totalCorrect = entries.reduce((sum, entry) => sum + Number(entry.correct || 0), 0);
  const totalErrors = totalQuestions - totalCorrect;
  const accuracy = percent(totalCorrect, totalQuestions);
  const todayEntries = entries.filter((entry) => entry.study_date === localDate());
  const todayQuestions = todayEntries.reduce((sum, entry) => sum + Number(entry.questions || 0), 0);
  const todayCorrect = todayEntries.reduce((sum, entry) => sum + Number(entry.correct || 0), 0);
  const daysStudied = new Set(entries.map((entry) => entry.study_date)).size;

  const byDiscipline = useMemo(() => disciplines.map((discipline) => {
    const rows = entries.filter((entry) => entry.discipline_id === discipline.id);
    const questions = rows.reduce((sum, row) => sum + row.questions, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    return { ...discipline, questions, correct, errors: questions - correct, accuracy: percent(correct, questions) };
  }).filter((item) => item.questions > 0), [disciplines, entries]);

  const bySubject = useMemo(() => subjects.map((subject) => {
    const rows = entries.filter((entry) => entry.subject_id === subject.id);
    const questions = rows.reduce((sum, row) => sum + row.questions, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    return {
      ...subject,
      questions,
      correct,
      errors: questions - correct,
      accuracy: percent(correct, questions),
      disciplineName: disciplines.find((d) => d.id === subject.discipline_id)?.name ?? "—",
    };
  }).filter((item) => item.questions > 0).sort((a, b) => a.accuracy - b.accuracy), [subjects, entries, disciplines]);

  const attention = bySubject.filter((item) => item.accuracy < targetAccuracy).slice(0, 10);

  const saveSettings = () => {
    const ok = writeStore(STORE.settings, {
      daily_goal: Math.max(1, Number(dailyGoal) || 1),
      target_accuracy: Math.min(100, Math.max(0, Number(targetAccuracy) || 0)),
    });
    notify(ok ? "Configurações salvas." : "Não foi possível salvar as configurações.");
  };

  const filteredSubjects = filters.disciplineId
    ? subjects.filter((subject) => subject.discipline_id === filters.disciplineId)
    : subjects;

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "disciplineId" ? { subjectId: "" } : {}),
    }));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div><strong>Digital Evidence Vault</strong><span>Controle de desempenho para concursos</span></div>
        </div>
        <div className="top-actions"><span className="user">{session.user.email}</span><button className="btn small" onClick={logout}><LogOut size={14}/> Sair</button></div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="nav">
            <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}><BarChart3 size={16}/> Dashboard</button>
            <button className={tab === "entries" ? "active" : ""} onClick={() => setTab("entries")}><CheckCircle2 size={16}/> Lançamentos</button>
            <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}><BookOpen size={16}/> Cadastro</button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings size={16}/> Configurações</button>
          </nav>
        </aside>

        <main className="content">
          {tab === "dashboard" && (
            <Dashboard
              filters={filters} setFilter={setFilter} disciplines={disciplines} subjects={filteredSubjects} sources={sources}
              onApply={() => { setApplied(filters); notify("Filtros aplicados."); }}
              onClear={() => { const next = emptyFilters(); setFilters(next); setApplied(next); }}
              totalQuestions={totalQuestions} totalCorrect={totalCorrect} totalErrors={totalErrors} accuracy={accuracy}
              daysStudied={daysStudied} todayQuestions={todayQuestions} todayCorrect={todayCorrect} dailyGoal={dailyGoal}
              byDiscipline={byDiscipline} attention={attention} targetAccuracy={targetAccuracy}
            />
          )}
          {tab === "entries" && <Entries disciplines={disciplines} subjects={subjects} sources={sources} types={types} entries={entries} refresh={reloadEntries} notify={notify}/>}
          {tab === "catalog" && <Catalog disciplines={disciplines} subjects={subjects} sources={sources} types={types} refresh={reloadCatalog} notify={notify}/>}
          {tab === "settings" && (
            <SettingsPage
              dailyGoal={dailyGoal}
              targetAccuracy={targetAccuracy}
              setDailyGoal={setDailyGoal}
              setTargetAccuracy={setTargetAccuracy}
              save={saveSettings}
            />
          )}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Dashboard(props: any) {
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="subtitle">Visão consolidada dos lançamentos reais do período selecionado.</p>

      <section className="section">
        <div className="section-head">FILTROS DE ANÁLISE</div>
        <div className="section-body">
          <div className="filters">
            <Field label="Disciplina"><select value={props.filters.disciplineId} onChange={(e) => props.setFilter("disciplineId", e.target.value)}><option value="">Todas</option>{props.disciplines.map((d: Discipline) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Assunto"><select value={props.filters.subjectId} onChange={(e) => props.setFilter("subjectId", e.target.value)}><option value="">Todos</option>{props.subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Banca / Origem"><select value={props.filters.sourceId} onChange={(e) => props.setFilter("sourceId", e.target.value)}><option value="">Todas</option>{props.sources.map((s: Source) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Data inicial"><input type="date" value={props.filters.from} onChange={(e) => props.setFilter("from", e.target.value)}/></Field>
            <Field label="Data final"><input type="date" value={props.filters.to} onChange={(e) => props.setFilter("to", e.target.value)}/></Field>
            <button className="btn primary" onClick={props.onApply}>Filtrar</button>
            <button className="btn" onClick={props.onClear}>Limpar</button>
          </div>
        </div>
      </section>

      <div className="metrics">
        <Metric label="Questões" value={props.totalQuestions}/>
        <Metric label="Acertos" value={props.totalCorrect} tone="good"/>
        <Metric label="Erros" value={props.totalErrors} tone="bad"/>
        <Metric label="Aproveitamento" value={props.accuracy} suffix="%" tone={props.accuracy >= props.targetAccuracy ? "good" : "warn"}/>
        <Metric label="Dias estudados" value={props.daysStudied}/>
        <Metric label="Média / dia" value={props.daysStudied ? props.totalQuestions / props.daysStudied : 0}/>
      </div>

      <section className="section">
        <div className="section-head">HOJE</div>
        <div className="section-body today-row">
          <div><strong>{props.todayQuestions}</strong> questões · <strong>{props.todayCorrect}</strong> acertos · <strong>{props.todayQuestions - props.todayCorrect}</strong> erros</div>
          <div className="goal"><div className="goal-line"><span>Meta diária: {props.dailyGoal}</span><b>{Math.min(100, (props.todayQuestions / Math.max(1, props.dailyGoal)) * 100).toFixed(0)}%</b></div><div className="progress"><span style={{width: `${Math.min(100, (props.todayQuestions / Math.max(1, props.dailyGoal)) * 100)}%`}}/></div></div>
        </div>
      </section>

      <div className="grid2">
        <DataTable title="DESEMPENHO POR DISCIPLINA" headers={["Disciplina","Questões","Acertos","Erros","%","Status"]} rows={props.byDiscipline.map((x: any) => [x.name,x.questions,x.correct,x.errors,`${x.accuracy.toFixed(1)}%`,<Status key={x.id} value={x.accuracy} target={props.targetAccuracy}/>])} empty="Nenhum lançamento no período."/>
        <DataTable title="PONTOS QUE PRECISAM DE ATENÇÃO" headers={["Assunto","Disciplina","Questões","%","Prioridade"]} rows={props.attention.map((x: any) => [x.name,props.disciplines?.find?.((d: Discipline) => d.id === x.discipline_id)?.name ?? x.disciplineName,x.questions,`${x.accuracy.toFixed(1)}%`,<Status key={x.id} value={x.accuracy} target={props.targetAccuracy}/>])} empty="Nenhum assunto abaixo da meta."/>
      </div>

      <section className="section">
        <div className="section-head">RESUMO RÁPIDO</div>
        <div className="section-body summary-grid">
          <div><span>Total no período</span><strong>{props.totalQuestions} questões</strong></div>
          <div><span>Precisão</span><strong>{props.accuracy.toFixed(1)}%</strong></div>
          <div><span>Meta configurada</span><strong>{props.targetAccuracy}%</strong></div>
          <div><span>Diferença para a meta</span><strong>{(props.accuracy - props.targetAccuracy).toFixed(1)} p.p.</strong></div>
        </div>
      </section>
    </>
  );
}

function Metric({label,value,suffix="",tone=""}:{label:string,value:number,suffix?:string,tone?:string}) {
  return <div className={`metric ${tone}`}><div className="metric-label">{label}</div><div className="metric-value">{Number(value || 0).toLocaleString("pt-BR", {maximumFractionDigits:1})}{suffix}</div></div>;
}

function Status({value,target}:{value:number,target:number}) {
  const tone = value >= target ? "good" : value >= 60 ? "warn" : "bad";
  return <span className={`status ${tone}`}>{value >= target ? "OK" : value >= 60 ? "REVISAR" : "FOCO"}</span>;
}

function DataTable({title,headers,rows,empty}:{title:string,headers:string[],rows:any[][],empty:string}) {
  return <section className="section"><div className="section-head">{title}</div><div className="table-wrap"><table className="table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}><div className="empty">{empty}</div></td></tr>}</tbody></table></div></section>;
}

function Field({label,children}:{label:string,children:ReactNode}) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function Entries({disciplines,subjects,sources,types,entries,refresh,notify}:any) {
  const [editing,setEditing] = useState<Entry | null>(null);
  const [open,setOpen] = useState(false);

  const save = (value: any) => {
    const all = readStore<Entry[]>(STORE.entries, []);
    const discipline = disciplines.find((x: Discipline) => x.id === value.discipline_id);
    const subject = subjects.find((x: Subject) => x.id === value.subject_id);
    const source = sources.find((x: Source) => x.id === value.source_id);
    const type = types.find((x: QuestionType) => x.id === value.question_type_id);
    const record: Entry = {
      id: editing?.id ?? uid(),
      study_date: value.study_date,
      discipline_id: value.discipline_id,
      subject_id: value.subject_id,
      source_id: value.source_id || null,
      question_type_id: value.question_type_id || null,
      questions: Number(value.questions),
      correct: Number(value.correct),
      notes: value.notes || null,
      discipline: discipline ? { name: discipline.name } : undefined,
      subject: subject ? { name: subject.name } : undefined,
      source: source ? { name: source.name } : undefined,
      question_type: type ? { name: type.name } : undefined,
    };
    const next = editing ? all.map((item) => item.id === editing.id ? record : item) : [record, ...all];
    if (!writeStore(STORE.entries, next)) return notify("Não foi possível salvar. Verifique o armazenamento do navegador.");
    notify(editing ? "Lançamento atualizado." : "Lançamento criado.");
    setOpen(false); setEditing(null); refresh();
  };

  const remove = (id: string) => {
    const all = readStore<Entry[]>(STORE.entries, []);
    if (!window.confirm("Excluir este lançamento?")) return;
    writeStore(STORE.entries, all.filter((item) => item.id !== id));
    notify("Lançamento excluído.");
    refresh();
  };

  return <>
    <div className="toolbar"><div><h1 className="page-title">Lançamentos</h1><p className="subtitle">Registre suas sessões de questões na sua conta.</p></div><button className="btn primary" onClick={() => {setEditing(null);setOpen(true)}}><Plus size={15}/> Novo lançamento</button></div>
    <section className="section"><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Disciplina</th><th>Assunto</th><th>Origem</th><th>Tipo</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>%</th><th>Observações</th><th>Ações</th></tr></thead><tbody>
      {entries.length ? entries.map((entry: Entry) => <tr key={entry.id}><td>{new Date(`${entry.study_date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{entry.discipline?.name ?? disciplines.find((x: Discipline)=>x.id===entry.discipline_id)?.name ?? "—"}</td><td>{entry.subject?.name ?? subjects.find((x: Subject)=>x.id===entry.subject_id)?.name ?? "—"}</td><td>{entry.source?.name ?? sources.find((x: Source)=>x.id===entry.source_id)?.name ?? "—"}</td><td>{entry.question_type?.name ?? types.find((x: QuestionType)=>x.id===entry.question_type_id)?.name ?? "—"}</td><td>{entry.questions}</td><td>{entry.correct}</td><td>{entry.questions-entry.correct}</td><td>{percent(entry.correct,entry.questions).toFixed(1)}%</td><td>{entry.notes ?? "—"}</td><td className="actions"><button className="btn small" onClick={() => {setEditing(entry);setOpen(true)}}>Editar</button><button className="btn small danger" onClick={() => remove(entry.id)}><Trash2 size={13}/></button></td></tr>) : <tr><td colSpan={11}><div className="empty">Nenhum lançamento encontrado.</div></td></tr>}
    </tbody></table></div></section>
    {open && <LaunchModal initial={editing} disciplines={disciplines} subjects={subjects} sources={sources} types={types} onClose={() => {setOpen(false);setEditing(null)}} onSave={save}/>}
  </>;
}

function LaunchModal({initial,disciplines,subjects,sources,types,onClose,onSave}:any) {
  const [value,setValue] = useState<any>({
    study_date: initial?.study_date ?? localDate(), discipline_id: initial?.discipline_id ?? "", subject_id: initial?.subject_id ?? "",
    source_id: initial?.source_id ?? "", question_type_id: initial?.question_type_id ?? "", questions: initial?.questions ?? "", correct: initial?.correct ?? "", notes: initial?.notes ?? "",
  });
  const availableSubjects = subjects.filter((s: Subject) => s.discipline_id === value.discipline_id);
  const errors = Math.max(0, Number(value.questions || 0) - Number(value.correct || 0));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const questions = Number(value.questions);
    const correct = Number(value.correct);
    if (!value.discipline_id || !value.subject_id) return window.alert("Selecione disciplina e assunto.");
    if (!Number.isFinite(questions) || questions < 1 || !Number.isFinite(correct) || correct < 0 || correct > questions) return window.alert("Informe questões maiores que zero e acertos entre 0 e o total.");
    onSave(value);
  };

  return <div className="modal-backdrop"><div className="modal"><div className="toolbar"><h2>{initial ? "Editar lançamento" : "Novo lançamento"}</h2><button className="btn small" onClick={onClose}>Fechar</button></div><form onSubmit={submit}>
    <div className="form-grid">
      <Field label="Data"><input type="date" value={value.study_date} onChange={(e)=>setValue({...value,study_date:e.target.value})}/></Field>
      <Field label="Disciplina"><select required value={value.discipline_id} onChange={(e)=>setValue({...value,discipline_id:e.target.value,subject_id:""})}><option value="">Selecione</option>{disciplines.map((x: Discipline)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Assunto"><select required value={value.subject_id} onChange={(e)=>setValue({...value,subject_id:e.target.value})}><option value="">Selecione</option>{availableSubjects.map((x: Subject)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Banca / origem"><select value={value.source_id} onChange={(e)=>setValue({...value,source_id:e.target.value})}><option value="">Nenhuma</option>{sources.map((x: Source)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Tipo"><select value={value.question_type_id} onChange={(e)=>setValue({...value,question_type_id:e.target.value})}><option value="">Nenhum</option>{types.map((x: QuestionType)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Questões"><input required min="1" type="number" value={value.questions} onChange={(e)=>setValue({...value,questions:e.target.value})}/></Field>
      <Field label="Acertos"><input required min="0" type="number" value={value.correct} onChange={(e)=>setValue({...value,correct:e.target.value})}/></Field>
      <Field label="Erros calculados"><input readOnly value={errors}/></Field>
      <Field label="Aproveitamento"><input readOnly value={value.questions ? `${percent(Number(value.correct),Number(value.questions)).toFixed(1)}%` : "—"}/></Field>
      <div className="field wide"><label>Observações</label><textarea rows={4} value={value.notes} onChange={(e)=>setValue({...value,notes:e.target.value})}/></div>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar lançamento</button></div>
  </form></div></div>;
}

function Catalog({disciplines,subjects,sources,types,refresh,notify}:any) {
  const [kind,setKind] = useState<"discipline"|"subject"|"source"|"type">("discipline");
  const [name,setName] = useState("");
  const [disciplineId,setDisciplineId] = useState("");
  const [search,setSearch] = useState("");

  const key = kind === "discipline" ? STORE.disciplines : kind === "subject" ? STORE.subjects : kind === "source" ? STORE.sources : STORE.types;
  const list = (kind === "discipline" ? disciplines : kind === "subject" ? subjects : kind === "source" ? sources : types)
    .filter((item: any) => !search || item.name.toLowerCase().includes(search.toLowerCase()))
    .filter((item: any) => kind !== "subject" || !disciplineId || item.discipline_id === disciplineId);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (kind === "subject" && !disciplineId) return notify("Selecione a disciplina do assunto.");
    const all = readStore<any[]>(key, []);
    const duplicate = all.some((item) => item.name.trim().toLowerCase() === clean.toLowerCase() && (kind !== "subject" || item.discipline_id === disciplineId));
    if (duplicate) return notify("Esse cadastro já existe.");
    const item: any = { id: uid(), name: clean };
    if (kind === "subject") item.discipline_id = disciplineId;
    if (!writeStore(key, [...all, item])) return notify("Não foi possível salvar o cadastro.");
    setName("");
    notify("Cadastro adicionado.");
    refresh();
  };

  const remove = (id: string) => {
    if (!window.confirm("Excluir este item?")) return;
    const all = readStore<any[]>(key, []);
    writeStore(key, all.filter((item) => item.id !== id));
    if (kind === "discipline") {
      const linkedSubjects = readStore<Subject[]>(STORE.subjects, []).filter((item) => item.discipline_id === id);
      if (linkedSubjects.length) writeStore(STORE.subjects, readStore<Subject[]>(STORE.subjects, []).filter((item) => item.discipline_id !== id));
    }
    notify("Cadastro excluído.");
    refresh();
  };

  const tabs = [["discipline","Disciplinas"],["subject","Assuntos"],["source","Bancas / Origens"],["type","Tipos"]] as const;

  return <>
    <h1 className="page-title">Cadastro</h1><p className="subtitle">Cadastre a estrutura usada nos lançamentos. Não há dados pré-preenchidos.</p>
    <section className="section"><div className="section-body">
      <div className="catalog-tabs">{tabs.map(([id,label]) => <button key={id} className={kind===id ? "btn primary" : "btn"} onClick={()=>{setKind(id);setSearch("");}}>{label}</button>)}</div>
      {kind === "subject" && <Field label="Disciplina para filtrar"><select value={disciplineId} onChange={(e)=>setDisciplineId(e.target.value)}><option value="">Todas</option>{disciplines.map((x: Discipline)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
      <form className="add-row" onSubmit={add}>
        {kind === "subject" && <select value={disciplineId} onChange={(e)=>setDisciplineId(e.target.value)} required><option value="">Disciplina</option>{disciplines.map((x: Discipline)=><option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder={kind==="discipline"?"Nova disciplina":kind==="subject"?"Novo assunto":kind==="source"?"Nova banca / origem":"Novo tipo"}/>
        <button className="btn primary"><Plus size={15}/> Adicionar</button>
      </form>
      <input className="search" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Pesquisar cadastro..."/>
      <div className="table-wrap"><table className="table"><thead><tr><th>Nome</th>{kind==="subject"&&<th>Disciplina</th>}<th>Ações</th></tr></thead><tbody>
        {list.length ? list.map((item: any)=><tr key={item.id}><td>{item.name}</td>{kind==="subject"&&<td>{disciplines.find((d: Discipline)=>d.id===item.discipline_id)?.name ?? "—"}</td>}<td><button className="btn small danger" onClick={()=>remove(item.id)}><Trash2 size={13}/> Excluir</button></td></tr>) : <tr><td colSpan={kind==="subject"?3:2}><div className="empty">Nenhum cadastro encontrado.</div></td></tr>}
      </tbody></table></div>
    </div></section>
  </>;
}

function SettingsPage({dailyGoal,targetAccuracy,setDailyGoal,setTargetAccuracy,save}:any) {
  return <>
    <h1 className="page-title">Configurações</h1><p className="subtitle">Defina as metas utilizadas pelo dashboard.</p>
    <section className="section"><div className="section-body"><div className="form-grid">
      <Field label="Meta diária de questões"><input type="number" min="1" value={dailyGoal} onChange={(e)=>setDailyGoal(Number(e.target.value))}/></Field>
      <Field label="Meta de aproveitamento (%)"><input type="number" min="0" max="100" value={targetAccuracy} onChange={(e)=>setTargetAccuracy(Number(e.target.value))}/></Field>
    </div><button className="btn primary settings-save" onClick={save}><Target size={15}/> Salvar metas</button></div></section>
    <section className="section"><div className="section-head">ARMAZENAMENTO</div><div className="section-body notice">Acesso protegido por conta individual. O logout encerra a sessão autenticada no navegador.</div></section>
  </>;
}

export default function RootApp() {
  return <AppErrorBoundary><App/></AppErrorBoundary>;
}
