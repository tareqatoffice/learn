/** Reads an audio file's length in seconds in the browser; 0 when it can't be decoded. Client only. */
export function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(n) ? Math.round(n) : 0);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    el.src = url;
  });
}
