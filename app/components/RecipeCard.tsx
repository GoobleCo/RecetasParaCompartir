import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { DIFFICULTY_LABEL, Recipe } from '../lib/api';
import { useTheme } from '../lib/theme';
import { imageUrl } from '../lib/upload';
import { Badge, Stars, T } from './ui';

function Cover({ recipe, height }: { recipe: Recipe; height: number }) {
  const { colors } = useTheme();
  const uri = imageUrl('recipe-images', recipe.image_path);
  if (uri) return <Image source={{ uri }} style={{ width: '100%', height, backgroundColor: colors.cardAlt }} resizeMode="cover" />;
  return (
    <View style={{ width: '100%', height, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontSize: height * 0.35 }}>{recipe.category?.emoji ?? '🍽️'}</T>
    </View>
  );
}

export function RecipeCard({ recipe, compact }: { recipe: Recipe; compact?: boolean }) {
  const { colors } = useTheme();
  const open = () => router.push(`/recipe/${recipe.id}`);

  if (compact) {
    return (
      <Pressable onPress={open} style={({ pressed }) => ({
        width: 170, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card,
        borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1,
      })}>
        <Cover recipe={recipe} height={105} />
        <View style={{ padding: 10, gap: 4 }}>
          <T variant="h3" numberOfLines={1}>{recipe.title}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Stars value={Number(recipe.avg_rating)} size={12} />
            <T variant="small" muted>({recipe.rating_count})</T>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} style={({ pressed }) => ({
      borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.88 : 1,
    })}>
      <Cover recipe={recipe} height={160} />
      <View style={{ padding: 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {recipe.category && <Badge label={`${recipe.category.emoji ?? ''} ${recipe.category.name}`.trim()} />}
          <Badge tone="muted" label={DIFFICULTY_LABEL[recipe.difficulty]} />
          {!recipe.is_public && <Badge tone="danger" label="Privada" />}
        </View>
        <T variant="h3" numberOfLines={2}>{recipe.title}</T>
        {recipe.description ? <T variant="small" muted numberOfLines={2}>{recipe.description}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Stars value={Number(recipe.avg_rating)} size={13} />
            <T variant="small" muted>{Number(recipe.avg_rating).toFixed(1)} ({recipe.rating_count})</T>
          </View>
          {recipe.prep_minutes ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <T variant="small" muted>{recipe.prep_minutes} min</T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
            <T variant="small" muted>{recipe.comment_count}</T>
          </View>
        </View>
        {recipe.author && <T variant="small" muted>por @{recipe.author.username}</T>}
      </View>
    </Pressable>
  );
}
