'use client';

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseStorage } from '@/lib/firebase/client';

/**
 * Upload a meal photo and return a download URL.
 *
 * Objects are stored under `food-images/<uid>/`, and the Storage Rules compare
 * that path segment to the caller's uid — so a user can only write into, and
 * read from, their own folder even though the bucket is shared.
 *
 * Returns null on any failure — the photo is a nice-to-have and must never
 * block logging the food itself.
 */
export async function uploadFoodImage(file: File): Promise<string | null> {
  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;

    const extension =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';

    const path = `food-images/${user.uid}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const storageRef = ref(getFirebaseStorage(), path);

    await uploadBytes(storageRef, file, { contentType: file.type });

    return await getDownloadURL(storageRef);
  } catch (error) {
    // Most likely causes: Storage not enabled on the project (it requires the
    // Blaze plan), or rules rejecting the write.
    console.warn('[storage] upload failed', error);
    return null;
  }
}
