# Enhanced Discord Bot Setup Guide

## 🆕 New Features Added

This bot now includes:
1. ✅ **Role Permission Management** (original feature)
2. 🔴 **YouTube Stream Alerts** 
3. 🎫 **DM Ticket System**
4. 🚨 **Address Detection & Auto-Moderation**
5. ⚙️ **Staff Commands**

---

## 📋 Required Configuration

You need to set these environment variables in Railway:

### Required Variables:

1. **DISCORD_TOKEN** - Your Discord bot token (you already have this)

### Optional but Recommended:

2. **YOUTUBE_API_KEY** - For stream alerts
3. **YOUTUBE_CHANNEL_ID** - Scooter's YouTube channel ID
4. **MAIN_CHAT_CHANNEL_ID** - Where stream alerts are posted
5. **ANNOUNCEMENT_CHANNEL_ID** - Where live pings are published
6. **MOD_CHANNEL_ID** - Where address detection alerts go
7. **LOG_CHANNEL_ID** - Where ticket transcripts are saved
8. **TICKET_CATEGORY_ID** - Category for ticket channels
9. **STAFF_ROLE_IDS** - Comma-separated role IDs for staff (e.g., `123456789,987654321`)

---

## 🔧 Step-by-Step Setup

### Step 1: Get YouTube API Key

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the API key

### Step 2: Get YouTube Channel ID

**Method 1 - From Channel URL:**
- If URL is `youtube.com/@ScooterName`, go to the channel
- View page source (Ctrl+U)
- Search for "channelId"
- Copy the ID (looks like: `UCxxxxxxxxxxxxxxxxxxxx`)

**Method 2 - Quick Tool:**
- Go to: https://www.streamweasels.com/tools/youtube-channel-id-and-user-id-convertor/
- Enter the channel URL
- Get the Channel ID

### Step 3: Get Discord Channel IDs

1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode (ON)

2. Right-click any channel → Copy Channel ID

3. Get IDs for:
   - Main chat channel (for stream alerts)
   - Announcement channel (for @everyone pings)
   - Mod channel (for address alerts)
   - Log channel (for ticket transcripts)
   - Ticket category (optional - where ticket channels are created)

### Step 4: Get Staff Role IDs

1. In Discord, type: `\@RoleName` (the role you want)
2. Send the message
3. Copy the numbers from `<@&123456789>`
4. Repeat for all staff roles
5. Combine with commas: `123456789,987654321,555555555`

### Step 5: Add Variables to Railway

1. Go to Railway dashboard
2. Click your bot project
3. Click "Variables" tab
4. Add each variable:

```
DISCORD_TOKEN = your_bot_token
YOUTUBE_API_KEY = your_youtube_api_key
YOUTUBE_CHANNEL_ID = UCxxxxxxxxxxxxxxxxxxxx
MAIN_CHAT_CHANNEL_ID = 123456789012345678
ANNOUNCEMENT_CHANNEL_ID = 123456789012345678
MOD_CHANNEL_ID = 123456789012345678
LOG_CHANNEL_ID = 123456789012345678
TICKET_CATEGORY_ID = 123456789012345678
STAFF_ROLE_IDS = 123456789,987654321
```

### Step 6: Update Your Code

1. Go to your GitHub repository
2. Delete the old `discord_bot.js`
3. Upload the new `discord_bot_enhanced.js`
4. Rename it to `discord_bot.js` (or update package.json main field)
5. Update `package.json` with the new version
6. Railway will auto-deploy

---

## 🎯 How Each Feature Works

### 🔴 YouTube Stream Alerts

**How it works:**
- Checks YouTube every minute for upcoming/live streams
- Announces in main chat at: 2hrs, 1hr, 30min, 5min before
- When live, pings @everyone and publishes to announcement channel

**Staff command:**
- `!checklive` - Manually trigger a stream check

**Setup requirement:**
- YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID must be set

---

### 🎫 DM Ticket System

**How it works:**
- User DMs the bot
- Bot asks: `tech` or `report`?
- **Tech ticket:** User describes issue → private channel created
- **Report ticket:** 3-step flow (who/what/proof) → private channel created
- Staff can use `!close` in the ticket channel to archive & delete

