# Life Calendar edge firewall

Enabled October 16, 2026, after logs showed 109 scanner requests in a short burst
on life-cal.jes.bz. Of those, 108 probed unsupported paths and received Worker
404 responses; one visited the root and redirected.

A single free-plan WAF custom rule now blocks unsupported paths on precisely
`life-cal.jes.bz` before they execute the Worker. It does not match the website,
the rest of jes.bz, or other hostnames. Permitted paths are `/`, `/robots.txt`,
`/favicon.ico`, `/apple-touch-icon.png` and `/apple-touch-icon-precomposed.png`.
The icons are allowed through for normal browser behavior; the Worker currently
returns 404 for them. Configured image URLs and query parameters are unchanged.

The rule does not use IP addresses, countries, ASNs or user-agent identity, and
does not challenge requests. Existing unattended Shortcuts remain supported.
It would have intercepted 108 of the 109 requests in the observed scanner burst.
Bots can still visit the root or submit valid calendar configurations, so this
is targeted protection against the observed file probes, not comprehensive bot
detection or rate limiting.

Live verification: `/.env`, `/.git/config`, `/wp-login.php` and an arbitrary
unsupported test path returned edge HTTP 403 without the Worker renderer header.
Bare root still returned 302, robots.txt returned 200, and a configured iPhone
image returned 200 with its original 1206×2622 resolution and rust-1 header.

The deployed rule and identifiers are recorded in cloudflare-edge-firewall.json.
This is documentation of a zone-level API change, not a Wrangler configuration;
normal Worker deployments do not manage or remove this rule.

To roll back, disable only rule `life_cal_block_unsupported_paths` in the jes.bz
zone's Security rules, or PATCH its ruleset-rule API endpoint with enabled=false.
Preserve other zone rules. Update the allowlist before introducing new Worker
routes. A separate workers.dev hostname would not inherit this zone rule.

Cloudflare documents five custom rules on the Free plan:
https://developers.cloudflare.com/waf/custom-rules/
