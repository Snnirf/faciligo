// =====================================================
// CONFIG
// =====================================================
const APP_NAME = 'FaciliGo';                         // palitan kung KeyTrack ang gusto
const ADMIN = { user: 'admin', pass: 'admin123' };   // demo lang. TODO Supabase Auth

// Petsa: ymd(0) = ngayon, ymd(1) = kahapon, atbp.
const ymd = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
};

// =====================================================
// MOCK DATABASE
// TODO Supabase: palitan ng supabase.from('table').select() / insert() / update()
// =====================================================
const DB = {
  students: [
    { sid: '2023-00123-BN-0', name: 'Juan Dela Cruz', section: 'BSIT 3-1', registered: true },
    { sid: '2023-00456-BN-0', name: 'Maria Santos',   section: 'BSIT 2-1', registered: true },
    { sid: '2023-00789-BN-0', name: 'Pedro Reyes',    section: 'BSIT 1-1', registered: false }
  ],
  rooms: [
    { id: 'R204', name: 'Room 204',       type: 'Classroom',  available: true },
    { id: 'R205', name: 'Room 205',       type: 'Classroom',  available: true },
    { id: 'CL1',  name: 'Computer Lab 1', type: 'Laboratory', available: true },
    { id: 'CL2',  name: 'Computer Lab 2', type: 'Laboratory', available: true },
    { id: 'CH1',  name: 'Chemistry Lab',  type: 'Laboratory', available: false }
  ],
  accessories: [
    { id: 'A1', name: 'HDMI cable',       available: true },
    { id: 'A2', name: 'Projector remote', available: true },
    { id: 'A3', name: 'Extension cord',   available: false }
  ],
  schedules: [
    { id: 1, room: 'R204', section: 'BSIT 3-1', day: 'Mon', start: '08:00', end: '10:00' },
    { id: 2, room: 'CL1',  section: 'BSIT 3-1', day: 'Tue', start: '13:00', end: '16:00' },
    { id: 3, room: 'R205', section: 'BSIT 2-1', day: 'Wed', start: '09:00', end: '11:00' },
    { id: 4, room: 'CL2',  section: 'BSIT 2-1', day: 'Thu', start: '10:00', end: '13:00' }
  ],
  reqs: [
    { id: 'TX-0001', sid: '2023-00456-BN-0', name: 'Maria Santos', room: 'R205', acc: ['HDMI cable'],
      status: 'approved', returned: false, date: ymd(1), time: '7:40 AM', code: 'FG-7K2Q9' },
    { id: 'TX-0002', sid: '2023-00123-BN-0', name: 'Juan Dela Cruz', room: 'CL2', acc: [],
      status: 'pending', returned: false, date: ymd(0), time: '8:05 AM',
      note: 'Room is not on the student’s class schedule' },
    { id: 'TX-0003', sid: '2023-00456-BN-0', name: 'Maria Santos', room: 'CL2', acc: ['Projector remote'],
      status: 'approved', returned: true, date: ymd(3), time: '1:10 PM', code: 'FG-3M8D1' },
    { id: 'TX-0004', sid: '2023-00789-BN-0', name: 'Pedro Reyes', room: 'R204', acc: [],
      status: 'rejected', returned: false, date: ymd(2), time: '9:15 AM',
      note: 'Your account is not registered. Visit the admin office.' },
    { id: 'TX-0005', sid: '2023-00123-BN-0', name: 'Juan Dela Cruz', room: 'CL1', acc: ['HDMI cable'],
      status: 'approved', returned: true, date: ymd(5), time: '12:50 PM', code: 'FG-9X4B2' }
  ]
};

// STATE: dito nakatago ang kasalukuyang nangyayari sa page
const S = {
  route: 'home',
  student: null,      // naka-login na student
  admin: false,       // naka-login na admin
  last: null,         // huling request ng student
  lastChecks: [],     // resulta ng checks ng huling request
  edit: null,         // student na ine-edit
  q: '',              // search text
  filter: 'all',      // filter ng requests
  period: 'daily',    // period ng reports
  detail: null        // request na binubuksan sa admin
};

// =====================================================
// HELPERS
// =====================================================
const v = (id) => document.getElementById(id).value.trim();

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LABEL = {
  approved: 'Approved', pending: 'Pending', rejected: 'Rejected',
  borrowed: 'Borrowed', returned: 'Returned'
};
const badge = (kind, label) => `<span class="badge b-${kind}">${label || LABEL[kind]}</span>`;

const roomOf = (id) => DB.rooms.find((r) => r.id === id);
const rname = (id) => (roomOf(id) ? roomOf(id).name : id);

