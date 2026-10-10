# Stock Movement Local Print Agent

This small service lets the deployed web app submit A4 QR label sheets directly to the printer installed on the computer running this agent. The web app and agent may be deployed separately; the agent must run on the printer-connected computer. It binds only to `127.0.0.1` and accepts requests only from the configured frontend origin.

## Requirements

- Node.js 20 or newer
- The target printer installed and selected as the operating-system default, or its exact queue name configured below
- Windows: a supported Windows PDF printer driver
- macOS/Linux: CUPS and the `lp` command

## Setup

1. Download/clone this repository onto the computer connected to the printer.
2. In this `print-agent` directory, install dependencies with `npm install`.
3. Copy `.env.example` to `.env`, then set `FRONTEND_ORIGINS` to the exact deployed frontend origin, including scheme and host but no path. For example:

   ```sh
   FRONTEND_ORIGINS=https://stock.example.com
   ```

   Windows PowerShell alternative:

   ```powershell
   $env:FRONTEND_ORIGINS = "https://stock.example.com"
   ```

4. Optionally set `PRINTER_NAME` to the exact printer queue name. Leave it unset to use the operating-system default printer.
5. Start the agent with `npm start` and leave it running while using Stock Movement.
6. Confirm `http://127.0.0.1:4317/health` from the same computer. The app posts the QR job to this local service after inward registration succeeds.

When Stock Movement first contacts localhost, the browser may ask permission to access the local network. Allow it for the deployed Stock Movement site. If the site's deployment platform adds a Content Security Policy, its `connect-src` must allow `http://127.0.0.1:4317`.

Windows PowerShell example (after editing `.env`):

```powershell
cd print-agent
npm install
npm start
```

macOS/Linux example:

```sh
cd print-agent
npm install
npm start
```

## Printing behavior

The agent creates an A4 PDF using only the 4 × 10 (40-up) grid: each label is 52.5 × 29.7 mm. It submits the PDF silently to the OS print queue with A4 and 100%/no-scale settings. `startAt` preserves a partially used sheet; accepted positions are 1 through 40.

A queued job means the OS accepted it, not that paper physically exited the printer. Printer status, paper feed calibration, and label alignment still need to be checked on the target device. Run a plain-paper calibration test before loading label stock.

If the agent uses a non-default port, set the frontend build variable `VITE_LOCAL_PRINT_AGENT_URL` to `http://127.0.0.1:<port>` and redeploy the frontend. The default is `http://127.0.0.1:4317`.

The agent does not expose the printer to the public network, and it does not configure or install a printer on the developer's computer. For unattended operation, install/run the agent under the tester's normal account or register it with their operating system's service/startup manager.
