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
        await handleRoleSelection(message, userState);
        return;
    }
});

async function sendHelpMessage(message) {
    const helpEmbed = new Discord.EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🤖 Role Manager Bot Help')
        .setDescription('I can help you manage your server roles and view permissions.')
        .addFields(
            { name: '!help', value: 'Show this help message' },
            { name: '!dashboard', value: 'Generate a beautiful HTML dashboard of all roles' },
            { name: '!role', value: 'Start the interactive role management process' }
        );
    await message.reply({ embeds: [helpEmbed] });
}

async function startRoleSelection(message) {
    // Find common guilds
    const guilds = client.guilds.cache.filter(g => g.members.cache.has(message.author.id));
    
    if (guilds.size === 0) {
        await message.reply("I couldn't find any servers we share! Make sure I'm in your server.");
        return;
    }

    const guild = guilds.first();
    const roles = await guild.roles.fetch();
    const sortedRoles = roles.sort((a, b) => b.position - a.position);

    let roleList = "Reply with the number of the role you want to manage:\n\n";
    const roleArray = Array.from(sortedRoles.values());
    
    roleArray.forEach((role, index) => {
        roleList += `**${index + 1}.** ${role.name}\n`;
    });

    userStates.set(message.author.id, {
        step: 'role_selection',
        guildId: guild.id,
        roles: roleArray
    });

    await message.reply(roleList);
}

async function handleRoleSelection(message, userState) {
    const index = parseInt(message.content) - 1;
    if (isNaN(index) || index < 0 || index >= userState.roles.length) {
        await message.reply("Invalid selection. Please enter a valid number.");
        return;
    }

    const selectedRole = userState.roles[index];
    const permissions = selectedRole.permissions.toArray();

    let permList = `**Permissions for ${selectedRole.name}:**\n\n`;
    permissions.forEach(perm => {
        permList += `✅ ${formatPermissionName(perm)}\n`;
    });

    if (permissions.length === 0) permList = `The role **${selectedRole.name}** has no permissions.`;

    await message.reply(permList);
    userStates.delete(message.author.id);
}

// FIX: Added missing helper functions
function formatPermissionName(permission) {
    return permission
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function getPermissionColor(perm) {
    const adminPerms = ['Administrator', 'Manage Guild', 'Manage Roles', 'Manage Webhooks'];
    const formatted = formatPermissionName(perm);
    
    if (adminPerms.includes(formatted)) return '#ff4757'; 
    if (formatted.startsWith('Manage')) return '#ffa502'; 
    return '#2ed573'; 
}

async function generateDashboard(message) {
    const guilds = client.guilds.cache.filter(g => g.members.cache.has(message.author.id));
    if (guilds.size === 0) return message.reply("No shared servers found.");

    const guild = guilds.first();
    const roles = await guild.roles.fetch();
    const sortedRoles = Array.from(roles.values()).sort((a, b) => b.position - a.position);

    const htmlContent = generateHTML(guild.name, sortedRoles);
    const filePath = path.join(__dirname, 'dashboard.html');
    
    fs.writeFileSync(filePath, htmlContent);
    await message.reply({
        content: `Here is your dashboard for **${guild.name}**!`,
        files: [filePath]
    });
}

function generateHTML(guildName, roles) {
    let rolesHtml = '';
    roles.forEach(role => {
        const perms = role.permissions.toArray();
        let permsHtml = perms.map(p => 
            `<span class="badge" style="background-color: ${getPermissionColor(p)}">${formatPermissionName(p)}</span>`
        ).join('');

        rolesHtml += `
        <div class="role-card">
            <div class="role-header" style="border-left: 5px solid ${role.hexColor}">
                <h3>${role.name}</h3>
                <span class="role-id">ID: ${role.id}</span>
            </div>
            <div class="perm-container">${permsHtml || 'No permissions'}</div>
        </div>`;
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${guildName} Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2f3136; color: white; padding: 20px; }
        .role-card { background: #36393f; margin-bottom: 15px; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-left: 10px; }
        .badge { display: inline-block; padding: 4px 8px; margin: 2px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
        .role-id { font-size: 11px; opacity: 0.5; }
    </style>
</head>
<body>
    <h1>${guildName} Role Dashboard</h1>
    ${rolesHtml}
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
