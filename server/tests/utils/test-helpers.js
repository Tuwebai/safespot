import { v4 as uuidv4 } from 'uuid';

export const generateTestUser = () => {
    return {
        id: uuidv4(),
        role: 'user'
    };
};

export const generateTestReport = (overrides = {}) => {
    return {
        title: 'Test Report ' + Date.now(),
        description: 'Auto-generated test report for integration testing',
        category: 'Celulares',
        latitude: -34.6037,
        longitude: -58.3816,
        address: 'Calle Falsa 123',
        status: 'pendiente',
        image_url: 'https://placehold.co/600x400',
        ...overrides
    };
};
