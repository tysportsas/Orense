// lib/formModel.ts
//
// Modelo de datos del Método Orense de Scouting: la MISMA definición de
// niveles (N1-N5), secciones, campos y escalas que la versión de un solo
// archivo, adaptada para TypeScript + React + Supabase.
//
// - Cada informe se guarda en Supabase como una fila de `reports` con una
//   columna `data: jsonb` que contiene exactamente los mismos ids de campo
//   que aquí se definen (p. ej. `nombre`, `puesto`, `att_LATERAL_cierres`).
// - `visibleSections(data)` decide qué secciones aplican según lo que el
//   observador ya respondió (categoría, nivel de informe, puesto...).
// - No hay aquí nada de DOM ni de localStorage: eso vive en los componentes
//   React (components/FieldRenderer.tsx) y en lib/reports.ts.

export type FieldOption = string | { v: string; l: string };

export interface Field {
  type: 'select' | 'chips' | 'text' | 'area' | 'date' | 'combo' | 'rate' | 'cards' | 'pitch' | 'pyramid' | 'file' | 'photo' | 'note';
  id?: string;
  label?: string;
  options?: any[];
  legend?: string[];
  values?: number[];
  req?: boolean;
  short?: string;
  hint?: string;
  link?: boolean;
  suggest?: boolean;
  ctrl?: boolean;
  tx?: (v: string) => string;
  autocap?: string;
  validate?: (v: any) => string | null;
  title?: string;
  text?: string;
}

export interface Section {
  id: string;
  title: string;
  desc: string;
  radar?: boolean;
  when: (d: Record<string, any>) => boolean;
  fields: (d: Record<string, any>) => Field[];
}

export type ReportData = Record<string, any>;

const LEGACY_FIELD_ALIASES: Array<[RegExp, string]> = [
  [/^rol_de_jugador$/, 'rol'],
  [/^tipo_de_visualizacion$/, 'visualizacion'],
  [/^agente(?:_\d+)?$/, 'agente'],
  [/^link_?2__tm__besoccer/, 'link2'],
  [/^link__tm__besoccer/, 'link1'],
  [/^control_orientado(?:_|$)/, 'tec_control_orientado'],
  [/^control(?:_|$)/, 'tec_control'],
  [/^ejecucion(?:_|$)/, 'tec_ejecucion'],
  [/^pase_corto(?:_|$)/, 'tec_pase_corto'],
  [/^pase_largo(?:_|$)/, 'tec_pase_largo'],
  [/^pase(?:_|$)/, 'tec_pase'],
  [/^remate(?:_|$)/, 'tec_remate'],
  [/^conducciones(?:_|$)/, 'tec_conducciones'],
  [/^juego_aereo(?:_|$)/, 'tec_juego_aereo'],
  [/^registros_pierna_habil(?:_|$)/, 'tec_pierna_habil'],
  [/^registros_pierna_no_+habil(?:_|$)/, 'tec_pierna_no_habil'],
  [/^decisiones_con_balon(?:_|$)/, 'tac_dec_con'],
  [/^decisiones_sin_balon(?:_|$)/, 'tac_dec_sin'],
  [/^comportamiento_abp_of(?:_|$)/, 'tac_abp_of'],
  [/^comportamiento_abp_def(?:_|$)/, 'tac_abp_def'],
  [/^busqueda_visual(?:_|$)/, 'tac_busq_vis'],
  [/^observacion_16$/, 'tac_obs'],
  [/^observacion_17$/, 'tec_obs'],
  [/^observacion_18$/, 'psi_obs'],
  [/^observacion_19$/, 'rend_obs'],
  [/^observacion_39$/, 'fis_obs'],
  [/^carisma(?:_|$)/, 'psi_carisma'],
  [/^liderazgo(?:_|$)/, 'psi_liderazgo'],
  [/^compromiso(?:_|$)/, 'psi_compromiso'],
  [/^resiliencia(?:_|$)/, 'psi_resiliencia'],
  [/^impulsividad(?:_|$)/, 'psi_impulsividad'],
  [/^concentracion(?:_|$)/, 'psi_concentracion'],
  [/^autodisciplina(?:_|$)/, 'psi_autodisciplina'],
  [/^adaptacion(?:_|$)/, 'rend_ada'],
  [/^tendencia_a_lesion(?:_|$)/, 'rend_les'],
  [/^rendimiento_ultima_temporada(?:_|$)/, 'rend_ult']
];

export function canonicalReportFieldKey(sourceKey: string): string {
  const key = String(sourceKey ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9_]/g, '_');

  const alias = LEGACY_FIELD_ALIASES.find(([pattern]) => pattern.test(key))?.[1];
  if (alias) return alias;

  const position = key.match(/^(arquero|lateral|central|mediocentro|interior|extremo|mediapunta|punta)(?:_\d+)?$/);
  return position ? `car_${position[1].toUpperCase()}` : key;
}

function normalizeReportValue(fieldKey: string, value: any) {
  if (/^(?:att_|tac_|tec_|tecf_|fisf_|menf_|psi_|fis_|rend_|ins_)/.test(fieldKey) && typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[1-5]$/.test(trimmed)) return Number(trimmed);
  }
  const characteristic = fieldKey.match(/^car_(ARQUERO|LATERAL|CENTRAL|MEDIOCENTRO|INTERIOR|EXTREMO|MEDIAPUNTA|PUNTA)$/);
  if (characteristic && typeof value === 'string') {
    const label = value.split(':')[0].trim().toUpperCase();
    if (label === 'SIN VER' || CARAC[characteristic[1]]?.some(([known]) => known === label)) return label;
  }
  return value;
}

export function excelSerialDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;

  const serial = Number(raw);
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;

  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

