const { Bot, session, InlineKeyboard, Keyboard } = require('grammy');
const { saveOrder } = require('./googleSheets');
const http = require('http');
require('dotenv').config();

const bot = new Bot(process.env.BOT_TOKEN);

// -------------------------------------------------------------
// 1. СЕССИИ (Простая надёжная схема)
// -------------------------------------------------------------
bot.use(
  session({
    initial: () => ({ step: 'idle', bookingData: {}, quiz: {} }),
  })
);

// -------------------------------------------------------------
// 🛠️ ЛОГИРОВАНИЕ ДЕЙСТВИЙ АДМИНУ
// -------------------------------------------------------------
async function notifyAdminLog(ctx, actionText) {
  try {
    if (!process.env.ADMIN_CHAT_ID) return;
    const user = ctx.from;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const username = user.username ? `@${user.username}` : 'без username';
    
    const logMsg = 
      `👀 <b>Действие клиента:</b>\n` +
      `👤 <b>Клиент:</b> <a href="tg://user?id=${user.id}">${name}</a> (${username})\n` +
      `🆔 <b>ID:</b> <code>${user.id}</code>\n` +
      `📌 <b>Событие:</b> ${actionText}`;

    await ctx.api.sendMessage(process.env.ADMIN_CHAT_ID, logMsg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Ошибка логирования действий админу:', e.message);
  }
}

// -------------------------------------------------------------
// 📦 БАЗА ДАННЫХ МОДЕЛЕЙ И ЦЕН
// -------------------------------------------------------------
const MODELS_INFO = {
  'ortonica620': {
    name: 'Ортоника 620',
    photos: [
      'AgACAgIAAxkBAAMYamfVDXqYTHvBH6p6GFI-h_ahSwEAAjAjaxvS5jlL4lgiueYZa0kBAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAAMZamfVDYjblPSiCzhGuafvj_n-TtgAAjIjaxvS5jlLmYldsmw1hZ4BAAMCAAN4AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 26 кг\n🏋️ Макс. нагрузка: 120 кг',
    prices: {
      '1d': { name: '1 день', price: 2088, daily: 2088 },
      '3d': { name: '3 дня', price: 4475, daily: 1492 },
      '7d': { name: '1 неделя (7 дней)', price: 7735, daily: 1105 },
      '14d': { name: '2 недели (14 дней)', price: 11900, daily: 850 },
      '21d': { name: '3 недели (21 день)', price: 14280, daily: 680 },
      '30d': { name: '1 месяц (30 дней)', price: 17000, daily: 567 },
    }
  },
  'ortonica650': {
    name: 'Ортоника 650',
    photos: [
      'AgACAgIAAxkBAAN8amfaSC6refFdfAMxEUjXH1uYuzIAAkQjaxvS5jlLRbTOk14z6doBAAMCAAN5AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 23 кг\n🏋️ Макс. нагрузка: 130 кг',
    prices: {
      '1d': { name: '1 день', price: 2334, daily: 2334 },
      '3d': { name: '3 дня', price: 5002, daily: 1667 },
      '7d': { name: '1 неделя (7 дней)', price: 8645, daily: 1235 },
      '14d': { name: '2 недели (14 дней)', price: 13300, daily: 950 },
      '21d': { name: '3 недели (21 день)', price: 15960, daily: 760 },
      '30d': { name: '1 месяц (30 дней)', price: 19000, daily: 633 },
    }
  },
  'ortonica690': {
    name: 'Ортоника 690',
    photos: [
      'AgACAgIAAxkBAANXamfaAAHiqFH1yBQ6UR0_LC9E62F_AAI2I2sb0uY5SzffZnbqGTx5AQADAgADeQADPQQ',
    ],
    specs: '🚀 Скорость: 8 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 25 кг\n🏋️ Макс. нагрузка: 150 кг',
    prices: {
      '1d': { name: '1 день', price: 2580, daily: 2580 },
      '3d': { name: '3 дня', price: 5528, daily: 1843 },
      '7d': { name: '1 неделя (7 дней)', price: 9555, daily: 1365 },
      '14d': { name: '2 недели (14 дней)', price: 14700, daily: 1050 },
      '21d': { name: '3 недели (21 день)', price: 17640, daily: 840 },
      '30d': { name: '1 месяц (30 дней)', price: 21000, daily: 700 },
    }
  },
  'ortonica750': {
    name: 'Ортоника 750',
    photos: [
      'AgACAgIAAxkBAANtamfaOfBzPz1bcengmeqXScRqQ2gAAj0jaxvS5jlL-ks51_fZah4BAAMCAAN4AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 25 км\n⚖️ Вес: 43 кг\n🏋️ Макс. нагрузка: 120 кг',
    prices: {
      '1d': { name: '1 день', price: 3069, daily: 3069 },
      '3d': { name: '3 дня', price: 6576, daily: 2192 },
      '7d': { name: '1 неделя (7 дней)', price: 11366, daily: 1624 },
      '14d': { name: '2 недели (14 дней)', price: 17486, daily: 1249 },
      '21d': { name: '3 недели (21 день)', price: 20983, daily: 999 },
      '30d': { name: '1 месяц (30 дней)', price: 24980, daily: 833 },
    }
  }
};

// -------------------------------------------------------------
// 🪟 КНОПКИ МЕНЮ
// -------------------------------------------------------------
function getMainMenuKeyboard() {
  return new Keyboard()
    .text('🛵 Каталог колясок').text('❓ Нужна консультация').row()
    .text('ℹ️ Условия аренды').text('📞 Контакты').row()
    .text('🏠 Главное меню')
    .resized();
}

function getCatalogKeyboard() {
  return new InlineKeyboard()
    .text('Ортоника 620 (от 567 ₽/сут)', 'model_ortonica620').row()
    .text('Ортоника 650 (от 633 ₽/сут)', 'model_ortonica650').row()
    .text('Ортоника 690 (от 700 ₽/сут)', 'model_ortonica690').row()
    .text('Ортоника 750 (от 833 ₽/сут) 🔥', 'model_ortonica750').row();
}

// -------------------------------------------------------------
// 📍 ОСНОВНЫЕ КОМАНДЫ
// -------------------------------------------------------------
bot.command(['start', 'menu'], async (ctx) => {
  ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Запустил бота (/start)');
  await ctx.reply(
    `Здравствуйте, ${ctx.from.first_name}!\n\n` +
    `Вас приветствует сервис аренды электроколясок. Выберите интересующий раздел меню:`,
    { reply_markup: getMainMenuKeyboard() }
  );
});

bot.hears('🏠 Главное меню', async (ctx) => {
  ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Нажал «Главное меню»');
  await ctx.reply('Вы вернулись в главное меню:', { reply_markup: getMainMenuKeyboard() });
});

bot.hears('🛵 Каталог колясок', async (ctx) => {
  ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Открыл «Каталог колясок»');
  await ctx.reply(
    '🛵 <b>Каталог электроколясок</b>\n\n' +
    'Выберите модель для просмотра характеристик, фото и тарифов:',
    { parse_mode: 'HTML', reply_markup: getCatalogKeyboard() }
  );
});

bot.callbackQuery(/^model_(.+)$/, async (ctx) => {
  const modelKey = ctx.match[1];
  const model = MODELS_INFO[modelKey];

  if (!model) return ctx.answerCallbackQuery('Модель не найдена');

  await notifyAdminLog(ctx, `Смотрит модель: ${model.name}`);
  await ctx.answerCallbackQuery();

  if (model.photos && model.photos.length > 0) {
    const mediaGroup = model.photos.map(fileId => ({ type: 'photo', media: fileId }));
    await ctx.replyWithMediaGroup(mediaGroup).catch(() => {});
  }

  const p = model.prices;
  const keyboard = new InlineKeyboard()
    .text(`1 день — ${p['1d'].price.toLocaleString('ru-RU')} ₽`, `book_${modelKey}_1d`).row()
    .text(`3 дня — ${p['3d'].price.toLocaleString('ru-RU')} ₽ (${p['3d'].daily} ₽/сут)`, `book_${modelKey}_3d`).row()
    .text(`1 неделя — ${p['7d'].price.toLocaleString('ru-RU')} ₽ (${p['7d'].daily} ₽/сут)`, `book_${modelKey}_7d`).row()
    .text(`2 недели — ${p['14d'].price.toLocaleString('ru-RU')} ₽ (${p['14d'].daily} ₽/сут)`, `book_${modelKey}_14d`).row()
    .text(`3 недели — ${p['21d'].price.toLocaleString('ru-RU')} ₽ (${p['21d'].daily} ₽/сут)`, `book_${modelKey}_21d`).row()
    .text(`1 месяц — ${p['30d'].price.toLocaleString('ru-RU')} ₽ 🔥 (${p['30d'].daily} ₽/сут)`, `book_${modelKey}_30d`).row()
    .text('⬅️ Назад в каталог', 'back_to_catalog');

  const caption = 
    `♿ <b>Электроколяска ${model.name}</b>\n\n` +
    `<b>Характеристики:</b>\n${model.specs}\n\n` +
    `💰 <b>Выберите срок аренды:</b>\n` +
    `<i>Чем дольше срок — тем ниже стоимость в сутки!</i>`;

  await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
});

bot.callbackQuery('back_to_catalog', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🛵 <b>Каталог электроколясок:</b>', { parse_mode: 'HTML', reply_markup: getCatalogKeyboard() });
});

// -------------------------------------------------------------
// 🔥 ВЫБОР ПЕРИОДА АРЕНДЫ (МГНОВЕННЫЙ ОТВЕТ)
// -------------------------------------------------------------
bot.callbackQuery(/^book_([^_]+)_(.+)$/, async (ctx) => {
  const modelKey = ctx.match[1];
  const periodKey = ctx.match[2];
  const model = MODELS_INFO[modelKey];

  if (!model) {
    return ctx.answerCallbackQuery({ text: 'Модель не найдена', show_alert: true });
  }

  const selectedPeriod = model.prices[periodKey];

  ctx.session.bookingData = {
    model: model.name,
    period: `${selectedPeriod.name} (${selectedPeriod.price.toLocaleString('ru-RU')} ₽)`,
  };

  await ctx.answerCallbackQuery();
  await notifyAdminLog(ctx, `Выбрал тариф: ${model.name} — ${selectedPeriod.name}`);

  const fzKeyboard = new InlineKeyboard().text('✅ Согласен с ФЗ-152', 'accept_fz152_go');

  await ctx.reply(
    '🔒 <b>Обработка персональных данных (ФЗ-152)</b>\n\n' +
    'Нажимая кнопку «Согласен», вы даете согласие на обработку персональных данных ' +
    'для оформления договора аренды.\n\n' +
    '⚠️ <i>Напоминаем: при передаче коляски потребуется оригинал паспорта РФ.</i>',
    { parse_mode: 'HTML', reply_markup: fzKeyboard }
  );
});

// Клик «Согласен с ФЗ-152» ➔ Просим ФИО
bot.callbackQuery('accept_fz152_go', async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = 'awaiting_fio';
  await ctx.reply('Отлично! Введите, пожалуйста, ваше <b>ФИО полностью</b>:', { parse_mode: 'HTML' });
});

// -------------------------------------------------------------
// 📝 ПОШАГОВЫЙ СБОР ДАННЫХ (БЕЗ ПЛАГИНА CONVERSATIONS)
// -------------------------------------------------------------
bot.on('message', async (ctx, next) => {
  const step = ctx.session?.step;

  // Если клиент вводит ФИО
  if (step === 'awaiting_fio') {
    if (!ctx.message.text) return ctx.reply('Пожалуйста, введите ваше ФИО текстом.');
    
    ctx.session.bookingData.fio = ctx.message.text;
    ctx.session.step = 'awaiting_phone';

    const phoneKeyboard = new Keyboard()
      .requestContact('📱 Поделиться номером телефона')
      .resized()
      .oneTime();

    return ctx.reply('Укажите ваш контактный номер телефона (или нажмите кнопку ниже):', { 
      reply_markup: phoneKeyboard 
    });
  }

  // Если клиент вводит Телефон (текст или кнопка «Поделиться контактом»)
  if (step === 'awaiting_phone') {
    const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
    if (!phone) return ctx.reply('Пожалуйста, отправьте номер телефона.');

    ctx.session.bookingData.phone = phone;
    ctx.session.step = 'awaiting_address';

    return ctx.reply('Укажите <b>город, адрес и желаемую дату/время доставки</b>:', { 
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
  }

  // Если клиент вводит Адрес и Дату (ФИНАЛ)
  if (step === 'awaiting_address') {
    if (!ctx.message.text) return ctx.reply('Пожалуйста, укажите адрес и дату текстом.');

    const addressAndDate = ctx.message.text;
    const booking = ctx.session.bookingData;
    ctx.session.step = 'idle'; // Сбрасываем шаг

    // 1. Запись в Google Таблицу
    try {
      await saveOrder({
        userId: ctx.from.id,
        fio: booking.fio,
        phone: booking.phone,
        addressAndDate,
        model: booking.model || 'Не указана',
        period: booking.period || 'Не указан',
      });
    } catch (e) {
      console.error('Ошибка записи в Google Таблицу:', e.message);
    }

    // 2. Ответ клиенту
    const finishText = 
      `🎉 <b>Ваша заявка успешно принята!</b>\n\n` +
      `🛵 <b>Модель:</b> ${booking.model}\n` +
      `⏱ <b>Период:</b> ${booking.period}\n` +
      `👤 <b>ФИО:</b> ${booking.fio}\n` +
      `📞 <b>Телефон:</b> ${booking.phone}\n` +
      `📍 <b>Адрес и дата:</b> ${addressAndDate}\n\n` +
      `📞 <b>Менеджер свяжется с вами в ближайшее время для подтверждения.</b>`;

    await ctx.reply(finishText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });

    // 3. Уведомление админу
    const adminMsg = 
      `📥 <b>НОВАЯ ЗАЯВКА НА АРЕНДУ!</b>\n\n` +
      `🛵 <b>Модель:</b> ${booking.model}\n` +
      `⏱ <b>Период:</b> ${booking.period}\n` +
      `👤 <b>ФИО:</b> ${booking.fio}\n` +
      `📞 <b>Тел:</b> ${booking.phone}\n` +
      `📍 <b>Адрес/Дата:</b> ${addressAndDate}\n\n` +
      `💬 <a href="tg://user?id=${ctx.from.id}">Написать клиенту</a>`;

    try {
      if (process.env.ADMIN_CHAT_ID) {
        await ctx.api.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' });
      }
    } catch (adminErr) {
      console.error('Ошибка отправки админу:', adminErr.message);
    }

    return;
  }

  return next();
});

// -------------------------------------------------------------
// ИНФОРМАЦИОННЫЕ РАЗДЕЛЫ И КОНТАКТЫ
// -------------------------------------------------------------
bot.hears('ℹ️ Условия аренды', async (ctx) => {
  await notifyAdminLog(ctx, 'Открыл «Условия аренды»');
  const text = 
    `📜 <b>Условия аренды, доставки и залога</b>\n\n` +
    `🏙️ <b>Москва и Московская область:</b>\n` +
    `• <b>Доставка:</b>\n` +
    `  — при аренде менее 32 дней — <b>2 500 ₽</b>\n` +
    `  — при аренде от 33 до 62 дней — <b>1 500 ₽</b>\n` +
    `  — при аренде более 63 дней — <b>Бесплатно</b>\n` +
    `• <b>Забор коляски:</b>\n` +
    `  — менее 32 дней — <b>1 500 ₽</b>\n` +
    `  — более 33 дней — <b>Бесплатно</b>\n` +
    `• <b>Залог:</b> <b>10 000 ₽</b>\n` +
    `• <b>Режим работы:</b> Круглосуточно\n\n` +
    `🏛️ <b>Санкт-Петербург:</b>\n` +
    `• <b>Доставка:</b> 1 600 ₽\n` +
    `• <b>Забор коляски:</b> 1 600 ₽\n` +
    `• <b>Самовывоз:</b> ул. Бурцева, д. 13\n` +
    `• <b>Режим работы:</b> с 09:00 до 20:00\n\n` +
    `📄 <b>Документы:</b> Оформление по договору. При получении обязателен оригинал <b>паспорта РФ</b>.`;

  await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.hears('📞 Контакты', async (ctx) => {
  await notifyAdminLog(ctx, 'Открыл «Контакты»');
  const text = 
    `📞 <b>Контакты и Адреса</b>\n\n` +
    `📍 <b>Санкт-Петербург (Самовывоз):</b>\n` +
    `ул. Бурцева, д. 13 (Пн-Вс: с 09:00 до 20:00)\n\n` +
    `📍 <b>Москва:</b>\n` +
    `Доставка и обработка заявок — <b>Круглосуточно</b>\n\n` +
    `📱 <b>Связь с менеджером:</b> Нажмите кнопку ниже для перехода в чат:`;

  const keyboard = new InlineKeyboard().url('💬 Написать Вячеславу', 'https://t.me/slava_ae');
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
});

bot.catch((err) => {
  console.error('Ошибка в работе бота:', err.message);
});

// -------------------------------------------------------------
// 🌐 ВЕБ-СЕРВЕР ДЛЯ RENDER
// -------------------------------------------------------------
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot is active 24/7!');
});

server.listen(PORT, () => {
  console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
});

bot.start();
console.log('🤖 Бот успешно запущен и готов к работе!');
