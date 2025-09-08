// ********** frontend/app.js (complete) **********
// IMPORTANT: set API to your Render URL
const API = "https://blood-pulse-token.onrender.com";

/* ---------- Helpers ---------- */
function escapeHtml(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function setToken(token) {
  if (!token) { localStorage.removeItem("bpt_token"); return; }
  localStorage.setItem("bpt_token", token);
}
function getToken() {
  return localStorage.getItem("bpt_token");
}
function authHeaders() {
  const t = getToken();
  return t ? { "Authorization": "Bearer " + t } : {};
}

/* ---------- Requests (public) ---------- */
async function getRequests(){
  try {
    const r = await fetch(API + "/api/requests");
    const data = await r.json();
    const container = document.getElementById("requestsList");
    container.innerHTML = "";
    if(!data.requests || data.requests.length === 0){
      container.innerHTML = "<div class='small'>No open requests</div>";
      return;
    }
    data.requests.forEach(req=>{
      const el = document.createElement("div");
      el.className = "request-card";
      el.innerHTML = `<strong>${escapeHtml(req.requester_name||"Anonymous")} (${escapeHtml(req.blood_group||"")})</strong>
        <div class="small">${escapeHtml(req.city||"")} ${escapeHtml(req.state||"")} • ${escapeHtml(req.phone||"")}</div>
        <div>${escapeHtml(req.notes||"")}</div>
        <div class="small">Posted: ${new Date(req.created_at).toLocaleString()}</div>`;
      container.appendChild(el);
    });
  } catch(e) {
    document.getElementById("requestsList").innerHTML = "<div class='small'>Error loading requests</div>";
    console.error(e);
  }
}

document.getElementById("requestForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const f = e.target;
  const payload = Object.fromEntries(new FormData(f));
  try {
    const res = await fetch(API + "/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    document.getElementById("requestResult").textContent = json.error ? ("Error: "+json.error) : "Request created!";
    if(json.ok) f.reset();
    getRequests();
  } catch(err) {
    document.getElementById("requestResult").textContent = "Network error";
    console.error(err);
  }
});

/* ---------- Public donors list ---------- */
async function loadDonorsList() {
  try {
    const r = await fetch(API + "/api/donors");
    const json = await r.json();
    const el = document.getElementById("donorsList");
    if (!el) return;
    if (!json.ok || !json.donors || json.donors.length === 0) {
      el.innerHTML = "<div class='small'>No donors listed</div>";
      return;
    }
    el.innerHTML = json.donors.map(d => `<div class="request-card"><strong>${escapeHtml(d.name||"Anonymous")}</strong><div class="small">${escapeHtml(d.city||"")} • ${escapeHtml(d.phone||"")}</div></div>`).join("");
  } catch (err) {
    console.error(err);
  }
}

/* ---------- NGO posts (public) ---------- */
async function loadNgoPosts() {
  try {
    const r = await fetch(API + "/api/ngo/posts");
    const json = await r.json();
    const el = document.getElementById("ngoPosts");
    if (!el) return;
    if (!json.ok || !json.posts || json.posts.length === 0) {
      el.innerHTML = "<div class='small'>No posts yet</div>";
      return;
    }
    el.innerHTML = json.posts.map(p => {
      const photo = (p.photos && p.photos[0]) ? `<img src="${p.photos[0]}" style="max-width:200px;display:block;margin-top:6px;" />` : "";
      return `<div class="request-card"><strong>${escapeHtml(p.title||"")}</strong><div class="small">${escapeHtml(p.location_text||"")}</div><div>${escapeHtml(p.description||"")}</div>${photo}<div class="small">Posted: ${new Date(p.created_at).toLocaleString()}</div></div>`;
    }).join("");
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Auth: register / login / logout ---------- */

async function loadProfileIfAny() {
  const token = getToken();
  if (!token) { showLoggedOut(); return; }
  try {
    const r = await fetch(API + "/api/profile", { headers: authHeaders() });
    const json = await r.json();
    if (!json.ok) { showLoggedOut(); return; }
    localStorage.setItem("bpt_user", JSON.stringify(json.user));
    const user = json.user;
    if (user.role === "ngo") {
      showLoggedIn(user);
      await loadMyPosts();
    } else if (user.role === "donor") {
      showDonor(user);
    } else {
      showLoggedIn(user);
    }
  } catch (err) {
    console.error(err);
    showLoggedOut();
  }
}

function showLoggedIn(user) {
  const authForms = document.getElementById("authForms");
  if(authForms) authForms.style.display = "none";
  const ngoPanel = document.getElementById("ngoPanel");
  if(ngoPanel) ngoPanel.style.display = "block";
  const donorPanel = document.getElementById("donorPanel");
  if(donorPanel) donorPanel.style.display = "none";
  const g = document.getElementById("ngoGreeting");
  if(g) g.textContent = (user && user.name) ? `${user.name} (${user.email})` : (user.email || "NGO");
}

function showDonor(user) {
  const authForms = document.getElementById("authForms");
  if(authForms) authForms.style.display = "none";
  const donorPanel = document.getElementById("donorPanel");
  if(donorPanel) donorPanel.style.display = "block";
  const ngoPanel = document.getElementById("ngoPanel");
  if(ngoPanel) ngoPanel.style.display = "none";
  const g = document.getElementById("donorGreeting");
  if(g) g.textContent = `${user.name || user.email} (donor)`;
  // prefill profile form
  const f = document.getElementById("donorProfileForm");
  if (f && user) {
    f.name.value = user.name || "";
    f.phone.value = user.phone || "";
    f.city.value = user.city || "";
  }
}

function showLoggedOut() {
  const authForms = document.getElementById("authForms");
  if(authForms) authForms.style.display = "block";
  const ngoPanel = document.getElementById("ngoPanel");
  if(ngoPanel) ngoPanel.style.display = "none";
  const donorPanel = document.getElementById("donorPanel");
  if(donorPanel) donorPanel.style.display = "none";
  localStorage.removeItem("bpt_token");
  localStorage.removeItem("bpt_user");
}

/* Register */
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  document.getElementById("registerResult").textContent = "Registering...";
  try {
    const res = await fetch(API + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.ok && json.token) {
      setToken(json.token);
      localStorage.setItem("bpt_user", JSON.stringify(json.user || { email: body.email }));
      document.getElementById("registerResult").textContent = "Registered and logged in";
      if(json.user.role === "donor") showDonor(json.user);
      else showLoggedIn(json.user);
      await loadMyPosts();
      await loadDonorsList();
    } else {
      document.getElementById("registerResult").textContent = json.error || "Registration failed";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("registerResult").textContent = "Network error";
  }
});

/* Login */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  document.getElementById("loginResult").textContent = "Logging in...";
  try {
    const res = await fetch(API + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.ok && json.token) {
      setToken(json.token);
      localStorage.setItem("bpt_user", JSON.stringify(json.user || { email: body.email }));
      document.getElementById("loginResult").textContent = "Logged in";
      if(json.user.role === "donor") showDonor(json.user);
      else showLoggedIn(json.user);
      await loadMyPosts();
      await loadDonorsList();
    } else {
      document.getElementById("loginResult").textContent = json.error || "Login failed";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("loginResult").textContent = "Network error";
  }
});

/* Logout (shared) */
const logoutBtn = document.getElementById("logoutBtn");
if(logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); showLoggedOut(); });
const logoutBtnDonor = document.getElementById("logoutBtnDonor");
if(logoutBtnDonor) logoutBtnDonor.addEventListener("click", (e) => { e.preventDefault(); showLoggedOut(); });

