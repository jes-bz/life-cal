# Life Calendar Worker

This Cloudflare Worker generates the Life Calendar PNG images on the fly.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Login to Cloudflare (if not already logged in):
    ```bash
    npx wrangler login
    ```

3.  Deploy:
    ```bash
    npm run deploy
    ```

## Development

To run locally:
```bash
npm run dev
```

## Integration

Update `WORKER_URL` in `../index.html` with your deployed worker URL (e.g., `https://life-cal-worker.yourname.workers.dev`).
