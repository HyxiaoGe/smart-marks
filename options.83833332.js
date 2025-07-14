(function(define){var __define; typeof define === "function" && (__define=define,define=null);
import {jsx as $96OZm$jsx, jsxs as $96OZm$jsxs, Fragment as $96OZm$Fragment1} from "react/jsx-runtime";
import {Fragment as $96OZm$Fragment, useState as $96OZm$useState, useEffect as $96OZm$useEffect} from "react";
import {createRoot as $96OZm$createRoot} from "react-dom/client";

function $parcel$defineInteropFlag(a) {
  Object.defineProperty(a, '__esModule', {value: true, configurable: true});
}
function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}




const $0b3ccfbeb4084da1$export$15b332947189bc50 = (RawImport)=>typeof RawImport.Layout === "function" ? RawImport.Layout : typeof RawImport.getGlobalProvider === "function" ? RawImport.getGlobalProvider() : (0, $96OZm$Fragment);


var $bbc91b5d8b31594e$exports = {};

$parcel$defineInteropFlag($bbc91b5d8b31594e$exports);

$parcel$export($bbc91b5d8b31594e$exports, "default", () => $bbc91b5d8b31594e$export$2e2bcd8739ae039);


/**
 * \u6269\u5c55\u8bbe\u7f6e\u9875\u9762
 */ function $bbc91b5d8b31594e$var$OptionsPage() {
    const [filterSettings, setFilterSettings] = (0, $96OZm$useState)({
        excludeFolders: [],
        excludePatterns: [],
        autoFilter: true
    });
    const [bookmarkFolders, setBookmarkFolders] = (0, $96OZm$useState)([]);
    const [loading, setLoading] = (0, $96OZm$useState)(true);
    const [saving, setSaving] = (0, $96OZm$useState)(false);
    const [syncStatus, setSyncStatus] = (0, $96OZm$useState)("idle");
    const [lastSyncTime, setLastSyncTime] = (0, $96OZm$useState)(null);
    // \u52a0\u8f7d\u8bbe\u7f6e\u548c\u4e66\u7b7e\u6587\u4ef6\u5939
    (0, $96OZm$useEffect)(()=>{
        loadSettings();
        loadBookmarkFolders();
    }, []);
    // \u52a0\u8f7d\u4fdd\u5b58\u7684\u8bbe\u7f6e
    const loadSettings = async ()=>{
        try {
            const result = await chrome.storage.sync.get([
                "filterSettings"
            ]);
            if (result.filterSettings) setFilterSettings(result.filterSettings);
        } catch (error) {
            console.error("\u52a0\u8f7d\u8bbe\u7f6e\u5931\u8d25:", error);
        }
    };
    // \u52a0\u8f7d\u4e66\u7b7e\u6587\u4ef6\u5939\u7ed3\u6784
    const loadBookmarkFolders = async ()=>{
        try {
            const bookmarkTree = await chrome.bookmarks.getTree();
            const folders = extractFolders(bookmarkTree);
            setBookmarkFolders(folders);
        } catch (error) {
            console.error("\u52a0\u8f7d\u4e66\u7b7e\u6587\u4ef6\u5939\u5931\u8d25:", error);
        } finally{
            setLoading(false);
        }
    };
    // \u4ece\u4e66\u7b7e\u6811\u4e2d\u63d0\u53d6\u6587\u4ef6\u5939
    const extractFolders = (nodes, parentPath = "", level = 0)=>{
        const folders = [];
        for (const node of nodes)if (!node.url) {
            const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;
            const folder = {
                id: node.id,
                title: node.title,
                parentId: node.parentId,
                path: currentPath,
                level: level
            };
            folders.push(folder);
            // \u9012\u5f52\u5904\u7406\u5b50\u6587\u4ef6\u5939
            if (node.children) {
                const childFolders = extractFolders(node.children, currentPath, level + 1);
                folders.push(...childFolders);
            }
        }
        return folders;
    };
    // \u4fdd\u5b58\u8bbe\u7f6e
    const saveSettings = async ()=>{
        setSaving(true);
        setSyncStatus("syncing");
        try {
            await chrome.storage.sync.set({
                filterSettings: filterSettings
            });
            setSyncStatus("success");
            setLastSyncTime(new Date());
            // \u663e\u793a\u4fdd\u5b58\u6210\u529f\u63d0\u793a
            const saveButton = document.getElementById("saveButton");
            if (saveButton) {
                saveButton.textContent = "\u2713 \u5df2\u4fdd\u5b58";
                saveButton.style.backgroundColor = "#4CAF50";
                setTimeout(()=>{
                    saveButton.textContent = "\u4fdd\u5b58\u8bbe\u7f6e";
                    saveButton.style.backgroundColor = "#2196F3";
                }, 2000);
            }
        } catch (error) {
            console.error("\u4fdd\u5b58\u8bbe\u7f6e\u5931\u8d25:", error);
            setSyncStatus("error");
            alert("\u4fdd\u5b58\u8bbe\u7f6e\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
        } finally{
            setSaving(false);
        }
    };
    // \u5207\u6362\u6587\u4ef6\u5939\u6392\u9664\u72b6\u6001\uff08\u652f\u6301\u7ea7\u8054\u9009\u62e9\u548c\u81ea\u5b9a\u4e49\u89c4\u5219\u5904\u7406\uff09
    const toggleFolderExclusion = (folderPath)=>{
        setFilterSettings((prev)=>{
            const isInExcludeFolders = prev.excludeFolders.includes(folderPath);
            const isMatchedByPatterns = isMatchedByPattern(folderPath);
            let newExcludeFolders = [
                ...prev.excludeFolders
            ];
            if (isInExcludeFolders) // \u5982\u679c\u6587\u4ef6\u5939\u5728excludeFolders\u4e2d\uff0c\u79fb\u9664\u5b83\u548c\u6240\u6709\u5b50\u6587\u4ef6\u5939
            newExcludeFolders = newExcludeFolders.filter((path)=>path !== folderPath && !path.startsWith(folderPath + "/"));
            else {
                // \u5982\u679c\u6587\u4ef6\u5939\u4e0d\u5728excludeFolders\u4e2d\uff0c\u6dfb\u52a0\u5b83
                newExcludeFolders.push(folderPath);
                // \u81ea\u52a8\u6dfb\u52a0\u6240\u6709\u5b50\u6587\u4ef6\u5939\uff08\u9664\u975e\u5b83\u4eec\u5df2\u7ecf\u88ab\u81ea\u5b9a\u4e49\u89c4\u5219\u5339\u914d\uff09
                const childFolders = bookmarkFolders.filter((folder)=>folder.path.startsWith(folderPath + "/")).filter((folder)=>!isMatchedByPattern(folder.path)) // \u907f\u514d\u91cd\u590d\u6dfb\u52a0\u88ab\u89c4\u5219\u5339\u914d\u7684\u6587\u4ef6\u5939
                .map((folder)=>folder.path);
                newExcludeFolders = [
                    ...new Set([
                        ...newExcludeFolders,
                        ...childFolders
                    ])
                ];
            }
            return {
                ...prev,
                excludeFolders: newExcludeFolders
            };
        });
    };
    // \u6dfb\u52a0\u81ea\u5b9a\u4e49\u6392\u9664\u6a21\u5f0f
    const addExcludePattern = ()=>{
        const examples = [
            '*\u79c1\u4eba*     - \u5339\u914d\u5305\u542b"\u79c1\u4eba"\u7684\u6240\u6709\u6587\u4ef6\u5939',
            '*temp*     - \u5339\u914d\u5305\u542b"temp"\u7684\u6240\u6709\u6587\u4ef6\u5939',
            '\u5de5\u4f5c/*     - \u5339\u914d"\u5de5\u4f5c"\u6587\u4ef6\u5939\u4e0b\u7684\u6240\u6709\u5b50\u6587\u4ef6\u5939',
            'Private    - \u7cbe\u786e\u5339\u914d\u540d\u4e3a"Private"\u7684\u6587\u4ef6\u5939'
        ];
        const pattern = prompt(`\u8bf7\u8f93\u5165\u8981\u6392\u9664\u7684\u6587\u4ef6\u5939\u540d\u79f0\u6216\u6a21\u5f0f\uff08\u652f\u6301\u901a\u914d\u7b26*\uff09:

\u793a\u4f8b\uff1a
${examples.join("\n")}

\u8f93\u5165\u4f60\u7684\u89c4\u5219:`);
        if (pattern && pattern.trim()) {
            const trimmedPattern = pattern.trim();
            setFilterSettings((prev)=>({
                    ...prev,
                    excludePatterns: [
                        ...prev.excludePatterns,
                        trimmedPattern
                    ]
                }));
        }
    };
    // \u5220\u9664\u6392\u9664\u6a21\u5f0f
    const removeExcludePattern = (index)=>{
        setFilterSettings((prev)=>({
                ...prev,
                excludePatterns: prev.excludePatterns.filter((_, i)=>i !== index)
            }));
    };
    // \u68c0\u67e5\u6587\u4ef6\u5939\u8def\u5f84\u662f\u5426\u5339\u914d\u81ea\u5b9a\u4e49\u89c4\u5219
    const isMatchedByPattern = (folderPath)=>{
        return filterSettings.excludePatterns.some((pattern)=>{
            // \u5c06\u901a\u914d\u7b26\u6a21\u5f0f\u8f6c\u6362\u4e3a\u6b63\u5219\u8868\u8fbe\u5f0f
            const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\//g, "\\/");
            const regex = new RegExp(`^${regexPattern}$`, "i");
            return regex.test(folderPath);
        });
    };
    // \u68c0\u67e5\u6587\u4ef6\u5939\u662f\u5426\u88ab\u6392\u9664\uff08\u5305\u62ec\u76f4\u63a5\u52fe\u9009\u548c\u81ea\u5b9a\u4e49\u89c4\u5219\u5339\u914d\uff09
    const isFolderExcluded = (folderPath)=>{
        return filterSettings.excludeFolders.includes(folderPath) || isMatchedByPattern(folderPath);
    };
    // \u6dfb\u52a0\u5e38\u7528\u9690\u79c1\u6587\u4ef6\u5939
    const addCommonPrivacyFolders = ()=>{
        const commonFolders = [
            "\u9690\u79c1",
            "\u79c1\u4eba",
            "\u4e2a\u4eba",
            "\u5de5\u4f5c",
            "\u673a\u5bc6",
            "\u4e34\u65f6"
        ];
        setFilterSettings((prev)=>({
                ...prev,
                excludeFolders: [
                    ...new Set([
                        ...prev.excludeFolders,
                        ...commonFolders
                    ])
                ]
            }));
    };
    if (loading) return /*#__PURE__*/ (0, $96OZm$jsx)("div", {
        style: {
            padding: "20px",
            textAlign: "center"
        },
        children: /*#__PURE__*/ (0, $96OZm$jsx)("p", {
            children: "\u6b63\u5728\u52a0\u8f7d\u8bbe\u7f6e..."
        })
    });
    return /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
        style: {
            maxWidth: "800px",
            margin: "0 auto",
            padding: "20px",
            fontFamily: "Arial, sans-serif"
        },
        children: [
            /*#__PURE__*/ (0, $96OZm$jsx)("h1", {
                style: {
                    color: "#333",
                    marginBottom: "30px"
                },
                children: "\uD83D\uDD16 Smart Marks \u8bbe\u7f6e"
            }),
            /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                style: {
                    backgroundColor: "#f9f9f9",
                    padding: "20px",
                    borderRadius: "8px",
                    marginBottom: "20px"
                },
                children: [
                    /*#__PURE__*/ (0, $96OZm$jsx)("h2", {
                        style: {
                            color: "#333",
                            marginBottom: "15px"
                        },
                        children: "\uD83D\uDD12 \u9690\u79c1\u4fdd\u62a4\u8bbe\u7f6e"
                    }),
                    /*#__PURE__*/ (0, $96OZm$jsx)("div", {
                        style: {
                            marginBottom: "15px"
                        },
                        children: /*#__PURE__*/ (0, $96OZm$jsxs)("label", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            },
                            children: [
                                /*#__PURE__*/ (0, $96OZm$jsx)("input", {
                                    type: "checkbox",
                                    checked: filterSettings.autoFilter,
                                    onChange: (e)=>setFilterSettings((prev)=>({
                                                ...prev,
                                                autoFilter: e.target.checked
                                            }))
                                }),
                                /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                    children: "\u542f\u7528\u6587\u4ef6\u5939\u8fc7\u6ee4\uff08\u4fdd\u62a4\u9690\u79c1\u6587\u4ef6\u5939\u4e0d\u88abAI\u5904\u7406\uff09"
                                })
                            ]
                        })
                    }),
                    filterSettings.autoFilter && /*#__PURE__*/ (0, $96OZm$jsxs)((0, $96OZm$Fragment1), {
                        children: [
                            /*#__PURE__*/ (0, $96OZm$jsx)("h3", {
                                style: {
                                    color: "#555",
                                    marginBottom: "10px"
                                },
                                children: "\u9009\u62e9\u8981\u6392\u9664\u7684\u6587\u4ef6\u5939\uff1a"
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsx)("div", {
                                style: {
                                    maxHeight: "300px",
                                    overflowY: "auto",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    padding: "10px",
                                    backgroundColor: "white",
                                    marginBottom: "15px"
                                },
                                children: bookmarkFolders.map((folder)=>/*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                                        style: {
                                            marginLeft: `${folder.level * 20}px`,
                                            marginBottom: "5px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, $96OZm$jsx)("input", {
                                                type: "checkbox",
                                                checked: isFolderExcluded(folder.path),
                                                onChange: ()=>toggleFolderExclusion(folder.path)
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsxs)("span", {
                                                style: {
                                                    fontSize: "14px",
                                                    color: isFolderExcluded(folder.path) ? "#f44336" : "#333"
                                                },
                                                children: [
                                                    folder.title,
                                                    isMatchedByPattern(folder.path) && !filterSettings.excludeFolders.includes(folder.path) && /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                                        style: {
                                                            fontSize: "12px",
                                                            color: "#FF9800",
                                                            marginLeft: "5px"
                                                        },
                                                        children: "(\u89c4\u5219\u5339\u914d)"
                                                    })
                                                ]
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsxs)("span", {
                                                style: {
                                                    fontSize: "12px",
                                                    color: "#666"
                                                },
                                                children: [
                                                    "(",
                                                    folder.path,
                                                    ")"
                                                ]
                                            })
                                        ]
                                    }, folder.id))
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                                style: {
                                    marginBottom: "15px"
                                },
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("button", {
                                        onClick: addCommonPrivacyFolders,
                                        style: {
                                            padding: "8px 16px",
                                            backgroundColor: "#FF9800",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer",
                                            marginRight: "10px"
                                        },
                                        children: "\u6dfb\u52a0\u5e38\u7528\u9690\u79c1\u6587\u4ef6\u5939"
                                    }),
                                    /*#__PURE__*/ (0, $96OZm$jsx)("button", {
                                        onClick: addExcludePattern,
                                        style: {
                                            padding: "8px 16px",
                                            backgroundColor: "#9C27B0",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                            cursor: "pointer"
                                        },
                                        children: "\u6dfb\u52a0\u81ea\u5b9a\u4e49\u89c4\u5219"
                                    })
                                ]
                            }),
                            filterSettings.excludePatterns.length > 0 && /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("h4", {
                                        style: {
                                            color: "#555",
                                            marginBottom: "10px"
                                        },
                                        children: "\u81ea\u5b9a\u4e49\u6392\u9664\u89c4\u5219\uff1a"
                                    }),
                                    filterSettings.excludePatterns.map((pattern, index)=>/*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                                            style: {
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                marginBottom: "5px"
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                                    style: {
                                                        backgroundColor: "#f44336",
                                                        color: "white",
                                                        padding: "2px 8px",
                                                        borderRadius: "4px",
                                                        fontSize: "12px"
                                                    },
                                                    children: pattern
                                                }),
                                                /*#__PURE__*/ (0, $96OZm$jsx)("button", {
                                                    onClick: ()=>removeExcludePattern(index),
                                                    style: {
                                                        background: "none",
                                                        border: "none",
                                                        color: "#f44336",
                                                        cursor: "pointer",
                                                        fontSize: "16px"
                                                    },
                                                    children: "\xd7"
                                                })
                                            ]
                                        }, index))
                                ]
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                style: {
                    textAlign: "center",
                    marginTop: "30px"
                },
                children: [
                    /*#__PURE__*/ (0, $96OZm$jsx)("button", {
                        id: "saveButton",
                        onClick: saveSettings,
                        disabled: saving,
                        style: {
                            padding: "12px 24px",
                            backgroundColor: "#2196F3",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "16px",
                            cursor: saving ? "not-allowed" : "pointer",
                            opacity: saving ? 0.6 : 1
                        },
                        children: saving ? "\u4fdd\u5b58\u4e2d..." : "\u4fdd\u5b58\u8bbe\u7f6e"
                    }),
                    /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                        style: {
                            marginTop: "10px",
                            fontSize: "14px"
                        },
                        children: [
                            syncStatus === "syncing" && /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                style: {
                                    color: "#FF9800"
                                },
                                children: "\u23f3 \u6b63\u5728\u540c\u6b65\u5230Chrome\u8d26\u6237..."
                            }),
                            syncStatus === "success" && lastSyncTime && /*#__PURE__*/ (0, $96OZm$jsxs)("span", {
                                style: {
                                    color: "#4CAF50"
                                },
                                children: [
                                    "\u2713 \u5df2\u540c\u6b65\u5230Chrome\u8d26\u6237 (",
                                    lastSyncTime.toLocaleTimeString(),
                                    ")"
                                ]
                            }),
                            syncStatus === "error" && /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                style: {
                                    color: "#f44336"
                                },
                                children: "\u2717 \u540c\u6b65\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5"
                            })
                        ]
                    })
                ]
            }),
            /*#__PURE__*/ (0, $96OZm$jsxs)("div", {
                style: {
                    marginTop: "30px",
                    padding: "15px",
                    backgroundColor: "#e3f2fd",
                    borderRadius: "8px"
                },
                children: [
                    /*#__PURE__*/ (0, $96OZm$jsx)("h3", {
                        style: {
                            color: "#1976d2",
                            marginBottom: "10px"
                        },
                        children: "\uD83D\uDCDD \u4f7f\u7528\u8bf4\u660e"
                    }),
                    /*#__PURE__*/ (0, $96OZm$jsxs)("ul", {
                        style: {
                            marginLeft: "20px",
                            lineHeight: "1.6"
                        },
                        children: [
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u7ea7\u8054\u9009\u62e9"
                                    }),
                                    "\uff1a\u52fe\u9009\u7236\u6587\u4ef6\u5939\u4f1a\u81ea\u52a8\u52fe\u9009\u6240\u6709\u5b50\u6587\u4ef6\u5939"
                                ]
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u81ea\u5b9a\u4e49\u89c4\u5219"
                                    }),
                                    "\uff1a",
                                    /*#__PURE__*/ (0, $96OZm$jsxs)("ul", {
                                        style: {
                                            marginLeft: "20px",
                                            marginTop: "5px"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: '\u652f\u6301\u901a\u914d\u7b26\u6a21\u5f0f\uff0c\u5982 *oauth* \u5339\u914d\u5305\u542b"oauth"\u7684\u6240\u6709\u6587\u4ef6\u5939'
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: "\u6dfb\u52a0\u89c4\u5219\u540e\uff0c\u5339\u914d\u7684\u6587\u4ef6\u5939\u4f1a\u7acb\u5373\u663e\u793a\u4e3a\u5df2\u52fe\u9009\u72b6\u6001"
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                                children: [
                                                    "\u89c4\u5219\u5339\u914d\u7684\u6587\u4ef6\u5939\u4f1a\u663e\u793a ",
                                                    /*#__PURE__*/ (0, $96OZm$jsx)("span", {
                                                        style: {
                                                            color: "#FF9800"
                                                        },
                                                        children: "(\u89c4\u5219\u5339\u914d)"
                                                    }),
                                                    " \u6807\u7b7e"
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u5e38\u7528\u793a\u4f8b"
                                    }),
                                    "\uff1a",
                                    /*#__PURE__*/ (0, $96OZm$jsxs)("ul", {
                                        style: {
                                            marginLeft: "20px",
                                            marginTop: "5px"
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: '*temp* - \u5339\u914d\u6240\u6709\u5305\u542b"temp"\u7684\u6587\u4ef6\u5939'
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: '*oauth* - \u5339\u914d\u6240\u6709\u5305\u542b"oauth"\u7684\u6587\u4ef6\u5939'
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: '\u5de5\u4f5c/* - \u5339\u914d"\u5de5\u4f5c"\u6587\u4ef6\u5939\u4e0b\u7684\u6240\u6709\u5b50\u6587\u4ef6\u5939'
                                            }),
                                            /*#__PURE__*/ (0, $96OZm$jsx)("li", {
                                                children: 'Private - \u7cbe\u786e\u5339\u914d\u540d\u4e3a"Private"\u7684\u6587\u4ef6\u5939'
                                            })
                                        ]
                                    })
                                ]
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u5b9e\u65f6\u6548\u679c"
                                    }),
                                    "\uff1a\u6587\u4ef6\u5939\u5217\u8868\u4f1a\u5b9e\u65f6\u663e\u793a\u54ea\u4e9b\u6587\u4ef6\u5939\u88ab\u89c4\u5219\u5339\u914d"
                                ]
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u540c\u6b65\u72b6\u6001"
                                    }),
                                    "\uff1a\u8bbe\u7f6e\u4f1a\u81ea\u52a8\u540c\u6b65\u5230Chrome\u8d26\u6237\uff0c\u53ef\u67e5\u770b\u540c\u6b65\u72b6\u6001"
                                ]
                            }),
                            /*#__PURE__*/ (0, $96OZm$jsxs)("li", {
                                children: [
                                    /*#__PURE__*/ (0, $96OZm$jsx)("strong", {
                                        children: "\u9690\u79c1\u4fdd\u62a4"
                                    }),
                                    "\uff1a\u88ab\u6392\u9664\u7684\u6587\u4ef6\u5939\u4e2d\u7684\u4e66\u7b7e\u4e0d\u4f1a\u88abAI\u5904\u7406"
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}
var $bbc91b5d8b31594e$export$2e2bcd8739ae039 = $bbc91b5d8b31594e$var$OptionsPage;


let $981a862b4392bbb4$var$__plasmoRoot = null;
document.addEventListener("DOMContentLoaded", ()=>{
    if (!!$981a862b4392bbb4$var$__plasmoRoot) return;
    $981a862b4392bbb4$var$__plasmoRoot = document.getElementById("__plasmo");
    const root = (0, $96OZm$createRoot)($981a862b4392bbb4$var$__plasmoRoot);
    const Layout = (0, $0b3ccfbeb4084da1$export$15b332947189bc50)($bbc91b5d8b31594e$exports);
    root.render(/*#__PURE__*/ (0, $96OZm$jsx)(Layout, {
        children: /*#__PURE__*/ (0, $96OZm$jsx)($bbc91b5d8b31594e$exports.default, {})
    }));
});


 globalThis.define=__define;  })(globalThis.define);