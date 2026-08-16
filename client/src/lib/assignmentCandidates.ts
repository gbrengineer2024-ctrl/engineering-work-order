export type AssignmentCandidate = {
  techId: string;
  techName: string;
  isActive: boolean;
  availabilityStatus?: string | null;
  currentOpenJobs?: number | null;
  maxOpenJobs?: number | null;
};

/**
 * คืนเฉพาะช่างที่อยู่เวรและยังรับงานได้ เพื่อใช้เป็น "รายชื่อให้เลือก" เท่านั้น
 * ระบบจะไม่เลือกหรือมอบหมายช่างแทน Supervisor/Admin
 */
export function getManualAssignmentCandidates(technicians: AssignmentCandidate[]) {
  return technicians
    .filter(technician => technician.isActive
      && technician.availabilityStatus === "ON_DUTY"
      && Number(technician.currentOpenJobs ?? 0) < Number(technician.maxOpenJobs ?? 5))
    .sort((left, right) => {
      const leftJobs = Number(left.currentOpenJobs ?? 0);
      const rightJobs = Number(right.currentOpenJobs ?? 0);
      if (leftJobs !== rightJobs) return leftJobs - rightJobs;
      return left.techName.localeCompare(right.techName, "th");
    });
}

export function getManualAssignmentHint(candidateCount: number) {
  if (candidateCount === 0) return "ไม่มีช่างที่เข้าเวรและยังรับงานได้ในขณะนี้";
  if (candidateCount === 1) return "มีช่างเข้าเวร 1 คน โปรดตรวจสอบและกดยืนยันการมอบหมาย";
  return `มีช่างเข้าเวร ${candidateCount} คน โปรดให้ Supervisor หรือ Admin เลือกและยืนยันการมอบหมาย`;
}
