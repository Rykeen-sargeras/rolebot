const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent,
    ],
    partials: [Discord.Partials.Channel]
});

// Store user states for interactive commands
const userStates = new Map();

client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Dashboard available at: http://localhost:3000`);
    startDashboardServer();
});

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond to DMs
    if (message.channel.type !== Discord.ChannelType.DM) return;

    const content = message.content.trim();

    // Help command
    if (content === '!help') {
        await sendHelpMessage(message);
        return;
    }

    // Generate dashboard
    if (content === '!dashboard') {
        await generateDashboard(message);
        return;
    }

    // Start role selection
    if (content === '!role') {
        await startRoleSelection(message);
        return;
    }

    // Handle role number selection
    const userState = userStates.get(message.author.id);
    if (userState && userState.step === 'role_selection') {
        await handleRoleSelection(message, content);
        return;
    }

    // Start permission selection
    if (content === '!permission') {
        if (!userState || !userState.selectedRole) {
            message.reply('❌ Please select a role first using `!role`');
            return;
        }
        await startPermissionSelection(message);
        return;
    }

    // Handle permission selection
    if (userState && userState.step === 'permission_selection') {
        await handlePermissionSelection(message, content);
        return;
    }

    // Handle enable/disable
    if (userState && userState.step === 'permission_action') {
        await handlePermissionAction(message, content);
        return;
    }
});

async function sendHelpMessage(message) {
    const embed = new Discord.EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Discord Role Manager Bot')
        .setDescription('Manage your Discord server roles and permissions via DM!')
        .addFields(
            { name: '!dashboard', value: 'Generate HTML dashboard with all role permissions' },
            { name: '!role', value: 'Select a role to manage' },
            { name: '!permission', value: 'Choose a permission to modify (after selecting a role)' },
            { name: '!help', value: 'Show this help message' }
        )
        .setFooter({ text: 'Use these commands in this DM' });

    await message.reply({ embeds: [embed] });
}

async function generateDashboard(message) {
    try {
        const guild = await getGuild(message);
        if (!guild) return;

        const data = await collectServerData(guild);
        const html = generateHTML(data);

        const filename = `dashboard_${guild.id}_${Date.now()}.html`;
        // Use __dirname for Railway compatibility, fallback to outputs directory locally
        const outputDir = fs.existsSync('/mnt/user-data/outputs') ? '/mnt/user-data/outputs' : __dirname;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, html);

        await message.reply({
            content: '✅ Dashboard generated! Download the file below and open it in your browser.',
            files: [filepath]
        });
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error generating dashboard: ' + error.message);
    }
}

async function startRoleSelection(message) {
    try {
        const guild = await getGuild(message);
        if (!guild) return;

        const roles = guild.roles.cache
            .filter(role => role.id !== guild.id) // Exclude @everyone
            .sort((a, b) => b.position - a.position)
            .map((role, index) => ({ index: index + 1, role }));

        let roleList = '**📋 Available Roles:**\n\n';
        roles.forEach(({ index, role }) => {
            roleList += `${index}. ${role.name} (${role.members.size} members)\n`;
        });
        roleList += '\n**Type the number of the role you want to manage:**';

        await message.reply(roleList);

        userStates.set(message.author.id, {
            step: 'role_selection',
            guild: guild.id,
            roles: roles
        });
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error fetching roles: ' + error.message);
    }
}

async function handleRoleSelection(message, content) {
    const userState = userStates.get(message.author.id);
    const roleIndex = parseInt(content);

    if (isNaN(roleIndex) || roleIndex < 1 || roleIndex > userState.roles.length) {
        await message.reply('❌ Invalid number. Please try again with `!role`');
        return;
    }

    const selectedRole = userState.roles[roleIndex - 1].role;
    userState.selectedRole = selectedRole;
    userState.step = 'role_selected';

    await message.reply(`✅ Selected role: **${selectedRole.name}**\n\nNow use \`!permission\` to modify permissions.`);
}

