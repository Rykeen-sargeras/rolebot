# Web Dashboard Guide - Audit Log & Send Messages

## 🎉 Good News!

Your bot ALREADY has a built-in web dashboard with:
- ✅ **Audit Log** - See all bot actions in real-time
- ✅ **Send Messages** - Post to main chat from the web
- ✅ **Live Updates** - Auto-refreshes every 10 seconds
- ✅ **Password Protected** - Secure access

---

## 🌐 How to Access the Dashboard

### Step 1: Get Your Railway URL

1. Go to **Railway Dashboard**
2. Click on your bot project
3. Click on the service
4. Go to **"Settings"** tab
5. Scroll to **"Networking"**
6. You'll see a URL like: `https://your-bot-name.up.railway.app`
7. Copy this URL

### Step 2: Visit the Dashboard

1. Open your browser
2. Go to: `https://your-bot-name.up.railway.app/dashboard`
3. You'll see a login screen

### Step 3: Set Your Password

By default, the password is `admin123` but you should change it!

**To set a custom password:**
1. Railway → Variables tab
2. Add new variable:
   - Name: `WEB_DASHBOARD_PASSWORD`
   - Value: `your_secure_password_here`
3. Save and wait for redeploy

### Step 4: Login

1. Enter your password
2. Click "Login"
3. You'll see the dashboard!

---

## 📊 Dashboard Features

### Audit Log Section

Shows all bot activity:
- 🟢 **Success** - Bot started, messages sent
- 🟡 **Warning** - Address detected, user timed out
- 🔵 **Info** - General actions
- 🔴 **Error** - Problems or failures

**Columns:**
- **Time** - When it happened
- **Action** - What happened
- **User** - Who did it (or System)
- **Details** - More information

**Auto-Refresh:** Updates every 10 seconds automatically

### Send Message Section

Post messages to your main chat from the web!

1. Type your message in the text box
2. Click "Send to Main Chat"
3. Message appears in your Discord main chat
4. You'll see a success notification

**Example Uses:**
- Post announcements when you're away from Discord
- Send reminders to your community
- Share updates quickly

---

## 🔐 Security

### Password Protection

All actions require password authentication:
- Viewing audit log
- Sending messages

### Change Your Password

**IMPORTANT:** Change from the default `admin123`!

```
Railway Variables:
WEB_DASHBOARD_PASSWORD = YourSecurePassword123!
```

### Who Can Access?

Anyone with:
1. The Railway URL
2. The dashboard password

**Keep these secret!** Don't share the URL or password publicly.

---

## ⚙️ Configuration

### Required Environment Variables

For full dashboard functionality:

```
DISCORD_TOKEN = your_bot_token
MAIN_CHAT_CHANNEL_ID = 123456789012345678
WEB_DASHBOARD_PASSWORD = your_secure_password
```

### Optional (but recommended):

```
MOD_CHANNEL_ID = 123456789012345678
LOG_CHANNEL_ID = 123456789012345678
STAFF_ROLE_IDS = 123456789,987654321
```

---

## 📱 Dashboard Layout

```
┌─────────────────────────────────────────┐
│     Discord Bot Dashboard               │
│     Bot: YourBot#1234  ●  Status: Online│
├─────────────────────────────────────────┤
│                                         │
│  📨 Send Message to Main Chat           │
│  ┌──────────────────────────────────┐  │
│  │ Type message here...             │  │
│  └──────────────────────────────────┘  │
│  [ Send to Main Chat ]                  │
│                                         │
├─────────────────────────────────────────┤
│  📋 Audit Log (Last 100 entries)        │
│  ┌──────────────────────────────────┐  │
│  │ Time        Action    User  Details│
│  │ 2:30 PM  Msg Sent   Web   "Hello"│
│  │ 2:25 PM  Address    User  Timeout│
│  │ 2:20 PM  Ticket     User  Tech   │
│  └──────────────────────────────────┘  │
│  Auto-refreshes every 10 seconds        │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing the Dashboard

### Test 1: Access the Dashboard
```
1. Go to: https://your-bot.up.railway.app/dashboard
2. Enter password
3. Should see dashboard
```

### Test 2: View Audit Log
```
1. Dashboard should show recent bot actions
2. Trigger an action in Discord (type !help)
3. Wait 10 seconds
4. Should see it in audit log
```

### Test 3: Send a Message
```
1. Type "Test message from web dashboard"
2. Click "Send to Main Chat"
3. Check your Discord main chat
4. Message should appear!
```

---

## 🔧 Troubleshooting

### Can't Access Dashboard

**Problem:** URL doesn't load

**Fix:**
1. Railway → Settings → Networking
2. Make sure service has a public domain
3. Check that bot is running (green status)

### "Invalid Password"

**Problem:** Password rejected

**Fix:**
1. Check `WEB_DASHBOARD_PASSWORD` in Railway
2. Use exact value (case-sensitive)
3. Default is `admin123` if not set

### Messages Not Sending

**Problem:** "Error: Channel not configured"

**Fix:**
1. Set `MAIN_CHAT_CHANNEL_ID` in Railway variables
2. Make sure channel ID is correct
3. Verify bot has permission to send messages in that channel

### Audit Log Empty

**Problem:** No entries showing

**Fix:**
- Audit log resets when bot restarts
- Wait for bot to perform some actions
- Use bot commands to generate entries

---

## 📈 What Gets Logged?

The audit log tracks:

- ✅ Bot starts/stops
- ✅ Address detections
- ✅ User timeouts
- ✅ Tickets created
- ✅ Tickets closed  
- ✅ Messages sent from web
- ✅ Stream alerts posted
- ✅ Permission changes (if you use role commands)
- ✅ Errors and warnings

---

## 💡 Pro Tips

### Bookmark the Dashboard
Add it to your browser bookmarks for quick access

### Mobile Friendly
The dashboard works on phones/tablets too!

### Share Carefully
Only share the URL and password with trusted staff

### Monitor Activity
Check the audit log regularly to see what your bot is doing

### Quick Announcements
Use the send message feature for quick community updates

---

## 🎨 Dashboard is Live!

Your dashboard is already running at:
```
https://YOUR-BOT-NAME.up.railway.app/dashboard
```

Just need to:
1. Find your Railway URL
2. Set a secure password
3. Start using it!

No code changes needed - it's already built in! 🎉
