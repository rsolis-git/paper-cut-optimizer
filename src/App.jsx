import React, { useState, useEffect, useMemo, useRef } from 'react';

// Constantes de diseño para el canvas
const MAX_CANVAS_WIDTH = 500;
// La constante CANVAS_ASPECT_RATIO no es estrictamente necesaria aquí ya que el canvas se dimensiona dinámicamente.

/**
 * Componente principal de la aplicación.
 */
const App = () => {
  // --- Estados para los parámetros de entrada (en pulgadas) ---
  // Aceptamos strings para evitar problemas de redondeo y conversión de input
  const [cutWidth, setCutWidth] = useState("8.5"); // Ancho del Arte
  const [cutHeight, setCutHeight] = useState("11.0"); // Largo del Arte
  const [sheetWidth, setSheetWidth] = useState("17.0"); // Ancho del Pliego
  const [sheetHeight, setSheetHeight] = useState("22.0"); // Largo del Pliego
  
  // MARGENES Y VALORES PREDETERMINADOS
  const [lateralMargin, setLateralMargin] = useState("0.375"); // Margen Lateral (Izquierda/Derecha)
  const [gutter, setGutter] = useState("0.125"); // Margen entre Etiquetas (Gutter)
  const [tail, setTail] = useState("0.375"); // Cola (Margen inferior)
  const [grip, setGrip] = useState("0.5"); // Pinza (Margen superior de agarre)

  // Estado para almacenar el layout calculado y mostrado
  const [displayLayout, setDisplayLayout] = useState(null);
  // Estado para indicar si los inputs han cambiado desde la última vez que se calculó
  const [isDirty, setIsDirty] = useState(true);
  // Estado para rastrear si el layout actual es el óptimo o una versión invertida
  const [currentLayoutKey, setCurrentLayoutKey] = useState('optimal'); // 'optimal' | 'inverted'

  // --- Cálculo del Layout Bruto (se recalcula automáticamente con useMemo) ---
  const rawLayout = useMemo(() => {
    // Convertir todas las entradas a números y asegurar que no sean NaN
    const CW = Math.max(0, parseFloat(cutWidth) || 0);
    const CH = Math.max(0, parseFloat(cutHeight) || 0);
    const SW = Math.max(0, parseFloat(sheetWidth) || 0);
    const SH = Math.max(0, parseFloat(sheetHeight) || 0);
    const LM = Math.max(0, parseFloat(lateralMargin) || 0); // Margen Lateral
    
    // NOTA IMPORTANTE: Para la imprenta, la Pinza (Grip) típicamente va en la parte de abajo (Tail)
    // y la Cola (Tail) va en la parte de arriba (Grip).
    // Se ha invertido el uso de las variables G y T para reflejar esto en la UI y el cálculo:
    // G = Margen Superior (Cola)
    // T = Margen Inferior (Pinza o Grip)
    const T_calc = Math.max(0, parseFloat(grip) || 0);  // Pinza (Grip) se usa como Margen Inferior
    const G_calc = Math.max(0, parseFloat(tail) || 0);  // Cola (Tail) se usa como Margen Superior

    const GT = Math.max(0, parseFloat(gutter) || 0);       // Margen entre Etiquetas

    // Asegurar dimensiones positivas y margen mínimo
    if (CW <= 0 || CH <= 0 || SW <= 0 || SH <= 0) {
      return { optimalKey: null, error: "Las dimensiones deben ser positivas.", sheetW: SW, sheetH: SH, grip: T_calc, lateralMargin: LM, gutter: GT, tail: G_calc };
    }
    // Verificación de espacio mínimo disponible (Ancho: 2*LM; Alto: G_calc + T_calc)
    if (G_calc + T_calc >= SH || 2 * LM >= SW) {
        return { optimalKey: null, error: "Los márgenes o pinza/cola son demasiado grandes para el pliego.", sheetW: SW, sheetH: SH, grip: T_calc, lateralMargin: LM, gutter: GT, tail: G_calc };
    }

    // 1. Área Útil para el tendido de piezas (excluyendo márgenes exteriores)
    const effectiveW = SW - 2 * LM;     // Ancho utilizable
    const effectiveH = SH - G_calc - T_calc; // Alto utilizable (entre Cola y Pinza)

    // 2. Función para calcular el ajuste (N) en una dimensión
    const calculateFit = (usableLength, pieceLength, gutterLength) => {
        if (pieceLength + gutterLength <= 0) return 0;
        // Number.EPSILON para corregir problemas de precisión de coma flotante.
        return Math.floor((usableLength + gutterLength) / (pieceLength + gutterLength) + Number.EPSILON);
    };

    // --- Opción A: Arte W x H (Normal) ---
    const fitW1 = calculateFit(effectiveW, CW, GT);
    const fitH1 = calculateFit(effectiveH, CH, GT);
    const total1 = fitW1 * fitH1;

    // --- Opción B: Arte H x W (Rotado 90 grados) ---
    const fitW2 = calculateFit(effectiveW, CH, GT); // Ancho de la pieza es CH
    const fitH2 = calculateFit(effectiveH, CW, GT); // Alto de la pieza es CW
    const total2 = fitW2 * fitH2;

    // 4. Seleccionar la mejor opción
    const optimalKey = total1 >= total2 ? 'A' : 'B';

    // Se devuelven ambos layouts para permitir la inversión manual.
    // Los valores de grip y tail devueltos son los originales para fines de visualización en la UI
    return {
        layoutA: { total: total1, fitW: fitW1, fitH: fitH1, rotated: false, cutW: CW, cutH: CH },
        layoutB: { total: total2, fitW: fitW2, fitH: fitH2, rotated: true, cutW: CH, cutH: CW },
        optimalKey,
        sheetW: SW, sheetH: SH,
        // Los valores de los estados originales son los que se pasan
        grip: Math.max(0, parseFloat(grip) || 0), 
        lateralMargin: LM, 
        gutter: GT, 
        tail: Math.max(0, parseFloat(tail) || 0),
        error: null
    };

  }, [cutWidth, cutHeight, sheetWidth, sheetHeight, lateralMargin, gutter, tail, grip]);

  // Efecto para marcar el estado como 'sucio' si algún input cambia
  useEffect(() => {
    setIsDirty(true);
  }, [cutWidth, cutHeight, sheetWidth, sheetHeight, lateralMargin, gutter, tail, grip]);


  // Handlers
  const handleCalculate = () => {
    if (rawLayout.error) {
        // Si hay error, solo mostramos el error sin intentar construir un layout válido.
        setDisplayLayout({ ...rawLayout, total: 0, fitW: 0, fitH: 0 });
        setCurrentLayoutKey('optimal');
        setIsDirty(false);
        return;
    }
    
    // Elige el layout óptimo para la visualización inicial
    const optimalLayout = rawLayout.optimalKey === 'A' ? rawLayout.layoutA : rawLayout.layoutB;

    setDisplayLayout({
        ...optimalLayout,
        sheetW: rawLayout.sheetW, sheetH: rawLayout.sheetH,
        grip: rawLayout.grip, lateralMargin: rawLayout.lateralMargin, 
        gutter: rawLayout.gutter, tail: rawLayout.tail, error: rawLayout.error
    });
    setCurrentLayoutKey('optimal');
    setIsDirty(false);
  };
  
  const handleInvert = () => {
      if (!displayLayout) return;

      // Determinamos qué layout mostrar al invertir:
      // Si el actual es el óptimo ('A' o 'B'), mostramos el alternativo.
      const currentIsOptimal = currentLayoutKey === 'optimal';
      const keyToDisplay = currentIsOptimal 
                           ? (rawLayout.optimalKey === 'A' ? 'B' : 'A')
                           : rawLayout.optimalKey;

      const invertedLayout = rawLayout[`layout${keyToDisplay}`];

      setDisplayLayout({
          ...invertedLayout,
          sheetW: rawLayout.sheetW, sheetH: rawLayout.sheetH,
          grip: rawLayout.grip, lateralMargin: rawLayout.lateralMargin, 
          gutter: rawLayout.gutter, tail: rawLayout.tail, error: rawLayout.error
      });
      // Marcamos el nuevo estado (si era óptimo, ahora es invertido; si era invertido, ahora es óptimo)
      setCurrentLayoutKey(currentIsOptimal ? 'inverted' : 'optimal');
  };

  const handleRevert = () => {
      if (!displayLayout || currentLayoutKey === 'optimal') return;
      
      // Simplemente volvemos al layout originalmente seleccionado como óptimo
      const optimalLayout = rawLayout.optimalKey === 'A' ? rawLayout.layoutA : rawLayout.layoutB;
      
      setDisplayLayout({
          ...optimalLayout,
          sheetW: rawLayout.sheetW, sheetH: rawLayout.sheetH,
          grip: rawLayout.grip, lateralMargin: rawLayout.lateralMargin, 
          gutter: rawLayout.gutter, tail: rawLayout.tail, error: rawLayout.error
      });
      setCurrentLayoutKey('optimal');
  };

  const handlePrint = () => {
    // Abre el diálogo de impresión del navegador
    window.print();
  };

  const layout = displayLayout; // Usamos el layout que se está mostrando


  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-inter">
      {/* Estilos para impresión: ajustados para hoja Carta */}
      <style>{`
        @media print {
            /* Define el tamaño del papel Carta (Letter) y los márgenes de impresión */
            @page {
                size: Letter portrait; /* Usar Letter (8.5in x 11in) en modo vertical */
                margin: 0.5in; /* Márgenes ligeros para el contenido */
            }
            
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            
            /* Cambiar el contenedor principal de grid a bloque para que fluya verticalmente */
            .container-print { 
                display: block !important; 
                width: 7.5in; /* Ancho de la página menos los márgenes */
                margin: 0 auto;
            }
            
            /* Ajustar el espaciado y el ancho de las columnas en la impresión */
            .col-span-1, .lg\\:col-span-1 {
                width: 100% !important; /* Cada "columna" ocupa todo el ancho */
                margin-bottom: 20px; /* Separación entre módulos */
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: none !important;
            }
            
            .print-results { page-break-after: avoid; } /* Evita salto de página innecesario */
            
            /* Asegurar que el croquis no se desborde */
            canvas {
                max-width: 100% !important;
                height: auto !important;
            }
            
            /* Quitar el fondo del body */
            body, html {
                background: none !important;
            }
        }
        .print-only { display: none; }
      `}</style>

      <h1 className="text-3xl font-bold text-center text-indigo-700 mb-6 border-b-2 pb-2 no-print">
        Optimizador de Corte de Pliego
      </h1>
      <h1 className="print-only text-xl font-bold text-center mb-4">Reporte de Optimización de Pliego</h1>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 container-print">
        {/* --- Columna de Controles (1) - Ocultar en impresión --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg h-min space-y-4 col-span-1 no-print">
          <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-3">
            1. Dimensiones del Arte (Pulgadas)
          </h2>
          {/* Diseño a dos columnas para Ancho y Largo */}
          <div className="grid grid-cols-2 gap-4">
            <InputGroup
              label="Ancho"
              value={cutWidth}
              onChange={e => setCutWidth(e.target.value)}
            />
            <InputGroup
              label="Largo"
              value={cutHeight}
              onChange={e => setCutHeight(e.target.value)}
            />
          </div>

          <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-3 pt-4">
            2. Dimensiones del Pliego (Pulgadas)
          </h2>
          {/* Diseño a dos columnas para Ancho Pliego y Largo Pliego */}
          <div className="grid grid-cols-2 gap-4">
            <InputGroup
              label="Ancho Pliego"
              value={sheetWidth}
              onChange={e => setSheetWidth(e.target.value)}
            />
            <InputGroup
              label="Largo Pliego"
              value={sheetHeight}
              onChange={e => setSheetHeight(e.target.value)}
            />
          </div>
        </div>

        {/* --- Columna de Margenes, Botones y Resultados (2) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg h-min space-y-4 col-span-1 print-results">
          <div className="no-print">
            <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-3">
              3. Márgenes y Agarre (Pulgadas)
            </h2>
            {/* Diseño a dos columnas para Márgenes y Agarre */}
            <div className="grid grid-cols-2 gap-4">
                <InputGroup
                  label="Margen Lateral"
                  value={lateralMargin}
                  onChange={e => setLateralMargin(e.target.value)}
                  description="Izq./Der."
                />
                <InputGroup
                  label="Gutter"
                  value={gutter}
                  onChange={e => setGutter(e.target.value)}
                  description="Entre etiquetas."
                />
                {/* INTERCAMBIADO: Grip va en el cálculo como Pinza (abajo), Tail como Cola (arriba) */}
                <InputGroup
                  label="Pinza (Grip)"
                  value={grip}
                  onChange={e => setGrip(e.target.value)}
                  description="Agarre inferior."
                />
                <InputGroup
                  label="Cola (Tail)"
                  value={tail}
                  onChange={e => setTail(e.target.value)}
                  description="Margen superior."
                />
            </div>
            
            {/* Botón de Cálculo */}
            <div className="flex flex-col space-y-3 mt-8">
              <button 
                onClick={handleCalculate} 
                className={`w-full p-3 rounded-lg font-semibold transition duration-200 shadow-md ${
                  isDirty 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-green-500 text-white cursor-default'
                }`}
                disabled={!isDirty}
              >
                {isDirty ? 'Calcular Optimización' : 'Valores Actualizados'}
              </button>
            </div>
          </div>
          
          {/* Resultados */}
          <div className={`mt-6 ${!layout ? 'hidden' : ''}`}>
            <h2 className="text-xl font-bold text-green-700 border-t pt-4 mt-6">
              Resultado de Optimización
            </h2>
            {layout && (
              <div className="text-lg space-y-1">
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600">Total de Piezas:</span>
                  <span className="font-bold text-3xl text-indigo-600">{layout.total}</span>
                </p>
                <p className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Ajuste Horizontal:</span>
                  <span className="font-semibold text-gray-800">{layout.fitW}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-600">Ajuste Vertical:</span>
                  <span className="font-semibold text-gray-800">{layout.fitH}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-600">Orientación del Arte:</span>
                  <span className={`font-semibold ${layout.rotated ? 'text-orange-500' : 'text-blue-500'}`}>
                    {layout.rotated ? 'Rotado (H x W)' : 'Normal (W x H)'}
                  </span>
                </p>
                <p className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Dim. Pliego Utilizado:</span>
                  <span className="font-semibold text-gray-800">{layout.sheetW}" x {layout.sheetH}"</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-600">Dim. Arte Utilizado:</span>
                  <span className="font-semibold text-gray-800">{layout.cutW}" x {layout.cutH}"</span>
                </p>
                
                {currentLayoutKey === 'inverted' && (
                    <div className="bg-orange-100 border border-orange-400 text-orange-700 p-3 rounded mt-4">
                        <p className="font-semibold">Visualizando Layout Invertido</p>
                    </div>
                )}


                {isDirty && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded mt-4 no-print">
                        <p className="font-semibold">Advertencia:</p>
                        <p>Los datos han cambiado. Pulse "Calcular Optimización" para actualizar el resultado y el croquis.</p>
                    </div>
                )}
                
                {layout.error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded mt-4">
                        <p className="font-semibold">Error:</p>
                        <p>{layout.error}</p>
                    </div>
                )}
              </div>
            )}
          </div>
          
          {/* Mensaje inicial */}
          {!layout && (
            <div className="p-6 text-center text-gray-500 bg-gray-100 rounded-lg mt-8 border border-dashed no-print">
                <p className="font-semibold">¡Bienvenido!</p>
                <p>Ingrese los valores y pulse "Calcular Optimización" para ver el resultado.</p>
            </div>
          )}
          {/* EL BOTÓN DE IMPRIMIR SE HA MOVIDO ABAJO DE TODO EL GRID */}

        </div>

        {/* --- Croquis de Corte (3) --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg col-span-1 lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-700 border-b pb-2 mb-4">
            Croquis de Corte
          </h2>
          {layout && layout.total > 0 ? (
            <LayoutCanvas layout={layout} />
          ) : (
            <div className="flex justify-center items-center h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
                Croquis disponible tras el cálculo.
            </div>
          )}
          
          {/* Botones de Inversión (NUEVOS) */}
          {layout && layout.total > 0 && (
             <div className="flex justify-center space-x-4 mt-4 no-print">
                <button 
                    onClick={handleInvert} 
                    className="flex-1 bg-blue-500 text-white p-2 rounded-lg font-semibold hover:bg-blue-600 transition duration-200 shadow-md"
                >
                    Invertir Orientación
                </button>
                <button 
                    onClick={handleRevert} 
                    disabled={currentLayoutKey === 'optimal'}
                    className={`flex-1 p-2 rounded-lg font-semibold transition duration-200 shadow-md ${
                        currentLayoutKey === 'inverted' 
                        ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Volver (Óptimo)
                </button>
             </div>
          )}

          <p className="text-sm text-gray-500 mt-4 no-print">
            El croquis muestra el pliego con la Pinza (rojo, inferior), la Cola (gris oscuro, superior) y los Márgenes Laterales (gris claro). Las piezas se muestran en verde. El espacio entre ellas es el Gutter.
          </p>
        </div>
      </div>
      
      {/* --- Botón de Imprimir (Movido a la parte inferior de la interfaz, fuera del grid) --- */}
      <div className="mt-8 pt-6 border-t border-gray-300 max-w-2xl mx-auto no-print">
        <button 
            onClick={handlePrint} 
            className="w-full bg-gray-600 text-white p-4 rounded-lg font-extrabold text-lg hover:bg-gray-700 transition duration-200 shadow-2xl tracking-wider"
        >
            Imprimir Croquis
        </button>
      </div>
      {/* --- NUEVA SECCIÓN: Pie de Página/Firma --- */}
      <footer className="mt-8 pt-4 pb-4 text-center text-gray-500 text-sm no-print">
        <p>
          By <span className="font-semibold text-gray-700">Rafael Solis</span> (<a href="mailto:creactivo.online@gmail.com" className="text-indigo-500 hover:text-indigo-600 underline">creactivo.online@gmail.com</a>)
        </p>
      </footer>
      {/* --- FIN NUEVA SECCIÓN --- */}
      
    </div>
  );
};

/**
 * Componente para un grupo de entrada de texto. (Ajustado para ser compacto y responsive)
 */
const InputGroup = ({ label, value, onChange, description = '' }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-sm font-medium text-gray-600 flex justify-between items-center space-x-2">
      <span className="truncate">{label}</span>
      <input
        type="number"
        step="0.001" 
        min="0"
        value={value}
        onChange={onChange}
        // w-full para adaptarse a la columna, text-right para mejor visualización
        className="w-1/2 p-1 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition duration-150 text-right text-sm"
      />
    </label>
    {description && <p className="text-xs text-gray-400 mt-0.5 text-right">{description}</p>}
  </div>
);

/**
 * Componente para dibujar el Croquis de Corte.
 * Ahora dibuja la Pinza (Grip) en la parte inferior y la Cola (Tail) en la superior.
 */
const LayoutCanvas = ({ layout }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.total === 0 || layout.error) return;

    const ctx = canvas.getContext('2d');
    
    // Dimensiones del Pliego (Sheet) y Márgenes
    const SW = layout.sheetW;
    const SH = layout.sheetH;
    const LM = layout.lateralMargin; // Margen Lateral
    const GT = layout.gutter;       // Gutter
    // Pinza (Grip) va abajo. Cola (Tail) va arriba.
    const GRIP = layout.grip; // Pinza (Grip, valor original del input)
    const TAIL = layout.tail; // Cola (Tail, valor original del input)

    // Determinar la escala para que el pliego quepa en MAX_CANVAS_WIDTH
    const scaleFactor = MAX_CANVAS_WIDTH / SW; 

    const drawW = SW * scaleFactor;
    const drawH = SH * scaleFactor;

    canvas.width = drawW;
    canvas.height = drawH;
    ctx.clearRect(0, 0, drawW, drawH);

    // --- Dibujar el Pliego (Sheet) ---
    ctx.strokeStyle = '#374151'; // Gris oscuro
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, drawW, drawH);

    // --- Dibujar la COLA (TAIL) - Margen Superior ---
    const tailH = TAIL * scaleFactor;
    ctx.fillStyle = 'rgba(107, 114, 128, 0.2)'; // Gris más oscuro
    ctx.fillRect(0, 0, drawW, tailH); 
    ctx.fillStyle = '#374151';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Cola (T)', 5, 15);

    // --- Dibujar la PINZA (GRIP) - Margen Inferior ---
    const gripH = GRIP * scaleFactor;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Rojo claro
    ctx.fillRect(0, drawH - gripH, drawW, gripH);
    ctx.strokeStyle = '#ef4444'; // Rojo
    ctx.lineWidth = 1;
    ctx.strokeRect(0, drawH - gripH, drawW, gripH);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Pinza (G)', 5, drawH - 5);


    // --- Dibujar los Márgenes Laterales (Lateral Margin) ---
    const lateralMarginW = LM * scaleFactor;
    // Área imprimible es entre Cola (arriba) y Pinza (abajo)
    const printableAreaH = drawH - tailH - gripH;
    
    // Margen Izquierdo (entre Cola y Pinza)
    ctx.fillStyle = 'rgba(107, 114, 128, 0.1)'; // Gris claro
    ctx.fillRect(0, tailH, lateralMarginW, printableAreaH);
    // Margen Derecho (entre Cola y Pinza)
    ctx.fillRect(drawW - lateralMarginW, tailH, lateralMarginW, printableAreaH);
    
    // --- Dibujar las Piezas de Arte y Gutters ---
    const cutDrawW = layout.cutW * scaleFactor;
    const cutDrawH = layout.cutH * scaleFactor;
    const gutterDraw = GT * scaleFactor;

    ctx.strokeStyle = '#34d399'; // Verde claro
    ctx.fillStyle = 'rgba(52, 211, 153, 0.4)'; // Verde
    ctx.lineWidth = 1;

    // Posición inicial: Después de la Cola (arriba) y el Margen Izquierdo
    const startX = lateralMarginW;
    const startY = tailH; // Empieza después de la Cola (Margen Superior)

    for (let i = 0; i < layout.fitW; i++) {
      for (let j = 0; j < layout.fitH; j++) {
        // Coordenadas con Gutter incluido
        const x = startX + i * cutDrawW + i * gutterDraw;
        const y = startY + j * cutDrawH + j * gutterDraw;

        // Dibujamos la pieza
        ctx.fillRect(x, y, cutDrawW, cutDrawH);
        ctx.strokeRect(x, y, cutDrawW, cutDrawH); // Línea de corte (Trim Box)
        
        // Dibujar Gutter Vertical (líneas horizontales de separación)
        // No dibujamos el último gutter si es que existe
        if (j < layout.fitH - 1) {
            ctx.fillStyle = 'rgba(107, 114, 128, 0.3)'; // Gris para el Gutter
            ctx.fillRect(x, y + cutDrawH, cutDrawW, gutterDraw);
        }

        // Dibujar Gutter Horizontal (líneas verticales de separación)
        if (i < layout.fitW - 1) {
            ctx.fillStyle = 'rgba(107, 114, 128, 0.3)';
            // Extender el Gutter vertical hasta el borde superior de la siguiente pieza.
            const nextGutterV = (j < layout.fitH - 1) ? gutterDraw : 0;
            ctx.fillRect(x + cutDrawW, y, gutterDraw, cutDrawH + nextGutterV); 
        }
      }
    }

    // --- Etiquetar el Pliego ---
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Pliego: ${SW}" x ${SH}"`, drawW / 2, drawH - 5 - gripH);
     // Ajustado para estar encima de la pinza

  }, [layout]);

  return (
    <div className="flex justify-center items-center p-2 border border-gray-200 rounded-lg bg-gray-100">
        <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg shadow-inner border border-gray-300" />
        
    </div>
    
  );
};

export default App;