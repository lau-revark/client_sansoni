export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function checkoutUrl(code: string): string {
  return `${appUrl()}/c/${encodeURIComponent(code)}`;
}
