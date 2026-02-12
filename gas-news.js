// REPLACE THIS WITH YOUR DEPLOYED WEB APP URL
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxspXixvmsWGwUciZVDoDski-bobl-p4qxaR8yjgwE-sD-PtHAbeGCadKfg0of3sqX5gw/exec';

let globalCategories = [];
let globalRole = { schno: "014569" };

let currentNews = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilteredNews = [];
let currentCategoryId = -1;


let newsContainer;
let catContainer;
let paginationContainer;

document.addEventListener('DOMContentLoaded', () => {
    newsContainer = document.getElementById('gas-news-container');
    catContainer = document.getElementById('gas-category-container');
    paginationContainer = document.getElementById('gas-pagination-container');

    // Instantiate Modal from Template if needed
    let modal = document.getElementById('gas-news-detail-modal');
    if (!modal) {
        const template = document.getElementById('gas-news-detail-modal-template');
        if (template) {
            const clone = template.content.cloneNode(true);
            document.body.appendChild(clone);
            modal = document.getElementById('gas-news-detail-modal');
        }
    }

    init();

    // Close when clicking outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'gas-news-detail-modal') closeModal();
        });
    }
});


async function init() {
    try {
        const data = await fetchData(-1, 1);

        // Store role if available
        // if (data.role) {
        //     globalRole = data.role;
        // } else if (data.result && data.result.list && data.result.list[0].role) {
        //     globalRole = data.result.list[0].role[0];
        // }

        // Render Categories
        if (data.cat_stats) {
            globalCategories = data.cat_stats; // Store for lookup
            renderCategories(data.cat_stats);
        }

        // Store news and render initial list
        // Initial Render (All News, Page 1)
        // Use the data we just fetched if it matches the format, or just fetch page 1

        // The initial fetch 'data' has 'news' which is page 1 of 'All' (usually)
        // And cat_stats.all which is total count
        let totalCount = 0;
        if (data.cat_stats && data.cat_stats.length > 0) {
            const allCat = data.cat_stats.find(c => c.id === -1);
            if (allCat) totalCount = allCat.count;
        }

        renderNews(data.news);

        renderPagination(totalCount);

    } catch (e) {
        catContainer.innerHTML = '';
        newsContainer.innerHTML = `<div class="gas-error">載入失敗: ${e.message}<br>請確認 GAS 網址是否正確部屬。</div>`;
    }
}

async function fetchData(catId = -1, page = 1) {
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                "action": "getNews",
                "catId": catId,
                "page": page
            })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

const COLOR_CLASSES = ['gas-blue-border', 'gas-brown-border', 'gas-green-border', 'gas-purple-border', 'gas-red-border'];

function renderCategories(categories) {
    catContainer.innerHTML = '';

    categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        // Cycle colors or random
        const colorClass = cat.id === -1 ? '' : COLOR_CLASSES[index % COLOR_CLASSES.length];
        const isActive = (index === 0); // Default active

        btn.className = `gas-cat-btn ${colorClass} ${isActive ? 'gas-active' : ''}`;
        btn.dataset.id = cat.id;
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        // btn.setAttribute('aria-label', `分類：${cat.name}，共 ${cat.count} 則`);
        btn.setAttribute('title', `分類：${cat.name}，共 ${cat.count} 則`);

        // Style adjustment for "All" button (usually dark gray/black)
        if (cat.id === -1) {
            btn.style.borderColor = '#333';
            // Inline styles removed to check active class
        }

        btn.innerHTML = `
        ${cat.name}
        <span class="gas-cat-count">${cat.count}</span>
    `;
        btn.onclick = async (e) => {
            if (cat.id === currentCategoryId) return;

            currentCategoryId = cat.id;
            currentPage = 1;
            console.log(cat.id, cat.name, cat.count);
            // 移除所有按鈕的 gas-active class 和 aria-pressed
            document.querySelectorAll('.gas-cat-btn').forEach(btn => {
                btn.classList.remove('gas-active');
                btn.setAttribute('aria-pressed', 'false');
            });
            // 為當前按鈕加上 gas-active class
            btn.classList.add('gas-active');
            btn.setAttribute('aria-pressed', 'true');

            // 若該分類數量為 0，則不進行資料擷取
            if (cat.count <= 0) {
                newsContainer.innerHTML = '<div class="gas-loading">此分類無公告</div>';
                newsContainer.style.minHeight = ''; // Ensure no height lock is active
                paginationContainer.innerHTML = '';
                return;
            }

            // 顯示載入中
            if (newsContainer.offsetHeight > 0) {
                newsContainer.style.minHeight = `${newsContainer.offsetHeight}px`;
            }
            newsContainer.setAttribute('aria-busy', 'true');
            newsContainer.innerHTML = `<div class="gas-loading">分類：${cat.name} 第1頁資料載入中....</div>`;

            paginationContainer.innerHTML = '';
            // 抓取新分類的第一頁資料
            const data = await fetchData(currentCategoryId, currentPage);

            const cat_stats = data.cat_stats;
            const current_cat_count = cat_stats.find(cat => cat.id === currentCategoryId).count;
            // 更新此分類的 count
            document.querySelector(`.gas-cat-btn[data-id="${currentCategoryId}"]`).querySelector('.gas-cat-count').textContent = current_cat_count;

            // 渲染新聞列表
            renderNews(data.news);

            // 渲染分頁
            renderPagination(current_cat_count);
        };
        catContainer.appendChild(btn);
    });
}


