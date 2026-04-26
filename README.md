# Wine Image Recognition MVP

Option A implementation: AI vision extraction followed by user confirmation.

## Flow

1. Open `Add / Scan Wine`.
2. Upload or capture a wine bottle photo.
3. The browser posts the image to `/api/recognize-wine`.
4. The API route calls `lib/imageRecognition.ts` on the server.
5. The UI renders one editable card per detected bottle.
6. The user can confirm, edit, reject, or add a missing bottle.
7. Only confirmed bottles are saved to the session cellar.

## Configuration

Copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_VISION_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, the app returns mock candidates so the confirmation flow remains testable.

## Scan Troubleshooting

When recognition fails, the app shows recovery options in the scan screen:

- Try the same photo again.
- Add the bottle manually.
- Follow provider-specific suggestions, such as checking `OPENAI_API_KEY` in Vercel and redeploying.

An OpenAI `401` usually means the Vercel environment variable is missing, copied incorrectly, or the deployment was not redeployed after the key changed.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```
