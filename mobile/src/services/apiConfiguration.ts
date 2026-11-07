export type ApiConfiguration = { baseUrl: string | null; error: string | null };

export function parseApiConfiguration(value: string | undefined): ApiConfiguration {
  if (!value?.trim()) return { baseUrl: null, error: null };
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.search || url.hash || !url.hostname || ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase())) {
      throw new Error('Invalid API address');
    }
    return { baseUrl: url.toString().replace(/\/+$/, ''), error: null };
  } catch {
    return {
      baseUrl: null,
      error: 'The AI service address is invalid. Use the computer’s Wi-Fi address or a hosted HTTPS address, not Android localhost.',
    };
  }
}

// Expo inlines this public configuration value; never put secrets in EXPO_PUBLIC_*.
export const apiConfiguration = parseApiConfiguration(process.env.EXPO_PUBLIC_API_BASE_URL);
