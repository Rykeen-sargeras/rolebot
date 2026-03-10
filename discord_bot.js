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
    WEB_DASHBOARD_PASSWORD: process.env.WEB_DASHBOARD_PASSWORD || 'admin123', // Set a secure password!
    ALT_DETECTION_ENABLED: process.env.ALT_DETECTION_ENABLED !== 'false', // Default enabled
    ALT_ACCOUNT_AGE_DAYS: parseInt(process.env.ALT_ACCOUNT_AGE_DAYS || '7'), // Flag accounts newer than 7 days
};

// Store user states for interactive commands and tickets
const userStates = new Map();
const streamAlerts = new Map(); // Track which alerts have been sent
let lastStreamCheck = null;

// Audit log system
const auditLog = [];
const MAX_AUDIT_LOGS = 500; // Keep last 500 events

function addAuditLog(action, user, details, severity = 'info') {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        user: user ? `${user.tag} (${user.id})` : 'System',
        details,
        severity // info, warning, error, success
    };
    
    auditLog.unshift(logEntry); // Add to beginning
    
    // Keep only last MAX_AUDIT_LOGS entries
    if (auditLog.length > MAX_AUDIT_LOGS) {
        auditLog.pop();
    }
    
    console.log(`[AUDIT ${severity.toUpperCase()}] ${action} by ${logEntry.user}: ${details}`);
}


client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`📊 Dashboard available at: http://localhost:10000`);
    addAuditLog('Bot Started', client.user, `Bot logged in as ${client.user.tag}`, 'success');
    
    // Start stream checking (every minute)
    setInterval(checkYouTubeStreams, 60000);
    checkYouTubeStreams(); // Check immediately on startup
    
    startKeepAliveServer();
});

