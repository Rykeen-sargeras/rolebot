# Fun Features Guide - Trivia & Mimic Mode

## 🎮 Overview

Two new fun features added to keep your server engaged:
1. **🧠 Trivia System** - Auto-posts questions, tracks scores
2. **🎭 Mimic Mode** - Secretly copies what a user says

---

## 🧠 Trivia System

### How It Works

- **Auto-posts** trivia questions every 25 minutes
- **First correct answer** wins 100 points
- **Leaderboard** tracks top 10 players
- **20 built-in questions** (easily add more!)

### Control from Discord

**Enable trivia:**
```
!trivia on
```

**Disable trivia:**
```
!trivia off
```

**Post question now:**
```
!trivia now
```

**View leaderboard:**
```
!trivia scores
```

### Control from Web Dashboard

1. Go to **🎮 Fun Features** tab
2. Click buttons:
   - ✅ Enable Trivia
   - ❌ Disable Trivia
   - 📝 Post Question Now
   - 🏆 View Leaderboard

### Question Categories

Built-in categories:
- Discord
- Geography
- Sports
- Science
- Art
- History
- Tech
- Literature
- Music

### Adding More Questions

Edit the `triviaQuestions` array in `discord_bot.js`:

```javascript
const triviaQuestions = [
    { 
        question: "Your question here?", 
        answer: "Correct answer", 
        category: "Category Name" 
    },
    // Add more questions...
];
```

**Tips for good questions:**
- Keep answers simple (one word or number)
- Make them fun but fair
- Mix easy and hard questions
- Use varied categories

### How Scoring Works

- Correct answer: **+100 points**
- Points accumulate over time
- Leaderboard shows top 10
- Scores persist until bot restart

### Example Trivia Flow

```
Bot posts:
┌────────────────────────────────┐
│ 🧠 Trivia Time!                │
│                                │
│ Category: Science              │
│                                │
│ Question:                      │
│ What is the largest planet     │
│ in our solar system?           │
│                                │
│ First correct answer wins      │
│ 100 points!                    │
└────────────────────────────────┘

User types: "Jupiter"

Bot responds:
┌────────────────────────────────┐
│ 🎉 Correct Answer!             │
│                                │
│ @User got it right!            │
│                                │
│ Answer: Jupiter                │
│ Points: +100 (Total: 350)      │
└────────────────────────────────┘
```

---

## 🎭 Mimic Mode (SECRET)

### How It Works

- Bot **secretly copies** everything a user says
- Works **only in main chat**
- Target user **doesn't know** they're being mimicked
- Can be toggled on/off anytime

### Control from Discord

**Start mimicking:**
```
!mimic on <user_id>
```
or
```
!mimic on @username
```

**Stop mimicking:**
```
!mimic off
```

**Note:** The `!mimic on` command auto-deletes after 5 seconds for secrecy!

### Control from Web Dashboard

1. Go to **🎮 Fun Features** tab
2. Scroll to **🎭 Mimic Mode** section
3. Enter target **User ID**
4. Click **🎭 Start Mimicking**
5. Click **🛑 Stop Mimic** to disable

### Getting User IDs

**Method 1: Discord Settings**
1. Enable Developer Mode (User Settings → Advanced → Developer Mode)
2. Right-click user → Copy ID

**Method 2: From Dashboard**
1. Go to **👥 User Management** tab
2. Search for the user
3. Copy their ID from search results

### Example Mimic Flow

```
Staff: !mimic on 123456789

Bot (secretly): 
🎭 SECRET MODE ACTIVATED
Mimicking: TargetUser#1234
(This message deletes in 5 seconds...)

TargetUser: "Hey everyone!"
Bot: "Hey everyone!"

TargetUser: "How's everyone doing?"
Bot: "How's everyone doing?"

TargetUser: "Wait... is the bot copying me?"
Bot: "Wait... is the bot copying me?"

Everyone else: 😂😂😂

Staff: !mimic off
Bot: ✅ Mimic mode disabled.
```

### Use Cases

**Fun trolling:**
- April Fools pranks
- Light-hearted jokes
- Community events

**Moderation:**
- Demonstrating spam behavior
- Teaching lessons about repetition
- Server entertainment

**Important:**
- Use responsibly
- Don't harass users
- Stop if anyone is uncomfortable
- Keep it fun and lighthearted!

---

## 📊 Dashboard Features

### Fun Features Tab

The web dashboard now has a **🎮 Fun Features** tab showing:

**Trivia Section:**
- Enable/Disable buttons
- Post Question Now button
- View Leaderboard button
- Live leaderboard display

**Mimic Section:**
- User ID input field
- Start/Stop buttons
- Current target display
- Status indicator

### Statistics Display

The **⚡ Quick Actions** tab shows:
- **Trivia System:** ✅ ON or ❌ OFF
- **Mimic Mode:** 🎭 ACTIVE or ⚫ OFF

### Real-Time Updates

- Leaderboard updates when viewed
- Mimic status shows current target
- Status reflects live state

---

## 🔧 Configuration

### Trivia Settings

**Change question frequency:**

Edit line with `25 * 60 * 1000`:
```javascript
triviaInterval = setInterval(() => {
    if (triviaEnabled) {
        postTriviaQuestion();
    }
}, 15 * 60 * 1000); // Changed to 15 minutes
```

**Change points per correct answer:**

Edit in message event handler:
```javascript
triviaScores.set(userId, currentScore + 200); // Changed to 200 points
```

### Mimic Settings

**Change which channel mimic works in:**

Currently hardcoded to `MAIN_CHAT_CHANNEL_ID`. To change:

Edit in message event handler:
```javascript
if (mimicEnabled && message.author.id === mimicTargetId && message.channel.id === CONFIG.YOUR_CHANNEL_ID)
```