export function normalizeReportData(data: ReportData): ReportData {
  const normalized = { ...data };
  for (const [sourceKey, value] of Object.entries(data)) {
    const fieldKey = canonicalReportFieldKey(sourceKey);
    if (fieldKey === sourceKey) {
      normalized[fieldKey] = normalizeReportValue(fieldKey, value);
      continue;
    }

    if (normalized[fieldKey] == null || normalized[fieldKey] === '') {
      normalized[fieldKey] = normalizeReportValue(fieldKey, value);
    }
  }

  // Convertir seriales de Excel a fechas ISO
  for (const fieldKey of ['fnac', 'fpartido', 'marca_temporal']) {
    const converted = excelSerialDate(normalized[fieldKey]);
    if (converted) {
      normalized[fieldKey] = converted;
    }
  }
  
  // Si partido es serial pero fpartido aún no tiene fecha, intentar conversión
  if (!normalized.fpartido) {
    const serialDate = excelSerialDate(normalized.partido);
    if (serialDate) {
      normalized.fpartido = serialDate;
      // Limpiar partido si era un serial (usuario puede completarlo manualmente)
      normalized.partido = '';
    }
  }

  if (typeof normalized.agente === 'string' && /^https?:\/\//i.test(normalized.agente.trim())) {
    const misplacedLink = normalized.agente.trim();
    delete normalized.agente;
    if (!normalized.link1) normalized.link1 = misplacedLink;
    else if (!normalized.link2) normalized.link2 = misplacedLink;
  }

  if (FORM_CATS.includes(String(normalized.categoria ?? '').trim().toUpperCase()) && nivel(normalized) === 1) {
    for (const key of ['control', 'pase', 'remate', 'conducciones', 'juego_aereo', 'pierna_habil', 'pierna_no_habil']) {
      const value = normalized[`tec_${key}`];
      if (normalized[`tecf_${key}`] == null && value != null) normalized[`tecf_${key}`] = value;
    }
    for (const key of ['liderazgo', 'concentracion', 'resiliencia']) {
      const value = normalized[`psi_${key}`];
      if (normalized[`menf_${key}`] == null && value != null) normalized[`menf_${key}`] = value;
    }
  }

  return normalized;
}

export const OBSERVADORES = ['DANIEL ARANGO','JAVIER SEMELER','LUIS TOAPANTA','PABLO TOBON','EDSON MENDOZA','GUSTAVO PAREDES','MAURICIO MANCUELLO','ROMARIO TAPIA','ALEJANDRO TELLO','CT S11','CT S13','CT S15','CT S17','CT S19','CT CANTERA','CT ACADEMIAS'];

export const NAC_LABEL = {COSTARICA:'COSTA RICA',ELSALVADOR:'EL SALVADOR',ESTADOSUNIDOS:'ESTADOS UNIDOS',COSTADEMARFIL:'COSTA DE MARFIL',COREADELSUR:'COREA DEL SUR',OTRANACIONALIDAD:'OTRA NACIONALIDAD'};
export const NACIONALIDADES = ['ECUADOR','COLOMBIA','VENEZUELA','PANAMÁ','PERÚ','PARAGUAY','URUGUAY','ARGENTINA','BRASIL','HONDURAS','COSTARICA','GUATEMALA','ELSALVADOR','MÉXICO','CHILE','BOLIVIA','ESTADOSUNIDOS','ESPAÑA','PORTUGAL','GHANA','NIGERIA','SENEGAL','COSTADEMARFIL','CAMERÚN','JAPÓN','COREADELSUR','OTRANACIONALIDAD']
  .map(v => ({v, l: NAC_LABEL[v] || v}));

export const ALTURAS = Array.from({length: 56}, (_, i) => `${150 + i} CM`);

export const CANTONES = {
  'AZUAY':['CUENCA','GIRÓN','GUALACEO','NABÓN','PAUTE','PUCARÁ','SAN FERNANDO','SANTA ISABEL','SÍGSIG','OÑA','CHORDELEG','EL PAN','SEVILLA DE ORO','GUACHAPALA','CAMILO PONCE ENRÍQUEZ'],
  'BOLÍVAR':['GUARANDA','CHILLANES','CHIMBO','ECHEANDÍA','SAN MIGUEL','CALUMA','LAS NAVES'],
  'CAÑAR':['AZOGUES','BIBLIÁN','CAÑAR','LA TRONCAL','EL TAMBO','DÉLEG','SUSCAL'],
  'CARCHI':['TULCÁN','BOLÍVAR','ESPEJO','MIRA','MONTÚFAR','SAN PEDRO DE HUACA'],
  'CHIMBORAZO':['RIOBAMBA','ALAUSÍ','COLTA','CHAMBO','CHUNCHI','GUAMOTE','GUANO','PALLATANGA','PENIPE','CUMANDÁ'],
  'COTOPAXI':['LATACUNGA','LA MANÁ','PANGUA','PUJILÍ','SALCEDO','SAQUISILÍ','SIGCHOS'],
  'EL ORO':['MACHALA','ARENILLAS','ATAHUALPA','BALSAS','CHILLA','EL GUABO','HUAQUILLAS','MARCABELÍ','PASAJE','PIÑAS','PORTOVELO','SANTA ROSA','ZARUMA','LAS LAJAS'],
  'ESMERALDAS':['ESMERALDAS','ELOY ALFARO','MUISNE','QUININDÉ','SAN LORENZO','ATACAMES','RIOVERDE'],
  'GALÁPAGOS':['SAN CRISTÓBAL','ISABELA','SANTA CRUZ'],
  'GUAYAS':['GUAYAQUIL','ALFREDO BAQUERIZO MORENO (JUJÁN)','BALAO','BALZAR','COLIMES','DAULE','DURÁN','EL EMPALME','EL TRIUNFO','MILAGRO','NARANJAL','NARANJITO','PALESTINA','PEDRO CARBO','SAMBORONDÓN','SANTA LUCÍA','SALITRE','SAN JACINTO DE YAGUACHI','PLAYAS','SIMÓN BOLÍVAR','CORONEL MARCELINO MARIDUEÑA','LOMAS DE SARGENTILLO','NOBOL','GENERAL ANTONIO ELIZALDE (BUCAY)','ISIDRO AYORA'],
  'IMBABURA':['IBARRA','ANTONIO ANTE','COTACACHI','OTAVALO','PIMAMPIRO','SAN MIGUEL DE URCUQUÍ'],
  'LOJA':['LOJA','CALVAS','CATAMAYO','CELICA','CHAGUARPAMBA','ESPÍNDOLA','GONZANAMÁ','MACARÁ','PALTAS','PUYANGO','SARAGURO','SOZORANGA','ZAPOTILLO','PINDAL','QUILANGA','OLMEDO'],
  'LOS RÍOS':['BABAHOYO','BABA','MONTALVO','PUEBLOVIEJO','QUEVEDO','URDANETA','VENTANAS','VINCES','PALENQUE','BUENA FE','VALENCIA','MOCACHE','QUINSALOMA'],
  'MANABÍ':['PORTOVIEJO','BOLÍVAR','CHONE','EL CARMEN','FLAVIO ALFARO','JIPIJAPA','JUNÍN','MANTA','MONTECRISTI','PAJÁN','PICHINCHA','ROCAFUERTE','SANTA ANA','SUCRE','TOSAGUA','24 DE MAYO','PEDERNALES','OLMEDO','PUERTO LÓPEZ','JAMA','JARAMIJÓ','SAN VICENTE'],
  'MORONA SANTIAGO':['MORONA','GUALAQUIZA','LIMÓN INDANZA','PALORA','SANTIAGO','SUCÚA','HUAMBOYA','SAN JUAN BOSCO','TAISHA','LOGROÑO','PABLO SEXTO','TIWINTZA'],
  'NAPO':['TENA','ARCHIDONA','EL CHACO','QUIJOS','CARLOS JULIO AROSEMENA TOLA'],
  'ORELLANA':['ORELLANA','AGUARICO','LA JOYA DE LOS SACHAS','LORETO'],
  'PASTAZA':['PASTAZA','MERA','SANTA CLARA','ARAJUNO'],
  'PICHINCHA':['QUITO','CAYAMBE','MEJÍA','PEDRO MONCAYO','RUMIÑAHUI','SAN MIGUEL DE LOS BANCOS','PEDRO VICENTE MALDONADO','PUERTO QUITO'],
  'SANTA ELENA':['SANTA ELENA','LA LIBERTAD','SALINAS'],
  'SANTO DOMINGO DE LOS TSÁCHILAS':['SANTO DOMINGO','LA CONCORDIA'],
  'SUCUMBÍOS':['LAGO AGRIO','GONZALO PIZARRO','PUTUMAYO','SHUSHUFINDI','SUCUMBÍOS','CASCALES','CUYABENO'],
  'TUNGURAHUA':['AMBATO','BAÑOS DE AGUA SANTA','CEVALLOS','MOCHA','PATATE','QUERO','SAN PEDRO DE PELILEO','SANTIAGO DE PÍLLARO','TISALEO'],
  'ZAMORA CHINCHIPE':['ZAMORA','CHINCHIPE','NANGARITZA','YACUAMBI','YANTZAZA','EL PANGUI','CENTINELA DEL CÓNDOR','PALANDA','PAQUISHA']
};
export const LUGARES: string[] = [];
for (const [prov, list] of Object.entries(CANTONES)) for (const c of list) LUGARES.push(`${c} – ${prov}`);
LUGARES.push('EXTRANJERO', 'SIN INFO');

