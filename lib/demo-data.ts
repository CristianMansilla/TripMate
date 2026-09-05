import { Activity, Expense, PackingItem, Reservation, Trip } from './types'

export const trips: Trip[] = [
  {
    id: 'cordoba-2026',
    name: 'Córdoba · Noviembre 2026',
    destination: 'Córdoba Capital + Villa Carlos Paz',
    country: 'Argentina',
    startDate: '2026-11-09',
    endDate: '2026-11-15',
    currency: 'ARS',
    status: 'planning',
    memberNames: ['Cristian', 'Luna']
  }
]

export const activities: Activity[] = [
  { id:'a1', tripId:'cordoba-2026', date:'2026-11-09', startTime:'17:05', endTime:'22:35', title:'Goya → Santa Fe', category:'transport', place:'Terminal de Goya', estimatedCost:83000, costScope:'shared', status:'planned', notes:'Via Tac. Valor editable hasta comprar.' },
  { id:'a2', tripId:'cordoba-2026', date:'2026-11-10', startTime:'00:50', endTime:'05:50', title:'Santa Fe → Córdoba', category:'transport', estimatedCost:84000, costScope:'shared', status:'planned', notes:'El Práctico. Conexión aproximada 2h15.' },
  { id:'a3', tripId:'cordoba-2026', date:'2026-11-10', startTime:'08:00', endTime:'12:30', title:'Centro histórico', category:'activity', place:'Plaza San Martín', estimatedCost:7000, costScope:'shared', status:'planned', notes:'Plaza, Catedral, Cabildo, Manzana Jesuítica y Cripta. Museo UNC opcional.' },
  { id:'a4', tripId:'cordoba-2026', date:'2026-11-10', startTime:'14:00', title:'Check-in · Edificio Vilaut', category:'lodging', place:'Inmove Temporarios', address:'Corrientes 207, Córdoba', estimatedCost:340000, costScope:'shared', status:'reserved', notes:'4 noches + late checkout del sábado hasta ~20:00.' },
  { id:'a5', tripId:'cordoba-2026', date:'2026-11-10', startTime:'15:30', endTime:'17:30', title:'Museo Provincial de Ciencias Naturales', category:'museum', place:'Av. Poeta Lugones 395', estimatedCost:0, costScope:'shared', status:'planned', notes:'Actualmente figura gratuito; reconfirmar antes del viaje.' },
  { id:'a6', tripId:'cordoba-2026', date:'2026-11-10', startTime:'20:45', title:'Bachata · Desde Cero', category:'activity', place:'Somos Bachata · San Martín 70', estimatedCost:30000, costScope:'shared', status:'planned' },
  { id:'a7', tripId:'cordoba-2026', date:'2026-11-10', startTime:'22:30', title:'Cena + bares en Güemes', category:'nightlife', place:'Güemes', estimatedCost:90000, costScope:'shared', status:'planned' },
  { id:'a8', tripId:'cordoba-2026', date:'2026-11-11', startTime:'08:00', title:'Córdoba → Villa Carlos Paz', category:'transport', estimatedCost:12000, costScope:'shared', status:'planned' },
  { id:'a9', tripId:'cordoba-2026', date:'2026-11-11', startTime:'10:30', title:'Complejo Aerosilla', category:'activity', place:'Villa Carlos Paz', estimatedCost:50000, costScope:'shared', status:'planned' },
  { id:'a10', tripId:'cordoba-2026', date:'2026-11-11', startTime:'11:30', title:'Tirolesa', category:'activity', place:'Complejo Aerosilla', estimatedCost:80000, costScope:'shared', status:'planned', optional:true },
  { id:'a11', tripId:'cordoba-2026', date:'2026-11-11', startTime:'12:00', title:'Parque aéreo', category:'activity', place:'Complejo Aerosilla', estimatedCost:46000, costScope:'shared', status:'planned', optional:true },
  { id:'a12', tripId:'cordoba-2026', date:'2026-11-11', startTime:'13:15', title:'Almuerzo + centro + Reloj Cucú', category:'food', place:'Villa Carlos Paz', estimatedCost:60000, costScope:'shared', status:'planned' },
  { id:'a13', tripId:'cordoba-2026', date:'2026-11-11', startTime:'15:30', title:'Lago / kayak / hidropedal / catamarán', category:'activity', place:'Costanera', estimatedCost:50000, costScope:'shared', status:'planned', optional:true },
  { id:'a14', tripId:'cordoba-2026', date:'2026-11-11', startTime:'19:00', title:'Cerro de la Cruz nocturno', category:'activity', place:'Cerro de la Cruz', estimatedCost:0, costScope:'shared', status:'idea', optional:true, notes:'Prioridad si aparece salida guiada compatible el miércoles 11.' },
  { id:'a15', tripId:'cordoba-2026', date:'2026-11-12', startTime:'11:00', title:'Infinito Water Park', category:'activity', place:'Córdoba', estimatedCost:200000, costScope:'shared', status:'idea', optional:true, notes:'Plan B. Confirmar apertura, precio y promociones de noviembre.' },
  { id:'a16', tripId:'cordoba-2026', date:'2026-11-12', startTime:'18:45', title:'Traslado Vilaut → Kempes', category:'transport', place:'Estadio Mario Alberto Kempes', estimatedCost:25000, costScope:'shared', status:'planned' },
  { id:'a17', tripId:'cordoba-2026', date:'2026-11-12', startTime:'21:00', title:'Romeo Santos + Prince Royce', category:'event', place:'Estadio Mario Alberto Kempes', estimatedCost:0, costScope:'shared', status:'paid', notes:'Entradas ya compradas. Fila 7, butacas 13 y 14. No se incluyen en presupuesto.' },
  { id:'a18', tripId:'cordoba-2026', date:'2026-11-13', startTime:'20:45', title:'Bachata · Desde Cero', category:'activity', place:'Somos Bachata · San Martín 70', estimatedCost:30000, costScope:'shared', status:'idea', optional:true },
  { id:'a19', tripId:'cordoba-2026', date:'2026-11-13', startTime:'23:15', title:'Córdoba → Carlos Paz · noche', category:'transport', estimatedCost:12000, costScope:'shared', status:'planned' },
  { id:'a20', tripId:'cordoba-2026', date:'2026-11-14', startTime:'00:15', title:'Previa + boliche Carlos Paz', category:'nightlife', place:'Villa Carlos Paz', estimatedCost:90000, costScope:'shared', status:'idea', optional:true, notes:'Elegir cuando aparezca cartelera: Keops, Zebra, Khalama u otra mejor opción.' },
  { id:'a21', tripId:'cordoba-2026', date:'2026-11-14', startTime:'05:00', title:'Carlos Paz → Córdoba madrugada', category:'transport', estimatedCost:12000, costScope:'shared', status:'planned', notes:'Bus Plan A; Uber/remís Plan B.' },
  { id:'a22', tripId:'cordoba-2026', date:'2026-11-14', startTime:'23:59', title:'Córdoba → Santa Fe', category:'transport', estimatedCost:54600, costScope:'shared', status:'planned' },
  { id:'a23', tripId:'cordoba-2026', date:'2026-11-15', startTime:'07:35', endTime:'13:10', title:'Santa Fe → Goya', category:'transport', estimatedCost:69000, costScope:'shared', status:'planned' },
  { id:'a24', tripId:'cordoba-2026', date:'2026-11-14', startTime:'13:30', title:'Tren de las Sierras · tramo corto', category:'activity', estimatedCost:10000, costScope:'shared', status:'idea', optional:true, notes:'Alternativa, no actividad fija. Sólo si encaja sin romper el sábado.' }
]

