# Supabase Database Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com/ and sign in
2. Create a new project
3. Note down your project details:
   - Project URL: `https://<project-ref>.supabase.co`
   - Database Host: `db.<project-ref>.supabase.co`
   - Database Password: (set during project creation)

## Step 2: Execute Database Schema

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `init-database.sql`
3. Execute the SQL to create all tables:
   - `profession_groups`
   - `members`
   - `events`
   - `attendances`
   - `member_attendance_summary` (materialized view)

## Step 3: Configure Backend Connection

1. Copy `application-supabase.properties.example` to `application-supabase.properties`
2. Update the following values:

```properties
spring.datasource.url=jdbc:postgresql://db.<your-project-ref>.supabase.co:5432/postgres
spring.datasource.username=postgres
spring.datasource.password=<your-database-password>
```

3. Set active profile:

```bash
export SPRING_PROFILES_ACTIVE=supabase
```

Or add to `application.properties`:

```properties
spring.profiles.active=supabase
```

## Step 4: Environment Variables (Production)

For production deployment, set these environment variables:

```bash
# Database
DATABASE_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<your-password>

# DeepSeek AI
DEEPSEEK_API_KEY=<your-deepseek-api-key>
```

## Step 5: Test Connection

Run the backend:

```bash
./gradlew bootRun --args='--spring.profiles.active=supabase'
```

Check logs for successful database connection.

## Notes

- The current in-memory implementation will be replaced with Supabase once configured
- All attendance records will persist in the database
- The `member_attendance_summary` view needs to be refreshed periodically:

```sql
REFRESH MATERIALIZED VIEW member_attendance_summary;
```
