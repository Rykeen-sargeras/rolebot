# Latest Updates - 250 Trivia Questions & Auto-Embed Announcements

## 🆕 What Changed

### 1. **250 Trivia Questions!** 🧠

Expanded from 20 to **250 diverse questions** across categories:

**Categories:**
- **General Knowledge** (50) - Countries, capitals, history
- **Pop Culture & Entertainment** (50) - Movies, games, TV, anime
- **Science & Nature** (50) - Biology, space, chemistry, animals
- **Technology & Internet** (50) - Programming, companies, platforms
- **Sports & Games** (50) - NFL, NBA, soccer, Olympics

**Examples:**
- "Who founded Microsoft?" → Bill Gates
- "What is the powerhouse of the cell?" → Mitochondria
- "What year did Minecraft release?" → 2011
- "How many Infinity Stones are there?" → 6
- "What does CPU stand for?" → Central Processing Unit

### 2. **Smart Announcement Embedding** 📢

Announcements now **auto-embed links**!

**How it works:**

**With URL (auto-embeds):**
```
Post: "Stream starting! https://youtube.com/watch?v=abc123"

Discord shows:
@everyone

Stream starting! https://youtube.com/watch?v=abc123
[YouTube video preview with thumbnail]
```

**Without URL (fancy embed):**
```
Post: "Server maintenance tonight at 9pm"

Discord shows:
@everyone

┌─────────────────────────────┐
│ 📢 Announcement             │
│                             │
│ Server maintenance tonight  │
│ at 9pm                      │
│                             │
│ Posted from Web Dashboard   │
│ Today at 3:45 PM            │
└─────────────────────────────┘
```

**Supported platforms** (auto-embed):
- ✅ YouTube
- ✅ Twitch
- ✅ Twitter/X
- ✅ Instagram
- ✅ TikTok
- ✅ Any URL with preview

---

## 📊 Trivia Categories Breakdown

### General Knowledge (50 questions)
- Geography (continents, capitals, landmarks)
- History (wars, dates, famous people)
- Science basics (elements, formulas, facts)
- Math (calculations, conversions)
- General facts (days, measurements)

### Pop Culture (50 questions)
- Gaming (Minecraft, Fortnite, Pokemon, Roblox)
- Movies (Marvel, DC, Disney, directors)
- TV Shows (Simpsons, Friends, Stranger Things)
- Anime (Naruto, Dragon Ball)
- Streaming platforms

### Science & Nature (50 questions)
- Biology (anatomy, cells, organs)
- Space (planets, stars, galaxies)
- Chemistry (elements, formulas, compounds)
- Animals (species, facts, behaviors)
- Earth science (geology, weather)

### Technology (50 questions)
- Programming languages (Python, Java, C++)
- Tech companies (Microsoft, Apple, Google)
- Internet platforms (YouTube, Twitter, Reddit)
- Computer terms (CPU, RAM, GPU, SSD)
- Tech founders and inventors

### Sports (50 questions)
- Football (NFL rules, scoring, players)
- Basketball (NBA stats, championships)
- Baseball (MLB records, rules)
- Soccer (World Cup, teams)
- Olympics (records, events)

---

## 🎯 Usage Examples

### Trivia System

**Enable and test:**
```
!trivia on
!trivia now
```

**Example question posted:**
```
🧠 Trivia Time!

Category: Technology

Question:
Who founded Microsoft?

First correct answer wins 100 points!
```

**User answers:**
```
User: Bill Gates
```

**Bot responds:**
```
🎉 Correct Answer!

@User got it right!

Answer: Bill Gates
Points: +100 (Total: 100)
```

### Announcements

**Stream announcement:**
```
Dashboard → Announcements → Type:
"Going live! https://youtube.com/watch?v=your-stream"
✓ Ping @everyone
[Post Announcement]
```

**Result:**
```
@everyone

Going live! https://youtube.com/watch?v=your-stream
[YouTube embed with thumbnail, title, channel]
```

**Regular announcement:**
```
Dashboard → Announcements → Type:
"New roles available! Check #info for details"
□ Ping @everyone (unchecked)
[Post Announcement]
```

