# Address Detection Not Sending to Mod Channel - Fix

## 🔍 Diagnosis

Use the new `!config` command to check your setup:

```
!config
```

This will show you which environment variables are set and which channels the bot can see.

---

## ✅ Solution Checklist

### Step 1: Verify MOD_CHANNEL_ID is Set

1. Go to **Railway → Your Project → Variables**
2. Check if `MOD_CHANNEL_ID` exists
3. If not, add it:
   - Variable name: `MOD_CHANNEL_ID`
   - Variable value: (your mod channel ID)

### Step 2: Get the Correct Channel ID

1. In Discord, enable **Developer Mode**:
   - User Settings → Advanced → Developer Mode (ON)

2. Right-click your mod channel → **Copy Channel ID**

3. The ID should look like: `1234567890123456789` (long number)

### Step 3: Add to Railway

1. Railway → Variables tab
2. Click "New Variable"
3. Name: `MOD_CHANNEL_ID`
4. Value: Paste the channel ID
5. Press Enter to save

### Step 4: Verify Bot Permissions

The bot needs these permissions in the mod channel:
- ✅ View Channel
- ✅ Send Messages
- ✅ Embed Links

**To check:**
1. Go to the mod channel
2. Channel Settings → Permissions
3. Find your bot's role
4. Make sure it has those permissions

### Step 5: Check Railway Logs

1. Railway → Deployments → Latest deployment
2. Look for these messages when address is detected:
   ```
   🚨 Address detected from Username in #channel-name
   MOD_CHANNEL_ID configured: 1234567890123456789
   ✅ Message deleted
   ✅ User timed out
   ✅ Mod channel fetched: mod-chat
   ✅ Alert sent to mod channel
   ```

If you see errors:
- `❌ MOD_CHANNEL_ID not configured!` → Add the variable
- `❌ Error sending to mod channel: Unknown Channel` → Wrong channel ID
- `❌ Error sending to mod channel: Missing Permissions` → Fix permissions

---

## 🧪 Testing

### Test 1: Check Configuration
```
In server: !config
```
Should show: `Mod Channel: ✅ #your-mod-channel`

### Test 2: Trigger Address Detection

As a **non-staff** member, post:
```
123 Main Street, New York, NY 10001
```

**Expected behavior:**
1. ✅ Message deleted immediately
2. ✅ You get timed out for 12 hours
3. ✅ Mod channel gets alert with the address
4. ✅ You get a DM explaining why

### Test 3: Check Logs

Go to Railway logs and look for:
```
🚨 Address detected from...
✅ Alert sent to mod channel
```

---

## 🔧 Common Issues

### "Channel not found"
**Problem:** Channel ID is wrong or bot can't see the channel

**Fix:**
1. Make sure channel ID is correct
2. Check bot can see the channel (not in a category it's excluded from)
3. Verify bot's role has "View Channel" permission

### "Missing permissions"
**Problem:** Bot can send messages but not embeds

**Fix:**
1. Mod channel → Settings → Permissions
2. Bot's role → Enable "Embed Links"

### "Not staff but still exempt"
**Problem:** User not timing out because they're considered staff

**Fix:**
1. Check STAFF_ROLE_IDS in Railway variables
2. Make sure test user doesn't have any of those roles
3. Use `!config` to see which roles are staff

---

## 📊 Updated Files

I've updated the bot code with:
- ✅ Better error logging
- ✅ New `!config` command to check setup
- ✅ More detailed console output

**To apply the update:**
1. Download the updated `discord_bot.js` file
2. Replace the one in your GitHub repo
3. Railway will auto-redeploy
4. Check logs for detailed messages

---

## 💡 Quick Test After Fix

```
1. Type: !config
   → Check Mod Channel shows ✅

2. Post fake address as non-staff
   → Should be deleted + timeout + alert

3. Check Railway logs
   → Should see all ✅ checkmarks
```

If all three work, you're good to go! 🎉
