import { FormEvent, useState } from 'react';
import { api, sesion } from './api';

// Cuentas de demostración (solo con VITE_DEMO_MODE=true). La contraseña viene del .env local, nunca del código.
const CUENTAS = [
  ['superusuario@rmotriz.com', 'Desarrollador'],
  ['ti@demo.local', 'Superadministrador'],
  ['admin@demo.local', 'Administrador'],
  ['jefe@demo.local', 'Jefe de taller'],
  ['cajera@demo.local', 'Cajera'],
  ['tecnico@demo.local', 'Técnico'],
  ['logistico@demo.local', 'Logístico'],
  ['reemplazo@demo.local', 'Cajera + Logístico'],
];

export default function Login({ onIngreso }: { onIngreso: () => void | Promise<void> }) {
  const demo = import.meta.env.VITE_DEMO_MODE === 'true';
  const [correo, setCorreo] = useState<string>(demo ? ((import.meta.env.VITE_DEMO_CORREO as string) ?? '') : '');
  const [password, setPassword] = useState<string>(demo ? ((import.meta.env.VITE_DEMO_PASSWORD as string) ?? '') : '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await api.login(correo, password);
      sesion.guardar(r.token);
      await onIngreso();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="tarjeta" onSubmit={enviar}>
        <div className="logo">
          R <b>Motriz</b>
        </div>
        <p className="sub">Posventa · Workspace</p>
        <h1>Iniciar sesión</h1>
        {demo && <p className="demo">Modo demostración: cuentas de ejemplo, sin datos reales.</p>}
        <label htmlFor="correo">Usuario</label>
        <input id="correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="usuario@empresa.com" autoComplete="username" required />
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="primario" disabled={enviando}>Ingresar</button>
        {demo && (
          <div className="cuentas">
            <b>Cuentas de demostración</b>
            <div>
              {CUENTAS.map(([c, rol]) => (
                <button type="button" key={c} onClick={() => setCorreo(c)} title={c}>
                  {rol}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
