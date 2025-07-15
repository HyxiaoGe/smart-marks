/**
 * LinkPreview API 服务
 */

interface LinkPreviewResponse {
  title: string;
  description: string;
  image: string;
  url: string;
}

interface LinkPreviewQuota {
  used: number;
  resetTime: number;
  limit: number;
}

class LinkPreviewService {
  private apiKey: string = '';
  private quota: LinkPreviewQuota = {
    used: 0,
    resetTime: Date.now() + 60 * 60 * 1000, // 1小时后重置
    limit: 60
  };
  private readonly QUOTA_KEY = 'linkPreviewQuota';
  private readonly API_ENDPOINT = 'https://api.linkpreview.net/';

  constructor() {
    this.loadQuota();
  }

  /**
   * 设置 API Key
   */
  setApiKey(key: string) {
    this.apiKey = key;
  }

  /**
   * 检查是否有 API Key
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * 加载配额信息
   */
  private async loadQuota() {
    try {
      const data = await chrome.storage.local.get(this.QUOTA_KEY);
      if (data[this.QUOTA_KEY]) {
        this.quota = data[this.QUOTA_KEY];
        
        // 检查是否需要重置配额
        if (Date.now() > this.quota.resetTime) {
          this.resetQuota();
        }
      }
    } catch (error) {
      console.error('加载LinkPreview配额失败:', error);
    }
  }

  /**
   * 保存配额信息
   */
  private async saveQuota() {
    try {
      await chrome.storage.local.set({
        [this.QUOTA_KEY]: this.quota
      });
    } catch (error) {
      console.error('保存LinkPreview配额失败:', error);
    }
  }

  /**
   * 重置配额
   */
  private resetQuota() {
    this.quota = {
      used: 0,
      resetTime: Date.now() + 60 * 60 * 1000,
      limit: 60
    };
    this.saveQuota();
  }

  /**
   * 检查是否有可用配额
   */
  hasQuota(): boolean {
    if (Date.now() > this.quota.resetTime) {
      this.resetQuota();
      return true;
    }
    return this.quota.used < this.quota.limit;
  }

  /**
   * 获取剩余配额
   */
  getRemainingQuota(): number {
    if (Date.now() > this.quota.resetTime) {
      return this.quota.limit;
    }
    return Math.max(0, this.quota.limit - this.quota.used);
  }

  /**
   * 获取配额信息
   */
  getQuotaInfo(): { remaining: number; resetIn: number; total: number } {
    const remaining = this.getRemainingQuota();
    const resetIn = Math.max(0, this.quota.resetTime - Date.now());
    
    return {
      remaining,
      resetIn: Math.floor(resetIn / 1000 / 60), // 转换为分钟
      total: this.quota.limit
    };
  }

  /**
   * 获取链接预览
   */
  async fetchPreview(url: string): Promise<LinkPreviewResponse | null> {
    if (!this.hasApiKey()) {
      console.log('LinkPreview: 未配置API Key');
      return null;
    }

    if (!this.hasQuota()) {
      console.log('LinkPreview: 配额已用完');
      return null;
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}?q=${encodeURIComponent(url)}`, {
        headers: {
          'X-Linkpreview-Api-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`LinkPreview API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as LinkPreviewResponse;
      
      // 更新配额
      this.quota.used++;
      await this.saveQuota();
      
      console.log(`LinkPreview: 获取成功，剩余配额: ${this.getRemainingQuota()}`);
      
      return data;
    } catch (error) {
      console.error('LinkPreview API调用失败:', error);
      return null;
    }
  }

  /**
   * 批量获取预览（带限流）
   */
  async fetchPreviews(urls: string[], delay: number = 1000): Promise<Map<string, LinkPreviewResponse>> {
    const results = new Map<string, LinkPreviewResponse>();
    
    for (const url of urls) {
      if (!this.hasQuota()) {
        console.log('LinkPreview: 批量获取中断，配额已用完');
        break;
      }
      
      const preview = await this.fetchPreview(url);
      if (preview) {
        results.set(url, preview);
      }
      
      // 延迟避免请求过快
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
}

// 导出单例实例
export const linkPreviewService = new LinkPreviewService();