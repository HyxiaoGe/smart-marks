/**
 * 内容脚本 - 用于从页面提取元数据
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

/**
 * 从页面获取描述信息
 */
function getPageDescription(): string {
  // 1. 尝试从meta标签获取description
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                         document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
  
  if (metaDescription) {
    return metaDescription.trim();
  }

  // 2. 尝试从第一个段落获取
  const firstParagraph = document.querySelector('article p, main p, .content p, p')?.textContent;
  if (firstParagraph && firstParagraph.length > 50) {
    return firstParagraph.substring(0, 200).trim() + '...';
  }

  // 3. 尝试从h1或h2获取
  const heading = document.querySelector('h1, h2')?.textContent;
  if (heading) {
    return heading.trim();
  }

  return '';
}

/**
 * 获取页面元数据
 */
function getPageMetadata() {
  return {
    title: document.title || '',
    description: getPageDescription(),
    url: window.location.href,
    favicon: getFavicon(),
    keywords: getKeywords()
  };
}

/**
 * 获取网站图标
 */
function getFavicon(): string {
  // 尝试多种方式获取favicon
  const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                 document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
                 document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
  
  if (favicon) {
    // 处理相对路径
    if (favicon.startsWith('//')) {
      return window.location.protocol + favicon;
    } else if (favicon.startsWith('/')) {
      return window.location.origin + favicon;
    } else if (!favicon.startsWith('http')) {
      return window.location.origin + '/' + favicon;
    }
    return favicon;
  }
  
  // 默认favicon路径
  return window.location.origin + '/favicon.ico';
}

/**
 * 获取页面关键词
 */
function getKeywords(): string[] {
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
  if (metaKeywords) {
    return metaKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  
  // 从标题和h1-h3标签提取关键词
  const keywords = new Set<string>();
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach(h => {
    const text = h.textContent?.trim();
    if (text && text.length < 50) {
      keywords.add(text);
    }
  });
  
  return Array.from(keywords).slice(0, 5);
}

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_PAGE_METADATA') {
    const metadata = getPageMetadata();
    sendResponse(metadata);
  }
  return true;
});

// 页面加载完成后，主动发送页面元数据（用于新书签创建时）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sendMetadata);
} else {
  sendMetadata();
}

function sendMetadata() {
  // 延迟发送，确保页面完全加载
  setTimeout(() => {
    const metadata = getPageMetadata();
    chrome.runtime.sendMessage({
      type: 'PAGE_METADATA',
      data: metadata
    }).catch(err => {
      // 忽略错误，可能扩展尚未准备好
      console.log('发送元数据失败，扩展可能未准备好');
    });
  }, 1000);
}