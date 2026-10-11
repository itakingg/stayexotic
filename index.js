require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Menyimpan koneksi terpisah untuk tiap Guild/Server
const activeConnections = new Map();

async function joinAndStay(voiceChannel, textChannel) {
  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    activeConnections.set(voiceChannel.guild.id, connection);

    if (textChannel) {
      textChannel.send(
        `✅ Berhasil masuk dan stay di voice channel: **${voiceChannel.name}**`,
      );
    }

    // Auto-reconnect per server
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(
        `⚠️ Koneksi terputus di [${voiceChannel.guild.name}] - ${voiceChannel.name}`,
      );
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        console.error(
          `❌ Reconnect gagal di ${voiceChannel.guild.name}, mencoba ulang...`,
        );
        connection.destroy();
        setTimeout(() => joinAndStay(voiceChannel, null), 5000);
      }
    });
  } catch (error) {
    console.error("❌ Gagal masuk ke Voice Channel:", error);
    if (textChannel) textChannel.send("❌ Gagal masuk ke voice channel!");
  }
}

client.once("ready", () => {
  console.log(`🤖 Bot aktif & global sebagai: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === "!stay") {
    const voiceChannel = message.member?.voice.channel;

    if (!voiceChannel) {
      return message.reply(
        "❌ Kamu harus masuk ke voice channel terlebih dahulu!",
      );
    }

    joinAndStay(voiceChannel, message.channel);
  }

  if (message.content === "!leave") {
    const connection = activeConnections.get(message.guild.id);
    if (connection) {
      connection.destroy();
      activeConnections.delete(message.guild.id);
      message.reply("👋 Bot telah keluar dari voice channel.");
    } else {
      message.reply(
        "❌ Bot sedang tidak berada di voice channel di server ini.",
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
