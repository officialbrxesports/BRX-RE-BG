# BRX Background Remover — Upgrade Notes

## Included in this upgrade
- Premium BRX Panther header using `public/brand/brx-logo.png`.
- Responsive header layout and polished dark-indigo/teal studio styling.
- Plans modal with Free and Premium preview cards.
- Plan selection is only a local UI preview stored in browser localStorage. It is NOT authentication, billing, or paid feature enforcement.
- Existing video processing and export components are preserved. The existing export UI already includes ZIP progress, video export progress, and error states.

## Run locally
From the project root:

```powershell
npm install
npm run dev -- --port 3002
```

## Important before launch
To launch real paid memberships, add a backend for user accounts, subscription verification, server-enforced entitlements/quotas, and a payment provider. Do not treat the local plan selector as security or payment integration.
