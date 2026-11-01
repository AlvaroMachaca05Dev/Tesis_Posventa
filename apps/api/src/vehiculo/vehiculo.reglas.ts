/** La placa sin guiones, espacios ni minúsculas: así «abc-123», «ABC 123» y «ABC123» son la misma. */
export const normalizarPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
export const KM_MAXIMO = 3_000_000;
