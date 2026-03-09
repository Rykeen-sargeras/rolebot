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
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Control Panel</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <script src="/socket.io/socket.io.js"></script>
        <style>
            :root {
                --bg-main: #0f172a;
                --bg-card: #1e293b;
                --bg-hover: #334155;
                --text-main: #f8fafc;
                --text-muted: #94a3b8;
                --accent: #6366f1;
                --success: #10b981;
                --danger: #ef4444;
                --border: #334155;
            }

            body { 
                font-family: 'Inter', sans-serif; 
                background: var(--bg-main); 
                color: var(--text-main); 
                padding: 2rem; 
                margin: 0;
                line-height: 1.5;
                padding-bottom: 100px; 
            }
            
            .header-container { max-width: 1200px; margin: 0 auto 2rem auto; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
            h1 { margin: 0; font-size: 2rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
            .subtitle { color: var(--text-muted); margin-top: 0.5rem; font-size: 0.95rem; }
            #roles-container { max-width: 1200px; margin: 0 auto; }

            .role-card { 
                background: var(--bg-card); margin-bottom: 1.5rem; border-radius: 12px; 
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                overflow: hidden;
            }

            .role-header { padding: 1.25rem 1.5rem; border-left: 6px solid #89b4fa; display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.02); }
            .role-header h2 { margin: 0; font-size: 1.25rem; }

            .badge { font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 20px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); }

            details { border-top: 1px solid var(--border); }
            summary { padding: 1rem 1.5rem; font-weight: 600; cursor: pointer; user-select: none; color: var(--text-main); transition: background 0.2s ease; display: flex; align-items: center; }
            summary:hover { background: rgba(255, 255, 255, 0.03); }
            
            .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; padding: 1.5rem; background: rgba(15, 23, 42, 0.4); }
            .perm-row { display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); font-size: 0.9rem; transition: border-color 0.2s; }
            .perm-row:hover { border-color: #475569; }

            .channel-icon { color: var(--text-muted); font-size: 1.1rem; margin-right: 8px; vertical-align: middle; }

            .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-hover); transition: .3s; border-radius: 24px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            input:checked + .slider { background-color: var(--success); }
            input:checked + .slider:before { transform: translateX(20px); }

            #save-bar {
                position: fixed; bottom: 0; left: 0; right: 0; background: #0f172a;
                border-top: 1px solid var(--border); padding: 1rem 2rem;
                display: flex; justify-content: center; align-items: center; gap: 15px;
                transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 -10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 1000;
            }
            #save-bar.visible { transform: translateY(0); }
            
            .btn-save { background: var(--success); color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: 0.2s; }
            .btn-save:hover { background: #059669; }
            .btn-discard { background: var(--bg-hover); color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: 0.2s; }
            .btn-discard:hover { background: #475569; }
        </style>
    </head>
    <body>
        <div class="header-container">
            <h1>🛡️ Discord Control Panel</h1>
            <div class="subtitle">Queue your changes and click Save to push them to Discord.</div>
        </div>
        
        <div id="roles-container">
            <h2 style="text-align: center; color: var(--text-muted); margin-top: 3rem;">Loading server data...</h2>
        </div>

        <div id="save-bar">
            <span style="color: var(--text-main); font-weight: 500;">You have unsaved changes!</span>
            <button class="btn-discard" onclick="discardChanges()">Discard</button>
            <button class="btn-save" onclick="saveChanges()">Save Changes</button>
        </div>

        <script>
            const socket = io();
            const container = document.getElementById('roles-container');
            const saveBar = document.getElementById('save-bar');
            
            let stagedChanges = {};

            function getChannelIcon(type) {
                if (type === 0) return '💬'; // Text
                if (type === 2) return '🔊'; // Voice
                if (type === 4) return '📁'; // Category
                return '📍'; // Other
            }

            socket.on('load_roles', (roles) => {
                container.innerHTML = ''; 
                stagedChanges = {}; 
                saveBar.classList.remove('visible'); 
                
                roles.forEach(role => {
                    let permsHtml = '';
                    let enabledCount = 0;
                    
                    role.permissions.forEach(perm => { if(perm.has) enabledCount++; });

                    // GENERATE TOGGLES FOR ALL ROLES (NO MORE LOCKS)
                    let toggleRows = '';
                    role.permissions.forEach(perm => {
                        toggleRows += \`
                            <div class="perm-row">
                                <span>\${perm.name}</span>
                                <label class="switch">
                                    <input type="checkbox" \${perm.has ? 'checked' : ''} onchange="queuePerm('\${role.id}', '\${perm.flag}', this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        \`;
                    });
                    permsHtml = \`<div class="grid-container">\${toggleRows}</div>\`;

                    let channelsHtml = '';
                    role.channels.forEach(channel => {
                        channelsHtml += \`
                            <div class="perm-row">
                                <span><span class="channel-icon">\${getChannelIcon(channel.type)}</span> \${channel.name}</span>
                                <label class="switch">
                                    <input type="checkbox" \${channel.canView ? 'checked' : ''} onchange="queueChannel('\${role.id}', '\${channel.id}', this.checked)">
                                    <span class="slider"></span>
                                </label>
                            </div>
                        \`;
                    });

                    const badgeHtml = role.managed ? '<span class="badge">🔗 YouTube / Integration Role</span>' : '';
                    
                    container.innerHTML += \`
                        <div class="role-card">
                            <div class="role-header" style="border-left-color: \${role.color !== '#000000' ? role.color : '#6366f1'}">
                                <h2>\${role.name}</h2>
                                \${badgeHtml}
                            </div>
                            
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

            function queuePerm(roleId, permFlag, state) {
                if (!stagedChanges[roleId]) stagedChanges[roleId] = { perms: {}, channels: {} };
                stagedChanges[roleId].perms[permFlag] = state;
                saveBar.classList.add('visible');
            }

            function queueChannel(roleId, channelId, state) {
                if (!stagedChanges[roleId]) stagedChanges[roleId] = { perms: {}, channels: {} };
                stagedChanges[roleId].channels[channelId] = state;
                saveBar.classList.add('visible');
            }

            function saveChanges() {
                saveBar.innerHTML = '<span style="color: white; font-weight: bold;">Saving to Discord...</span>';
                socket.emit('save_all_changes', stagedChanges);
            }

            function discardChanges() {
                socket.emit('request_reload');
                saveBar.classList.remove('visible');
            }

            socket.on('error_msg', (msg) => {
                alert('⚠️ Warning: ' + msg);
            });

            socket.on('save_complete', () => {
                saveBar.innerHTML = \`
                    <span style="color: var(--text-main); font-weight: 500;">You have unsaved changes!</span>
                    <button class="btn-discard" onclick="discardChanges()">Discard</button>
                    <button class="btn-save" onclick="saveChanges()">Save Changes</button>
                \`;
            });
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
                managed: role.managed,
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

    socket.on('request_reload', async () => {
        await sendRolesToWeb();
    });

    // MASTER SAVE FUNCTION
    socket.on('save_all_changes', async (changes) => {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        let hasError = false;

        for (const [roleId, data] of Object.entries(changes)) {
            try {
                const role = await guild.roles.fetch(roleId);
                if (!role) continue;

                // 1. Process Base Server Permissions (ALL roles allowed now)
                if (Object.keys(data.perms).length > 0) {
                    let newPerms = new PermissionsBitField(role.permissions);
                    
                    for (const [flag, state] of Object.entries(data.perms)) {
                        if (state === true) newPerms.add(PermissionsBitField.Flags[flag]);
                        else newPerms.remove(PermissionsBitField.Flags[flag]);
                    }
                    
                    await role.setPermissions(newPerms);
                    console.log(`✅ Base Perms updated for ${role.name}`);
                }

                // 2. Process Channel Visibility Overrides
                if (Object.keys(data.channels).length > 0) {
                    for (const [channelId, state] of Object.entries(data.channels)) {
                        const channel = guild.channels.cache.get(channelId);
                        if (channel) {
                            await channel.permissionOverwrites.edit(roleId, {
                                ViewChannel: state
                            });
                            console.log(`✅ Channel Vis updated for ${role.name} in #${channel.name}`);
                        }
                    }
                }

            } catch (error) {
                console.error(error);
                hasError = true;
            }
        }

        if (hasError) {
            socket.emit('error_msg', 'Some changes failed. Ensure the bot has "Manage Roles" and "Manage Channels" permissions, and that its highest role is placed ABOVE the roles you are editing in Discord Settings.');
        }

        socket.emit('save_complete');
        await sendRolesToWeb();
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
