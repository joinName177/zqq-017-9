import {
  ApiResponse,
  CreateEntryInput,
  CreateNegentropyEventInput,
  DailyEntry,
  DashboardData,
  NegentropyEvent,
} from '../../core/index.js';

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly serverEntry?: DailyEntry
  ) {
    super(message);
    this.name = 'HttpClientError';
  }

  public get isConflict(): boolean {
    return this.status === 409;
  }

  public get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export class HttpClient {
  private baseUrl = '';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let response: Response;
    let data: ApiResponse<T>;

    try {
      response = await fetch(url, { ...options, headers });
      data = (await response.json()) as ApiResponse<T>;
    } catch (err) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new HttpClientError('当前处于离线状态', 0);
      }
      const message = err instanceof Error ? err.message : '无法连接服务器';
      throw new HttpClientError(message, 0);
    }

    if (!response.ok || !data.success) {
      const serverEntry = (data as ApiResponse<DailyEntry>).data;
      throw new HttpClientError(
        data.error || `请求失败 (HTTP ${response.status})`,
        response.status,
        serverEntry || undefined
      );
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

  public async deleteEntry(
    id: string,
    options: { baseVersion?: number | null; force?: boolean } = {}
  ): Promise<boolean> {
    const params = new URLSearchParams();
    if (options.baseVersion !== undefined) {
      params.set('baseVersion', options.baseVersion === null ? '' : String(options.baseVersion));
    }
    if (options.force) params.set('force', 'true');
    const query = params.size > 0 ? `?${params.toString()}` : '';

    await this.request<{ success: boolean }>(`/api/entries/${encodeURIComponent(id)}${query}`, {
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

  public async deleteNegentropy(
    id: string,
    options: { baseVersion?: number | null; force?: boolean } = {}
  ): Promise<DailyEntry | null> {
    const params = new URLSearchParams();
    if (options.baseVersion !== undefined) {
      params.set('baseVersion', options.baseVersion === null ? '' : String(options.baseVersion));
    }
    if (options.force) params.set('force', 'true');
    const query = params.size > 0 ? `?${params.toString()}` : '';

    return this.request<DailyEntry | null>(
      `/api/negentropy/${encodeURIComponent(id)}${query}`,
      { method: 'DELETE' }
    );
  }

  public async seedDemo(): Promise<string> {
    const res = await this.request<{ message: string }>('/api/seed', {
      method: 'POST',
    });
    return res.message || '演示数据注入完成';
  }
}

export const httpClient = new HttpClient();
