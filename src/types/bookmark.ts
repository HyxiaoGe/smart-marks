/**
 * 书签相关的类型定义
 */

// 扩展Chrome原生BookmarkTreeNode类型
export interface ExtendedBookmarkTreeNode extends chrome.bookmarks.BookmarkTreeNode {
  // 自定义属性
  category?: string;        // AI分类结果
  confidence?: number;      // 分类置信度
  lastClassified?: number;  // 最后分类时间
  tags?: string[];         // 用户标签
}

// 书签分类结果
export interface BookmarkClassification {
  category: string;         // 分类名称
  confidence: number;       // 置信度 (0-1)
  reasoning?: string;       // 分类理由
  suggestedTags?: string[]; // 建议的标签
}

// 书签统计信息
export interface BookmarkStats {
  total: number;            // 总书签数
  categorized: number;      // 已分类数
  uncategorized: number;    // 未分类数
  folders: number;          // 文件夹数
  categoryDistribution: {   // 分类分布
    [category: string]: number;
  };
}

// AI分类设置
export interface ClassificationSettings {
  autoClassify: boolean;    // 是否自动分类
  aiModel: string;          // AI模型选择
  language: string;         // 语言设置
  confidenceThreshold: number; // 置信度阈值
  customCategories: string[]; // 自定义分类
}

// 批量操作结果
export interface BatchOperationResult {
  success: boolean;         // 操作是否成功
  processed: number;        // 处理的书签数
  errors: string[];         // 错误信息
  duration: number;         // 处理时间（毫秒）
}