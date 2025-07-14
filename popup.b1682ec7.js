(function(define){var __define; typeof define === "function" && (__define=define,define=null);
import {jsx as $9u1QC$jsx, jsxs as $9u1QC$jsxs} from "react/jsx-runtime";
import {Fragment as $9u1QC$Fragment, useState as $9u1QC$useState, useEffect as $9u1QC$useEffect} from "react";
import {createRoot as $9u1QC$createRoot} from "react-dom/client";

function $parcel$defineInteropFlag(a) {
  Object.defineProperty(a, '__esModule', {value: true, configurable: true});
}
function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}




const $0b3ccfbeb4084da1$export$15b332947189bc50 = (RawImport)=>typeof RawImport.Layout === "function" ? RawImport.Layout : typeof RawImport.getGlobalProvider === "function" ? RawImport.getGlobalProvider() : (0, $9u1QC$Fragment);


var $b88d5ad1a8d8fc95$exports = {};

$parcel$defineInteropFlag($b88d5ad1a8d8fc95$exports);

$parcel$export($b88d5ad1a8d8fc95$exports, "default", () => $b88d5ad1a8d8fc95$export$2e2bcd8739ae039);


/**
 * \u4e3b\u8981\u7684\u5f39\u51fa\u7a97\u53e3\u7ec4\u4ef6
 * \u63d0\u4f9b\u5feb\u901f\u7684\u4e66\u7b7e\u7ba1\u7406\u529f\u80fd
 */ function $b88d5ad1a8d8fc95$var$IndexPopup() {
    const [bookmarkCount, setBookmarkCount] = (0, $9u1QC$useState)(0);
    const [loading, setLoading] = (0, $9u1QC$useState)(true);
    // \u83b7\u53d6\u4e66\u7b7e\u6570\u91cf
    (0, $9u1QC$useEffect)(()=>{
        const fetchBookmarkCount = async ()=>{
            try {
                const bookmarks = await chrome.bookmarks.getTree();
                // \u7b80\u5355\u7edf\u8ba1\u4e66\u7b7e\u6570\u91cf\uff08\u9012\u5f52\u8ba1\u7b97\uff09
                const countBookmarks = (nodes)=>{
                    return nodes.reduce((count, node)=>{
                        if (node.url) return count + 1;
                        if (node.children) return count + countBookmarks(node.children);
                        return count;
                    }, 0);
                };
                setBookmarkCount(countBookmarks(bookmarks));
            } catch (error) {
                console.error("\u83b7\u53d6\u4e66\u7b7e\u5931\u8d25:", error);
            } finally{
                setLoading(false);
            }
        };
        fetchBookmarkCount();
    }, []);
    // \u5904\u7406\u667a\u80fd\u6574\u7406\u6309\u94ae\u70b9\u51fb
    const handleSmartOrganize = async ()=>{
        setLoading(true);
        try {
            // TODO: \u5b9e\u73b0\u667a\u80fd\u6574\u7406\u529f\u80fd
            console.log("\u5f00\u59cb\u667a\u80fd\u6574\u7406\u4e66\u7b7e...");
            // \u8fd9\u91cc\u5c06\u6765\u4f1a\u8c03\u7528AI\u670d\u52a1\u8fdb\u884c\u4e66\u7b7e\u5206\u7c7b
            alert("\u667a\u80fd\u6574\u7406\u529f\u80fd\u6b63\u5728\u5f00\u53d1\u4e2d...");
        } catch (error) {
            console.error("\u667a\u80fd\u6574\u7406\u5931\u8d25:", error);
            alert("\u6574\u7406\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5");
        } finally{
            setLoading(false);
        }
    };
    return /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
        style: {
            width: "350px",
            padding: "20px",
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#f5f5f5"
        },
        children: [
            /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
                style: {
                    textAlign: "center",
                    marginBottom: "20px",
                    color: "#333"
                },
                children: [
                    /*#__PURE__*/ (0, $9u1QC$jsx)("h2", {
                        style: {
                            margin: "0 0 10px 0",
                            fontSize: "18px"
                        },
                        children: "\uD83D\uDD16 \u667a\u80fd\u4e66\u7b7e\u7ba1\u7406\u5668"
                    }),
                    /*#__PURE__*/ (0, $9u1QC$jsx)("p", {
                        style: {
                            margin: "0",
                            fontSize: "14px",
                            color: "#666"
                        },
                        children: "\u8ba9AI\u5e2e\u4f60\u6574\u7406\u4e66\u7b7e"
                    })
                ]
            }),
            /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
                style: {
                    backgroundColor: "white",
                    padding: "15px",
                    borderRadius: "8px",
                    marginBottom: "15px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                },
                children: [
                    /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "10px"
                        },
                        children: [
                            /*#__PURE__*/ (0, $9u1QC$jsx)("span", {
                                style: {
                                    fontSize: "14px",
                                    color: "#666"
                                },
                                children: "\u5f53\u524d\u4e66\u7b7e\u6570\u91cf:"
                            }),
                            /*#__PURE__*/ (0, $9u1QC$jsx)("span", {
                                style: {
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                    color: "#333"
                                },
                                children: loading ? "..." : bookmarkCount
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0, $9u1QC$jsx)("button", {
                        onClick: handleSmartOrganize,
                        disabled: loading,
                        style: {
                            width: "100%",
                            padding: "10px",
                            backgroundColor: loading ? "#ccc" : "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "5px",
                            fontSize: "14px",
                            cursor: loading ? "not-allowed" : "pointer",
                            transition: "background-color 0.3s"
                        },
                        children: loading ? "\u5904\u7406\u4e2d..." : "\uD83E\uDD16 \u667a\u80fd\u6574\u7406"
                    })
                ]
            }),
            /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
                style: {
                    backgroundColor: "white",
                    padding: "15px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                },
                children: [
                    /*#__PURE__*/ (0, $9u1QC$jsx)("h3", {
                        style: {
                            margin: "0 0 10px 0",
                            fontSize: "14px",
                            color: "#333"
                        },
                        children: "\u5feb\u901f\u64cd\u4f5c"
                    }),
                    /*#__PURE__*/ (0, $9u1QC$jsxs)("div", {
                        style: {
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px"
                        },
                        children: [
                            /*#__PURE__*/ (0, $9u1QC$jsx)("button", {
                                style: {
                                    padding: "8px 12px",
                                    backgroundColor: "#2196F3",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer"
                                },
                                children: "\uD83D\uDCC1 \u7ba1\u7406\u6587\u4ef6\u5939"
                            }),
                            /*#__PURE__*/ (0, $9u1QC$jsx)("button", {
                                style: {
                                    padding: "8px 12px",
                                    backgroundColor: "#FF9800",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer"
                                },
                                children: "\uD83D\uDD0D \u641c\u7d22\u4e66\u7b7e"
                            }),
                            /*#__PURE__*/ (0, $9u1QC$jsx)("button", {
                                onClick: ()=>chrome.runtime.openOptionsPage(),
                                style: {
                                    padding: "8px 12px",
                                    backgroundColor: "#9C27B0",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                    cursor: "pointer"
                                },
                                children: "\u2699\ufe0f \u8bbe\u7f6e"
                            })
                        ]
                    })
                ]
            })
        ]
    });
}
var $b88d5ad1a8d8fc95$export$2e2bcd8739ae039 = $b88d5ad1a8d8fc95$var$IndexPopup;


let $4910710f4fa3f6b2$var$__plasmoRoot = null;
document.addEventListener("DOMContentLoaded", ()=>{
    if (!!$4910710f4fa3f6b2$var$__plasmoRoot) return;
    $4910710f4fa3f6b2$var$__plasmoRoot = document.getElementById("__plasmo");
    const root = (0, $9u1QC$createRoot)($4910710f4fa3f6b2$var$__plasmoRoot);
    const Layout = (0, $0b3ccfbeb4084da1$export$15b332947189bc50)($b88d5ad1a8d8fc95$exports);
    root.render(/*#__PURE__*/ (0, $9u1QC$jsx)(Layout, {
        children: /*#__PURE__*/ (0, $9u1QC$jsx)($b88d5ad1a8d8fc95$exports.default, {})
    }));
});


 globalThis.define=__define;  })(globalThis.define);