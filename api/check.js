const DEFAULT_TARGET_URL =
  'https://pass.rw.by/ru/ajax/route/car_places/?from=2100001&to=2100180&date=2026-04-21&train_number=657%D0%91&car_type=3&apply_modificator=&from_time=1776801420&_=1776706027315';

const DEFAULT_REQUEST_HEADERS = {
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  Priority: 'u=3, i',
  Referer: 'https://pass.rw.by/ru/order/places/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Safari/605.1.15',
  'X-Requested-With': 'XMLHttpRequest',
  Cookie:
    '_ga=GA1.1.451325835.1776675896; _ga_S7XDPVY02T=GS2.1.s1776705615$o2$g1$t1776706027$j31$l0$h0; _ym_visorc=w; lang=a0f082927586781ff77afecf65fdaa396819e9f3%7Eru; guid=e5dda66729b9a5eeb6a8c9bc53024b1960f7cb94%7E513400bc8d7faa30afed588c8b3d48e8; _ym_isad=2; _ym_d=1776675896; _ym_uid=1776675896547486178; accepted_cookies=undefined; cookies_status=all; hg-client-security=3CcDHInVe0bYodXugvM79sJQBnQ; session=m7oqg2sjdhsth3scsmoump88p7'
};

function normalizeSpaces(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterPlaces(places, seatFilter) {
  return places.filter((place) => {
    const num = Number(place);
    if (Number.isNaN(num)) return false;

    switch (seatFilter) {
      case 'lower_non_side':
        // Нижние не боковые полки (1, 3, 5, ..., 35)
        return num >= 1 && num <= 35 && num % 2 !== 0;
      case 'lower':
        // Все нижние полки, включая боковые (37..53)
        return num % 2 !== 0;
      case 'all':
      default:
        return true;
    }
  });
}

function wagonToItem(rawData, tariff, car, seatFilter = 'all') {
  const emptyPlaces = Array.isArray(car.emptyPlaces) ? car.emptyPlaces : [];
  const targetPlaces = filterPlaces(emptyPlaces, seatFilter);

  return {
    trainNumber: normalizeSpaces(rawData.trainNumber),
    trainType: normalizeSpaces(rawData.trainType2 || rawData.trainType),
    from: normalizeSpaces(rawData.from),
    to: normalizeSpaces(rawData.to),
    date: normalizeSpaces(rawData.route?.startDate || rawData.route?.trainDepDate),
    departureTime: normalizeSpaces(rawData.route?.startTime),
    carriageType: normalizeSpaces(tariff.type || rawData.carType),
    carriageNumber: normalizeSpaces(car.number),
    placesCount: targetPlaces.length,
    places: targetPlaces,
    totalPlacesCount: emptyPlaces.length,
    priceByn: normalizeSpaces(tariff.price_byn)
  };
}

function extractItems(rawData, seatFilter = 'all') {
  const tariffs = Array.isArray(rawData?.tariffs) ? rawData.tariffs : [];
  const items = [];

  for (const tariff of tariffs) {
    const cars = Array.isArray(tariff?.cars) ? tariff.cars : [];
    for (const car of cars) {
      items.push(wagonToItem(rawData, tariff, car, seatFilter));
    }
  }

  return items;
}

function filterItems(items, cfg) {
  return items.filter((item) => {
    if (item.placesCount < cfg.minAvailable) return false;

    const text = [
      item.trainNumber,
      item.trainType,
      item.from,
      item.to,
      item.carriageType,
      item.carriageNumber
    ]
      .join(' ')
      .toLowerCase();

    if (cfg.includeKeywords.length > 0 && !cfg.includeKeywords.some((kw) => text.includes(kw))) {
      return false;
    }

    if (cfg.excludeKeywords.length > 0 && cfg.excludeKeywords.some((kw) => text.includes(kw))) {
      return false;
    }

    return true;
  });
}

function formatPlacesByCategory(places, carriageType = '') {
  const isCoupe = /купе/i.test(carriageType);
  const lower = [];
  const upper = [];
  const sideLower = [];
  const sideUpper = [];
  const other = [];

  for (const place of places) {
    const num = Number(place);
    if (Number.isNaN(num)) {
      other.push(place);
      continue;
    }

    if (!isCoupe && num >= 37 && num <= 54) {
      if (num % 2 !== 0) {
        sideLower.push(num);
      } else {
        sideUpper.push(num);
      }
    } else if (num >= 1 && num <= 36) {
      if (num % 2 !== 0) {
        lower.push(num);
      } else {
        upper.push(num);
      }
    } else {
      other.push(num);
    }
  }

  const sortAsc = (a, b) => a - b;
  lower.sort(sortAsc);
  upper.sort(sortAsc);
  sideLower.sort(sortAsc);
  sideUpper.sort(sortAsc);

  const parts = [];
  if (lower.length > 0) {
    parts.push(`  • Нижние (${lower.length}): ${lower.join(', ')}`);
  }
  if (upper.length > 0) {
    parts.push(`  • Верхние (${upper.length}): ${upper.join(', ')}`);
  }
  if (sideLower.length > 0) {
    parts.push(`  • Боковые нижние (${sideLower.length}): ${sideLower.join(', ')}`);
  }
  if (sideUpper.length > 0) {
    parts.push(`  • Боковые верхние (${sideUpper.length}): ${sideUpper.join(', ')}`);
  }
  if (other.length > 0) {
    parts.push(`  • Другие места (${other.length}): ${other.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : `Места: ${places.join(', ')}`;
}

function formatItem(item, index, seatFilter = 'all') {
  const header =
    `${index + 1}. Поезд ${item.trainNumber} (${item.trainType}) ` +
    `${item.from} -> ${item.to}, ${item.date} ${item.departureTime}`;

  let placesSection;
  if (seatFilter === 'all') {
    const categorized = formatPlacesByCategory(item.places, item.carriageType);
    placesSection = `Свободно мест: ${item.placesCount}\n${categorized}`;
  } else {
    const placeLabel =
      seatFilter === 'lower_non_side'
        ? `Свободно нижних (не боковых) мест: ${item.placesCount} (из ${item.totalPlacesCount} всего)`
        : `Свободно нижних мест: ${item.placesCount} (из ${item.totalPlacesCount} всего)`;
    placesSection = `${placeLabel}\nМеста: ${item.places.join(', ')}`;
  }

  const body = [
    `Вагон: ${item.carriageNumber} (${item.carriageType})`,
    placesSection,
    item.priceByn ? `Цена BYN: ${item.priceByn}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return `${header}\n${body}`;
}

async function sendTelegram(text, cfg) {
  if (!cfg.telegramToken || !cfg.telegramChatId) {
    throw new Error('TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID обязательны');
  }

  const endpoint = `https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: cfg.telegramChatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ошибка Telegram API: ${response.status} ${body}`);
  }
}

async function fetchSource(cfg) {
  const headers = { ...DEFAULT_REQUEST_HEADERS };
  if (cfg.requestHeadersJson) {
    Object.assign(headers, JSON.parse(cfg.requestHeadersJson));
  }

  const response = await fetch(cfg.targetUrl, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`Источник вернул HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Источник вернул не JSON');
  }
}

function isAuthorized(req, schedulerToken) {
  if (!schedulerToken) return true;

  const authHeader = req.headers.authorization || '';
  const externalTokenHeader = req.headers['x-scheduler-token'] || '';
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const tokenFromQuery = reqUrl.searchParams.get('token') || '';

  return (
    authHeader === `Bearer ${schedulerToken}` ||
    externalTokenHeader === schedulerToken ||
    tokenFromQuery === schedulerToken
  );
}

export default async function handler(req, res) {
  const cfg = {
    targetUrl: process.env.TARGET_URL || DEFAULT_TARGET_URL,
    requestHeadersJson: process.env.REQUEST_HEADERS_JSON,
    includeKeywords: (process.env.INCLUDE_KEYWORDS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    excludeKeywords: (process.env.EXCLUDE_KEYWORDS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    minAvailable: process.env.MIN_AVAILABLE ? Number(process.env.MIN_AVAILABLE) : 1,
    maxResults: process.env.MAX_RESULTS ? Number(process.env.MAX_RESULTS) : 5,
    seatFilter: process.env.SEAT_FILTER || 'all',
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    schedulerToken: process.env.SCHEDULER_TOKEN || process.env.CRON_SECRET,
    alwaysNotify: process.env.ALWAYS_NOTIFY === 'true'
  };

  try {
    if (!isAuthorized(req, cfg.schedulerToken)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const rawData = await fetchSource(cfg);
    const items = extractItems(rawData, cfg.seatFilter);
    const matches = filterItems(items, cfg);

    if (matches.length === 0) {
      if (cfg.alwaysNotify) {
        await sendTelegram('Свободных мест по фильтру сейчас нет.', cfg);
      }
      return res.status(200).json({ ok: true, wagonsTotal: items.length, matches: 0 });
    }

    const headerTitle =
      cfg.seatFilter === 'lower_non_side'
        ? 'Найдены нижние (не боковые) места:'
        : cfg.seatFilter === 'lower'
          ? 'Найдены нижние места:'
          : 'Найдены свободные места:';

    const lines = matches.slice(0, cfg.maxResults).map((item, i) => formatItem(item, i, cfg.seatFilter));
    const message = [headerTitle, '', ...lines].join('\n\n');
    await sendTelegram(message, cfg);

    return res.status(200).json({
      ok: true,
      wagonsTotal: items.length,
      matches: matches.length,
      sent: Math.min(matches.length, cfg.maxResults)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