// Nakahiram ba ngayon ang key?
const keyOut = (roomId) =>
  DB.reqs.some((r) => r.room === roomId && r.status === 'approved' && !r.returned);

// Free ba ang room key? (available sa records AT wala sa kamay ng iba)
const isFree = (room) => room.available && !keyOut(room.id);

// Mga hindi pa naibabalik ng student
const unreturned = (sid) =>
  DB.reqs.filter((r) => r.sid === sid && r.status === 'approved' && !r.returned);

// Status para sa tables: approved + hindi pa naibalik = "borrowed"
const txStatus = (r) => (r.status === 'approved' ? (r.returned ? 'returned' : 'borrowed') : r.status);

const newTx = () => 'TX-' + String(DB.reqs.length + 1).padStart(4, '0');
const newCode = () => 'FG-' + Math.random().toString(36).slice(2, 7).toUpperCase();

function toast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// Gumagawa ng table. rows = HTML string ng <tr>
const table = (heads, rows, bodyId = '') => `
  <div class="wrap">
    <table>
      <thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody ${bodyId ? `id="${bodyId}"` : ''}>
        ${rows || `<tr><td colspan="${heads.length}">Nothing here yet.</td></tr>`}
      </tbody>
    </table>
  </div>`;

const tr = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;

const cards = (list) => `
  <div class="cards">
    ${list.map(([n, l]) => `<div class="card"><b>${n}</b><span>${l}</span></div>`).join('')}
  </div>`;

// =====================================================
// 1. LANDING PAGE
// =====================================================
function home() {
  return `
    <section class="hero">
      <h1>${APP_NAME}: room keys, without the paperwork.</h1>
      <p>
        Request a room key or equipment online, get checked automatically,
        and pick it up with a QR code. No logbooks, no ID deposits.
      </p>
      <div class="cta">
        <button class="btn gold lg" data-go="student-info">Student Portal</button>
        <button class="btn ghost lg" data-go="admin-login">Admin Login</button>
      </div>
    </section>

    <section class="about" id="about">
      <h2>About ${APP_NAME}</h2>
      <p class="lead">
        ${APP_NAME} is a web-based room key and equipment borrowing system for
        PUP Biñan Campus. It checks every request against registration,
        class schedule, key availability, and unreturned items, then keeps a
        record of every borrowing and return.
      </p>
      <div class="steps">
        <div class="panel"><b>1</b><h3>Request</h3><p class="hint">Enter your name and student ID, then choose a room and accessories.</p></div>
        <div class="panel"><b>2</b><h3>Get checked</h3><p class="hint">The system approves or rejects your request automatically.</p></div>
        <div class="panel"><b>3</b><h3>Show your QR</h3><p class="hint">Present the QR code at the kiosk to get your key.</p></div>
      </div>
    </section>`;
}

// =====================================================
// 2. STUDENT PORTAL
// =====================================================

// 2.1 Student information
function studentInfo() {
  return `
    <div class="panel" style="max-width:460px;margin:24px auto">
      <h1 style="font-size:28px">Student Portal</h1>
      <p class="lead" style="margin-bottom:0">Enter your details so we can find your student record.</p>

      <label for="nm">Student name</label>
      <input id="nm" type="text" autocomplete="name" placeholder="Juan Dela Cruz">

      <label for="sid">Student ID number</label>
      <input id="sid" type="text" placeholder="2023-00123-BN-0">

      <div class="row" style="margin-top:18px">
        <button class="btn" data-act="login-student">Continue</button>
        <button class="btn ghost" data-go="home">Back</button>
      </div>
      <p class="hint">Demo: 2023-00123-BN-0 Juan Dela Cruz · 2023-00456-BN-0 Maria Santos · 2023-00789-BN-0 Pedro Reyes (not registered)</p>
    </div>`;
}

