use crate::dimensions;
use chrono::NaiveDate;
use std::collections::HashMap;

pub const WEEK_MS: i64 = 604_800_000;
pub const RENDERER_VERSION: &str = "rust-1";

#[derive(Debug)]
pub struct Config {
    pub dob: String,
    pub birth: i64,
    pub years: usize,
    pub device: String,
    pub layout: String,
    pub colors: [[u8; 3]; 3],
}

impl Config {
    pub fn parse(pairs: impl IntoIterator<Item = (String, String)>) -> Option<Self> {
        let mut params = HashMap::new();
        for (key, value) in pairs {
            params.entry(key).or_insert(value);
        }
        let get = |key: &str, default: &str| {
            params
                .get(key)
                .filter(|v| !v.is_empty())
                .cloned()
                .unwrap_or_else(|| default.into())
        };
        let dob = get("dob", "1990-01-01");
        if dob.len() != 10
            || !dob.bytes().enumerate().all(|(i, c)| {
                if i == 4 || i == 7 {
                    c == b'-'
                } else {
                    c.is_ascii_digit()
                }
            })
        {
            return None;
        }
        let date = NaiveDate::parse_from_str(&dob, "%Y-%m-%d").ok()?;
        let years = number(&get("years", "80"))?;
        if !years.is_finite() || years.fract() != 0.0 || !(1.0..=120.0).contains(&years) {
            return None;
        }
        let device = get("device", "max");
        dimensions(&device)?;
        let mut layout = get("layout", "none");
        if !["none", "top", "bottom", "right"].contains(&layout.as_str()) {
            return None;
        }
        if device.starts_with("duo-") {
            layout = "none".into();
        }
        let mut colors = [[0u8; 3]; 3];
        for (i, source) in [
            get("bg", "000000"),
            get("lived", "ffffff"),
            get("rest", "333333"),
        ]
        .iter()
        .enumerate()
        {
            let hex = source.strip_prefix('#').unwrap_or(source);
            if hex.len() != 6 || !hex.bytes().all(|c| c.is_ascii_hexdigit()) {
                return None;
            }
            for c in 0..3 {
                colors[i][c] = u8::from_str_radix(&hex[c * 2..c * 2 + 2], 16).ok()?;
            }
        }
        Some(Self {
            dob,
            birth: date.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis(),
            years: years as usize,
            device,
            layout,
            colors,
        })
    }

    pub fn weeks(&self, now: i64) -> usize {
        ((now - self.birth).unsigned_abs().div_ceil(WEEK_MS as u64)) as usize
    }

    pub fn client_ttl(&self, now: i64) -> i64 {
        let weeks = self.weeks(now) as i64;
        let next = if now >= self.birth {
            self.birth + weeks * WEEK_MS + 1
        } else {
            self.birth - (weeks - 1) * WEEK_MS
        };
        ((next - now) / 1000).clamp(0, 3600)
    }

    pub fn cache_query(&self, now: i64) -> String {
        let hex = |c: [u8; 3]| format!("{:02x}{:02x}{:02x}", c[0], c[1], c[2]);
        format!(
            "v={RENDERER_VERSION}&device={}&weeks={}&years={}&layout={}&bg={}&lived={}&rest={}",
            self.device,
            self.weeks(now).min(self.years * 52),
            self.years,
            self.layout,
            hex(self.colors[0]),
            hex(self.colors[1]),
            hex(self.colors[2])
        )
    }
}

// Preserve Number()'s accepted integer forms from existing configuration links.
fn number(input: &str) -> Option<f64> {
    let s = input.trim();
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0b", 2),
        ("0B", 2),
        ("0o", 8),
        ("0O", 8),
    ] {
        if let Some(rest) = s.strip_prefix(prefix) {
            return u64::from_str_radix(rest, radix).ok().map(|n| n as f64);
        }
    }
    s.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config(pairs: &[(&str, &str)]) -> Option<Config> {
        Config::parse(pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())))
    }
    #[test]
    fn defaults_and_legacy_numbers() {
        let c = config(&[]).unwrap();
        assert_eq!(c.device, "max");
        assert_eq!(c.years, 80);
        for value in ["80", "8e1", "80.0", " 80 ", "0x50", "0b1010000", "0o120"] {
            assert_eq!(config(&[("years", value)]).unwrap().years, 80);
        }
    }
    #[test]
    fn rejects_bad_inputs() {
        for (k, v) in [
            ("dob", "2026-02-30"),
            ("dob", "2026-1-01"),
            ("dob", "x"),
            ("years", "121"),
            ("years", "0"),
            ("years", "NaN"),
            ("years", "2.5"),
            ("device", "constructor"),
            ("layout", "bad"),
            ("bg", "fff"),
            ("bg", "🔴🔴"),
        ] {
            assert!(config(&[(k, v)]).is_none(), "{k}={v}");
        }
        assert!(config(&[("dob", "2024-02-29")]).is_some());
    }
    #[test]
    fn canonical_keys_and_first_value() {
        let now = 1792152000000;
        let a = config(&[
            ("dob", "1990-01-01"),
            ("device", "duo-outer"),
            ("layout", "right"),
            ("bg", "#AAbBcC"),
        ])
        .unwrap();
        let b = config(&[
            ("dob", "1990-01-02"),
            ("device", "duo-outer"),
            ("layout", "top"),
            ("bg", "aabbcc"),
            ("junk", "x"),
        ])
        .unwrap();
        assert_eq!(a.cache_query(now), b.cache_query(now));
        assert_eq!(
            config(&[("years", "80"), ("years", "120")]).unwrap().years,
            80
        );
        assert_ne!(a.cache_query(now), a.cache_query(now + WEEK_MS));
    }
    #[test]
    fn week_boundary_and_future_birth() {
        let c = config(&[("dob", "2026-10-10")]).unwrap();
        assert_eq!(c.weeks(c.birth), 0);
        assert_eq!(c.weeks(c.birth + 1), 1);
        assert_eq!(c.weeks(c.birth + WEEK_MS), 1);
        assert_eq!(c.weeks(c.birth + WEEK_MS + 1), 2);
        assert_eq!(c.client_ttl(c.birth + WEEK_MS - 1000), 1);
        assert_eq!(c.client_ttl(c.birth + WEEK_MS), 0);
        assert_eq!(c.weeks(c.birth - WEEK_MS), 1);
        assert_eq!(c.weeks(c.birth - WEEK_MS - 1), 2);
        assert_eq!(c.client_ttl(c.birth - WEEK_MS - 1000), 1);
        assert_eq!(c.client_ttl(c.birth + 1000), 3600);
    }
}
