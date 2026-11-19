import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, PlanPreventivo, Servicio } from '../comun/api';
import { useConfirmar } from '../comun/Confirmar';
import { MenuAcciones } from '../comun/TablaMaestro';

const km = (n: number) => `${n.toLocaleString('es-PE')} km`;
const meses = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`;
const ACEITE: Record<string, string> = { M: 'Mineral o semisintético', S: 'Sintético o full sintético' };
const NOMBRE_CORTO: Record<string, string> = { SV094: 'Express', SV095: 'Menor', SV096: 'Mayor' };
/** Servicios a elegir (*): el afinamiento lleva limpieza de carburador o de inyectores, no ambos. */
const A_ELEGIR = ['Limpieza y mantenimiento de carburador', 'Limpieza de inyectores y obturador / IAC'];

const frecuenciaAfin = (p: PlanPreventivo) => {
  if (p.combustible === 'Diésel') return 'no lleva';
  const n = p.visitas.filter((v) => v.afinamiento).length, m = p.meses * p.visitas.length, porAnio = (n * 12) / m;
  return 'lleva · ' + (porAnio === 1 ? 'una vez al año' : porAnio === 2 ? 'dos veces al año' : `${n} cada ${meses(m)}`);
};

/** RF-026, RF-028 y RF-030: los 8 planes (combustible × uso × aceite), con su ciclo y la edición de sus reglas. */
export default function Planes({ nivel }: { nivel: 'A' | 'E' | 'V' }) {
  const [planes, setPlanes] = useState<PlanPreventivo[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [elegido, setElegido] = useState('');
  const [editando, setEditando] = useState<{ plan: PlanPreventivo; soloReglas: boolean } | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { preguntar, modal } = useConfirmar();
  const cargar = useCallback(async () => {
    const [p, s] = await Promise.all([api.planesPreventivos(), api.servicios()]);
    setPlanes(p);
    setServicios(s);
    setElegido((e) => (p.some((x) => x.id === e) ? e : p.find((x) => x.codigo === 'GP-M')?.id ?? p[0]?.id ?? ''));
  }, []);
  useEffect(() => { cargar().catch((e) => setError((e as Error).message)); }, [cargar]);
  const puede = nivel !== 'V';
  const plan = planes.find((x) => x.id === elegido) ?? null;

  async function eliminar(p: PlanPreventivo) {
    if ((await preguntar({ titulo: '¿Eliminar este plan?', mensaje: `Se eliminará ${p.codigo} · ${p.nombre}.`, boton: 'Eliminar', peligro: true })) === null) return;
    try {
      await api.eliminarPlan(p.id);
      setError(''); setMensaje(`Plan ${p.codigo} eliminado.`);
      await cargar();
    } catch (e) { setMensaje(''); setError((e as Error).message); }
  }

  return (
    <div className="panel ancho">
      {modal}
      <h1>Planes preventivos</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {mensaje && <p className="ok" role="status">{mensaje}</p>}
      <div className="filtros-plan">
        <label htmlFor="pl-filtro">Plan</label>
        <select id="pl-filtro" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          {planes.map((x) => <option key={x.id} value={x.id}>{`${x.codigo} · ${x.nombre}${x.activo ? '' : ' (inactivo)'}`}</option>)}
        </select>
      </div>
      {plan && (
        <div className="tabla tabla-plan">
          <table>
            <thead><tr>{puede && <th>Acciones</th>}<th>Plan</th><th>Combustible</th><th>Uso</th><th>Aceite</th><th>Código</th><th>Visita</th><th>Ciclo</th><th>Afinamiento</th><th>Vehículos</th><th>Estado</th></tr></thead>
            <tbody><tr>
              {puede && <td className="acc"><MenuAcciones>
                <button type="button" onClick={() => setEditando({ plan, soloReglas: false })}>Editar plan</button>
                <button type="button" onClick={() => setEditando({ plan, soloReglas: true })}>Editar reglas</button>
                <button type="button" className="peligro" onClick={() => void eliminar(plan)}>Eliminar</button>
              </MenuAcciones></td>}
              <td>{plan.nombre}</td><td>{plan.combustible}</td><td>{plan.uso}</td><td>{ACEITE[plan.aceite]}</td>
              <td><span className="pill">{plan.codigo}</span></td>
              <td>{km(plan.km)} o {meses(plan.meses)}</td>
              <td>{plan.visitas.length} visitas · {meses(plan.meses * plan.visitas.length)} · {km(plan.km * plan.visitas.length)}</td>
              <td>{frecuenciaAfin(plan)}</td><td>{plan.vehiculos}</td>
              <td><span className={'pill ' + (plan.activo ? 'verde' : 'rojo')}>{plan.activo ? 'Activo' : 'Inactivo'}</span></td>
            </tr></tbody>
          </table>
        </div>
      )}
      {plan && <VistaCiclo key={plan.id} plan={plan} servicios={servicios} />}
      {editando && <EditarPlan plan={editando.plan} soloReglas={editando.soloReglas} alCancelar={() => setEditando(null)}
        alGuardar={async () => { setEditando(null); setError(''); setMensaje('Plan guardado.'); await cargar(); }} />}
    </div>
  );
}

/** El ciclo: visitas numeradas con su hito acumulado, lo que incluye cada una y las reglas del plan. */
function VistaCiclo({ plan, servicios }: { plan: PlanPreventivo; servicios: Servicio[] }) {
  const [abiertas, setAbiertas] = useState<number[]>([]);
  const porCodigo = new Map(servicios.map((s) => [s.codigo, s]));
  const L = plan.visitas.length;
  const todas = abiertas.length === L;
  const alternar = (i: number) => setAbiertas((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
  // Afinamiento: una sola lista (carburado e inyección); los servicios a elegir llevan *.
  const afin: { nombre: string; horas: number }[] = [];
  for (const cod of ['SV071', 'SV072']) for (const x of porCodigo.get(cod)?.subservicios ?? []) if (!afin.some((a) => a.nombre === x.nombre)) afin.push(x);
  const diesel = plan.combustible === 'Diésel';
  return (
    <section className="vista-ciclo" aria-label={`Ciclo de ${plan.codigo}`}>
      <div>
        <div className="fila entre"><h2>Ciclo del plan</h2><button type="button" className="chico" onClick={() => setAbiertas(todas ? [] : plan.visitas.map((_, i) => i))}>{todas ? 'Plegar todo' : 'Desplegar todo'}</button></div>
        <ol className="visitas">
          {plan.visitas.map((v, i) => {
            const sv = porCodigo.get(v.codigo);
            const abierta = abiertas.includes(i);
            return (
              <li key={i} className={'visita' + (abierta ? ' abierta' : '')}>
                <button type="button" className="visita-cab" aria-expanded={abierta} onClick={() => alternar(i)}>
                  <span className="visita-num">{i + 1}</span>
                  <span className="visita-nombre">{NOMBRE_CORTO[v.codigo] ?? v.nombre}{v.afinamiento && <span className="pill violeta">+ afinamiento</span>}</span>
                  <span className="visita-cuando">{km(plan.km * (i + 1))} o {meses(plan.meses * (i + 1))}</span>
                  <span className="visita-flecha">{abierta ? '▾' : '▸'}</span>
                </button>
                {abierta && (
                  <div>
                    <ul className="visita-lista">
                      {(sv?.subservicios ?? []).map((x) => <li key={x.nombre}>{x.nombre} <span className="suave">· {x.horas} h</span></li>)}
                      {!sv?.subservicios?.length && <li className="suave">Sin lista de servicios.</li>}
                    </ul>
                    {v.afinamiento && (
                      <ul className="visita-lista">
                        <li className="titulo">Afinamiento</li>
                        {afin.map((x) => <li key={x.nombre}>{x.nombre}{A_ELEGIR.includes(x.nombre) && <sup className="a-elegir" title="A elegir: carburado o inyección">*</sup>} <span className="suave">· {x.horas} h</span></li>)}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          <li className="visita repite"><span className="visita-num">↻</span><span className="visita-nombre">Luego el ciclo se repite desde la visita 1 ({L} visitas, {meses(plan.meses * L)})</span></li>
        </ol>
      </div>
      <div className="reglas-plan">
        <h3>Reglas del plan</h3>
        <ul>
          <li><b>Intervalo:</b> el del aceite, cada {km(plan.km)} o {meses(plan.meses)}, lo que ocurra primero.</li>
          <li><b>Ciclo:</b> {L} visitas, {meses(plan.meses * L)} y {km(plan.km * L)}; después se repite igual.</li>
          <li><b>Afinamiento:</b> {diesel ? 'no lleva.' : `en los menores y mayores marcados, nunca con el express; ${plan.uso === 'Particular' ? 'una vez al año' : 'dos veces al año'}. Los servicios con * se escogen: carburado o inyección, no ambos.`}</li>
          {plan.patron && <li><b>Mini patrón:</b> {plan.patron}</li>}
          <li><b>Absorción:</b> un paquete superior reemplaza a los inferiores de la misma visita.</li>
          <li><b>Horizonte:</b> de 1 a 2 ciclos completos dentro de 24 meses; en este plan, {plan.horizonte} ciclo{plan.horizonte > 1 ? 's' : ''} ({meses(plan.meses * L * plan.horizonte)}).</li>
        </ul>
      </div>
    </section>
  );
}

const TOKENS = [['SV094', 'Express'], ['SV095', 'Menor'], ['SV096', 'Mayor'], ['SV095+AF', 'Menor + afinamiento'], ['SV096+AF', 'Mayor + afinamiento']];

function EditarPlan(p: { plan: PlanPreventivo; soloReglas: boolean; alCancelar: () => void; alGuardar: () => Promise<void> }) {
  const c0 = p.plan.ciclo;
  const diesel = p.plan.combustible === 'Diésel';
  const [nombre, setNombre] = useState(p.plan.nombre);
  const [activo, setActivo] = useState(p.plan.activo);
  const [kmV, setKm] = useState(String(c0.km));
  const [mesesV, setMeses] = useState(String(c0.meses));
  const [secuencia, setSecuencia] = useState<string[]>(c0.secuencia);
  const [horizonte, setHorizonte] = useState(String(c0.horizonte));
  const [patron, setPatron] = useState(c0.patron ?? '');
  const [error, setError] = useState('');
  const opciones = TOKENS.filter(([t]) => !(diesel && t.endsWith('+AF')));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    try {
      await api.editarPlan(p.plan.id, p.soloReglas ? { ciclo: { km: Number(kmV), meses: Number(mesesV), secuencia, horizonte: Number(horizonte), patron } } : { nombre, activo });
      await p.alGuardar();
    } catch (er) { setError((er as Error).message); }
  }

  return (
    <div className="fondo-modal">
      <form className="modal-form" role="dialog" aria-modal="true" aria-label={p.soloReglas ? 'Editar reglas del plan' : 'Editar plan'} onSubmit={guardar}>
        <div className="fila entre"><h2>{p.soloReglas ? 'Editar reglas' : 'Editar plan'} · {p.plan.codigo}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={p.alCancelar}>×</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dos-col">
          {!p.soloReglas && <>
            <div className="campo ancha"><label htmlFor="pl-nombre">Nombre del plan</label><input id="pl-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} /></div>
            <div className="campo"><label htmlFor="pl-estado">Estado</label><select id="pl-estado" value={activo ? '1' : '0'} onChange={(e) => setActivo(e.target.value === '1')}><option value="1">Activo</option><option value="0">Inactivo</option></select></div>
          </>}
          {p.soloReglas && <>
            <div className="campo"><label htmlFor="pl-km">Visita cada (km)</label><input id="pl-km" inputMode="numeric" value={kmV} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} /></div>
            <div className="campo"><label htmlFor="pl-meses">o cada (meses)</label><input id="pl-meses" inputMode="numeric" value={mesesV} onChange={(e) => setMeses(e.target.value.replace(/\D/g, ''))} /></div>
            <div className="campo ancha"><span>Secuencia de visitas</span>
              <ol className="secuencia-edit">
                {secuencia.map((t, i) => (
                  <li key={i} className="fila">
                    <select aria-label={`Visita ${i + 1}`} value={t} onChange={(e) => setSecuencia(secuencia.map((x, j) => (j === i ? e.target.value : x)))}>{opciones.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                    <button type="button" className="chico" aria-label={`Quitar visita ${i + 1}`} disabled={secuencia.length <= 1} onClick={() => setSecuencia(secuencia.filter((_, j) => j !== i))}>×</button>
                  </li>
                ))}
              </ol>
              <button type="button" className="chico" disabled={secuencia.length >= 12} onClick={() => setSecuencia([...secuencia, 'SV094'])}>+ Agregar visita</button>
            </div>
            <div className="campo"><label htmlFor="pl-hz">Ciclos en la línea de tiempo</label><select id="pl-hz" value={horizonte} onChange={(e) => setHorizonte(e.target.value)}><option value="1">1 ciclo</option><option value="2">2 ciclos</option></select></div>
            <div className="campo ancha"><label htmlFor="pl-patron">Mini patrón</label><input id="pl-patron" value={patron} onChange={(e) => setPatron(e.target.value)} maxLength={300} /></div>
          </>}
        </div>
        <div className="fila fin">
          <button type="button" onClick={p.alCancelar}>Cancelar</button>
          <button type="submit" className="primario chico">Guardar</button>
        </div>
      </form>
    </div>
  );
}
