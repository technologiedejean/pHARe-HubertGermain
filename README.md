# Squelette Next.js

Base neutre pour démarrer une application Next.js (App Router) avec TypeScript et Tailwind CSS.

## Démarrer

Ouvre un terminal dans le dossier du projet et lance :

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000 dans ton navigateur.

## Structure

- `app/` — les pages (chaque dossier = une URL)
- `app/api/` — les routes API (backend)
- `app/components/` — les composants réutilisables
- `lib/` — le code partagé (helpers, configuration)
- `public/` — les fichiers statiques (images, etc.)

## Scripts

- `npm run dev` — lance le serveur de développement
- `npm run build` — construit la version de production
- `npm run start` — lance la version de production
