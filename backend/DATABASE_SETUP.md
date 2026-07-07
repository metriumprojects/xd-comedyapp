# Database Setup and Initialization

This guide explains how to initialize and seed reference data in your MongoDB Atlas database.

## Prerequisites
Make sure your `.env` file is configured with the correct `MONGO_URI` connection string.

## Initialization Commands

Run the following commands from the `backend/` directory:

### 1. Initialize Active Categories Only (Clean Setup)
To insert only the core active categories (**Comics**, **Pranks**, **Stand Up**, **Meme**) without creating mock users or mock posts:
```bash
node scratch/seed_categories.js
```

### 2. Reset/Wipe the Database
To clear the database completely:
```bash
node scratch/wipe_database.js
```
