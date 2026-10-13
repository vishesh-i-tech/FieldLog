import { DEFAULT_API_BASE_URL } from '../constants/config';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'pending_configuration' | 'offline';
  database: 'connected' | 'disconnected' | 'not_configured' | 'unreachable';
  databaseLatencyMs?: number;
  uptimeSeconds?: number;
  timestamp?: string;
  message?: string;
  error?: string;
  instruction?: string;
}

export async function checkServerHealth(
  baseUrl = DEFAULT_API_BASE_URL,
  timeoutMs = 6000
): Promise<HealthCheckResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/health`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    return data as HealthCheckResponse;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMsg.includes('abort') || errorMsg.includes('timeout');

    return {
      status: 'offline',
      database: 'unreachable',
      error: isTimeout
        ? 'Connection timed out. Ensure laptop and phone are on the same Wi-Fi and port 4000 is open.'
        : `Network Error: ${errorMsg}`,
      message: 'Could not reach backend API at ' + baseUrl,
    };
  }
}
