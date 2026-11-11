import { router, useLocalSearchParams } from 'expo-router';
import { RecipeForm } from '../../../components/RecipeForm';
import { ErrorView, Loading } from '../../../components/ui';
import { getRecipe, updateRecipe } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useLoader } from '../../../lib/useLoader';

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, isStaff } = useAuth();
  const { data, error, loading, retry } = useLoader(() => getRecipe(id), [id]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'La receta no existe.'} onRetry={retry} />;
  // Control visual; el control real lo hace la política RLS del servidor
  if (data.author_id !== profile?.id && !isStaff) {
    return <ErrorView message="No tenés permiso para editar esta receta." />;
  }

  return (
    <RecipeForm
      initial={data}
      submitLabel="Guardar cambios"
      onSubmit={async (input) => {
        await updateRecipe(id, input);
        router.back();
      }}
    />
  );
}
