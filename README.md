# mail-cli

A CLI email reader and tagger for Gmail.

## Requirements

- [Bun](https://bun.sh/) runtime
- Google Cloud project with Gmail API enabled

## Setup

### 1. Clone and install dependencies

```bash
bun install
```

### 2. Create Google Cloud OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API: APIs & Services → Library → search "Gmail API" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Desktop app
   - Copy the Client ID and Client Secret

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
GMAIL_CLIENT_ID=your-google-client-id
GMAIL_CLIENT_SECRET=your-google-client-secret
```

### 4. Initialize database

```bash
bun run db:migrate
```

## Usage

### Authenticate

```bash
bun run mail auth
```

Opens a browser for Google OAuth consent. Credentials are stored securely.

### Check system health

```bash
bun run mail doctor
```

Verifies auth, token, and database status.

### Sync emails

```bash
bun run mail sync              # Sync last 30 days
bun run mail sync --days 7     # Sync last 7 days
```

### List messages

```bash
bun run mail ls                          # List 20 most recent
bun run mail ls --limit 50               # List 50 messages
bun run mail ls --tag important          # Filter by tag
bun run mail ls --include-archived       # Include archived messages
bun run mail ls --include-deleted        # Include deleted messages
```

### View message

```bash
bun run mail show 123    # Show message with ID 123
```

### Tag messages

```bash
bun run mail tag add 123 important    # Add tag to message
bun run mail tag rm 123 important     # Remove tag from message
bun run mail tag ls                   # List all tags
```

### Archive/Delete

```bash
bun run mail archive 123    # Archive message
bun run mail delete 123     # Delete message
```

## Data storage

- Database: `~/.mail-cli/mail.db` (SQLite)
- Tokens: stored securely via system keychain (keytar)
