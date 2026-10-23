# Production deployment checklist

## Infrastructure
- [ ] Node.js 20/22 installed; app runs under a non-root `store` user via systemd
- [ ] Supabase-compatible backend reachable over HTTPS; Postgres port not public
- [ ] Firewall: only 22 (restricted), 80, 443 open; SSH keys only; fail2ban on
- [ ] Unattended security upgrades enabled

## Configuration
- [ ] `.env` filled from `.env.example`, `chmod 600`, no `VITE_` prefix on secrets
- [ ] `SMTP_ENCRYPTION_KEY` generated and stored in a password manager
- [ ] App built **after** `.env` was filled (VITE_ values are baked in at build time)
- [ ] `nodemailer` present in `.output/server/node_modules`

## Domain & SSL
- [ ] DNS A/AAAA for `@` and `www` point to the server
- [ ] Certificates for both hosts; auto-renew timer active
- [ ] Admin → Settings → Primary website URL set (https, no slash)
- [ ] "Redirect www / non-www" enabled only after both hosts serve HTTPS
- [ ] nginx forwards `X-Forwarded-Host` and `X-Forwarded-Proto`

## Data & access
- [ ] Database restored / migrated; row counts verified
- [ ] Media migrated; product images load
- [ ] Admin can sign in, 2FA enabled for every admin/staff
- [ ] Auth: anonymous sign-up off, email confirmation on, redirect URLs set

## Store functions
- [ ] COD test order placed, stock decreased, cancelled, stock restored, test order removed
- [ ] SMTP profiles tested and enabled; SPF/DKIM/DMARC records present
- [ ] Stripe **off** until keys + webhook configured and tested in test mode
- [ ] Contact form submission reaches Admin → Inbox

## SEO
- [ ] `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/api/public/merchant-feed` show the primary domain
- [ ] Canonical + hreflang on home, product, page and blog URLs show the primary domain
- [ ] Search Console + Merchant Center updated with new URLs
- [ ] Maintenance mode OFF

## Operations
- [ ] Nightly `backup.sh` cron; off-site copy; one restore test done
- [ ] Uptime monitor on `/` and `/sitemap.xml`
- [ ] `rollback.sh` tested once on staging
