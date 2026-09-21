create table if not exists public.mcr_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

alter table public.mcr_admin_notifications enable row level security;
revoke all on public.mcr_admin_notifications from anon, authenticated;

create or replace function public.admin_manage_student(
  p_token text,
  p_user_id uuid,
  p_action text,
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_ok boolean;
begin
  select exists(
    select 1 from public.mcr_admin_sessions s
    join public.mcr_admin_accounts a on a.id=s.admin_id
    where s.token=p_token and s.expires_at>now() and a.active
  ) into v_ok;
  if not v_ok then return jsonb_build_object('ok',false,'error','Sessão administrativa inválida.'); end if;
  if p_action not in ('block','unblock','password') then return jsonb_build_object('ok',false,'error','Ação inválida.'); end if;
  if not exists(select 1 from auth.users where id=p_user_id) then return jsonb_build_object('ok',false,'error','Aluno não encontrado.'); end if;
  if p_action='block' then
    update auth.users set banned_until='infinity' where id=p_user_id;
  elsif p_action='unblock' then
    update auth.users set banned_until=null where id=p_user_id;
  else
    if p_password is null or length(p_password) < 6 then return jsonb_build_object('ok',false,'error','A nova senha deve ter pelo menos 6 caracteres.'); end if;
    update auth.users set encrypted_password=crypt(p_password, gen_salt('bf')) where id=p_user_id;
  end if;
  return jsonb_build_object('ok',true,'action',p_action);
end;
$$;

create or replace function public.admin_send_student_notification(
  p_token text,
  p_user_id uuid,
  p_title text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_ok boolean;
begin
  select exists(
    select 1 from public.mcr_admin_sessions s
    join public.mcr_admin_accounts a on a.id=s.admin_id
    where s.token=p_token and s.expires_at>now() and a.active
  ) into v_ok;
  if not v_ok then return jsonb_build_object('ok',false,'error','Sessão administrativa inválida.'); end if;
  if not exists(select 1 from auth.users where id=p_user_id) then return jsonb_build_object('ok',false,'error','Aluno não encontrado.'); end if;
  if coalesce(length(trim(p_message)),0)=0 then return jsonb_build_object('ok',false,'error','A mensagem não pode estar vazia.'); end if;
  insert into public.mcr_admin_notifications(user_id,title,message)
  values(p_user_id,coalesce(nullif(trim(p_title),''),'Mensagem do administrador'),trim(p_message));
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.admin_manage_student(text,uuid,text,text) from public;
revoke all on function public.admin_send_student_notification(text,uuid,text,text) from public;
grant execute on function public.admin_manage_student(text,uuid,text,text) to anon, authenticated;
grant execute on function public.admin_send_student_notification(text,uuid,text,text) to anon, authenticated;