**Ticket channels:**
- Only visible to the user who created it and staff
- Created in the TICKET_CATEGORY (if set)
- Named: `tech-1234` or `report-5678`

**Close command:**
- `!close` - Saves transcript to log channel, deletes ticket after 5sec

---

### 🚨 Address Detection

**How it works:**
- Monitors all messages from non-staff members
- Detects patterns like:
  - US street addresses & ZIP codes
  - UK postcodes
  - Australian postcodes
  - French postcodes
  - Apartment/unit numbers

**When address detected:**
1. Message is deleted immediately
2. User is timed out for 12 hours
3. Mod channel gets alert with ||hidden address||
4. User gets DM explaining why

**Who is exempt:**
- Anyone with a role in STAFF_ROLE_IDS

---

### ⚙️ Staff Commands

**Available in server channels:**

- `!checklive` - Manually check YouTube for streams
- `!online` - Set bot status to online (green)
- `!offline` - Set bot status to offline (invisible)
- `!close` - Close and archive a ticket channel
- `!help` - Show all commands
- `!dashboard` - Generate HTML role permissions dashboard
- `!role` - Select a role to manage
- `!permission` - Modify role permissions

**Who can use:**
- Anyone with a role in STAFF_ROLE_IDS
- Anyone with Administrator permission

---

## 🔐 Required Bot Permissions

Make sure your bot has these permissions:

**Essential:**
- ✅ Manage Roles
- ✅ Manage Channels (create ticket channels)
- ✅ Manage Messages (delete addresses)
- ✅ Timeout Members (address detection)
- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files

**Update invite URL:**
1. Discord Developer Portal → OAuth2 → URL Generator
2. Select `bot` scope
3. Select all permissions above
4. Use new invite URL to re-add bot (or update permissions in Server Settings)

---

## 🚀 Railway Port Configuration

The bot runs a keep-alive server on port 10000 (Railway's default).

**In Railway:**
- Settings → Networking → Make sure port 10000 is exposed
- This keeps the bot alive 24/7

---

## 🧪 Testing Each Feature

### Test Stream Alerts:
```
In server: !checklive
(Should respond confirming stream check)
```

### Test Ticket System:
```
1. DM the bot
2. Type: tech
3. Describe an issue
4. Check server for new tech-XXXX channel
```

### Test Address Detection:
```
As non-staff member, try posting:
"123 Main Street, New York, NY 10001"
(Should be deleted + timeout)
```

### Test Staff Commands:
```
!online
!offline
!help
```

---

## 📊 Monitoring

**Check Railway Logs for:**
- `✅ Bot logged in as...` - Bot started successfully
- `📊 Dashboard available at...` - Keep-alive server running
- `⚠️ YouTube API not configured` - Need to add API key
- Stream check activity every minute

**Check Discord:**
- Bot shows online
- Responds to DMs
- Stream alerts appear in main chat (when streams scheduled)

---

## ❓ Troubleshooting

**Stream alerts not working:**
- Check YOUTUBE_API_KEY is valid
- Check YOUTUBE_CHANNEL_ID is correct
- Check MAIN_CHAT_CHANNEL_ID is correct
- Use `!checklive` to test manually

**Tickets not creating:**
- Check STAFF_ROLE_IDS is set
- Check bot has "Manage Channels" permission
- Check TICKET_CATEGORY_ID exists (or remove it to create in root)

**Address detection not working:**
- Check STAFF_ROLE_IDS is set (so staff are exempt)
- Check bot has "Manage Messages" and "Timeout Members" permissions
- Check MOD_CHANNEL_ID is set

**Bot keeps crashing:**
- Check Railway logs for specific errors
- Make sure DISCORD_TOKEN is set
- Make sure Node.js 18+ is being used

---

## 🎉 You're All Set!

Once configured, the bot will:
- ✅ Monitor YouTube for streams every minute
- ✅ Accept and process DM tickets
- ✅ Auto-moderate addresses in chat
- ✅ Manage role permissions via commands
- ✅ Stay online 24/7 on Railway

**Need help?** Check the Railway deployment logs for detailed error messages!
