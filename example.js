const {
	default: makeWASocket,
	fetchLatestBaileysVersion,
	makeCacheableSignalKeyStore,
	makeInMemoryStore,
	PHONENUMBER_MCC,
	useMultiFileAuthState,
	Browsers,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const NodeCache = require("node-cache");
const readline = require("readline");
/** Change it to true if needed */
const useStore = false;

const MAIN_LOGGER = pino({
	timestamp: () => `,"time":"${new Date().toJSON()}"`,
});

const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const store = useStore ? makeInMemoryStore({ logger }) : undefined; // Inisialisasi store jika penggunaan store diaktifkan
store?.readFromFile(`store.json`);

setInterval(() => {
	store?.writeToFile("store.json");
}, 60000 * 60);

const msgRetryCounterCache = new NodeCache();

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});
const question = text => new Promise(resolve => rl.question(text, resolve));

const P = require("pino")({
	level: "silent",
});

async function start() {
	let { state, saveCreds } = await useMultiFileAuthState("AUTH");
	let { version, isLatest } = await fetchLatestBaileysVersion();
	const sock = makeWASocket({
		version,
		logger: P,
		printQRInTerminal: false,
		browser: Browsers.ubuntu("Chrome"),
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, P),
		},
		msgRetryCounterCache,
	});
	store?.bind(sock.ev);

	sock.ev.on("creds.update", saveCreds);

	if (!sock.authState.creds.registered) {
		const phoneNumber = await question("Enter your active whatsapp number: ");
		const code = await sock.requestPairingCode(phoneNumber);
		console.log(`pairing with this code: ${code}`);
	}

	// to upsert message from whatsapp
	sock.ev.process(async events => {
		if (events["connection.update"]) {
			const update = events["connection.update"];
			const { connection, lastDisconnect } = update;
			if (connection === "close") {
				if (
					lastDisconnect &&
					lastDisconnect.error &&
					lastDisconnect.error.output &&
					lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
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
  
