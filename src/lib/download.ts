/** Saves text as a file. Only ever called from an explicit button press. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens the device share sheet with a file, where supported. Returns false if not supported. */
export async function shareFile(filename: string, text: string, mime: string): Promise<boolean> {
  try {
    const file = new File([text], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
    await nav.share({ files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** Opens the share sheet with text the person has reviewed. Falls back to the clipboard. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'failed';
  }
  return copyText(text);
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
