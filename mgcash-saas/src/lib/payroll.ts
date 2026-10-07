export interface PayrollInput {
  base_salary: number; // monthly
  bonus: number;
  commissions: number[];
  deductions: number[];
  /** "monthly" = full base, "semi" = half (kinsenas). */
  cutoff: "monthly" | "semi";
}

export interface PayrollResult {
  base: number;
  commission: number;
  bonus: number;
  deductions: number;
  net: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePayroll(i: PayrollInput): PayrollResult {
  const base = i.cutoff === "semi" ? i.base_salary / 2 : i.base_salary;
  const commission = i.commissions.reduce((a, b) => a + b, 0);
  const deductions = i.deductions.reduce((a, b) => a + b, 0);
  const net = Math.max(0, base + commission + i.bonus - deductions);
  return {
    base: round2(base),
    commission: round2(commission),
    bonus: round2(i.bonus),
    deductions: round2(deductions),
    net: round2(net),
  };
}
