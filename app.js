const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const loadBtn = $("loadBtn");
const resetBtn = $("resetBtn");

const kpisEl = $("kpis");
const chartsEl = $("charts");
const trendCardEl = $("trendCard");
const tableCardEl = $("tableCard");

const statusBarsEl = $("statusBars");
const ownerBarsEl = $("ownerBars");
const trendBarsEl = $("trendBars");
const tableBodyEl = $("tableBody");

const defaultState = {
  apiUrl: "https://successhub.crm.dynamics.com/api/data/v9.2/ft_feedbackitems",
  vTeamName: "Dynamics 365 Contact Center and Agents",
  vTeamField: "",
  token: "",
  topN: "8",
  maxRows: "5000",
};

const STATUS_FIELD_CANDIDATES = [
  "status",
  "statuscode",
  "statecode",
  "ft_status",
  "mssh_status",
];

const OWNER_FIELD_CANDIDATES = [
  "ownerid",
  "_ownerid_value",
  "assignedto",
  "ft_owner",
  "mssh_owner",
];

const TITLE_FIELD_CANDIDATES = [
  "title",
  "subject",
  "ft_title",
  "name",
  "mssh_name",
];

const ID_FIELD_CANDIDATES = ["ft_feedbackitemid", "feedbackitemid", "id"];

const DATE_FIELD_CANDIDATES = ["createdon", "createddate", "ft_createdon"];

const VT_FIELD_HINTS = ["vteam", "v-team", "team", "vt", "featureteam"];

loadBtn.addEventListener("click", loadDashboard);
resetBtn.addEventListener("click", resetDashboard);

resetDashboard();

function setStatus(text) {
  statusEl.textContent = text;
}

function resetDashboard() {
  $("apiUrl").value = defaultState.apiUrl;
  $("vTeamName").value = defaultState.vTeamName;
  $("vTeamField").value = defaultState.vTeamField;
  $("token").value = defaultState.token;
  $("topN").value = defaultState.topN;
  $("maxRows").value = defaultState.maxRows;

  clearVisuals();
  setStatus("Idle");
}

function clearVisuals() {
  kpisEl.innerHTML = "";
  statusBarsEl.innerHTML = "";
  ownerBarsEl.innerHTML = "";
  trendBarsEl.innerHTML = "";
  tableBodyEl.innerHTML = "";

  kpisEl.classList.add("hidden");
  chartsEl.classList.add("hidden");
  trendCardEl.classList.add("hidden");
  tableCardEl.classList.add("hidden");
}

function getFormattedValue(record, key) {
  return record[`${key}@OData.Community.Display.V1.FormattedValue`];
}

