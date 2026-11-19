import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import{io}from'socket.io-client';import'./style.css';
const api='/api',tok=()=>localStorage.getItem('vbtoken'),H=()=>({Authorization:'Bearer '+tok()});
async function req(url,opt={}){let r=await fetch(api+url,{...opt,headers:{...H(),...(opt.body instanceof FormData?{}:{'Content-Type':'application/json'}),...opt.headers}}),d=await r.json();if(!r.ok)throw Error(d.error||'Có lỗi');return d}
function App(){let[t,S]=useState(tok()),[me,M]=useState(null),[page,P]=useState(()=>location.pathname.match(/^\/profile\/(\d+)\/?$/)?'profile':(sessionStorage.getItem('vbpage')||'feed')),[ready,Ready]=useState(!tok()),[profile,PR]=useState(null),[posts,PS]=useState([]),[people,PE]=useState([]),[chat,CH]=useState(null),[msgs,MS]=useState([]),[err,ER]=useState(''),[searchId,SI]=useState(''),[notifications,setNotifications]=useState([]),[showNotifications,setShowNotifications]=useState(false);
useEffect(()=>{if(!t){Ready(true);return}Ready(false);req('/me').then(x=>M(x.user)).catch(()=>out()).finally(()=>Ready(true))},[t]);useEffect(()=>{if(!t)return;let s=io('/',{auth:{token:t}});s.on('message',m=>{if(chat&&(m.sender_id===chat.id||m.receiver_id===chat.id))MS(v=>v.some(x=>x.id===m.id)?v:[...v,m])});s.on('notification',n=>setNotifications(v=>v.some(x=>x.id===n.id)?v:[n,...v]));return()=>s.disconnect()},[t,chat]);
useEffect(()=>{if(t)req('/notifications').then(setNotifications).catch(console.error)},[t]);
useEffect(()=>{if(t&&page==='feed')load();if(t&&(page==='people'||page==='messages'))req('/people').then(PE).catch(e=>ER(e.message))},[t,page]);useEffect(()=>{sessionStorage.setItem('vbpage',page)},[page]);
useEffect(()=>{
  if(page==='profile'&&profile?.user?.id){
    const path='/profile/'+profile.user.id;
    if(location.pathname!==path)history.pushState({page:'profile',id:profile.user.id},'',path);
  }else if(page!=='profile'&&location.pathname.startsWith('/profile/')){
    history.pushState({page},'','/');
  }
},[page,profile?.user?.id]);
useEffect(()=>{
  const back=()=>{
    const match=location.pathname.match(/^\/profile\/(\d+)\/?$/);
    if(match){
      sessionStorage.setItem('vbprofile',match[1]);
      PR(null);
      P('profile');
    }else{
      PR(null);
      P('feed');
    }
  };
  addEventListener('popstate',back);
  return ()=>removeEventListener('popstate',back);
},[]);
useEffect(()=>{if(t&&me&&page==='profile'&&!profile){let match=location.pathname.match(/^\/profile\/(\d+)\/?$/);let id=match?match[1]:(sessionStorage.getItem('vbprofile')||me.id);req('/users/'+id).then(d=>{PR(d);return req('/users/'+id+'/posts')}).then(PS).catch(()=>P('feed'))}},[t,me,page,profile]);
function out(){localStorage.removeItem('vbtoken');S(null);M(null)}async function load(){try{PS(await req('/posts'))}catch(e){ER(e.message)}}
async function searchById(){
  const id=Number(searchId.trim());
  if(!Number.isSafeInteger(id)||id<1){
    ER('Vui lòng nhập ID là số nguyên dương');
    return;
  }
  try{
    await open(id);
    SI('');
    ER('');
  }catch(e){
    ER(e.message||'Không tìm thấy tài khoản');
  }
}
async function open(id){sessionStorage.setItem('vbprofile',id);let d=await req('/users/'+id);PR(d);PS(await req('/users/'+id+'/posts'));P('profile')}
if(!ready)return <div>Đang tải...</div>;if(!t||!me)return <Auth done={x=>{localStorage.setItem('vbtoken',x);S(x)}}/>;
return <><header><b onClick={()=>P('feed')}>Vòng Bạn</b><input placeholder="Nhập ID người dùng..." value={searchId} onChange={e=>SI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchById()}/><nav><button onClick={()=>P('feed')}>Trang chủ</button><button onClick={()=>P('people')}>Mọi người</button><button onClick={()=>P('messages')}>Tin nhắn</button>
<div className="notification-wrap" style={{position:'relative'}}>
<button onClick={()=>setShowNotifications(v=>!v)}>
🔔 Thông báo {notifications.filter(n=>!n.is_read).length>0&&<b style={{color:'red'}}>({notifications.filter(n=>!n.is_read).length})</b>}
</button>
{showNotifications&&<div style={{position:'absolute',right:0,top:'48px',width:'320px',maxHeight:'400px',overflowY:'auto',background:'#fff',color:'#222',boxShadow:'0 4px 16px #0003',borderRadius:'10px',padding:'12px',zIndex:1000}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<b>Thông báo</b>
<button onClick={async()=>{
try{
await req('/notifications/read-all',{method:'PATCH'});
setNotifications(v=>v.map(n=>({...n,is_read:1})));
}catch(e){alert(e.message)}
}}>Đọc tất cả</button>
</div>
{notifications.length===0?<p>Chưa có thông báo.</p>:notifications.map(n=><div key={n.id} onClick={async()=>{
try{
if(!n.is_read){
await req('/notifications/'+n.id+'/read',{method:'PATCH'});
setNotifications(v=>v.map(x=>x.id===n.id?{...x,is_read:1}:x));
}
setShowNotifications(false);
await open(n.actor_id);
}catch(e){alert(e.message)}
}} style={{padding:'12px 6px',borderBottom:'1px solid #eee',background:n.is_read?'white':'#edf5ff',cursor:'pointer'}}>
<b>{n.actor_name}</b> {n.content}
<small style={{display:'block',color:'#888'}}>{n.created_at}</small>
</div>)}
</div>}
</div><button onClick={()=>open(me.id)}>Cá nhân</button><button onClick={out}>Thoát</button></nav></header><main>
{page==='feed'&&<><h2>Bảng tin</h2><Composer posted={load}/><Posts posts={posts} refresh={load} me={me} open={open}/></>}
{page==='profile'&&profile&&<Profile data={profile} me={me} posts={posts} refresh={async()=>{PR(await req('/users/'+profile.user.id));PS(await req('/users/'+profile.user.id+'/posts'))}} open={open}/>}
{page==='people'&&<><h2>Khám phá mọi người</h2><div className="people">{people.map(p=><article className="person" key={p.id}><Avatar u={p}/><b>{p.name}</b><p>{p.bio}</p><button onClick={async()=>{await req('/users/'+p.id+'/follow',{method:'POST'});PE(await req('/people'))}}>{p.following?'Bỏ theo dõi':'Theo dõi'}</button><button onClick={()=>{CH(p);req('/messages/'+p.id).then(MS);P('messages')}}>Nhắn tin</button><button onClick={()=>open(p.id)}>Trang cá nhân</button></article>)}</div></>}
{page==='messages'&&<Chat me={me} people={people} active={chat} choose={p=>{CH(p);req('/messages/'+p.id).then(MS)}} msgs={msgs} setMsgs={MS}/>}
</main>{err&&<div className="toast" onClick={()=>ER('')}>{err} ×</div>}</>}
function Auth({done}){let[m,M]=useState('login'),[name,N]=useState(''),[email,E]=useState(''),[pass,P]=useState(''),[err,R]=useState('');async function go(e){e.preventDefault();try{let d=await req('/auth/'+m,{method:'POST',body:JSON.stringify({name,email,password:pass})});done(d.token)}catch(x){R(x.message)}}return <div className="auth"><section><h1>Vòng Bạn</h1><p>Kết nối bạn bè, chia sẻ khoảnh khắc và trò chuyện mỗi ngày.</p></section><form onSubmit={go}><h2>{m==='login'?'Đăng nhập':'Đăng ký tài khoản'}</h2>{m==='register'&&<input placeholder="Họ và tên" required value={name} onChange={e=>N(e.target.value)}/>}<input type="email" placeholder="Email" required value={email} onChange={e=>E(e.target.value)}/><input type="password" minLength="8" placeholder="Mật khẩu (ít nhất 8 ký tự)" required value={pass} onChange={e=>P(e.target.value)}/>{err&&<p className="error">{err}</p>}<button className="primary">{m==='login'?'Đăng nhập':'Tạo tài khoản'}</button><button type="button" onClick={()=>M(m==='login'?'register':'login')}>{m==='login'?'Tạo tài khoản mới':'Quay lại đăng nhập'}</button></form></div>}
function Avatar({u,size=44}){return u?.avatar?<img className="avatar" width={size} height={size} src={u.avatar}/>:<div className="avatar blank" style={{width:size,height:size}}>{u?.name?.[0]||'V'}</div>}
function Composer({posted}){let[t,T]=useState(''),[privacy,Q]=useState('public'),[file,F]=useState(null);async function send(){if(!t.trim()&&!file)return;let d=new FormData();d.append('content',t);d.append('privacy',privacy);if(file)d.append('media',file);try{await req('/posts',{method:'POST',body:d});T('');F(null);posted()}catch(e){alert(e.message)}}return <section className="composer"><textarea placeholder="Bạn đang nghĩ gì?" value={t} onChange={e=>T(e.target.value)}/><div className="tools"><label>📷 Ảnh/video<input hidden type="file" accept="image/*,video/*" onChange={e=>F(e.target.files[0])}/></label><select value={privacy} onChange={e=>Q(e.target.value)}><option value="public">Công khai</option><option value="followers">Người theo dõi</option><option value="private">Chỉ mình tôi</option></select><button className="primary" onClick={send}>Đăng bài</button></div>{file?.name}</section>}
function Posts({posts,refresh,me,open}){return <div>{posts.map(p=><Post key={p.id} p={p} refresh={refresh} me={me} open={open}/>)}</div>}
function Post({p,refresh,me,open}){let[c,C]=useState([]),[b,B]=useState('');useEffect(()=>{req('/posts/'+p.id+'/comments').then(C)},[p.id]);async function comment(){if(!b.trim())return;await req('/posts/'+p.id+'/comments',{method:'POST',body:JSON.stringify({body:b})});B('');C(await req('/posts/'+p.id+'/comments'));refresh()}return <article className="post"><div className="posthead" onClick={()=>open(p.user_id)}><Avatar u={{name:p.name,avatar:p.avatar}}/><b>{p.name}</b><small>{new Date(p.created_at+'Z').toLocaleString('vi-VN')}</small></div>{p.content&&<p className="posttext">{p.content}</p>}{p.media&&(p.media_type==='video'?<video controls src={p.media}/>:<img className="media" src={p.media}/>)}<div className="stats">{p.likes} lượt thích · {p.comments} bình luận</div><div className="actions"><button onClick={async()=>{await req('/posts/'+p.id+'/like',{method:'POST'});refresh()}}>{p.liked?'❤️ Đã thích':'♡ Thích'}</button><button onClick={()=>document.getElementById('c'+p.id).focus()}>Bình luận</button>{p.user_id===me.id&&<button onClick={async()=>{if(confirm('Xóa bài viết?')){await req('/posts/'+p.id,{method:'DELETE'});refresh()}}}>Xóa</button>}</div>{c.map(x=><p className="comment"><b>{x.name}</b> {x.body}</p>)}<div className="commentbox"><input id={'c'+p.id} placeholder="Viết bình luận..." value={b} onChange={e=>B(e.target.value)} onKeyDown={e=>e.key==='Enter'&&comment()}/><button onClick={comment}>Gửi</button></div></article>}

function Profile({data,me,posts,refresh,open}){
 let u=data.user;
 let [edit,E]=useState(false);
 let [tab,T]=useState('Bài viết');
 let [f,F]=useState({...u});
 let [friends,Friends]=useState([]);
 let [requests,Requests]=useState([]);
 let [sent,Sent]=useState([]);
 let [busy,Busy]=useState(false);

 async function loadSocial(){
   try{
     const [fr,rs,st]=await Promise.all([
       req('/users/'+u.id+'/friends'),
       req('/friends/requests'),
       req('/friends/sent')
     ]);
     Friends(fr);
     Requests(rs);
     Sent(st);
   }catch(e){console.error(e)}
 }

 useEffect(()=>{loadSocial()},[u.id]);

 async function save(){
   try{
     await req('/profile',{method:'PATCH',body:JSON.stringify(f)});
     E(false);
     await refresh();
   }catch(e){alert(e.message)}
 }

 async function media(kind,file){
   if(!file)return;
   let d=new FormData();
   d.append('kind',kind);
   d.append('file',file);
   try{
     await req('/profile/media',{method:'POST',body:d});
     await refresh();
   }catch(e){alert(e.message)}
 }

 const isFriend=friends.some(x=>Number(x.id)===Number(me.id));
 const incoming=requests.some(x=>x.sender_id===u.id);
 const outgoing=sent.some(x=>x.receiver_id===u.id);

 async function action(url,method='POST'){
   if(busy)return;
   Busy(true);
   try{
     await req(url,{method});
     await loadSocial();
     await refresh();
   }catch(e){alert(e.message)}
   finally{Busy(false)}
 }

 return <>
 <section className="cover"
   style={{backgroundImage:u.cover?`url(${u.cover})`:''}}>
   {data.isMe&&<label>Đổi ảnh bìa
     <input hidden type="file" accept="image/*"
       onChange={e=>media('cover',e.target.files[0])}/>
   </label>}
 </section>

 <section className="profiletop">
   <label>
     <Avatar u={u} size={118}/>
     {data.isMe&&<small>Đổi ảnh đại diện
       <input hidden type="file" accept="image/*"
         onChange={e=>media('avatar',e.target.files[0])}/>
     </small>}
   </label>

   <div className="profiletitle">
     <h1>{u.name}</h1>
     <p className="userid">Mã người dùng: #{u.id}</p>
     <p>{data.followers} người theo dõi · {data.following} đang theo dõi</p>
     <p>{friends.length} bạn bè</p>
   </div>

   {data.isMe
     ? <button onClick={()=>E(!edit)}>✎ Chỉnh sửa trang cá nhân</button>
     : <div className="friend-actions">
         <button disabled={busy} onClick={()=>action('/users/'+u.id+'/follow')}>
           {data.following?'✓ Đang theo dõi':'＋ Theo dõi'}
         </button>
       {isFriend
         ? <button disabled={busy} onClick={()=>{
             if(confirm('Bạn có chắc muốn hủy kết bạn?'))
               action('/friends/'+u.id,'DELETE')
           }}>✓ Bạn bè</button>
         : incoming
           ? <>
               <button className="primary" disabled={busy}
                 onClick={()=>action('/friends/accept/'+u.id)}>
                 Chấp nhận
               </button>
               <button disabled={busy}
                 onClick={()=>action('/friends/reject/'+u.id)}>
                 Từ chối
               </button>
             </>
           : outgoing
             ? <button disabled={busy}
                 onClick={()=>action('/friends/sent/'+u.id,'DELETE')}>
                 Đã gửi lời mời · Hủy
               </button>
             : <button className="primary" disabled={busy}
                 onClick={()=>action('/friends/request/'+u.id)}>
                 + Kết bạn
               </button>
       }
     </div>
   }
 </section>

 {edit&&data.isMe&&
 <div className="modal-backdrop" onClick={()=>E(false)}>
   <section className="editbox modal-card" onClick={e=>e.stopPropagation()}>
     <div className="modal-heading">
       <h2>Chỉnh sửa trang cá nhân</h2>
       <button onClick={()=>E(false)}>✕</button>
     </div>
     <p className="modal-desc">Cập nhật thông tin cá nhân.</p>
     <div className="edit-fields">
       {[
         ['name','Họ và tên'],
         ['bio','Giới thiệu bản thân'],
         ['city','Nơi sống'],
         ['hometown','Quê quán'],
         ['job','Công việc'],
         ['education','Học vấn'],
         ['birthday','Ngày sinh']
       ].map(([k,l])=><label key={k}>
         {l}
         <input value={f[k]||''}
           onChange={e=>F({...f,[k]:e.target.value})}/>
       </label>)}
     </div>
     <div className="modal-footer">
       <button onClick={()=>E(false)}>Hủy</button>
       <button className="primary" onClick={save}>Lưu thay đổi</button>
     </div>
   </section>
 </div>
 }

 <div className="tabs">
   {['Bài viết','Giới thiệu','Bạn bè',...(data.isMe?['Lời mời']:[]),'Ảnh','Video']
     .map(x=><button className={tab===x?'sel':''}
       onClick={()=>T(x)} key={x}>{x}</button>)}
 </div>

 {tab==='Bài viết'
   ? <div className="profilegrid">
       <aside className="panel">
         <h3>Thông tin cá nhân</h3>
         <p>📍 {u.city||'Chưa cập nhật nơi sống'}</p>
         <p>⌂ {u.hometown||'Chưa cập nhật quê quán'}</p>
         <p>💼 {u.job||'Chưa cập nhật công việc'}</p>
         <p>🎓 {u.education||'Chưa cập nhật học vấn'}</p>
         <p>🎂 {u.birthday||'Chưa cập nhật ngày sinh'}</p>
         <p>{u.bio}</p>
       </aside>
       <div>
         {data.isMe&&<Composer posted={refresh}/>}
         <Posts posts={posts} refresh={refresh} me={me} open={open}/>
       </div>
     </div>

   : tab==='Bạn bè'
     ? <section className="panel">
         <h3>Bạn bè ({friends.length})</h3>
         {friends.length===0
           ? <p>Chưa có bạn bè.</p>
           : <div className="people">
               {friends.map(x=><article className="person" key={x.id}>
                 <Avatar u={x} size={65}/>
                 <b>{x.name}</b>
                 <small>Mã người dùng: #{x.id}</small>
                 <button onClick={()=>open(x.id)}>Trang cá nhân</button>
               </article>)}
             </div>}
       </section>

   : tab==='Lời mời'
     ? <section className="panel">
         <h3>Lời mời kết bạn ({requests.length})</h3>
         {requests.length===0
           ? <p>Không có lời mời mới.</p>
           : <div className="people">
               {requests.map(x=><article className="person" key={x.id}>
                 <Avatar u={x} size={65}/>
                 <b>{x.name}</b>
                 <small>Mã người dùng: #{x.sender_id}</small>
                 <button className="primary"
                   onClick={()=>action('/friends/accept/'+x.sender_id)}>
                   Chấp nhận
                 </button>
                 <button
                   onClick={()=>action('/friends/reject/'+x.sender_id)}>
                   Từ chối
                 </button>
                 <button onClick={()=>open(x.sender_id)}>Trang cá nhân</button>
               </article>)}
             </div>}
       </section>

   : <section className="panel">
       <h3>{tab}</h3>
       {tab==='Giới thiệu'
         ? <>
             <p>{u.bio}</p>
             <p>Nơi sống: {u.city}</p>
             <p>Quê quán: {u.hometown}</p>
             <p>Công việc: {u.job}</p>
             <p>Học vấn: {u.education}</p>
             <p>Ngày sinh: {u.birthday}</p>
           </>
         : 'Ảnh và video từ các bài đăng có tệp media sẽ hiển thị tại đây.'}
     </section>
 }
 </>
}

function Chat({me,people,active,choose,msgs,setMsgs}){
let[t,T]=useState('');
async function send(){
if(!active||!t.trim())return;
try{
let m=await req('/messages/'+active.id,{method:'POST',body:JSON.stringify({body:t})});
setMsgs(v=>v.some(x=>x.id===m.id)?v:[...v,m]);T('');
}catch(e){alert(e.message)}
}
return <section className="chat">
<aside>
<h3>Tin nhắn</h3>
{people.map(p=><button className="chatperson" key={p.id} onClick={()=>choose(p)}><Avatar u={p}/>{p.name}</button>)}
</aside>
<div className="chatbody">
<h3>{active?.name||'Chọn người để nhắn tin'}</h3>
<div className="bubbles">
{msgs.map((m,i)=><div key={m.id||i} className={'bubble '+(m.sender_id===me.id?'mine':'')}>{m.body}</div>)}
</div>
<div className="send">
<input value={t} onChange={e=>T(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Nhập tin nhắn..."/>
<button className="primary" onClick={send}>Gửi</button>
</div>
</div>
</section>
}

createRoot(document.getElementById('root')).render(<App/>);
