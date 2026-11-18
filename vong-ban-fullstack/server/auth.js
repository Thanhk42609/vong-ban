const jwt=require('jsonwebtoken'),SECRET=process.env.JWT_SECRET||'dev-only-change-me';
function auth(req,res,next){try{req.user=jwt.verify((req.headers.authorization||'').replace(/^Bearer\s+/,''),SECRET);next()}catch{return res.status(401).json({error:'Vui lòng đăng nhập lại'})}}
module.exports={auth,SECRET};
