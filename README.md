# Sandcastle Fitness — One-Page Referral Site (Ship Ready + Leaderboard)

Single-page experience:
- **/** includes:
  - Free pass form
  - Referral link creation (self-serve)
  - Member stats
  - Public leaderboard (top referrers)

- **/r/SC-XXXXXX** tracks clicks, sets attribution cookies, then redirects to **/**.

## Deploy on Netlify
1) Deploy this folder as its own Netlify site (Git deploy recommended so Functions run).
2) Add custom domain: `referral.sandcastlefitness.com`

## Notes
- Leaderboard uses an internal index of issued referral codes stored in Netlify Blobs.


## Tracking reliability upgrades
- /r/CODE redirects to /?ref=CODE (page JS cleans URL)
- Captures both first-touch and last-touch codes: ref_first + ref_last
- Payout default is last-touch; first-touch is stored for analysis.


## Branding
- Logo used in header: `assets/sandcastle-logo.png`