// 2.2 Student dashboard
function sDashboard() {
  const u = S.student;
  const mine = DB.reqs.filter((r) => r.sid === u.sid).slice().reverse();
  const borrowed = mine.filter((r) => txStatus(r) === 'borrowed');
  const pending = mine.filter((r) => r.status === 'pending');

  const roomRows = DB.rooms.map((r) =>
    tr([r.name, r.type, isFree(r) ? badge('approved', 'Available') : badge('rejected', 'Not available')])
  ).join('');

  const accChips = DB.accessories.map((a) =>
    `<span class="chip">${a.name}: ${a.available ? 'available' : 'unavailable'}</span>`
  ).join('');

  const miniRows = (list) => list.map((r) =>
    tr([r.id, rname(r.room), `${r.date} ${r.time}`, badge(txStatus(r))])
  ).join('');

  return `
    <div class="row" style="justify-content:space-between">
      <div>
        <h1>Welcome, ${esc(u.name.split(' ')[0])}</h1>
        <p class="lead" style="margin-bottom:0">${esc(u.name)} · ${u.sid} · ${esc(u.section)}</p>
      </div>
      <button class="btn lg" data-go="s-request">Borrowing Request</button>
    </div>

    ${cards([[borrowed.length, 'Currently borrowed'], [pending.length, 'Pending requests']])}

    <h2>Available rooms and equipment</h2>
    ${table(['Room', 'Type', 'Key'], roomRows)}
    <div class="chips">${accChips}</div>

    <h2 class="sec">Current borrowing status</h2>
    ${table(['Transaction', 'Room', 'Date', 'Status'], miniRows(borrowed))}

    <h2 class="sec">Pending requests</h2>
    ${table(['Transaction', 'Room', 'Date', 'Status'], miniRows(pending))}

    <h2 class="sec">Previous transactions</h2>
    ${table(['Transaction', 'Room', 'Date', 'Status'], miniRows(mine.slice(0, 5)))}
    <button class="btn ghost" data-go="s-history">View full history</button>`;
}

// 2.3 Borrowing request
function roomInfo(id) {
  const r = roomOf(id);
  const sched = DB.schedules.filter((x) => x.room === id)
    .map((x) => `${x.section} ${x.day} ${x.start}–${x.end}`).join('; ');
  return `
    <b>${r.name}</b> · ${r.type}<br>
    Key: ${isFree(r) ? badge('approved', 'Available') : badge('rejected', 'Not available')}<br>
    <span class="hint">Scheduled: ${sched || 'No class schedule yet'}</span>`;
}

function sRequest() {
  const roomOptions = DB.rooms.map((r) =>
    `<option value="${r.id}">${r.name} (${r.type})${isFree(r) ? '' : ' – not available'}</option>`
  ).join('');

  const accBoxes = DB.accessories.filter((a) => a.available).map((a) =>
    `<label class="chk"><input type="checkbox" name="acc" value="${a.name}"> ${a.name}</label>`
  ).join('') || '<p class="hint">No accessories available right now.</p>';

  return `
    <h1>Borrowing request</h1>
    <p class="lead">Choose the room key and any accessories you need.</p>
    <div class="panel" style="max-width:560px">
      <label for="room">Room or laboratory (key)</label>
      <select id="room">${roomOptions}</select>
      <div id="info" class="hint" style="margin-top:12px">${roomInfo(DB.rooms[0].id)}</div>

      <label>Accessories</label>
      ${accBoxes}

      <div class="row" style="margin-top:18px">
        <button class="btn" data-act="submit-request">Submit request</button>
        <button class="btn ghost" data-go="s-dashboard">Cancel</button>
      </div>
    </div>`;
}

// Rule-based authorization
function submitRequest() {
  const u = S.student;
  const roomId = v('room');
  const room = roomOf(roomId);
  const acc = [...document.querySelectorAll('[name=acc]:checked')].map((c) => c.value);

  const checks = [
    { label: 'Registered student',               ok: u.registered },
    { label: 'Key is available',                 ok: isFree(room) },
    { label: 'No unreturned items',              ok: unreturned(u.sid).length === 0 },
    { label: 'Room matches your class schedule', ok: DB.schedules.some((s) => s.room === roomId && s.section === u.section) }
  ];

  const req = {
    id: newTx(), sid: u.sid, name: u.name, room: roomId, acc,
    returned: false, date: ymd(0),
    time: new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  };

  if (!checks[0].ok || !checks[1].ok || !checks[2].ok) {
    req.status = 'rejected';
    req.note = !checks[0].ok ? 'Your account is not registered. Visit the admin office.'
             : !checks[1].ok ? 'This key is not available right now. Try another room.'
             : 'Return your borrowed items before requesting another key.';
  } else if (!checks[3].ok) {
    req.status = 'pending';
    req.note = 'Room is not on the student’s class schedule';
  } else {
    req.status = 'approved';
    req.code = newCode();
  }

  // TODO Supabase: await supabase.from('requests').insert(req)
  DB.reqs.push(req);
  S.last = req;
  S.lastChecks = checks;
  go('s-status');
}

