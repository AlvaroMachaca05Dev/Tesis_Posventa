import { CatalogoOds } from './api';

export type ServicioCatalogo = CatalogoOds['servicios'][number];

/** Un servicio tiene ficha si trae los servicios que incluye o las acciones a realizar. */
export const tieneFicha = (s?: ServicioCatalogo | null): s is ServicioCatalogo => !!s && (!!s.subservicios?.length || !!s.pasos?.length || !!s.descripcion);

/** Ojito para ver u ocultar la ficha de un servicio, justo antes del detalle de la línea. */
export function BotonFicha(p: { abierta: boolean; nombre: string; alAlternar: () => void }) {
  return (
    <button type="button" className="ficha-ojo" aria-expanded={p.abierta} aria-label={`${p.abierta ? 'Ocultar' : 'Ver'} ficha de ${p.nombre}`} title={p.abierta ? 'Ocultar ficha' : 'Ver ficha'} onClick={p.alAlternar}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /></svg>
    </button>
  );
}

/** Recuadro pequeño bajo la línea: primero los servicios que incluye (con sus tiempos, sin precios) y debajo las acciones a realizar. */
export function FichaServicio({ fi, nombre }: { fi: ServicioCatalogo; nombre: string }) {
  const acciones = !!fi.descripcion || !!fi.pasos?.length;
  return (
    <div className="ficha-servicio" role="group" aria-label={`Ficha de ${nombre}`}>
      {!!fi.subservicios?.length && <div><h4>Servicios:</h4><ul>{fi.subservicios.map((x) => <li key={x.nombre}>{x.nombre} · {x.horas} h</li>)}</ul></div>}
      {acciones && (
        <div>
          <h4>Acciones a realizar:</h4>
          {fi.descripcion && <p className="ficha-texto">{fi.descripcion}</p>}
          {!!fi.pasos?.length && <ul>{fi.pasos.map((x, k) => <li key={k}>{x.operacion}{x.incluye.length > 0 && <ul>{x.incluye.map((y) => <li key={y.paso + y.accion}>{y.paso}: {y.accion}</li>)}</ul>}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
