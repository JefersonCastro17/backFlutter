describe('Inicio de Sesion', () => {

  it('Debe iniciar sesión correctamente', () => {

    const email = 'test@mercapleno.com';
    const password = '123456';

    cy.visit('http://localhost:5173/login');

    cy.get('#email')
      .should('be.visible')
      .type(email);

    cy.get('#password')
      .should('be.visible')
      .type(password);

    cy.contains('button', 'Ingresar')
      .should('be.visible')
      .click();

    cy.get('#securityCode')
      .should('be.visible');

    cy.request({
      method: 'GET',
      url: `http://localhost:4000/api/test/ultimo-codigo?email=${encodeURIComponent(email)}`
    }).then((response) => {

      expect(response.status).to.equal(200);
      expect(response.body.success).to.equal(true);

      const codigo = response.body.codigo;

      expect(codigo).to.match(/^\d{6}$/);

      cy.log(`Código 2FA obtenido: ${codigo}`);

      cy.get('#securityCode')
        .type(codigo);

      cy.contains('button', 'Verificar codigo')
        .should('be.visible')
        .click();

    });
    cy.url()
      .should('not.include', '/login');

    cy.contains('Ir a Inventario')
      .should('be.visible')
      .click();

    cy.url()
      .should('include', '/products/admin');

    cy.contains('button', 'Agregar producto')
      .should('be.visible')
      .click();

    cy.get('input[name="nombre"]')
      .type('Choco Cono');

    cy.get('input[name="precio"]')
      .type('3500');

    cy.get('select[name="id_categoria"]')
      .select('Congelados');

    cy.get('select[name="id_proveedor"]')
      .select('Pedro Martínez')

    cy.get('select[name="estado"]')
      .select('Disponible');

    cy.get('textarea[name="descripcion"]')
      .type('Delicioso helado de chocolate');

    cy.get('.products-modal')
      .contains('button', 'Agregar')
      .click();

    cy.contains('Choco Cono')
      .should('be.visible');

    cy.contains('td', 'Choco Cono')
      .parent('tr')
      .within(() => {
        cy.contains('button', 'Editar')
          .click();
      });

    cy.intercept('PUT', '**/api/productos/*').as('updateProduct');

    cy.get('input[name="nombre"]')
      .clear()
      .type('Choco Cono Editado');

    cy.contains('button', 'Guardar cambios')
      .should('be.visible')
      .click();

    cy.wait('@updateProduct', { timeout: 10000 }).then((interception) => {
      cy.log(`Status recibido: ${interception.response?.statusCode}`);
      cy.log(`Respuesta backend: ${JSON.stringify(interception.response?.body)}`);
      expect(interception.response?.statusCode, 'El servidor debe responder con status 200').to.equal(200);
    });

    cy.contains('Choco Cono Editado')
      .should('be.visible');

    cy.contains('td', 'Choco Cono Editado')
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Deshabilitar')
          .click();
      });

    cy.get('#product-status')
      .select('deshabilitado');

    cy.contains('td', 'Choco Cono Editado')
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Habilitar')
          .click();
      });
    cy.get('#product-status')
      .select('todos');

    cy.contains('td', 'Choco Cono Editado')
      .should('be.visible')
      .closest('tr')
      .should('contain', 'Disponible');

    cy.contains('td', 'Choco Cono Editado')
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Eliminar')
          .click();
      });

    cy.contains('Choco Cono Editado')
      .should('not.exist');

    cy.contains('button', 'Volver')
      .click();

    cy.contains('Ir a Reportes')
      .should('be.visible')
      .click();

    cy.contains('button', 'Actualizar')
      .click();

    cy.contains('button', 'Imprimir PDF')
      .click();

    cy.contains('button', 'Descargar PDF')
      .click();

    cy.get('#mesInicio')
      .click()
      .type('2025-12');

    cy.get('#mesFin')
      .click()
      .type('2026-01');

    cy.contains('button', 'Actualizar')
      .should('be.visible')
      .click();

    cy.contains('button', 'Imprimir PDF')
      .click();

    cy.contains('button', 'Descargar PDF')
      .click();
  });
});