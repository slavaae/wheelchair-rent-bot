const { google } = require('googleapis');
require('dotenv').config();

async function saveOrder(orderData) {
  try {
    let credentials;
    
    // 1. Парсим JSON из переменной окружения
    if (typeof process.env.GOOGLE_CREDENTIALS === 'string') {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } else {
      credentials = process.env.GOOGLE_CREDENTIALS;
    }

    // 🔥 ИСПРАВЛЕНИЕ: Преобразуем экранированные \n в настоящие переносы строк
    if (credentials && credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    // 2. Авторизация в Google API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 3. Формируем строку данных
    const row = [
      new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
      orderData.userId || '',
      orderData.fio || '',
      orderData.phone || '',
      orderData.model || '',
      orderData.period || '',
      orderData.addressAndDate || '',
    ];

    // 4. Запись в таблицу
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Лист1!A:G', // Убедитесь, что вкладка в вашей таблице называется "Лист1" (или Sheet1)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log('✅ Заявка успешно записана в Google Таблицу!');
  } catch (error) {
    console.error('❌ Ошибка записи в Google Таблицу:', error.message);
    throw error;
  }
}

module.exports = { saveOrder };
