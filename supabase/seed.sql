-- =====================================================================
--  SAZÓN · Usuarios de prueba y recetas de ejemplo
--  ANTES: registrá 3 cuentas desde la app (ver GUIA_PASO_A_PASO.md):
--     admin@...   moderador@...   usuario@...
--  Cambiá los 3 emails de abajo por los que usaste y ejecutá en SQL Editor.
-- =====================================================================

do $$
declare
  admin_email text := 'CAMBIAR-admin@gmail.com';
  mod_email   text := 'CAMBIAR-moderador@gmail.com';
  user_email  text := 'CAMBIAR-usuario@gmail.com';
  admin_id uuid; mod_id uuid; usr_id uuid;
  r1 uuid; r2 uuid; r3 uuid;
  cat_almuerzos int; cat_postres int; cat_regional int; cat_desayunos int;
begin
  select id into admin_id from auth.users where email = admin_email;
  select id into mod_id   from auth.users where email = mod_email;
  select id into usr_id  from auth.users where email = user_email;
  if admin_id is null or mod_id is null or usr_id is null then
    raise exception 'Falta registrar alguna de las 3 cuentas desde la app (o los emails no coinciden)';
  end if;

  -- Roles (esto se hace como dueño de la BD; desde la app sólo un admin puede)
  update public.profiles set role = 'admin',     full_name = coalesce(full_name, 'Admin Sazón')   where id = admin_id;
  update public.profiles set role = 'moderator', full_name = coalesce(full_name, 'Moderador Sazón') where id = mod_id;
  update public.profiles set role = 'user',      full_name = coalesce(full_name, 'Usuario Prueba') where id = usr_id;

  select id into cat_almuerzos from public.categories where name = 'Almuerzos';
  select id into cat_postres   from public.categories where name = 'Postres';
  select id into cat_regional  from public.categories where name = 'Regional';
  select id into cat_desayunos from public.categories where name = 'Desayunos';

  if exists (select 1 from public.recipes where title = 'Empanadas salteñas') then
    raise notice 'Las recetas de ejemplo ya estaban cargadas';
    return;
  end if;

  insert into public.recipes (author_id, category_id, title, description, ingredients, steps, prep_minutes, servings, difficulty)
  values (admin_id, cat_regional, 'Empanadas salteñas',
    'Las clásicas de Salta: jugosas, con papa y bien cortadas a cuchillo.',
    array['24 tapas de empanada','500 g de carne de nalga cortada a cuchillo','2 cebollas de verdeo','1 cebolla','2 papas hervidas en cubitos','2 huevos duros','1 cdita de pimentón','1 cdita de comino','Ají molido a gusto','Grasa o aceite','Sal'],
    array['Rehogar la cebolla picada en grasa hasta que esté transparente.','Agregar la carne, salar y cocinar apenas (que quede jugosa).','Condimentar con pimentón, comino y ají. Dejar enfriar.','Sumar la papa, el huevo y la cebolla de verdeo.','Rellenar las tapas y hacer el repulgue.','Hornear 12-15 minutos a horno fuerte.'],
    90, 24, 'media')
  returning id into r1;

  insert into public.recipes (author_id, category_id, title, description, ingredients, steps, prep_minutes, servings, difficulty)
  values (mod_id, cat_postres, 'Flan casero',
    'Flan de huevo con caramelo, sin horno de convección ni vueltas.',
    array['5 huevos','1 litro de leche','200 g de azúcar','1 cdita de esencia de vainilla','150 g de azúcar para el caramelo'],
    array['Hacer el caramelo en la budinera y dejar enfriar.','Batir los huevos con el azúcar, sumar leche y vainilla.','Volcar sobre el caramelo.','Cocinar a baño María 1 hora a 180 °C.','Enfriar y dejar en la heladera al menos 4 horas.'],
    80, 8, 'facil')
  returning id into r2;

  insert into public.recipes (author_id, category_id, title, description, ingredients, steps, prep_minutes, servings, difficulty)
  values (usr_id, cat_desayunos, 'Tortilla al rescoldo (versión sartén)',
    'Tortilla norteña para el mate, adaptada para hacer en casa.',
    array['500 g de harina','100 g de grasa','1 cdita de sal','250 ml de agua tibia'],
    array['Mezclar harina y sal, agregar la grasa y arenar.','Sumar el agua de a poco hasta formar un bollo liso.','Reposar 20 minutos tapado.','Dividir en bollos, estirar y pinchar.','Cocinar en sartén o plancha caliente vuelta y vuelta.'],
    45, 6, 'facil')
  returning id into r3;

  -- Interacción de ejemplo
  insert into public.follows (follower_id, following_id) values (usr_id, admin_id), (mod_id, admin_id), (admin_id, usr_id)
  on conflict do nothing;
  insert into public.comments (recipe_id, user_id, body) values
    (r1, usr_id, '¡Me salieron buenísimas! Le agregué un poco más de comino.'),
    (r2, admin_id, 'El mejor flan, igual al de mi abuela.');
  insert into public.ratings (recipe_id, user_id, stars) values
    (r1, usr_id, 5), (r1, mod_id, 4), (r2, admin_id, 5), (r3, admin_id, 4)
  on conflict do nothing;
  insert into public.favorites (recipe_id, user_id) values (r1, usr_id), (r2, usr_id)
  on conflict do nothing;

  raise notice 'Listo: roles asignados y 3 recetas de ejemplo cargadas';
end $$;
