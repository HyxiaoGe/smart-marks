import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

interface PreviewResult {
  bookmark: {
    id: string;
    title: string;
    url: string;
  };
  suggestion: {
    category: string;
    confidence: number;
    reasoning?: string;
  };
}

function PreviewPage() {
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // 从storage中获取预览结果
    chrome.storage.local.get(['previewResults'], (data) => {
      if (data.previewResults) {
        setResults(data.previewResults);
      }
      setLoading(false);
    });
  }, []);

  const handleApply = async (result: PreviewResult) => {
    setProcessingId(result.bookmark.id);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'moveBookmark',
        bookmarkId: result.bookmark.id,
        category: result.suggestion.category
      });

      if (response.success) {
        // 从列表中移除已处理的书签
        setResults(results.filter(r => r.bookmark.id !== result.bookmark.id));
        // 更新storage
        chrome.storage.local.set({ 
          previewResults: results.filter(r => r.bookmark.id !== result.bookmark.id) 
        });
      } else {
        alert(`移动失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('应用建议失败:', error);
      alert('操作失败，请重试');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApplyAll = async () => {
    if (!confirm(`确定要应用所有 ${results.length} 个建议吗？`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    
    for (const result of results) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'moveBookmark',
          bookmarkId: result.bookmark.id,
          category: result.suggestion.category
        });

        if (response.success) {
          successCount++;
        }
      } catch (error) {
        console.error('移动书签失败:', error);
      }
    }

    alert(`操作完成！成功移动 ${successCount} 个书签`);
    // 清空结果
    setResults([]);
    chrome.storage.local.remove(['previewResults']);
    setLoading(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#4CAF50';
    if (confidence >= 0.6) return '#FF9800';
    return '#F44336';
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>
        🔖 智能分类预览
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>加载中...</p>
        </div>
      ) : results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>没有待分类的书签</p>
          <button 
            onClick={() => window.close()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
        </div>
      ) : (
        <>
          <div style={{ 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#666' }}>
              共 {results.length} 个书签待分类
            </p>
            <button
              onClick={handleApplyAll}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              应用所有建议
            </button>
            <button
              onClick={() => window.close()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>

          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {results.map((result) => (
              <div key={result.bookmark.id} style={{
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>
                      {result.bookmark.title}
                    </h3>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
                      {result.bookmark.url}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        backgroundColor: '#E3F2FD',
                        color: '#2196F3',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        📁 {result.suggestion.category}
                      </span>
                      <span style={{
                        color: getConfidenceColor(result.suggestion.confidence),
                        fontSize: '12px'
                      }}>
                        置信度: {(result.suggestion.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {result.suggestion.reasoning && (
                      <p style={{ 
                        margin: '10px 0 0 0', 
                        fontSize: '12px', 
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        {result.suggestion.reasoning}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleApply(result)}
                    disabled={processingId === result.bookmark.id}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: processingId === result.bookmark.id ? '#ccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: processingId === result.bookmark.id ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {processingId === result.bookmark.id ? '处理中...' : '应用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 渲染React组件
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<PreviewPage />);
}