const fs=require('fs'),path=require('path'),DB=require('better-sqlite3');
fs.mkdirSync(path.join(__dirname,'../data'),{recursive:true});const db=new DB(path.join(__dirname,'../data/vongban.sqlite'));db.pragma('journal_mode=WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,bio TEXT DEFAULT '',city TEXT DEFAULT '',hometown TEXT DEFAULT '',job TEXT DEFAULT '',education TEXT DEFAULT '',birthday TEXT DEFAULT '',avatar TEXT DEFAULT '',cover TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,user_id INTEGER,content TEXT DEFAULT '',media TEXT DEFAULT '',media_type TEXT DEFAULT '',privacy TEXT DEFAULT 'public',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS follows(follower_id INTEGER,followed_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(follower_id,followed_id));
CREATE TABLE IF NOT EXISTS likes(user_id INTEGER,post_id INTEGER,PRIMARY KEY(user_id,post_id));
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,post_id INTEGER,user_id INTEGER,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,sender_id INTEGER,receiver_id INTEGER,body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,seen INTEGER DEFAULT 0);
`
);
db.exec(`
CREATE TABLE IF NOT EXISTS friend_requests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sender_id,receiver_id)
);
CREATE TABLE IF NOT EXISTS friendships(
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,friend_id)
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id, is_read, id);
`);
module.exports=db;