export const CATEGORIAS = ['PROFESIONAL','S19','S17','S15','S13','ACADEMIAS'];
export const FORM_CATS = ['S15','S13','ACADEMIAS'];
export const PRO_CATS = ['PROFESIONAL','S19','S17'];

export const LEVELS = [
  {n:1, label:'INFORME GENERAL DESCRIPTIVO – RECIÉN CONOCIDO – PRIMER INFORME', name:'Informe general descriptivo', short:'N1 General descriptivo', sub:'Recién conocido, primer informe', who:['Scouts','Secretario técnico','Director deportivo','Cuerpos técnicos'], bg:'#b58a1e'},
  {n:2, label:'INFORME DEPORTIVO – POCO CONOCIDO – 1 A 2 PARTIDOS', name:'Informe deportivo', short:'N2 Deportivo', sub:'Poco conocido, 1 a 2 partidos', who:['Scouts','Secretario técnico'], bg:'#5d7a30'},
  {n:3, label:'INFORME ESPECÍFICO – CONOCIDO – 3 A 5 PARTIDOS', name:'Informe específico', short:'N3 Específico', sub:'Conocido, 3 a 5 partidos', who:['Scouts','Secretario técnico','Director deportivo'], bg:'#2e6f43'},
  {n:4, label:'INFORME FINAL – CONOCIDO EN PROFUNDIDAD – 6 O MÁS PARTIDOS', name:'Informe final', short:'N4 Final', sub:'Conocido en profundidad, 6 o más partidos', who:['Secretario técnico','Director deportivo'], bg:'#15502e'},
  {n:5, label:'INFORME INSTITUCIONAL – CONOCIMIENTO INTEGRAL – EVALUACIÓN PARA TOMA DE DECISIÓN', name:'Informe institucional', short:'N5 Institucional', sub:'Conocimiento integral, evaluación para toma de decisión', who:['Secretario técnico','Director deportivo'], bg:'#0f3a22'}
];
export const TIPOS = LEVELS.map(l => l.label);

export const VAL_PARTIDO = ['1. SIN IMPORTANCIA','2. BAJA RELEVANCIA','3. RELEVANCIA NORMAL','4. ALTA RELEVANCIA','5. MUY IMPORTANTE','SIN VER'];
export const VAL_PROY = ['1.SIN VALORAR','2.RENDIMIENTO BAJO: No supera lo propio.','3.RENDIMIENTO ESTANCADO: Iguala pero no supera lo propio.','4.BUEN RENDIMIENTO: Iguala y puede superar lo propio.','5.MUY BUEN RENDIMIENTO: Supera lo propio.'];
export const VALORACION = ['5.FICHAR','4.INTERESANTE','3.SEGUIR VIENDO','2.DESCARTAR','1.SIN VER'];

export const SC_TEC = ['Malo','Regular','Correcto','Bien','Muy bien'];
export const SC_POS = ['Muy deficiente','Deficiente','Aceptable','Bueno','Muy bueno'];
export const SC_DEC = ['% mayoría de malas','% más malas que buenas','% = buenas y malas','% más buenas que malas','Siempre buenas'];
export const SC_TRANS = ['Desconectado','Cambia por momentos pero lento','Dispuesto pero reactivo','Cambia','Cambia y es muy activo'];
export const SC_ABP = ['Sin importancia','Baja relevancia','Normal','Alta','Muy importante'];
export const SC_VIS = ['No escanea','Escanea poco','Escanea durante algunas acciones','Casi siempre escanea','Escanea siempre'];
export const SC_EXP = ['No la conoce','Poca experiencia, un año o menos','Experiencia pero poca continuidad, dos años y sin muchos minutos jugados','Con experiencia y buena continuidad','Mucha experiencia y continuidad'];
export const SC_LES = ['Muchas lesiones','Se lesiona frecuentemente','Casualmente se lesiona','Se lesiona poco','No se lesiona frecuentemente'];
export const SC_REND = ['Suplente con poca participación','Suplente y entrando con frecuencia','Alterna suplente y titular','Titular siendo cambio regular','Titular y sin mucho cambio'];
export const SC_ADAP = ['Mala','Poca adaptación','Buena pero tiene inconvenientes','Buena','Excelente'];
export const SC_INS = ['Muy malo','Malo','Regular','Bueno','Muy bueno'];
export const SC_FIS = ['Nada acorde a su posición','Desequilibrado','Poco acorde a su posición','Acorde pero debe mejorar para su posición','Muy acorde a su posición'];
export const SC_PRES = ['Crítico','Poco conveniente','Conveniente pero no fácil','Conveniente con posibilidad','Muy posible y conveniente'];

