# AOKY — Time & Income Tracker

## Деплой на Vercel — пошагово

### 1. Создай базу данных (бесплатно)

Иди на [neon.tech](https://neon.tech) → Sign Up → Create Project → скопируй **Connection string** (выглядит как `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

### 2. Залей код на GitHub

```bash
unzip aoky-vercel.zip -d aoky-tracker
cd aoky-tracker
git init && git add -A && git commit -m "init"
```

На [github.com/new](https://github.com/new) создай репо `aoky-tracker` (без README) → затем:

```bash
git remote add origin https://github.com/ТВОЙ_НИК/aoky-tracker.git
git branch -M main
git push -u origin main
```

### 3. Подключи к Vercel

1. Иди на [vercel.com](https://vercel.com) → **Add New Project**
2. **Import** репозиторий `aoky-tracker`
3. **Framework Preset**: выбери **Other**
4. В **Environment Variables** добавь:
   - `DATABASE_URL` = строка подключения из Neon
   - `JWT_SECRET` = любая длинная случайная строка
5. Нажми **Deploy**

### 4. Готово!

Vercel даст URL типа `aoky-tracker.vercel.app` — это твой сайт.

## Структура

```
api/
  index.js    — Express API (serverless function)
  db.js       — PostgreSQL подключение + миграции
  auth.js     — JWT авторизация
public/
  index.html  — React фронтенд
vercel.json   — роутинг Vercel
```

## Локальная разработка

```bash
npm install
npx vercel dev
```
