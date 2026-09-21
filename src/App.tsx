import { Component, type ErrorInfo, type FormEvent, type ReactNode, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, AlertTriangle, BarChart3, Bell, Bold, BookOpen, CheckCircle2, ChevronDown, Clipboard, Copy, FileDown, GripVertical, Italic, LogOut, Maximize2, Minimize2, MoreHorizontal, Menu, PaintBucket, PanelLeftClose, PanelLeftOpen, Plus, PauseCircle, Redo2, RotateCcw, Settings, Sparkles, Strikethrough, Target, Trash2, Trophy, TrendingUp, Underline, Undo2, Upload, WrapText, X } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Discipline, Entry, Filters, PerformanceNotification, QuestionType, Source, Subject } from "./types";
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

type UserCloudPreferences = {
  theme?: "light" | "dark";
  buttonColor?: string;
  plannerDefaultColor?: string;
  plannerCompletedColor?: string;
  plannerSidebarCollapsed?: boolean;
};

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const dateOneMonthAgo = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const emptyFilters = (): Filters => ({
  disciplineId: "",
  subjectId: "",
  sourceId: "",
  from: dateOneMonthAgo(),
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
  const [tab, setTab] = useState<"dashboard" | "planner" | "entries" | "catalog" | "settings">("dashboard");
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [periodPreset, setPeriodPreset] = useState<"7"|"30"|"90"|"custom">("30");
  const [studentName, setStudentName] = useState("");
  const [dailyGoal, setDailyGoal] = useState(100);
  const [weeklyGoal, setWeeklyGoal] = useState(500);
  const [monthlyGoal, setMonthlyGoal] = useState(2000);
  const [targetAccuracy, setTargetAccuracy] = useState(80);
  const [plannerDefaultColor, setPlannerDefaultColor] = useState("#fff2cc");
  const [plannerCompletedColor, setPlannerCompletedColor] = useState("#d9ead3");
  const [theme, setTheme] = useState<"light" | "dark">(() => readStore<"light" | "dark">("mcr_theme", "light"));
  const [buttonColor, setButtonColor] = useState("#d63384");
  const [appFullscreen,setAppFullscreen]=useState(false);
  const [plannerSidebarCollapsed,setPlannerSidebarCollapsed]=useState(false);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [cloudStateReady,setCloudStateReady]=useState(false);
  const [settingsReady,setSettingsReady]=useState(false);
  const cloudPreferencesRemoteJson=useRef<string | null>(null);
  const preferencesSyncChannel=useRef<ReturnType<typeof supabase.channel> | null>(null);
  

  useEffect(()=>{
    const sync=()=>setAppFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange",sync);
    return ()=>document.removeEventListener("fullscreenchange",sync);
  },[]);
  const toggleAppFullscreen=async()=>{
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{ notify("Não foi possível alternar para tela cheia."); }
  };
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [performanceNotifications, setPerformanceNotifications] = useState<PerformanceNotification[]>([]);
  const [inactivityNotificationRead, setInactivityNotificationRead] = useState(false);
  const [, setNotificationClock] = useState(Date.now());
  const [catalogDeleteOpen, setCatalogDeleteOpen] = useState(false);
  const [catalogDeletePassword, setCatalogDeletePassword] = useState("");
  const [catalogDeleteBusy, setCatalogDeleteBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStore("mcr_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const localTheme = readStore<"light" | "dark">("mcr_theme", "light");
    const localButton = readStore<string>(`mcr_button_color_${session.user.id}`, "#d63384");
    const localPlanner = readStore<{defaultColor?:string;completedColor?:string}>(`mcr_planner_colors_${session.user.id}`, {});
    const localSidebarCollapsed = readStore<boolean>(`mcr_planner_sidebar_collapsed_${session.user.id}`, false);
    const loadCloudState = async () => {
      const { data, error } = await (supabase as any)
        .from("study_user_state")
        .select("preferences")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
        notify("Não foi possível carregar as preferências da nuvem. Tente novamente em alguns segundos.");
        setCloudStateReady(false);
        return;
      }
      const prefs = (data?.preferences ?? {}) as UserCloudPreferences;
      cloudPreferencesRemoteJson.current=JSON.stringify(prefs);
      if (prefs.theme) setTheme(prefs.theme); else setTheme(localTheme);
      if (prefs.buttonColor) setButtonColor(prefs.buttonColor); else setButtonColor(localButton);
      if (prefs.plannerDefaultColor) setPlannerDefaultColor(prefs.plannerDefaultColor);
      else if (localPlanner.defaultColor) setPlannerDefaultColor(localPlanner.defaultColor);
      if (prefs.plannerCompletedColor) setPlannerCompletedColor(prefs.plannerCompletedColor);
      else if (localPlanner.completedColor) setPlannerCompletedColor(localPlanner.completedColor);
      if (typeof prefs.plannerSidebarCollapsed === "boolean") setPlannerSidebarCollapsed(prefs.plannerSidebarCollapsed);
      else setPlannerSidebarCollapsed(localSidebarCollapsed);
      setCloudStateReady(true);
    };
    void loadCloudState();
  }, [session?.user?.id]);

  useEffect(() => {
    if(!session?.user?.id) return;
    const userId=session.user.id;
    const channel=supabase.channel(`user-state-prefs-${userId}`);
    preferencesSyncChannel.current=channel;
    channel
      .on("broadcast",{event:"preferences_updated"},(message:any)=>{
        const prefs=(message?.payload?.preferences ?? {}) as UserCloudPreferences;
        const json=JSON.stringify(prefs);
        if(json===cloudPreferencesRemoteJson.current) return;
        cloudPreferencesRemoteJson.current=json;
        if(prefs.theme) setTheme(prefs.theme);
        if(prefs.buttonColor) setButtonColor(prefs.buttonColor);
        if(prefs.plannerDefaultColor) setPlannerDefaultColor(prefs.plannerDefaultColor);
        if(prefs.plannerCompletedColor) setPlannerCompletedColor(prefs.plannerCompletedColor);
        if(typeof prefs.plannerSidebarCollapsed==="boolean") setPlannerSidebarCollapsed(prefs.plannerSidebarCollapsed);
      })
      .subscribe();
    return()=>{ preferencesSyncChannel.current=null; void supabase.removeChannel(channel); };
  },[session?.user?.id]);

  useEffect(() => {
    document.documentElement.style.setProperty("--button-color", buttonColor);
    document.documentElement.style.setProperty("--button-color-soft", `${buttonColor}18`);
    if (!session?.user?.id || !cloudStateReady) return;
    const preferences: UserCloudPreferences = {
      theme,
      buttonColor,
      plannerDefaultColor,
      plannerCompletedColor,
      plannerSidebarCollapsed,
    };
    const preferencesJson=JSON.stringify(preferences);
    if(preferencesJson===cloudPreferencesRemoteJson.current) return;
    const timer=window.setTimeout(async()=>{
      const { error } = await (supabase as any).from("study_user_state").upsert(
        { user_id: session.user.id, preferences },
        { onConflict: "user_id" }
      );
      if(!error){
        cloudPreferencesRemoteJson.current=preferencesJson;
        void preferencesSyncChannel.current?.send({type:"broadcast",event:"preferences_updated",payload:{preferences}});
      }
    },150);
    return()=>window.clearTimeout(timer);
  }, [theme, buttonColor, plannerDefaultColor, plannerCompletedColor, plannerSidebarCollapsed, session?.user?.id, cloudStateReady]);

  useEffect(() => {
    if (session?.user?.id && cloudStateReady) {
      writeStore(`mcr_button_color_${session.user.id}`, buttonColor);
      writeStore(`mcr_planner_colors_${session.user.id}`, {defaultColor: plannerDefaultColor, completedColor: plannerCompletedColor});
      writeStore(`mcr_planner_sidebar_collapsed_${session.user.id}`, plannerSidebarCollapsed);
    }
  }, [buttonColor, plannerDefaultColor, plannerCompletedColor, plannerSidebarCollapsed, session?.user?.id, cloudStateReady]);

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

  const exportMonthlyPdf = async () => {
    if (!session?.user.id) return;

    const client = supabase as any;
    const { data, error } = await client
      .from("study_entries")
      .select("*")
      .gte("study_date", applied.from)
      .lte("study_date", applied.to)
      .order("study_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      notify(error.message);
      return;
    }

    const reportEntries = ((data ?? []) as Entry[]).filter((entry) =>
      (!applied.disciplineId || entry.discipline_id === applied.disciplineId) &&
      (!applied.subjectId || entry.subject_id === applied.subjectId) &&
      (!applied.sourceId || entry.source_id === applied.sourceId)
    );

    const disciplineMap = new Map(disciplines.map((item) => [item.id, item.name]));
    const subjectMap = new Map(subjects.map((item) => [item.id, item.name]));
    const sourceMap = new Map(sources.map((item) => [item.id, item.name]));
    const typeMap = new Map(types.map((item) => [item.id, item.name]));
    const entryAccuracy = (entry: Entry) => percent(Number(entry.correct || 0), Number(entry.questions || 0));
    const dateLabel = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("pt-BR");

    const enriched = reportEntries.map((entry) => ({
      entry,
      discipline: entry.discipline_id ? disciplineMap.get(entry.discipline_id) ?? entry.discipline_name_snapshot ?? "Disciplina removida" : entry.discipline_name_snapshot ?? "Sem disciplina",
      subject: entry.subject_id ? subjectMap.get(entry.subject_id) ?? entry.subject_name_snapshot ?? "Assunto removido" : entry.subject_name_snapshot ?? "Sem assunto",
      source: entry.source_id ? sourceMap.get(entry.source_id) ?? entry.source_name_snapshot ?? "Origem removida" : entry.source_name_snapshot ?? "—",
      type: entry.question_type_id ? typeMap.get(entry.question_type_id) ?? entry.question_type_name_snapshot ?? "Tipo removido" : entry.question_type_name_snapshot ?? "—",
      questions: Number(entry.questions || 0),
      correct: Number(entry.correct || 0),
      errors: Math.max(0, Number(entry.questions || 0) - Number(entry.correct || 0)),
      accuracy: entryAccuracy(entry),
    }));

    const totalQuestions = enriched.reduce((sum, item) => sum + item.questions, 0);
    const totalCorrect = enriched.reduce((sum, item) => sum + item.correct, 0);
    const totalErrors = enriched.reduce((sum, item) => sum + item.errors, 0);
    const totalAccuracy = percent(totalCorrect, totalQuestions);
    const studiedDays = new Set(enriched.map((item) => item.entry.study_date)).size;

    const aggregate = (key: "discipline" | "subject") => {
      const groups = new Map<string, any>();
      enriched.forEach((item) => {
        const name = item[key];
        const id = key === "discipline" ? item.entry.discipline_id ?? "snapshot:" + name : item.entry.subject_id ?? "snapshot:" + name;
        const current = groups.get(id) ?? { id, name, discipline: key === "subject" ? item.discipline : "", questions: 0, correct: 0, errors: 0, accuracy: 0 };
        current.questions += item.questions;
        current.correct += item.correct;
        current.errors += item.errors;
        current.accuracy = percent(current.correct, current.questions);
        groups.set(id, current);
      });
      return [...groups.values()].filter((item) => item.questions > 0).sort((a, b) => b.accuracy - a.accuracy);
    };

    const byDisciplineReport = aggregate("discipline");
    const bySubjectReport = aggregate("subject");

    const bestSubject = bySubjectReport[0];
    const worstSubject = bySubjectReport[bySubjectReport.length - 1];

    const bestWorstBySubject = bySubjectReport.map((subject) => {
      const rows = enriched.filter((item) => item.subject === subject.name && (!subject.discipline || item.discipline === subject.discipline));
      const best = rows.slice().sort((a, b) => b.accuracy - a.accuracy)[0];
      const worst = rows.slice().sort((a, b) => a.accuracy - b.accuracy)[0];
      return { subject, best, worst };
    });

    const dayMap = new Map<string, { questions: number; correct: number; errors: number }>();
    enriched.forEach((item) => {
      const current = dayMap.get(item.entry.study_date) ?? { questions: 0, correct: 0, errors: 0 };
      current.questions += item.questions;
      current.correct += item.correct;
      current.errors += item.errors;
      dayMap.set(item.entry.study_date, current);
    });
    const dailyReport = [...dayMap.entries()].map(([date, values]) => ({
      date,
      ...values,
      accuracy: percent(values.correct, values.questions),
    })).sort((a, b) => a.date.localeCompare(b.date));

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 14;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;
    const pink: [number, number, number] = [214, 51, 132];
    const dark: [number, number, number] = [42, 24, 35];
    const muted: [number, number, number] = [105, 91, 100];

    const header = (title: string, subtitle?: string) => {
      doc.setFillColor(...pink);
      doc.rect(0, 0, pageWidth, 8, "F");
      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("MCR — Meu Controle de Rendimento", margin, 21);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title, margin, 29);
      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...muted);
        doc.text(subtitle, margin, 35);
      }
      doc.setDrawColor(238, 221, 231);
      doc.line(margin, 40, pageWidth - margin, 40);
    };

    const sectionTitle = (title: string, y: number) => {
      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin, y);
      return y + 7;
    };

    const addBarChart = (title: string, rows: any[], labelKey: string, valueKey: string, maxRows = 12) => {
      const chartRows = rows.slice(0, maxRows);
      if (!chartRows.length) return;
      doc.addPage();
      header(title, "Ordenado do maior rendimento para o menor rendimento.");
      const maxValue = Math.max(100, ...chartRows.map((row) => Number(row[valueKey]) || 0));
      let y = 52;
      chartRows.forEach((row) => {
        const label = String(row[labelKey] ?? "—");
        const value = Number(row[valueKey]) || 0;
        const labelText = label.length > 36 ? label.slice(0, 33) + "..." : label;
        doc.setTextColor(...dark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(labelText, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...muted);
        doc.text(value.toFixed(1) + "%", pageWidth - margin, y, { align: "right" });
        y += 3;
        doc.setDrawColor(232, 226, 230);
        doc.setFillColor(246, 241, 244);
        doc.roundedRect(margin, y, contentWidth, 6, 2, 2, "F");
        doc.setFillColor(...pink);
        doc.roundedRect(margin, y, contentWidth * Math.min(100, Math.max(0, value)) / 100, 6, 2, 2, "F");
        y += 13;
        if (y > 270) {
          doc.addPage();
          header(title, "Continuação");
          y = 52;
        }
      });
    };

    header("Relatório completo de rendimento", "Período filtrado: " + dateLabel(applied.from) + " a " + dateLabel(applied.to));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    const filterLabels = [
      "Disciplina: " + (applied.disciplineId ? disciplineMap.get(applied.disciplineId) ?? "Selecionada" : "Todas"),
      "Assunto: " + (applied.subjectId ? subjectMap.get(applied.subjectId) ?? "Selecionado" : "Todos"),
      "Banca / Origem: " + (applied.sourceId ? sourceMap.get(applied.sourceId) ?? "Selecionada" : "Todas"),
    ];
    doc.text(filterLabels.join("   •   "), margin, 47);

    const cards = [
      ["Questões", totalQuestions.toLocaleString("pt-BR")],
      ["Acertos", totalCorrect.toLocaleString("pt-BR")],
      ["Erros", totalErrors.toLocaleString("pt-BR")],
      ["Aproveitamento", totalAccuracy.toFixed(1) + "%"],
      ["Dias estudados", String(studiedDays)],
      ["Meta", targetAccuracy + "%"],
    ];
    cards.forEach(([label, value], index) => {
      const x = margin + (index % 3) * 61;
      const y = 55 + Math.floor(index / 3) * 25;
      doc.setFillColor(252, 244, 248);
      doc.roundedRect(x, y, 57, 20, 3, 3, "F");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(label.toUpperCase(), x + 4, y + 7);
      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(value, x + 4, y + 15);
    });

    let y = 112;
    y = sectionTitle("INDICADORES PRINCIPAIS", y);
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Resultado"]],
      body: [
        ["Melhor assunto", bestSubject ? bestSubject.name + " — " + bestSubject.accuracy.toFixed(1) + "%" : "—"],
        ["Pior assunto", worstSubject ? worstSubject.name + " — " + worstSubject.accuracy.toFixed(1) + "%" : "—"],
        ["Melhor disciplina", byDisciplineReport[0] ? byDisciplineReport[0].name + " — " + byDisciplineReport[0].accuracy.toFixed(1) + "%" : "—"],
        ["Pior disciplina", byDisciplineReport.at(-1) ? byDisciplineReport.at(-1).name + " — " + byDisciplineReport.at(-1).accuracy.toFixed(1) + "%" : "—"],
        ["Diferença para a meta", (totalAccuracy - targetAccuracy).toFixed(1) + " p.p."],
      ],
      theme: "grid",
      headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    addBarChart("Gráfico — rendimento por disciplina", byDisciplineReport, "name", "accuracy");
    addBarChart("Gráfico — rendimento por assunto", bySubjectReport, "name", "accuracy");

    doc.addPage();
    header("Evolução diária", "Aproveitamento calculado por dia dentro do período filtrado.");
    if (dailyReport.length) {
      autoTable(doc, {
        startY: 48,
        head: [["Data", "Questões", "Acertos", "Erros", "Aproveitamento"]],
        body: dailyReport.map((row) => [dateLabel(row.date), row.questions, row.correct, row.errors, row.accuracy.toFixed(1) + "%"]),
        theme: "grid",
        headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2.5 },
        margin: { left: margin, right: margin },
      });
      const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
      const chartTop = finalY + 12;
      const chartHeight = Math.min(90, Math.max(45, 10 + dailyReport.length * 3.8));
      const chartWidth = contentWidth;
      const barWidth = Math.max(2.5, Math.min(9, chartWidth / Math.max(1, dailyReport.length) - 2));
      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Gráfico — aproveitamento diário", margin, chartTop);
      const baseY = chartTop + chartHeight;
      doc.setDrawColor(225, 218, 223);
      doc.line(margin, baseY, margin + chartWidth, baseY);
      dailyReport.forEach((row, index) => {
        const value = Math.min(100, Math.max(0, row.accuracy));
        const x = margin + (chartWidth / Math.max(1, dailyReport.length)) * index + 1;
        const h = chartHeight * value / 100;
        doc.setFillColor(...pink);
        doc.roundedRect(x, baseY - h, barWidth, h, 1, 1, "F");
        if (dailyReport.length <= 18 || index % Math.ceil(dailyReport.length / 18) === 0) {
          doc.setTextColor(...muted);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.8);
          doc.text(new Date(row.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), x + barWidth / 2, baseY + 7, { align: "center" });
        }
      });
    } else {
      doc.setTextColor(...muted);
      doc.setFontSize(9);
      doc.text("Nenhum lançamento no período filtrado.", margin, 55);
    }

    doc.addPage();
    header("Ranking por disciplina", "Maior rendimento → menor rendimento.");
    autoTable(doc, {
      startY: 48,
      head: [["#", "Disciplina", "Questões", "Acertos", "Erros", "Rendimento"]],
      body: byDisciplineReport.map((item, index) => [index + 1, item.name, item.questions, item.correct, item.errors, item.accuracy.toFixed(1) + "%"]),
      theme: "grid",
      headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });

    doc.addPage();
    header("Ranking por assunto", "Maior rendimento → menor rendimento.");
    autoTable(doc, {
      startY: 48,
      head: [["#", "Assunto", "Disciplina", "Questões", "Acertos", "Erros", "Rendimento"]],
      body: bySubjectReport.map((item, index) => [index + 1, item.name, item.discipline || "—", item.questions, item.correct, item.errors, item.accuracy.toFixed(1) + "%"]),
      theme: "grid",
      headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      styles: { cellPadding: 2.2 },
      margin: { left: margin, right: margin },
    });

    doc.addPage();
    header("Melhor e pior rendimento em cada assunto", "Para cada assunto: melhor lançamento e pior lançamento registrados no período.");
    autoTable(doc, {
      startY: 48,
      head: [["Assunto", "Disciplina", "Melhor lançamento", "Pior lançamento"]],
      body: bestWorstBySubject.map((item) => [
        item.subject.name,
        item.subject.discipline || "—",
        item.best ? dateLabel(item.best.entry.study_date) + " — " + item.best.accuracy.toFixed(1) + "% (" + item.best.correct + "/" + item.best.questions + ")" : "—",
        item.worst ? dateLabel(item.worst.entry.study_date) + " — " + item.worst.accuracy.toFixed(1) + "% (" + item.worst.correct + "/" + item.worst.questions + ")" : "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 7.2 },
      styles: { cellPadding: 2.2, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 42 }, 2: { cellWidth: 49 }, 3: { cellWidth: 49 } },
      margin: { left: margin, right: margin },
    });

    doc.addPage();
    header("Lançamentos detalhados", "Todos os lançamentos do período filtrado, com data, matéria, assunto, origem, tipo, questões, acertos, erros, rendimento e observações.");
    autoTable(doc, {
      startY: 48,
      head: [["Data", "Matéria", "Assunto", "Origem", "Tipo", "Q", "A", "E", "%", "Observações"]],
      body: enriched.map((item) => [
        dateLabel(item.entry.study_date),
        item.discipline,
        item.subject,
        item.source,
        item.type,
        item.questions,
        item.correct,
        item.errors,
        item.accuracy.toFixed(1) + "%",
        item.entry.notes || "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: pink, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
      bodyStyles: { fontSize: 6.2, valign: "top", overflow: "linebreak" },
      styles: { cellPadding: 1.7, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 17 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 9, halign: "center" },
        6: { cellWidth: 9, halign: "center" },
        7: { cellWidth: 9, halign: "center" },
        8: { cellWidth: 13, halign: "center" },
        9: { cellWidth: 31 },
      },
      margin: { left: margin, right: margin, top: 48, bottom: 12 },
      showHead: "everyPage",
      rowPageBreak: "auto",
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("MCR • Relatório completo • " + dateLabel(applied.from) + " a " + dateLabel(applied.to), margin, 291);
      doc.text("Página " + page + " de " + totalPages, pageWidth - margin, 291, { align: "right" });
    }

    const filenameFrom = applied.from.replaceAll("-", "");
    const filenameTo = applied.to.replaceAll("-", "");
    doc.save("MCR-relatorio-" + filenameFrom + "-" + filenameTo + ".pdf");
    setNotificationOpen(false);
    notify("Relatório PDF completo exportado.");
  };

  const exportMonthlyBackup = async () => {
    if (!session?.user.id) return;
    const client = supabase as any;
    const to = localDate();
    const from = dateMinus(29);
    const { data: entriesData, error: entriesError } = await client
      .from("study_entries")
      .select("*")
      .gte("study_date", from)
      .lte("study_date", to)
      .order("study_date", { ascending: true });
    if (entriesError) {
      notify("Não foi possível gerar o backup mensal.");
      return;
    }

    const [disciplinesResult, subjectsResult, sourcesResult, typesResult, settingsResult] = await Promise.all([
      client.from("study_disciplines").select("*"),
      client.from("study_subjects").select("*"),
      client.from("study_sources").select("*"),
      client.from("study_question_types").select("*"),
      client.from("study_settings").select("*").maybeSingle(),
    ]);
    const failed = [disciplinesResult, subjectsResult, sourcesResult, typesResult, settingsResult].find((result) => result.error);
    if (failed?.error) {
      notify("Não foi possível gerar o backup mensal.");
      return;
    }

    const backup = {
      format: "MCR_BACKUP",
      version: 2,
      backup_type: "monthly",
      period: { from, to, days: 30 },
      exported_at: new Date().toISOString(),
      user_id: session.user.id,
      data: {
        disciplinas: disciplinesResult.data ?? [],
        assuntos: subjectsResult.data ?? [],
        fontes: sourcesResult.data ?? [],
        tipos_questao: typesResult.data ?? [],
        lancamentos_ultimos_30_dias: entriesData ?? [],
        configuracoes: settingsResult.data ?? null,
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MCR-backup-mensal-" + from + "-a-" + to + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotificationOpen(false);
    notify("Backup mensal dos últimos 30 dias exportado.");
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
      const { error: rpcError } = await (client as any).rpc("clear_study_catalog", { p_user_id: session.user.id });
      if (rpcError) {
        // Fallback for databases where the reset RPC migration has not reached production yet.
        // The entries are preserved; their catalog references use ON DELETE SET NULL.
        const fallbackTables = ["study_subjects", "study_disciplines", "study_sources", "study_question_types"];
        for (const table of fallbackTables) {
          const { error: deleteError } = await (client as any).from(table).delete().eq("user_id", session.user.id);
          if (deleteError) throw deleteError;
        }
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
    setSettingsReady(false);
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
      setStudentName(settingsResult.data.student_name ?? "");
      setDailyGoal(settingsResult.data.daily_goal);
      setWeeklyGoal(settingsResult.data.weekly_goal ?? 500);
      setMonthlyGoal(settingsResult.data.monthly_goal ?? 2000);
      setTargetAccuracy(settingsResult.data.target_accuracy);
    } else {
      setStudentName("");
      setDailyGoal(100);
      setWeeklyGoal(500);
      setMonthlyGoal(2000);
      setTargetAccuracy(80);
    }
    setSettingsReady(true);
  };

  const loadPerformanceNotifications = async () => {
    if (!session?.user.id) return;
    const { data, error } = await (supabase as any)
      .from("study_performance_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    // This optional notification table may not exist in older database versions.
    // It must never block the account, dashboard, or planner from loading.
    if (error) {
      setPerformanceNotifications([]);
      return;
    }
    setPerformanceNotifications((data ?? []) as PerformanceNotification[]);
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
    if (!session?.user?.id) return;
    const userId=session.user.id;
    const channel=supabase.channel(`account-sync-${userId}`);
    const refreshCatalog=()=>{ void loadCatalog().catch((error)=>setToast(error instanceof Error ? error.message : "Não foi possível sincronizar o cadastro.")); };
    const refreshEntries=()=>{ void loadEntries().catch((error)=>setToast(error instanceof Error ? error.message : "Não foi possível sincronizar os lançamentos.")); };
    channel
      .on("postgres_changes",{event:"*",schema:"public",table:"study_disciplines",filter:`user_id=eq.${userId}`},refreshCatalog)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_subjects",filter:`user_id=eq.${userId}`},refreshCatalog)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_sources",filter:`user_id=eq.${userId}`},refreshCatalog)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_question_types",filter:`user_id=eq.${userId}`},refreshCatalog)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_settings",filter:`user_id=eq.${userId}`},refreshCatalog)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_entries",filter:`user_id=eq.${userId}`},refreshEntries)
      .subscribe();
    return()=>{ void supabase.removeChannel(channel); };
  },[session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    Promise.all([loadCatalog(), loadEntries(), loadPerformanceNotifications()]).catch((error) => {
      setToast(error instanceof Error ? error.message : "Não foi possível carregar os dados da conta.");
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (!session) return;
    loadEntries().catch((error) => {
      setToast(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos.");
    });
  }, [session?.user.id, applied.from, applied.to, applied.disciplineId, applied.subjectId, applied.sourceId]);

  // Fallback de sincronização para dados de conta que não dependem do Realtime.
  // O Supabase continua sendo a fonte de verdade; o localStorage é apenas cache.
  useEffect(() => {
    if (!session?.user?.id) return;
    const timer = window.setInterval(() => {
      void loadCatalog().catch(() => undefined);
      void loadEntries().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [session?.user?.id, applied.from, applied.to, applied.disciplineId, applied.subjectId, applied.sourceId]);

  const totalQuestions = entries.reduce((sum, entry) => sum + Number(entry.questions || 0), 0);
  const totalCorrect = entries.reduce((sum, entry) => sum + Number(entry.correct || 0), 0);
  const totalErrors = totalQuestions - totalCorrect;
  const accuracy = percent(totalCorrect, totalQuestions);
  const todayEntries = entries.filter((entry) => entry.study_date === localDate());
  const todayQuestions = todayEntries.reduce((sum, entry) => sum + Number(entry.questions || 0), 0);
  const todayCorrect = todayEntries.reduce((sum, entry) => sum + Number(entry.correct || 0), 0);
  const daysStudied = new Set(entries.map((entry) => entry.study_date)).size;

  const byDiscipline = useMemo(() => {
    const groups = new Map<string, any>();
    entries.forEach((entry) => {
      const id = entry.discipline_id ?? "snapshot:" + (entry.discipline_name_snapshot ?? "Sem disciplina");
      const name = entry.discipline_id
        ? disciplines.find((discipline) => discipline.id === entry.discipline_id)?.name ?? entry.discipline_name_snapshot ?? "Disciplina removida"
        : entry.discipline_name_snapshot ?? "Disciplina removida";
      const current = groups.get(id) ?? { id, name, questions: 0, correct: 0, errors: 0, accuracy: 0 };
      current.questions += Number(entry.questions || 0);
      current.correct += Number(entry.correct || 0);
      current.errors = current.questions - current.correct;
      current.accuracy = percent(current.correct, current.questions);
      groups.set(id, current);
    });
    return [...groups.values()];
  }, [disciplines, entries]);

  const bySubject = useMemo(() => {
    const groups = new Map<string, any>();
    entries.forEach((entry) => {
      const id = entry.subject_id ?? "snapshot:" + (entry.subject_name_snapshot ?? "Sem assunto");
      const name = entry.subject_id
        ? subjects.find((subject) => subject.id === entry.subject_id)?.name ?? entry.subject_name_snapshot ?? "Assunto removido"
        : entry.subject_name_snapshot ?? "Assunto removido";
      const disciplineName = entry.discipline_id
        ? disciplines.find((discipline) => discipline.id === entry.discipline_id)?.name ?? entry.discipline_name_snapshot ?? "—"
        : entry.discipline_name_snapshot ?? "—";
      const current = groups.get(id) ?? { id, name, disciplineName, questions: 0, correct: 0, errors: 0, accuracy: 0 };
      current.questions += Number(entry.questions || 0);
      current.correct += Number(entry.correct || 0);
      current.errors = current.questions - current.correct;
      current.accuracy = percent(current.correct, current.questions);
      groups.set(id, current);
    });
    return [...groups.values()].sort((a, b) => a.accuracy - b.accuracy);
  }, [subjects, entries, disciplines]);

  const attention = bySubject.filter((item) => item.accuracy < targetAccuracy).slice(0, 10);

  const saveSettings = async (showToast = true) => {
    if (!session?.user?.id) return false;
    const nextStudentName = String(studentName || "").trim().slice(0, 80);
    const nextDailyGoal = Math.max(1, Number(dailyGoal) || 1);
    const nextWeeklyGoal = Math.max(1, Number(weeklyGoal) || 1);
    const nextMonthlyGoal = Math.max(1, Number(monthlyGoal) || 1);
    const nextTargetAccuracy = Math.min(100, Math.max(0, Number(targetAccuracy) || 0));
    const client = supabase as any;
    const { error } = await client.from("study_settings").upsert({
      user_id: session.user.id,
      student_name: nextStudentName,
      daily_goal: nextDailyGoal,
      weekly_goal: nextWeeklyGoal,
      monthly_goal: nextMonthlyGoal,
      target_accuracy: nextTargetAccuracy,
    }, { onConflict: "user_id" });
    if (error) {
      if (showToast) notify(error.message);
      return false;
    }
    if (showToast) notify("Configurações salvas automaticamente.");
    return true;
  };

  useEffect(() => {
    if (!session?.user?.id || !settingsReady) return;
    const timer = window.setTimeout(() => {
      void saveSettings(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [session?.user?.id, settingsReady, studentName, dailyGoal, weeklyGoal, monthlyGoal, targetAccuracy]);

  const changePassword = async () => {
    if (!session?.user.email || !currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 6) { notify("A nova senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { notify("A confirmação da nova senha não confere."); return; }
    setPasswordBusy(true);
    try {
      const authResult = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
      if (authResult.error) { notify("Senha atual incorreta. A senha não foi alterada."); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPasswordModalOpen(false);
      notify("Senha alterada com sucesso.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível alterar a senha.");
    } finally { setPasswordBusy(false); }
  };

  const signOutOtherSessions = async () => {
    const { error } = await supabase.auth.signOut({ scope: "others" });
    notify(error ? error.message : "As outras sessões foram encerradas.");
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
    if (key === "from" || key === "to") setPeriodPreset("custom");
  };

  const setQuickPeriod = (preset: "7"|"30"|"90"|"custom") => {
    setPeriodPreset(preset);
    if (preset === "custom") return;
    const days = Number(preset);
    const next = { ...filters, from: dateMinus(days - 1), to: localDate() };
    setFilters(next);
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const latestQuestionEntry = entries
    .filter((entry) => Number(entry.questions || 0) > 0)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.updated_at ?? a.created_at ?? a.study_date).getTime();
      const tb = new Date(b.updated_at ?? b.created_at ?? b.study_date).getTime();
      return tb - ta;
    })[0];
  const latestQuestionTimestamp = latestQuestionEntry
    ? new Date(latestQuestionEntry.updated_at ?? latestQuestionEntry.created_at ?? latestQuestionEntry.study_date).getTime()
    : 0;
  const inactiveFor24Hours = Boolean(latestQuestionTimestamp && Date.now() - latestQuestionTimestamp >= 24 * 60 * 60 * 1000);
  const unreadPerformanceCount = performanceNotifications.filter((item) => !item.read_at).length;
  const notificationCount = unreadPerformanceCount + (inactiveFor24Hours && !inactivityNotificationRead ? 1 : 0) + (isLastDayOfMonth() ? 2 : 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNotificationClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setInactivityNotificationRead(false);
  }, [latestQuestionTimestamp]);

  const evaluatePerformanceEntry = async (entry: Entry) => {
    if (!session?.user.id || !entry.subject_id || Number(entry.questions || 0) < 5) return;

    try {
      const client = supabase as any;
      const { data: history, error } = await client
        .from("study_entries")
        .select("id, study_date, questions, correct, subject_id, discipline_id")
        .eq("subject_id", entry.subject_id)
        .neq("id", entry.id)
        .order("study_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return;

      const previous = (history ?? []) as Entry[];
      if (previous.length < 3) return;

      const currentAccuracy = percent(Number(entry.correct || 0), Number(entry.questions || 0));
      const weighted = (items: Entry[]) => {
        const questions = items.reduce((sum, item) => sum + Number(item.questions || 0), 0);
        const correct = items.reduce((sum, item) => sum + Number(item.correct || 0), 0);
        return percent(correct, questions);
      };
      const baseline = weighted(previous);
      const recent3 = weighted(previous.slice(0, 3));
      const prior3 = weighted(previous.slice(3, 6));
      const priorBelowTarget = previous.slice(0, 3).every((item) => percent(Number(item.correct || 0), Number(item.questions || 0)) < targetAccuracy);
      const previousBest = Math.max(...previous.map((item) => percent(Number(item.correct || 0), Number(item.questions || 0))));
       const allHistory = [entry, ...previous].sort((a, b) => new Date(b.study_date).getTime() - new Date(a.study_date).getTime());
       const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
       const stagnationHistory = allHistory.filter((item) => new Date(item.study_date).getTime() >= fourWeeksAgo && new Date(item.study_date).getTime() <= Date.now());
       const stagnationAccuracies = stagnationHistory.map((item) => percent(Number(item.correct || 0), Number(item.questions || 0)));
       const stagnationSpan = stagnationHistory.length >= 2
         ? new Date(stagnationHistory[0].study_date).getTime() - new Date(stagnationHistory[stagnationHistory.length - 1].study_date).getTime()
         : 0;
       const stagnatedForFourWeeks =
         stagnationHistory.length >= 4 &&
         stagnationSpan >= 28 * 24 * 60 * 60 * 1000 &&
         Math.max(...stagnationAccuracies) - Math.min(...stagnationAccuracies) <= 1;
      const subject = subjects.find((item) => item.id === entry.subject_id);
      const discipline = disciplines.find((item) => item.id === entry.discipline_id);
      const subjectName = subject?.name ?? entry.subject_name_snapshot ?? "este assunto";
      const disciplineName = discipline?.name ?? entry.discipline_name_snapshot ?? "—";

      let notificationType: PerformanceNotification["notification_type"] | null = null;
      let title = "";
      let message = "";

      if (stagnatedForFourWeeks) {
         notificationType = "attention";
         title = "⏸️ Desempenho estagnado em " + subjectName;
         message = "Seu aproveitamento está praticamente no mesmo nível há mais de 4 semanas (" + Math.min(...stagnationAccuracies).toFixed(0) + "%–" + Math.max(...stagnationAccuracies).toFixed(0) + "%). Vale revisar a estratégia de estudo desse assunto.";
       } else if (currentAccuracy <= baseline - 25) {
        notificationType = "drop_severe";
        title = "⚠️ Queda forte detectada";
        message = "Seu resultado em " + subjectName + " foi " + currentAccuracy.toFixed(0) + "%, enquanto seu padrão recente está em " + baseline.toFixed(0) + "%. Pode ser um bom momento para revisar esse assunto.";
      } else if (currentAccuracy <= baseline - 15) {
        notificationType = "drop";
        title = "⚠️ Atenção em " + subjectName;
        message = "Este lançamento ficou significativamente abaixo do seu padrão recente: " + currentAccuracy.toFixed(0) + "% agora contra " + baseline.toFixed(0) + "% de padrão.";
      } else if (previous.length >= 4 && previous.slice(0, 4).every((item) => percent(Number(item.correct || 0), Number(item.questions || 0)) < targetAccuracy) && currentAccuracy < targetAccuracy) {
        notificationType = "attention";
        title = "📚 " + subjectName + " merece atenção";
        message = "Seu desempenho vem ficando abaixo da sua meta nos últimos lançamentos. Priorize uma revisão antes de continuar avançando.";
      } else if (priorBelowTarget && currentAccuracy >= targetAccuracy && currentAccuracy >= recent3 + 10) {
        notificationType = "recovery";
        title = "🔥 Boa recuperação em " + subjectName;
        message = "Seu desempenho voltou a subir após uma sequência abaixo da meta: " + currentAccuracy.toFixed(0) + "% agora, contra " + recent3.toFixed(0) + "% nos lançamentos recentes anteriores.";
      } else if (currentAccuracy >= previousBest + 5 || (currentAccuracy >= 95 && currentAccuracy > previousBest)) {
        notificationType = "record";
        title = "🏆 Novo recorde em " + subjectName;
        message = "Você alcançou " + currentAccuracy.toFixed(0) + "%, seu melhor resultado registrado até aqui nesse assunto.";
      } else if (currentAccuracy >= baseline + 10) {
        notificationType = "exceptional";
        title = "🎯 Excelente desempenho em " + subjectName;
        message = "Você alcançou " + currentAccuracy.toFixed(0) + "%, acima do seu padrão recente de " + baseline.toFixed(0) + "%.";
      } else if (previous.length >= 6 && recent3 >= prior3 + 10) {
        notificationType = "evolution";
        title = "📈 Evolução detectada em " + subjectName;
        message = "Seu desempenho vem melhorando de forma consistente: os 3 lançamentos mais recentes estão em " + recent3.toFixed(0) + "%, contra " + prior3.toFixed(0) + "% nos anteriores.";
      }

      if (!notificationType) return;

      const sevenDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSameType } = await client
        .from("study_performance_notifications")
        .select("id")
        .eq("subject_id", entry.subject_id)
        .eq("notification_type", notificationType)
        .gte("created_at", sevenDaysAgo)
        .limit(1);
      if ((recentSameType ?? []).length) return;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count: todayCount } = await client
        .from("study_performance_notifications")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay.toISOString());
      if (Number(todayCount || 0) >= 4) return;

      const { data: inserted, error: insertError } = await client
        .from("study_performance_notifications")
        .insert({
          user_id: session.user.id,
          subject_id: entry.subject_id,
          subject_name: subjectName,
          discipline_name: disciplineName,
          notification_type: notificationType,
          title,
          message,
        })
        .select("*")
        .single();
      if (insertError) return;

      setPerformanceNotifications((current) => [inserted as PerformanceNotification, ...current].slice(0, 20));
    } catch {
      // Observações inteligentes nunca devem bloquear o lançamento de questões.
    }
  };

  const markPerformanceNotificationRead = async (id: string) => {
    const readAt = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("study_performance_notifications")
      .update({ read_at: readAt })
      .eq("id", id);
    if (!error) {
      setPerformanceNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
    }
  };

  const markAllPerformanceNotificationsRead = async () => {
    const unread = performanceNotifications.filter((item) => !item.read_at);
    if (!unread.length) return;
    const readAt = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("study_performance_notifications")
      .update({ read_at: readAt })
      .in("id", unread.map((item) => item.id));
    if (!error) {
      setPerformanceNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    }
  };

  if (authLoading) return <div className="fatal"><div className="fatal-card"><img className="mcr-logo mcr-logo-fatal" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /><p>Carregando sua sessão…</p></div></div>;
  if (authError && !session) return <div className="fatal"><div className="fatal-card"><img className="mcr-logo mcr-logo-fatal" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /><p>{authError}</p><button className="btn primary" onClick={() => window.location.reload()}>Tentar novamente</button></div></div>;
  if (!session) return <AuthScreen />;

  return (
    <div className={"app " + (mobileMenuOpen ? "mobile-menu-is-open" : "")}>
      <header className={"topbar " + (tab === "planner" ? "planner-topbar-hidden" : "")}>
        <div className="brand"><img className="mcr-logo mcr-logo-header" src={MCR_LOGO} alt="MCR — Meu Controle de Rendimento" /></div>
        <div className="top-actions">
          <div className="notification-wrap">
            <button className="notification-btn" aria-label="Notificações" onClick={() => setNotificationOpen((value) => !value)}>
              <Bell size={17}/>
              {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
            </button>
            {notificationOpen && <div className="notification-panel">
              <div className="notification-panel-head">
                <strong>Observações do seu desempenho</strong>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  {unreadPerformanceCount > 0 && <button className="notification-mark-all" onClick={markAllPerformanceNotificationsRead}>Marcar como lidas</button>}
                  <button onClick={() => setNotificationOpen(false)} aria-label="Fechar"><X size={14}/></button>
                </div>
              </div>
              {inactiveFor24Hours && <button className={"monthly-notification performance-notification " + (inactivityNotificationRead ? "read" : "unread")} onClick={() => setInactivityNotificationRead(true)}>
                <span className="notification-icon performance-attention"><AlertTriangle size={15}/></span>
                <span><strong>{studentName ? studentName + ", já faz 24 horas sem lançar questões." : "Já faz 24 horas sem lançar questões."}</strong><small>Registre suas questões para manter seu acompanhamento de desempenho atualizado.</small><small className="notification-date">Agora</small></span>
              </button>}
              {performanceNotifications.map((item) => <button key={item.id} className={"monthly-notification performance-notification " + (item.read_at ? "read" : "unread")} onClick={() => markPerformanceNotificationRead(item.id)}>
                <span className={"notification-icon performance-" + item.notification_type}>
                  {item.notification_type === "drop" || item.notification_type === "drop_severe" || item.notification_type === "attention" ? <AlertTriangle size={15}/> : item.notification_type === "record" ? <Trophy size={15}/> : item.title.startsWith("⏸️") ? <PauseCircle size={15}/> : item.notification_type === "evolution" ? <TrendingUp size={15}/> : item.notification_type === "recovery" ? <Sparkles size={15}/> : <Target size={15}/>}
                </span>
                <span><strong>{personalizeNotificationTitle(item.title, studentName)}</strong><small>{personalizeNotificationText(item.message, studentName)}</small><small className="notification-date">{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></span>
              </button>)}
              {isLastDayOfMonth() && <button className="monthly-notification" onClick={() => exportMonthlyPdf()}><span className="notification-icon"><FileDown size={15}/></span><span><strong>{studentName ? studentName + ", seu rendimento mensal está pronto." : "Seu rendimento mensal está pronto"}</strong><small>{studentName ? "Exporte seu resumo mensal em PDF." : "Exporte o resumo mensal em PDF."}</small></span></button>}
              {isLastDayOfMonth() && <button className="monthly-notification" onClick={() => exportMonthlyBackup()}><span className="notification-icon"><Upload size={15}/></span><span><strong>{studentName ? studentName + ", seu backup mensal está disponível." : "Backup mensal disponível"}</strong><small>{studentName ? "Faça o backup dos seus dados dos últimos 30 dias." : "Faça o backup dos dados dos últimos 30 dias."}</small></span></button>}
              {!performanceNotifications.length && !inactiveFor24Hours && !isLastDayOfMonth() && <div className="notification-empty">{studentName ? studentName + ", nenhuma observação importante por enquanto. O MCR só aparece quando identifica algo relevante." : "Nenhuma observação importante por enquanto. O MCR só aparece quando identifica algo relevante."}</div>}
            </div>}
          </div>
          <span className="user">{session.user.email}</span>
          <button className="btn small" onClick={logout}><LogOut size={14}/> Sair</button>
        </div>
      </header>

      {mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
      <button className="mobile-menu-button" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}><Menu size={21}/></button>
      <div className={"layout " + (tab === "planner" ? "planner-layout " + (plannerSidebarCollapsed ? "planner-sidebar-collapsed" : "") : "")}>
        {tab === "planner" && plannerSidebarCollapsed && (
          <button className="planner-sidebar-toggle planner-sidebar-toggle-open" title="Mostrar menu" aria-label="Mostrar menu" onClick={()=>setPlannerSidebarCollapsed(false)}>
            <PanelLeftOpen size={16}/>
          </button>
        )}
        <aside className={"sidebar " + (mobileMenuOpen ? "mobile-sidebar-open" : "")}>
          {tab === "planner" && !plannerSidebarCollapsed && (
            <button className="planner-sidebar-toggle" title="Ocultar menu" aria-label="Ocultar menu" onClick={()=>setPlannerSidebarCollapsed(true)}>
              <PanelLeftClose size={16}/>
            </button>
          )}
          <nav className="nav">
            <button className={tab === "dashboard" ? "active" : ""} onClick={() => { setTab("dashboard"); setMobileMenuOpen(false); }}><BarChart3 size={16}/> Dashboard</button>
            <button className={tab === "planner" ? "active" : ""} onClick={() => { setTab("planner"); setMobileMenuOpen(false); }}><Clipboard size={16}/> Planejamento</button>
            <button className={tab === "entries" ? "active" : ""} onClick={() => { setTab("entries"); setMobileMenuOpen(false); }}><CheckCircle2 size={16}/> Lançamentos</button>
            <button className={tab === "catalog" ? "active" : ""} onClick={() => { setTab("catalog"); setMobileMenuOpen(false); }}><BookOpen size={16}/> Cadastro</button>
            <button className={tab === "settings" ? "active" : ""} onClick={() => { setTab("settings"); setMobileMenuOpen(false); }}><Settings size={16}/> Configurações</button>
                      </nav>
        </aside>

        <main className={tab === "planner" ? "content planner-content" : "content"}>
          {tab === "dashboard" && (
            <Dashboard
              fullscreen={appFullscreen}
              onToggleFullscreen={toggleAppFullscreen}
              studentName={studentName}
              filters={filters} setFilter={setFilter} disciplines={disciplines} subjects={filteredSubjects} sources={sources}
              periodPreset={periodPreset} onPeriodChange={setQuickPeriod}
              onApply={() => { setApplied(filters); notify("Filtros aplicados."); }}
              onClear={() => { const next = emptyFilters(); setFilters(next); setApplied(next); setPeriodPreset("30"); }}
              totalQuestions={totalQuestions} totalCorrect={totalCorrect} totalErrors={totalErrors} accuracy={accuracy}
              daysStudied={daysStudied} todayQuestions={todayQuestions} todayCorrect={todayCorrect} dailyGoal={dailyGoal}
              byDiscipline={byDiscipline} bySubject={bySubject} attention={attention} targetAccuracy={targetAccuracy} entries={entries} onExportMonthly={exportMonthlyPdf}
            />
          )}
          {tab === "planner" && <Planner userId={session.user.id} notify={notify} defaultSmallColor={plannerDefaultColor} completedSmallColor={plannerCompletedColor} />}
          {tab === "entries" && <Entries disciplines={disciplines} subjects={subjects} sources={sources} types={types} entries={entries} refresh={() => loadEntries().catch((error) => notify(error instanceof Error ? error.message : "Não foi possível carregar os lançamentos."))} notify={notify} onPerformanceEntry={evaluatePerformanceEntry}/>} 
          {tab === "catalog" && <Catalog disciplines={disciplines} subjects={subjects} sources={sources} types={types} refresh={() => loadCatalog().catch((error) => notify(error instanceof Error ? error.message : "Não foi possível carregar o cadastro."))} notify={notify} catalogDeleteOpen={catalogDeleteOpen} setCatalogDeleteOpen={setCatalogDeleteOpen} catalogDeletePassword={catalogDeletePassword} setCatalogDeletePassword={setCatalogDeletePassword} catalogDeleteBusy={catalogDeleteBusy} deleteAllCatalogData={deleteAllCatalogData}/>}
          {tab === "settings" && (
            <SettingsPage
              studentName={studentName}
              setStudentName={setStudentName}
              dailyGoal={dailyGoal}
              weeklyGoal={weeklyGoal}
              monthlyGoal={monthlyGoal}
              targetAccuracy={targetAccuracy}
              plannerDefaultColor={plannerDefaultColor}
              setPlannerDefaultColor={setPlannerDefaultColor}
              plannerCompletedColor={plannerCompletedColor}
              setPlannerCompletedColor={setPlannerCompletedColor}
              theme={theme}
              setTheme={setTheme}
              buttonColor={buttonColor}
              setButtonColor={setButtonColor}
              setDailyGoal={setDailyGoal}
              setWeeklyGoal={setWeeklyGoal}
              setMonthlyGoal={setMonthlyGoal}
              setTargetAccuracy={setTargetAccuracy}
              save={saveSettings}
              session={session}
              passwordModalOpen={passwordModalOpen}
              setPasswordModalOpen={setPasswordModalOpen}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              passwordBusy={passwordBusy}
              changePassword={changePassword}
              signOutOtherSessions={signOutOtherSessions}
              logout={logout}
            />
          )}
        </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function personalizeNotificationText(text: string, name: string) {
  const safeName = name.trim();
  if (!safeName) return text;
  return safeName + ", " + text.charAt(0).toLowerCase() + text.slice(1);
}

function personalizeNotificationTitle(title: string, name: string) {
  const safeName = name.trim();
  if (!safeName) return title;
  return safeName + ", " + title;
}

function Dashboard(props: any) {
  return (
    <>
      <h1 className="page-title">Olá, {props.studentName || "estudante"}.</h1>
      <div className="dashboard-heading"><p className="subtitle">Visão consolidada dos lançamentos reais do período selecionado.</p><div className="dashboard-heading-actions"><button className="btn export-pdf-btn" onClick={props.onExportMonthly}><FileDown size={15}/> Exportar relatório</button><button className="btn" onClick={props.onToggleFullscreen} title={props.fullscreen?"Sair da tela cheia":"Entrar em tela cheia"}>{props.fullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {props.fullscreen?"Sair da tela cheia":"Tela cheia"}</button></div></div>

      <section className="section">
        <div className="section-head">FILTROS DE ANÁLISE</div>
        <div className="section-body">
          <div className="filters">
            <Field label="Disciplina"><select value={props.filters.disciplineId} onChange={(e) => props.setFilter("disciplineId", e.target.value)}><option value="">Todas</option>{props.disciplines.map((d: Discipline) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Assunto"><select value={props.filters.subjectId} disabled={!props.filters.disciplineId} onChange={(e) => props.setFilter("subjectId", e.target.value)}><option value="">{props.filters.disciplineId ? "Todos os assuntos" : "Selecione uma disciplina"}</option>{props.subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Banca / Origem"><select value={props.filters.sourceId} onChange={(e) => props.setFilter("sourceId", e.target.value)}><option value="">Todas</option>{props.sources.map((s: Source) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Período"><select value={props.periodPreset} onChange={(e) => props.onPeriodChange(e.target.value as "7"|"30"|"90"|"custom")}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="custom">Personalizado</option></select></Field>
            {props.periodPreset === "custom" && <><Field label="Data inicial"><input type="date" value={props.filters.from} onChange={(e) => props.setFilter("from", e.target.value)}/></Field><Field label="Data final"><input type="date" value={props.filters.to} onChange={(e) => props.setFilter("to", e.target.value)}/></Field></>}
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

      <SubjectPerformanceCharts bySubject={props.bySubject} />

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
      const errors = Math.max(0, questions - correct);
      return { date: key, label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""), questions, correct, errors };
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
        errors: group.reduce((sum, row) => sum + row.errors, 0),
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
            <h2>Acertos × Erros</h2>
            <p>Comparação entre acertos e erros no período selecionado.</p>
          </div>
          <div className="chart-range">
            {[7, 30, 90].map((days) => <button key={days} className={range === days ? "active" : ""} onClick={() => setRange(days as 7 | 30 | 90)}>{days} dias</button>)}
          </div>
        </div>
        <div className="chart-legend"><span><i className="legend-dot questions"/>Erros</span><span><i className="legend-dot correct"/>Acertos</span></div>
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
              const eH = (item.errors / maxQuestions) * innerH;
              const cH = (item.correct / maxQuestions) * innerH;
              return <g key={item.date}>
                <title>{item.label + " — " + item.correct + " acertos, " + item.errors + " erros"}</title>
                <rect x={x - barW - 2} y={pad.top + innerH - eH} width={barW} height={eH} rx="5" fill="url(#mcrQuestions)" opacity=".95" filter="url(#mcrGlow)"/>
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

function SubjectPerformanceCharts({ bySubject }: { bySubject: any[] }) {
  const minimumQuestions = 5;
  const eligible = (bySubject ?? []).filter((item) => Number(item.questions || 0) >= minimumQuestions);
  const bestSubjects = eligible.slice().sort((a, b) => b.accuracy - a.accuracy).slice(0, 8);
  const attentionSubjects = eligible.slice().sort((a, b) => a.accuracy - b.accuracy).slice(0, 8);

  const SubjectBars = ({ items, empty }: { items: any[]; empty: string }) => (
    items.length ? <div className="subject-performance-list">
      {items.map((item) => {
        const value = Math.min(100, Math.max(0, Number(item.accuracy || 0)));
        return <div className="subject-performance-row" key={item.id} title={item.name + ": " + value.toFixed(1) + "% — " + item.questions + " questões"}>
          <div className="subject-performance-meta">
            <div className="subject-performance-name">
              <strong>{item.name}</strong>
              <span>{item.disciplineName || "—"}</span>
            </div>
            <strong className="subject-performance-value">{value.toFixed(1)}%</strong>
          </div>
          <div className="subject-performance-track" aria-hidden="true">
            <span className="subject-performance-fill" style={{ width: value + "%" }} />
          </div>
          <div className="subject-performance-foot">
            <span>{Number(item.questions || 0).toLocaleString("pt-BR")} questões · {Number(item.correct || 0).toLocaleString("pt-BR")} acertos · {Number(item.errors || 0).toLocaleString("pt-BR")} erros</span>
          </div>
        </div>;
      })}
    </div> : <div className="empty">{empty}</div>
  );

  return <div className="performance-charts subject-performance-charts">
    <section className="chart-card">
      <div className="chart-card-head compact">
        <div>
          <div className="chart-eyebrow">ANÁLISE POR ASSUNTO</div>
          <h2>Melhores assuntos</h2>
          <p>Assuntos com maior aproveitamento, considerando apenas aqueles com pelo menos 5 questões.</p>
        </div>
      </div>
      <SubjectBars items={bestSubjects} empty="Nenhum assunto com pelo menos 5 questões no período." />
    </section>

    <section className="chart-card">
      <div className="chart-card-head compact">
        <div>
          <div className="chart-eyebrow">ANÁLISE POR ASSUNTO</div>
          <h2>Assuntos que precisam de atenção</h2>
          <p>Assuntos com menor aproveitamento, ordenados do pior para o melhor resultado.</p>
        </div>
      </div>
      <SubjectBars items={attentionSubjects} empty="Nenhum assunto com pelo menos 5 questões no período." />
    </section>
  </div>;
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

function Entries({disciplines,subjects=[],sources,types,entries,refresh,notify,onPerformanceEntry}:any) {
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
    let result: any;
    let createdEntry: Entry | null = null;
    if (editing) {
      result = await client.from("study_entries").update(payload).eq("id", editing.id).select("*").single();
    } else {
      result = await client.from("study_entries").insert(payload).select("*").single();
      createdEntry = result.data as Entry | null;
    }
    if (result.error) return notify(result.error.message);
    if (editing) createdEntry = result.data as Entry | null;
    notify(editing ? "Lançamento atualizado." : "Lançamento criado.");
    setOpen(false); setEditing(null); refresh();
    if (createdEntry && onPerformanceEntry) void onPerformanceEntry(createdEntry);
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
      {entries.length ? entries.map((entry: Entry) => <tr key={entry.id}><td>{new Date(`${entry.study_date}T12:00:00`).toLocaleDateString("pt-BR")}</td><td>{disciplines.find((x: Discipline)=>x.id===entry.discipline_id)?.name ?? entry.discipline_name_snapshot ?? "—"}</td><td>{subjects.find((x: Subject)=>x.id===entry.subject_id)?.name ?? entry.subject_name_snapshot ?? "—"}</td><td>{sources.find((x: Source)=>x.id===entry.source_id)?.name ?? entry.source_name_snapshot ?? "—"}</td><td>{types.find((x: QuestionType)=>x.id===entry.question_type_id)?.name ?? entry.question_type_name_snapshot ?? "—"}</td><td>{entry.questions}</td><td>{entry.correct}</td><td>{entry.questions-entry.correct}</td><td>{percent(entry.correct,entry.questions).toFixed(1)}%</td><td>{entry.notes ?? "—"}</td><td className="actions"><button className="btn small" onClick={() => {setEditing(entry);setOpen(true)}}>Editar</button><button className="btn small danger" onClick={() => remove(entry.id)}><Trash2 size={13}/></button></td></tr>) : <tr><td colSpan={11}><div className="empty">Nenhum lançamento encontrado.</div></td></tr>}
    </tbody></table></div></section>
    {open && <LaunchModal initial={editing} disciplines={disciplines} subjects={subjects} sources={sources} types={types} onClose={() => {setOpen(false);setEditing(null)}} onSave={save}/>}
  </>;
}

function LaunchModal({initial,disciplines,subjects=[],sources=[],types=[],onClose,onSave}:any) {
  const [value,setValue] = useState<any>({
    study_date: initial?.study_date ?? localDate(), discipline_id: initial?.discipline_id ?? "", subject_id: initial?.subject_id ?? "",
    source_id: initial?.source_id ?? "", question_type_id: initial?.question_type_id ?? "", questions: initial?.questions ?? "", correct: initial?.correct ?? "", notes: initial?.notes ?? "",
  });
  const availableSubjects = subjects.filter((s: Subject) => String(s.discipline_id ?? "") === String(value.discipline_id ?? ""));
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

function Catalog({disciplines,subjects,sources,types,refresh,notify,catalogDeleteOpen,setCatalogDeleteOpen,catalogDeletePassword,setCatalogDeletePassword,catalogDeleteBusy,deleteAllCatalogData}:any) {
  const [kind,setKind]=useState<"discipline"|"subject"|"source"|"type">("discipline");
  const [name,setName]=useState("");
  const [disciplineId,setDisciplineId]=useState("");
  const [search,setSearch]=useState("");
  const [bulkOpen,setBulkOpen]=useState(false);
  const [disciplineOrder,setDisciplineOrder]=useState<string[]>(() => readStore<string[]>("mcr_discipline_order", []));
  const [disciplineOrderReady,setDisciplineOrderReady]=useState(false);
  const [draggingId,setDraggingId]=useState<string | null>(null);
  const [editingId,setEditingId]=useState<string | null>(null);
  const [editingName,setEditingName]=useState("");

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

  useEffect(()=>{
    const loadOrder=async()=>{
      const client=supabase as any;
      const {data,error}=await client.from("study_user_state").select("discipline_order").eq("user_id",(await client.auth.getUser()).data.user?.id).maybeSingle();
      if(!error && Array.isArray(data?.discipline_order)){
        setDisciplineOrder(data.discipline_order as string[]);
      }
      setDisciplineOrderReady(true);
    };
    void loadOrder();
  },[]);
  
  const moveDiscipline = (sourceId:string,targetId:string) => {
    if(sourceId===targetId) return;
    const current=orderedDisciplines.map((item:any)=>item.id);
    const from=current.indexOf(sourceId), to=current.indexOf(targetId);
    if(from<0||to<0)return;
    const next=[...current]; next.splice(from,1); next.splice(to,0,sourceId);
    setDisciplineOrder(next);
    writeStore("mcr_discipline_order",next);
    if(disciplineOrderReady){
      void (async()=>{
        const client=supabase as any;
        const {error}=await client.from("study_user_state").upsert(
          {user_id:(await client.auth.getUser()).data.user?.id,discipline_order:next},
          {onConflict:"user_id"}
        );
        if(error) notify("Sequência alterada, mas não foi possível sincronizar na nuvem.");
      })();
    }
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

  const startEdit=(item:any)=>{
    setEditingId(item.id);
    setEditingName(item.name ?? "");
  };

  const cancelEdit=()=>{
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit=async(id:string)=>{
    const clean=editingName.trim();
    if(!clean)return notify("Informe um nome para a disciplina.");
    const client=supabase as any;
    const {error}=await client.from("study_disciplines").update({name:clean}).eq("id",id);
    if(error)return notify(error.message);
    cancelEdit();
    notify("Disciplina atualizada.");
    refresh();
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
        {list.length?list.map((item:any)=><tr key={item.id} draggable={kind==="discipline"} onDragStart={()=>kind==="discipline"&&setDraggingId(item.id)} onDragOver={(e)=>kind==="discipline"&&e.preventDefault()} onDrop={()=>kind==="discipline"&&draggingId&&moveDiscipline(draggingId,item.id)} onDragEnd={()=>setDraggingId(null)} className={draggingId===item.id?"row-dragging":""}><td>{kind==="discipline"&&<span className="drag-handle" title="Arraste para reordenar"><GripVertical size={15}/></span>}{kind==="discipline"&&editingId===item.id?<input className="catalog-inline-edit" value={editingName} onChange={e=>setEditingName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void saveEdit(item.id)}if(e.key==="Escape")cancelEdit()}} autoFocus spellCheck={false}/>:item.name}</td>{kind==="subject"&&<td>{disciplines.find((d:Discipline)=>d.id===item.discipline_id)?.name??"—"}</td>}<td><div className="actions">{kind==="discipline"&&(editingId===item.id?<><button type="button" className="btn small primary" onClick={()=>void saveEdit(item.id)}><CheckCircle2 size={13}/> Salvar</button><button type="button" className="btn small" onClick={cancelEdit}><X size={13}/> Cancelar</button></>:<button type="button" className="btn small" onClick={()=>startEdit(item)}>Editar</button>)}<button type="button" className="btn small danger" onClick={()=>remove(item.id)}><Trash2 size={13}/> Excluir</button></div></td></tr>):<tr><td colSpan={kind==="subject"?3:2}><div className="empty">Nenhum cadastro encontrado.</div></td></tr>}
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

const GOOGLE_SHEETS_FONTS=["Arial","Arial Black","Calibri","Cambria","Comic Sans MS","Courier New","EB Garamond","Georgia","Impact","Lato","Lexend","Lobster","Lora","Merriweather","Montserrat","Nunito","Oswald"];
const GOOGLE_SHEETS_PALETTE=[
  ["#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#efefef","#f3f3f3","#ffffff"],
  ["#980000","#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#4a86e8","#0000ff","#9900ff","#ff00ff"],
  ["#e6b8af","#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#c9daf8","#cfe2f3","#d9d2e9","#ead1dc"],
  ["#dd7e6b","#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#a4c2f4","#9fc5e8","#b4a7d6","#d5a6bd"],
  ["#cc4125","#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6d9eeb","#6fa8dc","#8e7cc3","#c27ba0"],
  ["#a61c00","#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3c78d8","#3d85c6","#674ea7","#a64d79"],
  ["#85200c","#990000","#b45f06","#bf9000","#38761d","#134f5c","#1155cc","#0b5394","#351c75","#741b47"]
];

function PlannerColorPalette({title,colors,onPick,onCustom}:{title:string;colors:string[];onPick:(color:string)=>void;onCustom:(color:string)=>void}) {
  return <div className="planner-color-popover" role="dialog" aria-label={title}>
    <div className="planner-palette-reset"><button type="button" onClick={()=>onPick("")}><span className="planner-reset-icon">⌁</span> Redefinir</button></div>
    <div className="planner-palette-grid">
      {GOOGLE_SHEETS_PALETTE.flatMap((row,rowIndex)=>row.map((color,colIndex)=><button key={rowIndex+"-"+colIndex} type="button" className="planner-swatch" style={{backgroundColor:color}} aria-label={color} title={color} onClick={()=>onPick(color)} />))}
    </div>
    <div className="planner-palette-section">PERSONALIZADO <span>✎</span></div>
    <div className="planner-custom-row">
      {colors.map(color=><button key={color} type="button" className="planner-custom-swatch" style={{backgroundColor:color}} aria-label={color} onClick={()=>onPick(color)} />)}
      <label className="planner-custom-picker" title="Escolher cor personalizada"><span>+</span><input type="color" onChange={e=>onCustom(e.target.value)} /></label>
    </div>
  </div>;
}

function Planner({userId,notify,defaultSmallColor,completedSmallColor,subjects}:{userId:string;notify:(message:string)=>void;defaultSmallColor:string;completedSmallColor:string;}) {
  type CellPartStyle = { bg:string; fg:string; bold:boolean; italic:boolean; underline:boolean; strike:boolean; size:number; fontFamily:string; align:"left"|"center"|"right"; vertical:"top"|"middle"|"bottom"; wrap:"overflow"|"wrap"|"clip" };
  type Cell = { id:string; subject:string; text:string; studiedWeek?:string; bg:string; fg:string; subjectBg:string; subjectFg:string; bold:boolean; italic:boolean; underline:boolean; strike:boolean; size:number; fontFamily:string; align:"left"|"center"|"right"; vertical:"top"|"middle"|"bottom"; wrap:"overflow"|"wrap"|"clip"; subjectStyle?:CellPartStyle; textStyle?:CellPartStyle };
  type PlannerData = { version:2; weekOffset:number; cols:number; rows:number; headers:string[]; colWidths:number[]; rowHeights:number[]; cells:Record<string,Cell> };
  const defaultHeaders=["SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO","DOMINGO"];
  const defaultPartStyle=(kind:"subject"|"text"):CellPartStyle=>kind==="subject"?({bg:"#f7f8fa",fg:"#17202a",bold:true,italic:false,underline:false,strike:false,size:14,fontFamily:"Arial",align:"center",vertical:"top",wrap:"wrap"}):({bg:"#ffffff",fg:"#17202a",bold:true,italic:false,underline:false,strike:false,size:14,fontFamily:"Arial",align:"center",vertical:"top",wrap:"wrap"});
  const defaultCell=():Cell=>({id:uid(),subject:"",text:"",bg:"#ffffff",fg:"#17202a",subjectBg:"#f7f8fa",subjectFg:"#17202a",bold:false,italic:false,underline:false,strike:false,size:14,fontFamily:"Arial",align:"left",vertical:"top",wrap:"wrap",subjectStyle:defaultPartStyle("subject"),textStyle:defaultPartStyle("text")});
  const cleanPlannerField=(value:unknown)=>{const text=String(value??"").trim();const normalized=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();return normalized.startsWith("MATERIA")||normalized.startsWith("OBSERVACOES")||normalized.startsWith("OBSERVACAO")?"":text;};
  const makeInitial=():PlannerData=>({version:3,weekOffset:0,cols:7,rows:4,headers:[...defaultHeaders],colWidths:Array(7).fill(190),rowHeights:Array(4).fill(180),cells:{}});
  const key="mcr_planner_"+userId;
  const normalizePlanner=(raw:any):PlannerData=>{
    const cols=Math.max(1,Number(raw?.cols)||7);
    const rows=Math.max(1,Number(raw?.rows)||4);
    const headers=Array.from({length:cols},(_,i)=>String(raw?.headers?.[i]??defaultHeaders[i]??("COLUNA "+(i+1))));
    const colWidths=Array.from({length:cols},(_,i)=>{const v=Number(raw?.colWidths?.[i]);return Number.isFinite(v)&&v>=120?v:190;});
    const rowHeights=Array.from({length:rows},(_,i)=>{const v=Number(raw?.rowHeights?.[i]);return Number.isFinite(v)&&v>=90?v:180;});
    const cells:Record<string,Cell>={};
    Object.entries(raw?.cells??{}).forEach(([id,value]:any)=>{
      const subject=cleanPlannerField(value?.subject); const text=cleanPlannerField(value?.text); {
        const base={...defaultCell(),...(value||{}),id,subject,text,subjectBg:String(value?.subjectBg??"#f7f8fa"),subjectFg:String(value?.subjectFg??value?.fg??"#17202a")};
        const savedSubjectStyle=value?.subjectStyle;
        const hasLegacyDefaultSubjectStyle=savedSubjectStyle && savedSubjectStyle.bold===false && savedSubjectStyle.align==="left" && savedSubjectStyle.fontFamily==="Arial" && Number(savedSubjectStyle.size)===14 && savedSubjectStyle.bg==="#f7f8fa" && savedSubjectStyle.fg==="#17202a" && savedSubjectStyle.italic===false && savedSubjectStyle.underline===false && savedSubjectStyle.strike===false && savedSubjectStyle.vertical==="top" && savedSubjectStyle.wrap==="wrap";
        if(hasLegacyDefaultSubjectStyle) base.subjectStyle={...defaultPartStyle("subject")};
        const legacy={bg:String(value?.bg??"#ffffff"),fg:String(value?.fg??"#17202a"),bold:Boolean(value?.bold),italic:Boolean(value?.italic),underline:Boolean(value?.underline),strike:Boolean(value?.strike),size:Number(value?.size)||14,fontFamily:String(value?.fontFamily??"Arial"),align:(value?.align??"left") as CellPartStyle["align"],vertical:(value?.vertical??"top") as CellPartStyle["vertical"],wrap:(value?.wrap??"wrap") as CellPartStyle["wrap"]};
        const normalizedSavedSubjectStyle={...(value?.subjectStyle??{}),bold:true,align:"center" as const};
        const normalizedSavedTextStyle={...(value?.textStyle??{}),bold:true,align:"center" as const};
        const subjectStyle={...defaultPartStyle("subject"),...normalizedSavedSubjectStyle,bg:String(normalizedSavedSubjectStyle.bg??value?.subjectBg??"#f7f8fa"),fg:String(normalizedSavedSubjectStyle.fg??value?.subjectFg??"#17202a")};
        const textStyle={...defaultPartStyle("text"),...legacy,...normalizedSavedTextStyle};
        cells[id]={...base,subjectStyle,textStyle};
      }
    });
    return {version:3,weekOffset:Number(raw?.weekOffset)||0,cols,rows,headers,colWidths,rowHeights,cells};
  };
  const plannerHasContent=(planner:PlannerData)=>{
    if(Object.keys(planner.cells).length>0) return true;
    if(planner.weekOffset!==0) return true;
    if(planner.headers.some((header,index)=>header!==defaultHeaders[index])) return true;
    return planner.colWidths.some(width=>width!==190)||planner.rowHeights.some(height=>height!==180);
  };
  const [data,setData]=useState<PlannerData>(()=>normalizePlanner(readStore<PlannerData>(key,makeInitial())));
  const plannerRemoteReady=useRef(false);
  const plannerRemoteTimer=useRef<ReturnType<typeof setTimeout> | null>(null);
  const plannerLastRemoteJson=useRef<string | null>(null);
  const plannerSyncChannel=useRef<ReturnType<typeof supabase.channel> | null>(null);
  const plannerLocalEditAt=useRef(0);
  const [selected,setSelected]=useState<string[]>([]);
  const [selectedParts,setSelectedParts]=useState<string[]>([]);
  const [activePart,setActivePart]=useState<"subject"|"text">("subject");
  const [selectionMode,setSelectionMode]=useState<"cells"|"rows"|"cols">("cells");
  const [selectedRows,setSelectedRows]=useState<number[]>([]);
  const [selectedCols,setSelectedCols]=useState<number[]>([]);
  const dragSelection=useRef<{anchorRow:number;anchorCol:number;dragging:boolean}|null>(null);
  const [textColor,setTextColor]=useState("#17202a");
  const [fillColor,setFillColor]=useState("#ffffff");
  const [subjectFillColor,setSubjectFillColor]=useState("#f7f8fa");
  const [paletteOpen,setPaletteOpen]=useState<"text"|"fill"|null>(null);
  const [moreOpen,setMoreOpen]=useState(false);
  const [fullscreen,setFullscreen]=useState(false);
  const [shortcutHelpOpen,setShortcutHelpOpen]=useState(false);
  const plannerHistory=useRef<{past:PlannerData[];future:PlannerData[]}>({past:[],future:[]});
  const plannerHistoryMode=useRef<"undo"|"redo"|null>(null);
  const plannerPreviousData=useRef<PlannerData>(data);
  const resizing=useRef<{type:"col"|"row";index:number;start:number;size:number}|null>(null);

  useEffect(()=>{
    setData(prev=>normalizePlanner(prev));
    plannerRemoteReady.current=false;
    let cancelled=false;
    const loadRemotePlanner=async()=>{
      const client=supabase as any;
      const localData=normalizePlanner(readStore<PlannerData>(key,makeInitial()));
      const {data:remote,error}=await client
        .from("study_user_state")
        .select("planner_data,updated_at")
        .eq("user_id",userId)
        .maybeSingle();

      if(cancelled) return;

      if(error){
        plannerRemoteReady.current=true;
        notify("Não foi possível sincronizar o planejamento com a nuvem. Seus dados locais foram preservados.");
        return;
      }

      const remoteData=remote?.planner_data ? normalizePlanner(remote.planner_data) : null;
      plannerLastRemoteJson.current=remoteData ? JSON.stringify(remoteData) : null;
      const localHasContent=plannerHasContent(localData);
      const remoteHasContent=remoteData ? plannerHasContent(remoteData) : false;

      if(remoteData && remoteHasContent){
        setData(remoteData);
        writeStore(key,remoteData);
      }else if(localHasContent){
        const {data:saved,error:saveError}=await client
          .from("study_user_state")
          .upsert(
            {user_id:userId,planner_data:localData},
            {onConflict:"user_id"}
          )
          .select("planner_data,updated_at")
          .single();

        if(saveError){
          notify("Não foi possível salvar o planejamento na nuvem. Seus dados locais foram preservados.");
        }else if(saved?.planner_data){
          const confirmed=normalizePlanner(saved.planner_data);
          plannerLastRemoteJson.current=JSON.stringify(confirmed);
          setData(confirmed);
          writeStore(key,confirmed);
        }
      }

      plannerRemoteReady.current=true;
    };

    void loadRemotePlanner();

    return ()=>{
      cancelled=true;
      if(plannerRemoteTimer.current) clearTimeout(plannerRemoteTimer.current);
      plannerRemoteTimer.current=null;
      plannerRemoteReady.current=false;
    };
  },[userId]);

  useEffect(()=>{
    if(!userId) return;
    const channel=supabase.channel(`planner-sync-${userId}`);
    plannerSyncChannel.current=channel;
    channel
      .on("broadcast",{event:"planner_updated"},(message:any)=>{
        const incoming=message?.payload?.planner_data;
        if(!incoming) return;
        const next=normalizePlanner(incoming);
        const json=JSON.stringify(next);
        if(json===plannerLastRemoteJson.current) return;
        plannerLastRemoteJson.current=json;
        setData(next);
        writeStore(key,next);
      })
      .subscribe();
    return()=>{ plannerSyncChannel.current=null; void supabase.removeChannel(channel); };
  },[userId,key]);

  useEffect(()=>{
    writeStore(key,data);
    if(!plannerRemoteReady.current)return;
    if(plannerRemoteTimer.current) clearTimeout(plannerRemoteTimer.current);

    const snapshot=normalizePlanner(data);
    const snapshotJson=JSON.stringify(snapshot);
    if(snapshotJson===plannerLastRemoteJson.current)return;
    plannerRemoteTimer.current=setTimeout(async()=>{
      const client=supabase as any;
      const {data:saved,error}=await client
        .from("study_user_state")
        .upsert(
          {user_id:userId,planner_data:snapshot},
          {onConflict:"user_id"}
        )
        .select("planner_data,updated_at")
        .single();

      if(error){
        notify("Alteração feita localmente, mas não foi possível sincronizar o planejamento com a nuvem.");
        return;
      }

      if(saved?.planner_data){
        const confirmed=normalizePlanner(saved.planner_data);
        plannerLastRemoteJson.current=JSON.stringify(confirmed);
        writeStore(key,confirmed);
        void plannerSyncChannel.current?.send({type:"broadcast",event:"planner_updated",payload:{planner_data:confirmed}});
      }
    },350);

    return ()=>{
      if(plannerRemoteTimer.current) clearTimeout(plannerRemoteTimer.current);
    };
  },[key,data,userId]);
  const commitPlannerChange=(updater:(prev:PlannerData)=>PlannerData)=>{
    plannerHistory.current.past=[...plannerHistory.current.past.slice(-99),data];
    plannerHistory.current.future=[];
    plannerHistoryMode.current=null;
    setData(updater);
  };

  const plannerUndo=()=>{const previous=plannerHistory.current.past.pop();if(!previous)return;plannerHistory.current.future.push(data);plannerHistoryMode.current="undo";plannerPreviousData.current=previous;setData(previous);};
  const plannerRedo=()=>{const next=plannerHistory.current.future.pop();if(!next)return;plannerHistory.current.past.push(data);plannerHistoryMode.current="redo";plannerPreviousData.current=next;setData(next);};


  const beginResize=(type:"col"|"row",index:number,event:PointerEvent)=>{
    event.preventDefault();
    event.stopPropagation();
    plannerHistory.current.past=[...plannerHistory.current.past.slice(-99),data];
    plannerHistory.current.future=[];
    plannerHistoryMode.current=null;
    const sizes=type==="col"?data.colWidths:data.rowHeights;
    resizing.current={
      type,
      index,
      start:type==="col"?event.clientX:event.clientY,
      size:sizes[index]??(type==="col"?190:180)
    };
    document.body.classList.add("planner-resizing");
  };

  useEffect(()=>{
    const move=(event:globalThis.PointerEvent)=>{
      const r=resizing.current;
      if(!r) return;
      const delta=(r.type==="col"?event.clientX:event.clientY)-r.start;
      const min=r.type==="col"?120:90;
      const max=r.type==="col"?700:600;
      const next=Math.max(min,Math.min(max,r.size+delta));
      commitPlannerChange(prev=>r.type==="col"
        ? {...prev,colWidths:prev.colWidths.map((v,i)=>i===r.index?next:v)}
        : {...prev,rowHeights:prev.rowHeights.map((v,i)=>i===r.index?next:v)}
      );
    };
    const up=()=>{
      if(resizing.current){
        resizing.current=null;
        document.body.classList.remove("planner-resizing");
      }
    };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
    return ()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",up);
    };
  },[]);

  const weekStart=useMemo(()=>{
    const now=new Date(); now.setHours(12,0,0,0);
    const day=now.getDay()||7;
    now.setDate(now.getDate()-day+1+(data.weekOffset*7));
    return now;
  },[data.weekOffset]);

  const weekLabel=useMemo(()=>{
    const end=new Date(weekStart); end.setDate(end.getDate()+6);
    const f=(d:Date)=>d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}).replace(".","");
    return f(weekStart)+" — "+f(end);
  },[weekStart]);

  const weekKey=useMemo(()=>weekStart.toISOString().slice(0,10),[weekStart]);
  const isStudiedThisWeek=(id:string)=>getCell(id).studiedWeek===weekKey;
  const toggleStudied=(id:string)=>{
    commitPlannerChange(prev=>{
      const cell={...getCell(id)};
      const next={...cell,studiedWeek:cell.studiedWeek===weekKey?undefined:weekKey};
      return {...prev,cells:{...prev.cells,[id]:next}};
    });
  };

  const cellId=(r:number,col:number)=>r+"-"+col;
  const getCell=(id:string):Cell=>data.cells[id]??defaultCell();
  const updateCell=(id:string,patch:Partial<Cell>)=>{
    commitPlannerChange(prev=>({...prev,cells:{...prev.cells,[id]:{...getCell(id),...patch}}}));
  };
  const getPartStyle=(id:string,part:"subject"|"text"):CellPartStyle=>{
    const cell=getCell(id);
    return part==="subject"?(cell.subjectStyle??defaultPartStyle("subject")):(cell.textStyle??defaultPartStyle("text"));
  };
  const partKey=(id:string,part:"subject"|"text")=>id+":"+part;
  const selectCellPart=(id:string,part:"subject"|"text",additive=false)=>{
    setActivePart(part);
    setSelectionMode("cells");setSelectedRows([]);setSelectedCols([]);
    if(additive){
      setSelectedParts(prev=>prev.includes(partKey(id,part))?prev.filter(key=>key!==partKey(id,part)):[...prev,partKey(id,part)]);
      setSelected(prev=>prev.includes(id)?prev:[...prev,id]);
    }else{
      setSelectedParts([partKey(id,part)]);
      setSelected([id]);
    }
  };
  const partTargets=()=>selectedParts.length?selectedParts.map(key=>{const [id,part]=key.split(":") as [string,"subject"|"text"];return {id,part};}):selected.flatMap(id=>[{id,part:"subject" as const},{id,part:"text" as const}]);
  const applyPartPatch=(patch:Partial<CellPartStyle>)=>{
    const targets=partTargets();
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      targets.forEach(({id,part})=>{
        const cell=cells[id]??getCell(id);
        const current=part==="subject"?(cell.subjectStyle??defaultPartStyle("subject")):(cell.textStyle??defaultPartStyle("text"));
        const key=part==="subject"?"subjectStyle":"textStyle";
        cells[id]={...cell,[key]:{...current,...patch}};
      });
      return {...prev,cells};
    });
  };
  const togglePartFormat=(format:"bold"|"italic"|"underline"|"strike")=>{
    const targets=partTargets();
    const next=targets.some(({id,part})=>!getPartStyle(id,part)[format]);
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      targets.forEach(({id,part})=>{
        const cell={...getCell(id)};
        cells[id]={...cell,[part==="subject"?"subjectStyle":"textStyle"]:{...getPartStyle(id,part),[format]:next}};
      });
      return {...prev,cells};
    });
  };
  const updateHeader=(col:number,value:string)=>{
    commitPlannerChange(prev=>{
      const headers=[...(prev.headers??[])];
      while(headers.length<prev.cols) headers.push("COLUNA "+(headers.length+1));
      headers[col]=value.slice(0,40);
      return {...prev,headers};
    });
  };
  const cellsInRect=(r1:number,r2:number,c1:number,c2:number)=>{
    const rows=[] as number[];
    const cols=[] as number[];
    for(let r=Math.min(r1,r2);r<=Math.max(r1,r2);r++) rows.push(r);
    for(let col=Math.min(c1,c2);col<=Math.max(c1,c2);col++) cols.push(col);
    return {rows,cols,ids:rows.flatMap(r=>cols.map(col=>cellId(r,col)))};
  };
  const selectRect=(r1:number,r2:number,c1:number,c2:number)=>{
    const rect=cellsInRect(r1,r2,c1,c2);
    setSelectionMode("cells");setSelectedRows([]);setSelectedCols([]);setSelected(rect.ids);setSelectedParts([]);
  };
  const startCellSelection=(row:number,col:number,event:PointerEvent)=>{
    if(event.button!==0) return;
    event.preventDefault();
    const anchor=dragSelection.current={anchorRow:row,anchorCol:col,dragging:true};
    selectRect(row,row,col,col);
    const stop=()=>{if(dragSelection.current){dragSelection.current.dragging=false;dragSelection.current=null;}}
    const move=(ev:PointerEvent)=>{
      if(!dragSelection.current?.dragging) return;
      const el=document.elementFromPoint(ev.clientX,ev.clientY)?.closest("[data-planner-row][data-planner-col]") as HTMLElement|null;
      if(!el) return;
      const rr=Number(el.dataset.plannerRow), cc=Number(el.dataset.plannerCol);
      if(Number.isFinite(rr)&&Number.isFinite(cc)) selectRect(anchor.anchorRow,rr,anchor.anchorCol,cc);
    };
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop,{once:true});
  };
  const selectRowsRange=(start:number,end:number)=>{
    const rows=Array.from({length:Math.abs(end-start)+1},(_,i)=>Math.min(start,end)+i);
    setSelectedParts([]);setSelectionMode("rows");setSelectedRows(rows);setSelectedCols([]);
    setSelected(rows.flatMap(row=>Array.from({length:data.cols},(_,col)=>cellId(row,col))));
  };
  const selectColsRange=(start:number,end:number)=>{
    const cols=Array.from({length:Math.abs(end-start)+1},(_,i)=>Math.min(start,end)+i);
    setSelectedParts([]);setSelectionMode("cols");setSelectedRows([]);setSelectedCols(cols);
    setSelected(cols.flatMap(col=>Array.from({length:data.rows},(_,row)=>cellId(row,col))));
  };
  const selectRow=(row:number)=>selectRowsRange(row,row);
  const selectCol=(col:number)=>selectColsRange(col,col);
  const startAxisSelection=(axis:"row"|"col",index:number,event:PointerEvent)=>{
    if(event.button!==0) return;
    event.preventDefault();
    const anchor=index;
    if(axis==="row") selectRowsRange(anchor,anchor); else selectColsRange(anchor,anchor);
    let dragging=true;
    const move=(ev:PointerEvent)=>{
      if(!dragging) return;
      const el=document.elementFromPoint(ev.clientX,ev.clientY) as HTMLElement|null;
      const head=el?.closest(axis==="row"?".planner-row-selector":".planner-day") as HTMLElement|null;
      if(!head) return;
      if(axis==="row"){
        const buttons=Array.from(document.querySelectorAll<HTMLElement>(".planner-row-selector"));
        const next=buttons.indexOf(head); if(next>=0) selectRowsRange(anchor,next);
      }else{
        const heads=Array.from(document.querySelectorAll<HTMLElement>(".planner-day"));
        const next=heads.indexOf(head); if(next>=0) selectColsRange(anchor,next);
      }
    };
    const stop=()=>{dragging=false;window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);
  };
  const selectAll=()=>{setSelectedParts([]);const ids=Array.from({length:data.rows*data.cols},(_,i)=>cellId(Math.floor(i/data.cols),i%data.cols));setSelectionMode("cells");setSelectedRows([]);setSelectedCols([]);setSelected(ids);};
  const plannerSelectionBounds=()=>{
    const ids=selected.length?selected:[cellId(0,0)];
    const coords=ids.map(id=>{const [r,col]=id.split("-").map(Number);return {r,col};}).filter(v=>Number.isFinite(v.r)&&Number.isFinite(v.col));
    return {
      minRow:selectionMode==="rows"&&selectedRows.length?Math.min(...selectedRows):Math.min(...coords.map(v=>v.r)),
      maxRow:selectionMode==="rows"&&selectedRows.length?Math.max(...selectedRows):Math.max(...coords.map(v=>v.r)),
      minCol:selectionMode==="cols"&&selectedCols.length?Math.min(...selectedCols):Math.min(...coords.map(v=>v.col)),
      maxCol:selectionMode==="cols"&&selectedCols.length?Math.max(...selectedCols):Math.max(...coords.map(v=>v.col)),
    };
  };
  const plannerCellClipboard=()=>{
    const {minRow,maxRow,minCol,maxCol}=plannerSelectionBounds();
    return Array.from({length:maxRow-minRow+1},(_,rowOffset)=>
      Array.from({length:maxCol-minCol+1},(_,colOffset)=>{
        const cell=getCell(cellId(minRow+rowOffset,minCol+colOffset));
        return [cell.subject,cell.text].filter(Boolean).join("\\n");
      }).join("\\t")
    ).join("\\n");
  };
  const writePlannerClipboard=async(cut=false)=>{
    const text=plannerCellClipboard();
    try{await navigator.clipboard.writeText(text);}catch{
      const area=document.createElement("textarea"); area.value=text; area.style.position="fixed"; area.style.opacity="0";
      document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
    }
    if(cut){
      commitPlannerChange(prev=>{
        const cells={...prev.cells};
        selected.forEach(id=>{cells[id]={...getCell(id),subject:"",text:""};});
        return {...prev,cells};
      });
    }
    notify(cut?"Células recortadas.":"Células copiadas.");
  };
  const pastePlannerText=async(text?:string)=>{
    const value=typeof text==="string"?text:await navigator.clipboard.readText();
    if(!value) return;
    const rows=value.replace(/\\r/g,"").split("\\n");
    if(rows.length&&rows[rows.length-1]==="") rows.pop();
    const matrix=rows.map(row=>row.split("\\t"));
    const {minRow,minCol}=plannerSelectionBounds();
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      matrix.forEach((row,rowOffset)=>row.forEach((raw,colOffset)=>{
        const r=minRow+rowOffset,col=minCol+colOffset;
        if(r>=prev.rows||col>=prev.cols) return;
        const id=cellId(r,col);
        const parts=raw.split("\\n");
        const current=getCell(id);
        cells[id]={...current,subject:parts.shift()??"",text:parts.join("\\n")};
      }));
      return {...prev,cells};
    });
    notify("Conteúdo colado.");
  };
  const clearPlannerSelection=()=>{
    if(!selected.length) return;
    commitPlannerChange(prev=>{const cells={...prev.cells};selected.forEach(id=>{cells[id]={...getCell(id),subject:"",text:""};});return {...prev,cells};});
  };
  const plannerTargets=()=>selected.length?selected:[cellId(0,0)];
  const activeStyle=()=>getPartStyle(selected[0]??cellId(0,0),activePart);
  const applyPlannerPatch=(patch:Partial<CellPartStyle>)=>applyPartPatch(patch);
  const togglePlannerFormat=(format:"bold"|"italic"|"underline"|"strike")=>{
    const targets=selectedParts.length
      ? selectedParts.map(key=>{const [id,part]=key.split(":") as [string,"subject"|"text"];return {id,part};})
      : (selected.length?selected:[cellId(0,0)]).flatMap(id=>[{id,part:"subject" as const},{id,part:"text" as const}]);
    const first=targets[0];
    const next=first?format==="bold"?!getPartStyle(first.id,first.part).bold:!getPartStyle(first.id,first.part)[format]:true;
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      targets.forEach(({id,part})=>{
        const cell=cells[id]??getCell(id);
        const key=part==="subject"?"subjectStyle":"textStyle";
        cells[id]={...cell,[key]:{...getPartStyle(id,part),[format]:next}};
      });
      return {...prev,cells};
    });
  };
  const applyPlannerColor=(kind:"text"|"fill",color:string)=>{
    if(!color)return;
    if(kind==="text"){
      setTextColor(color);
      applyPartPatch({fg:color});
    }else{
      setFillColor(color);
      const targets=plannerTargets();
      commitPlannerChange(prev=>{
        const cells={...prev.cells};
        targets.forEach(id=>{
          const cell=cells[id]??getCell(id);
          cells[id]={
            ...cell,
            bg:color,
            subjectBg:color,
            subjectStyle:{...(cell.subjectStyle??defaultPartStyle("subject")),bg:color},
            textStyle:{...(cell.textStyle??defaultPartStyle("text")),bg:color}
          };
        });
        return {...prev,cells};
      });
    }
    setPaletteOpen(null);
  };
  const applyPlannerFont=(fontFamily:string)=>applyPartPatch({fontFamily});
  const applyPlannerSize=(size:number)=>applyPartPatch({size});
  const applyPlannerAlignment=(align:"left"|"center"|"right")=>applyPartPatch({align});
  const applyPlannerVertical=(vertical:"top"|"middle"|"bottom")=>applyPartPatch({vertical});
  const applyPlannerWrap=(wrap:"overflow"|"wrap"|"clip")=>applyPartPatch({wrap});
  const fillPlannerDirection=(direction:"down"|"right")=>{
    if(selected.length<2) return;
    const {minRow,maxRow,minCol,maxCol}=plannerSelectionBounds();
    const source=getCell(cellId(minRow,minCol));
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      if(direction==="down"){for(let r=minRow+1;r<=maxRow;r++) cells[cellId(r,minCol)]={...getCell(cellId(r,minCol)),subject:source.subject,text:source.text};}
      else{for(let col=minCol+1;col<=maxCol;col++) cells[cellId(minRow,col)]={...getCell(cellId(minRow,col)),subject:source.subject,text:source.text};}
      return {...prev,cells};
    });
  };
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const editing=!!target?.closest("input,textarea,[contenteditable=\\\"true\\\"]");
      const mod=event.ctrlKey||event.metaKey;
      if(editing) return;

      if(event.shiftKey&&event.code==="Space"&&!mod){
        event.preventDefault();
        selectRow(selected.length?Number(selected[0].split("-")[0]):0);
        return;
      }
      if(!mod){
        if(event.key==="Delete"||event.key==="Backspace"){
          event.preventDefault();
          if(selectedRows.length){deleteSelectedRows();return;}
          if(selectedCols.length){deleteSelectedCols();return;}
          clearPlannerSelection();
          return;
        }
        const arrows:any={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
        const delta=arrows[event.key];
        if(delta){
          event.preventDefault();
          const first=selected[0]??"0-0";const [row,col]=first.split("-").map(Number);
          const nextRow=Math.max(0,Math.min(data.rows-1,row+delta[0]));const nextCol=Math.max(0,Math.min(data.cols-1,col+delta[1]));
          selectRect(nextRow,nextRow,nextCol,nextCol);
        }
        return;
      }
      const key=event.key.toLowerCase();
      if(key==="c"){event.preventDefault();void writePlannerClipboard(false);}
      else if(key==="x"){event.preventDefault();void writePlannerClipboard(true);}
      else if(key==="v"){event.preventDefault();void pastePlannerText();}
      else if(key==="a"){event.preventDefault();selectAll();}
      else if(key==="b"){event.preventDefault();togglePlannerFormat("bold");}
      else if(key==="i"){event.preventDefault();togglePlannerFormat("italic");}
      else if(key==="d"){event.preventDefault();fillPlannerDirection("down");}
      else if(key==="r"){event.preventDefault();fillPlannerDirection("right");}
      else if(key==="enter"){event.preventDefault();const first=selected[0];if(first){const source=getCell(first);commitPlannerChange(prev=>{const cells={...prev.cells};selected.forEach(id=>{cells[id]={...getCell(id),subject:source.subject,text:source.text};});return {...prev,cells};});}}
      else if(key==="s"){event.preventDefault();notify("Planejamento salvo automaticamente.");}
      else if(key==="z"&&!event.shiftKey){event.preventDefault();plannerUndo();}
      else if((key==="z"&&event.shiftKey)||key==="y"){event.preventDefault();plannerRedo();}
      else if(key==="/" ){event.preventDefault();setShortcutHelpOpen(true);}
      else if(key==="f"){event.preventDefault();notify("Use Ctrl+F para localizar no planejamento.");}
      else if(key==="h"){event.preventDefault();notify("Use Ctrl+H para localizar e substituir no planejamento.");}
      else if(event.code==="Space"){event.preventDefault();selectCol(selected.length?Number(selected[0].split("-")[1]):0);}
    };
    const onPaste=(event:ClipboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest("input,textarea,[contenteditable=\\\"true\\\"]")) return;
      const text=event.clipboardData?.getData("text/plain");
      if(!text) return;
      event.preventDefault();void pastePlannerText(text);
    };
    window.addEventListener("keydown",onKeyDown);
    window.addEventListener("paste",onPaste);
    return()=>{window.removeEventListener("keydown",onKeyDown);window.removeEventListener("paste",onPaste);};
  },[data,selected,selectionMode,selectedRows,selectedCols]);

  const toggleSelected=(id:string)=>{
    setSelectionMode("cells");setSelectedRows([]);setSelectedCols([]);
    setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };
  const deleteSelectedRows=()=>{
    if(!selectedRows.length || data.rows<=1) return;
    if(!window.confirm(`Excluir ${selectedRows.length} linha(s) selecionada(s)?`)) return;
    const remove=new Set(selectedRows);
    commitPlannerChange(prev=>{
      const rowsToKeep=Array.from({length:prev.rows},(_,r)=>r).filter(r=>!remove.has(r));
      const cells:Record<string,Cell>={};
      rowsToKeep.forEach((oldR,newR)=>{for(let col=0;col<prev.cols;col++){const oldId=cellId(oldR,col);const value=prev.cells[oldId];if(value) cells[cellId(newR,col)]={...value,id:cellId(newR,col)};}});
      return {...prev,rows:rowsToKeep.length,rowHeights:rowsToKeep.map(r=>prev.rowHeights[r]??180),cells};
    });
    setSelected([]);setSelectedRows([]);setSelectionMode("cells");
  };
  const deleteSelectedCols=()=>{
    if(!selectedCols.length || data.cols<=1) return;
    if(!window.confirm(`Excluir ${selectedCols.length} coluna(s) selecionada(s)?`)) return;
    const remove=new Set(selectedCols);
    commitPlannerChange(prev=>{
      const colsToKeep=Array.from({length:prev.cols},(_,col)=>col).filter(col=>!remove.has(col));
      const headers=colsToKeep.map(col=>prev.headers[col]??("COLUNA "+(col+1)));
      const cells:Record<string,Cell>={};
      for(let row=0;row<prev.rows;row++) colsToKeep.forEach((oldCol,newCol)=>{const oldId=cellId(row,oldCol);const value=prev.cells[oldId];if(value) cells[cellId(row,newCol)]={...value,id:cellId(row,newCol)};});
      return {...prev,cols:colsToKeep.length,headers,colWidths:colsToKeep.map(col=>prev.colWidths[col]??190),cells};
    });
    setSelected([]);setSelectedCols([]);setSelectionMode("cells");
  };
  const applyFill=()=>{commitPlannerChange(prev=>{const cells={...prev.cells};selected.forEach(id=>{cells[id]={...getCell(id),bg:fillColor}});return {...prev,cells}});notify("Cor aplicada.");};
  const applyText=()=>{commitPlannerChange(prev=>{const cells={...prev.cells};selected.forEach(id=>{cells[id]={...getCell(id),fg:textColor}});return {...prev,cells}});notify("Cor do texto das observações aplicada.");};
  const applySubjectFill=()=>{commitPlannerChange(prev=>{const cells={...prev.cells};selected.forEach(id=>{cells[id]={...getCell(id),subjectBg:subjectFillColor}});return {...prev,cells}});notify("Cor da matéria aplicada.");};
  const clearSelection=()=>{setSelected([]);setSelectedRows([]);setSelectedCols([]);setSelectionMode("cells");};
  const addRow=()=>commitPlannerChange(prev=>({...prev,rows:prev.rows+1,rowHeights:[...prev.rowHeights,180]}));
  const addCol=()=>commitPlannerChange(prev=>{
    const headers=[...(prev.headers??[])];
    headers.push("COLUNA "+(prev.cols+1));
    return {...prev,cols:prev.cols+1,headers,colWidths:[...prev.colWidths,190]};
  });
  const resetPlanner=()=>{if(window.confirm("Limpar todo o conteúdo desta semana?")){commitPlannerChange(prev=>({...prev,cells:{}}));setSelected([]);}};
  const startNextCycle=()=>{
    commitPlannerChange(prev=>{
      const cells={...prev.cells};
      Object.keys(cells).forEach(id=>{
        const cell=cells[id];
        cells[id]={
          ...cell,
          studiedWeek:undefined,
          bg:"#ffffff",
          subjectBg:defaultSmallColor,
          subjectStyle:{...(cell.subjectStyle??defaultPartStyle("subject")),bg:defaultSmallColor},
          textStyle:{...(cell.textStyle??defaultPartStyle("text")),bg:"#ffffff"},
        };
      });
      return {...prev,weekOffset:prev.weekOffset+1,cells};
    });
    setSelected([]);
    setSelectedRows([]);
    setSelectedCols([]);
    setSelectionMode("cells");
    notify("Novo ciclo iniciado. As matérias voltaram para a cor padrão e para não estudadas.");
  };
  const copyWeek=()=>{commitPlannerChange(prev=>{const cells:{[key:string]:Cell}={...prev.cells};for(let r=0;r<prev.rows;r++)for(let col=0;col<prev.cols;col++){const id=cellId(r,col);cells[id]={...getCell(id),id:uid()};}return {...prev,cells}});notify("Semana duplicada.");};

  return <div className={"planner-shell "+(fullscreen?"planner-fullscreen":"")}>
    {shortcutHelpOpen ? <div className="planner-shortcuts-backdrop" role="dialog" aria-modal="true" onClick={()=>setShortcutHelpOpen(false)}>
      <div className="planner-shortcuts-modal" onClick={e=>e.stopPropagation()}>
        <div className="planner-shortcuts-head"><strong>Atalhos do Planejamento</strong><button className="planner-tool" onClick={()=>setShortcutHelpOpen(false)}>×</button></div>
        <div className="planner-shortcuts-grid">
          <span>Ctrl/Cmd + C</span><span>Copiar células</span><span>Ctrl/Cmd + X</span><span>Recortar células</span><span>Ctrl/Cmd + V</span><span>Colar células</span><span>Ctrl/Cmd + Shift + V</span><span>Colar valores</span><span>Ctrl/Cmd + Z</span><span>Desfazer</span><span>Ctrl/Cmd + Shift + Z</span><span>Refazer</span><span>Ctrl/Cmd + A</span><span>Selecionar tudo</span><span>Ctrl + Espaço</span><span>Selecionar coluna</span><span>Shift + Espaço</span><span>Selecionar linha</span><span>Ctrl/Cmd + B</span><span>Negrito</span><span>Ctrl/Cmd + I</span><span>Itálico</span><span>Ctrl/Cmd + D</span><span>Preencher abaixo</span><span>Ctrl/Cmd + R</span><span>Preencher à direita</span><span>Delete / Backspace</span><span>Limpar conteúdo</span><span>Ctrl/Cmd + S</span><span>Salvar (automático)</span><span>Ctrl/Cmd + /</span><span>Mostrar atalhos</span><span>Ctrl/Cmd + F</span><span>Localizar</span><span>Ctrl/Cmd + H</span><span>Localizar e substituir</span>
        </div>
      </div>
    </div> : null}

    <div className="planner-formatbar">
      <button className="planner-format-btn planner-fullscreen-visible-btn" title={fullscreen ? "Sair da tela cheia" : "Abrir planejamento em tela cheia"} aria-label={fullscreen ? "Sair da tela cheia" : "Abrir planejamento em tela cheia"} onClick={()=>setFullscreen(v=>!v)}>
        {fullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
      </button>
      <button className="planner-format-btn planner-fullscreen-visible-btn" title="Iniciar próximo ciclo" aria-label="Iniciar próximo ciclo" onClick={startNextCycle}>
        <RotateCcw size={15}/>
      </button>
      <span className="planner-format-sep"/>
      <button className="planner-icon-tool" title="Desfazer" onClick={plannerUndo}><Undo2 size={16}/></button>
      <button className="planner-icon-tool" title="Refazer" onClick={plannerRedo}><Redo2 size={16}/></button>
      <span className="planner-format-sep"/>
      <select className="planner-format-select planner-font-select" title="Fonte" value={activeStyle().fontFamily} onChange={e=>applyPlannerFont(e.target.value)}>
        {GOOGLE_SHEETS_FONTS.map(font=><option key={font} value={font}>{font}</option>)}
      </select>
      <select className="planner-format-select planner-size-select" title="Tamanho da fonte" value={activeStyle().size} onChange={e=>applyPlannerSize(Number(e.target.value))}>
        {[8,9,10,11,12,14,16,18,20,22,24,28,32,36].map(size=><option key={size} value={size}>{size}</option>)}
      </select>
      <span className="planner-format-sep"/>
      <button className={"planner-format-btn "+(activeStyle().bold?"active":"")} title="Negrito" onClick={()=>togglePlannerFormat("bold")}><Bold size={15}/></button>
      <button className={"planner-format-btn "+(activeStyle().italic?"active":"")} title="Itálico" onClick={()=>togglePlannerFormat("italic")}><Italic size={15}/></button>
      <button className={"planner-format-btn "+(activeStyle().underline?"active":"")} title="Sublinhado" onClick={()=>togglePlannerFormat("underline")}><Underline size={15}/></button>
      <button className={"planner-format-btn "+(activeStyle().strike?"active":"")} title="Tachado" onClick={()=>togglePlannerFormat("strike")}><Strikethrough size={15}/></button>

      <div className="planner-popover-wrap">
        <button className="planner-format-btn planner-color-btn" title="Cor do texto" onClick={()=>{setPaletteOpen(p=>p==="text"?null:"text");setMoreOpen(false)}}><span className="planner-color-A">A</span><span className="planner-color-line" style={{backgroundColor:textColor}}/><ChevronDown size={11}/></button>
        {paletteOpen==="text" && <PlannerColorPalette title="Cor do texto" colors={[textColor,"#000000","#ffffff","#d63384","#4285f4","#34a853","#fbbc04","#ea4335"]} onPick={color=>applyPlannerColor("text",color)} onCustom={color=>applyPlannerColor("text",color)}/>}
      </div>

      <div className="planner-popover-wrap">
        <button className="planner-format-btn" title="Cor de preenchimento" onClick={()=>{setPaletteOpen(p=>p==="fill"?null:"fill");setMoreOpen(false)}}><PaintBucket size={15}/><span className="planner-fill-indicator" style={{backgroundColor:fillColor}}/><ChevronDown size={11}/></button>
        {paletteOpen==="fill" && <PlannerColorPalette title="Cor de preenchimento" colors={[fillColor,"#ffffff","#fff2cc","#d9ead3","#cfe2f3","#ead1dc","#fce5cd","#f4cccc"]} onPick={color=>applyPlannerColor("fill",color)} onCustom={color=>applyPlannerColor("fill",color)}/>}
      </div>

      <div className="planner-popover-wrap">
        <button className="planner-format-btn" title="Centralizar texto" onClick={()=>applyPlannerAlignment("center")}><AlignCenter size={15}/><ChevronDown size={11}/></button>
        <div className="planner-align-menu">
          <button title="Alinhar à esquerda" onClick={()=>applyPlannerAlignment("left")}><AlignLeft size={15}/> Esquerda</button>
          <button title="Centralizar" onClick={()=>applyPlannerAlignment("center")}><AlignCenter size={15}/> Centro</button>
          <button title="Alinhar à direita" onClick={()=>applyPlannerAlignment("right")}><AlignRight size={15}/> Direita</button>
        </div>
      </div>
      <div className="planner-popover-wrap planner-static-menu">
        <button className="planner-format-btn" title="Mais opções" onClick={()=>{setMoreOpen(v=>!v);setPaletteOpen(null)}}><MoreHorizontal size={16}/></button>
        {moreOpen && <div className="planner-more-menu">
          <div className="planner-menu-title">FORMATAÇÃO</div>
          <button onClick={()=>applyPlannerVertical("top")}>Alinhar no topo</button>
          <button onClick={()=>applyPlannerVertical("middle")}>Centralizar verticalmente</button>
          <button onClick={()=>applyPlannerVertical("bottom")}>Alinhar embaixo</button>
          <button onClick={()=>applyPlannerWrap("wrap")}><WrapText size={14}/> Quebrar texto</button>
          <button onClick={()=>applyPlannerWrap("overflow")}>Transbordar</button>
          <button onClick={()=>applyPlannerWrap("clip")}>Cortar</button>
          <div className="planner-menu-divider"/>
          <button onClick={addRow}>+ Adicionar linha</button>
          <button onClick={addCol}>+ Adicionar coluna</button>
          <button onClick={deleteSelectedRows} disabled={!selectedRows.length || data.rows<=1}>− Excluir linha</button>
          <button onClick={deleteSelectedCols} disabled={!selectedCols.length || data.cols<=1}>− Excluir coluna</button>
          <button onClick={copyWeek}>Duplicar semana</button>
          <button onClick={()=>setFullscreen(v=>!v)}>{fullscreen?"Sair da tela cheia":"Tela cheia"}</button>
          <button onClick={resetPlanner}>Limpar semana</button>
          <button onClick={selectAll}>Selecionar tudo</button>
          <button onClick={()=>setShortcutHelpOpen(true)}>Atalhos</button>
        </div>}
      </div>
    </div>
    <div className="planner-grid-wrap">
      <div className="planner-grid" style={{gridTemplateColumns:["30px",...data.colWidths.map(w=>w+"px")].join(" "),gridTemplateRows:["34px",...data.rowHeights.map(h=>h+"px")].join(" ")}}>
        <button className="planner-corner-selector" title="Selecionar toda a planilha" onClick={selectAll}>□</button>
        {Array.from({length:data.cols},(_,col)=>{
          const label=data.headers?.[col]??("COLUNA "+(col+1));
          return <div className={"planner-day "+(selectedCols.includes(col)?"axis-selected":"")} key={"head-"+col} onPointerDown={e=>{if((e.target as HTMLElement).closest(".planner-resize-handle")) return;startAxisSelection("col",col,e)}} onClick={()=>selectCol(col)}>
            <span className="planner-resize-handle planner-col-resize" onPointerDown={e=>{e.stopPropagation();beginResize("col",col,e)}} aria-hidden="true"/><input onClick={e=>{e.stopPropagation();selectCol(col)}} value={label} onChange={e=>updateHeader(col,e.target.value)} onKeyDown={e=>{if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();e.stopPropagation();deleteSelectedCols();}}} aria-label={"Nome da coluna "+(col+1)} spellCheck={false}/>
          </div>;
        })}
        {Array.from({length:data.rows},(_,row)=>[
          <button key={"row-head-"+row} className={"planner-row-selector "+(selectedRows.includes(row)?"axis-selected":"")} onPointerDown={e=>startAxisSelection("row",row,e)} onClick={()=>selectRow(row)}>{row+1}</button>,
          ...Array.from({length:data.cols},(_,col)=>{
          const id=cellId(row,col), cell=getCell(id), active=selected.includes(id);
          return <div key={id} data-planner-row={row} data-planner-col={col} className={"planner-cell "+(active?"selected":"")} style={{backgroundColor:cell.bg}}
            onPointerDown={e=>{const target=e.target as HTMLElement;if(target.closest("input,textarea,button,select")) return;if(e.shiftKey&&selected.length){const first=selected[0].split("-").map(Number);selectRect(first[0],row,first[1],col);return;}startCellSelection(row,col,e)}}
            onClick={(e)=>{const target=e.target as HTMLElement;if(target.closest("input,textarea,button,select")) return;if(e.ctrlKey||e.metaKey)toggleSelected(id);}}>
            <span className="planner-resize-handle planner-row-resize" onPointerDown={e=>beginResize("row",row,e)} />
            <div className="planner-subject-wrap">
            <input
              className={"planner-content-top "+(selectedParts.includes(partKey(id,"subject"))?"planner-part-selected":"")}
              aria-label="Conteúdo superior da célula sem rótulo visível"
              data-planner-subject={id}
              value={cell.subject}
              onChange={e=>updateCell(id,{subject:e.target.value})}
              onClick={e=>{e.stopPropagation();selectCellPart(id,"subject",e.ctrlKey||e.metaKey)}}
              onPointerDown={e=>e.stopPropagation()}
              onFocus={()=>selectCellPart(id,"subject",false)}
              style={{backgroundColor:isStudiedThisWeek(id)?completedSmallColor:((getPartStyle(id,"subject").bg&&getPartStyle(id,"subject").bg!=="#f7f8fa")?getPartStyle(id,"subject").bg:defaultSmallColor),color:getPartStyle(id,"subject").fg,fontSize:getPartStyle(id,"subject").size,fontWeight:getPartStyle(id,"subject").bold?"700":"400",fontStyle:getPartStyle(id,"subject").italic?"italic":"normal",fontFamily:getPartStyle(id,"subject").fontFamily,textAlign:getPartStyle(id,"subject").align,textDecoration:[getPartStyle(id,"subject").underline?"underline":"",getPartStyle(id,"subject").strike?"line-through":""] .filter(Boolean).join(" "),whiteSpace:getPartStyle(id,"subject").wrap==="wrap"?"normal":getPartStyle(id,"subject").wrap==="clip"?"nowrap":"pre-wrap",padding:getPartStyle(id,"subject").vertical==="middle"?"8px":"8px",lineHeight:getPartStyle(id,"subject").vertical==="middle"?"29px":getPartStyle(id,"subject").vertical==="bottom"?"40px":"1.2"}}
              spellCheck={false}
            />
            {cell.subject.trim() && <button type="button" className={"planner-study-check "+(isStudiedThisWeek(id)?"checked":"")} aria-label={isStudiedThisWeek(id)?"Desmarcar matéria estudada":"Marcar matéria como estudada"} title={isStudiedThisWeek(id)?"Desmarcar como estudada":"Marcar como estudada"} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();toggleStudied(id);}}>
              {isStudiedThisWeek(id) ? "✓" : ""}
            </button>}
            </div>
            <textarea
              className={"planner-content-bottom "+(selectedParts.includes(partKey(id,"text"))?"planner-part-selected":"")}
              aria-label="Conteúdo inferior da célula sem rótulo visível"
              value={cell.text}
              onChange={e=>updateCell(id,{text:e.target.value})}
              onClick={e=>{e.stopPropagation();selectCellPart(id,"text",e.ctrlKey||e.metaKey)}}
              onPointerDown={e=>e.stopPropagation()}
              onFocus={()=>selectCellPart(id,"text",false)}
              style={{backgroundColor:"#ffffff",color:getPartStyle(id,"text").fg,fontSize:getPartStyle(id,"text").size,fontWeight:getPartStyle(id,"text").bold?"700":"400",fontStyle:getPartStyle(id,"text").italic?"italic":"normal",fontFamily:getPartStyle(id,"text").fontFamily,textAlign:getPartStyle(id,"text").align,textDecoration:[getPartStyle(id,"text").underline?"underline":"",getPartStyle(id,"text").strike?"line-through":""] .filter(Boolean).join(" "),whiteSpace:getPartStyle(id,"text").wrap==="wrap"?"normal":getPartStyle(id,"text").wrap==="clip"?"nowrap":"pre-wrap",padding:getPartStyle(id,"text").vertical==="bottom"?"28px 8px 8px":getPartStyle(id,"text").vertical==="middle"?"18px 8px":"8px"}}
              spellCheck={false}
            />
          </div>;
        })])}
      </div>
    </div>
  </div>;
}

function SettingsPage({
  studentName,setStudentName,
  dailyGoal,weeklyGoal,monthlyGoal,targetAccuracy,
  plannerDefaultColor,setPlannerDefaultColor,plannerCompletedColor,setPlannerCompletedColor,
  theme,setTheme,buttonColor,setButtonColor,
  setDailyGoal,setWeeklyGoal,setMonthlyGoal,setTargetAccuracy,save,
  session,passwordModalOpen,setPasswordModalOpen,currentPassword,setCurrentPassword,
  newPassword,setNewPassword,confirmPassword,setConfirmPassword,passwordBusy,
  changePassword,signOutOtherSessions,logout
}:any) {
  const [plannerSettingsPalette,setPlannerSettingsPalette] = useState<"default"|"completed"|null>(null);
  return <>
    <h1 className="page-title">Configurações</h1>
    <p className="subtitle">Personalize suas metas, aparência e segurança da conta.</p>
    <section className="section">
      <div className="section-head">👤 IDENTIFICAÇÃO</div>
      <div className="section-body">
        <div className="form-grid">
          <Field label="Nome do aluno"><input type="text" maxLength={80} value={studentName} onChange={(e)=>setStudentName(e.target.value)} placeholder="Como você quer ser chamado?" /></Field>
        </div>
        <div className="notice">Esse nome será usado nas saudações do Dashboard e nas notificações personalizadas do MCR.</div>
      </div>
    </section>
    <section className="section">
      <div className="section-head">🎯 METAS DE ESTUDO</div>
      <div className="section-body">
        <div className="form-grid">
          <Field label="Meta diária de questões"><input type="number" min="1" value={dailyGoal} onChange={(e)=>setDailyGoal(Number(e.target.value))}/></Field>
          <Field label="Meta semanal de questões"><input type="number" min="1" value={weeklyGoal} onChange={(e)=>setWeeklyGoal(Number(e.target.value))}/></Field>
          <Field label="Meta mensal de questões"><input type="number" min="1" value={monthlyGoal} onChange={(e)=>setMonthlyGoal(Number(e.target.value))}/></Field>
          <Field label="Meta de aproveitamento (%)"><input type="number" min="0" max="100" value={targetAccuracy} onChange={(e)=>setTargetAccuracy(Number(e.target.value))}/></Field>
        </div>
        <div className="notice settings-auto-save"><Target size={15}/> Metas e identificação são salvas automaticamente na sua conta e ficam disponíveis em qualquer dispositivo após o login.</div>
      </div>
    </section>
    <section className="section">
      <div className="section-head">🟨 CORES DAS MATÉRIAS</div>
      <div className="section-body">
        <p className="subtitle planner-color-note">Escolha as cores usadas nos quadradinhos pequenos da matéria. A primeira é a cor inicial; a segunda aparece quando você marcar a matéria como estudada na semana.</p>
        <div className="planner-settings-colors">
          <div className="planner-setting-color">
            <div>
              <strong>Matéria não estudada</strong>
              <small>Cor padrão no início da semana</small>
            </div>
            <div className="planner-setting-color-control">
              <button type="button" className="planner-setting-color-button" style={{backgroundColor:plannerDefaultColor}} aria-label="Escolher cor padrão da matéria" onClick={()=>setPlannerSettingsPalette(v=>v==="default"?null:"default")}/>
              <span>{plannerDefaultColor}</span>
              {plannerSettingsPalette==="default" && <PlannerColorPalette title="Cor padrão da matéria" colors={[plannerDefaultColor,plannerCompletedColor]} onPick={color=>{if(color){setPlannerDefaultColor(color);setPlannerSettingsPalette(null)}}} onCustom={color=>{setPlannerDefaultColor(color);setPlannerSettingsPalette(null)}}/>}
            </div>
          </div>
          <div className="planner-setting-color">
            <div>
              <strong>Matéria estudada</strong>
              <small>Cor após marcar ✓ na semana</small>
            </div>
            <div className="planner-setting-color-control">
              <button type="button" className="planner-setting-color-button" style={{backgroundColor:plannerCompletedColor}} aria-label="Escolher cor de matéria estudada" onClick={()=>setPlannerSettingsPalette(v=>v==="completed"?null:"completed")}/>
              <span>{plannerCompletedColor}</span>
              {plannerSettingsPalette==="completed" && <PlannerColorPalette title="Cor de matéria estudada" colors={[plannerCompletedColor,plannerDefaultColor]} onPick={color=>{if(color){setPlannerCompletedColor(color);setPlannerSettingsPalette(null)}}} onCustom={color=>{setPlannerCompletedColor(color);setPlannerSettingsPalette(null)}}/>}
            </div>
          </div>
        </div>
        <div className="notice">O ✓ é apenas um marcador discreto. Ao marcar, somente o quadradinho pequeno da matéria muda para a cor de concluído.</div>
      </div>
    </section>
    <section className="section">
      <div className="section-head">🎨 APARÊNCIA</div>
      <div className="section-body">
        <div className="theme-choice-grid">
          <button className={"theme-choice " + (theme === "light" ? "active" : "")} onClick={()=>setTheme("light")} aria-pressed={theme === "light"}>
            <span className="theme-preview theme-preview-light"><span></span><i></i><i></i></span>
            <span><strong>Tema claro</strong><small>Padrão do MCR</small></span>
          </button>
          <button className={"theme-choice " + (theme === "dark" ? "active" : "")} onClick={()=>setTheme("dark")} aria-pressed={theme === "dark"}>
            <span className="theme-preview theme-preview-dark"><span></span><i></i><i></i></span>
            <span><strong>Tema escuro</strong><small>Mais confortável em ambientes com pouca luz</small></span>
          </button>
        </div>
        <div className="notice theme-note">O tema claro é o padrão. A preferência fica salva na sua conta e será carregada em qualquer dispositivo ou navegador após o login.</div>
      </div>
    </section>
    <section className="section">
      <div className="section-head">🎨 COR DOS BOTÕES</div>
      <div className="section-body">
        <div className="button-color-setting">
          <div>
            <strong>Cor principal dos botões</strong>
            <small>Escolha a cor dos botões de destaque do sistema.</small>
          </div>
          <div className="button-color-control">
            <input
              type="color"
              value={buttonColor}
              onChange={(e)=>setButtonColor(e.target.value)}
              aria-label="Escolher cor dos botões"
              className="button-color-picker"
            />
            <span>{buttonColor.toUpperCase()}</span>
            <button type="button" className="btn" onClick={()=>setButtonColor("#d63384")}>Restaurar padrão</button>
          </div>
        </div>
        <div className="button-color-preview">
          <button type="button" className="btn primary">Pré-visualização</button>
          <span>O padrão original do MCR é rosa.</span>
        </div>
        <div className="notice">A cor é individual por aluno. Quem já usa o sistema continua com o rosa padrão até escolher outra cor. Restaurar padrão volta para o rosa.</div>
      </div>
    </section>
    <section className="section">
      <div className="section-head">🔐 CONTA E SEGURANÇA</div>
      <div className="section-body account-settings">
        <div className="account-row">
          <div><strong>Conta atual</strong><span>{session?.user.email ?? "—"}</span></div>
          <span className="account-status">Sessão ativa</span>
        </div>
        <div className="account-actions">
          <button className="btn" onClick={()=>setPasswordModalOpen(true)}>Alterar senha</button>
          <button className="btn" onClick={signOutOtherSessions}>Encerrar outras sessões</button>
          <button className="btn danger" onClick={logout}><LogOut size={15}/> Sair da conta</button>
        </div>
        <div className="notice">A alteração de senha exige a confirmação da senha atual. O encerramento de outras sessões não exclui seus dados.</div>
      </div>
    </section>
    {passwordModalOpen && <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal password-modal">
        <h2>Alterar senha</h2>
        <p className="subtitle">Confirme sua senha atual e defina uma nova senha.</p>
        <div className="form-grid password-grid">
          <Field label="Senha atual"><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} /></Field>
          <Field label="Nova senha"><input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} /></Field>
          <Field label="Confirmar nova senha"><input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} /></Field>
        </div>
        <div className="modal-actions">
          <button className="btn" disabled={passwordBusy} onClick={()=>setPasswordModalOpen(false)}>Cancelar</button>
          <button className="btn primary" disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword} onClick={changePassword}>{passwordBusy ? "Alterando..." : "Alterar senha"}</button>
        </div>
      </div>
    </div>}
  </>;
}

export default function RootApp() {
  return <AppErrorBoundary><App/></AppErrorBoundary>;
}
