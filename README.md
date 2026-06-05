# FlowCall 🚰📞

**Never miss a plumbing lead again.** FlowCall is an automated call and request handler for local plumbing companies. It answers incoming calls, texts, and web requests 24/7 — capturing customer details, job descriptions, and priority level, then forwarding everything to the plumber with an auto-email confirmation to the customer.

## Features

- **📋 Web Request Form** — Customers submit plumbing requests via a mobile-friendly form
- **📊 Plumber Dashboard** — Real-time view of all requests, sorted by priority, with search, filters, and status management
- **📞 Twilio Voice IVR** — 5-step call flow (name → description → priority → email → confirm)
- **💬 Twilio SMS** — Multi-turn conversation intake via text
- **📧 Auto-Email** — Customer confirmation + plumber notification (SendGrid / Resend / console log)
- **🔔 Priority System** — Urgent / Standard / Low with color-coded badges
- **📈 Live Stats** — At-a-glance view of new, urgent, pending, and resolved requests

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### 1. Install

```bash
git clone https://github.com/Blazestar23X/FrontAPI.git flowcall
cd flowcall
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` to customize your company name and contact info:

```env
PORT=3000
DEFAULT_COMPANY_NAME="Your Plumbing Co."
DEFAULT_COMPANY_PHONE=+15551234567
DEFAULT_COMPANY_EMAIL=plumber@example.com
```

### 3. Run

```bash
npm start
```

Or with auto-reload for development:

```bash
npm run dev
```

### 4. Open in browser

| Page | URL | Description |
|------|-----|-------------|
| Customer Form | `http://localhost:3000/form.html` | Submit a plumbing request |
| Plumber Dashboard | `http://localhost:3000/dashboard/` | View & manage requests |
| Health Check | `http://localhost:3000/health` | Server status |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/requests` | Create a plumbing request |
| GET | `/api/requests` | List requests (filter by `status`, `priority`, `source`) |
| GET | `/api/requests/:id` | Get request details |
| PATCH | `/api/requests/:id` | Update status, notes, or priority |
| POST | `/api/requests/:id/notify` | Re-notify plumber |
| POST | `/api/customers` | Create a customer |
| GET | `/api/customers/:id` | Get customer details |
| GET | `/api/customers` | Search customers by phone or name |
| POST | `/twilio/voice` | Twilio voice webhook (IVR entry) |
| POST | `/twilio/sms` | Twilio SMS webhook |
| POST | `/api/notify-plumber` | Manual plumber notification |
| GET | `/health` | Server health check |

## Enabling Twilio (Phone Calls & SMS)

1. Sign up at [twilio.com](https://www.twilio.com)
2. Get a phone number with voice and SMS capabilities
3. Add to `.env`:

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

4. Configure your Twilio phone number's webhooks to point to:
   - Voice: `https://your-domain.com/twilio/voice`
   - SMS: `https://your-domain.com/twilio/sms`

> 💡 For local development, use [ngrok](https://ngrok.com/) to expose your local server: `ngrok http 3000`

## Enabling Email

Choose one provider and add to `.env`:

**Resend:**
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxx
```

**SendGrid:**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
```

> Without an API key, emails are logged to the console — perfect for testing.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** SQLite (via sql.js — zero native dependencies)
- **Voice/SMS:** Twilio
- **Email:** SendGrid / Resend
- **Frontend:** Vue 3, Tailwind CSS (dashboard), vanilla HTML/CSS/JS (form)

## Project Structure

```
flowcall/
├── server.js              # Express app entry point
├── package.json           # Dependencies and scripts
├── .env.example           # Configuration template
├── db/
│   ├── schema.sql         # Database tables
│   ├── seed.sql           # Sample data
│   ├── connection.js      # Database connection (sql.js)
│   └── init.js            # Database initialization
├── routes/
│   ├── requests.js        # Request CRUD API
│   ├── customers.js       # Customer CRUD API
│   ├── webhooks.js        # Twilio voice + SMS webhooks
│   └── notifications.js   # Manual notification endpoints
├── services/
│   ├── email.js           # Email sending (Resend/SendGrid/console)
│   ├── twilio.js          # TwiML generators for IVR prompts
│   └── notifications.js   # Plumber notification dispatch
└── public/
    ├── form.html          # Customer-facing request form
    └── dashboard/
        └── index.html     # Plumber dashboard (Vue 3 SPA)
```

## License

MIT