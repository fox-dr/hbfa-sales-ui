# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Main-only Push Guard (training wheels)
To avoid accidental branch deploys, this repo is configured to allow pushes only to `main` via a Git pre-push hook.

What’s in place
- Hook path: `.githooks/pre-push`
- Behavior: blocks `git push` to any branch except `main`.
- Override (if truly intended): `git push --no-verify`

Managing the hook
- Disable temporarily: run with `--no-verify` on a single push.
- Remove permanently: `git config --unset core.hooksPath` (or delete `.githooks/`).
- Re-enable: `git config core.hooksPath .githooks`

Netlify deploys
- Current config is unchanged (builds from repo according to Netlify site settings).
- If desired, disable Branch Deploys/Deploy Previews in Netlify UI to enforce main-only deploys at the platform level.
