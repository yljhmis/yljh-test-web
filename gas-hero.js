/**
 * GAS Hero Frontend Logic
 * 負責從 Google Apps Script 取得資料並渲染畫面
 */

// 請更換為您的 GAS Web App URL
const GAS_HERO_API_URL = 'https://script.google.com/macros/s/AKfycbwfZmTaYIxaG0qnqVG0cGx80V_4Eo1srTBMKoF5olvMGJI4XiwTkOzkW7vmOsVAiJZL/exec';
const DEFAULT_HERO_IMG_URL = [
    'https://esa.ntpc.edu.tw/web-heromgt/images/default_1.jpg',
    'https://esa.ntpc.edu.tw/web-heromgt/images/default_2.jpg',
    'https://esa.ntpc.edu.tw/web-heromgt/images/default_3.jpg',
    'https://esa.ntpc.edu.tw/web-heromgt/images/default_4.jpg',
    'https://esa.ntpc.edu.tw/web-heromgt/images/default_5.jpg'
];

let allHeroCategories = [];
let currentHeroCategory = 'all';
let currentHeroPage = 1;
const heroLimit = 3;


const heroFilterContainer = document.getElementById('gas-hero-filter');
const heroListContainer = document.getElementById('gas-hero-list');
const heroPaginationContainer = document.getElementById('gas-hero-pagination');

// 用於焦點管理
let previousActiveElement = null;

document.addEventListener('DOMContentLoaded', () => {
    initGasHero();
});

async function initGasHero() {
    renderHeroLoading();
    try {
        const data = await fetchHeroInitData();
        //console.log(data);

        if (data) {
            allHeroCategories = data.categories;
            // Assign color classes
            allHeroCategories.forEach((cat, index) => {
                if (cat.id === 'all') {
                    cat.colorClass = 'gas-hero-color-all';
                } else {
                    cat.colorClass = `gas-hero-color-${index % 8}`;
                }
            });

            renderHeroFilters(data.categories);
            renderHeroList(data.items, data.categories);
            renderHeroPagination();
        }
    } catch (e) {
        console.error('Initialization failed:', e);
        document.getElementById('gas-hero-list').innerHTML = '<p style="color:red; text-align:center; width:100%;">載入失敗，請稍後再試。</p>';
    }
}

function renderHeroLoading() {
    const container = document.getElementById('gas-hero-list');
    if (container.offsetHeight > 0) {
        container.style.minHeight = `${container.offsetHeight}px`;
    }
    container.innerHTML = '<p style="text-align:center; color:#666; width:100%;">資料載入中...</p>';
}

/**
 * 呼叫 GAS API
 * 支援分頁與分類參數，但此範例初版先抓取預設資料
 */
async function fetchHeroInitData(categoryId = 'all', page = 1, limit = 3) {
    try {
        const url = new URL(GAS_HERO_API_URL);
        url.searchParams.append('catId', categoryId);
        // 加上 timestamp 避免快取
        url.searchParams.append('t', new Date().getTime());

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);

        return json.data;
    } catch (error) {
        console.error('Fetch error:', error);
        // 開發階段若無 URL，可回傳假資料測試 (Optional)
        return null;
    }
}

/**
 * 渲染分類過濾器
 */
function renderHeroFilters(categories) {
    heroFilterContainer.innerHTML = '';
    heroFilterContainer.setAttribute('role', 'group');
    heroFilterContainer.setAttribute('aria-label', '分類篩選');

    categories.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = cat.id === currentHeroCategory;
        // Add color class
        btn.className = `gas-hero-badge ${isActive ? 'active' : ''} ${cat.colorClass || ''}`;
        btn.textContent = `${cat.name} ${cat.count}`;
        btn.onclick = () => handleHeroFilterClick(cat.id);

        // A11y attributes
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.setAttribute('aria-label', `分類：${cat.name}，共 ${cat.count} 筆`);

        heroFilterContainer.appendChild(btn);
    });
}