export const reservations: Reservation[] = [
  { id:'r1', tripId:'cordoba-2026', title:'Alojamiento · Vilaut', status:'reserved', priority:'high', amount:340000, notes:'Inmove Temporarios · Corrientes 207.' },
  { id:'r2', tripId:'cordoba-2026', title:'Entradas recital', status:'paid', priority:'high', amount:0, notes:'Ya compradas; fuera del presupuesto.' },
  { id:'r3', tripId:'cordoba-2026', title:'Micros ida y vuelta', status:'pending', priority:'high', notes:'Comprar cuando convenga precio/financiación.' },
  { id:'r4', tripId:'cordoba-2026', title:'Cerro de la Cruz nocturno', status:'watching', priority:'high', notes:'Esperar programación oficial para miércoles 11.' },
  { id:'r5', tripId:'cordoba-2026', title:'Infinito Water Park', status:'watching', priority:'medium', notes:'Ver preventa, promociones, clima y política de lluvia.' },
  { id:'r6', tripId:'cordoba-2026', title:'Boliche viernes', status:'watching', priority:'medium', notes:'Definir cuando aparezca cartelera del viernes 13.' },
  { id:'r7', tripId:'cordoba-2026', title:'Aerosilla / aventura', status:'pending', priority:'medium', notes:'Comparar combo vs entradas individuales.' }
]

