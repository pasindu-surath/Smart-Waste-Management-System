# SmartBin — Waste Management Dashboard

A modern, real-time IoT Waste Management Dashboard developed for monitoring smart dustbins. This system establishes a live connection with an ESP32 microcontroller over WebSockets to provide dynamic visual updates, capacity tracking, and remote control capabilities.

## 🚀 Features

- **Real-Time Telemetry:** Live updates of bin capacity (Plastic, Paper, and Organic categories) using WebSocket communication.
- **Dynamic UI:** Fluid glassmorphism-styled bin cylinders that dynamically change color based on waste levels (Green $\rightarrow$ Amber $\rightarrow$ Red).
- **Automated Alerts & Controls:** Instant visual warnings for critical capacities and a "Mark as Emptied" remote action trigger.
- **Comprehensive View Switcher:** Dedicated views for the Live Monitor, Analytics, Active Alerts, Event History, Connected Devices, and Threshold Settings.
- **Clean Responsive UI:** Fully responsive design built with Tailwind CSS concepts using Bootstrap 5.3, custom dark/light elements, and Space Grotesk typography.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Modern UI layout), JavaScript (ES6+), Bootstrap 5.3, Bootstrap Icons
- **Backend/IoT Node:** ESP32 (Arduino framework), WebSockets (`WebSocketsServer`), JSON communication (`ArduinoJson`)

## 📂 Project Structure

```text
├── index.html       # The main responsive frontend dashboard UI
└── README.md        # Project documentation