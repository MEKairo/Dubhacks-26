# Frontend

React + Vite starter for our shared calendar app. Requires Node.js 22.14 or newer.

## Start locally

```sh
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite. On Windows PowerShell, use `npm.cmd` instead of `npm` if script execution is disabled.

Run `npm run build` for a production build and `npm run preview` to preview it.

## Files

- `src/pages/Welcome.jsx`: starting screen, currently a placeholder.
- `src/App.jsx`: root component.
- `src/components/`: reusable interface pieces.
- `src/data/`: sample data.
- `src/lib/`: future API and Supabase helpers.
- `src/styles.css`: shared styles.
- `public/`: static assets.

Authentication, calendar syncing, and Supabase will be connected later.