export const expenses: Expense[] = [
  { id:'e1', tripId:'cordoba-2026', title:'Alojamiento · Vilaut + late checkout', category:'Alojamiento', amount:340000, status:'confirmed', scope:'shared', included:true },
  { id:'e2', tripId:'cordoba-2026', title:'Via Tac · Goya → Santa Fe', category:'Transporte', amount:83000, status:'estimated', scope:'shared', included:true },
  { id:'e3', tripId:'cordoba-2026', title:'El Práctico · Santa Fe → Córdoba', category:'Transporte', amount:84000, status:'estimated', scope:'shared', included:true },
  { id:'e4', tripId:'cordoba-2026', title:'El Práctico · Córdoba → Santa Fe', category:'Transporte', amount:54600, status:'estimated', scope:'shared', included:true },
  { id:'e5', tripId:'cordoba-2026', title:'Via Tac · Santa Fe → Goya', category:'Transporte', amount:69000, status:'estimated', scope:'shared', included:true },
  { id:'e6', tripId:'cordoba-2026', title:'Córdoba ↔ Carlos Paz · miércoles', category:'Transporte', amount:24000, status:'estimated', scope:'shared', included:true },
  { id:'e7', tripId:'cordoba-2026', title:'Córdoba ↔ Carlos Paz · viernes/madrugada', category:'Transporte', amount:24000, status:'estimated', scope:'shared', included:true },
  { id:'e8', tripId:'cordoba-2026', title:'Uber / taxi / urbano', category:'Transporte', amount:80000, status:'estimated', scope:'shared', included:true },

  { id:'e9', tripId:'cordoba-2026', title:'Museo Histórico UNC / Manzana Jesuítica', category:'Museos', amount:7000, status:'estimated', scope:'shared', included:true },
  { id:'e10', tripId:'cordoba-2026', title:'Museo Ciencias Naturales', category:'Museos', amount:0, status:'estimated', scope:'shared', included:true },
  { id:'e11', tripId:'cordoba-2026', title:'Caraffa / Ferreyra / Dionisi', category:'Museos', amount:20000, status:'estimated', scope:'shared', included:false },

  { id:'e12', tripId:'cordoba-2026', title:'Aerosilla', category:'Carlos Paz', amount:50000, status:'estimated', scope:'shared', included:true },
  { id:'e13', tripId:'cordoba-2026', title:'Tirolesa', category:'Carlos Paz', amount:80000, status:'estimated', scope:'shared', included:true },
  { id:'e14', tripId:'cordoba-2026', title:'Parque aéreo', category:'Carlos Paz', amount:46000, status:'estimated', scope:'shared', included:true },
  { id:'e15', tripId:'cordoba-2026', title:'Lago / kayak / hidropedal / catamarán', category:'Carlos Paz', amount:50000, status:'estimated', scope:'shared', included:true },
  { id:'e16', tripId:'cordoba-2026', title:'Tren de las Sierras · opcional', category:'Paseos', amount:10000, status:'estimated', scope:'shared', included:false },
  { id:'e17', tripId:'cordoba-2026', title:'Infinito Water Park · opcional', category:'Paseos', amount:200000, status:'estimated', scope:'shared', included:false },

  { id:'e18', tripId:'cordoba-2026', title:'Bachata martes', category:'Salidas', amount:30000, status:'estimated', scope:'shared', included:true },
  { id:'e19', tripId:'cordoba-2026', title:'Bachata viernes', category:'Salidas', amount:30000, status:'estimated', scope:'shared', included:true },
  { id:'e20', tripId:'cordoba-2026', title:'Boliche Carlos Paz', category:'Salidas', amount:50000, status:'estimated', scope:'shared', included:true },
  { id:'e21', tripId:'cordoba-2026', title:'Bebidas boliche', category:'Salidas', amount:40000, status:'estimated', scope:'shared', included:true },

  { id:'e22', tripId:'cordoba-2026', title:'Supermercado Vilaut', category:'Comidas', amount:60000, status:'estimated', scope:'shared', included:true },
  { id:'e23', tripId:'cordoba-2026', title:'Viandas', category:'Comidas', amount:40000, status:'estimated', scope:'shared', included:true },
  { id:'e24', tripId:'cordoba-2026', title:'Martes · cena + bares Güemes', category:'Comidas', amount:90000, status:'estimated', scope:'shared', included:true },
  { id:'e25', tripId:'cordoba-2026', title:'Miércoles · almuerzo Carlos Paz', category:'Comidas', amount:60000, status:'estimated', scope:'shared', included:true },
  { id:'e26', tripId:'cordoba-2026', title:'Jueves · comida antes/después recital', category:'Comidas', amount:60000, status:'estimated', scope:'shared', included:true },
  { id:'e27', tripId:'cordoba-2026', title:'Viernes · previa Carlos Paz', category:'Comidas', amount:80000, status:'estimated', scope:'shared', included:true },
  { id:'e28', tripId:'cordoba-2026', title:'Sábado · brunch + cena', category:'Comidas', amount:80000, status:'estimated', scope:'shared', included:true },
  { id:'e29', tripId:'cordoba-2026', title:'Cafés / snacks / helados', category:'Comidas', amount:60000, status:'estimated', scope:'shared', included:true },

  { id:'e30', tripId:'cordoba-2026', title:'Fondo de contingencia', category:'Contingencia', amount:150000, status:'estimated', scope:'shared', included:true }
]

