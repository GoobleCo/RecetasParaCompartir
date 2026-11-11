import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { AppError } from './errors';
import { supabase } from './supabase';

export type Bucket = 'recipe-images' | 'avatars';
const MAX_BYTES: Record<Bucket, number> = { 'recipe-images': 5 * 1024 * 1024, avatars: 2 * 1024 * 1024 };

/** Abre la galería. Devuelve null si el usuario cancela. */
export async function pickImage(aspect: [number, number]): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new AppError('Necesitamos permiso para acceder a tus fotos. Podés habilitarlo en la configuración del teléfono.');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.6, // comprime para ahorrar datos y almacenamiento
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0];
}

/**
 * Sube la imagen a Supabase Storage dentro de la carpeta del usuario
 * (<userId>/archivo.jpg). Las políticas del bucket impiden escribir en carpetas ajenas.
 */
export async function uploadImage(bucket: Bucket, userId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (!asset.base64) throw new AppError('No se pudo leer la imagen seleccionada.');
  const mime = asset.mimeType && /^image\/(jpeg|png|webp)$/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const bytes = decode(asset.base64);
  if (bytes.byteLength > MAX_BYTES[bucket]) {
    throw new AppError(`La imagen supera el máximo de ${MAX_BYTES[bucket] / 1024 / 1024} MB.`);
  }
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeImage(bucket: Bucket, path: string | null | undefined) {
  if (!path || path.startsWith('http')) return;
  await supabase.storage.from(bucket).remove([path]);
}

/** URL pública de una imagen guardada (o la URL tal cual si ya es externa) */
export function imageUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