/**
 * 處理分類點擊
 */
async function handleHeroFilterClick(catId) {
    if (currentHeroCategory === catId) return;

    currentHeroCategory = catId;
    currentHeroPage = 1; // 重置頁碼

    // 更新按鈕狀態
    document.querySelectorAll('.gas-hero-badge').forEach(btn => {
        btn.classList.remove('active');
        // 簡單的比對文字內容或是透過 dataset 識別會更準確，這裡先重繪解決
    });
    renderHeroFilters(allHeroCategories); // 重繪以更新 active 狀態

    heroPaginationContainer.innerHTML = '';

    // 重新載入列表
    renderHeroLoading();
    // 使用 POST 取得資料
    const data = await fetchHeroDataPost(catId, currentHeroPage, heroLimit);
    if (data) {
        renderHeroList(data.items, allHeroCategories);
        renderHeroPagination();
    }
}

/**
 * 處理分頁點擊
 */
async function handlePageClick(page) {
    if (currentHeroPage === page) return;

    currentHeroPage = page;
    renderHeroPagination();
    renderHeroLoading();

    const data = await fetchHeroDataPost(currentHeroCategory, currentHeroPage, heroLimit);
    if (data) {
        renderHeroList(data.items, allHeroCategories);
        // renderHeroPagination();

        // 捲動到頂部
        // const listTop = document.getElementById('gas-hero-filter').offsetTop - 20;
        const listTop = heroFilterContainer.offsetTop - 20;
        window.scrollTo({ top: listTop, behavior: 'smooth' });
    }
}

/**
 * 渲染分頁
 * 需求：最多 8 個按鈕 (含功能鍵)，包含第一頁、前一頁、後一頁、最後一頁。必要時顯示。
 * 嚴格遵守無障礙規範 (ARIA)。
 */
function renderHeroPagination() {
    if (!heroPaginationContainer) return;

    heroPaginationContainer.innerHTML = '';

    // 找出目前分類的總數
    let totalCount = 0;
    const cat = allHeroCategories.find(c => c.id === currentHeroCategory);
    if (cat) {
        totalCount = cat.count;
    }

    if (totalCount === 0) return;

    const totalPages = Math.ceil(totalCount / heroLimit);
    if (totalPages <= 1) return; // 只有一頁不顯示

    // 建立 nav 元素
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '分頁導航');
    nav.className = 'gas-hero-pagination-nav';
    nav.style.display = 'flex';
    nav.style.gap = '5px';

    // 輔助函式：建立按鈕
    const createBtn = (text, page, label, isDisabled, isActive = false) => {
        const btn = document.createElement('button');
        btn.className = `gas-hero-page-btn ${isActive ? 'active' : ''}`;
        btn.textContent = text;
        btn.setAttribute('aria-label', label);

        if (isActive) {
            btn.setAttribute('aria-current', 'page');
        }

        if (isDisabled) {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
        } else {
            btn.onclick = () => handlePageClick(page);
        }
        return btn;
    };

    // 邏輯：最多 8 個按鈕
    // 邏輯：最多 8 個頁碼按鈕 (不含功能鍵)
    const maxPageButtons = 8; // 調整這裡控制頁碼按鈕數量
    let startPage, endPage;

    if (totalPages <= maxPageButtons) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const half = Math.floor(maxPageButtons / 2);
        startPage = currentHeroPage - half;
        endPage = currentHeroPage + (maxPageButtons - half) - 1;

        if (startPage < 1) {
            startPage = 1;
            endPage = maxPageButtons;
        } else if (endPage > totalPages) {
            endPage = totalPages;
            startPage = totalPages - maxPageButtons + 1;
        }
    }

    // 1. 第一頁 & 上一頁 (非首頁顯示)
    if (currentHeroPage > 1) {
        nav.appendChild(createBtn('«', 1, '前往第一頁', false));
        nav.appendChild(createBtn('‹', currentHeroPage - 1, '前往上一頁', false));
    }

    // 2. 頁碼
    for (let i = startPage; i <= endPage; i++) {
        nav.appendChild(createBtn(i, i, `前往第 ${i} 頁`, false, i === currentHeroPage));
    }

    // 3. 下一頁 & 最末頁 (非末頁顯示)
    if (currentHeroPage < totalPages) {
        nav.appendChild(createBtn('›', currentHeroPage + 1, '前往下一頁', false));
        nav.appendChild(createBtn('»', totalPages, '前往最後一頁', false));
    }

    heroPaginationContainer.appendChild(nav);
}


