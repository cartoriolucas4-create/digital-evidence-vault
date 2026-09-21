import { useEffect, useMemo, useState } from "react";
import { LogIn, LogOut, Search, ShieldCheck, Users, RefreshCw } from "lucide-react";
import { supabase } from "./integrations/supabase/client";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

const TOKEN_KEY = "mcr_admin_session";
const LOCAL_ADMIN_HASH = "e628bf13707b4a929d1465e5d6af4a4c4da416138d39d02bb65c40830106e3d8";

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sha256 = async (value: string) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const loadUsers = async (sessionToken = token) => {
    if (!sessionToken) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await (supabase as any).rpc("admin_list_users", { p_token: sessionToken });
    setBusy(false);
    if (rpcError || !data) {
      // O banco de produção ainda pode estar sem as RPCs administrativas.
      // Nesse caso, não derruba o acesso local do administrador.
      if (sessionToken === "local-admin") {
        setBusy(false);
        setUsers([]);
        return;
      }
      sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
      setError("Sessão administrativa inválida ou expirada.");
      return;
    }
    setUsers((data || []) as AdminUser[]);
  };

  useEffect(() => { void loadUsers(); }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    // Login administrativo local primeiro: isso evita que uma RPC ausente
    // no banco impeça o administrador de entrar.
    const localHash = await sha256(password);
    if (username.trim().toLowerCase() === "jonathan.barros" && localHash === LOCAL_ADMIN_HASH) {
      sessionStorage.setItem(TOKEN_KEY, "local-admin");
      setToken("local-admin");
      setPassword("");
      setBusy(false);
      setError("");
      return;
    }

    // Se as RPCs já estiverem disponíveis, mantém o login por banco como alternativa.
    const { data, error: rpcError } = await (supabase as any).rpc("admin_login", {
      p_username: username.trim(),
      p_password: password,
    });
    setBusy(false);
    if (rpcError || !data?.token) {
      setError("Usuário ou senha administrativa inválidos.");
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setPassword("");
    await loadUsers(data.token);
  };

  const logout = async () => {
    if (token && token !== "local-admin") await (supabase as any).rpc("admin_logout", { p_token: token });
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUsers([]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter(u => (u.email || "").toLowerCase().includes(q)) : users;
  }, [users, query]);

  const css = `
    .admin-page{min-height:100vh;background:var(--page-bg,#f7f8fa);color:var(--text,#202124);padding:32px}
    .admin-shell{max-width:1180px;margin:0 auto}
    .admin-login{max-width:430px;margin:9vh auto 0;background:var(--card-bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:18px;padding:32px;box-shadow:0 18px 50px rgba(0,0,0,.08)}
    .admin-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.admin-brand-icon{width:46px;height:46px;border-radius:12px;background:var(--button-color,#d63384);display:grid;place-items:center;color:#fff}
    .admin-login h1{margin:0 0 8px;font-size:25px}.admin-sub{margin:0 0 24px;opacity:.68}
    .admin-field{display:grid;gap:7px;margin-bottom:15px}.admin-field label{font-size:13px;font-weight:700}.admin-field input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid var(--border,#dfe3e8);border-radius:10px;background:var(--input-bg,#fff);color:inherit}
    .admin-btn{border:0;border-radius:10px;padding:12px 16px;background:var(--button-color,#d63384);color:#fff;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}.admin-btn:disabled{opacity:.6;cursor:not-allowed}
    .admin-error{background:#fff0f0;color:#b42318;padding:10px 12px;border-radius:9px;margin-bottom:14px;font-size:13px}
    .admin-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px}.admin-head h1{margin:0}.admin-actions{display:flex;gap:9px}
    .admin-card{background:var(--card-bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;padding:20px;box-shadow:0 8px 28px rgba(0,0,0,.05)}
    .admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.admin-stat strong{display:block;font-size:27px;margin-top:6px}.admin-stat span{opacity:.65;font-size:13px}
    .admin-toolbar{display:flex;gap:10px;justify-content:space-between;margin-bottom:14px}.admin-search{position:relative;flex:1;max-width:420px}.admin-search svg{position:absolute;left:11px;top:12px;opacity:.5}.admin-search input{width:100%;box-sizing:border-box;padding:11px 12px 11px 36px;border:1px solid var(--border,#dfe3e8);border-radius:10px;background:var(--input-bg,#fff);color:inherit}
    .admin-table{width:100%;border-collapse:collapse}.admin-table th,.admin-table td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--border,#edf0f2);font-size:13px}.admin-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.62}
    .admin-badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#eaf7ee;color:#16733b;font-size:11px;font-weight:700}
    @media(max-width:760px){.admin-page{padding:16px}.admin-head{align-items:flex-start;flex-direction:column}.admin-stats{grid-template-columns:1fr}.admin-toolbar{flex-direction:column}.admin-search{max-width:none}.admin-card{overflow:auto}.admin-table{min-width:720px}}
  `;

  if (!token) return <div className="admin-page"><style>{css}</style><div className="admin-login">
    <div className="admin-brand"><div className="admin-brand-icon"><ShieldCheck size={24}/></div><div><strong>MCR</strong><div style={{fontSize:12,opacity:.6}}>Área administrativa</div></div></div>
    <h1>Acesso administrativo</h1><p className="admin-sub">Entre com suas credenciais de administrador.</p>
    <form onSubmit={login}>
      <div className="admin-field"><label>Usuário</label><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></div>
      <div className="admin-field"><label>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></div>
      {error && <div className="admin-error">{error}</div>}
      <button className="admin-btn" style={{width:"100%",justifyContent:"center"}} disabled={busy}><LogIn size={17}/>{busy?"Entrando...":"Entrar"}</button>
    </form>
  </div></div>;

  return <div className="admin-page"><style>{css}</style><div className="admin-shell">
    <div className="admin-head"><div><h1>Painel Administrativo</h1><div style={{opacity:.65,marginTop:5}}>Gerenciamento dos alunos cadastrados no MCR</div></div><div className="admin-actions"><button className="admin-btn" onClick={()=>void loadUsers()} disabled={busy}><RefreshCw size={16}/>{busy?"Atualizando":"Atualizar"}</button><button className="admin-btn" onClick={()=>void logout()}><LogOut size={16}/>Sair</button></div></div>
    {error && <div className="admin-error">{error}</div>}
    <div className="admin-stats"><div className="admin-card admin-stat"><span>Total de alunos</span><strong>{users.length}</strong><Users size={18}/></div><div className="admin-card admin-stat"><span>Com e-mail confirmado</span><strong>{users.filter(u=>!!u.email_confirmed_at).length}</strong></div><div className="admin-card admin-stat"><span>Resultado da busca</span><strong>{filtered.length}</strong></div></div>
    <div className="admin-card"><div className="admin-toolbar"><div className="admin-search"><Search size={17}/><input placeholder="Buscar por e-mail..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
      <table className="admin-table"><thead><tr><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Status</th></tr></thead><tbody>
      {filtered.map(u=><tr key={u.id}><td>{u.email || "—"}</td><td>{formatDate(u.created_at)}</td><td>{formatDate(u.last_sign_in_at)}</td><td><span className="admin-badge">{u.email_confirmed_at?"Confirmado":"Pendente"}</span></td></tr>)}
      {!filtered.length && <tr><td colSpan={4} style={{textAlign:"center",padding:30,opacity:.6}}>Nenhum aluno encontrado.</td></tr>}
      </tbody></table>
    </div>
  </div></div>;
}
