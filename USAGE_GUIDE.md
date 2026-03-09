# Discord Role Manager Bot - Usage Guide

## Quick Reference Card

### 🎯 Main Commands

| Command | Description | Example |
|---------|-------------|---------|
| `!help` | Show all commands | Just type `!help` |
| `!dashboard` | Generate HTML dashboard | Bot sends you a file to download |
| `!role` | Select a role to manage | Follow the numbered menu |
| `!permission` | Modify role permissions | Use after selecting a role |

---

## Step-by-Step Tutorials

### Tutorial 1: Generating Your First Dashboard

**What you'll do:** Create a visual overview of all your server's role permissions.

1. **Start a DM with the bot**
   - Find the bot in your server's member list
   - Click on it and select "Message"

2. **Request the dashboard**
   ```
   !dashboard
   ```

3. **Download the file**
   - Bot will send you a `.html` file
   - Click to download it
   - Open the file in any web browser (Chrome, Firefox, Safari, etc.)

4. **Explore the dashboard**
   - Scroll through all your roles
   - Use the search box to filter roles
   - Click "Expand All" or "Collapse All" to show/hide channel permissions

**What you'll see:**
- Every role in your server
- All general permissions (Administrator, Manage Server, etc.)
- Channel-specific access (which roles can see/type in which channels)
- Member counts for each role
- Role hierarchy positions

---

### Tutorial 2: Modifying a Role's Permissions

**What you'll do:** Enable "Manage Messages" for the Moderator role.

1. **Start role selection**
   ```
   !role
   ```

2. **Bot responds with a list:**
   ```
   📋 Available Roles:

   1. Admin (5 members)
   2. Moderator (12 members)
   3. Member (150 members)
   4. Guest (20 members)

   Type the number of the role you want to manage:
   ```

3. **Select the Moderator role**
   ```
   2
   ```

4. **Bot confirms:**
   ```
   ✅ Selected role: Moderator
   
   Now use !permission to modify permissions.
   ```

5. **View permissions**
   ```
   !permission
   ```

6. **Bot shows all permissions:**
   ```
   🔐 Permissions for Moderator:

   1. ❌ Administrator
   2. ❌ Manage Server
   3. ❌ Manage Roles
   4. ❌ Manage Channels
   5. ✅ Kick Members
   6. ✅ Ban Members
   7. ✅ Send Messages
   8. ❌ Manage Messages
   9. ✅ Read Message History
   10. ❌ Mention Everyone
   11. ✅ Connect (Voice)
   12. ✅ Speak (Voice)

   Type the number of the permission to modify:
   ```

7. **Select "Manage Messages"**
   ```
   8
   ```

8. **Bot asks for action:**
   ```
   Permission: Manage Messages
   Current Status: disabled

   Type enable or disable to change it:
   ```

9. **Enable the permission**
   ```
   enable
   ```

10. **Bot confirms the change:**
    ```
    ✅ Successfully enabled Manage Messages for role Moderator!
    
    Use !role to select another role, or !permission to modify another permission.
    ```

---

### Tutorial 3: Bulk Permission Review

**What you'll do:** Review permissions for all roles at once.

1. **Generate dashboard**
   ```
   !dashboard
   ```

2. **Open the HTML file in your browser**

3. **Use the search feature**
   - Type "admin" in the search box to see admin-related roles
   - Type "member" to see member roles
   - Clear search to see all

4. **Review each role:**
   - Look for ✅ (enabled) and ❌ (disabled) indicators
   - Check channel access tables
   - Identify any permission inconsistencies

5. **Make changes as needed**
   - Switch back to Discord DMs
   - Use `!role` and `!permission` to modify

6. **Re-generate dashboard to verify**
   ```
   !dashboard
   ```

---

## Real-World Examples

### Example 1: Setting Up a New Moderator Role

**Goal:** Create permissions for a moderator who can manage messages and kick users, but not ban or manage the server.

```
!role
→ Select your "Moderator" role number

!permission
→ Type 5 (Kick Members)
→ Type: enable

!permission
→ Type 8 (Manage Messages)
→ Type: enable

!dashboard
→ Download and verify the changes
```

### Example 2: Locking Down a Role

**Goal:** Remove all dangerous permissions from a role that was accidentally given too much access.