const TAG_COLORS = ['gas-tag-blue', 'gas-tag-brown', 'gas-tag-green', 'gas-tag-purple', 'gas-tag-red'];

function renderNews(newsList) {
    // Update global list for openNewsDetail lookup
    currentNews = newsList || [];

    newsContainer.setAttribute('aria-busy', 'false');
    newsContainer.innerHTML = '';
    newsContainer.style.minHeight = ''; // Release height lock

    if (!newsList || newsList.length === 0) {
        newsContainer.innerHTML = '<div class="gas-loading">沒有相關公告 或 api 異常</div>';
        return;
    }

    newsList.forEach(item => {
        const li = document.createElement('div');
        li.className = 'gas-news-item';

        // Data Mapping
        const title = item.opn_title || '無標題';
        const dept = item.con_croom || '';
        const dateRaw = item.timetext || '';
        const dateDisplay = dateRaw.split(' ')[0]; // 115.02.03

        const isNew = item.days <= 3;
        const isPinned = item.priority == 1;

        const views = item.peoclick || 0;
        const author = item.con_cpos || '';

        let catIds = [];

        if (Array.isArray(item.opn_libs) && item.opn_libs.length > 0) {
            catIds = item.opn_libs;
        } else if (item.temopn_lib0_id) {
            catIds.push(item.temopn_lib0_id);
        }

        if (catIds.length === 0) {
            // Fallback if no tags
            catIds = [-1]; // Or skip?
        }

        let tagsHTML = '';

        if (catIds.length === 0) {
            tagsHTML = `<span class="gas-tag gas-tag-gray">公告</span>`;
        } else {
            catIds.forEach(id => {
                const idx = globalCategories.findIndex(c => c.id == id);
                let className = 'gas-tag-gray';
                let name = '公告';

                if (idx !== -1) {
                    name = globalCategories[idx].name;
                    className = TAG_COLORS[idx % TAG_COLORS.length];
                }

                tagsHTML += `<span class="gas-tag ${className}" style="margin-right:4px;">${name}</span>`;
            });
        }

        li.innerHTML = `
        <div class="gas-news-date">${dateDisplay}</div>
        <div class="gas-news-content">
            <div class="gas-news-tag">
                ${tagsHTML}
            </div>
            ${isPinned ? '<span class="gas-icon-pinned" role="img" aria-label="置頂公告"></span>' : ''}
            ${isNew ? '<span class="gas-icon-new" role="img" aria-label="最新公告"></span>' : ''}
            <a href="javascript:void(0)" class="gas-news-title" role="button" aria-expanded="false" onclick="openNewsDetail(${item.id})">${title}</a>
        </div>
    `;
        newsContainer.appendChild(li);
    });
}

