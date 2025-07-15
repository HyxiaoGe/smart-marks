import React, { useState, useEffect } from 'react';

/**
 * 主要的弹出窗口组件
 * 提供快速的书签管理功能
 */
function IndexPopup() {
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

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
  const handleSmartOrganize = async (mode: string = 'normal') => {
    setLoading(true);
    try {
      // 检查是否配置了API
      const settings = await chrome.storage.sync.get(['apiSettings']);
      const apiKey = settings.apiSettings?.provider === 'openai' 
        ? settings.apiSettings?.openaiKey 
        : settings.apiSettings?.geminiKey;
        
      if (!apiKey) {
        if (confirm('还未配置AI服务，是否前往设置页面？')) {
          chrome.runtime.openOptionsPage();
        }
        return;
      }
      
      // 根据模式执行不同操作
      if (mode === 'preview') {
        // 预览模式
        const response = await chrome.runtime.sendMessage({ 
          action: 'previewOrganize' 
        });
        
        if (response.success) {
          // 显示预览结果 - 保存到storage供新标签页读取
          await chrome.storage.local.set({ 
            previewMode: true,
            previewResults: response.results 
          });
          
          // 打开新标签页显示预览
          chrome.tabs.create({
            url: chrome.runtime.getURL('tabs/preview.html')
          });
        } else {
          alert(`预览失败: ${response.error || '未知错误'}`);
        }
      } else if (mode === 'single') {
        // 单文件夹模式 - 打开新标签页
        chrome.tabs.create({
          url: chrome.runtime.getURL('tabs/folder-selector.html')
        });
      } else {
        // 正常批量整理
        const confirmMsg = '智能整理将移动未分类的书签到"智能分类"文件夹。\n\n' +
                          '• 已处理过的书签不会重复处理\n' +
                          '• 隐私文件夹中的书签不会被处理\n' +
                          '• 建议先使用"预览模式"查看效果\n\n' +
                          '确定要继续吗？';
        
        if (!confirm(confirmMsg)) {
          return;
        }
        
        const response = await chrome.runtime.sendMessage({ 
          action: 'batchOrganize' 
        });
        
        if (response.success) {
          alert(`智能整理完成！\n已处理 ${response.processed} 个书签`);
        } else {
          alert(`整理失败: ${response.error || '未知错误'}`);
        }
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
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSmartOrganize}
            disabled={loading}
            style={{
              flex: 1,
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
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            style={{
              padding: '10px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ⚙️
          </button>
        </div>
        
        {showAdvancedOptions && (
          <div style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#f0f0f0',
            borderRadius: '5px',
            fontSize: '12px'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>高级选项</h4>
            <button
              onClick={() => handleSmartOrganize('preview')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '6px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              👁️ 预览模式（仅显示建议）
            </button>
            <button
              onClick={() => handleSmartOrganize('single')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              📁 整理单个文件夹
            </button>
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