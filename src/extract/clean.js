export function cleanData(data) {
  return {
    company: data.company,
    founders: (data.founders || [])
      .filter((f) => f?.name && f.name !== "Not specified")
      .map((f) => ({
        name: f.name,
        worked_at: (f.worked_at || []).map((org) =>
          String(org).toLowerCase().includes("google") ? "Google" : org
        )
      }))
  };
}

export function enrichGoogleRelation(data, rawText) {
  const text = String(rawText || "").toLowerCase();
  if (text.includes("google")) {
    for (const f of data.founders || []) {
      if (!f.worked_at) f.worked_at = [];
      if (!f.worked_at.includes("Google")) f.worked_at.push("Google");
    }
  }
  return data;
}

