import { router } from 'expo-router';
import { RecipeForm } from '../../components/RecipeForm';
import { createRecipe } from '../../lib/api';

export default function NewRecipe() {
  return (
    <RecipeForm
      submitLabel="Publicar receta"
      onSubmit={async (input) => {
        const id = await createRecipe(input);
        router.replace(`/recipe/${id}`);
      }}
    />
  );
}
