# Gitfolio Studio

A full-stack GitHub-to-portfolio generator built with Next.js, React, and
TypeScript. It keeps the CalSans typography, black/zinc surfaces, gradient
headings, animated dividers, and project-card language of the source portfolio.

## Pipeline

1. A user enters a GitHub username.
2. The server fetches the live public profile, social accounts, and owned public
   repositories from GitHub.
3. The user selects up to 10 projects, marks exactly 3 as featured, edits or
   removes imported work, adds custom projects, and optionally uploads project
   screenshots.
4. The user uploads a PDF resume and reviews editable contact information.
5. The server fetches language bytes for all selected repositories and README
   excerpts for featured repositories.
6. Kimi K2.6 receives the GitHub evidence, extracted resume text, and up to
   three project screenshots. A forced function call returns structured
   headline, summary, skill groups, and project copy.
7. The user edits every generated field and chooses Obsidian, Aurora, or Signal.
8. The browser builds a portable bundle containing `index.html`, `resume.pdf`,
   CalSans, and uploaded images.
9. The user either downloads the ZIP or checks and creates a
   `name.voiceresume.xyz` subdomain through cPanel UAPI. The same bundle is then
   uploaded to that subdomain's document root.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local` and configure:

```dotenv
GITHUB_TOKEN=
DIGITALOCEAN_MODEL_ACCESS_KEY=
DIGITALOCEAN_MODEL=kimi-k2.6
CPANEL_BASE_URL=https://your-cpanel-host:2083
CPANEL_USERNAME=
CPANEL_API_TOKEN=
CPANEL_ROOT_DOMAIN=voiceresume.xyz
CPANEL_DEPLOY_ROOT=voiceresume.xyz
```

`GITHUB_TOKEN` is optional for public data but raises GitHub's REST limit from
60 requests per hour to the authenticated allowance. All credentials are read
only in server routes and are excluded from the generated HTML.

## Server routes

- `POST /api/github`: imports a live GitHub profile and repositories.
- `POST /api/ai`: extracts resume text, enriches repository context, and calls
  DigitalOcean Serverless Inference.
- `GET /api/deploy/check`: checks whether a cPanel subdomain is available.
- `POST /api/deploy`: creates the subdomain, uploads the bundle, and starts a
  best-effort AutoSSL check.

## Validation

```bash
npm run typecheck
npm run build
```

## API references

- [DigitalOcean Serverless Inference](https://docs.digitalocean.com/products/inference/reference/api/serverless-inference/)
- [DigitalOcean multimodal inference](https://docs.digitalocean.com/products/inference/how-to/use-multimodal-inference/)
- [cPanel API token authentication](https://api.docs.cpanel.net/cpanel/tokens)
- [cPanel SubDomain/addsubdomain](https://api.docs.cpanel.net/specifications/cpanel.openapi/subdomain/addsubdomain)
- [cPanel Fileman/upload_files](https://api.docs.cpanel.net/specifications/cpanel.openapi/manage-files/upload_files)
- [GitHub REST API](https://docs.github.com/rest)
