// @ts-nocheck
// configuration
var apiToken = "YOUR_BOT_API";
var telegramUrl = 'https://api.telegram.org/bot' + apiToken;
var appUrl   = "YOUR_APPSCRIPT_URL";
var ssID = "YOUR_SHEET_ID";
var apiGPT = "YOUR_API_KEY";

let lst_groupID = 'YOUR_LIST_OF_GROUPID_APPROVED';

// set webhook
function setWebhook(){
  const url = telegramUrl + "/setWebhook?url="+appUrl;
  const res = UrlFetchApp.fetch(url);

  // Logger.log(res.getContentText());
}

function sendMessage(id, text) {
  const url = telegramUrl + "/sendMessage?chat_id=" + id + "&text=" + text;
  const payload = {
                  method : 'POST', 
                  payload: {
                    chat_id: apiToken, 
                    text: text
                  }
                };
  UrlFetchApp.fetch(url, payload);
}


// handle webhook
function doPost(e){
  const webhookData = JSON.parse(e.postData.contents);
  Logger.log(webhookData)

  const userID = webhookData.message.from.id;
  const groupID = webhookData.message.chat.id;
  const name = webhookData.message.from.first_name;
  let text = webhookData.message.text;

  if (text.startsWith("/url")) {
    text = text.substring(4);

    const item = text.split(";");
    const sheet = SpreadsheetApp.openById(ssID).getSheetByName('Storage');
    
    sheet.appendRow([new Date(), groupID, name, item[0].trim(), item[1].trim(), item[2].trim(), item[3].trim()]);
    
    sendMessage(groupID, "Complete............");
  }

  if (text.startsWith("/task") && lst_groupID.includes(groupID)) {
    text = text.substring(5);

    const item = text.split(";");
    
    let lst_feature = ['describe', 'reason', 'responsible', 'link', 'note']
    checkMissingFeatures(item, lst_feature, lst_feature.length, groupID)

    const sheet = SpreadsheetApp.openById(ssID).getSheetByName('Task_sheet');
    const sheet_taskID_ref = SpreadsheetApp.openById(ssID).getSheetByName('task_id_ref');
    const task_id = sheet_taskID_ref.getRange('A1').getValue();

    if (task_id === "") {
      task_id = 1;
    }

    const lastColumn = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    let rowData = [];

    rowData.push(task_id);
    rowData.push(new Date());
    rowData.push(groupID);
    rowData.push(userID);
    rowData.push(name);
    rowData = rowData.concat(item.map(function(value) {return value.trim(); }));
    rowData.push('new');

    // get user_name for @tag
    const user_name = item[2].trim();

    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    // Update task_id for new record 
    sheet_taskID_ref.getRange('A1').setValue(task_id + 1);

    // response task id for target member 
    const responseMessage = user_name + " Task ID: " + (task_id);
    sendMessage(groupID, responseMessage);
  }

  if (text.startsWith("/completeTask") && lst_groupID.includes(groupID)) {

      // get task id from input text
      const arr = text.split(" ")
      const task_id = parseInt(arr[arr.length-1])

      // Retrieve data
      let currentSheet = SpreadsheetApp.openById(ssID).getSheetByName('Task_sheet');
      const currentData = currentSheet.getDataRange().getValues();

      // Find the target row
      let rowIndex = -1;
      for (let i = 0; i < currentData.length; i++) {
        let rowId = currentData[i][0]; 
        if (rowId === task_id) {
          rowIndex = i;
          break;
        }
      }
      // Move to another sheet
      if (rowIndex !== -1) {
        var targetSheet = SpreadsheetApp.openById(ssID).getSheetByName('Task_complete');
        let targetLastRow = targetSheet.getLastRow();
        var recordData = currentData[rowIndex];

        // Change status before send to another sheet
        const index_status = recordData.length - 1;
        recordData[index_status] = 'Done';
        targetSheet.getRange(targetLastRow + 1, 1, 1, recordData.length).setValues([recordData]);
      }
      // Remove the record from the current sheet
      currentSheet.deleteRow(rowIndex + 1);

      const responseMessage ="@YOUR_TARGET_USER" +" Task ID: "+(task_id)+ ', ' +recordData[5] + ', ' +recordData[7] + ', ' + targetSheet.getParent().getUrl();
      sendMessage(groupID, responseMessage);
    }
  

  if (text.startsWith("/chatgpt") && lst_groupID.includes(groupID)) {
    // remove /chatgpt not split because avoid ; in user's question 
    text = text.substring(9);
    const prompt = text + 'Trả lời câu hỏi trên mà không sử dụng các ký tự đặc biệt và không cần nhắc lại câu hỏi'
    
    if (text.split(" ").length <= 150) {
      sendMessage(groupID, 'Responding......')
      // attribute option of gpt model 
      const url = "https://api.openai.com/v1/completions";

      const payload = {
        prompt: prompt,
        model : "gpt-3.5-turbo-instruct",
        temperature: 0.7,
        max_tokens: 1000
      };

      const options = {
        method: 'post',
        headers: { Authorization : "Bearer " + apiGPT,
                  'Content-Type': "application/json; charset=utf-8"},
        payload: JSON.stringify(payload),
      };
      
      const results = JSON.parse(UrlFetchApp.fetch(url, options).getContentText());

      const outputText = results.choices[0].text.replace(/\n/g, '.').replace(/[^a-zA-ZÀ-ỹ\s.,]/g, '');

      const sheet = SpreadsheetApp.openById(ssID).getSheetByName('GPT');
      sheet.appendRow([text, outputText]); 

      sendMessage(groupID, outputText);
    } else { 
      sendMessage(groupID, 'You should ask questions under 150 words in length!!!');
    }
  }
}

// function check missing feature 
function checkMissingFeatures(inputList, lst_feature, requiredFeatureCount, groupID) {
  let missingFeatureCount = requiredFeatureCount - inputList.length;
  if (missingFeatureCount > 0) {
    let missingFeatures = lst_feature.slice(-missingFeatureCount);
    sendMessage(groupID, `Missing attribute: ${missingFeatures.join(", ")}`);
  }  
}


// function doGet(e){
//   return ContentService.createTextOutput("Method GET not allowed");
// }  