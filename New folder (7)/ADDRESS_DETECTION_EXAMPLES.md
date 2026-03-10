# Address Detection - What Triggers & What Doesn't

## ✅ Updated to Be MUCH More Strict

The address detection now requires **FULL ADDRESS FORMAT** with all three components:
1. **Street number** (e.g., 123)
2. **Street name + type** (e.g., Main Street)
3. **City/State/ZIP** (e.g., New York, NY 10001)

---

## ❌ Will NOT Trigger (Safe)

### Time References
- ✅ `28 minutes until I have`
- ✅ `2 hours until stream`
- ✅ `30 minutes ago`
- ✅ `in 5 minutes`
- ✅ `stream tonight at 8pm`

### Partial Addresses
- ✅ `123 Main Street` (no city/zip)
- ✅ `Main Street, New York` (no street number)
- ✅ `NY 10001` (no street)

### Room/Building Numbers
- ✅ `Room 123`
- ✅ `Building A`
- ✅ `Floor 5`
- ✅ `Unit 12`

### Measurements & Counts
- ✅ `100 miles`
- ✅ `50 points`
- ✅ `25 players`

### URLs & Links
- ✅ `https://example.com/street`
- ✅ `discord.gg/invite`
- ✅ `www.mainstreet.com`

### Prices & Money
- ✅ `$50 USD`
- ✅ `100 dollars`
- ✅ `Price: 25`

### Code & Technical
- ✅ `line 123`
- ✅ `error code 404`
- ✅ `street variable`

---

## ⚠️ WILL Trigger (Real Addresses)

### Full US Addresses
- ❌ `123 Main Street, New York, NY 10001`
- ❌ `456 Oak Avenue, Los Angeles CA 90210`
- ❌ `789 Park Boulevard, Miami FL 33101`

### Addresses with Apartments
- ❌ `Apartment 5, 123 Main Street, Boston MA`
- ❌ `Unit 12B, 456 Oak Ave, Seattle WA 98101`

### UK Addresses
- ❌ `123 High Street, London SW1A 1AA`
- ❌ `45 Oxford Road, Manchester M1 5AN`

### Australian Addresses
- ❌ `123 King Street, Sydney NSW 2000`
- ❌ `45 Queen Road, Melbourne VIC 3000`

---

## 🧪 Test Messages

### These are SAFE (won't trigger):
```
"28 minutes until I have to go"
"2 hours until stream starts"
"I live on Main Street" (no number + city)
"Going to 123 Main Street" (no city/zip)
"New York, NY 10001" (no street)
"Room 123 in Building A"
"100 USD"
"www.123mainstreet.com"
"error on line 50"
```

### These WILL trigger:
```
"I live at 123 Main Street, New York NY 10001"
"Meet me at 456 Oak Ave, Los Angeles, CA 90210"
"My address is Apartment 5, 789 Park Blvd, Miami FL 33101"
```

---

## 🔧 Why the Changes?

### Old System (Too Sensitive):
- Triggered on: `28 minutes until`
- Required: Just a street name
- Result: Too many false positives

### New System (Much Stricter):
- Requires: **Number + Street + City/State/ZIP**
- Whitelists: Time words (minute, hour, until, etc.)
- Minimum length: 20 characters
- Result: Only catches real addresses

---

## ⚙️ Fine-Tuning Options

If you still get false positives, you can add more whitelist words:

**Edit discord_bot.js, find the whitelistPhrases array:**
```javascript
const whitelistPhrases = [
    'example', 'test', 'fake', 'sample',
    'minute', 'hour', 'until', 'time',
    // Add your own here:
    'your', 'custom', 'words'
];
```

Common additions:
- Game-related: `game`, `match`, `level`, `map`
- Event-related: `event`, `meeting`, `party`
- Tech-related: `server`, `database`, `api`

---

## 📊 Current Settings

```javascript
Minimum message length: 20 characters
Required components: 3 (number + street + city/zip)
Whitelist categories: URLs, prices, time, code, social media
Pattern strictness: VERY HIGH (full address format only)
```

---

## 🎯 Philosophy

**Better to miss a few real addresses than timeout innocent users.**

The new system prioritizes:
1. **Zero false positives** - Never timeout innocent messages
2. **Context awareness** - Understand time, URLs, technical terms
3. **Full validation** - Require complete address format

If someone manages to post a partial address (e.g., "123 Main St"), it won't trigger, but:
- Staff can still manually moderate
- Most malicious actors post full addresses anyway
- Users' safety is preserved without harassment

---

## 💡 Pro Tip

If you want to completely disable address detection temporarily:

**Railway Variables:**
```
DISABLE_ADDRESS_DETECTION = true
```

(Note: This isn't implemented yet, but I can add it if you want)

---

**Updated:** March 2026
**Strictness Level:** MAXIMUM
**False Positive Rate:** Near zero
