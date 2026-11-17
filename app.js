import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const $=id=>document.getElementById(id),cfg=window.APP_CONFIG;
let db,user,admin=false,reader=false,records=[],urls=[];
const say=s=>$('notice').textContent=s;
const check=r=>{if(r.error)throw r.error;return r.data};
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
async function action(fn){try{await fn()}catch(e){say('操作失败：'+e.message)}}
function tab(id){['submit','records','admin'].forEach(x=>$(x).hidden=x!==id)}
async function init(){
 if(!cfg?.supabaseUrl||!cfg?.supabaseKey){say('尚未连接后端，当前不能登录或提交。请按仓库 README 创建 Supabase 项目、执行 schema.sql 并填写 config.js。');$('loginForm').querySelector('button').disabled=true;return}
 db=createClient(cfg.supabaseUrl,cfg.supabaseKey);
 const session=check(await db.auth.getSession());user=session.session?.user;
 if(!user){say('通过邮箱中的登录链接验证身份后，即可提交阅读记录。');return}
 $('login').hidden=true;$('workspace').hidden=false;$('identity').textContent=user.email;
 admin=check(await db.rpc('is_admin'));reader=check(await db.rpc('can_read_all'));
 $('adminTab').hidden=!admin;$('scope').textContent=reader?'你可以查看全部阅读记录。':'你可以查看自己的阅读记录；查看其他记录需要管理员授权。';
 say('已登录。'+(admin?'当前身份：管理员。':reader?'当前身份：授权查看者。':'当前身份：提交者。'));
 await loadRecords();if(admin)await loadGrants();
}
$('loginForm').onsubmit=e=>{e.preventDefault();action(async()=>{const b=e.submitter;b.disabled=true;try{check(await db.auth.signInWithOtp({email:$('email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname}}));say('登录链接已发送，请检查邮箱（包括垃圾邮件），点击链接返回本站。')}finally{b.disabled=false}})};
$('logout').onclick=()=>action(async()=>{check(await db.auth.signOut());location.reload()});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('images').onchange=()=>{urls.forEach(URL.revokeObjectURL);urls=[];$('previews').replaceChildren();for(const f of $('images').files){if(!['image/png','image/jpeg','image/webp'].includes(f.type))continue;const img=node('img');img.src=URL.createObjectURL(f);urls.push(img.src);img.alt=f.name;$('previews').append(img)}};
$('paperForm').onsubmit=e=>{e.preventDefault();action(async()=>{
 const button=$('submitButton');button.disabled=true;const paths=[];let saved=false;
 try{
 const fs=[...$('images').files];if(fs.length>6||fs.some(f=>f.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(f.type)))throw Error('请选择最多 6 张 PNG、JPG 或 WebP 图片，每张不超过 5 MB。');
 const values=Object.fromEntries(new FormData(e.target));for(const k of Object.keys(values))if(typeof values[k]==='string')values[k]=values[k].trim();values.publication_year=Number(values.publication_year);
 for(const f of fs){const path=user.id+'/'+crypto.randomUUID()+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[f.type]);check(await db.storage.from('paper-images').upload(path,f,{contentType:f.type,upsert:false}));paths.push(path)}
 check(await db.from('papers').insert({...values,owner_id:user.id,image_paths:paths}));saved=true;
 e.target.reset();urls.forEach(URL.revokeObjectURL);urls=[];$('previews').replaceChildren();say('阅读记录已成功提交。');await loadRecords();tab('records');
 }catch(err){if(!saved&&paths.length){const cleanup=await db.storage.from('paper-images').remove(paths);if(cleanup.error)say('提交失败，部分图片清理失败。请联系管理员。')}throw err}finally{button.disabled=false}
 })};
async function loadRecords(){records=check(await db.from('papers').select('*').order('created_at',{ascending:false}).limit(1000));renderRecords()}
function renderRecords(){const list=$('recordList');list.replaceChildren();const q=$('search').value.toLowerCase();const shown=records.filter(r=>[r.title,r.reader_name,r.journal].join(' ').toLowerCase().includes(q));list.append(node('p','显示 '+shown.length+' 条记录（最多加载最新 1000 条）。'));for(const r of shown){const d=node('details');d.className='entry';d.append(node('summary',r.title),node('p',r.reader_name+' · '+r.reading_date+' · '+r.journal+' · '+r.publication_year));const dl=node('dl');for(const [key,label]of [['abstract_zh','中文摘要'],['motivation_quote','作者为什么做这个模型（作者原话）'],['model','模型'],['conclusions','主要结论']]){dl.append(node('dt',label),node('dd',r[key]))}d.append(dl);if(r.image_paths.length){const b=node('button','加载图片'),gallery=node('div');gallery.className='gallery';b.onclick=()=>action(async()=>{b.disabled=true;try{const images=await Promise.all(r.image_paths.map(async path=>{const data=check(await db.storage.from('paper-images').download(path));const img=node('img');img.alt='文献阅读附件';img.src=URL.createObjectURL(data);img.onload=()=>URL.revokeObjectURL(img.src);img.onerror=()=>URL.revokeObjectURL(img.src);return img}));gallery.replaceChildren(...images);b.hidden=true}catch(e){b.disabled=false;throw e}});d.append(b,gallery)}list.append(d)}}
$('search').oninput=renderRecords;$('refresh').onclick=()=>action(loadRecords);
async function loadGrants(){const list=$('grantList');list.replaceChildren();const data=check(await db.from('read_grants').select('*').order('created_at',{ascending:false}));for(const g of data){const row=node('div');row.className='grant';row.append(node('span',g.email));const b=node('button','撤销查看');b.onclick=()=>action(async()=>{check(await db.from('read_grants').delete().eq('email',g.email));await loadGrants();say('已撤销 '+g.email+' 的查看权限。')});row.append(b);list.append(row)}if(!data.length)list.append(node('p','尚未授权其他查看者。'))}
$('grantForm').onsubmit=e=>{e.preventDefault();action(async()=>{const email=$('grantEmail').value.trim().toLowerCase();check(await db.from('read_grants').upsert({email},{onConflict:'email'}));$('grantForm').reset();await loadGrants();say('已授权 '+email+' 查看全部记录。')})};action(init);
