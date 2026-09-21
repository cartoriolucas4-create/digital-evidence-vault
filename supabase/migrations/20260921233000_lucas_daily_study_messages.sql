create table if not exists public.mcr_lucas_daily_messages (
  sequence_no smallint primary key,
  message text not null
);

insert into public.mcr_lucas_daily_messages (sequence_no, message) values
(0, 'De Lucas: Bom estudo, Rafinha! ❤️'),
(1, '💌 Do Lucas: Bons estudos, meu amor! 🥰'),
(2, 'Lucas mandou dizer: Vai com tudo, gatinha! ❤️'),
(3, 'De Lucas: Foco hoje, minha maravilhosa! ✨'),
(4, '❤️ Do Lucas: Bora estudar, chaveirinho!'),
(5, 'De Lucas: Você consegue, meu amor! ❤️'),
(6, 'Lucas: Bora estudar, Rafinha! 🥰'),
(7, '💌 Do Lucas: Foco aí, minha gatinha! ❤️'),
(8, 'De Lucas: Mais um dia rumo à aprovação! 💪'),
(9, 'Lucas mandou dizer: Eu acredito em você! ❤️'),
(10, 'De Lucas: Bons estudos, minha linda! 🥰'),
(11, '💗 Do Lucas: Vai dar tudo certo, Rafinha!'),
(12, 'De Lucas: Foco na missão, chaveirinho! ❤️'),
(13, 'Lucas: Estuda firme, meu amor! 💕'),
(14, '💌 Do Lucas: Vai lá, minha maravilhosa! ❤️'),
(15, 'De Lucas: Orgulho de você, gatinha!'),
(16, 'Lucas mandou dizer: Não desiste, meu amor! ❤️'),
(17, 'De Lucas: Hoje também é dia de vencer! 💪'),
(18, '💗 Do Lucas: Foco, Rafinha! Você consegue!'),
(19, 'De Lucas: Cada estudo te deixa mais perto! ❤️'),
(20, 'Lucas: Bom estudo, minha maravilhosa!'),
(21, '💌 Do Lucas: Vai firme, minha gatinha! ❤️'),
(22, 'De Lucas: Dá seu melhor hoje, amor!'),
(23, 'Lucas mandou dizer: Confio em você! ❤️'),
(24, 'De Lucas: Bora conquistar esse sonho, Rafinha!'),
(25, '💗 Do Lucas: Estuda firme, meu amor! ❤️'),
(26, 'De Lucas: Você está cada vez melhor!'),
(27, 'Lucas: Foco nos estudos, chaveirinho! 💪'),
(28, '💌 Do Lucas: Vai firme hoje, minha linda!'),
(29, 'De Lucas: Mais um passo, Rafinha! ❤️'),
(30, 'Lucas mandou dizer: Seu esforço vai valer a pena!'),
(31, 'De Lucas: Bons estudos, minha gatinha! ❤️'),
(32, '💗 Do Lucas: Foco e determinação, amor!'),
(33, 'De Lucas: Eu sei que você consegue! ❤️'),
(34, 'Lucas: Vai conquistar seus sonhos, maravilhosa!'),
(35, '💌 Do Lucas: Estuda bastante, meu amor!'),
(36, 'De Lucas: Força nos estudos, Rafinha! 💪'),
(37, 'Lucas mandou dizer: Hoje é dia de evolução!'),
(38, 'De Lucas: Foco, minha linda! ❤️'),
(39, '💗 Do Lucas: Vai com fé, chaveirinho!'),
(40, 'De Lucas: Você é incrível, meu amor! ❤️'),
(41, 'Lucas: Bora vencer mais um dia, Rafinha!'),
(42, '💌 Do Lucas: Bons estudos, minha maravilhosa!'),
(43, 'De Lucas: Seu esforço de hoje vale muito! 💪'),
(44, 'Lucas mandou dizer: Eu acredito em você! ❤️'),
(45, 'De Lucas: Vai firme, gatinha!'),
(46, '💗 Do Lucas: Mais um dia, mais uma conquista!'),
(47, 'De Lucas: Estuda firme e depois descansa!'),
(48, 'Lucas: Foco, Rafinha! Tô torcendo por você! ❤️'),
(49, '💌 Do Lucas: Você vai longe, minha linda!'),
(50, 'De Lucas: Bom estudo, meu chaveirinho! ❤️'),
(51, 'Lucas mandou dizer: Vai conquistar o que deseja!'),
(52, '💗 Do Lucas: Foco agora, resultado depois!'),
(53, 'De Lucas: Minha maravilhosa, dá seu melhor!'),
(54, 'Lucas: Estuda firme, gatinha! ❤️'),
(55, '💌 Do Lucas: Mais um dia vencido, meu amor!'),
(56, 'De Lucas: Rafinha, seu esforço vai valer!'),
(57, 'Lucas mandou dizer: Vai lá, minha campeã! 💪'),
(58, '❤️ Do Lucas: Orgulho de você, minha linda!'),
(59, 'De Lucas: Bons estudos, meu amor. Te amo! ❤️')
on conflict (sequence_no) do update set message = excluded.message;

create or replace function public.claim_lucas_daily_message(p_user_id uuid)
returns table(message text, sequence_no smallint, sent_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_prefs jsonb;
  v_last_date date;
  v_current_sequence integer;
  v_next_sequence smallint;
begin
  if auth.uid() is null or auth.uid() <> p_user_id or p_user_id <> 'bc0e495f-78e2-4f5e-87ae-17c537d3c0b5'::uuid then
    return;
  end if;

  insert into public.study_user_state (user_id, preferences)
  values (p_user_id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  select s.preferences into v_prefs
  from public.study_user_state s
  where s.user_id = p_user_id
  for update;

  begin
    v_last_date := nullif(v_prefs->>'lucas_daily_last_date', '')::date;
  exception when others then
    v_last_date := null;
  end;

  if v_last_date = v_today then
    return;
  end if;

  begin
    v_current_sequence := coalesce((v_prefs->>'lucas_daily_sequence')::integer, -1);
  exception when others then
    v_current_sequence := -1;
  end;

  v_next_sequence := ((v_current_sequence + 1) % 60)::smallint;

  update public.study_user_state
  set preferences = jsonb_set(
    jsonb_set(coalesce(v_prefs, '{}'::jsonb), '{lucas_daily_last_date}', to_jsonb(v_today::text), true),
    '{lucas_daily_sequence}', to_jsonb(v_next_sequence), true
  ),
  updated_at = now()
  where user_id = p_user_id;

  return query
  select m.message, m.sequence_no, v_today
  from public.mcr_lucas_daily_messages m
  where m.sequence_no = v_next_sequence;
end;
$$;

revoke all on table public.mcr_lucas_daily_messages from anon, authenticated;
grant execute on function public.claim_lucas_daily_message(uuid) to authenticated;
revoke execute on function public.claim_lucas_daily_message(uuid) from anon;