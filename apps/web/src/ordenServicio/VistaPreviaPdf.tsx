/** Vista previa de un PDF dentro de un modal: el visor del navegador trae la impresión y la descarga. */
export default function VistaPreviaPdf({ titulo, url, alCerrar }: { titulo: string; url: string; alCerrar: () => void }) {
  return (
    <div className="fondo-modal">
      <div className="modal-form modal-pdf" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="fila entre"><h2>{titulo}</h2><button type="button" className="cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button></div>
        <iframe className="visor-pdf" title={`Vista previa: ${titulo}`} src={url} />
        <div className="fila fin"><button type="button" className="primario chico" onClick={alCerrar}>Cerrar</button></div>
      </div>
    </div>
  );
}
