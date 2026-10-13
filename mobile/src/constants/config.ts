/**
 * Application configuration
 * Default configured with laptop's active Wi-Fi IPv4 address (172.20.10.10:4000)
 */
export const DEFAULT_API_BASE_URL = 'http://172.20.10.10:4000';

export interface AppConfig {
  apiBaseUrl: string;
}
