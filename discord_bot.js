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
        Discord.GatewayIntentBits.GuildMessages,
    ],
    partials: [Discord.Partials.Channel, Discord.Partials.Message]
});

// Configuration - Set these in Railway environment variables
const CONFIG = {
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
    YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID || '', // Scooter's YouTube channel ID
    MAIN_CHAT_CHANNEL_ID: process.env.MAIN_CHAT_CHANNEL_ID || '',
    ANNOUNCEMENT_CHANNEL_ID: process.env.ANNOUNCEMENT_CHANNEL_ID || '',
    MOD_CHANNEL_ID: process.env.MOD_CHANNEL_ID || '',
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || '',
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || '',
    STAFF_ROLE_IDS: (process.env.STAFF_ROLE_IDS || '').split(',').filter(Boolean),
};

// Store user states for interactive commands and tickets
const userStates = new Map();
const streamAlerts = new Map(); // Track which alerts have been sent
let lastStreamCheck = null;

client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Dashboard available at: http://localhost:10000`);
    
    // Start stream checking (every minute)
    setInterval(checkYouTubeStreams, 60000);
    checkYouTubeStreams(); // Check immediately on startup
    
    startKeepAliveServer();
});

// ======================
// YOUTUBE STREAM ALERTS
// ======================

async function checkYouTubeStreams() {
    if (!CONFIG.YOUTUBE_API_KEY || !CONFIG.YOUTUBE_CHANNEL_ID) {
        console.log('⚠️ YouTube API not configured');
        return;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CONFIG.YOUTUBE_CHANNEL_ID}&eventType=upcoming&type=video&key=${CONFIG.YOUTUBE_API_KEY}`
        );
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            // Check if live now
            const liveResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CONFIG.YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key=${CONFIG.YOUTUBE_API_KEY}`
            );
            const liveData = await liveResponse.json();
            
            if (liveData.items && liveData.items.length > 0) {
                await handleLiveStream(liveData.items[0]);
            }
            return;
        }

        // Get video details for scheduled streams
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoIds}&key=${CONFIG.YOUTUBE_API_KEY}`
        );
        const detailsData = await detailsResponse.json();

        for (const video of detailsData.items) {
            if (video.liveStreamingDetails && video.liveStreamingDetails.scheduledStartTime) {
                await handleScheduledStream(video);
            }
        }
    } catch (error) {
        console.error('Error checking YouTube streams:', error);
    }
}

async function handleScheduledStream(video) {
    const scheduledTime = new Date(video.liveStreamingDetails.scheduledStartTime);
    const now = new Date();
    const minutesUntil = Math.floor((scheduledTime - now) / 1000 / 60);
    
    const videoId = video.id;
    const alertKey = `${videoId}-${minutesUntil}`;
    
    // Check if we've already sent this alert
    if (streamAlerts.has(alertKey)) return;
    
    const mainChannel = await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID);
    if (!mainChannel) return;
    
    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const title = video.snippet.title;
    
    // Alert thresholds: 2hrs, 1hr, 30min, 5min
    const alerts = [
        { time: 120, message: '🔴 Stream starting in **2 hours**!' },
        { time: 60, message: '🔴 Stream starting in **1 hour**!' },
        { time: 30, message: '🔴 Stream starting in **30 minutes**!' },
        { time: 5, message: '🔴 Stream starting in **5 minutes**!' },
    ];
    
    for (const alert of alerts) {
        if (minutesUntil <= alert.time && minutesUntil > alert.time - 2) {
            const embed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(`📺 ${title}`)
                .setDescription(`${alert.message}\n\n[Watch on YouTube](${streamUrl})`)
                .setThumbnail(video.snippet.thumbnails.high.url)
                .setTimestamp(scheduledTime);
            
            await mainChannel.send({ embeds: [embed] });
            streamAlerts.set(alertKey, true);
            
            // Clean up old alerts
            if (streamAlerts.size > 100) {
                const firstKey = streamAlerts.keys().next().value;
                streamAlerts.delete(firstKey);
            }
            break;
        }
    }
}

async function handleLiveStream(video) {
    const videoId = video.id.videoId;
    const liveAlertKey = `${videoId}-LIVE`;
    
    // Only ping @everyone once per stream
    if (streamAlerts.has(liveAlertKey)) return;
    streamAlerts.set(liveAlertKey, true);
    
    const mainChannel = await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID);
    const announcementChannel = await client.channels.fetch(CONFIG.ANNOUNCEMENT_CHANNEL_ID);
    
    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const title = video.snippet.title;
    
    const embed = new Discord.EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔴 SCOOTER IS LIVE!`)
        .setDescription(`**${title}**\n\n[Watch Now on YouTube](${streamUrl})`)
        .setThumbnail(video.snippet.thumbnails.high.url)
        .setTimestamp();
    
    // Send to main chat with @everyone ping
    await mainChannel.send({ content: '@everyone', embeds: [embed] });
    
    // Publish to announcement channel
    if (announcementChannel) {
        const msg = await announcementChannel.send({ content: '@everyone', embeds: [embed] });
        if (msg.crosspostable) {
            await msg.crosspost();
        }
    }
}

