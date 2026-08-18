const { test, expect } = require('@playwright/test');

async function openLoginPage(page) {
  await page.goto('http://localhost:5173/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Iniciar Sesion' })).toBeVisible();
}

test.describe('Mercapleno', () => {
  test('muestra "Iniciar Sesion"', async ({ page }) => {
    await openLoginPage(page);
    await expect(page.getByRole('heading', { name: 'Iniciar Sesion' })).toHaveText('Iniciar Sesion');
  });

  test('formulario de login muestra campos y botón', async ({ page }) => {
    await openLoginPage(page);
    await expect(page.getByLabel('Correo electronico')).toBeVisible();
    await expect(page.getByLabel('Contrasena')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('registro con título "Registrarse"', async ({ page }) => {
    await openLoginPage(page);
    await page.getByRole('link', { name: /registrate aqui/i }).click();
    await expect(page.getByRole('heading', { name: 'Registrarse' })).toBeVisible();
  });

  test('puede escribir en email y password', async ({ page }) => {
    await openLoginPage(page);
    await page.getByLabel('Correo electronico').fill('test@example.com');
    await page.getByLabel('Contrasena').fill('Password123!');

    await expect(page.getByLabel('Correo electronico')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Contrasena')).toHaveValue('Password123!');
  });

  test('muestra "Recuperar Contrasena"', async ({ page }) => {
    await openLoginPage(page);
    await page.getByRole('link', { name: /recuperala/i }).click();
    await expect(page.getByRole('heading', { name: 'Recuperar Contrasena' })).toBeVisible();
  });

  test('llenar formulario de registro', async ({ page }) => {
    await openLoginPage(page);
    await page.getByRole('link', { name: /registrate aqui/i }).click();

    await page.locator('#nombre').fill('Juan');
    await page.locator('#apellido').fill('Pepito');
    await page.locator('#numero_identificacion').fill('1478569321');
    await page.locator('#fecha_nacimiento').fill('1990-01-01');
    await page.locator('#email').fill('juan@perez.com');
    await page.locator('#direccion').fill('Calle 123');
    await page.locator('#password').fill('Password123!');

    await expect(page.locator('#nombre')).toHaveValue('Juan');
    await expect(page.locator('#apellido')).toHaveValue('Pepito');
    await expect(page.locator('#numero_identificacion')).toHaveValue('1478569321');
    await expect(page.locator('#fecha_nacimiento')).toHaveValue('1990-01-01');
    await expect(page.locator('#email')).toHaveValue('juan@perez.com');
    await expect(page.locator('#direccion')).toHaveValue('Calle 123');
    await expect(page.locator('#password')).toHaveValue('Password123!');

    await expect(page.locator('button.submit-btn')).toBeVisible();
  });
});
