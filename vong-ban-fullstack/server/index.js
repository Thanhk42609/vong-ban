require('dotenv').config();const express=require('express'),http=require('http'),cors=require('cors'),path=require('path'),fs=require('fs'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),multer=require('multer'),{Server}=require('socket.io'),db=require('./db'),{auth,SECRET}=require('./auth');
const app=express(),server=http.createServer(app),origin=process.env.CLIENT_ORIGIN||'http://localhost:5173',io=new Server(server,{cors:{origin}});
app.use(cors({origin}));app.use(express.json({limit:'2mb'}));fs.mkdirSync(path.join(__dirname,'../uploads'),{recursive:true});app.use('/uploads',express.static(path.join(__dirname,'../uploads')));
const upload=multer({storage:multer.diskStorage({destination:path.join(__dirname,'../uploads'),filename:(q,f,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(f.originalname))}),limits:{fileSize:50*1024*1024},fileFilter:(q,f,cb)=>cb(null,f.mimetype.startsWith('image/')||f.mimetype.startsWith('video/'))});
const user=id=>db.prepare('SELECT id,name,bio,city,hometown,job,education,birthday,avatar,cover,created_at FROM users WHERE id=?').get(id);
const groupOf=id=>{
 const r=db.prepare('SELECT COALESCE(is_test,0) AS g FROM users WHERE id=?').get(id);
 return r ? Number(r.g) : null;
};
const canSee=(viewerId,targetId)=>{
 const a=groupOf(viewerId),b=groupOf(targetId);
 return a!==null && b!==null && a===b;
};
const counts=id=>{
 const g=groupOf(id);
 return {
  followers:db.prepare('SELECT count(*) n FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followed_id=? AND COALESCE(u.is_test,0)=?').get(id,g).n,
  following:db.prepare('SELECT count(*) n FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=? AND COALESCE(u.is_test,0)=?').get(id,g).n
 };
};

function createNotification(userId, actorId, type, content){
 const result=db.prepare(
  'INSERT INTO notifications(user_id,actor_id,type,content) VALUES(?,?,?,?)'
 ).run(userId,actorId,type,content);
 const item=db.prepare(`
  SELECT n.*,u.name AS actor_name,u.avatar AS actor_avatar
  FROM notifications n JOIN users u ON u.id=n.actor_id
  WHERE n.id=?
 `).get(result.lastInsertRowid);
 io.to('u'+userId).emit('notification',item);
 return item;
}

const postSQL=`SELECT p.*,u.name,u.avatar,
 (SELECT count(*) FROM likes l JOIN users lu ON lu.id=l.user_id WHERE l.post_id=p.id AND COALESCE(lu.is_test,0)=COALESCE(u.is_test,0)) likes,
 (SELECT count(*) FROM comments c JOIN users cu ON cu.id=c.user_id WHERE c.post_id=p.id AND COALESCE(cu.is_test,0)=COALESCE(u.is_test,0)) comments,
 EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) liked
 FROM posts p JOIN users u ON u.id=p.user_id`;