// 2.4 Request status
function sStatus() {
  const r = S.last;
  if (!r) return '<p>No request yet.</p><button class="btn" data-go="s-request">Make a request</button>';

  const checkList = S.lastChecks.map((c) =>
    `<li><span class="${c.ok ? 'y' : 'n'}">${c.ok ? '✓' : '✗'}</span> ${c.label}</li>`
  ).join('');

  const message = {
    approved: 'Your request passed every check. You can now get your QR code.',
    pending:  'A facilitator needs to review your request. Check your dashboard later.',
    rejected: esc(r.note || '')
  }[r.status];

  return `
    <div class="panel" style="max-width:520px;margin:20px auto">
      <h1 style="font-size:28px">Request status</h1>
      <p style="margin:10px 0">${badge(r.status)} &nbsp; ${r.id} · ${rname(r.room)}</p>
      <ul class="checks">${checkList}</ul>
      <p class="hint">${message}</p>
      <div class="row" style="margin-top:16px">
        ${r.status === 'approved' ? '<button class="btn" data-go="s-qr">Proceed to QR code</button>' : ''}
        <button class="btn ghost" data-go="s-dashboard">Back to dashboard</button>
      </div>
    </div>`;
}

// 2.5 QR code page
function sQr() {
  const r = S.last;
  if (!r || r.status !== 'approved') {
    return '<p>No approved request yet.</p><button class="btn" data-go="s-request">Make a request</button>';
  }
  const u = S.student;
  return `
    <div style="max-width:420px;margin:10px auto">
      <div class="tag">
        <div class="room">${rname(r.room)}</div>
        <div>${badge('approved')}</div>
        <div class="qr" id="qr"></div>
        <div class="code">${r.code}</div>

        <dl class="info">
          <dt>Transaction ID</dt><dd>${r.id}</dd>
          <dt>Student</dt><dd>${esc(u.name)}<br>${u.sid}</dd>
          <dt>Room / key</dt><dd>${rname(r.room)}</dd>
          <dt>Accessories</dt><dd>${r.acc.join(', ') || 'None'}</dd>
          <dt>Request date</dt><dd>${r.date} ${r.time}</dd>
          <dt>Status</dt><dd>Approved</dd>
        </dl>

        <ol class="steps-list">
          <li>Go to the ${APP_NAME} kiosk.</li>
          <li>Present this QR code to the scanner.</li>
          <li>Get your key from the compartment.</li>
          <li>Return it when you are done.</li>
        </ol>
      </div>
      <div class="row" style="margin-top:16px;justify-content:center">
        <button class="btn ghost" data-go="s-history">View history</button>
        <button class="btn ghost" data-go="s-dashboard">Dashboard</button>
      </div>
    </div>`;
}

// 2.6 Borrowing history
function sHistory() {
  const rows = DB.reqs.filter((r) => r.sid === S.student.sid).slice().reverse().map((r) =>
    tr([
      r.id,
      rname(r.room),
      r.acc.join(', ') || '–',
      `${r.date} ${r.time}`,
      badge(r.status),
      r.status === 'approved' ? badge(r.returned ? 'returned' : 'borrowed') : '–'
    ])
  ).join('');

  return `
    <h1>Borrowing history</h1>
    <p class="lead">Your previous requests, items borrowed, and return status.</p>
    ${table(['Transaction', 'Room / key', 'Accessories', 'Date', 'Request', 'Return status'], rows)}`;
}

// =====================================================
// 3. ADMIN / FACILITATOR
// =====================================================
function adminLogin() {
  return `
    <div class="panel" style="max-width:420px;margin:24px auto">
      <h1 style="font-size:28px">Admin login</h1>
      <label for="au">Username</label>
      <input id="au" type="text" autocomplete="username">
      <label for="ap">Password</label>
      <input id="ap" type="password" autocomplete="current-password"
        style="width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit">
      <div class="row" style="margin-top:18px">
        <button class="btn" data-act="login-admin">Log in</button>
        <button class="btn ghost" data-go="home">Back</button>
      </div>
      <p class="hint">Demo: admin / admin123</p>
    </div>`;
}

function adminShell(route, html) {
  const items = [
    ['a-dashboard', 'Overview'], ['a-students', 'Students'], ['a-rooms', 'Rooms and equipment'],
    ['a-schedules', 'Schedules'], ['a-requests', 'Requests'],
    ['a-transactions', 'Transactions'], ['a-reports', 'Reports']
  ];
  return `
    <div class="shell">
      <nav class="menu" aria-label="Admin pages">
        ${items.map(([k, l]) => `<button data-go="${k}" ${route === k ? 'aria-current="true"' : ''}>${l}</button>`).join('')}
      </nav>
      <section>${html}</section>
    </div>`;
}

