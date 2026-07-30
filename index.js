const { Bot, session, InlineKeyboard, Keyboard } = require('grammy');
const { saveOrder } = require('./googleSheets');
const http = require('http');
require('dotenv').config();

const bot = new Bot(process.env.BOT_TOKEN);

// -------------------------------------------------------------
// 1. СЕССИИ (Хранение состояния пользователя)
// -------------------------------------------------------------
bot.use(
  session({
    initial: () => ({ step: 'idle', bookingData: {}, quiz: {} }),
  })
);

// -------------------------------------------------------------
// 🛠️ БЕЗОПАСНОЕ ЛОГИРОВАНИЕ ДЕЙСТВИЙ АДМИНУ
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
    console.error('⚠️ Не удалось отправить лог админу:', e.message);
  }
}

// -------------------------------------------------------------
// 📦 БАЗА ДАННЫХ МОДЕЛЕЙ, ЦЕН И FILE_ID ФОТОГРАФИЙ
// -------------------------------------------------------------
const MODELS_INFO = {
  'ortonica620': {
    name: 'Ортоника Pulse 620',
    photos: [
      'AgACAgIAAxkBAAIDRmporP2hTjvfnLvD6rAxHVuksNTGAAKGGGsbRhdJSz-_U9sW8vehAQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDR2porP13XI-jsZ_43CQ2uxYJxSTXAAKHGGsbRhdJSwXqCAWmF0h8AQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDSGporP1F2ajD7TAfq9gZODAaSiVvAAKIGGsbRhdJS6yqQ-bYkB3NAQADAgADeQADPQQ',
      'AgACAgIAAxkBAAIDSWporP3yqTe8z8GbtVBpllbtPC75AAKJGGsbRhdJS68aPQKZGzNpAQADAgADeQADPQQ',
    ],
    specs: 
      '🚀 <b>Скорость:</b> 6 км/ч\n' +
      '⚡ <b>Запас хода:</b> до 20 км\n' +
      '🔋 <b>АКБ:</b> литиевый 2×12 Ah\n' +
      '⚙️ <b>Двигатели:</b> 2×250 W\n' +
      '🛋 <b>Подвеска:</b> независимая передних колес\n' +
      '🪶 <b>Вес:</b> всего 26 кг\n' +
      '📏 <b>Ширина сиденья:</b> 45.5 см\n' +
      '📦 <b>Складывание «книжка»:</b> общая ширина 54.5 см (пройдет в любой проем)',
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
    name: 'Ортоника Pulse 650',
    photos: [
      'AgACAgIAAxkBAAIDMGporKMGWQABF3HRXyDeZLlh-TkobQACHBdrGzKZSUvnIDxoWxIjUAEAAwIAA3kAAz0E',
      'AgACAgIAAxkBAAIDMWporKOTnILyLftDdLuY0cP5-i-PAAIdF2sbMplJS7ALqMXwjdl0AQADAgADeQADPQQ',
      'AgACAgIAAxkBAAIDMmporKMSeN9HGngI1aXW-pfh5EOXAAIeF2sbMplJS4BX-Ygf_6RXAQADAgADeQADPQQ',
    ],
    specs: 
      '🚀 <b>Скорость:</b> 6 км/ч\n' +
      '⚡ <b>Запас хода:</b> до 20 км\n' +
      '🔋 <b>АКБ:</b> литиевый 2×12 Ah\n' +
      '⚙️ <b>Двигатель:</b> 2×250 W\n' +
      '🛏 <b>Угол наклона спинки:</b> 90°–150° (есть подголовник)\n' +
      '📦 <b>Складывание «книжка»:</b> высота в сложенном виде всего 40 см\n' +
      '🏋️ <b>Макс. нагрузка:</b> 130 кг\n' +
      '📏 <b>Ширина сиденья:</b> 45 см | ⚖️ <b>Вес:</b> 33.5 кг',
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
    name: 'Ортоника Pulse 690',
    photos: [
      'AgACAgIAAxkBAAIDNmporMeauN22G8MJctoWqletiWDdAAJ9GGsbRhdJSxH6XErmFqLWAQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDN2porMfMbETiayTN-7yy8DZfDxnAAAJ-GGsbRhdJS6h412M3A46oAQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDOGporMdXgp0Q_EdG37CzBXFdznbeAAJ_GGsbRhdJS7iGPn6X4B_kAQADAgADeQADPQQ',
      'AgACAgIAAxkBAAIDOWporMe-ovWKTaS_ivVe8cQZpk4vAAKAGGsbRhdJS5Ia9ErS4uL1AQADAgADeAADPQQ',
    ],
    specs: 
      '🚀 <b>Скорость:</b> до 8 км/ч 🔥\n' +
      '⚡ <b>Запас хода:</b> до 20 км\n' +
      '⏱ <b>Быстрое складывание:</b> за 3 секунды\n' +
      '💡 <b>Освещение:</b> сенсорный фонарик + световая панель АКБ\n' +
      '⚙️ <b>Двигатель:</b> 2×250 W\n' +
      '🏋️ <b>Макс. нагрузка:</b> 150 кг (усиленная рама)\n' +
      '⚖️ <b>Вес:</b> 25 кг | 📏 <b>Высота сложенная:</b> 45.5 см',
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
    name: 'Ортоника Pulse 750',
    photos: [
      'AgACAgIAAxkBAAIDPmporOGXMwmT4D83_jOIHiuv9XHvAAKCGGsbRhdJSyVEdha2j0a1AQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDP2porOFbwP_sReVvMg-EVheo6ZAVAAKDGGsbRhdJS-txm9vuEkkHAQADAgADeAADPQQ',
      'AgACAgIAAxkBAAIDQGporOHC9bmi8lbrpkA2scloX2RvAAKEGGsbRhdJS6b_1hYnIk0tAQADAgADeQADPQQ',
      'AgACAgIAAxkBAAIDQWporOGXn7Kw3Fexf2mG6NfJJPvdAAKFGGsbRhdJS_b9k1JOrL_PAQADAgADeQADPQQ',
    ],
    specs: 
      '🚀 <b>Скорость:</b> 6 км/ч\n' +
      '⚡ <b>Запас хода:</b> до 25 км\n' +
      '🤖 <b>Авто-складывание:</b> с пульта или через приложение\n' +
      '⚙️ <b>Двигатель:</b> 2×200 W | 🔋 <b>АКБ:</b> Литий-ионный 20 Ah\n' +
      '🔄 <b>Радиус разворота:</b> 76 см (всенаправленные колеса 360°)\n' +
      '🏋️ <b>Макс. нагрузка:</b> 120 кг | ⚖️ <b>Вес:</b> 43 кг\n' +
      '📏 <b>Ширина сиденья:</b> 43 см',
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
// 📍 ОСНОВНЫЕ КОМАНДЫ И МЕНЮ
// -------------------------------------------------------------
bot.command(['start', 'menu'], async (ctx) => {
  if (ctx.session) ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Запустил бота (/start)');
  await ctx.reply(
    `Здравствуйте, ${ctx.from.first_name}!\n\n` +
    `Вас приветствует сервис аренды электроколясок. Выберите интересующий раздел меню:`,
    { reply_markup: getMainMenuKeyboard() }
  );
});

bot.hears('🏠 Главное меню', async (ctx) => {
  if (ctx.session) ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Нажал «Главное меню»');
  await ctx.reply('Вы вернулись в главное меню:', { reply_markup: getMainMenuKeyboard() });
});

bot.hears('🛵 Каталог колясок', async (ctx) => {
  if (ctx.session) ctx.session.step = 'idle';
  await notifyAdminLog(ctx, 'Открыл «Каталог колясок»');
  await ctx.reply(
    '🛵 <b>Каталог электроколясок</b>\n\n' +
    'Выберите модель для просмотра характеристик, фото и тарифов:',
    { parse_mode: 'HTML', reply_markup: getCatalogKeyboard() }
  );
});

// 🔥 ОТПРАВКА КАРТОЧКИ И ВСЕЙ ГАЛЕРЕИ ФОТОГРАФИЙ
bot.callbackQuery(/^model_(.+)$/, async (ctx) => {
  const modelKey = ctx.match[1];
  const model = MODELS_INFO[modelKey];

  if (!model) return ctx.answerCallbackQuery('Модель не найдена').catch(() => {});

  await notifyAdminLog(ctx, `Смотрит модель: ${model.name}`);
  await ctx.answerCallbackQuery().catch(() => {});

  // 1. Отправляем ВСЕ фотографии модели альбомом (галереей)
  if (model.photos && model.photos.length > 0) {
    try {
      const mediaGroup = model.photos.map(fileId => ({
        type: 'photo',
        media: fileId,
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
    } catch (err) {
      console.error('⚠️ Ошибка отправки альбома фото:', err.message);
    }
  }

  // 2. Клавиатура выбора срока
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
    `📋 <b>Характеристики:</b>\n` +
    `${model.specs}\n\n` +
    `💰 <b>Выберите срок аренды:</b>\n` +
    `<i>Чем дольше срок — тем ниже стоимость в сутки!</i>`;

  // 3. Отправляем текст карточки и интерактивные кнопки
  await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: keyboard });
});

bot.callbackQuery('back_to_catalog', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.reply('🛵 <b>Каталог электроколясок:</b>', { parse_mode: 'HTML', reply_markup: getCatalogKeyboard() });
});

// -------------------------------------------------------------
// 🔥 ВЫБОР ПЕРИОДА АРЕНДЫ
// -------------------------------------------------------------
bot.callbackQuery(/^book_([^_]+)_(.+)$/, async (ctx) => {
  const modelKey = ctx.match[1];
  const periodKey = ctx.match[2];
  const model = MODELS_INFO[modelKey];

  if (!model) {
    return ctx.answerCallbackQuery({ text: 'Модель не найдена', show_alert: true }).catch(() => {});
  }

  const selectedPeriod = model.prices[periodKey];

  if (!ctx.session) ctx.session = {};
  ctx.session.bookingData = {
    model: model.name,
    period: `${selectedPeriod.name} (${selectedPeriod.price.toLocaleString('ru-RU')} ₽)`,
  };

  await ctx.answerCallbackQuery().catch(() => {});
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

bot.callbackQuery('accept_fz152_go', async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  if (!ctx.session) ctx.session = {};
  ctx.session.step = 'awaiting_fio';
  await ctx.reply('Отлично! Введите, пожалуйста, ваше <b>ФИО полностью</b>:', { parse_mode: 'HTML' });
});

// -------------------------------------------------------------
// 📝 ПОШАГОВЫЙ СБОР ДАННЫХ
// -------------------------------------------------------------
bot.on('message', async (ctx, next) => {
  const step = ctx.session?.step;

  if (step === 'awaiting_fio') {
    if (!ctx.message.text) return ctx.reply('Пожалуйста, введите ваше ФИО текстом.');
    
    if (!ctx.session.bookingData) ctx.session.bookingData = {};
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

  if (step === 'awaiting_phone') {
    const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
    if (!phone) return ctx.reply('Пожалуйста, отправьте номер телефона.');

    if (!ctx.session.bookingData) ctx.session.bookingData = {};
    ctx.session.bookingData.phone = phone;
    ctx.session.step = 'awaiting_address';

    return ctx.reply('Укажите <b>город, адрес и желаемую дату/время доставки</b>:', { 
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
  }

  if (step === 'awaiting_address') {
    if (!ctx.message.text) return ctx.reply('Пожалуйста, укажите адрес и дату текстом.');

    const addressAndDate = ctx.message.text;
    const booking = ctx.session.bookingData || {};
    ctx.session.step = 'idle';

    try {
      await saveOrder({
        userId: ctx.from.id,
        fio: booking.fio || 'Не указано',
        phone: booking.phone || 'Не указан',
        addressAndDate,
        model: booking.model || 'Не указана',
        period: booking.period || 'Не указан',
      });
    } catch (e) {
      console.error('⚠️ Ошибка записи в Таблицу:', e.message);
    }

    const finishText = 
      `🎉 <b>Ваша заявка успешно принята!</b>\n\n` +
      `🛵 <b>Модель:</b> ${booking.model || 'Не указана'}\n` +
      `⏱ <b>Период:</b> ${booking.period || 'Не указан'}\n` +
      `👤 <b>ФИО:</b> ${booking.fio || 'Не указано'}\n` +
      `📞 <b>Телефон:</b> ${booking.phone || 'Не указано'}\n` +
      `📍 <b>Адрес и дата:</b> ${addressAndDate}\n\n` +
      `📞 <b>Менеджер свяжется с вами в ближайшее время для подтверждения.</b>`;

    await ctx.reply(finishText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });

    const adminMsg = 
      `📥 <b>НОВАЯ ЗАЯВКА НА АРЕНДУ!</b>\n\n` +
      `🛵 <b>Модель:</b> ${booking.model || 'Не указана'}\n` +
      `⏱ <b>Период:</b> ${booking.period || 'Не указан'}\n` +
      `👤 <b>ФИО:</b> ${booking.fio || 'Не указано'}\n` +
      `📞 <b>Тел:</b> ${booking.phone || 'Не указано'}\n` +
      `📍 <b>Адрес/Дата:</b> ${addressAndDate}\n\n` +
      `💬 <a href="tg://user?id=${ctx.from.id}">Написать клиенту</a>`;

    try {
      if (process.env.ADMIN_CHAT_ID) {
        await ctx.api.sendMessage(process.env.ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' });
      }
    } catch (adminErr) {
      console.error('⚠️ Ошибка отправки админу:', adminErr.message);
    }

    return;
  }

  return next();
});

// -------------------------------------------------------------
// ИНФОРМАЦИОННЫЕ РАЗДЕЛЫ
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

// -------------------------------------------------------------
// 🔍 ВСТРОЕННЫЙ ГЕНЕРАТОР FILE_ID (ДЛЯ АДМИНИСТРАТОРА)
// -------------------------------------------------------------
bot.on('message:photo', async (ctx) => {
  const photo = ctx.message.photo.pop();
  await ctx.reply(
    `📸 <b>Ваш file_id для кода:</b>\n\n` +
    `<code>${photo.file_id}</code>\n\n` +
    `<i>Нажмите на код выше, чтобы скопировать его</i>`,
    { parse_mode: 'HTML' }
  );
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
