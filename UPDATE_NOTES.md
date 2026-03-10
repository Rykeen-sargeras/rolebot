# Bot Update - Fixed Address Detection & !checklive

## 🔧 What Was Fixed

### 1. Address Detection Too Sensitive ✅
**Problem:** Bot was timing out people for typing random numbers

**Fix:**
- Made patterns much more strict
- Now requires actual street indicators (street, avenue, road, etc.)
- ZIP codes only detected with USA/state context
- Added whitelist for URLs, prices, code snippets
- Ignores messages under 15 characters
- Requires minimum address length and context

**What triggers NOW:**
- ✅ `123 Main Street, New York, NY 10001` - Full address
- ✅ `456 Oak Avenue, Los Angeles, CA` - Street address
- ✅ `Apartment 5B, 789 Park Blvd` - Apartment with street
- ✅ `NSW 2000` - Australian postcode

**What DOESN'T trigger anymore:**
- ❌ `12345` - Just numbers
- ❌ `100 dollars` - Numbers with context
- ❌ `Room 123` - Room numbers without street
- ❌ `https://example.com/12345` - URLs
- ❌ `Error code 12345` - Technical info
- ❌ `line 50` - Code references

### 2. !checklive Command Enhanced ✅
**Problem:** Command didn't show stream info in main chat

**Fix:**
- Now posts full embed cards to main chat when streams found
- Shows live streams with red "LIVE NOW" badge
- Shows upcoming streams with time until start
- Better error messages if YouTube not configured
- Falls back to command channel if main chat not set

**What you see now:**
```
Staff: !checklive
Bot: 🔍 Checking YouTube for live streams...

[In main chat - Embed appears]
🔴 LIVE NOW!
Title: Stream Title Here
[Watch on YouTube]

Bot: ✅ Found 1 live stream(s)! Posted to main chat.
```

Or for upcoming:
```
[In main chat - Embed appears]
📅 Upcoming Stream
Title: Stream Title Here
⏰ Starts in: 2h 30m
Scheduled: [timestamp]
[Watch on YouTube]

Bot: ✅ Found 1 upcoming stream(s)! Posted to main chat.
```

---

## 📥 How to Apply Update

### Option 1: Replace File on GitHub
1. Go to your GitHub repository
2. Click `discord_bot.js` → Delete file
3. Upload the new `discord_bot.js` from this download
4. Commit changes
5. Railway auto-deploys

### Option 2: Copy/Paste
1. Download the new `discord_bot.js`
2. Open it in a text editor
3. Copy ALL the content
4. Go to GitHub → `discord_bot.js` → Edit
5. Delete all content, paste new content
6. Commit changes

---

## 🧪 Testing the Fixes

### Test 1: Address Detection (Should NOT Trigger)
Try posting these as non-staff:
```
12345
100 points
Room 123
Error 404
https://discord.gg/12345
$50 price
```
**Expected:** None deleted, no timeout

### Test 2: Address Detection (SHOULD Trigger)
Try posting this as non-staff:
```
123 Main Street, New York, NY 10001
```
**Expected:** Deleted, timeout, mod alert

### Test 3: !checklive Command
As staff, type:
```
!checklive
```
**Expected:** 
- Bot checks YouTube
- If stream found → Embed posted to main chat
- If no stream → "No streams found"

---

## ⚙️ Configuration Required for !checklive

Make sure these are set in Railway:
- `YOUTUBE_API_KEY` - Your YouTube API key
- `YOUTUBE_CHANNEL_ID` - Scooter's channel ID
- `MAIN_CHAT_CHANNEL_ID` - Where to post stream alerts

If not set, command will tell you which variables are missing.

---

## 🆕 Whitelist Feature

The bot now ignores messages containing these context clues:
- URLs (http, https, www, .com, etc.)
- Prices ($, €, £, buy, sell, cost, price)
- Code/technical terms (code, error, line, function)
- Testing phrases (example, test, fake, sample)
- Social media links (discord.gg, youtube.com, twitter.com)

This prevents false positives while still catching real addresses.

---

## 📊 Logs to Watch For

After update, Railway logs will show:
```
🚨 Address detected from Username in #channel
Address pattern matched: "123 Main Street..."
✅ Passed validation checks
✅ Message deleted
✅ Alert sent to mod channel
```

Or for false positives avoided:
```
Address pattern matched but ignored: "12345"
Reason: Too short / No context / Whitelisted phrase
```

---

## 💡 Pro Tips

### Adjust Sensitivity
If you want it even more strict or lenient, you can modify the patterns in the code:

**More strict:** Require full address format (number + street + city + state)
**Less strict:** Add more pattern variations

### Temporary Disable
To temporarily disable address detection without removing the feature:
1. Railway → Variables
2. Add: `DISABLE_ADDRESS_DETECTION=true`
3. Bot will skip address checking

(This isn't implemented yet but I can add it if you want)

---

## 🎉 You're Updated!

The bot is now:
- ✅ Smarter about address detection
- ✅ Better at showing stream info
- ✅ Less likely to false-positive
- ✅ More helpful with !checklive

Test it out and let me know if you need more adjustments!
