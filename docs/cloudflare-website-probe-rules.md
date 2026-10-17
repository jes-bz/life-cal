# Obvious probe blocking on the website and redirect

Added October 16, 2026 (America/New_York), after zone analytics showed scanner
requests on both the short-domain redirect and the static website.

One free-plan WAF custom rule applies to `jes.bz` and `www.jes.bz`; another applies
to `jessebrizzi.com` and `www.jessebrizzi.com`. They block paths containing a
dot-env filename, Git metadata directories, PHP/PHTML files (including PHP path
suffixes), and WordPress admin/content/includes directories. Matching is case
insensitive. The exact deployed expressions and rule IDs are recorded in
cloudflare-website-probe-rules.json.

These static sites have no PHP or WordPress application endpoints. Normal pages,
assets, redirects, query parameters and ordinary missing-page responses are
unaffected. No IP, country or user-agent blocking, challenges, rate limits, or
paid products were enabled. The Life Calendar image hostname retains its existing,
separate unsupported-path rule, documented in cloudflare-edge-firewall.md.

The jes.bz phase ruleset previously contained the image-host rule, which was
preserved; the new rule was appended. The jessebrizzi.com zone had no custom
firewall entrypoint, so one was created with only this new rule.

Verification: all four hosts block `/.env`, `/.git/config`, `/probe.php` and
`/wp-content/plugins/probe.txt` with HTTP 403. Homepages and Life Calendar links
continue working, and the JavaScript and guide PNG assets remain accessible.
An unrelated missing page remains HTTP 404, not a firewall block.

Management: these are zone-level rules changed through the Cloudflare API, not
Wrangler settings. Normal Worker deploys do not modify them. To roll back,
disable the `block_obvious_file_probes` rule in each zone's Security rules (or
PATCH that rule's API endpoint with enabled=false); preserve other rules.
If either site later needs PHP, WordPress, or public dot-env/Git paths, narrow
or disable the corresponding matches first.
