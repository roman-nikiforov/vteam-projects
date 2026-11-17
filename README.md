# Fusion Feedback Dashboard

Cloud-hosted dashboard for Fusion feedback items in the **Dynamics 365 Contact Center and Agents** v-Team.

## What this app does

- Queries Fusion via:
  - `https://successhub.crm.dynamics.com/api/data/v9.2/ft_feedbackitems`
- Filters records to the configured v-Team name.
- Shows:
  - Total / open / closed counts
  - Distribution by status
  - Distribution by owner
  - 12-month creation trend
  - Latest feedback items table

## Files

- `index.html` - UI and styling
- `app.js` - data fetch, filtering, and dashboard rendering
- `.github/workflows/deploy-pages.yml` - GitHub Pages deployment workflow

## Authentication and API access

The app calls Dataverse from the browser. Use one of these:

1. **Browser session cookie** (default): if your browser is already signed in to `successhub.crm.dynamics.com`.
2. **Bearer token**: paste an access token in the dashboard input field.

If requests fail, verify your Dataverse permissions and CORS/security policy for your tenant.

## Deploy to GitHub Pages

1. Create an empty GitHub repository (for example `fusion-feedback-dashboard`).
2. Push this folder to the repository root.
3. In GitHub: **Settings -> Pages -> Source = GitHub Actions**.
4. The workflow deploys automatically on push to `main`.
5. Open: `https://<your-github-username>.github.io/<repo-name>/`

## Local run

Open `index.html` directly in a browser, or serve with any static server.
