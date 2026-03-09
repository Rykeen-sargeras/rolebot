const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// --- 1. SETUP DISCORD BOT ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds] // We only need Guilds to manage roles
});

// --- 2. SETUP WEB SERVER & WEBSOCKETS ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// The specific permissions we want to manage easily on the dashboard
const MANAGEABLE_PERMISSIONS = [
    { name: 'Administrator', flag: 'Administrator' },
    { name: 'Manage Server', flag: 'ManageGuild' },
    { name: 'Manage Roles', flag: 'ManageRoles' },
    { name: 'Send Messages', flag: 'SendMessages' }
];

// --- 3. SERVE THE DASHBOARD ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Live Role Manager</title>
        <script src="/socket.io/socket.io.js"></script>
        <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #1e1e2e; color: #cdd6f4; padding: 2rem; }
            h1 { color: #89b4fa; }
            .role-card { background: #313244; padding: 1.5rem; margin-bottom: 1rem; border-radius: 8px; border-left: 6px solid #89b4fa; }
            .perm-toggle { display: flex; justify-content: space-between; margin: 8px 0; background: #181825; padding: 10px; border-radius: 6px; }
            button.toggle-btn { background: #45475a; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
            button.toggle-btn.on { background: #a6e3a1; color: #11111b; font-weight: bold; }
            button.toggle-btn.off { background: #f38ba8; color: #11111b; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>🛡️ Live Role Manager</h1>
        <p>Changes made here happen instantly in Discord.</p>
        <div id="roles-container">Loading server data...</div>

        <script>
            const socket = io();
            const container = document.getElementById('roles-container');

            // Listen for role data from the bot
            socket.on('load_roles', (roles) => {
                container.innerHTML = ''; // Clear loading text
                
                roles.forEach(role => {
                    let permsHtml = '';
                    role.permissions.forEach(perm => {
                        const isOn = perm.has;
                        const btnClass = isOn ? 'on' : 'off';
                        const btnText = isOn ? 'ENABLED' : 'DISABLED';
                        
                        permsHtml += \`
                            <div class="perm-toggle">
                                <span>\${perm.name}</span>
                                <button class="toggle-btn \${btnClass}" onclick="togglePerm('\${role.id}', '\${perm.flag}', \${!isOn})">\${btnText}</button>
                            </div>
                        \`;
                    });

                    container.innerHTML += \`
                        <div class="role-card" style="border-left-color: \${role.color}">
                            <h3>\${role.name}</h3>
                            \${permsHtml}
                        </div>
                    \`;
                });
            });

            // Send toggle request to bot
            function togglePerm(roleId, permFlag, newState) {
                socket.emit('toggle_permission', { roleId, permFlag, newState });
            }

            // Listen for errors
            socket.on('error_msg', (msg) => alert('Error: ' + msg));
        </script>
    </body>
    </html>
    `);
});

// --- 4. HANDLE REAL-TIME COMMUNICATION ---
io.on('connection', async (socket) => {
    console.log('💻 A user connected to the web dashboard.');

    // Fetch roles and send to the webpage
    const sendRolesToWeb = async () => {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const roles = await guild.roles.fetch();
        const sortedRoles = Array.from(roles.values())
            .filter(r => r.id !== guild.id) // Exclude @everyone to prevent accidental lockouts
            .sort((a, b) => b.position - a.position);

        const roleData = sortedRoles.map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            // Check which permissions this role currently has
            permissions: MANAGEABLE_PERMISSIONS.map(p => ({
                name: p.name,
                flag: p.flag,
                has: role.permissions.has(PermissionsBitField.Flags[p.flag])
            }))
        }));

        socket.emit('load_roles', roleData);
    };

    // Send initial data when someone opens the page
    if (client.isReady()) {
        await sendRolesToWeb();
    }

    // Listen for the user clicking a toggle on the webpage
    socket.on('toggle_permission', async (data) => {
        try {
            const guild = client.guilds.cache.first();
            const role = await guild.roles.fetch(data.roleId);
            
            if (!role) return socket.emit('error_msg', 'Role not found.');

            // Calculate new permissions
            let newPerms = new PermissionsBitField(role.permissions);
            if (data.newState === true) {
                newPerms.add(PermissionsBitField.Flags[data.permFlag]);
            } else {
                newPerms.remove(PermissionsBitField.Flags[data.permFlag]);
            }

            // Update Discord
            await role.setPermissions(newPerms);
            console.log(\`✅ Updated \${role.name}: Set \${data.permFlag} to \${data.newState}\`);

            // Broadcast the updated roles back to the webpage so the UI refreshes instantly
            await sendRolesToWeb();

        } catch (error) {
            console.error(error);
            socket.emit('error_msg', 'Bot lacks permission to change this role. Make sure the Bot role is higher in the list than the role you are editing!');
        }
    });
});

// --- 5. START UP ---
client.on('ready', () => {
    console.log(\`🤖 Discord Bot connected as \${client.user.tag}\`);
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(\`🌐 Web Dashboard live on port \${PORT}\`);
    });
});

// Log in
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("❌ ERROR: Missing DISCORD_TOKEN");
    process.exit(1);
}
client.login(TOKEN);