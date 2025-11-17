/**
 * 分类缓存服务 - 管理域名分类的缓存
 */

import { logger } from '~/utils/logger';

interface DomainClassification {
  domain: string;
  category: string;
  confidence: number;
  timestamp: number;
  source: 'dictionary' | 'ai' | 'linkpreview' | 'manual';
}

interface ClassificationStats {
  [domain: string]: {
    category: string;
    count: number;
    lastUsed: number;
  };
}

class ClassificationCacheService {
  private cache: Map<string, DomainClassification> = new Map();
  private stats: ClassificationStats = {};
  private readonly CACHE_KEY = 'domainClassifications';
  private readonly STATS_KEY = 'domainStats';
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30天

  constructor() {
    this.loadCache();
  }

  /**
   * 加载缓存数据
   */
  private async loadCache() {
    try {
      const data = await chrome.storage.local.get([this.CACHE_KEY, this.STATS_KEY]);
      
      if (data[this.CACHE_KEY]) {
        const cacheData = data[this.CACHE_KEY] as Record<string, DomainClassification>;
        Object.entries(cacheData).forEach(([domain, classification]) => {
          // 检查缓存是否过期
          if (Date.now() - classification.timestamp < this.CACHE_DURATION) {
            this.cache.set(domain, classification);
          }
        });
      }
      
      if (data[this.STATS_KEY]) {
        this.stats = data[this.STATS_KEY];
      }
    } catch (error) {
      logger.error('加载分类缓存失败:', error);
    }
  }

  /**
   * 保存缓存到存储
   */
  private async saveCache() {
    try {
      const cacheData: Record<string, DomainClassification> = {};
      this.cache.forEach((value, key) => {
        cacheData[key] = value;
      });
      
      await chrome.storage.local.set({
        [this.CACHE_KEY]: cacheData,
        [this.STATS_KEY]: this.stats
      });
    } catch (error) {
      logger.error('保存分类缓存失败:', error);
    }
  }

  /**
   * 获取域名的缓存分类
   */
  getCachedClassification(url: string): DomainClassification | null {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const cached = this.cache.get(domain);
      
      if (cached) {
        // 更新统计
        this.updateStats(domain, cached.category);
        return cached;
      }
      
      return null;
    } catch (error) {
      logger.error('获取缓存分类失败:', error);
      return null;
    }
  }

  /**
   * 设置域名分类缓存
   */
  async setCachedClassification(
    url: string, 
    category: string, 
    confidence: number,
    source: DomainClassification['source']
  ): Promise<void> {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      const classification: DomainClassification = {
        domain,
        category,
        confidence,
        timestamp: Date.now(),
        source
      };
      
      this.cache.set(domain, classification);
      this.updateStats(domain, category);
      
      // 异步保存，不阻塞主流程
      setTimeout(() => this.saveCache(), 100);
    } catch (error) {
      logger.error('设置缓存分类失败:', error);
    }
  }

  /**
   * 更新域名统计信息
   */
  private updateStats(domain: string, category: string) {
    if (!this.stats[domain]) {
      this.stats[domain] = {
        category,
        count: 0,
        lastUsed: Date.now()
      };
    }
    
    this.stats[domain].count++;
    this.stats[domain].lastUsed = Date.now();
    this.stats[domain].category = category;
  }

  /**
   * 获取分类统计信息
   */
  getStats(): ClassificationStats {
    return { ...this.stats };
  }

  /**
   * 获取热门域名（按使用次数排序）
   */
  getPopularDomains(limit: number = 10): Array<{domain: string, category: string, count: number}> {
    return Object.entries(this.stats)
      .map(([domain, stats]) => ({
        domain,
        category: stats.category,
        count: stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * 清除过期缓存
   */
  async cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    this.cache.forEach((classification, domain) => {
      if (now - classification.timestamp > this.CACHE_DURATION) {
        this.cache.delete(domain);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      logger.debug(`清理了 ${cleaned} 个过期的域名分类缓存`);
      await this.saveCache();
    }
  }

  /**
   * 清除特定域名的缓存
   */
  clearDomainCache(url: string): void {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      this.cache.delete(domain);
      logger.debug(`已清除域名 ${domain} 的分类缓存`);
      // 异步保存
      setTimeout(() => this.saveCache(), 100);
    } catch (error) {
      logger.error('清除域名缓存失败:', error);
    }
  }

  /**
   * 导出缓存数据（用于调试或备份）
   */
  exportCache(): Record<string, any> {
    const cacheData: Record<string, DomainClassification> = {};
    this.cache.forEach((value, key) => {
      cacheData[key] = value;
    });
    
    return {
      cache: cacheData,
      stats: this.stats,
      exportTime: new Date().toISOString()
    };
  }
}

// 导出单例实例
export const classificationCache = new ClassificationCacheService();