// 3.1 Dashboard overview
function aDashboard() {
  const count = (s) => DB.reqs.filter((r) => r.status === s).length;
  const active = DB.reqs.filter((r) => txStatus(r) === 'borrowed');
  const overdue = active.filter((r) => r.date < ymd(0));

  const recent = DB.reqs.slice().reverse().slice(0, 6).map((r) =>
    tr([r.id, esc(r.name), rname(r.room), `${r.date} ${r.time}`, badge(txStatus(r))])
  ).join('');

  return `
    <h1>Overview</h1>
    ${cards([
      [DB.students.filter((s) => s.registered).length, 'Registered students'],
      [DB.rooms.filter(isFree).length, 'Available keys'],
      [active.length, 'Active borrowings'],
      [count('approved'), 'Approved requests'],
      [count('rejected'), 'Rejected requests'],
      [overdue.length, 'Unreturned items']
    ])}
    <h2>Recent activity</h2>
    ${table(['Transaction', 'Student', 'Room', 'Date', 'Status'], recent)}`;
}

// 3.2 Student management
const studentRows = () =>
  DB.students
    .filter((s) => (s.sid + s.name + s.section).toLowerCase().includes(S.q.toLowerCase()))
    .map((s) => tr([
      s.sid, esc(s.name), esc(s.section),
      s.registered ? badge('approved', 'Registered') : badge('rejected', 'Not registered'),
      `<button class="btn ghost sm" data-act="edit-student" data-id="${s.sid}">Edit</button>`
    ])).join('');

function aStudents() {
  const e = DB.students.find((s) => s.sid === S.edit) || {};
  return `
    <h1>Students</h1>
    <div class="panel">
      <h2>${S.edit ? 'Update student' : 'Add student'}</h2>
      <div class="form-grid">
        <div><label for="f-sid">Student ID</label>
          <input id="f-sid" type="text" value="${e.sid || ''}" ${S.edit ? 'readonly' : ''}></div>
        <div><label for="f-name">Name</label>
          <input id="f-name" type="text" value="${esc(e.name || '')}"></div>
        <div><label for="f-sec">Section</label>
          <input id="f-sec" type="text" value="${esc(e.section || '')}" placeholder="BSIT 3-1"></div>
        <div><label for="f-reg">Registered</label>
          <select id="f-reg">
            <option value="yes" ${e.registered === false ? '' : 'selected'}>Yes</option>
            <option value="no" ${e.registered === false ? 'selected' : ''}>No</option>
          </select></div>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-act="save-student">${S.edit ? 'Save changes' : 'Add student'}</button>
        ${S.edit ? '<button class="btn ghost" data-act="cancel-edit">Cancel</button>' : ''}
      </div>
    </div>

    <div class="toolbar">
      <input id="q" type="text" placeholder="Search name, ID, or section" value="${esc(S.q)}">
    </div>
    ${table(['Student ID', 'Name', 'Section', 'Status', ''], studentRows(), 'rows')}`;
}

// 3.3 Room and equipment management
function aRooms() {
  const roomRows = DB.rooms.map((r) => tr([
    r.name, r.type,
    r.available ? badge('approved', 'Available') : badge('rejected', 'Unavailable'),
    keyOut(r.id) ? badge('borrowed', 'Key is out') : '–',
    `<button class="btn ghost sm" data-act="toggle-room" data-id="${r.id}">
       ${r.available ? 'Mark unavailable' : 'Mark available'}</button>`
  ])).join('');

  const accRows = DB.accessories.map((a) => tr([
    a.name,
    a.available ? badge('approved', 'Available') : badge('rejected', 'Unavailable'),
    `<button class="btn ghost sm" data-act="toggle-acc" data-id="${a.id}">
       ${a.available ? 'Mark unavailable' : 'Mark available'}</button>`
  ])).join('');

  return `
    <h1>Rooms and equipment</h1>

    <h2>Rooms and room keys</h2>
    ${table(['Room', 'Type', 'Availability', 'Key', ''], roomRows)}
    <div class="panel">
      <div class="form-grid">
        <div><label for="r-name">Room name</label><input id="r-name" type="text" placeholder="Room 301"></div>
        <div><label for="r-type">Type</label>
          <select id="r-type"><option>Classroom</option><option>Laboratory</option></select></div>
        <div><button class="btn" data-act="add-room">Add room</button></div>
      </div>
    </div>

    <h2 class="sec">Accessories</h2>
    ${table(['Accessory', 'Availability', ''], accRows)}
    <div class="panel">
      <div class="form-grid">
        <div><label for="a-name">Accessory name</label><input id="a-name" type="text" placeholder="VGA cable"></div>
        <div><button class="btn" data-act="add-acc">Add accessory</button></div>
      </div>
    </div>`;
}