```
!role
→ Select the problematic role

!permission
→ Type 1 (Administrator)
→ Type: disable

!permission
→ Type 2 (Manage Server)
→ Type: disable

!permission
→ Type 3 (Manage Roles)
→ Type: disable

!dashboard
→ Verify all dangerous permissions are removed
```

### Example 3: Audit Check

**Goal:** Make sure no regular member roles have administrative permissions.

```
!dashboard
→ Open the HTML file
→ Search for "member" in the filter
→ Look for any ✅ next to Administrator, Manage Server, or Manage Roles
→ If found, use !role and !permission to remove them
```

---

## Dashboard Features Explained

### Role Card Components

```
┌─────────────────────────────────────────┐
│ [●] Role Name              👥12  #3     │  ← Badge, Name, Members, Position
├─────────────────────────────────────────┤
│ GENERAL PERMISSIONS                     │
│ ✅ Send Messages      ❌ Administrator  │  ← Permission grid
│ ✅ Read History       ❌ Manage Server  │
├─────────────────────────────────────────┤
│ CHANNEL ACCESS                          │
│ Channel         View  Send  Speak       │
│ #general        ✅    ✅    -          │  ← Channel permissions
│ #announcements  ✅    ❌    -          │
│ voice-chat      ✅    ✅    ✅         │
└─────────────────────────────────────────┘
```

### Permission Types

**General Permissions:**
- Server-wide abilities that apply everywhere
- Examples: Administrator, Manage Server, Kick Members

**Channel Permissions:**
- Specific to individual channels
- Can override general permissions
- Examples: View Channel, Send Messages, Connect

### Understanding the Indicators

- ✅ = Permission is **enabled**
- ❌ = Permission is **disabled**
- `-` = Not applicable for this channel type

---

## Pro Tips 💡

### 1. Use Dashboard for Quick Audits
Generate the dashboard weekly to spot permission drift or mistakes.

### 2. Document Changes
Keep the HTML files as snapshots of your permission configuration over time.

### 3. Role Hierarchy Matters
The bot can only modify roles below its own position. Keep the bot's role high in your server's hierarchy.

### 4. Test in a Test Server
Before making major changes, test the bot in a private server first.

### 5. Multiple Servers
If the bot is in multiple servers, it defaults to the first one. For multi-server support, you'll need to modify the code.

### 6. Backup Before Big Changes
Generate a dashboard before making sweeping permission changes so you can reference the original state.

---

## Troubleshooting Common Issues

### "Bot doesn't respond to my DMs"
- Make sure you're DMing the bot directly, not posting in a server channel
- Check that Message Content Intent is enabled in Discord Developer Portal
- Verify the bot is online (check your server's member list)

### "Permission denied" when trying to change permissions
- The bot's role must be higher than the role you're trying to modify
- Go to Server Settings → Roles and drag the bot's role higher

### "Can't enable Administrator permission"
- The bot itself must have Administrator permission to grant it to others
- Or manually grant it through Discord's UI, not the bot

### Dashboard shows old data
- The dashboard is generated at the moment you request it
- Generate a new dashboard to see current permissions

### Bot crashed or stopped working
- Check the console/terminal for error messages
- Common causes: Invalid token, lost internet connection, Discord API outage
- Restart with `npm start`

---

## Command Flow Diagram

```
Start DM with Bot
       ↓
   Type !help
       ↓
┌──────────────┐
│  !dashboard  │ → Download HTML → Open in Browser → Review Permissions
└──────────────┘

┌──────────────┐
│    !role     │ → Select Role Number → Bot Confirms Selection
└──────────────┘
       ↓
┌──────────────┐
│ !permission  │ → Select Permission Number → Type enable/disable → Confirmed
└──────────────┘
       ↓
 (Repeat !permission for more changes)
       ↓
   !dashboard (to verify changes)
```

---

## FAQ

**Q: Can multiple people use the bot at the same time?**
A: Yes! Each user's DM session is independent.

**Q: Does the bot log what changes I make?**
A: Changes are logged to the bot's console (where it's running), but not sent to a Discord channel.

**Q: Can I undo a permission change?**
A: Yes, just use `!permission` again and toggle it back.

**Q: What happens if I select the wrong role?**
A: Just type `!role` again to start over with a new selection.

**Q: Can the bot manage permissions for its own role?**
A: No, for security reasons, a bot cannot modify its own role.

**Q: How often can I generate dashboards?**
A: As often as you want! There's no rate limit.

---

**Need more help? Check the README.md for detailed setup instructions!**
