const API = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "null");
if (!token || !user || user.role !== "admin")
  window.location.href = "index.html";
document.getElementById("adminName").textContent = user.full_name;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

let fraudTrendChart, fraudSeverityChart;

function switchPanel(name, btn) {
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".page-tab")
    .forEach((b) => b.classList.remove("active"));
  document.getElementById(`panel${name}`).classList.add("active");
  btn.classList.add("active");
}

async function loadAlerts() {
  try {
    const res = await fetch(`${API}/admin/fraud-alerts`, { headers });
    const data = await res.json();
    if (!data.success) return;
    const alerts = data.alerts;
    document.getElementById("statAlerts").textContent = alerts.filter(
      (a) => !a.is_reviewed,
    ).length;
    const tbody = document.getElementById("alertsBody");
    if (!alerts.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty">No fraud alerts — all clear!</td></tr>';
      return;
    }
    tbody.innerHTML = alerts
      .map(
        (a) => `
                <tr>
                    <td><strong>${a.flagged_user}</strong><div class="sub">${
                      a.flagged_email
                    }</div></td>
                    <td style="color:var(--warn);font-weight:500;max-width:180px">${
                      a.reason
                    }</td>
                    <td><span class="badge ${a.severity}">${
                      a.severity
                    }</span></td>
                    <td style="font-weight:700;color:var(--danger)">PKR ${Number(
                      a.amount,
                    ).toLocaleString()}</td>
                    <td style="color:var(--muted)">${new Date(
                      a.created_at,
                    ).toLocaleString("en-PK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}</td>
                    <td>${
                      a.is_reviewed
                        ? '<span class="badge reviewed">Reviewed</span>'
                        : `<button class="btn-sm btn-review" onclick="reviewAlert(${a.alert_id},this)">Mark Reviewed</button>`
                    }</td>
                </tr>`,
      )
      .join("");
  } catch {}
}

async function reviewAlert(id, btn) {
  btn.disabled = true;
  btn.textContent = "...";
  try {
    const res = await fetch(`${API}/admin/fraud-alerts/${id}/review`, {
      method: "PUT",
      headers,
    });
    const data = await res.json();
    if (data.success) {
      btn.outerHTML = '<span class="badge reviewed">Reviewed</span>';
      const el = document.getElementById("statAlerts");
      el.textContent = Math.max(0, parseInt(el.textContent) - 1);
    } else {
      btn.disabled = false;
      btn.textContent = "Mark Reviewed";
    }
  } catch {
    btn.disabled = false;
    btn.textContent = "Mark Reviewed";
  }
}

async function loadUsers() {
  try {
    const res = await fetch(`${API}/admin/users`, { headers });
    const data = await res.json();
    if (!data.success) return;
    const users = data.users;
    document.getElementById("statUsers").textContent = users.length;
    document.getElementById("statActive").textContent = users.filter(
      (u) => u.is_active,
    ).length;
    document.getElementById("statFlagged").textContent = users.filter(
      (u) => u.total_fraud_flags > 0,
    ).length;
    document.getElementById("usersBody").innerHTML = users
      .map(
        (u) => `
                <tr>
                    <td><strong>${u.full_name}</strong></td>
                    <td style="color:var(--muted)">${u.email}</td>
                    <td style="font-weight:700;color:var(--accent-dk)">PKR ${Number(
                      u.balance,
                    ).toLocaleString()}</td>
                    <td style="text-align:center">${
                      u.total_fraud_flags > 0
                        ? `<span style="color:var(--danger);font-weight:700">${u.total_fraud_flags}</span>`
                        : '<span style="color:var(--muted)">0</span>'
                    }</td>
                    <td><span class="badge ${
                      u.is_active ? "active" : "inactive"
                    }">${u.is_active ? "Active" : "Inactive"}</span></td>
                    <td>${
                      u.role === "admin"
                        ? '<span style="color:var(--muted);font-size:12px">—</span>'
                        : `<button class="btn-sm btn-toggle" onclick="toggleUser(${
                            u.user_id
                          },this)">${
                            u.is_active ? "Deactivate" : "Activate"
                          }</button>`
                    }</td>
                </tr>`,
      )
      .join("");
  } catch {}
}

async function toggleUser(id, btn) {
  btn.disabled = true;
  btn.textContent = "...";
  try {
    const res = await fetch(`${API}/admin/users/${id}/toggle-status`, {
      method: "PUT",
      headers,
    });
    const data = await res.json();
    if (data.success) loadUsers();
    else {
      btn.disabled = false;
      btn.textContent = "Toggle";
    }
  } catch {
    btn.disabled = false;
    btn.textContent = "Toggle";
  }
}

async function loadAudit() {
  try {
    const res = await fetch(`${API}/admin/audit-log?limit=50`, {
      headers,
    });
    const data = await res.json();
    if (!data.success) return;
    if (!data.logs.length) {
      document.getElementById("auditBody").innerHTML =
        '<tr><td colspan="5" class="empty">No audit logs yet.</td></tr>';
      return;
    }
    document.getElementById("auditBody").innerHTML = data.logs
      .map(
        (l) => `
                <tr>
                    <td><strong>${l.actor_name || "System"}</strong></td>
                    <td><span style="background:var(--accent-lt);color:var(--accent-dk);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${
                      l.action_type
                    }</span></td>
                    <td style="color:var(--muted)">${l.target_table || "—"} ${
                      l.target_id ? "#" + l.target_id : ""
                    }</td>
                    <td style="color:var(--text2);font-size:12px">${
                      l.notes || "—"
                    }</td>
                    <td style="color:var(--muted)">${new Date(
                      l.created_at,
                    ).toLocaleString("en-PK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}</td>
                </tr>`,
      )
      .join("");
  } catch {}
}

async function loadAdminAnalytics() {
  try {
    const res = await fetch(`${API}/admin/analytics/overview`, { headers });
    const data = await res.json();
    if (!data.success) return;

    const dailyLabels = (data.daily_fraud || []).map((row) =>
      new Date(row.day).toLocaleDateString("en-PK", {
        month: "short",
        day: "numeric",
      }),
    );
    const dailyData = (data.daily_fraud || []).map((row) => row.count);

    const severityLabels = (data.severity_breakdown || []).map(
      (row) => row.severity || "Unknown",
    );
    const severityData = (data.severity_breakdown || []).map(
      (row) => row.count,
    );

    const fraudTrendCtx = document.getElementById("fraudTrendChart");
    if (fraudTrendChart) fraudTrendChart.destroy();
    fraudTrendChart = new Chart(fraudTrendCtx, {
      type: "line",
      data: {
        labels: dailyLabels,
        datasets: [
          {
            label: "Fraud alert count",
            data: dailyData,
            borderColor: "#dc2626",
            backgroundColor: "rgba(220, 38, 38, 0.15)",
            tension: 0.35,
            fill: true,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });

    const fraudSeverityCtx = document.getElementById("fraudSeverityChart");
    if (fraudSeverityChart) fraudSeverityChart.destroy();
    fraudSeverityChart = new Chart(fraudSeverityCtx, {
      type: "bar",
      data: {
        labels: severityLabels,
        datasets: [
          {
            label: "Alert count",
            data: severityData,
            backgroundColor: ["#f59e0b", "#ef4444", "#3b82f6", "#6b7280"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Admin analytics error:", err.message);
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

loadAlerts();
loadUsers();
loadAudit();
loadAdminAnalytics();
