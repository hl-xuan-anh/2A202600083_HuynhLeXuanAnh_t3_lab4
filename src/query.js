export function queryAiCompaniesCoFoundedByFormerGoogleEmployees(graph) {
  const nodes = graph.nodes();
  const edges = graph.edges();

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const workedAtByPerson = new Map(); // personId -> Set(orgId)
  const foundedCompanyByPerson = new Map(); // personId -> Set(companyId)

  for (const e of edges) {
    if (e.type === "WORKED_AT") {
      const set = workedAtByPerson.get(e.source) || new Set();
      set.add(e.target);
      workedAtByPerson.set(e.source, set);
    }
    if (e.type === "FOUNDED") {
      const set = foundedCompanyByPerson.get(e.source) || new Set();
      set.add(e.target);
      foundedCompanyByPerson.set(e.source, set);
    }
  }

  const googleOrgIds = new Set(
    nodes
      .filter((n) => n.type === "Organization" && n.name === "Google")
      .map((n) => n.id)
  );

  const companiesFoundedByGooglePeople = new Map(); // companyId -> Set(personId)
  for (const [personId, orgIds] of workedAtByPerson.entries()) {
    const isGoogle = [...orgIds].some((orgId) => googleOrgIds.has(orgId));
    if (!isGoogle) continue;

    const companyIds = foundedCompanyByPerson.get(personId) || new Set();
    for (const companyId of companyIds) {
      const set = companiesFoundedByGooglePeople.get(companyId) || new Set();
      set.add(personId);
      companiesFoundedByGooglePeople.set(companyId, set);
    }
  }

  const coFoundedCompanyIds = [...companiesFoundedByGooglePeople.entries()]
    .filter(([, founders]) => founders.size >= 2)
    .map(([companyId]) => companyId);

  return {
    companyNodeIds: coFoundedCompanyIds,
    companies: coFoundedCompanyIds
      .map((id) => nodeById.get(id))
      .filter(Boolean)
  };
}
