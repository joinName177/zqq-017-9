import { DashboardData, DailyEntry } from '../../core/index.js';

const CACHE_KEY_DASHBOARD = 'anxiety_entropy_dashboard_cache_v1';
const CACHE_KEY_TIMESTAMP = 'anxiety_entropy_dashboard_cache_time';
const CACHE_KEY_HISTORY = 'anxiety_entropy_history_cache_v1';
const CACHE_KEY_HISTORY_TIME = 'anxiety_entropy_history_cache_time';

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

  public saveHistoryCache(items: DailyEntry[]): void {
    try {
      localStorage.setItem(CACHE_KEY_HISTORY, JSON.stringify(items));
      localStorage.setItem(CACHE_KEY_HISTORY_TIME, new Date().toISOString());
    } catch (e) {
      console.warn('[OfflineCache] Failed to save history cache to localStorage', e);
    }
  }

  public getHistoryCache(): { items: DailyEntry[]; cachedAt: string | null } {
    try {
      const raw = localStorage.getItem(CACHE_KEY_HISTORY);
      const cachedAt = localStorage.getItem(CACHE_KEY_HISTORY_TIME);
      if (raw) {
        return { items: JSON.parse(raw) as DailyEntry[], cachedAt };
      }
    } catch (e) {
      console.warn('[OfflineCache] Failed to load history cache from localStorage', e);
    }
    return { items: [], cachedAt: null };
  }

  public clear(): void {
    localStorage.removeItem(CACHE_KEY_DASHBOARD);
    localStorage.removeItem(CACHE_KEY_TIMESTAMP);
    localStorage.removeItem(CACHE_KEY_HISTORY);
    localStorage.removeItem(CACHE_KEY_HISTORY_TIME);
  }
}

export const offlineCacheAdapter = new OfflineCacheAdapter();
