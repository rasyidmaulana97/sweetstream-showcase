// Tiny client-side demo for the static html/ version of Share.
// Persists "accounts" and "uploads" in localStorage. No real backend.
// This mirrors the React app's flows so the static folder is usable on its own.

const KEY_USERS = "share.users";
const KEY_SESSION = "share.session";
const KEY_UPLOADS = "share.uploads";

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const slug = (n = 10) => {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

// ---- Signup ----
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(signupForm);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    const users = read(KEY_USERS, {});
    if (users[email]) { alert("Account already exists. Log in instead."); return; }
    users[email] = { password };
    write(KEY_USERS, users);
    write(KEY_SESSION, { email });
    location.href = "./dashboard.html";
  });
}

// ---- Login ----
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const email = String(fd.get("email")).trim().toLowerCase();
    const password = String(fd.get("password"));
    const users = read(KEY_USERS, {});
    if (!users[email] || users[email].password !== password) {
      alert("Invalid email or password."); return;
    }
    write(KEY_SESSION, { email });
    location.href = "./dashboard.html";
  });
}

// ---- Dashboard ----
const uploadForm = document.getElementById("upload-form");
if (uploadForm) {
  const session = read(KEY_SESSION, null);
  if (!session) { location.href = "./login.html"; }
  else {
    document.getElementById("who").textContent = session.email;
    document.getElementById("logout").addEventListener("click", () => {
      localStorage.removeItem(KEY_SESSION);
      location.href = "./index.html";
    });

    const renderUploads = () => {
      const ul = document.getElementById("uploads");
      const all = read(KEY_UPLOADS, []);
      const mine = all.filter((u) => u.owner === session.email);
      ul.innerHTML = "";
      if (mine.length === 0) {
        ul.innerHTML = `<li class="muted">No uploads yet.</li>`;
        return;
      }
      for (const u of mine) {
        const li = document.createElement("li");
        const url = `${location.origin}${location.pathname.replace(/dashboard\.html$/, "")}view.html?s=${u.slug}`;
        li.innerHTML = `
          <div>
            <div><strong>${u.name}</strong></div>
            <div class="url">${url}</div>
          </div>
          <button class="btn btn-ghost" data-copy="${url}">Copy</button>
        `;
        ul.appendChild(li);
      }
      ul.querySelectorAll("[data-copy]").forEach((b) =>
        b.addEventListener("click", () => {
          navigator.clipboard.writeText(b.dataset.copy);
          b.textContent = "Copied";
          setTimeout(() => (b.textContent = "Copy"), 1200);
        })
      );
    };

    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(uploadForm);
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) return;
      if (file.size > 100 * 1024 * 1024) { alert("Max 100 MB."); return; }
      const days = Number(fd.get("expires"));
      const maxViews = Number(fd.get("views"));
      const dataUrl = await fileToDataUrl(file);
      const all = read(KEY_UPLOADS, []);
      all.push({
        slug: slug(),
        owner: session.email,
        name: file.name,
        type: file.type,
        dataUrl,
        views: 0,
        maxViews,
        expiresAt: Date.now() + days * 86400000,
      });
      write(KEY_UPLOADS, all);
      uploadForm.reset();
      renderUploads();
    });

    renderUploads();
  }
}

// ---- View page ----
const mediaHost = document.getElementById("media-host");
if (mediaHost) {
  const params = new URLSearchParams(location.search);
  const s = params.get("s");
  const all = read(KEY_UPLOADS, []);
  const item = all.find((u) => u.slug === s);
  const meta = document.getElementById("meta");

  if (!item) {
    mediaHost.innerHTML = `<p class="muted" style="color:#fff;padding:24px">Link not found.</p>`;
  } else if (Date.now() > item.expiresAt) {
    mediaHost.innerHTML = `<p class="muted" style="color:#fff;padding:24px">This link has expired.</p>`;
  } else if (item.views >= item.maxViews) {
    mediaHost.innerHTML = `<p class="muted" style="color:#fff;padding:24px">View limit reached.</p>`;
  } else {
    item.views += 1;
    write(KEY_UPLOADS, all);
    if (item.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = item.dataUrl; v.controls = true; v.playsInline = true;
      mediaHost.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = item.dataUrl; img.alt = item.name;
      mediaHost.appendChild(img);
    }
    meta.textContent = `${item.views}/${item.maxViews} views • expires ${new Date(item.expiresAt).toLocaleString()}`;
  }

  const dialog = document.getElementById("report-dialog");
  document.getElementById("report").addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "ok") alert("Report submitted. Thank you.");
  });
}
