# Environment and run instructions

Quick steps to run the project locally using the `dev` (SQLite) and `prod` (Postgres) settings.

1) Create a local `.env` from the example:

   cp .env.example .env

2) Development (default): `config.settings.dev` — uses SQLite and DEBUG on

   # run migrations and start dev server
   python manage.py makemigrations
   python manage.py migrate
   python manage.py runserver

3) Production preview (connect to Postgres) without changing files

   # set environment variables first (PowerShell example)
   $env:DJANGO_SETTINGS_MODULE = 'config.settings.prod'
   $env:POSTGRES_DB = 'capstone_prod'
   $env:POSTGRES_USER = 'postgres'
   $env:POSTGRES_PASSWORD = 'your_pass'
   $env:POSTGRES_HOST = 'localhost'
   $env:POSTGRES_PORT = '5432'

   # run migrations and optional collectstatic
   python manage.py migrate --settings=config.settings.prod
   python manage.py collectstatic --noinput --settings=config.settings.prod
   python manage.py runserver --settings=config.settings.prod

4) Alternative: pass `--settings` to commands (no env var changes required):

   python manage.py migrate --settings=config.settings.prod
   python manage.py runserver --settings=config.settings.prod

---

## Recommended PostgreSQL hosting for future deployment

For your PWA capstone, the best path is to keep local development simple with SQLite, and later switch to a managed PostgreSQL provider when you deploy.

### Best free PostgreSQL providers for students

- **Supabase**
  - Best choice for your project.
  - Includes a free PostgreSQL database plus authentication and file storage.
  - Easy for PWAs because you can connect with JavaScript and reuse existing app structure.

- **Neon Serverless Postgres**
  - Also a strong choice if you want a purely managed Postgres service.
  - Offers a free tier, auto-sleeps when idle, and is great for small apps.

- **Aiven for PostgreSQL**
  - A reliable managed Postgres provider with a free single-node tier.
  - Good if you want a more traditional Postgres deployment.

### Why Supabase is a good fit for this system

- Your system is a PWA, and Supabase works well with modern JavaScript apps.
- It gives you a real PostgreSQL backend without extra setup.
- It is student-friendly and easy to deploy later.
- You can keep using Django for your backend and simply point it to a Supabase Postgres database.

### Future-ready deployment plan

1. Develop locally with SQLite using `config.settings.dev`.
2. Keep `config.settings.prod` ready for PostgreSQL.
3. When you are ready to deploy, create a free Supabase project and copy the database credentials into `.env`.
4. Use `DJANGO_SETTINGS_MODULE=config.settings.prod` for production preview.
5. If you eventually need offline support for low signal, use browser storage / IndexedDB in the PWA and sync to the backend when connected.

### Important reminder

- PostgreSQL is the correct database for your capstone.
- You do not need Neo4j for this project.
- Redis is optional and only useful later for caching or session speed; do not use it as your main database.

Security note: never commit your real `.env`. Use secret stores for production.