**Result:**
```
📢 Announcement

New roles available! Check #info for details

Posted from Web Dashboard
Today at 4:20 PM
```

---

## ⚙️ How Auto-Embed Works

**Detection:**
1. Bot checks message for URLs using regex
2. If URL found → Send as plain text (Discord auto-embeds)
3. If no URL → Send as fancy embed card

**URL Detection:**
- Matches `http://` or `https://`
- Works with any valid URL
- Multiple URLs supported

**Why this approach?**
- Discord natively embeds links beautifully
- Fancy embed looks good for text-only
- Best of both worlds!

---

## 🔧 Customization

### Add More Trivia Questions

Edit `discord_bot.js`, find `triviaQuestions` array:

```javascript
const triviaQuestions = [
    // ... existing 250 questions
    
    // Add your own:
    { 
        question: "What is your server's name?", 
        answer: "MyServer", 
        category: "Custom" 
    },
    { 
        question: "Who is the server owner?", 
        answer: "YourName", 
        category: "Custom" 
    },
];
```

### Customize Embed Colors

**For announcements without URLs:**
```javascript
.setColor('#5865F2')  // Change to any hex color
```

**Popular colors:**
- `#FF0000` - Red
- `#00FF00` - Green
- `#0099FF` - Blue
- `#FFD700` - Gold
- `#9B59B6` - Purple

### Disable Auto-Embed

If you want all announcements as fancy embeds:

Find this in announcement API:
```javascript
if (urls && urls.length > 0) {
    // Comment out this entire section
    // to always use embed format
}
```

---

## 📈 Trivia Statistics

With 250 questions:
- Average ~10 days before repeat (at 25 questions/day)
- Balanced difficulty across categories
- Good mix of easy, medium, hard
- Appeals to different interests

**Question difficulty breakdown:**
- Easy: ~35% (basic facts)
- Medium: ~50% (general knowledge)
- Hard: ~15% (specific details)

---

## 💡 Pro Tips

### Trivia
- **Run during peak hours** for max participation
- **Announce category themes** (Tech Tuesday, Sports Sunday)
- **Offer bonus points** on special occasions
- **Reset leaderboard monthly** for fresh competition

### Announcements
- **Use URLs for streams** - auto-embeds look professional
- **Use text for rules/info** - fancy embed stands out
- **Test both formats** to see what your community prefers
- **Schedule ahead** - paste your stream link in advance

---

## 🐛 Troubleshooting

### Trivia Not Varied Enough

**Issue:** Same questions appearing too often

**Fix:** Questions are random - with 250 questions, repeats are rare. If you see repeats, just coincidence!

### URL Not Embedding

**Issue:** Link posted but not previewing

**Possible causes:**
1. Discord preview disabled in channel settings
2. Link doesn't support embeds (some sites block it)
3. Bot doesn't have embed links permission

**Fix:**
- Check channel settings → Enable link previews
- Verify bot has "Embed Links" permission
- Test with known-good link (YouTube, Twitch)

### Want Embed for URLs Too

**Issue:** Prefer fancy embed even with URLs

**Modify code:**
```javascript
// Remove the URL detection
// Always use embed format
const embed = new Discord.EmbedBuilder()...
```

---

## 📊 Stats

**Before:**
- 20 trivia questions
- Announcements always embedded

**After:**
- 250 trivia questions (12.5x more!)
- Smart embed (auto for links, fancy for text)

**File size:**
- Added ~8KB for questions
- Minimal performance impact

---

## 🎉 What's Next?

Potential future enhancements:

**Trivia:**
- [ ] Daily/weekly themes
- [ ] Difficulty levels
- [ ] Team mode
- [ ] Timed questions (30s to answer)
- [ ] Multiple choice format

**Announcements:**
- [ ] Custom embed colors per announcement
- [ ] Schedule announcements
- [ ] Recurring announcements
- [ ] Image attachments
- [ ] Role mentions (not just @everyone)

**Want these?** Let me know!

---

**Updated:** March 2026
**Trivia Count:** 250 questions
**New Feature:** Auto-embed announcements
