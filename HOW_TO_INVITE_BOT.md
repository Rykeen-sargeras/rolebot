# How to Invite Your Bot to Your Discord Server

## Step-by-Step Instructions

### Step 1: Go to Discord Developer Portal
1. Visit: **https://discord.com/developers/applications**
2. Log in with your Discord account
3. Click on your bot application (the one you created)

### Step 2: Navigate to OAuth2
1. On the left sidebar, click **"OAuth2"**
2. Then click **"URL Generator"**

### Step 3: Select Bot Scopes
In the "SCOPES" section, check these boxes:
- ✅ **bot**

### Step 4: Select Bot Permissions
Scroll down to "BOT PERMISSIONS" and check these:

**Required Permissions:**
- ✅ **Manage Roles** (This is the most important one!)
- ✅ **View Channels**
- ✅ **Send Messages**
- ✅ **Read Message History**

**Optional (but recommended):**
- ✅ **Embed Links**
- ✅ **Attach Files**
- ✅ **Use External Emojis**

### Step 5: Copy the Generated URL
1. Scroll to the very bottom
2. You'll see "GENERATED URL"
3. Click **"Copy"** button

### Step 6: Use the Invite Link
1. Paste the URL in your web browser
2. A Discord authorization page will open
3. Select the server you want to add the bot to (you must have "Manage Server" permission)
4. Click **"Continue"**
5. Review the permissions
6. Click **"Authorize"**
7. Complete the CAPTCHA if prompted

### Step 7: Verify Bot is in Server
1. Go to your Discord server
2. Check the member list on the right
3. You should see your bot listed (it will show as offline until you deploy it)

---

## Quick Checklist ✅

After inviting:
- [ ] Bot appears in server member list
- [ ] Bot's role is created automatically
- [ ] Move bot's role higher in Server Settings → Roles (so it can manage other roles)

---

## Troubleshooting

**"You don't have permission to add bots"**
- You need "Manage Server" permission in the Discord server
- Ask a server admin to use the invite link instead

**Bot joined but shows offline**
- This is normal! Bot will be offline until you deploy it to Railway
- Once deployed with your token, it will show online

**Bot can't manage roles**
- Go to Server Settings → Roles
- Drag the bot's role ABOVE the roles you want it to manage
- Make sure it has "Manage Roles" permission

---

## One-Click Invite URL Template

You can also manually create the invite URL:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=268435456&scope=bot
```

**To get YOUR_BOT_CLIENT_ID:**
1. Discord Developer Portal
2. Your Application
3. General Information tab
4. Copy "APPLICATION ID"
5. Replace YOUR_BOT_CLIENT_ID in the URL above

**Permission number 268435456 includes:**
- Manage Roles
- View Channels
- Send Messages
- Read Message History

---

That's it! Once your bot is deployed on Railway, it will come online automatically!
