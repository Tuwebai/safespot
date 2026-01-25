export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    category: 'Tecnología' | 'Comunidad' | 'Producto' | 'Seguridad';
    author: {
        name: string;
        role: string;
        avatar?: string;
    };
    date: string;
    readTime: string;
    content: string; // HTML string for simplicity in this Static CMS version
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    relatedLinks?: {
        label: string;
        url: string;
    }[];
}

export const BLOG_POSTS: BlogPost[] = [
    {
        id: '1',
        slug: 'algoritmo-hot-zones-seguridad-urbana',
        title: 'Actualización de Algoritmo: Hot Zones y Temperatura Barrial (Engine V3)',
        excerpt: 'Dejamos de usar "mapas estáticos". Entendé cómo el nuevo motor Flux-3 cruza 50.000 variables por hora para predecir la seguridad de tu cuadra en tiempo real. Análisis técnico profundo.',
        category: 'Tecnología',
        author: {
            name: 'Equipo de Data Science',
            role: 'SafeSpot Engineering',
            avatar: '/avatars/data-science-team.png'
        },
        date: '2026-01-25',
        readTime: '12 min',
        seoTitle: 'Algoritmo Hot Zones V3: Predicción de Delito en Tiempo Real | SafeSpot Engineering',
        seoDescription: 'Deep dive técnico sobre Flux-3, el motor de riesgo de SafeSpot. Cómo cruzamos cold data (histórico) con hot data (tiempo real) para generar la Temperatura Barrial sin violar privacidad.',
        keywords: ['algoritmo seguridad', 'hot zones', 'prediccion delito', 'data science', 'machine learning', 'seguridad gba', 'flux-3 engine'],
        content: `
            <p class="lead">Lo que vas a leer a continuación es, en parte, la explicación de por qué los mapas del delito tradicionales fallaron durante 20 años. Y es la primera vez que abrimos "el capó" de nuestro motor de decisión.</p>
            
            <p>Si usaste SafeSpot esta semana, notaste que el mapa ya no es un dibujo estático. Las zonas rojas se expanden, se contraen, "respiran". No es un efecto visual: es la representación visual de <strong>Flux-3</strong>, nuestro nuevo motor de inferencia de riesgo.</p>

            <h2>El Problema del "Mapa Muerto"</h2>
            <p>Hasta hoy, la seguridad urbana se basaba en la "foto del ayer". Las estadísticas oficiales te dicen dónde hubo un robo <em>el mes pasado</em>. Eso sirve para auditoría, pero es inútil para prevención. El crimen urbano es un fenómeno <strong>fluido</strong>.</p>
            
            <p>Un cruce de avenidas puede ser el lugar más seguro del mundo a las 18:00 (lleno de gente, policías, cámaras) y una trampa mortal a las 03:00. Un mapa que lo marca siempre en rojo es mentiroso. Un mapa que lo marca siempre en verde, es peligroso.</p>

            <h2>Introduciendo Temperatura Barrial (Flux-3)</h2>
            <p>Para resolver esto, dejamos de pensar en "lugares" y empezamos a pensar en "momentos". El concepto de <strong>Temperatura Barrial</strong> no mide la peligrosidad inherente de una calle, sino su <em>volatilidad actual</em>.</p>
            
            <div class="alert-box info">
                <strong>Arquitectura:</strong> Flux-3 procesa un stream de más de 50.000 data points por hora solo en GBA Norte, re-calculando el polígono de riesgo cada 45 segundos.
            </div>

            <h3>Cómo funciona el algoritmo</h3>
            <p>El motor utiliza un modelo de tres capas ponderadas para asignar un score de 0 a 100 a cada celda de 100m² del mapa:</p>

            <ul>
                <li>
                    <strong>Layer 1: Cold Data (Estático - 30% Weight):</strong> Base histórica de denuncias policiales y reportes validados de los últimos 6 meses. Define la "tendencia base". Si una zona es históricamente complicada, arranca con un piso de temperatura más alto.
                </li>
                <li>
                    <strong>Layer 2: Ambient Data (Contextual - 20% Weight):</strong> Ingestamos APIs de clima (lluvia reduce el delito a pie, niebla lo aumenta), fases lunares (oscuridad) y, crucialmente, <strong>densidad de tráfico</strong>. Una calle vacía es más riesgosa que una congestionada.
                </li>
                <li>
                    <strong>Layer 3: Hot Data (Real Time - 50% Weight):</strong> La magia. Si 3 usuarios reportan "Movimiento Sospechoso" en un radio de 200m en menos de 10 minutos, el motor ignora la historia y dispara la temperatura <strong>al instante</strong>.
                </li>
            </ul>

            <blockquote>
                "El crimen no ocurre en el vacío. Ocurre en un contexto. Flux-3 no mira el crimen, mira el contexto que lo permite."
                <footer>— Dra. Elena V., Lead Data Scientist @ SafeSpot</footer>
            </blockquote>

            <h2>Privacidad: El Elefante en la Habitación</h2>
            <p>Un sistema tan potente genera miedos lógicos. ¿Me están rastreando? ¿Saben quién soy? La respuesta corta es <strong>NO</strong>. La respuesta larga es diseño. Usamos <em>Differential Privacy</em>:</p>
            
            <ol>
                <li><strong>Desacople de Identidad:</strong> El reporte se separa de tu usuario en el servidor. Sabemos QUE alguien reportó, no QUIÉN.</li>
                <li><strong>Ruido Estadístico:</strong> Agregamos "ruido" aleatorio a las coordenadas exactas de los usuarios pasivos para que sea matemáticamente imposible triangular una persona específica.</li>
                <li><strong>Sin Perfiles:</strong> No analizamos comportamientos individuales. Analizamos masad. Nos importa el flujo de la "manada", no la oveja.</li>
            </ol>

            <h2>Caso de Estudio: Olivos (Enero 2026)</h2>
            <p>El fin de semana pasado, el sistema detectó una anomalía en Av. Maipú al 3500. Históricamente es zona verde. Pero a las 23:15, el layer de "Ambient Data" detectó un corte de luz masivo (reportado por API de servicio eléctrico). Simultáneamente, 2 usuarios reportaron "Merodeadores".</p>
            
            <p>En 45 segundos, Flux-3 pasó la zona de "Verde (Riesgo Bajo)" a "Naranja (Precaución Alta)". Tres usuarios que pasaban por ahí recibieron la alerta y desviaron por Libertador. Resultado: <strong>0 incidentes reportados esa noche</strong>.</p>
            
            <p>La prevención no es detener al ladrón. Es evitar que vos estés ahí cuando él está.</p>

            <div class="alert-box success">
                <strong>Update:</strong> Esta actualización ya está activa para todos los usuarios de GBA Norte y CABA. El rollout al resto del país comienza en Febrero.
            </div>
        `,
        relatedLinks: [
            { label: 'Ver Mapa en Vivo', url: '/explorar' },
            { label: 'Leer sobre Privacidad', url: '/confianza/sistema-de-confianza' }
        ]
    },
    {
        id: '2',
        slug: 'reporte-mensual-gba-norte-enero-2026',
        title: 'Reporte Mensual de Seguridad: GBA Norte',
        excerpt: 'Análisis de tendencias delictivas en Vicente López, San Isidro y San Martín. Horarios críticos y modalidades en ascenso según datos comunitarios.',
        category: 'Comunidad',
        author: {
            name: 'Observatorio SafeSpot',
            role: 'Análisis Barrial',
            avatar: '/avatars/observatory-team.png'
        },
        date: '2026-01-20',
        readTime: '8 min',
        seoTitle: 'Informe Seguridad Enero 2026: GBA Norte | SafeSpot Data',
        seoDescription: 'Reporte mensual de delitos en Zona Norte. Aumento de robo de cubiertas en San Isidro y nuevas modalidades de estafas en Vicente López. Datos validados.',
        keywords: ['seguridad gba norte', 'vicente lopez', 'san isidro', 'robo cubiertas', 'estadisticas delito', 'informe seguridad'],
        content: `
            <p class="lead">Enero suele ser un mes atípico. Con menos gente en la calle por vacaciones, el delito muta. El oportunismo callejero (motochorros) baja levemente por falta de víctimas, pero aumentan las modalidades predatorias sobre propiedades y vehículos estacionados. Este es el análisis de los 12.400 reportes validados en GBA Norte durante el último mes.</p>

            <h3>El Mapa del Delito: Enero 2026</h3>
            <p>Detectamos un desplazamiento del foco delictivo. Mientras que en Diciembre los centros comerciales a cielo abierto (Av. Santa Fe, Alvear) eran puntos calientes por las compras, en Enero la actividad se movió a <strong>zonas residenciales de baja densidad</strong>.</p>
            
            <h4>Modalidad #1: Robo de Ruedas (Sube 40%)</h4>
            <p>Es la estrella de la temporada. San Isidro y Martínez encabezan la lista. Los delincuentes aprovechan las noches largas y calles vacías. 
            <strong>El patrón detectado:</strong> Vehículos de apoyo (generalmente utilitarios blancos viejos) que marcan autos estacionados durante el día y vuelven entre las 02:00 y las 04:00 AM.</p>

            <div class="alert-box warning">
                <strong>Alerta Vecinal:</strong> Si ves una camioneta utilitaria dando vueltas despacio filmando casas o autos, reportalo en SafeSpot como "Actividad Sospechosa" inmediatamente. Ese reporte temprano ayuda a otros vecinos a estar alerta esa misma noche.
            </div>

            <h4>Modalidad #2: Cuento del Tío "Servicio Técnico"</h4>
            <p>En Vicente López, hemos validado 15 casos de intentos de estafa presencial. Personas vestidas con uniformes de empresas de internet o luz que piden entrar por "averías en la zona".</p>
            <p><strong>Recordá:</strong> Ninguna empresa de servicios entra a tu domicilio sin un número de reclamo generado por vos. Ante la duda, no abras. Pedí el número de orden y llamá a la empresa con el teléfono que figura en tu factura (no el que te den ellos).</p>

            <h3>Zonas de Recuperación (Lo positivo)</h3>
            <p>No todo son malas noticias. Gracias a la organización vecinal y la instalación de nuevas alarmas comunitarias, hemos visto una reducción del 60% en los reportes de "Arrebato de Celular" en los alrededores de la Estación Mitre (Olivos). Cuando los vecinos ocupan el espacio público y reportan activamente, el delito se desplaza.</p>
            
            <h3>Recomendaciones para Febrero</h3>
            <p>A medida que retomen las clases y la actividad laboral:</p>
            <ul>
                <li><strong>Horarios Escolares:</strong> Prestar atención en los corredores escolares de 07:30 a 08:00.</li>
                <li><strong>Delivery Seguro:</strong> No esperes el delivery en la vereda. Mirá por la ventana y salí solo cuando llegue.</li>
            </ul>
        `,
        relatedLinks: [
            { label: 'Ver Corredores Seguros', url: '/intel/corredores-seguros' },
            { label: 'Sumate a tu grupo vecinal', url: '/comunidad' }
        ]
    },
    {
        id: '3',
        slug: 'grupos-vecinales-verificados-whatsapp',
        title: 'Grupos Vecinales Verificados: Seguridad sin Caos',
        excerpt: 'Por qué los grupos de WhatsApp fallan cuando hay una emergencia real y cómo SafeSpot soluciona el problema del "ruido" vecinal.',
        category: 'Producto',
        author: {
            name: 'Juanchi (CEO)',
            role: 'Fundador SafeSpot',
            avatar: '/avatars/juanchi-ceo.png'
        },
        date: '2026-01-15',
        readTime: '5 min',
        seoTitle: 'Grupos Vecinales Seguros: La alternativa a WhatsApp | SafeSpot',
        seoDescription: 'Lanzamos los Círculos de Confianza. Verificación de identidad real, alertas geolocalizadas y cero memes. La evolución de la alerta vecinal.',
        keywords: ['vecinos en alerta', 'grupos whatsapp seguridad', 'alerta vecinal', 'safespot grupos', 'seguridad colaborativa'],
        content: `
            <p class="lead">Todos estamos en ese grupo. "Alerta Vecinos Calle Paz". Suena una notificación a las 3 AM. Te despertás con el corazón en la boca, agarrás el celular y... es un vecino avisando que se encontró un caniche, o peor, mandando un video de política.</p>
            
            <p>WhatsApp es una herramienta increíble para comunicarse, pero es <strong>pésima para gestionar emergencias</strong>. El ruido, la falta de contexto y la imposibilidad de filtrar lo importante pueden costar segundos valiosos en una situación real.</p>

            <h3>El Problema del Ruido (Signal-to-Noise Ratio)</h3>
            <p>En seguridad, la información tiene que ser limpia. Si tu cerebro aprende que el 90% de las notificaciones del grupo vecinal son irrelevantes, cuando llegue la notificación del robo real, la vas a ignorar. Se llama "Fatiga de Alerta".</p>

            <h3>La Solución: Círculos de Confianza SafeSpot</h3>
            <p>Lanzamos una nueva función diseñada específicamente para reemplazar la dinámica rota de WhatsApp. Los <strong>Grupos Vecinales Verificados</strong> tienen tres reglas de oro que el código hace cumplir:</p>

            <ol>
                <li>
                    <strong>Identidad Validada:</strong>
                    <p>En WhatsApp cualquiera con un link entra. En SafeSpot, para entrar a un círculo barrial, tenés que validar tu identidad. Se acabó el anonimato para trolear o espiar.</p>
                </li>
                <li>
                    <strong>Categorización Obligatoria:</strong>
                    <p>No podés mandar "texto suelto". Tenés que elegir: ¿Es una Alerta? ¿Es un Aviso? ¿Es una Búsqueda? Si marcás "Alerta", les suena a todos (incluso en No Molestar). Si es "Aviso", es silencioso. Jerarquía real.</p>
                </li>
                <li>
                    <strong>Georeferenciación:</strong>
                    <p>Cada mensaje está atado a un punto del mapa. "Vi algo raro" no sirve. "Vi algo raro EN ESTA ESQUINA" y aparece en el mapa de todos los miembros.</p>
                </li>
            </ol>

            <p>No queremos que dejes de hablar con tus vecinos. Queremos que cuando hables de seguridad, te escuchen de verdad. Probá armar el grupo de tu manzana hoy y notá la diferencia de dormir tranquilo sabiendo que si el teléfono suena, es por algo importante.</p>
        `,
        relatedLinks: [
            { label: 'Crear Grupo Vecinal', url: '/comunidad' },
            { label: 'Manual de Uso Seguro', url: '/intel/manual-urbano' }
        ]
    }
];

export const getPostBySlug = (slug: string) => {
    return BLOG_POSTS.find(post => post.slug === slug);
};

export const getRecentPosts = (limit: number = 3) => {
    return [...BLOG_POSTS].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
};
