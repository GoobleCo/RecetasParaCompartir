/**
 * Capa de acceso a datos. Todas las operaciones pasan por Supabase (PostgREST),
 * que aplica las políticas RLS definidas en supabase/schema.sql: aunque alguien
 * modificara la app, el servidor sigue rechazando lo que no le corresponde.
 */
import { AppError } from './errors';
import { supabase } from './supabase';
import { sanitizeSearch } from './validation';

export type Role = 'user' | 'moderator' | 'admin';
export type Difficulty = 'facil' | 'media' | 'dificil';

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: Role;
  notify_comments: boolean;
  notify_ratings: boolean;
  notify_follows: boolean;
  notify_new_recipes: boolean;
  notify_daily: boolean;
  created_at: string;
};

export type MiniProfile = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>;
export type Category = { id: number; name: string; emoji: string | null };

export type Recipe = {
  id: string;
  author_id: string;
  category_id: number | null;
  title: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
  prep_minutes: number | null;
  servings: number | null;
  difficulty: Difficulty;
  image_path: string | null;
  is_public: boolean;
  avg_rating: number;
  rating_count: number;
  comment_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  author: MiniProfile | null;
  category: Category | null;
};

export type RecipeInput = {
  title: string;
  description: string | null;
  category_id: number | null;
  ingredients: string[];
  steps: string[];
  prep_minutes: number | null;
  servings: number | null;
  difficulty: Difficulty;
  image_path: string | null;
  is_public: boolean;
};

export type Comment = {
  id: string;
  recipe_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: MiniProfile | null;
};

export type AppNotification = {
  id: number;
  type: 'comment' | 'rating' | 'follow' | 'new_recipe' | 'daily' | 'role' | 'system';
  title: string;
  body: string;
  recipe_id: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
};

export type HomeStats = {
  my_recipes: number; favorites: number; followers: number; following: number; unread: number; total_recipes: number;
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
export const ROLE_LABEL: Record<Role, string> = { user: 'Usuario', moderator: 'Moderador', admin: 'Administrador' };

const RECIPE_SELECT =
  '*, author:profiles!recipes_author_id_fkey(id, username, full_name, avatar_url), category:categories(id, name, emoji)';

type Res<T> = { data: T | null; error: unknown };
function unwrap<T>({ data, error }: Res<T>): T {
  if (error) throw error;
  return data as T;
}

/** Verifica que un UPDATE/DELETE afectó filas; si no, RLS lo bloqueó o no existe */
function ensureAffected(rows: unknown, what = 'el registro'): void {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError(`No tenés permiso para modificar ${what}, o ya no existe.`);
  }
}

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AppError('Tu sesión expiró. Volvé a iniciar sesión.');
  return id;
}

// ---------- Perfiles ----------
export async function getProfile(id: string): Promise<Profile> {
  const row = unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
  if (!row) throw new AppError('El usuario no existe.');
  return row as Profile;
}

export async function updateMyProfile(
  patch: Partial<Pick<Profile, 'username' | 'full_name' | 'bio' | 'avatar_url' |
    'notify_comments' | 'notify_ratings' | 'notify_follows' | 'notify_new_recipes' | 'notify_daily'>>,
): Promise<void> {
  const uid = await myId();
  const rows = unwrap(await supabase.from('profiles').update(patch).eq('id', uid).select('id'));
  ensureAffected(rows, 'tu perfil');
}

export async function usernameAvailable(username: string): Promise<boolean> {
  return unwrap(await supabase.rpc('username_available', { p_username: username })) as boolean;
}

export async function homeStats(): Promise<HomeStats> {
  return unwrap(await supabase.rpc('home_stats')) as HomeStats;
}

export async function deleteMyAccount(): Promise<void> {
  unwrap(await supabase.rpc('delete_my_account'));
}

