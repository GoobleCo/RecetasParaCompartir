import { router, useLocalSearchParams } from 'expo-router';
import { ChallengeForm } from '../../../components/ChallengeForm';
import { ErrorView, Loading } from '../../../components/ui';
import { getChallenge, updateChallenge } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useLoader } from '../../../lib/useLoader';

export default function EditChallenge() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, isStaff } = useAuth();
  const { data, error, loading, retry } = useLoader(() => getChallenge(id), [id]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'El desafío no existe.'} onRetry={retry} />;
  // Control visual; el control real lo hace la política RLS del servidor
  if (data.author_id !== profile?.id && !isStaff) return <ErrorView message="No tenés permiso para editar este desafío." />;

  return (
    <ChallengeForm
      initial={data}
      submitLabel="Guardar cambios"
      onSubmit={async (input) => {
        await updateChallenge(id, input);
        router.back();
      }}
    />
  );
}
