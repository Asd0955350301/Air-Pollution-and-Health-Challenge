/**
 * 空氣污染健康影響大挑戰－Google 試算表接收端
 * 目標試算表：
 * https://docs.google.com/spreadsheets/d/1XJ4nQeFSsh7cpjliUZL_Vu8R9Kn6EN85xNlMDDA9VL4/edit
 */

const SPREADSHEET_ID = '1XJ4nQeFSsh7cpjliUZL_Vu8R9Kn6EN85xNlMDDA9VL4';
const SHEET_NAME = '遊戲紀錄';
const TIME_ZONE = 'Asia/Taipei';

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'air-pollution-health-game',
    message: 'GAS is ready.'
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const raw = e && e.postData ? e.postData.contents : '';
    const data = JSON.parse(raw || '{}');
    const submissionId = safeText_(data.submissionId, 120);
    const playerName = safeText_(data.playerName, 30);

    if (!submissionId || !playerName) {
      throw new Error('Missing submissionId or playerName.');
    }

    const sheet = getOrCreateSheet_();
    if (isDuplicate_(sheet, submissionId)) {
      return jsonResponse_({ ok: true, duplicate: true });
    }

    const serverTime = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
    const slotSummary = Array.isArray(data.activeSlots)
      ? data.activeSlots.map(item => `Q${Number(item.level) || ''}: ${(item.slots || []).join(', ')}`).join(' | ')
      : '';

    sheet.appendRow([
      submissionId,
      serverTime,
      playerName,
      safeText_(data.locale, 20),
      safeNumber_(data.score, 0, 6),
      safeNumber_(data.maxScore, 0, 6),
      safeNumber_(data.heartsRemaining, 0, 5),
      safeNumber_(data.wrongAttempts, 0, 999),
      safeText_(slotSummary, 500),
      safeText_(data.completedAt, 60),
      safeText_(data.gameVersion, 20)
    ]);

    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: String(error && error.message || error) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function getOrCreateSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '提交編號',
      '伺服器時間（台北）',
      '玩家姓名',
      '介面語言',
      '分數',
      '滿分',
      '剩餘愛心',
      '答錯次數',
      '本次隨機空格',
      '瀏覽器完成時間',
      '遊戲版本'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 11)
      .setFontWeight('bold')
      .setBackground('#FFE07A');
    sheet.autoResizeColumns(1, 11);
  }

  return sheet;
}

function isDuplicate_(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return Boolean(
    sheet.getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(submissionId)
      .matchEntireCell(true)
      .findNext()
  );
}

function safeText_(value, maxLength) {
  let text = value == null ? '' : String(value).trim().slice(0, maxLength);
  // 避免玩家輸入被 Google 試算表當成公式執行。
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function safeNumber_(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

