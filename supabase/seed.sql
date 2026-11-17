-- =====================================================================
--  CÓDIGO Ω · Roles de prueba y datos de ejemplo
--  ANTES: registrá 3 cuentas desde la app (ver GUIA_PASO_A_PASO.md).
--  Cambiá los 3 emails de abajo por los que usaste y ejecutá en SQL Editor.
--  (Los puntajes de ejemplo se cargan directo como dueño de la base;
--   desde la app sólo se pueden obtener jugando.)
-- =====================================================================

do $$
declare
  admin_email text := 'CAMBIAR-admin@gmail.com';
  mod_email   text := 'CAMBIAR-moderador@gmail.com';
  user_email  text := 'CAMBIAR-usuario@gmail.com';
  admin_id uuid; mod_id uuid; usr_id uuid;
  c1 uuid; c2 uuid; c3 uuid;
  wk text := 'classic:week:' || public.game_week(public.game_today());
begin
  select id into admin_id from auth.users where email = admin_email;
  select id into mod_id   from auth.users where email = mod_email;
  select id into usr_id   from auth.users where email = user_email;
  if admin_id is null or mod_id is null or usr_id is null then
    raise exception 'Falta registrar alguna de las 3 cuentas desde la app (o los emails no coinciden)';
  end if;

  update public.profiles set role = 'admin',     full_name = coalesce(full_name, 'Comandante Omega') where id = admin_id;
  update public.profiles set role = 'moderator', full_name = coalesce(full_name, 'Moderador Omega')  where id = mod_id;
  update public.profiles set role = 'user',      full_name = coalesce(full_name, 'Operador Prueba')  where id = usr_id;

  if exists (select 1 from public.challenges where title = 'Entrenamiento básico') then
    raise notice 'Los datos de ejemplo ya estaban cargados';
    return;
  end if;

  insert into public.challenges (author_id, title, description, protocol_ids, rounds, round_time_s)
  values (admin_id, 'Entrenamiento básico', 'Códigos cortos para aprender. Ideal para tu primera partida.',
          array(select id from public.protocols where char_length(code) <= 4), 3, 12)
  returning id into c1;

  insert into public.challenges (author_id, title, description, protocol_ids, rounds, round_time_s)
  values (mod_id, 'Artillería pesada', 'Sólo protocolos ofensivos. Las combinaciones más largas.',
          array(select id from public.protocols where category = 'ofensivo'), 6, 9)
  returning id into c2;

  insert into public.challenges (author_id, title, description, protocol_ids, rounds, round_time_s)
  values (usr_id, 'Contrarreloj logístico', 'Logística y apoyo con muy poco tiempo. ¿Aguantás 8 rondas?',
          array(select id from public.protocols where category in ('logistica', 'apoyo')), 8, 6)
  returning id into c3;

  insert into public.follows (follower_id, following_id) values (usr_id, admin_id), (mod_id, admin_id), (admin_id, usr_id)
  on conflict do nothing;
  insert into public.comments (challenge_id, user_id, body) values
    (c1, usr_id, '¡Buenísimo para practicar! Ya me sé el Dron médico de memoria.'),
    (c2, admin_id, 'La Tormenta de iones me mata siempre 😅');
  insert into public.ratings (challenge_id, user_id, stars) values
    (c1, usr_id, 5), (c1, mod_id, 4), (c2, admin_id, 5), (c3, admin_id, 4)
  on conflict do nothing;
  insert into public.favorites (challenge_id, user_id) values (c1, usr_id), (c2, usr_id) on conflict do nothing;

  insert into public.best_scores (user_id, board, score) values
    (admin_id, 'classic', 4120), (mod_id, 'classic', 3380), (usr_id, 'classic', 2150),
    (admin_id, wk, 3900), (usr_id, wk, 2150),
    (mod_id, 'challenge:' || c1, 1480), (usr_id, 'challenge:' || c1, 1210)
  on conflict do nothing;
  update public.challenges set play_count = 2 where id = c1;

  raise notice 'Listo: roles asignados, 3 desafíos y puntajes de ejemplo cargados';
end $$;
