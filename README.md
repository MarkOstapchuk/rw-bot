# Place Alert Bot (Vercel + Telegram)

Бот проверяет наличие мест на `pass.rw.by`, фильтрует вагоны и отправляет уведомление в Telegram.

## Что уже зашито
- В [api/check.js](/Users/user/WebstormProjects/bot-rw/api/check.js) встроен ваш `GET` URL.
- Встроены базовые заголовки запроса (включая `X-Requested-With`, `User-Agent`, `Cookie`).
- Логика фильтрации под ответ:
  - `tariffs[].cars[].emptyPlaces`
  - если `emptyPlaces.length >= MIN_AVAILABLE`, вагон считается подходящим.

## Переменные окружения
Создайте `.env.local` из примера:
```bash
cp .env.example .env.local
```

Обязательные:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SCHEDULER_TOKEN`

Опциональные:
- `TARGET_URL` (если захотите поменять маршрут/дату)
- `REQUEST_HEADERS_JSON` (если нужно обновить cookie/session)
- `INCLUDE_KEYWORDS`, `EXCLUDE_KEYWORDS`
- `MIN_AVAILABLE`, `MAX_RESULTS`, `ALWAYS_NOTIFY`

## Локальный запуск
```bash
npm install
npm run dev
```

Проверка:
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/check?token=<SCHEDULER_TOKEN>`

## Деплой на Vercel
1. Загрузите проект в репозиторий.
2. Импортируйте проект в Vercel.
3. В `Project Settings -> Environment Variables` добавьте переменные.
4. Задеплойте.

## Внешний планировщик (cron-job.org)
1. Зарегистрируйтесь на [cron-job.org](https://cron-job.org).
2. Создайте задачу с URL:
   - `https://<ваш-проект>.vercel.app/api/check?token=<SCHEDULER_TOKEN>`
3. Метод: `GET`.
4. Интервал: каждые 3 минуты.
5. Сохраните задачу и включите её.

## Важно
- `SCHEDULER_TOKEN` должен быть длинной случайной строкой.
- Сайт может инвалидировать `Cookie/session`; если начнутся 401/403/redirect вместо JSON, обновите `REQUEST_HEADERS_JSON` свежим `Cookie` из браузера.
