/**
 * 功能：
 * 　- 呼叫 `role` API 取得學校代號 (schno)。
 * 　- 呼叫 `srvhrolib` API 取得分類清單。
 * 　- 呼叫 `nsrvhronum` API 取得分類統計。
 * 
 * 整合資料並回傳 JSON。
 */

// 目標網頁 URL (含有 Hash 參數) https://esa.ntpc.edu.tw/web-heromgt/rest/service/view/public/WVFYTWN4Zy9GRlBrTDlkSEJZUmRnakZFRVBkNlhhUXRJSHRFRG9ENWZ3MD0

// 變數設定
const schno = '014569';
const hash = "WVFYTWN4Zy9GRlBrTDlkSEJZUmRnakZFRVBkNlhhUXRJSHRFRG9ENWZ3MD0";

//-------------------------

const API_ENDPOINT = "https://esa.ntpc.edu.tw/oauth_data/service/forall/heromgtpublic/select";

function doGet(e) {
  try {    
    // 取得分類清單 (srvhrolib)
    const libData = fetchFromAPI("srvhrolib", { schno: schno });
    const categories = libData.list || [];

    // 取得統計數量 (nsrvhronum)
    const numData = fetchFromAPI("nsrvhronum", { schno: schno });
    // nsrvhronum 回傳結構通常是 result.list[0] 包含所有計數 (key 為 id, value 為數量)
    const countsMap = (numData.list && numData.list.length > 0) ? numData.list[0] : {};

    // 整理回傳資料
    // 對應前端需求的結構
    const resultCategories = categories.map(cat => {
      // cat.id 對應 countsMap 中的 key
      return {
        id: cat.libcode,
        name: cat.libname,
        count: countsMap[cat.libcode] || 0
      };
    });

    // 加入 "全部" 選項
    if (countsMap['all'] !== undefined) {
      resultCategories.unshift({
        id: 'all',
        name: '全部',
        count: countsMap['all']
      });
    }

    // 取得榮譽榜列表 (nsrvhro) 第一頁
    const itemList = fetchForPage("all", 1, 3);

    const responseData = {
      status: "success",
      data: {
        categories: resultCategories,
        items: itemList
      }
    };
    
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = {
      status: "error",
      message: error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理 POST 請求 (用於分頁獲取資料)
 * 參數: catId, page, limit
 */
function doPost(e) {
  try {
    let params = {};
    
    // 解析 POST data
    if (e.postData && e.postData.contents) {
        try {
            params = JSON.parse(e.postData.contents);
        } catch(e) {
            // 如果不是 JSON，嘗試從 parameter 讀取 (form-urlencoded)
            params = e.parameter;
        }
    } else {
        params = e.parameter;
    }

    const catId = params.catId || 'all';
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 3;

    // 呼叫 fetchForPage
    const itemList = fetchForPage(catId, page, limit);

    const responseData = {
      status: "success",
      data: {
        items: itemList,
        page: page,
        limit: limit
      }
    };

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = {
      status: "error",
      message: error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 抓取指定分類的指定頁面資料
 *   catId 分類 ID
 *   page  頁碼
 *   limit 一頁資料筆數
 */
function fetchForPage(catId, page, limit) {
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  const listPara = {
      schno: schno,
      start: start,
      end: end
  };

  if (catId !== 'all') {
      listPara.lib = catId;
      listPara.bylib = "1";
  }
  
  const listData = fetchFromAPI("nsrvhro", listPara);
  const itemList = listData.list || [];

  return itemList;
}

/**
 * 抓取指定分類的指定範圍資料
 *   catId 分類 ID
 *   start 開始 index
 *   end   結束 index
 */
function fetchForRange(catId, start, end) {
  const listPara = {
      schno: schno,
      start: start,
      end: end
  };

  if (catId !== 'all') {
      listPara.lib = catId;
      listPara.bylib = "1";
  }
  
  const listData = fetchFromAPI("nsrvhro", listPara);
  const itemList = listData.list || [];

  return itemList;
}

/**
 * 測試用
 */
function forTest() {
  console.log(fetchForRange('10', 0, 79).length)
}

/**
 * 通用 API 呼叫函式
 * @param {string} method - API 方法名稱 (e.g., 'role', 'srvhrolib')
 * @param {Object|string} paraData - 傳遞給 para 欄位的資料。如果是 'role' 通常是 hash 字串，其他則是包含 schno 的物件
 */
function fetchFromAPI(method, paraData) {
  // 建構 Paylaod
  // 注意：根據分析，role 的 para 是字串，其他的是物件
  let paraPayload;
  if (method === 'role') {
    paraPayload = {
        para: paraData,
        method: method
    };
  } else {
    // 確保 paraData 是物件，並加入 method
    paraPayload = { ...paraData, method: method };
  }

  const payload = {
    type: "request",
    version: "1.0",
    format: "json",
    name: "查詢",
    para: paraPayload,
    reserved: {}
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(API_ENDPOINT, options);
  const json = JSON.parse(response.getContentText());

  // 簡單檢查回傳狀態 (雖然後端回傳結構不一，但通常有 result)
  if (json.result) {
    return json.result;
  } else {
    // 若無 result 欄位，可能是錯誤或特殊結構，直接回傳以便除錯
    return {}; 
  }
}
