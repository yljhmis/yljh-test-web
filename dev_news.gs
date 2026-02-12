// https://esa.ntpc.edu.tw/web-announce/rest/service/view/public/OFJQdXFmQXJyaTF1WTR3YytNaC9iQTN4WW1nWWc3UGcrWG5KVjFCalJjVT0


// 變數設定
const schno = '014569';
const hash = "OFJQdXFmQXJyaTF1WTR3YytNaC9iQTN4WW1nWWc3UGcrWG5KVjFCalJjVT0";
// --------------------------------------------------------

const API_URL = "https://esa.ntpc.edu.tw/oauth_data/service/forall/announcepublic/select";

// 定義共用的 Headers
const commonHeaders = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json"
};

/**
 * 處理 GET/POST 請求並回傳合併後的 JSON
 */
function doGet() {
  return handleAllRequests('', 1);
}

function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      const body = JSON.parse(e.postData.contents);
      if (body.action === 'getNews') {
        return handleAllRequests(body.catId, body.page);
      } else if (body.action === 'getMoreNews') {
        return getMoreNews(body.catId, body.start, body.end);
      }
    }
  } catch (err) {
    // If parsing fails or no action, fall through to default
  }
  return handleAllRequests('', 1);
}

/**
 * 測試用
 */
function forTest() {
  return getMoreNews(null, 10, 19);
}

function handleAllRequests(catId, page) {  
  // Defaults
  const pageSize = 10;
  const currentPage = page || 1;
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize - 1;

  const payload = {
    "type": "request",
    "version": "1.0",
    "format": "json",
    "name": "查詢",
    "para": {
      "schno": schno,
      "search": "0", // "0" usually means standard search?
      "external": "1",
      "method": "temopn",
      "start": start,
      "end": end
    },
    "reserved": {}
  };

  // Add Category Filter if valid
  if (catId && catId != -1) {
    payload.para["bylib"] = "1";
    payload.para["opn_lib"] = catId.toString(); 
    payload.para["search"] = "1";
  }

  // 2. 準備並行的請求陣列
  const requests = [
    {
      url: API_URL,
      method: "post",
      headers: commonHeaders,
      payload: JSON.stringify({
        "type": "request",
        "version": "1.0",
        "format": "json",
        "name": "查詢",
        "para": { "para": hash, "method": "all" },
        "reserved": {}
      }),
      muteHttpExceptions: true
    },
    {
      url: API_URL,
      method: "post",
      headers: commonHeaders,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  ];

  try {
    // 3. 使用 fetchAll 同時發出所有請求 (並行)
    const responses = UrlFetchApp.fetchAll(requests);

    // 4. 解析結果並打包
    const resp0 = JSON.parse(responses[0].getContentText())
    const resp1 = JSON.parse(responses[1].getContentText())
    
    // 陣列：類別（物件）
    const temopn_lib0 = resp0.result.list[0].temopn_lib0
    // console.log(temopn_lib0)

    // 物件：類別統計資料
    const cat_stats = resp1.result.list[0]
    // console.log(cat_stats)
    // 陣列：公告物件
    const news = resp1.result.list.slice(1)
    // console.log(news)

    /****** 整理類別統計 ******/
    // 合併並轉換格式
    const all_cat_data = temopn_lib0.map(function(item) {
      return {
        id: item.id,
        no: item.no || '9999', // 無 no 則設為 '9999'
        name: item.name,
        count: cat_stats[item.id.toString()] || 0 // 從統計物件中依 id 取值
      };
    });

    // 依 no 遞增排序
    all_cat_data.sort(function(a, b) {
      return a.no.localeCompare(b.no);
    });

    // 於最前面新增「全部」元素
    all_cat_data.unshift({
      id: -1,
      no: '',
      name: '全部',
      count: cat_stats.all
    });

    // 輸出結果檢查
    // console.log(all_cat_data);

    const resultObject = {
      cat_stats: all_cat_data,
      news: news,
      timestamp: new Date().toISOString()
    };
    // console.log(JSON.stringify(resultObject))

    // 5. 回傳 JSON 給前端
    return ContentService.createTextOutput(JSON.stringify(resultObject))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    // 錯誤處理
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getMoreNews(catId, start, end) {
  const payload = {
    "type": "request",
    "version": "1.0",
    "format": "json",
    "name": "查詢",
    "para": {
      "schno": schno, // 確保此全域變數已定義
      "search": "0",
      "external": "1",
      "method": "temopn",
      "start": start,
      "end": end
    },
    "reserved": {}
  };

  // 類別篩選邏輯
  if (catId && catId != -1) {
    payload.para["bylib"] = "1";
    payload.para["opn_lib"] = catId.toString(); 
    payload.para["search"] = "1";
  }

  const options = {
    method: "post",
    headers: commonHeaders, // 確保此全域變數已定義
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    // 改用 fetch 處理單一請求
    const response = UrlFetchApp.fetch(API_URL, options);
    const content = response.getContentText();
    const jsonData = JSON.parse(content);

    // 驗證 API 回傳格式是否存在
    if (!jsonData.result || !jsonData.result.list) {
      throw new Error("Unexpected API response format");
    }

    // 排除索引 0 的統計資料，取得新聞陣列
    const news = jsonData.result.list.slice(1);

    const resultObject = {
      news: news,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(resultObject))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": e.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}