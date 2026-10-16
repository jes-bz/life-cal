# Paired Cloudflare Worker benchmark

October 16, 2026, 1:13 p.m. America/New_York. Production was unchanged.

Compared the committed JavaScript Worker at c16c7c8 (not the uncommitted JS
compression experiment) with the full Rust prototype. Temporary Workers:

- JS version: 014a028a-32a8-4ac4-8a08-b7d586552f7f
- Rust version: 99923ed1-aca1-4441-834e-5f3aee83dad6

Sent 25 identical input pairs, alternating implementation order between rounds:
five devices, four widget layouts, 90 years in four rounds and 120 in the fifth.
A different background color for each pair forced both internal image cache and
outer response cache misses. All 50 responses were HTTP 200 with an explicit
render MISS. All 25 decoded palette/pixel comparisons matched exactly at full
resolution. Ten additional requests checked repeated URLs.

Invocation logs supplied CPU measurements for all 25 JS renders and 20 Rust
renders. Five Rust invocation records remained unavailable after repeated queries
despite complete client-side responses. Compare only the 20 matching pairs:

| CPU statistic | JavaScript | Rust |
| --- | ---: | ---: |
| Mean | 31.45 ms | 27.35 ms |
| Median | 21.5 ms | 27 ms |
| Range | 9–116 ms | 5–60 ms |
| Requests over 10 ms | 17/20 | 14/20 |

Rust was faster in 10 of 20 matched pairs. Its mean was 13% lower but its median
was higher. This establishes feasibility and mixed performance, not a consistent
language-level speedup. Hardware, isolates and locations were not pinned; Rust
requests ran across several locations. Neither implementation reliably stayed
within the documented 10 ms free allowance. No request in this test was actually
terminated, which is consistent with documented runtime flexibility and does not
guarantee future success.

Across all 25 images, JavaScript returned 2,658,416 PNG bytes and Rust 833,314:
68.7% fewer bytes with identical decoded pixels. Rust uses miniz_oxide rather
than the JavaScript encoder's handwritten compressor, so this compares complete
implementations and encoding choices, not just languages.

All ten repeated URLs returned HTTP 200. The five JS repeats invoked the Worker,
hit caches.default and recorded 1–2 ms CPU. The five Rust repeats returned the
outer CF-Cache-Status: HIT and preserved the original X-Calendar-Cache: MISS;
no second Rust invocation appeared. This illustrates why the outer cache status
and actual invocation records matter more than a cached application header.

Both temporary Workers were deleted after measurement. Source, benchmark driver,
and sanitized invocation/client records are retained locally. No production
deployment, billing plan or dependency upgrade was made.

Reproduction driver: worker-rust/scripts/benchmark-cloudflare.mjs. It takes JS
test URL, Rust test URL, and output JSON path; deploy isolated Workers with full
invocation logging first. It sends 60 requests. Retrieve CPU metrics by ray ID
using Cloudflare telemetry afterward. Use fresh color values if rerunning against
existing caches (the driver intentionally fails if an initial image is cached).

Cloudflare's current allowance and flexibility:
https://developers.cloudflare.com/workers/platform/limits/

Data: cloudflare-benchmark-2026-10-16.json
