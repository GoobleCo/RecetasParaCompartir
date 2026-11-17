/**
 * Capa de acceso a datos. Todo pasa por Supabase (PostgREST + RPC), que aplica las
 * políticas RLS de supabase/schema.sql: aunque alguien modificara la app, el servidor
 * sigue rechazando lo que no le corresponde. Los puntajes los calcula el servidor.
 */
import { AppError } from './errors';
import type { Protocol, ProtocolCategory } from './game';
import { supabase } from './supabase';
import { sanitizeSearch } from './validation';

export type Role = 'user' | 'moderator' | 'admin';

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
  notify_new_challenges: boolean;
  notify_daily: boolean;
  notify_beaten: boolean;
  created_at: string;
};

export type MiniProfile = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>;
export type ProtocolRow = Protocol & { active: boolean };

export type Challenge = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  protocol_ids: number[];
  rounds: number;
  round_time_s: number;
  is_public: boolean;
  play_count: number;
  avg_rating: number;
  rating_count: number;
  comment_count: number;
  favorite_count: number;
  created_at: string;
  updated_at: string;
  author: MiniProfile | null;
};

export type ChallengeInput = {
  title: string;
  description: string | null;
  protocol_ids: number[];
  rounds: number;
  round_time_s: number;
  is_public: boolean;
};

export type Comment = {
  id: string;
  challenge_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user: MiniProfile | null;
};

export type AppNotification = {
  id: number;
  type: 'comment' | 'rating' | 'follow' | 'new_challenge' | 'daily' | 'beaten' | 'weekly' | 'role' | 'system';
  title: string;
  body: string;
  challenge_id: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
};

export type HomeStats = {
  best_classic: number | null;
  classic_rank: number | null;
  daily_best: number | null;
  daily_rank: number | null;
  week: string;
  today: string;
  games_played: number;
  my_challenges: number;
  followers: number;
  unread: number;
};

export type GameMode = 'classic' | 'daily' | 'challenge';

export type RunStart = {
  run_id: string;
  mode: GameMode;
  title: string;
  seed: number;
  round_time_ms: number;
  max_rounds: number | null;
  protocols: Protocol[];
};

export type RunResult =
  | { rejected: true; reason: string }
  | { rejected: false; score: number; best: number; new_record: boolean; previous_best: number | null;
      rank: number; completed: boolean; board: string };

export type Run = {
  id: string; mode: GameMode; challenge_id: string | null; status: 'started' | 'finished' | 'rejected';
  started_at: string; score: number | null; rounds_cleared: number | null; completed: boolean;
};

export type LeaderRow = { score: number; achieved_at: string; user: MiniProfile | null };
export type RankInfo = { score: number | null; rank: number | null; total: number };

export const ROLE_LABEL: Record<Role, string> = { user: 'Usuario', moderator: 'Moderador', admin: 'Administrador' };
export const MODE_LABEL: Record<GameMode, string> = { classic: 'Clásico', daily: 'Diario', challenge: 'Desafío' };

export const boards = {
  classic: 'classic',
  week: (week: string) => `classic:week:${week}`,
  daily: (day: string) => `daily:${day}`,
  challenge: (id: string) => `challenge:${id}`,
};

const AUTHOR = 'author:profiles!challenges_author_id_fkey(id, username, full_name, avatar_url)';
const CHALLENGE_SELECT = `*, ${AUTHOR}`;
const MINI = 'id, username, full_name, avatar_url';

type Res<T> = { data: T | null; error: unknown };
function unwrap<T>({ data, error }: Res<T>): T {
  if (error) throw error;
  return data as T;
}

/** Verifica que un UPDATE/DELETE afectó filas; si no, RLS lo bloqueó o el registro no existe */
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

export type ProfilePatch = Partial<Pick<Profile, 'username' | 'full_name' | 'bio' | 'avatar_url' | 'notify_comments' |
  'notify_ratings' | 'notify_follows' | 'notify_new_challenges' | 'notify_daily' | 'notify_beaten'>>;

