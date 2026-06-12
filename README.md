# Yuna Labs — Website

Source for [yuna-labs.com](https://yuna-labs.com). A static site (plain HTML/CSS/JS) with one Vercel serverless function for the contact form. No build step.

## Structure

```
index.html          Home
about.html          About
services.html       Services
engagement.html     How we work / engagement models
contact.html        Contact (form posts to /api/contact)
privacy.html        Privacy policy
404.html            Custom not-found page
style.css           Single shared stylesheet (design tokens in :root)
js/main.js          Footer year + mobile nav toggle
js/contact.js       Contact form submission
api/contact.js      Serverless function — sends form submissions via SMTP
assets/             Logo, SVG illustrations, OG image, favicons
vercel.json         Clean URLs, security headers, asset caching
sitemap.xml         Uses clean URLs (no .html)
```

## Local development

```
npm install            # only dependency is nodemailer (for the API)
npx vercel dev         # serves the site + /api/contact locally
```

Opening the HTML files directly in a browser also works for layout checks, but root-relative links (`/about`) and the API need `vercel dev`.

## Deployment

Deployed on Vercel. Pushing to the production branch deploys automatically. `cleanUrls` is enabled, so `/about.html` redirects to `/about`.

### Required environment variables (Vercel project settings)

| Variable       | Purpose                                  |
| -------------- | ---------------------------------------- |
| `SMTP_HOST`    | SMTP server hostname                     |
| `SMTP_PORT`    | SMTP port (default `465`)                |
| `SMTP_USER`    | SMTP username                            |
| `SMTP_PASS`    | SMTP password                            |
| `CONTACT_TO`   | Recipient (default `info@yuna-labs.com`) |
| `CONTACT_FROM` | From header (default Yuna Labs)          |

## Conventions

- Design tokens (colors, spacing, type) live in `:root` in `style.css` — change them there, not inline.
- Headings use Space Grotesk, body uses Inter (Google Fonts).
- Keep `sitemap.xml` `lastmod` dates current when pages change.
- The OG image is `assets/og-cover.png` (1200×630), shared across pages.
- Inline `<script>` blocks are not allowed by the CSP (`script-src 'self'`) — put JS in `js/` instead.
