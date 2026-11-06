// Reglas de documento y teléfono (las mismas que valida el servidor): DNI 8 dígitos, RUC 11, carné de extranjería 9 a 12.
export const LARGO_DOCUMENTO: Record<string, { max: number; digitos: boolean }> = {
  DNI: { max: 8, digitos: true },
  RUC: { max: 11, digitos: true },
  CARNET_EXTRANJERIA: { max: 12, digitos: false },
};
export const largoDocumento = (tipo: string) => LARGO_DOCUMENTO[tipo] ?? { max: 20, digitos: false };
export const TIPO_CORTO: Record<string, string> = { DNI: 'DNI', RUC: 'RUC', CARNET_EXTRANJERIA: 'CE' };
