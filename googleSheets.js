const { google } = require('googleapis');
require('dotenv').config();

async function saveOrder(orderData) {
  try {
    let credentials;
    
    // 1. Безопасный парсинг credentials из ENV
    if (typeof process.env.GOOGLE_CREDENTIALS === 'string') {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } else {
      credentials = process.env.GOOGLE_CREDENTIALS;
    }

    // 2. Исправление переноса строк в приватном ключе
    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    // 3. Авторизация в Google API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 🕒 Формируем время по Москве
    const nowMoscow = new Date().toLocaleString('ru-RU', { 
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 📝 Формируем массив колонок для таблицы (от A до H)
    const row = [
      nowMoscow,                          // A: Дата и время
      orderData.userId || '',             // B: Telegram ID
      orderData.fio || '',                // C: ФИО
      orderData.phone || '',              // D: Телефон
      orderData.model || '',              // E: Модель
      orderData.period || '',             // F: Период/Тариф
      orderData.addressAndDate || '',     // G: Адрес и дата
      '🟡 Новая'                         // H: Статус заявки по умолчанию
    ];

    // 4. Запись строки в таблицу
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Лист1!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log('✅ Заявка с временем и статусом записана в Таблицу!');
  } catch (error) {
    console.error('❌ Ошибка записи в Google Таблицу:', error.message);
    throw error;
  }
}

module.exports = { saveOrder };
