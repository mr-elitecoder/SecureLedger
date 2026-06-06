const API = "http://localhost:5000/api";
function switchTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b, i) =>
      b.classList.toggle(
        "active",
        (i === 0 && tab === "login") || (i === 1 && tab === "register"),
      ),
    );
  document
    .getElementById("loginForm")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("registerForm")
    .classList.toggle("active", tab === "register");
  document.querySelector(".form-header h1").textContent =
    tab === "login" ? "Welcome back" : "Create account";
  document.querySelector(".form-header p").textContent =
    tab === "login"
      ? "Sign in to your SecureLedger account"
      : "Join SecureLedger today";
}
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  el.innerHTML = `<span>${type === "error" ? "⚠" : "✓"}</span> ${msg}`;
  el.className = `alert ${type} show`;
}
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim(),
    password = document.getElementById("loginPassword").value,
    btn = document.getElementById("loginBtn");
  if (!email || !password) {
    showAlert("loginAlert", "Please fill in all fields.", "error");
    return;
  }
  btn.textContent = "Signing in...";
  btn.classList.add("loading");
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) {
      showAlert("loginAlert", data.message, "error");
      return;
    }
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    showAlert("loginAlert", "Login successful! Redirecting...", "success");
    setTimeout(() => {
      window.location.href =
        data.user.role === "admin" ? "admin.html" : "dashboard.html";
    }, 700);
  } catch {
    showAlert("loginAlert", "Cannot connect to server.", "error");
  } finally {
    btn.textContent = "Sign In →";
    btn.classList.remove("loading");
  }
}
async function handleRegister() {
  const full_name = document.getElementById("regName").value.trim(),
    email = document.getElementById("regEmail").value.trim(),
    password = document.getElementById("regPassword").value,
    btn = document.getElementById("registerBtn");
  if (!full_name || !email || !password) {
    showAlert("registerAlert", "Please fill in all fields.", "error");
    return;
  }
  btn.textContent = "Creating...";
  btn.classList.add("loading");
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, password }),
    });
    const data = await res.json();
    if (!data.success) {
      showAlert("registerAlert", data.message, "error");
      return;
    }
    showAlert("registerAlert", "Account created! Please sign in.", "success");
    setTimeout(() => switchTab("login"), 1200);
  } catch {
    showAlert("registerAlert", "Cannot connect to server.", "error");
  } finally {
    btn.textContent = "Create Account →";
    btn.classList.remove("loading");
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  document.getElementById("loginForm").classList.contains("active")
    ? handleLogin()
    : handleRegister();
});
if (localStorage.getItem("token")) {
  const u = JSON.parse(localStorage.getItem("user") || "{}");
  window.location.href = u.role === "admin" ? "admin.html" : "dashboard.html";
}
