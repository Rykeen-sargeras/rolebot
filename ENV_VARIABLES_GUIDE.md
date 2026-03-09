# Environment Variables - Quick Reference

Copy these into Railway's Variables tab:

## Required:
```
DISCORD_TOKEN=your_discord_bot_token_here
```

## YouTube Stream Alerts (Optional but recommended):
```
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxx
MAIN_CHAT_CHANNEL_ID=123456789012345678
ANNOUNCEMENT_CHANNEL_ID=123456789012345678
```

## Moderation & Tickets (Optional but recommended):
```
MOD_CHANNEL_ID=123456789012345678
LOG_CHANNEL_ID=123456789012345678
TICKET_CATEGORY_ID=123456789012345678
STAFF_ROLE_IDS=123456789,987654321,555555555
```

---

## How to Get Each Value:

### DISCORD_TOKEN
1. Discord Developer Portal → Your App → Bot
2. Reset Token → Copy

### YOUTUBE_API_KEY
1. Google Cloud Console → New Project
2. Enable YouTube Data API v3
3. Credentials → Create API Key

### YOUTUBE_CHANNEL_ID
1. Go to YouTube channel
2. View page source
3. Search for "channelId"
4. Or use: https://www.streamweasels.com/tools/youtube-channel-id-and-user-id-convertor/

### Channel IDs (MAIN_CHAT, ANNOUNCEMENT, MOD, LOG)
1. Discord → User Settings → Advanced → Developer Mode ON
2. Right-click channel → Copy Channel ID

### TICKET_CATEGORY_ID
1. Right-click a category → Copy Channel ID
2. Or leave blank to create tickets in root

### STAFF_ROLE_IDS
1. In Discord, type: \@RoleName
2. Copy numbers from <@&123456789>
3. Combine multiple with commas: 123,456,789

---

## Example Complete Setup:

```
DISCORD_TOKEN=MTIzNDU2Nzg5.GaBcDe.FgHiJkLmNoPqRsTuVwXyZ123
YOUTUBE_API_KEY=AIzaSyAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
MAIN_CHAT_CHANNEL_ID=1234567890123456789
ANNOUNCEMENT_CHANNEL_ID=9876543210987654321
MOD_CHANNEL_ID=1111111111111111111
LOG_CHANNEL_ID=2222222222222222222
TICKET_CATEGORY_ID=3333333333333333333
STAFF_ROLE_IDS=444444444444444444,555555555555555555
```

---

## Features That Work Without Optional Variables:

**If you ONLY set DISCORD_TOKEN:**
- ✅ Role management commands (!dashboard, !role, !permission)
- ✅ DM tickets (but won't create channels properly without STAFF_ROLE_IDS)
- ✅ Basic staff commands (!online, !offline, !help)

**What WON'T work without optional variables:**
- ❌ YouTube stream alerts (needs YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID)
- ❌ Address detection alerts (needs MOD_CHANNEL_ID)
- ❌ Ticket transcripts (needs LOG_CHANNEL_ID)
- ❌ Proper ticket permissions (needs STAFF_ROLE_IDS)

---

## Minimum Recommended Setup:

For full functionality, set at least:
```
DISCORD_TOKEN
STAFF_ROLE_IDS
MOD_CHANNEL_ID
LOG_CHANNEL_ID
```

This gives you:
- Role management ✅
- Ticket system ✅
- Address detection ✅
- Staff commands ✅

Add YouTube variables later when you want stream alerts.
