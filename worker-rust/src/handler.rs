use crate::{
    config::{Config, RENDERER_VERSION},
    render,
};
use serde_json::json;
use worker::*;

fn text(value: &str, status: u16) -> Result<Response> {
    let mut response = Response::ok(value)?.with_status(status);
    response.headers_mut().set("Cache-Control", "no-store")?;
    Ok(response)
}

#[event(fetch)]
pub async fn main(req: Request, _env: Env, ctx: Context) -> Result<Response> {
    let mut url = req.url()?;
    console_log!(
        "{}",
        json!({
            "event":"calendar_request", "renderer":RENDERER_VERSION,
            "path":url.path().chars().take(200).collect::<String>(), "method":req.method().to_string(),
            "userAgent":req.headers().get("user-agent")?.map(|v|v.chars().take(300).collect::<String>()),
            "colo":req.cf().map(|cf|cf.colo()), "country":req.cf().and_then(|cf|cf.country()),
            "asn":req.cf().and_then(|cf|cf.asn()), "verifiedBotCategory":req.cf().and_then(|cf|cf.verified_bot_category())
        })
    );
    let head = req.method() == Method::Head;
    if url.path() == "/robots.txt" {
        let mut response = Response::ok(if head {
            ""
        } else {
            "User-agent: *\nDisallow: /\n"
        })?;
        response.headers_mut().set("Content-Type", "text/plain")?;
        response
            .headers_mut()
            .set("Cache-Control", "public, max-age=86400")?;
        return Ok(response);
    }
    if url.path() != "/" {
        return text("Not Found", 404);
    }
    if req.method() != Method::Get && !head {
        let mut response = text("Method Not Allowed", 405)?;
        response.headers_mut().set("Allow", "GET, HEAD")?;
        return Ok(response);
    }
    if !url.query_pairs().any(|(key, _)| {
        ["dob", "years", "bg", "lived", "rest", "layout", "device"].contains(&key.as_ref())
    }) {
        return Response::redirect_with_status(Url::parse("https://jes.bz/life-cal/")?, 302);
    }
    let Some(config) = Config::parse(
        url.query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned())),
    ) else {
        return text("Invalid calendar parameters", 400);
    };
    let now = js_sys::Date::now() as i64;
    url.set_path("/");
    url.set_query(Some(&config.cache_query(now)));
    let key = url.to_string();
    let cache = Cache::default();
    let cached = match cache.get(key.clone(), true).await {
        Ok(value) => value,
        Err(_) => {
            console_error!("{}", json!({"event":"calendar_cache_read_failed"}));
            None
        }
    };
    let mut response = if let Some(cached) = cached {
        // Cache API responses have immutable headers; copy them before mutation.
        let headers = cached.headers().clone();
        let mut response = if head {
            Response::empty()?.with_headers(headers)
        } else {
            cached.with_headers(headers)
        };
        response.headers_mut().set("X-Calendar-Cache", "HIT")?;
        console_log!("{}", json!({"event":"calendar_cache_hit"}));
        response
    } else if head {
        let mut response = Response::empty()?;
        response.headers_mut().set("X-Calendar-Cache", "MISS")?;
        response
    } else {
        console_log!(
            "{}",
            json!({"event":"calendar_render_start","device":config.device,"years":config.years,"layout":config.layout})
        );
        let bytes = render(
            &config.device,
            config.years,
            config.weeks(now),
            &config.layout,
            config.colors,
        );
        console_log!(
            "{}",
            json!({"event":"calendar_render_complete","bytes":bytes.len()})
        );
        let mut response = Response::from_bytes(bytes)?;
        response.headers_mut().set("Content-Type", "image/png")?;
        response
            .headers_mut()
            .set("Access-Control-Allow-Origin", "*")?;
        response
            .headers_mut()
            .set("X-Calendar-Renderer", RENDERER_VERSION)?;
        let mut stored = response.cloned()?;
        stored
            .headers_mut()
            .set("Cache-Control", "public, max-age=604800")?;
        ctx.wait_until(async move {
            if cache.put(key, stored).await.is_err() {
                console_error!("{}", json!({"event":"calendar_cache_write_failed"}));
            }
        });
        response.headers_mut().set("X-Calendar-Cache", "MISS")?;
        response
    };
    let cold_head = head && response.headers().get("X-Calendar-Cache")?.as_deref() == Some("MISS");
    response.headers_mut().set(
        "Cache-Control",
        &if cold_head {
            "no-store".into()
        } else {
            format!("public, max-age={}", config.client_ttl(now))
        },
    )?;
    response.headers_mut().set("Content-Type", "image/png")?;
    response.headers_mut().set(
        "Content-Disposition",
        &format!("inline; filename=\"life-calendar-{}.png\"", config.dob),
    )?;
    response
        .headers_mut()
        .set("Access-Control-Allow-Origin", "*")?;
    response
        .headers_mut()
        .set("X-Calendar-Renderer", RENDERER_VERSION)?;
    Ok(response)
}
