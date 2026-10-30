# Integrations (state as of 30.10.2026)
| Capability | Path | Status | What is needed |
|---|---|---|---|
| generate_text (Claude Opus/Sonnet/Haiku 5.5) | Anthropic API, `ANTHROPIC_API_KEY` | **ממתין לחיבור** — המפתח קיים בפרויקט frame-ai כ-Sensitive ולא ניתן להעתקה; צריך להזין בפרויקט pixel-ai-office | Tal: Vercel → pixel-ai-office → Env → ANTHROPIC_API_KEY (Sensitive) |
| generate_image | OpenAI Images API (`OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`) — **נפרד** מ-ChatGPT | ממתין לחיבור | מפתח API + אישור חיוב API |
| agent portraits | ChatGPT בדפדפן (Browser-assisted, חשבון של טל) | **בוצע** — 5 גיליונות, יובאו כנכסים | — |
| generate_video | Kling API (`KLING_ACCESS_KEY/SECRET_KEY`) | ממתין לחיבור | מפתחות API + יתרה. ממשק Kling בדפדפן ≠ API |
| render_video | Local Runner + FFmpeg | מומש, ממתין ל-pairing | `npm run runner -- --pair CODE` |
| send_message (WhatsApp) | WhatsApp Cloud API רשמי + webhook חתום | מומש, ממתין לחיבור | WABA, phone number id, token, app secret, verify token; בדיקת Coexistence |
| send_message (test) | sandbox (טבלת בדיקה בלבד) | פעולה נבדקה | מספרי בדיקה בהגדרות |
| create_wp_draft | WordPress REST + Application Password לכל אתר | מומש, ממתין לחיבור לכל אתר | משתמש ייעודי + App Password לכל אתר (בקומה, s-pixel, …) |
| read_campaign_metrics | Meta Ads / Google Ads | טרם מומש (מתאם) | OAuth + developer token (Google) |
| read/create calendar | Google Calendar / Outlook | טרם מומש | OAuth |
| LinkedIn | טיוטות + ביצוע אנושי בלבד | לפי מדיניות LinkedIn — אין אוטומציה | — |
Statuses shown in-app: לא מחובר · ממתין להגדרה · גישה אומתה · פעולה נבדקה · חסרות הרשאות · פג תוקף · אין יתרה · מגבלת קצב · דורש משתמש · טרם מומש.
