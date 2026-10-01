import {
  ApiResponse,
  CreateEntryInput,
  CreateNegentropyEventInput,
  DailyEntry,
  DashboardData,
  NegentropyEvent,
} from '../../core/index.js';

/**
 * 带 HTTP 状态码的请求错误，离线同步队列据此区分「网络断开（可重试）」
 * 与「服务器明确返回 4xx（永久失败，需用户介入）」。
 */
export class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

export class HttpNotFoundError extends HttpRequestError {
  constructor(message = '记录不存在') {
    super(404, message);
    this.name = 'HttpNotFoundError';
  }
}

/**
 * 判断请求失败是否由网络断开 / 超时引起（此时操作应进入离线队列）。
 * response 4xx / 5xx 不属于断网，不应排队掩盖真实错误。
 */
export function isOfflineError(err: unknown): boolean {
  if (err instanceof TypeError) {
    // fetch 在无法建立连接时会抛 TypeError: Failed to fetch
    return true;
  }
  if (err instanceof HttpRequestError) {
    return err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return false;
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
    try {
      response = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      // fetch 只有在网络层失败时才会 reject（断网、DNS、CORS 预检失败等）
      if (networkErr instanceof Error) {
        throw new HttpRequestError(0, `网络连接失败：${networkErr.message}`);
      }
      throw new HttpRequestError(0, '网络连接失败');
    }

    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !data.success) {
      const message = data.error || `请求失败 (HTTP ${response.status})`;
      if (response.status === 404) {
        throw new HttpNotFoundError(message);
      }
      throw new HttpRequestError(response.status, message);
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

  public async getEntryByDate(date: string): Promise<DailyEntry | null> {
    try {
      return await this.request<DailyEntry>(`/api/entries/${date}`);
    } catch (err) {
      if (err instanceof HttpNotFoundError) return null;
      throw err;
    }
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
