const { Client, MessageEmbed, Interaction, MessageButton, MessageActionRow } = require('discord.js');
const db = require('quick.db');
const { colors, fromIntToDate } = require('discord-toolbox');
const config = require('../../config.json');
const moment = require('moment');

/**
 * @param {Client} client 
 * @param {Interaction} interaction 
 */
module.exports = async (client, interaction) => {
    if(!interaction.isButton()) return;
    if(interaction.customID.startsWith("invited-history") && interaction.customID.split("_")[2] == interaction.user.id) {
        const member = interaction.guild.members.cache.get(interaction.customID.split("_")[1]);
        const author = interaction.user;
        if(!member) return interaction.update({ content: "Le membre a quitté le serveur.", embeds: [], components: [] });

        let users = Object.values(db.get(`users`)).filter(u => u.joins?.map(j => j.by).includes(member.user.id));
        let invites = [];
        users.forEach((u) => {
            u.joins
            .filter(j => j.by == member.user.id)
            .forEach(j => {
                Object.assign(j, { id: u.id });
                invites.push(j);
            })
        });

        let backButton = new MessageButton()
            .setCustomID(`info_${member.user.id}_${interaction.customID.split("_")[2]}`)
            .setStyle("SECONDARY")
            .setLabel("Retour aux informations du membre")
        let backButtonActionRaw = new MessageActionRow()
            .addComponents([backButton])

        let pages = [];
        let page = [];
        invites.sort((a,b) => b.at - a.at);
        let updatedUserIDs = [];
        var definitiveInvites = [];
        invites.forEach(j => {
            let userDB = db.get(`users.${j.id}`)
            if(interaction.guild.members.cache.has(j.id)) {
                var left = false;
                if(userDB.joins[userDB.joins.length-1].by !== member.user.id) var fake = true;
                else if(updatedUserIDs.includes(j.by)) var fake = true;
                else var fake = false;
                updatedUserIDs.push(j.by);
            } else { var fake = false; var left = true; };
            definitiveInvites.push({
                at: j.at,
                by: j.by,
                inviteCode: j.inviteCode,
                id: j.id,
                fake: fake,
                left: left
            })
        });
        definitiveInvites.forEach(j => {
            page.push(j);
            if(page.length >= 20) {
                let pageEmbed = new MessageEmbed()
                    .setColor(colors.blue)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        page.filter(j => client.users.cache.has(j.id))
                        .map((join) => {
                            let user = client.users.cache.get(join.id);
                            return `${join.left ? "❌" : join.fake ? "💩" : "✅"} ${user.toString()} - **${join.inviteCode}** - il y a **${fromIntToDate(Date.now() +7200000 - join.at)}**`
                        }).join("\n") || "❌ **Aucun**"
                    ).setFooter(`Demandé par: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
                pages.push(pageEmbed);
                page = [];
            };
        }); if(page.length > 0) {
            let pageEmbed = new MessageEmbed()
                .setColor(colors.blue)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setDescription(
                    page.filter(j => client.users.cache.has(j.id))
                    .map((join) => {
                        let user = client.users.cache.get(join.id);
                        return `${join.left ? "❌" : join.fake ? "💩" : "✅"} ${user.toString()} - **${join.inviteCode}** - il y a **${fromIntToDate(Date.now() +7200000 - join.at)}**`
                    }).join("\n") || "❌ **Aucun**"
                ).setFooter(`Demandé par: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
            pages.push(pageEmbed);
        };

        if(definitiveInvites.length == 0) {
            pages.push(
                new MessageEmbed()
                    .setColor(colors.red)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        `❌ - ${member.user.toString()} **n'a invité aucun membre.**`
                    ).setFooter(author.tag, author.displayAvatarURL({ format: "png" }))
            )
        }

        interaction.update({ embeds: pages, components: [backButtonActionRaw] });
        await interaction.message.react("👍");
    } else if(interaction.customID.startsWith("info") && interaction.customID.split("_")[2] == interaction.user.id) {
        const author = interaction.user;
        const member = interaction.guild.members.cache.get(interaction.customID.split("_")[1]);
        if(!member) return interaction.update({ content: "Le membre a quitté le serveur.", embeds: [], components: [] });

        if(!db.has(`users.${member.user.id}`)) {
            db.set(`users.${member.user.id}`, {
                id: member.user.id,
                joins: [{
                    at: member.joinedAt.setHours(member.joinedAt.getHours() +1),
                    by: undefined,
                    inviteCode: undefined
                }],
                invites: {
                    normal: 0,
                    left: 0,
                    fake: 0,
                    bonus: 0
                }
            })
        }; let user = db.get(`users.${member.user.id}`);

        let regularInvites = `${member.user.id == interaction.customID.split("_")[2] ? "**Vous** avez" : member.user.toString() + " a"} **${Object.values(user.invites).reduce((x,y)=>x+y)}** invitations.\n\n` +
            `✅ \`\`${user.invites.normal}\`\` **Invités**\n` +
            `❌ \`\`${user.invites.left}\`\` **Partis**\n` +
            `💩 \`\`${user.invites.fake}\`\` **Invalidés**\n` +
            `✨ \`\`${user.invites.bonus}\`\` **Bonus**`;

        let rank = Object.values(db.get("users"))
            .sort((a,b) => Object.values(b.invites).reduce((x,y)=>x+y) - Object.values(a.invites).reduce((x,y)=>x+y))
        
        let embed = new MessageEmbed()
            .setColor(colors.blue)
            .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
            .addField(
                "__Invité par__",
                user.joins.length ? user.joins[user.joins.length-1].by == "vanity" ? "URL personnalisée" : user.joins[user.joins.length-1].by ? (client.users.cache.get(user.joins[user.joins.length-1].by) || await client.users.fetch(user.joins[user.joins.length-1].by)).toString() : "❌ **Introuvable**" : "❌ **Introuvable**",
                true
            ).addField("\u200b", "\u200b", true)
            .addField(
                "__Rejoint le__",
                moment.utc(member.joinedAt.setHours(member.joinedAt.getHours() +2)).format("DD/MM/YYYY à HH:mm:ss") + "\n" +
                `(il y a **${fromIntToDate(Date.now() - member.joinedTimestamp, "fr")}**)`,
                true
            ).addField(
                "__Invitations régulières__",
                regularInvites
            ).addField(
                "__Invitations actives__",
                (await interaction.guild.fetchInvites()).filter(i => i.inviter.id == member.user.id)
                .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
                .array().slice(0, 10)
                .map(i => {
                    return `**${i.code}** - ${i.channel.toString()} - il y a **${fromIntToDate(Date.now() - i.createdTimestamp, "fr")}**`
                }).join("\n") || "❌ **Aucune**"
            ).addField(
                "__Derniers membres invités__",
                interaction.guild.members.cache.filter(m => db.has(`users.${m.user.id}`) && db.get(`users.${m.user.id}`).joins.length && db.get(`users.${m.user.id}`).joins[db.get(`users.${m.user.id}`).joins.length-1].by == member.user.id)
                .sort((a,b) => b.joinedTimestamp - a.joinedTimestamp)
                .array().slice(0, 10)
                .map(m => {
                    let u = db.get(`users.${m.user.id}`);
                    return `${m.user.toString()} - **${u.joins[u.joins.length-1].inviteCode}** - il y a **${fromIntToDate(Date.now() - (u.joins[u.joins.length-1].at -7200000))}**`
                }).join("\n") || "❌ **Aucun**"
            ).setFooter(`Demandé par: ${author.tag}`)

        let invitedHistory = new MessageButton()
            .setCustomID(`invited-history_${member.user.id}_${author.id}`)
            .setStyle("SECONDARY")
            .setLabel("Voir l'historique des membres invités")

        let invitesHistory = new MessageButton()
            .setCustomID(`invites-list_${member.user.id}_${author.id}`)
            .setStyle("SECONDARY")
            .setLabel("Voir l'historique des invitations")
        
        let invitedHistoryActionRaw = new MessageActionRow()
            .addComponents([invitedHistory, invitesHistory])

        interaction.update({ embeds: [embed], components: [invitedHistoryActionRaw] });
    } else if(interaction.customID.startsWith("invites-list") && interaction.user.id == interaction.customID.split("_")[2]) {
        const author = interaction.user;
        const member = interaction.guild.members.cache.get(interaction.customID.split("_")[1]);
        if(!member) return interaction.update({ content: "Le membre a quitté le serveur.", embeds: [], components: [] });

        let invitesArray = (await interaction.guild.fetchInvites())
            .filter(i => i.inviter.id == member.user.id)
            .sort((a,b) => b.createdTimestamp - a.createdTimestamp)
            .array()
            .map(i => {
                return `**${i.code}** - ${i.channel.toString()} - il y a **${fromIntToDate(Date.now() - i.createdTimestamp, "fr")}**`
            });
        let pages = [];
        let page = [];
        invitesArray.forEach(i => {
            page.push(i);
            if(page.length > 30) {
                pages.push(page);
                page = [];
            }
        });
        if(page.length > 0) {
            let pageEmbed = new MessageEmbed()
                .setColor(colors.blue)
                .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                .setFooter(`Demandé par: ${author.tag}`, author.displayAvatarURL({ format: "png" }))
                .setDescription(
                    page.join("\n")
                )
            pages.push(pageEmbed);
        };
        if(pages.length == 0) {
            pages.push(
                new MessageEmbed()
                    .setColor(colors.red)
                    .setAuthor(member.user.tag, member.user.displayAvatarURL({ format: "png" }))
                    .setDescription(
                        `❌ - ${member.user.toString()} **n'a aucune invitation.**`
                    ).setFooter(author.tag, author.displayAvatarURL({ format: "png" }))
            )
        };
        console.log("page", page);
        console.log("pages", pages);
        
        let backButton = new MessageButton()
            .setCustomID(`info_${member.user.id}_${interaction.customID.split("_")[2]}`)
            .setStyle("SECONDARY")
            .setLabel("Retour aux informations du membre")
        let backButtonActionRaw = new MessageActionRow()
            .addComponents([backButton])

        interaction.update({ embeds: pages, components: [backButtonActionRaw] })
    }
};