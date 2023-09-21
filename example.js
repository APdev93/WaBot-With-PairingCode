/*
  A. dependencies:
  
  1. node-cache
  2. readline
  3.@whiskeysockets/baileys: v6.4.0^
  
  B. Import this module from @whiskeysockets/baileys
  1. makeCacheableSignalKeyStore
  2. PHONENUMBER_MCC
  
*/

require("./seting");
const sessionName = "session";
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidDecode,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  getContentType,
  PHONENUMBER_MCC,
  getAggregateVotesInPollMessage,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
const chalk = require("chalk");
const { say } = require("cfonts");
const NodeCache = require("node-cache");
const readline = require("readline");

//experiment
const usePairingCode = true;
const useMobile = false;
const useStore = false;

const MAIN_LOGGER = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` });


const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const store = useStore ? makeInMemoryStore({ logger }) : undefined;
store?.readFromFile("./session");

// Save every 1m
setInterval(() => {
  store?.writeToFile("./session");
}, 10000 * 6);

const msgRetryCounterCache = new NodeCache();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const P = require("pino")({
  level: "silent",
});
const stores = makeInMemoryStore({

  logger: pino().child({ level: "silent", stream: "store" }),

});
const {
  smsg,
  await,
  sleep,
  getBuffer,
} = require("./function");

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

async function startdian() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionName);
  let { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(chalk.redBright(`using WA v${version.join(".")}, isLatest: ${isLatest}`));
  const dian = makeWASocket({
      version,
      logger: P,
      printQRInTerminal: !usePairingCode,
      mobile: useMobile,
      browser: ["chrome (linux)", "", ""],
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, P),
      },
      msgRetryCounterCache,
    getMessage: async (key) => {
      if(store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg.message || undefined;
      }
    },
  });

  store?.bind(dian.ev);
  
     if (usePairingCode && !dian.authState.creds.registered) {
      if (useMobile) {
         throw new Error("Cannot use pairing code with mobile api");
      }

      const phoneNumber = await question(
         "Please enter your mobile phone number:\n"
      );
      const code = await dian.requestPairingCode(phoneNumber);
      console.log(`Pairing code: ${code}`);
   }

  
  
  
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function(err) {
    console.log("Caught exception: ", err);
  });
  dian.autosw = true;
  dian.sendsw = `${owner}@s.whatsapp.net`;
  dian.serializeM = (m) => smsg(dian, m, store);
  dian.ev.on('connection.update', async (update) => {
    
    const {
      connection,
      lastDisconnect,
      qr
    } = update
    if(lastDisconnect == 'undefined') {
      askForOTP()
      /*qrcode.generate(qr, {
        small: true
      })*/
    }
    if(connection === 'connecting') {
      console.log(chalk.blue("Menghubungkan...."))
      console.log("[pterodactyl] running")
    } else if(connection === 'open') {
      console.log(chalk.green(`Terhubung Ke WhatsApp Menggunakan WaSocket..`))
      dian.sendMessage(dian.sendsw, {
        text: `*Koneksi Terhubung Menggunakan WaSocket*`,
      });
    } else if(connection === 'close') {
      if(lastDisconnect.error.output.statusCode == DisconnectReason.loggedOut) {
        console.log(chalk.redBright("Tidak Bisa Terhubung"))
        dian.sendMessage(dian.sendsw, {
          text: `*Koneksi Terputus*`,
        });
        process.exit(0)
      } else {
        startdian().catch(() => startdian())
      }
    }
  })

  dian.ev.on("creds.update", saveCreds);
  dian.downloadAndSaveMediaMessage = async (
    message,
    filename,
    attachExtension = true
  ) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || "";
    let messageType = message.mtype
      ? message.mtype.replace(/Message/gi, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    let type = await FileType.fromBuffer(buffer);
    let trueFileName = attachExtension ? filename + "." + type.ext : filename;
    // save to file
    await fs.writeFileSync(trueFileName, buffer);
    return trueFileName;
  };

  dian.decodeJid = (jid) => {
    if(!jid) return jid;
    if(/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (
        (decode.user && decode.server && decode.user + "@" + decode.server) ||
        jid
      );
    } else return jid;
  };
  dian.sendImg = async (jid, path, caption = "", quoted = "", options) => {
    let buffer = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`,`[1], "base64")
        : /^https?:\/\//.test(path)
          ? await await getBuffer(path)
          : fs.existsSync(path)
            ? fs.readFileSync(path)
            : Buffer.alloc(0);
    return await dian.sendMessage(
      jid,
      { image: buffer, caption: caption, ...options },
      { quoted }
    );
  };
  dian.getName = (jid, withoutContact = false) => {
    id = dian.decodeJid(jid);
    withoutContact = dian.withoutContact || withoutContact;
    let v;
    if(id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = stores.contacts[id] || {};
        if(!(v.name || v.subject)) v = dian.groupMetadata(id) || {};
        resolve(
          v.name ||
          v.subject ||
          PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber(
            "international"
          )
        );
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
            id,
            name: "WhatsApp",
          }
          : id === dian.decodeJid(dian.user.id)
            ? dian.user
            : store.contacts[id] || {};
    return (
      (withoutContact ? "" : v.name) ||
      v.subject ||
      v.verifiedName ||
      PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
        "international"
      )
    );
  };
  dian.sendText = (jid, text, quoted = "", options) =>
    dian.sendMessage(jid, { text: text, ...options }, { quoted });


  async function getMessage(key) {
    if(store) {
      const msg = await store.loadMessage(key.remoteJid, key.id)
      return msg?.message
    }
    return {
      conversation: "Hai Im There"
    }
  }
  dian.ev.on('messages.update', async chatUpdate => {
    for(const { key, update } of chatUpdate) {
      if(update.pollUpdates && key.fromMe) {
        const pollCreation = await getMessage(key)
        if(pollCreation) {
          const pollUpdate = await getAggregateVotesInPollMessage({
            message: pollCreation,
            pollUpdates: update.pollUpdates,
          })
          var toCmd = pollUpdate.filter(v => v.voters.length !== 0)[0]?.name
          if(toCmd == undefined) return
          var prefCmd = toCmd
          dian.appenTextMessage(prefCmd, chatUpdate)
        }
      }
    }
  })
  dian.sendPoll = (jid, name = '', values = [], selectableCount = 1) => {
    return dian.sendMessage(jid, { poll: { name, values, selectableCount } })
  }
  dian.ev.on('messages.update', async chatUpdate => {
    for(const { key, update } of chatUpdate) {
      if(update.pollUpdates && key.fromMe) {
        const pollCreation = await getMessage(key)
        if(pollCreation) {
          const pollUpdate = await getAggregateVotesInPollMessage({
            message: pollCreation,
            pollUpdates: update.pollUpdates,
          })
          var toCmd = pollUpdate.filter(v => v.voters.length !== 0)[0]?.name
          if(toCmd == undefined) return
          var prefCmd = toCmd
          dian.appenTextMessage(prefCmd, chatUpdate)
        }
      }
    }
  })
  dian.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      mek = chatUpdate.messages[0];
      if(!mek.message) return;
      if(mek.key.remoteJid === "status@broadcast") {
        let bot = dian.decodeJid(dian.user.id);
        if(!dian.autosw) return;
        setTimeout(() => {
          dian.readMessages([mek.key]);
          let mt = getContentType(mek.message);
          console.log(
            /protocolMessage/i.test(mt)
              ? `${mek.key.participant.split("@")[0]} Telah menghapus sw nya`
              : "Melihat sw : " + mek.key.participant.split("@")[0]
          );
          if(/protocolMessage/i.test(mt))
            dian.sendMessage(dian.sendsw, {
              text:
                "sw @" + mek.key.participant.split("@")[0] + " Telah dihapus",
              mentions: [mek.key.participant],
            });
          if(/(imageMessage|videoMessage|extendedTextMessage)/i.test(mt)) {
            let keke =
              mt == "extendedTextMessage"
                ? `\nSw erisi : ${mek.message.extendedTextMessage.text}`
                : mt == "imageMessage"
                  ? `\nSw Gambar, Caption : ${mek.message.imageMessage.caption}`
                  : mt == "videoMessage"
                    ? `\nSw Video, Caption : ${mek.message.videoMessage.caption}`
                    : "\nTidak diketahui cek saja langsung!!!";
            dian.sendMessage(dian.sendsw, {
              text: "Melihat Sw @" + mek.key.participant.split("@")[0] + keke,
              mentions: [mek.key.participant],
            });
          }
        }, 500);
      }
      if(!mek.message) return;
      mek.message =
        Object.keys(mek.message)[0] === "ephemeralMessage"
          ? mek.message.ephemeralMessage.message
          : mek.message;
      if(!dian.public && !mek.key.fromMe && chatUpdate.type === "notify")
        return;
      if(mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
      m = smsg(dian, mek, store);
      require("./cmd")(dian, m, chatUpdate, store);
    } catch(err) {
      console.log(err);
    }
  });
  return dian;
}
startdian();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.green(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});