function renderPagination(totalItems) {
    paginationContainer.innerHTML = '';
    // Wrap in nav for accessibility (or ensure container is nav)
    // But container is div id="pagination-container". Better to just put buttons inside.
    // Or better, set role="navigation" and aria-label="分頁導航" on the container string?

    // actually, let's just use what we have but add clear aria-labels to buttons.
    paginationContainer.setAttribute('role', 'navigation');
    paginationContainer.setAttribute('aria-label', '分頁導航');

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    // Helper to create button
    const createBtn = (text, page, disabled = false, active = false, ariaLabel = '') => {
        const btn = document.createElement('button');
        active = (page === currentPage);
        // console.log(`Creating page btn ${page}, current: ${currentPage}, active: ${active}`); // DEBUG
        btn.className = `gas-page-btn ${active ? 'gas-active' : ''}`;
        btn.innerHTML = text; // innerHTML for entities like &laquo;

        // Add ARIA label
        if (ariaLabel) {
            btn.setAttribute('aria-label', ariaLabel);
        } else {
            btn.setAttribute('aria-label', `第 ${page} 頁`);
        }

        if (active) {
            btn.setAttribute('aria-current', 'page');
        }

        if (disabled) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.setAttribute('aria-disabled', 'true');
        } else {
            btn.onclick = async () => {
                if (page === currentPage) return;

                currentPage = page;

                // 分類完全不在畫面中，則捲動
                const rect = catContainer.getBoundingClientRect();
                // 判斷是否「完全看不見」：
                // 底部在視窗頂部之上 (rect.bottom < 0) 
                // 或者 頂部在視窗底部之下 (rect.top > window.innerHeight)
                const isOutOfView = rect.bottom < 0 || rect.top > window.innerHeight;
                if (isOutOfView) {
                    const listTop = catContainer.offsetTop - 20;
                    window.scrollTo({ top: listTop, behavior: 'smooth' });
                }

                renderPagination(totalItems);

                // 顯示載入中
                if (newsContainer.offsetHeight > 0) {
                    newsContainer.style.minHeight = `${newsContainer.offsetHeight}px`;
                }
                const currentCat = globalCategories.find(c => c.id === currentCategoryId);
                const currentCatName = currentCat ? currentCat.name : '未知分類';
                newsContainer.innerHTML = `<div class="gas-loading">分類：${currentCatName} 第${currentPage}頁資料載入中....</div>`;

                // 抓取本頁資料
                const data = await fetchData(currentCategoryId, currentPage);

                const cat_stats = data.cat_stats;
                const current_cat_count = cat_stats.find(cat => cat.id === currentCategoryId).count;
                // 更新此分類的 count
                document.querySelector(`.gas-cat-btn[data-id="${currentCategoryId}"]`).querySelector('.gas-cat-count').textContent = current_cat_count;

                // 渲染新聞列表
                renderNews(data.news);

                // 渲染分頁
                renderPagination(current_cat_count);

                // Scroll to top of list
                //document.getElementById('gas-category-container').scrollIntoView({ behavior: 'smooth' });
                // const listTop = document.getElementById('gas-category-container').offsetTop - 20;
                // const listTop = catContainer.offsetTop - 20;
                // window.scrollTo({ top: listTop, behavior: 'smooth' });
                // catContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // const rect = catContainer.getBoundingClientRect();

                // // 判斷是否「完全看不見」：
                // // 底部在視窗頂部之上 (rect.bottom < 0) 
                // // 或者 頂部在視窗底部之下 (rect.top > window.innerHeight)
                // const isOutOfView = rect.bottom < 0 || rect.top > window.innerHeight;

                // if (isOutOfView) {
                //     const listTop = catContainer.offsetTop - 20;
                //     window.scrollTo({ top: listTop, behavior: 'smooth' });
                // }
            };
        }
        paginationContainer.appendChild(btn);
    };

    // First & Prev
    if (currentPage > 1) {
        createBtn('&laquo;', 1, false, false, '第一頁');
        createBtn('&lsaquo;', currentPage - 1, false, false, '上一頁');
    }

    // Numeric Buttons (Max 10)
    let startPage = 1;
    let endPage = totalPages;
    const maxVisible = 8;

    if (totalPages > maxVisible) {
        // Center current page if possible
        const half = Math.floor(maxVisible / 2);
        startPage = Math.max(1, currentPage - half);
        endPage = startPage + maxVisible - 1;

        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        createBtn(i, i, false, i === currentPage, `第 ${i} 頁`);
    }

    // Next & Last
    if (currentPage < totalPages) {
        createBtn('&rsaquo;', currentPage + 1, false, false, '下一頁');
        createBtn('&raquo;', totalPages, false, false, '最後一頁');
    }
}

