import React, { useState, useEffect } from 'react';
import { getRecentNotifications, clearNotificationBadge, clearAllNotifications } from './utils/notification';

/**
 * 主要的弹出窗口组件
 * 提供快速的书签管理功能
 */
function IndexPopup() {
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [organizingProgress, setOrganizingProgress] = useState<{
    current: number;
    total: number;
    currentBookmark: string;
    status: 'idle' | 'processing' | 'completed' | 'error' | 'paused';
  }>({
    current: 0,
    total: 0,
    currentBookmark: '',
    status: 'idle'
  });

  // 获取书签数量
  useEffect(() => {
    const fetchBookmarkCount = async () => {
      try {
        const bookmarks = await chrome.bookmarks.getTree();
        // 简单统计书签数量（递归计算）
        const countBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[]): number => {
          return nodes.reduce((count, node) => {
            if (node.url) {
              return count + 1;
            }
            if (node.children) {
              return count + countBookmarks(node.children);
            }
            return count;
          }, 0);
        };
        
        setBookmarkCount(countBookmarks(bookmarks));
      } catch (error) {
        console.error('获取书签失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarkCount();
    
    // 同时加载通知
    getRecentNotifications().then(setNotifications);
    
    // 检查是否有未读通知
    chrome.storage.local.get('hasUnreadNotifications').then(data => {
      if (data.hasUnreadNotifications) {
        setShowNotifications(true);
      }
    });
  }, []);

  // 监听进度更新
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'ORGANIZE_PROGRESS') {
        setOrganizingProgress({
          current: message.current,
          total: message.total,
          currentBookmark: message.bookmarkTitle || '',
          status: 'processing'
        });
      } else if (message.type === 'ORGANIZE_COMPLETE') {
        setOrganizingProgress(prev => ({
          ...prev,
          status: 'completed'
        }));
        // 3秒后重置状态
        setTimeout(() => {
          setOrganizingProgress({
            current: 0,
            total: 0,
            currentBookmark: '',
            status: 'idle'
          });
        }, 3000);
      } else if (message.type === 'ORGANIZE_ERROR') {
        setOrganizingProgress(prev => ({
          ...prev,
          status: 'error'
        }));
      } else if (message.type === 'ORGANIZE_PAUSED') {
        setOrganizingProgress(prev => ({
          ...prev,
          current: message.current,
          total: message.total,
          status: 'paused'
        }));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // 处理暂停整理
  const handlePauseOrganize = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PAUSE_ORGANIZE' });
      if (response.success) {
        console.log('整理已暂停');
      }
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  // 处理智能整理按钮点击
  const handleSmartOrganize = async () => {
    setLoading(true);
    setOrganizingProgress({
      current: 0,
      total: 0,
      currentBookmark: '',
      status: 'processing'
    });
    
    try {
      // 检查是否配置了API
      const settings = await chrome.storage.sync.get(['apiSettings']);
      const apiKey = settings.apiSettings?.provider === 'openai' 
        ? settings.apiSettings?.openaiKey 
        : settings.apiSettings?.geminiKey;
        
      if (!apiKey) {
        setLoading(false);
        setOrganizingProgress({
          current: 0,
          total: 0,
          currentBookmark: '',
          status: 'idle'
        });
        
        if (confirm('还未配置AI服务，是否前往设置页面？')) {
          chrome.runtime.openOptionsPage();
        }
        return;
      }
      
      // 执行批量整理
      const confirmMsg = '智能整理将移动未分类的书签到"智能分类"文件夹。\n\n' +
                        '• 已处理过的书签不会重复处理\n' +
                        '• 隐私文件夹中的书签不会被处理\n' +
                        '• 默认只处理不在智能分类文件夹中的书签\n\n' +
                        '确定要继续吗？\n\n' +
                        '提示：可以在设置页面查看整理进度和历史记录。';
      
      if (!confirm(confirmMsg)) {
        setLoading(false);
        setOrganizingProgress({
          current: 0,
          total: 0,
          currentBookmark: '',
          status: 'idle'
        });
        return;
      }
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'batchOrganize' 
      });
      
      if (response.success) {
        // 成功消息已经通过进度状态显示
        // 设置标记，让设置页面知道要滚动到整理历史
        await chrome.storage.local.set({ justStartedOrganizing: true });
        
        // 显示跳转提示
        setOrganizingProgress(prev => ({
          ...prev,
          currentBookmark: '正在跳转到设置页面查看进度...'
        }));
        
        // 自动跳转到设置页面查看进度
        setTimeout(() => {
          chrome.runtime.openOptionsPage();
          // 关闭popup窗口
          window.close();
        }, 1000);
      } else {
        alert(`整理失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('智能整理失败:', error);
      alert('整理失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      width: '350px', 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ 
        marginBottom: '20px',
        color: '#333'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h2 style={{ margin: '0', fontSize: '18px' }}>
            🔖 智能书签管理器
          </h2>
          
          {/* 通知按钮 */}
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                clearNotificationBadge();
              }
            }}
            style={{
              position: 'relative',
              padding: '4px 8px',
              backgroundColor: notifications.length > 0 ? '#2196F3' : '#f0f0f0',
              color: notifications.length > 0 ? 'white' : '#666',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            🔔 消息
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                backgroundColor: '#f44336',
                color: 'white',
                borderRadius: '10px',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: 'bold'
              }}>
                {notifications.length}
              </span>
            )}
          </button>
        </div>
        
        <p style={{ margin: '0', fontSize: '14px', color: '#666', textAlign: 'center' }}>
          让AI帮你整理书签
        </p>
      </div>
      
      {/* 通知列表 */}
      {showNotifications && notifications.length > 0 && (
        <div style={{
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: '#f9f9f9',
          borderRadius: '5px',
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px' }}>最近消息</h4>
            <button
              onClick={async () => {
                setNotifications([]);
                await clearAllNotifications();
              }}
              style={{
                padding: '2px 8px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              清空
            </button>
          </div>
          {notifications.slice().reverse().map((notification, index) => (
            <div key={index} style={{
              padding: '8px',
              marginBottom: '5px',
              backgroundColor: 'white',
              borderRadius: '4px',
              borderLeft: `3px solid ${
                notification.type === 'success' ? '#4CAF50' : 
                notification.type === 'error' ? '#f44336' : '#2196F3'
              }`
            }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>
                {notification.title}
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {notification.message}
              </div>
              <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                {new Date(notification.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ 
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '15px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <span style={{ fontSize: '14px', color: '#666' }}>当前书签数量:</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {loading ? '...' : bookmarkCount}
          </span>
        </div>
        
        <button
          onClick={handleSmartOrganize}
          disabled={loading || organizingProgress.status === 'processing'}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading || organizingProgress.status === 'processing' ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '14px',
            cursor: loading || organizingProgress.status === 'processing' ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          {loading || organizingProgress.status === 'processing' ? '处理中...' : '🤖 智能整理'}
        </button>
        
        {/* 进度显示 */}
        {organizingProgress.status !== 'idle' && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            {organizingProgress.status === 'processing' && (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '4px'
                  }}>
                    <span>整理进度</span>
                    <span>{organizingProgress.current} / {organizingProgress.total}</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${organizingProgress.total > 0 ? (organizingProgress.current / organizingProgress.total * 100) : 0}%`,
                      height: '100%',
                      backgroundColor: '#4CAF50',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                <div style={{ 
                  color: '#666',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  正在处理: {organizingProgress.currentBookmark}
                </div>
                <button
                  onClick={handlePauseOrganize}
                  style={{
                    marginTop: '8px',
                    padding: '4px 12px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ⏸️ 暂停整理
                </button>
              </>
            )}
            {organizingProgress.status === 'completed' && (
              <div style={{ color: '#4CAF50', textAlign: 'center' }}>
                ✓ 智能整理完成！已处理 {organizingProgress.total} 个书签
              </div>
            )}
            {organizingProgress.status === 'paused' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ff9800', marginBottom: '8px' }}>
                  ⏸️ 整理已暂停（已处理 {organizingProgress.current} / {organizingProgress.total}）
                </div>
                <button
                  onClick={handleSmartOrganize}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ▶️ 重新开始整理
                </button>
              </div>
            )}
            {organizingProgress.status === 'error' && (
              <div style={{ color: '#f44336', textAlign: 'center' }}>
                ✗ 整理失败，请查看控制台了解详情
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ 
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
          快速操作
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => {
              chrome.runtime.openOptionsPage();
              // 发送消息让设置页面显示文件夹管理
              setTimeout(() => {
                chrome.runtime.sendMessage({ 
                  type: 'SHOW_FOLDER_MANAGER' 
                }).catch(() => {});
              }, 500);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📁 管理文件夹
          </button>
          <button style={{
            padding: '8px 12px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
            🔍 搜索书签
          </button>
          <button 
            onClick={() => chrome.runtime.openOptionsPage()}
            style={{
              padding: '8px 12px',
              backgroundColor: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ⚙️ 设置
          </button>
        </div>
      </div>
    </div>
  );
}

export default IndexPopup;