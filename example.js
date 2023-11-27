/*
  A. dependencies:
  
  1. node-cache
  2. readline
  3.@whiskeysockets/baileys: v6.4.0^
  
  B. Import this module from @whiskeysockets/baileys
  1. makeCacheableSignalKeyStore
  2. PHONENUMBER_MCC
  
*/

const sessionName = "session";
const {
   default: makeWASocket,
   delay,
   fetchLatestBaileysVersion,
   getAggregateVotesInPollMessage,
   makeCacheableSignalKeyStore,
   makeInMemoryStore,
   PHONENUMBER_MCC,
   proto,
   useMultiFileAuthState,
   WAMessageKey,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const NodeCache = require("node-cache");
const readline = require("readline");

const useStore = false;
const usePairingCode = true;
const useMobile = false;

const MAIN_LOGGER = pino({
   timestamp: () => `,"time":"${new Date().toJSON()}"`,
});

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

async function start() {
   let { state, saveCreds } = await useMultiFileAuthState(sessionName);
   let { version, isLatest } = await fetchLatestBaileysVersion();
   const sock = makeWASocket({
      version,
      logger: P, // P for hidden log console
      printQRInTerminal: !usePairingCode, // If you want to use scan, then change the value of this variable to false
      mobile: useMobile,
      browser: ["chrome (linux)", "", ""], // If you change this then the pairing code will not work
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, P),
      },
      msgRetryCounterCache,
   });
   store?.bind(sock.ev);

   sock.ev.on("creds.update", saveCreds); // to save creds

   if (usePairingCode && !sock.authState.creds.registered) {
      if (useMobile) {
         throw new Error("cannot use mobile api");
      }
      const phoneNumber = await question("Enter your active whatsapp number: ");
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`pairing with this code: ${code}`);
   }

   // to upsert message from whatsapp
   sock.ev.process(async (events) => {
      if (events["connection.update"]) {
         const update = events["connection.update"];
         const { connection, lastDisconnect } = update;
         if (connection === "open"){
            console.log("connected")
           
         }

         if (connection === "close") {
            if (
               lastDisconnect &&
               lastDisconnect.error &&
               lastDisconnect.error.output &&
               lastDisconnect.error.output.statusCode !== 401
                 
            ) {
               start();
            } else {
               console.log("Connection closed. You are logged out.");
            }
         }
         console.log("connection update", update);
      }
   });
   return sock;
}

start();