/**
 * 呼叫 GAS API (POST)
 * 用於取得特定分類與分頁的列表資料
 */
async function fetchHeroDataPost(catId, page = 1, limit = 3) {
    try {
        const payload = {
            catId: catId,
            page: page,
            limit: limit
        };

        const res = await fetch(GAS_HERO_API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            // mode: 'no-cors' // GAS Web App 需注意 CORS，若遇到問題可嘗試 no-cors 但會拿不到 response
            // 通常部署為 "Anyone" 權限即可正常回應
        });

        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message);

        return json.data;
    } catch (error) {
        console.error('Fetch POST error:', error);
        return null;
    }
}

/**
 * 渲染列表
 */
function renderHeroList(items, categories) {
    heroListContainer.innerHTML = '';
    heroListContainer.style.minHeight = ''; // Release height lock

    if (!items || items.length === 0) {
        heroListContainer.innerHTML = '<p style="text-align:center; width:100%;">此分類尚無資料。</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gas-hero-card';

        // 圖片處理
        const default_pic = DEFAULT_HERO_IMG_URL[Math.floor(Math.random() * DEFAULT_HERO_IMG_URL.length)];
        const imgSrc = (item.pic && item.pic.length > 0) ? "https://esa.ntpc.edu.tw" + item.pic[0].filepath : default_pic;
        console.log(imgSrc);
        // 分類名稱
        const catName = item.unitlibname || '未知分類';

        // Find category color
        const cat = allHeroCategories.find(c => c.name === catName) || {};
        const colorClass = cat.colorClass || 'gas-hero-color-all';

        card.innerHTML = `
            <div class="gas-hero-card-img-container">
                <img src="${imgSrc}" alt="${item.hrotitle}" class="gas-hero-card-img" onerror="this.src='${default_pic}'">
            </div>
            <div class="gas-hero-card-body">
                <div class="gas-hero-card-meta">
                    <span class="gas-hero-tag ${colorClass}">${catName}</span>
                    <span>${item.timetext}</span>
                </div>
                <a href="#" class="gas-hero-card-title js-open-modal" data-id="${item.id}">${item.hrotitle}</a>
                <div class="gas-hero-card-text">${item.hromemo}</div>
            </div>
        `;

        // 綁定點擊事件
        const titleLink = card.querySelector('.js-open-modal');
        titleLink.addEventListener('click', (e) => {
            e.preventDefault();
            openHeroModal(item, catName);
        });

        heroListContainer.appendChild(card);
    });
}


/**
 * 開啟 Modal
 */
