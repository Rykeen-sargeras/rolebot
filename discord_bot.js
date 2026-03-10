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

// Address detection patterns - more strict to avoid false positives
const ADDRESS_PATTERNS = [
    // US street addresses (must have number + street type word)
    /\b\d{1,5}\s+[\w\s]{3,50}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way|place|pl)\b/i,
    
    // ZIP code ONLY if followed by USA/US context or state abbreviation
    /\b\d{5}(?:-\d{4})?\s*(?:usa|united states|u\.s\.|us\b)/i,
    /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}\b/,
    
    // UK postcodes (specific format)
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b.*(?:uk|united kingdom|england|scotland|wales)/i,
    
    // Australian addresses (state + postcode)
    /\b(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+\d{4}\b/i,
    
    // Address with apartment/unit indicators
    /\b(?:apartment|apt|unit|suite|ste|floor|fl)\s*#?\d+\b.*\b(?:street|st|avenue|ave|road|rd|boulevard|blvd)\b/i,
    
    // Full address pattern (number + street name + city/state)
    /\b\d{1,5}\s+[\w\s]{3,30}(?:street|st|avenue|ave|road|rd)\b,?\s+[\w\s]{3,20},?\s+(?:[A-Z]{2}|\w{4,})/i,
];

function detectAddress(text) {
    // Ignore if message is too short (likely not a real address)
    if (text.length < 15) return null;
    
    // Ignore if message contains whitelisted phrases (context that indicates not a real address)
    const whitelistPhrases = [
        'example', 'test', 'fake', 'sample', 'lorem ipsum',
        'http', 'https', 'www.', '.com', '.net', '.org',
        'discord.gg', 'youtube.com', 'twitter.com',
        'price', 'cost', '$', '€', '£', 'buy', 'sell',
        'code', 'error', 'line', 'function'
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
            
            // Ignore if it's a single short word with numbers
            if (matchText.length < 10 && !/(?:street|avenue|road|blvd|lane|drive)/.test(matchText.toLowerCase())) {
                return null;
            }
            
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

function generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Bot Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .login-box, .dashboard {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        
        .login-box {
            max-width: 400px;
            margin: 100px auto;
        }
        
        h1 {
            color: #5865F2;
            margin-bottom: 20px;
        }
        
        h2 {
            color: #333;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #5865F2;
        }
        
        .input-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
        }
        
        input[type="password"],
        input[type="text"],
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        input:focus, textarea:focus {
            outline: none;
            border-color: #5865F2;
        }
        
        textarea {
            min-height: 100px;
            resize: vertical;
            font-family: inherit;
        }
        
        button {
            background: #5865F2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        button:hover {
            background: #4752c4;
        }
        
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        
        .status-online {
            background: #43b581;
            color: white;
        }
        
        .status-offline {
            background: #f04747;
            color: white;
        }
        
        .audit-log {
            background: #f7f7f7;
            border-radius: 8px;
            padding: 15px;
            max-height: 500px;
            overflow-y: auto;
            margin-top: 15px;
        }
        
        .audit-entry {
            background: white;
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid #5865F2;
        }
        
        .audit-entry.address {
            border-left-color: #f04747;
        }
        
        .audit-entry.ticket {
            border-left-color: #43b581;
        }
        
        .audit-entry.message {
            border-left-color: #faa61a;
        }
        
        .audit-timestamp {
            font-size: 12px;
            color: #999;
            margin-bottom: 5px;
        }
        
        .audit-action {
            font-weight: 600;
            color: #333;
            margin-bottom: 3px;
        }
        
        .audit-details {
            font-size: 13px;
            color: #666;
        }
        
        .message-form {
            background: #f7f7f7;
            padding: 20px;
            border-radius: 8px;
            margin-top: 15px;
        }
        
        .alert {
            padding: 12px;
            border-radius: 6px;
            margin-top: 15px;
        }
        
        .alert-success {
            background: #43b581;
            color: white;
        }
        
        .alert-error {
            background: #f04747;
            color: white;
        }
        
        .refresh-btn {
            background: #43b581;
            font-size: 12px;
            padding: 8px 16px;
            float: right;
        }
        
        .hidden {
            display: none;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .loading {
            animation: pulse 1.5s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Login Box -->
        <div id="loginBox" class="login-box">
            <h1>🤖 Bot Dashboard Login</h1>
            <div class="input-group">
                <label for="password">Dashboard Password</label>
                <input type="password" id="password" placeholder="Enter dashboard password">
            </div>
            <button onclick="login()">Login</button>
            <div id="loginError" class="alert alert-error hidden" style="margin-top: 15px;"></div>
        </div>
        
        <!-- Main Dashboard -->
        <div id="dashboard" class="dashboard hidden">
            <h1>🤖 Discord Bot Dashboard
                <span id="statusBadge" class="status-badge status-offline">Offline</span>
                <button class="refresh-btn" onclick="loadAuditLog()">🔄 Refresh</button>
            </h1>
            
            <h2>📝 Send Message to Main Chat</h2>
            <div class="message-form">
                <div class="input-group">
                    <label for="messageText">Message</label>
                    <textarea id="messageText" placeholder="Type your message here..."></textarea>
                </div>
                <button onclick="sendMessage()">Send to Main Chat</button>
                <div id="messageAlert" class="hidden"></div>
            </div>
            
            <h2>📋 Audit Log
                <button class="refresh-btn" onclick="loadAuditLog()">🔄 Refresh</button>
            </h2>
            <div id="auditLog" class="audit-log">
                <div class="loading">Loading audit log...</div>
            </div>
        </div>
    </div>
    
    <script>
        let dashboardPassword = '';
        
        function login() {
            const password = document.getElementById('password').value;
            if (!password) {
                showLoginError('Please enter a password');
                return;
            }
            
            dashboardPassword = password;
            
            // Test password by loading audit log
            loadAuditLog().then(success => {
                if (success) {
                    document.getElementById('loginBox').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                } else {
                    showLoginError('Invalid password');
                }
            });
        }
        
        function showLoginError(message) {
            const errorDiv = document.getElementById('loginError');
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
        
        async function loadAuditLog() {
            try {
                const response = await fetch('/api/audit-log?password=' + encodeURIComponent(dashboardPassword));
                
                if (!response.ok) {
                    if (response.status === 401) {
                        return false;
                    }
                    throw new Error('Failed to load audit log');
                }
                
                const data = await response.json();
                
                // Update status badge
                const statusBadge = document.getElementById('statusBadge');
                if (data.botStatus === 'online') {
                    statusBadge.textContent = 'Online: ' + data.botTag;
                    statusBadge.className = 'status-badge status-online';
                } else {
                    statusBadge.textContent = 'Offline';
                    statusBadge.className = 'status-badge status-offline';
                }
                
                // Render audit log
                const auditLogDiv = document.getElementById('auditLog');
                if (data.logs.length === 0) {
                    auditLogDiv.innerHTML = '<div style="text-align: center; color: #999;">No audit entries yet</div>';
                } else {
                    auditLogDiv.innerHTML = data.logs.map(entry => {
                        const entryClass = entry.action.includes('ADDRESS') ? 'address' : 
                                         entry.action.includes('TICKET') ? 'ticket' :
                                         entry.action.includes('MESSAGE') ? 'message' : '';
                        
                        const timestamp = new Date(entry.timestamp).toLocaleString();
                        
                        return \`
                            <div class="audit-entry \${entryClass}">
                                <div class="audit-timestamp">\${timestamp}</div>
                                <div class="audit-action">\${entry.action} - \${entry.user}</div>
                                <div class="audit-details">\${entry.details}</div>
                            </div>
                        \`;
                    }).join('');
                }
                
                return true;
            } catch (error) {
                console.error('Error loading audit log:', error);
                return false;
            }
        }
        
        async function sendMessage() {
            const messageText = document.getElementById('messageText').value;
            if (!messageText.trim()) {
                showMessageAlert('Please enter a message', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        password: dashboardPassword,
                        message: messageText
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showMessageAlert('✅ Message sent successfully!', 'success');
                    document.getElementById('messageText').value = '';
                    setTimeout(() => loadAuditLog(), 500); // Refresh audit log
                } else {
                    showMessageAlert('❌ ' + data.error, 'error');
                }
            } catch (error) {
                showMessageAlert('❌ Error: ' + error.message, 'error');
            }
        }
        
        function showMessageAlert(message, type) {
            const alertDiv = document.getElementById('messageAlert');
            alertDiv.textContent = message;
            alertDiv.className = 'alert alert-' + type;
            alertDiv.classList.remove('hidden');
            
            setTimeout(() => {
                alertDiv.classList.add('hidden');
            }, 5000);
        }
        
        // Auto-refresh audit log every 10 seconds if dashboard is visible
        setInterval(() => {
            if (!document.getElementById('dashboard').classList.contains('hidden')) {
                loadAuditLog();
            }
        }, 10000);
        
        // Allow Enter key to login
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    </script>
</body>
</html>`;
}

// Login
const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_BOT_TOKEN_HERE';
client.login(TOKEN);
