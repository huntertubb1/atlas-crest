# atlascrestllc.com

Static site for Atlas Crest LLC, served via GitHub Pages.

Source of truth for edits: this repo. Push to main deploys the live site.

## Browser security policy

The public apex and `www` are proxied through Cloudflare. The response-header rule
`Atlas public website security headers` is restricted to those two hostnames; its intended
values are in `security-headers.json`. GitHub Pages does not apply that JSON file itself.
The Cloudflare zone uses Full (Strict) origin TLS.

HTML also carries the content and referrer policies. Keep these aligned with the edge rule.
JavaScript must live in same-origin external files, not inline scripts or event-handler
attributes. Onboarding and application scripts deliberately preserve their original logic.
When adding a resource provider, update only the required directive and verify the affected
page before publishing. The policy does not apply to the Office or Audit Desk hostnames.

## Inspector badge verification (`/verify`)

Inspector badges carry a QR code for `https://atlascrestllc.com/verify?id=<badge>` (for example
`AC-1001`). `verify.html` + `js/verify.js` look the badge up in `assets/inspectors/badges.json` and
show the person at the door whether it is active, not active, or not one of ours, followed by a
plain-language explanation of the inspection. Anyone can also type the badge number at
`atlascrestllc.com/verify`. The roster is public (so is this repo): list only what belongs on a badge.

- **Add an inspector:** add an entry with the next badge number and `"status": "active"`, plus a
  headshot: `AC-1002.jpg`, a 600x720 portrait JPEG, in `assets/inspectors/` with `"photo": "AC-1002.jpg"`.
  The page shows it so the insured can match the face at the door (initials only if it is missing).
- **Deactivate:** set `"status": "inactive"` and keep the entry. Deleting it turns the old badge into
  "not found", which is less clear to the insured. The page re-reads the roster on every scan, so the
  change is live as soon as GitHub Pages redeploys.
- **Badge QR code:** encode the URL above with error correction Q and print it at least 2 cm (0.8 in)
  wide. The brand stationery kit's `gen-badge-qr.jxa.js` (macOS) writes a print SVG + PNG and
  decodes the result to prove it scans.
