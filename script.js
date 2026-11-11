const API = "/api";
const stopSelect = document.querySelector("#stop-select");
const forecastPanel = document.querySelector("#forecast-panel");
const updatedLabel = document.querySelector("#updated-label");
const conversation = document.querySelector("#conversation");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question-input");
const refreshButton = document.querySelector("#refresh-button");
let stopByCode = new Map();
let currentCode = "";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function loadStops() {
  try {
    const response = await fetch(`${API}/stops`);
    if (!response.ok) throw new Error("Could not load stop list.");
    const stops = await response.json();
    stopByCode = new Map(stops.map(stop => [stop.code, stop]));
    stopSelect.innerHTML = '<option value="">Select a Luas stop</option>';
    for (const line of ["Red", "Green"]) {
      const group = document.createElement("optgroup");
      group.label = `${line} Line`;
      stops.filter(stop => stop.line === line).forEach(stop => {
        const option = document.createElement("option");
        option.value = stop.code;
        option.textContent = stop.name;
        group.append(option);
      });
      stopSelect.append(group);
    }
  } catch (error) {
    stopSelect.innerHTML = '<option value="">Stops unavailable</option>';
    showError("Could not load Luas stops", "Please check that the Flask app is running and refresh the page.");
  }
}

function showError(title, message) {
  forecastPanel.innerHTML = `<div class="error-state"><span class="error-icon">!</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div></div>`;
}

function textFor(element, selectors) {
  for (const selector of selectors) {
    const found = element.querySelector(selector);
    if (found) {
      const value = (found.textContent || found.getAttribute("value") || "").trim();
      if (value) return value;
    }
  }
  return "";
}

function parseForecast(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("The Luas service returned XML that could not be read.");
  const root = xml.documentElement;
  if (!root || root.localName.toLowerCase() === "html") throw new Error("The Luas service did not return forecast XML.");

  // Luas forecast feeds represent each prediction as a tram element. Read the
  // destination from its text (or common destination attributes) and the due
  // estimate from its due/time attributes. No estimate is synthesized here.
  // Support the unnamespaced XML used by the live RPA feed. Keep a namespace
  // fallback for an API response that may add an XML namespace later.
  let tramNodes = [...xml.getElementsByTagName("tram")];
  if (!tramNodes.length) tramNodes = [...xml.getElementsByTagNameNS("*", "tram")];
  const arrivals = tramNodes.map(node => {
    const destination = (node.textContent || "").trim()
      || node.getAttribute("destination") || node.getAttribute("dest") || "";
    const due = node.getAttribute("dueMins") || node.getAttribute("due") || node.getAttribute("dueMinutes") || node.getAttribute("time") || node.getAttribute("minutes") || "";
    const direction = node.parentElement?.getAttribute("name") || node.parentElement?.getAttribute("direction") || "";
    return { destination, due, direction };
  }).filter(item => item.destination && item.due);

  const stopNode = xml.getElementsByTagNameNS("*", "stopInfo")[0] || root;
  const reportedName = stopNode.getAttribute("stop") || stopNode.getAttribute("name") || "";
  const message = textFor(xml, ["message", "msg", "status"]);
  return { arrivals, reportedName, message };
}

function renderForecast(code, result) {
  const stop = stopByCode.get(code);
  const stopName = stop?.name || result.reportedName || code;
  const line = stop?.line || "Luas";
  const pillClass = line === "Red" ? "line-pill red-line" : "line-pill";
  const entries = result.arrivals.map(arrival => {
    const destination = escapeHTML(arrival.destination);
    const due = escapeHTML(arrival.due);
    const direction = arrival.direction ? `<div class="arrival-caption">${escapeHTML(arrival.direction)}</div>` : "";
    const isNumeric = /^\d+(?:\.\d+)?$/.test(arrival.due);
    const dueLabel = isNumeric ? `${due}<small>min</small>` : `${due}<small>${arrival.due.toUpperCase() === "DUE" ? "arriving" : "estimate"}</small>`;
    return `<div class="arrival-row"><span class="direction-icon" aria-hidden="true">↗</span><div><div class="arrival-destination">${destination}</div>${direction}</div><div class="arrival-time">${dueLabel}</div></div>`;
  }).join("");

  const emptyText = result.message || "The API did not provide any forecast entries for this stop.";
  forecastPanel.innerHTML = `<div class="forecast-meta"><span class="forecast-stop">${escapeHTML(stopName)}</span><span class="${pillClass}">${escapeHTML(line)} Line</span><span class="forecast-count">${result.arrivals.length} forecast${result.arrivals.length === 1 ? "" : "s"}</span></div>${entries || `<div class="no-service">${escapeHTML(emptyText)}</div>`}`;
  updatedLabel.textContent = `Last refreshed ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date())}`;
}

async function fetchForecast(code, announce = false) {
  if (!code) return;
  currentCode = code;
  stopSelect.value = code;
  refreshButton.disabled = true;
  refreshButton.querySelector(".refresh-icon").classList.add("spinning");
  forecastPanel.innerHTML = '<div class="loading-state"><span class="loader"></span><span>Fetching live forecast from Luas…</span></div>';
  try {
    const response = await fetch(`${API}/forecast?stop=${encodeURIComponent(code)}`, { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const data = contentType.includes("json") ? await response.json() : null;
      throw new Error(data?.error || "Live Luas data is temporarily unavailable. Please try again shortly.");
    }
    const xml = await response.text();
    const result = parseForecast(xml);
    renderForecast(code, result);
    if (announce) addMessage("assistant", `Here are the latest forecasts for ${stopByCode.get(code)?.name || code}.`);
  } catch (error) {
    showError("Live data temporarily unavailable", error.message || "The Luas forecast service could not be reached. Please try again shortly.");
    updatedLabel.textContent = "Forecast could not be refreshed";
    if (announce) addMessage("assistant", `I couldn't reach the live Luas forecast service just now. No arrival times are available. Please try again shortly.`);
  } finally {
    refreshButton.disabled = false;
    refreshButton.querySelector(".refresh-icon").classList.remove("spinning");
  }
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const avatar = role === "assistant" ? '<div class="message-avatar">✳</div>' : "";
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  message.innerHTML = `${avatar}<div class="message-content"><div class="bubble">${escapeHTML(text)}</div><span class="message-time">${escapeHTML(time)}</span></div>`;
  conversation.append(message);
  conversation.scrollTop = conversation.scrollHeight;
}

function findStopInQuestion(question) {
  const normalized = question.toLowerCase();
  return [...stopByCode.values()].sort((a, b) => b.name.length - a.name.length)
    .find(stop => normalized.includes(stop.name.toLowerCase()) || new RegExp(`\\b${stop.code.toLowerCase()}\\b`).test(normalized));
}

stopSelect.addEventListener("change", () => fetchForecast(stopSelect.value));
refreshButton.addEventListener("click", () => fetchForecast(currentCode || stopSelect.value));
questionForm.addEventListener("submit", event => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  addMessage("user", question);
  questionInput.value = "";
  const stop = findStopInQuestion(question);
  if (!stop) {
    addMessage("assistant", "Tell me the name of a Luas stop, such as Ranelagh or Abbey Street, and I’ll look up its live forecast.");
    return;
  }
  fetchForecast(stop.code, true);
});
document.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
  questionInput.value = button.dataset.question;
  questionForm.requestSubmit();
}));
loadStops();
