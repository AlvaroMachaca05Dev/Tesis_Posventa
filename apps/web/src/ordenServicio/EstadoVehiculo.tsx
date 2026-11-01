import { useState } from 'react';
import { api, EstadoVehiculo, Orden } from '../comun/api';

const COMBUSTIBLE = ['Sin registrar', 'Reserva', '1/4', '1/2', '3/4', 'Lleno'];
const FLUIDOS = ['Aceite de motor', 'Líquido de frenos', 'Líquido de embrague', 'Refrigerante', 'Aceite hidráulico', 'Limpia parabrisas'];
const INVENTARIO = ['Llanta de repuesto', 'Kit de carretera', 'Herramientas', 'Botiquín', 'Extintor'];
const DANOS = ['Rayado', 'Fogueado', 'Sumido', 'Picado', 'Golpeado', 'No presenta daños'];

/** Lista de chequeo del vehículo al ingresar: ventana compacta, casi cuadrada. */
export default function EstadoVehiculoModal({ orden, bloqueada, alCerrar }: { orden: Orden; bloqueada: boolean; alCerrar: (o?: Orden) => void }) {
  const [e, setE] = useState<EstadoVehiculo>(() => ({ combustible: 'Sin registrar', ...(orden.estadoVehiculo ?? {}) }));
  const [error, setError] = useState('');
  const texto = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '');
  const lista = (k: string) => (Array.isArray(e[k]) ? (e[k] as string[]) : []);
  const marcar = (k: string, x: string) => setE({ ...e, [k]: lista(k).includes(x) ? lista(k).filter((y) => y !== x) : [...lista(k), x] });
  const campo = (k: string, etiqueta: string, ph = '') => <label>{etiqueta}<input aria-label={etiqueta} value={texto(k)} placeholder={ph} disabled={bloqueada} onChange={(x) => setE({ ...e, [k]: x.target.value })} /></label>;
  const checks = (k: string, titulo: string, opciones: string[]) => (
    <fieldset><legend>{titulo}</legend>{opciones.map((x) => <label key={x} className="chk"><input type="checkbox" checked={lista(k).includes(x)} disabled={bloqueada} onChange={() => marcar(k, x)} />{x}</label>)}</fieldset>
  );
  return (
    <div className="fondo-modal sobre">
      <div className="modal-estado" role="dialog" aria-modal="true" aria-label="Estado del vehículo">
        <div className="fila entre"><h3>Estado del vehículo · ODS {orden.codigo}</h3><button type="button" aria-label="Cerrar" onClick={() => alCerrar()}>✕</button></div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="rejilla-estado">
          {campo('objetosValor', 'Objetos de valor', 'Especifique objetos')}
          <label>Nivel de combustible<select aria-label="Nivel de combustible" value={texto('combustible')} disabled={bloqueada} onChange={(x) => setE({ ...e, combustible: x.target.value })}>{COMBUSTIBLE.map((c) => <option key={c}>{c}</option>)}</select></label>
          {checks('fluidos', 'Fluidos a nivel', FLUIDOS)}
          {checks('inventario', 'Inventario', INVENTARIO)}
          {campo('otrosFluidos', 'Otros fluidos')}
          {campo('otrosInventario', 'Otros (inventario)')}
          {checks('danos', 'Daños', DANOS)}
          <div className="col">{campo('documentos', 'Documentos', 'Documentos del vehículo')}{campo('otrosDanos', 'Otros daños')}</div>
          <label className="doble">Comentarios<textarea aria-label="Comentarios" rows={2} value={texto('comentarios')} disabled={bloqueada} onChange={(x) => setE({ ...e, comentarios: x.target.value })} /></label>
        </div>
        <div className="fila fin">
          <button type="button" onClick={() => alCerrar()}>Cancelar</button>
          {!bloqueada && <button type="button" className="primario chico" onClick={async () => { try { alCerrar(await api.editarOrden(orden.id, { estadoVehiculo: e })); } catch (x) { setError((x as Error).message); } }}>Guardar</button>}
        </div>
      </div>
    </div>
  );
}