// ---------- Categorías ----------
export async function getCategories(): Promise<Category[]> {
  return unwrap(await supabase.from('categories').select('id, name, emoji').order('name')) as Category[];
}
export async function createCategory(name: string, emoji: string | null) {
  unwrap(await supabase.from('categories').insert({ name: name.trim(), emoji: emoji?.trim() || null }));
}
export async function updateCategory(id: number, name: string, emoji: string | null) {
  const rows = unwrap(await supabase.from('categories').update({ name: name.trim(), emoji: emoji?.trim() || null }).eq('id', id).select('id'));
  ensureAffected(rows, 'la categoría');
}
export async function deleteCategory(id: number) {
  const rows = unwrap(await supabase.from('categories').delete().eq('id', id).select('id'));
  ensureAffected(rows, 'la categoría');
}

// ---------- Recetas (ABM) ----------
export type RecipeQuery = {
  q?: string;
  categoryId?: number | null;
  authorId?: string;
  authorIds?: string[];
  order?: 'recent' | 'top';
  limit?: number;
  onlyPublic?: boolean;
};

export async function listRecipes(opts: RecipeQuery = {}): Promise<Recipe[]> {
  let query = supabase.from('recipes').select(RECIPE_SELECT);
  if (opts.onlyPublic !== false) query = query.eq('is_public', true);
  if (opts.categoryId) query = query.eq('category_id', opts.categoryId);
  if (opts.authorId) query = query.eq('author_id', opts.authorId);
  if (opts.authorIds) {
    if (opts.authorIds.length === 0) return [];
    query = query.in('author_id', opts.authorIds);
  }
  const q = sanitizeSearch(opts.q ?? '');
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (opts.order === 'top') {
    query = query.order('avg_rating', { ascending: false }).order('rating_count', { ascending: false });
  }
  query = query.order('created_at', { ascending: false }).limit(opts.limit ?? 30);
  return unwrap(await query) as Recipe[];
}

export async function getMyRecipes(): Promise<Recipe[]> {
  return listRecipes({ authorId: await myId(), onlyPublic: false, limit: 100 });
}

export async function getFeed(): Promise<Recipe[]> {
  const uid = await myId();
  const follows = unwrap(await supabase.from('follows').select('following_id').eq('follower_id', uid)) as { following_id: string }[];
  return listRecipes({ authorIds: follows.map((f) => f.following_id), limit: 10 });
}

export async function getRecipe(id: string): Promise<Recipe> {
  const row = unwrap(await supabase.from('recipes').select(RECIPE_SELECT).eq('id', id).maybeSingle());
  if (!row) throw new AppError('La receta no existe, es privada o fue eliminada.');
  return row as Recipe;
}

export async function createRecipe(input: RecipeInput): Promise<string> {
  const uid = await myId();
  const row = unwrap(await supabase.from('recipes').insert({ ...input, author_id: uid }).select('id').single()) as { id: string };
  return row.id;
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const rows = unwrap(await supabase.from('recipes').update(input).eq('id', id).select('id'));
  ensureAffected(rows, 'esta receta');
}

export async function deleteRecipe(recipe: Pick<Recipe, 'id' | 'image_path'>): Promise<void> {
  const rows = unwrap(await supabase.from('recipes').delete().eq('id', recipe.id).select('id'));
  ensureAffected(rows, 'esta receta');
  if (recipe.image_path && !recipe.image_path.startsWith('http')) {
    await supabase.storage.from('recipe-images').remove([recipe.image_path]).catch(() => {});
  }
}

