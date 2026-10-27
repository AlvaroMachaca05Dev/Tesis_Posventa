import { useCallback, useEffect, useState } from 'react';
import { api, Me, sesion } from './api';
import Login from './Login';
import Shell from './Shell';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [cargando, setCargando] = useState<boolean>(!!sesion.token());

  const cargar = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      sesion.limpiar();
      setMe(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesion.token()) void cargar();
  }, [cargar]);

  if (cargando) return <div className="centro">Cargando…</div>;
  if (!me)
    return (
      <Login
        onIngreso={async () => {
          setCargando(true);
          await cargar();
        }}
      />
    );
  return (
    <Shell
      me={me}
      onCambio={cargar}
      onSalir={() => {
        sesion.limpiar();
        setMe(null);
      }}
    />
  );
}
