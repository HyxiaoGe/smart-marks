import { logger } from '~/utils/logger';
/**
 * 通知工具 - 显示操作反馈
 */

// 存储最近的通知消息
let recentNotifications: Array<{
  title: string;
  message: string;
  type: string;
  timestamp: number;
}> = [];

// 初始化时加载已存储的通知
chrome.storage.local.get('recentNotifications').then(data => {
  if (data.recentNotifications) {
    recentNotifications = data.recentNotifications;
  }
});

// 监听存储变化，同步更新内存中的通知列表
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.recentNotifications) {
    recentNotifications = changes.recentNotifications.newValue || [];
    logger.debug('通知列表已同步更新:', recentNotifications.length, '条');
  }
});

/**
 * 显示徽章和存储通知（不打扰用户）
 */
export async function showNotification(
  title: string, 
  message: string, 
  type: 'success' | 'error' | 'info' = 'info'
) {
  // 记录到控制台
  logger.debug(`[${type.toUpperCase()}] ${title}: ${message}`);
  
  // 存储通知
  recentNotifications.push({
    title,
    message,
    type,
    timestamp: Date.now()
  });
  
  // 只保留最近20条
  if (recentNotifications.length > 20) {
    recentNotifications = recentNotifications.slice(-20);
  }
  
  // 保存到存储
  await chrome.storage.local.set({ 
    recentNotifications,
    hasUnreadNotifications: true 
  });
  
  // 更新徽章显示未读数量
  if (type === 'success') {
    // 成功时显示绿色徽章
    await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else if (type === 'error') {
    // 错误时显示红色徽章
    await chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  } else {
    // 信息时显示蓝色徽章
    await chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
  }
  
  // 显示未读数量
  const unreadCount = recentNotifications.filter(n => 
    Date.now() - n.timestamp < 24 * 60 * 60 * 1000 // 24小时内的消息
  ).length;
  
  await chrome.action.setBadgeText({ 
    text: unreadCount > 0 ? String(unreadCount) : '' 
  });
}

/**
 * 获取最近的通知
 */
export async function getRecentNotifications() {
  const data = await chrome.storage.local.get('recentNotifications');
  return data.recentNotifications || [];
}

/**
 * 清除通知徽章
 */
export async function clearNotificationBadge() {
  await chrome.action.setBadgeText({ text: '' });
  await chrome.storage.local.set({ hasUnreadNotifications: false });
}

/**
 * 清除所有通知消息
 */
export async function clearAllNotifications() {
  recentNotifications = [];
  await chrome.storage.local.set({ 
    recentNotifications: [],
    hasUnreadNotifications: false 
  });
  await chrome.action.setBadgeText({ text: '' });
}

/**
 * 显示书签整理进度
 */
export async function showProgressNotification(
  current: number,
  total: number,
  category?: string
) {
  const progress = Math.round((current / total) * 100);
  const message = category 
    ? `正在处理: ${category} (${current}/${total})`
    : `处理进度: ${current}/${total} (${progress}%)`;
    
  // 检查是否有通知权限
  if (!chrome.notifications) {
    logger.debug(`整理进度: ${message}`);
    return;
  }
    
  try {
    await chrome.notifications.create('progress', {
      type: 'progress',
      iconUrl: chrome.runtime.getURL('icon48.plasmo.b88acab9.png'),
      title: '智能整理进行中',
      message: message,
      progress: progress,
      priority: 1
    });
  } catch (error) {
    logger.debug(`整理进度: ${message}`);
  }
}

/**
 * 清除进度通知
 */
export async function clearProgressNotification() {
  // 检查是否有通知权限
  if (!chrome.notifications) {
    return;
  }
  
  try {
    await chrome.notifications.clear('progress');
  } catch (error) {
    logger.error('清除通知失败:', error);
  }
}