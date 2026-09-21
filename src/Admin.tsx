import { useEffect, useMemo, useState } from "react";
import { Copy, Download, LogIn, LogOut, Search, ShieldCheck, Users, RefreshCw, X, CheckCircle2, Clock3, Ban, KeyRound, Bell, Unlock } from "lucide-react";
import { supabase } from "./integrations/supabase/client";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until?: string | null;
};

const TOKEN_KEY = "mcr_admin_session";
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const getName = (u: AdminUser) => u.name?.trim() || "Nome não informado";

export default function AdminPage() {
  const [token, setToken] = useState(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    // Invalidar sessões antigas do fallback local. Controles administrativos
    // só podem operar com um token emitido pelo banco.
    if (stored === "local-admin") {
      sessionStorage.removeItem(TOKEN_KEY);
      return "";
    }
    return stored;
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "pending">("all");
  const [sort, setSort] = useState<"created" | "name" | "last">("created");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [copied, setCopied] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");

  const loadUsers = async () => {
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await (supabase as any).rpc("admin_list_users", { p_token: token });
    setBusy(false);
    if (rpcError || !data) {
      setError("Não foi possível carregar os alunos. Tente novamente em Atualizar.");
      return;
    }
    setUsers((data || []) as AdminUser[]);
  };

  useEffect(() => {
    if (token) void loadUsers();
  }, [token]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await (supabase as any).rpc("admin_login", {
      p_username: username.trim(),
      p_password: password,
    });
    setBusy(false);
    if (rpcError || !data?.token) {
      setError("Usuário ou senha administrativa inválidos. A sessão segura não foi criada.");
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setPassword("");
  };

  const logout = async () => {
    if (token && token !== "local-admin") await (supabase as any).rpc("admin_logout", { p_token: token });
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUsers([]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = users.filter(u => {
      const matchesSearch = !q || getName(u).toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
      const matchesFilter = filter === "all" || (filter === "confirmed" ? !!u.email_confirmed_at : !u.email_confirmed_at);
      return matchesSearch && matchesFilter;
    });
    return [...result].sort((a,b) => {
      if (sort === "name") return getName(a).localeCompare(getName(b), "pt-BR");
      if (sort === "last") return (b.last_sign_in_at || "").localeCompare(a.last_sign_in_at || "");
      return b.created_at.localeCompare(a.created_at);
    });
  }, [users, query, filter, sort]);

  const active7 = useMemo(() => {
    const limit = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= limit).length;
  }, [users]);

  const adminAction = async (action: "block"|"unblock"|"password") => {
    if (!selected) return;
    setActionBusy(true); setActionMessage("");
    const { data, error } = await (supabase as any).rpc("admin_manage_student", {
      p_token: token, p_user_id: selected.id, p_action: action, p_password: action === "password" ? newPassword : null
    });
    setActionBusy(false);
    if (error || !data?.ok) { setActionMessage(data?.error || "Não foi possível executar a ação."); return; }
    setActionMessage(action === "block" ? "Aluno bloqueado." : action === "unblock" ? "Aluno desbloqueado." : "Senha alterada.");
    setNewPassword("");
    await loadUsers();
  };

  const sendStudentNotification = async () => {
    if (!selected) return;
    if (token === "local-admin") {
      setActionMessage("Sua sessão atual é local. Saia e entre novamente para criar a sessão administrativa segura e liberar este controle.");
      return;
    }
    if (!notificationMessage.trim()) { setActionMessage("Digite a mensagem."); return; }
    setActionBusy(true); setActionMessage("");
    const { data, error } = await (supabase as any).rpc("admin_send_student_notification", {
      p_token: token, p_user_id: selected.id, p_title: notificationTitle, p_message: notificationMessage
    });
    setActionBusy(false);
    if (error || !data?.ok) { setActionMessage(data?.error || "Não foi possível enviar a notificação."); return; }
    setActionMessage("Notificação enviada.");
    setNotificationTitle(""); setNotificationMessage("");
  };

  const exportCsv = () => {
    const header = ["Nome","E-mail","Cadastro","Último acesso","Status"];
    const rows = filtered.map(u => [getName(u), u.email || "", formatDate(u.created_at), formatDate(u.last_sign_in_at), u.email_confirmed_at ? "Confirmado" : "Pendente"]);
    const csv = [header, ...rows].map(row => row.map(v => '"' + String(v).replaceAll('"','""') + '"').join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="alunos-mcr.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const copyEmail = async (email: string | null) => {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(""), 1400);
  };

  const css = `
    .admin-page{min-height:100vh;background:var(--page-bg,#f7f8fa);color:var(--text,#202124);padding:32px}
    .admin-shell{max-width:1280px;margin:0 auto}.admin-login{max-width:430px;margin:9vh auto 0;background:var(--card-bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:18px;padding:32px;box-shadow:0 18px 50px rgba(0,0,0,.08)}
    .admin-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.admin-brand-icon{width:46px;height:46px;border-radius:12px;background:var(--button-color,#d63384);display:grid;place-items:center;color:#fff}
    .admin-login h1{margin:0 0 8px;font-size:25px}.admin-sub{margin:0 0 24px;opacity:.68}.admin-field{display:grid;gap:7px;margin-bottom:15px}.admin-field label{font-size:13px;font-weight:700}.admin-field input,.admin-select{width:100%;box-sizing:border-box;padding:11px 13px;border:1px solid var(--border,#dfe3e8);border-radius:10px;background:var(--input-bg,#fff);color:inherit}
    .admin-btn{border:0;border-radius:10px;padding:11px 15px;background:var(--button-color,#d63384);color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}.admin-btn:disabled{opacity:.6;cursor:not-allowed}.admin-btn.secondary{background:transparent;color:inherit;border:1px solid var(--border,#dfe3e8)}
    .admin-error{background:#fff0f0;color:#b42318;padding:10px 12px;border-radius:9px;margin-bottom:14px;font-size:13px}.admin-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px}.admin-head h1{margin:0}.admin-actions{display:flex;gap:9px;flex-wrap:wrap}
    .admin-card{background:var(--card-bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;padding:20px;box-shadow:0 8px 28px rgba(0,0,0,.05)}.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}.admin-stat strong{display:block;font-size:27px;margin-top:6px}.admin-stat span{opacity:.65;font-size:13px}
    .admin-toolbar{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap}.admin-search{position:relative;flex:1;min-width:260px}.admin-search svg{position:absolute;left:11px;top:12px;opacity:.5}.admin-search input{width:100%;box-sizing:border-box;padding:11px 12px 11px 36px;border:1px solid var(--border,#dfe3e8);border-radius:10px;background:var(--input-bg,#fff);color:inherit}
    .admin-filters{display:flex;gap:7px;flex-wrap:wrap}.admin-chip{border:1px solid var(--border,#dfe3e8);background:transparent;border-radius:999px;padding:8px 12px;cursor:pointer;color:inherit}.admin-chip.active{background:var(--button-color,#d63384);color:#fff;border-color:var(--button-color,#d63384)}
    .admin-table{width:100%;border-collapse:collapse}.admin-table th,.admin-table td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--border,#edf0f2);font-size:13px}.admin-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.62}.admin-table tbody tr{cursor:pointer}.admin-table tbody tr:hover{background:rgba(127,127,127,.05)}
    .admin-badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#eaf7ee;color:#16733b;font-size:11px;font-weight:700}.admin-badge.pending{background:#fff5e6;color:#9a5b00}.admin-email{display:flex;align-items:center;gap:7px}.admin-copy{border:0;background:transparent;cursor:pointer;opacity:.55;padding:4px}.admin-copy:hover{opacity:1}
    .admin-empty{text-align:center;padding:40px;opacity:.6}.admin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:20px;z-index:20}.admin-detail{width:min(520px,100%);background:var(--card-bg,#fff);border-radius:18px;padding:24px;box-shadow:0 25px 80px rgba(0,0,0,.2)}.admin-detail-head{display:flex;justify-content:space-between;align-items:center}.admin-detail-row{padding:12px 0;border-bottom:1px solid var(--border,#edf0f2)}.admin-detail-label{font-size:11px;text-transform:uppercase;opacity:.6}.admin-detail-value{margin-top:4px;word-break:break-word}
    @media(max-width:900px){.admin-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.admin-page{padding:16px}.admin-head{align-items:flex-start;flex-direction:column}.admin-stats{grid-template-columns:1fr}.admin-card{overflow:auto}.admin-table{min-width:820px}}
  `;

  if (!token) return <div className="admin-page"><style>{css}</style><div className="admin-login">
    <div className="admin-brand"><div className="admin-brand-icon"><ShieldCheck size={24}/></div><div><strong>MCR</strong><div style={{fontSize:12,opacity:.6}}>Área administrativa</div></div></div>
    <h1>Acesso administrativo</h1><p className="admin-sub">Entre com suas credenciais de administrador.</p>
    <form onSubmit={login}>
      <div className="admin-field"><label>Usuário</label><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></div>
      <div className="admin-field"><label>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></div>
      {error && <div className="admin-error">{error}</div>}<button className="admin-btn" style={{width:"100%",justifyContent:"center"}} disabled={busy}><LogIn size={17}/>{busy?"Entrando...":"Entrar"}</button>
    </form>
  </div></div>;

  return <div className="admin-page"><style>{css}</style><div className="admin-shell">
    <div className="admin-head"><div><h1>Painel Administrativo</h1><div style={{opacity:.65,marginTop:5}}>Gerenciamento dos alunos cadastrados no MCR</div></div><div className="admin-actions">
      <button className="admin-btn" onClick={()=>void loadUsers()} disabled={busy}><RefreshCw size={16}/>{busy?"Atualizando":"Atualizar"}</button>
      <button className="admin-btn secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={16}/>Exportar CSV</button>
      <button className="admin-btn" onClick={()=>void logout()}><LogOut size={16}/>Sair</button>
    </div></div>
    {error && <div className="admin-error">{error}</div>}
    <div className="admin-stats">
      <div className="admin-card admin-stat"><span>Total de alunos</span><strong>{users.length}</strong><Users size={18}/></div>
      <div className="admin-card admin-stat"><span>Confirmados</span><strong>{users.filter(u=>!!u.email_confirmed_at).length}</strong><CheckCircle2 size={18}/></div>
      <div className="admin-card admin-stat"><span>Pendentes</span><strong>{users.filter(u=>!u.email_confirmed_at).length}</strong><Clock3 size={18}/></div>
      <div className="admin-card admin-stat"><span>Ativos nos últimos 7 dias</span><strong>{active7}</strong></div>
    </div>
    <div className="admin-card">
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={17}/><input placeholder="Buscar por nome ou e-mail..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="admin-filters">
          {([["all","Todos"],["confirmed","Confirmados"],["pending","Pendentes"]] as const).map(([key,label])=><button key={key} className={"admin-chip "+(filter===key?"active":"")} onClick={()=>setFilter(key)}>{label}</button>)}
          <select className="admin-select" style={{width:"auto"}} value={sort} onChange={e=>setSort(e.target.value as any)}><option value="created">Mais recentes</option><option value="name">Nome A–Z</option><option value="last">Último acesso</option></select>
        </div>
      </div>
      <div style={{opacity:.6,fontSize:12,marginBottom:8}}>{filtered.length} aluno(s) exibido(s) · Use <strong>Gerenciar</strong> para bloquear, alterar senha ou enviar notificação.</div>
      <table className="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {filtered.map(u=><tr key={u.id} onClick={()=>setSelected(u)}>
          <td><strong>{getName(u)}</strong></td><td><div className="admin-email"><span>{u.email || "—"}</span>{u.email && <button className="admin-copy" title="Copiar e-mail" onClick={e=>{e.stopPropagation();void copyEmail(u.email)}}><Copy size={14}/></button>}</div></td><td>{formatDate(u.created_at)}</td><td>{formatDate(u.last_sign_in_at)}</td><td><span className={"admin-badge "+(!u.email_confirmed_at?"pending":"")}>{u.email_confirmed_at?"Confirmado":"Pendente"}</span></td><td><button className="admin-chip" style={{padding:"6px 10px"}} onClick={e=>{e.stopPropagation();setSelected(u)}}>Gerenciar</button></td>
        </tr>)}
        {!filtered.length && <tr><td colSpan={6} className="admin-empty">{busy?"Carregando alunos...":"Nenhum aluno encontrado."}</td></tr>}
      </tbody></table>
    </div>
  </div>
  {selected && <div className="admin-overlay" onClick={()=>setSelected(null)}><div className="admin-detail" onClick={e=>e.stopPropagation()}>
    <div className="admin-detail-head"><div><h2 style={{margin:0}}>{getName(selected)}</h2><div style={{opacity:.6,marginTop:4}}>Detalhes do aluno</div></div><button className="admin-copy" onClick={()=>setSelected(null)}><X size={20}/></button></div>
    {[["ID",selected.id],["Nome",getName(selected)],["E-mail",selected.email||"—"],["Cadastro",formatDate(selected.created_at)],["Último acesso",formatDate(selected.last_sign_in_at)],["Status",selected.email_confirmed_at?"Confirmado":"Pendente"]].map(([label,value])=><div className="admin-detail-row" key={label}><div className="admin-detail-label">{label}</div><div className="admin-detail-value">{value}</div></div>)}
    {selected.email && <button className="admin-btn" style={{marginTop:16}} onClick={()=>void copyEmail(selected.email)}><Copy size={16}/>{copied===selected.email?"Copiado!":"Copiar e-mail"}</button>}    <div style={{marginTop:20,paddingTop:18,borderTop:"1px solid var(--border,#edf0f2)"}}>
      <strong>Controles do aluno</strong>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        <button className="admin-btn" disabled={actionBusy} onClick={()=>void adminAction("block")}><Ban size={16}/>Bloquear</button>
        <button className="admin-btn secondary" disabled={actionBusy} onClick={()=>void adminAction("unblock")}><Unlock size={16}/>Desbloquear</button>
      </div>
      <div style={{display:"grid",gap:8,marginTop:14}}>
        <label style={{fontSize:12,fontWeight:700}}>Nova senha</label>
        <input className="admin-select" type="password" minLength={6} placeholder="Mínimo de 6 caracteres" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
        <button className="admin-btn" disabled={actionBusy || newPassword.length<6} onClick={()=>void adminAction("password")}><KeyRound size={16}/>Alterar senha</button>
      </div>
      <div style={{display:"grid",gap:8,marginTop:18}}>
        <label style={{fontSize:12,fontWeight:700}}>Notificação para este aluno</label>
        <input className="admin-select" placeholder="Título (opcional)" value={notificationTitle} onChange={e=>setNotificationTitle(e.target.value)}/>
        <textarea className="admin-select" rows={4} placeholder="Escreva a mensagem..." value={notificationMessage} onChange={e=>setNotificationMessage(e.target.value)}/>
        <button className="admin-btn" disabled={actionBusy || !notificationMessage.trim()} onClick={()=>void sendStudentNotification()}><Bell size={16}/>Enviar notificação</button>
      </div>
      {actionMessage && <div style={{marginTop:10,fontSize:13,fontWeight:700}}>{actionMessage}</div>}
    </div>

  </div></div>}
  </div>;
}
