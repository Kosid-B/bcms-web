export const EMPTY_BIA_PROCESS_FORM = {
  name: "",
  department: "",
  owner: "",
  criticality: 3,
  rto_minutes: "",
  rpo_minutes: "",
  mtpd_minutes: "",
  description: "",
};

export function createEmptyBiaProcessForm() {
  return {
    ...EMPTY_BIA_PROCESS_FORM,
  };
}

export const EMPTY_BIA_WIZARD_FORM = {
  name: "",
  department: "",
  owner: "",
  description: "",
  industry: "all",
  impacts: { financial: 0, regulatory: 0, reputation: 0, operational: 0 },
  mac_pct: 40,
  rto_minutes: null,
  rpo_minutes: null,
  resources: { people: [""], system: [""], vendor: [""], facility: [""] },
};

export function createEmptyBiaWizardForm() {
  return {
    ...EMPTY_BIA_WIZARD_FORM,
    impacts: { ...EMPTY_BIA_WIZARD_FORM.impacts },
    resources: {
      people: [...EMPTY_BIA_WIZARD_FORM.resources.people],
      system: [...EMPTY_BIA_WIZARD_FORM.resources.system],
      vendor: [...EMPTY_BIA_WIZARD_FORM.resources.vendor],
      facility: [...EMPTY_BIA_WIZARD_FORM.resources.facility],
    },
  };
}

export function sanitizeBiaText(value) {
  return (value ?? "").toString().trim().replace(/\s+/g, " ");
}

export function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function sanitizeResourceList(items = []) {
  return items
    .map((item) => sanitizeBiaText(item))
    .filter(Boolean);
}

export function sanitizeBiaResources(resources = {}) {
  return {
    people: sanitizeResourceList(resources.people),
    system: sanitizeResourceList(resources.system),
    vendor: sanitizeResourceList(resources.vendor),
    facility: sanitizeResourceList(resources.facility),
  };
}

export function buildBiaProcessPayload(form, orgId) {
  return {
    org_id: orgId,
    name: sanitizeBiaText(form.name),
    department: sanitizeBiaText(form.department) || null,
    owner: sanitizeBiaText(form.owner) || null,
    description: sanitizeBiaText(form.description) || null,
    status: "draft",
    criticality: Number(form.criticality) || 3,
    rto_minutes: toNullableNumber(form.rto_minutes),
    rpo_minutes: toNullableNumber(form.rpo_minutes),
    mtpd_minutes: toNullableNumber(form.mtpd_minutes),
    metadata: {},
  };
}

export function buildBiaWizardPayload(form, orgId, criticality, macLabel) {
  const macPct = Number(form.mac_pct) || 40;
  return {
    org_id: orgId,
    name: sanitizeBiaText(form.name),
    department: sanitizeBiaText(form.department) || null,
    owner: sanitizeBiaText(form.owner) || null,
    description: sanitizeBiaText(form.description) || null,
    status: "draft",
    criticality,
    rto_minutes: toNullableNumber(form.rto_minutes),
    rpo_minutes: toNullableNumber(form.rpo_minutes),
    mtpd_minutes: null,
    metadata: {
      impacts: form.impacts,
      resources: sanitizeBiaResources(form.resources),
      mac_pct: macPct,
      mac_label: macLabel(macPct),
      trigger_description: `Capacity < ${macPct}% -> BC Plan activated -> RTO starts`,
    },
  };
}
