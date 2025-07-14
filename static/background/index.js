(function(define){var __define; typeof define === "function" && (__define=define,define=null);
(() => {
/**
 * \u540e\u53f0\u811a\u672c - \u5904\u7406\u4e66\u7b7e\u4e8b\u4ef6\u548cAI\u5206\u7c7b\u903b\u8f91
 */ /**
 * \u4e66\u7b7e\u8fc7\u6ee4\u5de5\u5177\u51fd\u6570
 */ async function $a52c22cac21bde54$export$3c9f6c5fe3818122(bookmarkId) {
    try {
        const bookmarkTree = await chrome.bookmarks.getTree();
        return $a52c22cac21bde54$var$findBookmarkPath(bookmarkTree, bookmarkId) || "";
    } catch (error) {
        console.error("\u83b7\u53d6\u4e66\u7b7e\u8def\u5f84\u5931\u8d25:", error);
        return "";
    }
}
/**
 * \u9012\u5f52\u67e5\u627e\u4e66\u7b7e\u8def\u5f84
 * @param nodes \u4e66\u7b7e\u6811\u8282\u70b9
 * @param targetId \u76ee\u6807\u4e66\u7b7eID
 * @param currentPath \u5f53\u524d\u8def\u5f84
 * @returns \u4e66\u7b7e\u8def\u5f84
 */ function $a52c22cac21bde54$var$findBookmarkPath(nodes, targetId, currentPath = "") {
    for (const node of nodes){
        const newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
        if (node.id === targetId) return currentPath; // \u8fd4\u56de\u7236\u7ea7\u8def\u5f84
        if (node.children) {
            const result = $a52c22cac21bde54$var$findBookmarkPath(node.children, targetId, newPath);
            if (result !== null) return result;
        }
    }
    return null;
}
async function $a52c22cac21bde54$export$64f212d053d10035(bookmark) {
    if (!bookmark.parentId) return "";
    try {
        const parents = [];
        let currentId = bookmark.parentId;
        while(currentId){
            const parentNodes = await chrome.bookmarks.get(currentId);
            if (parentNodes.length > 0) {
                const parent = parentNodes[0];
                // \u8df3\u8fc7\u6839\u8282\u70b9
                if (parent.parentId) parents.unshift(parent.title);
                currentId = parent.parentId;
            } else break;
        }
        return parents.join("/");
    } catch (error) {
        console.error("\u83b7\u53d6\u4e66\u7b7e\u6587\u4ef6\u5939\u8def\u5f84\u5931\u8d25:", error);
        return "";
    }
}
function $a52c22cac21bde54$export$69cf574f30fda100(path, pattern) {
    // \u5c06\u901a\u914d\u7b26\u6a21\u5f0f\u8f6c\u6362\u4e3a\u6b63\u5219\u8868\u8fbe\u5f0f
    const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\//g, "\\/");
    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(path);
}
async function $a52c22cac21bde54$export$14098a650fd835e3(bookmark, filterSettings) {
    // \u5982\u679c\u672a\u542f\u7528\u8fc7\u6ee4\uff0c\u4e0d\u8fc7\u6ee4\u4efb\u4f55\u4e66\u7b7e
    if (!filterSettings.autoFilter) return false;
    // \u83b7\u53d6\u4e66\u7b7e\u6240\u5728\u7684\u6587\u4ef6\u5939\u8def\u5f84
    const folderPath = await $a52c22cac21bde54$export$64f212d053d10035(bookmark);
    // \u68c0\u67e5\u662f\u5426\u5728\u6392\u9664\u7684\u6587\u4ef6\u5939\u4e2d
    for (const excludeFolder of filterSettings.excludeFolders)if (folderPath.includes(excludeFolder)) {
        console.log(`\u4e66\u7b7e "${bookmark.title}" \u5728\u6392\u9664\u6587\u4ef6\u5939 "${excludeFolder}" \u4e2d\uff0c\u8df3\u8fc7\u5904\u7406`);
        return true;
    }
    // \u68c0\u67e5\u662f\u5426\u5339\u914d\u6392\u9664\u6a21\u5f0f
    for (const pattern of filterSettings.excludePatterns)if ($a52c22cac21bde54$export$69cf574f30fda100(folderPath, pattern)) {
        console.log(`\u4e66\u7b7e "${bookmark.title}" \u5339\u914d\u6392\u9664\u6a21\u5f0f "${pattern}"\uff0c\u8df3\u8fc7\u5904\u7406`);
        return true;
    }
    return false;
}
async function $a52c22cac21bde54$export$9438b961ef72b8d0(bookmarks, filterSettings) {
    const filteredBookmarks = [];
    for (const bookmark of bookmarks){
        const shouldFilter = await $a52c22cac21bde54$export$14098a650fd835e3(bookmark, filterSettings);
        if (!shouldFilter) filteredBookmarks.push(bookmark);
    }
    return filteredBookmarks;
}
function $a52c22cac21bde54$export$6612ea9fb025b0de() {
    return {
        excludeFolders: [
            "\u9690\u79c1",
            "\u79c1\u4eba",
            "\u4e2a\u4eba"
        ],
        excludePatterns: [
            "*private*",
            "*personal*",
            "*temp*"
        ],
        autoFilter: true
    };
}
async function $a52c22cac21bde54$export$1cfcb24f0783fcf9() {
    try {
        const result = await chrome.storage.sync.get([
            "filterSettings"
        ]);
        return result.filterSettings || $a52c22cac21bde54$export$6612ea9fb025b0de();
    } catch (error) {
        console.error("\u52a0\u8f7d\u8fc7\u6ee4\u8bbe\u7f6e\u5931\u8d25:", error);
        return $a52c22cac21bde54$export$6612ea9fb025b0de();
    }
}
async function $a52c22cac21bde54$export$3a8d4ca9f8e52c91(settings) {
    try {
        await chrome.storage.sync.set({
            filterSettings: settings
        });
        console.log("\u8fc7\u6ee4\u8bbe\u7f6e\u5df2\u4fdd\u5b58");
    } catch (error) {
        console.error("\u4fdd\u5b58\u8fc7\u6ee4\u8bbe\u7f6e\u5931\u8d25:", error);
        throw error;
    }
}


// \u76d1\u542c\u6269\u5c55\u5b89\u88c5\u4e8b\u4ef6
chrome.runtime.onInstalled.addListener(()=>{
    console.log("\u667a\u80fd\u4e66\u7b7e\u7ba1\u7406\u5668\u5df2\u5b89\u88c5");
    // \u521d\u59cb\u5316\u9ed8\u8ba4\u8bbe\u7f6e
    chrome.storage.sync.set({
        autoClassify: true,
        aiModel: "gpt-4o-mini",
        language: "zh-CN"
    });
});
// \u76d1\u542c\u65b0\u4e66\u7b7e\u521b\u5efa\u4e8b\u4ef6
chrome.bookmarks.onCreated.addListener(async (id, bookmark)=>{
    console.log("\u65b0\u4e66\u7b7e\u521b\u5efa:", bookmark);
    // \u68c0\u67e5\u662f\u5426\u542f\u7528\u81ea\u52a8\u5206\u7c7b
    const settings = await chrome.storage.sync.get([
        "autoClassify"
    ]);
    if (settings.autoClassify) {
        // \u68c0\u67e5\u662f\u5426\u5e94\u8be5\u8fc7\u6ee4\u8fd9\u4e2a\u4e66\u7b7e
        const filterSettings = await (0, $a52c22cac21bde54$export$1cfcb24f0783fcf9)();
        const shouldFilter = await (0, $a52c22cac21bde54$export$14098a650fd835e3)(bookmark, filterSettings);
        if (!shouldFilter) // \u5982\u679c\u4e0d\u9700\u8981\u8fc7\u6ee4\uff0c\u5219\u8fdb\u884cAI\u5206\u7c7b
        await $04b5fd3866fb80a3$var$classifyBookmark(bookmark);
        else console.log(`\u4e66\u7b7e "${bookmark.title}" \u88ab\u8fc7\u6ee4\uff0c\u4e0d\u8fdb\u884cAI\u5904\u7406`);
    }
});
// \u76d1\u542c\u4e66\u7b7e\u53d8\u66f4\u4e8b\u4ef6
chrome.bookmarks.onChanged.addListener(async (id, changeInfo)=>{
    console.log("\u4e66\u7b7e\u66f4\u65b0:", id, changeInfo);
    // \u5982\u679c\u6807\u9898\u6216URL\u53d1\u751f\u53d8\u5316\uff0c\u53ef\u80fd\u9700\u8981\u91cd\u65b0\u5206\u7c7b
    if (changeInfo.title || changeInfo.url) {
        const bookmark = await chrome.bookmarks.get(id);
        if (bookmark.length > 0) await $04b5fd3866fb80a3$var$classifyBookmark(bookmark[0]);
    }
});
/**
 * \u4f7f\u7528AI\u5bf9\u4e66\u7b7e\u8fdb\u884c\u667a\u80fd\u5206\u7c7b
 * @param bookmark \u4e66\u7b7e\u5bf9\u8c61
 */ async function $04b5fd3866fb80a3$var$classifyBookmark(bookmark) {
    try {
        // TODO: \u5b9e\u73b0AI\u5206\u7c7b\u903b\u8f91
        console.log("\u5f00\u59cb\u5206\u7c7b\u4e66\u7b7e:", bookmark.title);
        // \u8fd9\u91cc\u5c06\u6765\u4f1a\u8c03\u7528\u5916\u90e8AI\u670d\u52a1
        // 1. \u5206\u6790\u4e66\u7b7e\u7684\u6807\u9898\u548cURL
        // 2. \u8c03\u7528LLM API\u83b7\u53d6\u5206\u7c7b\u5efa\u8bae
        // 3. \u521b\u5efa\u6216\u79fb\u52a8\u5230\u5408\u9002\u7684\u6587\u4ef6\u5939
        // \u6682\u65f6\u7684\u6a21\u62df\u5206\u7c7b\u903b\u8f91
        const category = await $04b5fd3866fb80a3$var$simulateAIClassification(bookmark);
        if (category) await $04b5fd3866fb80a3$var$moveBookmarkToCategory(bookmark, category);
    } catch (error) {
        console.error("\u4e66\u7b7e\u5206\u7c7b\u5931\u8d25:", error);
    }
}
/**
 * \u6a21\u62dfAI\u5206\u7c7b\uff08\u4e34\u65f6\u5b9e\u73b0\uff09
 * @param bookmark \u4e66\u7b7e\u5bf9\u8c61
 * @returns \u5206\u7c7b\u7ed3\u679c
 */ async function $04b5fd3866fb80a3$var$simulateAIClassification(bookmark) {
    const title = bookmark.title?.toLowerCase() || "";
    const url = bookmark.url?.toLowerCase() || "";
    // \u7b80\u5355\u7684\u5173\u952e\u8bcd\u5339\u914d\u5206\u7c7b
    if (title.includes("github") || url.includes("github.com")) return "\u5f00\u53d1\u5de5\u5177";
    if (title.includes("news") || url.includes("news") || url.includes("\u65b0\u95fb")) return "\u65b0\u95fb\u8d44\u8baf";
    if (title.includes("video") || url.includes("youtube") || url.includes("bilibili")) return "\u89c6\u9891\u5a31\u4e50";
    if (title.includes("shop") || url.includes("taobao") || url.includes("amazon")) return "\u8d2d\u7269";
    if (title.includes("learn") || url.includes("course") || title.includes("\u6559\u7a0b")) return "\u5b66\u4e60\u8d44\u6599";
    return null; // \u65e0\u6cd5\u5206\u7c7b
}
/**
 * \u5c06\u4e66\u7b7e\u79fb\u52a8\u5230\u6307\u5b9a\u5206\u7c7b\u6587\u4ef6\u5939
 * @param bookmark \u4e66\u7b7e\u5bf9\u8c61
 * @param category \u5206\u7c7b\u540d\u79f0
 */ async function $04b5fd3866fb80a3$var$moveBookmarkToCategory(bookmark, category) {
    try {
        // \u67e5\u627e\u6216\u521b\u5efa\u5206\u7c7b\u6587\u4ef6\u5939
        const categoryFolder = await $04b5fd3866fb80a3$var$findOrCreateFolder(category);
        // \u79fb\u52a8\u4e66\u7b7e\u5230\u5206\u7c7b\u6587\u4ef6\u5939
        if (categoryFolder && bookmark.id) {
            await chrome.bookmarks.move(bookmark.id, {
                parentId: categoryFolder.id
            });
            console.log(`\u4e66\u7b7e "${bookmark.title}" \u5df2\u79fb\u52a8\u5230 "${category}" \u6587\u4ef6\u5939`);
        }
    } catch (error) {
        console.error("\u79fb\u52a8\u4e66\u7b7e\u5931\u8d25:", error);
    }
}
/**
 * \u67e5\u627e\u6216\u521b\u5efa\u6587\u4ef6\u5939
 * @param folderName \u6587\u4ef6\u5939\u540d\u79f0
 * @returns \u6587\u4ef6\u5939\u5bf9\u8c61
 */ async function $04b5fd3866fb80a3$var$findOrCreateFolder(folderName) {
    try {
        // \u83b7\u53d6\u4e66\u7b7e\u680f
        const bookmarkBar = await chrome.bookmarks.getTree();
        const bookmarkBarNode = bookmarkBar[0].children?.find((node)=>node.title === "\u4e66\u7b7e\u680f");
        if (!bookmarkBarNode) {
            console.error("\u627e\u4e0d\u5230\u4e66\u7b7e\u680f");
            return null;
        }
        // \u5728\u4e66\u7b7e\u680f\u4e2d\u67e5\u627e\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939
        let smartFolder = bookmarkBarNode.children?.find((node)=>node.title === "\u667a\u80fd\u5206\u7c7b");
        if (!smartFolder) // \u521b\u5efa\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939
        smartFolder = await chrome.bookmarks.create({
            parentId: bookmarkBarNode.id,
            title: "\u667a\u80fd\u5206\u7c7b"
        });
        // \u5728\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939\u4e2d\u67e5\u627e\u6307\u5b9a\u5206\u7c7b
        let categoryFolder = smartFolder.children?.find((node)=>node.title === folderName);
        if (!categoryFolder) // \u521b\u5efa\u5206\u7c7b\u6587\u4ef6\u5939
        categoryFolder = await chrome.bookmarks.create({
            parentId: smartFolder.id,
            title: folderName
        });
        return categoryFolder;
    } catch (error) {
        console.error("\u521b\u5efa\u6587\u4ef6\u5939\u5931\u8d25:", error);
        return null;
    }
}
/**
 * \u6279\u91cf\u6574\u7406\u73b0\u6709\u4e66\u7b7e
 * \u7531popup\u754c\u9762\u8c03\u7528
 */ chrome.runtime.onMessage.addListener(async (request, sender, sendResponse)=>{
    if (request.action === "batchOrganize") try {
        console.log("\u5f00\u59cb\u6279\u91cf\u6574\u7406\u4e66\u7b7e...");
        // \u83b7\u53d6\u6240\u6709\u4e66\u7b7e
        const bookmarks = await chrome.bookmarks.getTree();
        const allBookmarks = $04b5fd3866fb80a3$var$flattenBookmarks(bookmarks);
        // \u8fc7\u6ee4\u51fa\u9700\u8981\u6574\u7406\u7684\u4e66\u7b7e\uff08\u6392\u9664\u5df2\u5728\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939\u4e2d\u7684\uff09
        const bookmarksToOrganize = allBookmarks.filter((bookmark)=>bookmark.url && !$04b5fd3866fb80a3$var$isInSmartFolder(bookmark));
        // \u6279\u91cf\u5206\u7c7b
        for (const bookmark of bookmarksToOrganize){
            await $04b5fd3866fb80a3$var$classifyBookmark(bookmark);
            // \u6dfb\u52a0\u5ef6\u8fdf\u907f\u514d\u8fc7\u5feb\u8c03\u7528
            await new Promise((resolve)=>setTimeout(resolve, 100));
        }
        sendResponse({
            success: true,
            processed: bookmarksToOrganize.length
        });
    } catch (error) {
        console.error("\u6279\u91cf\u6574\u7406\u5931\u8d25:", error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
});
/**
 * \u6241\u5e73\u5316\u4e66\u7b7e\u6811
 * @param bookmarks \u4e66\u7b7e\u6811
 * @returns \u6241\u5e73\u5316\u7684\u4e66\u7b7e\u6570\u7ec4
 */ function $04b5fd3866fb80a3$var$flattenBookmarks(bookmarks) {
    const result = [];
    function traverse(nodes) {
        for (const node of nodes){
            if (node.url) result.push(node);
            if (node.children) traverse(node.children);
        }
    }
    traverse(bookmarks);
    return result;
}
/**
 * \u68c0\u67e5\u4e66\u7b7e\u662f\u5426\u5df2\u5728\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939\u4e2d
 * @param bookmark \u4e66\u7b7e\u5bf9\u8c61
 * @returns \u662f\u5426\u5728\u667a\u80fd\u5206\u7c7b\u6587\u4ef6\u5939\u4e2d
 */ function $04b5fd3866fb80a3$var$isInSmartFolder(bookmark) {
    // TODO: \u5b9e\u73b0\u68c0\u67e5\u903b\u8f91
    // \u8fd9\u91cc\u9700\u8981\u904d\u5386\u7236\u8282\u70b9\u8def\u5f84\uff0c\u68c0\u67e5\u662f\u5426\u5728"\u667a\u80fd\u5206\u7c7b"\u6587\u4ef6\u5939\u4e0b
    return false;
}



})();
 globalThis.define=__define;  })(globalThis.define);