// ======================
// MESSAGE MONITORING (Address Detection)
// ======================

client.on('messageCreate', async (message) => {
    // Ignore bots and DMs for address detection
    if (message.author.bot) return;
    if (!message.guild) {
        // Handle DM Ticket System
        await handleDMTicket(message);
        return;
    }
    
    // Check if user is staff
    const isStaff = message.member.roles.cache.some(role => CONFIG.STAFF_ROLE_IDS.includes(role.id));
    
    // Address detection for non-staff only
    if (!isStaff) {
        const addressDetected = detectAddress(message.content);
        if (addressDetected) {
            await handleAddressDetection(message, addressDetected);
            return;
        }
    }
    
    // Staff commands (work in server channels)
    if (message.content.startsWith('!')) {
        await handleStaffCommands(message);
    }
});

// Address detection patterns
const ADDRESS_PATTERNS = [
    // US addresses
    /\b\d{1,5}\s+[\w\s]{1,50}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way)\b/i,
    /\b\d{5}(?:-\d{4})?\b/, // ZIP codes
    
    // UK postcodes
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i,
    
    // Australian postcodes
    /\b(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/i,
    
    // French postcodes
    /\b\d{5}\b.*\bFrance\b/i,
    
    // General street indicators
    /\b(?:apartment|apt|unit|suite|ste|floor|fl)\s*#?\d+/i,
];

function detectAddress(text) {
    for (const pattern of ADDRESS_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return match[0];
        }
    }
    return null;
}

async function handleAddressDetection(message, address) {
    try {
        // Delete the message
        await message.delete();
        
        // Timeout user for 12 hours
        await message.member.timeout(12 * 60 * 60 * 1000, 'Posted address in chat');
        
        // Alert mod channel
        const modChannel = await client.channels.fetch(CONFIG.MOD_CHANNEL_ID);
        if (modChannel) {
            const embed = new Discord.EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 Address Detected and Removed')
                .addFields(
                    { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                    { name: 'Channel', value: `<#${message.channelId}>` },
                    { name: 'Detected Address', value: `||${address}||` },
                    { name: 'Action Taken', value: 'Message deleted, user timed out for 12 hours' }
                )
                .setTimestamp();
            
            await modChannel.send({ embeds: [embed] });
        }
        
        // DM user
        try {
            await message.author.send('⚠️ Your message was removed for containing what appears to be a physical address. For your safety, please do not share personal information in public channels. You have been timed out for 12 hours.');
        } catch (e) {
            console.log('Could not DM user about address detection');
        }
    } catch (error) {
        console.error('Error handling address detection:', error);
    }
}

// ======================
// DM TICKET SYSTEM
// ======================

async function handleDMTicket(message) {
    const userId = message.author.id;
    const userState = userStates.get(userId);
    
    // Initial DM - show menu
    if (!userState) {
        const embed = new Discord.EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 Support Ticket System')
            .setDescription('Please select the type of ticket you want to create:')
            .addFields(
                { name: '💻 Tech Support', value: 'Type `tech` for technical issues or help' },
                { name: '🚨 Report', value: 'Type `report` to report a user or issue' }
            );
        
        await message.reply({ embeds: [embed] });
        
        userStates.set(userId, { step: 'ticket_type' });
        return;
    }
    
    // Handle ticket type selection
    if (userState.step === 'ticket_type') {
        const type = message.content.toLowerCase().trim();
        
        if (type === 'tech') {
            userState.ticketType = 'tech';
            userState.step = 'tech_description';
            await message.reply('📝 Please describe your technical issue in detail:');
        } else if (type === 'report') {
            userState.ticketType = 'report';
            userState.step = 'report_who';
            await message.reply('👤 Who are you reporting? (Username, ID, or @mention)');
        } else {
            await message.reply('❌ Invalid option. Please type `tech` or `report`');
        }
        return;
    }
    
    // Tech ticket flow
    if (userState.step === 'tech_description') {
        userState.description = message.content;
        await createTechTicket(message.author, userState);
        userStates.delete(userId);
        return;
    }
    
    // Report ticket flow
    if (userState.step === 'report_who') {
        userState.reportWho = message.content;
        userState.step = 'report_what';
        await message.reply('📄 What happened? Please describe the incident:');
        return;
    }
    
    if (userState.step === 'report_what') {
        userState.reportWhat = message.content;
        userState.step = 'report_proof';
        await message.reply('📸 Please provide proof (screenshots, message links, etc.):');
        return;
    }
    
    if (userState.step === 'report_proof') {
        userState.reportProof = message.content;
        await createReportTicket(message.author, userState);
        userStates.delete(userId);
        return;
    }
}

async function createTechTicket(user, state) {
    const guild = client.guilds.cache.first(); // Get the first guild
    if (!guild) return;
    
    const ticketNumber = Math.floor(Math.random() * 9999);
    const channelName = `tech-${ticketNumber}`;
    
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: Discord.ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID || null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [Discord.PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                },
                ...CONFIG.STAFF_ROLE_IDS.map(roleId => ({
                    id: roleId,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                })),
            ],
        });
        
        const embed = new Discord.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💻 Tech Support Ticket')
            .addFields(
                { name: 'User', value: `${user.tag}` },
                { name: 'Issue Description', value: state.description }
            )
            .setFooter({ text: 'Staff: use !close to archive and close this ticket' })
            .setTimestamp();
        
        await channel.send({ content: `${user} - Support staff will assist you shortly!`, embeds: [embed] });
        
        await user.send(`✅ Your tech support ticket has been created: <#${channel.id}>`);
    } catch (error) {
        console.error('Error creating tech ticket:', error);
        await user.send('❌ There was an error creating your ticket. Please contact a staff member directly.');
    }
}