app.get('/api/health',(q,s)=>s.json({ok:true}));
app.post('/api/auth/register',async(q,s)=>{let{name,email,password}=q.body||{};if(!name?.trim()||!email?.trim()||!password||password.length<8)return s.status(400).json({error:'Nhập họ tên, email và mật khẩu từ 8 ký tự'});try{let h=await bcrypt.hash(password,12),r=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name.trim(),email.trim().toLowerCase(),h),u=user(r.lastInsertRowid);s.json({user:u,token:jwt.sign({id:u.id},SECRET,{expiresIn:'7d'})})}catch{s.status(409).json({error:'Email đã được sử dụng'})}});
app.post('/api/auth/login',async(q,s)=>{let u=db.prepare('SELECT * FROM users WHERE email=?').get((q.body.email||'').toLowerCase());if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(401).json({error:'Email hoặc mật khẩu không đúng'});s.json({user:user(u.id),token:jwt.sign({id:u.id},SECRET,{expiresIn:'7d'})})});
app.get('/api/me',auth,(q,s)=>s.json({user:user(q.user.id),...counts(q.user.id)}));
app.patch('/api/profile',auth,(q,s)=>{let keys=['name','bio','city','hometown','job','education','birthday'].filter(k=>typeof q.body[k]==='string');if(keys.length)db.prepare('UPDATE users SET '+keys.map(k=>k+'=?').join(',')+' WHERE id=?').run(...keys.map(k=>q.body[k].slice(0,500)),q.user.id);s.json({user:user(q.user.id),...counts(q.user.id)})});
app.post('/api/profile/media',auth,upload.single('file'),(q,s)=>{if(!q.file)return s.status(400).json({error:'Chọn ảnh hợp lệ'});let k=q.body.kind==='cover'?'cover':'avatar',url='/uploads/'+q.file.filename;db.prepare('UPDATE users SET '+k+'=? WHERE id=?').run(url,q.user.id);s.json({url,user:user(q.user.id)})});
app.get('/api/users/:id',auth,(q,s)=>{
 const id=Number(q.params.id),u=user(id);
 if(!u||!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 s.json({user:u,...counts(id),isMe:id===q.user.id,following:!!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?').get(q.user.id,id)});
});
app.post('/api/users/:id/follow',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(id===q.user.id||!user(id)||!canSee(q.user.id,id))return s.status(400).json({error:'Tài khoản không hợp lệ'});
 const ex=db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?').get(q.user.id,id);
 ex?db.prepare('DELETE FROM follows WHERE follower_id=? AND followed_id=?').run(q.user.id,id):db.prepare('INSERT INTO follows(follower_id,followed_id) VALUES(?,?)').run(q.user.id,id);
 s.json({following:!ex,...counts(id)});
});
app.get('/api/users/:id/followers',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 s.json(db.prepare('SELECT u.id,u.name,u.avatar FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followed_id=? AND COALESCE(u.is_test,0)=?').all(id,groupOf(id)));
});
app.get('/api/users/:id/following',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 s.json(db.prepare('SELECT u.id,u.name,u.avatar FROM follows f JOIN users u ON u.id=f.followed_id WHERE f.follower_id=? AND COALESCE(u.is_test,0)=?').all(id,groupOf(id)));
});
app.get('/api/people',auth,(q,s)=>{
 s.json(db.prepare('SELECT u.id,u.name,u.avatar,u.bio,EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=u.id) following FROM users u WHERE u.id<>? AND COALESCE(u.is_test,0)=?').all(q.user.id,q.user.id,groupOf(q.user.id)));
});

// FRIEND REQUESTS
app.post('/api/friends/request/:id',auth,(q,s)=>{
 const id=Number(q.params.id),me=q.user.id;
 if(!Number.isSafeInteger(id)||id<1||id===me||!user(id)||!canSee(me,id))
  return s.status(400).json({error:'Tài khoản không hợp lệ'});
 const areFriends=db.prepare('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?').get(me,id);
 if(areFriends)return s.status(409).json({error:'Hai người đã là bạn bè'});
 const incoming=db.prepare("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'").get(id,me);
 if(incoming){
  const tx=db.transaction(()=>{
   db.prepare("INSERT OR IGNORE INTO friendships(user_id,friend_id) VALUES(?,?),(?,?)").run(me,id,id,me);
   db.prepare("UPDATE friend_requests SET status='accepted' WHERE id=?").run(incoming.id);
  });
  tx();
  createNotification(id,me,'friend_accepted','đã chấp nhận lời mời kết bạn');
  return s.json({status:'friends',message:'Đã chấp nhận lời mời kết bạn'});
 }
 const existing=db.prepare("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'").get(me,id);
 if(existing)return s.json({status:'pending',message:'Đã gửi lời mời trước đó'});
 db.prepare("INSERT INTO friend_requests(sender_id,receiver_id,status) VALUES(?,?,'pending')").run(me,id);
 createNotification(id,me,'friend_request','đã gửi lời mời kết bạn');
 s.json({status:'pending',message:'Đã gửi lời mời kết bạn'});
});

app.get('/api/friends/requests',auth,(q,s)=>{
 s.json(db.prepare("SELECT r.id,r.sender_id,u.name,u.avatar,u.bio,r.created_at FROM friend_requests r JOIN users u ON u.id=r.sender_id WHERE r.receiver_id=? AND r.status='pending' AND COALESCE(u.is_test,0)=? ORDER BY r.id DESC").all(q.user.id,groupOf(q.user.id)));
});

app.get('/api/friends/sent',auth,(q,s)=>{
 s.json(db.prepare("SELECT r.id,r.receiver_id,u.name,u.avatar,r.created_at FROM friend_requests r JOIN users u ON u.id=r.receiver_id WHERE r.sender_id=? AND r.status='pending' AND COALESCE(u.is_test,0)=? ORDER BY r.id DESC").all(q.user.id,groupOf(q.user.id)));
});