export async function updateMyProfile(patch: ProfilePatch): Promise<void> {
  const uid = await myId();
  ensureAffected(unwrap(await supabase.from('profiles').update(patch).eq('id', uid).select('id')), 'tu perfil');
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

// ---------- Protocolos (catálogo; ABM del admin) ----------
export async function getProtocols(includeInactive = false): Promise<ProtocolRow[]> {
  let q = supabase.from('protocols').select('id, name, code, icon, category, active').order('category').order('name');
  if (!includeInactive) q = q.eq('active', true);
  return unwrap(await q) as ProtocolRow[];
}

export type ProtocolInput = { name: string; code: string; category: ProtocolCategory; icon: string | null; active: boolean };

export async function createProtocol(p: ProtocolInput) {
  unwrap(await supabase.from('protocols').insert({ ...p, name: p.name.trim(), icon: p.icon?.trim() || null }));
}
export async function updateProtocol(id: number, p: ProtocolInput) {
  ensureAffected(unwrap(await supabase.from('protocols')
    .update({ ...p, name: p.name.trim(), icon: p.icon?.trim() || null }).eq('id', id).select('id')), 'el protocolo');
}
export async function deleteProtocol(id: number) {
  ensureAffected(unwrap(await supabase.from('protocols').delete().eq('id', id).select('id')), 'el protocolo');
}

// ---------- Desafíos (ABM) ----------
export type ChallengeQuery = {
  q?: string;
  authorId?: string;
  authorIds?: string[];
  order?: 'recent' | 'top' | 'popular';
  limit?: number;
  onlyPublic?: boolean;
};

export async function listChallenges(opts: ChallengeQuery = {}): Promise<Challenge[]> {
  let query = supabase.from('challenges').select(CHALLENGE_SELECT);
  if (opts.onlyPublic !== false) query = query.eq('is_public', true);
  if (opts.authorId) query = query.eq('author_id', opts.authorId);
  if (opts.authorIds) {
    if (opts.authorIds.length === 0) return [];
    query = query.in('author_id', opts.authorIds);
  }
  const q = sanitizeSearch(opts.q ?? '');
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (opts.order === 'top') query = query.order('avg_rating', { ascending: false }).order('rating_count', { ascending: false });
  if (opts.order === 'popular') query = query.order('play_count', { ascending: false });
  query = query.order('created_at', { ascending: false }).limit(opts.limit ?? 30);
  return unwrap(await query) as Challenge[];
}

export async function getMyChallenges(): Promise<Challenge[]> {
  return listChallenges({ authorId: await myId(), onlyPublic: false, limit: 100 });
}

export async function getFeed(): Promise<Challenge[]> {
  const uid = await myId();
  const follows = unwrap(await supabase.from('follows').select('following_id').eq('follower_id', uid)) as { following_id: string }[];
  return listChallenges({ authorIds: follows.map((f) => f.following_id), limit: 10 });
}

export async function getChallenge(id: string): Promise<Challenge> {
  const row = unwrap(await supabase.from('challenges').select(CHALLENGE_SELECT).eq('id', id).maybeSingle());
  if (!row) throw new AppError('El desafío no existe, es privado o fue eliminado.');
  return row as Challenge;
}

export async function createChallenge(input: ChallengeInput): Promise<string> {
  const uid = await myId();
  const row = unwrap(await supabase.from('challenges').insert({ ...input, author_id: uid }).select('id').single()) as { id: string };
  return row.id;
}

export async function updateChallenge(id: string, input: ChallengeInput): Promise<void> {
  ensureAffected(unwrap(await supabase.from('challenges').update(input).eq('id', id).select('id')), 'este desafío');
}

export async function deleteChallenge(id: string): Promise<void> {
  ensureAffected(unwrap(await supabase.from('challenges').delete().eq('id', id).select('id')), 'este desafío');
}

// ---------- Partidas (validadas en el servidor) ----------
export async function startRun(mode: GameMode, challengeId?: string): Promise<RunStart> {
  return unwrap(await supabase.rpc('start_run', { p_mode: mode, p_challenge: challengeId ?? null })) as RunStart;
}

export async function finishRun(runId: string, s: { arrows: number; rounds: number; perfect: number; timeBonusMs: number; mistakes: number }): Promise<RunResult> {
  return unwrap(await supabase.rpc('finish_run', {
    p_run: runId, p_arrows: s.arrows, p_rounds: s.rounds, p_perfect: s.perfect,
    p_time_bonus_ms: Math.round(s.timeBonusMs), p_mistakes: s.mistakes,
  })) as RunResult;
}

export async function myRuns(limit = 10): Promise<Run[]> {
  const uid = await myId();
  return unwrap(await supabase.from('runs')
    .select('id, mode, challenge_id, status, started_at, score, rounds_cleared, completed')
    .eq('user_id', uid).neq('status', 'started')
    .order('started_at', { ascending: false }).limit(limit)) as Run[];
}

// ---------- Rankings ----------
export async function leaderboard(board: string, limit = 50): Promise<LeaderRow[]> {
  return unwrap(await supabase.from('best_scores')
    .select(`score, achieved_at, user:profiles!best_scores_user_id_fkey(${MINI})`)
    .eq('board', board)
    .order('score', { ascending: false }).order('achieved_at', { ascending: true })
    .limit(limit)) as unknown as LeaderRow[];
}

export async function myRank(board: string): Promise<RankInfo> {
  return unwrap(await supabase.rpc('my_rank', { p_board: board })) as RankInfo;
}

export async function userBest(userId: string): Promise<number | null> {
  const row = unwrap(await supabase.from('best_scores').select('score').eq('user_id', userId).eq('board', 'classic').maybeSingle()) as { score: number } | null;
  return row?.score ?? null;
}

// ---------- Comentarios ----------
const COMMENT_SELECT = `*, user:profiles!comments_user_id_fkey(${MINI})`;

export async function getComments(challengeId: string): Promise<Comment[]> {
  return unwrap(await supabase.from('comments').select(COMMENT_SELECT)
    .eq('challenge_id', challengeId).order('created_at', { ascending: true })) as Comment[];
}

export async function addComment(challengeId: string, body: string): Promise<void> {
  const uid = await myId();
  unwrap(await supabase.from('comments').insert({ challenge_id: challengeId, user_id: uid, body: body.trim() }));
}

export async function deleteComment(id: string): Promise<void> {
  ensureAffected(unwrap(await supabase.from('comments').delete().eq('id', id).select('id')), 'este comentario');
}

export type ModComment = Comment & { challenge: { id: string; title: string } | null };
export async function recentComments(limit = 40): Promise<ModComment[]> {
  return unwrap(await supabase.from('comments').select(`${COMMENT_SELECT}, challenge:challenges(id, title)`)
    .order('created_at', { ascending: false }).limit(limit)) as ModComment[];
}

// ---------- Valoraciones ----------
export async function getMyRating(challengeId: string): Promise<number | null> {
  const uid = await myId();
  const row = unwrap(await supabase.from('ratings').select('stars').eq('challenge_id', challengeId).eq('user_id', uid).maybeSingle()) as { stars: number } | null;
  return row?.stars ?? null;
}

export async function setMyRating(challengeId: string, stars: number): Promise<void> {
  const uid = await myId();
  if ((await getMyRating(challengeId)) == null) {
    unwrap(await supabase.from('ratings').insert({ challenge_id: challengeId, user_id: uid, stars }));
  } else {
    unwrap(await supabase.from('ratings').update({ stars }).eq('challenge_id', challengeId).eq('user_id', uid));
  }
}

// ---------- Favoritos ----------
export async function isFavorite(challengeId: string): Promise<boolean> {
  const uid = await myId();
  return !!unwrap(await supabase.from('favorites').select('challenge_id').eq('challenge_id', challengeId).eq('user_id', uid).maybeSingle());
}

export async function setFavorite(challengeId: string, fav: boolean): Promise<void> {
  const uid = await myId();
  if (fav) {
    const { error } = await supabase.from('favorites').insert({ challenge_id: challengeId, user_id: uid });
    if (error && !/duplicate|23505/i.test(`${error.message} ${error.code}`)) throw error;
  } else {
    unwrap(await supabase.from('favorites').delete().eq('challenge_id', challengeId).eq('user_id', uid));
  }
}

export async function getFavorites(): Promise<Challenge[]> {
  const uid = await myId();
  const rows = unwrap(await supabase.from('favorites')
    .select(`created_at, challenge:challenges(${CHALLENGE_SELECT})`)
    .eq('user_id', uid).order('created_at', { ascending: false })) as unknown as { challenge: Challenge | null }[];
  return rows.map((r) => r.challenge).filter((c): c is Challenge => !!c);
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
  return !!unwrap(await supabase.from('follows').select('following_id').eq('follower_id', uid).eq('following_id', userId).maybeSingle());
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
