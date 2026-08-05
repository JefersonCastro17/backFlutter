import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../../../src/email/email.service';
import { BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException, ConflictException } from '@nestjs/common';

import * as bcrypt from 'bcryptjs';


describe('AuthService (Unitarias)', () => {

  let authService: AuthService;
  let prismaService: PrismaService;
  let emailService: EmailService;
  let jwtService: JwtService;


  // beforeEach() se ejecuta ANTES de CADA prueba (it).
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService, 
        {
          provide: PrismaService,

          useValue: {
            usuarios: {
              // jest.fn() crea funciones simuladas vacías para que podamos espiar o alterar su comportamiento
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            intentos_login: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {

          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mocked_jwt_token'),
            verifyAsync: jest.fn(),
            verify: jest.fn(),
          },
        },
        {

          provide: EmailService,
          useValue: {
            // Simulamos sus funciones internas para no enviar correos reales
            sendVerificationCode: jest.fn(),
            sendLoginTwoFactorCode: jest.fn(),
            sendPasswordResetCode: jest.fn(),
          },
        },
      ],
    }).compile(); // Compilamos el módulo de pruebas




    // Obtenemos las instancias de los servicios desde el módulo compilado
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    jwtService = module.get<JwtService>(JwtService);
  });

  // afterEach() se ejecuta DESPUÉS de CADA prueba (it).
  afterEach(() => {
    // Limpiamos los "mocks" para que los datos de una prueba no interfieran en otra
    jest.clearAllMocks();
  });



  describe('Registro de Usuario', () => {

    const registerDto = {
      nombre: 'Test',
      apellido: 'User',
      email: 'test@example.com',
      password: 'Password123!',
      direccion: 'Test St',
      fecha_nacimiento: '2000-01-01',
      id_tipo_identificacion: 1,
      numero_identificacion: '1234567890',
    };


    // Casos CP-001, CP-006, CP-007
    it('debe registrar exitosamente, generar codigo y encriptar contraseña', async () => {
      // Espiamos el metodo 'bcrypt.hash' y simulamos que nos retorne la contraseña encriptada "hashed_password"
      const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password' as never);

      // Simulamos que al crear el usuario en BD, retorne el ID 1 exitosamente
      jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 } as any);

      // Simulamos el envío del correo electrónico exitosamente
      jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined as any);

      // Ejecutamos el método register() del servicio y esperamos el resultado
      const result = await authService.register(registerDto);

      // Verificamos que se haya encriptado la contraseña original con una dificultad de 10
      expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 10);



      // Verificamos que el usuario en la tabla 'usuarios'
      expect(prismaService.usuarios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // Verificamos que lo que se envio contenga la contraseña encriptada y un código aleatorio generado
          data: expect.objectContaining({
            password: 'hashed_password',
            email_verification_code: expect.any(String), // CP-006: valida que se guarde un código String
          }),
        }),
      );



      // Verificamos que se haya intentado enviar el correo electrónico
      expect(emailService.sendVerificationCode).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        emailSent: true, // Indica que el correo se pudo enviar correctamente
        requiresVerification: true,
        message: 'Usuario registrado. Enviamos un codigo de verificacion a tu correo.',
      });
    });


    // CP-002
    it('no debe permitir registrar un correo electrónico duplicado', async () => {
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        email: registerDto.email,
      } as any);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException
      );

      expect(prismaService.usuarios.create).not.toHaveBeenCalledWith({
        where: { email: registerDto.email },
        select: { id: true },
      });
    });


    // CP-003
    it('no debe permitir registrarse un número de identificación duplicado', async () =>{
      jest.spyOn(prismaService.usuarios, 'findFirst')
      .mockResolvedValueOnce(null) // Simula que no hay correo duplicado
      .mockResolvedValueOnce({
        id: 1,
      } as any); // Simula que hay número de identificación duplicado


    await expect(authService.register(registerDto)).rejects.toThrow(
      ConflictException
    );
    /*
    Validamos que se llame el email y despues el numero de identificacion,
    y que se haya llamado con los parametros correctos
    (Siguiendo la logica del codigo fuente)
    */
    expect(prismaService.usuarios.findFirst).toHaveBeenNthCalledWith(
      1,
      {
        where: { email: registerDto.email },
        select: { id: true },
      }
    )
    expect(prismaService.usuarios.findFirst).toHaveBeenNthCalledWith(
    2,
    {
      where: {
        numero_identificacion: registerDto.numero_identificacion,
      },
      select: { id: true },
    }
    )
    });



    // CP-008
    it('debe capturar error de email y retornar false', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password' as never);
      jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 } as any);

      // Simulamos que el EmailService falle arrojando un error (falla de envío)
      jest.spyOn(emailService, 'sendVerificationCode').mockRejectedValue(new Error('Email failed'));

      const result = await authService.register(registerDto);

      expect(result).toEqual({
        success: true,
        emailSent: false, // El correo falló
        requiresVerification: true,
        message: 'Usuario registrado, pero no se pudo enviar el correo. Usa reenviar codigo.',
      });
    });
  });




  describe('Verificar Correo Electrónico', () => {

    // CP-011
    it('debe arrojar BadRequestException si el código está expirado', async () => {
      // Simulamos que al buscar el usuario, lo encontramos pero su fecha esta expirada 
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        email_verified: false,
        email_verification_code: 'hashedcode',
        email_verification_expires: new Date(Date.now() - 10000), // Expirado
      } as any);

      // Se valida que el servicio arroje un error
      await expect(authService.verifyEmail({ email: 'test@test.com', code: '123456' })).rejects.toThrow(BadRequestException);
    });


    // CP-012
    it('debe retornar éxito si el correo ya está verificado', async () => {
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        email_verified: true, // Ya verificado
      } as any);

      // Llamamos al método
      const result = await authService.verifyEmail({ email: 'test@test.com', code: '123456' });

      expect(result).toEqual({
        success: true,
        message: 'El correo ya esta verificado.',
      });
    });


    

    // CP-013
    it('debe arrojar Error si hay un error en BD al verificar', async () => {
      // Simulamos que la base de datos se cae y arroja un error
      jest.spyOn(prismaService.usuarios, 'findFirst').mockRejectedValue(new Error('DB Error'));
      await expect(authService.verifyEmail({ email: 'test@test.com', code: '123456' })).rejects.toThrow(Error);
    });
  });


  describe('Reenviar Código de Verificación', () => {
    // CP-014
    it('debe reenviar exitosamente el código', async () => {
      // Simulamos que el usuario existe y no está verificado
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false } as any);
      // Simulamos éxito en la actualización del código en BD
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      // Simulamos éxito enviando el correo
      jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined as any);

      // Llamamos a la función
      const result = await authService.resendVerification({ email: 'test@test.com' });

      // Verificamos la respuesta exitosa
      expect(result).toEqual({
        success: true,
        message: 'Codigo reenviado. Revisa tu correo.',
      });
      // Verificamos que se modificó la DB y se envió el correo
      expect(prismaService.usuarios.update).toHaveBeenCalled();
      expect(emailService.sendVerificationCode).toHaveBeenCalled();
    });

    // CP-015
    it('debe arrojar NotFoundException si el correo no está registrado', async () => {
      // Simulamos que el usuario no existe en la base de datos (retorna null)
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);

      // Verificamos que lance la excepción NotFoundException
      await expect(authService.resendVerification({ email: 'noexist@test.com' })).rejects.toThrow(NotFoundException);
    });

    // CP-016
    it('debe retornar éxito sin enviar correo si ya está verificado', async () => {
      // Simulamos que el usuario ya está verificado
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: true } as any);
      
      // Llamamos al reenvío
      const result = await authService.resendVerification({ email: 'test@test.com' });

      // Validamos el éxito anticipado
      expect(result).toEqual({
        success: true,
        message: 'El correo ya esta verificado.',
      });
      // Validamos explícitamente que NO se haya intentado enviar ningún correo
      expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    // CP-017
    it('debe propagar excepción si falla el envío de correo', async () => {
      // Simulamos usuario válido
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false } as any);
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      // Forzamos el error al enviar el email
      jest.spyOn(emailService, 'sendVerificationCode').mockRejectedValue(new Error('Mail Error'));

      // Verificamos que se arroje un Error nativo (no capturado por try-catch que mapee)
      await expect(authService.resendVerification({ email: 'test@test.com' })).rejects.toThrow(Error);
    });

    // CP-018
    it('debe arrojar Error si falla la actualización en BD', async () => {
      // Simulamos que la BD falla al actualizar el registro
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false } as any);
      jest.spyOn(prismaService.usuarios, 'update').mockRejectedValue(new Error('DB Error'));

      // Verificamos el error propagado
      await expect(authService.resendVerification({ email: 'test@test.com' })).rejects.toThrow(Error);
    });
  });

  // describe() agrupa las pruebas de Inicio de Sesión
  describe('Inicio de Sesión', () => {
    // Declaramos un DTO para el inicio de sesión
    const loginDto = { email: 'test@example.com', password: 'Password123!' };

    // CP-020
    it('debe arrojar ForbiddenException si la contraseña es incorrecta (usando bcrypt)', async () => {
      // Simulamos encontrar al usuario activo y verificado en la base de datos
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ 
        id: 1, 
        password: 'hashed_password', // Contraseña hasheada en la BD
        id_rol: 1,
        email_verified: true
      } as any);
      // Forzamos a bcrypt para que diga que la contraseña comparada es incorrecta (false)
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      jest.spyOn((prismaService as any).intentos_login, 'findUnique').mockResolvedValue(null);

      // Verificamos que se arroje la excepción 'ForbiddenException' por mala contraseña
      await expect(authService.login(loginDto)).rejects.toThrow(ForbiddenException);
      // Validamos que se usó bcrypt para comparar la contraseña plana contra la hasheada
      expect(compareSpy).toHaveBeenCalledWith(loginDto.password, 'hashed_password');
    });

    // CP-024
    it('debe arrojar Error si hay error de BD en login', async () => {
      // Simulamos un error grave de conexión a base de datos
      jest.spyOn(prismaService.usuarios, 'findFirst').mockRejectedValue(new Error('DB Error'));

      // Validamos que el servicio propaga ese Error
      await expect(authService.login(loginDto)).rejects.toThrow(Error);
    });
  });

  // describe() agrupa los escenarios para el factor de autenticación doble (2FA)
  describe('Doble Factor (2FA)', () => {
    // CP-027
    it('debe generar códigos estadísticamente diferentes', () => {
      // Obtenemos una referencia interna al método privado 'generateCode' para probarlo aisladamente
      const generateCode = (authService as any).generateCode.bind(authService);
      const codes = new Set();
      // Generamos 20 códigos aleatorios
      for (let i = 0; i < 20; i++) {
        codes.add(generateCode()); // Lo guardamos en un 'Set' que elimina duplicados automáticamente
      }
      // Aseguramos que haya al menos más de 1 único (demuestra aleatoriedad)
      expect(codes.size).toBeGreaterThan(1); 
    });

    // CP-028
    it('debe establecer una expiración futura válida para el código 2FA', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockResolvedValue(undefined as any);
      
      // Llamamos al método privado que crea el reto 2FA para el usuario
      const res = await (authService as any).createLoginTwoFactorChallenge(user);
      
      // Aseguramos que se llamó a Prisma estableciendo una expiración que sea de tipo Fecha (Date)
      expect(prismaService.usuarios.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            login_two_factor_expires: expect.any(Date),
          }),
        }),
      );
      // Comprobamos que retorna algún resultado
      expect(res).toBeDefined();
    });

    // CP-029
    it('debe limpiar el código y arrojar error 500 si falla el correo de 2FA', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      // Simulamos el fallo de envío de correo
      jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockRejectedValue(new Error('Mail Error'));
      
      // Espiamos la limpieza de credenciales 2FA del servidor (para evitar códigos atrapados en BD)
      const clearSpy = jest.spyOn(authService as any, 'clearLoginTwoFactorChallenge').mockResolvedValue({});

      // Esperamos que lanzar la creación lance un error
      await expect((authService as any).createLoginTwoFactorChallenge(user)).rejects.toThrow(InternalServerErrorException);
      // Comprobamos que el sistema sí mandó a limpiar el challenge en base de datos
      expect(clearSpy).toHaveBeenCalledWith(1);
    });

    // CP-030
    it('debe arrojar error si falla Prisma al actualizar 2FA', async () => {
      const user = { id: 1, email: 'test@test.com' } as any;
      // Simulamos fallo en BD al actualizar 2FA
      jest.spyOn(prismaService.usuarios, 'update').mockRejectedValue(new Error('DB Error'));

      // Propaga el error
      await expect((authService as any).createLoginTwoFactorChallenge(user)).rejects.toThrow(Error);
    });

    // CP-033
    it('debe arrojar BadRequestException si el código 2FA expiró', async () => {
      // Creamos un objeto de usuario simulado donde la fecha de expiración del 2FA caducó hace tiempo
      const expiredUser = {
        id: 1,
        login_two_factor_code: 'hashed',
        login_two_factor_expires: new Date(Date.now() - 10000), // Expirado
      };
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(expiredUser as any);
      // Simulamos la limpieza del código en BD si expira
      jest.spyOn(authService as any, 'clearLoginTwoFactorChallenge').mockResolvedValue({});
      
      // Simulamos que el JwtService considera válido y extrae la información requerida del Token Temporal (pendingToken)
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1, email: 'test@test.com', id_rol: 1, token_type: 'login_2fa' });

      // Ejecuta la validación y asegura que tire BadRequestException
      await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '123456' })).rejects.toThrow(BadRequestException);
    });

    // CP-035
    it('debe arrojar Error si falla la BD al validar 2FA', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1, email: 'test@test.com', id_rol: 1, token_type: 'login_2fa' });
      // Si la BD falla durante la consulta inicial
      jest.spyOn(prismaService.usuarios, 'findFirst').mockRejectedValue(new Error('DB Error'));

      // Debería propagar un Error
      await expect(authService.verifyLoginCode({ pendingToken: 'tok', code: '123' })).rejects.toThrow(Error);
    });
  });

  // describe() agrupa las pruebas relacionadas con Recuperación de Contraseña
  describe('Solicitar Recuperación de Contraseña', () => {
    // CP-036
    it('debe generar código y enviar correo exitosamente', async () => {
      // Simulamos que el correo sí pertenece a un usuario en BD
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      jest.spyOn(emailService, 'sendPasswordResetCode').mockResolvedValue(undefined as any);

      // Solicitamos restablecimiento
      const result = await authService.requestPasswordReset({ email: 'test@test.com' });

      // Verificamos el mensaje estándar enviado al front-end por seguridad (no revela existencia del correo real)
      expect(result).toEqual({
        success: true,
        message: 'Si el correo existe, se envio un codigo.',
      });
      // Verificamos que se guardó en BD y se envió el correo de reseteo
      expect(prismaService.usuarios.update).toHaveBeenCalled();
      expect(emailService.sendPasswordResetCode).toHaveBeenCalled();
    });

    // CP-037
    it('debe retornar mismo mensaje genérico si el correo no existe', async () => {
      // Simulamos un escenario donde un hacker intenta correos y Prisma retorna 'null' (no existe)
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);

      const result = await authService.requestPasswordReset({ email: 'noexist@test.com' });

      // Debe arrojar exáctamente el mismo mensaje genérico de éxito, para prevenir enumeración de correos.
      expect(result).toEqual({
        success: true,
        message: 'Si el correo existe, se envio un codigo.',
      });
      // PERO sabemos que internamente, no se llamó nunca a la base de datos para modificar
      expect(prismaService.usuarios.update).not.toHaveBeenCalled();
    });

    // CP-039
    it('debe arrojar error si falla el envío de correo de recuperación', async () => {
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1 } as any);
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);
      // Falla el servicio de correo
      jest.spyOn(emailService, 'sendPasswordResetCode').mockRejectedValue(new Error('Mail Error'));

      await expect(authService.requestPasswordReset({ email: 'test@test.com' })).rejects.toThrow(Error);
    });

    // CP-040
    it('debe arrojar error si falla Prisma al guardar código de recuperación', async () => {
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1 } as any);
      // Falla base de datos
      jest.spyOn(prismaService.usuarios, 'update').mockRejectedValue(new Error('DB error'));

      await expect(authService.requestPasswordReset({ email: 'test@test.com' })).rejects.toThrow(Error);
    });
  });

  // describe() sobre validación y reinicio final de contraseña
  describe('Restablecer Contraseña', () => {
    // Declaramos DTO que envía la nueva clave
    const resetDto = { email: 'test@test.com', code: '123456', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' };
    
    // CP-041
    it('debe restablecer la contraseña exitosamente', async () => {
      // Espiamos nuestro propio código interno para simplificar el proceso matemático de verificación (hashcode de códigos numéricos)
      jest.spyOn(authService as any, 'hashCode').mockReturnValue('hashed_code');
      // Simulamos que el usuario tiene el mismo 'hashed_code' en la BD
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        password_reset_code: 'hashed_code',
        password_reset_expires: new Date(Date.now() + 10000), // Todavía válido
      } as any);
      // Simulamos la nueva encriptación
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new_hash' as never);
      jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({} as any);

      // Enviamos acción
      const result = await authService.resetPassword(resetDto);

      // Verificamos respuesta afirmativa
      expect(result).toEqual({
        success: true,
        message: 'Contrasena actualizada correctamente.',
      });
      // Verificamos que se actualice la DB enviando los valores 'null' (limpiando tokens) y el 'new_hash' de contraseña
      expect(prismaService.usuarios.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            password: 'new_hash',
            password_reset_code: null,
            password_reset_expires: null,
          }
        })
      );
    });

    // CP-042
    it('debe arrojar ForbiddenException si el código es inválido', async () => {
      jest.spyOn(authService as any, 'hashCode').mockReturnValue('hashed_code');
      // Usuario tiene guardado 'different_hash' (No coinciden)
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        password_reset_code: 'different_hash',
        password_reset_expires: new Date(Date.now() + 10000),
      } as any);

      // Lanza excepción de prohibido (ForbiddenException)
      await expect(authService.resetPassword(resetDto)).rejects.toThrow(ForbiddenException);
    });

    // CP-043
    it('debe arrojar BadRequestException si el código expiró', async () => {
      jest.spyOn(authService as any, 'hashCode').mockReturnValue('hashed_code');
      // Fecha en pasado
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        password_reset_code: 'hashed_code',
        password_reset_expires: new Date(Date.now() - 10000), // Expirado
      } as any);

      await expect(authService.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
    });

    // CP-046
    it('debe arrojar Error si falla la BD al actualizar contraseña', async () => {
      jest.spyOn(authService as any, 'hashCode').mockReturnValue('hashed_code');
      jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
        id: 1,
        password_reset_code: 'hashed_code',
        password_reset_expires: new Date(Date.now() + 10000),
      } as any);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new_hash' as never);
      jest.spyOn(prismaService.usuarios, 'update').mockRejectedValue(new Error('DB Error'));

      await expect(authService.resetPassword(resetDto)).rejects.toThrow(Error);
    });
  });

  // describe() sobre el cierre de sesión
  describe('Cerrar Sesión', () => {
    // CP-047
    it('debe retornar el mensaje de éxito para logout stateless', async () => {
      const result = await authService.logout();
      // Debido a que JWT es "stateless", cerrar sesión es meramente lógico por parte del front-end. 
      // Por eso el back-end solo envía confirmación.
      expect(result).toEqual({
        success: true,
        message: 'Sesion cerrada (token invalidado por el cliente)',
      });
    });
  });
});
