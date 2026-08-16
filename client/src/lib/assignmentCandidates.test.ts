import { describe, expect, it } from "vitest";
import { getManualAssignmentCandidates, getManualAssignmentHint } from "./assignmentCandidates";

describe("manual assignment candidates", () => {
  it("lists only on-duty technicians with remaining capacity and never chooses an assignee", () => {
    const candidates = getManualAssignmentCandidates([
      { techId: "tech-1", techName: "ช่างเอ", isActive: true, availabilityStatus: "ON_DUTY", currentOpenJobs: 2, maxOpenJobs: 5 },
      { techId: "tech-2", techName: "ช่างบี", isActive: true, availabilityStatus: "OFF_DUTY", currentOpenJobs: 0, maxOpenJobs: 5 },
      { techId: "tech-3", techName: "ช่างซี", isActive: true, availabilityStatus: "ON_DUTY", currentOpenJobs: 5, maxOpenJobs: 5 },
      { techId: "tech-4", techName: "ช่างดี", isActive: true, availabilityStatus: "ON_DUTY", currentOpenJobs: 1, maxOpenJobs: 5 },
    ]);

    expect(candidates.map(candidate => candidate.techId)).toEqual(["tech-4", "tech-1"]);
    expect(getManualAssignmentHint(candidates.length)).toContain("Supervisor หรือ Admin");
  });

  it("explains when no technician is available instead of selecting an unavailable person", () => {
    expect(getManualAssignmentCandidates([
      { techId: "tech-1", techName: "ช่างเอ", isActive: true, availabilityStatus: "ON_LEAVE", currentOpenJobs: 0, maxOpenJobs: 5 },
    ])).toEqual([]);
    expect(getManualAssignmentHint(0)).toContain("ไม่มีช่าง");
  });
});
