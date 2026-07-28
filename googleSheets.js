const { google } = require('googleapis');
require('dotenv').config();

async function saveOrder(orderData) {
  try {
    // 1. Парсим сервисный аккаунт из переменных окружения
    if (!process.env.GOOGLE_CREDENTIALS) {
      throw new Error('Переменная GOOGLE_CREDENTIALS не задана на Render!');
    }
    
    if (!process.env.SPREADSHEET_ID) {
      throw new Error('Переменная SPREADSHEET_ID не задана на Render!');
    }

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    // 2. Авторизация в Google API
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 3. Данные для добавления (Дата, ID, ФИО, Телефон, Адрес, Модель, Период)
    const currentDate = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    
    const values = [
      [
        currentDate,
        orderData.userId || '',
        orderData.fio || '',
        orderData.phone || '',
        orderData.addressAndDate || '',
        orderData.model || '',
        orderData.period || '',
      ],
    ];

    // 4. Отправка строки в таблицу (Лист1)
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Лист1!A:G', // Проверьте название вкладки (Лист1 или Sheet1)
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log('✅ Заказ успешно записан в Google Таблицу!');
  } catch (error) {
    console.error('❌ Ошибка записи в Google Таблицу:', error.message);
    throw error; // Бросаем ошибку дальше, чтобы увидеть её в логах
  }
}

module.exports = { saveOrder };
