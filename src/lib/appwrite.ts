import { Account, Client, Storage, TablesDB } from 'appwrite'

// Values come from app/.env (see .env.example)
const env = import.meta.env
export const ENDPOINT: string = env.VITE_APPWRITE_ENDPOINT
export const PROJECT_ID: string = env.VITE_APPWRITE_PROJECT_ID
export const DB_ID: string = env.VITE_APPWRITE_DATABASE_ID
export const FOLDERS: string = env.VITE_APPWRITE_FOLDERS_TABLE_ID
export const NOTES: string = env.VITE_APPWRITE_NOTES_TABLE_ID
export const BUCKET_ID: string = env.VITE_APPWRITE_BUCKET_ID

if (!ENDPOINT || !PROJECT_ID) throw new Error('Missing Appwrite config — copy app/.env.example to app/.env')

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID)
export const account = new Account(client)
export const tables = new TablesDB(client)
export const storage = new Storage(client)
