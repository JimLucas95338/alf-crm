// Default follow-up windows per call outcome.
// `null` means "no next call" — the contact drops out of the queue.
const OUTCOME_DAYS: Record<string, number | null> = {
  connected: 30,       // had a real conversation; follow up in a month
  voicemail: 3,        // left message; try again in a few days
  no_answer: 1,        // try again tomorrow
  callback: 2,         // default; user usually picks specific date
  bad_number: null,    // nothing to call
  interested: 2,       // hot — follow up fast
  not_interested: null,
};

// Auto-bump status based on outcome if the contact is still in an earlier stage.
// Returns the new status or null if no change.
const STATUS_PROGRESSION: Record<string, string[]> = {
  new: ["attempted", "contacted", "interested", "not_interested", "do_not_call"],
  attempted: ["contacted", "interested", "not_interested", "do_not_call"],
  contacted: ["interested", "not_interested", "do_not_call"],
  interested: ["not_interested", "do_not_call"],
  not_interested: ["do_not_call"],
  do_not_call: [],
};

export function daysForOutcome(outcome: string): number | null {
  return outcome in OUTCOME_DAYS ? OUTCOME_DAYS[outcome] : 7;
}

export function nextStatusForOutcome(currentStatus: string, outcome: string): string | null {
  let target: string | null = null;
  switch (outcome) {
    case "connected":      target = "contacted"; break;
    case "voicemail":      target = "attempted"; break;
    case "no_answer":      target = "attempted"; break;
    case "callback":       target = "contacted"; break;
    case "interested":     target = "interested"; break;
    case "not_interested": target = "not_interested"; break;
    case "bad_number":     return null; // don't auto-bump; user decides
  }
  if (!target || target === currentStatus) return null;
  const allowed = STATUS_PROGRESSION[currentStatus] ?? [];
  return allowed.includes(target) ? target : null;
}
