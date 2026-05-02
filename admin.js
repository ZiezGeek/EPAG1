/* ÉPAG — Admin Application Logic */
/* Designed & Created by ZiezGeek · Aldev.inc */

const ADMIN_PIN_KEY = 'evander_admin_pin';
const SETTINGS_KEY  = 'evander_settings';
let currentOrderId  = null;
let currentFilter   = 'all';
window._liveOrders  = {};

/* ── AUTH ── */
function getPin() { return localStorage.getItem(ADMIN_PIN_KEY) || '2468'; }
function login() {
  if (document.getElementById('pwInput').value === getPin()) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    init();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}
function logout() {
  if (window._stopOrdersListener) window._stopOrdersListener();
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('pwInput').value = '';
  window._liveOrders = {};
}
function changePin() {
  const c = document.getElementById('currentPin').value;
  const n = document.getElementById('newPin').value;
  const f = document.getElementById('confirmPin').value;
  if (c !== getPin())   { showToast('❌ Current PIN is wrong','error'); return; }
  if (n.length < 4)     { showToast('❌ PIN must be at least 4 digits','error'); return; }
  if (n !== f)          { showToast('❌ PINs do not match','error'); return; }
  localStorage.setItem(ADMIN_PIN_KEY, n);
  showToast('✅ PIN updated successfully!','success');
}

/* ── NAVIGATION ── */
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'orders') renderOrders();
}

/* ── FIREBASE HELPERS ── */
function getOrders() { return window._liveOrders || {}; }
async function saveOrder(id, obj) {
  try { if (window._set && window._ref) await window._set(window._ref('orders/'+id), obj); }
  catch(e) { showToast('⚠️ Sync error','error'); }
}
async function deleteOrderFb(id) {
  try { if (window._remove && window._ref) await window._remove(window._ref('orders/'+id)); }
  catch(e) {}
}

/* ── FILTER ── */
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderOrders();
}

const STATUS_CONFIG = {
  received:       { label:'Order Received',   icon:'📋', cls:'status-received' },
  preparing:      { label:'Preparing',         icon:'🔧', cls:'status-preparing' },
  outfordelivery: { label:'Out for Delivery',  icon:'🛵', cls:'status-outfordelivery' },
  delivered:      { label:'Delivered',         icon:'✅', cls:'status-delivered' }
};

