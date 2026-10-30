// Países para el móvil del cliente: al elegir uno se muestra su prefijo y el número se escribe sin él.
export interface Pais {
  codigo: string;
  nombre: string;
  prefijo: string;
}

export const PAISES: Pais[] = [
  { codigo: 'PE', nombre: 'Perú', prefijo: '+51' },
  { codigo: 'AR', nombre: 'Argentina', prefijo: '+54' },
  { codigo: 'BO', nombre: 'Bolivia', prefijo: '+591' },
  { codigo: 'BR', nombre: 'Brasil', prefijo: '+55' },
  { codigo: 'CL', nombre: 'Chile', prefijo: '+56' },
  { codigo: 'CO', nombre: 'Colombia', prefijo: '+57' },
  { codigo: 'EC', nombre: 'Ecuador', prefijo: '+593' },
  { codigo: 'ES', nombre: 'España', prefijo: '+34' },
  { codigo: 'US', nombre: 'Estados Unidos', prefijo: '+1' },
  { codigo: 'MX', nombre: 'México', prefijo: '+52' },
  { codigo: 'PY', nombre: 'Paraguay', prefijo: '+595' },
  { codigo: 'UY', nombre: 'Uruguay', prefijo: '+598' },
  { codigo: 'VE', nombre: 'Venezuela', prefijo: '+58' },
];