// Alt account detection on member join
client.on('guildMemberAdd', async (member) => {
    if (!CONFIG.ALT_DETECTION_ENABLED) return;
    
    try {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
        
        // Check if account is suspiciously new
        if (accountAgeDays < CONFIG.ALT_ACCOUNT_AGE_DAYS) {
            const modChannel = await client.channels.fetch(CONFIG.MOD_CHANNEL_ID);
            if (modChannel) {
                const embed = new Discord.EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Potential Alt Account Detected')
                    .setThumbnail(member.user.displayAvatarURL())
                    .addFields(
                        { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
                        { name: 'Account Age', value: `${accountAgeDays} days old`, inline: true },
                        { name: 'Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Default Avatar', value: member.user.avatar ? 'No' : '**Yes** ⚠️', inline: true },
                        { name: 'Status', value: '🔍 Review recommended', inline: true }
                    )
                    .setFooter({ text: 'Alt Detection System' })
                    .setTimestamp();
                
                await modChannel.send({ embeds: [embed] });
                addAuditLog('Alt Account Detected', member.user, `Account age: ${accountAgeDays} days`, 'warning');
            }
        }
        
        addAuditLog('Member Joined', member.user, `Account age: ${accountAgeDays} days`, 'info');
    } catch (error) {
        console.error('Error in alt detection:', error);
    }
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

// Address detection patterns - VERY strict to avoid false positives
const ADDRESS_PATTERNS = [
    // Full US street address (number + street name + street type + optional city/state/zip)
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b[\s,]+[\w\s]+,?\s+(?:[A-Z]{2}|\w{4,})\s*\d{5}/i,
    
    // Address with apartment/unit AND street name
    /\b(?:apartment|apt|unit|suite|ste)\s*#?\d+[,\s]+\d{1,5}\s+[\w\s]{3,}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i,
    
    // UK full address with postcode
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|road|lane|avenue|drive|way|close|court)\b.*\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/i,
    
    // Australian address (street + suburb + state + postcode)
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|road|avenue|drive|st|rd|ave|dr)\b[\s,]+[\w\s]{3,20}[\s,]+(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/i,
];

function detectAddress(text) {
    // Ignore if message is too short (likely not a real address)
    if (text.length < 20) return null;
    
    // Ignore if message contains whitelisted phrases (context that indicates not a real address)
    const whitelistPhrases = [
        'example', 'test', 'fake', 'sample', 'lorem ipsum',
        'http', 'https', 'www.', '.com', '.net', '.org',
        'discord.gg', 'youtube.com', 'twitter.com',
        'price', 'cost', '$', '€', '£', 'buy', 'sell',
        'code', 'error', 'line', 'function',
        'minute', 'hour', 'second', 'day', 'week', 'month', 'year',
        'until', 'in', 'ago', 'time', 'timer', 'clock',
        'stream', 'video', 'live', 'watch', 'tonight', 'today', 'tomorrow'
    ];
    
    const lowerText = text.toLowerCase();
    for (const phrase of whitelistPhrases) {
        if (lowerText.includes(phrase)) return null;
    }
    
    // Check patterns
    for (const pattern of ADDRESS_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            // Extra validation: make sure it looks like a real address
            const matchText = match[0];
            
            // Ignore if it's just numbers with no context
            if (/^\d+$/.test(matchText.trim())) return null;
            
            // Must contain multiple address components (not just street name)
            const hasNumber = /\d{1,5}/.test(matchText);
            const hasStreet = /(?:street|avenue|road|boulevard|lane|drive|st|ave|rd|blvd|ln|dr)/.test(matchText.toLowerCase());
            const hasCityOrZip = /(?:[A-Z]{2}\s+\d{5}|,\s*[A-Z][a-z]+)/.test(matchText);
            
            // Require all three components for a valid address
            if (!hasNumber || !hasStreet || !hasCityOrZip) return null;
            
            return matchText;
        }
    }
    return null;
}

async function handleAddressDetection(message, address) {
    try {
        console.log(`🚨 Address detected from ${message.author.tag} in #${message.channel.name}`);
        console.log(`MOD_CHANNEL_ID configured: ${CONFIG.MOD_CHANNEL_ID || 'NOT SET'}`);
        
        // Delete the message
        await message.delete();
        console.log('✅ Message deleted');
        
        // Timeout user for 12 hours
        await message.member.timeout(12 * 60 * 60 * 1000, 'Posted address in chat');
        console.log('✅ User timed out');
        
        // Add audit log entry
        addAuditLog(
            'Address Detected',
            message.author,
            `Detected in #${message.channel.name}: ${address.substring(0, 50)}... - User timed out 12hrs`,
            'warning'
        );
        
        // Alert mod channel
        if (!CONFIG.MOD_CHANNEL_ID) {
            console.error('❌ MOD_CHANNEL_ID not configured! Cannot send alert.');
            return;
        }
        
        try {
            const modChannel = await client.channels.fetch(CONFIG.MOD_CHANNEL_ID);
            console.log(`✅ Mod channel fetched: ${modChannel.name}`);
            
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
            console.log('✅ Alert sent to mod channel');
        } catch (modError) {
            console.error('❌ Error sending to mod channel:', modError.message);
            console.error('Check that MOD_CHANNEL_ID is correct and bot has permissions');
        }
        
        // DM user
        try {
            await message.author.send('⚠️ Your message was removed for containing what appears to be a physical address. For your safety, please do not share personal information in public channels. You have been timed out for 12 hours.');
            console.log('✅ DM sent to user');
        } catch (e) {
            console.log('⚠️ Could not DM user about address detection');
        }
    } catch (error) {
        console.error('❌ Error handling address detection:', error);
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
        
        addAuditLog('Ticket Created', { tag: user.tag, id: user.id }, `Tech ticket #${ticketNumber} - ${state.description.substring(0, 50)}...`, 'info');
        
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
    
    if (command === 'config') {
        const configEmbed = new Discord.EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Bot Configuration Status')
            .addFields(
                { name: 'YouTube API Key', value: CONFIG.YOUTUBE_API_KEY ? '✅ Set' : '❌ Not set' },
                { name: 'YouTube Channel ID', value: CONFIG.YOUTUBE_CHANNEL_ID ? '✅ Set' : '❌ Not set' },
                { name: 'Main Chat Channel', value: CONFIG.MAIN_CHAT_CHANNEL_ID ? `✅ <#${CONFIG.MAIN_CHAT_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Announcement Channel', value: CONFIG.ANNOUNCEMENT_CHANNEL_ID ? `✅ <#${CONFIG.ANNOUNCEMENT_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Mod Channel', value: CONFIG.MOD_CHANNEL_ID ? `✅ <#${CONFIG.MOD_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Log Channel', value: CONFIG.LOG_CHANNEL_ID ? `✅ <#${CONFIG.LOG_CHANNEL_ID}>` : '❌ Not set' },
                { name: 'Ticket Category', value: CONFIG.TICKET_CATEGORY_ID ? '✅ Set' : '❌ Not set' },
                { name: 'Staff Role IDs', value: CONFIG.STAFF_ROLE_IDS.length > 0 ? `✅ ${CONFIG.STAFF_ROLE_IDS.length} role(s)` : '❌ Not set' }
            );
        await message.reply({ embeds: [configEmbed] });
        return;
    }
    
    if (command === 'checklive') {
        await message.reply('🔍 Checking YouTube for live streams...');
        
        if (!CONFIG.YOUTUBE_API_KEY || !CONFIG.YOUTUBE_CHANNEL_ID) {
            await message.channel.send('❌ YouTube API not configured. Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in Railway.');
            return;
        }
        
        try {
            // Check for upcoming streams
            const upcomingResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CONFIG.YOUTUBE_CHANNEL_ID}&eventType=upcoming&type=video&key=${CONFIG.YOUTUBE_API_KEY}`
            );
            const upcomingData = await upcomingResponse.json();
            
            // Check for live streams
            const liveResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CONFIG.YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key=${CONFIG.YOUTUBE_API_KEY}`
            );
            const liveData = await liveResponse.json();
            
            const mainChannel = CONFIG.MAIN_CHAT_CHANNEL_ID ? await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID) : message.channel;
            
            // Handle live streams
            if (liveData.items && liveData.items.length > 0) {
                for (const video of liveData.items) {
                    const streamUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
                    const embed = new Discord.EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🔴 LIVE NOW!')
                        .setDescription(`**${video.snippet.title}**\n\n[Watch on YouTube](${streamUrl})`)
                        .setThumbnail(video.snippet.thumbnails.high.url)
                        .setTimestamp();
                    
                    await mainChannel.send({ embeds: [embed] });
                }
                await message.channel.send(`✅ Found ${liveData.items.length} live stream(s)! Posted to main chat.`);
                return;
            }
            
            // Handle upcoming streams
            if (upcomingData.items && upcomingData.items.length > 0) {
                const videoIds = upcomingData.items.map(item => item.id.videoId).join(',');
                const detailsResponse = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoIds}&key=${CONFIG.YOUTUBE_API_KEY}`
                );
                const detailsData = await detailsResponse.json();
                
                for (const video of detailsData.items) {
                    if (video.liveStreamingDetails && video.liveStreamingDetails.scheduledStartTime) {
                        const scheduledTime = new Date(video.liveStreamingDetails.scheduledStartTime);
                        const now = new Date();
                        const hoursUntil = Math.floor((scheduledTime - now) / 1000 / 60 / 60);
                        const minutesUntil = Math.floor((scheduledTime - now) / 1000 / 60) % 60;
                        
                        const streamUrl = `https://www.youtube.com/watch?v=${video.id}`;
                        const embed = new Discord.EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('📅 Upcoming Stream')
                            .setDescription(`**${video.snippet.title}**\n\n⏰ Starts in: **${hoursUntil}h ${minutesUntil}m**\n\n[Watch on YouTube](${streamUrl})`)
                            .setThumbnail(video.snippet.thumbnails.high.url)
                            .setTimestamp(scheduledTime);
                        
                        await mainChannel.send({ embeds: [embed] });
                    }
                }
                await message.channel.send(`✅ Found ${detailsData.items.length} upcoming stream(s)! Posted to main chat.`);
                return;
            }
            
            await message.channel.send('✅ No live or upcoming streams found.');
            
        } catch (error) {
            console.error('Error in checklive command:', error);
            await message.channel.send('❌ Error checking streams: ' + error.message);
        }
        return;
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
            { name: '⚙️ Staff Commands', value: '`!config` - Check bot configuration\n`!checklive` - Check YouTube streams\n`!online` / `!offline` - Set bot status\n`!close` - Close ticket channel' }
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
    const server = http.createServer(async (req, res) => {
        // Parse URL and method
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        
        // CORS headers for API requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // API: Get audit log
        if (pathname === '/api/audit-log' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                logs: auditLog.slice(0, 100), // Last 100 entries
                botStatus: client.user ? 'online' : 'offline',
                botTag: client.user?.tag || 'Not connected'
            }));
            return;
        }
        
        // API: Send message to main chat
        if (pathname === '/api/send-message' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    if (!CONFIG.MAIN_CHAT_CHANNEL_ID) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'MAIN_CHAT_CHANNEL_ID not configured' }));
                        return;
                    }
                    
                    const mainChannel = await client.channels.fetch(CONFIG.MAIN_CHAT_CHANNEL_ID);
                    await mainChannel.send(data.message);
                    
                    addAuditLog('Message Sent', { tag: 'Web Dashboard', id: 'web' }, `Sent to main chat: ${data.message.substring(0, 50)}...`, 'success');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Message sent!' }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // API: Send announcement
        if (pathname === '/api/send-announcement' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    if (!CONFIG.ANNOUNCEMENT_CHANNEL_ID) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'ANNOUNCEMENT_CHANNEL_ID not configured' }));
                        return;
                    }
                    
                    const announcementChannel = await client.channels.fetch(CONFIG.ANNOUNCEMENT_CHANNEL_ID);
                    
                    const embed = new Discord.EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📢 Announcement')
                        .setDescription(data.message)
                        .setTimestamp()
                        .setFooter({ text: 'Posted from Web Dashboard' });
                    
                    const msg = await announcementChannel.send({ 
                        content: data.pingEveryone ? '@everyone' : null,
                        embeds: [embed] 
                    });
                    
                    // Try to publish if it's an announcement channel
                    if (msg.crosspostable) {
                        await msg.crosspost();
                    }
                    
                    addAuditLog('Announcement Posted', { tag: 'Web Dashboard', id: 'web' }, `Posted announcement: ${data.message.substring(0, 50)}...`, 'success');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Announcement posted!' }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // API: Get role permissions
        if (pathname === '/api/roles' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            try {
                const guild = client.guilds.cache.first();
                if (!guild) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot not in any server' }));
                    return;
                }
                
                const rolesData = await collectServerData(guild);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(rolesData));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        
        // API: Search users
        if (pathname === '/api/users/search' && req.method === 'GET') {
            const password = url.searchParams.get('password');
            const query = url.searchParams.get('query');
            
            if (password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid password' }));
                return;
            }
            
            try {
                const guild = client.guilds.cache.first();
                if (!guild) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot not in any server' }));
                    return;
                }
                
                await guild.members.fetch();
                
                let results = [];
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    results = guild.members.cache.filter(member => {
                        return member.user.tag.toLowerCase().includes(lowerQuery) ||
                               member.user.id === query ||
                               member.displayName.toLowerCase().includes(lowerQuery);
                    }).map(member => ({
                        id: member.user.id,
                        tag: member.user.tag,
                        displayName: member.displayName,
                        avatar: member.user.displayAvatarURL(),
                        joinedAt: member.joinedTimestamp,
                        accountCreatedAt: member.user.createdTimestamp,
                        roles: member.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
                        timedOut: member.communicationDisabledUntilTimestamp ? member.communicationDisabledUntilTimestamp > Date.now() : false,
                        timeoutUntil: member.communicationDisabledUntilTimestamp
                    })).slice(0, 20); // Limit to 20 results
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ users: results }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }
        
        // API: User action (timeout, kick, ban)
        if (pathname === '/api/users/action' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    const guild = client.guilds.cache.first();
                    const member = await guild.members.fetch(data.userId);
                    
                    let result = '';
                    
                    switch(data.action) {
                        case 'timeout':
                            const duration = parseInt(data.duration) || 60; // minutes
                            await member.timeout(duration * 60 * 1000, data.reason || 'Timed out from web dashboard');
                            result = `Timed out for ${duration} minutes`;
                            addAuditLog('User Timed Out', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} timed out for ${duration} minutes`, 'warning');
                            break;
                            
                        case 'untimeout':
                            await member.timeout(null);
                            result = 'Timeout removed';
                            addAuditLog('Timeout Removed', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} timeout removed`, 'success');
                            break;
                            
                        case 'kick':
                            await member.kick(data.reason || 'Kicked from web dashboard');
                            result = 'User kicked';
                            addAuditLog('User Kicked', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} kicked`, 'warning');
                            break;
                            
                        case 'ban':
                            await guild.members.ban(data.userId, { reason: data.reason || 'Banned from web dashboard' });
                            result = 'User banned';
                            addAuditLog('User Banned', { tag: 'Web Dashboard', id: 'web' }, `${member.user.tag} banned`, 'error');
                            break;
                            
                        default:
                            throw new Error('Invalid action');
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: result }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // API: Quick actions
        if (pathname === '/api/quick-action' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (data.password !== CONFIG.WEB_DASHBOARD_PASSWORD) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid password' }));
                        return;
                    }
                    
                    let result = '';
                    
                    switch(data.action) {
                        case 'check-stream':
                            await checkYouTubeStreams();
                            result = 'Stream check completed';
                            addAuditLog('Stream Check', { tag: 'Web Dashboard', id: 'web' }, 'Manual stream check triggered', 'info');
                            break;
                            
                        case 'set-online':
                            await client.user.setStatus('online');
                            result = 'Bot status set to online';
                            addAuditLog('Status Changed', { tag: 'Web Dashboard', id: 'web' }, 'Bot status: online', 'info');
                            break;
                            
                        case 'set-offline':
                            await client.user.setStatus('invisible');
                            result = 'Bot status set to offline';
                            addAuditLog('Status Changed', { tag: 'Web Dashboard', id: 'web' }, 'Bot status: offline', 'info');
                            break;
                            
                        case 'clear-audit':
                            const count = auditLog.length;
                            auditLog.length = 0;
                            result = `Cleared ${count} audit entries`;
                            addAuditLog('Audit Log Cleared', { tag: 'Web Dashboard', id: 'web' }, `Cleared ${count} entries`, 'info');
                            break;
                            
                        case 'get-stats':
                            const guild = client.guilds.cache.first();
                            const stats = {
                                totalMembers: guild.memberCount,
                                onlineMembers: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
                                roles: guild.roles.cache.size,
                                channels: guild.channels.cache.size,
                                auditEntries: auditLog.length,
                                botUptime: Math.floor(process.uptime())
                            };
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, stats }));
                            return;
                            
                        default:
                            throw new Error('Invalid action');
                    }
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: result }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        // Main dashboard HTML
        if (pathname === '/' || pathname === '/dashboard') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(generateDashboardHTML());
            return;
        }
        
        // Default: bot status
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`Bot Online: ${client.user?.tag || 'Starting...'}\nUptime: ${Math.floor(process.uptime())} seconds\nAudit Entries: ${auditLog.length}`);
    });

    const PORT = process.env.PORT || 10000;
    server.listen(PORT, () => {
        console.log(`✅ Web dashboard running on port ${PORT}`);
        console.log(`📊 Access at: http://localhost:${PORT}/dashboard`);
    });
}