function getFirstValue(record, fields, options = {}) {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field) && record[field] !== null) {
      if (options.preferFormatted) {
        return getFormattedValue(record, field) ?? record[field];
      }
      return record[field];
    }
  }
  return undefined;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function pickVTeamField(records, configuredField, teamName) {
  if (configuredField && records.some((r) => configuredField in r)) {
    return configuredField;
  }

  const keyScores = new Map();
  const target = normalizeText(teamName);

  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      const keyNorm = normalizeText(key);
      if (key.includes("@OData.Community.Display.V1.FormattedValue")) return;
      if (VT_FIELD_HINTS.some((hint) => keyNorm.includes(hint))) {
        const val = record[key];
        const formatted = getFormattedValue(record, key);
        const valueNorm = normalizeText(formatted ?? val);
        let score = keyScores.get(key) ?? 0;
        if (valueNorm === target) score += 5;
        if (valueNorm.includes(target) || target.includes(valueNorm)) score += 2;
        score += 1;
        keyScores.set(key, score);
      }
    });
  });

  const sorted = [...keyScores.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

function isOpenFeedback(record, statusValue) {
  const state = getFirstValue(record, ["statecode"], { preferFormatted: true });
  const statusText = normalizeText(statusValue);
  const stateText = normalizeText(state);

  if (stateText) {
    if (stateText.includes("inactive") || stateText.includes("closed") || stateText === "1") {
      return false;
    }
    return true;
  }
  if (
    statusText.includes("closed") ||
    statusText.includes("resolved") ||
    statusText.includes("done") ||
    statusText.includes("completed")
  ) {
    return false;
  }
  return true;
}

function countBy(records, resolver) {
  const map = new Map();
  records.forEach((record) => {
    const key = resolver(record);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBars(container, data, maxItems = 12) {
  container.innerHTML = "";
  const trimmed = data.slice(0, maxItems);
  const max = Math.max(...trimmed.map(([, count]) => count), 1);

  trimmed.forEach(([name, count]) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const nameEl = document.createElement("div");
    nameEl.className = "bar-name";
    nameEl.textContent = name;

    const trackEl = document.createElement("div");
    trackEl.className = "bar-track";

    const fillEl = document.createElement("div");
    fillEl.className = "bar-fill";
    fillEl.style.width = `${(count / max) * 100}%`;
    trackEl.appendChild(fillEl);

    const valueEl = document.createElement("div");
    valueEl.className = "bar-value";
    valueEl.textContent = String(count);

    row.append(nameEl, trackEl, valueEl);
    container.appendChild(row);
  });
}

function renderKpi(label, value) {
  const item = document.createElement("div");
  item.className = "kpi";
  item.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
  return item;
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "-";
}

function makeRecordLink(id) {
  if (!id) return "-";
  return `https://successhub.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=ft_feedbackitem&id=${id}`;
}

async function loadDashboard() {
  clearVisuals();
  setStatus("Loading...");
  loadBtn.disabled = true;

  try {
    const apiUrl = $("apiUrl").value.trim();
    const vTeamName = $("vTeamName").value.trim();
    const vTeamField = $("vTeamField").value.trim();
    const bearerToken = $("token").value.trim();
    const topN = Math.max(3, Math.min(20, Number($("topN").value || 8)));
    const maxRows = Math.max(50, Math.min(10000, Number($("maxRows").value || 5000)));

    if (!apiUrl || !vTeamName) {
      throw new Error("Fusion endpoint and v-Team name are required.");
    }

    const url = new URL(apiUrl);
    if (!url.searchParams.has("$top")) {
      url.searchParams.set("$top", String(maxRows));
    }
    if (!url.searchParams.has("$count")) {
      url.searchParams.set("$count", "true");
    }

    const headers = {
      Accept: "application/json",
      "OData-Version": "4.0",
      "OData-MaxVersion": "4.0",
    };
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Fusion call failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const records = Array.isArray(payload.value) ? payload.value : [];
    if (!records.length) {
      throw new Error("No records returned from the endpoint.");
    }

    const selectedVTeamField = pickVTeamField(records, vTeamField, vTeamName);
    if (!selectedVTeamField) {
      throw new Error(
        "Unable to detect the v-Team field. Set the field name manually (for example ft_vteamname).",
      );
    }

    const normalizedTeam = normalizeText(vTeamName);
    const filtered = records.filter((record) => {
      const raw = record[selectedVTeamField];
      const formatted = getFormattedValue(record, selectedVTeamField);
      const val = normalizeText(formatted ?? raw);
      return val === normalizedTeam || val.includes(normalizedTeam);
    });

    if (!filtered.length) {
      throw new Error(
        `No feedback items matched "${vTeamName}" using field "${selectedVTeamField}".`,
      );
    }

    const withDerived = filtered.map((record) => {
      const statusValue = getFirstValue(record, STATUS_FIELD_CANDIDATES, { preferFormatted: true }) ?? "Unknown";
      const ownerValue = getFirstValue(record, OWNER_FIELD_CANDIDATES, { preferFormatted: true }) ?? "Unassigned";
      const titleValue = getFirstValue(record, TITLE_FIELD_CANDIDATES, { preferFormatted: true }) ?? "(Untitled)";
      const idValue = getFirstValue(record, ID_FIELD_CANDIDATES, { preferFormatted: false });
      const createdValue = getFirstValue(record, DATE_FIELD_CANDIDATES, { preferFormatted: false });
      return {
        original: record,
        statusValue: String(statusValue),
        ownerValue: String(ownerValue),
        titleValue: String(titleValue),
        idValue: idValue ? String(idValue) : "",
        createdValue,
        open: isOpenFeedback(record, statusValue),
      };
    });

    const now = new Date();
    const ages = withDerived
      .map((item) => toDate(item.createdValue))
      .filter(Boolean)
      .map((date) => Math.floor((now - date) / 86400000));
    const avgAge = ages.length
      ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length)
      : 0;

    const openCount = withDerived.filter((item) => item.open).length;
    const closedCount = withDerived.length - openCount;

    kpisEl.append(
      renderKpi("Matched items", withDerived.length),
      renderKpi("Open items", openCount),
      renderKpi("Closed items", closedCount),
    );
    kpisEl.append(renderKpi("Average age (days)", avgAge));
    kpisEl.append(renderKpi("Detected v-Team field", selectedVTeamField));
    kpisEl.append(renderKpi("Rows requested", records.length));
    kpisEl.classList.remove("hidden");

    const statusDistribution = countBy(withDerived, (i) => i.statusValue || "Unknown");
    const ownerDistribution = countBy(withDerived, (i) => i.ownerValue || "Unassigned");
    renderBars(statusBarsEl, statusDistribution, 12);
    renderBars(ownerBarsEl, ownerDistribution, topN);
    chartsEl.classList.remove("hidden");

    const monthMap = new Map();
    withDerived.forEach((item) => {
      const created = toDate(item.createdValue);
      if (!created) return;
      const key = monthKey(created);
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    });
    const allMonths = [];
    for (let i = 11; i >= 0; i -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allMonths.push(monthKey(monthDate));
    }
    const monthly = allMonths.map((m) => [m, monthMap.get(m) ?? 0]);
    renderBars(trendBarsEl, monthly, 12);
    trendCardEl.classList.remove("hidden");

    withDerived
      .sort((a, b) => {
        const da = toDate(a.createdValue)?.getTime() ?? 0;
        const db = toDate(b.createdValue)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 40)
      .forEach((item) => {
        const tr = document.createElement("tr");
        const link = makeRecordLink(item.idValue);
        tr.innerHTML = `
          <td>${escapeHtml(item.titleValue)}</td>
          <td>${escapeHtml(item.statusValue)}</td>
          <td>${escapeHtml(item.ownerValue)}</td>
          <td>${escapeHtml(formatDate(item.createdValue))}</td>
          <td class="mono">${item.idValue ? `<a href="${link}" target="_blank" rel="noreferrer">${escapeHtml(item.idValue.slice(0, 8))}...</a>` : "-"}</td>
        `;
        tableBodyEl.appendChild(tr);
      });

    tableCardEl.classList.remove("hidden");
    setStatus(`Loaded ${withDerived.length} items (field: ${selectedVTeamField})`);
  } catch (error) {
    setStatus(error.message || "Load failed");
  } finally {
    loadBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
