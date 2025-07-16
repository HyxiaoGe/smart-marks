/**
 * 通知工具 - 显示操作反馈
 */

/**
 * 显示Chrome通知
 */
export async function showNotification(
  title: string, 
  message: string, 
  type: 'success' | 'error' | 'info' = 'info'
) {
  // 检查是否有通知权限
  if (!chrome.notifications) {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    return;
  }
  
  // 使用扩展的默认图标（Plasmo 生成的图标文件名）
  const iconUrl = chrome.runtime.getURL('icon128.plasmo.ef13585c.png');
  
  try {
    // 创建通知
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: title,
      message: message,
      priority: 2
    });
  } catch (error) {
    console.error('显示通知失败:', error);
    // 降级到console日志
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  }
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
    console.log(`整理进度: ${message}`);
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
    console.log(`整理进度: ${message}`);
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
    console.error('清除通知失败:', error);
  }
}