export const packing: PackingItem[] = [
  { id:'p1', tripId:'cordoba-2026', label:'8 ropa interior', assignedTo:'Cristian', packed:false, category:'Ropa' },
  { id:'p2', tripId:'cordoba-2026', label:'8 pares de medias (2 deportivas)', assignedTo:'Cristian', packed:false, category:'Ropa' },
  { id:'p3', tripId:'cordoba-2026', label:'8 ropa interior', assignedTo:'Luna', packed:false, category:'Ropa' },
  { id:'p4', tripId:'cordoba-2026', label:'8 pares de medias (2 deportivas)', assignedTo:'Luna', packed:false, category:'Ropa' },
  { id:'p5', tripId:'cordoba-2026', label:'2 trajes de baño cada uno', assignedTo:'Compartido', packed:false, category:'Ropa' },
  { id:'p6', tripId:'cordoba-2026', label:'Powerbank + cables', assignedTo:'Compartido', packed:false, category:'Tecnología' },
  { id:'p7', tripId:'cordoba-2026', label:'Protector solar', assignedTo:'Compartido', packed:false, category:'Cuidado' },
  { id:'p8', tripId:'cordoba-2026', label:'Repelente', assignedTo:'Compartido', packed:false, category:'Cuidado' },
  { id:'p9', tripId:'cordoba-2026', label:'DNI + tarjetas + algo de efectivo', assignedTo:'Compartido', packed:false, category:'Documentos' },
  { id:'p10', tripId:'cordoba-2026', label:'Bolsas para ropa sucia/húmeda', assignedTo:'Compartido', packed:false, category:'Organización' }
]
