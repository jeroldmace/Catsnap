import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app shell, false in a normal browser. */
export const isNative = () => Capacitor.isNativePlatform();

/**
 * Hand a file to the user. In a browser this is a normal download; in the
 * native app it is written to the app cache and opened in the share sheet
 * (save to Drive, Files, email…).
 */
export async function saveFile(blob: Blob, filename: string): Promise<'downloaded' | 'shared'> {
  if (!isNative()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'downloaded';
  }
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const res = await Filesystem.writeFile({ path: filename, data: await blob.text(), directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Cat Snap backup', files: [res.uri], dialogTitle: 'Save your Cat Snap backup' });
  return 'shared';
}
