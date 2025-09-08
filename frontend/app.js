const API = "https://blood-pulse-token.onrender.com";  // 👈 your Render backend URL

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

function escapeHtml(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

getRequests();
