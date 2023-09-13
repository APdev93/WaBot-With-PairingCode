/*
* LU AKALIN SENDIRI JANGAN MAGER🗿
*/
const sessionName = "session";
const {
   default: makeWAsocket,
   delay,
   fetchLatestBaileysVersion,
   getAggregateVotesInPollMessage,
   makeCacheableSignalKeyStore,
   makeInMemoryStore,
   PHONENUMBER_MCC,
   proto,
   useMultiFileAuthState,
   DisconnectReason,
   WAMessageKey,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const NodeCache = require("node-cache");
const readline = require("readline");

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

const startsock = async () => {
   const { state, saveCreds } = await useMultiFileAuthState(sessionName);
   const { version, isLatest } = await fetchLatestBaileysVersion();
   console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
   const sock = makeWAsocket({
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
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
         if (store) {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg.message && undefined;
         }
      },
   });

   store?.bind(sock.ev);

   sock.ev.on("creds.update", saveCreds);

   if (usePairingCode && !sock.authState.creds.registered) {
      if (useMobile) {
         throw new Error("Cannot use pairing code with mobile api");
      }

      const phoneNumber = await question(
         "Please enter your mobile phone number:\n"
      );
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`Pairing code: ${code}`);
   }

   
   sock.ev.process(async (events) => {
      if (events["connection.update"]) {
         const update = events["connection.update"];
         const { connection, lastDisconnect } = update;
         if (connection === "close") {
            if (
               lastDisconnect &&
               lastDisconnect.error &&
               lastDisconnect.error.output &&
               lastDisconnect.error.output.statusCode !==
                  DisconnectReason.loggedOut
            ) {
               startsock();
            } else {
               console.log("Connection closed. You are logged out.");
            }
         }
         console.log("connection update", update);
      }
   });
   return sock;
};
startsock();
