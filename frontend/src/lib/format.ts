// src/lib/format.ts
export const formatCurrencyILS = (n: number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(
    n ?? 0
  );
