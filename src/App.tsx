import { Component, type ErrorInfo, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { BarChart3, Bell, BookOpen, CheckCircle2, Clipboard, Copy, FileDown, GripVertical, LogOut, Plus, Settings, Target, Trash2, Upload, X } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Discipline, Entry, Filters, QuestionType, Source, Subject } from "./types";
import { supabase } from "./integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { MCR_LOGO } from "./mcrLogo";

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
const monthBounds = (date = new Date()) => {
  const year = date.getFullYear(), month = date.getMonth();
  const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { from: format(new Date(year, month, 1, 12)), to: format(new Date(year, month + 1, 0, 12)), year, month };
};
const isLastDayOfMonth = (date = new Date()) => date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const monthLabel = (date = new Date()) => date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
            <img className="mcr-logo mcr-logo-fatal" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" />
            <p>O aplicativo encontrou um erro inesperado.</p>{this.state.error?.message && <div className="auth-error" style={{marginBottom:"14px",textAlign:"left"}}>{this.state.error.message}</div>}
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
      const client = supabase;
      const result = mode === "login"
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password });

      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMode("login");
        setError("Conta criada. O projeto de autenticação está configurado para confirmação de e-mail; faça a confirmação antes de entrar.");
      } else if (mode === "signup") {
        setError("");
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
      <img className="mcr-logo mcr-logo-auth" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" />
      <p>{mode === "login" ? "Sua preparação para concursos sob controle." : "Crie sua conta com e-mail e senha."}</p>
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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [catalogDeleteOpen, setCatalogDeleteOpen] = useState(false);
  const [catalogDeletePassword, setCatalogDeletePassword] = useState("");
  const [catalogDeleteBusy, setCatalogDeleteBusy] = useState(false);

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

  const exportMonthlyPdf = async (referenceDate = new Date()) => {
    if (!session?.user.id) return;
    const { from, to } = monthBounds(referenceDate);
    const { data, error } = await (supabase as any).from("study_entries").select("*").gte("study_date", from).lte("study_date", to).order("study_date", { ascending: true });
    if (error) { notify(error.message); return; }
    const monthlyEntries = (data ?? []) as Entry[];
    const questions = monthlyEntries.reduce((sum: number, entry: Entry) => sum + Number(entry.questions || 0), 0);
    const correct = monthlyEntries.reduce((sum: number, entry: Entry) => sum + Number(entry.correct || 0), 0);
    const errors = questions - correct, accuracy = percent(correct, questions);
    const days = new Set(monthlyEntries.map((entry: Entry) => entry.study_date)).size;
    const byDisciplineMonthly = disciplines.map((discipline) => {
      const rows = monthlyEntries.filter((entry: Entry) => entry.discipline_id === discipline.id);
      const total = rows.reduce((sum: number, row: Entry) => sum + Number(row.questions || 0), 0);
      const hits = rows.reduce((sum: number, row: Entry) => sum + Number(row.correct || 0), 0);
      return { name: discipline.name, questions: total, correct: hits, errors: total - hits, accuracy: percent(hits, total) };
    }).filter((item) => item.questions > 0).sort((a, b) => b.accuracy - a.accuracy);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFillColor(214, 51, 132); doc.rect(0, 0, 210, 9, "F");
    doc.setTextColor(42, 24, 35); doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text("MCR — Meu Controle de Rendimento", 14, 25);
    doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(105, 91, 100);
    doc.text("Resumo mensal — " + monthLabel(referenceDate), 14, 33);
    doc.setDrawColor(238, 221, 231); doc.line(14, 39, 196, 39);
    const cards = [["Questões", questions.toLocaleString("pt-BR")], ["Acertos", correct.toLocaleString("pt-BR")], ["Erros", errors.toLocaleString("pt-BR")], ["Aproveitamento", accuracy.toFixed(1) + "%"], ["Dias estudados", String(days)], ["Meta", targetAccuracy + "%"]];
    cards.forEach(([label, value], index) => {
      const x = 14 + (index % 3) * 61, y = 47 + Math.floor(index / 3) * 25;
      doc.setFillColor(252, 244, 248); doc.roundedRect(x, y, 57, 20, 3, 3, "F");
      doc.setTextColor(120, 102, 113); doc.setFontSize(8); doc.text(label.toUpperCase(), x + 4, y + 7);
      doc.setTextColor(42, 24, 35); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(value, x + 4, y + 15); doc.setFont("helvetica", "normal");
    });
    autoTable(doc, { startY: 105, head: [["Disciplina", "Questões", "Acertos", "Erros", "Aproveitamento"]], body: byDisciplineMonthly.map((item) => [item.name, item.questions, item.correct, item.errors, item.accuracy.toFixed(1) + "%"]), theme: "grid", headStyles: { fillColor: [214, 51, 132], textColor: 255, fontStyle: "bold", fontSize: 8 }, bodyStyles: { fontSize: 8, textColor: [55, 65, 81] }, alternateRowStyles: { fillColor: [252, 249, 251] }, styles: { cellPadding: 3 } });
    const finalY = (doc as any).lastAutoTable?.finalY ?? 120;
    doc.setFontSize(9); doc.setTextColor(105, 91, 100);
    doc.text("Diferença para a meta: " + (accuracy - targetAccuracy).toFixed(1) + " p.p.", 14, finalY + 12);
    doc.text("Relatório gerado pelo MCR.", 14, finalY + 19);
    doc.save("MCR-rendimento-" + referenceDate.getFullYear() + "-" + String(referenceDate.getMonth() + 1).padStart(2, "0") + ".pdf");
    setNotificationOpen(false); notify("PDF mensal exportado.");
  };

  const exportAnnualBackup = async (referenceDate = new Date()) => {
    if (!session?.user.id) return;
    const client = supabase as any;
    const tables = [
      ["study_disciplines", "disciplinas"],
      ["study_subjects", "assuntos"],
      ["study_sources", "fontes"],
      ["study_question_types", "tipos_questao"],
      ["study_entries", "lancamentos"],
      ["study_settings", "configuracoes"],
    ] as const;
    const results = await Promise.all(tables.map(async ([table, key]) => {
      const { data, error } = await client.from(table).select("*");
      return { key, data, error };
    }));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      notify("Não foi possível gerar o backup anual.");
      return;
    }
    const backup = {
      format: "MCR_BACKUP",
      version: 1,
      exported_at: new Date().toISOString(),
      reference_year: referenceDate.getFullYear(),
      user_id: session.user.id,
      data: Object.fromEntries(results.map((result) => [result.key, result.data ?? []])),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MCR-backup-" + referenceDate.getFullYear() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotificationOpen(false);
    notify("Backup anual exportado.");
  };

  const deleteAllCatalogData = async () => {
    if (!session?.user.email || !catalogDeletePassword) return;
    setCatalogDeleteBusy(true);
    try {
      const client = supabase;
      const authResult = await client.auth.signInWithPassword({ email: session.user.email, password: catalogDeletePassword });
      if (authResult.error) {
        notify("Senha incorreta. O cadastro não foi alterado.");
        return;
      }
      const tables = ["study_subjects", "study_disciplines", "study_sources", "study_question_types"];
      for (const table of tables) {
        const { error } = await (client as any).from(table).delete().not("id", "is", null);
        if (error) throw error;
      }
      writeStore("mcr_discipline_order", []);
      setDisciplines([]); setSubjects([]); setSources([]); setTypes([]);
      setCatalogDeletePassword(""); setCatalogDeleteOpen(false);
      notify("Cadastro zerado. Seus lançamentos e rendimento foram preservados.");
    } catch (error) {
      notify(error instanceof Error ? "Não foi possível zerar o cadastro: " + error.message : "Não foi possível zerar o cadastro.");
    } finally {
      setCatalogDeleteBusy(false);
    }
  };

  const logout = async () => {
    setToast("");
    const { error } = await supabase.auth.signOut();
    if (error) setToast("Não foi possível sair. Tente novamente.");
  };

  const loadCatalog = async () => {
    if (!session?.user.id) return;
    const client = supabase as any;
    const [disciplinesResult, subjectsResult, sourcesResult, typesResult, settingsResult] = await Promise.all([
      client.from("study_disciplines").select("*").order("created_at", { ascending: true }),
      client.from("study_subjects").select("*").order("created_at", { ascending: true }),
      client.from("study_sources").select("*").order("name"),
      client.from("study_question_types").select("*").order("name"),
      client.from("study_settings").select("*").maybeSingle(),
    ]);
    const firstError = [disciplinesResult, subjectsResult, sourcesResult, typesResult, settingsResult].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    setDisciplines(disciplinesResult.data ?? []);
    setSubjects(subjectsResult.data ?? []);
    setSources(sourcesResult.data ?? []);
    setTypes(typesResult.data ?? []);
    if (settingsResult.data) {
      setDailyGoal(settingsResult.data.daily_goal);
      setTargetAccuracy(settingsResult.data.target_accuracy);
    } else {
      setDailyGoal(100);
      setTargetAccuracy(80);
    }
  };

  const loadEntries = async () => {
    if (!session?.user.id) return;
    const client = supabase as any;
    const { data, error } = await client
      .from("study_entries")
      .select("*")
      .gte("study_date", applied.from)
      .lte("study_date", applied.to)
      .order("study_date", { ascending: false });
    if (error) throw error;
    const filtered = (data ?? []).filter((entry: Entry) =>
      (!applied.disciplineId || entry.discipline_id === applied.disciplineId) &&
      (!applied.subjectId || entry.subject_id === applied.subjectId) &&
      (!applied.sourceId || entry.source_id === applied.sourceId)
    );
    setEntries(filtered);
  };

  useEffect(() => {
    if (!session) return;
    Promise.all([loadCatalog(), loadEntries()]).catch((error) => {
      setToast(error instanceof Error ? error.message : "Não foi possível carregar os dados da conta.");
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (!session) return;
    loadEntries().catch((error) => {
      setToast(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos.");
    });
  }, [session?.user.id, applied.from, applied.to, applied.disciplineId, applied.subjectId, applied.sourceId]);

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
    const nextDailyGoal = Math.max(1, Number(dailyGoal) || 1);
    const nextTargetAccuracy = Math.min(100, Math.max(0, Number(targetAccuracy) || 0));
    (async () => {
      const client = supabase as any;
      const { error } = await client.from("study_settings").upsert({
        user_id: session.user.id,
        daily_goal: nextDailyGoal,
        target_accuracy: nextTargetAccuracy,
      }, { onConflict: "user_id" });
      notify(error ? error.message : "Configurações salvas.");
    })();
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

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  if (authLoading) return <div className="fatal"><div className="fatal-card"><img className="mcr-logo mcr-logo-fatal" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /><p>Carregando sua sessão…</p></div></div>;
  if (authError && !session) return <div className="fatal"><div className="fatal-card"><img className="mcr-logo mcr-logo-fatal" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /><p>{authError}</p><button className="btn primary" onClick={() => window.location.reload()}>Tentar novamente</button></div></div>;
  if (!session) return <AuthScreen />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><img className="mcr-logo mcr-logo-header" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /></div>
        <div className="top-actions"><div className="notification-wrap"><button className="notification-btn" aria-label="Notificações" onClick={() => setNotificationOpen((value) => !value)}><Bell size={17}/>{isLastDayOfMonth() && <span className="notification-badge">1</span>}</button>{notificationOpen && <div className="notification-panel"><div className="notification-panel-head"><strong>Notificações</strong><button onClick={() => setNotificationOpen(false)} aria-label="Fechar"><X size={14}/></button></div>{isLastDayOfMonth() ? <><button className="monthly-notification" onClick={() => exportMonthlyPdf()}><span className="notification-icon"><FileDown size={15}/></span><span><strong>Seu rendimento mensal está pronto</strong><small>Exporte o resumo mensal em PDF.</small></span></button>{new Date().getMonth() === 11 && <button className="monthly-notification" onClick={() => exportAnnualBackup()}><span className="notification-icon"><Upload size={15}/></span><span><strong>Backup anual disponível</strong><small>Faça o backup dos seus dados antes de encerrar o ano.</small></span></button>}</> : <div className="notification-empty">Nenhuma notificação nova.</div>}</div>}</div><span className="user">{session.user.email}</span><button className="btn small" onClick={logout}><LogOut size={14}/> Sair</button></div>
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
              byDiscipline={byDiscipline} attention={attention} targetAccuracy={targetAccuracy} entries={entries} onExportMonthly={() => exportMonthlyPdf()}
            />
          )}
          {tab === "entries" && <Entries disciplines={disciplines} subjects={subjects} sources={sources} types={types} entries={entries} refresh={() => loadEntries().catch((error) => notify(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos."))} notify={notify}/>}
          {tab === "catalog" && <Catalog disciplines={disciplines} subjects={subjects} sources={sources} types={types} refresh={() => loadCatalog().catch((error) => notify(error instanceof Error ? error.message : "Não foi possível carregar o cadastro."))} notify={notify}/>}
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
      <div className="dashboard-heading"><p className="subtitle">Visão consolidada dos lançamentos reais do período selecionado.</p><button className="btn export-pdf-btn" onClick={props.onExportMonthly}><FileDown size={15}/> Exportar rendimento mensal</button></div>

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

      <PerformanceCharts entries={props.entries} byDiscipline={props.byDiscipline} targetAccuracy={props.targetAccuracy} />

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

function PerformanceCharts({ entries, byDiscipline, targetAccuracy }: any) {
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const chartData = useMemo(() => {
    const end = entries.length ? entries.reduce((latest: string, item: Entry) => item.study_date > latest ? item.study_date : latest, entries[0].study_date) : localDate();
    const endDate = new Date(end + "T12:00:00");
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - range + 1);
    const rows = Array.from({ length: range }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const dayEntries = entries.filter((item: Entry) => item.study_date === key);
      const questions = dayEntries.reduce((sum: number, item: Entry) => sum + Number(item.questions || 0), 0);
      const correct = dayEntries.reduce((sum: number, item: Entry) => sum + Number(item.correct || 0), 0);
      return { date: key, label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""), questions, correct };
    });
    if (range <= 30) return rows;
    const weekly: any[] = [];
    for (let i = 0; i < rows.length; i += 7) {
      const group = rows.slice(i, i + 7);
      weekly.push({
        date: group[0].date,
        label: "Sem. " + (weekly.length + 1),
        questions: group.reduce((sum, row) => sum + row.questions, 0),
        correct: group.reduce((sum, row) => sum + row.correct, 0),
      });
    }
    return weekly;
  }, [entries, range]);

  const maxQuestions = Math.max(1, ...chartData.map((item: any) => item.questions));
  const width = 900;
  const height = 280;
  const pad = { top: 28, right: 18, bottom: 44, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, chartData.length);
  const barW = Math.min(20, slot * 0.30);

  return (
    <div className="performance-charts">
      <section className="chart-card chart-card-wide">
        <div className="chart-card-head">
          <div>
            <div className="chart-eyebrow">ANÁLISE DE PERFORMANCE</div>
            <h2>Questões × Acertos</h2>
            <p>Volume de questões e desempenho no período selecionado.</p>
          </div>
          <div className="chart-range">
            {[7, 30, 90].map((days) => <button key={days} className={range === days ? "active" : ""} onClick={() => setRange(days as 7 | 30 | 90)}>{days} dias</button>)}
          </div>
        </div>
        <div className="chart-legend"><span><i className="legend-dot questions"/>Questões</span><span><i className="legend-dot correct"/>Acertos</span></div>
        <div className="bar-chart-wrap">
          <svg viewBox={"0 0 " + width + " " + height} className="performance-svg" role="img" aria-label="Gráfico de questões e acertos">
            <defs>
              <linearGradient id="mcrQuestions" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d63384"/><stop offset="100%" stopColor="#9f165f"/></linearGradient>
              <linearGradient id="mcrCorrect" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#37b87a"/><stop offset="100%" stopColor="#16865a"/></linearGradient>
              <filter id="mcrGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            {[0, .25, .5, .75, 1].map((step) => {
              const y = pad.top + innerH * (1 - step);
              return <g key={step}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid-line"/><text x={pad.left - 9} y={y + 4} textAnchor="end" className="chart-axis-label">{Math.round(maxQuestions * step)}</text></g>;
            })}
            {chartData.map((item: any, index: number) => {
              const x = pad.left + slot * index + slot / 2;
              const qH = (item.questions / maxQuestions) * innerH;
              const cH = (item.correct / maxQuestions) * innerH;
              return <g key={item.date}>
                <title>{item.label + " — " + item.questions + " questões, " + item.correct + " acertos"}</title>
                <rect x={x - barW - 2} y={pad.top + innerH - qH} width={barW} height={qH} rx="5" fill="url(#mcrQuestions)" opacity=".95" filter="url(#mcrGlow)"/>
                <rect x={x + 2} y={pad.top + innerH - cH} width={barW} height={cH} rx="5" fill="url(#mcrCorrect)" opacity=".95"/>
                <text x={x} y={height - 16} textAnchor="middle" className="chart-x-label">{item.label}</text>
              </g>;
            })}
          </svg>
        </div>
      </section>

      <section className="chart-card">
        <div className="chart-card-head compact">
          <div>
            <div className="chart-eyebrow">PERFORMANCE ACADÊMICA</div>
            <h2>Desempenho por disciplina</h2>
            <p>Compare seu aproveitamento com a meta configurada.</p>
          </div>
        </div>
        <div className="discipline-chart">
          {byDiscipline.length ? byDiscipline.slice().sort((a: any, b: any) => b.accuracy - a.accuracy).map((item: any) => {
            const value = Math.min(100, Math.max(0, item.accuracy));
            const target = Math.min(100, Math.max(0, targetAccuracy));
            return <div className="discipline-row" key={item.id} title={item.name + ": " + value.toFixed(1) + "% — " + item.questions + " questões"}>
              <div className="discipline-meta"><span>{item.name}</span><strong>{value.toFixed(1)}%</strong></div>
              <div className="discipline-track">
                <span className="discipline-fill" style={{ width: value + "%" }} />
                <span className="discipline-target" style={{ left: target + "%" }} />
              </div>
              <div className="discipline-foot"><span>{item.questions.toLocaleString("pt-BR")} questões · {item.correct.toLocaleString("pt-BR")} acertos</span><span>{value >= target ? "Acima da meta" : (target - value).toFixed(1) + " p.p. abaixo"}</span></div>
            </div>;
          }) : <div className="empty">Nenhum lançamento no período.</div>}
        </div>
        {byDiscipline.length > 0 && <div className="target-note"><span className="target-marker"/> Meta: {targetAccuracy}%</div>}
      </section>
    </div>
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

  const save = async (value: any) => {
    const client = supabase as any;
    const payload = {
      study_date: value.study_date,
      discipline_id: value.discipline_id,
      subject_id: value.subject_id,
      source_id: value.source_id || null,
      question_type_id: value.question_type_id || null,
      questions: Number(value.questions),
      correct: Number(value.correct),
      notes: value.notes || null,
    };
    const result = editing
      ? await client.from("study_entries").update(payload).eq("id", editing.id)
      : await client.from("study_entries").insert(payload);
    if (result.error) return notify(result.error.message);
    notify(editing ? "Lançamento atualizado." : "Lançamento criado.");
    setOpen(false); setEditing(null); refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir este lançamento?")) return;
    const client = supabase as any;
    const { error } = await client.from("study_entries").delete().eq("id", id);
    notify(error ? error.message : "Lançamento excluído.");
    if (!error) refresh();
  };

  return <>
    <div className="toolbar"><div><h1 className="page-title">Lançamentos</h1><p className="subtitle">Registre suas sessões de questões na sua conta.</p></div><button className="btn primary" onClick={() => {setEditing(null);setOpen(true)}}><Plus size={15}/> Novo lançamento</button></div>
    <section className="section"><div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Disciplina</th><th>Assunto</th><th>Origem</th><th>Tipo</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>%</th><th>Observações</th><th>Ações</th></tr></thead><tbody>
      {entries.length ? entries.map((entry: Entry) => <tr key={entry.id}><td>{new Date(`${entry.study_date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{disciplines.find((x: Discipline)=>x.id===entry.discipline_id)?.name ?? "—"}</td><td>{subjects.find((x: Subject)=>x.id===entry.subject_id)?.name ?? "—"}</td><td>{sources.find((x: Source)=>x.id===entry.source_id)?.name ?? "—"}</td><td>{types.find((x: QuestionType)=>x.id===entry.question_type_id)?.name ?? "—"}</td><td>{entry.questions}</td><td>{entry.correct}</td><td>{entry.questions-entry.correct}</td><td>{percent(entry.correct,entry.questions).toFixed(1)}%</td><td>{entry.notes ?? "—"}</td><td className="actions"><button className="btn small" onClick={() => {setEditing(entry);setOpen(true)}}>Editar</button><button className="btn small danger" onClick={() => remove(entry.id)}><Trash2 size={13}/></button></td></tr>) : <tr><td colSpan={11}><div className="empty">Nenhum lançamento encontrado.</div></td></tr>}
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

function BulkImportModal({onClose,onImported,notify}:any) {
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);

  const prompt = `Você é responsável por transformar um edital de concurso no padrão de importação do Digital Evidence Vault.

REGRAS OBRIGATÓRIAS:
1. Identifique todas as disciplinas/matérias do edital.
2. Identifique todos os assuntos e subassuntos cobrados.
3. Preserve fielmente o conteúdo do edital. NÃO invente assuntos.
4. Agrupe cada assunto dentro da disciplina correta.
5. Remova apenas numerações hierárquicas desnecessárias (1., 1.1, 1.1.1 etc.).
6. Não inclua explicações, comentários, resumos ou observações.
7. Retorne SOMENTE neste formato:

DISCIPLINA: Nome da disciplina
ASSUNTO: Nome do assunto
ASSUNTO: Nome do assunto

DISCIPLINA: Outra disciplina
ASSUNTO: Nome do assunto
ASSUNTO: Nome do assunto

EDITAL:
[COLE AQUI O EDITAL COMPLETO]`;

  const copyPrompt=async()=>{
    try {
      await navigator.clipboard.writeText(prompt);
      notify("Prompt copiado. Cole no ChatGPT junto com o edital.");
    } catch {
      notify("Não foi possível copiar automaticamente. Selecione e copie o prompt.");
    }
  };

  const parse=()=>{
    const disciplines:{name:string;subjects:string[]}[]=[];
    let current:{name:string;subjects:string[]}|null=null;
    for(const raw of text.split(/\r?\n/)){
      const line=raw.trim();
      if(!line) continue;
      const normalized=line.replace(/^[-*•\s]+/, "").replace(/^\\*\\*(.*?)\\*\\*$/, "$1").trim();
      const dm=normalized.match(/^DISCIPLINA\s*:\s*(.+)$/i);
      const sm=normalized.match(/^ASSUNTO\s*:\s*(.+)$/i);
      if(dm){
        current={name:dm[1].trim(),subjects:[]};
        disciplines.push(current);
      } else if(sm && current){
        current.subjects.push(sm[1].trim());
      }
    }
    return disciplines.filter(d=>d.name&&d.subjects.length);
  };

  const importAll=async()=>{
    const parsed=parse();
    if(!parsed.length) return notify("Cole o conteúdo no padrão DISCIPLINA:/ASSUNTO: antes de importar.");
    setBusy(true);
    try{
      const client=supabase as any;
      let createdD=0,createdS=0;
      for(const item of parsed){
        const {data:existingD,error:dError}=await client.from("study_disciplines").select("id,name").ilike("name",item.name).maybeSingle();
        if(dError) throw dError;
        let disciplineId=existingD?.id;
        if(!disciplineId){
          const {data:newD,error}=await client.from("study_disciplines").insert({name:item.name,created_at:new Date(Date.now() + createdD).toISOString()}).select("id").single();
          if(error) throw error;
          disciplineId=newD.id;
          createdD++;
        }
        for(const subjectName of [...new Set(item.subjects)]){
          const {data:existingS,error:sError}=await client.from("study_subjects").select("id").eq("discipline_id",disciplineId).ilike("name",subjectName).maybeSingle();
          if(sError) throw sError;
          if(existingS) continue;
          const {error}=await client.from("study_subjects").insert({name:subjectName,discipline_id:disciplineId,created_at:new Date(Date.now() + createdS).toISOString()});
          if(error) throw error;
          createdS++;
        }
      }
      notify(`Edital importado: ${createdD} disciplinas e ${createdS} assuntos adicionados. Duplicados foram ignorados.`);
      await onImported();
      onClose();
    }catch(error){
      notify(error instanceof Error ? error.message : "Não foi possível importar o edital.");
    }finally{setBusy(false);}
  };

  const count=parse();
  return <div className="modal-backdrop"><div className="modal" style={{maxWidth:"900px"}}>
    <div className="toolbar"><div><h2>Adicionar edital em lote</h2><p className="subtitle">Use o ChatGPT para organizar o edital no padrão e cole o resultado abaixo.</p></div><button className="btn small" onClick={onClose}>Fechar</button></div>
    <section className="section"><div className="section-head">1. COPIE O PROMPT PARA O CHATGPT</div><div className="section-body">
      <div className="notice">O prompt instrui o ChatGPT a devolver somente disciplinas e assuntos no formato aceito pelo sistema.</div>
      <textarea readOnly rows={12} value={prompt} style={{width:"100%",fontFamily:"monospace"}}/>
      <button className="btn primary" onClick={copyPrompt}><Copy size={15}/> Copiar prompt para o ChatGPT</button>
    </div></section>
    <section className="section"><div className="section-head">2. COLE A RESPOSTA DO CHATGPT</div><div className="section-body">
      <textarea rows={12} value={text} onChange={e=>setText(e.target.value)} placeholder={"DISCIPLINA: Direito Constitucional\nASSUNTO: Princípios fundamentais\nASSUNTO: Direitos e garantias fundamentais\n\nDISCIPLINA: Direito Administrativo\nASSUNTO: Atos administrativos"}/>
      <div className="toolbar"><span>{count.length} disciplinas · {count.reduce((n,d)=>n+d.subjects.length,0)} assuntos reconhecidos</span><button className="btn primary" disabled={busy||!count.length} onClick={importAll}><Upload size={15}/>{busy?"Importando...":"Importar edital"}</button></div>
    </div></section>
  </div></div>;
}

function Catalog({disciplines,subjects,sources,types,refresh,notify}:any) {
  const [kind,setKind]=useState<"discipline"|"subject"|"source"|"type">("discipline");
  const [name,setName]=useState("");
  const [disciplineId,setDisciplineId]=useState("");
  const [search,setSearch]=useState("");
  const [bulkOpen,setBulkOpen]=useState(false);
  const [disciplineOrder,setDisciplineOrder]=useState<string[]>(() => readStore<string[]>("mcr_discipline_order", []));
  const [draggingId,setDraggingId]=useState<string | null>(null);

  const table=kind==="discipline"?"study_disciplines":kind==="subject"?"study_subjects":kind==="source"?"study_sources":"study_question_types";
  const baseList=(kind==="discipline"?disciplines:kind==="subject"?subjects:kind==="source"?sources:types);
  const orderedDisciplines = useMemo(() => {
    const ids = new Set(baseList.map((item:any)=>item.id));
    const saved = disciplineOrder.filter((id)=>ids.has(id));
    const missing = baseList.filter((item:any)=>!saved.includes(item.id)).map((item:any)=>item.id);
    return [...saved, ...missing].map((id)=>baseList.find((item:any)=>item.id===id)).filter(Boolean);
  }, [baseList, disciplineOrder]);
  const list=(kind==="discipline"?orderedDisciplines:baseList)
    .filter((item:any)=>!search||item.name.toLowerCase().includes(search.toLowerCase()))
    .filter((item:any)=>kind!=="subject"||!disciplineId||item.discipline_id===disciplineId);

  const moveDiscipline = (sourceId:string,targetId:string) => {
    if(sourceId===targetId) return;
    const current=orderedDisciplines.map((item:any)=>item.id);
    const from=current.indexOf(sourceId), to=current.indexOf(targetId);
    if(from<0||to<0)return;
    const next=[...current]; next.splice(from,1); next.splice(to,0,sourceId);
    setDisciplineOrder(next); writeStore("mcr_discipline_order",next);
    notify("Sequência das disciplinas salva.");
  };

  const add=async(event:FormEvent)=>{
    event.preventDefault();
    const clean=name.trim();
    if(!clean)return;
    if(kind==="subject"&&!disciplineId)return notify("Selecione a disciplina do assunto.");
    const client=supabase as any;
    const payload:any={name:clean};
    if(kind==="subject")payload.discipline_id=disciplineId;
    const {error}=await client.from(table).insert(payload);
    if(error)return notify(error.message);
    setName(""); notify("Cadastro adicionado."); refresh();
  };

  const remove=async(id:string)=>{
    if(!window.confirm("Excluir este item?"))return;
    const client=supabase as any;
    const {error}=await client.from(table).delete().eq("id",id);
    notify(error?error.message:"Cadastro excluído.");
    if(!error)refresh();
  };

  const tabs=[["discipline","Disciplinas"],["subject","Assuntos"],["source","Bancas / Origens"],["type","Tipos"]] as const;

  return <>
    <div className="toolbar">
      <div><h1 className="page-title">Cadastro</h1><p className="subtitle">Cadastre a estrutura usada nos lançamentos. Não há dados pré-preenchidos.</p></div>
      <div className="catalog-actions"><button className="btn primary" onClick={()=>setBulkOpen(true)}><Clipboard size={15}/> Adicionar edital em lote</button><button className="btn danger catalog-danger-btn" onClick={()=>setCatalogDeleteOpen(true)}>Zerar cadastro</button></div>
    </div>
    <section className="section"><div className="section-body">
      <div className="catalog-tabs">{tabs.map(([id,label])=><button key={id} className={kind===id?"btn primary":"btn"} onClick={()=>{setKind(id);setSearch("");}}>{label}</button>)}</div>
      {kind==="subject"&&<Field label="Disciplina para filtrar"><select value={disciplineId} onChange={e=>setDisciplineId(e.target.value)}><option value="">Todas</option>{disciplines.map((x:Discipline)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
      <form className="add-row" onSubmit={add}>
        {kind==="subject"&&<select value={disciplineId} onChange={e=>setDisciplineId(e.target.value)} required><option value="">Disciplina</option>{disciplines.map((x:Discipline)=><option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={kind==="discipline"?"Nova disciplina":kind==="subject"?"Novo assunto":kind==="source"?"Nova banca / origem":"Novo tipo"}/>
        <button className="btn primary"><Plus size={15}/> Adicionar</button>
      </form>
      <input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar cadastro..."/>
      <div className="table-wrap"><table className="table"><thead><tr><th>{kind==="discipline"?"Nome · arraste para ordenar":"Nome"}</th>{kind==="subject"&&<th>Disciplina</th>}<th>Ações</th></tr></thead><tbody>
        {list.length?list.map((item:any)=><tr key={item.id} draggable={kind==="discipline"} onDragStart={()=>kind==="discipline"&&setDraggingId(item.id)} onDragOver={(e)=>kind==="discipline"&&e.preventDefault()} onDrop={()=>kind==="discipline"&&draggingId&&moveDiscipline(draggingId,item.id)} onDragEnd={()=>setDraggingId(null)} className={draggingId===item.id?"row-dragging":""}><td>{kind==="discipline"&&<span className="drag-handle" title="Arraste para reordenar"><GripVertical size={15}/></span>}{item.name}</td>{kind==="subject"&&<td>{disciplines.find((d:Discipline)=>d.id===item.discipline_id)?.name??"—"}</td>}<td><button className="btn small danger" onClick={()=>remove(item.id)}><Trash2 size={13}/> Excluir</button></td></tr>):<tr><td colSpan={kind==="subject"?3:2}><div className="empty">Nenhum cadastro encontrado.</div></td></tr>}
      </tbody></table></div>
    </div></section>
    {bulkOpen&&<BulkImportModal onClose={()=>setBulkOpen(false)} onImported={refresh} notify={notify}/>}
    {catalogDeleteOpen&&<CatalogDeleteModal
      password={catalogDeletePassword}
      setPassword={setCatalogDeletePassword}
      busy={catalogDeleteBusy}
      onClose={()=>{if(!catalogDeleteBusy){setCatalogDeleteOpen(false);setCatalogDeletePassword("");}}}
      onConfirm={deleteAllCatalogData}
    />}
  </>;
}

function CatalogDeleteModal({password,setPassword,busy,onClose,onConfirm}:any) {
  const [step,setStep]=useState<"warning"|"password">("warning");

  return <div className="modal-backdrop">
    <div className="modal catalog-delete-modal">
      {step==="warning" ? <>
        <div className="catalog-delete-icon"><Trash2 size={24}/></div>
        <h2>Excluir todo o cadastro?</h2>
        <p className="catalog-delete-lead">Esta ação vai apagar <strong>somente a estrutura cadastrada</strong> para que você não precise excluir item por item.</p>
        <div className="catalog-delete-list">
          <strong>Será apagado:</strong>
          <span>• Todas as disciplinas / matérias</span>
          <span>• Todos os assuntos</span>
          <span>• Todas as bancas / origens</span>
          <span>• Todos os tipos de questão</span>
        </div>
        <div className="catalog-delete-preserve">
          <strong>Não será apagado:</strong>
          <span>✓ Seus lançamentos de questões</span>
          <span>✓ Seu rendimento e histórico</span>
          <span>✓ Suas metas e configurações</span>
          <span>✓ Sua conta e seus dados de acesso</span>
        </div>
        <div className="warning-box">Essa operação não pode ser desfeita pelo sistema. Confira as informações acima antes de continuar.</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn danger catalog-confirm-btn" onClick={()=>setStep("password")}>Continuar para exclusão</button>
        </div>
      </> : <>
        <div className="catalog-delete-icon"><Trash2 size={24}/></div>
        <h2>Confirme sua senha</h2>
        <p className="catalog-delete-lead">Por segurança, digite sua senha para autorizar a exclusão do cadastro.</p>
        <Field label="Senha da conta">
          <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Digite sua senha" onKeyDown={(e)=>{if(e.key==="Enter"&&!busy&&password)onConfirm();}} />
        </Field>
        <div className="warning-box">A senha será usada apenas para confirmar sua identidade. Ela não será armazenada pelo MCR.</div>
        <div className="modal-actions">
          <button className="btn" disabled={busy} onClick={()=>setStep("warning")}>Voltar</button>
          <button className="btn danger catalog-confirm-btn" disabled={busy||!password} onClick={onConfirm}>{busy?"Excluindo...":"Confirmar e apagar cadastro"}</button>
        </div>
      </>}
    </div>
  </div>;
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