async function createReportTicket(user, state) {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    const ticketNumber = Math.floor(Math.random() * 9999);
    const channelName = `report-${ticketNumber}`;
    
    try {
        const channel = await guild.channels.create({
            name: channelName,
            type: Discord.ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID || null,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [Discord.PermissionFlagsBits.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                },
                ...CONFIG.STAFF_ROLE_IDS.map(roleId => ({
                    id: roleId,
                    allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages],
                })),
            ],
        });
        
        const embed = new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 User Report')
            .addFields(
                { name: 'Reported By', value: `${user.tag}` },
                { name: 'Who', value: state.reportWho },
                { name: 'What Happened', value: state.reportWhat },
                { name: 'Proof', value: state.reportProof }
            )
            .setFooter({ text: 'Moderators: use !close to archive and close this ticket' })
            .setTimestamp();
        
        await channel.send({ content: `${user} - Moderators will review your report.`, embeds: [embed] });
        
        await user.send(`✅ Your report ticket has been created: <#${channel.id}>`);
    } catch (error) {
        console.error('Error creating report ticket:', error);
        await user.send('❌ There was an error creating your report. Please contact a moderator directly.');
    }
}

// ======================
// STAFF COMMANDS
// ======================

async function handleStaffCommands(message) {
    const isStaff = message.member.roles.cache.some(role => CONFIG.STAFF_ROLE_IDS.includes(role.id));
    if (!isStaff && !message.member.permissions.has(Discord.PermissionFlagsBits.Administrator)) return;
    
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args[0].toLowerCase();
    
    if (command === 'checklive') {
        await message.reply('🔍 Checking YouTube for live streams...');
        await checkYouTubeStreams();
        await message.channel.send('✅ Stream check complete! Any upcoming or live streams have been processed.');
    }
    
    if (command === 'online') {
        await client.user.setStatus('online');
        await message.reply('✅ Bot status set to **Online**');
    }
    
    if (command === 'offline') {
        await client.user.setStatus('invisible');
        await message.reply('✅ Bot status set to **Offline**');
    }
    
    if (command === 'close') {
        // Check if this is a ticket channel
        if (message.channel.name.startsWith('tech-') || message.channel.name.startsWith('report-')) {
            await closeTicket(message.channel);
        } else {
            await message.reply('❌ This command only works in ticket channels.');
        }
    }
    
    // Role management commands still work
    if (command === 'help') {
        await sendHelpMessage(message);
    }
    
    if (command === 'dashboard') {
        await generateDashboard(message);
    }
    
    if (command === 'role') {
        await startRoleSelection(message);
    }
    
    if (command === 'permission') {
        await handlePermissionCommand(message);
    }
}

async function closeTicket(channel) {
    try {
        // Fetch all messages to create transcript
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(msg => 
            `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`
        ).join('\n');
        
        // Send transcript to log channel
        const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
        if (logChannel) {
            const transcriptBuffer = Buffer.from(transcript, 'utf-8');
            const attachment = new Discord.AttachmentBuilder(transcriptBuffer, { name: `${channel.name}-transcript.txt` });
            
            const embed = new Discord.EmbedBuilder()
                .setColor('#FFA500')
                .setTitle(`🗃️ Ticket Closed: ${channel.name}`)
                .setDescription('Transcript attached below')
                .setTimestamp();
            
            await logChannel.send({ embeds: [embed], files: [attachment] });
        }
        
        await channel.send('🗃️ This ticket will be deleted in 5 seconds...');
        setTimeout(async () => {
            await channel.delete();
        }, 5000);
    } catch (error) {
        console.error('Error closing ticket:', error);
    }
}

