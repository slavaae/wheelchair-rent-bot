const { Bot, session, InlineKeyboard, Keyboard } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const { saveOrder } = require('./googleSheets');
const http = require('http');
require('dotenv').config();

const bot = new Bot(process.env.BOT_TOKEN);

// -------------------------------------------------------------
// 1. ПОДКЛЮЧЕНИЕ СЕССИЙ И РАЗГОВОРОВ (СТРОГИЙ ПОРЯДОК)
// -------------------------------------------------------------
bot.use(
  session({
    initial: () => ({ bookingData: {}, quiz: {} }),
  })
);

bot.use(conversations());

// -------------------------------------------------------------
// 🛠️ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ЛОГИРОВАНИЯ ДЕЙСТВИЙ В ЛС АДМИНУ
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
      'AgACAgIAAxkBAAMaamfVDXOjhGMWrRjVy-jCwYdcZmYAAjEjaxvS5jlLz-X3Y-jJYn4BAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAAMbamfVDQ7fyrMzuw1T0DUoWBal4ecAAjMjaxvS5jlLWNYtVMUoeWoBAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAAMcamfVDSD1Ca3S9AvoCs6XUDb3jNAAAjQjaxvS5jlL9gv1HSdurkABAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAAMdamfVDcIluCeUO_5XSYD9V8aO4SEAAjUjaxvS5jlLObBYO01WkYQBAAMCAAN5AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 26 кг\n🏋️ Макс. нагрузка: 120 кг\n🟢 Доступная стоимость. Прочная конструкция, которую сложно повредить.',
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
      'AgACAgIAAxkBAAN9amfaSDhJJD6vHGpkMenOB94wdIIAAkUjaxvS5jlLlP-fPJA6JHABAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAAN-amfaSMXWckW-9JDEtzNrBvwrWcwAAkYjaxvS5jlLIgwors7eKCoBAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAAN_amfaSD2D1VP1dXyf3ihKtVML5agAAkcjaxvS5jlLRR1gBkAfvW0BAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAAOAamfaSE8CWdw5UlahL7MIiy4I1AMAAkgjaxvS5jlLrdSCLqJ6NgwBAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAAOBamfaSIC2Bhg-A_Ok3TcNlkv4iMAAAkkjaxvS5jlLDcv6GKaPiWsBAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAAOCamfaSO6tfk0QftMj3CZxHOlOD5EAAkojaxvS5jlLSUgBHr18BoQBAAMCAAN5AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 23 кг\n🏋️ Макс. нагрузка: 130 кг\n🟢 Самая компактная модель. Идеальна для квартиры.',
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
      'AgACAgIAAxkBAANYamfaAAFSA74kqbD8p5Z-USgiDf2BAAI3I2sb0uY5SzP3adhBiqgfAQADAgADeAADPQQ',
      'AgACAgIAAxkBAANZamfaAAHLL1IS6tEIawvFrrxQop8DAAI4I2sb0uY5S3FyWmpfdi1PAQADAgADeAADPQQ',
      'AgACAgIAAxkBAANaamfaAAFHp7KWf8mWgURNEYE2dWX2AAI5I2sb0uY5S9w9qC7CDvAAAQEAAwIAA3gAAz0E',
      'AgACAgIAAxkBAANbamfaAAHA6OdWiG8IYNpf7neQJnZPAAI6I2sb0uY5S3Fb9NPJpDgGAQADAgADeAADPQQ',
      'AgACAgIAAxkBAANcamfaAAE5L-ZXDgHLpks2Y1LPhPZhAAI7I2sb0uY5S6ryOIDmTVx2AQADAgADeAADPQQ',
      'AgACAgIAAxkBAANdamfaAAHqwbhnQfwf2uK3g0HvhFfxAAI8I2sb0uY5S95ph7xtUf2lAQADAgADeAADPQQ',
    ],
    specs: '🚀 Скорость: 8 км/ч\n⚡ Запас хода: 20 км\n⚖️ Вес: 25 кг\n🏋️ Макс. нагрузка: 150 кг\n🟢 Стильное кресло с приятной эргономикой.',
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
      'AgACAgIAAxkBAANuamfaOX9vYbFLpINL6z_KfqEmlGQAAj4jaxvS5jlLgPYYSha1t6UBAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAANvamfaOfVcCzH-OmjqHo-RmJb4SxsAAj8jaxvS5jlL9Sl8vrEvGggBAAMCAAN5AAM9BA',
      'AgACAgIAAxkBAANwamfaOedxoyzZ7a0W5eY9Kj7OKOwAAkAjaxvS5jlL8RV5NmpjqYUBAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAANxamfaOfKTmCLMVj64XQKWp5SSidQAAkEjaxvS5jlLeCRnTO_udHoBAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAANyamfaOe2O0DB1KzHR-Nhk93_8nTcAAkIjaxvS5jlLmAfUBuGTQHMBAAMCAAN4AAM9BA',
      'AgACAgIAAxkBAANzamfaOQ9tKa53k6qsftRnq0U4PB0AAkMjaxvS5jlLOaVMdHsoGpQBAAMCAAN4AAM9BA',
    ],
    specs: '🚀 Скорость: 6 км/ч\n⚡ Запас хода: 25 км\n⚖️ Вес: 43 кг\n🏋️ Макс. нагрузка: 120 кг\n🟢 Флагман со всенаправленными колесами.',
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
// 📋 РАЗГОВОР ОФОРМЛЕНИЯ ЗАКАЗА
// -------------------------------------------------------------
async function bookingConversation(conversation, ctx) {
  const booking = await conversation.external((ctx) => {
    return ctx.session?.bookingData || { model: 'Не указана', period: 'Не указан' };
  });

  const fzKeyboard = new InlineKeyboard().text('✅ Согласен с ФЗ-152', 'accept_fz152');
  
  await ctx.reply(
    '🔒 <b>Обработка персональных данных (ФЗ-152)</b>\n\n' +
    'Нажимая кнопку «Согласен», вы даете согласие на обработку персональных данных ' +
    'для оформления договора аренды.\n\n' +
    '⚠️ <i>Напоминаем: при передаче коляски потребуется оригинал паспорта РФ.</i>',
    { parse_mode: 'HTML', reply_markup: fzKeyboard }
  );

  await conversation.waitForCallbackQuery('accept_fz152');
  await ctx.reply('Отлично! Введите, пожалуйста, ваше <b>ФИО полностью</b>:', { parse_mode: 'HTML' });

  // 1. ФИО
  const fioCtx = await conversation.waitFor('message:text');
  const fio = fioCtx.message.text;

  // 2. Телефон
  const phoneKeyboard = new Keyboard()
    .requestContact('📱 Поделиться номером телефона')
    .resized()
    .oneTime();

  await ctx.reply('Укажите ваш контактный номер телефона (или нажмите кнопку ниже):', { 
    reply_markup: phoneKeyboard 
  });

  const phoneCtx = await conversation.waitFor(['message:contact', 'message:text']);
  const phone = phoneCtx.message.contact 
    ? phoneCtx.message.contact.phone_number 
    : phoneCtx.message.text;

  // 3. Адрес и Дата
  const mainKeyboard = getMainMenuKeyboard();
  await ctx.reply('Укажите <b>город, адрес и желаемую дату/время доставки</b>:', { 
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true }
  });
  
  const addressCtx = await conversation.waitFor('message:text');
  const addressAndDate = addressCtx.message.text;

  // 4. Запись в Google Таблицу
  try {
    await saveOrder({
      userId: ctx.from.id,
      fio,
      phone,
      addressAndDate,
      model: booking.model,
      period: booking.period,
    });
  } catch (e) {
    console.error('Ошибка записи в Google Таблицу:', e.message);
  }

  // 5. Ответ клиенту
  const finishText = 
    `🎉 <b>Ваша заявка успешно принята!</b>\n\n` +
    `🛵 <b>Модель:</b> ${booking.model}\n` +
    `⏱ <b>Период:</b> ${booking.period}\n` +
    `👤 <b>ФИО:</b> ${fio}\n` +
    `📞 <b>Телефон:</b> ${phone}\n` +
    `📍 <b>Адрес и дата:</b> ${addressAndDate}\n\n` +
    `📞 <b>Менеджер свяжется с вами в ближайшее время для подтверждения.</b>`;

  await ctx.reply(finishText, { parse_mode: 'HTML', reply_markup: mainKeyboard });

  // 6. Уведомление администратору
  const adminMsg = 
    `📥 <b>НОВАЯ ЗАЯВКА НА АРЕНДУ!</b>\n\n` +
    `🛵 <b>Модель:</b> ${booking.model}\n` +
    `⏱ <b>Период:</b> ${booking.period}\n` +
    `👤 <b>ФИО:</b> ${fio}\n` +
    `📞 <b>Тел:</b> ${phone}\n` +
    `📍 <b>Адрес/Дата:</b> ${addressAndDate}\n\n` +
    `💬 <a href="tg://user?id=${ctx.from.id}">Написать клиенту</a>\n` +
    `📄 <i>Не забудьте проверить паспорт РФ при передаче!</i>`;

  try {
    if (process.env.ADMIN_CHAT_ID) {
      await ctx.api.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' });
    }
  } catch (adminErr) {
    console.error('Ошибка отправки админу:', adminErr.message);
  }
}

