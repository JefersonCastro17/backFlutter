import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:mercapleno_appv1/app/app.dart';
import 'package:mercapleno_appv1/core/network/api_client.dart';
import 'package:mercapleno_appv1/core/storage/session_storage.dart';

// Autenticación
import 'package:mercapleno_appv1/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:mercapleno_appv1/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:mercapleno_appv1/features/auth/presentation/controllers/auth_controller.dart';

// Ventas
import 'package:mercapleno_appv1/features/venta/presentation/providers/venta_provider.dart';

// Administración de Usuarios
import 'package:mercapleno_appv1/features/users_admin/data/datasources/users_admin_remote_data_source.dart';
import 'package:mercapleno_appv1/features/users_admin/data/repositories/users_admin_repository_impl.dart';
import 'package:mercapleno_appv1/features/users_admin/presentation/controllers/users_admin_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Carga segura de variables de entorno (.env) para evitar fallos si no existe el archivo.
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // Silencioso: si no existe .env se usarán los valores de compilación String.fromEnvironment.
  }

  // Instancia única y compartida de ApiClient para mantener coherencia en las cabeceras.
  final apiClient = ApiClient();

  // Módulo de Autenticación.
  final authRepository = AuthRepositoryImpl(
    remoteDataSource: AuthRemoteDataSource(apiClient: apiClient),
    sessionStorage: SessionStorage(),
  );
  final authController = AuthController(repository: authRepository);
  await authController.initialize();

  // Módulo de Administración de Usuarios.
  final usersRepository = UsersAdminRepositoryImpl(
    remoteDataSource: UsersAdminRemoteDataSource(apiClient: apiClient),
  );
  final usersController = UsersAdminController(repository: usersRepository);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authController),
        ChangeNotifierProvider.value(value: usersController),
        ChangeNotifierProvider(
          create: (_) => VentaProvider()..loadCatalogo(),
        ),
      ],
      child: MyApp(authController: authController),
    ),
  );
}
