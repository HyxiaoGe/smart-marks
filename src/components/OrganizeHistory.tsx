import React, { useState, useEffect } from 'react';
import type { OrganizeRecord, OrganizeSession } from '../services/organize-history';

/**
 * 整理历史和进度组件
 */
export function OrganizeHistory() {
  const [currentSession, setCurrentSession] = useState<OrganizeSession | null>(null);
  const [recentRecords, setRecentRecords] = useState<OrganizeRecord[]>([]);
  const [unprocessedCount, setUnprocessedCount] = useState<number>(0);
  const [showUnprocessed, setShowUnprocessed] = useState(false);
  const [unprocessedBookmarks, setUnprocessedBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingRecord, setUndoingRecord] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // 监听整理历史更新
    const handleHistoryUpdate = (message: any) => {
      if (message.type === 'ORGANIZE_HISTORY_UPDATE') {
        setCurrentSession(message.session);
        loadData();
      }
    };
    
    chrome.runtime.onMessage.addListener(handleHistoryUpdate);
    
    // 定期刷新当前会话
    const interval = setInterval(() => {
      if (currentSession?.status === 'running') {
        loadData();
      }
    }, 2000);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleHistoryUpdate);
      clearInterval(interval);
    };
  }, [currentSession?.status]);

  const loadData = async () => {
    try {
      // 获取整理历史
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ORGANIZE_HISTORY',
        limit: 50
      });
      
      if (response.success) {
        setCurrentSession(response.currentSession);
        setRecentRecords(response.recentRecords);
      }
      
      // 获取未处理书签数量
      const unprocessedResponse = await chrome.runtime.sendMessage({
        type: 'GET_UNPROCESSED_BOOKMARKS',
        includeAllFolders: false
      });
      
      if (unprocessedResponse.success) {
        setUnprocessedCount(unprocessedResponse.bookmarks.length);
      }
    } catch (error) {
      console.error('加载整理历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnprocessedBookmarks = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_UNPROCESSED_BOOKMARKS',
        includeAllFolders: true
      });
      
      if (response.success) {
        setUnprocessedBookmarks(response.bookmarks);
      }
    } catch (error) {
      console.error('加载未处理书签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearProcessedRecords = async () => {
    if (!confirm('确定要清理所有已处理记录吗？这将允许重新整理所有书签。')) {
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_PROCESSED_BOOKMARKS'
      });
      
      if (response.success) {
        alert('已清理所有已处理记录');
        loadData();
      }
    } catch (error) {
      console.error('清理失败:', error);
      alert('清理失败');
    }
  };

  const undoRecord = async (recordId: string) => {
    setUndoingRecord(recordId);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UNDO_ORGANIZE',
        recordId
      });
      
      if (response.success) {
        alert('撤销成功');
        loadData();
      } else {
        alert('撤销失败');
      }
    } catch (error) {
      console.error('撤销失败:', error);
      alert('撤销失败');
    } finally {
      setUndoingRecord(null);
    }
  };

  const moveBookmark = async (bookmarkId: string, newCategory: string) => {
    try {
      await chrome.runtime.sendMessage({
        action: 'moveBookmark',
        bookmarkId,
        category: newCategory
      });
      
      alert(`已移动到"${newCategory}"文件夹`);
      loadData();
    } catch (error) {
      console.error('移动失败:', error);
      alert('移动失败');
    }
  };

  if (loading && !currentSession && recentRecords.length === 0) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h3 style={{ marginBottom: '15px' }}>📊 整理进度与历史</h3>
      
      {/* 当前整理会话 */}
      {currentSession && currentSession.status === 'running' && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '1px solid #90caf9',
          borderRadius: '4px',
          padding: '15px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>正在整理中...</h4>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '5px'
            }}>
              <span>进度</span>
              <span>{currentSession.processedBookmarks} / {currentSession.totalBookmarks}</span>
            </div>
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: '#e0e0e0',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(currentSession.processedBookmarks / currentSession.totalBookmarks * 100)}%`,
                height: '100%',
                backgroundColor: '#2196f3',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
          {currentSession.records.length > 0 && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              最新处理: {currentSession.records[currentSession.records.length - 1].bookmarkTitle}
            </div>
          )}
        </div>
      )}
      
      {/* 未处理书签统计 */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        padding: '10px',
        marginBottom: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <strong>未处理书签：</strong>{unprocessedCount} 个
          {unprocessedCount > 0 && (
            <button
              onClick={() => {
                setShowUnprocessed(!showUnprocessed);
                if (!showUnprocessed && unprocessedBookmarks.length === 0) {
                  loadUnprocessedBookmarks();
                }
              }}
              style={{
                marginLeft: '10px',
                padding: '2px 8px',
                fontSize: '12px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showUnprocessed ? '隐藏' : '查看'}
            </button>
          )}
        </div>
        <button
          onClick={clearProcessedRecords}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          清理已处理记录
        </button>
      </div>
      
      {/* 未处理书签列表 */}
      {showUnprocessed && unprocessedBookmarks.length > 0 && (
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>未处理的书签：</h4>
          {unprocessedBookmarks.map(bookmark => (
            <div key={bookmark.id} style={{
              padding: '5px',
              borderBottom: '1px solid #e0e0e0',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 'bold' }}>{bookmark.title}</div>
              <div style={{ color: '#666', fontSize: '11px' }}>{bookmark.url}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* 最近整理记录 */}
      {recentRecords.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '10px' }}>最近整理记录</h4>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>书签</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>分类到</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>置信度</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>时间</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map(record => (
                  <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 'bold' }}>{record.bookmarkTitle}</div>
                      <div style={{ 
                        color: '#666', 
                        fontSize: '11px',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {record.bookmarkUrl}
                      </div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {record.toFolder}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        color: record.confidence > 0.8 ? '#4caf50' : 
                               record.confidence > 0.6 ? '#ff9800' : '#f44336'
                      }}>
                        {(record.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            moveBookmark(record.bookmarkId, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '11px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="">移动到...</option>
                        <option value="开发工具">开发工具</option>
                        <option value="AI工具">AI工具</option>
                        <option value="学习教育">学习教育</option>
                        <option value="视频娱乐">视频娱乐</option>
                        <option value="社交媒体">社交媒体</option>
                        <option value="新闻资讯">新闻资讯</option>
                        <option value="购物">购物</option>
                        <option value="效率工具">效率工具</option>
                        <option value="待整理">待整理</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}