export const POS = ['ARQUERO','LATERAL','CENTRAL','MEDIOCENTRO','INTERIOR','EXTREMO','MEDIAPUNTA','PUNTA'];

export const CARAC = {
  ARQUERO:[
    ['ÁGIL','Se mueve con gran agilidad en su área pequeña y bajo palos. Tiene rápidos reflejos y puede cambiar de dirección con facilidad.'],
    ['PRESENCIA','De gran envergadura o complexión fuerte. Impone su presencia física en el área. Fuerte en el contacto cuerpo a cuerpo. Transmite seguridad a la defensa.'],
    ['COMPLETO','Portero muy completo, con buen juego de pies, manejo de área chica, capacidad de despeje y buena técnica en el mano a mano. No tiene debilidades marcadas.']],
  LATERAL:[
    ['AGUERRIDO','Lateral con mucho carácter competitivo. Fuerte en el cruce y en la marca al extremo rival. Sale a comerse la banda. Muy defensivo.'],
    ['ESTABLE','Muy sólido en la marca y posicionamiento defensivo. No deja espacios libres en su lateral. Apoya con criterio al central.'],
    ['VERTICAL','Le gusta proyectarse mucho en ataque. Busca constantemente generar superioridad por su banda. Llega con facilidad a zonas de centro al área.'],
    ['COMBINATIVO','Buen trato de balón en espacios reducidos. Asocia bien con mediocentros y extremos combinando con triangulaciones.']],
  CENTRAL:[
    ['ATLETA','Central con grandes condiciones físicas. Rápido y potente. Perfil de velocista para perseguir delanteros.'],
    ['ENVERGADURA','Complexión física alta. Excelente envergadura y timing para anticiparse por arriba. Corta todos los centros y pelotas aéreas. Contundente por alto.'],
    ['INTUITIVO','Lee perfectamente las intenciones ofensivas. Gran intuición para anticiparse y prever jugadas de ataque. Gran capacidad técnica.']],
  MEDIOCENTRO:[
    ['DEFENSIVO','Más posicional, que prioriza la contención y equilibrio posicional. Fuerte en la marca y quite de balón. Cubre espacios.'],
    ['MIXTO','Buen equilibrio entre la contención y la construcción de juego. Recupera balones y también organiza salidas progresivas.'],
    ['CREATIVO','Con mayor vocación ofensiva. Busca dar sentido al juego con pases entre líneas y balance inclinado al ataque.'],
    ['RECORRIDO','Gran resistencia que le permite abarcar mucho terreno. Recorre de área a área apoyando en defensa y ataque. Pulmón para el equipo.']],
  INTERIOR:[
    ['CREATIVO','Interior con gran talento individual y visión de juego. Ve y ejecuta pases que rompen líneas rivales.'],
    ['RECORRIDO','Capaz de abarcar todo el frente de ataque. Subiendo y bajando constantemente para apoyar. Gran resistencia.'],
    ['ASOCIATIVO','Juego de asociación con compañeros mediante triangulaciones en espacios reducidos para progresar.'],
    ['LLEGADOR','Ofensivo y vertical. Llega constantemente al área rival desde segunda línea para sorprender y rematar.']],
  EXTREMO:[
    ['TALENTO','Gran manejo del balón en espacios reducidos. Mucha calidad técnica para el regate y la conducción en corto.'],
    ['POTENTE','Poderoso en carrera con “patas” para desbordar por banda y desequilibrar. Reta y supera constantemente por fuerza al lateral de su lado.'],
    ['ASOCIATIVO','Es capaz de interiorizar, para enlazar pases que puedan permitir un juego por dentro.']],
  MEDIAPUNTA:[
    ['ASOCIATIVO','Juego de asociación con delanteros, interiores y mediocentros en espacios reducidos con pases rápidos y triangulaciones.'],
    ['LLEGADOR','Llega desde segunda línea para rematar al borde o dentro del área. Aparece sorpresivamente en el área rival.']],
  PUNTA:[
    ['ÁREA','Jugador con gran movilidad en el área chica. Pierde la marca con desmarques para rematar.'],
    ['REFERENCIA','Punto focal del ataque. Mantiene la posesión de espaldas y hace jugar a los medios.'],
    ['ESPACIOS','Excelente ocupando y atacando espacios entre líneas defensivas. Aparece sorpresivamente entre centrales.'],
    ['DINÁMICO','Delantero muy dinámico y en constante movimiento. Cambia de posición y cae a bandas.']]
};
export const CARRILERO = ['CARRILERO','Jugador de buen recorrido y capacidad de ejecución, habituado a desempeñarse en estructuras con línea de cinco. Se caracteriza por ser aguerrido, combinativo y participativo, con capacidad para aportar continuidad tanto en fase ofensiva como defensiva.'];

export const ATT = {
  ARQUERO:['Juego aéreo','Comunicación','Saque largo','Saque corto','Duelos 1vs1','Reinicio de juego','Dominio de área','Ataja penales','Anticipación','Blocaje'],
  LATERAL:['Anticipación','Capacidad de recorridos','Duelos defensivos','Duelos ofensivos','Inicio de juego','Cierres','Recursos para sorprender','Dominio de centros'],
  CENTRAL:['Referencia posicional','Contundencia en duelo aéreo','Anticipación','Cierres','Duelos defensivos','Contundencia en duelos defensivos','Inicio de juego'],
  MEDIOCENTRO:['Referencia posicional','Anticipación','Relevos','Duelos','Capacidad de recuperar y dar continuidad al juego','Contundencia defensiva','Dominio del ritmo del juego','Participación activa en el juego'],
  INTERIOR:['Referencia posicional','Anticipación','Duelos 1vs1','Capacidad de recuperar y dar continuidad al juego','Contundencia defensiva','Dominio del ritmo del juego','Capacidad creativa'],
  EXTREMO:['Movilidad','Dominio del espacio libre','Capacidad de recorrido','Profundidad','Duelos 1vs1','Capacidad de juego de fuera hacia dentro'],
  MEDIAPUNTA:['Capacidad creativa','Referencia posicional','Capacidad de crear opción de gol (finalización)','Duelos 1vs1','Capacidad de recuperar y dar continuidad al juego','Dominio del ritmo del juego','Participación activa en el juego'],
  PUNTA:['Referencia posicional','Juego de espaldas al arco rival','Ruptura','Apoyo','Repliegue','Duelos','Capacidad de crear opción de gol (finalización)']
};

