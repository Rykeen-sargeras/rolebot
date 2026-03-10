# New Features: User Management, Quick Actions & Alt Detection

## 🆕 What's Been Added

### 1. Alt Account Detection 🔍
Automatically detects and alerts when suspicious new accounts join

### 2. User Management 👥
Search, view, and take action on users from web dashboard

### 3. Quick Actions ⚡
One-click bot controls and server statistics

---

## 🔍 Alt Account Detection

### How It Works

When someone joins your server, the bot checks:
- **Account age** - How old is the Discord account?
- **Default avatar** - Are they using Discord's default avatar?
- **Join timing** - Did they just create the account?

If suspicious, an alert is sent to your mod channel.

### Alert Triggers

By default, accounts **newer than 7 days** trigger an alert.

**Example Alert:**
```
⚠️ Potential Alt Account Detected

User: NewUser#1234 (123456789)
Account Age: 2 days old
Created: 2 days ago
Joined: Just now
Default Avatar: Yes ⚠️
Status: 🔍 Review recommended
```

### Configuration

**Enable/Disable:**
```
Railway Variable:
ALT_DETECTION_ENABLED = true  (or false to disable)
```

**Change Age Threshold:**
```
Railway Variable:
ALT_ACCOUNT_AGE_DAYS = 7  (default: 7 days)
```

Examples:
- `ALT_ACCOUNT_AGE_DAYS = 14` - Flag accounts under 2 weeks
- `ALT_ACCOUNT_AGE_DAYS = 3` - Flag accounts under 3 days
- `ALT_ACCOUNT_AGE_DAYS = 30` - Flag accounts under 1 month

### What Gets Logged

Every member join is logged with:
- User info
- Account age
- Whether it triggered alt detection

Check audit log for all join events.

---

## 👥 User Management

### Search Users

**From Web Dashboard:**
1. Go to "User Management" tab
2. Enter username, tag, or ID
3. Click "Search"
4. Results appear instantly

**Search by:**
- Username: `john`
- Full tag: `JohnDoe#1234`
- User ID: `123456789012345678`
- Display name: `Johnny`

### User Profile View

When you search, you see:
- **Avatar** - User's profile picture
- **Tag** - Username#1234
- **Display Name** - Server nickname
- **User ID** - Their Discord ID
- **Joined Server** - When they joined
- **Account Created** - When Discord account was made
- **Roles** - All roles (with colors)
- **Timeout Status** - If currently timed out

### Actions You Can Take

For each user, you can:

#### ⏱️ Timeout
- Choose duration (minutes)
- Optional reason
- User can't send messages until timeout expires
- Can be undone

#### ❌ Remove Timeout
- Instantly un-timeout a user
- Restores their ability to chat

#### 👢 Kick
- Removes user from server
- They can rejoin with invite link
- Optional reason

#### 🔨 Ban
- Permanently removes user
- They cannot rejoin
- Optional reason

### Example Workflow

```
1. User "BadUser" is spamming
2. Open dashboard → User Management
3. Search: "BadUser"
4. Click "Timeout"
5. Duration: 60 minutes
6. Reason: "Spamming"
7. Click "Apply"
8. Done! User is timed out
```

All actions are logged in audit log.

---

## ⚡ Quick Actions

### Available Actions

From the dashboard, one-click buttons for:

#### 🔴 Check Live Stream
- Manually trigger YouTube stream check
- Same as `!checklive` command
- Checks for live/upcoming streams
- Posts alerts if streams found

#### 🟢 Set Bot Online
- Changes bot status to "Online" (green)
- Users see bot as active

#### ⚫ Set Bot Offline
- Changes bot status to "Invisible"
- Bot still works, just appears offline

#### 🗑️ Clear Audit Log
- Clears all audit log entries
- Fresh start
- Cannot be undone

#### 📊 View Statistics
- Shows server stats:
  - Total members
  - Online members
  - Total roles
  - Total channels
  - Audit entries
  - Bot uptime

### Statistics Display

**What you see:**
```
Server Statistics:
━━━━━━━━━━━━━━━━
Total Members: 1,523
Online Now: 342
Roles: 15
Channels: 45
Audit Entries: 127
Bot Uptime: 5 hours, 23 minutes
```

---

## 🌐 Web Dashboard Updates

### New Tabs

Dashboard now has **6 tabs**:

1. **📨 Messages** - Send to main chat
2. **📢 Announcements** - Post announcements
3. **👥 User Management** - Search & manage users
4. **⚡ Quick Actions** - Bot controls
5. **📋 Audit Log** - View activity
6. **🔐 Roles** - View permissions

### User Management Tab