function openHeroModal(item, catName) {
    // 1. 儲存當前焦點 (Focus Return)
    previousActiveElement = document.activeElement;

    let modal = document.getElementById('gas-hero-modal');

    // 如果 Modal 不存在，則從 Template 複製
    if (!modal) {
        const template = document.getElementById('gas-hero-modal-template');
        if (!template) {
            console.error('Modal template not found!');
            return;
        }
        const clone = template.content.cloneNode(true);
        document.body.appendChild(clone);
        modal = document.getElementById('gas-hero-modal');
    }

    const title = document.getElementById('gas-hero-modal-title');
    const info = document.getElementById('gas-hero-modal-info');
    const text = document.getElementById('gas-hero-modal-text');
    const images = document.getElementById('gas-hero-modal-images');

    // Find category color
    const cat = allHeroCategories.find(c => c.name === catName) || {};
    const colorClass = cat.colorClass || 'gas-hero-color-all';

    title.textContent = item.hrotitle;
    info.innerHTML = `
        <span class="gas-hero-tag ${colorClass}">${catName}</span>
        <span style="margin-left:10px;">發布日期：${item.timetext}</span>
    `;
    text.textContent = item.hromemo; // 使用 textContent 保留格式但避免 XSS，若需 HTML 則用 innerHTML

    // 附件
    const files = document.getElementById('gas-hero-modal-files');
    files.innerHTML = '';
    if (item.file && item.file.length > 0) {
        let fileHtml = `
            <div class="gas-hero-modal-section-title">
                <img src="https://esa.ntpc.edu.tw/web-heromgt/images/trophy.svg" alt="" width="24" height="24">
                競賽附件
            </div>
            <div class="gas-hero-modal-file-list">
        `;
        item.file.forEach(f => {
            fileHtml += `<div class="gas-hero-file-item"><a href="${f.filepath}" target="_blank" rel="noopener noreferrer">${f.picname}</a></div>`;
        });
        fileHtml += `</div>`;
        files.innerHTML = fileHtml;
    }

    // 圖片
    images.innerHTML = '';
    if (item.pic && item.pic.length > 0) {
        let imgHtml = `
            <div class="gas-hero-modal-section-title">
                <img src="https://esa.ntpc.edu.tw/web-heromgt/images/trophy.svg" alt="" width="24" height="24">
                競賽照片
            </div>
            <div class="gas-hero-modal-image-list">
        `;
        item.pic.forEach(p => {
            // 假設 filepath 是相對路徑，若已有 domain 則直接使用，否則補上
            let src = p.filepath;
            if (src && !src.startsWith('http')) {
                src = 'https://esa.ntpc.edu.tw' + src;
            }
            imgHtml += `
                <a href="${src}" target="_blank" download="" title="下載原圖：${item.hrotitle}">
                    <img src="${src}" alt="競賽照片：${item.hrotitle}" class="gas-hero-modal-img">
                </a>
            `;
        });
        imgHtml += `</div>`;
        images.innerHTML = imgHtml;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // 綁定關閉事件 (包含 Overlay 點擊)
    const closeBtns = modal.querySelectorAll('[data-close="true"]');
    closeBtns.forEach(btn => {
        btn.onclick = () => closeHeroModal();
    });

    // 2. 焦點陷阱 (Focus Trap) 與 ESC 關閉
    const focusableElementsString = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modal.querySelectorAll(focusableElementsString);
    const firstTabStop = focusableElements[0];
    const lastTabStop = focusableElements[focusableElements.length - 1];

    // 將焦點移至第一個可聚焦元素 (通常是關閉按鈕，或是自訂的起始點)
    // 延遲一下確保 CSS transition 或是 render 完成
    setTimeout(() => {
        if (firstTabStop) firstTabStop.focus();
    }, 100);

    document.onkeydown = function (evt) {
        if (evt.key === 'Escape') {
            closeHeroModal();
            return;
        }

        if (evt.key === 'Tab') {
            // Shift + Tab
            if (evt.shiftKey) {
                if (document.activeElement === firstTabStop) {
                    evt.preventDefault();
                    lastTabStop.focus();
                }
            }
            // Tab
            else {
                if (document.activeElement === lastTabStop) {
                    evt.preventDefault();
                    firstTabStop.focus();
                }
            }
        }
    };
}

function closeHeroModal() {
    const modal = document.getElementById('gas-hero-modal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restore background scrolling
    document.onkeydown = null;

    // 歸還焦點
    if (previousActiveElement) {
        previousActiveElement.focus();
    }
}
