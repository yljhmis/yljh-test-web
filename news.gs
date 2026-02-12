/**
 * 處理 GET/POST 請求並回傳合併後的 JSON
 */
function doGet() {
  return handleAllRequests();
}

function doPost() {
  return handleAllRequests();
}

function handleAllRequests() {
  const API_URL = "https://esa.ntpc.edu.tw/oauth_data/service/forall/announcepublic/select";
  
  // 1. 定義共用的 Headers
  const commonHeaders = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "sec-ch-ua": "\"Not(A:Brand\";v=\"8\", \"Chromium\";v=\"144\", \"Google Chrome\";v=\"144\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin"
  };

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
        "para": { "para": "OFJQdXFmQXJyaTF1WTR3YytNaC9iQTN4WW1nWWc3UGcrWG5KVjFCalJjVT0", "method": "all" },
        "reserved": {}
      }),
      muteHttpExceptions: true
    },
    {
      url: API_URL,
      method: "post",
      headers: commonHeaders,
      payload: JSON.stringify({
        "type": "request",
        "version": "1.0",
        "format": "json",
        "name": "查詢",
        "para": { "schno": "014569", "search": "0", "external": "1", "method": "temopn", "start": 0, "end": 19 },
        //"para": { "schno": "014569", "search": "0", "method": "temopn"},
        "reserved": {}
      }),
      muteHttpExceptions: true
    },
    {
      url: API_URL,
      method: "post",
      headers: commonHeaders,
      payload: JSON.stringify({
        "type": "request",
        "version": "1.0",
        "format": "json",
        "name": "查詢",
        "para": { "method": "role" },
        "reserved": {}
      }),
      muteHttpExceptions: true
    }
  ];

  try {
    // 3. 使用 fetchAll 同時發出所有請求 (並行)
    const responses = UrlFetchApp.fetchAll(requests);

    // 4. 解析結果並打包
    const resultObject = {
      operation1: JSON.parse(responses[0].getContentText()),
      operation2: JSON.parse(responses[1].getContentText()),
      operation3: JSON.parse(responses[2].getContentText()),
      timestamp: new Date().toISOString()
    };
console.log(resultObject.operation2.result.list)
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