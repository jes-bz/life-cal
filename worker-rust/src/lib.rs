pub mod config;
#[cfg(target_arch = "wasm32")]
mod handler;

pub fn dimensions(device: &str) -> Option<(usize, usize)> {
    match device {
        "iphone" => Some((1206, 2622)),
        "max" => Some((1320, 2868)),
        "duo-outer" => Some((1398, 2034)),
        "duo-inner" => Some((1878, 2670)),
        "duo-inner-landscape" => Some((2670, 1878)),
        _ => None,
    }
}
// Match Number(positive_f64.toFixed(2)), including binary rounding at ties.
fn fixed2(value: f64) -> f64 {
    if value == 0.0 {
        return 0.0;
    }
    let bits = value.to_bits();
    let exponent = ((bits >> 52) & 2047) as i32 - 1023;
    let mantissa = (bits & ((1u64 << 52) - 1)) | (1u64 << 52);
    let shift = 52 - exponent;
    let scaled = mantissa as u128 * 100;
    let rounded = if shift > 0 {
        (scaled + (1u128 << (shift - 1))) >> shift
    } else {
        scaled << -shift
    };
    rounded as f64 / 100.0
}
fn set_pixel(row: &mut [u8], x: usize, value: u8) {
    let at = 1 + x / 2;
    row[at] = if x % 2 == 0 {
        (row[at] & 15) | (value << 4)
    } else {
        (row[at] & 240) | value
    };
}
fn chunk(output: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    output.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let start = output.len();
    output.extend_from_slice(kind);
    output.extend_from_slice(data);
    let crc = crc32fast::hash(&output[start..]);
    output.extend_from_slice(&crc.to_be_bytes());
}
/// Purpose-built native-resolution PNG. Geometry follows shared/calendar-logic.js.
pub fn render(
    device: &str,
    years: usize,
    weeks: usize,
    layout: &str,
    colors: [[u8; 3]; 3],
) -> Vec<u8> {
    let (width, height) = dimensions(device).expect("validated device");
    let (w, h) = (width as f64, height as f64);
    let duo = device.starts_with("duo-");
    let layout = if duo { "none" } else { layout };
    let mut top = if duo { 0.35 } else { 0.25 };
    let mut bottom = if duo { 0.06 } else { 0.10 };
    if layout == "top" {
        top += 0.10;
    } else if layout == "bottom" {
        bottom += 0.10;
    }
    let right = w * if layout == "right" {
        0.32
    } else if duo {
        0.22
    } else {
        0.0
    };
    let available_width = w - w * 0.04 * 2.0 - right;
    let available_height = h - h * top - h * bottom;
    let total = years * 52;
    let mut cols = 52;
    for c in 52..200 {
        let size = (available_width - 5.0 * (c - 1) as f64) / c as f64;
        let rows = (total as f64 / c as f64).ceil();
        let grid = size * rows + 5.0 * (rows - 1.0);
        let extra = if duo { 0.0 } else { 11.0 * (size + 5.0) };
        if grid + extra <= available_height + 1.0 {
            cols = c;
            break;
        }
    }
    let cell = (available_width - 5.0 * (cols - 1) as f64) / cols as f64;
    let rows = (total + cols - 1) / cols;
    let grid_height = cell * rows as f64 + 5.0 * (rows - 1) as f64;
    let grid_width = cell * cols as f64 + 5.0 * (cols - 1) as f64;
    let start_x = (w - right - grid_width) / 2.0;
    let start_y = if duo {
        h - h * bottom - grid_height
    } else {
        h * top
    };
    let size = fixed2(cell);
    let xs: Vec<f64> = (0..cols)
        .map(|i| fixed2(start_x + i as f64 * (cell + 5.0)))
        .collect();
    let ys: Vec<f64> = (0..rows)
        .map(|i| fixed2(start_y + i as f64 * (cell + 5.0)))
        .collect();
    let stride = (width + 1) / 2 + 1;
    let mut pixels = vec![0u8; stride * height];
    for i in 0..total {
        let x = xs[i % cols];
        let y = ys[i / cols];
        let base = if i < weeks || colors[1] == colors[2] {
            0
        } else {
            7
        };
        let left = x.floor().max(0.0) as usize;
        let right = (x + size).ceil().min(w) as usize;
        let top = y.floor().max(0.0) as usize;
        let bottom = (y + size).ceil().min(h) as usize;
        if left >= right || top >= bottom {
            continue;
        }
        for py in top..bottom {
            let row = &mut pixels[py * stride..(py + 1) * stride];
            let vertical = ((py + 1) as f64).min(y + size) - (py as f64).max(y);
            let coverage = (vertical * 7.0).round() as u8;
            let value = if coverage > 0 { base + coverage } else { 0 };
            row[1 + (left + 1) / 2..1 + right / 2].fill(value * 17);
            if left % 2 == 1 {
                set_pixel(row, left, value);
            }
            if right % 2 == 1 {
                set_pixel(row, right - 1, value);
            }
            for px in [left, right - 1] {
                let horizontal = ((px + 1) as f64).min(x + size) - (px as f64).max(x);
                let edge = (horizontal * vertical * 7.0).round() as u8;
                set_pixel(row, px, if edge > 0 { base + edge } else { 0 });
            }
        }
    }
    let mut palette = vec![0u8; 45];
    palette[..3].copy_from_slice(&colors[0]);
    for color in 1..=2 {
        for coverage in 1..=7 {
            for channel in 0..3 {
                let bg = colors[0][channel] as f64;
                let fg = colors[color][channel] as f64;
                palette[((color - 1) * 7 + coverage) * 3 + channel] =
                    (bg + (fg - bg) * coverage as f64 / 7.0).round() as u8;
            }
        }
    }
    let compressed = miniz_oxide::deflate::compress_to_vec_zlib(&pixels, 1);
    let mut header = Vec::with_capacity(13);
    header.extend_from_slice(&(width as u32).to_be_bytes());
    header.extend_from_slice(&(height as u32).to_be_bytes());
    header.extend_from_slice(&[4, 3, 0, 0, 0]);
    let mut output = Vec::with_capacity(compressed.len() + 128);
    output.extend_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    chunk(&mut output, b"IHDR", &header);
    chunk(&mut output, b"PLTE", &palette);
    chunk(&mut output, b"IDAT", &compressed);
    chunk(&mut output, b"IEND", &[]);
    output
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rounding() {
        assert_eq!(fixed2(1.005), 1.0);
        assert_eq!(fixed2(2.675), 2.67);
        assert_eq!(fixed2(17.999), 18.0);
    }
    #[test]
    fn sizes() {
        for device in [
            "iphone",
            "max",
            "duo-outer",
            "duo-inner",
            "duo-inner-landscape",
        ] {
            let png = render(
                device,
                120,
                1800,
                "none",
                [[0, 0, 0], [255, 255, 255], [51, 51, 51]],
            );
            assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        }
    }
}
