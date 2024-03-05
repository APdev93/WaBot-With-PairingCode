## Dependencies

```sh
node-cache
readline
@whiskeysockets/baileys: v6.6.0^
```

# Variable and function

<p>1.</p>

```js
   const { makeCacheableSignalKeyStore, PHONENUMBER_MCC, Browsers } = require("@whiskeysockets/baileys")

   const NodeCache = require("node-cache");
   const readline = require("readline");
```

<p>2.</p>

```js
   const useStore = false /** change to true if needed */
```

<p>3.</p>

```js
const MAIN_LOGGER = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` });

const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const store = useStore ? makeInMemoryStore({ logger }) : undefined;
store?.readFromFile("./store.json");

// Save every 1m
setInterval(() => {
  store?.writeToFile("./store.json");
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

# Conection option

```js
  async function start() {
  let { state, saveCreds } = await useMultiFileAuthState(sessionName);
   let { version, isLatest } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
      version,
      logger: P, /** P for hidden logger log */
      printQRInTerminal: true, /** If you want to use scan, then change the value of this variable to false */
      browser: Browsers.ubuntu("Chrome"), /** There are several browser options, see documentation from @whiskeysockets/baileys */
      auth: {
         creds: state.creds,
         keys: makeCacheableSignalKeyStore(state.keys, P),
      },
      msgRetryCounterCache,
  });
  store?.bind(sock.ev);

  sock.ev.on("creds.update", saveCreds); // to save creds
  
 if (!sock.authState.creds.registered) {
      const phoneNumber = await question(
         "Enter your active whatsapp number: "
      );
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`pairing with this code: ${code}`);
   }
}
start();
```

<p>Thankyou for visit my github</p>
