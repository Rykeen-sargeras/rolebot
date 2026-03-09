const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// --- 1. SETUP DISCORD BOT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds] 
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- THE MASTER PERMISSION LIST ---
const ALL_PERMISSIONS = [
    { name: 'Administrator', flag: 'Administrator' },
    { name: 'View Server Insights', flag: 'ViewGuildInsights' },
    { name: 'View Audit Log', flag: 'ViewAuditLog' },
    { name: 'Manage Server', flag: 'ManageGuild' },
    { name: 'Manage Roles', flag: 'ManageRoles' },
    { name: 'Manage Channels', flag: 'ManageChannels' },
    { name: 'Kick Members', flag: 'KickMembers' },
    { name: 'Ban Members', flag: 'BanMembers' },
    { name: 'Create Invites', flag: 'CreateInstantInvite' },
    { name: 'Change Nickname', flag: 'ChangeNickname' },
    { name: 'Manage Nicknames', flag: 'ManageNicknames' },
    { name: 'Manage Emojis/Stickers', flag: 'ManageGuildExpressions' },
    { name: 'Manage Webhooks', flag: 'ManageWebhooks' },
    { name: 'View Channels', flag: 'ViewChannel' },
    { name: 'Send Messages', flag: 'SendMessages' },
    { name: 'Send Messages in Threads', flag: 'SendMessagesInThreads' },
    { name: 'Create Public Threads', flag: 'CreatePublicThreads' },
    { name: 'Create Private Threads', flag: 'CreatePrivateThreads' },
    { name: 'Embed Links', flag: 'EmbedLinks' },
    { name: 'Attach Files', flag: 'AttachFiles' },
    { name: 'Add Reactions', flag: 'AddReactions' },
    { name: 'Use External Emojis', flag: 'UseExternalEmojis' },
    { name: 'Use External Stickers', flag: 'UseExternalStickers' },
    { name: 'Mention @everyone, @here, All Roles', flag: 'MentionEveryone' },
    { name: 'Manage Messages', flag: 'ManageMessages' },
    { name: 'Manage Threads', flag: 'ManageThreads' },
    { name: 'Read Message History', flag: 'ReadMessageHistory' },
    { name: 'Send TTS Messages', flag: 'SendTTSMessages' },
    { name: 'Use App Commands', flag: 'UseApplicationCommands' },
    { name: 'Connect (Voice)', flag: 'Connect' },
    { name: 'Speak (Voice)', flag: 'Speak' },
    { name: 'Video/Stream', flag: 'Stream' },
    { name: 'Use Voice Activity', flag: 'UseVAD' },
    { name: 'Priority Speaker', flag: 'PrioritySpeaker' },
    { name: 'Mute Members', flag: 'MuteMembers' },
    { name: 'Deafen Members', flag: 'DeafenMembers' },
    { name: 'Move Members', flag: 'MoveMembers' }
];

