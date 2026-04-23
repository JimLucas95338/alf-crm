// Maps our internal status to HubSpot's lifecycle + lead status.
// HubSpot's standard hs_lead_status enum: NEW, OPEN, IN_PROGRESS, OPEN_DEAL,
// UNQUALIFIED, ATTEMPTED_TO_CONTACT, CONNECTED, BAD_TIMING.
export function mapStatus(status: string): { lifecyclestage: string; hs_lead_status: string } {
  switch (status) {
    case "new":            return { lifecyclestage: "lead",        hs_lead_status: "NEW" };
    case "attempted":      return { lifecyclestage: "lead",        hs_lead_status: "ATTEMPTED_TO_CONTACT" };
    case "contacted":      return { lifecyclestage: "lead",        hs_lead_status: "CONNECTED" };
    case "interested":     return { lifecyclestage: "opportunity", hs_lead_status: "OPEN_DEAL" };
    case "not_interested": return { lifecyclestage: "lead",        hs_lead_status: "UNQUALIFIED" };
    case "do_not_call":    return { lifecyclestage: "other",       hs_lead_status: "BAD_TIMING" };
    default:               return { lifecyclestage: "lead",        hs_lead_status: "NEW" };
  }
}

// Strip protocol / trailing path for HubSpot's company.domain field.
export function toDomain(website: string | null | undefined): string {
  if (!website) return "";
  return website
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
}

export const COMPANY_HEADERS = [
  "name",
  "domain",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "country",
  "website",
  "description",
  "industry",
  "numberofemployees",
  "lifecyclestage",
  "hs_lead_status",
  "alf_last_call_date",
  "alf_next_call_date",
  "alf_call_count",
  "alf_owner_email",
  "alf_notes",
];

export const CONTACT_HEADERS = [
  "firstname",
  "lastname",
  "jobtitle",
  "phone",
  "company",
  "lifecyclestage",
  "hs_lead_status",
];
