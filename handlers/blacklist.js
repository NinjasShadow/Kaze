//import the config.json file
const config = require(`${process.cwd()}/botconfig/config.json`)
var ee = require(`${process.cwd()}/botconfig/embed.json`);
var emoji = require(`${process.cwd()}/botconfig/emojis.json`);
const ms = require("ms");
var {
    MessageEmbed, Permissions
} = require(`discord.js`);
const { dbEnsure, dbKeys, dbRemove, delay } = require("./functions")
const countermap = new Map();
module.exports = async (client) => {
    module.exports.messageCreate = async (client, message, guild_settings) => {
        Blacklist(client, message, guild_settings);
    }
    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.guild.available === false || !newMessage.channel || newMessage.author?.bot) return;
        let guild_settings = await client.settings.get(newMessage.guild.id);
        Blacklist(client, newMessage, guild_settings)
    })
    async function Blacklist(client, message, guild_settings) {
        try{
            if (!message.guild || message.guild.available === false || message.author?.bot) return;

            // Define the Settings
            let theSettings = guild_settings;
            let blacklist = await client.blacklist.get(message.guild.id);
            //if one of the settings isn't available, ensure and re-get it!
            if(!blacklist) {
                await dbEnsure(client.blacklist, message.guild.id, {
                    words: [],
                    mute_amount: 5,
                    whitelistedchannels: [],
                })
                blacklist = {
                    words: [],
                    mute_amount: 5,
                    whitelistedchannels: [],
                }
            }
            //if one of the settings isn't available, ensure and re-get it!
            if (!theSettings || !theSettings.warnsettings || !theSettings.embed || !theSettings.language || !theSettings.adminroles || !theSettings.autowarn) {
                if (!theSettings || !theSettings.autowarn) {
                    await dbEnsure(client.settings, message.guild.id, {
                        autowarn: {
                            antispam: false,
                            antiselfbot: false,
                            antimention: false,
                            antilinks: false,
                            antidiscord: false,
                            anticaps: false,
                            blacklist: false,
                            ghost_ping_detector: false,
                        }
                    })
                }
                if (!theSettings || !theSettings.warnsettings) {
                    await dbEnsure(client.settings, message.guild.id, {
                        warnsettings: {
                            ban: false,
                            kick: false,
                            roles: [
                                /*
                                { warncount: 0, roleid: "1212031723081723"}
                                */
                            ]
                        }
                    })
                }
                if (!theSettings || !theSettings.adminroles) {
                    await dbEnsure(client.settings, message.guild.id, {
                        adminroles: [],
                    });
                }
                if (!theSettings || !theSettings.language) {
                    await dbEnsure(client.settings, message.guild.id, {
                        language: "en"
                    });
                }
                if (!theSettings || !theSettings.embed) {
                    await dbEnsure(client.settings, message.guild.id, {
                        embed: ee
                    });
                }
                theSettings = await client.settings.get(message.guild.id);
            }
            //get the constant variables
            let adminroles = theSettings.adminroles
            let ls = theSettings.language
            let es = theSettings.embed;
            let autowarn = theSettings.autowarn;
            let mute_amount = blacklist?.mute_amount
            let blacklistwords = blacklist.words;
            let member = message.member
            let warnsettings = theSettings.warnsettings

            // If it's an admin user
            if (((adminroles && adminroles.length > 0) && [...message.member.roles.cache.values()].length > 0 && message.member.roles.cache?.some(r => adminroles?.includes(r ? r.id : r))) || message.guild.ownerId == message.author?.id || message.member?.permissions?.has("ADMINISTRATOR")) return;
            // if It's a whitelisted Channel
            if (blacklist.whitelistedchannels?.some(r => message.channel.parentId == r || message.channel.id == r)) return

            try {
                for await (const blacklistword of blacklistwords){
                    if (message.content.toLowerCase().includes(blacklistword)) {
                        if(autowarn.blacklist){
                            await dbEnsure(client.userProfiles, message.author?.id, {
                                id: message.author?.id,
                                guild: message.guild.id,
                                totalActions: 0,
                                warnings: [],
                                kicks: []
                            });
                            const newActionId = await client.modActions.stats().then(d => client.getUniqueID(d.count));
                            await client.modActions.set(newActionId, {
                                user: message.author?.id,
                                guild: message.guild.id,
                                type: 'warning',
                                moderator: message.author?.id,
                                reason: "Blacklist Autowarn",
                                when: new Date().toLocaleString(`de`),
                                oldhighesrole: message.member.roles ? message.member.roles.highest : `Had No Roles`,
                                oldthumburl: message.author.displayAvatarURL({
                                    dynamic: true
                                })
                            });
                            // Push the action to the user's warnings
                            await client.userProfiles.push(message.author?.id+'.warnings', newActionId);
                            await client.userProfiles.add(message.author?.id+'.totalActions', 1);
                            await client.stats.push(message.guild.id+message.author?.id+".warn", new Date().getTime()); 
                            const warnIDs = await client.userProfiles.get(message.author?.id+'.warnings')
                            const modActions = await client.modActions.all();
                            const warnData = warnIDs.map(id => modActions.find(d => d.ID == id)?.data);
                            let warnings = warnData.filter(v => v.guild == message.guild.id);
                                message.channel.send({
                                    embeds: [
                                        new MessageEmbed().setAuthor(client.getAuthor(message.author.tag, message.member.displayAvatarURL({dynamic: true})))
                                        .setColor("ORANGE").setFooter(client.getFooter("ID: "+ message.author?.id, message.author.displayAvatarURL({dynamic:true})))
                                        .setDescription(`> <@${message.author?.id}> **received an autogenerated Warn - \`blacklist\`**!\n\n> **He now has \`${warnings.length} Warnings\`**`)
                                    ]
                                });
                                let warnsettings = guild_settings.warnsettings
                                if(warnsettings.kick && warnsettings.kick == warnings.length){
                                if (!message.member.kickable)
                                    message.channel.send({embeds :[new MessageEmbed()
                                    .setColor(es.wrongcolor)
                                    .setFooter(client.getFooter(es))
                                    .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable8"]))
                                    ]});
                                else {
                                    try{
                                        message.member.send({embeds : [new MessageEmbed()
                                            .setColor(es.color).setThumbnail(es.thumb ? es.footericon && (es.footericon.includes("http://") || es.footericon.includes("https://")) ? es.footericon : client.user.displayAvatarURL() : null)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable9"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable10"]))
                                        ]});
                                    } catch{
                                        return message.channel.send({embeds :[new MessageEmbed()
                                            .setColor(es.wrongcolor)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable11"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable12"]))
                                        ]});
                                    }
                                    try {
                                        message.member.kick({
                                            reason: `Reached ${warnings.length} Warnings`
                                        }).then(async () => {
                                            message.channel.send({embeds :[new MessageEmbed()
                                            .setColor(es.color).setThumbnail(es.thumb ? es.footericon && (es.footericon.includes("http://") || es.footericon.includes("https://")) ? es.footericon : client.user.displayAvatarURL() : null)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable13"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable14"]))
                                            ]});
                                        });
                                    } catch (e) {
                                        console.error(e);
                                        message.channel.send({embeds : [new MessageEmbed()
                                            .setColor(es.wrongcolor)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(client.la[ls].common.erroroccur)
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable15"]))
                                        ]});
                                    }
                                }
                                }
                                if(warnsettings.ban && warnsettings.ban == warnings.length){
                                    if (!message.member.bannable)
                                        message.channel.send({embeds : [new MessageEmbed()
                                    .setColor(es.wrongcolor)
                                    .setFooter(client.getFooter(es))
                                    .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable16"]))
                                    ]});
                                else {
                                    try{
                                        message.member.send({embeds :[new MessageEmbed()
                                            .setColor(es.color).setThumbnail(es.thumb ? es.footericon && (es.footericon.includes("http://") || es.footericon.includes("https://")) ? es.footericon : client.user.displayAvatarURL() : null)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable17"]))
                                        ]});
                                    } catch {
                                        message.channel.send({embeds :[new MessageEmbed()
                                            .setColor(es.wrongcolor)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable18"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable19"]))
                                        ]});
                                    }
                                    try {
                                        message.member.ban({
                                            reason: `Reached ${warnings.length} Warnings`
                                        }).then(async () => {
                                            message.channel.send({embeds :[new MessageEmbed()
                                            .setColor(es.color).setThumbnail(es.thumb ? es.footericon && (es.footericon.includes("http://") || es.footericon.includes("https://")) ? es.footericon : client.user.displayAvatarURL() : null)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable20"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable21"]))
                                            ]});
                                        });
                                    } catch (e) {
                                        console.error(e);
                                        message.channel.send({embeds :[new MessageEmbed()
                                            .setColor(es.wrongcolor)
                                            .setFooter(client.getFooter(es))
                                            .setTitle(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable22"]))
                                            .setDescription(eval(client.la[ls]["cmds"]["administration"]["warn"]["variable23"]))
                                        ]});
                                    }}
                                }
                                for await (const role of warnsettings.roles){
                                    if(role.warncount == warnings.length){
                                        if(!message.member.roles.cache.has(role.roleid)){
                                        message.member.roles.add(role.roleid).catch(() => null)
                                        }
                                    }
                                }
                        }
                        await message.delete().catch(() => null)

                        if (!countermap.get(message.author?.id)) countermap.set(message.author?.id, 1)
                        setTimeout(() => {
                            countermap.set(message.author?.id, Number(countermap.get(message.author?.id)) - 1)
                            if (Number(countermap.get(message.author?.id)) < 0) countermap.set(message.author?.id, 1)
                        }, 15000)
                        countermap.set(message.author?.id, Number(countermap.get(message.author?.id)) + 1)



                        if (Number(countermap.get(message.author?.id)) > mute_amount) {
                            let member = message.member
                            let time = 10 * 60 * 1000; let mutetime = time;
                            let reason = "Sending 1 or more Blacklisted Word(s)";
                            
                            member.timeout(mutetime, reason).then(async () => {  
                                message.channel.send({embeds: [new MessageEmbed()
                                    .setColor(es.color).setThumbnail(es.thumb ? es.footericon && (es.footericon.includes("http://") || es.footericon.includes("https://")) ? es.footericon : client.user.displayAvatarURL() : null)
                                    .setFooter(client.getFooter(es))
                                    .setTitle(eval(client.la[ls]["handlers"]["blacklistjs"]["blacklist"]["variable1"]).replace("MUTED", "TIMEOUTED"))
                                    .setDescription(eval(client.la[ls]["handlers"]["blacklistjs"]["blacklist"]["variable2"]))
                                ]}).catch(() => null);
                            }).catch(() => {
                                return message.channel.send(`**I could not timeout ${member.user.tag}**`).then(m => {
                                    setTimeout(() => { m.delete().catch(() => null) }, 5000);
                                });
                            });
                            
                            countermap.set(message.author?.id, 1)
                        }
                        else {
                            return message.channel.send({embeds: [new MessageEmbed()
                                .setColor(es.wrongcolor)
                                .setFooter(client.getFooter(es))
                                .setTitle(eval(client.la[ls]["handlers"]["blacklistjs"]["blacklist"]["variable5"]))
                            ]}).then(msg => {setTimeout(()=>{msg.delete().catch(() => null)}, 3000)}).catch(() => null)
                        }
                    } else {
                        // Do nothing ;)
                    }
                }

            } catch (e) {
                // console.log(String(e.stack).grey.bgRed)
                return message.channel.send({embeds: [new MessageEmbed()
                    .setColor(es.wrongcolor)
                    .setFooter(client.getFooter(es))
                    .setTitle(client.la[ls].common.erroroccur)
                    .setDescription(eval(client.la[ls]["handlers"]["blacklistjs"]["blacklist"]["variable6"]))
                ]}).catch(() => null);
            }
        }catch(e){console.log(String(e).grey)}
    }

}