app.post('/api/friends/accept/:id',auth,(q,s)=>{
 const id=Number(q.params.id),me=q.user.id;
 if(!canSee(me,id))return s.status(404).json({error:'Không tìm thấy lời mời'});
 const request=db.prepare("SELECT id FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'").get(id,me);
 if(!request)return s.status(404).json({error:'Không tìm thấy lời mời'});
 const tx=db.transaction(()=>{
  db.prepare("INSERT OR IGNORE INTO friendships(user_id,friend_id) VALUES(?,?),(?,?)").run(me,id,id,me);
  db.prepare("UPDATE friend_requests SET status='accepted' WHERE id=?").run(request.id);
 });
 tx();
 createNotification(id,me,'friend_accepted','đã chấp nhận lời mời kết bạn');
 s.json({ok:true,message:'Đã trở thành bạn bè'});
});

app.post('/api/friends/reject/:id',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy lời mời'});
 const result=db.prepare("UPDATE friend_requests SET status='rejected' WHERE sender_id=? AND receiver_id=? AND status='pending'").run(id,q.user.id);
 if(!result.changes)return s.status(404).json({error:'Không tìm thấy lời mời'});
 s.json({ok:true});
});

app.delete('/api/friends/:id',auth,(q,s)=>{
 const id=Number(q.params.id),me=q.user.id;
 if(!canSee(me,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 db.prepare("DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)").run(me,id,id,me);
 s.json({ok:true});
});


app.delete('/api/friends/sent/:id',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy lời mời'});
 const result=db.prepare("DELETE FROM friend_requests WHERE sender_id=? AND receiver_id=? AND status='pending'").run(q.user.id,id);
 if(!result.changes)return s.status(404).json({error:'Không tìm thấy lời mời'});
 s.json({ok:true});
});

app.get('/api/users/:id/friends',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 s.json(db.prepare("SELECT u.id,u.name,u.avatar,u.bio FROM friendships f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? AND COALESCE(u.is_test,0)=? ORDER BY u.name").all(id,groupOf(id)));
});

app.get('/api/friends',auth,(q,s)=>{
 s.json(db.prepare("SELECT u.id,u.name,u.avatar,u.bio FROM friendships f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? AND COALESCE(u.is_test,0)=? ORDER BY u.name").all(q.user.id,groupOf(q.user.id)));
});


app.get('/api/notifications',auth,(q,s)=>{
 s.json(db.prepare(`
  SELECT n.*,u.name AS actor_name,u.avatar AS actor_avatar
  FROM notifications n JOIN users u ON u.id=n.actor_id
  WHERE n.user_id=? AND COALESCE(u.is_test,0)=?
  ORDER BY n.id DESC LIMIT 100
 `).all(q.user.id,groupOf(q.user.id)));
});

app.patch('/api/notifications/read-all',auth,(q,s)=>{
 db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(q.user.id);
 s.json({ok:true});
});

app.patch('/api/notifications/:id/read',auth,(q,s)=>{
 const result=db.prepare(
  'UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?'
 ).run(Number(q.params.id),q.user.id);
 if(!result.changes)return s.status(404).json({error:'Không tìm thấy thông báo'});
 s.json({ok:true});
});

