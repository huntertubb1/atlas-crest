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
