import { FormEvent, useState } from 'react';
import { api, Pais, TipoDocumento } from './api';
import { largoDocumento, TIPOS } from './documento';

/** Datos que comparten un cliente y un proveedor: el mismo formulario para los dos. */
export type DatosTercero = {
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre: string;
  nombreComercial: string;
  pais: string;
  movil: string;
  direccionFiscal: string;
  email: string;
  contacto: string;
  comentario: string;
};
export interface EntradaTercero {
  tipoDocumento: TipoDocumento;
  documento: string;
  nombre: string;
  nombreComercial: string | null;
  pais: string;
  movil: string | null;
  direccionFiscal: string | null;
  email: string | null;
  contacto: string | null;
  comentario: string | null;
  esGenerico?: boolean;
}

export default function FormTercero(p: {
  uno: 'cliente' | 'proveedor';
  entrada: EntradaTercero | null;
  tipoPorDefecto: TipoDocumento;
  paises: Pais[];
  paisBase: string;
  error?: string;
  alCancelar: () => void;
  alGuardar: (datos: DatosTercero) => Promise<void>;
}) {
  const c = p.entrada;
  const [d, setD] = useState<DatosTercero>({
    tipoDocumento: c?.tipoDocumento ?? p.tipoPorDefecto,
    documento: c?.documento ?? '',
    nombre: c?.nombre ?? '',
    nombreComercial: c?.nombreComercial ?? '',
    pais: c?.pais ?? p.paisBase,
    movil: c?.movil ?? '',
    direccionFiscal: c?.direccionFiscal ?? '',
    email: c?.email ?? '',
    contacto: c?.contacto ?? '',
    comentario: c?.comentario ?? '',
  });
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');
  const poner = <K extends keyof DatosTercero>(k: K, v: DatosTercero[K]) => setD((x) => ({ ...x, [k]: v }));
  const prefijo = p.paises.find((x) => x.codigo === d.pais)?.prefijo ?? '';
  const largo = largoDocumento(d.tipoDocumento);
  // En un cliente solo el tipo y el número de documento son obligatorios; en un proveedor también la razón social.
  const nombreObligatorio = p.uno === 'proveedor';
  const enviar = (e: FormEvent) => { e.preventDefault(); void p.alGuardar(d); };
  const consultable = (d.tipoDocumento === 'DNI' || d.tipoDocumento === 'RUC') && !c?.esGenerico;

  // Con el tipo ya elegido, trae el nombre o la razón social (y la dirección fiscal de un RUC) de RENIEC o SUNAT.
  async function consultar() {
    setErrorConsulta('');
    setConsultando(true);
    try {
      const r = await api.consultarDocumento(d.tipoDocumento, d.documento);
      setD((x) => ({ ...x, nombre: r.nombre, ...(r.direccion && !x.direccionFiscal ? { direccionFiscal: r.direccion } : {}) }));
    } catch (e) {
      setErrorConsulta((e as Error).message);
    } finally {
      setConsultando(false);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={`${c ? 'Editar' : 'Nuevo'} ${p.uno}`} onSubmit={enviar}>
        <h2>{c ? 'Editar' : 'Nuevo'} {p.uno}</h2>
        {(p.error || errorConsulta) && <p className="error" role="alert">{p.error || errorConsulta}</p>}
        <div className="dos-col">
          <div className="campo"><label htmlFor="t-tipo">Tipo de documento *</label>
            <select id="t-tipo" value={d.tipoDocumento} disabled={c?.esGenerico}
              onChange={(e) => { const t = e.target.value as TipoDocumento; setErrorConsulta(''); setD((x) => ({ ...x, tipoDocumento: t, documento: x.documento.slice(0, largoDocumento(t).max) })); }}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="t-doc">Número de documento *</label>
            <div className="con-mas">
              <input id="t-doc" value={d.documento} maxLength={c?.esGenerico ? undefined : largo.max} inputMode={largo.digitos ? 'numeric' : undefined} required disabled={c?.esGenerico}
                onChange={(e) => { setErrorConsulta(''); poner('documento', largo.digitos ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase()); }} />
              <button type="button" className="consultar" disabled={!consultable || consultando || d.documento.length !== largo.max} onClick={() => void consultar()}>{consultando ? 'Consultando…' : 'Consultar'}</button>
            </div></div>
          <div className="campo"><label htmlFor="t-nombre">{nombreObligatorio ? 'Razón social o nombre *' : 'Razón social o nombre'}</label>
            <input id="t-nombre" value={d.nombre} onChange={(e) => poner('nombre', e.target.value)} required={nombreObligatorio} /></div>
          <div className="campo"><label htmlFor="t-comercial">Nombre comercial</label>
            <input id="t-comercial" value={d.nombreComercial} onChange={(e) => poner('nombreComercial', e.target.value)} /></div>
          <div className="campo"><label htmlFor="t-pais">País</label>
            <select id="t-pais" value={d.pais} onChange={(e) => poner('pais', e.target.value)}>
              {p.paises.map((x) => <option key={x.codigo} value={x.codigo}>{`${x.nombre} (${x.prefijo})`}</option>)}
            </select></div>
          <div className="campo"><label htmlFor="t-movil">Móvil</label>
            <div className="movil">
              <span className="prefijo">{prefijo}</span>
              <input id="t-movil" inputMode="numeric" maxLength={d.pais === 'PE' ? 9 : 15} value={d.movil} placeholder="Sin prefijo" onChange={(e) => poner('movil', e.target.value.replace(/\D/g, ''))} />
            </div></div>
          <div className="campo"><label htmlFor="t-dir">Dirección fiscal</label>
            <input id="t-dir" value={d.direccionFiscal} onChange={(e) => poner('direccionFiscal', e.target.value)} /></div>
          <div className="campo"><label htmlFor="t-mail">Correo</label>
            <input id="t-mail" type="email" value={d.email} onChange={(e) => poner('email', e.target.value)} /></div>
          <div className="campo ancha"><label htmlFor="t-contacto">Nombre de contacto (solo si es una empresa)</label>
            <input id="t-contacto" value={d.contacto} onChange={(e) => poner('contacto', e.target.value)} /></div>
          <div className="campo ancha"><label htmlFor="t-com">Comentario</label>
            <textarea id="t-com" rows={2} value={d.comentario} onChange={(e) => poner('comentario', e.target.value)} /></div>
        </div>
        <p className="nota-obligatorio">* Los campos con asterisco son obligatorios.</p>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar</button>
        </div>
      </form>
    </div>
  );
}
