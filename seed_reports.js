const fetch = globalThis.fetch;
// Node 18+ has native fetch. If on older node, this script might fail, 
// but we assume modern env based on usage of 'vite'.

import crypto from 'crypto';
const API_URL = 'http://localhost:3000/api/reports';

// Center point (Buenos Aires Obelisco area roughly)
// Or better, let's try to match a zone likely to be viewed or generic.
const CENTER = { lat: -34.6037, lng: -58.3816 };

const REPORTS = [
    {
        title: 'Robo de Bici',
        description: 'Bici robada',
        category: 'Bicicletas',
        zone: 'Microcentro',
        address: 'Av. Corrientes 1000',
        created_at: new Date().toISOString(),
        incident_date: new Date().toISOString(),
        latitude: CENTER.lat + 0.001,
        longitude: CENTER.lng + 0.001,
        status: 'pendiente'
    },
    {
        title: 'Arrebato de iPhone',
        description: 'Me sacaron el celular',
        category: 'Celulares',
        zone: 'San Nicolás',
        address: 'Av. 9 de Julio 500',
        created_at: new Date().toISOString(),
        incident_date: new Date().toISOString(),
        latitude: CENTER.lat - 0.002,
        longitude: CENTER.lng + 0.001,
        status: 'pendiente'
    },
    {
        title: 'Robo de Moto',
        description: 'Moto robada en la calle',
        category: 'Motos',
        zone: 'Congreso',
        address: 'Av. Callao 300',
        created_at: new Date().toISOString(),
        incident_date: new Date().toISOString(),
        latitude: CENTER.lat + 0.003,
        longitude: CENTER.lng - 0.002,
        status: 'pendiente'
    },
    {
        title: 'Cartera perdida',
        description: 'Cartera olvidada en local',
        category: 'Carteras',
        zone: 'Microcentro',
        address: 'Florida 200',
        created_at: new Date().toISOString(),
        incident_date: new Date().toISOString(),
        latitude: CENTER.lat - 0.001,
        longitude: CENTER.lng - 0.001,
        status: 'en_proceso'
    },
    {
        title: 'Rompevidrios Auto',
        description: 'Intento de robo rompiendo vidrio',
        category: 'Autos',
        zone: 'Tribunales',
        address: 'Lavalle 1200',
        created_at: new Date().toISOString(),
        incident_date: new Date().toISOString(),
        latitude: CENTER.lat + 0.002,
        longitude: CENTER.lng + 0.002,
        status: 'resuelto'
    }
];

async function seed() {
    console.log('🌱 Seeding 5 test reports...');
    console.log('Target URL:', API_URL);

    for (const report of REPORTS) {
        await new Promise(r => setTimeout(r, 200)); // Delay to avoid rate limits
        const ANONYMOUS_ID = crypto.randomUUID(); // New ID per report to bypass rate limit
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-anonymous-id': ANONYMOUS_ID
                },
                body: JSON.stringify(report)
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`✅ Created: "${report.title}"`, data.data?.id ? `(ID: ${data.data.id})` : '');
            } else {
                const err = await res.text();
                console.error(`❌ Failed: "${report.title}"`, err);
            }
        } catch (error) {
            console.error(`❌ Network Error: "${report.title}"`, error.message);
        }
    }
    console.log('✨ Seed completed.');
}

seed();