async function startPermissionSelection(message) {
    const userState = userStates.get(message.author.id);
    const role = userState.selectedRole;

    const permissions = [
        { name: 'Administrator', flag: Discord.PermissionFlagsBits.Administrator },
        { name: 'Manage Server', flag: Discord.PermissionFlagsBits.ManageGuild },
        { name: 'Manage Roles', flag: Discord.PermissionFlagsBits.ManageRoles },
        { name: 'Manage Channels', flag: Discord.PermissionFlagsBits.ManageChannels },
        { name: 'Kick Members', flag: Discord.PermissionFlagsBits.KickMembers },
        { name: 'Ban Members', flag: Discord.PermissionFlagsBits.BanMembers },
        { name: 'Send Messages', flag: Discord.PermissionFlagsBits.SendMessages },
        { name: 'Manage Messages', flag: Discord.PermissionFlagsBits.ManageMessages },
        { name: 'Read Message History', flag: Discord.PermissionFlagsBits.ReadMessageHistory },
        { name: 'Mention Everyone', flag: Discord.PermissionFlagsBits.MentionEveryone },
        { name: 'Connect (Voice)', flag: Discord.PermissionFlagsBits.Connect },
        { name: 'Speak (Voice)', flag: Discord.PermissionFlagsBits.Speak },
    ];

    let permList = `**🔐 Permissions for ${role.name}:**\n\n`;
    permissions.forEach((perm, index) => {
        const hasPermission = role.permissions.has(perm.flag);
        const status = hasPermission ? '✅' : '❌';
        permList += `${index + 1}. ${status} ${perm.name}\n`;
    });
    permList += '\n**Type the number of the permission to modify:**';

    await message.reply(permList);

    userState.step = 'permission_selection';
    userState.permissions = permissions;
}

async function handlePermissionSelection(message, content) {
    const userState = userStates.get(message.author.id);
    const permIndex = parseInt(content);

    if (isNaN(permIndex) || permIndex < 1 || permIndex > userState.permissions.length) {
        await message.reply('❌ Invalid number. Please try again.');
        return;
    }

    const selectedPerm = userState.permissions[permIndex - 1];
    userState.selectedPermission = selectedPerm;
    userState.step = 'permission_action';

    const hasPermission = userState.selectedRole.permissions.has(selectedPerm.flag);
    const status = hasPermission ? 'enabled' : 'disabled';

    await message.reply(
        `**Permission:** ${selectedPerm.name}\n` +
        `**Current Status:** ${status}\n\n` +
        `Type \`enable\` or \`disable\` to change it:`
    );
}

async function handlePermissionAction(message, content) {
    const userState = userStates.get(message.author.id);
    const action = content.toLowerCase();

    if (action !== 'enable' && action !== 'disable') {
        await message.reply('❌ Please type either `enable` or `disable`');
        return;
    }

    try {
        const guild = client.guilds.cache.get(userState.guild);
        const role = guild.roles.cache.get(userState.selectedRole.id);
        const permission = userState.selectedPermission.flag;

        let newPermissions = role.permissions;
        if (action === 'enable') {
            newPermissions = newPermissions.add(permission);
        } else {
            newPermissions = newPermissions.remove(permission);
        }

        await role.setPermissions(newPermissions);

        await message.reply(
            `✅ Successfully ${action}d **${userState.selectedPermission.name}** for role **${role.name}**!\n\n` +
            `Use \`!role\` to select another role, or \`!permission\` to modify another permission.`
        );

        // Reset to role selected state
        userState.step = 'role_selected';
        delete userState.selectedPermission;

    } catch (error) {
        console.error(error);
        await message.reply('❌ Error updating permission: ' + error.message);
    }
}

async function getGuild(message) {
    const guilds = client.guilds.cache;
    
    if (guilds.size === 0) {
        await message.reply('❌ Bot is not in any servers!');
        return null;
    }

    if (guilds.size === 1) {
        return guilds.first();
    }

    // If bot is in multiple servers, let user choose (simplified version)
    return guilds.first();
}

