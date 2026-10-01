import { DashboardData } from '../../core/index.js';

const CACHE_KEY_DASHBOARD = 'anxiety_entropy_dashboard_cache_v1';
const CACHE_KEY_TIMESTAMP = 'anxiety_entropy_dashboard_cache_time';

export class OfflineCacheAdapter {
  public saveDashboardCache(data: DashboardData): void {
    try {
      localStorage.setItem(CACHE_KEY_DASHBOARD, JSON.stringify(data));
      localStorage.setItem(CACHE_KEY_TIMESTAMP, new Date().toISOString());
    } catch (e) {
      console.warn('[OfflineCache] Failed to save dashboard cache to localStorage', e);
    }
  }

  public getDashboardCache(): { data: DashboardData | null; cachedAt: string | null } {
    try {
      const raw = localStorage.getItem(CACHE_KEY_DASHBOARD);
      const cachedAt = localStorage.getItem(CACHE_KEY_TIMESTAMP);
      if (raw) {
        return {
          data: JSON.parse(raw) as DashboardData,
          cachedAt,
        };
      }
    } catch (e) {
      console.warn('[OfflineCache] Failed to load dashboard cache from localStorage', e);
    }
    return { data: null, cachedAt: null };
  }

  public clear(): void {
    localStorage.removeItem(CACHE_KEY_DASHBOARD);
    localStorage.removeItem(CACHE_KEY_TIMESTAMP);
  }
}

export const offlineCacheAdapter = new OfflineCacheAdapter();
