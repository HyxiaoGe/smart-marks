import React, { useState, useEffect } from 'react';

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

/**
 * 预览页面 - 显示AI分类建议
 */
function PreviewPage() {
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPreviewResults();
  }, []);

  // 加载预览结果
  const loadPreviewResults = async () => {
    try {
      const data = await chrome.storage.local.get('previewResults');
      if (data.previewResults) {
        setResults(data.previewResults);
        // 默认选中所有高置信度的建议
        const defaultSelected = new Set(
          data.previewResults
            .filter((r: PreviewResult) => r.suggestion.confidence > 0.7)
            .map((r: PreviewResult) => r.bookmark.id)
        );
        setSelectedItems(defaultSelected);
      }
    } catch (error) {
      console.error('加载预览结果失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换选中状态
  const toggleSelection = (bookmarkId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(bookmarkId)) {
      newSelected.delete(bookmarkId);
    } else {
      newSelected.add(bookmarkId);
    }
    setSelectedItems(newSelected);
  };

  // 应用选中的分类
  const applySelected = async () => {
    if (selectedItems.size === 0) {
      alert('请至少选择一个书签');
      return;
    }

    setLoading(true);
    try {
      const selectedResults = results.filter(r => selectedItems.has(r.bookmark.id));
      
      // 批量处理选中的书签
      for (const result of selectedResults) {
        await chrome.runtime.sendMessage({
          action: 'moveBookmark',
          bookmarkId: result.bookmark.id,
          category: result.suggestion.category
        });
      }

      alert(`成功整理 ${selectedItems.size} 个书签`);
      window.close();
    } catch (error) {
      console.error('应用分类失败:', error);
      alert('应用分类失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>正在加载预览结果...</p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>
        👁️ AI分类预览
      </h2>

      <div style={{
        backgroundColor: '#e8f5e9',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <p style={{ margin: '0' }}>
          以下是AI对书签的分类建议。请检查并选择要应用的分类。
        </p>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px'
      }}>
        {results.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>
            没有需要整理的书签
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedItems.size === results.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(new Set(results.map(r => r.bookmark.id)));
                      } else {
                        setSelectedItems(new Set());
                      }
                    }}
                  />
                </th>
                <th style={{ padding: '10px', textAlign: 'left' }}>书签</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>建议分类</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>置信度</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>理由</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr 
                  key={result.bookmark.id}
                  style={{ 
                    borderBottom: '1px solid #eee',
                    backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                  }}
                >
                  <td style={{ padding: '10px' }}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(result.bookmark.id)}
                      onChange={() => toggleSelection(result.bookmark.id)}
                    />
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {result.bookmark.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {result.bookmark.url}
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      backgroundColor: '#e3f2fd',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}>
                      {result.suggestion.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      color: result.suggestion.confidence > 0.7 ? '#4CAF50' : '#FF9800',
                      fontWeight: 'bold'
                    }}>
                      {(result.suggestion.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
                    {result.suggestion.reasoning || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{
        marginTop: '20px',
        display: 'flex',
        gap: '10px',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          已选择 {selectedItems.size} / {results.length} 个书签
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => window.close()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={applySelected}
            disabled={selectedItems.size === 0 || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedItems.size === 0 || loading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: selectedItems.size === 0 || loading ? 'not-allowed' : 'pointer'
            }}
          >
            应用选中的分类
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreviewPage;