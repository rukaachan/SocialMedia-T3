# Tweeva

Tweeva is a minimal social app for posting short updates, following profiles, and browsing a simple feed.

## Overview

- create an account with Discord authentication
- post tweets
- like tweets
- follow other users
- browse recent and following feeds
- view user profiles

## Stack

- Next.js
- React
- NextAuth
- Prisma
- MySQL
- tRPC
- Tailwind CSS

## Run locally

1. Start MySQL.
2. Configure `.env`.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Sync the database:
   ```bash
   pnpm exec prisma db push
   ```
5. Start the app:
   ```bash
   pnpm dev
   ```

Open `http://localhost:3000`.