**Add delay to mimic:**
```javascript
setTimeout(async () => {
    await message.channel.send(message.content);
}, 2000); // 2 second delay
```

---

## 🎯 Best Practices

### Trivia

**Do:**
- ✅ Enable during peak server times
- ✅ Mix easy and hard questions
- ✅ Celebrate winners
- ✅ Keep it friendly competition

**Don't:**
- ❌ Make questions too obscure
- ❌ Run 24/7 (can be spammy)
- ❌ Forget to acknowledge winners

### Mimic

**Do:**
- ✅ Use for lighthearted fun
- ✅ Pick users who can take a joke
- ✅ Stop if anyone objects
- ✅ Keep sessions short (5-10 minutes)

**Don't:**
- ❌ Target the same person repeatedly
- ❌ Use against vulnerable users
- ❌ Leave it running unattended
- ❌ Mimic during serious conversations

---

## 📝 Audit Log Entries

Both features create audit log entries:

**Trivia:**
- `Trivia Enabled` - When turned on
- `Trivia Disabled` - When turned off
- `Trivia Posted` - Each question
- `Trivia Answered` - Correct answers with scores

**Mimic:**
- `Mimic Enabled` - When started (shows target)
- `Mimic Activated` - Each copied message
- `Mimic Disabled` - When stopped

View in **📋 Audit Log** tab or Discord log channel.

---

## 🐛 Troubleshooting

### Trivia Not Posting

**Check:**
1. Is `MAIN_CHAT_CHANNEL_ID` set?
2. Does bot have permission to post?
3. Is trivia actually enabled? (`!trivia on`)
4. Check Railway logs for errors

**Fix:**
```
!trivia off
!trivia on
```

### Trivia Not Detecting Answers

**Issue:** Answer matching is case-insensitive but exact.

**If answer is "Tokyo" these work:**
- ✅ Tokyo
- ✅ tokyo
- ✅ TOKYO
- ✅ The answer is Tokyo

**These don't work:**
- ❌ Tokio (spelling)
- ❌ Tokyo, Japan (extra words might work - it uses `.includes()`)

**To improve:** Edit answer matching in message handler.

### Mimic Not Working

**Check:**
1. Is user ID correct?
2. Is mimic enabled?
3. Is user posting in main chat?
4. Check bot permissions

**Debug:**
```
!mimic off
!mimic on <correct_user_id>
```

### Command Not Responding

**Issue:** User not staff

**Fix:** Add user's role to `STAFF_ROLE_IDS` in Railway variables.

---

## 🎨 Customization Ideas

### Trivia Variations

**Themed trivia nights:**
```javascript
// Monday = Science, Tuesday = History, etc.
const day = new Date().getDay();
const categoryMap = {
    1: 'Science',
    2: 'History',
    3: 'Geography',
    // ...
};
```

**Bonus points on weekends:**
```javascript
const isWeekend = day === 0 || day === 6;
const points = isWeekend ? 200 : 100;
```

**Streak bonuses:**
```javascript
const streaks = new Map(); // Track consecutive wins
// Award bonus for 3+ streak
```

### Mimic Variations

**Delayed mimic:**
```javascript
setTimeout(() => {
    await message.channel.send(message.content);
}, 3000); // 3 second delay
```

**Random mimic:**
```javascript
// Only mimic 50% of messages
if (Math.random() > 0.5) {
    await message.channel.send(message.content);
}
```

**Silly mimic:**
```javascript
// Convert to SpOnGeBoB cAsE
const silly = message.content.split('').map((c, i) => 
    i % 2 ? c.toUpperCase() : c.toLowerCase()
).join('');
await message.channel.send(silly);
```

---

## 📊 Statistics Tracking

### View Trivia Stats

**From Discord:**
```
!trivia scores
```

**From Dashboard:**
1. Go to 🎮 Fun Features
2. Click 🏆 View Leaderboard
3. Shows top 10 with scores

### Export Scores

Currently scores reset on bot restart. To persist:

**Option 1:** Use database (advanced)
**Option 2:** Save to file periodically
**Option 3:** Log to Google Sheets

---

## 🚀 Future Enhancements

Possible additions:

**Trivia:**
- [ ] Multiple choice questions
- [ ] Timed questions (30 seconds to answer)
- [ ] Category selection
- [ ] Daily/weekly winners
- [ ] Question difficulty levels
- [ ] Team trivia mode

**Mimic:**
- [ ] Mimic multiple users
- [ ] Voice channel mimicking
- [ ] Reaction mimicking
- [ ] AI-powered responses (instead of exact copy)
- [ ] Schedule mimic times

**Want these features?** Let me know!

---

## ⚠️ Important Notes

### Permissions Required

Bot needs:
- ✅ Send Messages (for trivia & mimic)
- ✅ Read Message History (to see trivia answers)
- ✅ Manage Messages (optional - to delete mimic commands)

### Rate Limits

- Trivia posts once every 25 minutes (configurable)
- Mimic has no rate limit (copies every message)

### Privacy

- Mimic command auto-deletes (secret)
- All actions logged in audit log
- Staff can see who enabled what

### Performance

- Trivia: Minimal impact
- Mimic: Doubles message count (one user + bot copy)

---

## 💡 Pro Tips

1. **Announce trivia** before enabling: "Trivia starting in 5 minutes!"
2. **Rotate categories** to keep it fresh
3. **Use mimic sparingly** - it's funniest when unexpected
4. **Celebrate leaderboard** winners weekly
5. **Create themed events** around both features
6. **Get feedback** from community on question difficulty

---

**Have fun with these features!** 🎉

Questions? Check the other guides or reach out!