// --- 3. SERVE THE DASHBOARD ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Live Role & Channel Manager</title>
        <script src="/socket.io/socket.io.js"></script>
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #1e1e2e; color: #cdd6f4; padding: 2rem; }
            h1 { color: #89b4fa; border-bottom: 2px solid #313244; padding-bottom: 10px; }
            .role-card { background: #313244; padding: 1.5rem; margin-bottom: 1rem; border-radius: 8px; border-left: 6px solid #89b4fa; }
            
            /* Collapsible Sections */
            details { background: #181825; border-radius: 6px; margin-top: 10px; }
            summary { padding: 12px; font-weight: bold; cursor: pointer; user-select: none; color: #b4befe; }
            summary:hover { background: #2a2b3c; border-radius: 6px; }
            
            /* Grids for toggles to save space */
            .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; padding: 15px; border-top: 1px solid #313244; }
            .perm-toggle { display: flex; justify-content: space-between; align-items: center; background: #1e1e2e; padding: 8px 12px; border-radius: 6px; border: 1px solid #313244; font-size: 14px;}
            
            button.toggle-btn { border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 12px; font-weight: bold; }
            button.toggle-btn.on { background: #a6e3a1; color: #11111b; }
            button.toggle-btn.off { background: #f38ba8; color: #11111b; }
            
            .channel-icon { color: #89b4fa; font-family: monospace; font-size: 16px; margin-right: 5px;}
            .managed-badge { font-size: 12px; background: #f38ba8; color: #11111b; padding: 3px 8px; border-radius: 12px; margin-left: 10px; vertical-align: middle; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>🛡️ Ultimate Role Manager</h1>
        <p>Manage all server permissions and channel visibility instantly.</p>
        <div id="roles-container"><h2>Loading server data... (This might take a second)</h2></div>

        <script>
            const socket = io();
            const container = document.getElementById('roles-container');

            function getChannelIcon(type) {
                if (type === 0) return '#️⃣'; // Text
                if (type === 2) return '🔊'; // Voice
                if (type === 4) return '📁'; // Category
                return '💬'; // Other
            }

            socket.on('load_roles', (roles) => {
                container.innerHTML = ''; 
                
                roles.forEach(role => {
                    // 1. Build Server Permissions Grid
                    let permsHtml = '';
                    let enabledCount = 0;
                    
                    role.permissions.forEach(perm => { if(perm.has) enabledCount++; });

                    if (role.managed) {
                        permsHtml = \`<div style="padding: 15px; color: #f38ba8; font-style: italic;">
                            Discord prevents bots from changing core Server Permissions for integration roles (like YouTube subs, Server Boosters, or Bots). <br><br>
                            👉 <b>You CAN still change which channels they see in the section below!</b>
                        </div>\`;
                    } else {
                        role.permissions.forEach(perm => {
                            const btnClass = perm.has ? 'on' : 'off';
                            const btnText = perm.has ? 'ENABLED' : 'DISABLED';
                            permsHtml += \`
                                <div class="perm-toggle">
                                    <span>\${perm.name}</span>
                                    <button class="toggle-btn \${btnClass}" onclick="togglePerm('\${role.id}', '\${perm.flag}', \${!perm.has})">\${btnText}</button>
                                </div>
                            \`;
                        });
                        permsHtml = \`<div class="grid-container">\${permsHtml}</div>\`;
                    }

                    // 2. Build Channel Visibility Grid
                    let channelsHtml = '';
                    role.channels.forEach(channel => {
                        const btnClass = channel.canView ? 'on' : 'off';
                        const btnText = channel.canView ? 'CAN SEE' : 'HIDDEN';
                        channelsHtml += \`
                            <div class="perm-toggle">
                                <span><span class="channel-icon">\${getChannelIcon(channel.type)}</span> \${channel.name}</span>
                                <button class="toggle-btn \${btnClass}" onclick="toggleChannel('\${role.id}', '\${channel.id}', \${!channel.canView})">\${btnText}</button>
                            </div>
                        \`;
                    });

                    // 3. Put it all together in the Role Card
                    const badgeHtml = role.managed ? '<span class="managed-badge">🔗 YouTube / Integration Role</span>' : '';
                    
                    container.innerHTML += \`
                        <div class="role-card" style="border-left-color: \${role.color}">
                            <h2>\${role.name} \${badgeHtml}</h2>
                            
                            <details>
                                <summary>⚙️ Server Permissions (\${enabledCount} Active)</summary>
                                \${permsHtml}
                            </details>
                            
                            <details>
                                <summary>👁️ Channel Visibility</summary>
                                <div class="grid-container">\${channelsHtml}</div>
                            </details>
                        </div>
                    \`;
                });
            });

            // Tell bot to toggle a general permission
            function togglePerm(roleId, permFlag, newState) {
                socket.emit('toggle_permission', { roleId, permFlag, newState });
            }

            // Tell bot to toggle channel visibility
            function toggleChannel(roleId, channelId, newState) {
                socket.emit('toggle_channel_view', { roleId, channelId, newState });
            }

            socket.on('error_msg', (msg) => alert('Error: ' + msg));
        </script>
    </body>
    </html>
    `);
});

// --- 4. HANDLE REAL-TIME COMMUNICATION ---
io.on('connection', async (socket) => {
    console.log('💻 A user connected to the dashboard.');

    const sendRolesToWeb = async () => {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const roles = await guild.roles.fetch();
        const channels = await guild.channels.fetch();

        // FIXED: Now we ONLY filter out the @everyone role (id === guild.id). 
        // We removed the !r.managed filter so YouTube roles show up!
        const sortedRoles = Array.from(roles.values())
            .filter(r => r.id !== guild.id) 
            .sort((a, b) => b.position - a.position);

        const roleData = sortedRoles.map(role => {
            const channelVisibility = Array.from(channels.values())
                .filter(c => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildCategory))
                .sort((a, b) => a.position - b.position)
                .map(channel => {
                    const permissions = channel.permissionsFor(role);
                    return {
                        id: channel.id,
                        name: channel.name,
                        type: channel.type,
                        canView: permissions ? permissions.has(PermissionsBitField.Flags.ViewChannel) : false
                    };
                });

            return {
                id: role.id,
                name: role.name,
                color: role.hexColor,
                managed: role.managed, // Pass this to the frontend so we know it's a YouTube role
                permissions: ALL_PERMISSIONS.map(p => ({
                    name: p.name,
                    flag: p.flag,
                    has: role.permissions.has(PermissionsBitField.Flags[p.flag])
                })),
                channels: channelVisibility
            };
        });

        socket.emit('load_roles', roleData);
    };

    if (client.isReady()) {
        await sendRolesToWeb();
    }

    socket.on('toggle_permission', async (data) => {
        try {
            const guild = client.guilds.cache.first();
            const role = await guild.roles.fetch(data.roleId);
            if (!role) return socket.emit('error_msg', 'Role not found.');
            if (role.managed) return socket.emit('error_msg', 'Cannot change Server Perms for Integration roles.');

            let newPerms = new PermissionsBitField(role.permissions);
            if (data.newState === true) {
                newPerms.add(PermissionsBitField.Flags[data.permFlag]);
            } else {
                newPerms.remove(PermissionsBitField.Flags[data.permFlag]);
            }

            await role.setPermissions(newPerms);
            console.log(`✅ Server Perm Updated -> Role: ${role.name} | ${data.permFlag}: ${data.newState}`);
            await sendRolesToWeb();
        } catch (error) {
            console.error(error);
            socket.emit('error_msg', 'Bot lacks permission. Is the Bot role higher than this role?');
        }
    });

    socket.on('toggle_channel_view', async (data) => {
        try {
            const guild = client.guilds.cache.first();
            const channel = guild.channels.cache.get(data.channelId);
            const role = await guild.roles.fetch(data.roleId);
            
            if (!channel || !role) return socket.emit('error_msg', 'Channel or Role not found.');

            await channel.permissionOverwrites.edit(data.roleId, {
                ViewChannel: data.newState
            });

            console.log(`✅ Channel Perm Updated -> Role: ${role.name} | Channel: ${channel.name} | View: ${data.newState}`);
            await sendRolesToWeb();
        } catch (error) {
            console.error(error);
            socket.emit('error_msg', 'Bot lacks permission to edit this channel. Check role hierarchy.');
        }
    });
});

// --- 5. START UP ---
client.on('ready', () => {
    console.log(`🤖 Discord Bot connected as ${client.user.tag}`);
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Web Dashboard live on port ${PORT}`);
    });
});

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERROR: Missing DISCORD_TOKEN");
    process.exit(1);
}
client.login(TOKEN);
