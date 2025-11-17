/**
 * 书签工具函数
 */

import type { ExtendedBookmarkTreeNode, BookmarkStats } from '../types/bookmark';
import { logger } from '~/utils/logger';

/**
 * 获取书签统计信息
 * @param bookmarks 书签树
 * @returns 统计信息
 */
export function getBookmarkStats(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): BookmarkStats {
  const stats: BookmarkStats = {
    total: 0,
    categorized: 0,
    uncategorized: 0,
    folders: 0,
    categoryDistribution: {}
  };

  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (node.url) {
        stats.total++;
        // 检查是否在智能分类文件夹中
        if (isInSmartFolder(node)) {
          stats.categorized++;
        } else {
          stats.uncategorized++;
        }
      } else if (node.children) {
        stats.folders++;
        traverse(node.children);
      }
    }
  }

  traverse(bookmarks);
  return stats;
}

/**
 * 检查书签是否在智能分类文件夹中
 * @param bookmark 书签节点
 * @returns 是否在智能分类文件夹中
 */
export function isInSmartFolder(bookmark: chrome.bookmarks.BookmarkTreeNode): boolean {
  // TODO: 实现检查逻辑
  // 需要通过parentId向上查找，判断是否在"智能分类"文件夹下
  return false;
}

/**
 * 扁平化书签树
 * @param bookmarks 书签树
 * @returns 扁平化的书签数组
 */
export function flattenBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
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
  
  traverse(bookmarks);
  return result;
}

/**
 * 根据关键词搜索书签
 * @param bookmarks 书签数组
 * @param keyword 搜索关键词
 * @returns 匹配的书签数组
 */
export function searchBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[], keyword: string): chrome.bookmarks.BookmarkTreeNode[] {
  const lowerKeyword = keyword.toLowerCase();
  return bookmarks.filter(bookmark => 
    bookmark.title?.toLowerCase().includes(lowerKeyword) ||
    bookmark.url?.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * 获取书签的域名
 * @param url 书签URL
 * @returns 域名
 */
export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    logger.error('解析URL失败:', error);
    return '';
  }
}

/**
 * 格式化书签创建时间
 * @param dateAdded 创建时间戳
 * @returns 格式化的时间字符串
 */
export function formatBookmarkDate(dateAdded: number): string {
  const date = new Date(dateAdded);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 验证书签URL是否有效
 * @param url 书签URL
 * @returns 是否有效
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取书签的图标URL
 * @param url 书签URL
 * @returns 图标URL
 */
export function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}`;
  } catch (error) {
    logger.error('获取图标URL失败:', error);
    return '';
  }
}

/**
 * 清理书签标题（移除特殊字符）
 * @param title 原始标题
 * @returns 清理后的标题
 */
export function cleanBookmarkTitle(title: string): string {
  return title
    .replace(/[^\w\s\u4e00-\u9fff-]/g, '') // 保留字母、数字、空格和中文
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();
}

/**
 * 根据URL提取可能的分类关键词
 * @param url 书签URL
 * @returns 关键词数组
 */
export function extractKeywordsFromUrl(url: string): string[] {
  const keywords: string[] = [];
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // 从域名提取关键词
    if (domain.includes('github')) keywords.push('开发', '代码');
    if (domain.includes('stackoverflow')) keywords.push('开发', '问答');
    if (domain.includes('news') || domain.includes('新闻')) keywords.push('新闻');
    if (domain.includes('youtube') || domain.includes('bilibili')) keywords.push('视频', '娱乐');
    if (domain.includes('taobao') || domain.includes('amazon')) keywords.push('购物');
    if (domain.includes('blog') || domain.includes('博客')) keywords.push('博客', '文章');
    
    // 从路径提取关键词
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    for (const segment of pathSegments) {
      if (segment.includes('doc') || segment.includes('文档')) keywords.push('文档');
      if (segment.includes('tutorial') || segment.includes('教程')) keywords.push('教程');
      if (segment.includes('course') || segment.includes('课程')) keywords.push('课程');
    }
    
  } catch (error) {
    logger.error('提取关键词失败:', error);
  }
  
  return [...new Set(keywords)]; // 去重
}