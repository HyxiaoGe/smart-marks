/**
 * 分类缓存服务 - 管理书签分类的缓存
 *
 * 重要变更 (v2.0):
 * - 缓存粒度从域名级改为URL级，确保每个书签都有独立的分类
 * - 添加永久锁定机制，用户手动分类或高置信度AI分类将被永久保留
 * - 支持用户偏好学习的基础设施
 */

import { logger } from '~/utils/logger';

/**
 * 书签分类记录
 */
interface BookmarkClassification {
  url: string;                    // 完整URL
  urlHash: string;                // URL的哈希值（用于快速查找）
  category: string;               // 分类名称
  confidence: number;             // 置信度 [0, 1]
  timestamp: number;              // 首次分类时间
  lastUsed: number;               // 最后使用时间
  source: 'dictionary' | 'ai' | 'linkpreview' | 'manual';  // 分类来源
  locked: boolean;                // 是否永久锁定（用户手动或高置信度AI）
  version: number;                // 分类版本号（用于未来升级）
}

/**
 * 域名统计信息（用于分析和优化）
 */
interface DomainStats {
  domain: string;
  totalBookmarks: number;         // 该域名下的书签总数
  categories: Record<string, number>;  // 各分类的数量
  lastUpdated: number;
}

class ClassificationCacheService {
  private cache: Map<string, BookmarkClassification> = new Map();
  private domainStats: Map<string, DomainStats> = new Map();

  private readonly CACHE_KEY = 'bookmarkClassifications_v2';  // v2 标记新版本
  private readonly STATS_KEY = 'domainStats_v2';
  private readonly CACHE_DURATION = 365 * 24 * 60 * 60 * 1000; // 365天（非锁定记录）

