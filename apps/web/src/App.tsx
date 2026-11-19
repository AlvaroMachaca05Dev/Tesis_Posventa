import { useCallback, useEffect, useState } from 'react';
import { api, Me, sesion } from './comun/api';
import Login from './sesion/Login';
import Shell from './sesion/Shell';

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
  // Al cambiar el logo de la empresa se vuelve a leer el perfil, para que la cabecera lo muestre de inmediato.
  useEffect(() => {
    const alCambiar = () => { void api.me().then(setMe).catch(() => undefined); };
    window.addEventListener('empresa-cambio', alCambiar);
    return () => window.removeEventListener('empresa-cambio', alCambiar);
  }, []);

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