// 3.4 Schedule management
function aSchedules() {
  const rows = DB.schedules.map((s) => tr([
    rname(s.room), esc(s.section), s.day, `${s.start}–${s.end}`,
    `<button class="btn ghost sm" data-act="del-sched" data-id="${s.id}">Delete</button>`
  ])).join('');

  return `
    <h1>Schedules</h1>
    ${table(['Room', 'Section', 'Day', 'Time', ''], rows)}
    <div class="panel">
      <h2>Add schedule</h2>
      <div class="form-grid">
        <div><label for="s-room">Room</label>
          <select id="s-room">${DB.rooms.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}</select></div>
        <div><label for="s-sec">Section</label><input id="s-sec" type="text" placeholder="BSIT 3-1"></div>
        <div><label for="s-day">Day</label>
          <select id="s-day">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<option>${d}</option>`).join('')}</select></div>
        <div><label for="s-start">Start</label><input id="s-start" type="text" placeholder="08:00"></div>
        <div><label for="s-end">End</label><input id="s-end" type="text" placeholder="10:00"></div>
      </div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="add-sched">Add schedule</button></div>
    </div>`;
}

// 3.5 Borrowing request management
function aRequests() {
  const list = DB.reqs.filter((r) => S.filter === 'all' || r.status === S.filter).slice().reverse();

  const rows = list.map((r) => tr([
    r.id, esc(r.name), rname(r.room), `${r.date} ${r.time}`, badge(r.status),
    `<div class="row">
       <button class="btn ghost sm" data-act="detail" data-id="${r.id}">Details</button>
       ${r.status === 'pending'
         ? `<button class="btn ok sm" data-act="approve" data-id="${r.id}">Approve</button>
            <button class="btn bad sm" data-act="reject" data-id="${r.id}">Reject</button>`
         : ''}
     </div>`
  ])).join('');

  const d = DB.reqs.find((r) => r.id === S.detail);
  const detail = d ? `
    <div class="panel" style="margin-bottom:20px">
      <div class="row" style="justify-content:space-between">
        <h2>${d.id}</h2><button class="btn ghost sm" data-act="close-detail">Close</button>
      </div>
      <dl class="info">
        <dt>Student</dt><dd>${esc(d.name)} (${d.sid})</dd>
        <dt>Room / key</dt><dd>${rname(d.room)}</dd>
        <dt>Accessories</dt><dd>${d.acc.join(', ') || 'None'}</dd>
        <dt>Submitted</dt><dd>${d.date} ${d.time}</dd>
        <dt>Status</dt><dd>${LABEL[d.status]}</dd>
        <dt>Notes</dt><dd>${esc(d.note || '–')}</dd>
        <dt>QR code</dt><dd>${d.code || '–'}</dd>
      </dl>
    </div>` : '';

  return `
    <h1>Borrowing requests</h1>
    <p class="lead">Requests are checked automatically. Only requests outside the rules wait for review.</p>
    <div class="toolbar">
      <select id="flt" aria-label="Filter by status">
        ${['all', 'pending', 'approved', 'rejected'].map((f) =>
          `<option value="${f}" ${S.filter === f ? 'selected' : ''}>${f === 'all' ? 'All requests' : LABEL[f]}</option>`).join('')}
      </select>
    </div>
    ${detail}
    ${table(['Transaction', 'Student', 'Room', 'Date', 'Status', ''], rows)}`;
}

// 3.6 Transaction management
function aTransactions() {
  const all = DB.reqs.filter((r) => r.status === 'approved').slice().reverse();
  const out = all.filter((r) => !r.returned);
  const back = all.filter((r) => r.returned);

  const outRows = out.map((r) => tr([
    r.id, esc(r.name), rname(r.room), r.acc.join(', ') || '–', `${r.date} ${r.time}`,
    `<button class="btn ghost sm" data-act="return" data-id="${r.id}">Mark returned</button>`
  ])).join('');

  const histRows = (list) => list.map((r) => tr([
    r.id, esc(r.name), rname(r.room), r.acc.join(', ') || '–', `${r.date} ${r.time}`, badge(txStatus(r))
  ])).join('');

  return `
    <h1>Transactions</h1>
    <h2>Currently borrowed</h2>
    ${table(['Transaction', 'Borrower', 'Room / key', 'Accessories', 'Date', ''], outRows)}
    <h2 class="sec">Returned items</h2>
    ${table(['Transaction', 'Borrower', 'Room / key', 'Accessories', 'Date', 'Status'], histRows(back))}
    <h2 class="sec">Transaction history</h2>
    ${table(['Transaction', 'Borrower', 'Room / key', 'Accessories', 'Date', 'Status'], histRows(all))}`;
}

// 3.7 Reports
function aReports() {
  const cutoff = { daily: ymd(0), weekly: ymd(6), monthly: ymd(29) }[S.period];
  const inPeriod = DB.reqs.filter((r) => r.date >= cutoff).slice().reverse();
  const n = (s) => inPeriod.filter((r) => r.status === s).length;

  const rows = inPeriod.map((r) =>
    tr([r.id, esc(r.name), rname(r.room), `${r.date} ${r.time}`, badge(txStatus(r))])
  ).join('');

  const resources = [
    ...DB.rooms.map((r) => tr([r.name + ' (key)', isFree(r) ? badge('approved', 'Available') : badge('rejected', 'Unavailable')])),
    ...DB.accessories.map((a) => tr([a.name, a.available ? badge('approved', 'Available') : badge('rejected', 'Unavailable')]))
  ].join('');

  const unret = DB.reqs.filter((r) => txStatus(r) === 'borrowed').map((r) =>
    tr([r.id, esc(r.name), rname(r.room), r.acc.join(', ') || '–', r.date])
  ).join('');

  return `
    <h1>Reports</h1>
    <div class="toolbar">
      <select id="per" aria-label="Report period">
        <option value="daily"   ${S.period === 'daily' ? 'selected' : ''}>Daily (today)</option>
        <option value="weekly"  ${S.period === 'weekly' ? 'selected' : ''}>Weekly (last 7 days)</option>
        <option value="monthly" ${S.period === 'monthly' ? 'selected' : ''}>Monthly (last 30 days)</option>
      </select>
      <button class="btn ghost" onclick="window.print()">Print</button>
    </div>
    ${cards([[inPeriod.length, 'Total requests'], [n('approved'), 'Approved'], [n('rejected'), 'Rejected'], [n('pending'), 'Pending']])}
    <h2>Borrowing records</h2>
    ${table(['Transaction', 'Student', 'Room', 'Date', 'Status'], rows)}
    <h2 class="sec">Available and unavailable resources</h2>
    ${table(['Resource', 'Status'], resources)}
    <h2 class="sec">Unreturned items</h2>
    ${table(['Transaction', 'Borrower', 'Room / key', 'Accessories', 'Borrowed on'], unret)}`;
}

// =====================================================
// ROUTER AT RENDER
// =====================================================
const PAGES = {
  'home': home, 'student-info': studentInfo, 'admin-login': adminLogin,
  's-dashboard': sDashboard, 's-request': sRequest, 's-status': sStatus,
  's-qr': sQr, 's-history': sHistory,
  'a-dashboard': aDashboard, 'a-students': aStudents, 'a-rooms': aRooms,
  'a-schedules': aSchedules, 'a-requests': aRequests,
  'a-transactions': aTransactions, 'a-reports': aReports
};

function go(route) {
  if (location.hash.slice(1) === route) render();
  else location.hash = route;
}

function renderNav(route) {
  let items;
  if (route.startsWith('a-')) {
    items = [['home', 'Home'], ['logout', 'Log out']];
  } else if (route.startsWith('s-')) {
    items = [['s-dashboard', 'Dashboard'], ['s-request', 'Request'], ['s-history', 'History'], ['logout', 'Log out']];
  } else {
    items = [['home', 'Home'], ['about', 'About'], ['student-info', 'Student Portal'], ['admin-login', 'Admin Login']];
  }
  nav.innerHTML = items.map(([k, l]) =>
    `<button data-go="${k}" ${route === k ? 'aria-current="true"' : ''}>${l}</button>`
  ).join('');
}

function render() {
  let route = location.hash.slice(1) || 'home';
  if (!PAGES[route]) route = 'home';
  if (route.startsWith('s-') && !S.student) route = 'student-info';
  if (route.startsWith('a-') && !S.admin) route = 'admin-login';
  S.route = route;

  document.title = APP_NAME;
  document.querySelector('.brand').firstChild.textContent = APP_NAME;

  renderNav(route);
  const html = PAGES[route]();
  app.innerHTML = route.startsWith('a-') ? adminShell(route, html) : html;
  window.scrollTo(0, 0);

  // Iguhit ang QR code sa QR page
  const qr = document.getElementById('qr');
  if (qr && S.last) {
    if (window.QRCode) {
      new QRCode(qr, { text: S.last.id + '|' + S.last.code + '|' + S.last.sid, width: 150, height: 150 });
    } else {
      qr.textContent = S.last.code; // fallback kung hindi na-load ang library
    }
  }
}

// =====================================================
// EVENTS
// =====================================================
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-act]');
  if (!t) return;

  // ----- Navigation -----
  if (t.dataset.go) {
    const dest = t.dataset.go;
    if (dest === 'logout') {
      S.student = null; S.admin = false; S.last = null;
      return go('home');
    }
    if (dest === 'about') {
      if (S.route !== 'home') { location.hash = 'home'; render(); }
      return document.getElementById('about').scrollIntoView({ behavior: 'smooth' });
    }
    return go(dest);
  }

  // ----- Actions -----
  const id = t.dataset.id;
  switch (t.dataset.act) {

    case 'login-student': {
      const found = DB.students.find((s) => s.sid === v('sid'));
      // TODO Supabase: hanapin ang student sa 'students' table
      if (!found || found.name.toLowerCase() !== v('nm').toLowerCase()) {
        return toast('Name and student ID do not match a record.');
      }
      S.student = found;
      return go('s-dashboard');
    }

    case 'login-admin':
      // TODO Supabase: supabase.auth.signInWithPassword(...)
      if (v('au') === ADMIN.user && v('ap') === ADMIN.pass) {
        S.admin = true;
        return go('a-dashboard');
      }
      return toast('Wrong username or password.');

    case 'submit-request': return submitRequest();

    // ----- Students -----
    case 'save-student': {
      const data = { sid: v('f-sid'), name: v('f-name'), section: v('f-sec'), registered: v('f-reg') === 'yes' };
      if (!data.sid || !data.name || !data.section) return toast('Fill in all fields.');
      const existing = DB.students.find((s) => s.sid === data.sid);
      // TODO Supabase: insert o update sa 'students'
      if (existing) Object.assign(existing, data); else DB.students.push(data);
      toast(existing ? 'Student updated' : 'Student added');
      S.edit = null;
      return render();
    }
    case 'edit-student':   S.edit = id; return render();
    case 'cancel-edit':    S.edit = null; return render();

    // ----- Rooms at accessories -----
    case 'toggle-room': { const r = roomOf(id); r.available = !r.available; return render(); }
    case 'toggle-acc':  { const a = DB.accessories.find((x) => x.id === id); a.available = !a.available; return render(); }
    case 'add-room': {
      if (!v('r-name')) return toast('Enter a room name.');
      DB.rooms.push({ id: 'R' + Date.now(), name: v('r-name'), type: v('r-type'), available: true });
      toast('Room added'); return render();
    }
    case 'add-acc': {
      if (!v('a-name')) return toast('Enter an accessory name.');
      DB.accessories.push({ id: 'A' + Date.now(), name: v('a-name'), available: true });
      toast('Accessory added'); return render();
    }

    // ----- Schedules -----
    case 'add-sched': {
      if (!v('s-sec') || !v('s-start') || !v('s-end')) return toast('Fill in all fields.');
      DB.schedules.push({ id: Date.now(), room: v('s-room'), section: v('s-sec'), day: v('s-day'), start: v('s-start'), end: v('s-end') });
      toast('Schedule added'); return render();
    }
    case 'del-sched':
      DB.schedules = DB.schedules.filter((s) => String(s.id) !== id);
      return render();

    // ----- Requests at transactions -----
    case 'detail':       S.detail = id; return render();
    case 'close-detail': S.detail = null; return render();
    case 'approve': {
      const r = DB.reqs.find((x) => x.id === id);
      r.status = 'approved'; r.code = newCode();
      toast('Request approved'); return render();
    }
    case 'reject': {
      const r = DB.reqs.find((x) => x.id === id);
      r.status = 'rejected'; r.note = 'Rejected by facilitator';
      toast('Request rejected'); return render();
    }
    case 'return': {
      DB.reqs.find((x) => x.id === id).returned = true;
      toast('Marked as returned'); return render();
    }
  }
});

// Pagpalit ng dropdown (room info, filter, report period)
document.addEventListener('change', (e) => {
  if (e.target.id === 'room')  document.getElementById('info').innerHTML = roomInfo(e.target.value);
  if (e.target.id === 'flt')   { S.filter = e.target.value; render(); }
  if (e.target.id === 'per')   { S.period = e.target.value; render(); }
});

// Search ng students (hindi nire-render ang buong page para hindi mawala ang cursor)
document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  S.q = e.target.value;
  document.getElementById('rows').innerHTML =
    studentRows() || '<tr><td colspan="5">No matching students.</td></tr>';
});

window.addEventListener('hashchange', () => {
  if ((location.hash.slice(1) || 'home') !== S.route) render();
});

render();