export const MARKERS = [
  {c:'A',  pos:'ARQUERO',     x:52,  y:200},
  {c:'LI', pos:'LATERAL',     x:150, y:62},
  {c:'CI', pos:'CENTRAL',     x:150, y:150},
  {c:'CD', pos:'CENTRAL',     x:150, y:250},
  {c:'LD', pos:'LATERAL',     x:150, y:338},
  {c:'MC', pos:'MEDIOCENTRO', x:262, y:140},
  {c:'MC', pos:'MEDIOCENTRO', x:262, y:260},
  {c:'I',  pos:'INTERIOR',    x:372, y:145},
  {c:'I',  pos:'INTERIOR',    x:372, y:255},
  {c:'MP', pos:'MEDIAPUNTA',  x:452, y:200},
  {c:'E',  pos:'EXTREMO',     x:462, y:62},
  {c:'E',  pos:'EXTREMO',     x:462, y:338},
  {c:'P',  pos:'PUNTA',       x:585, y:200}
];


export const stripAcc = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const slug = s => stripAcc(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
export const cap = s => s.charAt(0) + s.slice(1).toLowerCase();
export const norm = s => stripAcc(String(s == null ? '' : s)).toLowerCase().trim();
export const opt = o => (typeof o === 'string' ? {v: o, l: o} : o);
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es', {day: 'numeric', month: 'short', year: 'numeric'}); };
export const fmtTs = ts => new Date(ts).toLocaleDateString('es', {day: 'numeric', month: 'short', year: 'numeric'});
export const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
export const tNombre = s => [...s].map(c => (c === 'ñ' || c === 'Ñ') ? 'Ñ' : stripAcc(c).toUpperCase()).join('').replace(/[^A-ZÑ\s'\-]/g, '').replace(/\s{2,}/g, ' ');
export const tUpper = s => s.toUpperCase();
export const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

export const sel = (id, label, options, o: Partial<Field> = {}): Field => ({type: 'select', id, label, options, ...o});
export const chips = (id, label, options, o: Partial<Field> = {}): Field => ({type: 'chips', id, label, options, ...o});
export const txt = (id, label, o: Partial<Field> = {}): Field => ({type: 'text', id, label, ...o});
export const area = (id, label, o: Partial<Field> = {}): Field => ({type: 'area', id, label, ...o});
export const date = (id, label, o: Partial<Field> = {}): Field => ({type: 'date', id, label, ...o});
export const combo = (id, label, options, o: Partial<Field> = {}): Field => ({type: 'combo', id, label, options, ...o});
export const rate = (id, label, legend, o: Partial<Field> = {}): Field => ({type: 'rate', id, label, legend, ...o});
export const cards = (id, label, options, o: Partial<Field> = {}): Field => ({type: 'cards', id, label, options, ...o});
export const pitch = (id, label, o: Partial<Field> = {}): Field => ({type: 'pitch', id, label, ...o});
export const file = (id, label, o: Partial<Field> = {}): Field => ({type: 'file', id, label, ...o});
export const note = (title, text): Field => ({type: 'note', title, text});
export const pyramid = (id, label, o: Partial<Field> = {}): Field => ({type: 'pyramid', id, label, ...o});
export const photo = (id, label, o: Partial<Field> = {}): Field => ({type: 'photo', id, label, ...o});

export const isF = d => FORM_CATS.includes(String(d?.categoria ?? '').trim().toUpperCase());
export const isP = (d: ReportData) => {
  if (PRO_CATS.includes(String(d?.categoria ?? '').trim().toUpperCase())) return true;
  return nivel(d) === 3 && Object.keys(d ?? {}).some((key) => /^(psi_|rend_)/.test(canonicalReportFieldKey(key)));
};
export const nivel = (d: ReportData): number => {
  const value = String(d?.tipo_informe ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!value) return 0;

  const index = TIPOS.findIndex((type) => type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === value);
  if (index >= 0) return index + 1;

  const number = value.match(/\bn\s*([1-5])\b/) || value.match(/\bnivel\s*([1-5])\b/) || value.match(/^\s*([1-5])\s*[.\-:]/);
  if (number) return Number(number[1]);
  if (value.includes('general')) return 1;
  if (value.includes('deportivo')) return 2;
  if (value.includes('especifico')) return 3;
  if (value.includes('institucional')) return 5;
  if (value.includes('final')) return 4;
  return 0;
};

export const SCALE_NOTE = 'Asigne la valoración que mejor represente el nivel observado del jugador en cada criterio, de acuerdo con la escala establecida y con base en la evidencia obtenida durante la observación.';
export const FIRST_NOTE = 'Registra lo posible en una primera visualización; de lo contrario, completa en un informe posterior.';

export const valFields = () => [
  sel('val_partido', 'Valoración del partido visto', VAL_PARTIDO, {req: true, short: 'Valoración partido visto'}),
  sel('val_proy', 'Valoración de proyección y rendimiento', VAL_PROY, {req: true, short: 'Valoración proyección y rendimiento'}),
  sel('valoracion', 'Valoración', VALORACION, {req: true, short: 'Valoración'})
];

export const caracFields = (d, carrilero) => {
  const p = String(d.puesto ?? '').trim().toUpperCase();
  if (!p) return [];
  const characteristics = CARAC[p];
  if (!characteristics) return [note('Puesto no reconocido', `El valor importado "${p}" no coincide con una posición del catálogo.`)];
  const list = characteristics.slice();
  if (p === 'LATERAL' && carrilero) list.push(CARRILERO);
  const options = [...list.map(([t, ds]) => ({v: t, t, d: ds})), {v: 'SIN VER', t: 'SIN VER', d: ''}];
  return [
    note('Caracterización de ' + cap(p), 'Selecciona la caracterización que mejor corresponda al puesto específico del jugador.'),
    cards('car_' + p, 'Caracterización', options, {req: true, short: 'Caracterización ' + cap(p)}),
    area('car_obs_' + p, 'Observación', {short: 'Caracterización ' + cap(p) + ' · Observación'})
  ];
};

export const attFields = d => {
  const p = String(d.puesto ?? '').trim().toUpperCase();
  if (!p) return [];
  const attributes = ATT[p];
  if (!attributes) return [note('Puesto no reconocido', `El valor importado "${p}" no coincide con una posición del catálogo.`)];
  return [
    note('Atributos de ' + cap(p), SCALE_NOTE),
    ...attributes.map(l => rate('att_' + p + '_' + slug(l), l, SC_POS, {short: cap(p) + ' · ' + l})),
    area('att_obs_' + p, 'Observación', {short: 'Atributos ' + cap(p) + ' · Observación'})
  ];
};

export const TAC = [
  ['dec_con', 'Decisiones con balón', SC_DEC],
  ['dec_sin', 'Decisiones sin balón', SC_DEC],
  ['trans_da', 'Transición defensa–ataque', SC_TRANS],
  ['trans_ad', 'Transición ataque–defensa', SC_TRANS],
  ['abp_of', 'Comportamiento ABP ofensivo', SC_ABP],
  ['abp_def', 'Comportamiento ABP defensivo', SC_ABP],
  ['busq_vis', 'Búsqueda visual', SC_VIS]
];
export const tacFields = () => [
  ...TAC.map(([k, l, lg]) => rate('tac_' + k, l, lg, {short: 'Táctico · ' + l})),
  area('tac_obs', 'Observación', {short: 'Táctico · Observación'})
];

export const TEC_F = [['control', 'Control'], ['pase', 'Pase'], ['remate', 'Remate'], ['conducciones', 'Conducciones'], ['juego_aereo', 'Juego aéreo'], ['pierna_habil', 'Registros pierna hábil'], ['pierna_no_habil', 'Registros pierna no hábil']];
export const TEC_P = [['control', 'Control'], ['pase_corto', 'Pase corto'], ['pase_largo', 'Pase largo'], ['remate', 'Remate'], ['ejecucion', 'Ejecución'], ['conducciones', 'Conducciones'], ['juego_aereo', 'Juego aéreo'], ['pierna_habil', 'Registros pierna hábil'], ['pierna_no_habil', 'Registros pierna no hábil'], ['control_orientado', 'Control orientado']];
export const tecFields = (prefix, items) => [
  ...items.map(([k, l]) => rate(prefix + k, l, SC_TEC, {short: 'Técnico · ' + l})),
  area(prefix + 'obs', 'Observación', {short: 'Técnico · Observación'})
];

export const SECTIONS = [
  {
    id: 'datos', title: 'Datos generales',
    desc: 'Información básica del jugador que permite identificarlo, contextualizar su situación deportiva y mantener criterios uniformes de registro en cada informe. Esta sección recopila los datos esenciales necesarios para su seguimiento, evaluación y consulta dentro del proceso de scouting.',
    when: () => true,
    fields: () => [
      sel('observador', 'Observador', OBSERVADORES, {req: true, short: 'Observador'}),
      txt('nombre', 'Nombre del jugador', {req: true, short: 'Nombre', tx: tNombre, autocap: 'characters', suggest: true,
        hint: 'Únicamente primer nombre y primer apellido, en mayúsculas, sin tilde ni puntos. Si el jugador ya fue observado, elígelo de la lista para cargar sus datos.'}),
      photo('foto', 'Foto del jugador', {short: 'Foto'}),
      date('fnac', 'Fecha de nacimiento', {req: true, short: 'Fecha de nacimiento', validate: v => v > todayISO() ? 'La fecha no puede ser futura.' : null}),
      sel('nacionalidad', 'Nacionalidad', NACIONALIDADES, {req: true, short: 'Nacionalidad'}),
      sel('altura', 'Altura', ALTURAS, {short: 'Altura', hint: 'Registrar si está disponible en primera instancia; de lo contrario, completar posteriormente.'}),
      chips('lateralidad', 'Lateralidad', ['DERECHO', 'IZQUIERDO', 'AMBIDIESTRO'], {req: true, short: 'Lateralidad'}),
      txt('club', 'Club', {req: true, short: 'Club', tx: tUpper, autocap: 'characters',
        hint: 'Únicamente el nombre corto, en mayúsculas. Ej.: ORENSE, IDV, LIGA QUITO, TOLIMA, NACIONAL.'}),
      txt('partido', 'Partido visto', {req: true, short: 'Partido visto', tx: tUpper, autocap: 'characters',
        hint: 'Únicamente el nombre corto, en mayúsculas. Ej.: ORENSE VS IDV, LIGA QUITO VS LIBERTAD, TOLIMA VS NACIONAL.'}),
      date('fpartido', 'Fecha del partido visto', {req: true, short: 'Fecha del partido', validate: v => v > todayISO() ? 'La fecha no puede ser futura.' : null}),
      txt('link1', 'Link (TM, BeSoccer o algún link relevante)', {short: 'Link 1', link: true}),
      txt('link2', 'Link adicional relevante', {short: 'Link 2', link: true}),
      chips('visualizacion', 'Tipo de visualización', ['VIVO', 'VIDEO'], {req: true, short: 'Tipo de visualización'}),
      chips('rol', 'Rol del jugador', ['TITULAR', 'ALTERNATIVA'], {req: true, short: 'Rol del jugador'}),
      chips('categoria', 'Categoría vista', CATEGORIAS, {req: true, ctrl: true, short: 'Categoría vista'})
    ]
  },

  /* ---------- formativas: S15, S13, ACADEMIAS ---------- */
  {
    id: 'f_perfil', title: 'Método Orense de scouting para formativas',
    desc: 'Diligencia el siguiente formulario de acuerdo con los lineamientos establecidos en el Método de Scouting de Orense S.C.',
    when: isF,
    fields: () => [
      combo('lugar_nac', 'Lugar de nacimiento (ciudad)', LUGARES, {req: true, short: 'Lugar de nacimiento',
        hint: 'Escribe para buscar el cantón; se muestra con su provincia. Si nació fuera del país, elige EXTRANJERO.',
        validate: v => LUGARES.some(x => norm(x) === norm(v)) ? null : 'Elige una opción de la lista.'}),
      sel('tipo_informe', 'Tipo de informe', TIPOS.slice(0, 3), {req: true, short: 'Tipo de informe'}),
      ...valFields()
    ]
  },
  {
    id: 'f_puesto', title: 'Puesto específico', desc: '',
    when: isF,
    fields: d => [pitch('puesto', 'Puesto específico', {req: true, ctrl: true, short: 'Puesto específico'}), ...caracFields(d, false)]
  },
  {
    id: 'f_tec', radar: true, title: 'Atributos técnicos', desc: SCALE_NOTE + ' ' + FIRST_NOTE,
    when: isF, fields: () => tecFields('tecf_', TEC_F)
  },
  {
    id: 'f_tac', radar: true, title: 'Atributos tácticos', desc: SCALE_NOTE + ' ' + FIRST_NOTE,
    when: isF, fields: () => tacFields()
  },
  {
    id: 'f_fis', radar: true, title: 'Atributos físicos', desc: SCALE_NOTE + ' ' + FIRST_NOTE,
    when: isF,
    fields: () => [
      ...[['altura', 'Altura'], ['peso', 'Peso'], ['velocidad', 'Velocidad'], ['resistencia', 'Resistencia']]
        .map(([k, l]) => rate('fisf_' + k, l, SC_FIS, {short: 'Físico (formativas) · ' + l})),
      area('fisf_obs', 'Observación', {short: 'Físico (formativas) · Observación'})
    ]
  },
  {
    id: 'f_men', radar: true, title: 'Atributos mentales', desc: SCALE_NOTE + ' ' + FIRST_NOTE,
    when: isF,
    fields: () => [
      ...[['liderazgo', 'Liderazgo'], ['concentracion', 'Concentración'], ['trabajo_equipo', 'Trabajo en equipo'], ['resiliencia', 'Resiliencia']]
        .map(([k, l]) => rate('menf_' + k, l, SC_TEC, {short: 'Mental (formativas) · ' + l})),
      area('menf_obs', 'Observación', {short: 'Mental (formativas) · Observación'})
    ]
  },

  /* ---------- profesional, S19, S17 ---------- */
  {
    id: 'p_tipo', title: 'Tipo de informe',
    desc: 'Selecciona el nivel de informe correspondiente según el grado de conocimiento y seguimiento acumulado del jugador. El nivel deberá avanzar progresivamente de acuerdo con las visualizaciones e informes previos realizados, desde su identificación inicial hasta la evaluación integral para una posible toma de decisión.',
    when: isP,
    fields: () => [pyramid('tipo_informe', 'Nivel del informe', {req: true, ctrl: true, short: 'Tipo de informe'})]
  },

  { /* N1 */
    id: 'p_gen', title: 'Informe general descriptivo',
    desc: 'Primer acercamiento al jugador. Visualización y caracterización general en las ligas y mercados objetivo, con el propósito de identificar perfiles y alimentar la Base de Datos. Todo jugador incorporado debe contar con este nivel.',
    when: d => isP(d) && nivel(d) === 1,
    fields: () => [
      ...valFields(),
      txt('agente', 'Agente', {short: 'Agente'})
    ]
  },
  {
    id: 'p_gen_pos', title: 'Caracterización del puesto específico', desc: '',
    when: d => isP(d) && nivel(d) === 1,
    fields: d => [pitch('puesto', 'Puesto específico', {req: true, ctrl: true, short: 'Puesto específico'}), ...caracFields(d, true)]
  },

  { /* N2 */
    id: 'p_dep', title: 'Informe deportivo',
    desc: 'Jugador poco conocido. Seguimiento inicial de 1 a 2 partidos, profundizando en su posición, características técnicas, tácticas, físicas y condicionales. Debe existir previamente información de Nivel 1.',
    when: d => isP(d) && nivel(d) === 2,
    fields: () => [...valFields(), txt('agente', 'Agente', {short: 'Agente'})]
  },
  {
    id: 'p_dep_pos', radar: true, title: 'Atributos del puesto específico', desc: '',
    when: d => isP(d) && nivel(d) === 2,
    fields: d => [pitch('puesto', 'Puesto específico', {req: true, ctrl: true, short: 'Puesto específico'}), ...attFields(d)]
  },
  {
    id: 'p_dep_tac', radar: true, title: 'Atributos tácticos', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 2, fields: () => tacFields()
  },
  {
    id: 'p_dep_tec', radar: true, title: 'Atributos técnicos', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 2, fields: () => tecFields('tec_', TEC_P)
  },

  { /* N3 */
    id: 'p_esp', title: 'Informe específico',
    desc: 'Jugador conocido. Seguimiento de 3 a 5 partidos, evaluando con mayor profundidad comportamientos, rendimiento, fortalezas, debilidades y adaptación al perfil institucional requerido. Debe contar con antecedentes de niveles anteriores.',
    when: d => isP(d) && nivel(d) === 3,
    fields: () => [...valFields(), txt('agente', 'Agente', {short: 'Agente'}), pitch('puesto', 'Puesto específico', {req: true, ctrl: true, short: 'Puesto específico'})]
  },
  {
    id: 'p_esp_psi', radar: true, title: 'Atributos psicológicos y mentales', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 3,
    fields: () => [
      ...[['liderazgo', 'Liderazgo'], ['compromiso', 'Compromiso'], ['concentracion', 'Concentración'], ['autodisciplina', 'Autodisciplina'], ['trabajo_equipo', 'Trabajo en equipo'], ['impulsividad', 'Impulsividad'], ['carisma', 'Carisma'], ['resiliencia', 'Resiliencia']]
        .map(([k, l]) => rate('psi_' + k, l, SC_TEC, {short: 'Psicológico · ' + l})),
      area('psi_obs', 'Observación', {short: 'Psicológico · Observación'})
    ]
  },
  {
    id: 'p_esp_fis', radar: true, title: 'Atributos físicos y condicionales', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 3,
    fields: () => [
      ...[['intensidad', 'Intensidad'], ['altura', 'Altura'], ['peso', 'Peso'], ['masa', 'Masa'], ['vel_inicial', 'Velocidad inicial'], ['vel_fondo', 'Velocidad fondo'],
          ['coordinacion', 'Coordinación'], ['fuerza_golpeo', 'Fuerza golpeo balón'], ['resistencia', 'Resistencia'], ['fuerza_salto', 'Fuerza salto'],
          ['cambios', 'Capacidad de cambios'], ['potencia', 'Potencia']]
        .map(([k, l]) => rate('fis_' + k, l, SC_FIS, {short: 'Físico y condicional · ' + l})),
      area('fis_obs', 'Observación', {short: 'Físico y condicional · Observación'})
    ]
  },
  {
    id: 'p_esp_rend', radar: true, title: 'Atributos de rendimiento', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 3,
    fields: () => [
      rate('rend_exp', 'Experiencia en la categoría', SC_EXP, {short: 'Rendimiento · Experiencia en la categoría'}),
      rate('rend_les', 'Tendencia a lesión', SC_LES, {short: 'Rendimiento · Tendencia a lesión'}),
      rate('rend_ult', 'Rendimiento última temporada', SC_REND, {short: 'Rendimiento · Última temporada'}),
      rate('rend_ada', 'Adaptación', SC_ADAP, {short: 'Rendimiento · Adaptación'}),
      area('rend_obs', 'Observación', {short: 'Rendimiento · Observación'})
    ]
  },

  { /* N4 */
    id: 'p_fin', title: 'Informe final',
    desc: 'Jugador conocido en profundidad. Seguimiento de 6 o más partidos y diferentes contextos competitivos. Permite consolidar su perfil, regularidad, fortalezas, oportunidades de mejora, proyección y posible encaje deportivo en Orense S.C.',
    when: d => isP(d) && nivel(d) === 4,
    fields: () => [
      ...valFields(),
      area('fortalezas', 'Fortalezas', {short: 'Fortalezas'}),
      area('oportunidades', 'Oportunidades de mejora', {short: 'Oportunidades de mejora'}),
      area('obs_generales', 'Observaciones generales', {short: 'Observaciones generales'}),
      file('adjunto', 'Adjunto', {short: 'Adjuntos'})
    ]
  },
  {
    id: 'p_fin_ins', title: 'Atributos institucionales', desc: SCALE_NOTE,
    when: d => isP(d) && nivel(d) === 4,
    fields: () => [
      pitch('puesto', 'Puesto específico', {req: true, ctrl: true, short: 'Puesto específico'}),
      rate('ins_entorno', 'Entorno cercano', SC_INS, {short: 'Institucional · Entorno cercano'}),
      rate('ins_personal', 'Pasado personal', SC_INS, {short: 'Institucional · Pasado personal'}),
      rate('ins_deportivo', 'Pasado deportivo', SC_INS, {short: 'Institucional · Pasado deportivo'}),
      ...[['pres', 'Carga en presupuesto'], ['salario', 'Salario'], ['comisiones', 'Comisiones'], ['otros', 'Otros pagos'], ['total', 'Total operación']]
        .map(([k, l]) => rate('ins_' + k, l, SC_PRES, {values: [2, 4, 6, 8, 10], short: 'Institucional · ' + l})),
      area('ins_obs', 'Observación', {short: 'Institucional · Observación'})
    ]
  },

  { /* N5 */
    id: 'p_ins', title: 'Informe institucional',
    desc: 'Evaluación integral para toma de decisión. Presentación final de jugadores priorizados con posibilidad real de contratación. Consolida los informes anteriores e incorpora valoración deportiva, encaje institucional, proyección, condiciones de mercado y recomendación final.',
    when: d => isP(d) && nivel(d) === 5,
    fields: () => [
      area('info_fichaje', 'Información adicional pertinente para el fichaje', {short: 'Información adicional para el fichaje'}),
      area('links_ad1', 'Links adicionales, noticias, redes, etc.', {short: 'Links adicionales 1'}),
      area('links_ad2', 'Links adicionales, noticias, redes, etc. (2)', {short: 'Links adicionales 2'}),
      file('adjunto', 'Adjunto', {short: 'Adjuntos'})
    ]
  }
];

export const REVIEW = {id: 'review', title: 'Revisar y guardar', desc: 'Confirma que los datos están completos. El informe se guarda en este dispositivo; para respaldarlo o compartirlo, expórtalo desde la pestaña Informes.'};

export const visibleSections = d => SECTIONS.filter(s => s.when(d));

// ---------------------------------------------------------------------
// Colección de todas las secciones, en el mismo orden que la app original.
// ---------------------------------------------------------------------

export function collect(d: ReportData): ReportData {
  const out: ReportData = {};
  for (const s of visibleSections(d)) for (const f of s.fields(d)) {
    if (!f.id || f.type === 'file' || f.type === 'note') continue;
    const v = d[f.id];
    if (!isEmpty(v)) out[f.id] = v;
    if (f.type === 'photo' && !isEmpty(d.foto_url)) out.foto_url = d.foto_url;
  }
  return out;
}

export function validateSection(sec: Section, d: ReportData) {
  const errs: Record<string, string> = {};
  for (const f of sec.fields(d)) {
    if (!f.id) continue;
    const v = d[f.id];
    if (f.type === 'photo' && !isEmpty(d.foto_url) && !/^https?:\/\/\S+$/i.test(d.foto_url)) { errs[f.id] = 'El enlace debe empezar por http:// o https:// y no llevar espacios.'; continue; }
    if (f.req && isEmpty(v)) { errs[f.id] = 'Este campo es obligatorio.'; continue; }
    if (!isEmpty(v) && f.validate) { const m = f.validate(v); if (m) errs[f.id] = m; }
  }
  return errs;
}

export function displayVal(f: Field, v: any): string {
  if (f.type === 'rate') { const vals = f.values || [1, 2, 3, 4, 5]; const i = vals.indexOf(v); return i >= 0 ? `${v} · ${f.legend![i]}` : String(v); }
  if (f.type === 'select' || f.type === 'chips') { const m = (f.options || []).map(opt).find((o: any) => o.v === v); return m ? m.l : v; }
  if (f.type === 'date') return fmtDate(v);
  return String(v);
}

export const groupKey = (d: ReportData) => norm(d.nombre || '') + '|' + (d.fnac || '');
export const ageOf = (iso: string) => {
  const [y, m, day] = iso.split('-').map(Number); const t = new Date();
  let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < day)) a--;
  return a;
};
export const shortVal = (v: string) => String(v).split(':')[0];

export function radarAxes(sec: Section, d: ReportData) {
  if (!sec.radar) return null;
  const axes = sec.fields(d).filter(f => f.type === 'rate' && typeof d[f.id!] === 'number').map(f => {
    const vals = f.values || [1, 2, 3, 4, 5]; const i = vals.indexOf(d[f.id!]);
    return { label: f.label!, value: d[f.id!] as number, text: i >= 0 ? `${d[f.id!]} · ${f.legend![i]}` : String(d[f.id!]) };
  });
  return axes.length >= 3 ? axes : null;
}