// ---------- Comentarios ----------
export async function getComments(recipeId: string): Promise<Comment[]> {
  return unwrap(await supabase
    .from('comments')
    .select('*, user:profiles!comments_user_id_fkey(id, username, full_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true })) as Comment[];
}

export async function addComment(recipeId: string, body: string): Promise<void> {
  const uid = await myId();
  unwrap(await supabase.from('comments').insert({ recipe_id: recipeId, user_id: uid, body: body.trim() }));
}

export async function deleteComment(id: string): Promise<void> {
  const rows = unwrap(await supabase.from('comments').delete().eq('id', id).select('id'));
  ensureAffected(rows, 'este comentario');
}

export async function recentComments(limit = 40): Promise<(Comment & { recipe: { id: string; title: string } | null })[]> {
  return unwrap(await supabase
    .from('comments')
    .select('*, user:profiles!comments_user_id_fkey(id, username, full_name, avatar_url), recipe:recipes(id, title)')
    .order('created_at', { ascending: false })
    .limit(limit)) as (Comment & { recipe: { id: string; title: string } | null })[];
}

// ---------- Valoraciones ----------
export async function getMyRating(recipeId: string): Promise<number | null> {
  const uid = await myId();
  const row = unwrap(await supabase.from('ratings').select('stars').eq('recipe_id', recipeId).eq('user_id', uid).maybeSingle()) as { stars: number } | null;
  return row?.stars ?? null;
}

export async function setMyRating(recipeId: string, stars: number): Promise<void> {
  const uid = await myId();
  const existing = await getMyRating(recipeId);
  if (existing == null) {
    unwrap(await supabase.from('ratings').insert({ recipe_id: recipeId, user_id: uid, stars }));
  } else {
    unwrap(await supabase.from('ratings').update({ stars }).eq('recipe_id', recipeId).eq('user_id', uid));
  }
}

// ---------- Favoritos ----------
export async function isFavorite(recipeId: string): Promise<boolean> {
  const uid = await myId();
  const row = unwrap(await supabase.from('favorites').select('recipe_id').eq('recipe_id', recipeId).eq('user_id', uid).maybeSingle());
  return !!row;
}

export async function setFavorite(recipeId: string, fav: boolean): Promise<void> {
  const uid = await myId();
  if (fav) {
    const { error } = await supabase.from('favorites').insert({ recipe_id: recipeId, user_id: uid });
    if (error && !/duplicate|23505/i.test(`${error.message} ${error.code}`)) throw error;
  } else {
    unwrap(await supabase.from('favorites').delete().eq('recipe_id', recipeId).eq('user_id', uid));
  }
}

export async function getFavorites(): Promise<Recipe[]> {
  const uid = await myId();
  const rows = unwrap(await supabase
    .from('favorites')
    .select(`created_at, recipe:recipes(${RECIPE_SELECT})`)
    .eq('user_id', uid)
    .order('created_at', { ascending: false })) as unknown as { recipe: Recipe | null }[];
  return rows.map((r) => r.recipe).filter((r): r is Recipe => !!r);
}

// ---------- Seguidores ----------
export async function followCounts(userId: string) {
  const [a, b] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

export async function isFollowing(userId: string): Promise<boolean> {
  const uid = await myId();
  const row = unwrap(await supabase.from('follows').select('following_id').eq('follower_id', uid).eq('following_id', userId).maybeSingle());
  return !!row;
}

export async function setFollowing(userId: string, follow: boolean): Promise<void> {
  const uid = await myId();
  if (follow) {
    const { error } = await supabase.from('follows').insert({ follower_id: uid, following_id: userId });
    if (error && !/duplicate|23505/i.test(`${error.message} ${error.code}`)) throw error;
  } else {
    unwrap(await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', userId));
  }
}

// ---------- Notificaciones ----------
export async function listNotifications(): Promise<AppNotification[]> {
  return unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as AppNotification[];
}
export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false);
  if (error) throw error;
  return count ?? 0;
}
export async function markRead(id: number) {
  unwrap(await supabase.from('notifications').update({ read: true }).eq('id', id));
}
export async function markAllRead() {
  unwrap(await supabase.from('notifications').update({ read: true }).eq('read', false));
}
export async function deleteNotification(id: number) {
  unwrap(await supabase.from('notifications').delete().eq('id', id));
}

// ---------- Administración ----------
export async function listUsers(q: string): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
  const s = sanitizeSearch(q);
  if (s) query = query.or(`username.ilike.%${s}%,full_name.ilike.%${s}%`);
  return unwrap(await query) as Profile[];
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  unwrap(await supabase.rpc('set_user_role', { p_user: userId, p_role: role }));
}
