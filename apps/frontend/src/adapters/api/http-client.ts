import {
  ApiResponse,
  CreateEntryInput,
  CreateNegentropyEventInput,
  DailyEntry,
  DashboardData,
  NegentropyEvent,
} from '../../core/index.js';

export class HttpClient {
  private baseUrl = '';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !data.success) {
      throw new Error(data.error || `请求失败 (HTTP ${response.status})`);
    }

    return data.data as T;
  }

  public async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>('/api/dashboard');
  }

  public async recordEntry(input: CreateEntryInput): Promise<DailyEntry> {
    return this.request<DailyEntry>('/api/entries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public async getHistory(limit = 30, offset = 0): Promise<{ items: DailyEntry[]; total: number }> {
    return this.request<{ items: DailyEntry[]; total: number }>(
      `/api/entries?limit=${limit}&offset=${offset}`
    );
  }

  public async deleteEntry(id: string): Promise<boolean> {
    await this.request<{ success: boolean }>(`/api/entries/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  public async addNegentropy(input: CreateNegentropyEventInput): Promise<NegentropyEvent> {
    return this.request<NegentropyEvent>('/api/negentropy', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public async deleteNegentropy(id: string): Promise<boolean> {
    await this.request<{ success: boolean }>(`/api/negentropy/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  public async seedDemo(): Promise<string> {
    const res = await this.request<{ message: string }>('/api/seed', {
      method: 'POST',
    });
    return res.message || '演示数据注入完成';
  }
}

export const httpClient = new HttpClient();