// -------------------------------------------------------------
// 2. РЕГИСТРАЦИЯ КОНВЕРСАЦИИ
// -------------------------------------------------------------
bot.use(createConversation(bookingConversation));

// -------------------------------------------------------------
// 🪟 КНОПКИ И ОБРАБОТЧИКИ
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

bot.command(['start', 'menu'], async (ctx) => {
  await notifyAdminLog(ctx, 'Запустил бота (/start)');
  await ctx.reply(
    `Здравствуйте, ${ctx.from.first_name}!\n\n` +
    `Вас приветствует сервис аренды электроколясок. Выберите интересующий раздел меню:`,
    { reply_markup: getMainMenuKeyboard() }
  );
});

bot.hears('🏠 Главное меню', async (ctx) => {
  await notifyAdminLog(ctx, 'Нажал «Главное меню»');
  await ctx.reply('Вы вернулись в главное меню:', { reply_markup: getMainMenuKeyboard() });
});

bot.hears('🛵 Каталог колясок', async (ctx) => {
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
    await ctx.replyWithMediaGroup(mediaGroup);
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

bot.callbackQuery(/^book_([^_]+)_(.+)$/, async (ctx) => {
  const modelKey = ctx.match[1];
  const periodKey = ctx.match[2];
  const model = MODELS_INFO[modelKey];

  if (!model) {
    return ctx.answerCallbackQuery({ text: 'Модель не найдена', show_alert: true });
  }

  const selectedPeriod = model.prices[periodKey];

  // Безопасная инициализация сессии
  if (!ctx.session) ctx.session = {};
  ctx.session.bookingData = {
    model: model.name,
    period: `${selectedPeriod.name} (${selectedPeriod.price.toLocaleString('ru-RU')} ₽)`,
  };

  await notifyAdminLog(ctx, `Выбрал тариф: ${model.name} — ${selectedPeriod.name}`);
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter('bookingConversation');
});

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

// -------------------------------------------------------------
// ❓ ОПРОС
// -------------------------------------------------------------
bot.hears('❓ Нужна консультация', async (ctx) => {
  await notifyAdminLog(ctx, 'Запустил опрос подбора');
  if (!ctx.session) ctx.session = {};
  ctx.session.quiz = {};
  
  const keyboard = new InlineKeyboard()
    .text('До 80 кг', 'quiz_w_80').row()
    .text('80 – 110 кг', 'quiz_w_110').row()
    .text('Более 110 кг', 'quiz_w_140');

  await ctx.reply('<b>Шаг 1 из 3:</b> Укажите примерный вес пользователя:', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^quiz_w_(.+)$/, async (ctx) => {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.quiz) ctx.session.quiz = {};
  ctx.session.quiz.weight = ctx.match[1];
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('🏠 В основном дома', 'quiz_l_home').row()
    .text('🌳 Прогулки по городу', 'quiz_l_city').row()
    .text('✈️ Поездки (багажник авто)', 'quiz_l_travel');

  await ctx.editMessageText('<b>Шаг 2 из 3:</b> Где планируете чаще использовать коляску?', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^quiz_l_(.+)$/, async (ctx) => {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.quiz) ctx.session.quiz = {};
  ctx.session.quiz.location = ctx.match[1];
  await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('🔋 До 20 км', 'quiz_r_short').row()
    .text('🔋 От 30 км и более', 'quiz_r_long');

  await ctx.editMessageText('<b>Шаг 3 из 3:</b> Какой запас хода вам необходим?', {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^quiz_r_(.+)$/, async (ctx) => {
  if (!ctx.session) ctx.session = {};
  if (!ctx.session.quiz) ctx.session.quiz = {};
  ctx.session.quiz.range = ctx.match[1];
  await ctx.answerCallbackQuery();

  const { weight, location } = ctx.session.quiz;
  let recKey = 'ortonica650';

  if (weight === '140' || location === 'city') recKey = 'ortonica690';
  if (location === 'travel') recKey = 'ortonica750';
  if (weight === '80' && location === 'home') recKey = 'ortonica620';

  const recommendedModel = MODELS_INFO[recKey];
  await notifyAdminLog(ctx, `Завершил опрос. Рекомендация: ${recommendedModel.name}`);

  const keyboard = new InlineKeyboard()
    .text(`Посмотреть ${recommendedModel.name}`, `model_${recKey}`).row()
    .text('📞 Консультация с менеджером', 'ask_manager');

  await ctx.editMessageText(
    `🎯 <b>Результат подбора:</b>\n\n` +
    `Вам отлично подойдет модель <b>${recommendedModel.name}</b>!\n` +
    `<i>${recommendedModel.specs.split('\n')[0]}</i>\n\n` +
    `Хотите перейти к просмотру тарифных планов этой модели?`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
});

bot.callbackQuery('ask_manager', async (ctx) => {
  await ctx.answerCallbackQuery();
  await notifyAdminLog(ctx, 'Запросил прямую связь с менеджером из опроса');
  
  const keyboard = new InlineKeyboard().url('💬 Написать Вячеславу', 'https://t.me/slava_ae');

  await ctx.reply('Менеджер уведомлен! Вы можете написать Вячеславу напрямую по кнопке ниже:', {
    reply_markup: keyboard,
  });
});

bot.catch((err) => {
  console.error('Ошибка в работе бота:', err.message);
});

// -------------------------------------------------------------
// 🌐 ВЕБ-СЕРВЕР ДЛЯ RENDER FREE WEB SERVICE
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