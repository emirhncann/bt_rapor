// utils/buildFilter.ts

export function buildInventoryFilters(filters: Record<string, string | string[]>) {
  const conditions: string[] = [];

  const specodeFields = [
    { field: "SPECODE", spetype: 1 },
    { field: "SPECODE2", spetype: 2 },
    { field: "SPECODE3", spetype: 3 },
    { field: "SPECODE4", spetype: 4 },
    { field: "SPECODE5", spetype: 5 },
  ];

  for (const { field, spetype } of specodeFields) {
    const codeVal = filters[field.toLowerCase()];

    if (Array.isArray(codeVal) && codeVal.length) {
      // Çoklu seçim -> IN ()
      const escaped = codeVal.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
      conditions.push(`I.${field} IN (${escaped})`);
    } else if (typeof codeVal === 'string' && codeVal.trim()) {
      conditions.push(`I.${field} = '${codeVal.replace(/'/g, "''")}'`);
    }

    // Açıklama filtresi (tekli)
    const descKey = field.toLowerCase() + 'desc';
    const descVal = filters[descKey];
    if (typeof descVal === 'string' && descVal.trim()) {
      const op = descVal.includes("%") ? "LIKE" : "=";
      conditions.push(`EXISTS (
        SELECT 1 FROM LG_009_SPECODES S
        WHERE S.SPECODE = I.${field}
          AND S.CODETYPE = 1 AND S.SPECODETYPE = 1 AND S.SPETYP${spetype} = ${spetype}
          AND S.DEFINITION_ ${op} '${descVal.replace(/'/g, "''")}'
      )`);
    }
  }

  // Grup kodu çoklu destek
  const grpCodes = filters.grpcod;
  if (Array.isArray(grpCodes) && grpCodes.length) {
    const escaped = grpCodes.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
    conditions.push(`I.STGRPCODE IN (${escaped})`);
  } else if (typeof grpCodes === 'string' && grpCodes.trim()) {
    conditions.push(`I.STGRPCODE = '${grpCodes.replace(/'/g, "''")}'`);
  }

  const grpDesc = filters.grpcoddesc;
  if (typeof grpDesc === 'string' && grpDesc.trim()) {
    const op = grpDesc.includes("%") ? "LIKE" : "=";
    conditions.push(`EXISTS (
      SELECT 1 FROM LG_009_SPECODES G
      WHERE G.SPECODE = I.STGRPCODE
        AND G.CODETYPE = 4 AND G.SPECODETYPE = 0
        AND G.DEFINITION_ ${op} '${grpDesc.replace(/'/g, "''")}'
    )`);
  }

  return conditions.length ? " AND " + conditions.join(" AND ") : "";
} 