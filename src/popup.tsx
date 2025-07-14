import React, { useState, useEffect } from 'react';

/**
 * 主要的弹出窗口组件
 * 提供快速的书签管理功能
 */
function IndexPopup() {
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

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
  }, []);

  // 处理智能整理按钮点击
  const handleSmartOrganize = async () => {
    setLoading(true);
    try {
      // TODO: 实现智能整理功能
      console.log('开始智能整理书签...');
      // 这里将来会调用AI服务进行书签分类
      alert('智能整理功能正在开发中...');
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
        textAlign: 'center', 
        marginBottom: '20px',
        color: '#333'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
          🔖 智能书签管理器
        </h2>
        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
          让AI帮你整理书签
        </p>
      </div>

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
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          {loading ? '处理中...' : '🤖 智能整理'}
        </button>
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
          <button style={{
            padding: '8px 12px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}>
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