/**
 * 整理历史记录服务
 * 记录每次整理的书签移动历史，支持撤销操作
 */

export interface OrganizeRecord {
  id: string;
  bookmarkId: string;
  bookmarkTitle: string;
  bookmarkUrl: string;
  fromFolder?: string;
  toFolder: string;
  timestamp: number;
  confidence: number;
  reasoning?: string;
  status: 'completed' | 'pending' | 'error';
}

export interface OrganizeSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalBookmarks: number;
  processedBookmarks: number;
  status: 'running' | 'completed' | 'cancelled' | 'error' | 'paused';
  records: OrganizeRecord[];
  pausedAt?: number;
  remainingBookmarkIds?: string[];
}

class OrganizeHistoryService {
  private currentSession: OrganizeSession | null = null;
  private readonly HISTORY_KEY = 'organizeHistory';
  private readonly SESSION_KEY = 'currentOrganizeSession';
  private readonly MAX_HISTORY_DAYS = 30;

  /**
   * 开始新的整理会话
   */
  async startSession(totalBookmarks: number): Promise<string> {
    const sessionId = `session_${Date.now()}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      totalBookmarks,
      processedBookmarks: 0,
      status: 'running',
      records: []
    };
    
    await this.saveCurrentSession();
    return sessionId;
  }

  /**
   * 添加整理记录
   */
  async addRecord(record: Omit<OrganizeRecord, 'id'>): Promise<void> {
    if (!this.currentSession) {
      console.error('没有活动的整理会话');
      return;
    }
    
    const fullRecord: OrganizeRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.currentSession.records.push(fullRecord);
    this.currentSession.processedBookmarks++;
    
    await this.saveCurrentSession();
    
    // 广播进度更新
    chrome.runtime.sendMessage({
      type: 'ORGANIZE_HISTORY_UPDATE',
      session: this.currentSession,
      latestRecord: fullRecord
    }).catch(() => {
      // 忽略错误
    });
  }

  /**
   * 暂停当前会话
   */
  async pauseSession(remainingBookmarkIds: string[]): Promise<void> {
    if (!this.currentSession) return;
    
    this.currentSession.status = 'paused';
    this.currentSession.pausedAt = Date.now();
    this.currentSession.remainingBookmarkIds = remainingBookmarkIds;
    
    await this.saveCurrentSession();
    
    // 广播暂停状态
    chrome.runtime.sendMessage({
      type: 'ORGANIZE_PAUSED',
      session: this.currentSession
    }).catch(() => {});
  }
  
  /**
   * 结束整理会话
   */
  async endSession(status: 'completed' | 'cancelled' | 'error' | 'paused' = 'completed'): Promise<void> {
    if (!this.currentSession) return;
    
    this.currentSession.endTime = Date.now();
    this.currentSession.status = status;
    
    // 保存到历史记录
    await this.saveToHistory(this.currentSession);
    
    // 清除当前会话
    this.currentSession = null;
    await chrome.storage.local.remove(this.SESSION_KEY);
  }

  /**
   * 获取当前会话
   */
  async getCurrentSession(): Promise<OrganizeSession | null> {
    if (this.currentSession) {
      return this.currentSession;
    }
    
    // 尝试从存储中恢复
    const data = await chrome.storage.local.get(this.SESSION_KEY);
    if (data[this.SESSION_KEY]) {
      this.currentSession = data[this.SESSION_KEY];
      return this.currentSession;
    }
    
    return null;
  }

  /**
   * 保存当前会话
   */
  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession) return;
    
    await chrome.storage.local.set({
      [this.SESSION_KEY]: this.currentSession
    });
  }

  /**
   * 保存到历史记录
   */
  private async saveToHistory(session: OrganizeSession): Promise<void> {
    const data = await chrome.storage.local.get(this.HISTORY_KEY);
    const history: OrganizeSession[] = data[this.HISTORY_KEY] || [];
    
    // 添加新会话
    history.unshift(session);
    
    // 清理旧记录
    const cutoffTime = Date.now() - this.MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const cleanedHistory = history.filter(s => s.startTime > cutoffTime);
    
    // 限制总数
    const limitedHistory = cleanedHistory.slice(0, 100);
    
    await chrome.storage.local.set({
      [this.HISTORY_KEY]: limitedHistory
    });
  }

  /**
   * 获取历史记录
   */
  async getHistory(limit: number = 10): Promise<OrganizeSession[]> {
    const data = await chrome.storage.local.get(this.HISTORY_KEY);
    const history: OrganizeSession[] = data[this.HISTORY_KEY] || [];
    return history.slice(0, limit);
  }

  /**
   * 获取最近的整理记录
   */
  async getRecentRecords(limit: number = 50): Promise<OrganizeRecord[]> {
    const history = await this.getHistory(5);
    const allRecords: OrganizeRecord[] = [];
    
    // 包含当前会话
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      allRecords.push(...currentSession.records);
    }
    
    // 添加历史记录
    for (const session of history) {
      if (session.id !== currentSession?.id) {
        allRecords.push(...session.records);
      }
    }
    
    return allRecords
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 撤销整理操作
   */
  async undoRecord(recordId: string): Promise<boolean> {
    try {
      // 查找记录
      const recentRecords = await this.getRecentRecords(100);
      const record = recentRecords.find(r => r.id === recordId);
      
      if (!record) {
        console.error('找不到整理记录');
        return false;
      }
      
      // 将书签移回原位置
      if (record.fromFolder) {
        // TODO: 需要实现查找原文件夹的逻辑
        console.log('撤销操作：将书签移回原文件夹', record.fromFolder);
      } else {
        // 移到书签栏根目录
        await chrome.bookmarks.move(record.bookmarkId, {
          parentId: '1'
        });
      }
      
      // 从已处理列表中移除
      await this.removeFromProcessed(record.bookmarkId);
      
      return true;
    } catch (error) {
      console.error('撤销操作失败:', error);
      return false;
    }
  }

  /**
   * 从已处理列表中移除
   */
  private async removeFromProcessed(bookmarkId: string): Promise<void> {
    const data = await chrome.storage.local.get('processedBookmarks');
    const processed: string[] = data.processedBookmarks || [];
    const filtered = processed.filter(id => id !== bookmarkId);
    await chrome.storage.local.set({ processedBookmarks: filtered });
  }

  /**
   * 清理已处理记录
   */
  async clearProcessedBookmarks(): Promise<void> {
    await chrome.storage.local.remove('processedBookmarks');
    console.log('已清理所有已处理记录');
  }

  /**
   * 获取未处理的书签
   */
  async getUnprocessedBookmarks(includeAllFolders: boolean = false): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    const bookmarks = await chrome.bookmarks.getTree();
    const allBookmarks = this.flattenBookmarks(bookmarks);
    
    const data = await chrome.storage.local.get('processedBookmarks');
    const processed = new Set<string>(data.processedBookmarks || []);
    
    const unprocessed = [];
    for (const bookmark of allBookmarks) {
      if (!bookmark.url) continue;
      if (bookmark.id && processed.has(bookmark.id)) continue;
      
      if (!includeAllFolders) {
        // 只包含不在智能分类文件夹中的书签
        const inSmartFolder = await this.isInSmartFolder(bookmark);
        if (inSmartFolder) continue;
      }
      
      unprocessed.push(bookmark);
    }
    
    return unprocessed;
  }

  private flattenBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    const result: chrome.bookmarks.BookmarkTreeNode[] = [];
    
    function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
      for (const node of nodes) {
        if (node.url) {
          result.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    }
    
    traverse(nodes);
    return result;
  }

  private async isInSmartFolder(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<boolean> {
    try {
      if (!bookmark.parentId) return false;
      
      let currentId = bookmark.parentId;
      
      while (currentId) {
        const [parentNode] = await chrome.bookmarks.get(currentId);
        if (parentNode.title === '智能分类') {
          return true;
        }
        currentId = parentNode.parentId;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}

// 导出单例
export const organizeHistory = new OrganizeHistoryService();