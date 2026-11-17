import { FormEvent, useEffect, useState } from 'react';
import { api, ConfigEmpresa, LocalEmpresa } from '../comun/api';
import { aJpeg } from '../comun/imagen';

type Nivel = 'A' | 'E' | 'V';
type Pestana = 'datos' | 'impresion' | 'locales';
const PESTANAS: [Pestana, string][] = [['datos', 'Datos de la empresa'], ['impresion', 'Impresión'], ['locales', 'Locales y series']];

/** Configuración de la empresa: sus datos (salen en los PDF y tickets), los parámetros de impresión y las series de cada local. */
export default function Empresa({ nivel }: { nivel: Nivel }) {
  const puedeEditar = nivel === 'A';
  const [pestana, setPestana] = useState<Pestana>('datos');
  const [cfg, setCfg] = useState<ConfigEmpresa | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.empresa().then(setCfg).catch((e) => setError((e as Error).message));
  }, []);
  const hecho = (c: ConfigEmpresa, m: string) => { setCfg(c); setError(''); setMensaje(m); };
  const fallo = (e: unknown) => { setMensaje(''); setError((e as Error).message); };

  return (
    <div className="panel ancho">
      <h1>Empresa y parámetros</h1>
      <div className="pestanas" role="tablist">
        {PESTANAS.map(([id, nombre]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} className={pestana === id ? 'on' : ''} onClick={() => { setPestana(id); setMensaje(''); setError(''); }}>{nombre}</button>
        ))}
      </div>
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {cfg && pestana === 'datos' && <Datos cfg={cfg} puedeEditar={puedeEditar} alGuardar={hecho} alFallar={fallo} />}
      {cfg && pestana === 'impresion' && <Impresion cfg={cfg} puedeEditar={puedeEditar} alGuardar={hecho} alFallar={fallo} />}
      {cfg && pestana === 'locales' && <Locales cfg={cfg} puedeEditar={puedeEditar} alGuardar={hecho} alFallar={fallo} />}
    </div>
  );
}

interface Parte { cfg: ConfigEmpresa; puedeEditar: boolean; alGuardar: (c: ConfigEmpresa, m: string) => void; alFallar: (e: unknown) => void }

function Datos({ cfg, puedeEditar, alGuardar, alFallar }: Parte) {
  const [d, setD] = useState({ nombre: cfg.nombre, razonSocial: cfg.razonSocial ?? '', ruc: cfg.ruc ?? '', direccion: cfg.direccion ?? '', telefono: cfg.telefono ?? '', correo: cfg.correo ?? '', lema: cfg.lema ?? '' });
  const poner = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  const enviar = async (e: FormEvent) => { e.preventDefault(); try { alGuardar(await api.editarEmpresa(d), 'Datos de la empresa guardados.'); } catch (x) { alFallar(x); } };
  async function subirLogo(f: File) {
    try { alGuardar(await api.editarEmpresa({ logo: await aJpeg(f) }), 'Logo guardado.'); } catch (x) { alFallar(x); }
  }
  async function quitarLogo() {
    try { alGuardar(await api.editarEmpresa({ logo: null }), 'Logo quitado.'); } catch (x) { alFallar(x); }
  }
  const campo = (k: keyof typeof d, etiqueta: string, extra: Record<string, unknown> = {}) => (
    <div className="campo"><label htmlFor={`e-${k}`}>{etiqueta}</label><input id={`e-${k}`} value={d[k]} disabled={!puedeEditar} onChange={(e) => poner(k, e.target.value)} {...extra} /></div>
  );
  return (
    <form className="form-config" onSubmit={enviar}>
      <div className="dos-col">
        {campo('nombre', 'Nombre comercial *', { required: true })}
        {campo('razonSocial', 'Razón social')}
        {campo('ruc', 'RUC', { inputMode: 'numeric', maxLength: 11 })}
        {campo('telefono', 'Teléfono')}
        {campo('correo', 'Correo', { type: 'email' })}
        {campo('direccion', 'Dirección')}
        <div className="campo ancha"><label htmlFor="e-lema">Lema de la cabecera</label><input id="e-lema" value={d.lema} disabled={!puedeEditar} onChange={(e) => poner('lema', e.target.value)} /></div>
      </div>
      <section className="bloque-nota logo-empresa"><h3>Logo de la empresa (horizontal)</h3>
        {cfg.logo ? <img className="logo-vista" alt="Logo de la empresa" src={`data:image/jpeg;base64,${cfg.logo.base64}`} /> : <p className="suave">Sin logo.</p>}
        {puedeEditar && (
          <div className="fila">
            <label className="boton-archivo">Subir logo<input type="file" accept="image/*" aria-label="Subir logo" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await subirLogo(f); }} /></label>
            {cfg.logo && <button type="button" onClick={() => void quitarLogo()}>Quitar logo</button>}
          </div>
        )}
      </section>
      {puedeEditar && <div className="fila fin"><button type="submit" className="primario chico">Guardar</button></div>}
    </form>
  );
}

