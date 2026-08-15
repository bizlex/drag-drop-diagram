# Drag & Drop Diagram

Phase 1 starts with a Vite, React 18.3.1, and strict TypeScript application shell. Editor behavior and the diagram document model are implemented in subsequent Phase 1 work packages.

## Development

```bash
npm install
npm run dev
```

The development server is available at the URL printed by Vite. `npm start` is retained as an alias for `npm run dev`.

## Quality checks

```bash
npm run lint
npm run test:run
npm run build
```

`npm test` starts Vitest in watch mode; `npm run test:run` executes the suite once.

## GitHub Pages

Vite is configured with the repository base path `/drag-drop-diagram/`. The existing `gh-pages` deployment command now publishes Vite's `dist` directory:

```bash
npm run deploy
```

The GitHub Actions deployment workflow and deployed smoke coverage defined by P1-10 have not been added in P1-01.
