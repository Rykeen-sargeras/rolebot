# Discord Multi-Function Bot - Complete Package

## 📦 What's Included

This is the complete Discord bot with all features and documentation.

### Core Files:
- `discord_bot.js` - Main bot code
- `package.json` - Dependencies
- `.nvmrc` - Node.js version
- `.gitignore` - Git ignore rules

### Documentation:
- `README.md` - Overview and quick start
- `DEPLOYMENT_GUIDE.md` - Complete GitHub + Railway setup
- `ENHANCED_SETUP_GUIDE.md` - Configuration for all features
- `ENV_VARIABLES_GUIDE.md` - Environment variables reference
- `WEB_DASHBOARD_GUIDE.md` - How to use the web dashboard
- `HOW_TO_INVITE_BOT.md` - Bot invitation instructions
- `USAGE_GUIDE.md` - Command usage examples
- `TROUBLESHOOTING.md` - Fix common issues
- `UPDATE_NOTES.md` - Latest changes
- `ADDRESS_DETECTION_FIX.md` - Address detection tuning

---

## ✨ Features

### 🔐 Role Permission Management
- View all role permissions in HTML dashboard
- Modify permissions via DM commands
- See channel access for each role

### 🔴 YouTube Stream Alerts
- Checks every minute for streams
- Announces at 2hrs, 1hr, 30min, 5min before
- @everyone ping when live
- Posts to announcement channel

### 🎫 DM Ticket System
- Tech support tickets
- Report tickets (3-step flow)
- Private channels for each ticket
- Archive transcripts on close

### 🚨 Address Detection
- Auto-detects real addresses
- Deletes message
- Times out user for 12 hours
- Alerts mod channel
- Smart filtering to avoid false positives

### 📊 Web Dashboard
- Real-time audit log
- Send messages to main chat
- Password protected
- Auto-refreshes every 10 seconds

### ⚙️ Staff Commands
- `!config` - Check bot configuration
- `!checklive` - Check YouTube streams
- `!online` / `!offline` - Set bot status
- `!close` - Close ticket channels
- `!dashboard` - Generate HTML role report
- `!role` / `!permission` - Manage roles

---

## 🚀 Quick Start

### 1. Upload to GitHub
- Create new repository
- Upload all files from this package
- Make sure `.gitignore` is included

### 2. Deploy to Railway
- Connect GitHub repo
- Add environment variables (see below)
- Bot auto-deploys

### 3. Required Variables
```
DISCORD_TOKEN = your_bot_token
```

### 4. Recommended Variables
```
YOUTUBE_API_KEY = your_youtube_key
YOUTUBE_CHANNEL_ID = channel_id
MAIN_CHAT_CHANNEL_ID = channel_id
ANNOUNCEMENT_CHANNEL_ID = channel_id
MOD_CHANNEL_ID = channel_id
LOG_CHANNEL_ID = channel_id
TICKET_CATEGORY_ID = category_id
STAFF_ROLE_IDS = role_id,role_id,role_id
WEB_DASHBOARD_PASSWORD = your_secure_password
```

---

## 📖 Documentation Guide

**Start here:** `DEPLOYMENT_GUIDE.md`
- Step-by-step setup from scratch
- GitHub and Railway instructions
- Complete walkthrough

**For configuration:** `ENHANCED_SETUP_GUIDE.md`
- How to get all the IDs you need
- Feature-by-feature setup
- Testing instructions

**For daily use:** `USAGE_GUIDE.md`
- How to use commands
- Example workflows
- Real-world scenarios

**Having issues?** `TROUBLESHOOTING.md`
- Common problems and fixes
- Checklist-based debugging
- Error solutions

**Web dashboard:** `WEB_DASHBOARD_GUIDE.md`
- How to access
- Send messages from web
- View audit log

---

## 🔧 What Each File Does

### `discord_bot.js`
The main bot code with all features:
- Stream monitoring (runs every minute)
- Address detection (on every message)
- Ticket system (DM handler)
- Web server (port 10000)
- Command handlers
- Audit logging

### `package.json`
Lists the dependencies:
- discord.js v14 (main library)
- Node.js 18+ required

### `.nvmrc`
Forces Railway to use Node.js 18.20.0
(Required for discord.js v14)

### `.gitignore`
Prevents committing:
- node_modules
- .env files
- Output files

---

## 🎯 Deployment Checklist

- [ ] Create Discord bot at discord.com/developers
- [ ] Enable all 3 privileged intents
- [ ] Copy bot token
- [ ] Invite bot to server
- [ ] Create GitHub repository
- [ ] Upload all files
- [ ] Create Railway account
- [ ] Deploy from GitHub
- [ ] Add DISCORD_TOKEN variable
- [ ] Add other variables (optional but recommended)
- [ ] Check Railway logs - should see "Bot logged in"
- [ ] Test with !help command
- [ ] Access web dashboard

---

## 🌐 Accessing Web Dashboard

1. Railway → Settings → Networking
2. Copy your URL: `https://yourbot.up.railway.app`
3. Visit: `https://yourbot.up.railway.app/dashboard`
4. Login with password (default: `admin123`)
5. View audit log & send messages!

---

## 💡 Pro Tips

### Security
- Change WEB_DASHBOARD_PASSWORD immediately
- Never commit DISCORD_TOKEN to GitHub
- Keep Railway URL private
- Only share with trusted staff

### Testing
- Test each feature individually
- Use `!config` to verify setup
- Check Railway logs for errors
- Test address detection with fake addresses

### Monitoring
- Check web dashboard regularly
- Review audit log for unusual activity
- Monitor Railway resource usage
- Keep an eye on timeout actions

### Optimization
- Adjust address detection patterns if too strict/loose
- Set stream check interval (currently 1 minute)
- Clean up old ticket channels
- Archive important audit logs

---

## 🆘 Getting Help

1. **Check the guides** - Most issues are covered
2. **Railway logs** - Show detailed error messages
3. **Use !config** - Verify your setup
4. **Test incrementally** - One feature at a time

### Common Issues

**Bot offline?**
- Check DISCORD_TOKEN in Railway
- Verify token is correct
- Check Railway deployment status

**Features not working?**
- Use `!config` to see what's configured
- Add missing environment variables
- Check bot permissions in Discord

**Address detection too sensitive?**
- See `ADDRESS_DETECTION_FIX.md`
- Adjust patterns in code
- Test with various inputs

---

## 📊 Stats

- **Lines of code:** 1,383
- **Features:** 6 major systems
- **Commands:** 10+ staff commands
- **Auto-tasks:** Stream checking, address monitoring
- **API endpoints:** 3 (audit log, send message, dashboard)

---

## 🎉 You're All Set!

Everything you need is in this package:
- ✅ Complete bot code
- ✅ All documentation
- ✅ Configuration guides
- ✅ Troubleshooting help

**Next step:** Read `DEPLOYMENT_GUIDE.md` and get started!

---

**Version:** 2.0 Enhanced
**Last Updated:** March 2026
**Node.js:** 18.20.0+
**Discord.js:** 14.14.1