async function collectServerData(guild) {
    const roles = guild.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position);

    const channels = guild.channels.cache;

    const roleData = [];

    for (const [roleId, role] of roles) {
        const channelPermissions = [];

        for (const [channelId, channel] of channels) {
            if (channel.type === Discord.ChannelType.GuildCategory) continue;

            const permissions = channel.permissionsFor(role);
            if (!permissions) continue;

            const perms = {
                channelName: channel.name,
                channelType: channel.type,
                canView: permissions.has(Discord.PermissionFlagsBits.ViewChannel),
                canSend: channel.isTextBased() ? permissions.has(Discord.PermissionFlagsBits.SendMessages) : null,
                canConnect: channel.isVoiceBased() ? permissions.has(Discord.PermissionFlagsBits.Connect) : null,
                canSpeak: channel.isVoiceBased() ? permissions.has(Discord.PermissionFlagsBits.Speak) : null,
            };

            channelPermissions.push(perms);
        }

        roleData.push({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            members: role.members.size,
            permissions: {
                administrator: role.permissions.has(Discord.PermissionFlagsBits.Administrator),
                manageGuild: role.permissions.has(Discord.PermissionFlagsBits.ManageGuild),
                manageRoles: role.permissions.has(Discord.PermissionFlagsBits.ManageRoles),
                manageChannels: role.permissions.has(Discord.PermissionFlagsBits.ManageChannels),
                kickMembers: role.permissions.has(Discord.PermissionFlagsBits.KickMembers),
                banMembers: role.permissions.has(Discord.PermissionFlagsBits.BanMembers),
                sendMessages: role.permissions.has(Discord.PermissionFlagsBits.SendMessages),
                manageMessages: role.permissions.has(Discord.PermissionFlagsBits.ManageMessages),
                readMessageHistory: role.permissions.has(Discord.PermissionFlagsBits.ReadMessageHistory),
                mentionEveryone: role.permissions.has(Discord.PermissionFlagsBits.MentionEveryone),
                connect: role.permissions.has(Discord.PermissionFlagsBits.Connect),
                speak: role.permissions.has(Discord.PermissionFlagsBits.Speak),
            },
            channelPermissions
        });
    }

    return {
        serverName: guild.name,
        serverIcon: guild.iconURL(),
        roles: roleData
    };
}

