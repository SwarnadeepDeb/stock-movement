const printAgentUrl = (import.meta.env.VITE_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:4317").replace(/\/$/, "");

export const submitA4QrPrintJob = async ({ items, startAt, content }) => {
  let response;
  try {
    response = await fetch(`${printAgentUrl}/print/a4`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, startAt, content }),
    });
  } catch {
    throw new Error("Local print agent is unavailable. Start the print agent on the printer-connected computer.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error ?? "The local print agent rejected the print job.");
  }

  return result;
};