**Layout:**
```
┌─────────────────────────────────────┐
│ 🔍 Search Users                     │
│ ┌─────────────────────────────────┐ │
│ │ Enter username, tag, or ID...   │ │
│ └─────────────────────────────────┘ │
│ [Search]                            │
├─────────────────────────────────────┤
│ Search Results:                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 👤 JohnDoe#1234                 │ │
│ │ ID: 123456789                   │ │
│ │ Joined: 3 months ago            │ │
│ │ Roles: Member, Supporter        │ │
│ │ Status: Active                  │ │
│ │                                 │ │
│ │ [Timeout] [Kick] [Ban]          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Quick Actions Tab

**Layout:**
```
┌─────────────────────────────────────┐
│ ⚡ Quick Actions                    │
├─────────────────────────────────────┤
│ Stream Management:                  │
│ [🔴 Check Live Stream]              │
│                                     │
│ Bot Status:                         │
│ [🟢 Set Online] [⚫ Set Offline]    │
│                                     │
│ Maintenance:                        │
│ [🗑️ Clear Audit Log]                │
│                                     │
│ Server Info:                        │
│ [📊 View Statistics]                │
├─────────────────────────────────────┤
│ 📊 Server Statistics                │
│ Total Members: 1,523                │
│ Online: 342                         │
│ Roles: 15                           │
│ Channels: 45                        │
│ Uptime: 5h 23m                      │
└─────────────────────────────────────┘
```

---

## 🔐 Security & Permissions

### Who Can Use These Features?

Anyone with the dashboard password can:
- Search users
- View user info
- Timeout/kick/ban users
- Use quick actions

**Keep your password secure!**

### Bot Permissions Required

For user management to work, bot needs:
- ✅ Kick Members
- ✅ Ban Members
- ✅ Moderate Members (timeout)

### Audit Trail

All actions are logged:
- Who performed the action (Web Dashboard)
- What action was taken
- Target user
- Timestamp

Check audit log to see history.

---

## 🧪 Testing New Features

### Test Alt Detection

1. Create a test Discord account (or use a friend's new account)
2. Have them join your server
3. Check mod channel for alert
4. Check audit log

### Test User Management

1. Open dashboard → User Management
2. Search for your own username
3. View your profile
4. Don't actually timeout yourself! 😄

### Test Quick Actions

1. Go to Quick Actions tab
2. Click "View Statistics"
3. See your server stats
4. Try "Check Live Stream"
5. Check audit log for entries

---

## 🎯 Use Cases

### Alt Detection
**Scenario:** User gets banned, creates new account to evade ban

**Solution:** Alt detection alerts you immediately when the new account joins. You can:
- Check audit log for join timing
- Compare to recent bans
- Take action if confirmed

### User Management
**Scenario:** User reports harassment in DM

**Solution:** From anywhere (phone, work, etc.):
- Open dashboard on mobile
- Search the harasser
- Timeout or ban immediately
- No need to open Discord app

### Quick Actions
**Scenario:** Stream is about to start but bot hasn't announced

**Solution:**
- Open dashboard
- Click "Check Live Stream"
- Bot checks and posts announcement
- Stream gets promoted

---

## 📊 Alt Detection Statistics

The system tracks:
- How many joins per day
- How many flagged as potential alts
- Account age distribution

All visible in audit log.

**Example audit log entries:**
```
[INFO] Member Joined - NewUser#1234 - Account age: 45 days
[WARNING] Alt Account Detected - SuspiciousUser#5678 - Account age: 1 day
[INFO] Member Joined - OldUser#9012 - Account age: 1,234 days
```

---

## ⚙️ Configuration Summary

### New Environment Variables

```
# Alt Detection
ALT_DETECTION_ENABLED = true
ALT_ACCOUNT_AGE_DAYS = 7

# Existing (reminder)
WEB_DASHBOARD_PASSWORD = your_password
MOD_CHANNEL_ID = channel_id_here
```

### Recommended Settings

**For small servers (< 100 members):**
```
ALT_ACCOUNT_AGE_DAYS = 14
```

**For medium servers (100-1000 members):**
```
ALT_ACCOUNT_AGE_DAYS = 7
```

**For large servers (1000+ members):**
```
ALT_ACCOUNT_AGE_DAYS = 3
```

Adjust based on your needs!

---

## 💡 Pro Tips

### Alt Detection
- Check default avatar - most alts don't set custom avatars
- Check join timing - alts often join right after being banned
- Look for similar usernames to banned users

### User Management
- Bookmark the dashboard for quick access
- Use short timeouts first (10-30 min) before escalating
- Always add a reason for bans (helps track patterns)

### Quick Actions
- Check stream status before announcing manually
- Use statistics to track server growth
- Clear audit log monthly to keep it fast

---

## 🚀 Coming Soon

Potential future enhancements:
- **Advanced alt detection** - Check IP patterns, behavior similarity
- **Bulk user actions** - Timeout multiple users at once
- **User history** - See past timeouts/warns
- **Appeal system** - Let users request unban
- **Auto-actions** - Auto-timeout users flagged as alts

Want any of these? Let me know!

---

**Version:** 3.0
**Features Added:** Alt Detection, User Management, Quick Actions
**Updated:** March 2026