app.get('/api/posts',auth,(q,s)=>{
 s.json(db.prepare(postSQL+` WHERE COALESCE(u.is_test,0)=(SELECT COALESCE(is_test,0) FROM users WHERE id=?) AND (p.privacy='public' OR p.user_id=? OR (p.privacy='followers' AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.followed_id=p.user_id))) ORDER BY p.created_at DESC`).all(q.user.id,q.user.id,q.user.id,q.user.id));
});
app.get('/api/users/:id/posts',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 const follow=!!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?').get(q.user.id,id);
 s.json(db.prepare(postSQL+` WHERE COALESCE(u.is_test,0)=(SELECT COALESCE(is_test,0) FROM users WHERE id=?) AND p.user_id=? AND (p.privacy='public' OR p.user_id=? OR (p.privacy='followers' AND ?)) ORDER BY p.created_at DESC`).all(q.user.id,q.user.id,id,q.user.id,follow?1:0));
});
app.post('/api/posts',auth,upload.single('media'),(q,s)=>{let{content='',privacy='public'}=q.body,f=q.file;if(!content.trim()&&!f)return s.status(400).json({error:'Bài viết cần nội dung hoặc file'});let media=f?'/uploads/'+f.filename:'',type=f?(f.mimetype.startsWith('video/')?'video':'image'):'';let r=db.prepare('INSERT INTO posts(user_id,content,media,media_type,privacy) VALUES(?,?,?,?,?)').run(q.user.id,content.slice(0,5000),media,type,['public','followers','private'].includes(privacy)?privacy:'public');s.json(db.prepare(postSQL+' WHERE p.id=?').get(q.user.id,r.lastInsertRowid))});
app.delete('/api/posts/:id',auth,(q,s)=>{let id=+q.params.id,p=db.prepare('SELECT user_id FROM posts WHERE id=?').get(id);if(!p)return s.sendStatus(404);if(p.user_id!==q.user.id)return s.sendStatus(403);db.prepare('DELETE FROM likes WHERE post_id=?').run(id);db.prepare('DELETE FROM comments WHERE post_id=?').run(id);db.prepare('DELETE FROM posts WHERE id=?').run(id);s.json({ok:true})});
app.post('/api/posts/:id/like',auth,(q,s)=>{
 const id=Number(q.params.id);
 const post=db.prepare('SELECT user_id FROM posts WHERE id=?').get(id);
 if(!post||!canSee(q.user.id,post.user_id))return s.status(404).json({error:'Không tìm thấy bài viết'});
 const ex=db.prepare('SELECT 1 FROM likes WHERE user_id=? AND post_id=?').get(q.user.id,id);
 ex?db.prepare('DELETE FROM likes WHERE user_id=? AND post_id=?').run(q.user.id,id):db.prepare('INSERT INTO likes(user_id,post_id) VALUES(?,?)').run(q.user.id,id);
 s.json({liked:!ex,likes:db.prepare('SELECT count(*) n FROM likes WHERE post_id=?').get(id).n});
});
app.get('/api/posts/:id/comments',auth,(q,s)=>{
 const postId=Number(q.params.id);
 const post=db.prepare('SELECT user_id FROM posts WHERE id=?').get(postId);
 if(!post||!canSee(q.user.id,post.user_id))return s.status(404).json({error:'Không tìm thấy bài viết'});
 s.json(db.prepare('SELECT c.*,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND COALESCE(u.is_test,0)=? ORDER BY c.id').all(postId,groupOf(q.user.id)));
});
app.post('/api/posts/:id/comments',auth,(q,s)=>{
 const postId=Number(q.params.id),b=(q.body.body||'').trim();
 if(!b)return s.status(400).json({error:'Nhập bình luận'});
 const post=db.prepare('SELECT user_id FROM posts WHERE id=?').get(postId);
 if(!post||!canSee(q.user.id,post.user_id))return s.status(404).json({error:'Không tìm thấy bài viết'});
 const r=db.prepare('INSERT INTO comments(post_id,user_id,body) VALUES(?,?,?)').run(postId,q.user.id,b.slice(0,2000));
 s.json(db.prepare('SELECT c.*,u.name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?').get(r.lastInsertRowid));
});
app.get('/api/messages/:id',auth,(q,s)=>{
 const id=Number(q.params.id);
 if(!canSee(q.user.id,id))return s.status(404).json({error:'Không tìm thấy tài khoản'});
 const g=groupOf(q.user.id);
 s.json(db.prepare('SELECT m.* FROM messages m JOIN users a ON a.id=m.sender_id JOIN users b ON b.id=m.receiver_id WHERE ((m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)) AND COALESCE(a.is_test,0)=? AND COALESCE(b.is_test,0)=? ORDER BY m.id').all(q.user.id,id,id,q.user.id,g,g));
});
app.post('/api/messages/:id',auth,(q,s)=>{
 const body=(q.body.body||'').trim(),to=Number(q.params.id);
 if(!body||!canSee(q.user.id,to))return s.status(400).json({error:'Tin nhắn không hợp lệ'});
 const r=db.prepare('INSERT INTO messages(sender_id,receiver_id,body) VALUES(?,?,?)').run(q.user.id,to,body.slice(0,4000));
 const m=db.prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid);
 io.to('u'+to).emit('message',m);
 io.to('u'+q.user.id).emit('message',m);
 s.json(m);
});
io.use((sock,next)=>{try{sock.user=jwt.verify(sock.handshake.auth.token,SECRET);next()}catch{next(Error('unauthorized'))}});io.on('connection',sock=>sock.join('u'+sock.user.id));
server.listen(process.env.PORT||4000,()=>console.log('API running on 4000'));
