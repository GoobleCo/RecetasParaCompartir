import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Category, DIFFICULTY_LABEL, Difficulty, getCategories, Recipe, RecipeInput } from '../lib/api';
import { useAuth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { useTheme } from '../lib/theme';
import { imageUrl, pickImage, removeImage, uploadImage } from '../lib/upload';
import { intInRange, required } from '../lib/validation';
import { Button, Card, Chip, Field, IconButton, SectionHeader, T } from './ui';

type Errors = Partial<Record<'title' | 'description' | 'prep' | 'servings' | 'ingredients' | 'steps', string | null>>;

/**
 * Formulario compartido para ALTA y MODIFICACIÓN de recetas.
 * Valida todo antes de enviar y muestra el error en cada campo.
 */
export function RecipeForm({ initial, submitLabel, onSubmit }: {
  initial?: Recipe;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null);
  const [prep, setPrep] = useState(initial?.prep_minutes ? String(initial.prep_minutes) : '');
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'media');
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? ['']);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? ['']);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);
  const [imagePath, setImagePath] = useState<string | null>(initial?.image_path ?? null);
  const [newImage, setNewImage] = useState<ImagePickerAsset | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const choose = async () => {
    try {
      const asset = await pickImage([4, 3]);
      if (asset) setNewImage(asset);
    } catch (e) {
      Alert.alert('Imagen', friendlyError(e));
    }
  };

  const updateList = (list: string[], set: (v: string[]) => void, i: number, v: string) => {
    const copy = [...list];
    copy[i] = v;
    set(copy);
  };

  const submit = async () => {
    const ing = ingredients.map((s) => s.trim()).filter(Boolean);
    const st = steps.map((s) => s.trim()).filter(Boolean);
    const e: Errors = {
      title: required(title, 'El título', 80, 3),
      description: description.length > 500 ? 'Máximo 500 caracteres.' : null,
      prep: intInRange(prep, 'El tiempo', 1, 1440),
      servings: intInRange(servings, 'Las porciones', 1, 50),
      ingredients: ing.length === 0 ? 'Agregá al menos un ingrediente.' : ing.length > 50 ? 'Máximo 50 ingredientes.' : null,
      steps: st.length === 0 ? 'Agregá al menos un paso.' : st.length > 50 ? 'Máximo 50 pasos.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      Alert.alert('Revisá el formulario', 'Hay campos con errores.');
      return;
    }
    if (!session) return;

    setSaving(true);
    let uploaded: string | null = null;
    try {
      if (newImage) uploaded = await uploadImage('recipe-images', session.user.id, newImage);
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        prep_minutes: prep ? Number(prep) : null,
        servings: servings ? Number(servings) : null,
        difficulty,
        ingredients: ing,
        steps: st,
        is_public: isPublic,
        image_path: uploaded ?? imagePath,
      });
      // Si reemplazamos o quitamos la foto, borramos la anterior del storage
      if (initial?.image_path && initial.image_path !== (uploaded ?? imagePath)) {
        removeImage('recipe-images', initial.image_path).catch(() => {});
      }
    } catch (err) {
      if (uploaded) removeImage('recipe-images', uploaded).catch(() => {});
      Alert.alert('No se pudo guardar', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const preview = newImage?.uri ?? imageUrl('recipe-images', imagePath);

  const listEditor = (label: string, list: string[], set: (v: string[]) => void, placeholder: string, error?: string | null, numbered?: boolean) => (
    <View style={{ gap: 8 }}>
      <SectionHeader title={label} />
      {list.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          {numbered && <T style={{ width: 22, paddingTop: 12, fontWeight: '700', color: colors.primary }}>{i + 1}.</T>}
          <Field style={{ flex: 1 }} value={item} onChangeText={(v) => updateList(list, set, i, v)}
            placeholder={placeholder} multiline={numbered} maxLength={numbered ? 600 : 120} />
          <IconButton label="Quitar" icon="close-circle-outline" color={colors.muted}
            onPress={() => set(list.length === 1 ? [''] : list.filter((_, j) => j !== i))} />
        </View>
      ))}
      {error && <T variant="small" style={{ color: colors.danger }}>{error}</T>}
      <Button small variant="ghost" icon="add" title={`Agregar ${numbered ? 'paso' : 'ingrediente'}`}
        onPress={() => set([...list, ''])} disabled={list.length >= 50} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {preview ? (
            <Image source={{ uri: preview }} style={{ width: '100%', height: 200 }} />
          ) : (
            <View style={{ height: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
              <T style={{ fontSize: 40 }}>📷</T>
              <T muted>Sin foto</T>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, padding: 10 }}>
            <Button style={{ flex: 1 }} small variant="secondary" icon="image-outline" title={preview ? 'Cambiar foto' : 'Agregar foto'} onPress={choose} />
            {preview && <Button small variant="danger" icon="trash-outline" title="Quitar" onPress={() => { setNewImage(null); setImagePath(null); }} />}
          </View>
        </Card>

        <Field label="Título *" value={title} onChangeText={setTitle} error={errors.title} placeholder="Ej: Locro norteño" maxLength={80} />
        <Field label="Descripción" value={description} onChangeText={setDescription} error={errors.description}
          placeholder="Contá de qué se trata, para cuándo es ideal…" multiline maxLength={500} />

        <View style={{ gap: 8 }}>
          <T variant="label">Categoría</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Sin categoría" active={categoryId == null} onPress={() => setCategoryId(null)} />
            {categories.map((c) => (
              <Chip key={c.id} label={`${c.emoji ?? ''} ${c.name}`.trim()} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Tiempo (min)" value={prep} onChangeText={setPrep} error={errors.prep} keyboardType="number-pad" placeholder="45" maxLength={4} />
          <Field style={{ flex: 1 }} label="Porciones" value={servings} onChangeText={setServings} error={errors.servings} keyboardType="number-pad" placeholder="4" maxLength={2} />
        </View>

        <View style={{ gap: 8 }}>
          <T variant="label">Dificultad</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <Chip key={d} label={DIFFICULTY_LABEL[d]} active={difficulty === d} onPress={() => setDifficulty(d)} />
            ))}
          </View>
        </View>

        {listEditor('Ingredientes *', ingredients, setIngredients, 'Ej: 500 g de harina', errors.ingredients)}
        {listEditor('Pasos *', steps, setSteps, 'Describí este paso', errors.steps, true)}

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T variant="h3">Receta pública</T>
            <T variant="small" muted>{isPublic ? 'Toda la comunidad puede verla.' : 'Sólo vos (y la moderación) pueden verla.'}</T>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary, false: colors.border }} />
        </Card>

        <Button title={submitLabel} icon="checkmark" onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