// --- Details Modal Logic ---
let lastFocusedNewsElement = null;

function openNewsDetail(id) {
    const item = currentNews.find(n => n.id === id);
    if (!item) return;

    lastFocusedNewsElement = document.activeElement;

    document.getElementById('gas-modal-title').textContent = item.opn_title || item.title;

    // Meta info in modal
    const dept = item.con_croom || '';
    const author = item.con_cpos || '';
    document.getElementById('gas-modal-meta').innerHTML = `<span>${dept}　${author}</span>　<span>公告日期： ${item.sdatetext} - ${item.edatetext}</span>`;

    // HTML Content
    let content = (item.opn_content ? item.opn_content.replace(/\n/g, '<br>') : '') || item.opn_content_show || '(無內容)';
    document.getElementById('gas-modal-body').innerHTML = content;

    // URL References
    const urlsContainer = document.getElementById('gas-modal-urls');
    if (item.opn_urla || item.opn_urlb) {
        urlsContainer.style.display = 'block';
        let html = '';
        if (item.opn_urla) {
            html += `<div class="gas-url-row"><div class="gas-url-label">參考網址一</div><div class="gas-url-link"><a href="${item.opn_urla}" target="_blank" aria-label="參考網址一 (另開新視窗)" title="另開新視窗">參考網址一 <span style="font-size:0.8em; color:#888;">(另開新視窗)</span></a></div></div>`;
        }
        if (item.opn_urlb) {
            html += `<div class="gas-url-row"><div class="gas-url-label">參考網址二</div><div class="gas-url-link"><a href="${item.opn_urlb}" target="_blank" aria-label="參考網址二 (另開新視窗)" title="另開新視窗">參考網址二 <span style="font-size:0.8em; color:#888;">(另開新視窗)</span></a></div></div>`;
        }
        urlsContainer.innerHTML = html;
    } else {
        urlsContainer.style.display = 'none';
    }

    // Attachments
    const attachContainer = document.getElementById('gas-modal-attachments');
    const attachList = document.getElementById('gas-attach-list');
    attachList.innerHTML = '';

    if (item.attach && item.attach.length > 0) {
        attachContainer.style.display = 'block';
        item.attach.forEach(att => {
            const a = document.createElement('a');

            // Format: /central/{{role.schno}}/photoes/announce/{{news.id}}/{{f.filename}}
            // We use the globalRole.schno we fetched or defaulted
            const schno = globalRole.schno || '000000';
            const url = `https://esa.ntpc.edu.tw/central/${schno}/photoes/announce/${item.id}/${att.filename}`;

            // Get file extension
            const ext = att.filename.split('.').pop().toUpperCase();

            a.href = url;
            a.className = 'gas-attach-link';
            a.innerHTML = `📎 ${att.filename} <span style="font-size:0.85rem; color:#666;">[${ext}]</span>`; // Visual info
            a.setAttribute('download', att.filename);
            a.target = "_blank"; // Open in new tab usually better for downloads if direct
            a.setAttribute('aria-label', `下載附件 ${att.filename} (另開新視窗)`);
            a.title = `下載附件 ${att.filename} (另開新視窗)`;

            attachList.appendChild(a);
        });
    } else {
        attachContainer.style.display = 'none';
    }

    const overlay = document.getElementById('gas-news-detail-modal');
    overlay.classList.add('gas-open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Focus Management
    setTimeout(() => {
        const closeBtn = overlay.querySelector('.gas-modal-close');
        if (closeBtn) closeBtn.focus();
    }, 100);
}

function closeModal() {
    const overlay = document.getElementById('gas-news-detail-modal');
    overlay.classList.remove('gas-open');
    document.body.style.overflow = '';

    if (lastFocusedNewsElement) {
        lastFocusedNewsElement.focus();
    }
}

// Close on escape key
// Close on escape key and Focus Trap
document.addEventListener('keydown', function (e) {
    const overlay = document.getElementById('gas-news-detail-modal');
    const isOpen = overlay.classList.contains('gas-open');

    if (!isOpen) return;

    if (e.key === 'Escape') {
        closeModal();
    }

    if (e.key === 'Tab') {
        // Focus Trap
        const focusableElements = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
});
