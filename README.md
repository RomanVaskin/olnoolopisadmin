# sportpolis-admin

Автономная административная панель для управления пулами страховых номеров OLNOO Insurance.

## Запуск

```bash
npm install
cp .env.example .env.local
# задайте SPORTPOLIS_ADMIN_PASSWORD в .env.local
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). База `data/sportpolis.db` и её схема создаются автоматически при первом обращении к серверной части.

## Переменные окружения

```dotenv
SPORTPOLIS_ADMIN_PASSWORD=your-strong-password
```

Пароль проверяется только на сервере. После входа сервер устанавливает подписанную `HttpOnly` cookie сроком на 12 часов.

## API

Все маршруты требуют административную сессию.

- `POST /api/policy-numbers/import` — JSON `{ "policyType": "VK", "numbers": "VK123\nVK124" }`.
- `GET /api/policy-numbers` — фильтры `type`, `status`, `search` в query string.
- `GET /api/policy-numbers/stats` — статистика по VK, VI и подготовленному типу SYS.
- `POST /api/policies/issue` — резервирование номера и выпуск VK по данным заявки.
- `GET /api/policies/:policyNumber/pdf` — защищённое скачивание выпущенного PDF.

## Проверки

```bash
npm run typecheck
npm run lint
npm run build
```

VK-генератор находится в `lib/policy-generator.ts`. Для выпуска требуется реальный `templates/vk.pdf`; созданные документы сохраняются как `generated/<policyNumber>.pdf`. В development на главной странице доступна кнопка «Тестовый выпуск VK».

Для кириллицы автоматически ищется DejaVu Sans (Linux) или Arial Unicode (macOS). Нестандартный путь можно задать через необязательную переменную `SPORTPOLIS_PDF_FONT`.
