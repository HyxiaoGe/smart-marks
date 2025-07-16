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
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;
  private quotaPerKey: Map<string, LinkPreviewQuota> = new Map();
  private readonly QUOTA_KEY = 'linkPreviewQuota';
  private readonly API_ENDPOINT = 'https://api.linkpreview.net/';

  constructor() {
    this.loadQuota();
  }

  /**
   * 设置 API Keys
   */
  setApiKeys(keys: string[]) {
    this.apiKeys = keys.filter(k => k.trim());
    // 初始化每个密钥的配额
    this.apiKeys.forEach(key => {
      if (!this.quotaPerKey.has(key)) {
        this.quotaPerKey.set(key, {
          used: 0,
          resetTime: Date.now() + 60 * 60 * 1000,
          limit: 60
        });
      }
    });
  }

  /**
   * 设置单个 API Key (向后兼容)
   */
  setApiKey(key: string) {
    if (key) {
      this.setApiKeys([key]);
    }
  }

  /**
   * 检查是否有 API Key
   */
  hasApiKey(): boolean {
    return this.apiKeys.length > 0;
  }

  /**
   * 获取当前的 API Key
   */
  private getCurrentKey(): string | null {
    if (this.apiKeys.length === 0) return null;
    return this.apiKeys[this.currentKeyIndex];
  }
  
  /**
   * 切换到下一个 API Key
   */
  private switchToNextKey(): string | null {
    if (this.apiKeys.length <= 1) return null;
    
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return this.getCurrentKey();
  }

  /**
   * 加载配额信息
   */
  private async loadQuota() {
    try {
      const data = await chrome.storage.local.get(this.QUOTA_KEY);
      if (data[this.QUOTA_KEY]) {
        // 转换为Map结构
        const quotaData = data[this.QUOTA_KEY];
        if (quotaData instanceof Map) {
          this.quotaPerKey = quotaData;
        } else if (typeof quotaData === 'object') {
          // 兼容旧格式或从存储中恢复
          this.quotaPerKey = new Map(Object.entries(quotaData));
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
      // 将Map转换为普通对象以便存储
      const quotaObj: { [key: string]: LinkPreviewQuota } = {};
      this.quotaPerKey.forEach((quota, key) => {
        quotaObj[key] = quota;
      });
      
      await chrome.storage.local.set({
        [this.QUOTA_KEY]: quotaObj
      });
    } catch (error) {
      console.error('保存LinkPreview配额失败:', error);
    }
  }

  /**
   * 重置单个密钥的配额
   */
  private resetQuotaForKey(key: string) {
    this.quotaPerKey.set(key, {
      used: 0,
      resetTime: Date.now() + 60 * 60 * 1000,
      limit: 60
    });
    this.saveQuota();
  }

  /**
   * 检查单个密钥是否有可用配额
   */
  private hasQuotaForKey(key: string): boolean {
    const quota = this.quotaPerKey.get(key);
    if (!quota) return false;
    
    if (Date.now() > quota.resetTime) {
      this.resetQuotaForKey(key);
      return true;
    }
    return quota.used < quota.limit;
  }

  /**
   * 检查是否有可用配额（简化版，只检查是否有密钥）
   */
  hasQuota(): boolean {
    return this.hasApiKey();
  }

  /**
   * 获取剩余配额
   */
  getRemainingQuota(): number {
    let totalRemaining = 0;
    for (const key of this.apiKeys) {
      const quota = this.quotaPerKey.get(key);
      if (quota) {
        if (Date.now() > quota.resetTime) {
          totalRemaining += quota.limit;
        } else {
          totalRemaining += Math.max(0, quota.limit - quota.used);
        }
      }
    }
    return totalRemaining;
  }

  /**
   * 获取配额信息
   */
  getQuotaInfo(): { remaining: number; resetIn: number; total: number; keyCount: number } {
    const remaining = this.getRemainingQuota();
    let nearestResetTime = Infinity;
    
    // 找到最近的重置时间
    for (const quota of this.quotaPerKey.values()) {
      if (quota.resetTime < nearestResetTime) {
        nearestResetTime = quota.resetTime;
      }
    }
    
    const resetIn = Math.max(0, nearestResetTime - Date.now());
    
    return {
      remaining,
      resetIn: Math.floor(resetIn / 1000 / 60), // 转换为分钟
      total: this.apiKeys.length * 60, // 每个密钥60次
      keyCount: this.apiKeys.length
    };
  }

  /**
   * 获取链接预览
   */
  async fetchPreview(url: string, retryCount: number = 0): Promise<LinkPreviewResponse | null> {
    const apiKey = this.getCurrentKey();
    if (!apiKey) {
      console.log('LinkPreview: 未配置API Key');
      return null;
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}?q=${encodeURIComponent(url)}`, {
        headers: {
          'X-Linkpreview-Api-Key': apiKey
        }
      });

      if (!response.ok) {
        console.log(`LinkPreview: API Key ${this.currentKeyIndex + 1} 请求失败 (${response.status})`);
        
        // 如果有其他密钥可用，尝试切换
        if (this.apiKeys.length > 1 && retryCount < this.apiKeys.length - 1) {
          const nextKey = this.switchToNextKey();
          if (nextKey) {
            console.log(`LinkPreview: 切换到密钥 ${this.currentKeyIndex + 1}/${this.apiKeys.length} 重试`);
            return this.fetchPreview(url, retryCount + 1);
          }
        }
        
        throw new Error(`LinkPreview API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as LinkPreviewResponse;
      
      // 成功获取，更新配额
      const quota = this.quotaPerKey.get(apiKey);
      if (quota) {
        quota.used++;
        await this.saveQuota();
      }
      
      console.log(`LinkPreview: 获取成功 (密钥 ${this.currentKeyIndex + 1}/${this.apiKeys.length})`);
      
      return data;
    } catch (error) {
      console.error(`LinkPreview: 密钥 ${this.currentKeyIndex + 1} 调用失败:`, error);
      
      // 如果有其他密钥可用，尝试切换
      if (this.apiKeys.length > 1 && retryCount < this.apiKeys.length - 1) {
        const nextKey = this.switchToNextKey();
        if (nextKey) {
          console.log(`LinkPreview: 切换到密钥 ${this.currentKeyIndex + 1}/${this.apiKeys.length} 重试`);
          return this.fetchPreview(url, retryCount + 1);
        }
      }
      
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