  // 统计信息
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.loadCache();
  }

  /**
   * 生成URL哈希（简单但足够的实现）
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'h' + Math.abs(hash).toString(36);
  }

  /**
   * 提取域名（用于统计）
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * 加载缓存数据
   */
  private async loadCache() {
    try {
      const data = await chrome.storage.local.get([this.CACHE_KEY, this.STATS_KEY]);

      if (data[this.CACHE_KEY]) {
        const cacheArray = data[this.CACHE_KEY] as BookmarkClassification[];
        const now = Date.now();

        cacheArray.forEach(classification => {
          // 永久锁定的记录永不过期
          if (classification.locked) {
            this.cache.set(classification.urlHash, classification);
          }
          // 非锁定记录检查过期时间
          else if (now - classification.timestamp < this.CACHE_DURATION) {
            this.cache.set(classification.urlHash, classification);
          }
        });

        logger.info(`加载了 ${this.cache.size} 条分类缓存记录`);
      }

      if (data[this.STATS_KEY]) {
        const statsArray = data[this.STATS_KEY] as DomainStats[];
        statsArray.forEach(stat => {
          this.domainStats.set(stat.domain, stat);
        });
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
      const cacheArray = Array.from(this.cache.values());
      const statsArray = Array.from(this.domainStats.values());

      await chrome.storage.local.set({
        [this.CACHE_KEY]: cacheArray,
        [this.STATS_KEY]: statsArray
      });

      logger.debug(`保存了 ${cacheArray.length} 条分类记录，${statsArray.length} 个域名统计`);
    } catch (error) {
      logger.error('保存分类缓存失败:', error);
    }
  }

  /**
   * 获取URL的缓存分类
   * @param url 完整URL
   * @returns 分类信息，如果没有缓存则返回null
   */
  getCachedClassification(url: string): BookmarkClassification | null {
    try {
      const urlHash = this.hashUrl(url);
      const cached = this.cache.get(urlHash);

      if (cached) {
        // 更新最后使用时间
        cached.lastUsed = Date.now();
        this.cacheHits++;

        logger.debug(`缓存命中: ${url} → ${cached.category} (locked: ${cached.locked})`);
        return cached;
      }

      this.cacheMisses++;
      return null;
    } catch (error) {
      logger.error('获取缓存分类失败:', error);
      return null;
    }
  }

  /**
   * 设置书签分类缓存
   * @param url 完整URL
   * @param category 分类名称
   * @param confidence 置信度
   * @param source 分类来源
   * @param locked 是否永久锁定（可选，默认根据source和confidence判断）
   */
  async setCachedClassification(
    url: string,
    category: string,
    confidence: number,
    source: BookmarkClassification['source'],
    locked?: boolean
  ): Promise<void> {
    try {
      const urlHash = this.hashUrl(url);
      const now = Date.now();

      // 检查是否已存在且被锁定
      const existing = this.cache.get(urlHash);
      if (existing?.locked && source !== 'manual') {
        logger.warn(`URL已被锁定，跳过更新: ${url} (当前分类: ${existing.category})`);
        return;
      }

      // 自动判断是否应该锁定
      const shouldLock = locked !== undefined ? locked : (
        source === 'manual' ||  // 用户手动分类 → 永久锁定
        (source === 'ai' && confidence >= 0.8)  // 高置信度AI分类 → 锁定
      );

      const classification: BookmarkClassification = {
        url,
        urlHash,
        category,
        confidence,
        timestamp: existing?.timestamp || now,  // 保留首次分类时间
        lastUsed: now,
        source,
        locked: shouldLock,
        version: 2  // 当前版本号
      };

      this.cache.set(urlHash, classification);

      // 更新域名统计
      this.updateDomainStats(url, category);

      // 异步保存（延迟100ms，避免频繁写入）
      setTimeout(() => this.saveCache(), 100);

      logger.debug(`设置分类: ${url} → ${category} (confidence: ${confidence}, locked: ${shouldLock}, source: ${source})`);
    } catch (error) {
      logger.error('设置缓存分类失败:', error);
    }
  }

  /**
   * 更新域名统计信息
   */
  private updateDomainStats(url: string, category: string) {
    const domain = this.extractDomain(url);
    const stats = this.domainStats.get(domain) || {
      domain,
      totalBookmarks: 0,
      categories: {},
      lastUpdated: Date.now()
    };

    stats.totalBookmarks++;
    stats.categories[category] = (stats.categories[category] || 0) + 1;
    stats.lastUpdated = Date.now();

    this.domainStats.set(domain, stats);
  }

  /**
   * 锁定特定URL的分类（用户确认）
   */
  async lockClassification(url: string): Promise<boolean> {
    try {
      const urlHash = this.hashUrl(url);
      const classification = this.cache.get(urlHash);

      if (!classification) {
        logger.warn(`无法锁定：URL未找到缓存 ${url}`);
        return false;
      }

      classification.locked = true;
      classification.source = 'manual';  // 标记为用户确认
      classification.confidence = 1.0;   // 用户确认 = 100%置信度

      await this.saveCache();
      logger.info(`已锁定分类: ${url} → ${classification.category}`);

      return true;
    } catch (error) {
      logger.error('锁定分类失败:', error);
      return false;
    }
  }

  /**
   * 解锁特定URL的分类（允许重新分类）
   */
  async unlockClassification(url: string): Promise<boolean> {
    try {
      const urlHash = this.hashUrl(url);
      const classification = this.cache.get(urlHash);

      if (!classification) {
        return false;
      }

      classification.locked = false;
      await this.saveCache();

      logger.info(`已解锁分类: ${url}`);
      return true;
    } catch (error) {
      logger.error('解锁分类失败:', error);
      return false;
    }
  }

  /**
   * 清除特定URL的缓存
   */
  async clearUrlCache(url: string): Promise<void> {
    try {
      const urlHash = this.hashUrl(url);
      const classification = this.cache.get(urlHash);

      if (classification?.locked) {
        logger.warn(`URL已锁定，无法清除: ${url}`);
        return;
      }

      this.cache.delete(urlHash);
      logger.debug(`已清除URL缓存: ${url}`);

      setTimeout(() => this.saveCache(), 100);
    } catch (error) {
      logger.error('清除URL缓存失败:', error);
    }
  }

  /**
   * 清除特定域名下所有未锁定的缓存
   */
  async clearDomainCache(url: string): Promise<void> {
    try {
      const domain = this.extractDomain(url);
      let clearedCount = 0;

      for (const [hash, classification] of this.cache.entries()) {
        if (!classification.locked && this.extractDomain(classification.url) === domain) {
          this.cache.delete(hash);
          clearedCount++;
        }
      }

      if (clearedCount > 0) {
        logger.info(`已清除域名 ${domain} 的 ${clearedCount} 条未锁定缓存`);
        await this.saveCache();
      }
    } catch (error) {
      logger.error('清除域名缓存失败:', error);
    }
  }

  /**
   * 清理过期缓存（仅清理未锁定的记录）
   */
  async cleanupCache(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    for (const [hash, classification] of this.cache.entries()) {
      // 跳过锁定的记录
      if (classification.locked) {
        continue;
      }

      // 检查是否过期
      if (now - classification.timestamp > this.CACHE_DURATION) {
        this.cache.delete(hash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`清理了 ${cleaned} 个过期的分类缓存`);
      await this.saveCache();
    }
  }

  /**
   * 获取域名统计信息
   */
  getDomainStats(domain: string): DomainStats | null {
    return this.domainStats.get(domain) || null;
  }

  /**
   * 获取所有域名统计
   */
  getAllDomainStats(): DomainStats[] {
    return Array.from(this.domainStats.values())
      .sort((a, b) => b.totalBookmarks - a.totalBookmarks);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    const total = this.cache.size;
    const locked = Array.from(this.cache.values()).filter(c => c.locked).length;
    const hitRate = this.cacheHits + this.cacheMisses > 0
      ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2)
      : '0.00';

    return {
      total,
      locked,
      unlocked: total - locked,
      hitRate: `${hitRate}%`,
      hits: this.cacheHits,
      misses: this.cacheMisses
    };
  }

  /**
   * 导出缓存数据（用于调试或备份）
   */
  exportCache(): Record<string, any> {
    return {
      version: 2,
      classifications: Array.from(this.cache.values()),
      domainStats: Array.from(this.domainStats.values()),
      stats: this.getCacheStats(),
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 导入缓存数据（用于恢复）
   */
  async importCache(data: any): Promise<boolean> {
    try {
      if (data.version !== 2) {
        logger.warn('导入的数据版本不匹配');
        return false;
      }

      // 清空现有缓存
      this.cache.clear();
      this.domainStats.clear();

      // 导入分类记录
      if (Array.isArray(data.classifications)) {
        data.classifications.forEach((c: BookmarkClassification) => {
          this.cache.set(c.urlHash, c);
        });
      }

      // 导入统计数据
      if (Array.isArray(data.domainStats)) {
        data.domainStats.forEach((s: DomainStats) => {
          this.domainStats.set(s.domain, s);
        });
      }

      await this.saveCache();
      logger.info('成功导入缓存数据');

      return true;
    } catch (error) {
      logger.error('导入缓存失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const classificationCache = new ClassificationCacheService();