function Impresion({ cfg, puedeEditar, alGuardar, alFallar }: Parte) {
  const [ancho, setAncho] = useState(String(cfg.anchoTicketMm ?? 80));
  const [pie, setPie] = useState(cfg.pieTicket ?? '');
  const [cuentas, setCuentas] = useState(cfg.cuentasBancarias ?? '');
  const [terminos, setTerminos] = useState(cfg.terminosRecepcion ?? '');
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    try { alGuardar(await api.editarEmpresa({ anchoTicketMm: Number(ancho), pieTicket: pie, cuentasBancarias: cuentas, terminosRecepcion: terminos }), 'Parámetros de impresión guardados.'); } catch (x) { alFallar(x); }
  };
  return (
    <form className="form-config" onSubmit={enviar}>
      <div className="dos-col">
        <div className="campo"><label htmlFor="i-ancho">Ancho del ticket (mm) *</label><input id="i-ancho" inputMode="numeric" value={ancho} disabled={!puedeEditar} onChange={(e) => setAncho(e.target.value.replace(/\D/g, ''))} required /></div>
        <div className="campo"><label htmlFor="i-pie">Pie del ticket</label><input id="i-pie" value={pie} disabled={!puedeEditar} onChange={(e) => setPie(e.target.value)} /></div>
        <div className="campo ancha"><label htmlFor="i-cuentas">Cuentas bancarias del PDF de la orden</label><textarea id="i-cuentas" rows={2} value={cuentas} disabled={!puedeEditar} onChange={(e) => setCuentas(e.target.value)} /></div>
        <div className="campo ancha"><label htmlFor="i-terminos">Términos y condiciones de la hoja de recepción</label><textarea id="i-terminos" rows={10} value={terminos} disabled={!puedeEditar} onChange={(e) => setTerminos(e.target.value)} /></div>
      </div>
      {puedeEditar && <div className="fila fin"><button type="submit" className="primario chico">Guardar</button></div>}
    </form>
  );
}

function Locales({ cfg, puedeEditar, alGuardar, alFallar }: Parte) {
  return (
    <div className="tabla">
      <table>
        <thead><tr><th>Local</th><th>Dirección</th><th>Teléfono</th><th>Serie de nota de venta</th><th>Serie de boleta</th><th>Serie de factura</th>{puedeEditar && <th />}</tr></thead>
        <tbody>{cfg.locales.map((l) => <FilaLocal key={l.id} local={l} puedeEditar={puedeEditar} alGuardar={alGuardar} alFallar={alFallar} />)}</tbody>
      </table>
    </div>
  );
}

function FilaLocal({ local, puedeEditar, alGuardar, alFallar }: { local: LocalEmpresa } & Omit<Parte, 'cfg'>) {
  const [d, setD] = useState({ direccion: local.direccion ?? '', telefono: local.telefono ?? '', serieNotaVenta: local.serieNotaVenta ?? '', serieBoleta: local.serieBoleta ?? '', serieFactura: local.serieFactura ?? '' });
  const guardar = async () => { try { alGuardar(await api.editarLocalEmpresa(local.id, d), `${local.nombre}: guardado.`); } catch (x) { alFallar(x); } };
  const celda = (k: keyof typeof d, etiqueta: string, serie = false) => (
    <td><input aria-label={`${etiqueta} de ${local.nombre}`} value={d[k]} disabled={!puedeEditar} maxLength={serie ? 4 : 200} className={serie ? 'serie' : ''}
      onChange={(e) => setD((x) => ({ ...x, [k]: serie ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value }))} /></td>
  );
  return (
    <tr>
      <td><b>{local.nombre}</b></td>
      {celda('direccion', 'Dirección')}
      {celda('telefono', 'Teléfono')}
      {celda('serieNotaVenta', 'Serie de nota de venta', true)}
      {celda('serieBoleta', 'Serie de boleta', true)}
      {celda('serieFactura', 'Serie de factura', true)}
      {puedeEditar && <td><button type="button" className="primario chico" aria-label={`Guardar ${local.nombre}`} onClick={() => void guardar()}>Guardar</button></td>}
    </tr>
  );
}
