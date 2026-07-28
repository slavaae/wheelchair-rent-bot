const { google } = require('googleapis');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Запись новой заявки в лист Orders
async function saveOrder(orderData) {
  try {
    const values = [[
      new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
      orderData.userId || '—',
      orderData.fio || '—',
      orderData.phone || '—',
      orderData.addressAndDate || '—',
      orderData.model || '—',
      orderData.period || '—',
      'Новая'
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:H', // Название листа должно быть строго Orders
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    console.log('✅ Успешно записано в Google Таблицу');
    return true;
  } catch (error) {
    console.error('❌ Ошибка записи заявки в Google Таблицу:', error.message);
    return false;
  }
}

module.exports = {
  saveOrder,
};