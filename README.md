# DevNotes

A blog-style notebook for developers. Save the commands, code snippets and screenshots you collect while fixing problems, and read them back later as clean posts.

**Live:** https://devnotes-argha.vercel.app

## Features

- **Block-based notes.** Mix text (Markdown), code snippets and images in any order. There is no length limit.
- **Code blocks.** Syntax highlighting, a language picker and one-click copy.
- **Images with notes.** Attach an image or paste one with `Ctrl+V`, then write what it shows underneath.
- **Automatic image compression.** Images are resized to at most 2400px, converted to WebP and rotated correctly before upload.
- **Nested folders.** Organise notes by project, with subfolders.
- **Search.** Matches note titles, text, code and image notes.
- **Export and share.** Download any note as Markdown, or turn on a public read-only link.
- **Email accounts.** Sign up and sign in with email through Appwrite. Each user sees only their own notes.
- **Light and dark mode.** Plus a resizable sidebar and keyboard shortcuts (`Ctrl+S` saves a note).

## Tech stack

- React 19, TypeScript and Vite
- Tailwind CSS v4 with the typography plugin
- [Appwrite Cloud](https://appwrite.io) for authentication, the database (TablesDB) and image storage
- highlight.js, marked, DOMPurify and lucide-react
- Hosted on Vercel

## Getting started

```bash
npm install
cp .env.example .env      # fill in your Appwrite values
npm run dev               # http://localhost:5173
```

### Environment variables

| Variable | Description |
| --- | --- |
| `VITE_APPWRITE_ENDPOINT` | Appwrite API endpoint, e.g. `https://sgp.cloud.appwrite.io/v1` |
| `VITE_APPWRITE_PROJECT_ID` | Appwrite project ID |
| `VITE_APPWRITE_DATABASE_ID` | Database ID (`devnotes`) |
| `VITE_APPWRITE_FOLDERS_TABLE_ID` | Folders table ID (`folders`) |
| `VITE_APPWRITE_NOTES_TABLE_ID` | Notes table ID (`notes`) |
| `VITE_APPWRITE_BUCKET_ID` | Image bucket ID (`note-images`) |

These values are public identifiers, not secrets: they are built into the code the browser downloads. Your data is protected by Appwrite's per-user permissions.

## Appwrite setup

The script `setup-appwrite.sh` creates the database, both tables and the image bucket. Run it once, after `appwrite login`:

```bash
bash setup-appwrite.sh
```

Then, in the Appwrite Console, add a **Web platform** for every hostname the app runs on, such as `localhost` and your Vercel domain. Without this, sign-in fails with a CORS error.

The script sets up the following:

- **Tables.** Both tables have row security on and allow `create("users")`. Each row is readable and writable only by its owner. Shared notes also get `read("any")`.
- **The `note-images` bucket.** It has **file security on** and allows `create("users")`. Keep file security on: with it off, every image fails to load.

## Project structure

```
src/
  lib/          appwrite client, auth context, data layer (notes, folders, images), theme
  components/   sidebar, note editor, dialogs, blocks renderer, authenticated image loader
  pages/        auth, layout, note list (home), note view/edit, public shared note
```

## Deployment (Vercel)

1. Import the repo in Vercel. The Vite preset is detected automatically.
2. Add the `VITE_APPWRITE_*` environment variables in the project settings.
3. Deploy, then add the Vercel domain as a Web platform in Appwrite.

`vercel.json` sends every route to `index.html`, so refreshing a page or opening a shared link doesn't return a 404.

Every push to `main` deploys automatically. Pushes to other branches get their own preview URLs.