// Dashboard HTML function starts here
function generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Bot Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --bg-primary: #0f0f0f;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #242424;
            --bg-hover: #2a2a2a;
            --accent: #5865f2;
            --accent-hover: #4752c4;
            --success: #3ba55d;
            --warning: #faa81a;
            --danger: #ed4245;
            --text-primary: #ffffff;
            --text-secondary: #b9bbbe;
            --text-muted: #72767d;
            --border: #2f3136;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }
        
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .login-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .login-box { background: var(--bg-secondary); border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; border: 1px solid var(--border); }
        .login-box h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
        .login-box p { color: var(--text-secondary); margin-bottom: 24px; }
        
        .header { background: var(--bg-secondary); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border); }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .bot-status { display: flex; align-items: center; gap: 8px; background: var(--bg-tertiary); padding: 8px 16px; border-radius: 8px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        .tabs { display: flex; gap: 8px; margin-bottom: 24px; background: var(--bg-secondary); padding: 8px; border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; }
        .tab { padding: 12px 24px; background: transparent; border: none; color: var(--text-secondary); cursor: pointer; border-radius: 8px; font-weight: 500; transition: all 0.2s; white-space: nowrap; font-size: 14px; }
        .tab:hover { background: var(--bg-hover); color: var(--text-primary); }
        .tab.active { background: var(--accent); color: white; }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .card { background: var(--bg-secondary); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid var(--border); }
        .card h2 { font-size: 18px; margin-bottom: 16px; font-weight: 600; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 14px; font-weight: 500; }
        
        input[type="text"], input[type="password"], input[type="number"], textarea, select {
            width: 100%; padding: 12px 16px; background: var(--bg-tertiary); border: 1px solid var(--border);
            border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 14px; transition: all 0.2s;
        }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent); background: var(--bg-primary); }
        textarea { resize: vertical; min-height: 120px; }
        
        .btn { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-size: 14px; font-family: inherit; }
        .btn-primary { background: var(--accent); color: white; }
        .btn-primary:hover { background: var(--accent-hover); }
        .btn-success { background: var(--success); color: white; }
        .btn-warning { background: var(--warning); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border); }
        .btn-secondary:hover { background: var(--bg-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .checkbox-group { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
        .checkbox-group input[type="checkbox"] { width: auto; }
        
        .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; display: none; }
        .alert.show { display: block; }
        .alert-success { background: rgba(59, 165, 93, 0.1); border: 1px solid var(--success); color: var(--success); }
        .alert-error { background: rgba(237, 66, 69, 0.1); border: 1px solid var(--danger); color: var(--danger); }
        
        .audit-entry { background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--accent); }
        .audit-entry.warning { border-left-color: var(--warning); }
        .audit-entry.error { border-left-color: var(--danger); }
        .audit-entry.success { border-left-color: var(--success); }
        .audit-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .audit-time { color: var(--text-muted); font-size: 12px; }
        .audit-action { font-weight: 600; font-size: 14px; }
        .audit-user { color: var(--text-secondary); font-size: 13px; }
        .audit-details { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
        
        .user-card { background: var(--bg-tertiary); border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; gap: 16px; align-items: flex-start; }
        .user-avatar { width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0; }
        .user-info { flex: 1; }
        .user-tag { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
        .user-id { color: var(--text-muted); font-size: 12px; margin-bottom: 8px; }
        .user-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
        .user-meta-item { font-size: 13px; color: var(--text-secondary); }
        .user-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .user-actions .btn { padding: 8px 16px; font-size: 13px; }
        
        .quick-actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .quick-action-btn { background: var(--bg-tertiary); border: 1px solid var(--border); padding: 20px; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .quick-action-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
        .quick-action-icon { font-size: 32px; margin-bottom: 8px; }
        .quick-action-label { font-weight: 500; font-size: 14px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 20px; }
        .stat-card { background: var(--bg-tertiary); padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: var(--accent); }
        .stat-label { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
        
        .role-item { background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 12px; }
        .role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .role-name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .role-badge { width: 12px; height: 12px; border-radius: 50%; }
        .role-members { color: var(--text-muted); font-size: 13px; }
        .permissions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 12px; }
        .permission-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
        
        .hidden { display: none !important; }
        .text-success { color: var(--success); }
        .text-warning { color: var(--warning); }
        .text-danger { color: var(--danger); }
        .mt-2 { margin-top: 8px; }
        .mb-2 { margin-bottom: 8px; }
        
        .loading { text-align: center; padding: 40px; color: var(--text-muted); }
        
        @media (max-width: 768px) {
            .container { padding: 12px; }
            .header { flex-direction: column; gap: 12px; }
            .tabs { overflow-x: scroll; }
            .quick-actions-grid { grid-template-columns: 1fr 1fr; }
        }
    </style>
</head>
<body>
    <div id="loginScreen" class="login-screen">
        <div class="login-box">
            <h1>🤖 Bot Dashboard</h1>
            <p>Enter password to access dashboard</p>
            <div id="loginAlert" class="alert"></div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="loginPassword" placeholder="Enter dashboard password">
            </div>
            <button class="btn btn-primary" onclick="login()" style="width: 100%;">Login</button>
        </div>
    </div>

    <div id="dashboard" class="hidden container">
        <div class="header">
            <div class="header-left">
                <h1>Discord Bot Dashboard</h1>
                <div class="bot-status">
                    <div class="status-dot"></div>
                    <span id="botStatus">Online</span>
                </div>
            </div>
            <button class="btn btn-secondary" onclick="logout()">Logout</button>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('messages')">📨 Messages</button>
            <button class="tab" onclick="showTab('announcements')">📢 Announcements</button>
            <button class="tab" onclick="showTab('users')">👥 Users</button>
            <button class="tab" onclick="showTab('actions')">⚡ Quick Actions</button>
            <button class="tab" onclick="showTab('audit')">📋 Audit Log</button>
            <button class="tab" onclick="showTab('roles')">🔐 Roles</button>
        </div>

        <div id="tab-messages" class="tab-content active">
            <div class="card">
                <h2>Send Message to Main Chat</h2>
                <div id="messageAlert" class="alert"></div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="messageText" placeholder="Type your message here..."></textarea>
                </div>
                <button class="btn btn-primary" onclick="sendMessage()">Send to Main Chat</button>
            </div>
        </div>

        <div id="tab-announcements" class="tab-content">
            <div class="card">
                <h2>Post Announcement</h2>
                <div id="announcementAlert" class="alert"></div>
                <div class="form-group">
                    <label>Announcement Message</label>
                    <textarea id="announcementText" placeholder="Enter your announcement..."></textarea>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="pingEveryone">
                    <label for="pingEveryone">Ping @everyone</label>
                </div>
                <button class="btn btn-primary mt-2" onclick="sendAnnouncement()">Post Announcement</button>
            </div>
        </div>

        <div id="tab-users" class="tab-content">
            <div class="card">
                <h2>User Management</h2>
                <div id="userAlert" class="alert"></div>
                <div class="form-group">
                    <label>Search Users</label>
                    <input type="text" id="userSearch" placeholder="Enter username, tag, or ID...">
                </div>
                <button class="btn btn-primary" onclick="searchUsers()">Search</button>
                <div id="userResults" class="mt-2"></div>
            </div>
        </div>

        <div id="tab-actions" class="tab-content">
            <div class="card">
                <h2>Quick Actions</h2>
                <div id="actionAlert" class="alert"></div>
                <div class="quick-actions-grid">
                    <div class="quick-action-btn" onclick="quickAction('check-stream')">
                        <div class="quick-action-icon">🔴</div>
                        <div class="quick-action-label">Check Stream</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('set-online')">
                        <div class="quick-action-icon">🟢</div>
                        <div class="quick-action-label">Set Online</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('set-offline')">
                        <div class="quick-action-icon">⚫</div>
                        <div class="quick-action-label">Set Offline</div>
                    </div>
                    <div class="quick-action-btn" onclick="quickAction('clear-audit')">
                        <div class="quick-action-icon">🗑️</div>
                        <div class="quick-action-label">Clear Audit</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <h2>Server Statistics</h2>
                <button class="btn btn-secondary mb-2" onclick="loadStats()">Refresh Stats</button>
                <div id="statsContainer" class="stats-grid"></div>
            </div>
        </div>

        <div id="tab-audit" class="tab-content">
            <div class="card">
                <h2>Audit Log</h2>
                <button class="btn btn-secondary mb-2" onclick="loadAuditLog()">Refresh</button>
                <div id="auditLog"></div>
            </div>
        </div>

        <div id="tab-roles" class="tab-content">
            <div class="card">
                <h2>Server Roles & Permissions</h2>
                <button class="btn btn-secondary mb-2" onclick="loadRoles()">Refresh</button>
                <div id="rolesContainer"></div>
            </div>
        </div>
    </div>

    <script>
        let password = '';
        
        function login() {
            password = document.getElementById('loginPassword').value;
            if (!password) {
                showAlert('loginAlert', 'Please enter password', 'error');
                return;
            }
            fetch(\`/api/audit-log?password=\${password}\`)
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        showAlert('loginAlert', 'Invalid password', 'error');
                    } else {
                        document.getElementById('loginScreen').classList.add('hidden');
                        document.getElementById('dashboard').classList.remove('hidden');
                        document.getElementById('botStatus').textContent = data.botTag || 'Online';
                        loadAuditLog();
                    }
                })
                .catch(err => showAlert('loginAlert', 'Error: ' + err.message, 'error'));
        }
        
        function logout() {
            password = '';
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('loginPassword').value = '';
        }
        
        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-' + tabName).classList.add('active');
            event.target.classList.add('active');
            if (tabName === 'audit') loadAuditLog();
            if (tabName === 'roles') loadRoles();
            if (tabName === 'actions') loadStats();
        }
        
        function showAlert(id, message, type) {
            const alert = document.getElementById(id);
            alert.textContent = message;
            alert.className = 'alert alert-' + type + ' show';
            setTimeout(() => alert.classList.remove('show'), 5000);
        }
        
        async function sendMessage() {
            const message = document.getElementById('messageText').value;
            if (!message) return showAlert('messageAlert', 'Please enter a message', 'error');
            try {
                const res = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, message })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('messageAlert', 'Message sent!', 'success');
                    document.getElementById('messageText').value = '';
                } else {
                    showAlert('messageAlert', data.error || 'Error', 'error');
                }
            } catch (err) {
                showAlert('messageAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function sendAnnouncement() {
            const message = document.getElementById('announcementText').value;
            const pingEveryone = document.getElementById('pingEveryone').checked;
            if (!message) return showAlert('announcementAlert', 'Please enter announcement', 'error');
            try {
                const res = await fetch('/api/send-announcement', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, message, pingEveryone })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('announcementAlert', 'Announcement posted!', 'success');
                    document.getElementById('announcementText').value = '';
                    document.getElementById('pingEveryone').checked = false;
                } else {
                    showAlert('announcementAlert', data.error || 'Error', 'error');
                }
            } catch (err) {
                showAlert('announcementAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function searchUsers() {
            const query = document.getElementById('userSearch').value;
            if (!query) return showAlert('userAlert', 'Enter search term', 'error');
            try {
                const res = await fetch(\`/api/users/search?password=\${password}&query=\${encodeURIComponent(query)}\`);
                const data = await res.json();
                if (data.error) return showAlert('userAlert', data.error, 'error');
                const container = document.getElementById('userResults');
                if (data.users.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No users found</p>';
                    return;
                }
                container.innerHTML = data.users.map(user => \`
                    <div class="user-card">
                        <img src="\${user.avatar}" class="user-avatar" alt="Avatar">
                        <div class="user-info">
                            <div class="user-tag">\${user.tag}</div>
                            <div class="user-id">ID: \${user.id}</div>
                            <div class="user-meta">
                                <span class="user-meta-item">Joined: \${new Date(user.joinedAt).toLocaleDateString()}</span>
                                <span class="user-meta-item">Account: \${new Date(user.accountCreatedAt).toLocaleDateString()}</span>
                                <span class="user-meta-item \${user.timedOut ? 'text-warning' : ''}">\${user.timedOut ? '⏱️ Timed Out' : '✅ Active'}</span>
                            </div>
                            <div class="user-actions">
                                <button class="btn btn-warning" onclick="timeoutUser('\${user.id}', '\${user.tag}')">Timeout</button>
                                \${user.timedOut ? '<button class="btn btn-success" onclick="untimeoutUser(\\''+user.id+'\\', \\''+user.tag+'\\')">Remove Timeout</button>' : ''}
                                <button class="btn btn-danger" onclick="kickUser('\${user.id}', '\${user.tag}')">Kick</button>
                                <button class="btn btn-danger" onclick="banUser('\${user.id}', '\${user.tag}')">Ban</button>
                            </div>
                        </div>
                    </div>
                \`).join('');
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function timeoutUser(userId, tag) {
            const duration = prompt('Timeout duration in minutes:', '60');
            if (!duration) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'timeout', duration, reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} timed out for \${duration} minutes\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function untimeoutUser(userId, tag) {
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'untimeout' })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} timeout removed\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function kickUser(userId, tag) {
            if (!confirm(\`Kick \${tag}?\`)) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'kick', reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} kicked\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function banUser(userId, tag) {
            if (!confirm(\`Ban \${tag}? This is permanent.\`)) return;
            const reason = prompt('Reason (optional):', '');
            try {
                const res = await fetch('/api/users/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, userId, action: 'ban', reason })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('userAlert', \`\${tag} banned\`, 'success');
                    searchUsers();
                } else {
                    showAlert('userAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('userAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function quickAction(action) {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action })
                });
                const data = await res.json();
                if (data.success) {
                    showAlert('actionAlert', data.message || 'Action completed', 'success');
                    if (action === 'get-stats') displayStats(data.stats);
                } else {
                    showAlert('actionAlert', data.error, 'error');
                }
            } catch (err) {
                showAlert('actionAlert', 'Error: ' + err.message, 'error');
            }
        }
        
        async function loadStats() {
            try {
                const res = await fetch('/api/quick-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, action: 'get-stats' })
                });
                const data = await res.json();
                if (data.success && data.stats) displayStats(data.stats);
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        
        function displayStats(stats) {
            const container = document.getElementById('statsContainer');
            const uptimeHours = Math.floor(stats.botUptime / 3600);
            const uptimeMins = Math.floor((stats.botUptime % 3600) / 60);
            container.innerHTML = \`
                <div class="stat-card"><div class="stat-value">\${stats.totalMembers}</div><div class="stat-label">Total Members</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.onlineMembers}</div><div class="stat-label">Online Now</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.roles}</div><div class="stat-label">Roles</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.channels}</div><div class="stat-label">Channels</div></div>
                <div class="stat-card"><div class="stat-value">\${stats.auditEntries}</div><div class="stat-label">Audit Entries</div></div>
                <div class="stat-card"><div class="stat-value">\${uptimeHours}h \${uptimeMins}m</div><div class="stat-label">Bot Uptime</div></div>
            \`;
        }
        
        async function loadAuditLog() {
            try {
                const res = await fetch(\`/api/audit-log?password=\${password}\`);
                const data = await res.json();
                if (data.error) return;
                const container = document.getElementById('auditLog');
                if (data.logs.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No audit entries</p>';
                    return;
                }
                container.innerHTML = data.logs.map(log => {
                    const time = new Date(log.timestamp).toLocaleString();
                    const severity = log.severity || 'info';
                    return \`
                        <div class="audit-entry \${severity}">
                            <div class="audit-header">
                                <span class="audit-action">\${log.action}</span>
                                <span class="audit-time">\${time}</span>
                            </div>
                            <div class="audit-user">By: \${log.user}</div>
                            <div class="audit-details">\${log.details}</div>
                        </div>
                    \`;
                }).join('');
            } catch (err) {
                console.error('Error loading audit log:', err);
            }
        }
        
        async function loadRoles() {
            try {
                const res = await fetch(\`/api/roles?password=\${password}\`);
                const data = await res.json();
                if (data.error) {
                    document.getElementById('rolesContainer').innerHTML = '<p style="color: var(--text-danger);">' + data.error + '</p>';
                    return;
                }
                const container = document.getElementById('rolesContainer');
                if (!data.roles || data.roles.length === 0) {
                    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No roles found</p>';
                    return;
                }
                container.innerHTML = data.roles.map(role => \`
                    <div class="role-item">
                        <div class="role-header">
                            <div class="role-name">
                                <span class="role-badge" style="background-color: \${role.color}"></span>
                                \${role.name}
                            </div>
                            <div class="role-members">\${role.members} members</div>
                        </div>
                        <div class="permissions-grid">
                            \${Object.entries(role.permissions).map(([key, value]) => \`
                                <div class="permission-item">
                                    <span>\${value ? '✅' : '❌'}</span>
                                    <span>\${formatPermissionName(key)}</span>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`).join('');
            } catch (err) {
                console.error('Error loading roles:', err);
            }
        }
        
        function formatPermissionName(key) {
            return key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        setInterval(() => {
            if (document.getElementById('tab-audit').classList.contains('active')) loadAuditLog();
        }, 10000);
        
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('loginPassword').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') login();
            });
        });
    </script>
</body>
</html>`;
}

// Login
const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
client.login(TOKEN);
