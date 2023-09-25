## Dependencies

```sh
node-cache
readline
@whiskeysockets/baileys: v6.4.0^
```

# Variable and function

<p>1.</p>

```js
   const { makeCacheableSignalKeyStore, PHONENUMBER_MCC } = require("@whiskeysockets/baileys")

   const NodeCache = require("node-cache");
   const readline = require("readline");
```

<p>2.</p>

```js
   const usePairingCode = true;
   const useMobile = false;
   const useStore = false;
```

<p>3.</p>

```js
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
```

# NOTICE

<p>if you already have a variable store, then You have to change the name, because the store variable is different from before</p>

```js
 // change variable name
 //          |
  const stores = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
  });
```

# Conection option

```js
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
      const phoneNumber = await question(
         "Enter your active whatsapp number: "
      );
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`pairing with this code: ${code}`);
   }
}
start();
```

<p>Thankyou for visit my github, please follow my haha</p>
