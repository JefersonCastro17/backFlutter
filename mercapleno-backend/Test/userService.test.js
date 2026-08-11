const { json } = require('node:stream/consumers');
const getUser = require('../src/auth/auth.service');
jest.mock('node-fetch');
const fetch = require('node-fetch');

test('obtiene datos de usuario simulados', async () => {
    fetch.mockResolvedValue({
        json: () => ({id: 1, name: 'Santiago'})
    });

    const user = await getUser(1);
    expect(user).toEqual({ id: 1, name: 'Daniel' });
});