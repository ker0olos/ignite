/** Base64 data's bytes. */
export function base64Bytes(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Seconds as `m:ss`. */
export function clock(seconds: number) {
  const whole = Math.floor(Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