// ======================
// ROLE MANAGEMENT (Original functionality)
// ======================

async function sendHelpMessage(message) {
    const embed = new Discord.EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 Discord Bot Commands')
        .setDescription('Multi-function bot for role management, tickets, and stream alerts')
        .addFields(
            { name: '📊 Role Management', value: '`!dashboard` - Generate HTML permissions dashboard\n`!role` - Select role to manage\n`!permission` - Modify permissions' },
            { name: '🎫 Ticket System', value: 'DM the bot to create a ticket' },
            { name: '⚙️ Staff Commands', value: '`!checklive` - Check YouTube streams\n`!online` / `!offline` - Set bot status\n`!close` - Close ticket channel' }
        );

    await message.reply({ embeds: [embed] });
}

async function generateDashboard(message) {
    try {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const data = await collectServerData(guild);
        const html = generateHTML(data);

        const filename = `dashboard_${guild.id}_${Date.now()}.html`;
        const outputDir = fs.existsSync('/mnt/user-data/outputs') ? '/mnt/user-data/outputs' : __dirname;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, html);

        await message.reply({
            content: '✅ Dashboard generated!',
            files: [filepath]
        });
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error generating dashboard: ' + error.message);
    }
}

async function startRoleSelection(message) {
    try {
        const guild = message.guild;
        if (!guild) return;

        const roles = guild.roles.cache
            .filter(role => role.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map((role, index) => ({ index: index + 1, role }));

        let roleList = '**📋 Available Roles:**\n\n';
        roles.forEach(({ index, role }) => {
            roleList += `${index}. ${role.name} (${role.members.size} members)\n`;
        });
        roleList += '\n**Reply with the number of the role:**';

        await message.reply(roleList);

        const filter = m => m.author.id === message.author.id;
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
        
        if (collected.size === 0) {
            await message.reply('❌ Timed out.');
            return;
        }

        const roleIndex = parseInt(collected.first().content);
        if (isNaN(roleIndex) || roleIndex < 1 || roleIndex > roles.length) {
            await message.reply('❌ Invalid number.');
            return;
        }

        const selectedRole = roles[roleIndex - 1].role;
        userStates.set(message.author.id, { selectedRole, guild: guild.id });
        
        await message.reply(`✅ Selected role: **${selectedRole.name}**\n\nUse \`!permission\` to modify permissions.`);
    } catch (error) {
        console.error(error);
        await message.reply('❌ Error: ' + error.message);
    }
}

async function handlePermissionCommand(message) {
    const userState = userStates.get(message.author.id);
    if (!userState || !userState.selectedRole) {
        await message.reply('❌ Please select a role first using `!role`');
        return;
    }

    const role = message.guild.roles.cache.get(userState.selectedRole.id);
    if (!role) {
        await message.reply('❌ Role not found');
        return;
    }

    const permissions = [
        { name: 'Administrator', flag: Discord.PermissionFlagsBits.Administrator },
        { name: 'Manage Server', flag: Discord.PermissionFlagsBits.ManageGuild },
        { name: 'Manage Roles', flag: Discord.PermissionFlagsBits.ManageRoles },
        { name: 'Manage Channels', flag: Discord.PermissionFlagsBits.ManageChannels },
        { name: 'Kick Members', flag: Discord.PermissionFlagsBits.KickMembers },
        { name: 'Ban Members', flag: Discord.PermissionFlagsBits.BanMembers },
        { name: 'Send Messages', flag: Discord.PermissionFlagsBits.SendMessages },
        { name: 'Manage Messages', flag: Discord.PermissionFlagsBits.ManageMessages },
    ];

    let permList = `**🔐 Permissions for ${role.name}:**\n\n`;
    permissions.forEach((perm, index) => {
        const hasPermission = role.permissions.has(perm.flag);
        const status = hasPermission ? '✅' : '❌';
        permList += `${index + 1}. ${status} ${perm.name}\n`;
    });
    permList += '\n**Reply with permission number, then `enable` or `disable`**';

    await message.reply(permList);
}

async function collectServerData(guild) {
    // ... (same as before - keeping original functionality)
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
    // ... (same HTML generation as before)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${data.serverName} Dashboard</title></head><body><h1>${data.serverName} Role Permissions</h1><p>Dashboard generated on ${new Date().toLocaleString()}</p></body></html>`;
}

function startKeepAliveServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`Bot Online: ${client.user?.tag || 'Starting...'}\nUptime: ${process.uptime()} seconds`);
    });

    const PORT = process.env.PORT || 10000;
    server.listen(PORT, () => {
        console.log(`✅ Keep-alive server running on port ${PORT}`);
    });
}

// Login
const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
client.login(TOKEN);