/* ---------- NGO: create post (file upload) ---------- */
document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = getToken();
  if(!token){ document.getElementById("postResult").textContent = "Please login"; return; }
  const form = new FormData(e.target);
  document.getElementById("postResult").textContent = "Uploading...";
  try {
    const res = await fetch(API + "/api/ngo/posts", {
      method: "POST",
      headers: authHeaders(),
      body: form
    });
    const json = await res.json();
    if(json.ok){
      document.getElementById("postResult").textContent = "Post uploaded";
      e.target.reset();
      await loadMyPosts();
      await loadNgoPosts();
    } else {
      document.getElementById("postResult").textContent = json.error || "Upload failed";
    }
  } catch(err) {
    console.error(err);
    document.getElementById("postResult").textContent = "Network error";
  }
});

/* ---------- My Posts (NGO) ---------- */
async function loadMyPosts(){
  const token = getToken();
  if(!token){ document.getElementById("myPosts").innerHTML = "<div class='small'>Login to see your posts</div>"; return; }
  try {
    const r = await fetch(API + "/api/ngo/posts", { headers: authHeaders() });
    const json = await r.json();
    if(!json.ok){ document.getElementById("myPosts").innerHTML = "<div class='small'>Error loading posts</div>"; return; }
    const user = JSON.parse(localStorage.getItem("bpt_user") || "{}");
    const posts = (json.posts || []).filter(p => String(p.ngo_id) === String(user.id));
    if(!posts.length) { document.getElementById("myPosts").innerHTML = "<div class='small'>No posts yet</div>"; return; }
    const html = posts.map(p => {
      const photo = (p.photos && p.photos[0]) ? `<img src="${p.photos[0]}" style="max-width:200px;display:block;margin-top:6px;" />` : "";
      return `<div class="request-card"><strong>${escapeHtml(p.title||"")}</strong><div class="small">${escapeHtml(p.location_text||"")}</div><div>${escapeHtml(p.description||"")}</div>${photo}<div class="small">Posted: ${new Date(p.created_at).toLocaleString()}</div></div>`;
    }).join("");
    document.getElementById("myPosts").innerHTML = html;
  } catch(err) {
    console.error(err);
    document.getElementById("myPosts").innerHTML = "<div class='small'>Error loading posts</div>";
  }
}

/* ---------- Donor profile (save) ---------- */
document.getElementById("donorProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  document.getElementById("donorProfileResult").textContent = "Saving...";
  try {
    const res = await fetch(API + "/api/profile", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if(json.ok){
      document.getElementById("donorProfileResult").textContent = "Profile saved";
      localStorage.setItem("bpt_user", JSON.stringify(json.user));
      await loadDonorsList();
    } else {
      document.getElementById("donorProfileResult").textContent = json.error || "Save failed";
    }
  } catch(err) {
    console.error(err);
    document.getElementById("donorProfileResult").textContent = "Network error";
  }
});

/* ---------- Page startup ---------- */
(async function initAll(){
  // initial public loads
  getRequests();
  loadDonorsList();
  loadNgoPosts();
  // try restore login & profile
  await loadProfileIfAny();
})();
