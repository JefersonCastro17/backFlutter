import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mercapleno_appv1/core/theme/app_theme.dart';
import 'package:mercapleno_appv1/features/auth/presentation/controllers/auth_controller.dart';
import 'package:mercapleno_appv1/features/auth/presentation/pages/auth_route_args.dart';
import 'package:mercapleno_appv1/features/auth/presentation/pages/login_page.dart';
import 'package:mercapleno_appv1/features/auth/presentation/pages/register_page.dart';
import 'package:mercapleno_appv1/features/home/presentation/pages/home_page.dart';
import 'package:mercapleno_appv1/features/home/presentation/pages/landing_page.dart';
import 'package:mercapleno_appv1/features/venta/presentation/pages/carrito_page.dart';
import 'package:mercapleno_appv1/features/users_admin/presentation/controllers/users_admin_controller.dart';
import 'package:mercapleno_appv1/features/users_admin/presentation/pages/users_admin_list_page.dart';
import 'package:mercapleno_appv1/features/users_admin/presentation/pages/user_form_page.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.authController});

  final AuthController authController;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Mercapleno',
      theme: AppTheme.light(),
      home: AnimatedBuilder(
        animation: authController,
        builder: (context, _) {
          // La app raiz escucha el estado auth y decide que zona mostrar.
          if (authController.isInitializing) {
            return const _SplashPage();
          }

          if (authController.isAuthenticated) {
            return HomePage(controller: authController);
          }

          return LandingPage(controller: authController);
        },
      ),
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case LoginPage.routeName:
            final args = settings.arguments as LoginPageArgs;
            return MaterialPageRoute(
              builder: (_) => LoginPage(
                controller: args.controller,
                prefilledEmail: args.prefilledEmail,
                infoMessage: args.infoMessage,
              ),
            );
          case RegisterPage.routeName:
            final args = settings.arguments as RegisterPageArgs;
            return MaterialPageRoute(
              builder: (_) => RegisterPage(
                controller: args.controller,
                prefilledEmail: args.prefilledEmail,
              ),
            );
          case '/carrito':
            return MaterialPageRoute(
              builder: (_) => const CarritoPage(),
            );
          case UsersAdminListPage.routeName:
            return MaterialPageRoute(
              builder: (context) => UsersAdminListPage(
                usersController: Provider.of<UsersAdminController>(context, listen: false),
                authController: Provider.of<AuthController>(context, listen: false),
              ),
            );
          case UserFormPage.routeName:
            final args = settings.arguments as UserFormPageArgs;
            return MaterialPageRoute(
              builder: (_) => UserFormPage(
                usersController: args.usersController,
                authController: args.authController,
                userToEdit: args.userToEdit,
              ),
            );
          default:
            return null;
        }
      },
    );
  }
}

class _SplashPage extends StatelessWidget {
  const _SplashPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0B4A8B), Color(0xFF123C63), Color(0xFFF4F7FB)],
          ),
        ),
        child: const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFFF4A300)),
              SizedBox(height: 16),
              Text(
                'Cargando Mercapleno...',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