function generateHTML(data) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.serverName} - Role Permissions</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Lexend:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0e1a;
            --bg-secondary: #131824;
            --bg-tertiary: #1a1f2e;
            --accent-primary: #00d4ff;
            --accent-secondary: #7b2ff7;
            --text-primary: #e4e8f0;
            --text-secondary: #8b92a8;
            --success: #00ff88;
            --danger: #ff3366;
            --warning: #ffaa00;
        }

        body {
            font-family: 'Lexend', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            background-image: 
                radial-gradient(circle at 20% 50%, rgba(123, 47, 247, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(0, 212, 255, 0.15) 0%, transparent 50%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 3rem 2rem;
        }

        header {
            text-align: center;
            margin-bottom: 4rem;
            position: relative;
        }

        .server-icon {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            margin: 0 auto 1.5rem;
            border: 4px solid var(--accent-primary);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: slideDown 0.8s ease-out;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.1rem;
            font-weight: 300;
        }

        .controls {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border: 2px solid var(--accent-primary);
            background: transparent;
            color: var(--accent-primary);
            border-radius: 8px;
            cursor: pointer;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn:hover {
            background: var(--accent-primary);
            color: var(--bg-primary);
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 212, 255, 0.4);
        }

        .role-card {
            background: var(--bg-secondary);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .role-card:hover {
            border-color: var(--accent-primary);
            box-shadow: 0 8px 32px rgba(0, 212, 255, 0.15);
            transform: translateY(-4px);
        }

        .role-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--bg-tertiary);
        }

        .role-name {
            font-size: 1.8rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .role-badge {
            display: inline-block;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            box-shadow: 0 0 10px currentColor;
        }

        .role-stats {
            display: flex;
            gap: 2rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
        }

        .stat {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent-primary);
        }

        .stat-label {
            color: var(--text-secondary);
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
        }

        .permissions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .permission-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            transition: all 0.2s ease;
        }

        .permission-item:hover {
            background: rgba(0, 212, 255, 0.1);
            transform: translateX(4px);
        }

        .permission-icon {
            font-size: 1.2rem;
        }

        .channel-section {
            margin-top: 2rem;
        }

        .section-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 2px;
            font-family: 'JetBrains Mono', monospace;
        }

        .channel-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-tertiary);
            border-radius: 12px;
            overflow: hidden;
        }

        .channel-table th {
            background: rgba(0, 212, 255, 0.1);
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
            color: var(--accent-primary);
        }

        .channel-table td {
            padding: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
        }

        .channel-table tr:hover {
            background: rgba(0, 212, 255, 0.05);
        }

        .channel-name {
            font-weight: 600;
        }

        .channel-type {
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        .filter-container {
            margin: 2rem 0;
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            align-items: center;
        }

        .filter-input {
            flex: 1;
            min-width: 250px;
            padding: 0.75rem 1rem;
            background: var(--bg-secondary);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }

        .filter-input:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
        }

        footer {
            text-align: center;
            margin-top: 4rem;
            padding: 2rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
            font-family: 'JetBrains Mono', monospace;
        }

        .scroll-top {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 50px;
            height: 50px;
            background: var(--accent-primary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);
        }

        .scroll-top.visible {
            opacity: 1;
        }

        .scroll-top:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0, 212, 255, 0.6);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            ${data.serverIcon ? `<img src="${data.serverIcon}" alt="Server Icon" class="server-icon">` : ''}
            <h1>${data.serverName}</h1>
            <p class="subtitle">Role Permissions Dashboard</p>
        </header>

        <div class="filter-container">
            <input type="text" id="roleFilter" class="filter-input" placeholder="🔍 Search roles...">
            <button class="btn" onclick="expandAll()">Expand All</button>
            <button class="btn" onclick="collapseAll()">Collapse All</button>
        </div>

        <div id="rolesContainer">
            ${data.roles.map((role, index) => `
                <div class="role-card" style="animation-delay: ${index * 0.1}s">
                    <div class="role-header">
                        <div class="role-name">
                            <span class="role-badge" style="background-color: ${role.color}"></span>
                            ${role.name}
                        </div>
                        <div class="role-stats">
                            <div class="stat">
                                <div class="stat-value">${role.members}</div>
                                <div class="stat-label">Members</div>
                            </div>
                            <div class="stat">
                                <div class="stat-value">#${role.position}</div>
                                <div class="stat-label">Position</div>
                            </div>
                        </div>
                    </div>

                    <div class="section-title">General Permissions</div>
                    <div class="permissions-grid">
                        ${Object.entries(role.permissions).map(([key, value]) => `
                            <div class="permission-item">
                                <span class="permission-icon">${value ? '✅' : '❌'}</span>
                                <span>${formatPermissionName(key)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="channel-section">
                        <div class="section-title">Channel Access</div>
                        <table class="channel-table">
                            <thead>
                                <tr>
                                    <th>Channel</th>
                                    <th>View</th>
                                    <th>Send/Connect</th>
                                    <th>Speak</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${role.channelPermissions.map(cp => `
                                    <tr>
                                        <td>
                                            <div class="channel-name">${cp.channelName}</div>
                                            <div class="channel-type">${getChannelTypeLabel(cp.channelType)}</div>
                                        </td>
                                        <td>${cp.canView ? '✅' : '❌'}</td>
                                        <td>${cp.canSend !== null ? (cp.canSend ? '✅' : '❌') : (cp.canConnect !== null ? (cp.canConnect ? '✅' : '❌') : '-')}</td>
                                        <td>${cp.canSpeak !== null ? (cp.canSpeak ? '✅' : '❌') : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('')}
        </div>

        <footer>
            Generated on ${new Date().toLocaleString()} • Discord Role Manager Bot
        </footer>
    </div>

    <div class="scroll-top" onclick="scrollToTop()">↑</div>

    <script>
        function formatPermissionName(key) {
            return key.replace(/([A-Z])/g, ' $1').trim()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        function getChannelTypeLabel(type) {
            const types = {
                0: 'Text Channel',
                2: 'Voice Channel',
                4: 'Category',
                5: 'Announcement',
                13: 'Stage Channel',
                15: 'Forum'
            };
            return types[type] || 'Unknown';
        }

        // Filter roles
        document.getElementById('roleFilter').addEventListener('input', function(e) {
            const filter = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.role-card');
            
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(filter)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });

        // Scroll to top button
        window.addEventListener('scroll', function() {
            const scrollTop = document.querySelector('.scroll-top');
            if (window.pageYOffset > 300) {
                scrollTop.classList.add('visible');
            } else {
                scrollTop.classList.remove('visible');
            }
        });

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function expandAll() {
            document.querySelectorAll('.channel-section').forEach(section => {
                section.style.display = 'block';
            });
        }

        function collapseAll() {
            document.querySelectorAll('.channel-section').forEach(section => {
                section.style.display = 'none';
            });
        }
    </script>
</body>
</html>`;
}

function startDashboardServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Discord Bot Dashboard Server Running\nUse !dashboard in DM to generate HTML file');
    });

    server.listen(3000, () => {
        console.log('Dashboard server listening on port 3000');
    });
}

// Login with your bot token
const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
client.login(TOKEN);