/* ── RENDER ── */
function renderOrders() {
  const orders = getOrders();
  const list   = document.getElementById('ordersList');
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  let filtered = Object.values(orders).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  if (currentFilter !== 'all') filtered = filtered.filter(o => o.status === currentFilter);
  if (search) filtered = filtered.filter(o =>
    (o.id||'').toLowerCase().includes(search) || (o.name||'').toLowerCase().includes(search) ||
    (o.phone||'').includes(search) || (o.items||'').toLowerCase().includes(search)
  );
  const all = Object.values(orders);
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card s-total"><span class="stat-icon">📋</span><div class="stat-label">Total Orders</div><div class="stat-value">${all.length}</div></div>
    <div class="stat-card s-prep"><span class="stat-icon">🔧</span><div class="stat-label">Preparing</div><div class="stat-value">${all.filter(o=>o.status==='preparing').length}</div></div>
    <div class="stat-card s-out"><span class="stat-icon">🛵</span><div class="stat-label">Out for Delivery</div><div class="stat-value">${all.filter(o=>o.status==='outfordelivery').length}</div></div>
    <div class="stat-card s-done"><span class="stat-icon">✅</span><div class="stat-label">Delivered Today</div><div class="stat-value">${all.filter(o=>o.status==='delivered'&&isToday(o.timestamps?.delivered)).length}</div></div>
  `;
  if (!filtered.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>${!all.length?'No orders yet — waiting for your first customer!':'No orders match this filter.'}</p></div>`; return; }
  list.innerHTML = filtered.map(o => {
    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.received;
    return `<div class="order-card">
      <div class="order-header">
        <span class="order-id-badge">${o.id}</span>
        <span class="status-badge ${cfg.cls}">${cfg.icon} ${cfg.label}</span>
        <span style="color:var(--muted);font-size:0.74rem;margin-left:auto;">${fmt(o.createdAt)}</span>
      </div>
      <div class="order-meta">
        <div class="meta-cell"><label>Customer</label><p>${o.name}</p></div>
        <div class="meta-cell"><label>Phone</label><p><a href="tel:${o.phone}" style="color:var(--blue);text-decoration:none;">${o.phone}</a></p></div>
        <div class="meta-cell"><label>Items</label><p>${o.items}</p></div>
        <div class="meta-cell"><label>Address</label><p>${o.address}</p></div>
        ${o.notes?`<div class="meta-cell"><label>Notes</label><p>${o.notes}</p></div>`:''}
      </div>
      <div class="order-actions">
        <button class="btn-action btn-status" onclick="openStatusModal('${o.id}')">🔄 Update Status</button>
        <button class="btn-action btn-wa"     onclick="openWA('${o.id}')">💬 WhatsApp</button>
        <button class="btn-action btn-delete" onclick="deleteOrder('${o.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

function isToday(iso) { if(!iso) return false; return new Date(iso).toDateString()===new Date().toDateString(); }
function fmt(iso) { if(!iso) return ''; return new Date(iso).toLocaleString('en-ZA',{dateStyle:'short',timeStyle:'short'}); }

async function deleteOrder(id) {
  if (!confirm('Delete order '+id+'?')) return;
  await deleteOrderFb(id); showToast('🗑️ Order deleted','success');
}

/* ── STATUS MODAL ── */
function openStatusModal(id) {
  currentOrderId = id;
  const order = getOrders()[id]; if (!order) return;
  const steps  = ['received','preparing','outfordelivery','delivered'];
  const labels = ['Order Received — confirm with customer','Preparing — packing cylinders','Out for Delivery — on the way!','Delivered — completed!'];
  const icons  = ['📋','🔧','🛵','✅'];
  document.getElementById('statusOptions').innerHTML = steps.map((s,i) => `
    <div class="status-option ${order.status===s?'current':''}" onclick="updateStatus('${s}')">
      <span class="opt-icon">${icons[i]}</span>
      <div class="opt-text"><h4>${labels[i]}</h4><p>${order.status===s?'← Current status':'Tap to update'}</p></div>
    </div>`).join('');
  document.getElementById('waPreviewContainer').style.display = 'none';
  document.getElementById('statusModal').classList.add('open');
}
async function updateStatus(ns) {
  const orders = getOrders(); const order = orders[currentOrderId]; if(!order) return;
  order.status = ns; if(!order.timestamps) order.timestamps={};
  order.timestamps[ns] = new Date().toISOString();
  await saveOrder(order.id, order);
  document.getElementById('waPreviewText').textContent = buildWAMessage(ns, order);
  document.getElementById('waPreviewContainer').style.display = 'block';
  showToast('✅ Status updated: '+STATUS_CONFIG[ns].label,'success');
}
function closeStatusModal() { document.getElementById('statusModal').classList.remove('open'); currentOrderId=null; }

/* ── WHATSAPP ── */
function getSettings() {
  const d = { waNum:'27176322026', tpl:{
    received:       "Hi {name}! 🔥 Your gas order ({orderId}) has been received! Items: {items}. We'll be on our way shortly. — ÉPAG",
    preparing:      "Hi {name}! 🔧 We're preparing your order ({orderId}) now. Items: {items}. Dispatching soon! — ÉPAG",
    outfordelivery: "Hi {name}! 🛵 Your gas ({orderId}) is OUT FOR DELIVERY! Items: {items}. Coming to {address}. Almost there! — ÉPAG",
    delivered:      "Hi {name}! ✅ Your order ({orderId}) has been DELIVERED! Thank you for choosing ÉPAG. 🔥"
  }};
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
  return {...d,...s,tpl:{...d.tpl,...(s.tpl||{})}};
}
function buildWAMessage(status, order) {
  return (getSettings().tpl[status]||'')
    .replace(/{name}/g,order.name).replace(/{orderId}/g,order.id)
    .replace(/{items}/g,order.items).replace(/{address}/g,order.address||'');
}
function openWA(id) {
  const o = getOrders()[id]; if(!o) return;
  const p = (o.phone||'').replace(/\D/g,'');
  const ip = p.startsWith('0') ? '27'+p.slice(1) : p;
  window.open(`https://wa.me/${ip}?text=${encodeURIComponent(buildWAMessage(o.status,o))}`,'_blank');
}
function saveWaNum() {
  const s=getSettings(); s.waNum=document.getElementById('settingsWaNum').value;
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(s)); showToast('✅ Number saved!','success');
}
function saveTemplates() {
  const s=getSettings();
  s.tpl={received:document.getElementById('tpl-received').value,preparing:document.getElementById('tpl-preparing').value,outfordelivery:document.getElementById('tpl-outfordelivery').value,delivered:document.getElementById('tpl-delivered').value};
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(s)); showToast('✅ Templates saved!','success');
}

/* ── ADD ORDER ── */
function openAddModal()  { document.getElementById('addOrderModal').classList.add('open'); }
function closeAddModal() { document.getElementById('addOrderModal').classList.remove('open'); }
async function saveManualOrder() {
  const name=document.getElementById('ao-name').value.trim();
  const phone=document.getElementById('ao-phone').value.trim();
  const address=document.getElementById('ao-address').value.trim();
  const items=document.getElementById('ao-items').value.trim();
  const notes=document.getElementById('ao-notes').value.trim();
  if(!name||!phone||!address||!items){showToast('❌ Fill in all required fields','error');return;}
  const id='EG-'+Math.floor(1000+Math.random()*9000);
  const now=new Date().toISOString();
  await saveOrder(id,{id,name,phone,address,items,notes,status:'received',timestamps:{received:now},createdAt:now});
  closeAddModal(); showToast('✅ Order '+id+' added!','success');
  ['ao-name','ao-phone','ao-address','ao-items','ao-notes'].forEach(i=>document.getElementById(i).value='');
}

/* ── TOAST ── */
let toastTimer;
function showToast(msg,type='success'){
  const t=document.getElementById('toast'); document.getElementById('toastMsg').textContent=msg;
  t.className='toast show '+type; clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}

/* ── INIT ── */
function init() {
  const s = getSettings();
  document.getElementById('settingsWaNum').value      = s.waNum;
  document.getElementById('tpl-received').value       = s.tpl.received;
  document.getElementById('tpl-preparing').value      = s.tpl.preparing;
  document.getElementById('tpl-outfordelivery').value = s.tpl.outfordelivery;
  document.getElementById('tpl-delivered').value      = s.tpl.delivered;
  if (window._startOrdersListener) window._startOrdersListener();
  else setTimeout(()=>{ if(window._startOrdersListener) window._startOrdersListener(); },1500);
}