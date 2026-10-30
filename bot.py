# -*- coding: utf-8 -*-
import os, time, sqlite3, requests, logging, threading
TOKEN = os.environ.get("TOKENLENS_BOT_TOKEN", "").strip()
OWNER_ID = 1161719856
API = "https://api.telegram.org/bot" + TOKEN
MINI_APP = "https://tokenlens-chart-6wfg.folkapps.com"
CHANNEL = "@tokenlenschart"
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tokenlens")

DB = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tokenlens_bot.db"), check_same_thread=False)
DB.execute("CREATE TABLE IF NOT EXISTS users(uid INTEGER PRIMARY KEY, first_seen TEXT, last_seen TEXT)")
DB.execute("CREATE TABLE IF NOT EXISTS groups(gid INTEGER PRIMARY KEY, first_seen TEXT)")
DB.execute("CREATE TABLE IF NOT EXISTS opens(uid INTEGER, ts TEXT)")
DB.commit()

def now(): return datetime.now(timezone.utc).isoformat()
from datetime import datetime, timezone

def send(chat, text, kb=None):
    payload = {"chat_id": chat, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if kb: payload["reply_markup"] = kb
    requests.post(API+"/sendMessage", json=payload, timeout=20)

def track_user(uid):
    DB.execute("INSERT OR IGNORE INTO users(uid, first_seen, last_seen) VALUES(?,?,?)", (uid, now(), now()))
    DB.execute("UPDATE users SET last_seen=? WHERE uid=?", (now(), uid)); DB.commit()

WELCOME = (
    "📊 Welcome to <b>Tokenlens</b>!\n\n"
    "See tokenomics in seconds: supply distribution, FDV, unlocks and market impact. "
    "Analyze any project and share your card.\n\n"
    f"🔗 Tool: {MINI_APP}\n📢 Channel: {CHANNEL}"
)
def welcome_kb():
    return {"inline_keyboard": [[{"text": "📊 Open Tokenlens", "web_app": {"url": MINI_APP}}],
                                [{"text": "📢 Channel", "url": f"https://t.me/{CHANNEL.lstrip('@')}"}]]}

def handle(u):
    msg = u.get("message") or u.get("edited_message")
    if not msg: return
    chat = msg["chat"]; uid = msg.get("from", {}).get("id")
    if chat["type"] in ("group", "supergroup") and uid:
        DB.execute("INSERT OR IGNORE INTO groups(gid, first_seen) VALUES(?,?)", (chat["id"], now())); DB.commit()
    if uid: track_user(uid)
    if u.get("callback_query"):
        cq = u["callback_query"]
        DB.execute("INSERT INTO opens(uid, ts) VALUES(?,?)", (cq["from"]["id"], now())); DB.commit()
        requests.post(API+"/answerCallbackQuery", json={"callback_query_id": cq["id"]}, timeout=15)
        send(cq["message"]["chat"]["id"], "Opening the mini app: " + MINI_APP)
        return
    text = (msg.get("text") or "").strip()
    if not text: return
    if text == "/start":
        send(chat["id"], WELCOME, welcome_kb())
    elif text.startswith("/stats") and uid == OWNER_ID:
        users = DB.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        groups = DB.execute("SELECT COUNT(*) FROM groups").fetchone()[0]
        opens = DB.execute("SELECT COUNT(*) FROM opens").fetchone()[0]
        send(chat["id"], f"📈 Stats\nUsers: {users}\nGroups: {groups}\nMini app opens: {opens}")
    elif text.startswith("/stats"):
        send(chat["id"], "This command is only for the bot owner 🙂")

def poll():
    off = 0
    while True:
        try:
            r = requests.get(API+"/getUpdates", params={"offset": off, "timeout": 25}, timeout=60).json()
            if not r.get("ok"): log.error("api error: %s", r); time.sleep(5); continue
            for x in r.get("result", []):
                off = x["update_id"] + 1
                try: handle(x)
                except Exception: log.exception("handle failed")
        except Exception as e:
            log.error("poll %s", e); time.sleep(5)

requests.post(API+"/setMyCommands", json={"commands":[{"command":"start","description":"Start the bot"},{"command":"stats","description":"Bot stats (owner only)"}]}, timeout=15)
requests.post(API+"/setChatMenuButton", json={"menu_button":{"type":"web_app","text":"Tokenlens","web_app":{"url":MINI_APP}}}, timeout=15)
log.info("tokenlens bot starting")
poll()
