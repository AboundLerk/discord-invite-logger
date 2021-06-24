const { Client } = require('discord.js');
const db = require('quick.db');

/**
 * 
 * @param {Client} client 
 */
module.exports = async (client) => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    let guildInvites = (await client.guilds.cache.get(require('../../config.json').serverID).fetchInvites());
    guildInvites
        .array()
        .forEach(i => {
            db.set(`invites.${i.code}`, {
                inviterId: i.inviter?.id,
                code: i.code,
                uses: i.uses
            });
        });
    Object.values(db.get("invites"))
        .filter(i => !guildInvites.has(i.code))
        .forEach(i => db.delete(`invites.${i.code}`))
}